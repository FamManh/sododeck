import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { visibleGraph } from '../visible-graph';
import { clickFrame, clampToMinimum, DEFAULT_FRAME, framePlan } from './frame-draw';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    // 184 × 76 cards (one title line).
    { id: 'a', type: 'service', title: 'A', position: { x: 100, y: 100 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 100 } },
    // Partly inside the rect drawn in the tests.
    { id: 'c', type: 'service', title: 'C', position: { x: 650, y: 100 } },
    { id: 'in', type: 'service', title: 'In', group: 'outer', position: { x: 1100, y: 120 } },
    { id: 'd', type: 'diamond', title: 'D', position: { x: 100, y: 300 } },
  ],
  groups: [
    { id: 'outer', title: 'Outer', position: { x: 1000, y: 0 }, size: { width: 800, height: 600 } },
    {
      id: 'inner',
      title: 'Inner',
      parent: 'outer',
      position: { x: 1400, y: 300 },
      size: { width: 200, height: 150 },
    },
  ],
  stickies: [{ id: 's1', text: 'note', position: { x: 120, y: 120 } }],
};

const graph = (scopeGroup: string | null = null) =>
  visibleGraph(deck, { node: null, group: scopeGroup }, new Set());

describe('framePlan (031 US2)', () => {
  it('takes the cards and shapes fully inside, not those partly inside, nor stickies', () => {
    const plan = framePlan(deck, graph(), { x: 80, y: 80, width: 600, height: 400 });
    expect(plan.nodes).toEqual(['a', 'b', 'd']);
    expect(plan.groups).toEqual([]);
    expect(plan.parent).toBeUndefined();
    expect(plan.frame).toEqual({ position: { x: 80, y: 80 }, size: { width: 600, height: 400 } });
  });

  it('is empty on empty canvas', () => {
    const plan = framePlan(deck, graph(), { x: -900, y: -900, width: 300, height: 200 });
    expect(plan).toMatchObject({ nodes: [], groups: [], parent: undefined });
  });

  it('a frame drawn inside another frame becomes its child, taking that level’s items', () => {
    const plan = framePlan(deck, graph(), { x: 1050, y: 50, width: 600, height: 500 });
    expect(plan.parent).toBe('outer');
    expect(plan.nodes).toEqual(['in']);
    expect(plan.groups).toEqual(['inner']);
  });

  it('takes the drilled-in group as the parent on its own empty space', () => {
    const plan = framePlan(deck, graph('outer'), { x: 3000, y: 3000, width: 200, height: 100 });
    expect(plan.parent).toBe('outer');
  });

  it('clamps a small drag to the minimum frame, keeping its corner', () => {
    expect(clampToMinimum({ x: 10, y: 20, width: 40, height: 300 })).toEqual({
      x: 10,
      y: 20,
      width: 160,
      height: 300,
    });
  });

  it('places a 320 × 200 frame centred on a click', () => {
    expect(DEFAULT_FRAME).toEqual({ width: 320, height: 200 });
    expect(clickFrame({ x: 500, y: 400 })).toEqual({ x: 340, y: 300, width: 320, height: 200 });
  });
});
