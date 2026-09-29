import { describe, expect, it } from 'vitest';

import { snap, snapCandidates } from './snap';

const card = { x: 100, y: 100, width: 100, height: 50 };

describe('snapCandidates', () => {
  it('lists left, centre, right x and top, middle, bottom y with the card span', () => {
    const c = snapCandidates([card]);
    expect(c.x).toEqual([
      { at: 100, from: 100, to: 150 },
      { at: 150, from: 100, to: 150 },
      { at: 200, from: 100, to: 150 },
    ]);
    expect(c.y).toEqual([
      { at: 100, from: 100, to: 200 },
      { at: 125, from: 100, to: 200 },
      { at: 150, from: 100, to: 200 },
    ]);
  });
});

describe('snap', () => {
  const candidates = snapCandidates([card]);

  it('snaps a left edge within the threshold', () => {
    const r = snap({ x: 104, y: 400, width: 60, height: 30 }, candidates, 6);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(0);
    expect(r.guides).toHaveLength(1);
    expect(r.guides[0]).toMatchObject({ axis: 'x', at: 100 });
  });

  it('snaps centres', () => {
    // box centre x = 147 → card centre 150
    const r = snap({ x: 117, y: 400, width: 60, height: 30 }, candidates, 6);
    expect(r.dx).toBe(3);
    expect(r.guides[0]).toMatchObject({ axis: 'x', at: 150 });
  });

  it('snaps a middle to a middle on y', () => {
    // box middle y = 128 → card middle 125
    const r = snap({ x: 500, y: 118, width: 60, height: 20 }, candidates, 6);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(-3);
    expect(r.guides).toEqual([expect.objectContaining({ axis: 'y', at: 125 })]);
  });

  it('picks the nearest line per axis', () => {
    // box left 205 (right edge 200 is 5 away), box right 265: nothing; box centre 235
    // card lines at 198 too: add a second card whose left is 203.
    const two = snapCandidates([card, { x: 203, y: 0, width: 10, height: 10 }]);
    const r = snap({ x: 205, y: 400, width: 60, height: 30 }, two, 6);
    expect(r.dx).toBe(-2);
    expect(r.guides[0]).toMatchObject({ axis: 'x', at: 203 });
  });

  it('snaps the two axes independently', () => {
    const r = snap({ x: 98, y: 153, width: 60, height: 30 }, candidates, 6);
    expect(r.dx).toBe(2);
    expect(r.dy).toBe(-3);
    expect(r.guides.map((g) => g.axis).sort()).toEqual(['x', 'y']);
  });

  it('does not snap beyond the threshold', () => {
    const r = snap({ x: 107, y: 400, width: 61, height: 30 }, candidates, 6);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('scales the threshold with zoom (6 / 2 = 3: a 4 px miss does not snap)', () => {
    expect(snap({ x: 104, y: 400, width: 61, height: 30 }, candidates, 6 / 2).dx).toBe(0);
    expect(snap({ x: 103, y: 400, width: 61, height: 30 }, candidates, 6 / 2).dx).toBe(-3);
  });

  it('spans the guide across the snapped box and every aligned card', () => {
    const cards = snapCandidates([
      { x: 100, y: 0, width: 50, height: 20 },
      { x: 100, y: 300, width: 80, height: 20 },
      { x: 400, y: 900, width: 50, height: 20 },
    ]);
    const r = snap({ x: 102, y: 100, width: 40, height: 40 }, cards, 6);
    expect(r.guides).toEqual([{ axis: 'x', at: 100, from: 0, to: 320 }]);
  });

  it('covers the box beyond the candidate on the other axis', () => {
    const r = snap({ x: 102, y: 400, width: 40, height: 40 }, candidates, 6);
    expect(r.guides).toEqual([{ axis: 'x', at: 100, from: 100, to: 440 }]);
  });
});
