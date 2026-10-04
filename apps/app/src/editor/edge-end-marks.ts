import type { Direction } from '@sododeck/schema';

import {
  ARROW_LENGTH,
  ARROW_WIDTH,
  CARD_TEXT_ACROSS,
  CARD_TEXT_ALONG,
  CROW_BAR,
  CROW_BAR_AT,
  CROW_LEN,
  CROW_RING_AT,
  CROW_SPREAD,
} from './edge-constants';
import type { CrowEnd } from './relationships/relationship-ends';
import type { PathEnds, Point } from './routing/route-path';

/** One end mark of a connector, in canvas coordinates. */
export type EndMark =
  | { kind: 'knob'; at: Point }
  | { kind: 'arrow'; at: Point; /** Degrees, the way the tip points. */ angle: number }
  /** The × that closes an error path (035): no direction, so no angle. */
  | { kind: 'cross'; at: Point }
  /** A relationship's crow's foot end (042): `u` leaves the card along the line. */
  | { kind: 'crow'; end: CrowEnd; at: Point; u: Point }
  /** A relationship's 1 / n text end (042). */
  | { kind: 'card-text'; text: CardText; at: Point; anchor: 'start' | 'end' };

export type CardText = '1' | '0..1' | '1..n' | '0..n';

/** The marks of an ordinary connector. */
export type ConnectorMark = Extract<EndMark, { kind: 'knob' | 'arrow' | 'cross' }>;

/** Accessible names of the four ends (contracts/relationships-ui.md). */
export const CROW_NAMES: Record<CrowEnd, string> = {
  one: 'exactly one',
  'zero-one': 'zero or one',
  'one-many': 'one or many',
  'zero-many': 'zero or many',
};

export const CARD_TEXT: Record<CrowEnd, CardText> = {
  one: '1',
  'zero-one': '0..1',
  'one-many': '1..n',
  'zero-many': '0..n',
};

const n2 = (value: number) => String(Number(value.toFixed(2)));
const pt = (p: Point) => `${n2(p.x)} ${n2(p.y)}`;

/**
 * A crow's foot end at `at` (the card edge), `u` pointing away from the card along the line
 * (DESIGN.md construction): toes p + 6v → p + 12u → p − 6v for many, a bar of 16 across at 10
 * (one), 8 (zero-one) or 16 (one-many), and a ring of r 4 at 17 (zero-one) or 20 (zero-many),
 * which the caller fills with the canvas colour. One path, baked like the arrow.
 */
export function crowPath(
  at: Point,
  u: Point,
  kind: CrowEnd,
): { d: string; ring?: { cx: number; cy: number } } {
  const v = { x: -u.y, y: u.x };
  const along = (d: number, across = 0): Point => ({
    x: at.x + u.x * d + v.x * across,
    y: at.y + u.y * d + v.y * across,
  });
  const parts: string[] = [];
  if (kind === 'one-many' || kind === 'zero-many') {
    parts.push(
      `M ${pt(along(0, CROW_SPREAD))} L ${pt(along(CROW_LEN))} L ${pt(along(0, -CROW_SPREAD))}`,
    );
  }
  if (kind !== 'zero-many') {
    const a = CROW_BAR_AT[kind];
    parts.push(`M ${pt(along(a, CROW_BAR / 2))} L ${pt(along(a, -CROW_BAR / 2))}`);
  }
  const d = parts.join(' ');
  if (kind === 'zero-one' || kind === 'zero-many') {
    const c = along(CROW_RING_AT[kind]);
    return { d, ring: { cx: Number(c.x.toFixed(2)), cy: Number(c.y.toFixed(2)) } };
  }
  return { d };
}

/**
 * Where a 1 / n text end sits: 8 along the end and 8 across it, on the upper side of the line,
 * reading away from the card.
 */
export function cardTextAt(at: Point, u: Point): { at: Point; anchor: 'start' | 'end' } {
  let v = { x: -u.y, y: u.x };
  if (v.y > 0 || (v.y === 0 && v.x > 0)) v = { x: -v.x, y: -v.y };
  return {
    at: {
      x: Number((at.x + u.x * CARD_TEXT_ALONG + v.x * CARD_TEXT_ACROSS).toFixed(2)),
      y: Number((at.y + u.y * CARD_TEXT_ALONG + v.y * CARD_TEXT_ACROSS).toFixed(2)),
    },
    anchor: u.x < 0 ? 'end' : 'start',
  };
}

/** One relationship end's mark (042): a crow's foot or its 1 / n text; none without a kind. */
export function relationshipMark(
  at: Point,
  u: Point,
  end: CrowEnd | undefined,
  notation: 'crow' | 'numeric',
): EndMark | undefined {
  if (end === undefined) return undefined;
  if (notation === 'numeric') {
    const text = cardTextAt(at, u);
    return { kind: 'card-text', text: CARD_TEXT[end], at: text.at, anchor: text.anchor };
  }
  return { kind: 'crow', end, at, u };
}

/** The arrow's outline with its tip at the origin, pointing along +x. */
export const ARROW_PATH = `M 0 0 L -${String(ARROW_LENGTH)} -${String(ARROW_WIDTH / 2)} L -${String(ARROW_LENGTH)} ${String(ARROW_WIDTH / 2)} Z`;

/**
 * The arrow in canvas coordinates (tip at `x, y`, pointing `angle` degrees). Baked into the path
 * rather than placed with a `transform`: 1,000 rotated paths made panning and dragging 500 cards
 * drop from 60 to about 30 fps (029 T060 bench).
 */
export function arrowPathAt(x: number, y: number, angle: number, scale = 1): string {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const half = (ARROW_WIDTH / 2) * scale;
  const length = ARROW_LENGTH * scale;
  // Number() drops a stray "-0" and trailing zeros.
  const n = (value: number) => String(Number(value.toFixed(2)));
  const at = (back: number, side: number) =>
    `${n(x + cos * back - sin * side)} ${n(y + sin * back + cos * side)}`;
  return `M ${String(x)} ${String(y)} L ${at(-length, -half)} L ${at(-length, half)} Z`;
}

/** Half the width of the × that ends an error path. */
const CROSS_HALF = 5;

/** The × centred on `x, y`, as two strokes in one path (baked, like the arrow). */
export function crossPathAt(x: number, y: number): string {
  const [x1, x2, y1, y2] = [x - CROSS_HALF, x + CROSS_HALF, y - CROSS_HALF, y + CROSS_HALF];
  return `M ${String(x1)} ${String(y1)} L ${String(x2)} ${String(y2)} M ${String(x1)} ${String(y2)} L ${String(x2)} ${String(y1)}`;
}

/** Degrees, rounded so the attribute stays short and stable. */
function angle(dir: Point): number {
  return Math.round((Math.atan2(dir.y, dir.x) * 180) / Math.PI);
}

/**
 * The marks of a connector (029 R6): a knob at the start and an arrow at the end for `forward`,
 * arrows at both ends for `both`, knobs at both ends for `none`. Pure and free of the canvas
 * library, so the canvas (`EdgeEnds`) and the export draw the same marks.
 */
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
): Extract<EndMark, { kind: 'knob' | 'arrow' }>[];
/** With `errorEnd` (an error path, 035) the end is a × and never an arrow or a knob. */
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
  errorEnd: boolean,
): ConnectorMark[];
export function endMarks(
  ends: PathEnds,
  direction: Direction | undefined,
  errorEnd = false,
): ConnectorMark[] {
  const mode = direction ?? 'forward';
  const start: ConnectorMark =
    mode === 'both'
      ? {
          kind: 'arrow',
          at: ends.start,
          angle: angle({ x: 0 - ends.startDir.x, y: 0 - ends.startDir.y }),
        }
      : { kind: 'knob', at: ends.start };
  const end: ConnectorMark = errorEnd
    ? { kind: 'cross', at: ends.end }
    : mode === 'none'
      ? { kind: 'knob', at: ends.end }
      : { kind: 'arrow', at: ends.end, angle: angle(ends.endDir) };
  return [start, end];
}
