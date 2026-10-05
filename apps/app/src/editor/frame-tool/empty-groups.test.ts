import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { groupBounds } from '../canvas-geometry';
import { dropTarget, frameEntries } from '../editing/drop-target';
import { membershipChanges } from '../editing/membership-changes';
import { buildScene } from '../export/scene';
import { visibleGraph } from '../visible-graph';

/** A frame drawn first (031 US2): a framed group with nothing in it, next to a card. */
const deck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
  groups: [
    { id: 'pay', title: 'Payments', position: { x: 400, y: 0 }, size: { width: 320, height: 200 } },
  ],
});
const top = { node: null, group: null };

describe('empty groups on the canvas (031 FR-010, FR-011)', () => {
  it('is drawn at its stored frame', () => {
    expect(visibleGraph(deck, top, new Set()).groups).toEqual(['pay']);
    expect(groupBounds(deck).get('pay')).toEqual({ x: 400, y: 0, width: 320, height: 200 });
  });

  it('is a drop target: a card dropped onto it joins it', () => {
    const graph = visibleGraph(deck, top, new Set());
    const frames = frameEntries(deck, groupBounds(deck), graph.groups);
    expect(dropTarget(frames, { x: 500, y: 100 }, new Set())).toBe('pay');
    expect(dropTarget(frames, { x: 900, y: 100 }, new Set())).toBeNull();
    const drop = { target: 'pay', scope: undefined, keep: false };
    expect(membershipChanges(deck, { nodes: ['a'], groups: [] }, drop)).toEqual([
      { kind: 'node', id: 'a', from: undefined, to: 'pay' },
    ]);
    // And out again: the frame keeps its size, nothing deletes it.
    const inside = { ...deck, nodes: [{ ...deck.nodes[0], group: 'pay' }] } as typeof deck;
    expect(
      membershipChanges(inside, { nodes: ['a'], groups: [] }, { ...drop, target: null }),
    ).toEqual([{ kind: 'node', id: 'a', from: 'pay', to: undefined }]);
  });

  it('collapses to a card counting 0', () => {
    const graph = visibleGraph(deck, top, new Set(['pay']));
    expect(graph.cards).toMatchObject([{ groupId: 'pay', nodeCount: 0 }]);
  });

  it('can be drilled into, showing nothing inside', () => {
    const graph = visibleGraph(deck, { node: null, group: 'pay' }, new Set());
    expect(graph.nodes).toEqual([]);
    expect(graph.groups).toEqual([]);
  });

  it('exports as a frame with a count of 0', () => {
    const scene = buildScene({
      deck,
      scope: 'deck',
      ui: {
        currentViewId: null,
        revealed: new Set(),
        drill: [],
        activeFlowId: null,
      },
    });
    expect(scene.groups).toMatchObject([{ id: 'pay', label: 'Payments', count: 0 }]);
  });
});
