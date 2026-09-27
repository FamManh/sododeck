import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  boundsOf,
  COLLAPSED_CARD_SIZE,
  COMPONENT_CARD_SIZE,
  displayPosition,
  freeSpot,
  GROUP_PADDING,
  groupBounds,
  nearestInDirection,
  NODE_SIZE,
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

  it('accepts a taller component-level node size', () => {
    const bounds = groupBounds(d, COMPONENT_CARD_SIZE);
    expect(bounds.get('inner')).toEqual({
      x: -GROUP_PADDING,
      y: -GROUP_PADDING,
      width: 200 + COMPONENT_CARD_SIZE.width + 2 * GROUP_PADDING,
      height: 100 + COMPONENT_CARD_SIZE.height + 2 * GROUP_PADDING,
    });
  });
});

describe('nodeSize', () => {
  it('returns the box size for each zoom level', () => {
    expect(nodeSize('landscape')).toEqual(NODE_SIZE);
    expect(nodeSize('system')).toEqual(NODE_SIZE);
    expect(nodeSize('container')).toEqual(NODE_SIZE);
    expect(nodeSize('component')).toEqual(COMPONENT_CARD_SIZE);
    expect(COLLAPSED_CARD_SIZE).toEqual({ width: 180, height: 64 });
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
  it('uses the provided node size when boxing the selection', () => {
    const d = deck({
      nodes: [
        { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 100 } },
      ],
    });
    expect(selectionFrame(d, ['a', 'b'], COMPONENT_CARD_SIZE)).toEqual({
      x: -8,
      y: -8,
      width: 200 + COMPONENT_CARD_SIZE.width + 16,
      height: 100 + COMPONENT_CARD_SIZE.height + 16,
    });
  });
});
