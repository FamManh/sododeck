import type { DbColumn, SododeckFile } from '@sododeck/schema';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { columnConstraints, columnSummary, fullType } from './table-text';

const users = {
  id: 'users',
  type: 'db-table',
  title: 'users',
  columns: [
    { id: 'id', name: 'id', type: 'int', pk: true, increment: true },
    { id: 'email', name: 'email', type: 'varchar', size: '320', notNull: true, unique: true },
  ],
} as SododeckFile['nodes'][number];
const orders = {
  id: 'orders',
  type: 'db-table',
  title: 'orders',
  columns: [
    { id: 'o-id', name: 'id', type: 'int', pk: true },
    { id: 'o-user', name: 'user_id', type: 'int', default: 0, check: 'user_id >= 0' },
    { id: 'o-status', name: 'status', type: 'order_status', enumRef: 'e1', note: 'Paid?' },
  ],
} as SododeckFile['nodes'][number];
const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [users, orders],
  edges: [
    {
      id: 'r1',
      from: 'orders',
      to: 'users',
      fromColumns: ['o-user'],
      toColumns: ['id'],
      cardinality: 'n-1',
    },
  ],
  enums: [{ id: 'e1', name: 'order_status', values: [] }],
};
const column = (table: typeof users, id: string) =>
  table.columns?.find((c) => c.id === id) as DbColumn;

describe('column popover text (064)', () => {
  it('lists only the constraints set, in order', () => {
    expect(columnConstraints(deck, 'users', column(users, 'id'))).toEqual([
      'Primary key',
      'Auto increment',
    ]);
    expect(columnConstraints(deck, 'users', column(users, 'email'))).toEqual([
      'Not null',
      'Unique',
    ]);
    expect(columnConstraints(deck, 'orders', column(orders, 'o-user'))).toEqual([
      'Foreign key → users.id',
      'Default 0',
      'Check user_id >= 0',
    ]);
    expect(columnConstraints(deck, 'orders', column(orders, 'o-status'))).toEqual([]);
  });

  it('shows the full type with its size, or the enum name', () => {
    expect(fullType(column(users, 'email'), deck)).toBe('varchar(320)');
    expect(fullType(column(orders, 'o-status'), deck)).toBe('order_status');
  });

  it('builds the announce text', () => {
    expect(columnSummary(deck, 'users', column(users, 'email'))).toBe(
      'email, varchar(320), Not null, Unique',
    );
    expect(columnSummary(deck, 'orders', column(orders, 'o-status'))).toBe(
      'status, order_status, note: Paid?',
    );
  });
});
