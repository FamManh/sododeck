import type { UiState } from '../../state/ui-store';

/**
 * Column and relationship highlights (042 FR-024) stay on in focus mode and flows, where they add
 * only the row highlight; gestures, menus and drags still turn them off.
 */
export function rowsSuspendedBy(s: UiState): boolean {
  return (
    s.flowSession !== null ||
    s.canvasGesture !== null ||
    s.endpointPreview !== null ||
    s.columnConnect !== null ||
    s.tool === 'hand' ||
    s.popover !== null ||
    s.contextMenu !== null ||
    s.toolbarField !== null
  );
}

/**
 * When database note popovers (064) must not open, and an open one closes: the row highlight's
 * suspensions, a connection being drawn, and a row being edited or dragged.
 */
export function dbHoverSuspended(s: UiState, connecting: boolean): boolean {
  return rowsSuspendedBy(s) || connecting || s.columnEdit !== null || s.rowDrag !== null;
}
