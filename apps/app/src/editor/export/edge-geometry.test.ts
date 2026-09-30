import { describe, expect, it } from 'vitest';

import { edgePath, handlePoint } from './edge-geometry';

function contains(
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

describe('edgePath', () => {
  it('goes from the right side to the left side for cards left to right', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 0, width: 100, height: 50 };
    const edge = edgePath(from, to);
    expect(edge.source).toEqual(handlePoint(from, 'right'));
    expect(edge.target).toEqual(handlePoint(to, 'left'));
    expect(edge.path).toMatch(/^M ?100[ ,]25/);
    expect(edge.labelX).toBe(200);
  });

  it('goes from the bottom side to the top side for stacked cards', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 0, y: 300, width: 100, height: 50 };
    const edge = edgePath(from, to);
    expect(edge.source).toEqual({ x: 50, y: 50 });
    expect(edge.target).toEqual({ x: 50, y: 300 });
  });

  it('has an extent around both handles', () => {
    const edge = edgePath(
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 300, y: 200, width: 100, height: 50 },
    );
    expect(contains(edge.extent, edge.source.x, edge.source.y)).toBe(true);
    expect(contains(edge.extent, edge.target.x, edge.target.y)).toBe(true);
    expect(edge.extent.x).toBe(Math.min(edge.source.x, edge.target.x) - 20);
  });

  it('pins the handles to a route, ignoring the automatic centre comparison (017)', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 0, width: 100, height: 50 };
    const edge = edgePath(from, to, { fromSide: 'top', toSide: 'top' });
    expect(edge.source).toEqual(handlePoint(from, 'top'));
    expect(edge.target).toEqual(handlePoint(to, 'top'));
  });

  it('shifts labelX and widens the extent for an offset horizontal pair (017)', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 0, width: 100, height: 50 };
    const plain = edgePath(from, to);
    const routed = edgePath(from, to, { offset: 200 });
    expect(routed.labelX).toBe(plain.labelX + 200);
    expect(routed.extent.x + routed.extent.width).toBeGreaterThan(
      plain.extent.x + plain.extent.width,
    );
  });
});
