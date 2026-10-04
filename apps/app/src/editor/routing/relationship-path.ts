/**
 * A relationship's line (042 R4, R5, R8): from a row anchor to a row anchor, with a straight 24 px
 * stub along the side normal on curved and elbow lines so the crow's foot sits on a straight
 * piece, composite brackets, and a loop for a self-reference. Built on `pointsToPath`, shared by
 * the canvas and the export.
 */
import { REL_STUB } from '../edge-constants';
import type { RelSide } from '../relationships/relationship-ends';
import { labelPoint, pointsToPath, samplePath } from './connector-geometry';
import type { PathShape, Point } from './route-path';

/** Stub per composite member row, out from the card edge (FR-010). */
export const MEMBER_STUB = 6;
/** Minimum outward bulge of a self-reference loop (FR-011). */
export const LOOP_MIN = 56;

/** One end in canvas coordinates: the card side it leaves and the row centre(s) on it. */
export interface RelEndInput {
  side: RelSide;
  /** The side's x (the card's left or right edge). */
  x: number;
  /** One row centre, or the visible members of a composite end (≥ 2 draw a bracket). */
  ys: readonly number[];
}

/** Where a mark sits: on the card edge (or the bracket), `u` pointing away along the line. */
export interface RelMarkAt {
  at: Point;
  u: Point;
}

export interface RelPath {
  /** The connector line. */
  d: string;
  /** The composite brackets (member stubs and joining segments); empty for single ends. */
  bracket: string;
  from: RelMarkAt;
  to: RelMarkAt;
  /** Middle of the line, where the label pill sits. */
  label: Point;
}

const normal = (side: RelSide): Point => ({ x: side === 'right' ? 1 : -1, y: 0 });
const n2 = (value: number) => String(Number(value.toFixed(2)));
const fmt = (p: Point) => `${n2(p.x)} ${n2(p.y)}`;

/** The point the line leaves an end from: the row, or a composite bracket's midpoint. */
function base(end: RelEndInput): { p: Point; bracket: string } {
  const first = end.ys[0] ?? 0;
  if (end.ys.length < 2) return { p: { x: end.x, y: first }, bracket: '' };
  const n = normal(end.side).x;
  const tip = end.x + n * MEMBER_STUB;
  const top = Math.min(...end.ys);
  const bottom = Math.max(...end.ys);
  const stubs = end.ys.map((y) => `M ${fmt({ x: end.x, y })} L ${fmt({ x: tip, y })}`);
  return {
    p: { x: tip, y: (top + bottom) / 2 },
    bracket: [...stubs, `M ${fmt({ x: tip, y: top })} L ${fmt({ x: tip, y: bottom })}`].join(' '),
  };
}

function unitBetween(a: Point, b: Point, fallback: Point): Point {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return length === 0 ? fallback : { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
}

/** `pointsToPath` output continued from the current point (its leading move becomes a line). */
const continued = (path: string) => path.replace(/^M/, 'L');

function middleOf(d: string): Point {
  return labelPoint(samplePath(d), 0.5, 0);
}

/**
 * The line between two row-anchored ends. Curved and elbow leave each end on a 24 stub along the
 * side normal and pass `bends` (user bends, absolute) between the stubs; straight is the direct
 * line and its marks follow the line angle (planning correction of FR-008).
 */
export function relationshipPath(
  from: RelEndInput,
  to: RelEndInput,
  shape: PathShape,
  bends: readonly Point[] = [],
): RelPath {
  const a = base(from);
  const b = base(to);
  const bracket = [a.bracket, b.bracket].filter((part) => part !== '').join(' ');
  const n1 = normal(from.side);
  const n2v = normal(to.side);
  if (shape === 'straight') {
    return {
      d: `M ${fmt(a.p)} L ${fmt(b.p)}`,
      bracket,
      from: { at: a.p, u: unitBetween(a.p, b.p, n1) },
      to: { at: b.p, u: unitBetween(b.p, a.p, n2v) },
      label: { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 },
    };
  }
  const q1 = { x: a.p.x + n1.x * REL_STUB, y: a.p.y };
  const q2 = { x: b.p.x + n2v.x * REL_STUB, y: b.p.y };
  let middle: readonly Point[] = bends;
  // Both ends on one side (overlapping tables): an elbow runs out to the farther stub first, so
  // it never doubles back over itself.
  if (shape === 'elbow' && bends.length === 0 && from.side === to.side && q1.y !== q2.y) {
    const x = from.side === 'right' ? Math.max(q1.x, q2.x) : Math.min(q1.x, q2.x);
    middle = [
      { x, y: q1.y },
      { x, y: q2.y },
    ];
  }
  const inner = pointsToPath([q1, ...middle, q2], shape, {
    start: n1,
    end: { x: -n2v.x, y: 0 },
  });
  const d = `M ${fmt(a.p)} ${continued(inner)} L ${fmt(b.p)}`;
  return {
    d,
    bracket,
    from: { at: a.p, u: n1 },
    to: { at: b.p, u: n2v },
    label: middleOf(d),
  };
}

/**
 * A self-reference (R8): out of the referencing row, bulging `max(56, |Δy| / 2)` from the card
 * edge, back into the referenced row on the same side; a cubic for curved, three legs otherwise.
 * It stays outside the card on that side.
 */
export function selfLoopPath(from: RelEndInput, to: RelEndInput, shape: PathShape): RelPath {
  const a = base(from);
  const b = base(to);
  const bracket = [a.bracket, b.bracket].filter((part) => part !== '').join(' ');
  const n = normal(from.side);
  const edge = from.side === 'right' ? Math.max(from.x, to.x) : Math.min(from.x, to.x);
  const bulge = Math.max(LOOP_MIN, Math.abs(b.p.y - a.p.y) / 2);
  const apexX = edge + n.x * bulge;
  const mid = { x: apexX, y: (a.p.y + b.p.y) / 2 };
  let d: string;
  if (shape === 'curved') {
    const q1 = { x: a.p.x + n.x * REL_STUB, y: a.p.y };
    const q2 = { x: b.p.x + n.x * REL_STUB, y: b.p.y };
    // A symmetric cubic peaks at ¼ start + ¾ control: put the control where the peak is the apex.
    const controlX = (4 * apexX - (q1.x + q2.x) / 2) / 3;
    d = `M ${fmt(a.p)} L ${fmt(q1)} C ${fmt({ x: controlX, y: q1.y })} ${fmt({ x: controlX, y: q2.y })} ${fmt(q2)} L ${fmt(b.p)}`;
  } else {
    const inner = pointsToPath(
      [a.p, { x: apexX, y: a.p.y }, { x: apexX, y: b.p.y }, b.p],
      shape === 'straight' ? 'elbow' : shape,
      { start: n, end: { x: -n.x, y: 0 } },
    );
    d = inner;
  }
  return { d, bracket, from: { at: a.p, u: n }, to: { at: b.p, u: n }, label: mid };
}
