import { describe, expect, it } from 'vitest';

import {
  buildPlan,
  createAllocator,
  dialectOutcome,
  hexColour,
  splitType,
  typeFamily,
} from './build-plan';
import type { ImportTarget, RawColumn, RawSchema, RawTable } from './types';

const TARGET: ImportTarget = {
  kind: 'deck',
  deckDialect: 'generic',
  deckHasTables: false,
  deckHasDescription: false,
  tableNames: [],
  enumNames: [],
};

const col = (name: string, type: string, extra: Partial<RawColumn> = {}): RawColumn => ({
  name,
  type,
  line: 1,
  ...extra,
});
const table = (name: string, columns: RawColumn[], extra: Partial<RawTable> = {}): RawTable => ({
  name,
  columns,
  indexes: [],
  checks: [],
  line: 1,
  ...extra,
});
const schema = (extra: Partial<RawSchema>): RawSchema => ({
  format: 'sql',
  tables: [],
  refs: [],
  enums: [],
  groups: [],
  notes: [],
  skipped: [],
  changed: [],
  ...extra,
});
const plan = (
  raw: Partial<RawSchema>,
  target: Partial<ImportTarget> = {},
  importDialect: 'postgres' | 'mysql' | 'sqlite' | null = null,
) => buildPlan(schema(raw), {}, { ...TARGET, ...target }, { importDialect });

describe('buildPlan: tables and columns', () => {
  it('makes db-table nodes with opaque ids, columns in order and flags only when true', () => {
    const result = plan({
      tables: [
        table('orders', [
          col('id', 'bigserial', { pk: true }),
          col('total', 'numeric(10, 2)', { notNull: true, default: { kind: 'value', value: 0 } }),
          col('at', 'timestamp(3) with time zone', { default: { kind: 'expr', expr: 'now()' } }),
          col('blank', ''),
        ]),
      ],
    });
    const [node] = result.fragment.deck.nodes;
    expect(node).toMatchObject({ id: 'node.1', type: 'db-table', title: 'orders' });
    expect(node?.columns).toEqual([
      { id: 'dbcol.1', name: 'id', type: 'bigint', pk: true, increment: true },
      { id: 'dbcol.2', name: 'total', type: 'numeric', size: '10,2', notNull: true, default: 0 },
      {
        id: 'dbcol.3',
        name: 'at',
        type: 'timestamp with time zone',
        size: '3',
        defaultExpr: 'now()',
      },
      { id: 'dbcol.4', name: 'blank', type: 'text' },
    ]);
    expect(result.report.changed).toEqual([
      expect.objectContaining({ detail: 'orders.blank has no type; stored as text' }),
    ]);
    // Ids never come from names.
    expect(JSON.stringify(result.fragment).includes('"id":"orders"')).toBe(false);
  });

  it('renames a repeated name and a name the deck already has with the copy rule', () => {
    const result = plan(
      {
        tables: [
          table('orders', []),
          table('Orders', []),
          table('users', []),
          table('users', [], { schema: 'billing' }),
        ],
      },
      { tableNames: [{ name: 'USERS' }, { name: 'orders_copy' }] },
    );
    expect(result.fragment.deck.nodes.map((n) => n.title)).toEqual([
      'orders',
      'Orders_copy_2',
      'users_copy',
      'users',
    ]);
    expect(result.report.changed.map((c) => [c.kind, c.detail])).toEqual([
      [
        'renamed-duplicate',
        'Orders appears twice in this import; the second is imported as Orders_copy_2',
      ],
      ['name-exists', 'a table named users already exists, imported as users_copy'],
    ]);
  });

  it('marks composite primary keys from a table constraint or a DBML pk index, and says when order differs', () => {
    const result = plan({
      tables: [
        table('a', [col('x', 'int'), col('y', 'int')], { primaryKey: ['y', 'x'] }),
        table('b', [col('x', 'int'), col('y', 'int')], {
          indexes: [{ parts: [{ column: 'x' }, { column: 'y' }], pk: true, line: 1 }],
        }),
      ],
    });
    const [a, b] = result.fragment.deck.nodes;
    expect(a?.columns?.map((c) => c.pk)).toEqual([true, true]);
    expect(b?.columns?.map((c) => c.pk)).toEqual([true, true]);
    expect(b?.indexes).toBeUndefined();
    expect(result.report.changed.map((c) => c.detail)).toEqual([
      'the primary key follows the column order',
    ]);
  });

  it('maps indexes to column ids and expressions, and leaves out parts naming no column', () => {
    const result = plan({
      tables: [
        table('t', [col('a', 'int')], {
          indexes: [
            {
              name: 'i',
              parts: [{ column: 'A' }, { expr: 'lower(b)' }, { column: 'zz' }],
              unique: true,
              method: 'btree',
              line: 3,
            },
          ],
          checks: [{ name: 'c', expr: 'a > 0', line: 4 }],
        }),
      ],
    });
    const [node] = result.fragment.deck.nodes;
    expect(node?.indexes).toEqual([
      {
        id: 'dbidx.1',
        name: 'i',
        columns: ['dbcol.1', { expr: 'lower(b)' }],
        unique: true,
        method: 'btree',
      },
    ]);
    expect(node?.checks).toEqual([{ id: 'dbchk.1', name: 'c', expr: 'a > 0' }]);
    expect(result.report.changed[0]?.detail).toBe('index part zz names no column of t; left out');
  });
});

describe('buildPlan: relationships (FR-013, FR-016)', () => {
  const tables = [
    table('customers', [col('id', 'int', { pk: true })]),
    table('orders', [
      col('id', 'int', { pk: true }),
      col('customer_id', 'int', { notNull: true }),
      col('promo_id', 'int', { unique: true }),
    ]),
  ];
  const ref = (from: string[], to: string[], extra = {}) => ({
    from: { name: 'orders', columns: from },
    to: { name: 'customers', columns: to },
    line: 9,
    excerpt: 'ALTER TABLE orders …',
    ...extra,
  });

  it('draws column ends, many-to-one or one-to-one when the columns are unique, optional when nullable', () => {
    const result = plan({
      tables,
      refs: [
        ref(['customer_id'], ['id'], { name: 'fk', onDelete: 'cascade' }),
        ref(['promo_id'], ['id']),
      ],
    });
    expect(result.fragment.deck.edges).toEqual([
      {
        id: 'edge.1',
        from: 'node.2',
        to: 'node.1',
        label: 'fk',
        fromColumns: ['dbcol.3'],
        toColumns: ['dbcol.1'],
        cardinality: 'n-1',
        onDelete: 'cascade',
      },
      {
        id: 'edge.2',
        from: 'node.2',
        to: 'node.1',
        fromColumns: ['dbcol.4'],
        toColumns: ['dbcol.1'],
        cardinality: '1-1',
        fromOptional: true,
      },
    ]);
  });

  it('references the primary key when no column is named, and keeps DBML cardinality as written', () => {
    const result = plan({
      tables,
      refs: [ref(['customer_id'], [], { cardinality: '1-n', toOptional: true })],
    });
    expect(result.fragment.deck.edges[0]).toMatchObject({
      toColumns: ['dbcol.1'],
      cardinality: '1-n',
      toOptional: true,
    });
  });

  it('skips a reference to a table or column outside the import', () => {
    const result = plan({
      tables,
      refs: [
        { ...ref(['customer_id'], ['id']), to: { name: 'accounts', columns: ['id'] } },
        ref(['customer_id'], ['nope']),
      ],
    });
    expect(result.fragment.deck.edges).toEqual([]);
    expect(result.report.skipped.map((s) => s.detail)).toEqual([
      'references accounts, not in this import',
      'names customers.nope, which is not in this import',
    ]);
  });

  it('writes an n–n between two primary keys without column ends', () => {
    const result = plan({ tables, refs: [{ ...ref(['id'], ['id']), cardinality: 'n-n' }] });
    expect(result.fragment.deck.edges[0]).toEqual({
      id: 'edge.1',
      from: 'node.2',
      to: 'node.1',
      cardinality: 'n-n',
    });
  });
});

describe('buildPlan: enums, groups and notes', () => {
  it('links columns to enums by name and schema, shares one enum per MySQL value list', () => {
    const result = plan(
      {
        enums: [
          { name: 'mood', schema: 'public', values: [{ name: 'ok' }, { name: '' }], line: 1 },
        ],
        tables: [
          table(
            'a',
            [col('m', 'public.mood'), col('s', "enum('x','y')", { enumValues: ['x', 'y'] })],
            { schema: 'public' },
          ),
          table('b', [col('m', 'MOOD'), col('t', "enum('x','y')", { enumValues: ['x', 'y'] })], {
            schema: 'public',
          }),
        ],
      },
      { enumNames: [{ name: 'mood', schema: 'public' }] },
    );
    expect(result.enums.map((e) => [e.planId, e.name, e.values?.map((v) => v.name)])).toEqual([
      ['enum.1', 'mood', ['ok']],
      ['enum.2', 'a_s', ['x', 'y']],
    ]);
    const columns = result.fragment.deck.nodes.flatMap((n) => n.columns ?? []);
    expect(columns.map((c) => [c.type, c.enumRef])).toEqual([
      ['mood', 'enum.1'],
      ['a_s', 'enum.2'],
      ['mood', 'enum.1'],
      ['a_s', 'enum.2'],
    ]);
    expect(result.report.changed.map((c) => c.kind)).toEqual([
      'option-dropped',
      'enum-name-exists',
    ]);
  });

  it('groups by schema only when there are two or more', () => {
    const one = plan({
      tables: [table('a', [], { schema: 'public' }), table('b', [], { schema: 'public' })],
    });
    expect(one.fragment.deck.groups).toEqual([]);
    const two = plan({
      tables: [table('a', [], { schema: 'public' }), table('b', [], { schema: 'billing' })],
    });
    expect(two.fragment.deck.groups.map((g) => g.title)).toEqual(['public', 'billing']);
    expect(two.fragment.deck.nodes.map((n) => n.group)).toEqual(['group.1', 'group.2']);
  });

  it('turns DBML table groups into groups with their colour, header colours into card colours', () => {
    const result = plan({
      format: 'dbml',
      tables: [table('a', [], { headerColor: '#3498DB' }), table('b', [])],
      groups: [
        {
          name: 'sales',
          tables: [{ name: 'a' }, { name: 'missing' }],
          color: '#E67E22',
          note: 'Pipeline',
          line: 1,
        },
      ],
      notes: [{ text: 'Hello', line: 2 }],
      projectNote: 'About',
    });
    expect(result.fragment.deck.groups).toEqual([
      { id: 'group.1', title: 'sales', description: 'Pipeline', style: { fill: '#e67e22' } },
    ]);
    expect(result.fragment.deck.nodes[0]).toMatchObject({
      group: 'group.1',
      style: { fill: '#3498db' },
    });
    expect(result.stickies).toEqual([{ text: 'Hello' }]);
    expect(result.description).toBe('About');
    const withDescription = plan(
      { format: 'dbml', projectNote: 'About' },
      { deckHasDescription: true },
    );
    expect(withDescription.description).toBeUndefined();
    expect(withDescription.stickies).toEqual([{ text: 'About' }]);
  });
});

describe('buildPlan: dialects (FR-007…FR-009)', () => {
  it('decides the outcome from the deck and the import', () => {
    expect(dialectOutcome('mysql', TARGET)).toEqual({ outcome: 'set', setDialect: 'mysql' });
    expect(dialectOutcome('mysql', { ...TARGET, deckHasTables: true })).toEqual({
      outcome: 'keep-generic',
      setDialect: null,
    });
    expect(dialectOutcome('mysql', { ...TARGET, deckDialect: 'postgres' })).toEqual({
      outcome: 'convert',
      setDialect: null,
    });
    expect(dialectOutcome('postgres', { ...TARGET, deckDialect: 'postgres' })).toEqual({
      outcome: 'same',
      setDialect: null,
    });
    expect(dialectOutcome(null, { ...TARGET, deckDialect: 'postgres' })).toEqual({
      outcome: 'same',
      setDialect: null,
    });
    expect(dialectOutcome('sqlite', { ...TARGET, kind: 'new-deck' })).toEqual({
      outcome: 'set',
      setDialect: 'sqlite',
    });
  });

  it('converts common types to the deck dialect and lists every conversion and kept type', () => {
    const result = plan(
      {
        tables: [
          table('t', [
            col('a', 'datetime'),
            col('b', 'datetime'),
            col('c', 'varchar(20)'),
            col('d', 'int unsigned'),
          ]),
        ],
      },
      { deckDialect: 'postgres', deckHasTables: true },
      'mysql',
    );
    expect(result.fragment.deck.nodes[0]?.columns?.map((c) => [c.type, c.size])).toEqual([
      ['timestamp', undefined],
      ['timestamp', undefined],
      ['varchar', '20'],
      ['int unsigned', undefined],
    ]);
    expect(result.conversions).toEqual([{ from: 'datetime', to: 'timestamp', count: 2 }]);
    expect(result.report.changed.map((c) => [c.kind, c.detail])).toEqual([
      ['type-converted', 'datetime → timestamp (2 columns)'],
      ['type-kept', 'int unsigned kept as written (1 column)'],
    ]);
  });

  it('keeps types as written on a Generic deck with tables', () => {
    const result = plan(
      { tables: [table('t', [col('a', 'datetime')])] },
      { deckHasTables: true },
      'mysql',
    );
    expect(result.dialectOutcome).toBe('keep-generic');
    expect(result.fragment.deck.nodes[0]?.columns?.[0]?.type).toBe('datetime');
  });
});

describe('helpers', () => {
  it('splits sizes out of types', () => {
    expect(splitType('VARCHAR(255)')).toEqual({ type: 'varchar', size: '255' });
    expect(splitType("enum('a','b')")).toEqual({ type: "enum('a','b')" });
    expect(splitType('text[]')).toEqual({ type: 'text[]' });
  });

  it('normalises hex colours', () => {
    expect(hexColour('#ABC')).toBe('#aabbcc');
    expect(hexColour('#3498DB')).toBe('#3498db');
    expect(hexColour('red')).toBeUndefined();
  });

  it('groups types into families', () => {
    expect(typeFamily('bigint unsigned')).toBe('integer');
    expect(typeFamily('character varying')).toBe('text');
    expect(typeFamily('uuid')).toBe('uuid');
    expect(typeFamily('jsonb')).toBe('other');
  });

  it('allocates ids per prefix', () => {
    const allocate = createAllocator();
    expect([allocate('node'), allocate('node'), allocate('edge')]).toEqual([
      'node.1',
      'node.2',
      'edge.1',
    ]);
  });
});
