import { describe, expect, it } from 'vitest';

import {
  relationshipLabel,
  relationshipName,
  relationshipSummary,
  type TableLookup,
} from './relationship-label';

const col = (id: string) => ({ id, name: id.replace(/^c-/, '') });
const tables: TableLookup = (id) =>
  ({
    orders: { title: 'orders', columns: [col('c-id'), col('c-customer_id')] },
    customers: { title: 'customers', columns: [col('c-id')] },
    items: { title: 'shipment_items', columns: [col('c-order_id'), col('c-product_id')] },
    lines: { title: 'order_items', columns: [col('c-order_id'), col('c-product_id')] },
  })[id];

const fk = {
  from: 'orders',
  to: 'customers',
  fromColumns: ['c-customer_id'],
  toColumns: ['c-id'],
  cardinality: 'n-1' as const,
};

describe('relationshipLabel (042 FR-013)', () => {
  it('shows the name alone', () => {
    expect(relationshipLabel({ ...fk, label: 'placed by' }, tables)).toBe('placed by');
    expect(relationshipLabel(fk, tables)).toBeUndefined();
  });

  it('adds ON DELETE, but not for no-action', () => {
    expect(relationshipLabel({ ...fk, onDelete: 'restrict' }, tables)).toBe('ON DELETE RESTRICT');
    expect(relationshipLabel({ ...fk, onDelete: 'set-null' }, tables)).toBe('ON DELETE SET NULL');
    expect(relationshipLabel({ ...fk, onDelete: 'no-action' }, tables)).toBeUndefined();
  });

  it('lists composite columns and marks n–n, joined with " · "', () => {
    const composite = {
      from: 'items',
      fromColumns: ['c-order_id', 'c-product_id'],
      label: 'ships',
      onDelete: 'cascade' as const,
    };
    expect(relationshipLabel(composite, tables)).toBe(
      'ships · ON DELETE CASCADE · (order_id, product_id)',
    );
    expect(relationshipLabel({ ...fk, cardinality: 'n-n' }, tables)).toBe('n–n');
  });
});

describe('relationshipName (042 R18)', () => {
  it('names both ends, the cardinality in words and the on-delete action', () => {
    expect(relationshipName({ ...fk, onDelete: 'restrict' }, tables)).toBe(
      'Relationship orders.customer_id to customers.id, many to one, on delete restrict',
    );
  });

  it('names composite ends and many to many', () => {
    expect(
      relationshipName(
        {
          from: 'items',
          to: 'lines',
          fromColumns: ['c-order_id', 'c-product_id'],
          toColumns: ['c-order_id', 'c-product_id'],
          cardinality: 'n-n',
        },
        tables,
      ),
    ).toBe(
      'Relationship shipment_items (order_id, product_id) to order_items (order_id, product_id), many to many',
    );
  });

  it('falls back to the table for missing columns and adds the label', () => {
    expect(
      relationshipName(
        { from: 'orders', to: 'customers', fromColumns: ['gone'], label: 'placed by' },
        tables,
      ),
    ).toBe('Relationship orders to customers, placed by');
  });
});

describe('relationshipSummary (048)', () => {
  it('reads table.column → table.column · cardinality', () => {
    expect(relationshipSummary(fk, tables)).toBe('orders.customer_id → customers.id · n-1');
  });

  it('leaves the cardinality out when there is none', () => {
    const { cardinality: _unused, ...plain } = fk;
    expect(relationshipSummary(plain, tables)).toBe('orders.customer_id → customers.id');
  });
});
