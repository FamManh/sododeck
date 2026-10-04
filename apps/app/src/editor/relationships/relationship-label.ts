/**
 * A relationship's label pill text (042 R10, FR-013) and its accessible name (R18). Pure, shared
 * by the canvas and the export.
 */
import type { DbAction, DbColumn, Id, SododeckFile } from '@sododeck/schema';

type Edge = SododeckFile['edges'][number];
type Table = { title: string; columns?: readonly Pick<DbColumn, 'id' | 'name'>[] | undefined };

/** Looks a table up by id (the deck's nodes, or a test map). */
export type TableLookup = (id: Id) => Table | undefined;

function columnNames(table: Table | undefined, ids: readonly Id[] | undefined): string[] {
  if (table === undefined || ids === undefined) return [];
  const byId = new Map((table.columns ?? []).map((column) => [column.id, column.name]));
  return ids.flatMap((id) => {
    const name = byId.get(id);
    return name === undefined ? [] : [name];
  });
}

const actionText = (action: DbAction) => action.replace('-', ' ');

/**
 * The label pill: the connector label, "ON DELETE <ACTION>" (not for no-action), the composite
 * column list "(a, b)" from the `from` table, and "n–n", joined with " · "; undefined when empty.
 */
export function relationshipLabel(
  edge: Pick<Edge, 'from' | 'label' | 'onDelete' | 'fromColumns' | 'cardinality'>,
  tables: TableLookup,
): string | undefined {
  const parts: string[] = [];
  if (edge.label !== undefined && edge.label !== '') parts.push(edge.label);
  if (edge.onDelete !== undefined && edge.onDelete !== 'no-action') {
    parts.push(`ON DELETE ${actionText(edge.onDelete).toUpperCase()}`);
  }
  if ((edge.fromColumns?.length ?? 0) >= 2) {
    const names = columnNames(tables(edge.from), edge.fromColumns);
    if (names.length > 0) parts.push(`(${names.join(', ')})`);
  }
  if (edge.cardinality === 'n-n') parts.push('n–n');
  return parts.length === 0 ? undefined : parts.join(' · ');
}

function endName(table: Table | undefined, id: Id, columns: readonly Id[] | undefined): string {
  const title = table?.title ?? id;
  const names = columnNames(table, columns);
  if (names.length === 0) return title;
  return names.length === 1 ? `${title}.${names[0] ?? ''}` : `${title} (${names.join(', ')})`;
}

const WORD = { '1': 'one', n: 'many' } as const;

/**
 * "Relationship orders.customer_id to customers.id, many to one, on delete restrict": the ends,
 * the cardinality in words, the on-delete action and the label. A missing column reads as its
 * table.
 */
export function relationshipName(
  edge: Pick<
    Edge,
    'from' | 'to' | 'label' | 'onDelete' | 'fromColumns' | 'toColumns' | 'cardinality'
  >,
  tables: TableLookup,
): string {
  const parts = [
    `Relationship ${endName(tables(edge.from), edge.from, edge.fromColumns)} to ${endName(tables(edge.to), edge.to, edge.toColumns)}`,
  ];
  if (edge.cardinality !== undefined) {
    const [a, , b] = edge.cardinality;
    parts.push(`${WORD[a === 'n' ? 'n' : '1']} to ${WORD[b === 'n' ? 'n' : '1']}`);
  }
  if (edge.onDelete !== undefined && edge.onDelete !== 'no-action') {
    parts.push(`on delete ${actionText(edge.onDelete)}`);
  }
  if (edge.label !== undefined && edge.label !== '') parts.push(edge.label);
  return parts.join(', ');
}

/**
 * One line for a list of relationships (048): "orders.customer_id → customers.id · n-1". Without
 * a cardinality the part after the dot is left out.
 */
export function relationshipSummary(
  edge: Pick<Edge, 'from' | 'to' | 'fromColumns' | 'toColumns' | 'cardinality'>,
  tables: TableLookup,
): string {
  const ends = `${endName(tables(edge.from), edge.from, edge.fromColumns)} → ${endName(tables(edge.to), edge.to, edge.toColumns)}`;
  return edge.cardinality === undefined ? ends : `${ends} · ${edge.cardinality}`;
}
