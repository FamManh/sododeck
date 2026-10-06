import { describe, expect, it } from 'vitest';

import {
  normaliseRotation,
  rotationFromPointer,
  rotationPatch,
  stepRotation,
  textRotationOf,
} from './text-rotation';

describe('text rotation (founder feedback, 2026-10-06)', () => {
  it('reads the rotation of a text only; other types ignore a stored value', () => {
    expect(textRotationOf({ type: 'text', rotation: 30 })).toBe(30);
    expect(textRotationOf({ type: 'text' })).toBe(0);
    expect(textRotationOf({ type: 'diamond', rotation: 30 })).toBe(0);
    expect(textRotationOf({ type: 'service', rotation: 30 })).toBe(0);
  });

  it('normalises to more than -180 and at most 180, in tenths of a degree', () => {
    expect(normaliseRotation(190)).toBe(-170);
    expect(normaliseRotation(-180)).toBe(180);
    expect(normaliseRotation(360)).toBe(0);
    expect(normaliseRotation(-0)).toBe(0);
    expect(normaliseRotation(12.345)).toBe(12.3);
  });

  it('turns clockwise from the top: right of the centre is 90, below is 180', () => {
    const centre = { x: 100, y: 100 };
    expect(rotationFromPointer(centre, { x: 100, y: 0 }, false)).toBe(0);
    expect(rotationFromPointer(centre, { x: 200, y: 100 }, false)).toBe(90);
    expect(rotationFromPointer(centre, { x: 100, y: 200 }, false)).toBe(180);
    expect(rotationFromPointer(centre, { x: 0, y: 100 }, false)).toBe(-90);
    // Whole degrees while dragging; 15° steps with Shift.
    expect(rotationFromPointer(centre, { x: 120, y: 0 }, false)).toBe(11);
    expect(rotationFromPointer(centre, { x: 120, y: 0 }, true)).toBe(15);
  });

  it('steps by a delta and wraps past half a turn', () => {
    expect(stepRotation(0, 15)).toBe(15);
    expect(stepRotation(175, 15)).toBe(-170);
    expect(stepRotation(-170, -15)).toBe(175);
  });

  it('writes null for no turn, so the key is removed', () => {
    expect(rotationPatch(0)).toBeNull();
    expect(rotationPatch(45)).toBe(45);
  });
});
