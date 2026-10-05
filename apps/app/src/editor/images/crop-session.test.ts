import { describe, expect, it } from 'vitest';

import {
  CROP_HANDLES,
  dragHandle,
  moveFrame,
  nudge,
  pictureDelta,
  pictureHandle,
  type CropHandle,
} from './crop-session';

const crop = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
const min = { width: 0.1, height: 0.1 };
const free = { keepRatio: false, min };

const close = (
  actual: { x: number; y: number; width: number; height: number },
  expected: typeof actual,
) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.width).toBeCloseTo(expected.width);
  expect(actual.height).toBeCloseTo(expected.height);
};

describe('crop session maths (057)', () => {
  it('lists eight handles clockwise from the top left, with names', () => {
    expect(CROP_HANDLES.map((h) => h.id)).toEqual([
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ]);
    expect(CROP_HANDLES.map((h) => h.label)).toEqual([
      'Crop top left corner',
      'Crop top edge',
      'Crop top right corner',
      'Crop right edge',
      'Crop bottom right corner',
      'Crop bottom edge',
      'Crop bottom left corner',
      'Crop left edge',
    ]);
  });

  it.each([
    ['top-left', { x: 0.35, y: 0.35, width: 0.4, height: 0.4 }],
    ['top', { x: 0.25, y: 0.35, width: 0.5, height: 0.4 }],
    ['top-right', { x: 0.25, y: 0.35, width: 0.6, height: 0.4 }],
    ['right', { x: 0.25, y: 0.25, width: 0.6, height: 0.5 }],
    ['bottom-right', { x: 0.25, y: 0.25, width: 0.6, height: 0.6 }],
    ['bottom', { x: 0.25, y: 0.25, width: 0.5, height: 0.6 }],
    ['bottom-left', { x: 0.35, y: 0.25, width: 0.4, height: 0.6 }],
    ['left', { x: 0.35, y: 0.25, width: 0.4, height: 0.5 }],
  ] as const)('moves the %s handle by the delta', (handle, expected) => {
    close(dragHandle(crop, handle, { x: 0.1, y: 0.1 }, free), expected);
  });

  it('clamps to the picture and to the minimum', () => {
    close(dragHandle(crop, 'top-left', { x: -1, y: -1 }, free), {
      x: 0,
      y: 0,
      width: 0.75,
      height: 0.75,
    });
    close(dragHandle(crop, 'bottom-right', { x: 1, y: 1 }, free), {
      x: 0.25,
      y: 0.25,
      width: 0.75,
      height: 0.75,
    });
    close(dragHandle(crop, 'left', { x: 0.9, y: 0 }, free), {
      x: 0.65,
      y: 0.25,
      width: 0.1,
      height: 0.5,
    });
    close(dragHandle(crop, 'bottom', { x: 0, y: -0.9 }, free), {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.1,
    });
  });

  it('keeps the proportions on a corner with keepRatio, anchored at the opposite corner', () => {
    const wide = { x: 0.1, y: 0.1, width: 0.4, height: 0.2 };
    const out = dragHandle(wide, 'bottom-right', { x: 0.2, y: 0 }, { keepRatio: true, min });
    expect(out.width / out.height).toBeCloseTo(2);
    close(out, { x: 0.1, y: 0.1, width: 0.6, height: 0.3 });
    const inward = dragHandle(wide, 'top-left', { x: 0.2, y: 0 }, { keepRatio: true, min });
    close(inward, { x: 0.3, y: 0.2, width: 0.2, height: 0.1 });
    // Held inside the picture: the bottom edge stops the growth.
    const capped = dragHandle(wide, 'bottom-right', { x: 1, y: 1 }, { keepRatio: true, min });
    expect(capped.width / capped.height).toBeCloseTo(2);
    expect(capped.x + capped.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(capped.y + capped.height).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('ignores keepRatio on an edge handle', () => {
    close(dragHandle(crop, 'right', { x: 0.1, y: 0 }, { keepRatio: true, min }), {
      x: 0.25,
      y: 0.25,
      width: 0.6,
      height: 0.5,
    });
  });

  it('moves the frame without changing its size, inside the picture', () => {
    close(moveFrame(crop, { x: 0.1, y: -0.1 }), { x: 0.35, y: 0.15, width: 0.5, height: 0.5 });
    close(moveFrame(crop, { x: 1, y: 1 }), { x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    close(moveFrame(crop, { x: -1, y: -1 }), { x: 0, y: 0, width: 0.5, height: 0.5 });
  });

  it('converts canvas pixels to picture fractions, mirrored when flipped', () => {
    const picture = { width: 400, height: 200 };
    expect(pictureDelta({ x: 40, y: 20 }, picture, {})).toEqual({ x: 0.1, y: 0.1 });
    expect(pictureDelta({ x: 40, y: 20 }, picture, { flipX: true })).toEqual({ x: -0.1, y: 0.1 });
    expect(pictureDelta({ x: 40, y: 20 }, picture, { flipY: true })).toEqual({ x: 0.1, y: -0.1 });
  });

  it('maps an on-screen handle to the picture edge it moves when flipped', () => {
    const cases: [CropHandle, object, CropHandle][] = [
      ['left', { flipX: true }, 'right'],
      ['top-left', { flipX: true }, 'top-right'],
      ['top-left', { flipY: true }, 'bottom-left'],
      ['top-left', { flipX: true, flipY: true }, 'bottom-right'],
      ['top', { flipX: true }, 'top'],
      ['frame', { flipX: true, flipY: true }, 'frame'],
    ];
    for (const [handle, flip, expected] of cases)
      expect(pictureHandle(handle, flip)).toBe(expected);
  });

  it('nudges a handle or the frame by 1 canvas px, 10 with the large step', () => {
    const picture = { width: 100, height: 100 };
    close(nudge(crop, 'frame', 'ArrowRight', false, picture, {}, min), {
      x: 0.26,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    });
    close(nudge(crop, 'bottom', 'ArrowUp', true, picture, {}, min), {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.4,
    });
    // The on-screen left edge of a mirrored picture is its right edge.
    close(nudge(crop, 'left', 'ArrowLeft', false, picture, { flipX: true }, min), {
      x: 0.25,
      y: 0.25,
      width: 0.51,
      height: 0.5,
    });
    // An arrow across an edge handle does nothing.
    expect(nudge(crop, 'top', 'ArrowLeft', false, picture, {}, min)).toEqual(crop);
  });
});
