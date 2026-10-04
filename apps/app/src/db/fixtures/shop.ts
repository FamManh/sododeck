/**
 * The "Shop" schema deck (045 T003), shared by export tests and later by import (044) and the
 * database card export (049). Pure data: a schema-valid `SododeckFile` per dialect.
 *
 * Column types are written as Generic common types and, for a real dialect, replaced by that
 * dialect's native form through `translateType`, so each dialect's deck holds types its engine
 * accepts (`char(36)` on MySQL, `text` on SQLite).
 */
import type { DbColumn, Dialect, Edge, Node, SododeckFile } from '@sododeck/schema';

import { translateType } from '../export/common-types';

type ColumnSpec = Omit<DbColumn, 'id'> & { id?: string };

const ORDERS_DB = 'card.orders-db';
const USERS_DB = 'card.users-db';

function nativeColumn(table: string, spec: ColumnSpec, dialect: Dialect): DbColumn {
  const { id, ...rest } = spec;
  const column: DbColumn = { id: id ?? `${table}.${spec.name}`, ...rest };
  if (dialect === 'generic' || column.enumRef !== undefined) return column;
  const native = translateType(column.type, column.size, dialect);
  const { size: _dropped, ...withoutSize } = column;
  return {
    ...withoutSize,
    type: native.type,
    ...(native.size === undefined ? {} : { size: native.size }),
  };
}

function table(
  name: string,
  parent: string,
  at: [number, number],
  columns: ColumnSpec[],
  extra: Partial<Node>,
  dialect: Dialect,
): Node {
  return {
    id: name,
    type: 'db-table',
    title: name,
    parent,
    position: { x: at[0], y: at[1] },
    columns: columns.map((c) => nativeColumn(name, c, dialect)),
    ...extra,
  };
}

function relationship(id: string, edge: Omit<Edge, 'id'>): Edge {
  return { id, ...edge };
}

/** `now()` where the engine has it; SQLite's own `CURRENT_TIMESTAMP` there. */
function nowExpr(dialect: Dialect): string {
  return dialect === 'sqlite' ? 'CURRENT_TIMESTAMP' : 'now()';
}

export function shopDeck(dialect: Dialect = 'postgres'): SododeckFile {
  const now = nowExpr(dialect);
  const t = (
    name: string,
    parent: string,
    at: [number, number],
    columns: ColumnSpec[],
    extra: Partial<Node> = {},
  ) => table(name, parent, at, columns, extra, dialect);
  const nodes: Node[] = [
    {
      id: ORDERS_DB,
      type: 'database',
      title: 'Orders DB',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 600 },
    },
    {
      id: USERS_DB,
      type: 'database',
      title: 'Users DB',
      position: { x: 1000, y: 0 },
      size: { width: 400, height: 300 },
    },
    { id: 'svc.checkout', type: 'service', title: 'Checkout API', position: { x: 1000, y: 500 } },
    t(
      'customers',
      ORDERS_DB,
      [0, 0],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'varchar', size: '255', notNull: true, unique: true },
        { name: 'name', type: 'varchar', size: '120', notNull: true },
        { name: 'created_at', type: 'timestamp', notNull: true, defaultExpr: now },
      ],
      {
        description: 'One row per buyer',
        indexes: [
          {
            id: 'customers.email-lower',
            name: 'customers_email_lower_idx',
            columns: [{ expr: 'lower(email)' }],
          },
        ],
      },
    ),
    t(
      'addresses',
      ORDERS_DB,
      [300, 0],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'customer_id', type: 'uuid', notNull: true },
        { name: 'street', type: 'varchar', size: '200', notNull: true },
        { name: 'city', type: 'varchar', size: '100', notNull: true },
        { name: 'country', type: 'char', size: '2', notNull: true, note: 'ISO 3166-1 alpha-2' },
      ],
    ),
    t(
      'orders',
      ORDERS_DB,
      [0, 300],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'customer_id', type: 'uuid', notNull: true },
        { name: 'shipping_address_id', type: 'uuid' },
        { name: 'billing_address_id', type: 'uuid' },
        {
          name: 'status',
          type: 'order_status',
          enumRef: 'enum.order_status',
          notNull: true,
          default: 'pending',
        },
        {
          name: 'total',
          type: 'decimal',
          size: '10,2',
          notNull: true,
          default: 0,
          note: 'Sum of the order items',
        },
        { name: 'created_at', type: 'timestamp', notNull: true, defaultExpr: now },
      ],
      {
        description: 'One row per checkout',
        indexes: [
          {
            id: 'orders.customer-created',
            columns: ['orders.customer_id', 'orders.created_at'],
          },
        ],
      },
    ),
    t(
      'products',
      ORDERS_DB,
      [300, 300],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'sku', type: 'varchar', size: '40', notNull: true, unique: true },
        { name: 'name', type: 'varchar', size: '200', notNull: true },
        { name: 'price', type: 'decimal', size: '10,2', notNull: true },
        { name: 'active', type: 'boolean', notNull: true, default: true },
      ],
      {
        description: "Things we sell; 'active' hides them\nfrom the store",
        checks: [{ id: 'products.price-check', name: 'products_price_check', expr: 'price >= 0' }],
      },
    ),
    t(
      'categories',
      ORDERS_DB,
      [600, 300],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'parent_id', type: 'uuid' },
        { name: 'name', type: 'varchar', size: '100', notNull: true },
      ],
    ),
    t(
      'order_items',
      ORDERS_DB,
      [0, 600],
      [
        { name: 'order_id', type: 'uuid', pk: true },
        { name: 'product_id', type: 'uuid', pk: true },
        { name: 'quantity', type: 'int', notNull: true, check: 'quantity > 0' },
        { name: 'unit_price', type: 'decimal', size: '10,2', notNull: true },
      ],
    ),
    t(
      'payments',
      ORDERS_DB,
      [300, 600],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'order_id', type: 'uuid', notNull: true },
        { name: 'amount', type: 'decimal', size: '10,2', notNull: true },
        { name: 'paid_at', type: 'timestamp' },
      ],
    ),
    t(
      'shipments',
      ORDERS_DB,
      [600, 600],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'order_id', type: 'uuid', notNull: true },
        { name: 'carrier', type: 'varchar', size: '80' },
        { name: 'shipped_at', type: 'timestamp' },
      ],
    ),
    t(
      'shipment_items',
      ORDERS_DB,
      [0, 900],
      [
        { name: 'shipment_id', type: 'uuid', pk: true },
        { name: 'order_id', type: 'uuid', pk: true },
        { name: 'product_id', type: 'uuid', pk: true },
        { name: 'quantity', type: 'int', notNull: true },
      ],
    ),
    t(
      'reviews',
      ORDERS_DB,
      [300, 900],
      [
        { name: 'id', type: 'int', pk: true, increment: true },
        { name: 'product_id', type: 'uuid', notNull: true },
        { name: 'customer_id', type: 'uuid' },
        { name: 'rating', type: 'smallint', notNull: true, check: 'rating BETWEEN 1 AND 5' },
        { name: 'body', type: 'text' },
      ],
    ),
    t(
      'audit_log',
      ORDERS_DB,
      [600, 900],
      [
        { name: 'id', type: 'bigint', notNull: true },
        { name: 'action', type: 'varchar', size: '40', notNull: true },
        { name: 'payload', type: 'json' },
        { name: 'logged_at', type: 'timestamp', notNull: true, defaultExpr: now },
      ],
      {
        indexes: [{ id: 'audit_log.logged', columns: ['audit_log.logged_at'], method: 'btree' }],
      },
    ),
    t(
      'users',
      USERS_DB,
      [1000, 0],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'email', type: 'varchar', size: '255', notNull: true, unique: true },
        { name: 'display_name', type: 'varchar', size: '80' },
      ],
    ),
    t(
      'sessions',
      USERS_DB,
      [1200, 0],
      [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', notNull: true },
        { name: 'token', type: 'varchar', size: '64', notNull: true, unique: true },
        { name: 'expires_at', type: 'timestamp', notNull: true },
      ],
    ),
  ];
  const fk = (
    id: string,
    from: string,
    fromColumns: string[],
    to: string,
    toColumns: string[],
    extra: Partial<Edge> = {},
  ) => relationship(id, { from, to, fromColumns, toColumns, cardinality: 'n-1', ...extra });
  const edges: Edge[] = [
    fk(
      'rel.addresses-customer',
      'addresses',
      ['addresses.customer_id'],
      'customers',
      ['customers.id'],
      {
        onDelete: 'cascade',
      },
    ),
    fk('rel.orders-customer', 'orders', ['orders.customer_id'], 'customers', ['customers.id'], {
      onDelete: 'cascade',
      label: 'places',
    }),
    fk(
      'rel.orders-shipping',
      'orders',
      ['orders.shipping_address_id'],
      'addresses',
      ['addresses.id'],
      { fromOptional: true, toOptional: true, label: 'ships to' },
    ),
    fk(
      'rel.orders-billing',
      'orders',
      ['orders.billing_address_id'],
      'addresses',
      ['addresses.id'],
      { fromOptional: true, toOptional: true, label: 'bills to' },
    ),
    fk(
      'rel.categories-parent',
      'categories',
      ['categories.parent_id'],
      'categories',
      ['categories.id'],
      {
        fromOptional: true,
        toOptional: true,
      },
    ),
    fk('rel.items-order', 'order_items', ['order_items.order_id'], 'orders', ['orders.id'], {
      onDelete: 'cascade',
    }),
    fk(
      'rel.items-product',
      'order_items',
      ['order_items.product_id'],
      'products',
      ['products.id'],
      {
        onDelete: 'restrict',
      },
    ),
    fk('rel.payments-order', 'payments', ['payments.order_id'], 'orders', ['orders.id']),
    fk('rel.shipments-order', 'shipments', ['shipments.order_id'], 'orders', ['orders.id']),
    fk(
      'rel.shipment-items-shipment',
      'shipment_items',
      ['shipment_items.shipment_id'],
      'shipments',
      ['shipments.id'],
      { onDelete: 'cascade' },
    ),
    fk(
      'rel.shipment-items-item',
      'shipment_items',
      ['shipment_items.order_id', 'shipment_items.product_id'],
      'order_items',
      ['order_items.order_id', 'order_items.product_id'],
    ),
    fk('rel.reviews-product', 'reviews', ['reviews.product_id'], 'products', ['products.id'], {
      onDelete: 'cascade',
    }),
    fk('rel.reviews-customer', 'reviews', ['reviews.customer_id'], 'customers', ['customers.id'], {
      onDelete: 'set-null',
      fromOptional: true,
      toOptional: true,
    }),
    relationship('rel.products-categories', {
      from: 'products',
      to: 'categories',
      cardinality: 'n-n',
      label: 'listed in',
    }),
    fk('rel.sessions-user', 'sessions', ['sessions.user_id'], 'users', ['users.id'], {
      onDelete: 'cascade',
    }),
    relationship('edge.checkout-orders', { from: 'svc.checkout', to: ORDERS_DB, label: 'SQL' }),
  ];
  return {
    $schema: 'https://sododeck.com/schema/v1.json',
    version: 1,
    name: 'Shop',
    packs: ['architecture', 'database'],
    ...(dialect === 'generic' ? {} : { dialect }),
    enums: [
      {
        id: 'enum.order_status',
        name: 'order_status',
        note: 'Where an order is in its life',
        values: [
          { id: 'enum.order_status.pending', name: 'pending' },
          { id: 'enum.order_status.paid', name: 'paid', note: 'Payment captured' },
          { id: 'enum.order_status.shipped', name: 'shipped' },
          { id: 'enum.order_status.cancelled', name: 'cancelled' },
        ],
      },
    ],
    nodes,
    groups: [],
    edges,
    views: [],
    features: [],
    flows: [],
    rules: {},
    stickies: [],
  };
}
