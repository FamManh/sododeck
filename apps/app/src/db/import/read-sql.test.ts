import { describe, expect, it } from 'vitest';

import { createParsers } from './load-parsers';
import { readSql, unwrap } from './read-sql';
import { splitSql } from './split-sql';
import type { SqlDialect } from './types';

const parsers = createParsers();

async function read(text: string, dialect: SqlDialect = 'postgres') {
  return readSql(splitSql(text), dialect, await parsers.sql(dialect));
}

describe('readSql: Postgres', () => {
  it('reads columns with types, flags, defaults, checks and inline references', async () => {
    const { raw, error } = await read(`CREATE TABLE billing.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE ON UPDATE SET NULL,
  status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
  total numeric(10,2) DEFAULT 0 CHECK (total >= 0),
  code varchar(8) UNIQUE,
  live boolean DEFAULT true,
  n bigserial,
  note text DEFAULT NULL,
  at timestamptz DEFAULT now()
);`);
    expect(error).toBeUndefined();
    const [table] = raw.tables;
    expect(table).toMatchObject({ schema: 'billing', name: 'orders', line: 1 });
    expect(table?.columns.map((c) => [c.name, c.type, c.line])).toEqual([
      ['id', 'uuid', 2],
      ['customer_id', 'uuid', 3],
      ['status', 'public.order_status', 4],
      ['total', 'numeric(10,2)', 5],
      ['code', 'varchar(8)', 6],
      ['live', 'boolean', 7],
      ['n', 'bigserial', 8],
      ['note', 'text', 9],
      ['at', 'timestamptz', 10],
    ]);
    const col = (name: string) => table?.columns.find((c) => c.name === name);
    expect(col('id')).toMatchObject({
      pk: true,
      default: { kind: 'expr', expr: 'gen_random_uuid()' },
    });
    expect(col('customer_id')?.notNull).toBe(true);
    expect(col('status')?.default).toEqual({ kind: 'value', value: 'pending' });
    expect(col('total')).toMatchObject({
      default: { kind: 'value', value: 0 },
      check: 'total >= 0',
    });
    expect(col('code')?.unique).toBe(true);
    expect(col('live')?.default).toEqual({ kind: 'value', value: true });
    expect(col('note')?.default).toBeUndefined();
    expect(col('at')?.default).toEqual({ kind: 'expr', expr: 'now()' });
    expect(raw.refs).toEqual([
      expect.objectContaining({
        from: { schema: 'billing', name: 'orders', columns: ['customer_id'] },
        to: { schema: 'public', name: 'customers', columns: ['id'] },
        onDelete: 'cascade',
        onUpdate: 'set-null',
      }),
    ]);
  });

  it('reads table constraints, enums, indexes, comments and ALTER TABLE additions', async () => {
    const { raw } = await read(`CREATE TYPE mood AS ENUM ('sad', 'ok');
CREATE TABLE t (a int, b int, c mood, PRIMARY KEY (a, b), CONSTRAINT t_c CHECK ((a < b)), UNIQUE (c), UNIQUE (a, c));
CREATE TABLE u (id int);
ALTER TABLE ONLY t ADD CONSTRAINT t_fk FOREIGN KEY (b) REFERENCES u (id);
ALTER TABLE t ADD COLUMN d text NOT NULL;
ALTER TABLE ONLY t ALTER COLUMN a SET DEFAULT nextval('t_a_seq'::regclass);
CREATE UNIQUE INDEX t_idx ON t USING btree (a, lower(d));
COMMENT ON TABLE t IS 'The t';
COMMENT ON COLUMN t.d IS 'The d';`);
    expect(raw.enums).toEqual([
      { name: 'mood', values: [{ name: 'sad' }, { name: 'ok' }], line: 1 },
    ]);
    const t = raw.tables[0];
    expect(t?.primaryKey).toEqual(['a', 'b']);
    expect(t?.checks).toEqual([{ name: 't_c', expr: 'a < b', line: 2 }]);
    expect(t?.columns.find((c) => c.name === 'c')?.unique).toBe(true);
    expect(t?.columns.find((c) => c.name === 'a')?.increment).toBe(true);
    expect(t?.columns.find((c) => c.name === 'd')).toMatchObject({
      type: 'text',
      notNull: true,
      note: 'The d',
    });
    expect(t?.note).toBe('The t');
    expect(t?.indexes).toEqual([
      { parts: [{ column: 'a' }, { column: 'c' }], unique: true, line: 2 },
      {
        name: 't_idx',
        parts: [{ column: 'a' }, { expr: 'lower(d)' }],
        unique: true,
        method: 'btree',
        line: 7,
      },
    ]);
    expect(raw.refs[0]).toMatchObject({
      name: 't_fk',
      from: { name: 't', columns: ['b'] },
      to: { name: 'u', columns: ['id'] },
    });
    expect(raw.skipped).toEqual([]);
  });

  it('reports what it does not map', async () => {
    const { raw } =
      await read(`CREATE TABLE t (a int COLLATE "C", g int GENERATED ALWAYS AS (a + 1) STORED);
ALTER TABLE t DROP COLUMN a;
ALTER TABLE t ALTER COLUMN a TYPE bigint;
ALTER TABLE nope ADD COLUMN x int;
CREATE TYPE pair AS (a int, b int);
CREATE INDEX i ON t (a) WHERE a > 0;`);
    expect(raw.skipped.map((s) => [s.line, s.reason, s.detail])).toEqual([
      [2, 'drop-or-rename', undefined],
      [3, 'alter', undefined],
      [4, 'unknown-table', undefined],
      [5, 'unknown', 'only enum types are imported'],
    ]);
    expect(raw.changed.map((c) => [c.line, c.target, c.detail])).toEqual([
      [1, 't.a', 'collation is not stored'],
      [1, 't.g', 'generated expression is not stored'],
      [6, 'i', 'the index condition (WHERE) is not stored'],
    ]);
  });

  it('blocks on a table it cannot read and reports the line', async () => {
    const { error, raw } = await read(
      'CREATE TABLE ok (a int);\n\nCREATE TABLE bad (\n  a int,,\n  b int\n);',
    );
    expect(error).toMatchObject({ line: 4 });
    expect(raw.tables.map((t) => t.name)).toEqual(['ok']);
    expect(raw.skipped[0]).toMatchObject({ line: 3, reason: 'parse-error' });
  });
});

describe('readSql: MySQL', () => {
  it('reads backticks, unsigned, auto-increment, inline enums, keys, comments and table options', async () => {
    const { raw } = await read(
      "CREATE TABLE `orders` (\n  `id` int unsigned NOT NULL AUTO_INCREMENT COMMENT 'pk',\n  `s` enum('a','b''c') DEFAULT 'a',\n  `t` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  KEY `k` (`s`),\n  FULLTEXT KEY `f` (`s`)\n) ENGINE=InnoDB COMMENT='All orders';",
      'mysql',
    );
    const t = raw.tables[0];
    expect(t?.note).toBe('All orders');
    expect(t?.columns[0]).toMatchObject({
      name: 'id',
      type: 'int unsigned',
      notNull: true,
      increment: true,
      note: 'pk',
    });
    expect(t?.columns[1]?.enumValues).toEqual(['a', "b'c"]);
    expect(t?.columns[2]?.default).toEqual({ kind: 'expr', expr: 'CURRENT_TIMESTAMP' });
    expect(t?.indexes.map((i) => i.name)).toEqual(['k', 'f']);
    expect(raw.changed.map((c) => c.detail)).toEqual([
      'ON UPDATE CURRENT_TIMESTAMP is not stored',
      'fulltext index kept as a plain index',
      'table options not stored: ENGINE',
    ]);
  });
});

describe('readSql: SQLite', () => {
  it('reads autoincrement, untyped columns and inline references', async () => {
    const { raw } = await read(
      'CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, x, user_id INTEGER REFERENCES users(id)) WITHOUT ROWID;',
      'sqlite',
    );
    expect(raw.tables[0]?.columns.map((c) => [c.name, c.type, c.increment ?? false])).toEqual([
      ['id', 'integer', true],
      ['x', '', false],
      ['user_id', 'integer', false],
    ]);
    expect(raw.refs[0]?.to).toEqual({ name: 'users', columns: ['id'] });
  });
});

describe('unwrap', () => {
  it('drops one pair of parentheses around the whole expression only', () => {
    expect(unwrap('((a > b))')).toBe('a > b');
    expect(unwrap('(a) AND (b)')).toBe('(a) AND (b)');
  });
});
