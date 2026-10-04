import { describe, expect, it } from 'vitest';

import { lucide, searchIcons } from '../../src/icon-sets';
import { solidTestSet } from '../fixtures/solid-test-set';

const names = (query: string) => searchIcons(query).map((i) => i.name);

describe('searchIcons', () => {
  it('returns nothing for an empty query', () => {
    expect(searchIcons('')).toEqual([]);
    expect(searchIcons('   ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(names('SEARCH')).toEqual(names('search'));
    expect(names('search').length).toBeGreaterThan(0);
  });

  it('ranks an exact name first, then prefixes', () => {
    const result = names('search');
    expect(result[0]).toBe('search');
  });

  it('ranks Database first for "db" and still finds Server and Hard drive', () => {
    const result = names('db');
    expect(result[0]).toBe('database');
    expect(result).toContain('server');
    expect(result).toContain('hard-drive');
  });

  it('ranks name or label prefix before keyword prefix before substring', () => {
    const sets = [solidTestSet];
    // "squ" prefix of name; "box" keyword exact-prefix of square; "oint" substring of "point".
    expect(searchIcons('squ', sets).map((i) => i.name)).toEqual(['square']);
    expect(searchIcons('box', sets).map((i) => i.name)).toEqual(['square']);
    expect(searchIcons('oint', sets).map((i) => i.name)).toEqual(['dot']);
  });

  it('keeps catalog order for ties', () => {
    expect(searchIcons('r', [solidTestSet]).map((i) => i.name)).toEqual(['square', 'triangle']);
  });

  it('filters by set', () => {
    const both = [lucide, solidTestSet];
    expect(searchIcons('dot', both, 'solid-test').map((i) => i.set)).toEqual(['solid-test']);
    expect(searchIcons('dot', both, 'lucide').every((i) => i.set === 'lucide')).toBe(true);
  });

  it('answers 1,000 queries in under 100 ms', () => {
    const words = ['db', 'server', 'cloud', 'user', 'a', 'arrow', 'file', 'x', 'net', 'zap'];
    const start = performance.now();
    for (let i = 0; i < 1000; i += 1) searchIcons(words[i % words.length] ?? 'a');
    expect(performance.now() - start).toBeLessThan(100);
  });
});
