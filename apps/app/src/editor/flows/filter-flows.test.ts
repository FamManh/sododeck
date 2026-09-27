import { describe, expect, it } from 'vitest';

import { branchedDeck } from '../../test/flow-fixtures';
import { filterFlows, findRanges } from './filter-flows';

describe('filterFlows', () => {
  it('matches everything for an empty query', () => {
    const result = filterFlows(branchedDeck, '  ');
    expect(result.count).toBe(4);
    expect(result.total).toBe(4);
  });

  it('matches flow titles ignoring case, with ranges', () => {
    const result = filterFlows(branchedDeck, 'PLACE');
    expect([...result.matches.keys()]).toEqual(['place']);
    expect(result.matches.get('place')?.title).toEqual([[0, 5]]);
    expect(result).toMatchObject({ count: 1, total: 4 });
  });

  it('matches step titles, connection labels, step and branch conditions', () => {
    expect([...filterFlows(branchedDeck, 'refund').matches.keys()]).toEqual(['loose']);
    expect(filterFlows(branchedDeck, 'https').count).toBe(2);
    expect(filterFlows(branchedDeck, 'token').matches.get('place')?.fields).toEqual([
      { kind: 'step condition', text: 'token.valid', ranges: [[0, 5]] },
    ]);
    expect(filterFlows(branchedDeck, 'declined').matches.get('pay')?.fields[0]?.kind).toBe(
      'branch condition',
    );
    expect(filterFlows(branchedDeck, 'zzz').count).toBe(0);
  });

  it('finds every occurrence', () => {
    expect(findRanges('abcABC', 'bc')).toEqual([
      [1, 3],
      [4, 6],
    ]);
  });
});
