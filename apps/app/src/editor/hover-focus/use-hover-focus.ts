import type { Node } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { useUiStore, type HoverFocus, type UiState } from '../../state/ui-store';
import { focusTargetId } from '../focus-target';
import { useConnecting } from '../use-connection-role';

/** The pointer must rest this long on a card before its connections light up (034 R3). */
export const REST_MS = 150;
/** Leaving a card clears after this grace, so crossing a gap to the next card never flashes. */
export const GRACE_MS = 100;

/** Stickies, proxies and the scope label are not cards: resting on them lights nothing. */
const NOT_CARD_PREFIXES = ['sticky:', 'image:', 'sticky-leader:', 'port:', 'scope-label:'];

export function isHoverTarget(id: string): boolean {
  return !NOT_CARD_PREFIXES.some((prefix) => id.startsWith(prefix));
}

// Collapse does not change whether a target exists, only its id: an empty set is enough here.
const NO_COLLAPSED: ReadonlySet<string> = new Set();

/**
 * Hover focus runs only inside Focus mode with nothing pinned (051 R1): outside it nothing dims.
 * A pinned focus, flows, gestures, the hand tool and open menus own the canvas.
 */
function suspendedBy(s: UiState): boolean {
  return (
    !s.focusMode ||
    focusTargetId(s.selection, NO_COLLAPSED) !== null ||
    s.activeFlow !== null ||
    s.flowSession !== null ||
    s.canvasGesture !== null ||
    s.endpointPreview !== null ||
    s.tool === 'hand' ||
    s.popover !== null ||
    s.contextMenu !== null ||
    s.toolbarField !== null
  );
}

/**
 * Column and relationship highlights (042 FR-024) stay on in focus mode and flows, where they add
 * only the row highlight; gestures, menus and drags still turn them off.
 */
function rowsSuspendedBy(s: UiState): boolean {
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

const isRowFocus = (focus: HoverFocus | null) =>
  focus?.source === 'column' || focus?.source === 'edge';

export interface HoverFocusHandlers {
  onNodeMouseEnter: (event: ReactMouseEvent, node: Node) => void;
  onNodeMouseLeave: (event: ReactMouseEvent, node: Node) => void;
  /** Roving keyboard focus landed on a card. `announcement` is read out politely. */
  onCardFocus: (id: string, announcement?: string) => void;
  onCardBlur: () => void;
  /** The last pointer type seen on the canvas; touch has no hover, so it is ignored. */
  notePointerType: (type: string) => void;
  /**
   * The pointer moved between column rows (042 R14): `row` is the row now under it, or null
   * when it left the rows of `tableId` for the rest of the card (back to the card's own focus).
   */
  onRowHover: (tableId: string, row: string | null) => void;
  /** Keyboard focus landed on a column row (042 FR-022). */
  onRowFocus: (tableId: string, columnId: string) => void;
  /** The pointer is over a relationship (042 FR-023): its end rows light, nothing dims. */
  onRelationshipEnter: (edgeId: string) => void;
  onRelationshipLeave: (edgeId: string) => void;
}

/**
 * Hover focus (034 R3): the timers and suspension rules that decide when `hoverFocus` is set.
 * The set only holds an id; the lit connections come from `HoverFocusStyle`, so the canvas does
 * not subscribe to it.
 */
export function useHoverFocus(): HoverFocusHandlers {
  const connecting = useConnecting();
  const suspended = useUiStore(suspendedBy) || connecting;
  const suspendedRef = useRef(suspended);
  const rowsSuspended = useUiStore(rowsSuspendedBy) || connecting;
  const rowsSuspendedRef = useRef(rowsSuspended);
  const rest = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const grace = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const pointerType = useRef('mouse');

  const stopTimers = useCallback(() => {
    if (rest.current !== null) globalThis.clearTimeout(rest.current);
    if (grace.current !== null) globalThis.clearTimeout(grace.current);
    rest.current = null;
    grace.current = null;
  }, []);

  // A suspension (a drag, a menu, pinned focus…) ends any hover at once; column and
  // relationship highlights only end with the narrower one (FR-024).
  useEffect(() => {
    suspendedRef.current = suspended;
    rowsSuspendedRef.current = rowsSuspended;
    if (!suspended && !rowsSuspended) return;
    const focus = useUiStore.getState().hoverFocus;
    if (rowsSuspended || (focus !== null && !isRowFocus(focus))) {
      stopTimers();
      useUiStore.getState().clearHoverFocus();
    }
  }, [suspended, rowsSuspended, stopTimers]);

  useEffect(() => stopTimers, [stopTimers]);

  const onNodeMouseEnter = useCallback((_event: ReactMouseEvent, node: Node) => {
    if (suspendedRef.current || pointerType.current === 'touch' || !isHoverTarget(node.id)) return;
    if (grace.current !== null) globalThis.clearTimeout(grace.current);
    grace.current = null;
    if (rest.current !== null) globalThis.clearTimeout(rest.current);
    const ui = useUiStore.getState();
    // Already showing one: moving card to card switches without waiting again.
    if (ui.hoverFocus !== null) {
      ui.setHoverFocus({ id: node.id, source: 'pointer' });
      return;
    }
    rest.current = globalThis.setTimeout(() => {
      rest.current = null;
      if (suspendedRef.current) return;
      useUiStore.getState().setHoverFocus({ id: node.id, source: 'pointer' });
    }, REST_MS);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    if (rest.current !== null) globalThis.clearTimeout(rest.current);
    rest.current = null;
    if (useUiStore.getState().hoverFocus === null) return;
    if (grace.current !== null) globalThis.clearTimeout(grace.current);
    grace.current = globalThis.setTimeout(() => {
      grace.current = null;
      useUiStore.getState().clearHoverFocus();
    }, GRACE_MS);
  }, []);

  const onCardFocus = useCallback(
    (id: string, announcement?: string) => {
      if (suspendedRef.current || !isHoverTarget(id)) return;
      stopTimers();
      const ui = useUiStore.getState();
      ui.setHoverFocus({ id, source: 'keyboard' });
      if (announcement !== undefined) ui.announce(announcement);
    },
    [stopTimers],
  );

  const onCardBlur = useCallback(() => {
    const ui = useUiStore.getState();
    // A focused row's highlight is keyboard focus too (042); the pointer's stays.
    if (
      ui.hoverFocus?.source === 'keyboard' ||
      (ui.hoverFocus?.source === 'column' && ui.focusedRow !== null)
    )
      ui.clearHoverFocus();
  }, []);

  const notePointerType = useCallback((type: string) => {
    pointerType.current = type;
  }, []);

  /** Shows `focus` after the rest, or at once while another hover already shows. */
  const schedule = useCallback((focus: HoverFocus) => {
    if (grace.current !== null) globalThis.clearTimeout(grace.current);
    grace.current = null;
    if (rest.current !== null) globalThis.clearTimeout(rest.current);
    rest.current = null;
    const blocked = () => (isRowFocus(focus) ? rowsSuspendedRef.current : suspendedRef.current);
    if (blocked() || pointerType.current === 'touch') return;
    if (useUiStore.getState().hoverFocus !== null) {
      useUiStore.getState().setHoverFocus(focus);
      return;
    }
    rest.current = globalThis.setTimeout(() => {
      rest.current = null;
      if (!blocked()) useUiStore.getState().setHoverFocus(focus);
    }, REST_MS);
  }, []);

  const onRowHover = useCallback(
    (tableId: string, row: string | null) => {
      if (row === null) {
        const current = useUiStore.getState().hoverFocus;
        if (current?.source !== 'column') return;
        // Back on the card's header or body: the card's own focus (034), or nothing in focus
        // mode and flows, where card hover is off.
        if (suspendedRef.current) useUiStore.getState().clearHoverFocus();
        else schedule({ id: tableId, source: 'pointer' });
        return;
      }
      const columnId = row.slice(tableId.length + 1);
      schedule({ id: tableId, source: 'column', column: { tableId, columnId } });
    },
    [schedule],
  );

  const onRowFocus = useCallback(
    (tableId: string, columnId: string) => {
      if (rowsSuspendedRef.current) return;
      stopTimers();
      useUiStore.getState().setHoverFocus({
        id: tableId,
        source: 'column',
        column: { tableId, columnId },
      });
    },
    [stopTimers],
  );

  const onRelationshipEnter = useCallback(
    (edgeId: string) => {
      if (rowsSuspendedRef.current || pointerType.current === 'touch') return;
      stopTimers();
      useUiStore.getState().setHoverFocus({ id: edgeId, source: 'edge' });
    },
    [stopTimers],
  );

  const onRelationshipLeave = useCallback((edgeId: string) => {
    const ui = useUiStore.getState();
    if (ui.hoverFocus?.source === 'edge' && ui.hoverFocus.id === edgeId) ui.clearHoverFocus();
  }, []);

  return {
    onNodeMouseEnter,
    onNodeMouseLeave,
    onCardFocus,
    onCardBlur,
    notePointerType,
    onRowHover,
    onRowFocus,
    onRelationshipEnter,
    onRelationshipLeave,
  };
}
