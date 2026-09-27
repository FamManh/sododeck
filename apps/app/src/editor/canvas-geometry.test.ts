import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  displayPosition,
  freeSpot,
  GROUP_PADDING,
  groupBounds,
  nearestInDirection,
  NODE_SIZE,
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
