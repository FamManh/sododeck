import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  checkIntegrity,
  createEditor,
  fromJSON,
  STICKY_DEFAULT_OFFSET,
  toJSON,
  type RemovalResult,
} from '../src';
import { cascadeDeck as deck } from './cascade-deck';
import { expectValid, seqIds } from './helpers';

const positionedStickyDeck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 100, y: 200 } }],
  stickies: [
    {
      id: 'st-offset',
      text: 'Pinned with offset',
      anchor: 'a',
      position: { x: 10, y: -8 },
      collapsed: true,
      showInFlows: true,
    },
    { id: 'st-default', text: 'Pinned with default', anchor: 'a' },
  ],
};

const gridStickyDeck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  ],
  stickies: [
    { id: 'st-grid-offset', text: 'Grid offset', anchor: 'b', position: { x: 12, y: -4 } },
    { id: 'st-grid-default', text: 'Grid default', anchor: 'b' },
  ],
};

const multiNodeStickyDeck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 10, y: 20 } },
    { id: 'b', type: 'database', title: 'B', position: { x: 200, y: 300 } },
  ],
  edges: [{ id: 'ab', from: 'a', to: 'b' }],
  stickies: [
    { id: 'st-a', text: 'On A', anchor: 'a', position: { x: 5, y: -5 } },
    { id: 'st-b', text: 'On B', anchor: 'b', position: { x: 10, y: 12 } },
    { id: 'st-edge', text: 'On edge', anchor: 'ab' },
  ],
};

function setup(input: SododeckFile = deck) {
  const doc = fromJSON(input);
  return { doc, editor: createEditor(doc, { newId: seqIds() }) };
}

/** Runs a removal, checks validity and that one undo restores the deck exactly (SC-002). */
function removeAndUndo(
  remove: (editor: ReturnType<typeof setup>['editor']) => RemovalResult,
  check: (out: SododeckFile, result: RemovalResult) => void,
  input: SododeckFile = deck,
): void {
  const { doc, editor } = setup(input);
  const before = toJSON(doc);
  const result = remove(editor);
  expectValid(doc);
  const out = toJSON(doc);
  check(out, result);
  // The reported problems are exactly what the integrity report now shows about removed objects.
  for (const problem of result.broken) expect(checkIntegrity(out)).toContainEqual(problem);

  expect(editor.undo()).toBe(true);
  expect(toJSON(doc)).toEqual(before);
  expect(editor.canUndo()).toBe(false);
}

describe('delete cascade (US3, FR-011–018)', () => {
  it('node: removes its edges, keeps steps and stickies broken, cleans views and children', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'n'),
      (out, result) => {
        expect(out.nodes.map((n) => n.id)).toEqual(['a', 'child']);
        expect(out.edges.map((e) => e.id)).toEqual(['e3']);
        // The step keeps all its content, pointing at the removed edge (FR-012).
        expect(out.flows[0]?.steps[0]).toEqual(deck.flows[0]?.steps[0]);
        expect(out.views[0]).toMatchObject({
          includes: ['a', 'child'],
          positions: { a: { x: 2, y: 2 } },
        });
        expect(out.nodes[1]).not.toHaveProperty('parent');
        expect(out.stickies).toEqual([
          { id: 'st-n', text: 'On n', position: { x: 220, y: -10 } },
          { id: 'st-e', text: 'On e1', anchor: 'e1' },
          { id: 'st-fl', text: 'On flow', anchor: 'fl' },
          { id: 'st-s1', text: 'On step', anchor: 's1' },
          { id: 'st-free', text: 'Free', position: { x: 5, y: 5 } },
        ]);

        expect(result).toEqual({
          removed: [
            { scope: 'nodes', id: 'n' },
            { scope: 'edges', id: 'e1' },
            { scope: 'edges', id: 'e2' },
          ],
          updated: [
            { scope: 'nodes', id: 'child' },
            { scope: 'views', id: 'v' },
            { scope: 'stickies', id: 'st-n' },
          ],
          freed: ['st-n'],
          broken: [
            {
              kind: 'missing-reference',
              object: { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
              field: 'edge',
              target: 'e1',
              targetType: 'edge',
            },
            {
              kind: 'missing-reference',
              object: { scope: 'stickies', id: 'st-e' },
              field: 'anchor',
              target: 'e1',
              targetType: 'object',
            },
          ],
        });
      },
    );
  });

  it('node: frees pinned notes at the same canvas point for a positioned node', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'a'),
      (out, result) => {
        expect(out.stickies).toEqual([
          {
            id: 'st-offset',
            text: 'Pinned with offset',
            position: { x: 110, y: 192 },
            collapsed: true,
            showInFlows: true,
          },
          {
            id: 'st-default',
            text: 'Pinned with default',
            position: { x: 100 + STICKY_DEFAULT_OFFSET.x, y: 200 + STICKY_DEFAULT_OFFSET.y },
          },
        ]);
        expect(result).toEqual({
          removed: [{ scope: 'nodes', id: 'a' }],
          updated: [
            { scope: 'stickies', id: 'st-offset' },
            { scope: 'stickies', id: 'st-default' },
          ],
          freed: ['st-offset', 'st-default'],
          broken: [],
        });
      },
      positionedStickyDeck,
    );
  });

  it('node: frees pinned notes at the same canvas point for a grid-placed node', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'b'),
      (out, result) => {
        expect(out.stickies).toEqual([
          { id: 'st-grid-offset', text: 'Grid offset', position: { x: 232, y: -4 } },
          {
            id: 'st-grid-default',
            text: 'Grid default',
            position: { x: 220 + STICKY_DEFAULT_OFFSET.x, y: STICKY_DEFAULT_OFFSET.y },
          },
        ]);
        expect(result).toEqual({
          removed: [{ scope: 'nodes', id: 'b' }],
          updated: [
            { scope: 'stickies', id: 'st-grid-offset' },
            { scope: 'stickies', id: 'st-grid-default' },
          ],
          freed: ['st-grid-offset', 'st-grid-default'],
          broken: [],
        });
      },
      gridStickyDeck,
    );
  });

  it('batch node delete: frees the notes of every removed node, but keeps edge anchors broken', () => {
    const { doc, editor } = setup(multiNodeStickyDeck);
    const before = toJSON(doc);
    const results = editor.batch(() => [editor.remove('nodes', 'a'), editor.remove('nodes', 'b')]);
    const out = toJSON(doc);
    expect(out.stickies).toEqual([
      { id: 'st-a', text: 'On A', position: { x: 15, y: 15 } },
      { id: 'st-b', text: 'On B', position: { x: 210, y: 312 } },
      { id: 'st-edge', text: 'On edge', anchor: 'ab' },
    ]);
    expect(results.map((result) => result.freed)).toEqual([['st-a'], ['st-b']]);
    expect(results.flatMap((result) => result.broken)).toContainEqual({
      kind: 'missing-reference',
      object: { scope: 'stickies', id: 'st-edge' },
      field: 'anchor',
      target: 'ab',
      targetType: 'object',
    });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc)).toEqual(before);
  });

  it('edge: keeps its steps and reports them', () => {
    removeAndUndo(
      (editor) => editor.remove('edges', 'e1'),
      (out, result) => {
        expect(out.edges.map((e) => e.id)).toEqual(['e2', 'e3']);
        expect(out.flows).toEqual(deck.flows);
        expect(result.removed).toEqual([{ scope: 'edges', id: 'e1' }]);
        expect(result.updated).toEqual([]);
        expect(result.freed).toEqual([]);
        expect(result.broken.map((p) => [p.object.child?.id ?? p.object.id, p.field])).toEqual([
          ['s1', 'edge'],
          ['st-e', 'anchor'],
        ]);
      },
    );
  });

  it('group: moves members and child groups up to its parent, deletes nothing else', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'inner'),
      (out, result) => {
        expect(out.groups).toEqual([
          { id: 'outer', title: 'Outer' },
          { id: 'nested', title: 'Nested', parent: 'outer' },
          { id: 'loose', title: 'Loose' },
        ]);
        expect(out.nodes.map((n) => n.group)).toEqual(['outer', 'outer', 'outer']);
        expect(out.edges).toEqual(deck.edges);
        expect(result).toEqual({
          removed: [{ scope: 'groups', id: 'inner' }],
          updated: [
            { scope: 'nodes', id: 'a' },
            { scope: 'nodes', id: 'n' },
            { scope: 'groups', id: 'nested' },
          ],
          freed: [],
          broken: [],
        });
      },
    );
  });

  it('group without a parent: ungroups its members', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'outer'),
      (out) => {
        expect(out.groups.find((g) => g.id === 'inner')).toEqual({ id: 'inner', title: 'Inner' });
        expect(out.nodes.find((n) => n.id === 'child')).not.toHaveProperty('group');
      },
    );
  });

  it('feature: clears the feature of flows and views', () => {
    removeAndUndo(
      (editor) => editor.remove('features', 'feat'),
      (out, result) => {
        expect(out.flows[0]).not.toHaveProperty('feature');
        expect(out.views[0]).not.toHaveProperty('feature');
        expect(result).toEqual({
          removed: [{ scope: 'features', id: 'feat' }],
          updated: [
            { scope: 'views', id: 'v' },
            { scope: 'flows', id: 'fl' },
          ],
          freed: [],
          broken: [],
        });
      },
    );
  });

  it('flow: deletes its steps, keeps stickies anchored to it or its steps', () => {
    removeAndUndo(
      (editor) => editor.remove('flows', 'fl'),
      (out, result) => {
        expect(out.flows).toEqual([]);
        expect(out.stickies).toEqual(deck.stickies);
        expect(result.removed).toEqual([
          { scope: 'flows', id: 'fl' },
          { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
          { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's2' } },
        ]);
        expect(result.freed).toEqual([]);
        expect(result.broken.map((p) => [p.object.id, p.target])).toEqual([
          ['st-fl', 'fl'],
          ['st-s1', 's1'],
        ]);
      },
    );
  });

  it('rule: detaches it from nodes and steps and drops its sample inputs (US3 AS2)', () => {
    removeAndUndo(
      (editor) => editor.removeRule('R'),
      (out, result) => {
        expect(out.rules).not.toHaveProperty('R');
        expect(out.nodes.map((n) => n.rules)).toEqual([undefined, undefined, ['Q']]);
        expect(out.flows[0]?.steps).toEqual([
          { id: 's1', edge: 'e1', title: 'Call', sla: '< 1 s' },
          { id: 's2', edge: 'e3', rules: ['Q'], ruleInputs: { Q: {} } },
        ]);
        expect(checkIntegrity(out)).toEqual([]);
        expect(result).toEqual({
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
      },
    );
  });

  it('sticky: removes it', () => {
    removeAndUndo(
      (editor) => editor.remove('stickies', 'st-n'),
      (out, result) => {
        expect(out.stickies.map((s) => s.id)).toEqual(['st-e', 'st-fl', 'st-s1', 'st-free']);
        expect(result).toEqual({
          removed: [{ scope: 'stickies', id: 'st-n' }],
          updated: [],
          freed: [],
          broken: [],
        });
      },
    );
  });

  it('view: removes it', () => {
    removeAndUndo(
      (editor) => editor.remove('views', 'v'),
      (out, result) => {
        expect(out.views).toEqual([]);
        expect(result.removed).toEqual([{ scope: 'views', id: 'v' }]);
      },
    );
  });

  it('step: removes one step, keeps stickies anchored to it', () => {
    removeAndUndo(
      (editor) => editor.removeStep('fl', 's1'),
      (out, result) => {
        expect(out.flows[0]?.steps.map((s) => s.id)).toEqual(['s2']);
        expect(result).toEqual({
          removed: [{ scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } }],
          updated: [],
          freed: [],
          broken: [
            {
              kind: 'missing-reference',
              object: { scope: 'stickies', id: 'st-s1' },
              field: 'anchor',
              target: 's1',
              targetType: 'object',
            },
          ],
        });
      },
    );
  });

  it('refuses to remove something that does not exist', () => {
    const { editor } = setup();
    expect(() => editor.remove('nodes', 'zz')).toThrow(/does not exist/);
    expect(() => editor.removeRule('zz')).toThrow(/does not exist/);
    expect(() => editor.removeStep('fl', 'zz')).toThrow(/does not exist/);
    expect(editor.canUndo()).toBe(false);
  });
});

describe('view references (011, FR-061)', () => {
  const viewDeck: SododeckFile = {
    ...deck,
    views: [
      { id: 'v', type: 'system', title: 'V', pinned: ['n', 'a'], collapsed: ['inner'] },
      {
        id: 'w',
        type: 'custom',
        title: 'W',
        excludeGroups: ['inner', 'loose'],
        collapsed: ['inner', 'outer'],
        pinned: ['a'],
      },
      { id: 'x', type: 'custom', title: 'X', excludeGroups: ['loose'] },
    ],
  };

  it('node: leaves pinned in every view', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'n'),
      (out, result) => {
        expect(out.views[0]?.pinned).toEqual(['a']);
        expect(out.views[1]?.pinned).toEqual(['a']);
        expect(result.updated).toContainEqual({ scope: 'views', id: 'v' });
        expect(result.updated).not.toContainEqual({ scope: 'views', id: 'w' });
      },
      viewDeck,
    );
  });

  it('group: leaves excludeGroups and collapsed in every view, dropping empty lists', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'inner'),
      (out, result) => {
        expect(out.views[0]).not.toHaveProperty('collapsed');
        expect(out.views[1]).toMatchObject({ excludeGroups: ['loose'], collapsed: ['outer'] });
        expect(result.updated).toEqual(
          expect.arrayContaining([
            { scope: 'views', id: 'v' },
            { scope: 'views', id: 'w' },
          ]),
        );
        expect(result.updated).not.toContainEqual({ scope: 'views', id: 'x' });
        expect(checkIntegrity(out)).toEqual([]);
      },
      viewDeck,
    );
  });

  it('group: deletes its frame from every view in the same step (016)', () => {
    const frame = { position: { x: 0, y: 0 }, size: { width: 200, height: 120 } };
    removeAndUndo(
      (editor) => editor.remove('groups', 'inner'),
      (out, result) => {
        expect(out.views[0]).not.toHaveProperty('groupFrames');
        expect(out.views[1]?.groupFrames).toEqual({ outer: frame });
        expect(result.updated).toContainEqual({ scope: 'views', id: 'x' });
      },
      {
        ...viewDeck,
        views: [
          { id: 'v', type: 'system', title: 'V', groupFrames: { inner: frame } },
          { id: 'w', type: 'custom', title: 'W', groupFrames: { inner: frame, outer: frame } },
          { id: 'x', type: 'custom', title: 'X', groupFrames: { inner: frame } },
        ],
      },
    );
  });
});
