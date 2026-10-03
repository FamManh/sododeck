import type { RouteWaypoint, Side } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { ARROW_LENGTH } from '../edge-constants';
import {
  anchorPoint,
  autoSides,
  cardCentre,
  connectorPath,
  decodeWaypoints,
  encodeWaypoint,
  labelPoint,
  offsetBends,
  pointsToPath,
  projectOnPath,
  samplePath,
  simplifyWaypoints,
  snapBend,
  type PathPoint,
} from './connector-geometry';
import { resolveSides, routedPath, routedStepPath, type Box, type PathShape } from './route-path';

const box = (x: number, y: number, width = 160, height = 50): Box => ({ x, y, width, height });
const from = box(0, 0);
const SHAPES: PathShape[] = ['curved', 'elbow', 'straight'];
const TARGETS: [string, Box][] = [
  ['right', box(400, 20)],
  ['left', box(-400, 20)],
  ['below', box(30, 300)],
  ['above', box(30, -300)],
  ['overlapping', box(80, 20)],
];

describe('connectorPath without bends or anchors', () => {
  it.each(SHAPES)('%s equals routedPath for every direction and self-loop', (shape) => {
    for (const [, to] of [...TARGETS, ['loop', from] as [string, Box]]) {
      for (const options of [
        {},
        { arrowAtStart: true },
        { arrowAtEnd: false },
        { arrowAtStart: true, arrowAtEnd: true },
      ]) {
        const sides = resolveSides(from, to);
        expect(connectorPath({ shape, fromBox: from, toBox: to, sides, options })).toEqual(
          routedPath(shape, from, to, sides, 0, options),
        );
      }
    }
  });

  it('keeps a 017 offset exactly', () => {
    const to = box(400, 120);
    const sides = resolveSides(from, to);
    expect(
      connectorPath({ shape: 'elbow', fromBox: from, toBox: to, sides, route: { offset: 40 } }),
    ).toEqual(routedPath('elbow', from, to, sides, 40));
  });

  it('an empty route and empty waypoints count as none', () => {
    const to = box(400, 20);
    const sides = resolveSides(from, to);
    expect(connectorPath({ shape: 'curved', fromBox: from, toBox: to, sides, route: {} })).toEqual(
      routedPath('curved', from, to, sides),
    );
  });
});

describe('anchorPoint', () => {
  const b = box(100, 200, 160, 50);
  it('sits on the side midpoint by default', () => {
    expect(anchorPoint(b, 'top')).toEqual({ x: 180, y: 200 });
    expect(anchorPoint(b, 'bottom')).toEqual({ x: 180, y: 250 });
    expect(anchorPoint(b, 'left')).toEqual({ x: 100, y: 225 });
    expect(anchorPoint(b, 'right')).toEqual({ x: 260, y: 225 });
  });

  it.each([0, 0.25, 0.5, 1])('runs left to right and top to bottom at %s', (at) => {
    expect(anchorPoint(b, 'top', at)).toEqual({ x: 100 + 160 * at, y: 200 });
    expect(anchorPoint(b, 'bottom', at)).toEqual({ x: 100 + 160 * at, y: 250 });
    expect(anchorPoint(b, 'left', at)).toEqual({ x: 100, y: 200 + 50 * at });
    expect(anchorPoint(b, 'right', at)).toEqual({ x: 260, y: 200 + 50 * at });
  });

  it('cardCentre is the middle of the box', () => {
    expect(cardCentre(b)).toEqual({ x: 180, y: 225 });
  });
});

describe('waypoint encoding', () => {
  const s = { x: 80, y: 25 };
  const t = { x: 480, y: 325 };

  it('round-trips within 1e-9 for fraction bends', () => {
    for (const p of [
      { x: 100, y: 25 },
      { x: 480, y: 300 },
      { x: -50, y: 700 },
      { x: 280, y: 175 },
    ]) {
      const [back] = decodeWaypoints([encodeWaypoint(p, s, t)], s, t);
      expect(back?.x).toBeCloseTo(p.x, 9);
      expect(back?.y).toBeCloseTo(p.y, 9);
    }
  });

  it('uses a fraction when the span is 22 px or more, a px offset from the midpoint under it', () => {
    expect(encodeWaypoint({ x: 280, y: 175 }, s, t)).toEqual({ x: 0.5, y: 0.5 });
    const a = { x: 100, y: 0 };
    const b = { x: 110, y: 22 };
    expect(encodeWaypoint({ x: 130, y: 40 }, a, b)).toEqual({ dx: 25, y: 40 / 22 });
    const small = encodeWaypoint({ x: 100, y: 0 }, a, { x: 121.9, y: 21.9 });
    expect(small.dx).toBeCloseTo(-10.95, 9);
    expect(small.dy).toBeCloseTo(-10.95, 9);
  });

  it('moving both centres by the same delta moves every bend by exactly that delta', () => {
    const waypoints: RouteWaypoint[] = [
      { x: 0.5, dy: -88 },
      { dx: 12, y: 1.25 },
    ];
    const before = decodeWaypoints(waypoints, s, t);
    const d = { x: 33, y: -17 };
    const after = decodeWaypoints(
      waypoints,
      { x: s.x + d.x, y: s.y + d.y },
      { x: t.x + d.x, y: t.y + d.y },
    );
    after.forEach((p, i) => {
      expect(p.x).toBeCloseTo((before[i]?.x ?? NaN) + d.x, 9);
      expect(p.y).toBeCloseTo((before[i]?.y ?? NaN) + d.y, 9);
    });
  });

  it('a zero span decodes to the end column without NaN or Infinity', () => {
    const same = { x: 100, y: 100 };
    const points = decodeWaypoints(
      [
        { x: 0.5, y: 3 },
        { dx: 9, dy: 9 },
      ],
      same,
      same,
    );
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(points[0]).toEqual({ x: 100, y: 100 });
  });
});

describe('offsetBends', () => {
  it('returns the two corners of a vertical-axis segment, nearest the start first', () => {
    const segment = { axis: 'vertical' as const, at: 120, from: 80, to: 480 };
    expect(offsetBends(segment, { x: 80, y: 50 })).toEqual([
      { x: 80, y: 120 },
      { x: 480, y: 120 },
    ]);
    expect(offsetBends(segment, { x: 480, y: 50 })).toEqual([
      { x: 480, y: 120 },
      { x: 80, y: 120 },
    ]);
  });

  it('returns the two corners of a horizontal-axis segment', () => {
    const segment = { axis: 'horizontal' as const, at: 300, from: 25, to: 225 };
    expect(offsetBends(segment, { x: 160, y: 25 })).toEqual([
      { x: 300, y: 25 },
      { x: 300, y: 225 },
    ]);
    expect(offsetBends(segment, { x: 160, y: 225 })).toEqual([
      { x: 300, y: 225 },
      { x: 300, y: 25 },
    ]);
  });

  it('matches the corners routedStepPath puts around its middle segment', () => {
    const step = routedStepPath({
      sourceX: 160,
      sourceY: 25,
      targetX: 400,
      targetY: 205,
      sides: ['right', 'left'],
      offset: 30,
    });
    if (step.segment === null) throw new Error('expected a segment');
    const [a, b] = offsetBends(step.segment, { x: 160, y: 25 });
    expect(a.x).toBeCloseTo(step.labelX, 9);
    expect(b.x).toBeCloseTo(step.labelX, 9);
    expect([a.y, b.y].sort((p, q) => p - q)).toEqual([25, 205]);
  });
});

describe('autoSides', () => {
  const to = box(400, 20);
  it('without bends is resolveSides', () => {
    expect(autoSides(from, to, [], undefined)).toEqual(resolveSides(from, to));
    expect(autoSides(from, to, [], { fromSide: 'top' })).toEqual(
      resolveSides(from, to, { fromSide: 'top' }),
    );
  });

  it('faces the first bend from the source and the last bend into the target', () => {
    expect(
      autoSides(
        from,
        to,
        [
          { x: 80, y: -120 },
          { x: 480, y: -120 },
        ],
        undefined,
      ),
    ).toEqual(['top', 'top']);
    expect(autoSides(from, to, [{ x: 80, y: 200 }], undefined)).toEqual(['bottom', 'left']);
  });

  it('keeps a pinned side', () => {
    expect(autoSides(from, to, [{ x: 80, y: -120 }], { fromSide: 'left' })).toEqual([
      'left',
      'left',
    ]);
    expect(autoSides(from, to, [{ x: 80, y: -120 }], { toSide: 'right' })).toEqual([
      'top',
      'right',
    ]);
  });
});

/** Reads M/L/Q/C commands back into numbers: [command, ...numbers]. */
function commands(path: string): [string, ...number[]][] {
  const out: [string, ...number[]][] = [];
  for (const match of path.matchAll(/([MLCQ])([^MLCQ]*)/g)) {
    const numbers = (match[2] ?? '').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    out.push([match[1] ?? '', ...numbers.map(Number)]);
  }
  return out;
}

const NORMALS: Record<Side, PathPoint> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

describe('pointsToPath', () => {
  const normals = (a: Side, b: Side) => ({
    start: NORMALS[a],
    end: { x: -NORMALS[b].x, y: -NORMALS[b].y },
  });

  it('elbow has only horizontal and vertical runs', () => {
    const points = [
      { x: 169, y: 25 },
      { x: 280, y: -60 },
      { x: 330, y: 140 },
      { x: 391, y: 45 },
    ];
    const path = pointsToPath(points, 'elbow', normals('right', 'left'));
    let cursor: PathPoint | null = null;
    for (const [command, ...n] of commands(path)) {
      const end = { x: n.at(-2) ?? NaN, y: n.at(-1) ?? NaN };
      if (command === 'L' && cursor !== null) {
        expect(end.x === cursor.x || end.y === cursor.y).toBe(true);
      }
      cursor = end;
    }
  });

  it('elbow rounds corners with at most 10 px', () => {
    const path = pointsToPath(
      [
        { x: 0, y: 0 },
        { x: 200, y: 100 },
        { x: 400, y: 100 },
      ],
      'elbow',
      normals('right', 'left'),
    );
    const q = commands(path).filter(([c]) => c === 'Q');
    expect(q.length).toBeGreaterThan(0);
    for (const [, cx, cy, ex, ey] of q) {
      expect(Math.hypot((ex ?? 0) - (cx ?? 0), (ey ?? 0) - (cy ?? 0))).toBeLessThanOrEqual(10.0001);
    }
  });

  it('elbow enters the end along the end direction axis', () => {
    // target on the left side: the last run is horizontal
    const path = pointsToPath(
      [
        { x: 0, y: 0 },
        { x: 150, y: 90 },
        { x: 400, y: 20 },
      ],
      'elbow',
      normals('right', 'left'),
    );
    const list = commands(path);
    const last = list.at(-1);
    const prev = list.at(-2);
    expect(last?.[0]).toBe('L');
    const end = { x: last?.at(-2), y: last?.at(-1) };
    const before = { x: prev?.at(-2), y: prev?.at(-1) };
    expect(end).toEqual({ x: 400, y: 20 });
    expect(before.y).toBe(20);
  });

  it('curved passes through every bend and leaves and enters along the side normals', () => {
    const bends = [
      { x: 280, y: -60 },
      { x: 330, y: 140 },
    ];
    const points = [{ x: 169, y: 25 }, ...bends, { x: 391, y: 45 }];
    const list = commands(pointsToPath(points, 'curved', normals('right', 'left')));
    const ends = list.filter(([c]) => c === 'C').map((c) => ({ x: c.at(-2), y: c.at(-1) }));
    expect(ends).toEqual([...bends, { x: 391, y: 45 }]);
    const first = list.find(([c]) => c === 'C');
    // first control point is straight out of the right side: same y, larger x
    expect(first?.[2]).toBe(25);
    expect(first?.[1]).toBeGreaterThan(169);
    const last = list.at(-1);
    // last control point is straight in front of the left side: same y, smaller x
    expect(last?.[4]).toBe(45);
    expect(last?.[3]).toBeLessThan(391);
  });

  it('curved never produces NaN for duplicate points', () => {
    const path = pointsToPath(
      [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 200, y: 0 },
      ],
      'curved',
      normals('right', 'left'),
    );
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  it('straight draws a line between the ends and ignores bends', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 90 },
      { x: 200, y: 40 },
    ];
    expect(pointsToPath(points, 'straight', normals('right', 'left'))).toBe('M 0 0 L 200 40');
  });
});

describe('connectorPath with bends and anchors', () => {
  const to = box(400, 20);
  const sides = resolveSides(from, to);
  const waypoints: RouteWaypoint[] = [{ x: 0.5, dy: -88 }];

  it('draws a different path once a bend exists, for every shape', () => {
    for (const shape of SHAPES) {
      const plain = connectorPath({ shape, fromBox: from, toBox: to, sides });
      const bent = connectorPath({ shape, fromBox: from, toBox: to, sides, route: { waypoints } });
      if (shape === 'straight') expect(bent.path).toBe(plain.path);
      else expect(bent.path).not.toBe(plain.path);
    }
  });

  it('moves the end along its side with fromAt / toAt', () => {
    const result = connectorPath({
      shape: 'straight',
      fromBox: from,
      toBox: to,
      sides,
      route: { fromAt: 0, toAt: 1 },
    });
    expect(result.ends.start).toEqual({ x: 160, y: 0 });
    expect(result.ends.end).toEqual({ x: 400, y: 70 });
    expect(result.path.startsWith('M ')).toBe(true);
  });

  it('shortens the line at an end with an arrow, keeping the end point on the card', () => {
    const result = connectorPath({
      shape: 'elbow',
      fromBox: from,
      toBox: to,
      sides,
      route: { waypoints },
    });
    expect(result.ends.end).toEqual({ x: 400, y: 45 });
    const last = commands(result.path).at(-1);
    expect(last?.at(-2)).toBeCloseTo(400 - ARROW_LENGTH, 9);
  });

  it('translating both cards translates the path', () => {
    const d = 50;
    const a = connectorPath({
      shape: 'elbow',
      fromBox: from,
      toBox: to,
      sides,
      route: { waypoints },
    });
    const b = connectorPath({
      shape: 'elbow',
      fromBox: box(d, d),
      toBox: box(400 + d, 20 + d),
      sides,
      route: { waypoints },
    });
    const numbers = (path: string) => path.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    expect(numbers(b.path)).toHaveLength(numbers(a.path).length);
    numbers(a.path).forEach((value, index) => {
      expect(numbers(b.path)[index]).toBeCloseTo(value + d, 9);
    });
  });

  it('a self-loop ignores bends', () => {
    const loop = connectorPath({
      shape: 'elbow',
      fromBox: from,
      toBox: from,
      sides: ['right', 'top'],
      route: { waypoints },
    });
    expect(loop).toEqual(routedPath('elbow', from, from, ['right', 'top']));
  });

  it('turns a 017 offset into the same bends when an anchor is set', () => {
    const result = connectorPath({
      shape: 'elbow',
      fromBox: from,
      toBox: box(400, 120),
      sides,
      route: { offset: 30, fromAt: 0.25 },
    });
    expect(result.path).not.toMatch(/NaN/);
    expect(result.ends.start).toEqual({ x: 160, y: 12.5 });
  });

  it('returns a label point on the path', () => {
    const result = connectorPath({
      shape: 'elbow',
      fromBox: from,
      toBox: to,
      sides,
      route: { waypoints },
    });
    const samples = samplePath(result.path);
    const fraction = projectOnPath(samples, { x: result.labelX, y: result.labelY });
    expect(fraction).toBeGreaterThan(0.3);
    expect(fraction).toBeLessThan(0.7);
  });
});

describe('simplifyWaypoints', () => {
  it('drops duplicates and near-collinear points, keeping both ends', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ];
    expect(simplifyWaypoints(points, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
    ]);
  });

  it('never removes a point farther than the tolerance from its neighbours', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 10 },
      { x: 100, y: 0 },
    ];
    expect(simplifyWaypoints(points, 5)).toEqual(points);
  });

  it('keeps a lone pair and an empty list', () => {
    expect(simplifyWaypoints([], 2)).toEqual([]);
    const pair = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(simplifyWaypoints(pair, 2)).toEqual(pair);
  });
});

describe('snapBend', () => {
  it('snaps an axis to a neighbour within the tolerance, before the grid', () => {
    const result = snapBend(
      { x: 203, y: 150 },
      [
        { x: 200, y: 20 },
        { x: 600, y: 300 },
      ],
      22,
      6,
    );
    expect(result.point.x).toBe(200);
    expect(result.guides).toContainEqual({ axis: 'x', at: 200 });
  });

  it('otherwise snaps to the 22 px grid', () => {
    const result = snapBend({ x: 100, y: 151 }, [{ x: 500, y: 500 }], 22, 6);
    expect(result.point).toEqual({ x: 110, y: 154 });
    expect(result.guides).toEqual([]);
  });

  it('can be switched off by passing grid 0', () => {
    const result = snapBend({ x: 101.3, y: 151.7 }, [{ x: 500, y: 500 }], 0, 0);
    expect(result.point).toEqual({ x: 101.3, y: 151.7 });
  });
});

describe('path sampling', () => {
  const line = 'M 0 0 L 100 0';
  it('measures a straight line and finds the fraction under a point', () => {
    const samples = samplePath(line);
    expect(samples.total).toBeCloseTo(100, 9);
    expect(projectOnPath(samples, { x: 25, y: 40 })).toBeCloseTo(0.25, 9);
    expect(projectOnPath(samples, { x: -10, y: 5 })).toBe(0);
    expect(projectOnPath(samples, { x: 500, y: 5 })).toBe(1);
  });

  it('labelPoint stays on the path and respects the clamp', () => {
    const samples = samplePath(line);
    expect(labelPoint(samples, 0.5, 8)).toEqual({ x: 50, y: 0 });
    expect(labelPoint(samples, 0, 8)).toEqual({ x: 8, y: 0 });
    expect(labelPoint(samples, 1, 8)).toEqual({ x: 92, y: 0 });
    expect(labelPoint(samples, 0.2, 8).x).toBeCloseTo(20, 9);
  });

  it('labelPoint falls back to the middle when the path is shorter than two clamps', () => {
    expect(labelPoint(samplePath('M 0 0 L 10 0'), 0.1, 8)).toEqual({ x: 5, y: 0 });
  });

  it('walks corners and curves in arc length', () => {
    const l = samplePath('M 0 0 L 100 0 L 100 100');
    expect(l.total).toBeCloseTo(200, 9);
    expect(labelPoint(l, 0.75, 0)).toEqual({ x: 100, y: 50 });
    const q = samplePath('M 0 0 Q 50 0 50 50');
    expect(q.total).toBeGreaterThan(70);
    expect(q.total).toBeLessThan(85);
    const c = samplePath('M 0 0 C 0 50 100 50 100 0');
    const mid = labelPoint(c, 0.5, 0);
    expect(mid.x).toBeCloseTo(50, 2);
  });

  it('handles an empty path', () => {
    const empty = samplePath('');
    expect(empty.total).toBe(0);
    expect(labelPoint(empty, 0.5, 8)).toEqual({ x: 0, y: 0 });
    expect(projectOnPath(empty, { x: 3, y: 4 })).toBe(0);
  });

  it('a 20-bend path is built in under 0.1 ms', () => {
    const points: PathPoint[] = [{ x: 0, y: 0 }];
    for (let i = 1; i <= 20; i += 1) points.push({ x: i * 30, y: (i % 2) * 60 });
    points.push({ x: 700, y: 20 });
    const normals = { start: { x: 1, y: 0 }, end: { x: 1, y: 0 } };
    for (const shape of ['elbow', 'curved'] as const) {
      pointsToPath(points, shape, normals);
      const runs = 200;
      const t0 = performance.now();
      for (let i = 0; i < runs; i += 1) pointsToPath(points, shape, normals);
      expect((performance.now() - t0) / runs).toBeLessThan(0.1);
    }
  });
});
