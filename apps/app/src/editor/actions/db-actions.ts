/**
 * Database card actions (049, contracts/ui.md §2): "Move to database…" and "Remove from card" on a
 * table, "Export this database as SQL" on a database card. Each write is one undo step; the table
 * inspector's Database field runs the same exported functions.
 */
import { isDbTable, isLocked, type DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import { Database, FileCode, Unlink } from 'lucide-react';

import { databaseCards, isDatabaseCard, ownerOf, tableCounts } from '../../db/owner';
import { useUiStore } from '../../state/ui-store';
import { LOCKED_HINT } from '../lock';
import { belowCard, placeTables, writeBasePositions } from '../place-tables';
import { displayPosition } from '../canvas-geometry';
import type { Action, ActionContext } from './types';

type Node = SododeckFile['nodes'][number];

export const NO_DATABASE_HINT = 'This deck has no database card';
export const EMPTY_DATABASE_HINT = 'This database has no tables';

/** The one selected node, when it is a table. */
function selectedTable(ctx: ActionContext): Node | undefined {
  const [id, ...rest] = ctx.selection.nodes;
  if (id === undefined || rest.length > 0) return undefined;
  const node = ctx.deck.nodes.find((n) => n.id === id);
  return node !== undefined && isDbTable(node) ? node : undefined;
}

/** The one selected node, when it is a database card. */
function selectedDatabase(ctx: ActionContext): Node | undefined {
  const [id, ...rest] = ctx.selection.nodes;
  if (id === undefined || rest.length > 0) return undefined;
  const node = ctx.deck.nodes.find((n) => n.id === id);
  return node !== undefined && isDatabaseCard(node) ? node : undefined;
}

/** Why a table cannot move now, or null: locked, or nowhere to go. */
export function moveDisabledReason(deck: SododeckFile, table: Node): string | null {
  if (isLocked(table)) return LOCKED_HINT;
  return databaseCards(deck).length === 0 ? NO_DATABASE_HINT : null;
}

/** The database cards a table can move to: every one but its current owner. */
export function moveTargets(deck: SododeckFile, table: Node): Node[] {
  return databaseCards(deck).filter((card) => card.id !== table.parent);
}

/**
 * Moves a table into database card `cardId`, or out of its card with `null` (049 US1), in one undo
 * step. The table keeps its spot when it is free at its new level, else takes the nearest free
 * one (below its old card when it leaves one). Columns, relationships and touches are kept.
 */
export function moveTableTo(
  editor: DeckEditor,
  deck: SododeckFile,
  tableId: Id,
  cardId: Id | null,
): void {
  const index = deck.nodes.findIndex((node) => node.id === tableId);
  const table = deck.nodes[index];
  if (table === undefined || (table.parent ?? null) === cardId) return;
  const anchor =
    cardId === null && table.parent !== undefined
      ? belowCard(deck, table.parent)
      : displayPosition(table, index);
  const positions = placeTables(deck, [tableId], cardId ?? undefined, anchor);
  editor.batch(() => {
    editor.setTableOwner(tableId, cardId);
    writeBasePositions(editor, deck, positions);
  });
  const card = cardId === null ? undefined : deck.nodes.find((node) => node.id === cardId);
  useUiStore
    .getState()
    .announce(
      card === undefined
        ? `${table.title} removed from its card`
        : `Moved ${table.title} to ${card.title}`,
    );
}

/** Opens the export dialog on one database card's tables (049 US4); false when it has none. */
export function exportDatabaseSql(deck: SododeckFile, cardId: Id): boolean {
  if ((tableCounts(deck).get(cardId) ?? 0) === 0) return false;
  const ui = useUiStore.getState();
  // The `database` scope reads the one selected database card (045 `availableSchemaScopes`).
  ui.select({ nodes: [cardId] });
  ui.openExport(null, { format: 'sql', scope: 'database' });
  return true;
}

export const DB_ACTIONS: readonly Action[] = [
  {
    id: 'table.moveToDatabase',
    label: 'Move to database…',
    icon: Database,
    section: 'arrange',
    where: { menu: ['component'] },
    applies: (ctx) => selectedTable(ctx) !== undefined,
    disabledReason: (ctx) => {
      const table = selectedTable(ctx);
      if (table === undefined) return null;
      const reason = moveDisabledReason(ctx.deck, table);
      if (reason !== null) return reason;
      return moveTargets(ctx.deck, table).length === 0 ? 'No other database card' : null;
    },
    children: (ctx) => {
      const table = selectedTable(ctx);
      if (table === undefined) return [];
      return moveTargets(ctx.deck, table).map((card) => ({
        id: `table.moveToDatabase.${card.id}`,
        label: card.title,
        section: 'arrange',
        where: {},
        run: (inner) => {
          moveTableTo(inner.editor, inner.deck, table.id, card.id);
        },
      }));
    },
  },
  {
    id: 'table.removeFromCard',
    label: 'Remove from card',
    icon: Unlink,
    section: 'arrange',
    where: { menu: ['component'] },
    applies: (ctx) => {
      const table = selectedTable(ctx);
      return table !== undefined && ownerOf(ctx.deck, table.id) !== undefined;
    },
    disabledReason: (ctx) => {
      const table = selectedTable(ctx);
      return table !== undefined && isLocked(table) ? LOCKED_HINT : null;
    },
    run: (ctx) => {
      const table = selectedTable(ctx);
      if (table !== undefined) moveTableTo(ctx.editor, ctx.deck, table.id, null);
    },
  },
  {
    id: 'database.exportSql',
    label: 'Export this database as SQL',
    icon: FileCode,
    section: 'clipboard',
    where: { menu: ['component'] },
    applies: (ctx) => selectedDatabase(ctx) !== undefined,
    disabledReason: (ctx) => {
      const card = selectedDatabase(ctx);
      return card !== undefined && (tableCounts(ctx.deck).get(card.id) ?? 0) === 0
        ? EMPTY_DATABASE_HINT
        : null;
    },
    run: (ctx) => {
      const card = selectedDatabase(ctx);
      if (card !== undefined) exportDatabaseSql(ctx.deck, card.id);
    },
  },
];
