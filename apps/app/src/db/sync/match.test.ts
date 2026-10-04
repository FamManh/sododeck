import { describe, expect, it } from 'vitest';

import {
  matchChecks,
  matchColumns,
  matchEnums,
  matchIndexes,
  matchRelationships,
  matchTables,
  matchValues,
  type TableShape,
} from './match';

const table = (name: string, columns: string[] = [], schema?: string): TableShape => ({
  name,
  columns,
  ...(schema === undefined ? {} : { schema }),
});
const NONE = new Set<string>();

describe('matchTables (R5.1)', () => {
  it('matches by schema and name, then ignoring case', () => {
    const result = matchTables(
      [table('orders', ['id']), table('Users', ['id']), table('a', ['x'], 'billing')],
      [table('USERS', ['id']), table('orders', ['id']), table('a', ['x'], 'billing')],
      NONE,
    );
    expect(result.pairs).toEqual([
      { existing: 1, parsed: 0, how: 'case' },
      { existing: 0, parsed: 1, how: 'exact' },
      { existing: 2, parsed: 2, how: 'exact' },
    ]);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('does not match the same name in another schema', () => {
    const result = matchTables([table('a', ['x'], 'one')], [table('a', ['x'], 'two')], NONE);
    // One unmatched on each side with the same columns: a rename, not an exact match.
    expect(result.pairs).toEqual([{ existing: 0, parsed: 0, how: 'rename' }]);
  });

  it('restores a table removed earlier in the session by its name', () => {
    const result = matchTables(
      [table('customers', ['id'])],
      [table('customers', ['id']), table('Shipments', ['id'])],
      new Set(['shipments']),
    );
    expect(result.restored).toEqual([{ parsed: 1, key: 'shipments' }]);
    expect(result.added).toEqual([]);
  });

  it('treats one table unmatched on each side with shared columns as a rename', () => {
    const result = matchTables(
      [table('customers', ['id', 'email', 'name', 'created'])],
      [table('clients', ['id', 'email', 'name', 'created', 'phone'])],
      NONE,
    );
    expect(result.pairs).toEqual([{ existing: 0, parsed: 0, how: 'rename' }]);
  });

  it('treats two single-column tables as a rename and unrelated tables as remove + add', () => {
    expect(matchTables([table('a', ['id'])], [table('b', ['code'])], NONE).pairs).toEqual([
      { existing: 0, parsed: 0, how: 'rename' },
    ]);
    const apart = matchTables([table('a', ['id', 'x', 'y'])], [table('b', ['p', 'q', 'r'])], NONE);
    expect(apart.pairs).toEqual([]);
    expect(apart.added).toEqual([0]);
    expect(apart.removed).toEqual([0]);
  });

  it('does not guess among several unmatched tables, and says they were replaced', () => {
    const result = matchTables(
      [table('a', ['id', 'x']), table('b', ['id', 'y'])],
      [table('c', ['id', 'x']), table('d', ['id', 'y'])],
      NONE,
    );
    expect(result.pairs).toEqual([]);
    expect(result.added).toEqual([0, 1]);
    expect(result.removed).toEqual([0, 1]);
    expect(result.replaced).toEqual({ removed: [0, 1], added: [0, 1] });
  });

  it('adds and removes plain differences without a replaced note', () => {
    const result = matchTables([table('a', ['id'])], [table('a', ['id']), table('b', [])], NONE);
    expect(result.added).toEqual([1]);
    expect(result.replaced).toBeNull();
  });
});

describe('matchColumns (R5.2)', () => {
  const col = (name: string, type = 'int') => ({ name, type });

  it('matches by name, then ignoring case, keeping the text order', () => {
    const result = matchColumns(
      [col('id'), col('Email', 'text')],
      [col('email', 'text'), col('id'), col('extra')],
    );
    expect(result.pairs.map((p) => [p.existing, p.parsed, p.how])).toEqual([
      [1, 0, 'case'],
      [0, 1, 'exact'],
    ]);
    expect(result.added).toEqual([2]);
  });

  it('pairs a single unmatched old and new column as a rename', () => {
    const result = matchColumns(
      [col('id'), col('total', 'int')],
      [col('id'), col('amount', 'text')],
    );
    expect(result.pairs).toContainEqual({ existing: 1, parsed: 1, how: 'rename' });
  });

  it('pairs several unmatched columns by position only when the types agree', () => {
    const same = matchColumns(
      [col('a', 'int'), col('b', 'text')],
      [col('c', 'int'), col('d', 'text')],
    );
    expect(same.pairs.map((p) => p.how)).toEqual(['rename', 'rename']);
    const differ = matchColumns(
      [col('a', 'int'), col('b', 'text')],
      [col('c', 'text'), col('d', 'int')],
    );
    expect(differ.pairs).toEqual([]);
    expect(differ.added).toEqual([0, 1]);
    expect(differ.removed).toEqual([0, 1]);
  });
});

describe('matchEnums and matchValues (R5.3)', () => {
  it('matches enums by name and a lone enum by value overlap', () => {
    const byName = matchEnums(
      [{ name: 'status', values: ['a', 'b'] }],
      [{ name: 'Status', values: ['a', 'b'] }],
    );
    expect(byName.pairs[0]?.how).toBe('case');
    const renamed = matchEnums(
      [{ name: 'status', values: ['a', 'b'] }],
      [{ name: 'state', values: ['a', 'b', 'c'] }],
    );
    expect(renamed.pairs[0]?.how).toBe('rename');
    const apart = matchEnums(
      [{ name: 'status', values: ['a', 'b'] }],
      [{ name: 'state', values: ['x', 'y'] }],
    );
    expect(apart.pairs).toEqual([]);
  });

  it('matches values by name and pairs the rest by position', () => {
    const result = matchValues(['a', 'b', 'c'], ['a', 'B', 'z']);
    expect(result.pairs.map((p) => [p.existing, p.parsed])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(result.pairs.map((p) => p.how)).toEqual(['exact', 'case', 'rename']);
  });
});

describe('matchIndexes and matchChecks (R5.4)', () => {
  it('matches named indexes by name and unnamed ones by their parts', () => {
    const result = matchIndexes(
      [{ name: 'by_email', signature: 'email' }, { signature: 'a,b' }, { signature: 'zzz' }],
      [{ signature: 'a,b' }, { name: 'by_email', signature: 'email,name' }],
    );
    expect(result.pairs.map((p) => [p.existing, p.parsed])).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(result.removed).toEqual([2]);
  });

  it('pairs an index whose name changed but whose parts did not', () => {
    const result = matchIndexes(
      [{ name: 'old', signature: 'a' }],
      [{ name: 'new', signature: 'a' }],
    );
    expect(result.pairs).toEqual([{ existing: 0, parsed: 0, how: 'rename' }]);
  });

  it('matches checks by name, then by expression', () => {
    const result = matchChecks(
      [{ name: 'pos', expr: 'a > 0' }, { expr: 'b  >  0' }],
      [{ expr: 'b > 0' }, { name: 'pos', expr: 'a > 1' }],
    );
    expect(result.pairs.map((p) => [p.existing, p.parsed])).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});

describe('matchRelationships (R5.5)', () => {
  it('matches by the ordered ends, then by name', () => {
    const result = matchRelationships(
      [
        { signature: 't1.c1>t2.c2' },
        { name: 'fk_x', signature: 't3.c>t4.c' },
        { signature: 'gone' },
      ],
      [{ name: 'fk_x', signature: 't3.c>t5.c' }, { signature: 't1.c1>t2.c2' }],
    );
    expect(result.pairs.map((p) => [p.existing, p.parsed, p.how])).toEqual([
      [1, 0, 'rename'],
      [0, 1, 'exact'],
    ]);
    expect(result.removed).toEqual([2]);
  });
});
