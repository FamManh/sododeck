/** Row reorder by drag (043 R6, FR-009): where the row lands, and the one write on release. */
import type { DeckEditor } from '@sododeck/model';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { TABLE_CARD } from '../table-layout';

/**
 * Where a dragged row lands (043 R6): its start index moved by whole rows of the pointer's travel,
 * clamped to the list. `rowScreenHeight` is one 24 px row on screen at the current zoom, so the
 * arithmetic stays the layout's (rows are never measured one by one).
 */
export function reorderIndex(
  start: number,
  dy: number,
  rowScreenHeight: number,
  count: number,
): number {
  const step = rowScreenHeight > 0 ? rowScreenHeight : TABLE_CARD.rowHeight;
  return Math.max(0, Math.min(count - 1, start + Math.round(dy / step)));
}

/** Ends a row drag: one `moveColumn` when the row lands elsewhere, then the announcement. */
export function finishRowDrag(editor: DeckEditor, name: string): void {
  const ui = useUiStore.getState();
  const drag = ui.rowDrag;
  ui.setRowDrag(null);
  if (drag === null) return;
  const table = readDeck(editor.doc).nodes.find((node) => node.id === drag.tableId);
  const columns = table?.columns ?? [];
  const from = columns.findIndex((column) => column.id === drag.columnId);
  if (from < 0 || from === drag.overIndex) return;
  oneStep(editor, () => {
    editor.moveColumn(drag.tableId, drag.columnId, drag.overIndex);
  });
  ui.announce(`Moved ${name} to position ${String(drag.overIndex + 1)}`);
}
