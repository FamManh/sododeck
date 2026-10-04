import { describe, expect, it } from 'vitest';

import { nextStep, parseSteps, prevStep, seekTime, SETTLE, stepAt } from './seek';

const STEPS = parseSteps('2:0 3:1.5 4:2.4 7:5.1');
const END = 5.4;

describe('parseSteps', () => {
  it('reads index:time pairs sorted by time and skips junk', () => {
    expect(parseSteps('3:1.5 2:0 x:y')).toEqual([
      { index: 2, time: 0 },
      { index: 3, time: 1.5 },
    ]);
    expect(parseSteps(undefined)).toEqual([]);
    expect(parseSteps('  ')).toEqual([]);
  });
});

describe('stepAt', () => {
  it('is the last step that has started, or the first one', () => {
    expect(stepAt(STEPS, 0)?.index).toBe(2);
    expect(stepAt(STEPS, 1.5)?.index).toBe(3);
    expect(stepAt(STEPS, 2)?.index).toBe(3);
    expect(stepAt(STEPS, 9)?.index).toBe(7);
    expect(stepAt([], 1)).toBeUndefined();
  });
});

describe('next and previous', () => {
  it('move one step and stop at the ends', () => {
    expect(nextStep(STEPS, 0)?.index).toBe(3);
    expect(nextStep(STEPS, END)?.index).toBe(7);
    expect(prevStep(STEPS, 2)?.index).toBe(2);
    expect(prevStep(STEPS, 0)?.index).toBe(2);
  });

  it('chain through every step from a settled seek', () => {
    let t = 0;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      const step = nextStep(STEPS, t);
      if (step === undefined) break;
      t = seekTime(STEPS, step, END);
      seen.push(step.index);
    }
    expect(seen).toEqual([3, 4, 7, 7]);
  });
});

describe('seekTime', () => {
  it('settles into a step, and shows the final frame for the last one', () => {
    const [first, , , last] = STEPS;
    expect(first === undefined ? null : seekTime(STEPS, first, END)).toBe(SETTLE);
    expect(last === undefined ? null : seekTime(STEPS, last, END)).toBe(END);
  });
});
