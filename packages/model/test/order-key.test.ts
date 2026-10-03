import { describe, expect, it } from 'vitest';

import { compareKeys, keyBetween, keysBetween } from '../src/order-key';

/** Deterministic pseudo-random numbers, so a failure reproduces. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

describe('order keys', () => {
  it('starts with a valid key', () => {
    const key = keyBetween(null, null);
    expect(key).toBe('a0');
    expect(keyBetween(key, null) > key).toBe(true);
  });

  it('extends both ends', () => {
    const middle = keyBetween(null, null);
    const before = keyBetween(null, middle);
    const after = keyBetween(middle, null);
    expect(before < middle).toBe(true);
    expect(after > middle).toBe(true);
  });

  it('puts a key strictly between any two keys, by code unit', () => {
    const random = seeded(42);
    const keys = keysBetween(null, null, 50);
    for (let i = 0; i < 1000; i++) {
      // Grow the pool with keys squeezed between random neighbours, so deep keys are tested too.
      const sorted = [...keys].sort(compareKeys);
      const at = Math.floor(random() * (sorted.length - 1));
      const a = sorted[at] ?? '';
      const b = sorted[at + 1] ?? '';
      const key = keyBetween(a, b);
      expect(a < key && key < b).toBe(true);
      keys.push(key);
    }
  });

  it('returns n strictly increasing keys inside the bounds', () => {
    const [a, b] = keysBetween(null, null, 2) as [string, string];
    const keys = keysBetween(a, b, 25);
    expect(keys).toHaveLength(25);
    expect([a, ...keys, b].every((k, i, all) => i === 0 || (all[i - 1] ?? '') < k)).toBe(true);
    expect(keysBetween(a, null, 0)).toEqual([]);
  });

  it('keeps keys short', () => {
    let last: string | null = null;
    let longest = 0;
    for (let i = 0; i < 10_000; i++) {
      last = keyBetween(last, null);
      longest = Math.max(longest, last.length);
    }
    expect(longest).toBeLessThanOrEqual(6);
    expect(Math.max(...keysBetween(null, null, 500).map((k) => k.length))).toBeLessThanOrEqual(3);
  });

  it('refuses equal or reversed bounds', () => {
    expect(() => keyBetween('a1', 'a1')).toThrow();
    expect(() => keyBetween('a2', 'a1')).toThrow();
    expect(() => keysBetween('a2', 'a1', 3)).toThrow();
  });

  it('refuses malformed keys', () => {
    expect(() => keyBetween('', null)).toThrow();
    expect(() => keyBetween('a10', null)).toThrow();
    expect(() => keyBetween('!', null)).toThrow();
  });

  it('compares by code unit, never by locale', () => {
    expect(compareKeys('Z', 'a')).toBeLessThan(0);
    expect(compareKeys('a', 'a')).toBe(0);
    expect(compareKeys('b', 'a')).toBeGreaterThan(0);
  });
});
