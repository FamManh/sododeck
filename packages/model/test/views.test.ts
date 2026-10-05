import { emptySododeckFile, type SododeckFile, type View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  baseViewId,
  checkIntegrity,
  createEditor,
  DeckEditError,
  fromJSON,
  getObject,
  nextCustomTitle,
  observeDeck,
  PRESET_VIEW_IDS,
  resolveViews,
  toJSON,
  VIEW_PRESETS,
  viewPosition,
  type DeckChange,
  type DeckDoc,
} from '../src';
import { expectValid, seqIds } from './helpers';

const base: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', group: 'core', position: { x: 100, y: 0 } },
    { id: 'c', type: 'database', title: 'C', group: 'core' },
  ],
  groups: [
    { id: 'core', title: 'Core' },
    { id: 'clients', title: 'Clients' },
  ],
  edges: [{ id: 'ab', from: 'a', to: 'b' }],
  features: [{ id: 'f', title: 'Checkout' }],
};

const stored: View[] = [
  { id: 'v1', type: 'system', title: 'One' },
  { id: 'v2', type: 'infra', title: 'Two', positions: { a: { x: 5, y: 6 } } },
];

function setup(file: SododeckFile = base) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

const views = (doc: DeckDoc) => toJSON(doc).views;
const view = (doc: DeckDoc, id: string) => getObject(doc, 'views', id);

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof DeckEditError ? error.code : 'other';
  }
  return undefined;
}

describe('pure view helpers', () => {
  it('presets are Overview and Flows with fixed ids and no Infra (054)', () => {
    expect(VIEW_PRESETS.map((v) => [v.id, v.type, v.title, v.subtitleField])).toEqual([
      ['system', 'system', 'Overview', 'tech'],
      ['feature', 'feature', 'Flows', 'flows'],
    ]);
    expect([...PRESET_VIEW_IDS]).toEqual(['system', 'feature']);
  });

  it('keeps a stored Infra view untouched', () => {
    const file = { ...base, views: stored };
    expect(resolveViews(file)[1]).toMatchObject({ id: 'v2', type: 'infra', title: 'Two' });
    const infra: View[] = [
      { id: 'system', type: 'system', title: 'System', subtitleField: 'tech' },
      { id: 'feature', type: 'feature', title: 'Feature', subtitleField: 'flows' },
      { id: 'infra', type: 'infra', title: 'Infra', subtitleField: 'host', dimKinds: ['client'] },
    ];
    const deck = { ...base, views: infra };
    expect(resolveViews(deck)).toBe(infra);
    expect(toJSON(fromJSON(deck)).views).toEqual(infra);
    expect(JSON.stringify(toJSON(fromJSON(deck)))).toBe(JSON.stringify(toJSON(fromJSON(deck))));
  });

  it('resolveViews returns stored views, else the presets, keeping identity', () => {
    const file = { ...base, views: stored };
    expect(resolveViews(file)).toBe(stored);
    expect(resolveViews(base)).toBe(VIEW_PRESETS);
    expect(resolveViews({ ...base, views: [] })).toBe(resolveViews(base));
  });

  it('baseViewId is the first view', () => {
    expect(baseViewId(stored)).toBe('v1');
    expect(baseViewId(VIEW_PRESETS)).toBe('system');
  });

  it('nextCustomTitle uses the lowest unused number', () => {
    expect(nextCustomTitle(VIEW_PRESETS)).toBe('Custom 1');
    const list: View[] = [
      ...stored,
      { id: 'x', type: 'custom', title: 'Custom 1' },
      { id: 'y', type: 'custom', title: 'Custom 3' },
    ];
    expect(nextCustomTitle(list)).toBe('Custom 2');
  });

  it('viewPosition prefers the view override in any view, else the base position', () => {
    const file = { ...base, views: stored };
    const [v1, v2] = stored as [View, View];
    expect(viewPosition(file, v2, 'a')).toEqual({ x: 5, y: 6 });
    expect(viewPosition(file, v2, 'b')).toEqual({ x: 100, y: 0 });
    expect(viewPosition(file, v1, 'a')).toEqual({ x: 0, y: 0 });
    expect(viewPosition(file, { ...v1, positions: { a: { x: 9, y: 9 } } }, 'a')).toEqual({
      x: 9,
      y: 9,
    });
    expect(viewPosition(file, v1, 'c')).toBeUndefined();
    expect(viewPosition(file, v1, 'missing')).toBeUndefined();
  });
});

describe('view ops: presets are materialized outside undo history (FR-001)', () => {
  it('the first move in Flows writes the 2 presets, then the change; undo keeps the views', () => {
    const { doc, editor } = setup();
    editor.moveInView('feature', { a: { x: 50, y: 60 } });
    expect(views(doc).map((v) => v.id)).toEqual(['system', 'feature']);
    expect(view(doc, 'feature')?.positions).toEqual({ a: { x: 50, y: 60 } });
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 0, y: 0 });
    expectValid(doc);

    expect(editor.undo()).toBe(true);
    expect(views(doc).map((v) => v.id)).toEqual(['system', 'feature']);
    expect(view(doc, 'feature')?.positions).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
  });

  it('move in Flows (materializes), collapse, undo: move undone, views and collapse stay', () => {
    const { doc, editor } = setup();
    editor.moveInView('feature', { a: { x: 50, y: 60 } });
    editor.setCollapsed('feature', 'core', true);
    editor.undo();
    expect(view(doc, 'feature')?.positions).toBeUndefined();
    expect(view(doc, 'feature')?.collapsed).toEqual(['core']);
    expect(views(doc)).toHaveLength(2);
  });

  it('collapses a derived schema group without a stored group (048)', () => {
    const { doc, editor } = setup();
    editor.setCollapsed('feature', 'schema:billing', true);
    expect(view(doc, 'feature')?.collapsed).toEqual(['schema:billing']);
    expect(checkIntegrity(toJSON(doc))).toEqual([]);
    editor.setCollapsed('feature', 'schema:billing', false);
    expect(view(doc, 'feature')?.collapsed).toBeUndefined();
  });

  it('still refuses a collapse of an unknown stored group', () => {
    const { editor } = setup();
    expect(() => {
      editor.setCollapsed('feature', 'nope', true);
    }).toThrow(DeckEditError);
  });

  it('opening a deck and reading views never writes', () => {
    const { doc } = setup();
    expect(toJSON(doc).views).toEqual([]);
  });

  it('unknown views are not-found and write nothing', () => {
    const { doc, editor } = setup();
    expect(
      code(() => {
        editor.moveInView('nope', { a: { x: 1, y: 1 } });
      }),
    ).toBe('not-found');
    expect(
      code(() => {
        editor.setPinned('nope', ['a'], true);
      }),
    ).toBe('not-found');
    expect(views(doc)).toEqual([]);
  });
});

describe('moveInView: the base-view rule (FR-020, FR-021)', () => {
  it('the base view writes node.position; other views write overrides; unknown ids skipped', () => {
    const { doc, editor } = setup();
    editor.moveInView('system', { a: { x: 7, y: 8 }, ghost: { x: 1, y: 1 } });
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 7, y: 8 });
    // A base-view move on a deck without views is not a view change.
    expect(views(doc)).toEqual([]);

    editor.moveInView('feature', { b: { x: 1, y: 2 }, ghost: { x: 1, y: 1 } });
    expect(view(doc, 'feature')?.positions).toEqual({ b: { x: 1, y: 2 } });
    expect(getObject(doc, 'nodes', 'b')?.position).toEqual({ x: 100, y: 0 });
    expectValid(doc);
  });

  it('writes a base position for a node that had none', () => {
    const { doc, editor } = setup();
    editor.moveInView('system', { c: { x: 3, y: 4 } });
    expect(getObject(doc, 'nodes', 'c')?.position).toEqual({ x: 3, y: 4 });
  });

  it('a base view with its own override shows it; a move there drops it', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.removeView('v1');
    const file = toJSON(doc);
    const infra = file.views[0];
    if (infra === undefined) throw new Error('no view');
    expect(baseViewId(file.views)).toBe('v2');
    expect(viewPosition(file, infra, 'a')).toEqual({ x: 5, y: 6 });

    editor.moveInView('v2', { a: { x: 70, y: 80 } });
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 70, y: 80 });
    expect(view(doc, 'v2')?.positions).toBeUndefined();
  });

  it('moves in a gesture are one undo step', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.beginGesture();
    editor.moveInView('v2', { b: { x: 1, y: 1 } });
    editor.moveInView('v2', { b: { x: 2, y: 2 } });
    editor.endGesture();
    editor.undo();
    expect(view(doc, 'v2')?.positions).toEqual({ a: { x: 5, y: 6 } });
  });

  it('refuses non-finite coordinates', () => {
    const { editor } = setup({ ...base, views: stored });
    expect(
      code(() => {
        editor.moveInView('v2', { a: { x: Number.NaN, y: 0 } });
      }),
    ).toBe('invalid');
  });
});

describe('setPinned (FR-022, FR-023)', () => {
  it('adds and removes, stays unique, and is one undo step', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.setPinned('v2', ['a', 'b'], true);
    editor.setPinned('v2', ['a'], true);
    expect(view(doc, 'v2')?.pinned).toEqual(['a', 'b']);
    editor.setPinned('v2', ['a', 'b'], false);
    expect(view(doc, 'v2')?.pinned).toBeUndefined();
    editor.undo();
    expect(view(doc, 'v2')?.pinned).toEqual(['a', 'b']);
    expectValid(doc);
  });

  it('pins are per view', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.setPinned('v1', ['a'], true);
    expect(view(doc, 'v2')?.pinned).toBeUndefined();
  });

  it('throws missing-reference for an unknown node', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    expect(
      code(() => {
        editor.setPinned('v2', ['ghost'], true);
      }),
    ).toBe('missing-reference');
    expect(view(doc, 'v2')?.pinned).toBeUndefined();
  });
});

describe('updateView (FR-041, FR-043)', () => {
  it('validates titles, kinds and references', () => {
    const { editor } = setup({ ...base, views: stored });
    expect(
      code(() => {
        editor.updateView('v1', { title: '   ' });
      }),
    ).toBe('invalid');
    expect(
      code(() => {
        editor.updateView('v1', { excludeKinds: ['Lambda'] });
      }),
    ).toBe('invalid');
    expect(
      code(() => {
        editor.updateView('v1', { excludeGroups: ['ghost'] });
      }),
    ).toBe('missing-reference');
    expect(
      code(() => {
        editor.updateView('v1', { feature: 'ghost' });
      }),
    ).toBe('missing-reference');
  });

  it('writes settings and removes fields set to [] or undefined', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.updateView('v1', {
      subtitleField: 'flows',
      excludeGroups: ['clients'],
      excludeKinds: ['external'],
      excludeTags: ['legacy'],
      dimKinds: ['client'],
      feature: 'f',
    });
    expect(view(doc, 'v1')).toMatchObject({
      subtitleField: 'flows',
      excludeGroups: ['clients'],
      excludeKinds: ['external'],
      excludeTags: ['legacy'],
      dimKinds: ['client'],
      feature: 'f',
    });
    editor.updateView('v1', { excludeGroups: [], feature: undefined });
    expect(view(doc, 'v1')?.excludeGroups).toBeUndefined();
    expect(view(doc, 'v1')?.feature).toBeUndefined();
    expect(view(doc, 'v1')?.excludeKinds).toEqual(['external']);
    expectValid(doc);
  });

  it('writes schemas and detail (048); an empty list, undefined and a default remove them', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.updateView('v1', { schemas: ['billing', 'public'], detail: 'keys' });
    expect(view(doc, 'v1')).toMatchObject({ schemas: ['billing', 'public'], detail: 'keys' });
    expectValid(doc);
    editor.updateView('v1', { detail: 'all' });
    expect(view(doc, 'v1')?.detail).toBe('all');
    editor.updateView('v1', { schemas: [], detail: undefined });
    expect(view(doc, 'v1')?.schemas).toBeUndefined();
    expect(view(doc, 'v1')?.detail).toBeUndefined();
    expect(Object.keys(view(doc, 'v1') ?? {})).toEqual(['id', 'type', 'title']);
    expectValid(doc);
  });

  it('writes includes, refusing a node that does not exist, in one undo step (048)', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.updateView('v1', { includes: ['a', 'b'] });
    expect(view(doc, 'v1')?.includes).toEqual(['a', 'b']);
    expect(
      code(() => {
        editor.updateView('v1', { includes: ['a', 'nope'] });
      }),
    ).toBe('missing-reference');
    expect(view(doc, 'v1')?.includes).toEqual(['a', 'b']);
    editor.undo();
    expect(view(doc, 'v1')?.includes).toBeUndefined();
    editor.redo();
    editor.updateView('v1', { includes: [] });
    expect(view(doc, 'v1')?.includes).toBeUndefined();
    expectValid(doc);
  });

  it('refuses a bad detail, a blank schema name and a non-list, and writes nothing', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    const before = JSON.stringify(view(doc, 'v1'));
    for (const patch of [
      { detail: 'auto' },
      { schemas: [''] },
      { schemas: 'billing' },
      { schemas: [3] },
    ]) {
      expect(
        code(() => {
          editor.updateView('v1', patch as never);
        }),
      ).toBe('invalid');
    }
    expect(JSON.stringify(view(doc, 'v1'))).toBe(before);
  });

  it('schemas and detail edits are one undo step each, on the first view of a preset deck too', () => {
    const { doc, editor } = setup();
    editor.updateView('feature', { schemas: ['billing'] });
    expect(view(doc, 'feature')?.schemas).toEqual(['billing']);
    editor.undo();
    expect(view(doc, 'feature')?.schemas).toBeUndefined();
    editor.redo();
    editor.updateView('feature', { detail: 'names' });
    editor.undo();
    expect(view(doc, 'feature')?.detail).toBeUndefined();
    expect(view(doc, 'feature')?.schemas).toEqual(['billing']);
  });

  it('a title typing burst is one undo step', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    for (const title of ['O', 'Or', 'Ord']) editor.updateView('v1', { title });
    editor.undo();
    expect(view(doc, 'v1')?.title).toBe('One');
  });

  it('a settings change on a deck with no views materializes the presets first', () => {
    const { doc, editor } = setup();
    editor.updateView('feature', { title: 'Features' });
    expect(views(doc).map((v) => v.title)).toEqual(['Overview', 'Features']);
    editor.undo();
    expect(views(doc).map((v) => v.title)).toEqual(['Overview', 'Flows']);
  });
});

describe('addView and removeView (FR-040, FR-042)', () => {
  it('addView appends "Custom <n>" and returns its id', () => {
    const { doc, editor } = setup();
    const id = editor.addView();
    expect(views(doc).map((v) => v.title)).toEqual(['Overview', 'Flows', 'Custom 1']);
    expect(view(doc, id)).toEqual({ id, type: 'custom', title: 'Custom 1', subtitleField: 'tech' });
    editor.addView();
    expect(views(doc).at(-1)?.title).toBe('Custom 2');
    editor.undo();
    editor.undo();
    expect(views(doc).map((v) => v.id)).toEqual(['system', 'feature']);
  });

  it('refuses to remove the last view', () => {
    const { doc, editor } = setup({ ...base, views: [{ id: 'only', type: 'custom', title: 'O' }] });
    expect(code(() => editor.removeView('only'))).toBe('invalid');
    expect(views(doc)).toHaveLength(1);
  });

  it('undo after removeView restores every field, collapsed included', () => {
    const full: View = {
      id: 'v2',
      type: 'custom',
      title: 'Two',
      subtitleField: 'owner',
      feature: 'f',
      excludeGroups: ['clients'],
      excludeKinds: ['external'],
      excludeTags: ['legacy'],
      dimKinds: ['client'],
      positions: { a: { x: 5, y: 6 } },
      pinned: ['a'],
    };
    const { doc, editor } = setup({ ...base, views: [stored[0] as View, full] });
    editor.setCollapsed('v2', 'core', true);
    editor.removeView('v2');
    expect(views(doc)).toHaveLength(1);
    editor.undo();
    expect(view(doc, 'v2')).toEqual({ ...full, collapsed: ['core'] });
  });
});

describe('setCollapsed: saved and synced, never an undo step (FR-050, R5)', () => {
  it('a collapse alone leaves nothing to undo', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.setCollapsed('v1', 'core', true);
    expect(view(doc, 'v1')?.collapsed).toEqual(['core']);
    expect(editor.canUndo()).toBe(false);
    editor.setCollapsed('v1', 'core', false);
    expect(view(doc, 'v1')?.collapsed).toBeUndefined();
  });

  it('rename, collapse, undo: the rename is undone and the group stays collapsed', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.update('nodes', 'a', { title: 'Renamed' });
    editor.setCollapsed('v1', 'core', true);
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')?.title).toBe('A');
    expect(view(doc, 'v1')?.collapsed).toEqual(['core']);
  });

  it('a collapse as the first view change materializes presets, with nothing undoable', () => {
    const { doc, editor } = setup();
    editor.setCollapsed('feature', 'core', true);
    expect(views(doc)).toHaveLength(2);
    expect(view(doc, 'feature')?.collapsed).toEqual(['core']);
    expect(editor.canUndo()).toBe(false);
  });

  it('throws missing-reference for an unknown group', () => {
    const { editor } = setup({ ...base, views: stored });
    expect(
      code(() => {
        editor.setCollapsed('v1', 'ghost', true);
      }),
    ).toBe('missing-reference');
  });

  it('syncs to a second doc, reported as local here and remote there', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const here: DeckChange[] = [];
    const there: DeckChange[] = [];
    observeDeck(doc, (c) => here.push(c));
    observeDeck(other, (c) => there.push(c));
    doc.on('update', (update: Uint8Array) => {
      Y.applyUpdate(other, update);
    });

    editor.setCollapsed('v1', 'core', true);
    expect(view(other, 'v1')?.collapsed).toEqual(['core']);
    expect(here.map((c) => c.origin)).toEqual(['local']);
    expect(there.map((c) => c.origin)).toEqual(['remote']);
    expect(here[0]?.changes[0]).toMatchObject({ scope: 'views', id: 'v1' });
  });
});

describe('references from views survive renames (constitution III)', () => {
  it('renaming a node, group or feature keeps every view reference', () => {
    const { doc, editor } = setup({ ...base, views: stored });
    editor.setPinned('v2', ['a'], true);
    editor.setCollapsed('v2', 'core', true);
    editor.updateView('v2', { excludeGroups: ['clients'], feature: 'f' });
    editor.update('nodes', 'a', { title: 'New A' });
    editor.update('groups', 'core', { title: 'New core' });
    editor.update('features', 'f', { title: 'New feature' });
    expect(view(doc, 'v2')).toMatchObject({
      pinned: ['a'],
      collapsed: ['core'],
      excludeGroups: ['clients'],
      feature: 'f',
    });
  });
});
