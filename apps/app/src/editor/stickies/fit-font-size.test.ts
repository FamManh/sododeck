import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFitCache,
  FIT_STEPS,
  FIXED_FONT_SIZES,
  fitFontSize,
  MIN_FIT_FONT_SIZE,
  TAG_ROW_HEIGHT,
  type FitBox,
  type Measure,
} from './fit-font-size';

/** Content height grows linearly with the font size: 2 lines per 100 px of text length. */
const linear: Measure = ({ text, fontSize }) => Math.ceil(text.length / 10) * fontSize;

const box = (over: Partial<FitBox> = {}): FitBox => ({
  text: 'hello',
  width: 200,
  height: 100,
  align: 'left',
  ...over,
});

describe('fitFontSize', () => {
  beforeEach(() => {
    clearFitCache();
  });

  it('exposes descending steps ending at the minimum', () => {
    expect(FIT_STEPS[0]).toBe(32);
    expect(FIT_STEPS.at(-1)).toBe(MIN_FIT_FONT_SIZE);
    expect(MIN_FIT_FONT_SIZE).toBe(9);
    expect([...FIT_STEPS]).toEqual([...FIT_STEPS].sort((a, b) => b - a));
    expect(FIXED_FONT_SIZES.length).toBeGreaterThan(0);
  });

  it('picks the largest step for short text', () => {
    expect(fitFontSize(linear, box(), 0)).toEqual({ fontSize: 32, clipped: false });
  });

  it('steps down until the content fits', () => {
    // 5 lines: 5 * size <= 100 -> 20
    expect(fitFontSize(linear, box({ text: 'x'.repeat(50) }), 0)).toEqual({
      fontSize: 20,
      clipped: false,
    });
  });

  it('returns the minimum and clipped when nothing fits', () => {
    expect(fitFontSize(linear, box({ text: 'x'.repeat(500) }), 0)).toEqual({
      fontSize: 9,
      clipped: true,
    });
  });

  it('bypasses fitting for a fixed font size', () => {
    const measure = vi.fn<Measure>(() => 9999);
    expect(fitFontSize(measure, box({ fontSize: 16 }), 0)).toEqual({
      fontSize: 16,
      clipped: false,
    });
    expect(measure).not.toHaveBeenCalled();
  });

  it('subtracts tag rows from the available height', () => {
    const b = box({ text: 'x'.repeat(30), height: 100 }); // 3 lines
    expect(fitFontSize(linear, b, 0).fontSize).toBe(32);
    // 100 - 2 * 24 = 52 -> 3 * 16 = 48 fits, 3 * 18 = 54 does not
    expect(TAG_ROW_HEIGHT).toBe(24);
    expect(fitFontSize(linear, b, 2).fontSize).toBe(16);
  });

  it('caches per input and recomputes when any input changes', () => {
    const measure = vi.fn(linear);
    const b = box();
    fitFontSize(measure, b, 0);
    const calls = measure.mock.calls.length;
    fitFontSize(measure, b, 0);
    expect(measure.mock.calls.length).toBe(calls);

    for (const next of [
      [box({ text: 'other' }), 0],
      [box({ width: 201 }), 0],
      [box({ height: 101 }), 0],
      [box({ align: 'center' }), 0],
      [b, 1],
    ] as const) {
      const before = measure.mock.calls.length;
      fitFontSize(measure, next[0], next[1]);
      expect(measure.mock.calls.length).toBeGreaterThan(before);
    }
  });
});
