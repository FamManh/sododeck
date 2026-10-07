import type { DbColumn, DbEnum } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from './export/text-measure';
import type { TableContext } from './table-keys';
import {
  effectiveDetail,
  rowAnchorY,
  rowAtSlot,
  withForcedRows,
  withNewRow,
  withFilter,
  withFilterOf,
  cachedTableLayout,
  tableLayout,
  TABLE_CARD,
  type TableNode,
} from './table-layout';

// 0.6 em per character: Geist 12 → 7.2 px, Mono 11 → 6.6 px; a 240 card has 214 inside.
const measure = fixedWidthMeasurer(0.6);

const col = (id: string, extra: Partial<DbColumn> = {}): DbColumn => ({
  id,
  name: id,
  type: 'uuid',
  notNull: true,
  ...extra,
});

/** The "orders" table of frame 156: 7 columns, 2 indexes. */
const orders: TableNode = {
  id: 'orders',
  title: 'orders',
  columns: [
    col('id', { pk: true }),
    col('customer_id'),
    col('number', { type: 'text', unique: true }),
    col('status', { type: 'order_status', enumRef: 'e-status' }),
    col('coupon_code', { type: 'text', notNull: false }),
    col('total_cents', { type: 'int' }),
    col('created_at', { type: 'timestamptz' }),
  ],
  indexes: [
    { id: 'i1', columns: ['id'] },
    { id: 'i2', columns: ['number'] },
  ],
};

const status: DbEnum = { id: 'e-status', name: 'order_status', color: 'violet', values: [] };

function context(over: Partial<TableContext['display']> = {}, extra: Partial<TableContext> = {}) {
  return {
    fk: new Map([['orders', new Set(['customer_id'])]]),
    showSchema: false,
    enums: new Map([[status.id, status]]),
    display: {
      detail: 'auto',
      hideTypes: false,
      hideNullable: false,
      hideNotes: false,
      hideIndexes: false,
      ...over,
    },
    ...extra,
  } satisfies TableContext;
}

const layout = (node: TableNode, ctx: TableContext = context(), width?: number) =>
  tableLayout(node, ctx, width, measure);

// 12 + header 24 + 8 + title 18.
const TOP = 62;

describe('tableLayout heights (041 FR-003, FR-016)', () => {
  it('All (and Auto): every row, the footer and the bottom', () => {
    expect(layout(orders).height).toBe(TOP + 8 + 7 * 24 + 24 + 8);
    expect(layout(orders).rows).toHaveLength(7);
    expect(layout(orders, context({ detail: 'all' })).height).toBe(layout(orders).height);
  });

  it('Keys: key rows in stored order, then the "+n columns" pill', () => {
    const keys = layout(orders, context({ detail: 'keys' }));
    expect(keys.rows.map((r) => r.columnId)).toEqual(['id', 'customer_id']);
    expect(keys.hidden).toEqual({ count: 5, kind: 'more' });
    expect(keys.height).toBe(TOP + 8 + 2 * 24 + 6 + 24 + 24 + 8);
  });

  it('Keys on a table without keys: title and "+n columns" only', () => {
    const plain = { ...orders, id: 'plain', columns: [col('a'), col('b')], indexes: [] };
    const keys = layout(plain, context({ detail: 'keys' }));
    expect(keys.rows).toEqual([]);
    expect(keys.hidden).toEqual({ count: 2, kind: 'more' });
    expect(keys.height).toBe(TOP + 8 + 24 + 8);
  });

  it('Names: title and a footer row with "n columns"', () => {
    const names = layout({ ...orders, detail: 'names' });
    expect(names.rows).toEqual([]);
    expect(names.hidden).toEqual({ count: 7, kind: 'all' });
    expect(names.height).toBe(TOP + 8 + 24 + 8);
  });

  it('the table’s own detail wins over the deck’s', () => {
    expect(layout({ ...orders, detail: 'all' }, context({ detail: 'keys' })).rows).toHaveLength(7);
    expect(effectiveDetail(undefined, 'auto')).toBe('all');
    expect(effectiveDetail(undefined, 'names')).toBe('names');
    expect(effectiveDetail('keys', 'all')).toBe('keys');
  });

  it('an empty table has no hairline, rows or footer', () => {
    const empty = layout({
      id: 'e',
      title: 'empty',
      columns: [],
      indexes: [{ id: 'i', columns: [{ expr: 'x' }] }],
    });
    expect(empty.hasBody).toBe(false);
    expect(empty.footer).toBeUndefined();
    expect(empty.height).toBe(TOP + 12);
  });

  it('a table note never changes the height or the rows (064 FR-005a)', () => {
    const one = layout({ ...orders, description: 'One row per checkout.' });
    expect(one.height).toBe(layout(orders).height);
    expect(one.rowsTop).toBe(layout(orders).rowsTop);
    const long = layout({ ...orders, description: 'word '.repeat(80) });
    expect(long.height).toBe(layout(orders).height);
  });

  it('flags a table note: noted always, hasNote only while note icons show', () => {
    const noted = { ...orders, description: 'Placed orders' };
    expect(layout(noted).noted).toBe(true);
    expect(layout(noted).hasNote).toBe(true);
    expect(layout(noted, context({ hideNotes: true })).noted).toBe(true);
    expect(layout(noted, context({ hideNotes: true })).hasNote).toBe(false);
    const blank = layout({ ...orders, description: '  ' });
    expect(blank.noted).toBe(false);
    expect(blank.hasNote).toBe(false);
  });

  it('flags rows with a note or with information the row cannot show (064 R1)', () => {
    const table: TableNode = {
      ...orders,
      columns: [
        col('id', { pk: true }),
        col('email', { type: 'text', note: 'Used for sign-in' }),
        col('blank_note', { type: 'text', note: ' ' }),
        col('a_very_long_column_name_that_cannot_fit_on_the_row', { type: 'text' }),
        col('kind', { type: 'character varying', size: '255, 12345678901234' }),
        col('created_at', { type: 'timestamptz', default: 'now()' }),
        col('total', { type: 'int', check: 'total > 0' }),
        col('serial', { type: 'int', increment: true }),
      ],
    };
    const rows = layout(table).rows;
    const by = (id: string) => rows.find((r) => r.columnId === id);
    expect(by('id')?.hidden).toBe(false);
    expect(by('id')?.hasNote).toBe(false);
    expect(by('email')?.hidden).toBe(true);
    expect(by('email')?.hasNote).toBe(true);
    expect(by('blank_note')?.hidden).toBe(false);
    expect(by('a_very_long_column_name_that_cannot_fit_on_the_row')?.hidden).toBe(true);
    expect(by('kind')?.typeCut).toBe(true);
    expect(by('kind')?.hidden).toBe(true);
    expect(by('created_at')?.hidden).toBe(true);
    expect(by('total')?.hidden).toBe(true);
    expect(by('serial')?.hidden).toBe(true);
    const hiddenIcons = layout(table, context({ hideNotes: true })).rows;
    expect(hiddenIcons.find((r) => r.columnId === 'email')?.hasNote).toBe(false);
    expect(hiddenIcons.find((r) => r.columnId === 'email')?.hidden).toBe(true);
  });

  it('reserves room for the note icon in the name', () => {
    const name = 'abcdefghijklmnopqrstu';
    const plain = layout({ ...orders, columns: [col(name, { type: 'int' })] }).rows[0];
    const noted = layout({ ...orders, columns: [col(name, { type: 'int', note: 'n' })] }).rows[0];
    expect(plain?.nameCut).toBe(false);
    expect(noted?.nameCut).toBe(true);
  });

  it('applies the four display toggles', () => {
    const noted = { ...orders, description: 'A note.' };
    expect(layout(noted, context({ hideNotes: true })).height).toBe(layout(orders).height);
    expect(layout(orders, context({ hideIndexes: true })).footer).toBeUndefined();
    expect(layout(orders, context({ hideIndexes: true })).height).toBe(layout(orders).height - 24);
    const noTypes = layout(orders, context({ hideTypes: true }));
    expect(noTypes.rows.every((r) => r.type === undefined && r.enum === undefined)).toBe(true);
    const noNull = layout(orders, context({ hideNullable: true }));
    expect(noNull.rows.some((r) => r.nullable)).toBe(false);
  });

  it('uses a stored width and ignores a stored height', () => {
    const sized = { ...orders, size: { width: 300, height: 40 } };
    expect(layout(sized).width).toBe(300);
    expect(layout(sized).height).toBe(layout(orders).height);
  });
});

describe('tableLayout rows (041 FR-005–FR-009)', () => {
  const rows = layout(orders).rows;
  const row = (id: string) => rows.find((r) => r.columnId === id);

  it('derives glyphs: PK, FK, unique on non-key columns only', () => {
    expect(row('id')?.glyphs).toEqual(['pk']);
    expect(row('customer_id')?.glyphs).toEqual(['fk']);
    expect(row('number')?.glyphs).toEqual(['unique']);
    expect(row('total_cents')?.glyphs).toEqual([]);
    expect(layout(orders).keySlot).toBe(16);
    const both = { ...orders, columns: [col('customer_id', { pk: true, unique: true })] };
    expect(layout(both).rows[0]?.glyphs).toEqual(['pk', 'fk']);
    expect(layout(both).keySlot).toBe(30);
  });

  it('marks nullable when neither not-null nor primary key', () => {
    expect(row('coupon_code')?.nullable).toBe(true);
    expect(row('id')?.nullable).toBe(false);
    const loosePk = { ...orders, columns: [col('id', { pk: true, notNull: false })] };
    expect(layout(loosePk).rows[0]?.nullable).toBe(false);
  });

  it('draws an enum chip with the enum colour, neutral without one, type text when missing', () => {
    expect(row('status')?.enum).toEqual({
      id: 'e-status',
      name: 'order_status',
      text: 'order_status',
      color: 'violet',
    });
    expect(row('status')?.type).toBeUndefined();
    const neutral = context(
      {},
      { enums: new Map([['e-status', { ...status, color: undefined }]]) },
    );
    expect(layout(orders, neutral).rows[3]?.enum?.color).toBeUndefined();
    const missing = layout(orders, context({}, { enums: new Map() })).rows[3];
    expect(missing?.enum).toBeUndefined();
    expect(missing?.type).toBe('order_status');
  });

  it('shows the type with its size', () => {
    const sized = { ...orders, columns: [col('email', { type: 'varchar', size: '255' })] };
    expect(layout(sized).rows[0]?.type).toBe('varchar(255)');
  });

  it('cuts the type at 58 % of the row, then the name', () => {
    const long = {
      ...orders,
      columns: [col('a_very_long_column_name_here', { type: 'a_type_name_that_is_far_too_long' })],
    };
    const [r] = layout(long).rows;
    expect(r?.typeCut).toBe(true);
    expect(r?.typeText?.endsWith('…')).toBe(true);
    expect(r?.typeWidth).toBeLessThanOrEqual(214 * 0.58);
    expect(r?.nameCut).toBe(true);
    expect(r?.nameText.endsWith('…')).toBe(true);
    expect(r?.name).toBe('a_very_long_column_name_here');
    expect(row('id')?.nameCut).toBe(false);
  });

  it('cuts a long title (tooltip) and counts the footer', () => {
    expect(layout({ ...orders, title: 'x'.repeat(40) }).titleCut).toBe(true);
    expect(layout(orders).titleCut).toBe(false);
    expect(layout(orders).footer).toBe('2 indexes');
    expect(layout({ ...orders, indexes: [{ id: 'i', columns: ['id'] }] }).footer).toBe('1 index');
  });

  it('names the schema only when the deck has two or more', () => {
    const inPublic = { ...orders, schema: 'public' };
    expect(layout(inPublic).typeName).toBe('Table');
    expect(layout(inPublic, context({}, { showSchema: true })).typeName).toBe('Table · public');
    expect(layout(orders, context({}, { showSchema: true })).typeName).toBe('Table');
  });
});

describe('rowAnchorY and connected rows (042 R2, R15)', () => {
  // Rows start below the title, the 8 px body gap: 62 + 8.
  const ROWS = TOP + 8;

  it('exposes the rows top, the title centre and the pill top', () => {
    const all = layout(orders);
    expect(all.rowsTop).toBe(ROWS);
    expect(all.titleCenter).toBe(12 + 24 + 8 + 9);
    expect(all.pillTop).toBeUndefined();
    const keys = layout(orders, context({ detail: 'keys' }));
    expect(keys.pillTop).toBe(ROWS + 2 * 24 + 6);
    const plain = { ...orders, id: 'plain', columns: [col('a'), col('b')], indexes: [] };
    expect(layout(plain, context({ detail: 'keys' })).pillTop).toBe(ROWS);
  });

  it('keeps the rows where they are with a note', () => {
    const noted = layout({ ...orders, description: 'Placed orders' });
    expect(noted.rowsTop).toBe(ROWS);
  });

  it('returns the row centre at All and Keys', () => {
    const all = layout(orders);
    expect(rowAnchorY(all, 'id')).toEqual({ y: ROWS + 12, kind: 'row' });
    expect(rowAnchorY(all, 'total_cents')).toEqual({ y: ROWS + 5 * 24 + 12, kind: 'row' });
    const keys = layout(orders, context({ detail: 'keys' }));
    expect(rowAnchorY(keys, 'customer_id')).toEqual({ y: ROWS + 24 + 12, kind: 'row' });
  });

  it('falls back to the "+n" pill for a hidden column and the title at Names', () => {
    const keys = layout(orders, context({ detail: 'keys' }));
    expect(rowAnchorY(keys, 'total_cents')).toEqual({ y: ROWS + 2 * 24 + 6 + 12, kind: 'pill' });
    const names = layout({ ...orders, detail: 'names' });
    expect(rowAnchorY(names, 'id')).toEqual({ y: 12 + 24 + 8 + 9, kind: 'title' });
  });

  it('uses the title for a column id that does not exist', () => {
    expect(rowAnchorY(layout(orders), 'gone')).toEqual({ y: 12 + 24 + 8 + 9, kind: 'title' });
  });

  it('keeps connected rows at Keys and leaves them out of the hidden count', () => {
    const ctx = context(
      { detail: 'keys' },
      { connected: new Map([['orders', new Set(['customer_id', 'number'])]]) },
    );
    const keys = layout(orders, ctx);
    expect(keys.rows.map((r) => r.columnId)).toEqual(['id', 'customer_id', 'number']);
    expect(keys.hidden).toEqual({ count: 4, kind: 'more' });
    expect(rowAnchorY(keys, 'number')).toEqual({ y: ROWS + 2 * 24 + 12, kind: 'row' });
  });
});

describe('new-row editor slot (043 R3)', () => {
  it('makes the table one row taller and shifts the rows below the insertion index', () => {
    const before = tableLayout(orders, context(), 240, measure);
    const after = tableLayout(withNewRow({ ...orders }, 2), context(), 240, measure);
    expect(after.newRowIndex).toBe(2);
    expect(after.height).toBe(before.height + TABLE_CARD.rowHeight);
    expect(rowAnchorY(after, 'customer_id')).toEqual(rowAnchorY(before, 'customer_id'));
    expect(rowAnchorY(after, 'number').y).toBe(
      rowAnchorY(before, 'number').y + TABLE_CARD.rowHeight,
    );
    expect(rowAnchorY(after, 'created_at').y).toBe(
      rowAnchorY(before, 'created_at').y + TABLE_CARD.rowHeight,
    );
  });

  it('clamps the index to the end and finds rows by slot around it', () => {
    const layout = tableLayout(withNewRow({ ...orders }, 99), context(), 240, measure);
    expect(layout.newRowIndex).toBe(7);
    const mid = tableLayout(withNewRow({ ...orders }, 1), context(), 240, measure);
    expect(rowAtSlot(mid, 0)?.columnId).toBe('id');
    expect(rowAtSlot(mid, 1)).toBeUndefined();
    expect(rowAtSlot(mid, 2)?.columnId).toBe('customer_id');
  });

  it('draws a body for a table without columns while a new row is open', () => {
    const empty: TableNode = { id: 'e', title: 'e', columns: [] };
    expect(tableLayout(empty, context(), 240, measure).hasBody).toBe(false);
    const open = tableLayout(withNewRow({ ...empty }, 0), context(), 240, measure);
    expect(open.hasBody).toBe(true);
    expect(open.newRowIndex).toBe(0);
  });
});

describe('forced rows: columns the current step touches (049 R3, FR-011)', () => {
  const ROWS = TOP + 8;

  it('keeps a touched column at Keys, in stored order, and counts only the truly hidden', () => {
    const keys = tableLayout(
      orders,
      context({ detail: 'keys' }),
      undefined,
      measure,
      new Set(['total_cents']),
    );
    expect(keys.rows.map((r) => r.columnId)).toEqual(['id', 'customer_id', 'total_cents']);
    expect(keys.hidden).toEqual({ count: 4, kind: 'more' });
    expect(keys.hiddenIds.has('total_cents')).toBe(false);
    expect(keys.height).toBe(TOP + 8 + 3 * 24 + 6 + 24 + 24 + 8);
    expect(rowAnchorY(keys, 'total_cents')).toEqual({ y: ROWS + 2 * 24 + 12, kind: 'row' });
  });

  it('draws touched rows at Names, the rest as "+n columns"', () => {
    const names = tableLayout(
      { ...orders, detail: 'names' },
      context(),
      undefined,
      measure,
      new Set(['status']),
    );
    expect(names.rows.map((r) => r.columnId)).toEqual(['status']);
    expect(names.hidden).toEqual({ count: 6, kind: 'more' });
  });

  it('reads the mark a projection put on the node', () => {
    const node = withForcedRows({ ...orders }, new Set(['created_at']));
    const keys = layout(node, context({ detail: 'keys' }));
    expect(keys.rows.map((r) => r.columnId)).toContain('created_at');
    expect(layout(orders, context({ detail: 'keys' })).rows.map((r) => r.columnId)).not.toContain(
      'created_at',
    );
  });

  it('changes nothing at All', () => {
    expect(tableLayout(orders, context(), undefined, measure, new Set(['id'])).rows).toHaveLength(
      7,
    );
  });
});

describe('row limit at All (048 FR-001, FR-002, FR-003)', () => {
  const wide = (n: number, extra: Partial<TableNode> = {}): TableNode => ({
    id: 'wide',
    title: 'wide',
    columns: [
      ...Array.from({ length: n }, (_, i) =>
        col(`c${String(i + 1)}`, i === 40 ? { pk: true } : {}),
      ),
    ],
    ...extra,
  });
  const ctx = (fk: string[] = [], connected: string[] = []) =>
    context(
      { detail: 'all' },
      { fk: new Map([['wide', new Set(fk)]]), connected: new Map([['wide', new Set(connected)]]) },
    );
  const ids = (l: ReturnType<typeof layout>) => l.rows.map((r) => r.columnId);

  it('shows keys first (PK, then FK), then the rest, up to 12, drawn in stored order', () => {
    const l = layout(wide(60), ctx(['c30', 'c50']));
    expect(l.rows).toHaveLength(12);
    expect(ids(l)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
      'c6',
      'c7',
      'c8',
      'c9',
      'c30',
      'c41',
      'c50',
    ]);
    expect(l.hidden).toEqual({ count: 48, kind: 'limit' });
    expect(l.button).toMatchObject({ label: 'Show all 60 columns', expanded: false });
  });

  it('never cuts a relationship end: the card may show more than 12 rows', () => {
    const l = layout(wide(60), ctx([], ['c55']));
    expect(l.rows).toHaveLength(13);
    expect(ids(l)).toContain('c55');
    expect(l.hidden).toEqual({ count: 47, kind: 'limit' });
  });

  it('draws no button for exactly 12 rows, or 13 columns with one connected', () => {
    expect(layout(wide(12), ctx()).button).toBeUndefined();
    expect(layout(wide(12), ctx()).hidden).toBeUndefined();
    const thirteen = layout(wide(13), ctx([], ['c13']));
    expect(thirteen.rows).toHaveLength(13);
    expect(thirteen.button).toBeUndefined();
    expect(thirteen.hidden).toBeUndefined();
  });

  it('shows every row and "Show fewer" when the table is opened', () => {
    const l = layout(wide(60, { expanded: true }), ctx());
    expect(l.rows).toHaveLength(60);
    expect(l.hidden).toBeUndefined();
    expect(l.button).toMatchObject({ label: 'Show fewer', expanded: true });
  });

  it('adds the button slot (6 above, 24 tall) to the height', () => {
    const l = layout(wide(60), ctx());
    expect(l.height).toBe(TOP + 8 + 12 * 24 + 6 + 24 + 8);
    expect(l.button?.top).toBe(TOP + 8 + 12 * 24 + 6);
    const open = layout(wide(60, { expanded: true }), ctx());
    expect(open.height).toBe(TOP + 8 + 60 * 24 + 6 + 24 + 8);
  });

  it('leaves Names and Keys unchanged and lets the own detail win', () => {
    const keys = layout(wide(60), context({ detail: 'keys' }));
    expect(keys.hidden?.kind).toBe('more');
    expect(keys.button).toBeUndefined();
    const names = layout(wide(60, { detail: 'names' }));
    expect(names.hidden?.kind).toBe('all');
    expect(names.button).toBeUndefined();
    const own = layout(wide(60, { detail: 'all' }), context({ detail: 'keys' }));
    expect(own.hidden?.kind).toBe('limit');
  });

  it('anchors a hidden column at the button centre and a drawn one at its row', () => {
    const l = layout(wide(60), ctx());
    expect(rowAnchorY(l, 'c40')).toEqual({ y: (l.button?.top ?? 0) + 12, kind: 'pill' });
    const open = layout(wide(60, { expanded: true }), ctx());
    expect(rowAnchorY(open, 'c40')).toEqual({ y: open.rowsTop + 39 * 24 + 12, kind: 'row' });
    // A column that was drawn keeps its row position before and after opening.
    expect(rowAnchorY(l, 'c3').y).toBe(rowAnchorY(open, 'c3').y);
  });
});

describe('column filter projection (048 FR-010, R4)', () => {
  const names = (n: number): TableNode => ({
    id: 'wide',
    title: 'wide',
    columns: Array.from({ length: n }, (_, i) =>
      col(`c${String(i + 1)}`, { name: i === 44 ? 'Invoice_ID' : `field_${String(i + 1)}` }),
    ),
  });
  const ctx = (connected: string[] = []) =>
    context(
      { detail: 'all' },
      { fk: new Map(), connected: new Map([['wide', new Set(connected)]]) },
    );
  const ids = (l: ReturnType<typeof tableLayout>) => l.rows.map((r) => r.columnId);
  const filtered = (node: TableNode, text: string, c = ctx()) =>
    tableLayout(withFilter({ ...node }, text), c, 240, measure);

  it('shows a match beyond the limit, case-insensitive, and folds the rest behind the button', () => {
    const l = filtered(names(60), 'invoice');
    expect(ids(l)).toEqual(['c45']);
    expect([...l.matchIds]).toEqual(['c45']);
    expect(l.hidden).toEqual({ count: 59, kind: 'limit' });
    expect(l.button).toMatchObject({ label: 'Show all 60 columns' });
  });

  it('keeps relationship ends visible among the matches', () => {
    const l = filtered(names(60), 'invoice', ctx(['c3']));
    expect(ids(l)).toEqual(['c3', 'c45']);
    expect([...l.matchIds]).toEqual(['c45']);
  });

  it('no match shows only connected rows; matches are not capped at 12', () => {
    expect(filtered(names(60), 'zzz').rows).toHaveLength(0);
    expect(filtered(names(60), 'field_').rows).toHaveLength(59);
  });

  it('works at Keys and Names details too, and ignores blank text', () => {
    const keys = tableLayout(
      withFilter({ ...names(60) }, 'invoice'),
      context({ detail: 'keys' }),
      240,
      measure,
    );
    expect(ids(keys)).toEqual(['c45']);
    const blank = filtered(names(60), '  ');
    expect(blank.rows).toHaveLength(12);
    expect(blank.matchIds.size).toBe(0);
  });

  it('height follows the folded rows; the unfiltered layout is restored exactly', () => {
    const node = names(60);
    const shared = ctx();
    const plain = cachedTableLayout(node, shared);
    const l = filtered(node, 'invoice', shared);
    expect(l.height).toBe(TOP + 8 + 24 + 6 + 24 + 8);
    expect(cachedTableLayout(node, shared)).toBe(plain);
  });

  it('withFilterOf carries the mark to a copy', () => {
    const marked = withFilter({ ...names(60) }, 'invoice');
    const copy = withFilterOf(marked, { ...marked, title: '' });
    expect(tableLayout(copy, ctx(), 240, measure).rows).toHaveLength(1);
  });
});
