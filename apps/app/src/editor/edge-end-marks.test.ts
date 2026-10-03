import { describe, expect, it } from 'vitest';

import { ARROW_PATH, arrowPathAt, endMarks } from './edge-end-marks';

const ends = {
  start: { x: 10, y: 20 },
  end: { x: 110, y: 60 },
  startDir: { x: 1, y: 0 },
  endDir: { x: 0, y: 1 },
};

describe('endMarks', () => {
  it('is a knob then an arrow for forward, and for an absent direction', () => {
    const expected = [
      { kind: 'knob', at: ends.start },
      { kind: 'arrow', at: ends.end, angle: 90 },
    ];
    expect(endMarks(ends, 'forward')).toEqual(expected);
    expect(endMarks(ends, undefined)).toEqual(expected);
  });

  it('is two arrows for both, the start one pointing against the line', () => {
    expect(endMarks(ends, 'both')).toEqual([
      { kind: 'arrow', at: ends.start, angle: 180 },
      { kind: 'arrow', at: ends.end, angle: 90 },
    ]);
  });

  it('is two knobs for none', () => {
    expect(endMarks(ends, 'none')).toEqual([
      { kind: 'knob', at: ends.start },
      { kind: 'knob', at: ends.end },
    ]);
  });

  it('draws the arrow 9 long and 10 wide with the tip at the origin', () => {
    expect(ARROW_PATH).toBe('M 0 0 L -9 -5 L -9 5 Z');
  });

  it('bakes the rotation into the path instead of a transform', () => {
    expect(arrowPathAt(110, 60, 0)).toBe('M 110 60 L 101 55 L 101 65 Z');
    expect(arrowPathAt(110, 60, 90)).toBe('M 110 60 L 115 51 L 105 51 Z');
    expect(arrowPathAt(10, 20, 180)).toBe('M 10 20 L 19 25 L 19 15 Z');
  });

  it('ends in a cross instead of an arrow on an error path, keeping the start mark (035)', () => {
    expect(endMarks(ends, 'forward', true)).toEqual([
      { kind: 'knob', at: ends.start },
      { kind: 'cross', at: ends.end },
    ]);
    expect(endMarks(ends, 'both', true)[1]).toEqual({ kind: 'cross', at: ends.end });
  });
});
