import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { enumById, fkColumns, schemaCount, tableContextOf } from './table-keys';

const table = (id: string, columns: string[], schema?: string) => ({
  id,
  type: 'db-table',
  title: id,
  ...(schema === undefined ? {} : { schema }),
  columns: columns.map((c) => ({ id: c, name: c, type: 'int' })),
});

function deck(edges: SododeckFile['edges'], extra: Partial<SododeckFile> = {}): SododeckFile {
  return {
    ...emptySododeckFile(),
    nodes: [
      table('a', ['a1', 'a2']),
      table('b', ['b1', 'b2', 'b3']),
      { id: 's', type: 'service', title: 'S', columns: [{ id: 's1', name: 's1', type: 'int' }] },
    ],
    edges,
    ...extra,
  };
}

const fk = (file: SododeckFile, id: string) => [...(fkColumns(file).get(id) ?? [])].sort();

describe('fkColumns (041 R3)', () => {
  it('marks the n side of 1-n and n-1, and the from side otherwise', () => {
    const file = deck([
      { id: 'r1', from: 'a', to: 'b', fromColumns: ['a1'], toColumns: ['b1'], cardinality: '1-n' },
      { id: 'r2', from: 'b', to: 'a', fromColumns: ['b2'], toColumns: ['a1'], cardinality: 'n-1' },
      { id: 'r3', from: 'a', to: 'b', fromColumns: ['a2'], toColumns: ['b3'], cardinality: '1-1' },
    ]);
    expect(fk(file, 'b')).toEqual(['b1', 'b2']);
    expect(fk(file, 'a')).toEqual(['a2']);
  });

  it('uses the from side for n-n and for no cardinality, and keeps composite ends', () => {
    const file = deck([
      { id: 'r1', from: 'b', to: 'a', fromColumns: ['b1', 'b2'], toColumns: ['a1', 'a2'] },
      { id: 'r2', from: 'a', to: 'b', fromColumns: ['a2'], toColumns: ['b3'], cardinality: 'n-n' },
    ]);
    expect(fk(file, 'b')).toEqual(['b1', 'b2']);
    expect(fk(file, 'a')).toEqual(['a2']);
  });

  it('handles a self-reference and ignores ends on cards that are not tables', () => {
    const file = deck([
      { id: 'r1', from: 'a', to: 'a', fromColumns: ['a1'], toColumns: ['a2'], cardinality: '1-n' },
      { id: 'r2', from: 's', to: 'b', fromColumns: ['s1'], toColumns: ['b1'] },
      { id: 'r3', from: 'a', to: 'b' },
    ]);
    expect(fk(file, 'a')).toEqual(['a2']);
    expect(fkColumns(file).has('s')).toBe(false);
    expect(fkColumns(file).has('b')).toBe(false);
  });

  it('returns the same map for the same edges and nodes', () => {
    const file = deck([{ id: 'r', from: 'a', to: 'b', fromColumns: ['a1'], toColumns: ['b1'] }]);
    expect(fkColumns({ ...file })).toBe(fkColumns(file));
    expect(fkColumns({ ...file, edges: [...file.edges] })).not.toBe(fkColumns(file));
  });
});

describe('schemaCount and enumById (041 R12)', () => {
  it('counts distinct non-empty table schemas', () => {
    const base = deck([]);
    expect(schemaCount(base)).toBe(0);
    expect(schemaCount({ ...base, nodes: [table('a', [], 'public'), table('b', [])] })).toBe(1);
    expect(
      schemaCount({
        ...base,
        nodes: [table('a', [], 'public'), table('b', [], 'auth'), table('c', [], 'public')],
      }),
    ).toBe(2);
  });

  it('indexes enums by id, cached by the enums list', () => {
    const file = deck([], { enums: [{ id: 'e', name: 'mood', values: [] }] });
    expect(enumById(file).get('e')?.name).toBe('mood');
    expect(enumById({ ...file })).toBe(enumById(file));
  });

  it('keeps one context object while its inputs are unchanged', () => {
    const file = deck([]);
    const first = tableContextOf(file);
    const renamed: SododeckFile = { ...file, name: 'renamed' };
    expect(tableContextOf(renamed)).toBe(first);
    expect(tableContextOf({ ...file, tableDisplay: { hideTypes: true } })).not.toBe(first);
    expect(first.display.detail).toBe('auto');
    expect(first.showSchema).toBe(false);
  });
});
