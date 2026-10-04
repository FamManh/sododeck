/**
 * Table ownership (049, ADR 0035): a table belongs to the database card it is parented to.
 * `node.parent` already means "one level up" for drill-in, so there is no separate owner field.
 */
import type { Id } from '@sododeck/schema';

import { DeckEditError } from '../errors';
import { collectionMap } from '../layout';
import { writeField } from '../write';
import { requireEntry, type EditContext } from './context';
import { requireTable } from './db-tables';

/**
 * Moves a table into a database card (`cardId`), or out of any card (`null`). Columns,
 * relationships and step touches are untouched, since they name the table by id. Throws
 * `not-found` for an unknown table or card and `invalid` when the node is not a table or the card
 * is not a `database` card. No-op when the owner is already as asked; otherwise one undo step.
 */
export function setTableOwner(ctx: EditContext, tableId: Id, cardId: Id | null): void {
  const table = requireTable(ctx, tableId);
  if (cardId !== null) {
    const card = requireEntry(collectionMap(ctx.doc, 'nodes'), cardId, 'Node');
    if (card.get('type') !== 'database') {
      throw new DeckEditError('invalid', [
        { path: 'parent', message: `Node "${cardId}" is not a database card.` },
      ]);
    }
  }
  const current = table.get('parent');
  if ((typeof current === 'string' ? current : null) === cardId) return;
  ctx.transact(() => {
    if (cardId === null) table.delete('parent');
    else writeField(table, 'nodes', 'parent', cardId);
  });
}
