import { describe, expect, it } from 'vitest';

import { blockSize, layoutRow } from './layout-row';

const s = (width: number, height = 50) => ({ width, height });

describe('layoutRow (055)', () => {
  it('puts pictures in a row with a 16 px gap', () => {
    expect(layoutRow([s(100), s(60), s(40)], { x: 10, y: 20 }, 1000)).toEqual([
      { x: 10, y: 20 },
      { x: 126, y: 20 },
      { x: 202, y: 20 },
    ]);
  });

  it('wraps at the visible width and drops below the tallest picture of the line', () => {
    const points = layoutRow([s(100, 80), s(100, 40), s(100, 10)], { x: 0, y: 0 }, 230);
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 116, y: 0 },
      { x: 0, y: 96 },
    ]);
  });

  it('gives a picture wider than the line a line of its own, never overlapping', () => {
    const sizes = [s(300, 40), s(50, 40)];
    const points = layoutRow(sizes, { x: 0, y: 0 }, 200);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 0, y: 56 });
  });

  it('measures the block it lays out', () => {
    expect(blockSize([s(100, 80), s(100, 40), s(100, 10)], 230)).toEqual({
      width: 216,
      height: 106,
    });
    expect(blockSize([], 100)).toEqual({ width: 0, height: 0 });
  });

  it('is empty for no pictures', () => {
    expect(layoutRow([], { x: 0, y: 0 }, 100)).toEqual([]);
  });
});
