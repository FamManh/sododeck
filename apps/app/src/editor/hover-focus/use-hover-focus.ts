import type { Node } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

import { useUiStore, type UiState } from '../../state/ui-store';
import { useConnecting } from '../use-connection-role';

/** The pointer must rest this long on a card before its connections light up (034 R3). */
export const REST_MS = 150;
/** Leaving a card clears after this grace, so crossing a gap to the next card never flashes. */
export const GRACE_MS = 100;

/** Stickies, proxies and the scope label are not cards: resting on them lights nothing. */
const NOT_CARD_PREFIXES = ['sticky:', 'sticky-leader:', 'port:', 'scope-label:'];

export function isHoverTarget(id: string): boolean {
  return !NOT_CARD_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/** Pinned focus, flows, gestures, the hand tool and open menus own the canvas: no hover focus. */
function suspendedBy(s: UiState): boolean {
  return (
    s.focusMode ||
    s.activeFlow !== null ||
    s.flowSession !== null ||
    s.canvasGesture !== null ||
    s.reconnectingEdgeId !== null ||
    s.tool === 'hand' ||
    s.popover !== null ||
    s.contextMenu !== null ||
    s.toolbarField !== null
  );
}

export interface HoverFocusHandlers {
  onNodeMouseEnter: (event: ReactMouseEvent, node: Node) => void;
  onNodeMouseLeave: (event: ReactMouseEvent, node: Node) => void;
  /** Roving keyboard focus landed on a card. `announcement` is read out politely. */
  onCardFocus: (id: string, announcement?: string) => void;
  onCardBlur: () => void;
  /** The last pointer type seen on the canvas; touch has no hover, so it is ignored. */
  notePointerType: (type: string) => void;
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
  const rest = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const grace = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const pointerType = useRef('mouse');

  const stopTimers = useCallback(() => {
    if (rest.current !== null) globalThis.clearTimeout(rest.current);
    if (grace.current !== null) globalThis.clearTimeout(grace.current);
    rest.current = null;
    grace.current = null;
  }, []);

  // A suspension (a drag, a menu, pinned focus…) ends any hover at once.
  useEffect(() => {
    suspendedRef.current = suspended;
    if (!suspended) return;
    stopTimers();
    useUiStore.getState().clearHoverFocus();
  }, [suspended, stopTimers]);

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
    if (ui.hoverFocus?.source === 'keyboard') ui.clearHoverFocus();
  }, []);

  const notePointerType = useCallback((type: string) => {
    pointerType.current = type;
  }, []);

  return { onNodeMouseEnter, onNodeMouseLeave, onCardFocus, onCardBlur, notePointerType };
}
