import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { schemaExport } from '../../db/export/schema-export';
import { DEFAULT_SQL_OPTIONS } from '../../db/export/types';
import { shopDeck } from '../../db/fixtures/shop';
import { edits, shopText } from '../../db/fixtures/sync/shop-edits';
import { createParsers } from '../../db/import/load-parsers';
import { readDbml } from '../../db/import/read-dbml';
import { createSessionMemory } from '../../db/sync/session-memory';
import {
  DBML_APPLY_PAUSE_MS,
  DBML_BURST_IDLE_MS,
  DbmlSession,
  type SessionView,
} from './dbml-session';

const parsers = createParsers();
const read = async (text: string) => {
  const result = readDbml(text, await parsers.dbml());
  return { schema: result.raw, problems: result.problems };
};

const writerOf = (deck: SododeckFile) => {
  const out = schemaExport(deck, {
    format: 'dbml',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  });
  return {
    text: out.text,
    tableIds: deck.nodes.filter((n) => n.type === 'db-table').map((n) => n.id),
  };
};

let counter = 0;

function setup(options: { scope?: 'schema' | 'selection'; selection?: string[] } = {}) {
  const doc = fromJSON(shopDeck('postgres'));
  const editor = createEditor(doc, { captureTimeout: 5 });
  const state = { text: '' };
  const views: SessionView[] = [];
  const removed: { id: string; name: string }[][] = [];
  const added: string[][] = [];
  const session = new DbmlSession({
    editor,
    getDeck: () => toJSON(doc),
    readDbml: read,
    io: {
      getText: () => state.text,
      setText: (text) => {
        state.text = text;
      },
    },
    newId: (prefix) => `${prefix}.s${String(counter++)}`,
    viewport: () => ({ x: 0, y: 0, width: 1000, height: 600 }),
    memory: createSessionMemory(),
    onChange: (view) => views.push(view),
    onRemoved: (r) => removed.push(r),
    onAdded: (a) => added.push(a),
    sessionId: 't',
  });
  session.setScope(options.scope ?? 'schema');
  session.writerChanged(writerOf(toJSON(doc)));
  const type = (text: string) => {
    state.text = text;
    session.typed();
  };
  const wait = async (state_: SessionView['state']) => {
    await vi.advanceTimersByTimeAsync(DBML_APPLY_PAUSE_MS);
    await vi.waitFor(() => {
      expect(session.view().state).toBe(state_);
    });
  };
  return { doc, editor, session, state, views, removed, added, type, wait };
}

const column = (doc: ReturnType<typeof setup>['doc'], table: string, name: string) =>
  toJSON(doc)
    .nodes.find((n) => n.title === table)
    ?.columns?.find((c) => c.name === name);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DbmlSession', () => {
  it('starts synced with the writer’s text in the editor', () => {
    const { state, session } = setup();
    expect(session.view().state).toBe('synced');
    expect(state.text).toBe(shopText());
  });

  it('applies 500 ms after typing stops, and says so', async () => {
    const { doc, session, type, wait, views } = setup();
    session.setFocused(true);
    type(edits.addColumn(shopText()));
    expect(session.view().state).toBe('dirty');
    await vi.advanceTimersByTimeAsync(DBML_APPLY_PAUSE_MS - 10);
    expect(column(doc, 'orders', 'discount_cents')).toBeUndefined();
    await wait('applied');
    expect(column(doc, 'orders', 'discount_cents')).toMatchObject({
      type: 'integer',
      notNull: true,
    });
    expect(views.map((v) => v.state)).toEqual(['dirty', 'applied']);
  });

  it('is synced, not applied, when the editor has no focus', async () => {
    const { session, type, wait } = setup();
    expect(session.view().state).toBe('synced');
    type(edits.addColumn(shopText()));
    await wait('synced');
  });

  it('restarts the pause on every keystroke', async () => {
    const { doc, type, wait } = setup();
    type(edits.addColumn(shopText()));
    await vi.advanceTimersByTimeAsync(400);
    type(edits.addColumn(shopText()));
    await vi.advanceTimersByTimeAsync(400);
    expect(column(doc, 'orders', 'discount_cents')).toBeUndefined();
    await wait('synced');
    expect(column(doc, 'orders', 'discount_cents')).toBeDefined();
  });

  it('keeps ids when a table is renamed', async () => {
    const { doc, type, wait } = setup();
    const before = toJSON(doc).nodes.find((n) => n.title === 'customers');
    type(edits.renameTable(shopText()));
    await wait('synced');
    expect(toJSON(doc).nodes.find((n) => n.title === 'clients')?.id).toBe(before?.id);
  });

  describe('errors', () => {
    it('shows them, writes nothing, and applies once fixed', async () => {
      const { doc, session, type, wait } = setup();
      session.setFocused(true);
      const before = toJSON(doc);
      type(edits.typo(shopText()));
      await wait('invalid');
      expect(session.view().problems.some((p) => p.severity === 'error')).toBe(true);
      expect(toJSON(doc)).toEqual(before);
      type(edits.addColumn(shopText()));
      expect(session.view().state).toBe('dirty');
      await wait('applied');
      expect(column(doc, 'orders', 'discount_cents')).toBeDefined();
    });

    it('keeps warnings with an applied state', async () => {
      const { session, type, wait } = setup();
      session.setFocused(true);
      type(edits.tableGroup(shopText()));
      await wait('applied');
      expect(session.view().problems.map((p) => [p.code, p.severity])).toEqual([
        ['not-an-input', 'warning'],
      ]);
    });

    it('discards unapplied text on blur', async () => {
      const { session, state, type, wait } = setup();
      session.setFocused(true);
      type(edits.typo(shopText()));
      await wait('invalid');
      session.setFocused(false);
      expect(session.view()).toMatchObject({ state: 'synced', problems: [] });
      expect(state.text).toBe(shopText());
    });
  });

  describe('removals', () => {
    it('reports the removed table and brings it back when typed again', async () => {
      const { doc, session, state, removed, type, wait } = setup();
      const before = toJSON(doc).nodes.find((n) => n.title === 'shipments');
      type(edits.removeTable(shopText()));
      await wait('synced');
      expect(removed).toEqual([[{ id: before?.id, name: 'shipments' }]]);
      expect(toJSON(doc).nodes.find((n) => n.title === 'shipments')).toBeUndefined();
      // The writer's text follows (nothing pending), then the user types the block back.
      session.writerChanged(writerOf(toJSON(doc)));
      type(shopText());
      await wait('synced');
      expect(toJSON(doc).nodes.find((n) => n.title === 'shipments')?.id).toBe(before?.id);
      expect(state.text).toBe(shopText());
    });

    it('asks first before removing every table, and removes nothing until Apply', async () => {
      const { doc, session, removed, type, wait } = setup();
      session.setFocused(true);
      const count = toJSON(doc).nodes.filter((n) => n.type === 'db-table').length;
      type('');
      await wait('confirm');
      expect(session.view().confirmCount).toBe(count);
      expect(toJSON(doc).nodes.filter((n) => n.type === 'db-table')).toHaveLength(count);
      session.applyConfirmed();
      expect(toJSON(doc).nodes.filter((n) => n.type === 'db-table')).toHaveLength(0);
      expect(removed[0]).toHaveLength(count);
      expect(session.view().state).toBe('applied');
    });

    it('goes back to dirty when the user types during the confirmation', async () => {
      const { session, type, wait } = setup();
      session.setFocused(true);
      type('');
      await wait('confirm');
      type(shopText());
      expect(session.view().state).toBe('dirty');
    });
  });

  describe('undo bursts', () => {
    it('one undo takes back a whole burst of typing', async () => {
      const original = shopDeck('postgres');
      const { doc, editor, session, type, wait } = setup();
      session.setFocused(true);
      type(edits.addColumn(shopText()));
      await wait('applied');
      await vi.advanceTimersByTimeAsync(1200);
      type(edits.renameTable(edits.addColumn(shopText())));
      await wait('applied');
      expect(editor.undo()).toBe(true);
      expect(toJSON(doc)).toEqual(original);
      expect(editor.canUndo()).toBe(false);
    });

    it('starts a new step after 2 s without typing', async () => {
      const { doc, editor, session, type, wait } = setup();
      session.setFocused(true);
      type(edits.addColumn(shopText()));
      await wait('applied');
      await vi.advanceTimersByTimeAsync(DBML_BURST_IDLE_MS);
      type(edits.renameTable(edits.addColumn(shopText())));
      await wait('applied');
      editor.undo();
      expect(toJSON(doc).nodes.find((n) => n.title === 'customers')).toBeDefined();
      expect(column(doc, 'orders', 'discount_cents')).toBeDefined();
    });

    it('starts a new step after blur and after another local write', async () => {
      const { session, type, wait } = setup();
      session.setFocused(true);
      const first = session.mergeKey();
      type(edits.addColumn(shopText()));
      await wait('applied');
      expect(session.mergeKey()).toBe(first);
      session.setFocused(false);
      const second = session.mergeKey();
      expect(second).not.toBe(first);
      session.setFocused(true);
      session.deckChanged('local');
      expect(session.mergeKey()).not.toBe(second);
    });

    it('does not end the burst for its own writes or a remote change', async () => {
      const { session, type, wait } = setup();
      session.setFocused(true);
      const key = session.mergeKey();
      type(edits.addColumn(shopText()));
      await wait('applied');
      session.deckChanged('remote');
      expect(session.mergeKey()).toBe(key);
    });
  });

  describe('the text follows the deck', () => {
    it('rewrites the text from the writer while synced', () => {
      const { doc, session, state } = setup();
      const next = { ...toJSON(doc) };
      next.nodes = next.nodes.map((n) => (n.title === 'users' ? { ...n, title: 'people' } : n));
      session.writerChanged(writerOf(next));
      expect(state.text).toContain('Table people {');
    });

    it('keeps typing: dirty, invalid and confirm ignore the writer', async () => {
      const { doc, session, state, type, wait } = setup();
      session.setFocused(true);
      type(edits.typo(shopText()));
      expect(session.view().state).toBe('dirty');
      session.writerChanged({ ...writerOf(toJSON(doc)), text: 'writer text' });
      expect(state.text).toBe(edits.typo(shopText()));
      await wait('invalid');
      session.writerChanged({ ...writerOf(toJSON(doc)), text: 'writer text' });
      expect(state.text).toBe(edits.typo(shopText()));
    });

    it('keeps the applied text while focused and rewrites it on blur', async () => {
      const { doc, session, state, type, wait } = setup();
      session.setFocused(true);
      const typed = `${edits.addColumn(shopText())}\n// my comment\n`;
      type(typed);
      await wait('applied');
      session.writerChanged(writerOf(toJSON(doc)));
      expect(state.text).toBe(typed);
      session.setFocused(false);
      expect(state.text).toBe(writerOf(toJSON(doc)).text);
      expect(session.view().state).toBe('synced');
    });

    it('rewrites the text after an undo, whatever was pending', async () => {
      const { doc, session, state, type, wait } = setup();
      session.setFocused(true);
      type(edits.addColumn(shopText()));
      await wait('applied');
      session.deckChanged('undo');
      expect(session.view().state).toBe('synced');
      session.writerChanged(writerOf(toJSON(doc)));
      expect(state.text).toBe(writerOf(toJSON(doc)).text);
    });

    it('plans against the deck as it is when the pause ends, not as it was when typing began', async () => {
      const { doc, editor, session, type, wait } = setup();
      session.setFocused(true);
      type(edits.addColumn(shopText()));
      // Another surface adds a table before the pause is over; the text lacks it.
      editor.update('nodes', 'users', { title: 'people' });
      session.deckChanged('local');
      await wait('applied');
      // The text still says `users`, which is what it expresses: the next apply plans against the
      // new snapshot, so it renames the table back instead of failing on a stale plan.
      expect(toJSON(doc).nodes.find((n) => n.id === 'users')?.title).toBe('users');
    });
  });

  describe('Selection scope', () => {
    it('adds new tables to the baseline, so the next apply does not see a clash', async () => {
      const ids = ['orders', 'order_items'];
      const { doc, session, state, added, type, wait } = setup({ scope: 'selection' });
      const deck = toJSON(doc);
      const text = schemaExport(deck, {
        format: 'dbml',
        scope: { kind: 'selection', tableIds: ids },
        dialect: null,
        sql: DEFAULT_SQL_OPTIONS,
      }).text;
      session.writerChanged({ text, tableIds: ids });
      expect(state.text).toBe(text);
      session.setFocused(true);
      const withNote = `${text.trimEnd()}\n\nTable notes {\n  id int [pk]\n}\n`;
      type(withNote);
      await wait('applied');
      expect(added).toHaveLength(1);
      type(`${withNote.trimEnd()}\n// again\n`);
      await wait('applied');
      expect(session.view().problems.filter((p) => p.severity === 'error')).toEqual([]);
      expect(toJSON(doc).nodes.filter((n) => n.title === 'notes')).toHaveLength(1);
    });
  });
});
