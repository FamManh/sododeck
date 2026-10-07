import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import type * as Y from 'yjs';

import {
  applyDeckText,
  applyFile,
  createDeckSnapshot,
  createEditor,
  getObject,
  inspectDeckText,
  loadDeck,
  observeDeck,
  serializeDeck,
  toJSON,
  type ApplyResult,
  type DeckChange,
} from '../src';
import { readExample } from './helpers';

const full = await readExample('full.sododeck.json');
const origin = { test: 'host' };

/** The full example opened, with every change event and a snapshot recorded. */
function open(file: SododeckFile = full) {
  const { doc } = loadDeck(file);
  const changes: DeckChange[] = [];
  observeDeck(doc, (change) => changes.push(change));
  const snapshot = createDeckSnapshot(doc);
  return { doc, changes, snapshot };
}

/** A deep copy of `file` changed by `edit`. */
function edited(edit: (file: SododeckFile) => void, file: SododeckFile = full): SododeckFile {
  const copy = structuredClone(file);
  edit(copy);
  return copy;
}

function applied(result: ApplyResult) {
  if (result.status !== 'applied') throw new Error('expected the file to be applied');
  return result;
}

const nodeOf = (file: SododeckFile, id: string) => {
  const found = file.nodes.find((n) => n.id === id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
};

/** The deck reads exactly as loading the file would (FR-014). */
function expectLoaded(doc: Y.Doc, file: SododeckFile): void {
  expect(serializeDeck(doc)).toBe(serializeDeck(loadDeck(file).doc));
}

describe('applyFile: an outside change appears in place (066 US1)', () => {
  it('renames one card: one change naming it, every other stored map and snapshot kept', () => {
    const { doc, changes, snapshot } = open();
    const nodes = doc.getMap('nodes');
    const before = new Map([...nodes.entries()]);
    const snapBefore = snapshot.get();
    const file = edited((f) => {
      nodeOf(f, 'order-svc').title = 'Orders';
    });

    const result = applied(applyFile(doc, file, origin));

    expect(result.changed).toBe(true);
    expect(result.summary).toEqual({ nodes: { added: 0, changed: 1, removed: 0 } });
    expect(changes).toEqual([
      {
        origin: 'remote',
        changes: [{ scope: 'nodes', id: 'order-svc', kind: 'updated', keys: ['title'] }],
      },
    ]);
    for (const [id, map] of before) expect(nodes.get(id)).toBe(map);
    const snapAfter = snapshot.get();
    expect(snapAfter.edges).toBe(snapBefore.edges);
    expect(snapAfter.nodes.find((n) => n.id === 'api-gateway')).toBe(
      snapBefore.nodes.find((n) => n.id === 'api-gateway'),
    );
    expectLoaded(doc, file);
  });

  it('adds a connector and removes a note: summary says so and nothing else', () => {
    const { doc, changes } = open();
    const file = edited((f) => {
      f.edges.push({ id: 'e-new', from: 'order-svc', to: 'dispatch-svc' });
      f.stickies = f.stickies.filter((s) => s.id !== 'note-1');
    });
    const result = applied(applyFile(doc, file, origin));
    expect(result.summary).toEqual({
      edges: { added: 1, changed: 0, removed: 0 },
      stickies: { added: 0, changed: 0, removed: 1 },
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.changes).toEqual([
      { scope: 'edges', id: 'e-new', kind: 'added', keys: [] },
      { scope: 'stickies', id: 'note-1', kind: 'removed', keys: [] },
    ]);
    expectLoaded(doc, file);
  });

  it('changes a step text, a rule cell and a table column type, naming child and key', () => {
    const { doc, changes } = open();
    const file = edited((f) => {
      const step = f.flows[0]?.steps[1];
      if (step !== undefined) step.description = 'Validated in place.';
      const row = f.rules['delivery-tier']?.rows[0];
      if (row !== undefined) row.when[0] = '< 3';
      const column = nodeOf(f, 'customers').columns?.[1];
      if (column !== undefined) column.type = 'text';
    });
    const result = applied(applyFile(doc, file, origin));
    expect(result.summary).toEqual({
      nodes: { added: 0, changed: 1, removed: 0 },
      flows: { added: 0, changed: 1, removed: 0 },
      rules: { added: 0, changed: 1, removed: 0 },
    });
    expect(changes[0]?.changes).toEqual([
      { scope: 'nodes', id: 'customers', kind: 'updated', keys: ['columns'] },
      {
        scope: 'flows',
        id: 'place-order',
        child: { kind: 'step', id: 's2' },
        kind: 'updated',
        keys: ['description'],
      },
      {
        scope: 'rules',
        id: 'delivery-tier',
        child: { kind: 'row', id: 'r1' },
        kind: 'updated',
        keys: ['when'],
      },
    ]);
    expectLoaded(doc, file);
  });

  it('moves a step, a rule row, a table column and a view to the file’s order', () => {
    const { doc, changes } = open();
    const move = (list: unknown[] | undefined, from: number, to: number) => {
      if (list === undefined) return;
      const [item] = list.splice(from, 1);
      if (item !== undefined) list.splice(to, 0, item);
    };
    const file = edited((f) => {
      move(f.flows[0]?.steps, 4, 1);
      move(f.rules['delivery-tier']?.rows, 4, 0);
      move(nodeOf(f, 'customers').columns, 2, 0);
      move(f.views, 4, 0);
    });
    applied(applyFile(doc, file, origin));
    expect(toJSON(doc)).toEqual(toJSON(loadDeck(file).doc));
    const list = changes[0]?.changes ?? [];
    // One reported change per moved item: untouched siblings report nothing.
    expect(list.map((c) => [c.scope, c.child?.kind ?? '', c.keys])).toEqual([
      ['nodes', '', ['columns']],
      ['views', '', []],
      ['flows', 'step', []],
      ['rules', 'row', []],
    ]);
  });

  it('applies the same file twice: the second writes nothing and emits nothing (FR-007)', () => {
    const { doc, changes } = open();
    const file = edited((f) => {
      f.name = 'Renamed deck';
    });
    applied(applyFile(doc, file, origin));
    const seen = changes.length;
    let updates = 0;
    doc.on('update', () => updates++);
    const again = applied(applyFile(doc, file, origin));
    expect(again.changed).toBe(false);
    expect(again.summary).toEqual({});
    expect(changes).toHaveLength(seen);
    expect(updates).toBe(0);
  });

  it('applies a move and an unlock to a locked card (FR-017)', () => {
    const { doc } = open();
    expect(getObject(doc, 'nodes', 'delivery-platform')?.locked).toBe(true);
    const file = edited((f) => {
      const card = nodeOf(f, 'delivery-platform');
      card.position = { x: 999, y: 111 };
      delete card.locked;
    });
    applied(applyFile(doc, file, origin));
    const card = getObject(doc, 'nodes', 'delivery-platform');
    expect(card?.position).toEqual({ x: 999, y: 111 });
    expect(card).not.toHaveProperty('locked');
  });

  it('applies every kind of deck metadata change as one changed meta', () => {
    const { doc } = open();
    const file = edited((f) => {
      f.name = 'Other';
      f.description = 'Another description.';
      f.packs = ['architecture', 'database'];
      f.tagColors = { ...f.tagColors, extra: '#123456' };
      f.swatches = ['#abcdef'];
      f.dialect = 'mysql';
      delete f.groupingMode;
      f.canvasBackground = { pattern: 'grid' };
      const field = f.fields?.[0];
      if (field !== undefined) field.name = 'Load';
      f.fields?.push({
        id: 'task.size',
        name: 'Size',
        kind: 'select',
        types: ['service'],
        options: [{ id: 'opt-s', label: 'S' }],
      });
      const enumeration = f.enums?.[0];
      enumeration?.values.push({ id: 'enumval-new', name: 'pending' });
      f.fieldDefaults = [];
    });
    const result = applied(applyFile(doc, file, origin));
    expect(result.summary).toEqual({ meta: { added: 0, changed: 1, removed: 0 } });
    expectLoaded(doc, file);
  });

  it('applies an id that moves from one collection to another', () => {
    const { doc } = open();
    const file = edited((f) => {
      f.stickies = f.stickies.filter((s) => s.id !== 'note-1');
      f.groups.push({ id: 'note-1', title: 'Was a note' });
    });
    const result = applied(applyFile(doc, file, origin));
    expect(result.summary.stickies?.removed).toBe(1);
    expect(result.summary.groups?.added).toBe(1);
    expectLoaded(doc, file);
  });

  it('throws a TypeError for an editor origin and writes nothing (FR-016)', () => {
    const { doc, changes } = open();
    const editor = createEditor(doc);
    let editorOrigin: unknown;
    doc.on('afterTransaction', (transaction: Y.Transaction) => {
      editorOrigin ??= transaction.origin;
    });
    editor.update('nodes', 'order-svc', { title: 'Typed' });
    const seen = changes.length;
    const before = toJSON(doc);
    const file = edited((f) => {
      f.name = 'Never';
    });
    expect(() => applyFile(doc, file, editorOrigin as object)).toThrow(TypeError);
    expect(toJSON(doc)).toEqual(before);
    expect(changes).toHaveLength(seen);
    editor.destroy();
  });

  it('accepts a prepared deck without validating it again', async () => {
    const { prepareDeck } = await import('../src');
    const { doc } = open();
    const file = edited((f) => {
      f.name = 'Prepared';
    });
    applied(applyFile(doc, prepareDeck(file), origin));
    expect(toJSON(doc).name).toBe('Prepared');
  });
});

describe('applyFile: a broken file is refused, not half-applied (066 US3)', () => {
  const broken: [string, (file: SododeckFile) => void][] = [
    [
      'a duplicate card id',
      (f) => {
        f.nodes.push({ id: 'order-svc', type: 'service', title: 'Twin' });
      },
    ],
    [
      'a missing required title',
      (f) => {
        delete (f.nodes[0] as Partial<SododeckFile['nodes'][number]>).title;
      },
    ],
    [
      'a rule row with too few cells',
      (f) => {
        f.rules['delivery-tier']?.rows[0]?.when.pop();
      },
    ],
    [
      'a newer format version',
      (f) => {
        (f as { version: number }).version = 2;
      },
    ],
  ];

  it.each(broken)('refuses %s with the import entries and touches nothing', (_, edit) => {
    const { doc, changes } = open();
    const editor = createEditor(doc, { captureTimeout: 0 });
    editor.update('nodes', 'order-svc', { title: 'Mine' });
    const before = toJSON(doc);
    const seen = changes.length;
    const file = edited(edit);

    const result = applyFile(doc, file, origin);

    const inspected = inspectDeckText(JSON.stringify(file));
    expect(inspected.ok).toBe(false);
    expect(result).toEqual({ status: 'refused', entries: inspected.entries });
    expect(toJSON(doc)).toEqual(before);
    expect(changes).toHaveLength(seen);
    expect(editor.canUndo()).toBe(true);
    expect(editor.canRedo()).toBe(false);
    editor.undo();
    expect(getObject(doc, 'nodes', 'order-svc')?.title).toBe(
      full.nodes.find((n) => n.id === 'order-svc')?.title,
    );
    expect(editor.canUndo()).toBe(false);
    editor.destroy();
  });

  it('applyDeckText refuses text that is not JSON with one invalid-json entry', () => {
    const { doc, changes } = open();
    const result = applyDeckText(doc, 'not json', origin);
    expect(result.status === 'refused' ? result.entries.map((e) => e.code) : []).toEqual([
      'invalid-json',
    ]);
    expect(changes).toEqual([]);
  });

  it('applyDeckText applies a BOM-prefixed valid text', () => {
    const { doc } = open();
    const file = edited((f) => {
      f.name = 'From text';
    });
    const result = applyDeckText(doc, `\uFEFF${JSON.stringify(file)}`, origin);
    expect(result.status).toBe('applied');
    expect(toJSON(doc).name).toBe('From text');
  });

  it('applyDeckText throws a TypeError for an editor origin, even for broken text', () => {
    const { doc } = open();
    const editor = createEditor(doc);
    let editorOrigin: unknown;
    doc.on('afterTransaction', (transaction: Y.Transaction) => {
      editorOrigin ??= transaction.origin;
    });
    editor.update('nodes', 'order-svc', { title: 'Typed' });
    expect(() => applyDeckText(doc, 'not json', editorOrigin as object)).toThrow(TypeError);
    editor.destroy();
  });
});
