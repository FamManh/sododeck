import type { Problem } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { nextProblem } from './next-problem';

const p = (key: string) => ({ key }) as Problem;
const list = [p('a'), p('b'), p('c')];

describe('nextProblem (015 FR-021)', () => {
  it('starts at the first (or last) problem', () => {
    expect(nextProblem(list, null, 1)?.key).toBe('a');
    expect(nextProblem(list, null, -1)?.key).toBe('c');
  });

  it('walks forwards and backwards, wrapping at the ends', () => {
    expect(nextProblem(list, 'a', 1)?.key).toBe('b');
    expect(nextProblem(list, 'c', 1)?.key).toBe('a');
    expect(nextProblem(list, 'a', -1)?.key).toBe('c');
  });

  it('restarts when the last visited problem is gone, and is null without problems', () => {
    expect(nextProblem(list, 'fixed', 1)?.key).toBe('a');
    expect(nextProblem(list, 'fixed', -1)?.key).toBe('c');
    expect(nextProblem([], 'a', 1)).toBeNull();
  });
});
