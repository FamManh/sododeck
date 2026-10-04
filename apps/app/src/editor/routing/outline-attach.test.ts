import type { Side } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { outlinePoint } from '../shapes/shape-geometry';
import {
  attachToOutline,
  CENTRE_MARGIN,
  CENTRE_ZONE,
  MIDPOINT_SNAP,
  nudgeAnchor,
} from './outline-attach';

const box = { x: 100, y: 100, width: 240, height: 100 };
const free = { zoom: 1, mod: true, allowAutomatic: false };
const snapping = { zoom: 1, mod: false, allowAutomatic: false };

describe('attachToOutline: nearest point on a rectangle', () => {
  it('exposes the screen-px constants from the contract', () => {
    expect(MIDPOINT_SNAP).toBe(6);
    expect(CENTRE_ZONE).toBe(0.4);
    expect(CENTRE_MARGIN).toBe(24);
  });

  it.each<[string, { x: number; y: number }, Side, number, { x: number; y: number }]>([
    ['above the top', { x: 160, y: 60 }, 'top', 0.25, { x: 160, y: 100 }],
    ['right of the right side', { x: 400, y: 130 }, 'right', 0.3, { x: 340, y: 130 }],
    ['below the bottom', { x: 280, y: 260 }, 'bottom', 0.75, { x: 280, y: 200 }],
    ['left of the left side', { x: 40, y: 180 }, 'left', 0.8, { x: 100, y: 180 }],
    ['just inside the top', { x: 136, y: 104 }, 'top', 0.15, { x: 136, y: 100 }],
    ['just inside the right', { x: 330, y: 170 }, 'right', 0.7, { x: 340, y: 170 }],
  ])('%s', (_name, pointer, side, at, point) => {
    const hit = attachToOutline(box, undefined, pointer, free);
    expect(hit.side).toBe(side);
    expect(hit.at).toBeCloseTo(at, 3);
    expect(hit.point.x).toBeCloseTo(point.x, 1);
    expect(hit.point.y).toBeCloseTo(point.y, 1);
    expect(hit.snapped).toBe(false);
    expect(hit.automatic).toBe(false);
  });

  it('beyond a corner, lands on the corner', () => {
    const hit = attachToOutline(box, undefined, { x: 380, y: 40 }, free);
    expect(hit.point).toEqual({ x: 340, y: 100 });
  });
});

describe('attachToOutline: continuity', () => {
  it('a pointer step of d moves the point by at most d + snap, all round the card', () => {
    // A loop round the card, 20 px outside it, through every corner, in 1 px steps.
    const loop: { x: number; y: number }[] = [];
    const left = 80;
    const top = 80;
    const right = 360;
    const bottom = 220;
    for (let x = left; x <= right; x += 1) loop.push({ x, y: top });
    for (let y = top; y <= bottom; y += 1) loop.push({ x: right, y });
    for (let x = right; x >= left; x -= 1) loop.push({ x, y: bottom });
    for (let y = bottom; y >= top; y -= 1) loop.push({ x: left, y });
    // and passes inside the card, along a side and out through it
    for (let x = 110; x <= 330; x += 1) loop.push({ x, y: 108 });
    for (let y = 108; y >= 60; y -= 1) loop.push({ x: 330, y });
    for (let x = 300; x <= 370; x += 1) loop.push({ x, y: 150 });
    for (const mod of [true, false]) {
      let previous = attachToOutline(box, undefined, loop[0] ?? { x: 0, y: 0 }, {
        ...free,
        mod,
      }).point;
      for (let i = 1; i < loop.length; i += 1) {
        const a = loop[i - 1];
        const b = loop[i];
        if (a === undefined || b === undefined) continue;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const next = attachToOutline(box, undefined, b, { ...free, mod }).point;
        const moved = Math.hypot(next.x - previous.x, next.y - previous.y);
        // `at` is stored to 4 places: allow its rounding (well under 0.1 px here).
        expect(moved).toBeLessThanOrEqual(d + (mod ? 0 : MIDPOINT_SNAP) + 0.1);
        previous = next;
      }
    }
  });

  it('the side changes only at a corner', () => {
    const before = attachToOutline(box, undefined, { x: 339, y: 60 }, free);
    const after = attachToOutline(box, undefined, { x: 380, y: 101 }, free);
    expect(before.side).toBe('top');
    expect(after.side).toBe('right');
    expect(Math.hypot(before.point.x - 340, before.point.y - 100)).toBeLessThan(1.01);
    expect(Math.hypot(after.point.x - 340, after.point.y - 100)).toBeLessThan(1.01);
  });
});

describe('attachToOutline: midpoint snap', () => {
  it('snaps only to 0.5, within 6 screen px', () => {
    // top side: 240 px long, the middle at x = 220
    expect(attachToOutline(box, undefined, { x: 225, y: 90 }, snapping)).toMatchObject({
      side: 'top',
      at: 0.5,
      snapped: true,
      point: { x: 220, y: 100 },
    });
    const outside = attachToOutline(box, undefined, { x: 227, y: 90 }, snapping);
    expect(outside.snapped).toBe(false);
    expect(outside.point.x).toBeCloseTo(227, 1);
    // no other stops: a quarter stays exactly where the pointer is
    const quarter = attachToOutline(box, undefined, { x: 161, y: 90 }, snapping);
    expect(quarter.snapped).toBe(false);
    expect(quarter.point.x).toBeCloseTo(161, 1);
  });

  it('the reach is in screen px: scaled by zoom', () => {
    // At zoom 2, 6 screen px are 3 canvas px.
    expect(
      attachToOutline(box, undefined, { x: 222.5, y: 90 }, { ...snapping, zoom: 2 }),
    ).toMatchObject({ snapped: true, at: 0.5 });
    expect(
      attachToOutline(box, undefined, { x: 224, y: 90 }, { ...snapping, zoom: 2 }),
    ).toMatchObject({ snapped: false });
    // At zoom 0.5, 6 screen px are 12 canvas px.
    expect(
      attachToOutline(box, undefined, { x: 231, y: 90 }, { ...snapping, zoom: 0.5 }),
    ).toMatchObject({ snapped: true });
  });

  it('mod turns snapping off', () => {
    const hit = attachToOutline(box, undefined, { x: 221, y: 90 }, { ...snapping, mod: true });
    expect(hit.snapped).toBe(false);
    expect(hit.point.x).toBeCloseTo(221, 1);
  });

  it('sides shorter than 18 screen px do not snap', () => {
    const tiny = { x: 0, y: 0, width: 16, height: 60 };
    const hit = attachToOutline(tiny, undefined, { x: 9, y: -10 }, snapping);
    expect(hit.side).toBe('top');
    expect(hit.snapped).toBe(false);
    expect(hit.point.x).toBeCloseTo(9, 1);
    // the long side of the same card still snaps
    expect(attachToOutline(tiny, undefined, { x: 30, y: 32 }, snapping)).toMatchObject({
      side: 'right',
      snapped: true,
    });
  });
});

describe('attachToOutline: centre zone', () => {
  const centre = { x: 220, y: 150 };

  it('is automatic only with allowAutomatic', () => {
    expect(
      attachToOutline(box, undefined, centre, { ...snapping, allowAutomatic: true }).automatic,
    ).toBe(true);
    expect(attachToOutline(box, undefined, centre, snapping).automatic).toBe(false);
  });

  it('covers only the middle 40 % of each axis', () => {
    const opts = { ...snapping, allowAutomatic: true };
    // x from 172 to 268, y from 130 to 170
    expect(attachToOutline(box, undefined, { x: 173, y: 131 }, opts).automatic).toBe(true);
    expect(attachToOutline(box, undefined, { x: 170, y: 150 }, opts).automatic).toBe(false);
    expect(attachToOutline(box, undefined, { x: 220, y: 128 }, opts).automatic).toBe(false);
    // outside, the end still sits on the outline
    const edge = attachToOutline(box, undefined, { x: 220, y: 110 }, opts);
    expect(edge).toMatchObject({ automatic: false, side: 'top' });
  });

  it('exists only where the zone keeps a 24 screen px margin', () => {
    const opts = { ...snapping, allowAutomatic: true };
    // 240 × 100 at zoom 1: 30 px from top and bottom → zone
    expect(attachToOutline(box, undefined, centre, opts).automatic).toBe(true);
    // at zoom 0.5 the margin is 15 screen px → no zone
    expect(attachToOutline(box, undefined, centre, { ...opts, zoom: 0.5 }).automatic).toBe(false);
    // 60 × 40 never has one, even zoomed in a little
    const small = { x: 0, y: 0, width: 60, height: 40 };
    expect(attachToOutline(small, undefined, { x: 30, y: 20 }, opts).automatic).toBe(false);
    expect(
      attachToOutline(small, undefined, { x: 30, y: 20 }, { ...opts, zoom: 1.5 }).automatic,
    ).toBe(false);
  });
});

describe('attachToOutline: shapes', () => {
  const shapeBox = { x: 0, y: 0, width: 176, height: 112 };

  it.each(['diamond', 'ellipse'] as const)('puts the point on the %s outline', (geometry) => {
    for (const pointer of [
      { x: 30, y: 10 },
      { x: 170, y: 20 },
      { x: 120, y: 110 },
      { x: -20, y: 60 },
      { x: 88, y: -40 },
    ]) {
      const hit = attachToOutline(shapeBox, geometry, pointer, free);
      const expected = outlinePoint(geometry, shapeBox, hit.side, hit.at);
      expect(hit.point.x).toBeCloseTo(expected.x, 6);
      expect(hit.point.y).toBeCloseTo(expected.y, 6);
      // and it is (about) the nearest outline point: no sample on any side is clearly closer
      const best = (['top', 'right', 'bottom', 'left'] as const)
        .flatMap((side) =>
          Array.from({ length: 201 }, (_, i) => outlinePoint(geometry, shapeBox, side, i / 200)),
        )
        .reduce((min, p) => Math.min(min, Math.hypot(p.x - pointer.x, p.y - pointer.y)), Infinity);
      const got = Math.hypot(hit.point.x - pointer.x, hit.point.y - pointer.y);
      expect(got).toBeLessThanOrEqual(best + 0.5);
    }
  });

  it('snaps to a shape side middle too', () => {
    const top = outlinePoint('diamond', shapeBox, 'top', 0.5);
    const hit = attachToOutline(shapeBox, 'diamond', { x: top.x + 2, y: top.y - 8 }, snapping);
    expect(hit).toMatchObject({ side: 'top', at: 0.5, snapped: true });
  });
});

describe('nudgeAnchor', () => {
  it('moves ±1 % along the side', () => {
    expect(nudgeAnchor('right', 0.37, 0.01)).toEqual({ side: 'right', at: 0.38 });
    expect(nudgeAnchor('right', 0.37, -0.01)).toEqual({ side: 'right', at: 0.36 });
    expect(nudgeAnchor('top', 0.5, 0.01)).toEqual({ side: 'top', at: 0.51 });
  });

  it('stops at the corner, then carries round it like stepAnchor', () => {
    expect(nudgeAnchor('top', 0.995, 0.01)).toEqual({ side: 'top', at: 1 });
    expect(nudgeAnchor('top', 1, 0.01)).toEqual({ side: 'right', at: 0 });
    expect(nudgeAnchor('left', 0, -0.01)).toEqual({ side: 'top', at: 0 });
    expect(nudgeAnchor('bottom', 0.004, -0.01)).toEqual({ side: 'bottom', at: 0 });
  });
});
