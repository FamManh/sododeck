import { describe, expect, it } from 'vitest';

import { readableText } from '../src/lib/contrast';

describe('readableText (020, R6)', () => {
  it('picks dark text for a light custom fill and is readable', () => {
    const result = readableText('#e8d5b7');
    expect(result.text).toBe('dark');
    expect(result.readable).toBe(true);
  });

  it('picks light text for a dark custom fill and is readable', () => {
    const result = readableText('#1f2a44');
    expect(result.text).toBe('light');
    expect(result.readable).toBe(true);
  });

  it('switches near luminance 0.204', () => {
    // #7c7c7c (lum ≈ 0.2016) and #7d7d7d (lum ≈ 0.2051) sit just either side of the switch point.
    expect(readableText('#7c7c7c').text).toBe('light');
    expect(readableText('#7d7d7d').text).toBe('dark');
  });

  it('is not readable for a mid-grey that fails both text colours', () => {
    expect(readableText('#7c7c7c').readable).toBe(false);
  });

  it('is not readable for both ends of the unreadable band (≈ 0.183–0.227 luminance)', () => {
    expect(readableText('#777777').readable).toBe(false);
    expect(readableText('#828282').readable).toBe(false);
  });
});
