import { describe, expect, it } from 'vitest';

import type { Guide } from '../../state/ui-store';

import { equalGaps, nearestGap, withGapLabels } from './gaps';

const box = { x: 200, y: 100, width: 100, height: 50 };

describe('nearestGap', () => {
  it('finds the nearest neighbour on the right', () => {
    const others = [
      { x: 330, y: 110, width: 50, height: 50 },
      { x: 500, y: 100, width: 50, height: 50 },
    ];
    // gap 300..330, vertical overlap 110..150
    expect(nearestGap(box, others, 'x')).toEqual({ value: 30, at: { x: 315, y: 130 } });
  });

  it('finds the nearest neighbour on the left', () => {
    const others = [
      { x: 330, y: 100, width: 50, height: 50 },
      { x: 130, y: 90, width: 50, height: 30 },
    ];
    // left gap 180..200 = 20, overlap 100..120
    expect(nearestGap(box, others, 'x')).toEqual({ value: 20, at: { x: 190, y: 110 } });
  });

  it('ignores cards outside the row', () => {
    const others = [
      { x: 310, y: 150, width: 50, height: 50 }, // touches only, no positive overlap
      { x: 320, y: 300, width: 50, height: 50 },
    ];
    expect(nearestGap(box, others, 'x')).toBeNull();
  });

  it('ignores overlapping cards', () => {
    expect(nearestGap(box, [{ x: 250, y: 100, width: 100, height: 50 }], 'x')).toBeNull();
  });

  it('measures columns on axis y', () => {
    const others = [
      { x: 250, y: 0, width: 100, height: 60 },
      { x: 600, y: 0, width: 100, height: 90 }, // other column
    ];
    // gap 60..100 = 40, overlap x 250..300
    expect(nearestGap(box, others, 'y')).toEqual({ value: 40, at: { x: 275, y: 80 } });
  });

  it('returns null with no neighbour', () => {
    expect(nearestGap(box, [], 'x')).toBeNull();
    expect(nearestGap(box, [], 'y')).toBeNull();
  });
});

describe('equalGaps', () => {
  it('labels both gaps when they are equal within 1 px', () => {
    const others = [
      { x: 330, y: 100, width: 50, height: 50 }, // gap 30
      { x: 411, y: 100, width: 50, height: 50 }, // gap 31
    ];
    expect(equalGaps(box, others, 'x')).toEqual([
      { value: 30, at: { x: 315, y: 125 } },
      { value: 31, at: { x: 395.5, y: 125 } },
    ]);
  });

  it('works to the left', () => {
    const others = [
      { x: 150, y: 100, width: 30, height: 50 }, // gap 20
      { x: 80, y: 100, width: 50, height: 50 }, // gap 20
    ];
    expect(equalGaps(box, others, 'x')).toEqual([
      { value: 20, at: { x: 190, y: 125 } },
      { value: 20, at: { x: 140, y: 125 } },
    ]);
  });

  it('returns nothing when the gaps differ', () => {
    const others = [
      { x: 330, y: 100, width: 50, height: 50 },
      { x: 420, y: 100, width: 50, height: 50 },
    ];
    expect(equalGaps(box, others, 'x')).toEqual([]);
  });

  it('returns nothing without a second card', () => {
    expect(equalGaps(box, [{ x: 330, y: 100, width: 50, height: 50 }], 'x')).toEqual([]);
  });
});

describe('withGapLabels', () => {
  it('adds distance and equal gaps, leaving the other fields untouched', () => {
    const others = [
      { x: 330, y: 100, width: 50, height: 50 },
      { x: 410, y: 100, width: 50, height: 50 },
      { x: 200, y: 0, width: 100, height: 60 },
    ];
    const guides: Guide[] = [
      { axis: 'x', at: 200, from: 0, to: 150 },
      { axis: 'y', at: 100, from: 200, to: 460 },
    ];
    const out = withGapLabels(guides, box, others);
    expect(out[0]).toEqual({
      axis: 'x',
      at: 200,
      from: 0,
      to: 150,
      distance: { value: 30, at: { x: 315, y: 125 } },
      equalGaps: [
        { value: 30, at: { x: 315, y: 125 } },
        { value: 30, at: { x: 395, y: 125 } },
      ],
    });
    expect(out[1]).toEqual({
      axis: 'y',
      at: 100,
      from: 200,
      to: 460,
      distance: { value: 40, at: { x: 250, y: 80 } },
    });
    expect(guides[0]).toEqual({ axis: 'x', at: 200, from: 0, to: 150 });
    expect(out[0]).not.toBe(guides[0]);
  });

  it('adds nothing when there is no neighbour', () => {
    const guides: Guide[] = [{ axis: 'x', at: 1, from: 2, to: 3 }];
    expect(withGapLabels(guides, box, [])).toEqual(guides);
  });
});
