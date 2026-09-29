/**
 * Where a paste lands (016 FR-004): the copied objects' top-left goes to the pointer; without one,
 * 24 px from where they were copied when that is on screen, else the view centre. Pasting again
 * at the same point (within 4 px) steps another 24 px each time, so copies never stack.
 */
import type { PasteSerial } from '../../state/ui-store';
import type { Point, Rect } from '../canvas-geometry';

export const PASTE_STEP = 24;
/** A pointer that moved less than this is still "the same point". */
const SAME_POINT = 4;

export interface PlacementInput {
  /** Top-left of the copied objects (`fragmentOrigin`). */
  source: Point;
  /** The pointer over the canvas, in canvas coordinates, or null. */
  pointer: Point | null;
  /** The part of the canvas on screen, in canvas coordinates. */
  visible: Rect;
  serial: PasteSerial | null;
}

const inside = (p: Point, r: Rect) =>
  p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;

export function pastePlacement({ source, pointer, visible, serial }: PlacementInput): {
  at: Point;
  serial: PasteSerial;
} {
  const nudged = { x: source.x + PASTE_STEP, y: source.y + PASTE_STEP };
  const base =
    pointer ??
    (inside(nudged, visible)
      ? nudged
      : { x: visible.x + visible.width / 2, y: visible.y + visible.height / 2 });
  const repeat =
    serial !== null &&
    Math.abs(serial.at.x - base.x) <= SAME_POINT &&
    Math.abs(serial.at.y - base.y) <= SAME_POINT;
  const at = repeat ? serial.at : base;
  const count = repeat ? serial.count + 1 : 0;
  return {
    at: { x: Math.round(at.x + count * PASTE_STEP), y: Math.round(at.y + count * PASTE_STEP) },
    serial: { at, count },
  };
}
