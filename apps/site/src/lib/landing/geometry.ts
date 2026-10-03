/**
 * Pure geometry for the landing page product visuals: card sizes, anchors, connector curves,
 * arrow heads and crow's feet in the Deck look (DESIGN.md "Card system (Deck)", frames 117–133,
 * and the Database board). Everything is computed from data at build time, never measured.
 */

export interface Point {
  x: number;
  y: number;
}

/** A card side: left, right, top, bottom. */
export type Side = 'l' | 'r' | 't' | 'b';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where a left / right connector attaches, from the top (defaults to `DECK.anchor`). */
  anchor?: number;
}

/** Card metrics of direction B "Deck". */
export const DECK = {
  width: 184,
  radius: 14,
  border: 1.5,
  pad: 12,
  gap: 8,
  header: 24,
  titleSize: 14,
  titleLine: 1.28,
  descSize: 12,
  descLine: 1.4,
  lip: 3,
  anchor: 30,
  fieldRow: 24,
  tagRow: 22,
  tagsPerRow: 3,
  edgeWidth: 2,
  proxyHeight: 46,
  proxyAnchor: 23,
} as const;

/** Table card metrics (Database board). */
export const TABLE = {
  width: 240,
  colHeight: 24,
  colInset: 4,
  keyWidth: 16,
  border: 1.5,
  pad: 12,
  header: 24,
  gap: 8,
  title: 18,
  foot: 24,
  bottom: 8,
  crowLength: 12,
  crowSpread: 6,
  crowBar: 16,
  crowRing: 4,
} as const;

/**
 * Estimated number of wrapped lines for `text` in `width` px at `fontSize`, capped at `max`.
 * Uses an average glyph width of 0.54em, the same estimate as the design board.
 */
export function textLines(text: string, width: number, fontSize: number, max = 3): number {
  if (text === '') return 0;
  const perLine = Math.max(4, Math.floor(width / (fontSize * 0.54)));
  let lines = 1;
  let current = 0;
  for (const word of text.split(' ')) {
    const length = word.length;
    if (current === 0) current = length;
    else if (current + 1 + length <= perLine) current += 1 + length;
    else {
      lines += 1;
      current = length;
    }
  }
  return Math.min(max, lines);
}

export interface CardSize {
  title: string;
  description?: string;
  width?: number;
  fields?: number;
  tags?: number;
  /** Shows the "n inside" row of a card that holds other cards. */
  inside?: boolean;
}

/** Height of a Container-level Deck card for its content. */
export function cardHeight(card: CardSize): number {
  const width = card.width ?? DECK.width;
  const inner = width - 2 * DECK.pad - 2 * DECK.border;
  let height = 2 * DECK.border + 2 * DECK.pad + DECK.header;
  height +=
    DECK.gap + textLines(card.title, inner, DECK.titleSize) * DECK.titleSize * DECK.titleLine;
  if (card.description !== undefined && card.description !== '') {
    height +=
      DECK.gap + textLines(card.description, inner, DECK.descSize) * DECK.descSize * DECK.descLine;
  }
  if (card.fields !== undefined && card.fields > 0)
    height += DECK.gap + card.fields * DECK.fieldRow;
  if (card.tags !== undefined && card.tags > 0) {
    const perRow = Math.max(1, Math.round((DECK.tagsPerRow * width) / DECK.width));
    height += DECK.gap + Math.ceil(card.tags / perRow) * DECK.tagRow;
  }
  if (card.inside === true) height += DECK.gap + 24;
  return Math.round(height);
}

const NORMAL: Record<Side, Point> = {
  l: { x: -1, y: 0 },
  r: { x: 1, y: 0 },
  t: { x: 0, y: -1 },
  b: { x: 0, y: 1 },
};

/** The outward unit vector of a side. */
export const normal = (side: Side): Point => NORMAL[side];

/**
 * Where a connector meets a box: left / right sides at `at` (default: the anchor, at most half
 * the height), top / bottom sides at `at` (default: the middle).
 */
export function anchorPoint(box: Box, side: Side, at?: number): Point {
  const horizontal = side === 'l' || side === 'r';
  const offset = at ?? (horizontal ? Math.min(box.h / 2, box.anchor ?? DECK.anchor) : box.w / 2);
  switch (side) {
    case 'l':
      return { x: box.x, y: box.y + offset };
    case 'r':
      return { x: box.x + box.w, y: box.y + offset };
    case 't':
      return { x: box.x + offset, y: box.y };
    case 'b':
      return { x: box.x + offset, y: box.y + box.h };
  }
}

export interface PathGeometry {
  /** SVG path data. */
  d: string;
  /** The point at fraction `f` (0–1) along the path. */
  at: (f: number) => Point;
}

const round = (n: number): number => Math.round(n * 100) / 100;
const pt = (p: Point): string => `${String(round(p.x))} ${String(round(p.y))}`;

/**
 * The Deck connector: a cubic curve that leaves and enters each side along its normal, with
 * handles 42 % of the distance (at least 28px) long.
 */
export function curve(p1: Point, s1: Side, p2: Point, s2: Side): PathGeometry {
  const k = Math.max(28, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.42);
  const n1 = NORMAL[s1];
  const n2 = NORMAL[s2];
  const c1 = { x: p1.x + n1.x * k, y: p1.y + n1.y * k };
  const c2 = { x: p2.x + n2.x * k, y: p2.y + n2.y * k };
  return {
    d: `M${pt(p1)} C${pt(c1)} ${pt(c2)} ${pt(p2)}`,
    at: (f) => cubicAt(p1, c1, c2, p2, f),
  };
}

/** The point at `f` on a cubic Bézier curve. */
export function cubicAt(p0: Point, c1: Point, c2: Point, p3: Point, f: number): Point {
  const u = 1 - f;
  return {
    x: u * u * u * p0.x + 3 * u * u * f * c1.x + 3 * u * f * f * c2.x + f * f * f * p3.x,
    y: u * u * u * p0.y + 3 * u * u * f * c1.y + 3 * u * f * f * c2.y + f * f * f * p3.y,
  };
}

/** A polyline through `points` with corners rounded to radius `r`. */
export function roundedPath(points: readonly Point[], r: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return '';
  let d = `M${pt(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    if (a === undefined || b === undefined || c === undefined) continue;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const start = { x: b.x + ((a.x - b.x) * rr) / l1, y: b.y + ((a.y - b.y) * rr) / l1 };
    const end = { x: b.x + ((c.x - b.x) * rr) / l2, y: b.y + ((c.y - b.y) * rr) / l2 };
    d += ` L${pt(start)} Q${pt(b)} ${pt(end)}`;
  }
  return `${d} L${pt(last)}`;
}

/**
 * The filled Deck arrow head at `p`, the end of a connector that enters a card on `side`.
 */
export function arrowHead(p: Point, side: Side): string {
  const n = NORMAL[side];
  const v = { x: -n.x, y: -n.y };
  const perp = { x: -v.y, y: v.x };
  const at = (a: number, b: number): string =>
    pt({ x: p.x + v.x * a + perp.x * b, y: p.y + v.y * a + perp.y * b });
  return `M${at(-1, 0)}L${at(-9, -5)}L${at(-9, 5)}Z`;
}

/** Crow's foot end kinds: exactly one, zero or one, one or many, zero or many. */
export type CrowEnd = 'one' | 'zone' | 'many' | 'zmany';

export interface CrowFoot {
  /** Stroked paths (bars and toes). */
  paths: string[];
  /** Circle centres of the "zero" rings. */
  rings: Point[];
}

/**
 * The crow's foot at `p` on a relationship that leaves the table along unit vector `u`.
 */
export function crowFoot(p: Point, u: Point, kind: CrowEnd): CrowFoot {
  const v = { x: -u.y, y: u.x };
  const at = (a: number, b: number): string =>
    pt({ x: p.x + u.x * a + v.x * b, y: p.y + u.y * a + v.y * b });
  const centre = (a: number): Point => ({ x: round(p.x + u.x * a), y: round(p.y + u.y * a) });
  const { crowLength: len, crowSpread: spread, crowBar: bar, crowRing: ring } = TABLE;
  const barAt = (a: number): string => `M${at(a, -spread)}L${at(a, spread)}`;
  const toes = `M${at(0, -spread)}L${at(len, 0)}L${at(0, spread)}`;
  switch (kind) {
    case 'one':
      return { paths: [barAt(10)], rings: [] };
    case 'zone':
      return { paths: [barAt(8)], rings: [centre(8 + ring + 5)] };
    case 'many':
      return { paths: [toes, barAt(bar)], rings: [] };
    case 'zmany':
      return { paths: [toes], rings: [centre(bar + ring)] };
  }
}
