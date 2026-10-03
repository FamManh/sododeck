/**
 * Pure canvas geometry (no React). Positions are flow coordinates of a node's top-left corner.
 */
import { frameOf, NODE_GRID, type Point } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { Level } from './levels';
import { cardLayout, DECK_CARD_WIDTH, type CardLayout } from './card-layout';

type Node = SododeckFile['nodes'][number];

export type { Point };

export interface Rect extends Point {
  width: number;
  height: number;
}

/**
 * The smallest default card (029): 184 wide, one title line and nothing else. Real cards grow
 * from here through `cardLayout`; this is only the fallback for code that has no node at hand.
 */
export const NODE_SIZE = {
  width: DECK_CARD_WIDTH,
  height: cardLayout({ title: '' }).height,
} as const;
/**
 * A roomier layout cell for Tidy and for fitting group frames: cards no longer grow at the
 * component level (§g-58), but the spacing laid out for them stays generous.
 */
export const COMPONENT_CARD_SIZE = { width: DECK_CARD_WIDTH, height: 128 } as const;
/** The fanned hand of a collapsed group (DESIGN.md "Groups"). */
export const COLLAPSED_CARD_SIZE = { width: DECK_CARD_WIDTH, height: 112 } as const;
type NodeSize = { width: number; height: number };

/**
 * Sizes a resized card may have (017 R2/R4): drawn clamped to this range, in 4 px steps. The
 * minimum height is the Deck card's own floor (header, one title line, padding), so a handle never
 * shows a size the card cannot draw (029).
 */
export const CARD_SIZE_LIMITS = {
  min: { width: 120, height: NODE_SIZE.height },
  max: { width: 800, height: 600 },
  step: 4,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Space between a group's members and its dashed boundary. */
export const GROUP_PADDING = 24;

/** Offset for a new node that would land exactly on another one. */
export const FREE_SPOT_STEP = 24;

/**
 * Where a node is drawn: its document position, or a display-only grid slot when it has none
 * (never written back until the user moves it, so opening a deck is not an edit). The grid rule
 * lives in `@sododeck/model` (`nodeCanvasPosition`, ADR 0010) so the cascade agrees with the canvas.
 */
export function displayPosition(node: Pick<Node, 'position'>, index: number): Point {
  return (
    node.position ?? {
      x: (index % NODE_GRID.columns) * NODE_GRID.dx,
      y: Math.floor(index / NODE_GRID.columns) * NODE_GRID.dy,
    }
  );
}

function union(a: Rect | undefined, b: Rect): Rect {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function pad(rect: Rect, by: number): Rect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + 2 * by,
    height: rect.height + 2 * by,
  };
}

/**
 * A card's default size: the same at every zoom level (§g-58), so zooming in never makes a card
 * grow or re-flow. Zoom levels only change what a card shows (kind tile, subtitle).
 */
export function nodeSize(_level?: Level): NodeSize {
  return NODE_SIZE;
}

/** What `cardSize` reads of a node. All optional so a bare `{}` is a default card. */
export type SizedNode = Pick<Node, 'size'> & Partial<Pick<Node, 'title' | 'tech' | 'tags'>>;

/**
 * A card's drawn size (029 R7, 017 R2): 184 wide by the height `cardLayout` gives its content, or
 * the stored size (clamped to the limits, never below the minimum layout). The description is the
 * node's `tech`, the System view's subtitle; a view that shows another field paints inside the
 * same box. The same at every zoom level.
 */
export function cardLayoutOf(node: SizedNode, extra: CardExtra = {}): CardLayout {
  const stored = node.size;
  const size =
    stored === undefined
      ? undefined
      : {
          width: clamp(stored.width, CARD_SIZE_LIMITS.min.width, CARD_SIZE_LIMITS.max.width),
          height: clamp(stored.height, CARD_SIZE_LIMITS.min.height, CARD_SIZE_LIMITS.max.height),
        };
  return cardLayout({
    title: node.title ?? '',
    description: 'description' in extra ? extra.description : node.tech,
    tags: node.tags,
    childCount: extra.childCount,
    size,
  });
}

/** What a view adds to a card's content: its own subtitle field, and the "n inside" row. */
export interface CardExtra {
  description?: string | undefined;
  childCount?: number | undefined;
}

/** A card's drawn size, see `cardLayoutOf`. */
export function cardSize(node: SizedNode, _level?: Level, extra: CardExtra = {}): NodeSize {
  const { width, height } = cardLayoutOf(node, extra);
  return { width, height };
}

/** A card's box at its display position (017). */
export function cardBox(
  node: Pick<Node, 'position'> & SizedNode,
  index: number,
  level: Level,
): Rect {
  return { ...displayPosition(node, index), ...cardSize(node, level) };
}

const groupBoundsCache = new WeakMap<
  ReadonlyArray<SododeckFile['nodes'][number]>,
  WeakMap<ReadonlyArray<SododeckFile['groups'][number]>, Map<Level, Map<string, Rect>>>
>();

/**
 * The box of every group (016 research R3, the one place that resolves it): the stored frame when
 * the group has one; otherwise, for a deck an older tab has not fitted yet, its members' boxes
 * (each at its own `cardSize`, 017) and its child groups' boxes plus padding. Unframed groups in a
 * parent cycle, and unframed groups with nothing inside, get none.
 */
export function groupBounds(deck: SododeckFile, level: Level = 'system'): Map<string, Rect> {
  let byGroups = groupBoundsCache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    groupBoundsCache.set(deck.nodes, byGroups);
  }
  let byLevel = byGroups.get(deck.groups);
  if (byLevel === undefined) {
    byLevel = new Map();
    byGroups.set(deck.groups, byLevel);
  }
  const cached = byLevel.get(level);
  if (cached !== undefined) return cached;

  const content = new Map<string, Rect>();
  deck.nodes.forEach((node, index) => {
    if (node.group === undefined) return;
    content.set(node.group, union(content.get(node.group), cardBox(node, index, level)));
  });

  const children = new Map<string, string[]>();
  for (const group of deck.groups) {
    if (group.parent === undefined) continue;
    const list = children.get(group.parent) ?? [];
    list.push(group.id);
    children.set(group.parent, list);
  }

  const out = new Map<string, Rect>();
  for (const group of deck.groups) {
    const frame = frameOf(group);
    if (frame !== undefined) out.set(group.id, { ...frame.position, ...frame.size });
  }
  const visiting = new Set<string>();
  const resolve = (id: string): Rect | undefined => {
    if (out.has(id)) return out.get(id);
    if (visiting.has(id)) return undefined; // parent cycle: reported by the integrity check
    visiting.add(id);
    let inner = content.get(id);
    for (const child of children.get(id) ?? []) {
      const bounds = resolve(child);
      if (bounds) inner = union(inner, bounds);
    }
    visiting.delete(id);
    if (!inner) return undefined;
    const bounds = pad(inner, GROUP_PADDING);
    out.set(id, bounds);
    return bounds;
  };
  for (const group of deck.groups) resolve(group.id);
  byLevel.set(level, out);
  return out;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * The card whose on-screen centre is nearest `centre` (Tab into the canvas lands on what is in
 * view, never on a card far away that would pan the canvas). `null` with no cards.
 */
export function nearestToCentre(
  cards: readonly {
    id: string;
    rect: { left: number; top: number; width: number; height: number };
  }[],
  centre: { x: number; y: number },
): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const { id, rect } of cards) {
    const dx = rect.left + rect.width / 2 - centre.x;
    const dy = rect.top + rect.height / 2 - centre.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The nearest point within ±45° of `dir` from `fromId` (arrow-key navigation), ties broken by
 * the smaller id. `null` when there is none.
 */
export function nearestInDirection(
  points: readonly (Point & { id: string })[],
  fromId: string,
  dir: Direction,
): string | null {
  const from = points.find((p) => p.id === fromId);
  if (!from) return null;
  let best: { id: string; distance: number } | null = null;
  for (const p of points) {
    if (p.id === fromId) continue;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const across = dir === 'right' || dir === 'left' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0 || across > along) continue;
    const distance = Math.hypot(dx, dy);
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && p.id < best.id)
    ) {
      best = { id: p.id, distance };
    }
  }
  return best?.id ?? null;
}

/** `spot`, or offset by +24/+24 steps until no node sits exactly there (so both stay clickable). */
export function freeSpot(deck: SododeckFile, spot: Point): Point {
  const taken = new Set(
    deck.nodes.map((n, i) => {
      const p = displayPosition(n, i);
      return `${String(p.x)},${String(p.y)}`;
    }),
  );
  let { x, y } = spot;
  while (taken.has(`${String(x)},${String(y)}`)) {
    x += FREE_SPOT_STEP;
    y += FREE_SPOT_STEP;
  }
  return { x, y };
}

const FRAME_PADDING = 8;

/** Union box of the selected nodes (+8px) for the multi-selection frame, or null below two. */
export function selectionFrame(
  deck: SododeckFile,
  selected: readonly string[],
  level: Level = 'system',
): Rect | null {
  if (selected.length < 2) return null;
  const ids = new Set(selected);
  let box: Rect | undefined;
  deck.nodes.forEach((node, index) => {
    if (ids.has(node.id)) box = union(box, cardBox(node, index, level));
  });
  return box ? pad(box, FRAME_PADDING) : null;
}

/** Union box of the given nodes at their display positions, or null when none exists (007). */
export function boundsOf(
  deck: SododeckFile,
  nodeIds: Iterable<string>,
  level: Level = 'system',
): Rect | null {
  const ids = new Set(nodeIds);
  let box: Rect | undefined;
  deck.nodes.forEach((node, index) => {
    if (ids.has(node.id)) box = union(box, cardBox(node, index, level));
  });
  return box ?? null;
}

/** Whether a flow-space rect is fully visible in a viewport of `size` screen pixels. */
export function rectInView(
  rect: Rect,
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
): boolean {
  const left = rect.x * viewport.zoom + viewport.x;
  const top = rect.y * viewport.zoom + viewport.y;
  const right = left + rect.width * viewport.zoom;
  const bottom = top + rect.height * viewport.zoom;
  return left >= 0 && top >= 0 && right <= size.width && bottom <= size.height;
}
