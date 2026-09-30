import type { Side } from '@sododeck/schema';

import type { Point, Rect } from '../canvas-geometry';
import { resolveSides, routedStepPath, type RouteSegment } from '../routing/route-path';

/** How far a smooth-step path can swing past its handle points. */
const STEP_OFFSET = 20;

/** The midpoint of one side of a card: where the canvas puts that side's handle. */
export function handlePoint(rect: Rect, side: Side): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
  }
}

export interface EdgeGeometry {
  path: string;
  source: Point;
  target: Point;
  labelX: number;
  labelY: number;
  extent: Rect;
}

/** The handles' bounding box, extended to include an offset middle segment (017). */
function extentOf(source: Point, target: Point, segment: RouteSegment | null): Rect {
  let minX = Math.min(source.x, target.x) - STEP_OFFSET;
  let minY = Math.min(source.y, target.y) - STEP_OFFSET;
  let maxX = Math.max(source.x, target.x) + STEP_OFFSET;
  let maxY = Math.max(source.y, target.y) + STEP_OFFSET;
  if (segment !== null) {
    if (segment.axis === 'vertical') {
      minY = Math.min(minY, segment.at - STEP_OFFSET);
      maxY = Math.max(maxY, segment.at + STEP_OFFSET);
    } else {
      minX = Math.min(minX, segment.at - STEP_OFFSET);
      maxX = Math.max(maxX, segment.at + STEP_OFFSET);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The canvas's edge between two cards: sides resolved from `route` or, absent one, by
 * comparing centres (as `DeckEdge` / `MergedEdge`), then `routedStepPath` for the path itself,
 * an 8 px corner radius and an offset middle segment when the route has one.
 */
export function edgePath(
  from: Rect,
  to: Rect,
  route?: { fromSide?: Side; toSide?: Side; offset?: number },
): EdgeGeometry {
  const sides = resolveSides(from, to, route);
  const [sourceSide, targetSide] = sides;
  const source = handlePoint(from, sourceSide);
  const target = handlePoint(to, targetSide);
  const { path, labelX, labelY, segment } = routedStepPath({
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sides,
    offset: route?.offset,
    borderRadius: 8,
  });
  return { path, source, target, labelX, labelY, extent: extentOf(source, target, segment) };
}
