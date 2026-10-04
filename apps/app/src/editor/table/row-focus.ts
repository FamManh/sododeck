/**
 * Keyboard focus on a table's column rows (042 R9, constitution VII): ↓ from a focused table
 * enters its rows, ↓ / ↑ move between them, Esc returns to the card. Rows are plain elements
 * with `data-row`; the focused one is mirrored in `ui.focusedRow` (UI only).
 */
import { isTextTarget } from '../../lib/is-text-target';
import { useUiStore, type ColumnRef } from '../../state/ui-store';
import { canvasElement, nodeElement } from '../canvas-actions';

function rows(tableId: string): HTMLElement[] {
  const card =
    nodeElement(tableId) ?? canvasElement()?.querySelector(`[data-id="${CSS.escape(tableId)}"]`);
  return [...(card?.querySelectorAll<HTMLElement>('[data-row]') ?? [])];
}

function focusRow(tableId: string, element: HTMLElement | undefined): boolean {
  const columnId = element?.dataset.columnId;
  if (element === undefined || columnId === undefined) return false;
  element.focus({ preventScroll: true });
  useUiStore.getState().setFocusedRow({ tableId, columnId });
  return true;
}

/** Focuses the first drawn row of a table; false when it draws none. */
export function enterRows(tableId: string): boolean {
  return focusRow(tableId, rows(tableId)[0]);
}

/** Moves row focus one row down (1) or up (−1), staying on the first or last row. */
export function moveRowFocus(row: ColumnRef, step: 1 | -1): void {
  const list = rows(row.tableId);
  const index = list.findIndex((element) => element.dataset.columnId === row.columnId);
  const next = list[Math.max(0, Math.min(list.length - 1, index + step))];
  focusRow(row.tableId, next);
}

/** Leaves the rows: focus goes back to the table card. */
export function leaveRows(row: ColumnRef): void {
  useUiStore.getState().setFocusedRow(null);
  nodeElement(row.tableId)?.focus({ preventScroll: true });
}

/**
 * Focuses a row once it is drawn again (043): after the line editor closes, the row replaces the
 * input on the next render, so focus waits a frame.
 */
export function focusRowSoon(row: ColumnRef): void {
  const expected = useUiStore.getState().focusedRow;
  requestAnimationFrame(() => {
    // Focus already moved on (another row, a new line editor, a field): leave it there.
    if (useUiStore.getState().focusedRow !== expected) return;
    if (isTextTarget(document.activeElement)) return;
    const element = rows(row.tableId).find((item) => item.dataset.columnId === row.columnId);
    if (!focusRow(row.tableId, element)) nodeElement(row.tableId)?.focus({ preventScroll: true });
  });
}
