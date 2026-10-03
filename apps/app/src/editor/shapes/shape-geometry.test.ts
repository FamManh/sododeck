import { CARD_TYPES, type Geometry } from '@sododeck/model';
import type { Side } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  defaultSize,
  minSize,
  outlinePoint,
  shapePath,
  titleBox,
  type Box,
  type Point,
} from './shape-geometry';

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];
const CLOSED: readonly Geometry[] = [
  'rect',
  'rounded-rect',
  'ellipse',
  'diamond',
  'stadium',
  'cylinder',
  'document',
  'parallelogram',
  'hexagon',
];

/** Flattens an SVG path of M / L / C / Z commands (all `shapePath` emits) into polylines. */
function samplePath(d: string): Point[][] {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const parts: Point[][] = [];
  let current: Point[] = [];
  let start: Point = { x: 0, y: 0 };
  let at: Point = { x: 0, y: 0 };
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M') {
      if (current.length > 0) parts.push(current);
      at = { x: num(), y: num() };
      start = at;
      current = [at];
    } else if (command === 'L') {
      at = { x: num(), y: num() };
      current.push(at);
    } else if (command === 'C') {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const end = { x: num(), y: num() };
      for (let k = 1; k <= 200; k++) {
        const t = k / 200;
        const u = 1 - t;
        current.push({
          x: u * u * u * at.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
          y: u * u * u * at.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
        });
      }
      at = end;
    } else if (command === 'Z') {
      current.push(start);
      at = start;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function distanceToPolylines(p: Point, lines: Point[][]): number {
  let best = Infinity;
  for (const line of lines) {
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      if (a === undefined || b === undefined) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t =
        len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
    }
  }
  return best;
}

/** Even-odd point-in-polygon over the flattened outline. */
function inside(p: Point, lines: Point[][]): boolean {
  let hit = false;
  for (const line of lines) {
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1];
      const b = line[k];
      if (a === undefined || b === undefined) continue;
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        hit = !hit;
      }
    }
  }
  return hit;
}

const sizesOf = (geometry: Geometry) => [defaultSize(geometry), minSize(geometry)];
const boxOf = (size: { width: number; height: number }, x = 40, y = 30): Box => ({
  x,
  y,
  ...size,
});

describe('shape geometry (031 contract shape-api)', () => {
  it('takes default and minimum sizes from the registry', () => {
    for (const type of CARD_TYPES.filter((t) => t.family === 'shape')) {
      const geometry = type.geometry;
      if (geometry === undefined) throw new Error('shape without geometry');
      expect(defaultSize(geometry)).toEqual(type.defaultSize);
      expect(minSize(geometry)).toEqual(type.minSize);
    }
  });

  describe.each(CLOSED)('%s', (geometry) => {
    it('puts every side point (at 0, 0.25, 0.5, 0.75, 1) on the outline within 0.5 px', () => {
      for (const size of [...sizesOf(geometry), { width: 300, height: 90 }]) {
        const box = boxOf(size);
        const lines = samplePath(shapePath(geometry, box).outline);
        for (const side of SIDES) {
          for (const at of [0, 0.25, 0.5, 0.75, 1]) {
            const point = outlinePoint(geometry, box, side, at);
            expect(distanceToPolylines(point, lines)).toBeLessThan(0.5);
          }
        }
      }
    });

    it('keeps the title box inside the outline at default and minimum size', () => {
      for (const size of sizesOf(geometry)) {
        const box = boxOf(size);
        const lines = samplePath(shapePath(geometry, box).outline);
        const t = titleBox(geometry, box);
        expect(t.width).toBeGreaterThan(0);
        expect(t.height).toBeGreaterThanOrEqual(16);
        for (const corner of [
          { x: t.x, y: t.y },
          { x: t.x + t.width, y: t.y },
          { x: t.x, y: t.y + t.height },
          { x: t.x + t.width, y: t.y + t.height },
        ]) {
          expect(inside(corner, lines)).toBe(true);
        }
      }
    });

    it('draws a lip: the outline 3 px lower', () => {
      const box = boxOf(defaultSize(geometry));
      const { outline, lip } = shapePath(geometry, box);
      expect(lip).toBe(shapePath(geometry, { ...box, y: box.y + 3 }).outline);
      expect(outline).not.toBe('');
    });

    it('moves along a side as `at` grows, and at 0.5 sits on the side’s middle line', () => {
      const box = boxOf(defaultSize(geometry));
      const top = [0, 0.25, 0.5, 0.75, 1].map((at) => outlinePoint(geometry, box, 'top', at).x);
      expect([...top].sort((a, b) => a - b)).toEqual(top);
      expect(outlinePoint(geometry, box, 'top').x).toBeCloseTo(box.x + box.width / 2, 6);
      expect(outlinePoint(geometry, box, 'right').y).toBeCloseTo(box.y + box.height / 2, 6);
    });
  });

  it('rect: at 0 and 1 are the corners of the side, 0.5 the box midpoint', () => {
    const box = boxOf({ width: 160, height: 72 });
    expect(outlinePoint('rect', box, 'top', 0)).toEqual({ x: 40, y: 30 });
    expect(outlinePoint('rect', box, 'top', 1)).toEqual({ x: 200, y: 30 });
    expect(outlinePoint('rect', box, 'left', 1)).toEqual({ x: 40, y: 102 });
    expect(outlinePoint('rect', box, 'bottom')).toEqual({ x: 120, y: 102 });
  });

  it('diamond: the vertices are the side midpoints at any size', () => {
    for (const size of [
      { width: 176, height: 112 },
      { width: 400, height: 60 },
    ]) {
      const box = boxOf(size);
      expect(outlinePoint('diamond', box, 'top')).toEqual({ x: 40 + size.width / 2, y: 30 });
      expect(outlinePoint('diamond', box, 'right')).toEqual({
        x: 40 + size.width,
        y: 30 + size.height / 2,
      });
      expect(outlinePoint('diamond', box, 'bottom')).toEqual({
        x: 40 + size.width / 2,
        y: 30 + size.height,
      });
      expect(outlinePoint('diamond', box, 'left')).toEqual({ x: 40, y: 30 + size.height / 2 });
    }
  });

  it('parallelogram: left and right points are inset by half the skew at mid-height', () => {
    const box = boxOf({ width: 168, height: 72 });
    const skew = 168 * 0.16;
    expect(outlinePoint('parallelogram', box, 'left').x).toBeCloseTo(40 + skew / 2, 6);
    expect(outlinePoint('parallelogram', box, 'left').y).toBeCloseTo(66, 6);
    expect(outlinePoint('parallelogram', box, 'right').x).toBeCloseTo(40 + 168 - skew / 2, 6);
  });

  it('document: the bottom point sits on the wave, above the box bottom', () => {
    const box = boxOf({ width: 152, height: 96 });
    const bottom = outlinePoint('document', box, 'bottom');
    const lines = samplePath(shapePath('document', box).outline);
    expect(distanceToPolylines(bottom, lines)).toBeLessThan(0.5);
    expect(bottom.y).toBeLessThan(30 + 96);
    expect(bottom.y).toBeGreaterThan(30 + 96 * 0.85);
  });

  it('actor: head on top, hands left and right, feet at the bottom; no lip', () => {
    const box = boxOf({ width: 80, height: 112 });
    const { outline, lip, extra } = shapePath('actor', box);
    expect(lip).toBeNull();
    const lines = [...samplePath(outline), ...samplePath(extra ?? '')];
    // Head and hands are on the figure; the feet point is midway between the two feet.
    for (const side of ['top', 'left', 'right'] as const) {
      expect(distanceToPolylines(outlinePoint('actor', box, side), lines)).toBeLessThan(0.5);
    }
    for (const at of [0, 1]) {
      expect(distanceToPolylines(outlinePoint('actor', box, 'bottom', at), lines)).toBeLessThan(
        0.5,
      );
    }
    const head = outlinePoint('actor', box, 'top');
    const feet = outlinePoint('actor', box, 'bottom');
    const left = outlinePoint('actor', box, 'left');
    const right = outlinePoint('actor', box, 'right');
    expect(head).toEqual({ x: 80, y: 30 });
    expect(left.y).toBeCloseTo(right.y, 6);
    expect(left.x).toBeLessThan(head.x);
    expect(right.x).toBeGreaterThan(head.x);
    // The figure fills the top 64 % of the box; the title sits below it, inside the box.
    expect(feet.y).toBeCloseTo(30 + 112 * 0.64, 6);
    const title = titleBox('actor', box);
    expect(title.y).toBeGreaterThanOrEqual(feet.y);
    expect(title.y + title.height).toBeLessThanOrEqual(30 + 112);
  });

  it('actor: a wide box keeps the figure upright and centred', () => {
    const box = boxOf({ width: 400, height: 112 });
    const left = outlinePoint('actor', box, 'left');
    const right = outlinePoint('actor', box, 'right');
    expect((left.x + right.x) / 2).toBeCloseTo(240, 6);
    expect(right.x - left.x).toBeLessThan(80);
  });

  it('text: no outline and no lip; connection points are the box', () => {
    const box = boxOf({ width: 160, height: 40 });
    expect(shapePath('none', box)).toEqual({ outline: '', lip: null });
    expect(outlinePoint('none', box, 'top')).toEqual({ x: 120, y: 30 });
    expect(outlinePoint('none', box, 'left', 0)).toEqual({ x: 40, y: 30 });
    const title = titleBox('none', box);
    expect(title.x).toBeGreaterThanOrEqual(40);
    expect(title.x + title.width).toBeLessThanOrEqual(200);
  });

  it('clamps `at` to 0–1', () => {
    const box = boxOf({ width: 160, height: 72 });
    expect(outlinePoint('rect', box, 'top', -1)).toEqual(outlinePoint('rect', box, 'top', 0));
    expect(outlinePoint('rect', box, 'top', 2)).toEqual(outlinePoint('rect', box, 'top', 1));
  });
});
