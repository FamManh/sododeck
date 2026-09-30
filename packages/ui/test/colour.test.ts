import { describe, expect, it } from 'vitest';

import { hexToHsv, hsvToHex, normalizeHex } from '../src/lib/colour';

describe('normalizeHex', () => {
  it('accepts a bare 6-digit hex without a leading #', () => {
    expect(normalizeHex('7A3CFF')).toBe('#7a3cff');
  });

  it('accepts a 6-digit hex with a leading # and lower-cases it', () => {
    expect(normalizeHex('#7a3cff')).toBe('#7a3cff');
  });

  it('rejects 3-digit shorthand', () => {
    expect(normalizeHex('#abc')).toBeNull();
  });

  it('rejects non-hex text', () => {
    expect(normalizeHex('zzzzzz')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(normalizeHex('')).toBeNull();
  });
});

describe('hexToHsv / hsvToHex round trip', () => {
  it.each([
    ['red', '#ff0000'],
    ['green', '#00ff00'],
    ['blue', '#0000ff'],
    ['grey', '#808080'],
    ['black', '#000000'],
    ['white', '#ffffff'],
    ['a custom violet', '#7a3cff'],
  ])('round-trips %s', (_name, hex) => {
    expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
});
