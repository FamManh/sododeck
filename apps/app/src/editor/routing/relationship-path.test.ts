import { describe, expect, it } from 'vitest';

import { samplePath } from './connector-geometry';
import { relationshipPath, selfLoopPath } from './relationship-path';

const from = { side: 'right' as const, x: 240, ys: [94] };
const to = { side: 'left' as const, x: 400, ys: [70] };

function startsWithStub(d: string, x: number, y: number, tip: number) {
  expect(d.startsWith(`M ${String(x)} ${String(y)} L ${String(tip)} ${String(y)}`)).toBe(true);
}

describe('relationshipPath (042 R4)', () => {
  it.each(['curved', 'elbow'] as const)('%s leaves and enters on 24 px stubs', (shape) => {
    const path = relationshipPath(from, to, shape);
    startsWithStub(path.d, 240, 94, 264);
    expect(path.d.endsWith('L 400 70')).toBe(true);
    expect(path.d).toContain('376 70');
    expect(path.from).toEqual({ at: { x: 240, y: 94 }, u: { x: 1, y: 0 } });
    expect(path.to).toEqual({ at: { x: 400, y: 70 }, u: { x: -1, y: 0 } });
    expect(path.bracket).toBe('');
  });

  it('straight is the direct line, its marks along the line', () => {
    const path = relationshipPath(from, { ...to, ys: [94] }, 'straight');
    expect(path.d).toBe('M 240 94 L 400 94');
    expect(path.from.u).toEqual({ x: 1, y: 0 });
    expect(path.to.u).toEqual({ x: -1, y: 0 });
    const angled = relationshipPath(from, { ...to, ys: [254] }, 'straight');
    expect(angled.from.u.x).toBeCloseTo(Math.SQRT1_2);
    expect(angled.from.u.y).toBeCloseTo(Math.SQRT1_2);
    expect(angled.label).toEqual({ x: 320, y: 174 });
  });

  it('passes the bends between the stubs', () => {
    const path = relationshipPath(from, to, 'curved', [{ x: 320, y: 300 }]);
    const samples = samplePath(path.d);
    const nearest = Math.min(...samples.points.map((p) => Math.hypot(p.x - 320, p.y - 300)));
    expect(nearest).toBeLessThan(1);
  });

  it('draws composite member stubs and leaves from the bracket midpoint', () => {
    const path = relationshipPath({ ...from, ys: [82, 106] }, to, 'curved');
    expect(path.bracket).toBe('M 240 82 L 246 82 M 240 106 L 246 106 M 246 82 L 246 106');
    startsWithStub(path.d, 246, 94, 270);
    expect(path.from.at).toEqual({ x: 246, y: 94 });
  });

  it('runs an elbow with both ends on one side out to the farther stub', () => {
    const path = relationshipPath(from, { side: 'right', x: 300, ys: [400] }, 'elbow');
    const xs = samplePath(path.d).points.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(324);
    expect(Math.min(...xs)).toBe(240);
  });

  it('puts the label on the path', () => {
    const path = relationshipPath(from, to, 'curved');
    const samples = samplePath(path.d);
    const nearest = Math.min(
      ...samples.points.map((p) => Math.hypot(p.x - path.label.x, p.y - path.label.y)),
    );
    expect(nearest).toBeLessThan(2);
  });
});

describe('selfLoopPath (042 R8)', () => {
  const a = { side: 'right' as const, x: 240, ys: [94] };
  const b = { side: 'right' as const, x: 240, ys: [70] };

  it.each(['curved', 'elbow', 'straight'] as const)(
    '%s bulges at least 56 and stays outside the card',
    (shape) => {
      const path = selfLoopPath(a, b, shape);
      const xs = samplePath(path.d).points.map((p) => p.x);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(240);
      expect(Math.max(...xs)).toBeCloseTo(296, 0);
      expect(path.from).toEqual({ at: { x: 240, y: 94 }, u: { x: 1, y: 0 } });
      expect(path.to).toEqual({ at: { x: 240, y: 70 }, u: { x: 1, y: 0 } });
    },
  );

  it('bulges by half the row distance when that is larger', () => {
    const path = selfLoopPath(a, { ...b, ys: [294] }, 'elbow');
    const xs = samplePath(path.d).points.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(340);
    expect(path.label).toEqual({ x: 340, y: 194 });
  });
});
