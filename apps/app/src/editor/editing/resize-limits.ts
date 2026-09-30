/**
 * Limits of a group frame resize (016 R5, FR-044) and of a card resize (017 R4): `resizeFrame`
 * keeps a frame containing its members plus padding, never smaller than MIN_FRAME; `resizeBox`
 * generalises the same span math to any min/max/step (cards: 120×44–800×600, step 4). Pure; the
 * resizers and the drawer fields share it.
 */
import type { Rect } from '../canvas-geometry';

export const MIN_FRAME = { width: 160, height: 96 } as const;

export type Handle =
  'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';

export interface ResizeInput {
  /** The frame when the resize started. */
  start: Rect;
  /** The rect React Flow's resizer proposes for the pointer (only its moving edges are trusted). */
  proposed: Rect;
  /** Which handle is dragged: decides which edges move. */
  handle: Handle;
  /** Bounding box of the group's member cards and nested frames (no padding); null when empty. */
  content: Rect | null;
  /** GROUP_PADDING (24). */
  padding: number;
  /** ⇧ held. */
  keepRatio: boolean;
  /** ⌥ held. */
  fromCentre: boolean;
}

/**
 * How an axis may change: `fixed` (neither edge), `low` (left/top edge), `high` (right/bottom
 * edge) or `both` (symmetric around the start centre).
 */
type AxisMode = 'fixed' | 'low' | 'high' | 'both';

interface Span {
  lo: number;
  hi: number;
}

/** The smallest box the frame must contain: content grown by padding (null when no content). */
export function requiredBox(content: Rect | null, padding: number): Rect | null {
  if (!content) return null;
  return {
    x: content.x - padding,
    y: content.y - padding,
    width: content.width + 2 * padding,
    height: content.height + 2 * padding,
  };
}

function axisMode(handle: Handle, low: 'left' | 'top', high: 'right' | 'bottom'): AxisMode {
  if (handle.includes(low)) return 'low';
  if (handle.includes(high)) return 'high';
  return 'fixed';
}

/** Moving edges from `proposed`, the others from `start`, then ⌥ mirroring. */
function proposedSpan(start: Span, proposed: Span, mode: AxisMode, fromCentre: boolean): Span {
  if (mode === 'fixed') return start;
  const centre = (start.lo + start.hi) / 2;
  if (mode === 'low') {
    return fromCentre
      ? { lo: proposed.lo, hi: 2 * centre - proposed.lo }
      : { lo: proposed.lo, hi: start.hi };
  }
  return fromCentre
    ? { lo: 2 * centre - proposed.hi, hi: proposed.hi }
    : { lo: start.lo, hi: proposed.hi };
}

/** A span of `size` placed on an axis, anchored at the edge that does not move (or the centre). */
function sized(start: Span, mode: AxisMode, size: number): Span {
  if (mode === 'low') return { lo: start.hi - size, hi: start.hi };
  if (mode === 'high') return { lo: start.lo, hi: start.lo + size };
  const centre = (start.lo + start.hi) / 2;
  return { lo: centre - size / 2, hi: centre + size / 2 };
}

/** Grows the edges this axis may move until it contains `required` and is at least `min`. */
function clampSpan(span: Span, start: Span, mode: AxisMode, required: Span | null, min: number) {
  switch (mode) {
    case 'fixed':
      return span;
    case 'high':
      return { lo: span.lo, hi: Math.max(span.hi, span.lo + min, required?.hi ?? -Infinity) };
    case 'low':
      return { lo: Math.min(span.lo, span.hi - min, required?.lo ?? Infinity), hi: span.hi };
    case 'both': {
      const centre = (start.lo + start.hi) / 2;
      const half = Math.max(
        (span.hi - span.lo) / 2,
        min / 2,
        required ? centre - required.lo : -Infinity,
        required ? required.hi - centre : -Infinity,
      );
      return { lo: centre - half, hi: centre + half };
    }
  }
}

const xSpan = (r: Rect): Span => ({ lo: r.x, hi: r.x + r.width });
const ySpan = (r: Rect): Span => ({ lo: r.y, hi: r.y + r.height });

function toRect(x: Span, y: Span): Rect {
  const left = Math.round(x.lo);
  const top = Math.round(y.lo);
  return { x: left, y: top, width: Math.round(x.hi) - left, height: Math.round(y.hi) - top };
}

/**
 * Limits of a card resize (017 R4, CARD_SIZE_LIMITS): min/max size and a step that rounds the
 * absolute width/height of a moved edge to its nearest multiple (never a fixed, undragged edge).
 */
export interface BoxResizeInput {
  start: Rect;
  proposed: Rect;
  handle: Handle;
  min: { width: number; height: number };
  max: { width: number; height: number };
  step: number;
  keepRatio: boolean;
  fromCentre: boolean;
}

function clampStep(size: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, size));
  return Math.round(clamped / step) * step;
}

interface Spans {
  x: Span;
  y: Span;
  modeX: AxisMode;
  modeY: AxisMode;
}

/**
 * The moving edges' spans before either resizer's own clamp: the handle's axes proposed (or
 * mirrored with ⌥), then ⇧'s ratio lock. Shared by `resizeBox` and `resizeFrame` (017 R4, T024).
 */
function proposedSpans(
  start: Rect,
  proposed: Rect,
  handle: Handle,
  keepRatio: boolean,
  fromCentre: boolean,
): Spans {
  const startX = xSpan(start);
  const startY = ySpan(start);
  const moveX = axisMode(handle, 'left', 'right');
  const moveY = axisMode(handle, 'top', 'bottom');
  // With ⌥ the moving axes grow symmetrically, for the ratio and for the clamp alike.
  let modeX: AxisMode = fromCentre && moveX !== 'fixed' ? 'both' : moveX;
  let modeY: AxisMode = fromCentre && moveY !== 'fixed' ? 'both' : moveY;

  let x = proposedSpan(startX, xSpan(proposed), moveX, fromCentre);
  let y = proposedSpan(startY, ySpan(proposed), moveY, fromCentre);

  if (keepRatio && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    const width = Math.max(0, x.hi - x.lo);
    const height = Math.max(0, y.hi - y.lo);
    if (modeX !== 'fixed' && modeY !== 'fixed') {
      const changeX = Math.abs(width - start.width) / start.width;
      const changeY = Math.abs(height - start.height) / start.height;
      if (changeX >= changeY) y = sized(startY, modeY, width / ratio);
      else x = sized(startX, modeX, height * ratio);
    } else if (modeX !== 'fixed') {
      // A side handle keeps the other axis's centre, so that axis grows symmetrically.
      modeY = 'both';
      y = sized(startY, modeY, width / ratio);
    } else if (modeY !== 'fixed') {
      modeX = 'both';
      x = sized(startX, modeX, height * ratio);
    }
  }
  return { x, y, modeX, modeY };
}

export function resizeBox(input: BoxResizeInput): Rect {
  const { start, proposed, handle, keepRatio, fromCentre, min, max, step } = input;
  const startX = xSpan(start);
  const startY = ySpan(start);
  const {
    x: rawX,
    y: rawY,
    modeX,
    modeY,
  } = proposedSpans(start, proposed, handle, keepRatio, fromCentre);
  let x = rawX;
  let y = rawY;

  // Only a moved edge rounds to `step`; an axis the handle never touches keeps its exact start
  // value, so a card whose stored size is not itself a multiple of 4 never drifts on one axis.
  if (modeX !== 'fixed') {
    x = sized(startX, modeX, clampStep(x.hi - x.lo, min.width, max.width, step));
  }
  if (modeY !== 'fixed') {
    y = sized(startY, modeY, clampStep(y.hi - y.lo, min.height, max.height, step));
  }
  return toRect(x, y);
}

export function resizeFrame(input: ResizeInput): Rect {
  const { start, handle, content, padding } = input;
  const startX = xSpan(start);
  const startY = ySpan(start);
  const { x, y, modeX, modeY } = proposedSpans(
    start,
    input.proposed,
    handle,
    input.keepRatio,
    input.fromCentre,
  );
  const required = requiredBox(content, padding);
  const clampedX = clampSpan(x, startX, modeX, required ? xSpan(required) : null, MIN_FRAME.width);
  const clampedY = clampSpan(y, startY, modeY, required ? ySpan(required) : null, MIN_FRAME.height);
  return toRect(clampedX, clampedY);
}

/**
 * Clamps a whole frame typed in the drawer (X/Y/W/H fields): at least MIN_FRAME and containing
 * requiredBox; X/Y kept, width/height grown as needed; if X/Y would cut the content, the frame is
 * moved to contain it.
 */
export function clampFrame(frame: Rect, content: Rect | null, padding: number): Rect {
  const required = requiredBox(content, padding);
  let { x, y } = frame;
  let width = Math.max(frame.width, MIN_FRAME.width);
  let height = Math.max(frame.height, MIN_FRAME.height);
  if (required) {
    x = Math.min(x, required.x);
    y = Math.min(y, required.y);
    width = Math.max(width, required.x + required.width - x);
    height = Math.max(height, required.y + required.height - y);
  }
  return toRect({ lo: x, hi: x + width }, { lo: y, hi: y + height });
}
