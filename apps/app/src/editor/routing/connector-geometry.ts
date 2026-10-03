/**
 * Connector geometry (022 R1–R4, R10): anchors along a side, bend points stored relative to the
 * two cards, the path through them for each line type, snapping, and arc-length sampling for the
 * label. Pure: no DOM, no React. A connector with no bends and no anchor positions is drawn by
 * `routedPath` unchanged, so every pre-022 connector keeps its exact path.
 */
import type { EdgeRoute, RouteWaypoint, Side } from '@sododeck/schema';

import { ARROW_LENGTH } from '../edge-constants';
import {
  NORMAL,
  resolveSides,
  routedPath,
  type Box,
  type PathEnds,
  type PathShape,
  type Point,
  type ResolvedSides,
  type RoutedPathOptions,
  type RoutedShapePath,
  type RouteSegment,
} from './route-path';

export type PathPoint = Point;

/** The canvas grid step (the dot grid gap); also the span under which a bend stores pixels. */
export const GRID_STEP = 22;

/** Longest rounded corner of an elbow, in px (frame 129). */
const CORNER_RADIUS = 10;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const length = (a: Point): number => Math.hypot(a.x, a.y);
const distance = (a: Point, b: Point): number => length(sub(a, b));
const format = (p: Point): string => `${p.x} ${p.y}`;

// ---------------------------------------------------------------------------------------------
// Anchors and bends

export function cardCentre(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * The point `at` (0 to 1, default the middle) along a side: left to right on top and bottom, top
 * to bottom on left and right. `at` 0.5 is the side midpoint React Flow reports.
 */
export function anchorPoint(box: Box, side: Side, at = 0.5): Point {
  switch (side) {
    case 'top':
      return { x: box.x + box.width * at, y: box.y };
    case 'bottom':
      return { x: box.x + box.width * at, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height * at };
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height * at };
  }
}

type Encoded = { fraction: number } | { offset: number };

function encodeAxis(value: number, source: number, target: number): Encoded {
  const span = target - source;
  return Math.abs(span) < GRID_STEP
    ? { offset: value - (source + target) / 2 }
    : { fraction: (value - source) / span };
}

/**
 * Stores a bend relative to the two card centres, per axis: a fraction of the source → target
 * span, or pixels from the midpoint when that span is under one grid step (so a near-zero span
 * never becomes a huge fraction). Decoding never divides.
 */
export function encodeWaypoint(point: Point, source: Point, target: Point): RouteWaypoint {
  const x = encodeAxis(point.x, source.x, target.x);
  const y = encodeAxis(point.y, source.y, target.y);
  return {
    ...('fraction' in x ? { x: x.fraction } : { dx: x.offset }),
    ...('fraction' in y ? { y: y.fraction } : { dy: y.offset }),
  };
}

function decodeAxis(
  fraction: number | undefined,
  offset: number | undefined,
  source: number,
  target: number,
): number {
  if (fraction !== undefined) return source + fraction * (target - source);
  return (source + target) / 2 + (offset ?? 0);
}

/** The bends in the view being drawn, from both card centres in that view. */
export function decodeWaypoints(
  waypoints: readonly RouteWaypoint[],
  source: Point,
  target: Point,
): Point[] {
  return waypoints.map((w) => ({
    x: decodeAxis(w.x, w.dx, source.x, target.x),
    y: decodeAxis(w.y, w.dy, source.y, target.y),
  }));
}

/**
 * The two corners of a 017 middle segment, nearest `start` first: the implicit bends of a
 * connector that still has `route.offset` (R3).
 */
export function offsetBends(segment: RouteSegment, start: Point): [Point, Point] {
  const a: Point =
    segment.axis === 'vertical'
      ? { x: segment.from, y: segment.at }
      : { x: segment.at, y: segment.from };
  const b: Point =
    segment.axis === 'vertical'
      ? { x: segment.to, y: segment.at }
      : { x: segment.at, y: segment.to };
  return distance(start, a) <= distance(start, b) ? [a, b] : [b, a];
}

function pointBox(p: Point): Box {
  return { x: p.x, y: p.y, width: 0, height: 0 };
}

/**
 * Sides for a connector with bends: a pinned side wins; otherwise the source faces the first
 * bend and the target the last, so a detour leaves a card on the side it heads to (R4).
 */
export function autoSides(
  fromBox: Box,
  toBox: Box,
  bends: readonly Point[],
  route: { fromSide?: Side; toSide?: Side } | undefined,
): ResolvedSides {
  const first = bends[0];
  const last = bends.at(-1);
  if (first === undefined || last === undefined) return resolveSides(fromBox, toBox, route);
  return [
    resolveSides(fromBox, pointBox(first), route)[0],
    resolveSides(pointBox(last), toBox, route)[1],
  ];
}

// ---------------------------------------------------------------------------------------------
// Paths through the points

/** Directions the line leaves the first point and enters the last. */
export interface EndDirections {
  start: Point;
  end: Point;
}

function unit(p: Point): Point {
  const l = length(p);
  return l === 0 ? { x: 0, y: 0 } : { x: p.x / l, y: p.y / l };
}

/** Removes repeated points and points on a straight run (exact), keeping both ends. */
function tidy(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out.at(-1);
    if (prev !== undefined && prev.x === p.x && prev.y === p.y) continue;
    out.push(p);
  }
  const merged: Point[] = [];
  for (const p of out) {
    const a = merged.at(-2);
    const b = merged.at(-1);
    if (
      a !== undefined &&
      b !== undefined &&
      ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))
    ) {
      merged.pop();
    }
    merged.push(p);
  }
  return merged;
}

/** Axis-aligned legs through the points; the first leg leaves along `start`, the last enters along `end`. */
function elbowVertices(points: readonly Point[], dirs: EndDirections): Point[] {
  const first = points[0];
  if (first === undefined) return [];
  const horizontalStart = Math.abs(dirs.start.x) >= Math.abs(dirs.start.y);
  const horizontalEnd = Math.abs(dirs.end.x) >= Math.abs(dirs.end.y);
  const out: Point[] = [first];
  let cur = first;
  points.forEach((q, i) => {
    if (i === 0) return;
    const last = i === points.length - 1;
    // Each hop is an L that starts along the source axis, so a leg after a vertical leg is
    // horizontal and the reverse. The final hop must arrive along the target axis: when an L
    // would arrive across it, a Z (three legs) does.
    if (last && horizontalEnd === horizontalStart) {
      const midX = (cur.x + q.x) / 2;
      const midY = (cur.y + q.y) / 2;
      out.push(
        horizontalStart ? { x: midX, y: cur.y } : { x: cur.x, y: midY },
        horizontalStart ? { x: midX, y: q.y } : { x: q.x, y: midY },
      );
    } else {
      out.push(horizontalStart ? { x: q.x, y: cur.y } : { x: cur.x, y: q.y });
    }
    out.push(q);
    cur = q;
  });
  return tidy(out);
}

function elbowPath(points: readonly Point[], dirs: EndDirections): string {
  const v = elbowVertices(points, dirs);
  const first = v[0];
  const last = v.at(-1);
  if (first === undefined || last === undefined) return '';
  let path = `M ${format(first)}`;
  for (let i = 1; i < v.length - 1; i += 1) {
    const prev = v[i - 1];
    const corner = v[i];
    const next = v[i + 1];
    if (prev === undefined || corner === undefined || next === undefined) continue;
    const r = Math.min(CORNER_RADIUS, distance(prev, corner) / 2, distance(corner, next) / 2);
    const a = add(corner, scale(unit(sub(prev, corner)), r));
    const b = add(corner, scale(unit(sub(next, corner)), r));
    path += ` L ${format(a)} Q ${format(corner)} ${format(b)}`;
  }
  return `${path} L ${format(last)}`;
}

/** Minimum reach of an end control point and its share of the hop (as 029's curve). */
const MIN_REACH = 12;
const REACH_SHARE = 0.4;

/**
 * Control point for the segment `p1 → p2` next to `p1`, from a centripetal Catmull-Rom spline
 * (α = 0.5: no cusps or loops at close points) written as a cubic Bézier. Falls back to a third
 * of the way when a neighbour coincides with `p1`.
 */
function nearControl(p0: Point, p1: Point, p2: Point): Point {
  const d1 = Math.sqrt(distance(p0, p1));
  const d2 = Math.sqrt(distance(p1, p2));
  if (d1 === 0 || d2 === 0) return add(p1, scale(sub(p2, p1), 1 / 3));
  const k = 3 * d1 * (d1 + d2);
  const a = d1 * d1;
  const b = d2 * d2;
  const c = 2 * a + 3 * d1 * d2 + b;
  return {
    x: (a * p2.x - b * p0.x + c * p1.x) / k,
    y: (a * p2.y - b * p0.y + c * p1.y) / k,
  };
}

function curvedPath(points: readonly Point[], dirs: EndDirections): string {
  const first = points[0];
  if (first === undefined) return '';
  let path = `M ${format(first)}`;
  const last = points.length - 1;
  for (let i = 0; i < last; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1 === undefined || p2 === undefined) continue;
    const prev = points[i - 1];
    const next = points[i + 2];
    const hop = distance(p1, p2);
    // Two hops share each interior point's tangent; the ends follow the side normals so the line
    // leaves and enters a card straight.
    const reach = hop < 1 ? 0 : Math.max(MIN_REACH, REACH_SHARE * hop);
    const c1 =
      i === 0 || prev === undefined ? add(p1, scale(dirs.start, reach)) : nearControl(prev, p1, p2);
    const c2 =
      i === last - 1 || next === undefined
        ? add(p2, scale(dirs.end, -reach))
        : nearControl(next, p2, p1);
    path += ` C ${format(c1)} ${format(c2)} ${format(p2)}`;
  }
  return path;
}

/**
 * The path through `points` (first = line start, last = line end, bends between). `straight`
 * draws the two ends only; `elbow` joins them with axis-aligned legs and rounded corners;
 * `curved` is a smooth curve through every bend.
 */
export function pointsToPath(
  points: readonly Point[],
  shape: PathShape,
  dirs: EndDirections,
): string {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return '';
  if (shape === 'straight') return `M ${format(first)} L ${format(last)}`;
  return shape === 'elbow' ? elbowPath(points, dirs) : curvedPath(points, dirs);
}

// ---------------------------------------------------------------------------------------------
// The whole connector

/** The route keys the geometry reads (`offset` is 017's, kept until the first bend edit). */
export type ConnectorRoute = Pick<EdgeRoute, 'offset' | 'fromAt' | 'toAt' | 'waypoints'>;

export interface ConnectorInput {
  shape: PathShape;
  fromBox: Box;
  toBox: Box;
  /** Sides already resolved (`resolveSides`, or `autoSides` when the route has bends). */
  sides: ResolvedSides;
  route?: ConnectorRoute | undefined;
  /** Absolute bends that replace the route's own (a bend being dragged: nothing is stored yet). */
  bends?: readonly Point[] | undefined;
  /** Sideways shift of a bundle's fanned connector (034 R6); a bent or anchored one ignores it. */
  spread?: number;
  options?: RoutedPathOptions;
}

function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * One entry for every connector (029 `routedPath` plus 022 anchors and bends), shared by the
 * canvas and the export. Ends stay on the card sides; the line stops an arrow length short of an
 * end with an arrow. Bends of a `straight` line are kept in the document but not drawn, and a
 * self-loop ignores them.
 */
export function connectorPath(input: ConnectorInput): RoutedShapePath {
  const { shape, fromBox, toBox, sides, route, options = {} } = input;
  const waypoints = route?.waypoints ?? [];
  const anchored = route?.fromAt !== undefined || route?.toAt !== undefined;
  const bent = (input.bends?.length ?? waypoints.length) > 0 && shape !== 'straight';
  if (sameBox(fromBox, toBox) || (!bent && !anchored)) {
    return routedPath(shape, fromBox, toBox, sides, route?.offset ?? 0, options, input.spread ?? 0);
  }

  const { arrowAtStart = false, arrowAtEnd = true } = options;
  const [fromSide, toSide] = sides;
  const start = anchorPoint(fromBox, fromSide, route?.fromAt);
  const end = anchorPoint(toBox, toSide, route?.toAt);
  let bends = !bent
    ? []
    : (input.bends ?? decodeWaypoints(waypoints, cardCentre(fromBox), cardCentre(toBox)));
  if (
    bends.length === 0 &&
    shape === 'elbow' &&
    route?.offset !== undefined &&
    route.offset !== 0
  ) {
    // An anchor on a 017 offset connector: draw the offset segment as two bends (R3).
    const segment = routedPath('elbow', fromBox, toBox, sides, route.offset, options).segment;
    if (segment !== null) bends = offsetBends(segment, start);
  }

  const straight = shape === 'straight';
  const startNormal = NORMAL[fromSide];
  const endNormal = NORMAL[toSide];
  const along = unit(sub(end, start));
  const straightDir = length(along) === 0 ? { x: 1, y: 0 } : along;
  const startDir = straight ? straightDir : startNormal;
  const endDir = straight ? straightDir : scale(endNormal, -1);
  const ends: PathEnds = { start, end, startDir, endDir };

  const startCut = arrowAtStart ? ARROW_LENGTH : 0;
  const endCut = arrowAtEnd ? ARROW_LENGTH : 0;
  if (distance(start, end) < startCut + endCut) {
    const mid = scale(add(start, end), 0.5);
    return { path: '', labelX: mid.x, labelY: mid.y, segment: null, ends };
  }
  const lineStart = add(start, scale(startDir, startCut));
  const lineEnd = add(end, scale(endDir, -endCut));
  const path = pointsToPath([lineStart, ...bends, lineEnd], shape, {
    start: startDir,
    end: endDir,
  });
  const label = labelPoint(samplePath(path), 0.5, 0);
  return { path, labelX: label.x, labelY: label.y, segment: null, ends };
}

// ---------------------------------------------------------------------------------------------
// Editing helpers

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const lengthSquared = ab.x * ab.x + ab.y * ab.y;
  if (lengthSquared === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / lengthSquared));
  return distance(p, add(a, scale(ab, t)));
}

/** Two points closer than this are the same point. */
const SAME_POINT = 0.5;

/**
 * Drops repeated points and points within `tolerance` of the straight line between their kept
 * neighbours. `points` run line start → bends → line end; both ends are always kept.
 */
export function simplifyWaypoints(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const deduped: Point[] = [];
  points.forEach((p, i) => {
    const prev = deduped.at(-1);
    if (prev !== undefined && distance(prev, p) < SAME_POINT) {
      // The last point is never the one dropped.
      if (i === points.length - 1) deduped[deduped.length - 1] = p;
      return;
    }
    deduped.push(p);
  });
  const kept: Point[] = [];
  deduped.forEach((p, i) => {
    const prev = kept.at(-1);
    const next = deduped[i + 1];
    if (prev === undefined || next === undefined) {
      kept.push(p);
      return;
    }
    if (distanceToSegment(p, prev, next) > tolerance) kept.push(p);
  });
  return kept;
}

/** A guide drawn while a bend lines up with a neighbour. */
export interface BendGuide {
  axis: 'x' | 'y';
  at: number;
}

function snapAxis(
  value: number,
  neighbours: readonly number[],
  grid: number,
  tolerance: number,
): { value: number; guide: number | null } {
  let best: number | null = null;
  for (const n of neighbours) {
    if (
      Math.abs(n - value) <= tolerance &&
      (best === null || Math.abs(n - value) < Math.abs(best - value))
    ) {
      best = n;
    }
  }
  if (best !== null) return { value: best, guide: best };
  return { value: grid > 0 ? Math.round(value / grid) * grid : value, guide: null };
}

/**
 * Snaps a dragged bend: per axis to a neighbouring point's line within `tolerance`, otherwise to
 * the grid (`grid` 0 turns the grid off). Neighbour alignment wins so right angles stay easy.
 */
export function snapBend(
  point: Point,
  neighbours: readonly Point[],
  grid: number,
  tolerance: number,
): { point: Point; guides: BendGuide[] } {
  const x = snapAxis(
    point.x,
    neighbours.map((n) => n.x),
    grid,
    tolerance,
  );
  const y = snapAxis(
    point.y,
    neighbours.map((n) => n.y),
    grid,
    tolerance,
  );
  const guides: BendGuide[] = [];
  if (x.guide !== null) guides.push({ axis: 'x', at: x.guide });
  if (y.guide !== null) guides.push({ axis: 'y', at: y.guide });
  return { point: { x: x.value, y: y.value }, guides };
}

// ---------------------------------------------------------------------------------------------
// Sampling (label position, R10)

/** A path flattened to a polyline with the running length at each point. */
export interface PathSamples {
  points: Point[];
  /** Length from the start to each point; `cumulative[0]` is 0. */
  cumulative: number[];
  total: number;
}

/** Straight pieces per curve when flattening. */
const CURVE_STEPS = 24;

function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

const COMMAND_ARGS: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6 };

/**
 * Flattens an SVG path made of `M`, `L`, `Q` and `C` (what the connector paths use) to a
 * polyline. `steps` is the number of straight pieces per curve.
 */
export function samplePath(path: string, steps = CURVE_STEPS): PathSamples {
  const points: Point[] = [];
  const tokens = path.match(/[MLQC]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let command = '';
  let numbers: number[] = [];
  let cursor: Point = { x: 0, y: 0 };
  const flush = () => {
    const need = COMMAND_ARGS[command];
    if (need === undefined) return;
    while (numbers.length >= need) {
      const n = numbers.splice(0, need);
      const pt = (i: number): Point => ({ x: n[i] ?? 0, y: n[i + 1] ?? 0 });
      if (command === 'M' || command === 'L') {
        cursor = pt(0);
        points.push(cursor);
      } else if (command === 'Q') {
        const from = cursor;
        for (let s = 1; s <= steps; s += 1) points.push(quadratic(from, pt(0), pt(2), s / steps));
        cursor = pt(2);
      } else {
        const from = cursor;
        for (let s = 1; s <= steps; s += 1) {
          points.push(cubic(from, pt(0), pt(2), pt(4), s / steps));
        }
        cursor = pt(4);
      }
    }
    numbers = [];
  };
  for (const token of tokens) {
    if (/[MLQC]/i.test(token)) {
      flush();
      command = token.toUpperCase();
    } else {
      numbers.push(Number(token));
      if (numbers.length === COMMAND_ARGS[command]) flush();
    }
  }
  flush();
  const cumulative: number[] = [];
  let total = 0;
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev !== undefined) total += distance(prev, p);
    cumulative.push(total);
  });
  return { points, cumulative, total };
}

/** The fraction (0 to 1) of the path length at the point of the path nearest to `point`. */
export function projectOnPath(samples: PathSamples, point: Point): number {
  if (samples.total === 0) return 0;
  let best = Infinity;
  let at = 0;
  for (let i = 1; i < samples.points.length; i += 1) {
    const a = samples.points[i - 1];
    const b = samples.points[i];
    const start = samples.cumulative[i - 1];
    if (a === undefined || b === undefined || start === undefined) continue;
    const ab = sub(b, a);
    const lengthSquared = ab.x * ab.x + ab.y * ab.y;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / lengthSquared),
          );
    const d = distance(point, add(a, scale(ab, t)));
    if (d < best) {
      best = d;
      at = start + t * Math.sqrt(lengthSquared);
    }
  }
  return Math.max(0, Math.min(1, at / samples.total));
}

function pointAtLength(samples: PathSamples, at: number): Point {
  const first = samples.points[0] ?? { x: 0, y: 0 };
  for (let i = 1; i < samples.points.length; i += 1) {
    const end = samples.cumulative[i];
    const start = samples.cumulative[i - 1];
    const a = samples.points[i - 1];
    const b = samples.points[i];
    if (end === undefined || start === undefined || a === undefined || b === undefined) continue;
    if (at <= end) {
      const span = end - start;
      return span === 0 ? a : add(a, scale(sub(b, a), (at - start) / span));
    }
  }
  return samples.points.at(-1) ?? first;
}

/**
 * The point `at` (0 to 1) along the path, kept at least `clamp` px from each end so a label
 * never sits on a card. A path shorter than two clamps puts it in the middle.
 */
export function labelPoint(samples: PathSamples, at: number, clamp: number): Point {
  if (samples.total === 0) return samples.points[0] ?? { x: 0, y: 0 };
  const wanted = at * samples.total;
  const low = clamp;
  const high = samples.total - clamp;
  const d = low > high ? samples.total / 2 : Math.min(Math.max(wanted, low), high);
  return pointAtLength(samples, d);
}
