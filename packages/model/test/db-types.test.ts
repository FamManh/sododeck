import { describe, expect, it } from 'vitest';

import {
  COMMON_TYPES,
  commonTypeOf,
  DIALECT_HINTS,
  DIALECT_TYPES,
  idTypeOf,
  INDEX_METHODS,
  sameColumnType,
  typeEntry,
} from '../src';

const baseOf = (spelling: string) => spelling.replace(/\(.*\)$/, '');

describe('COMMON_TYPES', () => {
  it('lists the 17 canonical names', () => {
    expect(COMMON_TYPES.map((t) => t.canonical)).toEqual([
      'int',
      'smallint',
      'bigint',
      'decimal',
      'real',
      'double',
      'char',
      'varchar',
      'text',
      'boolean',
      'uuid',
      'date',
      'time',
      'timestamp',
      'datetime',
      'json',
      'blob',
    ]);
  });
});

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
    expect(DIALECT_HINTS.generic).toBe('Common types only; SQL export asks which dialect');
    expect(DIALECT_HINTS.postgres).toBe('uuid, jsonb, timestamptz, enums, arrays');
    expect(DIALECT_HINTS.mysql).toBe('char(36) ids, json, datetime, ENUM per column');
    expect(DIALECT_HINTS.sqlite).toBe('Type affinity: integer, text, real, blob');
  });
});

describe('commonTypeOf', () => {
  it('resolves the dialect spelling first', () => {
    expect(commonTypeOf('timestamp', 'postgres')?.canonical).toBe('datetime');
    expect(commonTypeOf('timestamptz', 'postgres')?.canonical).toBe('timestamp');
  });

  it('then falls back to canonical names and aliases', () => {
    expect(commonTypeOf('INTEGER', 'postgres')?.canonical).toBe('int');
    expect(commonTypeOf('int', 'postgres')?.canonical).toBe('int');
    expect(commonTypeOf('character varying', 'mysql')?.canonical).toBe('varchar');
    expect(commonTypeOf('timestamp', 'generic')?.canonical).toBe('timestamp');
  });

  it('returns undefined for unknown types', () => {
    expect(commonTypeOf('citext', 'postgres')).toBeUndefined();
  });
});

describe('sameColumnType', () => {
  it('treats int and integer as equal on Postgres and Generic', () => {
    expect(sameColumnType({ type: 'int' }, { type: 'integer' }, 'postgres')).toBe(true);
    expect(sameColumnType({ type: 'int' }, { type: 'integer' }, 'generic')).toBe(true);
  });

  it('keeps timestamptz and timestamp apart on Postgres', () => {
    expect(sameColumnType({ type: 'timestamptz' }, { type: 'timestamp' }, 'postgres')).toBe(false);
  });

  it('compares sizes', () => {
    expect(sameColumnType({ type: 'varchar(80)' }, { type: 'varchar(100)' }, 'postgres')).toBe(
      false,
    );
    expect(sameColumnType({ type: 'varchar', size: '80' }, { type: 'varchar(80)' }, 'mysql')).toBe(
      true,
    );
    expect(sameColumnType({ type: 'numeric(10, 2)' }, { type: 'numeric(10,2)' }, 'postgres')).toBe(
      true,
    );
  });

  it('compares enum columns by enumRef only', () => {
    expect(
      sameColumnType({ type: 'text', enumRef: 'e1' }, { type: 'x', enumRef: 'e1' }, 'postgres'),
    ).toBe(true);
    expect(
      sameColumnType({ type: 'text', enumRef: 'e1' }, { type: 'text', enumRef: 'e2' }, 'postgres'),
    ).toBe(false);
    expect(sameColumnType({ type: 'text', enumRef: 'e1' }, { type: 'text' }, 'postgres')).toBe(
      false,
    );
  });

  it('compares unknown types by name', () => {
    expect(sameColumnType({ type: 'CITEXT' }, { type: 'citext' }, 'postgres')).toBe(true);
    expect(sameColumnType({ type: 'citext' }, { type: 'ltree' }, 'postgres')).toBe(false);
  });
});

describe('idTypeOf', () => {
  it('gives the id type per dialect', () => {
    expect(idTypeOf('postgres')).toBe('uuid');
    expect(idTypeOf('mysql')).toBe('char(36)');
    expect(idTypeOf('sqlite')).toBe('text');
    expect(idTypeOf('generic')).toBe('uuid');
  });
});
