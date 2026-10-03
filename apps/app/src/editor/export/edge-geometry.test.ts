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
    const edge = edgePath(from, to, undefined, 'elbow', 'none');
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
      undefined,
      'elbow',
    );
    expect(contains(edge.extent, edge.source.x, edge.source.y)).toBe(true);
    expect(contains(edge.extent, edge.target.x, edge.target.y)).toBe(true);
    expect(edge.extent.x).toBe(Math.min(edge.source.x, edge.target.x) - 20);
  });

  it('pins the handles to a route, ignoring the automatic centre comparison (017)', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 0, width: 100, height: 50 };
    const edge = edgePath(from, to, { fromSide: 'top', toSide: 'top' }, 'elbow');
    expect(edge.source).toEqual(handlePoint(from, 'top'));
    expect(edge.target).toEqual(handlePoint(to, 'top'));
  });

  it('shifts labelX and widens the extent for an offset horizontal pair (017)', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 0, width: 100, height: 50 };
    const plain = edgePath(from, to, undefined, 'elbow');
    const routed = edgePath(from, to, { offset: 200 }, 'elbow');
    expect(routed.labelX).toBe(plain.labelX + 200);
    expect(routed.extent.x + routed.extent.width).toBeGreaterThan(
      plain.extent.x + plain.extent.width,
    );
  });

  describe('the three line types (029 R4)', () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 300, y: 100, width: 100, height: 50 };

    it('draws curved (the default) as one cubic from card side to card side', () => {
      const edge = edgePath(from, to);
      expect(edge.path).toMatch(/^M [\d.-]+ [\d.-]+ C /);
      expect(edge.source).toEqual({ x: 100, y: 25 });
      expect(edge.target).toEqual({ x: 300, y: 125 });
      expect(edge.ends).toMatchObject({ start: edge.source, end: edge.target });
    });

    it('draws straight as one line between the side midpoints', () => {
      const edge = edgePath(from, to, undefined, 'straight', 'none');
      expect(edge.path).toBe('M 100 25 L 300 125');
      expect(edge.ends.startDir.x).toBeCloseTo(0.894, 2);
    });

    it('stops the line one arrow short of an end that carries an arrow', () => {
      const none = edgePath(from, to, undefined, 'straight', 'none').path;
      const forward = edgePath(from, to, undefined, 'straight', 'forward').path;
      const both = edgePath(from, to, undefined, 'straight', 'both').path;
      expect(none).toBe('M 100 25 L 300 125');
      expect(forward).not.toBe(none);
      expect(both).not.toBe(forward);
    });

    it('keeps the same end points for every shape', () => {
      const [curved, elbow, straight] = (['curved', 'elbow', 'straight'] as const).map((shape) =>
        edgePath(from, to, undefined, shape),
      );
      expect(curved?.source).toEqual(elbow?.source);
      expect(straight?.target).toEqual(elbow?.target);
    });

    it('has an extent around the whole curve and both ends', () => {
      const edge = edgePath(from, to);
      for (const point of [edge.source, edge.target]) {
        expect(contains(edge.extent, point.x, point.y)).toBe(true);
      }
    });
  });
});
