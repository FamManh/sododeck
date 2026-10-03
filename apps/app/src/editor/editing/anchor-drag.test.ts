import { describe, expect, it } from 'vitest';

import { anchorFromPoint, anchorReadout, stepAnchor } from './anchor-drag';

const box = { x: 100, y: 200, width: 200, height: 80 };

describe('anchorFromPoint', () => {
  it('projects the pointer onto the nearest side', () => {
    expect(anchorFromPoint(box, { x: 140, y: 190 }, { mod: true })).toMatchObject({
      side: 'top',
      at: 0.2,
    });
    expect(anchorFromPoint(box, { x: 310, y: 260 }, { mod: true })).toMatchObject({
      side: 'right',
      at: 0.75,
    });
    expect(anchorFromPoint(box, { x: 90, y: 220 }, { mod: true })).toMatchObject({
      side: 'left',
      at: 0.25,
    });
    expect(anchorFromPoint(box, { x: 200, y: 300 }, { mod: true })).toMatchObject({
      side: 'bottom',
      at: 0.5,
    });
  });

  it('snaps within 4 % to the five stops, and ⌘ turns it off', () => {
    const near = { x: 100 + 200 * 0.77, y: 200 };
    expect(anchorFromPoint(box, near, { mod: false })).toMatchObject({ at: 0.75, snapped: true });
    expect(anchorFromPoint(box, near, { mod: true })).toMatchObject({ snapped: false });
    expect(anchorFromPoint(box, { x: 100 + 200 * 0.7, y: 200 }, { mod: false })).toMatchObject({
      snapped: false,
    });
    expect(anchorFromPoint(box, { x: 90, y: 150 }, { mod: false })).toMatchObject({
      at: 0,
      snapped: true,
    });
  });

  it('clamps to the side and reports the anchor point', () => {
    const hit = anchorFromPoint(box, { x: 500, y: 300 }, { mod: true });
    expect(hit.at).toBeLessThanOrEqual(1);
    expect(hit.point).toEqual({ x: 300, y: 280 });
    expect(anchorFromPoint(box, { x: 120, y: 200 }, { mod: true }).point).toEqual({
      x: 120,
      y: 200,
    });
  });

  it('is automatic once more than 12 px inside every side', () => {
    expect(anchorFromPoint(box, { x: 200, y: 240 }, { mod: false }).automatic).toBe(true);
    expect(anchorFromPoint(box, { x: 200, y: 210 }, { mod: false }).automatic).toBe(false);
    expect(anchorFromPoint(box, { x: 200, y: 190 }, { mod: false }).automatic).toBe(false);
  });
});

describe('anchorReadout', () => {
  it('says the side and the percentage', () => {
    expect(anchorReadout('left', 0.78)).toBe('left side · 78 %');
    expect(anchorReadout('top', 0.25, true)).toBe('top side · 25 % · snapped');
  });
});

describe('stepAnchor', () => {
  it('moves one stop along the side', () => {
    expect(stepAnchor('top', 0.5, 1)).toEqual({ side: 'top', at: 0.75 });
    expect(stepAnchor('top', 0.5, -1)).toEqual({ side: 'top', at: 0.25 });
    expect(stepAnchor('left', 0.78, 1)).toEqual({ side: 'left', at: 1 });
    expect(stepAnchor('left', 0.78, -1)).toEqual({ side: 'left', at: 0.75 });
  });

  it('carries on to the neighbouring side at a corner', () => {
    expect(stepAnchor('top', 1, 1)).toEqual({ side: 'right', at: 0 });
    expect(stepAnchor('top', 0, -1)).toEqual({ side: 'left', at: 0 });
    expect(stepAnchor('right', 1, 1)).toEqual({ side: 'bottom', at: 1 });
    expect(stepAnchor('bottom', 0, -1)).toEqual({ side: 'left', at: 1 });
  });
});
