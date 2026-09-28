/**
 * Pure canvas geometry (no React). Positions are flow coordinates of a node's top-left corner.
 */
import { NODE_GRID, type Point } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { Level } from './levels';

type Node = SododeckFile['nodes'][number];

export type { Point };

export interface Rect extends Point {
  width: number;
  height: number;
}

/** DESIGN.md: nodes are a fixed 164×50. */
export const NODE_SIZE = { width: 164, height: 50 } as const;
export const COMPONENT_CARD_SIZE = { width: 164, height: 104 } as const;
export const COLLAPSED_CARD_SIZE = { width: 180, height: 64 } as const;
type NodeSize = { width: number; height: number };
type SizeKey = `${number}x${number}`;

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

export function nodeSize(level: Level): NodeSize {
  return level === 'component' ? COMPONENT_CARD_SIZE : NODE_SIZE;
}

const groupBoundsCache = new WeakMap<
  ReadonlyArray<SododeckFile['nodes'][number]>,
  WeakMap<ReadonlyArray<SododeckFile['groups'][number]>, Map<SizeKey, Map<string, Rect>>>
>();

/**
 * Bounds of every non-empty group: its members' boxes and its child groups' bounds, plus
 * padding. Groups in a parent cycle, and groups with nothing inside, get none.
 */
export function groupBounds(deck: SododeckFile, size: NodeSize = NODE_SIZE): Map<string, Rect> {
  let byGroups = groupBoundsCache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    groupBoundsCache.set(deck.nodes, byGroups);
  }
  let bySize = byGroups.get(deck.groups);
  if (bySize === undefined) {
    bySize = new Map();
    byGroups.set(deck.groups, bySize);
  }
  const sizeKey: SizeKey = `${size.width}x${size.height}`;
  const cached = bySize.get(sizeKey);
  if (cached !== undefined) return cached;

  const content = new Map<string, Rect>();
  deck.nodes.forEach((node, index) => {
    if (node.group === undefined) return;
    const { x, y } = displayPosition(node, index);
    content.set(node.group, union(content.get(node.group), { x, y, ...size }));
  });

  const children = new Map<string, string[]>();
  for (const group of deck.groups) {
    if (group.parent === undefined) continue;
    const list = children.get(group.parent) ?? [];
    list.push(group.id);
    children.set(group.parent, list);
  }

  const out = new Map<string, Rect>();
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
  bySize.set(sizeKey, out);
  return out;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

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
  size: NodeSize = NODE_SIZE,
): Rect | null {
  if (selected.length < 2) return null;
  const ids = new Set(selected);
  let box: Rect | undefined;
  deck.nodes.forEach((node, index) => {
    if (ids.has(node.id)) box = union(box, { ...displayPosition(node, index), ...size });
  });
  return box ? pad(box, FRAME_PADDING) : null;
}

/** Union box of the given nodes at their display positions, or null when none exists (007). */
export function boundsOf(deck: SododeckFile, nodeIds: Iterable<string>): Rect | null {
  const ids = new Set(nodeIds);
  let box: Rect | undefined;
  deck.nodes.forEach((node, index) => {
    if (ids.has(node.id)) box = union(box, { ...displayPosition(node, index), ...NODE_SIZE });
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
