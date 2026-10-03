/**
 * Connector routing (017 R6): resolves the sides a connection leaves and enters, whether its
 * path has a movable middle segment, and the step path itself. A stored `offset` shifts that
 * segment relative to where automatic routing puts it (FR-014), so it survives card moves.
 */
import { getSmoothStepPath, Position } from '@xyflow/react';
import type { Side } from '@sododeck/schema';

import { ARROW_LENGTH } from '../edge-constants';

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

/** The three line types. Mirrors the schema's `EdgeShape`, kept local so routing stays pure. */
export type PathShape = 'curved' | 'elbow' | 'straight';

export interface Point {
  x: number;
  y: number;
}

/** Where a path starts and ends, and the directions the end marks follow. */
export interface PathEnds {
  /** Midpoint of the source side. */
  start: Point;
  /** Midpoint of the target side. */
  end: Point;
  /** Unit vector leaving the start along the line. An arrow at the start points the other way. */
  startDir: Point;
  /** Unit vector entering the end along the line: the direction an end arrow points. */
  endDir: Point;
}

export interface RoutedShapePath {
  path: string;
  labelX: number;
  labelY: number;
  /** The movable middle segment; only `elbow` between opposite sides has one. */
  segment: RouteSegment | null;
  ends: PathEnds;
}

export interface RoutedPathOptions {
  /** Shorten the line at the start by the arrow length (direction `both`). Default false. */
  arrowAtStart?: boolean;
  /** Shorten the line at the end by the arrow length. Default true. */
  arrowAtEnd?: boolean;
}

/** Outward unit normal of each side. */
const NORMAL: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function sideMidpoint(box: Box, side: Side): Point {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 };
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height / 2 };
  }
}

function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function move(point: Point, dir: Point, distance: number): Point {
  return { x: point.x + dir.x * distance, y: point.y + dir.y * distance };
}

function format(point: Point): string {
  return `${point.x} ${point.y}`;
}

function bezier(start: Point, c1: Point, c2: Point, end: Point): string {
  return `M ${format(start)} C ${format(c1)} ${format(c2)} ${format(end)}`;
}

/** Point of a cubic Bézier at t = 0.5, where the label sits. */
function bezierMiddle(p0: Point, p1: Point, p2: Point, p3: Point): Point {
  return {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
  };
}

/**
 * One entry for the three line types (029 R4), shared by the canvas and the export. Every shape
 * starts and ends at the same side midpoints, so changing the shape never moves an end (Q4).
 * The line stops one arrow length short of an end that carries an arrow; the end points in
 * `ends` stay on the card side. A gap shorter than the arrow yields an empty path.
 */
export function routedPath(
  shape: PathShape,
  fromBox: Box,
  toBox: Box,
  sides: ResolvedSides,
  offset = 0,
  options: RoutedPathOptions = {},
  spread = 0,
): RoutedShapePath {
  const { arrowAtStart = false, arrowAtEnd = true } = options;
  const loop = sameBox(fromBox, toBox);
  // A self-loop leaves the right side and comes back into the top, for every shape.
  const [fromSide, toSide]: ResolvedSides = loop ? ['right', 'top'] : sides;
  const start = sideMidpoint(fromBox, fromSide);
  const end = sideMidpoint(toBox, toSide);
  const startNormal = NORMAL[fromSide];
  const endNormal = NORMAL[toSide];
  const straightDir = (): Point => {
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    return length === 0
      ? { x: 1, y: 0 }
      : { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  };
  const line = shape === 'straight' && !loop ? straightDir() : null;
  const startDir = line ?? startNormal;
  const endDir = line ?? { x: 0 - endNormal.x, y: 0 - endNormal.y };
  const ends: PathEnds = { start, end, startDir, endDir };

  const startCut = arrowAtStart ? ARROW_LENGTH : 0;
  const endCut = arrowAtEnd ? ARROW_LENGTH : 0;
  const gap = Math.hypot(end.x - start.x, end.y - start.y);
  let lineStart = move(start, startDir, startCut);
  let lineEnd = move(end, endDir, -endCut);
  // Fan-out (034 R6): a render-only sideways shift along the chord's normal, never stored.
  const chordLength = Math.hypot(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y);
  const shift: Point =
    spread === 0 || loop || chordLength === 0
      ? { x: 0, y: 0 }
      : {
          x: (-(lineEnd.y - lineStart.y) / chordLength) * spread,
          y: ((lineEnd.x - lineStart.x) / chordLength) * spread,
        };
  const hasMiddle = shape === 'elbow' && !loop && middleSegment(sides) !== null;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  if (!loop && gap < startCut + endCut) {
    return { path: '', labelX: mid.x, labelY: mid.y, segment: null, ends };
  }

  if (loop || shape === 'curved') {
    const reach = loop
      ? 40
      : Math.max(40, 0.4 * Math.hypot(lineEnd.x - lineStart.x, lineEnd.y - lineStart.y));
    const c1 = move(lineStart, startDir, reach);
    const c2 = move(lineEnd, endDir, -reach);
    c1.x += shift.x;
    c1.y += shift.y;
    c2.x += shift.x;
    c2.y += shift.y;
    const label = bezierMiddle(lineStart, c1, c2, lineEnd);
    return {
      path: bezier(lineStart, c1, c2, lineEnd),
      labelX: label.x,
      labelY: label.y,
      segment: null,
      ends,
    };
  }

  if (shape === 'straight' || (!hasMiddle && (shift.x !== 0 || shift.y !== 0))) {
    // A straight line, and an elbow with no middle segment to move, shift both ends instead.
    lineStart = { x: lineStart.x + shift.x, y: lineStart.y + shift.y };
    lineEnd = { x: lineEnd.x + shift.x, y: lineEnd.y + shift.y };
  }

  if (shape === 'straight') {
    const shiftedMid = { x: mid.x + shift.x, y: mid.y + shift.y };
    return {
      path: `M ${format(lineStart)} L ${format(lineEnd)}`,
      labelX: shiftedMid.x,
      labelY: shiftedMid.y,
      segment: null,
      ends,
    };
  }

  const step = routedStepPath({
    sourceX: lineStart.x,
    sourceY: lineStart.y,
    targetX: lineEnd.x,
    targetY: lineEnd.y,
    sides: [fromSide, toSide],
    offset: hasMiddle ? offset + spread : offset,
  });
  return { ...step, ends };
}
