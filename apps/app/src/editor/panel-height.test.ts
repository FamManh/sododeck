import { describe, expect, it } from 'vitest';

import { CANVAS_MIN, clampPanelHeight, PANEL_COLLAPSED, PANEL_MIN } from './panel-height';

describe('clampPanelHeight', () => {
  it('has the documented limits', () => {
    expect([PANEL_MIN, CANVAS_MIN, PANEL_COLLAPSED]).toEqual([96, 200, 36]);
  });

  it('keeps a height inside the limits', () => {
    expect(clampPanelHeight(300, 900)).toBe(300);
  });

  it('raises a height below the minimum', () => {
    expect(clampPanelHeight(20, 900)).toBe(96);
  });

  it('lowers a height that would leave the canvas under 200 px', () => {
    expect(clampPanelHeight(5000, 900)).toBe(700);
  });

  it('returns the minimum in a tiny window', () => {
    expect(clampPanelHeight(300, 250)).toBe(96);
  });

  it('returns the minimum for NaN', () => {
    expect(clampPanelHeight(Number.NaN, 900)).toBe(96);
  });
});
