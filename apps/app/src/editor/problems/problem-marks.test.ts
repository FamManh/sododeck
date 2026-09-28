import { checkDeck } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { NO_PROBLEM_MARKS, problemMarks, sameProblemMark } from './problem-marks';

const file = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
    { id: 'c', type: 'service', title: 'C' },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'b' },
  ],
});

describe('problemMarks (015 FR-022)', () => {
  it('marks every object a problem names, with a count, titles and a label', () => {
    const marks = problemMarks(checkDeck(file));
    // A component without connections is not a problem (founder decision, 2026-09-28).
    expect(marks.has('c')).toBe(false);
    expect(marks.get('e1')).toEqual({
      count: 1,
      titles: 'Duplicate connection',
      label: '1 problem',
    });
    expect(marks.has('a')).toBe(false);
  });

  it('keeps one map per result and none without problems', () => {
    const result = checkDeck(file);
    expect(problemMarks(result)).toBe(problemMarks(result));
    expect(problemMarks(null)).toBe(NO_PROBLEM_MARKS);
    expect(problemMarks(checkDeck(deckOf({})))).toBe(NO_PROBLEM_MARKS);
  });

  it('compares marks by value', () => {
    const a = problemMarks(checkDeck(file)).get('e1');
    const b = problemMarks(checkDeck(file)).get('e1');
    expect(a).not.toBe(b);
    expect(sameProblemMark(a, b)).toBe(true);
    expect(sameProblemMark(a, undefined)).toBe(false);
    expect(sameProblemMark(undefined, undefined)).toBe(true);
  });
});
