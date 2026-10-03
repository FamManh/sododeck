import { describe, expect, it } from 'vitest';

import { ARROW_PATH, endMarks } from './edge-end-marks';

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
});
