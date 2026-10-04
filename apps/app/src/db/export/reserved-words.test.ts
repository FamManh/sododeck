import { describe, expect, it } from 'vitest';

import { isReserved, RESERVED_WORDS } from './reserved-words';

describe('RESERVED_WORDS', () => {
  it('holds the common reserved words', () => {
    for (const word of [
      'order',
      'user',
      'group',
      'select',
      'table',
      'key',
      'index',
      'check',
      'default',
      'references',
    ]) {
      expect(RESERVED_WORDS).toContain(word);
    }
    expect(isReserved('ORDER')).toBe(true);
    expect(isReserved('customers')).toBe(false);
  });

  it('is lower case, sorted and unique', () => {
    expect(RESERVED_WORDS.every((w) => w === w.toLowerCase())).toBe(true);
    expect([...RESERVED_WORDS].sort()).toEqual(RESERVED_WORDS);
    expect(new Set(RESERVED_WORDS).size).toBe(RESERVED_WORDS.length);
  });
});
