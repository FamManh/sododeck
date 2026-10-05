import { COMMON_TYPES } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { convertType, writtenType } from './convert-types';
import type { SqlDialect } from './types';

const DIALECTS: SqlDialect[] = ['postgres', 'mysql', 'sqlite'];

describe('convertType (research R10)', () => {
  it('maps every common type across every dialect pair', () => {
    const base = (spelling: string) => spelling.replace(/\(.*\)$/, '');
    for (const entry of COMMON_TYPES) {
      for (const from of DIALECTS) {
        // A spelling two common types share (`text`, `integer` in SQLite) maps to the first one.
        const unique = COMMON_TYPES.filter((e) => base(e[from]) === base(entry[from])).length === 1;
        for (const to of DIALECTS) {
          const result = convertType(base(entry[from]), undefined, from, to);
          expect(result.mapped).toBe(true);
          if (unique && !entry[from].includes('('))
            expect(writtenType(result.type, result.size)).toBe(entry[to]);
        }
      }
    }
  });

  it('converts MySQL types to Postgres keeping sizes where Postgres keeps one', () => {
    expect(convertType('datetime', undefined, 'mysql', 'postgres')).toEqual({
      type: 'timestamp',
      mapped: true,
    });
    expect(convertType('varchar', '255', 'mysql', 'postgres')).toEqual({
      type: 'varchar',
      size: '255',
      mapped: true,
    });
    expect(convertType('decimal', '10,2', 'mysql', 'postgres')).toEqual({
      type: 'numeric',
      size: '10,2',
      mapped: true,
    });
    expect(convertType('tinyint', undefined, 'mysql', 'postgres')).toEqual({
      type: 'smallint',
      mapped: true,
    });
    expect(convertType('timestamp', undefined, 'mysql', 'postgres')).toEqual({
      type: 'timestamptz',
      mapped: true,
    });
  });

  it('reads aliases and drops the size where the target keeps none', () => {
    expect(convertType('character varying', '20', 'postgres', 'sqlite')).toEqual({
      type: 'text',
      mapped: true,
    });
    expect(convertType('uuid', undefined, 'postgres', 'mysql')).toEqual({
      type: 'char',
      size: '36',
      mapped: true,
    });
    expect(convertType('timestamp with time zone', undefined, 'postgres', 'mysql')).toEqual({
      type: 'timestamp',
      mapped: true,
    });
  });

  it('keeps types outside the list as written', () => {
    expect(convertType('int unsigned', undefined, 'mysql', 'postgres')).toEqual({
      type: 'int unsigned',
      mapped: false,
    });
    expect(convertType('money', '4', 'postgres', 'mysql')).toEqual({
      type: 'money',
      size: '4',
      mapped: false,
    });
  });
});
