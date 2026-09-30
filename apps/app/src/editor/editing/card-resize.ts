/**
 * Resizing a single card with one of its eight handles (017 R4, FR-002–FR-007): the pointer's
 * proposed rect goes through `resizeBox` (min 120 × 44, max 800 × 600, step 4), then snaps its
 * dragged edges to the other on-screen cards (⌘ turns that off), then writes the size and, for a
 * top or left handle, the moved position — one undo step for the whole drag, and Esc cancels it.
 * Connections stay attached because they are drawn from the card's live box (R2), not recomputed
 * here.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { useUiStore, type Guide } from '../../state/ui-store';
import { CARD_SIZE_LIMITS, cardBox, type Rect } from '../canvas-geometry';
import type { Level } from '../levels';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { setActiveGesture } from './drag-session';
import { resizeBox, type Handle } from './resize-limits';
import { snapCandidates, snapEdges, type SnapCandidates } from './snap';

/** DESIGN.md "Snap guide": within 6 screen px. */
const SNAP_SCREEN_PX = 6;

export interface CardResizeSession {
  nodeId: Id;
  title: string;
  viewId: Id;
  handle: Handle;
  start: Rect;
  candidates: SnapCandidates;
  /** The last box `applyCardResize` wrote, for the closing announcement. */
  last: Rect;
  cancelled: boolean;
}

/** Starts a card resize. Null when the card is not drawn in the current view. */
export function startCardResize(
  editor: DeckEditor,
  nodeId: Id,
  handle: Handle,
  level: Level,
): CardResizeSession | null {
  const view = readViewState(editor.doc);
  const index = view.deck.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return null;
  const node = view.deck.nodes[index];
  if (node === undefined) return null;
  const start = cardBox(node, index, level);
  const title = node.title;

  // Snap candidates are every other visible card, collected once (017 R4, like drag's R7).
  const ui = useUiStore.getState();
  const scope = scopeOf(ui.drill);
  const graph = visibleGraph(view.deck, scope, view.collapsed);
  const visible = new Set(graph.nodes);
  const others: Rect[] = [];
  view.deck.nodes.forEach((node, i) => {
    if (node.id === nodeId || !visible.has(node.id)) return;
    others.push(cardBox(node, i, level));
  });

  const session: CardResizeSession = {
    nodeId,
    title,
    viewId: view.view.id,
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
      session.cancelled = true;
      editor.cancelGesture();
      ui.setCanvasGesture(null);
      ui.setResizeReadout(null);
      ui.setGuides([]);
      ui.announce('Cancelled');
      return true;
    },
    arrow: () => false,
  });
  return session;
}

/** One frame of the resize: the pointer's proposal, clamped, snapped, then written. */
export function applyCardResize(
  editor: DeckEditor,
  session: CardResizeSession,
  proposed: Rect,
  mods: { shift: boolean; alt: boolean; mod: boolean },
  zoom: number,
): void {
  if (session.cancelled) return;
  let box = resizeBox({
    start: session.start,
    proposed,
    handle: session.handle,
    min: CARD_SIZE_LIMITS.min,
    max: CARD_SIZE_LIMITS.max,
    step: CARD_SIZE_LIMITS.step,
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
    editor.setCardSize(session.nodeId, { width: box.width, height: box.height });
    if (box.x !== session.start.x || box.y !== session.start.y) {
      editor.moveInView(session.viewId, { [session.nodeId]: { x: box.x, y: box.y } });
    }
  });
  session.last = box;
  ui.setResizeReadout({ width: box.width, height: box.height, x: box.x, y: box.y });
}

export function endCardResize(editor: DeckEditor, session: CardResizeSession): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'card-resize') ui.setCanvasGesture(null);
  ui.setResizeReadout(null);
  ui.setGuides([]);
  if (session.cancelled) return;
  editor.endGesture();
  ui.announce(
    `Resized ${session.title} to ${String(session.last.width)} × ${String(session.last.height)}`,
  );
}
