import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { dropTarget, frameEntries, type FrameEntry } from './drop-target';

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

const frames: FrameEntry[] = [
  { id: 'outer', rect: rect(0, 0, 1000, 1000), depth: 0 },
  { id: 'inner', rect: rect(100, 100, 400, 400), depth: 1 },
  { id: 'deep', rect: rect(150, 150, 100, 100), depth: 2 },
  // A sibling of inner that overlaps it: same depth, larger.
  { id: 'wide', rect: rect(50, 50, 600, 600), depth: 1 },
  { id: 'far', rect: rect(2000, 0, 200, 200), depth: 0 },
];

describe('dropTarget (016 R6)', () => {
  it('picks the innermost frame under the pointer: deepest first, then the smaller area', () => {
    expect(dropTarget(frames, { x: 200, y: 200 }, new Set())).toBe('deep');
    expect(dropTarget(frames, { x: 300, y: 300 }, new Set())).toBe('inner');
    expect(dropTarget(frames, { x: 600, y: 600 }, new Set())).toBe('wide');
    expect(dropTarget(frames, { x: 900, y: 900 }, new Set())).toBe('outer');
  });

  it('skips the dragged groups and their descendants', () => {
    expect(dropTarget(frames, { x: 200, y: 200 }, new Set(['inner', 'deep']))).toBe('wide');
  });

  it('is null outside every frame', () => {
    expect(dropTarget(frames, { x: 1500, y: 1500 }, new Set())).toBeNull();
    expect(dropTarget([], { x: 0, y: 0 }, new Set())).toBeNull();
  });
});

describe('frameEntries', () => {
  it('lists the drawn frames with their nesting depth', () => {
    const deck = deckOf({
      groups: [
        { id: 'outer', title: 'Outer' },
        { id: 'inner', title: 'Inner', parent: 'outer' },
      ],
    });
    const bounds = new Map([
      ['outer', rect(0, 0, 10, 10)],
      ['inner', rect(1, 1, 5, 5)],
    ]);
    expect(frameEntries(deck, bounds, ['outer', 'inner'])).toEqual([
      { id: 'outer', rect: rect(0, 0, 10, 10), depth: 0 },
      { id: 'inner', rect: rect(1, 1, 5, 5), depth: 1 },
    ]);
    expect(frameEntries(deck, bounds, ['inner']).map((f) => f.id)).toEqual(['inner']);
  });
});
