/**
 * Connector routing (017 R6): resolves the sides a connection leaves and enters, whether its
 * path has a movable middle segment, and the step path itself. A stored `offset` shifts that
 * segment relative to where automatic routing puts it (FR-014), so it survives card moves.
 */
import { getSmoothStepPath, Position } from '@xyflow/react';
import type { Side } from '@sododeck/schema';

/** A card's box in canvas coordinates, as drawn (016/017). */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Sides resolved for an edge, in source → target order. */
export type ResolvedSides = readonly [Side, Side];

/** The axis a route's middle segment moves along; only opposite side pairs have one. */
export type MiddleAxis = 'vertical' | 'horizontal';

/** The movable middle segment of a routed path, or null when the path has none. */
export interface RouteSegment {
  axis: MiddleAxis;
  /** The segment's position on its moving axis (`centerY` for `vertical`, `centerX` for `horizontal`). */
  at: number;
  /** The segment's extent on the fixed axis. */
  from: number;
  to: number;
}

export interface RoutedPath {
  path: string;
  labelX: number;
  labelY: number;
  segment: RouteSegment | null;
}

export interface RoutedStepPathInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sides: ResolvedSides;
  /** Shift of the middle segment relative to the automatic route; ignored without one. */
  offset?: number;
  borderRadius?: number;
}

const HANDLE_POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Picks the sides a connection leaves and enters: a pinned side from the route wins, otherwise
 * sides are picked by comparing box centres (identical to today's `facingSides` for equal-size
 * cards, since it compared top-left positions of same-sized cards).
 */
export function resolveSides(
  fromBox: Box,
  toBox: Box,
  route?: { fromSide?: Side; toSide?: Side },
): ResolvedSides {
  const from = centerOf(fromBox);
  const to = centerOf(toBox);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const [autoFrom, autoTo]: ResolvedSides =
    Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? ['right', 'left']
        : ['left', 'right']
      : dy >= 0
        ? ['bottom', 'top']
        : ['top', 'bottom'];
  return [route?.fromSide ?? autoFrom, route?.toSide ?? autoTo];
}

/** Only opposite side pairs (left/right or top/bottom) have a movable middle segment. */
export function middleSegment(sides: ResolvedSides): MiddleAxis | null {
  const [from, to] = sides;
  if ((from === 'top' && to === 'bottom') || (from === 'bottom' && to === 'top')) return 'vertical';
  if ((from === 'left' && to === 'right') || (from === 'right' && to === 'left'))
    return 'horizontal';
  return null;
}

/** The nearest side of a box to a point (R12: endpoint drops pin the side under the pointer). */
export function nearestSide(box: Box, point: { x: number; y: number }): Side {
  const candidates: [Side, number][] = [
    ['top', Math.abs(point.y - box.y)],
    ['bottom', Math.abs(point.y - (box.y + box.height))],
    ['left', Math.abs(point.x - box.x)],
    ['right', Math.abs(point.x - (box.x + box.width))],
  ];
  return candidates.reduce((best, candidate) => (candidate[1] < best[1] ? candidate : best))[0];
}

function segmentFor(
  axis: MiddleAxis,
  labelX: number,
  labelY: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): RouteSegment {
  return axis === 'vertical'
    ? { axis, at: labelY, from: Math.min(sourceX, targetX), to: Math.max(sourceX, targetX) }
    : { axis, at: labelX, from: Math.min(sourceY, targetY), to: Math.max(sourceY, targetY) };
}

/**
 * A stepped path between resolved sides, with an offset middle segment (R6). With `offset`
 * absent or 0, the result is byte-identical to `getSmoothStepPath` called directly.
 */
export function routedStepPath(input: RoutedStepPathInput): RoutedPath {
  const { sourceX, sourceY, targetX, targetY, sides, offset = 0, borderRadius = 8 } = input;
  const sourcePosition = HANDLE_POSITION[sides[0]];
  const targetPosition = HANDLE_POSITION[sides[1]];
  const axis = middleSegment(sides);
  const base = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius };
  const [defaultPath, defaultLabelX, defaultLabelY] = getSmoothStepPath(base);
  if (axis === null || offset === 0) {
    return {
      path: defaultPath,
      labelX: defaultLabelX,
      labelY: defaultLabelY,
      segment:
        axis === null
          ? null
          : segmentFor(axis, defaultLabelX, defaultLabelY, sourceX, sourceY, targetX, targetY),
    };
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    ...base,
    ...(axis === 'horizontal'
      ? { centerX: defaultLabelX + offset }
      : { centerY: defaultLabelY + offset }),
  });
  return {
    path,
    labelX,
    labelY,
    segment: segmentFor(axis, labelX, labelY, sourceX, sourceY, targetX, targetY),
  };
}
