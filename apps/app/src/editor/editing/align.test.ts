import { describe, expect, it } from 'vitest';

import { align, distribute, type IdRect } from './align';

const a: IdRect = { id: 'a', x: 10, y: 20, width: 100, height: 40 };
const b: IdRect = { id: 'b', x: 200, y: 100, width: 60, height: 80 };
const c: IdRect = { id: 'c', x: 50, y: 300, width: 120, height: 20 };
const set = [a, b, c];

describe('align', () => {
  it('aligns left edges to the leftmost edge', () => {
    const out = align(set, 'left');
    expect(out.b).toEqual({ x: 10, y: 100 });
    expect(out.c).toEqual({ x: 10, y: 300 });
    expect(out.a ?? { x: a.x, y: a.y }).toEqual({ x: 10, y: 20 });
  });

  it('aligns right edges to the rightmost edge', () => {
    const out = align(set, 'right');
    // rightmost: b at 260
    expect(out.a).toEqual({ x: 160, y: 20 });
    expect(out.c).toEqual({ x: 140, y: 300 });
    expect(out.b ?? { x: b.x, y: b.y }).toEqual({ x: 200, y: 100 });
  });

  it('aligns centres to the centre of the bounding box', () => {
    // box x: 10..260 → centre 135
    const out = align(set, 'centre');
    expect(out.a).toEqual({ x: 85, y: 20 });
    expect(out.b).toEqual({ x: 105, y: 100 });
    expect(out.c).toEqual({ x: 75, y: 300 });
  });

  it('aligns top edges to the topmost edge', () => {
    const out = align(set, 'top');
    expect(out.b).toEqual({ x: 200, y: 20 });
    expect(out.c).toEqual({ x: 50, y: 20 });
  });

  it('aligns bottom edges to the lowest edge', () => {
    const out = align(set, 'bottom');
    // lowest: c at 320
    expect(out.a).toEqual({ x: 10, y: 280 });
    expect(out.b).toEqual({ x: 200, y: 240 });
  });

  it('aligns middles to the middle of the bounding box', () => {
    // box y: 20..320 → middle 170
    const out = align(set, 'middle');
    expect(out.a).toEqual({ x: 10, y: 150 });
    expect(out.b).toEqual({ x: 200, y: 130 });
    expect(out.c).toEqual({ x: 50, y: 160 });
  });

  it('rounds to integers', () => {
    const out = align(
      [
        { id: 'p', x: 0, y: 0, width: 11, height: 10 },
        { id: 'q', x: 100, y: 0, width: 10, height: 10 },
      ],
      'centre',
    );
    for (const p of Object.values(out)) {
      expect(Number.isInteger(p.x)).toBe(true);
    }
  });

  it('returns nothing for fewer than two rects', () => {
    expect(align([a], 'left')).toEqual({});
    expect(align([], 'top')).toEqual({});
  });
});

describe('distribute', () => {
  const gapsOf = (
    rects: IdRect[],
    out: Record<string, { x: number; y: number }>,
    key: 'x' | 'y',
  ) => {
    const size = key === 'x' ? 'width' : 'height';
    const placed = rects
      .map((r) => ({ ...r, ...(out[r.id] ?? {}) }))
      .sort((p, q) => p[key] - q[key]);
    const gaps: number[] = [];
    for (let i = 1; i < placed.length; i++) {
      const prev = placed[i - 1];
      const cur = placed[i];
      if (prev && cur) gaps.push(cur[key] - (prev[key] + prev[size]));
    }
    return gaps;
  };

  it('spaces horizontally with equal gaps, outermost stay put', () => {
    const rects: IdRect[] = [
      { id: 'a', x: 0, y: 5, width: 50, height: 10 },
      { id: 'b', x: 70, y: 40, width: 30, height: 10 },
      { id: 'c', x: 300, y: 0, width: 50, height: 10 },
    ];
    const out = distribute(rects, 'horizontal');
    // span 0..350, sizes 130 → 2 gaps of 110; b at 160
    expect(out.b).toEqual({ x: 160, y: 40 });
    expect(out.a ?? { x: 0, y: 5 }).toEqual({ x: 0, y: 5 });
    expect(out.c ?? { x: 300, y: 0 }).toEqual({ x: 300, y: 0 });
  });

  it('spaces vertically with equal gaps, only y changes', () => {
    const rects: IdRect[] = [
      { id: 'c', x: 9, y: 400, width: 10, height: 50 },
      { id: 'a', x: 1, y: 0, width: 10, height: 50 },
      { id: 'b', x: 5, y: 60, width: 10, height: 100 },
    ];
    const out = distribute(rects, 'vertical');
    // span 0..450, sizes 200 → gaps 125; b at 175
    expect(out.b).toEqual({ x: 5, y: 175 });
    expect(gapsOf(rects, out, 'y')).toEqual([125, 125]);
  });

  it('keeps gaps equal within 1 px with odd sizes', () => {
    const rects: IdRect[] = [
      { id: 'a', x: 0, y: 0, width: 33, height: 10 },
      { id: 'b', x: 40, y: 0, width: 17, height: 10 },
      { id: 'c', x: 90, y: 0, width: 29, height: 10 },
      { id: 'd', x: 211, y: 0, width: 13, height: 10 },
    ];
    const out = distribute(rects, 'horizontal');
    const gaps = gapsOf(rects, out, 'x');
    expect(gaps).toHaveLength(3);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    for (const p of Object.values(out)) expect(Number.isInteger(p.x)).toBe(true);
  });

  it('allows equal negative gaps when the rects overlap', () => {
    const rects: IdRect[] = [
      { id: 'a', x: 0, y: 0, width: 100, height: 10 },
      { id: 'b', x: 10, y: 0, width: 100, height: 10 },
      { id: 'c', x: 100, y: 0, width: 100, height: 10 },
    ];
    const gaps = gapsOf(rects, distribute(rects, 'horizontal'), 'x');
    expect(gaps).toEqual([-50, -50]);
  });

  it('returns nothing for fewer than three rects', () => {
    expect(distribute([a, b], 'horizontal')).toEqual({});
  });
});
