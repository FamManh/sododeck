import type { DbColumn, DbEnum, Node, SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  columnLinePatch,
  formatColumnLine,
  lineError,
  lineErrorText,
  newColumnData,
  NO_TYPE,
  parseColumnLine,
  typeTokenStart,
  type ParsedColumnLine,
} from './column-line';
import { edgeCaseDeck, nameClashDeck } from './fixtures/export-edge-cases';
import { shopDeck } from './fixtures/shop';

const ORDER_STATUS: DbEnum = {
  id: 'enum.order_status',
  name: 'order_status',
  values: [{ id: 'enum.order_status.pending', name: 'pending' }],
};
const BILLING_STATE: DbEnum = {
  id: 'enum.billing_state',
  name: 'state',
  schema: 'billing',
  values: [],
};
const ENUMS = [ORDER_STATUS, BILLING_STATE];

const parse = (text: string) => parseColumnLine(text, { enums: ENUMS });

/** The fields a line can express, for comparing a parse result with a column. */
function lineFields(c: Partial<Omit<ParsedColumnLine, 'tokens' | 'ignored' | 'hints'>>) {
  return {
    name: c.name,
    type: c.type,
    size: c.size,
    pk: c.pk,
    notNull: c.notNull,
    unique: c.unique,
    increment: c.increment,
    default: c.default,
    defaultExpr: c.defaultExpr,
    enumRef: c.enumRef,
  };
}

describe('parseColumnLine: contract examples', () => {
  it('email text unique not null', () => {
    expect(lineFields(parse('email text unique not null'))).toEqual(
      lineFields({ name: 'email', type: 'text', unique: true, notNull: true }),
    );
  });

  it("status order_status not null default 'pending'", () => {
    const p = parse("status order_status not null default 'pending'");
    expect(lineFields(p)).toEqual(
      lineFields({
        name: 'status',
        type: 'order_status',
        enumRef: 'enum.order_status',
        notNull: true,
        default: 'pending',
      }),
    );
  });

  it('price numeric(10,2) not null default 0', () => {
    expect(lineFields(parse('price numeric(10,2) not null default 0'))).toEqual(
      lineFields({ name: 'price', type: 'numeric', size: '10,2', notNull: true, default: 0 }),
    );
  });

  it('created_at timestamptz default now()', () => {
    expect(lineFields(parse('created_at timestamptz default now()'))).toEqual(
      lineFields({ name: 'created_at', type: 'timestamptz', defaultExpr: 'now()' }),
    );
  });

  it('id int pk increment', () => {
    expect(lineFields(parse('id int pk increment'))).toEqual(
      lineFields({ name: 'id', type: 'int', pk: true, increment: true }),
    );
  });

  it('email text sparkly', () => {
    const p = parse('email text sparkly');
    expect(p.ignored).toEqual(['sparkly']);
    expect(lineFields(p)).toEqual(lineFields({ name: 'email', type: 'text' }));
  });

  it('customer_id uuid ref customers.id', () => {
    const p = parse('customer_id uuid ref customers.id');
    expect(p.ignored).toEqual(['ref', 'customers.id']);
    expect(lineFields(p)).toEqual(lineFields({ name: 'customer_id', type: 'uuid' }));
  });

  it('notes', () => {
    const p = parse('notes');
    expect(lineFields(p)).toEqual(lineFields({ name: 'notes' }));
    expect(p.type).toBeUndefined();
  });
});

describe('parseColumnLine: grammar', () => {
  it('gives an empty name for a blank line', () => {
    expect(parse('').name).toBe('');
    expect(parse('   ').name).toBe('');
    expect(parse('   ').tokens).toEqual([]);
  });

  it('reads quoted names without the quotes', () => {
    expect(lineFields(parse('"order date" date not null'))).toEqual(
      lineFields({ name: 'order date', type: 'date', notNull: true }),
    );
    expect(parse("'line note' text").name).toBe('line note');
    expect(parse('"say ""hi""" text').name).toBe('say "hi"');
  });

  it('takes the second word as the type, even a keyword-looking one', () => {
    expect(parse('created date').type).toBe('date');
    expect(parse('flag null').type).toBe('null');
    expect(parse('id pk').pk).toBeUndefined();
  });

  it('splits a size from the type', () => {
    expect(parse('price numeric(10,2)')).toMatchObject({ type: 'numeric', size: '10,2' });
    expect(parse('price numeric(10, 2)')).toMatchObject({ type: 'numeric', size: '10,2' });
    expect(parse('email varchar(255)')).toMatchObject({ type: 'varchar', size: '255' });
  });

  it('ignores a type token whose size is invalid', () => {
    for (const line of ['a varchar(abc)', 'a varchar(1234567)', 'a numeric(1,2,3)', 'a x()']) {
      const p = parse(line);
      expect(p.type, line).toBeUndefined();
      expect(p.size, line).toBeUndefined();
      expect(p.ignored, line).toEqual([line.slice(2)]);
    }
  });

  it('accepts schema-qualified types', () => {
    expect(parse('state billing.state')).toMatchObject({
      type: 'billing.state',
      enumRef: 'enum.billing_state',
    });
    expect(parse('kind public.kind')).toMatchObject({ type: 'public.kind' });
    expect(parse('kind public.kind').enumRef).toBeUndefined();
  });

  it('matches enums case-insensitively by name or schema.name', () => {
    expect(parse('s ORDER_STATUS').enumRef).toBe('enum.order_status');
    expect(parse('s Billing.State').enumRef).toBe('enum.billing_state');
    // A schema-qualified enum is also known by its bare name.
    expect(parse('s state').enumRef).toBe('enum.billing_state');
    expect(parse('s text').enumRef).toBeUndefined();
  });

  it('reads keywords case-insensitively', () => {
    expect(lineFields(parse('id INT PRIMARY KEY Not Null UNIQUE AutoIncrement'))).toEqual(
      lineFields({
        name: 'id',
        type: 'INT',
        pk: true,
        notNull: true,
        unique: true,
        increment: true,
      }),
    );
    expect(parse('id int auto_increment').increment).toBe(true);
    expect(parse('id int autoincrement').increment).toBe(true);
  });

  it('ignores half a two-word keyword', () => {
    expect(parse('a int primary').ignored).toEqual(['primary']);
    expect(parse('a int not').ignored).toEqual(['not']);
    expect(parse('a int not unique')).toMatchObject({ unique: true, ignored: ['not'] });
  });

  it('lets the last of null / not null win, with only its chip', () => {
    const a = parse('a text not null null');
    expect(a.notNull).toBeUndefined();
    expect(a.tokens.filter((t) => t.kind === 'flag').map((t) => t.text)).toEqual(['null']);
    const b = parse('a text null not null');
    expect(b.notNull).toBe(true);
    expect(b.tokens.filter((t) => t.kind === 'flag').map((t) => t.text)).toEqual(['not null']);
  });

  it('gives a hint for default with no value, and ignores it', () => {
    const p = parse('a text default');
    expect(p.hints).toEqual(['default needs a value']);
    expect(p.default).toBeUndefined();
    expect(p.defaultExpr).toBeUndefined();
    expect(p.ignored).toEqual(['default']);
  });

  it('reads default values as data', () => {
    expect(parse("a text default 'pending'").default).toBe('pending');
    expect(parse('a text default "pending"').default).toBe('pending');
    expect(parse("a text default 'it''s'").default).toBe("it's");
    expect(parse("a text default ''").default).toBe('');
    expect(parse("a text default '0'").default).toBe('0');
    expect(parse('a int default 0').default).toBe(0);
    expect(parse('a int default -12.5').default).toBe(-12.5);
    expect(parse('a bool default true').default).toBe(true);
    expect(parse('a bool default FALSE').default).toBe(false);
  });

  it('reads default null as no default', () => {
    const p = parse('a text not null default null');
    expect(p.default).toBeUndefined();
    expect(p.defaultExpr).toBeUndefined();
    expect(p.notNull).toBe(true);
    expect(p.ignored).toEqual([]);
  });

  it('reads default expressions', () => {
    expect(parse('a timestamptz default now()').defaultExpr).toBe('now()');
    expect(parse('a uuid default gen_random_uuid()').defaultExpr).toBe('gen_random_uuid()');
    expect(parse('a timestamp default current_timestamp').defaultExpr).toBe('current_timestamp');
    expect(parse("a int default (length('a b'))").defaultExpr).toBe("(length('a b'))");
    const p = parse('a timestamptz default now()');
    expect(p.default).toBeUndefined();
  });

  it('lets the last default win', () => {
    const p = parse('a int default 1 default now()');
    expect(p.default).toBeUndefined();
    expect(p.defaultExpr).toBe('now()');
    expect(p.tokens.filter((t) => t.kind === 'default').map((t) => t.text)).toEqual([
      'default now()',
    ]);
  });

  it('sends ref, references, > and unknown words to ignored', () => {
    expect(parse('a int references b.id').ignored).toEqual(['references', 'b.id']);
    expect(parse('a int > b.id').ignored).toEqual(['>', 'b.id']);
    expect(parse("a int 'quoted'").ignored).toEqual(["'quoted'"]);
  });

  it('gives tokens in text order with their ranges', () => {
    const text = "status order_status  not null default 'pending' sparkly";
    const p = parse(text);
    expect(p.tokens.map((t) => [t.kind, t.text])).toEqual([
      ['name', 'status'],
      ['type', 'order_status'],
      ['flag', 'not null'],
      ['default', "default 'pending'"],
      ['ignored', 'sparkly'],
    ]);
    for (const t of p.tokens) expect(text.slice(t.from, t.to)).toBe(t.text);
  });

  it('gives the caret offset of the type token', () => {
    expect(typeTokenStart(parse('price  numeric(10,2)'))).toBe(7);
    expect(typeTokenStart(parse('notes'))).toBeUndefined();
  });

  it('parses a 200-character line in under 1 ms', () => {
    const line =
      `"a long column name" numeric(10,2) primary key not null unique increment default now() ${'sparkly '.repeat(20)}`
        .slice(0, 200)
        .trimEnd();
    expect(line.length).toBeGreaterThan(190);
    for (let i = 0; i < 50; i++) parse(line);
    const runs = 500;
    const start = performance.now();
    for (let i = 0; i < runs; i++) parse(line);
    expect((performance.now() - start) / runs).toBeLessThan(1);
  });
});

describe('formatColumnLine', () => {
  const col = (c: Omit<DbColumn, 'id'>): DbColumn => ({ id: 'c1', ...c });

  it('writes the parts in order', () => {
    expect(
      formatColumnLine(
        col({
          name: 'price',
          type: 'numeric',
          size: '10,2',
          notNull: true,
          unique: true,
          increment: true,
          default: 0,
        }),
        ENUMS,
      ),
    ).toBe('price numeric(10,2) not null unique increment default 0');
  });

  it('writes not null only when the column is not a primary key', () => {
    expect(formatColumnLine(col({ name: 'id', type: 'int', pk: true, notNull: true }), [])).toBe(
      'id int pk',
    );
  });

  it('quotes names with spaces and string defaults', () => {
    expect(formatColumnLine(col({ name: 'order date', type: 'text', default: "it's" }), [])).toBe(
      `"order date" text default 'it''s'`,
    );
  });

  it('writes expressions and booleans bare', () => {
    expect(formatColumnLine(col({ name: 'a', type: 'timestamp', defaultExpr: 'now()' }), [])).toBe(
      'a timestamp default now()',
    );
    expect(formatColumnLine(col({ name: 'a', type: 'bool', default: false }), [])).toBe(
      'a bool default false',
    );
  });

  it('writes a name-only line for a blank type', () => {
    expect(formatColumnLine(col({ name: 'notes', type: NO_TYPE }), [])).toBe('notes');
  });
});

/** Every column of a deck with the enums it can name. */
function columnsOf(deck: SododeckFile): { column: DbColumn; enums: readonly DbEnum[] }[] {
  const enums = deck.enums ?? [];
  return deck.nodes.flatMap((n) => (n.columns ?? []).map((column) => ({ column, enums })));
}

/** What a column says in line terms: blank type is no type, pk implies not null, a stale enumRef is lost. */
function expressible(c: DbColumn, enums: readonly DbEnum[]) {
  return lineFields({
    name: c.name,
    ...(c.type.trim() === '' ? {} : { type: c.type }),
    ...(c.size === undefined ? {} : { size: c.size }),
    ...(c.pk === true ? { pk: true } : {}),
    ...(c.notNull === true && c.pk !== true ? { notNull: true } : {}),
    ...(c.unique === true ? { unique: true } : {}),
    ...(c.increment === true ? { increment: true } : {}),
    ...(c.default === undefined ? {} : { default: c.default }),
    ...(c.defaultExpr === undefined ? {} : { defaultExpr: c.defaultExpr }),
    ...(c.enumRef !== undefined && enums.some((e) => e.id === c.enumRef)
      ? { enumRef: c.enumRef }
      : {}),
  });
}

describe('parse(format(c)) round-trip', () => {
  const decks: [string, SododeckFile][] = [
    ['shop generic', shopDeck('generic')],
    ['shop postgres', shopDeck('postgres')],
    ['shop mysql', shopDeck('mysql')],
    ['shop sqlite', shopDeck('sqlite')],
    ['edge cases', edgeCaseDeck()],
    ['name clash', nameClashDeck()],
  ];

  it.each(decks)('holds for every column (%s)', (_label, deck) => {
    const columns = columnsOf(deck);
    expect(columns.length).toBeGreaterThan(0);
    for (const { column, enums } of columns) {
      const line = formatColumnLine(column, enums);
      const parsed = parseColumnLine(line, { enums });
      expect(lineFields(parsed), line).toEqual(expressible(column, enums));
      expect(parsed.ignored, line).toEqual([]);
    }
  });

  it('holds for awkward values', () => {
    const awkward: DbColumn[] = [
      { id: 'a', name: 'say "hi"', type: 'text', default: 'a "b" \'c\'' },
      { id: 'b', name: 'blank', type: ' ', notNull: true, default: 1 },
      { id: 'c', name: 'n', type: 'numeric', size: '10,2', default: '12' },
      { id: 'd', name: 'e', type: 'text', default: '' },
      { id: 'f', name: 'k', type: 'double precision', unique: true },
    ];
    for (const column of awkward) {
      const line = formatColumnLine(column, []);
      expect(lineFields(parseColumnLine(line, { enums: [] })), line).toEqual(
        expressible(column, []),
      );
    }
  });
});

describe('columnLinePatch', () => {
  const previous: DbColumn = {
    id: 'c1',
    name: 'total',
    type: 'decimal',
    size: '10,2',
    notNull: true,
    unique: true,
    default: 0,
    note: 'Sum of the items',
    check: 'total >= 0',
  };

  it('writes every field of the line and null for removed parts', () => {
    expect(columnLinePatch(previous, parse('total numeric'))).toEqual({
      name: 'total',
      type: 'numeric',
      size: null,
      notNull: null,
      unique: null,
      default: null,
    });
  });

  it('switches between default and defaultExpr', () => {
    expect(
      columnLinePatch(previous, parse('total decimal(10,2) not null unique default now()')),
    ).toEqual({
      name: 'total',
      type: 'decimal',
      size: '10,2',
      notNull: true,
      unique: true,
      default: null,
      defaultExpr: 'now()',
    });
    const withExpr: DbColumn = { id: 'c2', name: 'at', type: 'timestamp', defaultExpr: 'now()' };
    expect(columnLinePatch(withExpr, parse("at timestamp default 'x'"))).toEqual({
      name: 'at',
      type: 'timestamp',
      default: 'x',
      defaultExpr: null,
    });
  });

  it('never touches note, check or id', () => {
    const patch = columnLinePatch(previous, parse('renamed text'));
    expect(patch).not.toHaveProperty('note');
    expect(patch).not.toHaveProperty('check');
    expect(patch).not.toHaveProperty('id');
  });

  it('sets, keeps and clears enumRef', () => {
    const plain: DbColumn = { id: 'c3', name: 'status', type: 'text' };
    expect(columnLinePatch(plain, parse('status order_status'))).toEqual({
      name: 'status',
      type: 'order_status',
      enumRef: 'enum.order_status',
    });
    const linked: DbColumn = { ...plain, type: 'order_status', enumRef: 'enum.order_status' };
    expect(columnLinePatch(linked, parse('status text'))).toEqual({
      name: 'status',
      type: 'text',
      enumRef: null,
    });
    // A stale enumRef stays while the type still names it.
    const stale: DbColumn = { ...plain, type: 'mood', enumRef: 'enum.gone' };
    expect(columnLinePatch(stale, parse('feeling MOOD not null'))).toEqual({
      name: 'feeling',
      type: 'MOOD',
      notNull: true,
    });
  });

  it('keeps not null on a primary key, whose line hides it', () => {
    const id: DbColumn = { id: 'c4', name: 'id', type: 'int', pk: true, notNull: true };
    expect(columnLinePatch(id, parse(formatColumnLine(id, [])))).toEqual({
      name: 'id',
      type: 'int',
      pk: true,
    });
    expect(columnLinePatch(id, parse('id int pk null'))).toEqual({
      name: 'id',
      type: 'int',
      pk: true,
      notNull: null,
    });
  });

  it('writes no nulls for a new column and a blank type for a name-only line', () => {
    expect(columnLinePatch(undefined, parse('notes'))).toEqual({ name: 'notes', type: NO_TYPE });
    expect(newColumnData(parse('id int pk increment'))).toEqual({
      name: 'id',
      type: 'int',
      pk: true,
      increment: true,
    });
    expect(newColumnData(parse('notes'))).toEqual({ name: 'notes', type: NO_TYPE });
  });
});

describe('lineError', () => {
  const table: Pick<Node, 'columns'> = {
    columns: [
      { id: 'c1', name: 'id', type: 'int' },
      { id: 'c2', name: 'Email', type: 'text' },
    ],
  };

  it('returns empty for a blank name', () => {
    expect(lineError(parse('   '), table)).toBe('empty');
    expect(lineError(parse('"  " text'), table)).toBe('empty');
  });

  it('returns taken for a name used by another column, case-insensitively', () => {
    expect(lineError(parse('email text'), table)).toBe('taken');
    expect(lineError(parse('EMAIL text'), table, 'c1')).toBe('taken');
  });

  it('excludes the edited column', () => {
    expect(lineError(parse('email varchar'), table, 'c2')).toBeNull();
    expect(lineError(parse('phone text'), table)).toBeNull();
    expect(lineError(parse('phone text'), {})).toBeNull();
  });

  it('gives the inline messages', () => {
    expect(lineErrorText('empty', '')).toBe('Type a column name');
    expect(lineErrorText('taken', 'email')).toBe('A column named email already exists');
  });
});
