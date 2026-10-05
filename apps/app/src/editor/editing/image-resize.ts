/**
 * Resizing a picture with one of its eight handles (055 US3). The same gesture as a note's
 * (`sticky-resize.ts`): the pointer's proposed rect is clamped (min 32 × 32), snaps its dragged
 * edges to the other drawn cards (⌘ turns that off) and is written live inside one gesture, so the
 * whole drag is one undo step and Esc puts the picture back. The aspect ratio holds unless ⇧ is
 * held, because a picture stretched by accident is the common mistake (contracts/ui.md).
 */
import { IMAGE_MAX_SIDE, IMAGE_MIN_SIZE, clampImageSize, imageBox } from '@sododeck/model';
import type { DeckEditor } from '@sododeck/model';
import type { Id } from '@sododeck/schema';

import { useUiStore, type Guide } from '../../state/ui-store';
import { cardBox, type Rect, type SizeLimits } from '../canvas-geometry';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { setActiveGesture } from './drag-session';
import { resizeBox, type Handle } from './resize-limits';
import { snapCandidates, snapEdges, type SnapCandidates } from './snap';

/** DESIGN.md "Snap guide": within 6 screen px. */
const SNAP_SCREEN_PX = 6;

/** Whole pixels, so the ratio holds; the largest side is the longest a scene stays sensible. */
export const IMAGE_SIZE_LIMITS: SizeLimits = {
  min: IMAGE_MIN_SIZE,
  max: { width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE },
  step: 1,
};

export interface ImageResizeSession {
  imageId: Id;
  handle: Handle;
  start: Rect;
  candidates: SnapCandidates;
  /** The last box `applyImageResize` wrote, for the closing announcement. */
  last: Rect;
  cancelled: boolean;
}

/** Starts a picture resize. Null when the picture does not exist or is locked. */
export function startImageResize(
  editor: DeckEditor,
  imageId: Id,
  handle: Handle,
  level: Parameters<typeof cardBox>[2] = 'system',
): ImageResizeSession | null {
  const deck = readViewState(editor.doc).deck;
  const image = (deck.images ?? []).find((entry) => entry.id === imageId);
  if (image === undefined || image.locked === true) return null;
  const start = imageBox(image);

  const ui = useUiStore.getState();
  const graph = visibleGraph(deck, scopeOf(ui.drill), readViewState(editor.doc).collapsed);
  const visible = new Set(graph.nodes);
  const others: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (visible.has(node.id)) others.push(cardBox(node, index, level));
  });
  for (const other of deck.images ?? []) {
    if (other.id !== imageId) others.push(imageBox(other));
  }

  const session: ImageResizeSession = {
    imageId,
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
export function applyImageResize(
  editor: DeckEditor,
  session: ImageResizeSession,
  proposed: Rect,
  mods: { shift: boolean; alt: boolean; mod: boolean },
  zoom: number,
): void {
  if (session.cancelled) return;
  let box = resizeBox({
    start: session.start,
    proposed,
    handle: session.handle,
    min: IMAGE_SIZE_LIMITS.min,
    max: IMAGE_SIZE_LIMITS.max,
    step: IMAGE_SIZE_LIMITS.step,
    keepRatio: !mods.shift,
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
    editor.setImageSize(session.imageId, { width: box.width, height: box.height });
    if (box.x !== session.start.x || box.y !== session.start.y) {
      editor.moveImage(session.imageId, { x: box.x, y: box.y });
    }
  });
  session.last = box;
  ui.setResizeReadout({ width: box.width, height: box.height, x: box.x, y: box.y });
}

function revert(editor: DeckEditor, session: ImageResizeSession): void {
  session.cancelled = true;
  editor.cancelGesture();
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'card-resize') ui.setCanvasGesture(null);
  ui.setResizeReadout(null);
  ui.setGuides([]);
}

/** Ends a resize React Flow will never end (the node unmounted mid-drag): the picture goes back. */
export function cancelImageResize(editor: DeckEditor, session: ImageResizeSession): void {
  if (!session.cancelled) revert(editor, session);
  setActiveGesture(null);
}

export function endImageResize(editor: DeckEditor, session: ImageResizeSession): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'card-resize') ui.setCanvasGesture(null);
  ui.setResizeReadout(null);
  ui.setGuides([]);
  if (session.cancelled) return;
  editor.endGesture();
  ui.announce(`Resized image to ${String(session.last.width)} × ${String(session.last.height)}`);
}

const KEY_STEP = 8;
const KEY_STEP_LARGE = 32;

/**
 * The keyboard way to resize a picture (Alt + arrow, ⇧ for a larger step): → and ↑… follow the note
 * rule (→ and ↓ grow, ← and ↑ shrink), the other side follows the aspect ratio. Returns false
 * when nothing changed (missing, locked, already at the minimum or maximum).
 */
export function resizeImageByKey(
  editor: DeckEditor,
  imageId: Id,
  key: string,
  large: boolean,
): boolean {
  const image = (readViewState(editor.doc).deck.images ?? []).find((entry) => entry.id === imageId);
  if (image === undefined || image.locked === true) return false;
  const step = large ? KEY_STEP_LARGE : KEY_STEP;
  const delta =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? step
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? -step
        : 0;
  if (delta === 0) return false;
  const { size } = image;
  const ratio = size.width / size.height;
  // The longer side takes the step, so a narrow strip does not collapse before a wide one.
  const grow = size.width >= size.height;
  const proposed = grow
    ? { width: size.width + delta, height: Math.round((size.width + delta) / ratio) }
    : { width: Math.round((size.height + delta) * ratio), height: size.height + delta };
  // At the minimum the smaller side stops at 32 and the other keeps the ratio (never stretched).
  const floor = Math.max(
    1,
    IMAGE_MIN_SIZE.width / proposed.width,
    IMAGE_MIN_SIZE.height / proposed.height,
  );
  const fixed = clampImageSize({
    width: Math.round(proposed.width * floor),
    height: Math.round(proposed.height * floor),
  });
  if (fixed.width === size.width && fixed.height === size.height) return false;
  editor.setImageSize(imageId, fixed);
  useUiStore
    .getState()
    .announce(`Resized image to ${String(fixed.width)} × ${String(fixed.height)}`);
  return true;
}
