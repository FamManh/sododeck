import { describe, expect, it } from 'vitest';

import {
  clampFrame,
  MIN_FRAME,
  requiredBox,
  resizeBox,
  resizeFrame,
  type BoxResizeInput,
  type ResizeInput,
} from './resize-limits';

const start = { x: 0, y: 0, width: 200, height: 100 };
const base: Omit<ResizeInput, 'proposed' | 'handle'> = {
  start,
  content: null,
  padding: 24,
  keepRatio: false,
  fromCentre: false,
};

describe('requiredBox', () => {
  it('grows the content by the padding', () => {
    expect(requiredBox({ x: 50, y: 60, width: 100, height: 40 }, 24)).toEqual({
      x: 26,
      y: 36,
      width: 148,
      height: 88,
    });
  });

  it('is null without content', () => {
    expect(requiredBox(null, 24)).toBeNull();
  });
});

describe('resizeFrame', () => {
  it('moves only the right edge for the right handle', () => {
    const r = resizeFrame({
      ...base,
      handle: 'right',
      proposed: { x: 0, y: 30, width: 300, height: 20 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: 300, height: 100 });
  });

  it('moves the top and left edges for the top-left handle', () => {
    const r = resizeFrame({
      ...base,
      handle: 'top-left',
      proposed: { x: -50, y: -20, width: 250, height: 120 },
    });
    expect(r).toEqual({ x: -50, y: -20, width: 250, height: 120 });
  });

  it('never moves the other axis on a side handle', () => {
    const r = resizeFrame({
      ...base,
      handle: 'top',
      proposed: { x: 40, y: -30, width: 90, height: 130 },
    });
    expect(r).toEqual({ x: 0, y: -30, width: 200, height: 130 });
  });

  it('is at least 160 × 96 for an empty group', () => {
    const r = resizeFrame({
      ...base,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 10, height: 10 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: MIN_FRAME.width, height: MIN_FRAME.height });
  });

  it('keeps the minimum when shrinking from the top-left', () => {
    const r = resizeFrame({
      ...base,
      handle: 'top-left',
      proposed: { x: 190, y: 90, width: 10, height: 10 },
    });
    expect(r).toEqual({ x: 40, y: 4, width: 160, height: 96 });
  });

  it('stops at the members plus padding when shrinking', () => {
    const big = { x: 0, y: 0, width: 400, height: 300 };
    const content = { x: 50, y: 50, width: 200, height: 150 };
    const right = resizeFrame({
      ...base,
      start: big,
      content,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(right).toEqual({ x: 0, y: 0, width: 274, height: 224 });
    const left = resizeFrame({
      ...base,
      start: big,
      content,
      handle: 'left',
      proposed: { x: 350, y: 0, width: 50, height: 300 },
    });
    expect(left).toEqual({ x: 26, y: 0, width: 374, height: 300 });
  });

  it('keeps the aspect ratio on a corner with ⇧ (larger change wins)', () => {
    const br = resizeFrame({
      ...base,
      keepRatio: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 400, height: 120 },
    });
    expect(br).toEqual({ x: 0, y: 0, width: 400, height: 200 });
    const tl = resizeFrame({
      ...base,
      keepRatio: true,
      handle: 'top-left',
      proposed: { x: -100, y: -10, width: 300, height: 110 },
    });
    expect(tl).toEqual({ x: -100, y: -50, width: 300, height: 150 });
    const tall = resizeFrame({
      ...base,
      keepRatio: true,
      handle: 'bottom-left',
      proposed: { x: -10, y: 0, width: 210, height: 300 },
    });
    expect(tall).toEqual({ x: -400, y: 0, width: 600, height: 300 });
  });

  it('keeps the aspect ratio on a side with ⇧, around the other axis centre', () => {
    const r = resizeFrame({
      ...base,
      keepRatio: true,
      handle: 'right',
      proposed: { x: 0, y: 0, width: 300, height: 100 },
    });
    expect(r).toEqual({ x: 0, y: -25, width: 300, height: 150 });
  });

  it('resizes from the centre with ⌥', () => {
    const side = resizeFrame({
      ...base,
      fromCentre: true,
      handle: 'right',
      proposed: { x: 0, y: 0, width: 260, height: 100 },
    });
    expect(side).toEqual({ x: -60, y: 0, width: 320, height: 100 });
    const corner = resizeFrame({
      ...base,
      fromCentre: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 260, height: 140 },
    });
    expect(corner).toEqual({ x: -60, y: -40, width: 320, height: 180 });
  });

  it('grows both edges to the minimum with ⌥', () => {
    const r = resizeFrame({
      ...base,
      fromCentre: true,
      handle: 'right',
      proposed: { x: 0, y: 0, width: 100, height: 100 },
    });
    expect(r).toEqual({ x: 20, y: 0, width: 160, height: 100 });
  });

  it('combines ⇧ and ⌥ on a corner', () => {
    const r = resizeFrame({
      ...base,
      keepRatio: true,
      fromCentre: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 300, height: 100 },
    });
    // right 300 → width 400 around x 100; height 200 around y 50
    expect(r).toEqual({ x: -100, y: -50, width: 400, height: 200 });
  });

  it('lets clamping win over the ratio', () => {
    const r = resizeFrame({
      ...base,
      start: { x: 0, y: 0, width: 400, height: 100 },
      keepRatio: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 200, height: 100 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: 200, height: 96 });
  });

  it('rounds to integers', () => {
    const r = resizeFrame({
      ...base,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 250.4, height: 120.6 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: 250, height: 121 });
  });
});

describe('clampFrame', () => {
  const content = { x: 100, y: 100, width: 200, height: 100 };

  it('grows to the minimum size', () => {
    expect(clampFrame({ x: 5, y: 6, width: 10, height: 10 }, null, 24)).toEqual({
      x: 5,
      y: 6,
      width: 160,
      height: 96,
    });
  });

  it('keeps X/Y and grows width/height to contain the content', () => {
    expect(clampFrame({ x: 50, y: 50, width: 100, height: 100 }, content, 24)).toEqual({
      x: 50,
      y: 50,
      width: 274,
      height: 174,
    });
  });

  it('moves the frame when X/Y would cut the content', () => {
    expect(clampFrame({ x: 200, y: 150, width: 300, height: 200 }, content, 24)).toEqual({
      x: 76,
      y: 76,
      width: 300,
      height: 200,
    });
    expect(clampFrame({ x: 200, y: 150, width: 100, height: 100 }, content, 24)).toEqual({
      x: 76,
      y: 76,
      width: 248,
      height: 148,
    });
  });

  it('leaves a valid frame alone', () => {
    const frame = { x: 0, y: 0, width: 500, height: 400 };
    expect(clampFrame(frame, content, 24)).toEqual(frame);
  });
});

describe('resizeBox (017 R4)', () => {
  const cardStart = { x: 0, y: 0, width: 164, height: 50 };
  const cardBase: Omit<BoxResizeInput, 'proposed' | 'handle'> = {
    start: cardStart,
    min: { width: 120, height: 44 },
    max: { width: 800, height: 600 },
    step: 4,
    keepRatio: false,
    fromCentre: false,
  };

  it('moves only the dragged edge, for each of the 8 handles', () => {
    const right = resizeBox({
      ...cardBase,
      handle: 'right',
      proposed: { x: 0, y: 10, width: 260, height: 20 },
    });
    expect(right).toEqual({ x: 0, y: 0, width: 260, height: 50 });

    const left = resizeBox({
      ...cardBase,
      handle: 'left',
      proposed: { x: -40, y: 10, width: 204, height: 20 },
    });
    expect(left).toEqual({ x: -40, y: 0, width: 204, height: 50 });

    const top = resizeBox({
      ...cardBase,
      handle: 'top',
      proposed: { x: 10, y: -30, width: 20, height: 80 },
    });
    expect(top).toEqual({ x: 0, y: -30, width: 164, height: 80 });

    const bottom = resizeBox({
      ...cardBase,
      handle: 'bottom',
      proposed: { x: 10, y: 0, width: 20, height: 88 },
    });
    expect(bottom).toEqual({ x: 0, y: 0, width: 164, height: 88 });

    const bottomRight = resizeBox({
      ...cardBase,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 244, height: 80 },
    });
    expect(bottomRight).toEqual({ x: 0, y: 0, width: 244, height: 80 });

    const bottomLeft = resizeBox({
      ...cardBase,
      handle: 'bottom-left',
      proposed: { x: -80, y: 0, width: 244, height: 80 },
    });
    expect(bottomLeft).toEqual({ x: -80, y: 0, width: 244, height: 80 });

    const topRight = resizeBox({
      ...cardBase,
      handle: 'top-right',
      proposed: { x: 0, y: -30, width: 244, height: 80 },
    });
    expect(topRight).toEqual({ x: 0, y: -30, width: 244, height: 80 });

    const topLeft = resizeBox({
      ...cardBase,
      handle: 'top-left',
      proposed: { x: -80, y: -30, width: 244, height: 80 },
    });
    expect(topLeft).toEqual({ x: -80, y: -30, width: 244, height: 80 });
  });

  it('rounds the absolute size to multiples of 4 (164 + 80 → 244, 50 + 30 → 80)', () => {
    const r = resizeBox({
      ...cardBase,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 243, height: 78 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: 244, height: 80 });
  });

  it('clamps to the minimum 120 × 44', () => {
    const r = resizeBox({
      ...cardBase,
      handle: 'top-left',
      proposed: { x: 150, y: 40, width: 14, height: 10 },
    });
    expect(r).toEqual({ x: 44, y: 6, width: 120, height: 44 });
  });

  it('clamps to the maximum 800 × 600', () => {
    const r = resizeBox({
      ...cardBase,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 5000, height: 4000 },
    });
    expect(r).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('keeps the start ratio with ⇧ until a limit, then clamping wins (016 style)', () => {
    const r = resizeBox({
      ...cardBase,
      keepRatio: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 328, height: 100 },
    });
    // ratio 164:50: width doubles, and the follower (height) doubles too, matching "proposed".
    expect(r).toEqual({ x: 0, y: 0, width: 328, height: 100 });

    const clamped = resizeBox({
      ...cardBase,
      keepRatio: true,
      handle: 'bottom-right',
      proposed: { x: 0, y: 0, width: 40, height: 40 },
    });
    // The height follower (12) is below the 44 minimum, so both axes clamp to their own
    // minimum independently, breaking the ratio (as `resizeFrame`'s clamping-wins case, 016).
    expect(clamped).toEqual({ x: 0, y: 0, width: 120, height: 44 });
  });

  it('resizes from the centre with ⌥', () => {
    const r = resizeBox({
      ...cardBase,
      fromCentre: true,
      handle: 'right',
      proposed: { x: 0, y: 0, width: 194, height: 50 },
    });
    expect(r).toEqual({ x: -30, y: 0, width: 224, height: 50 });
  });

  it('keeps 016s resizeFrame case: content minimum and MIN_FRAME still pass through', () => {
    const r = resizeFrame({
      start: { x: 0, y: 0, width: 200, height: 100 },
      proposed: { x: 0, y: 0, width: 10, height: 10 },
      handle: 'bottom-right',
      content: null,
      padding: 24,
      keepRatio: false,
      fromCentre: false,
    });
    expect(r).toEqual({ x: 0, y: 0, width: MIN_FRAME.width, height: MIN_FRAME.height });
  });
});
