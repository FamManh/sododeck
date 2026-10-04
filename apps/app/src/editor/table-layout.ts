/**
 * The table card's layout (041, research R1): one pure function of the table, its deck context
 * and its width, never of the zoom (R2) and never measured from the DOM (§g-58, ADR 0016). The
 * canvas geometry, `DeckNode` and the export all read it, so boxes, rows and connectors agree.
 *
 * Height = 12 + header 24 + 8 + title 18 + (8 + note lines × 17) + body, where the body (only when
 * the table has columns) is 8 + rows × 24 + ("+n columns" pill or "Show all" button: 6 + 24) +
 * (footer 24) + 8, and a
 * table without columns ends with the card's own 12.
 */
import type { DbColumn, DbDetail, Id, SododeckFile } from '@sododeck/schema';

import { textMeasurer } from './card-tags';
import { wrapText } from './card-layout';
import { truncate, type TextMeasurer } from './export/text-measure';
import { rowKey } from './relationships/row-key';
import type { TableContext } from './table-keys';
import type { DeckTableDetail } from '@sododeck/model';

/** Database tokens (DESIGN.md "Database pack"), shared by the canvas and the export. */
export const TABLE_CARD = {
  width: 240,
  paddingY: 12,
  paddingX: 13,
  gap: 8,
  headerHeight: 24,
  titleLineHeight: 18,
  noteLineHeight: 17,
  maxNoteLines: 2,
  /** Space between the title (or note) and the first row; the hairline sits in its middle. */
  bodyGap: 8,
  rowHeight: 24,
  /** Rows drawn at All before "Show all n columns" (048 FR-001); relationship ends are extra. */
  rowLimit: 12,
  /** Hover fill inset from the card edge. */
  rowInset: 4,
  keySlot: 16,
  keySlotDouble: 30,
  keyGap: 6,
  typeShare: 0.58,
  typeGap: 8,
  nullableGap: 3,
  nullableSlot: 7,
  /** The type mismatch icon (043): 12 px after a 4 px gap. */
  mismatchGap: 4,
  mismatchSlot: 12,
  chipPaddingX: 6,
  chipHeight: 18,
  pillGap: 6,
  pillHeight: 24,
  footerHeight: 24,
  bottom: 8,
  titleFont: "600 14px 'Geist Variable', system-ui, sans-serif",
  noteFont: "400 12px 'Geist Variable', system-ui, sans-serif",
  nameFont: "500 12px 'Geist Variable', system-ui, sans-serif",
  keyNameFont: "600 12px 'Geist Variable', system-ui, sans-serif",
  typeFont: "400 11px 'Geist Mono Variable', ui-monospace, monospace",
} as const;

export type KeyGlyph = 'pk' | 'fk' | 'unique';

export interface TableRow {
  columnId: Id;
  glyphs: readonly KeyGlyph[];
  /** Full name; `nameText` is what fits (with an ellipsis when cut). */
  name: string;
  nameText: string;
  nameCut: boolean;
  /** Full type text, absent when types are hidden or an enum chip stands in its place. */
  type?: string;
  typeText?: string;
  typeCut: boolean;
  nullable: boolean;
  /** An enum column whose enum exists: the chip shows the enum name in its colour. */
  enum?: { id: Id; name: string; text: string; color?: string };
  /** Width the type text or chip takes at the right of the row. */
  typeWidth: number;
  /** "int → uuid · orders.customer_id" when a relationship end's types differ (043 FR-010b). */
  mismatch?: string;
}

export interface TableLayout {
  width: number;
  height: number;
  /** "Table" or "Table · <schema>". */
  typeName: string;
  titleCut: boolean;
  /** Note lines as drawn (0–2); the last ends with an ellipsis when cut. */
  noteLines: readonly string[];
  noteCut: boolean;
  detail: DbDetail;
  /** The table's own detail choice; absent means it follows the deck. */
  ownDetail: DbDetail | undefined;
  keySlot: number;
  /** The fixed "?" slot after the type (absent when the deck hides the nullable marker). */
  showNullable: boolean;
  rows: readonly TableRow[];
  /**
   * Columns not drawn as rows: "+n columns" at Keys, "n columns" at Names, and at All the ones the
   * row limit cut (`limit`, behind the "Show all" button, 048).
   */
  hidden: { count: number; kind: 'more' | 'all' | 'limit' } | undefined;
  /** The "Show all n columns" / "Show fewer" button (048): only at All on a table over the limit. */
  button: { label: string; expanded: boolean; top: number } | undefined;
  /** Columns whose name matches the open filter (048), drawn or not; empty without a filter. */
  matchIds: ReadonlySet<Id>;
  /** Where the new-row editor is drawn (043): its index among `rows`; later rows sit one lower. */
  newRowIndex: number | undefined;
  /** Ids of the columns not drawn as rows (042: their relationship ends anchor on the pill). */
  hiddenIds: ReadonlySet<Id>;
  /** "1 index" / "n indexes", absent without indexes or when hidden. */
  footer: string | undefined;
  /** Top of the first row, from the card's top (042 R2): rows are `rowHeight` apart from here. */
  rowsTop: number;
  /** Top of the "+n columns" pill, absent without one. */
  pillTop: number | undefined;
  /** Vertical centre of the title line, from the card's top. */
  titleCenter: number;
  /** Whether the column body (hairline and what follows) is drawn. */
  hasBody: boolean;
  columnCount: number;
  /** System level content: key dots and the column count. */
  compact: { pkCount: number; fkCount: number; columnCount: number };
}

type Node = SododeckFile['nodes'][number];

/** What `tableLayout` reads of a table node. */
export type TableNode = Pick<Node, 'title'> &
  Partial<
    Pick<
      Node,
      'id' | 'description' | 'schema' | 'columns' | 'indexes' | 'detail' | 'size' | 'expanded'
    >
  >;

const newRows = new WeakMap<TableNode, number>();

/**
 * Marks a projected table node as drawing the new-row editor before column `at` (043 R3): the
 * card grows by one row and the rows below shift, so connectors follow. `node` must be a fresh
 * object owned by the projection, never a document snapshot node.
 */
export function withNewRow<T extends TableNode>(node: T, at: number): T {
  newRows.set(node, at);
  return node;
}

/** `copy` with the new-row mark of `node`, if it has one (a projection copied for a helper). */
export function withNewRowOf<T extends TableNode>(node: object, copy: T): T {
  const at = newRows.get(node as TableNode);
  return at === undefined ? copy : withNewRow(copy, at);
}

const filters = new WeakMap<TableNode, string>();

/**
 * Marks a projected table node as filtered by column name (048 R4): only the columns whose name
 * contains `text` (case-insensitive) and the relationship ends are drawn, the rest fold behind the
 * button. Like `withNewRow`, `node` must be a fresh object owned by the projection.
 */
export function withFilter<T extends TableNode>(node: T, text: string): T {
  filters.set(node, text);
  return node;
}

/** `copy` with the filter mark of `node`, if it has one (a projection copied for a helper). */
export function withFilterOf<T extends TableNode>(node: object, copy: T): T {
  const text = filters.get(node as TableNode);
  return text === undefined ? copy : withFilter(copy, text);
}

/** A table's detail: its own choice, else the deck's; Auto draws every column (R2). */
export function effectiveDetail(own: DbDetail | undefined, deck: DeckTableDetail): DbDetail {
  return own ?? (deck === 'auto' ? 'all' : deck);
}

/** The text a column's type shows: `varchar(255)` when it has a size. */
export function typeText(column: Pick<DbColumn, 'type' | 'size'>): string {
  return column.size === undefined ? column.type : `${column.type}(${column.size})`;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function glyphsOf(column: DbColumn, fk: ReadonlySet<Id>): KeyGlyph[] {
  const glyphs: KeyGlyph[] = [];
  if (column.pk === true) glyphs.push('pk');
  if (fk.has(column.id)) glyphs.push('fk');
  if (glyphs.length === 0 && column.unique === true) glyphs.push('unique');
  return glyphs;
}

const EMPTY_FK: ReadonlySet<Id> = new Set();

/**
 * The columns a limited table draws (048 R1): primary keys, then foreign keys, then the rest in
 * stored order, up to `limit`, plus every relationship end; returned in stored order. This is the
 * one place that decides which rows a long table draws.
 */
function limitedIndexes(
  columns: readonly DbColumn[],
  glyphs: readonly (readonly KeyGlyph[])[],
  connected: ReadonlySet<Id>,
  limit: number,
): number[] {
  const all = columns.map((_, i) => i);
  const has = (i: number, glyph: KeyGlyph) => glyphs[i]?.includes(glyph) === true;
  const picked = new Set(
    [
      ...all.filter((i) => has(i, 'pk')),
      ...all.filter((i) => !has(i, 'pk') && has(i, 'fk')),
      ...all.filter((i) => !has(i, 'pk') && !has(i, 'fk')),
    ].slice(0, limit),
  );
  return all.filter((i) => picked.has(i) || connected.has(columns[i]?.id ?? ''));
}

/** Lays out a table card `width` px wide (default 240, or the stored width). */
export function tableLayout(
  node: TableNode,
  context: TableContext,
  width: number = node.size?.width ?? TABLE_CARD.width,
  measure: TextMeasurer = textMeasurer(),
): TableLayout {
  const t = TABLE_CARD;
  const { display } = context;
  const inner = width - 2 * t.paddingX;
  const columns = node.columns ?? [];
  const fk = (node.id === undefined ? undefined : context.fk.get(node.id)) ?? EMPTY_FK;
  const connected =
    (node.id === undefined ? undefined : context.connected?.get(node.id)) ?? EMPTY_FK;
  const filterText = (filters.get(node) ?? '').trim().toLowerCase();
  const filtering = filterText !== '';
  // A filter looks through every column, so it draws at All whatever the table's detail.
  const detail = filtering ? 'all' : effectiveDetail(node.detail, display.detail);
  const matchIds: ReadonlySet<Id> = filtering
    ? new Set(columns.filter((c) => c.name.toLowerCase().includes(filterText)).map((c) => c.id))
    : EMPTY_FK;

  const glyphs = columns.map((column) => glyphsOf(column, fk));
  const limited = detail === 'all' && node.expanded !== true && columns.length > t.rowLimit;
  // Keys draws PK, FK and every relationship-end row (042 R15), so no relationship loses its row.
  const isKey = (i: number) =>
    glyphs[i]?.some((g) => g !== 'unique') === true || connected.has(columns[i]?.id ?? '');
  const shownIndexes = filtering
    ? columns
        .map((_, i) => i)
        .filter((i) => matchIds.has(columns[i]?.id ?? '') || connected.has(columns[i]?.id ?? ''))
    : detail === 'names'
      ? []
      : limited
        ? limitedIndexes(columns, glyphs, connected, t.rowLimit)
        : columns.map((_, i) => i).filter((i) => detail === 'all' || isKey(i));
  const keySlot = shownIndexes.some((i) => (glyphs[i]?.length ?? 0) > 1)
    ? t.keySlotDouble
    : t.keySlot;
  const typeMax = inner * t.typeShare;
  const nullableRoom = display.hideNullable ? 0 : t.nullableGap + t.nullableSlot;

  const rows = shownIndexes.flatMap((i): TableRow[] => {
    const column = columns[i];
    if (column === undefined) return [];
    const enumItem =
      column.enumRef === undefined || display.hideTypes
        ? undefined
        : context.enums.get(column.enumRef);
    let typeWidth = 0;
    let type: string | undefined;
    let shownType: string | undefined;
    let typeCut = false;
    let chip: TableRow['enum'];
    if (enumItem !== undefined) {
      const text = truncate(enumItem.name, t.typeFont, typeMax - 2 * t.chipPaddingX, measure);
      typeCut = text !== enumItem.name;
      typeWidth = Math.min(typeMax, measure(text, t.typeFont) + 2 * t.chipPaddingX);
      chip = {
        id: enumItem.id,
        name: enumItem.name,
        text,
        ...(enumItem.color === undefined ? {} : { color: enumItem.color }),
      };
    } else if (!display.hideTypes) {
      type = typeText(column);
      shownType = truncate(type, t.typeFont, typeMax, measure);
      typeCut = shownType !== type;
      typeWidth = Math.min(typeMax, measure(shownType, t.typeFont));
    }
    const rowGlyphs = glyphs[i] ?? [];
    const mismatch =
      node.id === undefined ? undefined : context.mismatched?.get(rowKey(node.id, column.id));
    // The (!) icon takes room at the right of the row, like the nullable slot.
    const mismatchRoom = mismatch === undefined ? 0 : t.mismatchGap + t.mismatchSlot;
    const font = column.pk === true ? t.keyNameFont : t.nameFont;
    const nameMax =
      inner -
      keySlot -
      t.keyGap -
      (typeWidth > 0 ? typeWidth + t.typeGap : 0) -
      nullableRoom -
      mismatchRoom;
    const nameText = truncate(column.name, font, Math.max(0, nameMax), measure);
    return [
      {
        columnId: column.id,
        glyphs: rowGlyphs,
        name: column.name,
        nameText,
        nameCut: nameText !== column.name,
        ...(type === undefined ? {} : { type, typeText: shownType }),
        typeCut,
        nullable: !display.hideNullable && column.notNull !== true && column.pk !== true,
        ...(chip === undefined ? {} : { enum: chip }),
        typeWidth,
        ...(mismatch === undefined ? {} : { mismatch }),
      },
    ];
  });

  const pendingAt = newRows.get(node);
  const newRowIndex =
    pendingAt === undefined ? undefined : Math.max(0, Math.min(rows.length, pendingAt));
  const slots = rows.length + (newRowIndex === undefined ? 0 : 1);
  const hiddenCount = columns.length - rows.length;
  const drawn = new Set(rows.map((row) => row.columnId));
  const hiddenIds: ReadonlySet<Id> = new Set(
    columns.map((column) => column.id).filter((id) => !drawn.has(id)),
  );
  const hidden: TableLayout['hidden'] =
    hiddenCount === 0
      ? undefined
      : {
          count: hiddenCount,
          kind: filtering ? 'limit' : detail === 'names' ? 'all' : limited ? 'limit' : 'more',
        };
  // At All the button shows while rows are cut, and ("Show fewer") once a long table is opened.
  const buttonLabel =
    hidden?.kind === 'limit'
      ? `Show all ${String(columns.length)} columns`
      : detail === 'all' && node.expanded === true && columns.length > t.rowLimit
        ? 'Show fewer'
        : undefined;
  const indexCount = node.indexes?.length ?? 0;
  const hasBody = columns.length > 0 || newRowIndex !== undefined;
  const footer =
    !hasBody || display.hideIndexes || indexCount === 0
      ? undefined
      : plural(indexCount, 'index', 'indexes');

  const note = display.hideNotes ? '' : (node.description ?? '').trim();
  const wrapped = note === '' ? [] : wrapText(note, inner, t.noteFont, measure);
  const noteCut = wrapped.length > t.maxNoteLines;
  const noteLines = noteCut
    ? [
        ...wrapped.slice(0, t.maxNoteLines - 1),
        truncate(`${wrapped[t.maxNoteLines - 1] ?? ''}…`, t.noteFont, inner, measure),
      ]
    : wrapped;

  // The footer row holds the index count, and at Names also "n columns".
  const footerRow = hasBody && (footer !== undefined || hidden?.kind === 'all');
  const morePill = hidden?.kind === 'more' || buttonLabel !== undefined;
  const body = hasBody
    ? t.bodyGap +
      slots * t.rowHeight +
      (morePill ? (slots > 0 ? t.pillGap : 0) + t.pillHeight : 0) +
      (footerRow ? t.footerHeight : 0) +
      t.bottom
    : t.paddingY;
  const height =
    t.paddingY +
    t.headerHeight +
    t.gap +
    t.titleLineHeight +
    (noteLines.length > 0 ? t.gap + noteLines.length * t.noteLineHeight : 0) +
    body;

  const titleTop = t.paddingY + t.headerHeight + t.gap;
  const rowsTop =
    titleTop +
    t.titleLineHeight +
    (noteLines.length > 0 ? t.gap + noteLines.length * t.noteLineHeight : 0) +
    t.bodyGap;
  const slotTop = rowsTop + slots * t.rowHeight + (slots > 0 ? t.pillGap : 0);
  const pillTop = hidden?.kind === 'more' ? slotTop : undefined;
  const button: TableLayout['button'] =
    buttonLabel === undefined
      ? undefined
      : { label: buttonLabel, expanded: buttonLabel === 'Show fewer', top: slotTop };

  const schema = node.schema;
  return {
    width,
    height,
    typeName:
      context.showSchema && schema !== undefined && schema !== '' ? `Table · ${schema}` : 'Table',
    titleCut: measure(node.title, t.titleFont) > inner,
    noteLines,
    noteCut,
    detail,
    ownDetail: node.detail,
    keySlot,
    showNullable: !display.hideNullable,
    rows,
    matchIds,
    newRowIndex,
    hidden,
    button,
    hiddenIds,
    footer,
    rowsTop,
    pillTop,
    titleCenter: titleTop + t.titleLineHeight / 2,
    hasBody,
    columnCount: columns.length,
    compact: {
      pkCount: columns.filter((c) => c.pk === true).length,
      fkCount: columns.filter((c) => c.pk !== true && fk.has(c.id)).length,
      columnCount: columns.length,
    },
  };
}

/** The row drawn in 24 px slot `slot` under `rowsTop`, skipping the new-row editor (043). */
export function rowAtSlot(layout: TableLayout, slot: number): TableRow | undefined {
  if (slot < 0 || slot === layout.newRowIndex) return undefined;
  const shifted = layout.newRowIndex !== undefined && slot > layout.newRowIndex;
  return layout.rows[shifted ? slot - 1 : slot];
}

/** Where a relationship end meets a table: a drawn row, the "+n columns" pill / button, or the title. */
export interface RowAnchor {
  /** From the card's top. */
  y: number;
  kind: 'row' | 'pill' | 'title';
}

/**
 * The vertical anchor of a column on a table card (042 R2): the row's centre when drawn, else the
 * "+n columns" pill's centre, else the title's centre (Names, or a column id that does not exist).
 * Pure layout arithmetic, never measured, so canvas, drag hit test and export agree.
 */
export function rowAnchorY(layout: TableLayout, columnId: Id): RowAnchor {
  const found = layout.rows.findIndex((row) => row.columnId === columnId);
  const shifted = layout.newRowIndex !== undefined && found >= layout.newRowIndex;
  const index = shifted ? found + 1 : found;
  if (found >= 0) {
    return {
      y: layout.rowsTop + index * TABLE_CARD.rowHeight + TABLE_CARD.rowHeight / 2,
      kind: 'row',
    };
  }
  const standIn = layout.button?.top ?? layout.pillTop;
  if (standIn !== undefined && layout.hiddenIds.has(columnId)) {
    return { y: standIn + TABLE_CARD.pillHeight / 2, kind: 'pill' };
  }
  return { y: layout.titleCenter, kind: 'title' };
}

const layoutCache = new WeakMap<
  TableNode,
  { context: TableContext; width: number; layout: TableLayout }
>();

/** `tableLayout` with the default measurer, cached per node object, context and width. */
export function cachedTableLayout(
  node: TableNode,
  context: TableContext,
  width: number = node.size?.width ?? TABLE_CARD.width,
): TableLayout {
  const known = layoutCache.get(node);
  if (known?.context === context && known.width === width) return known.layout;
  const layout = tableLayout(node, context, width);
  layoutCache.set(node, { context, width, layout });
  return layout;
}
