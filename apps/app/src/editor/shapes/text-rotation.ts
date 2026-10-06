/**
 * Turned text (founder feedback, 2026-10-06, ADR 0043): `node.rotation`, degrees clockwise around
 * the box centre. Paint-only, like the drag tilt (§g-74): the box, snapping, hit tests, handles
 * and connectors stay axis-aligned; only the words (and their rings) turn.
 */
import { shapeGeometryOf } from '@sododeck/model';

/** The Shift step of the rotate handle and the arrow-key step. */
export const ROTATION_STEP = 15;

/** Wraps to (-180, 180] and rounds to tenths, so stored values stay short and in range. */
export function normaliseRotation(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180;
  const turned = wrapped === -180 ? 180 : wrapped;
  const rounded = Math.round(turned * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/** The turn a node is drawn with: a text's stored rotation; 0 for every other type. */
export function textRotationOf(node: {
  type: string;
  display?: 'card' | 'shape';
  rotation?: number;
}): number {
  if (shapeGeometryOf({ type: node.type, display: node.display }) !== 'none') return 0;
  return normaliseRotation(node.rotation ?? 0);
}

/**
 * The turn that points the top of the box at the pointer: 0 straight up, clockwise positive.
 * Whole degrees, or `ROTATION_STEP` steps with `snap` (Shift).
 */
export function rotationFromPointer(
  centre: { x: number; y: number },
  pointer: { x: number; y: number },
  snap: boolean,
): number {
  const degrees = (Math.atan2(pointer.x - centre.x, centre.y - pointer.y) * 180) / Math.PI;
  const step = snap ? ROTATION_STEP : 1;
  return normaliseRotation(Math.round(degrees / step) * step);
}

/** `current` turned by `delta` degrees, wrapped. */
export function stepRotation(current: number, delta: number): number {
  return normaliseRotation(current + delta);
}

/** What to write: `null` removes the key at 0 (schema: absent means not turned). */
export function rotationPatch(degrees: number): number | null {
  const value = normaliseRotation(degrees);
  return value === 0 ? null : value;
}
