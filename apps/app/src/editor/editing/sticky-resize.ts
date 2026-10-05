/**
 * Resizing a note with one of its eight handles (053 R8). The same gesture as a card's
 * (`card-resize.ts`, 017 R4): the pointer's proposed rect is clamped (min 96 × 96, step 4), snaps
 * its dragged edges to the other drawn cards and notes (⌘ turns that off), and is written live
 * inside one gesture, so the whole drag is one undo step and Esc puts the note back. Connectors
 * stay attached because they are drawn from the note's live box.
 */
import { STICKY_MIN_SIZE, stickyBox, stickyCanvasPosition } from '@sododeck/model';
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { useUiStore, type Guide } from '../../state/ui-store';
import { cardBox, type Rect, type SizeLimits } from '../canvas-geometry';
import { scopeOf, visibleGraph } from '../visible-graph';
import { moveStickyInView, readViewState } from '../views/use-current-view';
import { setActiveGesture } from './drag-session';
import { resizeBox, type Handle } from './resize-limits';
import { snapCandidates, snapEdges, type SnapCandidates } from './snap';

/** DESIGN.md "Snap guide": within 6 screen px. */
const SNAP_SCREEN_PX = 6;

/** A note is at least 96 × 96, at most 800 × 800, in steps of 4 like a card. */
export const STICKY_SIZE_LIMITS: SizeLimits = {
  min: STICKY_MIN_SIZE,
  max: { width: 800, height: 800 },
  step: 4,
};

export interface StickyResizeSession {
  stickyId: Id;
  label: string;
  handle: Handle;
  start: Rect;
  candidates: SnapCandidates;
  /** The last box `applyStickyResize` wrote, for the closing announcement. */
  last: Rect;
  cancelled: boolean;
}

/** Starts a note resize. Null when the note does not exist, is locked or is collapsed. */
export function startStickyResize(
  editor: DeckEditor,
  stickyId: Id,
  handle: Handle,
  level: Parameters<typeof cardBox>[2] = 'system',
): StickyResizeSession | null {
  const deck = readViewState(editor.doc).deck;
  const sticky = deck.stickies.find((s) => s.id === stickyId);
  if (sticky === undefined || sticky.locked === true || sticky.collapsed === true) return null;
  const start = stickyBox(sticky, stickyCanvasPosition(deck, sticky).point);

  // Snap candidates: every other drawn card and note, collected once (like a card resize).
  const ui = useUiStore.getState();
  const graph = visibleGraph(deck, scopeOf(ui.drill), readViewState(editor.doc).collapsed);
  const visible = new Set(graph.nodes);
  const others: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (visible.has(node.id)) others.push(cardBox(node, index, level));
  });
  for (const other of deck.stickies) {
    if (other.id === stickyId) continue;
    others.push(stickyBox(other, stickyCanvasPosition(deck, other).point));
  }

  const session: StickyResizeSession = {
    stickyId,
    label: sticky.text.trim().split('\n')[0] ?? '',
    handle,
    start,
    candidates: snapCandidates(others),
    last: start,
    cancelled: false,
  };
  editor.beginGesture();
  ui.setCanvasGesture('card-resize');
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      revert(editor, session);
      ui.announce('Cancelled');
      return true;
    },
    arrow: () => false,
  });
  return session;
}

/** One frame: the pointer's proposal, clamped, snapped, then written. */
export function applyStickyResize(
  editor: DeckEditor,
  session: StickyResizeSession,
  proposed: Rect,
  mods: { shift: boolean; alt: boolean; mod: boolean },
  zoom: number,
): void {
  if (session.cancelled) return;
  let box = resizeBox({
    start: session.start,
    proposed,
    handle: session.handle,
    min: STICKY_SIZE_LIMITS.min,
    max: STICKY_SIZE_LIMITS.max,
    step: STICKY_SIZE_LIMITS.step,
    keepRatio: mods.shift,
    fromCentre: mods.alt,
  });
  let guides: readonly Guide[] = [];
  if (!mods.mod) {
    const threshold = SNAP_SCREEN_PX / (zoom > 0 ? zoom : 1);
    const snapped = snapEdges(box, session.handle, session.candidates, threshold);
    box = snapped.box;
    guides = snapped.guides;
  }
  const ui = useUiStore.getState();
  ui.setGuides(guides);
  editor.batch(() => {
    editor.setStickySize(session.stickyId, { width: box.width, height: box.height });
    if (box.x !== session.start.x || box.y !== session.start.y) {
      moveStickyInView(editor, session.stickyId, { x: box.x, y: box.y });
    }
  });
  session.last = box;
  ui.setResizeReadout({ width: box.width, height: box.height, x: box.x, y: box.y });
}

function revert(editor: DeckEditor, session: StickyResizeSession): void {
  session.cancelled = true;
  editor.cancelGesture();
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'card-resize') ui.setCanvasGesture(null);
  ui.setResizeReadout(null);
  ui.setGuides([]);
}

/** Ends a resize React Flow will never end (the node unmounted mid-drag): the note goes back. */
export function cancelStickyResize(editor: DeckEditor, session: StickyResizeSession): void {
  if (!session.cancelled) revert(editor, session);
  setActiveGesture(null);
}

export function endStickyResize(editor: DeckEditor, session: StickyResizeSession): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'card-resize') ui.setCanvasGesture(null);
  ui.setResizeReadout(null);
  ui.setGuides([]);
  if (session.cancelled) return;
  editor.endGesture();
  ui.announce(`Resized note to ${String(session.last.width)} × ${String(session.last.height)}`);
}
