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
    expect(result.freed).toEqual(['st-n']);
    const brokenObjects = result.broken.map((p) => p.object);
    expect(brokenObjects).not.toContainEqual({ scope: 'stickies', id: 'st-n' });
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
      freed: [],
      broken: [],
    });
    expect(previewRemoval(cascadeDeck, [{ scope: 'rules', id: 'nope' }])).toEqual({
      removed: [],
      updated: [],
      freed: [],
      broken: [],
    });
  });

  it('skips a target that does not exist', () => {
    expect(previewRemoval(cascadeDeck, [{ scope: 'nodes', id: 'nope' }])).toEqual({
      removed: [],
      updated: [],
      freed: [],
      broken: [],
    });
  });
});

describe('mergeRemovals', () => {
  it('keeps the first occurrence of each ref and problem, in order', () => {
    const problem = { object: { scope: 'stickies', id: 's' }, field: 'anchor', target: 'x' };
    const merged = mergeRemovals([
      {
        removed: [{ scope: 'nodes', id: 'a' }],
        updated: [{ scope: 'views', id: 'v' }],
        freed: ['st-a'],
        broken: [problem],
      },
      {
        removed: [
          { scope: 'nodes', id: 'a' },
          { scope: 'flows', id: 'f', child: { kind: 'step', id: 's1' } },
          { scope: 'flows', id: 'f', child: { kind: 'step', id: 's2' } },
        ],
        updated: [{ scope: 'views', id: 'v' }],
        freed: ['st-a', 'st-b'],
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
      freed: ['st-a', 'st-b'],
      broken: [problem],
    });
  });
});
