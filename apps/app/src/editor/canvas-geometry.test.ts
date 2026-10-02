import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  CARD_SIZE_LIMITS,
  cardBox,
  cardSize,
  COLLAPSED_CARD_SIZE,
  displayPosition,
  freeSpot,
  GROUP_PADDING,
  groupBounds,
  nearestInDirection,
  NODE_SIZE,
  nearestToCentre,
  nodeSize,
  rectInView,
  selectionFrame,
} from './canvas-geometry';

const deck = (patch: Partial<SododeckFile>): SododeckFile => ({ ...emptySododeckFile(), ...patch });

describe('displayPosition', () => {
  it('uses the document position, else a 10-column grid', () => {
    expect(displayPosition({ position: { x: 3, y: 4 } }, 7)).toEqual({ x: 3, y: 4 });
    expect(displayPosition({}, 0)).toEqual({ x: 0, y: 0 });
    expect(displayPosition({}, 11)).toEqual({ x: 220, y: 110 });
  });
});

describe('CARD_SIZE_LIMITS (017 R2)', () => {
  it('is 120×44 to 800×600', () => {
    expect(CARD_SIZE_LIMITS).toEqual({
      min: { width: 120, height: 44 },
      max: { width: 800, height: 600 },
      step: 4,
    });
  });
});

describe('cardSize (017 R2/R3)', () => {
  it('keeps one size at every zoom level when the node has no stored size (§g-58)', () => {
    for (const level of ['landscape', 'system', 'container', 'component'] as const) {
      expect(cardSize({}, level)).toEqual(NODE_SIZE);
      expect(nodeSize(level)).toEqual(NODE_SIZE);
    }
  });

  it('is the stored size, unclamped when within the limits', () => {
    expect(cardSize({ size: { width: 244, height: 80 } }, 'system')).toEqual({
      width: 244,
      height: 80,
    });
  });

  it('clamps a stored size outside the limits', () => {
    expect(cardSize({ size: { width: 20, height: 900 } }, 'system')).toEqual({
      width: CARD_SIZE_LIMITS.min.width,
      height: CARD_SIZE_LIMITS.max.height,
    });
  });
});

describe('cardBox', () => {
  it('combines displayPosition and cardSize', () => {
    expect(
      cardBox({ position: { x: 10, y: 20 }, size: { width: 244, height: 80 } }, 0, 'system'),
    ).toEqual({ x: 10, y: 20, width: 244, height: 80 });
    expect(cardBox({}, 0, 'component')).toEqual({ x: 0, y: 0, ...NODE_SIZE });
  });
});

describe('groupBounds', () => {
  const d = deck({
    nodes: [
      { id: 'a', type: 'service', title: 'A', group: 'inner', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', group: 'inner', position: { x: 200, y: 100 } },
      { id: 'c', type: 'service', title: 'C', group: 'outer', position: { x: 0, y: 300 } },
    ],
    groups: [
      { id: 'outer', title: 'Outer' },
      { id: 'inner', title: 'Inner', parent: 'outer' },
      { id: 'empty', title: 'Empty' },
      { id: 'loop1', title: 'L1', parent: 'loop2' },
      { id: 'loop2', title: 'L2', parent: 'loop1' },
    ],
  });
  const bounds = groupBounds(d);

  it('wraps the members with padding', () => {
    expect(bounds.get('inner')).toEqual({
      x: -GROUP_PADDING,
      y: -GROUP_PADDING,
      width: 200 + NODE_SIZE.width + 2 * GROUP_PADDING,
      height: 100 + NODE_SIZE.height + 2 * GROUP_PADDING,
    });
  });

  it('contains nested groups', () => {
    const inner = bounds.get('inner');
    const outer = bounds.get('outer');
    expect(outer?.x).toBe((inner?.x ?? 0) - GROUP_PADDING);
    expect(outer?.y).toBe((inner?.y ?? 0) - GROUP_PADDING);
    expect((outer?.y ?? 0) + (outer?.height ?? 0)).toBe(300 + NODE_SIZE.height + GROUP_PADDING);
  });

  it('gives no bounds to an empty group and survives parent cycles', () => {
    expect(bounds.has('empty')).toBe(false);
    expect(bounds.has('loop1')).toBe(false);
  });

  it('fits the same card size at the component level', () => {
    const bounds = groupBounds(d, 'component');
    expect(bounds.get('inner')).toEqual({
      x: -GROUP_PADDING,
      y: -GROUP_PADDING,
      width: 200 + NODE_SIZE.width + 2 * GROUP_PADDING,
      height: 100 + NODE_SIZE.height + 2 * GROUP_PADDING,
    });
  });

  it('sizes each member with its own stored size (017)', () => {
    const sized = deck({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          group: 'g',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 200 },
        },
        { id: 'b', type: 'service', title: 'B', group: 'g', position: { x: 400, y: 0 } },
      ],
      groups: [{ id: 'g', title: 'G' }],
    });
    expect(groupBounds(sized).get('g')).toEqual({
      x: -GROUP_PADDING,
      y: -GROUP_PADDING,
      width: 400 + NODE_SIZE.width + 2 * GROUP_PADDING,
      height: 200 + 2 * GROUP_PADDING,
    });
  });

  it('is not cached across different card sizes (the cache is no longer keyed by one size)', () => {
    expect(groupBounds(d, 'system')).not.toBe(groupBounds(d, 'component'));
    expect(groupBounds(d, 'system')).toBe(groupBounds(d, 'system'));
  });
});

describe('groupBounds with stored frames (016)', () => {
  const frame = { position: { x: -500, y: -400 }, size: { width: 900, height: 700 } };
  const framed = deck({
    nodes: [
      { id: 'a', type: 'service', title: 'A', group: 'inner', position: { x: 0, y: 0 } },
      { id: 'c', type: 'service', title: 'C', group: 'outer', position: { x: 0, y: 100 } },
    ],
    groups: [
      { id: 'outer', title: 'Outer' },
      { id: 'inner', title: 'Inner', parent: 'outer', ...frame },
      { id: 'empty', title: 'Empty', position: { x: 1, y: 2 }, size: { width: 160, height: 96 } },
    ],
  });

  it('returns the stored frame of a group that has one, even with no members', () => {
    const bounds = groupBounds(framed, 'component');
    expect(bounds.get('inner')).toEqual({ x: -500, y: -400, width: 900, height: 700 });
    expect(bounds.get('empty')).toEqual({ x: 1, y: 2, width: 160, height: 96 });
  });

  it('falls back to the derived box, around stored child frames', () => {
    const outer = groupBounds(framed, 'component').get('outer');
    expect(outer).toEqual({
      x: -500 - GROUP_PADDING,
      y: -400 - GROUP_PADDING,
      width: 900 + 2 * GROUP_PADDING,
      height: 700 + 2 * GROUP_PADDING,
    });
  });

  it('is recomputed when deck.groups changes', () => {
    const first = groupBounds(framed, 'component');
    expect(groupBounds(framed, 'component')).toBe(first);
    const moved = {
      ...framed,
      groups: framed.groups.map((g) =>
        g.id === 'inner' ? { ...g, position: { x: 10, y: 20 } } : g,
      ),
    };
    expect(groupBounds(moved, 'component').get('inner')).toEqual({
      x: 10,
      y: 20,
      width: 900,
      height: 700,
    });
  });
});

describe('nodeSize', () => {
  it('returns the box size for each zoom level', () => {
    expect(nodeSize('landscape')).toEqual(NODE_SIZE);
    expect(nodeSize('system')).toEqual(NODE_SIZE);
    expect(nodeSize('container')).toEqual(NODE_SIZE);
    expect(nodeSize('component')).toEqual(NODE_SIZE);
    expect(COLLAPSED_CARD_SIZE).toEqual({ width: 180, height: 64 });
  });
});

describe('nearestToCentre', () => {
  const rect = (x: number, y: number) => ({ left: x, top: y, width: 10, height: 10 });

  it('picks the card whose centre is nearest the viewport centre', () => {
    expect(
      nearestToCentre(
        [
          { id: 'far', rect: rect(0, 0) },
          { id: 'mid', rect: rect(95, 95) },
        ],
        { x: 100, y: 100 },
      ),
    ).toBe('mid');
  });

  it('is null with no cards', () => {
    expect(nearestToCentre([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('nearestInDirection', () => {
  const points = [
    { id: 'c', x: 0, y: 0 },
    { id: 'r', x: 100, y: 10 },
    { id: 'r2', x: 100, y: -10 },
    { id: 'far', x: 300, y: 0 },
    { id: 'd', x: 5, y: 200 },
  ];

  it('picks the nearest point within ±45° of the direction', () => {
    expect(nearestInDirection(points, 'c', 'right')).toBe('r');
    expect(nearestInDirection(points, 'c', 'down')).toBe('d');
    expect(nearestInDirection(points, 'r', 'left')).toBe('c');
  });

  it('breaks ties by the smaller id', () => {
    const tied = [
      { id: 'o', x: 0, y: 0 },
      { id: 'b', x: 10, y: 5 },
      { id: 'a', x: 10, y: -5 },
    ];
    expect(nearestInDirection(tied, 'o', 'right')).toBe('a');
  });

  it('returns null when nothing lies that way', () => {
    expect(nearestInDirection(points, 'c', 'left')).toBeNull();
    expect(nearestInDirection(points, 'c', 'up')).toBeNull();
    expect(nearestInDirection(points, 'missing', 'up')).toBeNull();
  });
});

describe('freeSpot', () => {
  it('returns the spot when free, else steps +24/+24', () => {
    const d = deck({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 100, y: 100 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 124, y: 124 } },
      ],
    });
    expect(freeSpot(d, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(freeSpot(d, { x: 100, y: 100 })).toEqual({ x: 148, y: 148 });
  });
});

describe('boundsOf / rectInView (007)', () => {
  const d = deck({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 100 } },
      { id: 'c', type: 'service', title: 'C', position: { x: 900, y: 900 } },
    ],
  });

  it('boxes the given nodes, null when none exists', () => {
    expect(boundsOf(d, ['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 200 + NODE_SIZE.width,
      height: 100 + NODE_SIZE.height,
    });
    expect(boundsOf(d, [])).toBeNull();
    expect(boundsOf(d, ['gone'])).toBeNull();
  });

  it('sizes each node with its own stored size (017)', () => {
    const sized = deck({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 200 },
        },
        { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
      ],
    });
    expect(boundsOf(sized, ['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 400 + NODE_SIZE.width,
      height: 200,
    });
  });

  it('checks a rect against the viewport in screen pixels', () => {
    const rect = { x: 100, y: 100, width: 100, height: 50 };
    const size = { width: 400, height: 300 };
    expect(rectInView(rect, { x: 0, y: 0, zoom: 1 }, size)).toBe(true);
    expect(rectInView(rect, { x: 0, y: 0, zoom: 2 }, size)).toBe(true);
    expect(rectInView(rect, { x: 0, y: 0, zoom: 3 }, size)).toBe(false);
    expect(rectInView(rect, { x: -150, y: 0, zoom: 1 }, size)).toBe(false);
  });
});

describe('selectionFrame', () => {
  it('uses the card size when boxing the selection, at any level', () => {
    const d = deck({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 100 } },
      ],
    });
    expect(selectionFrame(d, ['a', 'b'], 'component')).toEqual({
      x: -8,
      y: -8,
      width: 200 + NODE_SIZE.width + 16,
      height: 100 + NODE_SIZE.height + 16,
    });
  });

  it('sizes each member with its own stored size (017)', () => {
    const d = deck({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 200 },
        },
        { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
      ],
    });
    expect(selectionFrame(d, ['a', 'b'])).toEqual({
      x: -8,
      y: -8,
      width: 400 + NODE_SIZE.width + 16,
      height: 200 + 16,
    });
  });
});
