import { getSmoothStepPath, Position } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { ARROW_LENGTH } from '../edge-constants';
import {
  middleSegment,
  nearestSide,
  resolveSides,
  routedPath,
  routedStepPath,
  type Box,
  type PathShape,
} from './route-path';

const near: Box = { x: 0, y: 0, width: 160, height: 50 };
const far = (x: number, y: number, width = 160, height = 50): Box => ({ x, y, width, height });

describe('resolveSides', () => {
  it('picks sides by comparing centres, same as facingSides for equal-size cards', () => {
    expect(resolveSides(near, far(300, 0))).toEqual(['right', 'left']);
    expect(resolveSides(near, far(-300, 0))).toEqual(['left', 'right']);
    expect(resolveSides(near, far(0, 300))).toEqual(['bottom', 'top']);
    expect(resolveSides(near, far(0, -300))).toEqual(['top', 'bottom']);
  });

  it('a pinned side from the route wins over the computed one', () => {
    expect(resolveSides(near, far(300, 0), { fromSide: 'top' })).toEqual(['top', 'left']);
    expect(resolveSides(near, far(300, 0), { toSide: 'bottom' })).toEqual(['right', 'bottom']);
    expect(resolveSides(near, far(300, 0), { fromSide: 'top', toSide: 'bottom' })).toEqual([
      'top',
      'bottom',
    ]);
  });
});

describe('middleSegment', () => {
  const sides: [string, string][] = [
    ['top', 'top'],
    ['top', 'right'],
    ['top', 'bottom'],
    ['top', 'left'],
    ['right', 'top'],
    ['right', 'right'],
    ['right', 'bottom'],
    ['right', 'left'],
    ['bottom', 'top'],
    ['bottom', 'right'],
    ['bottom', 'bottom'],
    ['bottom', 'left'],
    ['left', 'top'],
    ['left', 'right'],
    ['left', 'bottom'],
    ['left', 'left'],
  ];

  it.each(sides)('%s → %s', (from, to) => {
    const axis = middleSegment([from, to] as [never, never]);
    if ((from === 'top' && to === 'bottom') || (from === 'bottom' && to === 'top')) {
      expect(axis).toBe('vertical');
    } else if ((from === 'left' && to === 'right') || (from === 'right' && to === 'left')) {
      expect(axis).toBe('horizontal');
    } else {
      expect(axis).toBeNull();
    }
  });
});

describe('nearestSide', () => {
  it('picks the closest edge of the box to the point', () => {
    const box: Box = { x: 100, y: 100, width: 160, height: 50 };
    expect(nearestSide(box, { x: 101, y: 120 })).toBe('left');
    expect(nearestSide(box, { x: 259, y: 120 })).toBe('right');
    expect(nearestSide(box, { x: 150, y: 101 })).toBe('top');
    expect(nearestSide(box, { x: 150, y: 149 })).toBe('bottom');
  });
});

describe('routedStepPath', () => {
  const common = { sourceX: 0, sourceY: 0, targetX: 300, targetY: 0 };

  it('with no route, equals getSmoothStepPath exactly', () => {
    const [path, labelX, labelY] = getSmoothStepPath({
      ...common,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      borderRadius: 8,
    });
    const routed = routedStepPath({ ...common, sides: ['right', 'left'] });
    expect(routed).toEqual({ path, labelX, labelY, segment: expect.any(Object) as unknown });
    expect(routed.path).toBe(path);
    expect(routed.labelX).toBe(labelX);
    expect(routed.labelY).toBe(labelY);
  });

  it('offset on a vertical pair (top/bottom) moves the middle segment and labelY', () => {
    const vertical = { sourceX: 0, sourceY: 0, targetX: 0, targetY: 300 };
    const base = routedStepPath({ ...vertical, sides: ['bottom', 'top'] });
    const routed = routedStepPath({ ...vertical, sides: ['bottom', 'top'], offset: 60 });
    expect(routed.labelY).toBe(base.labelY + 60);
    expect(routed.segment).toMatchObject({ axis: 'vertical', at: base.labelY + 60 });
    expect(routed.path).not.toBe(base.path);
  });

  it('offset on a horizontal pair (left/right) moves the middle segment and labelX', () => {
    const base = routedStepPath({ ...common, sides: ['right', 'left'] });
    const routed = routedStepPath({ ...common, sides: ['right', 'left'], offset: 60 });
    expect(routed.labelX).toBe(base.labelX + 60);
    expect(routed.segment).toMatchObject({ axis: 'horizontal', at: base.labelX + 60 });
    expect(routed.path).not.toBe(base.path);
  });

  it('ignores the offset on a perpendicular or same-side pair, and segment is null', () => {
    const perpendicular = routedStepPath({ ...common, sides: ['right', 'top'], offset: 60 });
    const sameSide = routedStepPath({ ...common, sides: ['right', 'right'], offset: 60 });
    expect(perpendicular.segment).toBeNull();
    expect(sameSide.segment).toBeNull();
    expect(perpendicular).toEqual(
      routedStepPath({ ...common, sides: ['right', 'top'], offset: 0 }),
    );
    expect(sameSide).toEqual(routedStepPath({ ...common, sides: ['right', 'right'], offset: 0 }));
  });
});

describe('routedPath', () => {
  const shapes: PathShape[] = ['curved', 'elbow', 'straight'];
  const from: Box = { x: 0, y: 0, width: 184, height: 100 };
  const to: Box = { x: 400, y: 40, width: 184, height: 100 };
  const sides: ['right', 'left'] = ['right', 'left'];
  const noArrows = { arrowAtEnd: false };

  it.each(shapes)('%s starts and ends at the side midpoints (Q4)', (shape) => {
    const { ends } = routedPath(shape, from, to, sides, 0);
    expect(ends.start).toEqual({ x: 184, y: 50 });
    expect(ends.end).toEqual({ x: 400, y: 90 });
  });

  it('ends never move when the shape changes', () => {
    const [curved, elbow, straight] = shapes.map((shape) => routedPath(shape, from, to, sides, 0));
    expect(elbow?.ends.start).toEqual(curved?.ends.start);
    expect(elbow?.ends.end).toEqual(curved?.ends.end);
    expect(straight?.ends.start).toEqual(curved?.ends.start);
    expect(straight?.ends.end).toEqual(curved?.ends.end);
  });

  it('elbow without arrows is exactly the step path from the same points', () => {
    const step = routedStepPath({
      sourceX: 184,
      sourceY: 50,
      targetX: 400,
      targetY: 90,
      sides,
      offset: 30,
    });
    const routed = routedPath('elbow', from, to, sides, 30, noArrows);
    expect(routed.path).toBe(step.path);
    expect(routed.labelX).toBe(step.labelX);
    expect(routed.labelY).toBe(step.labelY);
    expect(routed.segment).toEqual(step.segment);
  });

  it('elbow stops an arrow length short of the target, along the side normal', () => {
    const step = routedStepPath({
      sourceX: 184,
      sourceY: 50,
      targetX: 400 - ARROW_LENGTH,
      targetY: 90,
      sides,
    });
    expect(routedPath('elbow', from, to, sides, 0).path).toBe(step.path);
  });

  it('curved control points lie on the side normals', () => {
    const { path } = routedPath('curved', from, to, sides, 0, noArrows);
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    // M sx sy C c1x c1y c2x c2y ex ey
    const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = numbers;
    expect(path.startsWith('M')).toBe(true);
    expect(c1y).toBe(sy);
    expect(c1x).toBeGreaterThan(sx ?? 0);
    expect(c2y).toBe(ey);
    expect(c2x).toBeLessThan(ex ?? 0);
  });

  it('curved on a vertical pair leaves along the vertical normal', () => {
    const below: Box = { x: 20, y: 300, width: 184, height: 100 };
    const { path, ends } = routedPath('curved', from, below, ['bottom', 'top'], 0, noArrows);
    const [sx, , c1x, c1y, , , ,] = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(c1x).toBe(sx);
    expect(c1y).toBeGreaterThan(ends.start.y);
  });

  it('straight is one M L segment', () => {
    const { path } = routedPath('straight', from, to, sides, 0, noArrows);
    expect(path).toBe('M 184 50 L 400 90');
  });

  it('straight is shortened by the arrow length', () => {
    const { path, ends } = routedPath('straight', from, to, sides, 0);
    const [, , ex, ey] = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(Math.hypot(400 - (ex ?? 0), 90 - (ey ?? 0))).toBeCloseTo(ARROW_LENGTH, 5);
    expect(ends.end).toEqual({ x: 400, y: 90 });
  });

  it('endDir points into the target side for curved and elbow', () => {
    for (const shape of ['curved', 'elbow'] as const) {
      expect(routedPath(shape, from, to, sides, 0).ends.endDir).toEqual({ x: 1, y: 0 });
      expect(routedPath(shape, from, to, ['right', 'top'], 0).ends.endDir).toEqual({ x: 0, y: 1 });
    }
  });

  it('startDir leaves along the start side normal', () => {
    expect(routedPath('curved', from, to, sides, 0).ends.startDir).toEqual({ x: 1, y: 0 });
    expect(routedPath('elbow', from, to, ['bottom', 'left'], 0).ends.startDir).toEqual({
      x: 0,
      y: 1,
    });
  });

  it('straight directions run along the line', () => {
    const { ends } = routedPath('straight', from, to, sides, 0);
    const length = Math.hypot(216, 40);
    expect(ends.endDir.x).toBeCloseTo(216 / length, 10);
    expect(ends.endDir.y).toBeCloseTo(40 / length, 10);
    expect(ends.startDir).toEqual(ends.endDir);
  });

  it.each(shapes)(
    '%s self-loop leaves the right side and enters the top, non-degenerate',
    (shape) => {
      const { path, ends } = routedPath(shape, from, from, ['right', 'left'], 0);
      expect(ends.start).toEqual({ x: 184, y: 50 });
      expect(ends.end).toEqual({ x: 92, y: 0 });
      expect(ends.endDir).toEqual({ x: 0, y: 1 });
      expect(path.startsWith('M 184 50 C')).toBe(true);
    },
  );

  it.each(shapes)('%s with a gap shorter than the arrow has no path but valid ends', (shape) => {
    const touching: Box = { x: 184 + 4, y: 0, width: 184, height: 100 };
    const result = routedPath(shape, from, touching, sides, 0);
    expect(result.path).toBe('');
    expect(result.ends.start).toEqual({ x: 184, y: 50 });
    expect(result.ends.end).toEqual({ x: 188, y: 50 });
    expect(result.ends.endDir).toEqual({ x: 1, y: 0 });
    expect(Number.isFinite(result.labelX) && Number.isFinite(result.labelY)).toBe(true);
  });

  it('shortens at the start too when there is an arrow there', () => {
    const both = routedPath('straight', from, to, sides, 0, {
      arrowAtStart: true,
      arrowAtEnd: true,
    });
    const [sx] = both.path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(Math.hypot((sx ?? 0) - 184, 0)).toBeGreaterThan(8);
  });
});

describe('routedPath spread (034 R6)', () => {
  const to = far(400, 120);
  const sides = ['right', 'left'] as const;
  const shapes: PathShape[] = ['curved', 'elbow', 'straight'];

  it.each(shapes)("returns exactly today's %s path for no spread or 0", (shape) => {
    const base = routedPath(shape, near, to, sides, 12);
    expect(routedPath(shape, near, to, sides, 12, {}, undefined)).toEqual(base);
    expect(routedPath(shape, near, to, sides, 12, {}, 0)).toEqual(base);
  });

  it('moves the curve control points along the chord normal, and the label with them', () => {
    const base = routedPath('curved', near, to, sides);
    const moved = routedPath('curved', near, to, sides, 0, {}, 14);
    expect(moved.path).not.toBe(base.path);
    expect(moved.labelY).not.toBe(base.labelY);
    const opposite = routedPath('curved', near, to, sides, 0, {}, -14);
    // Symmetric about the unspread curve.
    expect(moved.labelX + opposite.labelX).toBeCloseTo(2 * base.labelX, 5);
    expect(moved.labelY + opposite.labelY).toBeCloseTo(2 * base.labelY, 5);
    // Both ends stay on the card sides.
    expect(moved.ends).toEqual(base.ends);
  });

  it("adds the spread to the elbow's middle segment, without a stored route", () => {
    const moved = routedPath('elbow', near, to, sides, 0, {}, 20);
    expect(moved.path).toBe(routedPath('elbow', near, to, sides, 20).path);
    expect(moved.segment?.at).toBe(routedPath('elbow', near, to, sides, 20).segment?.at);
  });

  it('shifts a straight line sideways and moves its label point', () => {
    const base = routedPath('straight', near, to, sides);
    const moved = routedPath('straight', near, to, sides, 0, {}, 14);
    expect(moved.path).not.toBe(base.path);
    expect(Math.hypot(moved.labelX - base.labelX, moved.labelY - base.labelY)).toBeCloseTo(14, 5);
  });

  it('spreads an elbow with no middle segment by moving its ends', () => {
    const corner = routedPath('elbow', near, far(300, 200), ['right', 'top']);
    const moved = routedPath('elbow', near, far(300, 200), ['right', 'top'], 0, {}, 14);
    expect(moved.path).not.toBe(corner.path);
  });
});
