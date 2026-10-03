import type { PathStep } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { edgeStateOf, stepMarks } from './step-marks';

let seq = 0;
function step(
  number: string,
  from: string | null,
  to: string | null,
  extra: Partial<PathStep> = {},
): PathStep {
  seq += 1;
  return {
    step: { id: `s${String(seq)}`, edge: `e${String(seq)}` },
    number,
    branchId: null,
    from,
    to,
    broken: false,
    chainBreak: false,
    ...extra,
  };
}

// a → b → c → d
const linear = () => [step('1', 'a', 'b'), step('2', 'b', 'c'), step('3', 'c', 'd')];

const plain = (marks: ReturnType<typeof stepMarks>) =>
  Object.fromEntries([...marks].map(([id, m]) => [id, `${m.state}:${m.number ?? '✓'}`]));

describe('stepMarks', () => {
  it('step 1: source played, target current, later targets upcoming', () => {
    expect(plain(stepMarks(linear(), 0))).toEqual({
      a: 'played:✓',
      b: 'current:1',
      c: 'upcoming:2',
      d: 'upcoming:3',
    });
  });

  it('middle step: earlier cards played, current target numbered, rest upcoming', () => {
    expect(plain(stepMarks(linear(), 1))).toEqual({
      a: 'played:✓',
      b: 'played:✓',
      c: 'current:2',
      d: 'upcoming:3',
    });
  });

  it('last step: everything played but the current target', () => {
    expect(plain(stepMarks(linear(), 2))).toEqual({
      a: 'played:✓',
      b: 'played:✓',
      c: 'played:✓',
      d: 'current:3',
    });
  });

  it('going back turns the card you left into upcoming again', () => {
    const marks = stepMarks(linear(), 0);
    expect(marks.get('c')).toEqual({ state: 'upcoming', number: '2' });
  });

  it('a loop-back card keeps its most advanced state and its first number when upcoming', () => {
    // a → b → c → b → d: b is reached at step 1 and again at step 3
    const path = [
      step('1', 'a', 'b'),
      step('2', 'b', 'c'),
      step('3', 'c', 'b'),
      step('4', 'b', 'd'),
    ];
    expect(plain(stepMarks(path, 1))).toMatchObject({ b: 'played:✓', c: 'current:2' });
    expect(plain(stepMarks(path, 2))).toMatchObject({ b: 'current:3', c: 'played:✓' });
    expect(plain(stepMarks(path, 0))).toMatchObject({ b: 'current:1' });
  });

  it('an upcoming card reached twice later shows the first step number', () => {
    const path = [
      step('1', 'a', 'b'),
      step('2', 'b', 'c'),
      step('3', 'c', 'd'),
      step('4', 'd', 'c'),
    ];
    expect(plain(stepMarks(path, 0))).toMatchObject({ c: 'upcoming:2' });
  });

  it('a self-loop step is current on its single card', () => {
    const path = [step('1', 'a', 'b'), step('2', 'b', 'b')];
    expect(plain(stepMarks(path, 1))).toEqual({ a: 'played:✓', b: 'current:2' });
  });

  it('a broken step marks no card, and neither does a missing source', () => {
    const path = [
      step('1', 'a', 'b'),
      step('2', null, null, { broken: true }),
      step('3', 'b', 'c'),
    ];
    expect(plain(stepMarks(path, 1))).toEqual({ a: 'played:✓', b: 'played:✓', c: 'upcoming:3' });
  });

  it('marks nothing for an empty path or an out-of-range index', () => {
    expect(stepMarks([], 0).size).toBe(0);
    expect(stepMarks(linear(), 9).size).toBe(0);
  });

  it('steps outside the played path (other alternatives) are never given', () => {
    // Only the played steps are passed in, so a card that only another alternative reaches has no mark.
    expect(stepMarks(linear(), 0).has('x')).toBe(false);
  });
});

describe('edgeStateOf', () => {
  it('is played before, current at and upcoming after the current index', () => {
    expect(edgeStateOf(0, 2)).toBe('played');
    expect(edgeStateOf(2, 2)).toBe('current');
    expect(edgeStateOf(3, 2)).toBe('upcoming');
  });
});
