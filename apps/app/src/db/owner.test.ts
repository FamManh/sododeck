import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { databaseCards, ownerOf, tableCountText, tableCounts, tablesOf } from './owner';

const table = (id: string, parent?: string) => ({
  id,
  type: 'db-table' as const,
  title: id,
  columns: [],
  ...(parent === undefined ? {} : { parent }),
});

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'orders-db', type: 'database', title: 'Orders DB' },
    { id: 'customers-db', type: 'database', title: 'Customers DB' },
    { id: 'svc', type: 'service', title: 'Orders' },
    table('orders', 'orders-db'),
    table('items', 'orders-db'),
    table('customers', 'customers-db'),
    table('loose'),
    { id: 'child', type: 'service', title: 'Child', parent: 'orders-db' },
    table('under-service', 'svc'),
  ],
};

describe('database card ownership (049)', () => {
  it('counts only tables per card', () => {
    const counts = tableCounts(deck);
    expect(counts.get('orders-db')).toBe(2);
    expect(counts.get('customers-db')).toBe(1);
    expect(tableCounts(deck)).toBe(counts);
  });

  it('lists a card’s tables in deck order', () => {
    expect(tablesOf(deck, 'orders-db').map((n) => n.id)).toEqual(['orders', 'items']);
    expect(tablesOf(deck, 'svc').map((n) => n.id)).toEqual(['under-service']);
  });

  it('finds the database card that owns a table, if any', () => {
    expect(ownerOf(deck, 'orders')?.id).toBe('orders-db');
    expect(ownerOf(deck, 'loose')).toBeUndefined();
    expect(ownerOf(deck, 'under-service')).toBeUndefined();
    expect(ownerOf(deck, 'nope')).toBeUndefined();
  });

  it('lists the database cards a table can move to', () => {
    expect(databaseCards(deck).map((n) => n.id)).toEqual(['orders-db', 'customers-db']);
  });

  it('writes the card face count', () => {
    expect(tableCountText(0)).toBe('No tables yet');
    expect(tableCountText(1)).toBe('1 table inside');
    expect(tableCountText(12)).toBe('12 tables inside');
  });
});
