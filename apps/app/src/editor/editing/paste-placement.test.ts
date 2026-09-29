import { describe, expect, it } from 'vitest';

import { pastePlacement, PASTE_STEP } from './paste-placement';

const visible = { x: 0, y: 0, width: 1000, height: 800 };

describe('pastePlacement (016 FR-004)', () => {
  it('pastes at the pointer when there is one', () => {
    const { at } = pastePlacement({
      source: { x: 10, y: 10 },
      pointer: { x: 400, y: 300 },
      visible,
      serial: null,
    });
    expect(at).toEqual({ x: 400, y: 300 });
  });

  it('otherwise 24 px from the source when that is on screen', () => {
    const { at } = pastePlacement({
      source: { x: 10, y: 10 },
      pointer: null,
      visible,
      serial: null,
    });
    expect(at).toEqual({ x: 10 + PASTE_STEP, y: 10 + PASTE_STEP });
  });

  it('otherwise at the view centre', () => {
    const { at } = pastePlacement({
      source: { x: 5000, y: 10 },
      pointer: null,
      visible,
      serial: null,
    });
    expect(at).toEqual({ x: 500, y: 400 });
  });

  it('adds 24 px for each repeat at the same point', () => {
    const first = pastePlacement({
      source: { x: 0, y: 0 },
      pointer: { x: 400, y: 300 },
      visible,
      serial: null,
    });
    const second = pastePlacement({
      source: { x: 0, y: 0 },
      pointer: { x: 401, y: 302 },
      visible,
      serial: first.serial,
    });
    const third = pastePlacement({
      source: { x: 0, y: 0 },
      pointer: { x: 400, y: 300 },
      visible,
      serial: second.serial,
    });
    expect(second.at).toEqual({ x: 424, y: 324 });
    expect(third.at).toEqual({ x: 448, y: 348 });
    const moved = pastePlacement({
      source: { x: 0, y: 0 },
      pointer: { x: 600, y: 300 },
      visible,
      serial: third.serial,
    });
    expect(moved.at).toEqual({ x: 600, y: 300 });
    expect(moved.serial.count).toBe(0);
  });
});
