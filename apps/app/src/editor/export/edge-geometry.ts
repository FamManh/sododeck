import type { Direction, Side } from '@sododeck/schema';

import type { Point, Rect } from '../canvas-geometry';
import { ARROW_WIDTH } from '../edge-constants';
import {
  resolveSides,
  routedPath,
  type PathEnds,
  type PathShape,
  type RouteSegment,
} from '../routing/route-path';

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
  /** Where the end marks sit and point (`routedPath`). */
  ends: PathEnds;
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

/** The bounding box of every coordinate pair in an absolute `M` / `L` / `C` / `Q` path. */
function pathExtent(path: string, ends: PathEnds, pad: number): Rect {
  const numbers = (path.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
  const xs = [ends.start.x, ends.end.x];
  const ys = [ends.start.y, ends.end.y];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    xs.push(numbers[index] ?? 0);
    ys.push(numbers[index + 1] ?? 0);
  }
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) + pad - minX,
    height: Math.max(...ys) + pad - minY,
  };
}

/**
 * The canvas's connector between two cards (029 R4): sides resolved from `route` or, absent one,
 * by comparing centres, then the shared `routedPath` for the line type, so the export draws what
 * `DeckEdge` draws. The line stops one arrow short of an end that carries an arrow. Elbow keeps
 * its offset middle segment (017).
 */
export function edgePath(
  from: Rect,
  to: Rect,
  route?: { fromSide?: Side; toSide?: Side; offset?: number },
  shape: PathShape = 'curved',
  direction: Direction = 'forward',
): EdgeGeometry {
  const sides = resolveSides(from, to, route);
  const { path, labelX, labelY, segment, ends } = routedPath(
    shape,
    from,
    to,
    sides,
    route?.offset,
    { arrowAtStart: direction === 'both', arrowAtEnd: direction !== 'none' },
  );
  const extent =
    shape === 'elbow'
      ? extentOf(ends.start, ends.end, segment)
      : // Room for the arrow's tip and the knob.
        pathExtent(path, ends, ARROW_WIDTH);
  return { path, source: ends.start, target: ends.end, ends, labelX, labelY, extent };
}
