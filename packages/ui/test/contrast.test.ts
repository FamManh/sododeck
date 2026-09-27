import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../src/lib/contrast';

describe('contrastRatio', () => {
  it('is 21 for white on black', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('matches the DESIGN.md figure for Deck Orange on white', () => {
    expect(contrastRatio('#f2661c', '#ffffff')).toBeCloseTo(3.14, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1c1c1a', '#f4f4f1')).toBe(contrastRatio('#f4f4f1', '#1c1c1a'));
  });

  it('accepts 3-digit hex', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('throws on invalid input', () => {
    expect(() => contrastRatio('orange', '#fff')).toThrow();
    expect(() => contrastRatio('#12345', '#fff')).toThrow();
  });
});
