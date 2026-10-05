import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  checkIntegrity,
  createEditor,
  fromJSON,
  previewRemoval,
  toJSON,
  type RemovalResult,
} from '../src';
import { cascadeDeck as deck } from './cascade-deck';
import { expectValid, seqIds } from './helpers';

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
  it('node: removes its edges, keeps steps broken and notes in place, cleans views and children', () => {
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
        // Notes are never pinned (ADR 0041): deleting a card leaves them where they are.
        expect(out.stickies).toEqual(deck.stickies);

        expect(result).toEqual({
          removed: [
            { scope: 'nodes', id: 'n' },
            { scope: 'edges', id: 'e1' },
            { scope: 'edges', id: 'e2' },
          ],
          updated: [
            { scope: 'nodes', id: 'child' },
            { scope: 'views', id: 'v' },
          ],
          broken: [
            {
              kind: 'missing-reference',
              object: { scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } },
              field: 'edge',
              target: 'e1',
              targetType: 'edge',
            },
          ],
        });
      },
    );
  });

  it('edge: keeps its steps and reports them', () => {
    removeAndUndo(
      (editor) => editor.remove('edges', 'e1'),
      (out, result) => {
        expect(out.edges.map((e) => e.id)).toEqual(['e2', 'e3']);
        expect(out.flows).toEqual(deck.flows);
        expect(result.removed).toEqual([{ scope: 'edges', id: 'e1' }]);
        expect(result.updated).toEqual([]);
        expect(result.broken.map((p) => [p.object.child?.id ?? p.object.id, p.field])).toEqual([
          ['s1', 'edge'],
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
          broken: [],
        });
      },
    );
  });

  it('flow: deletes its steps, leaves notes alone', () => {
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
        expect(result.broken).toEqual([]);
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

  it('step: removes one step', () => {
    removeAndUndo(
      (editor) => editor.removeStep('fl', 's1'),
      (out, result) => {
        expect(out.flows[0]?.steps.map((s) => s.id)).toEqual(['s2']);
        expect(result).toEqual({
          removed: [{ scope: 'flows', id: 'fl', child: { kind: 'step', id: 's1' } }],
          updated: [],
          broken: [],
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

describe('groups as connector ends (050)', () => {
  const groupEdgeDeck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'service', title: 'A', group: 'g' },
      { id: 'b', type: 'service', title: 'B' },
    ],
    groups: [
      { id: 'g', title: 'G' },
      { id: 'h', title: 'H' },
    ],
    edges: [
      { id: 'a-b', from: 'a', to: 'b' },
      { id: 'b-g', from: 'b', to: 'g', route: { toSide: 'left' } },
      { id: 'g-h', from: 'g', to: 'h', style: { dash: 'dashed' } },
      { id: 'h-b', from: 'h', to: 'b' },
    ],
    flows: [{ id: 'f', title: 'F', steps: [{ id: 's1', edge: 'b-g' }] }],
  };

  it('removing a group removes every edge touching it, in one undo step', () => {
    removeAndUndo(
      (editor) => editor.remove('groups', 'g'),
      (out, result) => {
        expect(out.edges.map((e) => e.id)).toEqual(['a-b', 'h-b']);
        expect(out.nodes.find((n) => n.id === 'a')).not.toHaveProperty('group');
        expect(result.removed).toEqual([
          { scope: 'groups', id: 'g' },
          { scope: 'edges', id: 'b-g' },
          { scope: 'edges', id: 'g-h' },
        ]);
        expect(result.updated).toEqual([{ scope: 'nodes', id: 'a' }]);
        // The step that used a removed group edge is kept and reported broken, as for cards.
        expect(result.broken.map((p) => [p.object.child?.id ?? p.object.id, p.field])).toEqual([
          ['s1', 'edge'],
        ]);
      },
      groupEdgeDeck,
    );
  });

  it('previewRemoval lists the group edges a group delete would remove', () => {
    const preview = previewRemoval(groupEdgeDeck, [{ scope: 'groups', id: 'g' }]);
    expect(preview.removed).toEqual([
      { scope: 'groups', id: 'g' },
      { scope: 'edges', id: 'b-g' },
      { scope: 'edges', id: 'g-h' },
    ]);
  });

  it('renaming a group keeps its edges (ids are stable)', () => {
    const { doc, editor } = setup(groupEdgeDeck);
    editor.update('groups', 'g', { title: 'Renamed' });
    const out = toJSON(doc);
    expect(out.edges).toEqual(groupEdgeDeck.edges);
    expect(checkIntegrity(out)).toEqual([]);
  });

  it('accepts a new edge to a group and an end moved onto a group', () => {
    const { doc, editor } = setup(groupEdgeDeck);
    editor.add('edges', { id: 'a-h', from: 'a', to: 'h' });
    editor.update('edges', 'a-b', { to: 'g' });
    const out = toJSON(doc);
    expect(out.edges.find((e) => e.id === 'a-h')).toEqual({ id: 'a-h', from: 'a', to: 'h' });
    expect(out.edges.find((e) => e.id === 'a-b')?.to).toBe('g');
    expect(() => editor.add('edges', { from: 'a', to: 'nothing' })).toThrow(
      expect.objectContaining({ code: 'missing-reference' }),
    );
  });
});

describe('stickies as connector ends (053)', () => {
  const stickyEndDeck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 100, y: 100 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 100 } },
    ],
    edges: [
      { id: 'a-b', from: 'a', to: 'b' },
      { id: 'n1-a', from: 'n1', to: 'a' },
      { id: 'b-n1', from: 'b', to: 'n1' },
      { id: 'n1-n2', from: 'n1', to: 'n2' },
    ],
    stickies: [
      { id: 'n1', text: 'First', position: { x: 0, y: 0 } },
      { id: 'n2', text: 'Second', position: { x: 0, y: 300 } },
      { id: 'near', text: 'Near a', position: { x: 110, y: 110 } },
    ],
  };

  it('deleting a sticky removes its connectors in one undo step', () => {
    removeAndUndo(
      (editor) => editor.remove('stickies', 'n1'),
      (out, result) => {
        expect(out.stickies.map((s) => s.id)).toEqual(['n2', 'near']);
        expect(out.edges.map((e) => e.id)).toEqual(['a-b']);
        expect(result.removed).toEqual([
          { scope: 'stickies', id: 'n1' },
          { scope: 'edges', id: 'n1-a' },
          { scope: 'edges', id: 'b-n1' },
          { scope: 'edges', id: 'n1-n2' },
        ]);
        expect(result.broken).toEqual([]);
      },
      stickyEndDeck,
    );
  });

  it('previewRemoval lists the connectors a sticky delete would remove', () => {
    const preview = previewRemoval(stickyEndDeck, [{ scope: 'stickies', id: 'n2' }]);
    expect(preview.removed).toEqual([
      { scope: 'stickies', id: 'n2' },
      { scope: 'edges', id: 'n1-n2' },
    ]);
  });

  it('deleting a node keeps the notes in place and the connectors between notes', () => {
    removeAndUndo(
      (editor) => editor.remove('nodes', 'a'),
      (out) => {
        expect(out.edges.map((e) => e.id)).toEqual(['b-n1', 'n1-n2']);
        expect(out.stickies).toEqual(stickyEndDeck.stickies);
      },
      stickyEndDeck,
    );
  });

  it('deleting a connector leaves both stickies', () => {
    removeAndUndo(
      (editor) => editor.remove('edges', 'n1-n2'),
      (out) => {
        expect(out.stickies.map((s) => s.id)).toEqual(['n1', 'n2', 'near']);
      },
      stickyEndDeck,
    );
  });

  it('accepts a new connector to a sticky and an end moved onto one', () => {
    const { doc, editor } = setup(stickyEndDeck);
    editor.add('edges', { id: 'b-n2', from: 'b', to: 'n2' });
    editor.update('edges', 'a-b', { to: 'n2' });
    const out = toJSON(doc);
    expect(out.edges.find((e) => e.id === 'b-n2')).toEqual({ id: 'b-n2', from: 'b', to: 'n2' });
    expect(out.edges.find((e) => e.id === 'a-b')?.to).toBe('n2');
    expect(checkIntegrity(out)).toEqual([]);
    expect(() => editor.add('edges', { from: 'b', to: 'nothing' })).toThrow(
      expect.objectContaining({ code: 'missing-reference' }),
    );
  });
});
