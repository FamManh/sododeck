import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { buildSchemaSlice } from './schema-slice';
import { DEFAULT_SQL_OPTIONS, type SchemaExportRequest } from './types';

const sqlDeck: SchemaExportRequest = {
  format: 'sql',
  scope: { kind: 'deck' },
  dialect: null,
  sql: DEFAULT_SQL_OPTIONS,
};

describe('buildSchemaSlice', () => {
  const slice = buildSchemaSlice(shopDeck('postgres'), sqlDeck);
  const names = (ids: readonly string[]) =>
    ids.map((id) => [...slice.tables, ...slice.junctions].find((t) => t.id === id)?.name);

  it('lists tables in stable order: schema, name, id', () => {
    expect(slice.tables.map((t) => t.name)).toEqual([
      'addresses',
      'audit_log',
      'categories',
      'customers',
      'order_items',
      'orders',
      'payments',
      'products',
      'reviews',
      'sessions',
      'shipment_items',
      'shipments',
      'users',
    ]);
  });

  it('orders SQL by dependency, ties by name, junctions after the later side', () => {
    expect(names(slice.sqlOrder)).toEqual([
      'audit_log',
      'categories',
      'customers',
      'addresses',
      'orders',
      'payments',
      'products',
      'products_categories',
      'order_items',
      'reviews',
      'shipments',
      'shipment_items',
      'users',
      'sessions',
    ]);
    expect(slice.deferredFks).toEqual([]);
  });

  it('places foreign keys by cardinality (research R5)', () => {
    const orders = slice.tables.find((t) => t.name === 'orders');
    expect(orders?.foreignKeys.map((fk) => [fk.refTable, fk.columns, fk.onDelete])).toEqual([
      ['customers', ['orders.customer_id'], 'cascade'],
      ['addresses', ['orders.shipping_address_id'], undefined],
      ['addresses', ['orders.billing_address_id'], undefined],
    ]);
    const flipped = shopDeck('postgres');
    const edge = flipped.edges.find((e) => e.id === 'rel.payments-order');
    if (edge === undefined) throw new Error('fixture changed');
    Object.assign(edge, {
      from: 'orders',
      to: 'payments',
      fromColumns: ['orders.id'],
      toColumns: ['payments.order_id'],
      cardinality: '1-n',
    });
    const payments = buildSchemaSlice(flipped, sqlDeck).tables.find((t) => t.name === 'payments');
    expect(payments?.foreignKeys.map((fk) => [fk.refTable, fk.columns])).toEqual([
      ['orders', ['payments.order_id']],
    ]);
  });

  it('defers the foreign keys of a cycle', () => {
    const edge = buildSchemaSlice(edgeCaseDeck(), edgeCaseRequest('sql', 'postgres'));
    expect(edge.deferredFks.map((fk) => [fk.table, fk.refTable])).toEqual([['t.a', 't.b']]);
    const b = edge.tables.find((t) => t.id === 't.b');
    expect(b?.foreignKeys.map((fk) => fk.deferred)).toEqual([false]);
  });

  it('notes each case it owns', () => {
    const edge = buildSchemaSlice(edgeCaseDeck(), edgeCaseRequest('sql', 'mysql'));
    expect(new Set(edge.notes.map((n) => n.kind))).toEqual(
      new Set([
        'fk-out-of-scope',
        'unmapped-type',
        'default-size',
        'stale-reference',
        'length-mismatch',
        'no-columns',
        'self-junction',
        'junction-renamed',
        'no-key',
        'empty-type',
        'unnamed-table',
      ]),
    );
    const misc = edge.tables.find((t) => t.name === 'misc');
    expect(misc?.columns.map((c) => c.type.written)).toEqual([
      'int',
      'text',
      'empty_choice',
      'text',
      'json',
      'money',
      'varchar(255)',
      'boolean',
    ]);
    const stale = edge.tables.find((t) => t.name === 'stale');
    expect(stale?.indexes[0]?.parts).toEqual([{ kind: 'column', column: 't.stale.c0' }]);
  });

  it('translates types only for SQL on a Generic deck', () => {
    const generic = shopDeck('generic');
    const column = (request: SchemaExportRequest) =>
      buildSchemaSlice(generic, request)
        .tables.find((t) => t.name === 'orders')
        ?.columns.find((c) => c.name === 'id')?.type.written;
    expect(column({ ...sqlDeck, dialect: 'mysql' })).toBe('char(36)');
    expect(column({ ...sqlDeck, dialect: 'sqlite' })).toBe('text');
    expect(column({ ...sqlDeck, format: 'dbml' })).toBe('uuid');
  });

  it('keeps an out-of-scope foreign key column and notes it (US2 scenario 6)', () => {
    for (const scope of [
      { kind: 'selection' as const, tableIds: ['orders'] },
      { kind: 'database' as const, cardId: 'card.users-db' },
    ]) {
      const scoped = buildSchemaSlice(shopDeck('postgres'), { ...sqlDeck, scope });
      expect(scoped.tables.every((t) => t.foreignKeys.length === 0)).toBe(
        scope.kind === 'selection',
      );
      expect(scoped.notes.every((n) => n.kind === 'fk-out-of-scope')).toBe(true);
    }
    const orders = buildSchemaSlice(shopDeck('postgres'), {
      ...sqlDeck,
      scope: { kind: 'selection', tableIds: ['orders', 'customers'] },
    });
    expect(orders.tables.find((t) => t.name === 'orders')?.columns).toHaveLength(7);
    // Table order (customers, then orders), then deck edge order.
    expect(orders.notes.map((n) => n.message)).toEqual([
      'addresses.customer_id → customers.id not written: addresses not in this export',
      'reviews.customer_id → customers.id not written: reviews not in this export',
      'orders.shipping_address_id → addresses.id not written: addresses not in this export',
      'orders.billing_address_id → addresses.id not written: addresses not in this export',
      'order_items.order_id → orders.id not written: order_items not in this export',
      'payments.order_id → orders.id not written: payments not in this export',
      'shipments.order_id → orders.id not written: shipments not in this export',
    ]);
  });

  it('leaves out an enum used only out of scope (US2 scenario 7)', () => {
    const scoped = buildSchemaSlice(shopDeck('postgres'), {
      ...sqlDeck,
      scope: { kind: 'database', cardId: 'card.users-db' },
    });
    expect(scoped.enums).toEqual([]);
    expect(buildSchemaSlice(shopDeck('postgres'), sqlDeck).enums.map((e) => e.name)).toEqual([
      'order_status',
    ]);
  });

  it('is deterministic', () => {
    expect(buildSchemaSlice(edgeCaseDeck(), edgeCaseRequest('sql', 'postgres'))).toEqual(
      buildSchemaSlice(edgeCaseDeck(), edgeCaseRequest('sql', 'postgres')),
    );
  });
});
