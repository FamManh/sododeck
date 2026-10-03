import { describe, expect, it } from 'vitest';

import { sameTag, tagKey } from '../src';

describe('tagKey (033, ADR 0022)', () => {
  it.each([
    ['PCI', 'pci'],
    ['  pci  ', 'pci'],
    ['Pci   DSS', 'pci dss'],
    ['a\tb', 'a b'],
    ['Crème', 'crème'],
    ['É', 'é'],
    ['x', 'x'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, key) => {
    expect(tagKey(input)).toBe(key);
  });

  it('does not fold accents', () => {
    expect(tagKey('cafe')).not.toBe(tagKey('café'));
  });
});

describe('sameTag', () => {
  it('is true for spellings with the same key and false otherwise', () => {
    expect(sameTag('PCI', 'pci')).toBe(true);
    expect(sameTag(' Pci  dss', 'PCI DSS ')).toBe(true);
    expect(sameTag('pci', 'pci-dss')).toBe(false);
    expect(sameTag('', '  ')).toBe(true);
  });
});
