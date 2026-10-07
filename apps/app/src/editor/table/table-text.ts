/** Words the table card says (041): row labels for assistive tech and detail names. */
import type { DbColumn, DbDetail, Id, SododeckFile } from '@sododeck/schema';

import { enumById } from '../table-keys';
import { typeText, type KeyGlyph, type TableRow } from '../table-layout';

export const GLYPH_NAMES: Record<KeyGlyph, string> = {
  pk: 'Primary key',
  fk: 'Foreign key',
  unique: 'Unique',
};

/** What assistive tech reads for a row (FR-023): name, type, keys, nullable, in that order. */
export function rowLabel(row: TableRow): string {
  return [
    row.name,
    row.enum?.name ?? row.type,
    ...row.glyphs.map((glyph) => GLYPH_NAMES[glyph].toLowerCase()),
    row.nullable ? 'nullable' : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
}

export const DETAIL_NAMES: Record<DbDetail, string> = {
  names: 'Names',
  keys: 'Keys',
  all: 'All',
};

/** The header toggle's cycle (041 FR-015): deck setting → Keys → All → deck setting. */
export function nextDetail(own: DbDetail | undefined): DbDetail | undefined {
  if (own === undefined || own === 'names') return 'keys';
  if (own === 'keys') return 'all';
  return undefined;
}

type Deck = Pick<SododeckFile, 'nodes' | 'edges' | 'enums'>;

/** A column's full type as the popover shows it (064): its enum's name, else `type(size)`. */
export function fullType(column: DbColumn, deck: Pick<SododeckFile, 'enums'>): string {
  const linked = column.enumRef === undefined ? undefined : enumById(deck).get(column.enumRef);
  return linked?.name ?? typeText(column).trim();
}

/** "table.column" for each column a foreign key of `tableId`.`columnId` references. */
function referencedColumns(deck: Deck, tableId: Id, columnId: Id): string[] {
  const out: string[] = [];
  for (const edge of deck.edges) {
    // The referencing end is the `n` side, else `from` (as `fkColumns` reads it).
    const many = edge.cardinality === '1-n';
    const own = many
      ? { table: edge.to, columns: edge.toColumns }
      : { table: edge.from, columns: edge.fromColumns };
    const other = many
      ? { table: edge.from, columns: edge.fromColumns }
      : { table: edge.to, columns: edge.toColumns };
    const at = own.table === tableId ? (own.columns?.indexOf(columnId) ?? -1) : -1;
    if (at < 0) continue;
    const node = deck.nodes.find((n) => n.id === other.table);
    const target = node?.columns?.find((c) => c.id === other.columns?.[at]);
    if (node !== undefined && target !== undefined) out.push(`${node.title}.${target.name}`);
  }
  return out;
}

/**
 * The constraints a column popover lists (064 FR-002), in a fixed order and only those set:
 * Primary key, Foreign key → table.column, Not null (implied by a primary key), Unique,
 * Auto increment, Default, Check.
 */
export function columnConstraints(deck: Deck, tableId: Id, column: DbColumn): string[] {
  const out: string[] = [];
  if (column.pk === true) out.push('Primary key');
  for (const target of referencedColumns(deck, tableId, column.id)) {
    out.push(`Foreign key → ${target}`);
  }
  if (column.notNull === true && column.pk !== true) out.push('Not null');
  if (column.unique === true) out.push('Unique');
  if (column.increment === true) out.push('Auto increment');
  if (column.default !== undefined) out.push(`Default ${String(column.default)}`);
  else if (column.defaultExpr !== undefined) out.push(`Default ${column.defaultExpr}`);
  if (column.check !== undefined) out.push(`Check ${column.check}`);
  return out;
}

/** What a keyboard open of the column popover reads out (064 FR-009). */
export function columnSummary(deck: Deck, tableId: Id, column: DbColumn): string {
  const note = (column.note ?? '').trim();
  return [
    column.name,
    fullType(column, deck),
    ...columnConstraints(deck, tableId, column),
    note === '' ? undefined : `note: ${note}`,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
}
