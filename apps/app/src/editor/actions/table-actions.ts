/**
 * Table, row and lock actions (043 R8, contracts/editing-ui.md): Add column, Export this table as
 * SQL and Lock for cards; Edit, Edit details (the drawer, 052), the key / not null / unique toggles, Add index, Add relationship…,
 * Move up / down and Delete column for a column row. Every write is one undo step. The keys (C,
 * R, ⌥↑ / ⌥↓, ⌫, ⇧⌘L) call the same exported functions, so a key works exactly when its item does.
 */
import { isDbTable, isLocked, type DeckEditor, type Patch } from '@sododeck/model';
import type { DbColumn, Id, SododeckFile } from '@sododeck/schema';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Cable,
  FileCode,
  KeyRound,
  ListOrdered,
  Lock,
  Pencil,
  PanelRight,
  Plus,
  Trash2,
} from 'lucide-react';

import { useUiStore, type ColumnRef, type Selection } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { LOCKED_HINT, lockableIds, refuseLocked } from '../lock';
import { focusRowSoon, leaveRows } from '../table/row-focus';
import type { Action, ActionContext } from './types';

type Table = SododeckFile['nodes'][number];

const tableOf = (deck: Pick<SododeckFile, 'nodes'>, id: Id): Table | undefined => {
  const node = deck.nodes.find((n) => n.id === id);
  return node !== undefined && isDbTable(node) ? node : undefined;
};

const columnOf = (deck: Pick<SododeckFile, 'nodes'>, row: ColumnRef): DbColumn | undefined =>
  tableOf(deck, row.tableId)?.columns?.find((column) => column.id === row.columnId);

/** The one selected table (menu and toolbar of a single card), else undefined. */
function selectedTable(ctx: ActionContext): Table | undefined {
  const [id, ...rest] = ctx.selection.nodes;
  return id === undefined || rest.length > 0 ? undefined : tableOf(ctx.deck, id);
}

/** The selected nodes when every one is a table; otherwise none. */
function selectedTables(ctx: ActionContext): Table[] {
  const ids = new Set(ctx.selection.nodes);
  const nodes = ctx.deck.nodes.filter((node) => ids.has(node.id));
  return nodes.length > 0 && nodes.length === ids.size && nodes.every(isDbTable) ? nodes : [];
}

const rowOf = (ctx: ActionContext): ColumnRef | undefined =>
  ctx.target.kind === 'row' ? ctx.target.row : undefined;

const lockedReason = (table: Table | undefined): string | null =>
  table !== undefined && isLocked(table) ? LOCKED_HINT : null;

/**
 * Opens the new-row editor of a table (043 FR-006a): below `after` (a column id), else at the
 * end. Refused on a locked table. Returns whether the editor opened.
 */
export function startNewRow(deck: SododeckFile, tableId: Id, after: Id | null = null): boolean {
  const table = tableOf(deck, tableId);
  if (table === undefined) return false;
  if (isLocked(table)) return !refuseLocked();
  const columns = table.columns ?? [];
  const index = after === null ? -1 : columns.findIndex((column) => column.id === after);
  const ui = useUiStore.getState();
  ui.select({ nodes: [tableId] });
  ui.focus(tableId);
  return ui.startColumnEdit({
    tableId,
    columnId: null,
    at: index < 0 ? columns.length : index + 1,
    select: 'name',
  });
}

/** Opens the line editor on an existing row (F2, ⏎, double-click, "Edit"); refused when locked. */
export function startRowEdit(deck: SododeckFile, row: ColumnRef): boolean {
  const table = tableOf(deck, row.tableId);
  if (table === undefined || columnOf(deck, row) === undefined) return false;
  if (isLocked(table)) return !refuseLocked();
  return useUiStore
    .getState()
    .startColumnEdit({ tableId: row.tableId, columnId: row.columnId, select: 'name' });
}

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/**
 * Deletes a column (043 R7, FR-010): 040's cascade in one step, then the Undo toast naming the
 * column and counting the relationships that went with it. Row focus moves to the next row, else
 * the previous one, else back to the card. No confirmation: a column is part of a card.
 */
export function deleteColumn(
  editor: DeckEditor,
  deck: SododeckFile,
  row: ColumnRef,
  undoToast?: (message: string) => void,
  /** The details drawer keeps keyboard focus where it is (052); the canvas moves it to a row. */
  options: { moveFocus?: boolean } = {},
): boolean {
  const table = tableOf(deck, row.tableId);
  const columns = table?.columns ?? [];
  const index = columns.findIndex((column) => column.id === row.columnId);
  const column = columns[index];
  if (table === undefined || column === undefined) return false;
  if (isLocked(table)) return !refuseLocked();
  let edges = 0;
  oneStep(editor, () => {
    const result = editor.removeColumn(row.tableId, row.columnId);
    edges = result.removed.filter((ref) => ref.scope === 'edges').length;
  });
  const message = `Deleted column ${column.name}${
    edges > 0 ? ` · ${plural(edges, 'relationship', 'relationships')} removed` : ''
  }`;
  if (undoToast === undefined) useUiStore.getState().announce(message);
  else undoToast(message);
  if (options.moveFocus === false) return true;
  const next = columns[index + 1] ?? columns[index - 1];
  const ui = useUiStore.getState();
  if (ui.focusedRow?.columnId === row.columnId || ui.focusedRow === null) {
    if (next === undefined) leaveRows(row);
    else focusRowSoon({ tableId: row.tableId, columnId: next.id });
  }
  return true;
}

/** Moves a column one place up (−1) or down (1), clamped, keeping row focus on it. */
export function moveRow(editor: DeckEditor, deck: SododeckFile, row: ColumnRef, step: 1 | -1) {
  const table = tableOf(deck, row.tableId);
  const columns = table?.columns ?? [];
  const index = columns.findIndex((column) => column.id === row.columnId);
  const column = columns[index];
  if (table === undefined || column === undefined) return false;
  if (isLocked(table)) return !refuseLocked();
  const to = Math.max(0, Math.min(columns.length - 1, index + step));
  if (to === index) return true;
  oneStep(editor, () => {
    editor.moveColumn(row.tableId, row.columnId, to);
  });
  const ui = useUiStore.getState();
  ui.announce(`Moved ${column.name} to position ${String(to + 1)} of ${String(columns.length)}`);
  if (ui.focusedRow?.columnId === row.columnId) focusRowSoon(row);
  return true;
}

/**
 * Locks (or unlocks) a selection (043, 054): the selected cards and every card inside a selected
 * group. All of them lock unless all are locked already. Notes and connectors are left to their
 * own Lock (053). One transaction, so one undo step.
 */
export function toggleLockSelection(
  editor: DeckEditor,
  deck: SododeckFile,
  selection: Pick<Selection, 'nodes' | 'groups'>,
): void {
  const ids = new Set(lockableIds(deck, selection));
  const nodes = deck.nodes.filter((node) => ids.has(node.id));
  if (nodes.length === 0) return;
  const lock = !nodes.every(isLocked);
  editor.setLocked(
    nodes.map((node) => node.id),
    lock,
  );
  const ui = useUiStore.getState();
  // A lock ends any editing of the card's rows (FR-023).
  if (lock && nodes.some((node) => node.id === ui.columnEdit?.tableId)) ui.endColumnEdit();
  const name =
    nodes.length === 1 ? (nodes[0]?.title ?? 'card') : plural(nodes.length, 'card', 'cards');
  ui.announce(`${lock ? 'Locked' : 'Unlocked'} ${name}`);
}

/** Locks (or unlocks) the cards `ids`. */
export function toggleLock(editor: DeckEditor, deck: SododeckFile, ids: readonly Id[]): void {
  toggleLockSelection(editor, deck, { nodes: ids, groups: [] });
}

const allLocked = (ctx: ActionContext) => {
  const ids = new Set(lockableIds(ctx.deck, ctx.selection));
  const nodes = ctx.deck.nodes.filter((node) => ids.has(node.id));
  return nodes.length > 0 && nodes.every(isLocked);
};

/** A row flag toggle: one `updateColumn`, `true` or removed. */
function flagAction(
  id: string,
  label: string,
  key: 'pk' | 'notNull' | 'unique',
  icon: Action['icon'],
): Action {
  return {
    id,
    label,
    icon,
    section: 'edit',
    where: { menu: ['row'] },
    checked: (ctx) => {
      const row = rowOf(ctx);
      return row !== undefined && columnOf(ctx.deck, row)?.[key] === true;
    },
    disabledReason: (ctx) => {
      const row = rowOf(ctx);
      return row === undefined ? null : lockedReason(tableOf(ctx.deck, row.tableId));
    },
    run: (ctx) => {
      const row = rowOf(ctx);
      const column = row === undefined ? undefined : columnOf(ctx.deck, row);
      if (row === undefined || column === undefined) return;
      const on = column[key] !== true;
      const patch: Patch<DbColumn> = { [key]: on ? true : null };
      oneStep(ctx.editor, () => {
        ctx.editor.updateColumn(row.tableId, row.columnId, patch);
      });
      useUiStore.getState().announce(`${column.name}: ${label.toLowerCase()} ${on ? 'on' : 'off'}`);
    },
  };
}

const rowLockedReason = (ctx: ActionContext) => {
  const row = rowOf(ctx);
  return row === undefined ? null : lockedReason(tableOf(ctx.deck, row.tableId));
};

export const TABLE_ACTIONS: readonly Action[] = [
  {
    id: 'table.addColumn',
    label: 'Add column',
    icon: Plus,
    shortcut: 'add-column',
    section: 'edit',
    where: { menu: ['component'], toolbar: ['component'] },
    applies: (ctx) => selectedTable(ctx) !== undefined,
    disabledReason: (ctx) => lockedReason(selectedTable(ctx)),
    run: (ctx) => {
      const table = selectedTable(ctx);
      if (table !== undefined) startNewRow(ctx.deck, table.id);
    },
  },
  {
    id: 'table.exportSql',
    label: (ctx) =>
      selectedTables(ctx).length > 1 ? 'Export these tables as SQL' : 'Export this table as SQL',
    icon: FileCode,
    section: 'clipboard',
    where: { menu: ['component', 'components'] },
    applies: (ctx) => selectedTables(ctx).length > 0,
    run: (ctx) => {
      // The selection is the scope (045 `selection`), so the menu's target becomes the selection.
      const ui = useUiStore.getState();
      ui.select({ nodes: selectedTables(ctx).map((table) => table.id) });
      ui.openExport(null, { format: 'sql', scope: 'selection' });
    },
  },
  {
    id: 'node.lock',
    label: (ctx) => (allLocked(ctx) ? 'Unlock' : 'Lock'),
    icon: Lock,
    shortcut: 'lock',
    section: 'arrange',
    where: {
      menu: ['component', 'components', 'group', 'mixed'],
      toolbar: ['component', 'components', 'group', 'mixed'],
    },
    // Nothing to lock (a group with no cards, only notes and connectors): not offered.
    applies: (ctx) => lockableIds(ctx.deck, ctx.selection).length > 0,
    checked: allLocked,
    run: (ctx) => {
      toggleLockSelection(ctx.editor, ctx.deck, ctx.selection);
    },
  },
  {
    id: 'row.edit',
    label: 'Edit',
    icon: Pencil,
    shortcut: 'open-details',
    section: 'open',
    where: { menu: ['row'] },
    disabledReason: rowLockedReason,
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row !== undefined) startRowEdit(ctx.deck, row);
    },
  },
  {
    id: 'row.details',
    label: 'Edit details',
    icon: PanelRight,
    section: 'open',
    where: { menu: ['row'] },
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row === undefined || columnOf(ctx.deck, row) === undefined) return;
      useUiStore
        .getState()
        .openTableDrawer(row.tableId, { tab: 'columns', columnId: row.columnId });
    },
  },
  flagAction('row.pk', 'Set as primary key', 'pk', KeyRound),
  flagAction('row.notNull', 'Not null', 'notNull', Ban),
  flagAction('row.unique', 'Unique', 'unique', KeyRound),
  {
    id: 'row.addIndex',
    label: 'Add index',
    icon: ListOrdered,
    section: 'edit',
    where: { menu: ['row'] },
    disabledReason: rowLockedReason,
    run: (ctx) => {
      const row = rowOf(ctx);
      const column = row === undefined ? undefined : columnOf(ctx.deck, row);
      if (row === undefined || column === undefined) return;
      oneStep(ctx.editor, () => {
        ctx.editor.addIndex(row.tableId, { columns: [row.columnId] });
      });
      useUiStore.getState().announce(`Index added on ${column.name}`);
    },
  },
  {
    id: 'row.addRelationship',
    label: 'Add relationship…',
    icon: Cable,
    shortcut: 'row-connect',
    section: 'edit',
    // A locked table still takes relationships (FR-023): only an edge is written.
    where: { menu: ['row'] },
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row !== undefined) useUiStore.getState().openColumnConnectPopover(row);
    },
  },
  {
    id: 'row.moveUp',
    label: 'Move up',
    icon: ArrowUp,
    shortcut: 'row-move-up',
    section: 'arrange',
    where: { menu: ['row'] },
    disabledReason: rowLockedReason,
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row !== undefined) moveRow(ctx.editor, ctx.deck, row, -1);
    },
  },
  {
    id: 'row.moveDown',
    label: 'Move down',
    icon: ArrowDown,
    shortcut: 'row-move-down',
    section: 'arrange',
    where: { menu: ['row'] },
    disabledReason: rowLockedReason,
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row !== undefined) moveRow(ctx.editor, ctx.deck, row, 1);
    },
  },
  {
    id: 'row.delete',
    label: 'Delete column',
    icon: Trash2,
    shortcut: 'delete',
    section: 'danger',
    destructive: true,
    where: { menu: ['row'] },
    disabledReason: rowLockedReason,
    run: (ctx) => {
      const row = rowOf(ctx);
      if (row !== undefined) deleteColumn(ctx.editor, ctx.deck, row, ctx.undoToast);
    },
  },
];
