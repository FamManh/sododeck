import { describe, expect, it } from 'vitest';

import { COMMON_TYPES } from './export/common-types';
import { DIALECT_HINTS, DIALECT_TYPES, INDEX_METHODS, typeEntry } from './dialect-types';

const baseOf = (spelling: string) => spelling.replace(/\(.*\)$/, '');

describe('DIALECT_TYPES', () => {
  it.each(['postgres', 'mysql', 'sqlite'] as const)(
    'lists every common type spelling for %s',
    (dialect) => {
      const names = new Set(DIALECT_TYPES[dialect].map((t) => t.name));
      for (const common of COMMON_TYPES) {
        expect(names.has(baseOf(common[dialect])), `${common.canonical} → ${common[dialect]}`).toBe(
          true,
        );
      }
    },
  );

  it('lists the 17 canonical names for Generic', () => {
    expect(DIALECT_TYPES.generic.map((t) => t.name)).toEqual(COMMON_TYPES.map((t) => t.canonical));
    expect(DIALECT_TYPES.generic).toHaveLength(17);
  });

  it('lists only the five affinities for SQLite', () => {
    expect(DIALECT_TYPES.sqlite.map((t) => t.name).sort()).toEqual([
      'blob',
      'integer',
      'numeric',
      'real',
      'text',
    ]);
  });

  it('has no duplicate names within a dialect', () => {
    for (const list of Object.values(DIALECT_TYPES)) {
      const names = list.map((t) => t.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('typeEntry', () => {
  it('resolves case-insensitively and by alias', () => {
    expect(typeEntry('postgres', 'TIMESTAMPTZ')?.name).toBe('timestamptz');
    expect(typeEntry('postgres', 'int4')?.name).toBe('integer');
    expect(typeEntry('postgres', ' Character  Varying ')?.name).toBe('varchar');
  });

  it('ignores a size written inside the type', () => {
    expect(typeEntry('mysql', 'varchar(80)')?.name).toBe('varchar');
  });

  it('returns undefined outside the dialect list', () => {
    expect(typeEntry('mysql', 'citext')).toBeUndefined();
    expect(typeEntry('sqlite', 'uuid')?.name).toBe('text');
  });

  it('reports the size kind', () => {
    expect(typeEntry('postgres', 'varchar')?.size).toBe('length');
    expect(typeEntry('postgres', 'numeric')?.size).toBe('precision');
    expect(typeEntry('postgres', 'integer')?.size).toBe('none');
  });
});

describe('INDEX_METHODS and DIALECT_HINTS', () => {
  it('has no index method for SQLite', () => {
    expect(INDEX_METHODS.sqlite).toEqual([]);
    expect(INDEX_METHODS.postgres).toEqual(['btree', 'hash', 'gist', 'gin', 'spgist', 'brin']);
    expect(INDEX_METHODS.mysql).toEqual(['btree', 'hash']);
  });

  it('has a hint for every dialect', () => {
    for (const dialect of ['generic', 'postgres', 'mysql', 'sqlite'] as const) {
      expect(DIALECT_HINTS[dialect].length).toBeGreaterThan(0);
    }
  });
});
