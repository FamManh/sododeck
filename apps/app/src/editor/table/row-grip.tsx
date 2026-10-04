import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { GripVertical } from 'lucide-react';
import { useContext } from 'react';

import { EditorContext } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { startPointerDrag } from '../editing/pointer-drag';
import { finishRowDrag, reorderIndex } from './row-drag';

/**
 * A row's reorder grip (043 R6, FR-009): shown on row hover, a press-and-drag moves the column.
 * The session lives in `ui.rowDrag` (the drop line reads it); the release writes one step, Esc
 * cancels. `nodrag` keeps React Flow from dragging the card.
 */
export function RowGrip({
  tableId,
  columnId,
  name,
  index,
  count,
}: {
  tableId: string;
  columnId: string;
  name: string;
  index: number;
  count: number;
}) {
  // The context, not `useEditor`: a table body drawn outside an editor (tests, previews) keeps its
  // grips inert instead of throwing.
  const editor = useContext(EditorContext);
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Reorder ${name}`}
      className="sd-row-grip nodrag nopan absolute top-0 -left-[3px] flex h-6 w-3 cursor-grab items-center justify-center text-ink-muted opacity-0 group-hover/row:opacity-100 active:cursor-grabbing"
      onPointerDown={(event) => {
        if (event.button !== 0 || editor === null) return;
        event.preventDefault();
        event.stopPropagation();
        const row = event.currentTarget.closest('[data-row]');
        const rowHeight = row?.getBoundingClientRect().height ?? 0;
        const startY = event.clientY;
        startPointerDrag(event, {
          onStart: () => {
            useUiStore.getState().setRowDrag({ tableId, columnId, overIndex: index });
          },
          onMove: (move) => {
            const overIndex = reorderIndex(index, move.clientY - startY, rowHeight, count);
            const drag = useUiStore.getState().rowDrag;
            if (drag !== null && drag.overIndex !== overIndex) {
              useUiStore.getState().setRowDrag({ ...drag, overIndex });
            }
          },
          onEnd: (_, committed) => {
            if (committed) finishRowDrag(editor, name);
            else useUiStore.getState().setRowDrag(null);
          },
          onCancel: () => {
            useUiStore.getState().setRowDrag(null);
          },
        });
      }}
    >
      <GripVertical aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
    </button>
  );
}
