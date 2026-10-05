/**
 * Connector hit test for the marquee. React Flow's marquee only tests nodes, so connectors drawn
 * across the marquee are found here: each connector's drawn path (`d`, in flow coordinates) is
 * flattened once with `samplePath` (the same sampler the label and export use) and tested
 * against the marquee rectangle. Pure; the DOM side is `use-marquee-edges.ts`.
 */
import { samplePath } from '../routing/connector-geometry';
import type { Box, Point } from '../routing/route-path';

/** Default select (cards fully inside) or ⌥ touch select (016 R13). */
export type MarqueeMode = 'full' | 'partial';

/** A connector's flattened path and its bounds, for a quick reject. */
export interface EdgeShape {
  points: readonly Point[];
  bounds: Box | null;
}

/** Fewer pieces per curve than the label sampler: 12 keeps a curve within ~1 px for hit testing. */
const HIT_STEPS = 12;

export function edgeShapeOf(d: string): EdgeShape {
  const { points } = samplePath(d, HIT_STEPS);
  if (points.length === 0) return { points, bounds: null };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { points, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

const inside = (p: Point, r: Box) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

const overlaps = (a: Box, b: Box) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

/** The segment `a`–`b` touches the rectangle (Liang–Barsky clipping). */
export function segmentHitsRect(a: Point, b: Point, r: Box): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return (
    clip(-dx, a.x - r.x) &&
    clip(dx, r.x + r.width - a.x) &&
    clip(-dy, a.y - r.y) &&
    clip(dy, r.y + r.height - a.y)
  );
}

/** Partial: any part of the path touches the rectangle. Full: all of it lies inside. */
export function edgeInRect(shape: EdgeShape, r: Box, mode: MarqueeMode): boolean {
  const { bounds, points } = shape;
  if (bounds === null) return false;
  if (mode === 'full') {
    return (
      bounds.x >= r.x &&
      bounds.y >= r.y &&
      bounds.x + bounds.width <= r.x + r.width &&
      bounds.y + bounds.height <= r.y + r.height
    );
  }
  if (!overlaps(bounds, r)) return false;
  const first = points[0];
  if (first !== undefined && inside(first, r)) return true;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined && segmentHitsRect(a, b, r)) return true;
  }
  return false;
}

/** The ids of the connectors the marquee catches, in the given order. */
export function edgesInRect(
  shapes: Iterable<{ id: string; shape: EdgeShape }>,
  r: Box,
  mode: MarqueeMode,
): string[] {
  const hit: string[] = [];
  for (const { id, shape } of shapes) if (edgeInRect(shape, r, mode)) hit.push(id);
  return hit;
}

/** React Flow's marquee rectangle (pane pixels) in flow coordinates, given `[x, y, zoom]`. */
export function screenRectToFlow(r: Box, [tx, ty, zoom]: readonly [number, number, number]): Box {
  return {
    x: (r.x - tx) / zoom,
    y: (r.y - ty) / zoom,
    width: r.width / zoom,
    height: r.height / zoom,
  };
}

/**
 * The marquee adds to the selection (016 R13): the connectors selected before it started stay,
 * and the ones it catches now join them.
 */
export function marqueeEdgeSelection(before: readonly string[], hit: Iterable<string>): string[] {
  return [...new Set([...before, ...hit])];
}
