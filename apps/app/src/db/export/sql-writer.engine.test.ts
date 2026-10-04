// @vitest-environment node
/**
 * Runs the exported SQL on in-process engines (045 FR-023, SC-001, research R16): Postgres on
 * PGlite (dev dependency only) and SQLite on Node's built-in `node:sqlite`. Imported by no app code.
 */
import { createRequire } from 'node:module';

import type { DatabaseSync as DatabaseSyncClass } from 'node:sqlite';

import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

import { edgeCaseDeck, edgeCaseRequest } from '../fixtures/export-edge-cases';
import { shopDeck } from '../fixtures/shop';
import { schemaExport } from './schema-export';
import { DEFAULT_SQL_OPTIONS, type SqlDialect } from './types';

// Vite does not externalise every `node:` builtin; `createRequire` always reaches Node's own.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: typeof DatabaseSyncClass;
};

const SHOP_TABLES = [
  'addresses',
  'audit_log',
  'categories',
  'customers',
  'order_items',
  'orders',
  'payments',
  'products',
  'products_categories',
  'reviews',
  'sessions',
  'shipment_items',
  'shipments',
  'users',
];

function shopSql(dialect: SqlDialect): string {
  return schemaExport(shopDeck(dialect), {
    format: 'sql',
    scope: { kind: 'deck' },
    dialect: null,
    sql: DEFAULT_SQL_OPTIONS,
  }).text;
}

async function rows<T>(db: PGlite, sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

describe('Postgres (PGlite)', () => {
  it('creates every Shop table, column, key, index and enum', async () => {
    const db = new PGlite();
    await db.exec(shopSql('postgres'));

    const tables = await rows<{ table_name: string }>(
      db,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
    );
    expect(tables.map((r) => r.table_name)).toEqual(SHOP_TABLES);

    const columns = await rows<{ c: string }>(
      db,
      `SELECT table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable AS c
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
    );
    expect(columns.map((r) => r.c)).toEqual(
      expect.arrayContaining([
        'orders.id uuid NO',
        'orders.status USER-DEFINED NO',
        'orders.total numeric NO',
        'orders.created_at timestamp with time zone NO',
        'orders.shipping_address_id uuid YES',
        'customers.email character varying NO',
        'audit_log.payload jsonb YES',
        'reviews.id integer NO',
        'products_categories.products_id uuid NO',
      ]),
    );
    expect(columns).toHaveLength(58);

    const constraints = await rows<{ c: string }>(
      db,
      `SELECT conrelid::regclass || ' ' || contype::text || ' ' || pg_get_constraintdef(oid) AS c
       FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1`,
    );
    const defs = constraints.map((r) => r.c);
    expect(defs).toEqual(
      expect.arrayContaining([
        'order_items p PRIMARY KEY (order_id, product_id)',
        'shipment_items p PRIMARY KEY (shipment_id, order_id, product_id)',
        'orders f FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE',
        'shipment_items f FOREIGN KEY (order_id, product_id) REFERENCES order_items(order_id, product_id)',
        'categories f FOREIGN KEY (parent_id) REFERENCES categories(id)',
        'reviews f FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL',
        'order_items f FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT',
        'customers u UNIQUE (email)',
        'products c CHECK ((price >= (0)::numeric))',
      ]),
    );
    expect(defs.filter((d) => d.split(' ')[1] === 'f')).toHaveLength(16);
    expect(defs.filter((d) => d.split(' ')[1] === 'p')).toHaveLength(13);

    const indexes = await rows<{ indexdef: string }>(
      db,
      "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%idx' ORDER BY 1",
    );
    expect(indexes.map((r) => r.indexdef)).toEqual([
      'CREATE INDEX audit_log_logged_at_idx ON public.audit_log USING btree (logged_at)',
      'CREATE INDEX customers_email_lower_idx ON public.customers USING btree (lower((email)::text))',
      'CREATE INDEX orders_customer_id_idx ON public.orders USING btree (customer_id, created_at)',
    ]);

    const labels = await rows<{ enumlabel: string }>(
      db,
      "SELECT enumlabel FROM pg_enum JOIN pg_type t ON t.oid = enumtypid WHERE t.typname = 'order_status' ORDER BY enumsortorder",
    );
    expect(labels.map((r) => r.enumlabel)).toEqual(['pending', 'paid', 'shipped', 'cancelled']);

    const identity = await rows<{ is_identity: string }>(
      db,
      "SELECT is_identity FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'id'",
    );
    expect(identity[0]?.is_identity).toBe('YES');
    await db.close();
  }, 30_000);

  it('runs the edge-case export (Generic → Postgres)', async () => {
    const db = new PGlite();
    await db.exec(schemaExport(edgeCaseDeck(), edgeCaseRequest('sql', 'postgres')).text);
    const tables = await rows<{ t: string }>(
      db,
      `SELECT table_schema || '.' || table_name AS t FROM information_schema.tables
       WHERE table_schema IN ('public', 'billing') ORDER BY 1`,
    );
    expect(tables.map((r) => r.t)).toContain('billing.ledgers');
    expect(tables.map((r) => r.t)).toContain('public.order items');
    expect(tables.map((r) => r.t)).toContain('public.products_categories_2');
    const cycle = await rows<{ c: string }>(
      db,
      "SELECT pg_get_constraintdef(oid) AS c FROM pg_constraint WHERE conrelid = 'a'::regclass AND contype = 'f'",
    );
    expect(cycle.map((r) => r.c)).toEqual(['FOREIGN KEY (b_id) REFERENCES b(id)']);
    await db.close();
  }, 30_000);
});

describe('SQLite (node:sqlite)', () => {
  function open(sql: string) {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(sql);
    return db;
  }

  it('creates every Shop table, column, key, index and enum check', () => {
    const db = open(shopSql('sqlite'));
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(SHOP_TABLES);

    const info = (table: string) =>
      db
        .prepare(`SELECT name, type, "notnull", pk FROM pragma_table_info('${table}') ORDER BY cid`)
        .all();
    expect(info('order_items')).toEqual([
      { name: 'order_id', type: 'TEXT', notnull: 0, pk: 1 },
      { name: 'product_id', type: 'TEXT', notnull: 0, pk: 2 },
      { name: 'quantity', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'unit_price', type: 'numeric', notnull: 1, pk: 0 },
    ]);
    let columnCount = 0;
    for (const t of tables) columnCount += info(String(t)).length;
    expect(columnCount).toBe(58);

    const fks = tables.flatMap((t) =>
      db
        .prepare(
          `SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list('${String(t)}')`,
        )
        .all()
        .map(
          (r) =>
            `${String(t)}.${String(r.from)} → ${String(r.table)}.${String(r.to)} ${String(r.on_delete)}`,
        ),
    );
    expect(fks).toEqual(
      expect.arrayContaining([
        'orders.customer_id → customers.id CASCADE',
        'shipment_items.order_id → order_items.order_id NO ACTION',
        'shipment_items.product_id → order_items.product_id NO ACTION',
        'reviews.customer_id → customers.id SET NULL',
      ]),
    );
    expect(fks).toHaveLength(17);

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);
    expect(indexes).toEqual([
      'audit_log_logged_at_idx',
      'customers_email_lower_idx',
      'orders_customer_id_idx',
    ]);
    const unique = db
      .prepare("SELECT \"unique\", origin FROM pragma_index_list('customers') WHERE origin = 'u'")
      .all();
    expect(unique).toHaveLength(1);

    // The enum is a check: other values are refused.
    db.exec("INSERT INTO customers (id, email, name) VALUES ('c1', 'a@b.c', 'A')");
    expect(() => {
      db.exec("INSERT INTO orders (id, customer_id, status) VALUES ('o1', 'c1', 'lost')");
    }).toThrow(/CHECK constraint failed/);
    db.exec("INSERT INTO orders (id, customer_id) VALUES ('o1', 'c1')");
    db.exec("INSERT INTO products (id, sku, name, price) VALUES ('p', 'P-1', 'Pen', 2)");
    db.exec("INSERT INTO reviews (product_id, rating) VALUES ('p', 3)");
    expect(() => {
      db.exec("INSERT INTO reviews (product_id, rating) VALUES ('nope', 3)");
    }).toThrow(/FOREIGN KEY constraint failed/);
    expect(db.prepare('SELECT id FROM reviews').all()).toEqual([{ id: 1 }]);
    db.close();
  });

  it('runs the edge-case export (Generic → SQLite)', () => {
    const db = open(schemaExport(edgeCaseDeck(), edgeCaseRequest('sql', 'sqlite')).text);
    const names = db
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['ledgers', 'order items', 'tags_tags', 'a', 'b']),
    );
    db.close();
  });
});
