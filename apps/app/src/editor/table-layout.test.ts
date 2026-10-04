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

  it('a note adds up to two lines, cut with an ellipsis', () => {
    const one = layout({ ...orders, description: 'One row per checkout.' });
    expect(one.noteLines).toEqual(['One row per checkout.']);
    expect(one.height).toBe(layout(orders).height + 8 + 17);
    const long = layout({ ...orders, description: 'word '.repeat(80) });
    expect(long.noteLines).toHaveLength(2);
    expect(long.noteCut).toBe(true);
    expect(long.noteLines[1]?.endsWith('…')).toBe(true);
    expect(long.height).toBe(layout(orders).height + 8 + 2 * TABLE_CARD.noteLineHeight);
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

  it('counts the System content: PK, FK (not PK) and columns', () => {
    expect(layout(orders).compact).toEqual({ pkCount: 1, fkCount: 1, columnCount: 7 });
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

  it('moves the rows down by the note', () => {
    const noted = layout({ ...orders, description: 'Placed orders' });
    expect(noted.rowsTop).toBe(ROWS + 8 + 17);
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
