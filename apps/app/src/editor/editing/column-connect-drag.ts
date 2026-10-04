/**
 * Drawing a relationship by dragging from a column port (042 R9), and moving one end of a
 * selected relationship (R13). Pointer events on the window, like the bend and anchor drags: a
 * 4 px threshold, the target from the pure `columnTargetAt` on the drawn tables' layouts, Esc
 * cancels, release commits in one undo step. The live state is `ui.columnConnect` (UI only).
 */
import { deckDialect, type DeckEditor } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type ColumnConnect, type ColumnRef } from '../../state/ui-store';
import { connectColumns, COMPOSITE_END_HINT, reconnectColumnEnd } from '../canvas-actions';
import { columnTargetAt, type TargetTable } from '../relationships/column-target';
import type { RelSide } from '../relationships/relationship-ends';
import { typeMismatch } from '../relationships/type-mismatch';
import type { Point } from '../routing/route-path';
import { rowAnchorY } from '../table-layout';

/** Movement before a press becomes a drag (as 050's end handles). */
export const DRAG_THRESHOLD = 4;

/** What the canvas lends the drag: coordinates, the drawn tables and the editor. */
export interface ColumnDragEnv {
  toFlow: (client: Point) => Point;
  tables: () => readonly TargetTable[];
  editor: DeckEditor;
}

let env: ColumnDragEnv | null = null;

/** Set by the canvas while it is mounted. */
export function setColumnDragEnv(next: ColumnDragEnv | null): void {
  env = next;
}

function columnOf(deck: SododeckFile, ref: ColumnRef) {
  return deck.nodes.find((n) => n.id === ref.tableId)?.columns?.find((c) => c.id === ref.columnId);
}

/** Where a row meets its card on `side`, in flow coordinates. */
export function portPoint(
  tables: readonly TargetTable[],
  ref: ColumnRef,
  side: RelSide,
): Point | undefined {
  const table = tables.find((t) => t.id === ref.tableId);
  if (table === undefined) return undefined;
  return {
    x: side === 'right' ? table.box.x + table.box.width : table.box.x,
    y: table.box.y + rowAnchorY(table.layout, ref.columnId).y,
  };
}

/**
 * The drag state at `point` (pure): the target under it (never the source row of a new
 * relationship, nor the fixed end of a moved one), where the chip goes and the type warning.
 */
export function dragAt(
  drag: ColumnConnect,
  point: Point,
  tables: readonly TargetTable[],
  deck: SododeckFile,
): ColumnConnect {
  const hit = columnTargetAt(point, tables);
  const dialect = deckDialect(deck);
  const sameRow =
    hit !== undefined &&
    hit.tableId === drag.source.tableId &&
    hit.columnId === drag.source.columnId;
  const rest: ColumnConnect = {
    source: drag.source,
    mode: drag.mode,
    from: drag.from,
    point,
    ...(drag.edgeId === undefined ? {} : { edgeId: drag.edgeId }),
    ...(drag.end === undefined ? {} : { end: drag.end }),
  };
  if (hit === undefined || sameRow) return rest;
  const table = tables.find((t) => t.id === hit.tableId);
  const fixed = columnOf(deck, drag.source);
  const other = columnOf(deck, hit);
  // A new relationship and a moved `to` end read source → target; a moved `from` end the reverse.
  const mismatch =
    fixed === undefined || other === undefined
      ? undefined
      : drag.end === 'from'
        ? typeMismatch(other, fixed, dialect)
        : typeMismatch(fixed, other, dialect);
  return {
    ...rest,
    target: hit,
    ...(table === undefined
      ? {}
      : {
          targetAt: {
            x: table.box.x + table.box.width,
            y: table.box.y + rowAnchorY(table.layout, hit.columnId).y,
          },
        }),
    ...(mismatch === undefined ? {} : { mismatch }),
  };
}

export interface ColumnDragStart {
  clientX: number;
  clientY: number;
}

/**
 * Starts listening after a press on a port (`create`) or a relationship end handle
 * (`reconnect`, with the end that moves). Nothing is shown until the pointer moves 4 px.
 */
export function startColumnDrag(
  start: ColumnDragStart,
  source: ColumnRef,
  side: RelSide,
  reconnect?: { edgeId: string; end: 'from' | 'to' },
): void {
  const current = env;
  if (current === null) return;
  const ui = useUiStore.getState();
  let started = false;
  const origin = { x: start.clientX, y: start.clientY };

  const finish = () => {
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
    window.removeEventListener('keydown', onKey, true);
    useUiStore.getState().setColumnConnect(null);
  };
  const onMove = (event: PointerEvent) => {
    if (!started) {
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < DRAG_THRESHOLD) return;
      started = true;
    }
    const tables = current.tables();
    const from = portPoint(tables, source, side) ?? current.toFlow(origin);
    const base: ColumnConnect = {
      source,
      mode: reconnect === undefined ? 'create' : 'reconnect',
      ...(reconnect === undefined ? {} : { edgeId: reconnect.edgeId, end: reconnect.end }),
      from,
      point: from,
    };
    const point = current.toFlow({ x: event.clientX, y: event.clientY });
    ui.setColumnConnect(dragAt(base, point, tables, readDeck(current.editor.doc)));
  };
  const onUp = () => {
    const drag = useUiStore.getState().columnConnect;
    finish();
    if (!started || drag?.target === undefined) return;
    if (drag.mode === 'create') connectColumns(current.editor, drag.source, drag.target);
    else if (drag.edgeId !== undefined && drag.end !== undefined) {
      reconnectColumnEnd(current.editor, drag.edgeId, drag.end, drag.target);
    }
  };
  const onCancel = () => {
    finish();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  };
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  window.addEventListener('keydown', onKey, true);
}

/** A composite end cannot be dragged (FR-020): it says where its columns are edited. */
export function refuseCompositeDrag(): void {
  const ui = useUiStore.getState();
  ui.announce(COMPOSITE_END_HINT);
}
