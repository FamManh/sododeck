import { describe, expect, it } from 'vitest';

import { collapseSkipped, excerpt, plural, SKIP_REASON_TEXT, skipText } from './report-text';
import type { SkippedEntry } from './types';

describe('report texts', () => {
  it('has a reason text for every skip kind', () => {
    for (const text of Object.values(SKIP_REASON_TEXT)) expect(text.length).toBeGreaterThan(0);
    expect(SKIP_REASON_TEXT.view).toBe('views are not modelled');
  });

  it('excerpts the first line, spaces collapsed, at most 60 characters', () => {
    expect(excerpt('  CREATE VIEW  order_totals AS\n SELECT 1')).toBe(
      'CREATE VIEW order_totals AS',
    );
    const long = excerpt(`INSERT INTO t VALUES (${'1, '.repeat(40)}1)`);
    expect(long).toHaveLength(60);
    expect(long.endsWith('…')).toBe(true);
  });

  it('uses an entry detail over its reason', () => {
    expect(skipText({ reason: 'dangling-fk' })).toBe(SKIP_REASON_TEXT['dangling-fk']);
    expect(skipText({ reason: 'dangling-fk', detail: 'references accounts' })).toBe(
      'references accounts',
    );
  });

  it('collapses more than 20 entries of one reason', () => {
    const entries: SkippedEntry[] = [
      { line: 1, excerpt: 'SET a', reason: 'session' },
      ...Array.from({ length: 25 }, (_, i) => ({
        line: i + 2,
        excerpt: 'INSERT',
        reason: 'data' as const,
      })),
    ];
    const rows = collapseSkipped(entries);
    expect(rows).toHaveLength(22);
    expect(rows.at(-1)).toEqual({
      kind: 'more',
      reason: 'data',
      count: 5,
      text: 'and 5 more data statements',
    });
  });

  it('pluralises', () => {
    expect(plural(1, 'table')).toBe('1 table');
    expect(plural(3, 'table')).toBe('3 tables');
  });
});
