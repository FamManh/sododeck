/**
 * What a relationship drag would connect to under the pointer (042 R9, FR-016): the column row
 * under it on any table, else the single-column primary key of the table under it, else nothing.
 * Pure flow-coordinate arithmetic on 041's layout (`rowsTop`, 24 px rows), never the DOM.
 */
import { isDbTable } from '@sododeck/model';
import type { DbColumn, Id, SododeckFile } from '@sododeck/schema';

import { cardBox, tableLayoutOf } from '../canvas-geometry';
import type { Level } from '../levels';
import type { Box, Point } from '../routing/route-path';
import { tableContextOf } from '../table-keys';
import { rowAtSlot, TABLE_CARD, type TableLayout } from '../table-layout';

export interface TargetTable {
  id: Id;
  box: Box;
  layout: TableLayout;
  columns: readonly Pick<DbColumn, 'id' | 'pk'>[];
}

export interface ColumnRef {
  tableId: Id;
  columnId: Id;
}

const inside = (box: Box, p: Point) =>
  p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;

/** Tables later in the list are drawn on top and win. */
export function columnTargetAt(
  point: Point,
  tables: readonly TargetTable[],
): ColumnRef | undefined {
  for (let i = tables.length - 1; i >= 0; i -= 1) {
    const table = tables[i];
    if (table === undefined || !inside(table.box, point)) continue;
    const row = Math.floor((point.y - table.box.y - table.layout.rowsTop) / TABLE_CARD.rowHeight);
    const hit = rowAtSlot(table.layout, row);
    if (hit !== undefined) return { tableId: table.id, columnId: hit.columnId };
    const keys = table.columns.filter((column) => column.pk === true);
    const [key] = keys;
    return keys.length === 1 && key !== undefined
      ? { tableId: table.id, columnId: key.id }
      : undefined;
  }
  return undefined;
}

/**
 * The drawn tables a relationship drag can land on, in draw order (042): their boxes and layouts
 * at `level`, the same numbers the cards are drawn with. Rows exist only from 90 %, so below it
 * there are none.
 */
export function targetTablesOf(
  deck: SododeckFile,
  visible: ReadonlySet<Id>,
  level: Level,
): TargetTable[] {
  if (level !== 'container' && level !== 'component') return [];
  const context = tableContextOf(deck);
  return deck.nodes.flatMap((node, index) => {
    if (!isDbTable(node) || !visible.has(node.id)) return [];
    return [
      {
        id: node.id,
        box: cardBox(node, index, level, { table: context }),
        layout: tableLayoutOf(node, context),
        columns: node.columns ?? [],
      },
    ];
  });
}
