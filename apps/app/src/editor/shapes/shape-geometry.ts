/**
 * Shape geometry (031 research R2, contract shape-api): the one source of a shape's outline, lip,
 * connection points and title box, shared by the canvas, the export and the connectors. Pure: no
 * DOM, no React.
 *
 * Every outline is built from M / L / C / Z segments only (ellipses and rounded corners as cubic
 * Béziers), so the path the canvas draws is the path the connection points are measured on. A
 * side's connection point is found by projection: a vertical line (top / bottom) or a horizontal
 * line (left / right) through the box at `at`, meeting the outline nearest that side. That is how
 * 022's anchor drag already turns a pointer into `at`, and `at` 0.5 is always the side's own
 * middle (a diamond's vertex, a parallelogram's slant at mid-height, the document's wave).
 */
import { CARD_TYPES, type Geometry } from '@sododeck/model';
import type { Side, Size } from '@sododeck/schema';

export type { Geometry };

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point {
  width: number;
  height: number;
}

export interface ShapePaths {
  /** The closed outline (fill and 1.5 px stroke). Empty for the text shape. */
  outline: string;
  /** The outline 3 px lower, filled with the stroke colour; null where it would look wrong. */
  lip: string | null;
  /** Strokes drawn over the fill: the cylinder's rim, the actor's body. */
  extra?: string;
}

/** DESIGN.md "Shape": the lip is the outline offset 3 px down. */
export const LIP_OFFSET = 3;
/** Title line height in px (13 / 600, DESIGN.md Shape). */
export const SHAPE_TITLE_LINE = 16;
export const SHAPE_TITLE_MAX_LINES = 3;
export const SHAPE_TITLE_FONT = "600 13px 'Geist Variable', system-ui, sans-serif";

const ROUNDED_RADIUS = 14;
/** Quarter-circle cubic control distance. */
const KAPPA = 0.5522847498;
/** The figure's share of the actor's box; the title sits below it. */
const ACTOR_FIGURE = 0.64;
const CYLINDER_CAP = 0.18;
const DOCUMENT_WAVE = 0.12;
const PARALLELOGRAM_SKEW = 0.16;
const HEXAGON_INSET = 0.12;

type Segment =
  { kind: 'M' | 'L'; p: Point } | { kind: 'C'; c1: Point; c2: Point; p: Point } | { kind: 'Z' };

const M = (x: number, y: number): Segment => ({ kind: 'M', p: { x, y } });
const L = (x: number, y: number): Segment => ({ kind: 'L', p: { x, y } });
const C = (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): Segment => ({
  kind: 'C',
  c1: { x: c1x, y: c1y },
  c2: { x: c2x, y: c2y },
  p: { x, y },
});
const Z: Segment = { kind: 'Z' };

// ---------------------------------------------------------------------------------------------
// Sizes

const SIZES = new Map<Geometry, { defaultSize: Size; minSize: Size }>();
for (const type of CARD_TYPES) {
  if (type.geometry !== undefined && type.defaultSize !== undefined && type.minSize !== undefined) {
    SIZES.set(type.geometry, { defaultSize: type.defaultSize, minSize: type.minSize });
  }
}
const FALLBACK_SIZE = {
  defaultSize: { width: 160, height: 72 },
  minSize: { width: 64, height: 40 },
};

/** The size a shape takes when the node stores none (registry, research R1). */
export function defaultSize(geometry: Geometry): Size {
  return (SIZES.get(geometry) ?? FALLBACK_SIZE).defaultSize;
}

/** The smallest size a shape may be resized to: it still fits one title line. */
export function minSize(geometry: Geometry): Size {
  return (SIZES.get(geometry) ?? FALLBACK_SIZE).minSize;
}

// ---------------------------------------------------------------------------------------------
// Outlines, in box-local coordinates (0, 0)–(w, h)

/** A rounded rectangle; `r` is clamped to half the shorter side (a stadium at the limit). */
function roundedRect(w: number, h: number, radius: number): Segment[] {
  const r = Math.min(radius, w / 2, h / 2);
  const k = r * KAPPA;
  return [
    M(r, 0),
    L(w - r, 0),
    C(w - r + k, 0, w, r - k, w, r),
    L(w, h - r),
    C(w, h - r + k, w - r + k, h, w - r, h),
    L(r, h),
    C(r - k, h, 0, h - r + k, 0, h - r),
    L(0, r),
    C(0, r - k, r - k, 0, r, 0),
    Z,
  ];
}

/** An ellipse centred on (cx, cy), from its left point clockwise (four cubic arcs). */
function ellipse(cx: number, cy: number, rx: number, ry: number): Segment[] {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    M(cx - rx, cy),
    C(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry),
    C(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy),
    C(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry),
    C(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy),
    Z,
  ];
}

function polygon(points: readonly (readonly [number, number])[]): Segment[] {
  return [...points.map(([x, y], i) => (i === 0 ? M(x, y) : L(x, y))), Z];
}

interface ActorFigure {
  cx: number;
  headR: number;
  neckY: number;
  hipY: number;
  armY: number;
  armHalf: number;
  footHalf: number;
  feetY: number;
}

/** The stick figure: upright, centred, in the top 64 % of the box, never wider than it is tall. */
function actorFigure(w: number, h: number): ActorFigure {
  const feetY = h * ACTOR_FIGURE;
  const width = Math.min(w - 2, feetY * 0.62);
  const headR = Math.min(feetY * 0.15, width / 2);
  const neckY = 2 * headR;
  return {
    cx: w / 2,
    headR,
    neckY,
    hipY: neckY + (feetY - neckY) * 0.55,
    armY: neckY + (feetY - neckY) * 0.18,
    armHalf: width / 2,
    footHalf: width * 0.35,
    feetY,
  };
}

/** Closed outline (filled, stroked, measured for connection points). */
function outlineSegments(geometry: Geometry, w: number, h: number): Segment[] {
  switch (geometry) {
    case 'rect':
      return polygon([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ]);
    case 'rounded-rect':
      return roundedRect(w, h, ROUNDED_RADIUS);
    case 'stadium':
      return roundedRect(w, h, Math.min(w, h) / 2);
    case 'ellipse':
      return ellipse(w / 2, h / 2, w / 2, h / 2);
    case 'diamond':
      return polygon([
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ]);
    case 'parallelogram': {
      const s = w * PARALLELOGRAM_SKEW;
      return polygon([
        [s, 0],
        [w, 0],
        [w - s, h],
        [0, h],
      ]);
    }
    case 'hexagon': {
      const i = w * HEXAGON_INSET;
      return polygon([
        [i, 0],
        [w - i, 0],
        [w, h / 2],
        [w - i, h],
        [i, h],
        [0, h / 2],
      ]);
    }
    case 'cylinder': {
      // The silhouette: the top cap's upper half, the two sides, the bottom cap's lower half.
      const ry = (h * CYLINDER_CAP) / 2;
      const rx = w / 2;
      const kx = rx * KAPPA;
      const ky = ry * KAPPA;
      return [
        M(0, ry),
        C(0, ry - ky, rx - kx, 0, rx, 0),
        C(rx + kx, 0, w, ry - ky, w, ry),
        L(w, h - ry),
        C(w, h - ry + ky, rx + kx, h, rx, h),
        C(rx - kx, h, 0, h - ry + ky, 0, h - ry),
        Z,
      ];
    }
    case 'document': {
      // A rectangle whose bottom is one wave: low on the left, high on the right, crossing the
      // middle at x = w / 2 (two cubic bumps of amplitude a / 2).
      const a = h * DOCUMENT_WAVE;
      const mid = h - a / 2;
      const bump = ((a / 2) * 4) / 3;
      return [
        M(0, 0),
        L(w, 0),
        L(w, mid),
        C((w * 5) / 6, mid - bump, (w * 4) / 6, mid - bump, w / 2, mid),
        C((w * 2) / 6, mid + bump, w / 6, mid + bump, 0, mid),
        Z,
      ];
    }
    case 'actor': {
      const f = actorFigure(w, h);
      return ellipse(f.cx, f.headR, f.headR, f.headR);
    }
    case 'none':
      return [];
  }
}

/** Open strokes drawn over the fill. */
function extraSegments(geometry: Geometry, w: number, h: number): Segment[] {
  if (geometry === 'cylinder') {
    // The front half of the top cap: what makes it read as a cylinder.
    const ry = (h * CYLINDER_CAP) / 2;
    const rx = w / 2;
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;
    return [
      M(0, ry),
      C(0, ry + ky, rx - kx, 2 * ry, rx, 2 * ry),
      C(rx + kx, 2 * ry, w, ry + ky, w, ry),
    ];
  }
  if (geometry === 'actor') {
    const f = actorFigure(w, h);
    return [
      M(f.cx, f.neckY),
      L(f.cx, f.hipY),
      M(f.cx - f.armHalf, f.armY),
      L(f.cx + f.armHalf, f.armY),
      M(f.cx - f.footHalf, f.feetY),
      L(f.cx, f.hipY),
      L(f.cx + f.footHalf, f.feetY),
    ];
  }
  return [];
}

const round = (n: number): string => String(Math.round(n * 100) / 100);

function toPath(segments: readonly Segment[], dx: number, dy: number): string {
  const p = (pt: Point) => `${round(pt.x + dx)} ${round(pt.y + dy)}`;
  return segments
    .map((s) =>
      s.kind === 'Z'
        ? 'Z'
        : s.kind === 'C'
          ? `C ${p(s.c1)} ${p(s.c2)} ${p(s.p)}`
          : `${s.kind} ${p(s.p)}`,
    )
    .join(' ');
}

/** Shapes with no lip: an offset copy of a stick figure or of bare text would look wrong. */
const NO_LIP: ReadonlySet<Geometry> = new Set(['actor', 'none']);

/** SVG path data for the outline, the lip and any extra strokes of a shape in `box`. */
export function shapePath(geometry: Geometry, box: Box): ShapePaths {
  const segments = outlineSegments(geometry, box.width, box.height);
  if (segments.length === 0) return { outline: '', lip: null };
  const outline = toPath(segments, box.x, box.y);
  const lip = NO_LIP.has(geometry) ? null : toPath(segments, box.x, box.y + LIP_OFFSET);
  const extra = extraSegments(geometry, box.width, box.height);
  return extra.length === 0
    ? { outline, lip }
    : { outline, lip, extra: toPath(extra, box.x, box.y) };
}

// ---------------------------------------------------------------------------------------------
// Connection points

type Polyline = readonly Point[];

const FLATTEN_STEPS = 32;
const flatCache = new Map<string, Polyline>();
const FLAT_CACHE_LIMIT = 4000;

/** The outline as a closed polyline (local coordinates), memoised per geometry and size. */
function flatOutline(geometry: Geometry, w: number, h: number): Polyline {
  const key = `${geometry}|${String(w)}|${String(h)}`;
  const known = flatCache.get(key);
  if (known !== undefined) return known;
  const points: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  let start: Point = at;
  for (const s of outlineSegments(geometry, w, h)) {
    if (s.kind === 'M') {
      at = s.p;
      start = at;
      points.push(at);
    } else if (s.kind === 'L') {
      at = s.p;
      points.push(at);
    } else if (s.kind === 'C') {
      const from = at;
      for (let k = 1; k <= FLATTEN_STEPS; k++) {
        const t = k / FLATTEN_STEPS;
        const u = 1 - t;
        points.push({
          x:
            u * u * u * from.x +
            3 * u * u * t * s.c1.x +
            3 * u * t * t * s.c2.x +
            t * t * t * s.p.x,
          y:
            u * u * u * from.y +
            3 * u * u * t * s.c1.y +
            3 * u * t * t * s.c2.y +
            t * t * t * s.p.y,
        });
      }
      at = s.p;
    } else {
      points.push(start);
      at = start;
    }
  }
  if (flatCache.size >= FLAT_CACHE_LIMIT) flatCache.clear();
  flatCache.set(key, points);
  return points;
}

/**
 * Where the line `axis = value` meets the polyline, as the other coordinate: every crossing.
 * `axis` 'x' means a vertical line x = value.
 */
function crossings(line: Polyline, axis: 'x' | 'y', value: number): number[] {
  const other = axis === 'x' ? 'y' : 'x';
  const out: number[] = [];
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1];
    const b = line[k];
    if (a === undefined || b === undefined) continue;
    const lo = Math.min(a[axis], b[axis]);
    const hi = Math.max(a[axis], b[axis]);
    if (value < lo - 1e-9 || value > hi + 1e-9) continue;
    if (hi - lo < 1e-9) {
      out.push(a[other], b[other]);
      continue;
    }
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    out.push(a[other] + t * (b[other] - a[other]));
  }
  return out;
}

/** The span of `axis` over the part of the outline on `side`'s half of the box. */
function sideSpan(line: Polyline, side: Side, w: number, h: number): [number, number] {
  const horizontal = side === 'top' || side === 'bottom';
  const axis = horizontal ? 'x' : 'y';
  const other = horizontal ? 'y' : 'x';
  const half = horizontal ? h / 2 : w / 2;
  const near = (v: number) =>
    side === 'top' || side === 'left' ? v <= half + 1e-9 : v >= half - 1e-9;
  let lo = Infinity;
  let hi = -Infinity;
  const take = (v: number) => {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  };
  for (let k = 0; k < line.length; k++) {
    const a = line[k];
    if (a === undefined) continue;
    if (near(a[other])) take(a[axis]);
    const b = line[k + 1];
    if (b === undefined) continue;
    // Where an edge crosses the half line, its end on the far side is clipped there.
    if (near(a[other]) !== near(b[other]) && b[other] !== a[other]) {
      const t = (half - a[other]) / (b[other] - a[other]);
      take(a[axis] + t * (b[axis] - a[axis]));
    }
  }
  return lo <= hi ? [lo, hi] : [0, horizontal ? w : h];
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** The actor's connection points: head (top), hand tips (left / right), feet (bottom). */
function actorPoint(box: Box, side: Side, at: number): Point {
  const f = actorFigure(box.width, box.height);
  const cx = box.x + f.cx;
  switch (side) {
    case 'top': {
      // Along the head's upper half, left to right.
      const angle = Math.PI + Math.PI * at;
      return { x: cx + f.headR * Math.cos(angle), y: box.y + f.headR + f.headR * Math.sin(angle) };
    }
    case 'bottom':
      return { x: cx + f.footHalf * (2 * at - 1), y: box.y + f.feetY };
    case 'left':
      return { x: cx - f.armHalf, y: box.y + f.armY };
    case 'right':
      return { x: cx + f.armHalf, y: box.y + f.armY };
  }
}

/**
 * Where a connector meets the shape on `side` (contract shape-api): `at` 0 to 1 runs left to
 * right on top and bottom, top to bottom on left and right; 0.5 (the default) is the side's
 * middle. The text shape uses its box; the actor its head, hands and feet.
 */
export function outlinePoint(geometry: Geometry, box: Box, side: Side, at = 0.5): Point {
  const t = clamp01(at);
  const { width: w, height: h } = box;
  if (geometry === 'actor') return actorPoint(box, side, t);
  if (geometry === 'none') {
    switch (side) {
      case 'top':
        return { x: box.x + w * t, y: box.y };
      case 'bottom':
        return { x: box.x + w * t, y: box.y + h };
      case 'left':
        return { x: box.x, y: box.y + h * t };
      case 'right':
        return { x: box.x + w, y: box.y + h * t };
    }
  }
  const line = flatOutline(geometry, w, h);
  const horizontal = side === 'top' || side === 'bottom';
  const [lo, hi] = sideSpan(line, side, w, h);
  const mid = horizontal ? w / 2 : h / 2;
  // 0 → 0.5 covers the near end to the middle, 0.5 → 1 the middle to the far end, so 0.5 is
  // always the side's middle even where the outline is not symmetric about it.
  const value = t <= 0.5 ? lo + (mid - lo) * (t / 0.5) : mid + (hi - mid) * ((t - 0.5) / 0.5);
  const hits = crossings(line, horizontal ? 'x' : 'y', value);
  const pick = side === 'top' || side === 'left' ? Math.min(...hits) : Math.max(...hits);
  const other = Number.isFinite(pick)
    ? pick
    : side === 'top' || side === 'left'
      ? 0
      : horizontal
        ? h
        : w;
  return horizontal
    ? { x: box.x + value, y: box.y + other }
    : { x: box.x + other, y: box.y + value };
}

// ---------------------------------------------------------------------------------------------
// Title box

/** The rectangle the centred title wraps in: inside the outline, clear of caps, waves and figure. */
export function titleBox(geometry: Geometry, box: Box): Box {
  const { width: w, height: h } = box;
  const inset = (left: number, top: number, right: number, bottom: number): Box => ({
    x: box.x + left,
    y: box.y + top,
    width: Math.max(0, w - left - right),
    height: Math.max(0, h - top - bottom),
  });
  switch (geometry) {
    case 'rect':
      return inset(10, 6, 10, 6);
    case 'rounded-rect': {
      const r = Math.min(ROUNDED_RADIUS, w / 2, h / 2);
      const pad = r * (1 - Math.SQRT1_2);
      return inset(
        Math.max(10, pad + 4),
        Math.max(4, pad),
        Math.max(10, pad + 4),
        Math.max(4, pad),
      );
    }
    case 'stadium': {
      const r = Math.min(w, h) / 2;
      const pad = r * (1 - Math.SQRT1_2);
      return inset(pad + 4, pad, pad + 4, pad);
    }
    case 'ellipse': {
      // The largest box of the ellipse's own proportions: w / √2 by h / √2.
      const dx = (w * (1 - Math.SQRT1_2)) / 2 + 2;
      const dy = (h * (1 - Math.SQRT1_2)) / 2 + 1;
      return inset(dx, dy, dx, dy);
    }
    case 'diamond':
      return inset(w / 4 + 2, h / 4 + 1, w / 4 + 2, h / 4 + 1);
    case 'cylinder': {
      const ry = (h * CYLINDER_CAP) / 2;
      return inset(8, 2 * ry + 3, 8, ry + 2);
    }
    case 'document':
      return inset(8, 6, 8, h * DOCUMENT_WAVE + 2);
    case 'parallelogram': {
      const s = w * PARALLELOGRAM_SKEW;
      return inset(s + 4, 4, s + 4, 4);
    }
    case 'hexagon': {
      const i = w * HEXAGON_INSET;
      return inset(i + 4, 4, i + 4, 4);
    }
    case 'actor': {
      const top = h * ACTOR_FIGURE + 4;
      return inset(0, top, 0, 0);
    }
    case 'none':
      return inset(4, 2, 4, 2);
  }
}

/** Title lines a shape of this geometry and size has room for: 1 to 3. */
export function titleLineRoom(geometry: Geometry, size: Size): number {
  const room = titleBox(geometry, { x: 0, y: 0, ...size }).height;
  return Math.max(1, Math.min(SHAPE_TITLE_MAX_LINES, Math.floor(room / SHAPE_TITLE_LINE)));
}
