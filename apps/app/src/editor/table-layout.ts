/**
 * The table card's layout (041, research R1): one pure function of the table, its deck context
 * and its width, never of the zoom (R2) and never measured from the DOM (§g-58, ADR 0016). The
 * canvas geometry, `DeckNode` and the export all read it, so boxes, rows and connectors agree.
 *
 * Height = 12 + header 24 + 8 + title 18 + (8 + note lines × 17) + body, where the body (only when
 * the table has columns) is 8 + rows × 24 + ("+n columns" pill: 6 + 24) + (footer 24) + 8, and a
 * table without columns ends with the card's own 12.
 */
import type { DbColumn, DbDetail, Id, SododeckFile } from '@sododeck/schema';

import { textMeasurer } from './card-tags';
import { wrapText } from './card-layout';
import { truncate, type TextMeasurer } from './export/text-measure';
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
  /** Hover fill inset from the card edge. */
  rowInset: 4,
  keySlot: 16,
  keySlotDouble: 30,
  keyGap: 6,
  typeShare: 0.58,
  typeGap: 8,
  nullableGap: 3,
  nullableSlot: 7,
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
  /** Columns not drawn as rows: "+n columns" at Keys, "n columns" at Names. */
  hidden: { count: number; kind: 'more' | 'all' } | undefined;
  /** "1 index" / "n indexes", absent without indexes or when hidden. */
  footer: string | undefined;
  /** Whether the column body (hairline and what follows) is drawn. */
  hasBody: boolean;
  columnCount: number;
  /** System level content: key dots and the column count. */
  compact: { pkCount: number; fkCount: number; columnCount: number };
}

type Node = SododeckFile['nodes'][number];

/** What `tableLayout` reads of a table node. */
export type TableNode = Pick<Node, 'title'> &
  Partial<Pick<Node, 'id' | 'description' | 'schema' | 'columns' | 'indexes' | 'detail' | 'size'>>;

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
  const detail = effectiveDetail(node.detail, display.detail);

  const glyphs = columns.map((column) => glyphsOf(column, fk));
  const isKey = (i: number) => glyphs[i]?.some((g) => g !== 'unique') === true;
  const shownIndexes =
    detail === 'names' ? [] : columns.map((_, i) => i).filter((i) => detail === 'all' || isKey(i));
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
    const font = column.pk === true ? t.keyNameFont : t.nameFont;
    const nameMax =
      inner - keySlot - t.keyGap - (typeWidth > 0 ? typeWidth + t.typeGap : 0) - nullableRoom;
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
      },
    ];
  });

  const hiddenCount = columns.length - rows.length;
  const hidden: TableLayout['hidden'] =
    hiddenCount === 0
      ? undefined
      : { count: hiddenCount, kind: detail === 'names' ? 'all' : 'more' };
  const indexCount = node.indexes?.length ?? 0;
  const hasBody = columns.length > 0;
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
  const morePill = hidden?.kind === 'more';
  const body = hasBody
    ? t.bodyGap +
      rows.length * t.rowHeight +
      (morePill ? (rows.length > 0 ? t.pillGap : 0) + t.pillHeight : 0) +
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
    hidden,
    footer,
    hasBody,
    columnCount: columns.length,
    compact: {
      pkCount: columns.filter((c) => c.pk === true).length,
      fkCount: columns.filter((c) => c.pk !== true && fk.has(c.id)).length,
      columnCount: columns.length,
    },
  };
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
