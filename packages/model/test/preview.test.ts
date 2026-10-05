import { describe, expect, it } from 'vitest';

import {
  createEditor,
  fromJSON,
  getObject,
  previewRemoval,
  toJSON,
  type RemovalResult,
  type RemovalTarget,
} from '../src';
import { mergeRemovals } from '../src/preview';
import { cascadeDeck } from './cascade-deck';
import { shopDeck } from './helpers';

/** What the editor really does for `targets`: one batch, skipping targets already cascaded away. */
function actualRemoval(targets: RemovalTarget[]): RemovalResult {
  const doc = fromJSON(cascadeDeck);
  const editor = createEditor(doc);
  const results = editor.batch(() =>
    targets.flatMap((t) => {
      if (t.scope === 'branches') return [editor.removeBranch(t.flowId, t.id)];
      if (t.scope === 'rules') return [editor.removeRule(t.id)];
      return getObject(doc, t.scope, t.id) === undefined ? [] : [editor.remove(t.scope, t.id)];
    }),
  );
  editor.destroy();
  return mergeRemovals(results);
}

const CASES: [string, RemovalTarget[]][] = [
  ['node', [{ scope: 'nodes', id: 'n' }]],
  ['edge', [{ scope: 'edges', id: 'e1' }]],
  ['nested group', [{ scope: 'groups', id: 'inner' }]],
  ['top-level group', [{ scope: 'groups', id: 'outer' }]],
  ['flow', [{ scope: 'flows', id: 'fl' }]],
  ['feature', [{ scope: 'features', id: 'feat' }]],
  ['view', [{ scope: 'views', id: 'v' }]],
  ['sticky', [{ scope: 'stickies', id: 'st-n' }]],
  ['rule', [{ scope: 'rules', id: 'R' }]],
  [
    'two nodes sharing edges',
    [
      { scope: 'nodes', id: 'a' },
      { scope: 'nodes', id: 'n' },
    ],
  ],
  [
    'an edge, then its node',
    [
      { scope: 'edges', id: 'e1' },
      { scope: 'nodes', id: 'n' },
    ],
  ],
  [
    'a node, then its edge',
    [
      { scope: 'nodes', id: 'n' },
      { scope: 'edges', id: 'e1' },
    ],
  ],
];

describe('previewRemoval', () => {
  it.each(CASES)('%s: equals the result of really removing it', (_, targets) => {
    const doc = fromJSON(cascadeDeck);
    const editor = createEditor(doc);
    const before = toJSON(doc);

    expect(previewRemoval(before, targets)).toEqual(actualRemoval(targets));
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canUndo()).toBe(false);
    editor.destroy();
  });

  it('lists an object removed by several targets once', () => {
    const result = previewRemoval(cascadeDeck, [
      { scope: 'nodes', id: 'a' },
      { scope: 'nodes', id: 'n' },
    ]);
    const edges = result.removed.filter((ref) => ref.scope === 'edges').map((ref) => ref.id);
    expect(edges).toEqual(['e1', 'e2', 'e3']);
    expect(result.removed.slice(0, 1)).toEqual([{ scope: 'nodes', id: 'a' }]);
  });

  it('reports what the delete leaves broken', () => {
    const result = previewRemoval(cascadeDeck, [{ scope: 'nodes', id: 'n' }]);
    expect(result.broken.map((p) => p.object)).toEqual([
      { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
    ]);
  });

  it('lists a removed rule and the nodes and steps it is detached from (008)', () => {
    expect(previewRemoval(cascadeDeck, [{ scope: 'rules', id: 'R' }])).toEqual({
      removed: [{ scope: 'rules', id: 'R' }],
      updated: [
        { scope: 'nodes', id: 'n' },
        { scope: 'nodes', id: 'child' },
        { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
        { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's2' } },
      ],
      broken: [],
    });
    expect(previewRemoval(cascadeDeck, [{ scope: 'rules', id: 'nope' }])).toEqual({
      removed: [],
      updated: [],
      broken: [],
    });
  });

  it('keeps the tables of a database card: un-parented, not removed (049)', () => {
    const deck = shopDeck();
    const owned = deck.nodes.filter((n) => n.parent === 'db').map((n) => n.id);
    expect(owned.length).toBeGreaterThan(0);
    const result = previewRemoval(deck, [{ scope: 'nodes', id: 'db' }]);
    expect(result.removed).toEqual([{ scope: 'nodes', id: 'db' }]);
    expect(result.updated).toEqual(owned.map((id) => ({ scope: 'nodes', id })));
    expect(result.broken).toEqual([]);
  });

  it('skips a target that does not exist', () => {
    expect(previewRemoval(cascadeDeck, [{ scope: 'nodes', id: 'nope' }])).toEqual({
      removed: [],
      updated: [],
      broken: [],
    });
  });
});

describe('mergeRemovals', () => {
  it('keeps the first occurrence of each ref and problem, in order', () => {
    const problem = {
      kind: 'missing-reference' as const,
      object: { scope: 'flows' as const, id: 'f', child: { kind: 'step' as const, id: 's9' } },
      field: 'edge',
      target: 'x',
      targetType: 'edge' as const,
    };
    const merged = mergeRemovals([
      {
        removed: [{ scope: 'nodes', id: 'a' }],
        updated: [{ scope: 'views', id: 'v' }],
        broken: [problem],
      },
      {
        removed: [
          { scope: 'nodes', id: 'a' },
          { scope: 'flows', id: 'f', child: { kind: 'step', id: 's1' } },
          { scope: 'flows', id: 'f', child: { kind: 'step', id: 's2' } },
        ],
        updated: [{ scope: 'views', id: 'v' }],
        broken: [{ ...problem }],
      },
    ] as RemovalResult[]);
    expect(merged).toEqual({
      removed: [
        { scope: 'nodes', id: 'a' },
        { scope: 'flows', id: 'f', child: { kind: 'step', id: 's1' } },
        { scope: 'flows', id: 'f', child: { kind: 'step', id: 's2' } },
      ],
      updated: [{ scope: 'views', id: 'v' }],
      broken: [problem],
    });
  });
});
