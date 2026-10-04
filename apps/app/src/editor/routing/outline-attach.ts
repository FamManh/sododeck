/**
 * Where a dragged connector end attaches to a card (050 R5). Pure: no DOM, no React.
 *
 * - **Nearest point.** The end sits on the point of the outline nearest the pointer, inside or
 *   outside the card. For a rectangle each side is projected exactly; neighbouring sides meet at
 *   the corners, so the end slides round a corner without a jump. A shape (031) is sampled along
 *   each side through `outlinePoint` and the best sample refined.
 * - **Midpoint snap.** Only the middle of a side (`at` 0.5) snaps, within `MIDPOINT_SNAP` screen
 *   px, so many ends on one side can sit a few px apart. ⌘ / Ctrl (`mod`) turns it off, and sides
 *   too short for a useful snap never snap.
 * - **Centre zone.** For the end's own card only (`allowAutomatic`): the middle 40 % of each axis
 *   means "automatic", but only where that zone stays `CENTRE_MARGIN` screen px from every side,
 *   so it can't be hit by accident on a small card.
 *
 * Every distance is in screen px and divided by the zoom (FR-030).
 */
import type { Geometry } from '@sododeck/model';
import type { Side } from '@sododeck/schema';

import { stepAnchor } from '../editing/anchor-drag';
import { outlinePoint } from '../shapes/shape-geometry';
import { anchorPoint } from './connector-geometry';
import type { Box, Point } from './route-path';

/** Snap reach to a side's middle, in screen px (FR-010). */
export const MIDPOINT_SNAP = 6;
/** The centre zone's share of each axis (clarify 2026-10-04). */
export const CENTRE_ZONE = 0.4;
/** The least distance, in screen px, between the centre zone and every side (FR-011). */
export const CENTRE_MARGIN = 24;
/** Sides shorter than this on screen do not snap (spec edge case: 3 × the snap reach). */
const MIN_SNAP_SIDE = 3 * MIDPOINT_SNAP;
/** Samples per side of a shape outline before refining. */
const SHAPE_SAMPLES = 48;
const REFINE_STEPS = 24;

export interface Attachment {
  side: Side;
  /** 0 to 1 along the side: left → right on top and bottom, top → bottom on left and right. */
  at: number;
  /** Where the end sits, on the outline. */
  point: Point;
  /** Pulled onto the side's middle. */
  snapped: boolean;
  /** In the centre zone of the end's own card: a drop makes the end automatic. */
  automatic: boolean;
}

export interface AttachOptions {
  zoom: number;
  /** ⌘ / Ctrl held: no snapping. */
  mod: boolean;
  /** The end's own current card: the centre zone may make it automatic. */
  allowAutomatic: boolean;
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** Stored fractions stay short (as 022 stores them). */
const tidy = (n: number): number => Math.round(n * 10000) / 10000;

/** Uses the box itself for plain cards and the text shape, the outline for every other shape. */
function shaped(geometry: Geometry | undefined): geometry is Exclude<Geometry, 'none'> {
  return geometry !== undefined && geometry !== 'none';
}

function pointAt(box: Box, geometry: Geometry | undefined, side: Side, at: number): Point {
  return shaped(geometry) ? outlinePoint(geometry, box, side, at) : anchorPoint(box, side, at);
}

/** The exact nearest point of one rectangle side. */
function projectOnSide(box: Box, side: Side, p: Point): { at: number; distance: number } {
  const horizontal = side === 'top' || side === 'bottom';
  const length = horizontal ? box.width : box.height;
  const raw = horizontal ? p.x - box.x : p.y - box.y;
  const at = length === 0 ? 0.5 : clamp01(raw / length);
  return { at, distance: distance(anchorPoint(box, side, at), p) };
}

/** The nearest point of one shape side: the best of the samples, then a golden-section refine. */
function projectOnShapeSide(
  box: Box,
  geometry: Exclude<Geometry, 'none'>,
  side: Side,
  p: Point,
): { at: number; distance: number } {
  const dist = (t: number) => distance(outlinePoint(geometry, box, side, t), p);
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= SHAPE_SAMPLES; i += 1) {
    const t = i / SHAPE_SAMPLES;
    const d = dist(t);
    if (d < bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  let lo = Math.max(0, best - 1 / SHAPE_SAMPLES);
  let hi = Math.min(1, best + 1 / SHAPE_SAMPLES);
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < REFINE_STEPS; i += 1) {
    const a = hi - (hi - lo) * ratio;
    const b = lo + (hi - lo) * ratio;
    if (dist(a) <= dist(b)) hi = b;
    else lo = a;
  }
  const refined = (lo + hi) / 2;
  const refinedDistance = dist(refined);
  return refinedDistance <= bestDistance
    ? { at: refined, distance: refinedDistance }
    : { at: best, distance: bestDistance };
}

/** Whether `p` lies in the centre zone, and the zone keeps its margin on screen. */
function inCentreZone(box: Box, p: Point, zoom: number): boolean {
  const edge = (1 - CENTRE_ZONE) / 2;
  const marginX = box.width * edge * zoom;
  const marginY = box.height * edge * zoom;
  if (marginX < CENTRE_MARGIN || marginY < CENTRE_MARGIN) return false;
  return (
    p.x >= box.x + box.width * edge &&
    p.x <= box.x + box.width * (1 - edge) &&
    p.y >= box.y + box.height * edge &&
    p.y <= box.y + box.height * (1 - edge)
  );
}

/** Where a connector end dragged to `pointer` attaches to the card `box` (research R5). */
export function attachToOutline(
  box: Box,
  geometry: Geometry | undefined,
  pointer: Point,
  opts: AttachOptions,
): Attachment {
  const zoom = opts.zoom > 0 ? opts.zoom : 1;
  let side: Side = 'top';
  let at = 0.5;
  let nearest = Infinity;
  for (const candidate of SIDES) {
    const hit = shaped(geometry)
      ? projectOnShapeSide(box, geometry, candidate, pointer)
      : projectOnSide(box, candidate, pointer);
    if (hit.distance < nearest) {
      nearest = hit.distance;
      side = candidate;
      at = hit.at;
    }
  }
  const automatic = opts.allowAutomatic && inCentreZone(box, pointer, zoom);
  let snapped = false;
  if (!opts.mod) {
    const middle = pointAt(box, geometry, side, 0.5);
    const span = distance(pointAt(box, geometry, side, 0), pointAt(box, geometry, side, 1));
    const reach = distance(pointAt(box, geometry, side, at), middle) * zoom;
    if (span * zoom >= MIN_SNAP_SIDE && reach <= MIDPOINT_SNAP) {
      at = 0.5;
      snapped = true;
    }
  }
  const placed = snapped ? at : tidy(at);
  return { side, at: placed, point: pointAt(box, geometry, side, placed), snapped, automatic };
}

/**
 * Shift + arrow on a focused end (FR-014): 1 % along the side (`delta` toward its end or start).
 * It stops at the corner first, and from the corner carries onto the neighbouring side like
 * `stepAnchor`.
 */
export function nudgeAnchor(
  side: Side,
  at: number,
  delta: -0.01 | 0.01,
): { side: Side; at: number } {
  const atEnd = delta > 0 ? at >= 1 : at <= 0;
  if (atEnd) return stepAnchor(side, at, delta > 0 ? 1 : -1);
  return { side, at: clamp01(tidy(at + delta)) };
}
