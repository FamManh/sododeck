import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer, truncate } from './text-measure';

describe('text measurement', () => {
  const measure = fixedWidthMeasurer();
  it('estimates grapheme width', () => {
    expect(measure('abc', '10px Geist')).toBe(18);
    expect(measure('👩‍💻', '10px Geist')).toBe(6);
  });
  it('truncates without splitting emoji', () => {
    expect(truncate('abc', '10px Geist', 30, measure)).toBe('abc');
    expect(truncate('abcd', '10px Geist', 18, measure)).toBe('ab…');
    expect(truncate('👩‍💻abc', '10px Geist', 12, measure)).toBe('👩‍💻…');
    expect(truncate('', '10px Geist', 0, measure)).toBe('');
  });
});
