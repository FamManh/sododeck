import { describe, expect, it } from 'vitest';

import { addTag, normalizeTag, removeTag } from '../src/lib/tags';

describe('normalizeTag', () => {
  it('trims and lower-cases', () => {
    expect(normalizeTag(' PII ')).toBe('pii');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeTag('Critical   Path')).toBe('critical path');
  });

  it('returns null for empty or blank input', () => {
    expect(normalizeTag('')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
  });
});

describe('addTag', () => {
  it('adds "PII" once, then ignores an empty Enter', () => {
    expect(addTag(addTag([], 'PII'), '')).toEqual(['pii']);
  });

  it('ignores duplicates regardless of case and returns the same array', () => {
    const tags = ['pii'];
    expect(addTag(tags, 'Pii')).toBe(tags);
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
