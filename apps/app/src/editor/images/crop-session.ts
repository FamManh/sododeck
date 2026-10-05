/**
 * The maths of crop mode (057): pure functions on a crop rectangle in picture fractions, in the
 * picture's own, unflipped coordinates (the stored form). The overlay converts a pointer or key
 * move on the screen into a move of one picture edge: `pictureDelta` scales canvas pixels to
 * fractions and mirrors them, `pictureHandle` names the edge a mirrored handle really moves.
 */
import type { CropRect, PictureFlip } from '@sododeck/model';

/** The eight handles and the frame itself (a drag inside it moves it). */
export type CropHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'frame';

/** The handles in Tab order, clockwise from the top left (contracts/ui.md), with their names. */
export const CROP_HANDLES: readonly { id: Exclude<CropHandle, 'frame'>; label: string }[] = [
  { id: 'top-left', label: 'Crop top left corner' },
  { id: 'top', label: 'Crop top edge' },
  { id: 'top-right', label: 'Crop top right corner' },
  { id: 'right', label: 'Crop right edge' },
  { id: 'bottom-right', label: 'Crop bottom right corner' },
  { id: 'bottom', label: 'Crop bottom edge' },
  { id: 'bottom-left', label: 'Crop bottom left corner' },
  { id: 'left', label: 'Crop left edge' },
];

/** The whole picture as a crop. */
export const WHOLE_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

export interface DragOptions {
  /** ⇧ on a corner: keep the frame's proportions. */
  keepRatio: boolean;
  /** The smallest frame, in fractions (`minCropFraction`). */
  min: { width: number; height: number };
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

const movesLeft = (handle: CropHandle) => handle.endsWith('left');
const movesRight = (handle: CropHandle) => handle.endsWith('right');
const movesTop = (handle: CropHandle) => handle.startsWith('top');
const movesBottom = (handle: CropHandle) => handle.startsWith('bottom');
const isCorner = (handle: CropHandle) => handle.includes('-');

/**
 * The frame after dragging `handle` by `delta` (picture fractions) from `start`, clamped to the
 * picture and to `min`. With `keepRatio` on a corner, the frame scales about the opposite corner
 * by the axis that moved most, as far as the picture and the minimum allow.
 */
export function dragHandle(
  start: CropRect,
  handle: CropHandle,
  delta: { x: number; y: number },
  { keepRatio, min }: DragOptions,
): CropRect {
  if (handle === 'frame') return moveFrame(start, delta);
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let { x, y, width, height } = start;
  if (movesLeft(handle)) {
    x = clamp(start.x + delta.x, 0, right - min.width);
    width = right - x;
  } else if (movesRight(handle)) {
    width = clamp(start.width + delta.x, min.width, 1 - start.x);
  }
  if (movesTop(handle)) {
    y = clamp(start.y + delta.y, 0, bottom - min.height);
    height = bottom - y;
  } else if (movesBottom(handle)) {
    height = clamp(start.height + delta.y, min.height, 1 - start.y);
  }
  if (!keepRatio || !isCorner(handle)) return { x, y, width, height };

  // Scale about the opposite corner by the axis that moved most (unclamped), then fit.
  const freeWidth = start.width + (movesLeft(handle) ? -delta.x : delta.x);
  const freeHeight = start.height + (movesTop(handle) ? -delta.y : delta.y);
  const kx = freeWidth / start.width;
  const ky = freeHeight / start.height;
  const room = {
    width: movesLeft(handle) ? right : 1 - start.x,
    height: movesTop(handle) ? bottom : 1 - start.y,
  };
  const k = clamp(
    Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky,
    Math.max(min.width / start.width, min.height / start.height),
    Math.min(room.width / start.width, room.height / start.height),
  );
  width = start.width * k;
  height = start.height * k;
  return {
    x: movesLeft(handle) ? right - width : start.x,
    y: movesTop(handle) ? bottom - height : start.y,
    width,
    height,
  };
}

/** The frame moved by `delta` (picture fractions), its size kept, held inside the picture. */
export function moveFrame(start: CropRect, delta: { x: number; y: number }): CropRect {
  return {
    x: clamp(start.x + delta.x, 0, 1 - start.width),
    y: clamp(start.y + delta.y, 0, 1 - start.height),
    width: start.width,
    height: start.height,
  };
}

/**
 * A move on the screen (canvas pixels) as a move in picture fractions: divided by the size the
 * whole picture is drawn at, and mirrored on a flipped axis.
 */
export function pictureDelta(
  canvas: { x: number; y: number },
  picture: { width: number; height: number },
  flip: PictureFlip,
): { x: number; y: number } {
  const x = canvas.x / picture.width;
  const y = canvas.y / picture.height;
  return { x: flip.flipX === true ? -x : x, y: flip.flipY === true ? -y : y };
}

/** The picture edge an on-screen handle moves: a mirrored picture shows its right edge on the left. */
export function pictureHandle(handle: CropHandle, flip: PictureFlip): CropHandle {
  if (handle === 'frame') return handle;
  let out: string = handle;
  if (flip.flipX === true) {
    out = out.replace(/left|right/, (side) => (side === 'left' ? 'right' : 'left'));
  }
  if (flip.flipY === true) {
    out = out.replace(/top|bottom/, (side) => (side === 'top' ? 'bottom' : 'top'));
  }
  return out as CropHandle;
}

const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Whether `key` is an arrow key crop mode reacts to. */
export function isArrowKey(key: string): boolean {
  return key in ARROWS;
}

/**
 * An arrow key on a focused handle or on the frame (057 R8): moves it 1 canvas pixel, 10 with
 * `large`, clamped like a drag. An arrow across an edge handle (← on the top edge) does nothing.
 */
export function nudge(
  crop: CropRect,
  handle: CropHandle,
  key: string,
  large: boolean,
  picture: { width: number; height: number },
  flip: PictureFlip,
  min: { width: number; height: number },
): CropRect {
  const arrow = ARROWS[key];
  if (arrow === undefined) return crop;
  const horizontal = arrow.x !== 0;
  if ((handle === 'top' || handle === 'bottom') && horizontal) return crop;
  if ((handle === 'left' || handle === 'right') && !horizontal) return crop;
  const step = large ? 10 : 1;
  const delta = pictureDelta({ x: arrow.x * step, y: arrow.y * step }, picture, flip);
  return dragHandle(crop, pictureHandle(handle, flip), delta, { keepRatio: false, min });
}
