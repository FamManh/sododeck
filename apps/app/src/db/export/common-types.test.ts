import { COMMON_TYPES } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { translateType } from './common-types';

describe('translateType', () => {
  it('maps every canonical type and alias for each dialect', () => {
    for (const entry of COMMON_TYPES) {
      for (const name of [entry.canonical, ...entry.aliases]) {
        for (const dialect of ['postgres', 'mysql', 'sqlite'] as const) {
          const result = translateType(name.toUpperCase(), undefined, dialect);
          expect(result.mapped).toBe(true);
          if (!(dialect === 'mysql' && entry.canonical === 'varchar')) {
            expect(result.written).toBe(entry[dialect]);
          }
        }
      }
    }
  });

  it('normalises case and inner whitespace', () => {
    expect(translateType(' Character   Varying ', '80', 'postgres').written).toBe('varchar(80)');
    expect(translateType('DOUBLE  PRECISION', undefined, 'mysql').written).toBe('double');
  });

  it('keeps the size only where the type allows it', () => {
    expect(translateType('decimal', '10,2', 'postgres').written).toBe('numeric(10,2)');
    expect(translateType('decimal', '10, 2', 'mysql').written).toBe('decimal(10,2)');
    expect(translateType('decimal', '10,2', 'sqlite').written).toBe('numeric');
    expect(translateType('int', '11', 'mysql').written).toBe('int');
    expect(translateType('varchar(80)', undefined, 'postgres')).toMatchObject({
      type: 'varchar',
      size: '80',
      written: 'varchar(80)',
    });
  });

  it('gives MySQL varchar without length 255 and flags it', () => {
    expect(translateType('varchar', undefined, 'mysql')).toMatchObject({
      written: 'varchar(255)',
      sizeDefaulted: true,
    });
    expect(translateType('varchar', undefined, 'postgres').sizeDefaulted).toBe(false);
  });

  it('writes uuid as char(36) on MySQL', () => {
    expect(translateType('uuid', undefined, 'mysql')).toMatchObject({ type: 'char', size: '36' });
  });

  it('keeps unmapped types as written', () => {
    expect(translateType('money', undefined, 'mysql')).toMatchObject({
      written: 'money',
      mapped: false,
    });
    expect(translateType('geometry', '4326', 'postgres').written).toBe('geometry(4326)');
  });
});
