import { describe, expect, it } from 'vitest';

import { typeMismatch } from './type-mismatch';

describe('typeMismatch (042 FR-018)', () => {
  it('is undefined for the same type, any case', () => {
    expect(typeMismatch({ type: 'uuid' }, { type: 'UUID' })).toBeUndefined();
    expect(typeMismatch({ type: 'varchar', size: '255' }, { type: 'varchar', size: '255' })).toBe(
      undefined,
    );
  });

  it('names both types when they or their sizes differ', () => {
    expect(typeMismatch({ type: 'int' }, { type: 'uuid' })).toBe('int → uuid');
    expect(typeMismatch({ type: 'varchar', size: '64' }, { type: 'varchar', size: '255' })).toBe(
      'varchar(64) → varchar(255)',
    );
  });

  it('matches an enum column only with the same enum', () => {
    const status = { type: 'order_status', enumRef: 'e1' };
    expect(typeMismatch(status, { ...status })).toBeUndefined();
    expect(typeMismatch(status, { type: 'order_status', enumRef: 'e2' })).toBe(
      'order_status → order_status',
    );
    expect(typeMismatch(status, { type: 'text' })).toBe('order_status → text');
  });

  it('agrees with the lint: int and integer match, timestamptz and timestamp do not on Postgres (047)', () => {
    expect(typeMismatch({ type: 'int' }, { type: 'integer' }, 'postgres')).toBeUndefined();
    expect(typeMismatch({ type: 'int' }, { type: 'integer' })).toBeUndefined();
    expect(typeMismatch({ type: 'timestamptz' }, { type: 'timestamp' }, 'postgres')).toBe(
      'timestamptz → timestamp',
    );
    expect(
      typeMismatch({ type: 'numeric', size: '10, 2' }, { type: 'numeric', size: '10,2' }),
    ).toBe(undefined);
  });
});
