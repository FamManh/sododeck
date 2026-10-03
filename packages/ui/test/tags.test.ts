import { describe, expect, it } from 'vitest';

import { addTag, normalizeTag, removeTag, tagKey } from '../src/lib/tags';

describe('tagKey', () => {
  it('trims, single-spaces and lower-cases, and keeps accents', () => {
    expect(tagKey('  Pci   DSS ')).toBe('pci dss');
    expect(tagKey('Crème')).toBe('crème');
    expect(tagKey('   ')).toBe('');
  });
});

describe('normalizeTag', () => {
  it('trims and keeps the case typed (033)', () => {
    expect(normalizeTag(' PII ')).toBe('PII');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeTag('Critical   Path')).toBe('Critical Path');
  });

  it('returns null for empty or blank input', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
  });
});

describe('addTag', () => {
  it('adds "PII" as typed once, then ignores an empty Enter', () => {
    expect(addTag(addTag([], 'PII'), '')).toEqual(['PII']);
  });

  it('ignores a tag with the same key, keeps the first spelling and returns the same array', () => {
    const tags = ['PII'];
    expect(addTag(tags, 'pii')).toBe(tags);
    expect(addTag(tags, '  Pii ')).toBe(tags);
    expect(addTag(['Critical Path'], 'critical   path')).toEqual(['Critical Path']);
  });

  it('appends without mutating', () => {
    const tags = ['critical'];
    expect(addTag(tags, 'pii')).toEqual(['critical', 'pii']);
    expect(tags).toEqual(['critical']);
  });
});

describe('removeTag', () => {
  it('removes one tag and keeps order', () => {
    expect(removeTag(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('matches by key, so "pii" removes "PII"', () => {
    expect(removeTag(['a', 'PII', 'c'], 'pii')).toEqual(['a', 'c']);
  });

  it('returns the same array when the tag is absent', () => {
    const tags = ['a'];
    expect(removeTag(tags, 'z')).toBe(tags);
  });
});

describe('addTag with a limit', () => {
  it('adds nothing once the limit is reached', () => {
    const two = ['a', 'b'] as const;
    expect(addTag(two, 'c', 2)).toBe(two);
    expect(addTag(two, 'c', 3)).toEqual(['a', 'b', 'c']);
  });
});
