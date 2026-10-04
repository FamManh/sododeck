import type { Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import type { RawTable } from '../import/types';
import { checkExpressions, normaliseDeckTable, normaliseRawTable, schemaName } from './normalise';

const table = (extra: Partial<Node>): Node => ({
  id: 't',
  type: 'db-table',
  title: ' orders ',
  columns: [
    { id: 'c1', name: 'id', type: 'int', pk: true },
    { id: 'c2', name: 'qty', type: 'int', check: 'qty > 0' },
  ],
  ...extra,
});

describe('schemaName', () => {
  it('reads public and blank as no schema', () => {
    expect(schemaName(undefined)).toBeUndefined();
    expect(schemaName('  ')).toBeUndefined();
    expect(schemaName('Public')).toBeUndefined();
    expect(schemaName('billing')).toBe('billing');
  });
});

describe('normaliseDeckTable', () => {
  it('moves column checks to table checks and keeps their origin', () => {
    const normal = normaliseDeckTable(
      table({ checks: [{ id: 'k1', name: 'pos', expr: 'id > 0' }] }),
    );
    expect(normal.checks).toEqual([
      { name: 'pos', expr: 'id > 0', origin: { kind: 'check', id: 'k1' } },
      { expr: 'qty > 0', origin: { kind: 'column', id: 'c2' } },
    ]);
    expect(checkExpressions(table({}))).toEqual(['qty > 0']);
  });

  it('trims the title and the note', () => {
    const normal = normaliseDeckTable(table({ description: '  hi  ' }));
    expect(normal.title).toBe('orders');
    expect(normal.note).toBe('hi');
    expect(normaliseDeckTable(table({ description: '   ' })).note).toBeUndefined();
  });

  it('leaves out an index method the writer cannot hold, and keeps one it can', () => {
    const normal = normaliseDeckTable(
      table({
        indexes: [
          { id: 'i1', columns: ['c1'], method: 'gin' },
          { id: 'i2', columns: ['c2'], method: 'BTree' },
        ],
      }),
    );
    expect(normal.indexes[0]).not.toHaveProperty('method');
    expect(normal.indexes[1]?.method).toBe('btree');
  });
});

describe('normaliseRawTable', () => {
  it('moves a column check to the table checks and trims notes', () => {
    const raw: RawTable = {
      name: 'orders',
      note: ' n ',
      line: 1,
      columns: [{ name: 'qty', type: 'int', check: 'qty > 0', note: ' x ', line: 2 }],
      indexes: [{ parts: [{ column: 'qty' }], note: ' ', line: 3 }],
      checks: [{ expr: 'a > 0', line: 4 }],
    };
    const normal = normaliseRawTable(raw);
    expect(normal.note).toBe('n');
    expect(normal.columns[0]).not.toHaveProperty('check');
    expect(normal.columns[0]?.note).toBe('x');
    expect(normal.indexes[0]).not.toHaveProperty('note');
    expect(normal.checks.map((c) => c.expr)).toEqual(['a > 0', 'qty > 0']);
  });
});
