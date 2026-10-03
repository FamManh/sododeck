import { describe, expect, it } from 'vitest';

import { samplePath } from '../routing/connector-geometry';
import { labelClamp, labelFromPoint, labelRange, labelReadout, stepLabel } from './label-drag';

const line = samplePath('M 0 0 L 400 0');
const clamp = labelClamp('call'); // 8 + (4 × 6.3 + 16) / 2 = 28.6

describe('labelFromPoint', () => {
  it('projects the pointer onto straight, bent and curved paths', () => {
    expect(labelFromPoint(line, { x: 160, y: 30 }, clamp, { mod: true }).at).toBeCloseTo(0.4, 3);
    const bent = samplePath('M 0 0 L 200 0 L 200 200');
    expect(labelFromPoint(bent, { x: 230, y: 150 }, clamp, { mod: true }).at).toBeCloseTo(0.875, 3);
    const curved = samplePath('M 0 0 C 0 100 400 100 400 0');
    const hit = labelFromPoint(curved, { x: 200, y: 80 }, clamp, { mod: true });
    expect(hit.at).toBeGreaterThan(0.45);
    expect(hit.at).toBeLessThan(0.55);
  });

  it('snaps within 4 % of a tick, and ⌘ turns it off', () => {
    expect(labelFromPoint(line, { x: 108, y: 0 }, clamp, { mod: false })).toEqual({
      at: 0.25,
      snapped: true,
    });
    expect(labelFromPoint(line, { x: 108, y: 0 }, clamp, { mod: true })).toEqual({
      at: 0.27,
      snapped: false,
    });
    expect(labelFromPoint(line, { x: 120, y: 0 }, clamp, { mod: false }).snapped).toBe(false);
  });

  it('keeps the pill 8 px plus half its width away from each end', () => {
    const { min, max } = labelRange(400, clamp);
    expect(labelFromPoint(line, { x: -50, y: 0 }, clamp, { mod: true }).at).toBeCloseTo(min, 3);
    expect(labelFromPoint(line, { x: 900, y: 0 }, clamp, { mod: true }).at).toBeCloseTo(max, 3);
    expect(min * 400).toBeGreaterThanOrEqual(clamp);
    expect(min * 400).toBeLessThan(clamp + 0.5);
  });

  it('a line shorter than two clamps only allows the middle', () => {
    expect(labelRange(40, clamp)).toEqual({ min: 0.5, max: 0.5 });
    expect(labelRange(0, clamp)).toEqual({ min: 0.5, max: 0.5 });
  });
});

describe('stepLabel', () => {
  const range = labelRange(400, clamp);

  it('← / → move 5 %', () => {
    expect(stepLabel(0.5, 'ArrowRight', false, range)).toBe(0.55);
    expect(stepLabel(0.5, 'ArrowLeft', false, range)).toBe(0.45);
  });

  it('Shift + ← / → jump to the previous / next tick', () => {
    expect(stepLabel(0.5, 'ArrowRight', true, range)).toBe(0.75);
    expect(stepLabel(0.5, 'ArrowLeft', true, range)).toBe(0.25);
    expect(stepLabel(0.3, 'ArrowLeft', true, range)).toBe(0.25);
    expect(stepLabel(0.75, 'ArrowRight', true, range)).toBe(range.max);
  });

  it('Home and End go to the clamped ends', () => {
    expect(stepLabel(0.5, 'Home', false, range)).toBe(Math.round(range.min * 1000) / 1000);
    expect(stepLabel(0.5, 'End', false, range)).toBe(Math.round(range.max * 1000) / 1000);
  });

  it('never leaves the range, and ignores other keys', () => {
    expect(stepLabel(range.max, 'ArrowRight', false, range)).toBeLessThanOrEqual(range.max);
    expect(stepLabel(0.5, 'a', false, range)).toBeNull();
  });
});

describe('labelReadout', () => {
  it('says the percentage', () => {
    expect(labelReadout(0.2)).toBe('label 20 %');
    expect(labelReadout(0.25, true)).toBe('label 25 % · snapped');
  });
});
