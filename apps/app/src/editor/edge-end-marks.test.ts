import { describe, expect, it } from 'vitest';

import {
  ARROW_PATH,
  arrowPathAt,
  cardTextAt,
  crowPath,
  endMarks,
  relationshipMark,
} from './edge-end-marks';

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

describe('crowPath (042 R7, DESIGN.md "Crow\'s foot and ports")', () => {
  const p = { x: 100, y: 50 };
  const right = { x: 1, y: 0 };
  const left = { x: -1, y: 0 };

  it('draws toes p ± 6v → p + 12u and a bar at 16 for one or many', () => {
    // v = (−u.y, u.x) = (0, 1) for u pointing right.
    expect(crowPath(p, right, 'one-many')).toEqual({
      d: 'M 100 56 L 112 50 L 100 44 M 116 58 L 116 42',
    });
  });

  it('draws toes and a ring at 20 for zero or many, no bar', () => {
    expect(crowPath(p, right, 'zero-many')).toEqual({
      d: 'M 100 56 L 112 50 L 100 44',
      ring: { cx: 120, cy: 50 },
    });
  });

  it('draws a bar at 10 for exactly one and at 8 with a ring at 17 for zero or one', () => {
    expect(crowPath(p, right, 'one')).toEqual({ d: 'M 110 58 L 110 42' });
    expect(crowPath(p, right, 'zero-one')).toEqual({
      d: 'M 108 58 L 108 42',
      ring: { cx: 117, cy: 50 },
    });
  });

  it('mirrors on the left side', () => {
    expect(crowPath(p, left, 'one-many')).toEqual({
      d: 'M 100 44 L 88 50 L 100 56 M 84 42 L 84 58',
    });
  });

  it('follows the angle of a straight line', () => {
    const u = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    const { ring } = crowPath({ x: 0, y: 0 }, u, 'zero-many');
    expect(ring?.cx).toBeCloseTo(20 * Math.SQRT1_2, 1);
    expect(ring?.cy).toBeCloseTo(20 * Math.SQRT1_2, 1);
    expect(crowPath({ x: 0, y: 0 }, u, 'one-many').d).toContain('L 8.49 8.49');
  });
});

describe('1 / n text marks (042 FR-025)', () => {
  it('sits 8 along the end and 8 above the line, reading away from the card', () => {
    expect(cardTextAt({ x: 100, y: 50 }, { x: 1, y: 0 })).toEqual({
      at: { x: 108, y: 42 },
      anchor: 'start',
    });
    expect(cardTextAt({ x: 100, y: 50 }, { x: -1, y: 0 })).toEqual({
      at: { x: 92, y: 42 },
      anchor: 'end',
    });
  });

  it('maps each end to its text, and crow notation to a crow mark', () => {
    const at = { x: 0, y: 0 };
    const u = { x: 1, y: 0 };
    const text = (end: 'one' | 'zero-one' | 'one-many' | 'zero-many') => {
      const mark = relationshipMark(at, u, end, 'numeric');
      return mark?.kind === 'card-text' ? mark.text : undefined;
    };
    expect([text('one'), text('zero-one'), text('one-many'), text('zero-many')]).toEqual([
      '1',
      '0..1',
      '1..n',
      '0..n',
    ]);
    expect(relationshipMark(at, u, 'one', 'crow')).toEqual({ kind: 'crow', end: 'one', at, u });
    expect(relationshipMark(at, u, undefined, 'crow')).toBeUndefined();
  });
});
