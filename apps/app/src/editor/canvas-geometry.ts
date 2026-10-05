/**
 * Pure canvas geometry (no React). Positions are flow coordinates of a node's top-left corner.
 */
import {
  drawnShapeType,
  frameOf,
  imageBox,
  NODE_GRID,
  shapeGeometryOf,
  type Point,
} from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { Level } from './levels';
import { cardLayout, DECK_CARD_WIDTH, type CardLayout } from './card-layout';
import {
  cardFieldView,
  currentFieldView,
  EMPTY_FIELD_VIEW,
  fieldBlock,
  type CardFieldView,
} from './card-fields';
import { SHAPE_MAX, shapeLayout } from './shapes/shape-layout';
import { currentTableContext, type TableContext } from './table-keys';
import {
  cachedTableLayout,
  TABLE_CARD,
  withFilterOf,
  withNewRowOf,
  type TableLayout,
} from './table-layout';

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
export type SizedNode = Partial<
  Pick<
    Node,
    | 'size'
    | 'title'
    | 'tech'
    | 'tags'
    | 'type'
    | 'display'
    | 'id'
    | 'host'
    | 'owner'
    | 'values'
    // A table's body (041).
    | 'description'
    | 'schema'
    | 'columns'
    | 'indexes'
    | 'detail'
  >
>;

/** The geometry a node draws as (031), or null for a card. */
export function geometryOf(node: SizedNode): ReturnType<typeof shapeGeometryOf> {
  return node.type === undefined
    ? null
    : shapeGeometryOf({ type: node.type, display: node.display });
}

export type SizeLimits = {
  readonly min: { readonly width: number; readonly height: number };
  readonly max: { readonly width: number; readonly height: number };
  readonly step: number;
};

/**
 * A table's width range (041): its height always follows its content, so the height limits only
 * keep a resize gesture from refusing; the stored height is ignored when drawing.
 */
export const TABLE_SIZE_LIMITS: SizeLimits = {
  min: { width: 160, height: CARD_SIZE_LIMITS.min.height },
  max: { width: CARD_SIZE_LIMITS.max.width, height: 4000 },
  step: CARD_SIZE_LIMITS.step,
};

/** Resize limits of a node: a shape's own minimum (031 R1), a table's, else the card limits. */
export function sizeLimitsOf(node: SizedNode): SizeLimits {
  if (node.type === 'db-table') return TABLE_SIZE_LIMITS;
  const min =
    node.type === undefined
      ? undefined
      : drawnShapeType({ type: node.type, display: node.display })?.minSize;
  return min === undefined
    ? CARD_SIZE_LIMITS
    : { min, max: SHAPE_MAX, step: CARD_SIZE_LIMITS.step };
}

/**
 * A card's drawn size (029 R7, 017 R2): 184 wide by the height `cardLayout` gives its content, or
 * the stored size (clamped to the limits, never below the minimum layout). The description is the
 * node's `tech`, the System view's subtitle; a view that shows another field paints inside the
 * same box. The same at every zoom level.
 */
export function cardLayoutOf(node: SizedNode, extra: CardExtra = {}): CardLayout {
  // A table's box comes from its rows (041): its detail and the deck's toggles, never the zoom.
  if (node.type === 'db-table') return tableCardLayout(node, extra.table);
  // A shape keeps its own box and draws only its title (031).
  const geometry = geometryOf(node);
  if (geometry !== null) return shapeLayout(geometry, node);
  const stored = node.size;
  const size =
    stored === undefined
      ? undefined
      : {
          width: clamp(stored.width, CARD_SIZE_LIMITS.min.width, CARD_SIZE_LIMITS.max.width),
          height: clamp(stored.height, CARD_SIZE_LIMITS.min.height, CARD_SIZE_LIMITS.max.height),
        };
  // The typed fields block (032): the caller's view (canvas, export) or the deck the canvas shows.
  const fields =
    extra.fields ?? (node.type === undefined ? EMPTY_FIELD_VIEW : currentFieldView(node as Node));
  return cardLayout({
    title: node.title ?? '',
    description: 'description' in extra ? extra.description : node.tech,
    tags: node.tags,
    childCount: extra.childCount,
    fieldsHeight: fieldBlock(fields, size?.width ?? DECK_CARD_WIDTH).height,
    size,
  });
}

/** A table node's layout (041), from the deck set by `setTableDeck` unless a context is given. */
const hasTitle = <T extends SizedNode>(node: T): node is T & { title: string } =>
  node.title !== undefined;

export function tableLayoutOf(node: SizedNode, context?: TableContext): TableLayout {
  const width = clamp(
    node.size?.width ?? TABLE_CARD.width,
    TABLE_SIZE_LIMITS.min.width,
    TABLE_SIZE_LIMITS.max.width,
  );
  // The node itself when it has a title, so the per-node layout cache and a projected new-row
  // mark (043) both reach the layout; a copy only for the title-less nodes some helpers pass.
  const table = hasTitle(node)
    ? node
    : withFilterOf(node, withNewRowOf(node, { ...node, title: '' }));
  return cachedTableLayout(table, context ?? currentTableContext(), width);
}

function tableCardLayout(node: SizedNode, context: TableContext | undefined): CardLayout {
  const table = tableLayoutOf(node, context);
  return {
    width: table.width,
    height: table.height,
    titleLines: 1,
    titleCut: table.titleCut,
    descriptionLines: table.noteLines.length,
    tagRows: 0,
    fieldsHeight: 0,
    hasChildrenRow: false,
    table,
  };
}

/** What a view adds to a card's content: its own subtitle field, the "n inside" row, its fields. */
export interface CardExtra {
  /** The deck context of a table (041); defaults to the deck set by `setTableDeck`. */
  table?: TableContext | undefined;
  description?: string | undefined;
  childCount?: number | undefined;
  /** The card's typed fields (032); defaults to `currentFieldView(node)`. */
  fields?: CardFieldView | undefined;
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
  extra: CardExtra = {},
): Rect {
  return { ...displayPosition(node, index), ...cardSize(node, level, extra) };
}

const groupBoundsCache = new WeakMap<
  ReadonlyArray<SododeckFile['nodes'][number]>,
  WeakMap<
    ReadonlyArray<SododeckFile['groups'][number]>,
    Map<
      Level,
      { fields: unknown; fieldDefaults: unknown; images: unknown; rects: Map<string, Rect> }
    >
  >
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
  // Card heights follow the typed fields shown (032), so the field definitions are in the key.
  const cached = byLevel.get(level);
  if (
    cached !== undefined &&
    cached.fields === deck.fields &&
    cached.fieldDefaults === deck.fieldDefaults &&
    cached.images === deck.images
  ) {
    return cached.rects;
  }

  const content = new Map<string, Rect>();
  deck.nodes.forEach((node, index) => {
    if (node.group === undefined) return;
    const box = cardBox(node, index, level, { fields: cardFieldView(deck, node) });
    content.set(node.group, union(content.get(node.group), box));
  });

  // An image in a group is a member (055): its own box counts, whatever the card size.
  for (const image of deck.images ?? []) {
    if (image.group === undefined) continue;
    content.set(image.group, union(content.get(image.group), imageBox(image)));
  }

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
  byLevel.set(level, {
    fields: deck.fields,
    fieldDefaults: deck.fieldDefaults,
    images: deck.images,
    rects: out,
  });
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
  // A step may end on a group (050 R6): its frame counts.
  if (deck.groups.some((group) => ids.has(group.id))) {
    const frames = groupBounds(deck, level);
    for (const group of deck.groups) {
      const frame = ids.has(group.id) ? frames.get(group.id) : undefined;
      if (frame !== undefined) box = union(box, frame);
    }
  }
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
