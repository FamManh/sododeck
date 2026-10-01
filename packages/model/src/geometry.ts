/**
 * Canvas geometry: pure functions of a plain `SododeckFile`. Sticky placement is shared by the
 * model's cascade and the app's canvas so a note's screen point never disagrees between them
 * (ADR 0010); group frames are fitted here for decks saved before frames were stored (016).
 */
import type { Frame, Group, Id, Node, SododeckFile, Sticky, View } from '@sododeck/schema';

export interface Point {
  x: number;
  y: number;
}

/** Grid used for nodes without a stored position. Must equal `apps/app/canvas-geometry.ts` GRID. */
export const NODE_GRID = { columns: 10, dx: 220, dy: 110 } as const;

/** Offset of a pinned note that has no stored position. */
export const STICKY_DEFAULT_OFFSET: Point = { x: 24, y: -96 };

/** The node's stored position, or its grid slot by index in `file.nodes`. Null when no such node. */
export function nodeCanvasPosition(file: SododeckFile, nodeId: Id): Point | null {
  const index = file.nodes.findIndex((n) => n.id === nodeId);
  if (index === -1) return null;
  const node = file.nodes[index];
  if (node === undefined) return null;
  return (
    node.position ?? {
      x: (index % NODE_GRID.columns) * NODE_GRID.dx,
      y: Math.floor(index / NODE_GRID.columns) * NODE_GRID.dy,
    }
  );
}

export type StickyPlacement =
  | { status: 'free'; point: Point }
  | { status: 'pinned'; point: Point; pinnedTo: Id }
  | { status: 'foreign'; point: Point; anchor: Id }
  | { status: 'missing'; point: Point; anchor: Id };

/** Where a note is drawn: free, pinned to a node, pinned to something else, or a missing anchor. */
export function stickyCanvasPosition(file: SododeckFile, sticky: Sticky): StickyPlacement {
  const anchor = sticky.anchor;
  if (anchor === undefined) {
    return { status: 'free', point: sticky.position ?? { x: 0, y: 0 } };
  }
  const base = nodeCanvasPosition(file, anchor);
  if (base === null) {
    // Not a node: either a foreign anchor (some other object exists) or a missing one.
    const isNode = file.nodes.some((n) => n.id === anchor);
    const exists =
      isNode ||
      file.edges.some((e) => e.id === anchor) ||
      file.groups.some((g) => g.id === anchor) ||
      file.views.some((v) => v.id === anchor) ||
      file.features.some((f) => f.id === anchor) ||
      file.flows.some((f) => f.id === anchor || f.steps.some((s) => s.id === anchor)) ||
      anchor in file.rules;
    const point = sticky.position ?? { x: 0, y: 0 };
    return exists ? { status: 'foreign', point, anchor } : { status: 'missing', point, anchor };
  }
  const offset = sticky.position ?? STICKY_DEFAULT_OFFSET;
  return {
    status: 'pinned',
    point: { x: base.x + offset.x, y: base.y + offset.y },
    pinnedTo: anchor,
  };
}

const MARKDOWN_MARKERS = /(\*\*|__|\*|_)/g;

/** First non-empty line of `text`, with markdown emphasis markers removed. Null when blank. */
export function stickyLabel(text: string): string | null {
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    return line.replace(MARKDOWN_MARKERS, '');
  }
  return null;
}

/**
 * Where a view shows a node (FR-020): the view's own position when it has one (any view, the base
 * view included, since a view that became the base keeps its layout), else the node's position.
 * Undefined when neither exists; the caller falls back to the grid slot.
 */
export function viewPosition(
  file: Pick<SododeckFile, 'nodes'>,
  view: Pick<View, 'positions'>,
  nodeId: Id,
): Point | undefined {
  const own = view.positions?.[nodeId];
  if (own !== undefined) return own;
  return file.nodes.find((n) => n.id === nodeId)?.position;
}

/** `viewPosition` when the caller already holds the node (linear loops over nodes). */
export function viewNodePosition(
  view: Pick<View, 'positions'>,
  node: Pick<Node, 'id' | 'position'>,
): Point | undefined {
  return view.positions?.[node.id] ?? node.position;
}

/** A group's stored frame on the base canvas, or undefined when it has none (older files). */
export function frameOf(group: Pick<Group, 'position' | 'size'>): Frame | undefined {
  const { position, size } = group;
  return position === undefined || size === undefined ? undefined : { position, size };
}

export interface FitOptions {
  /** Card size used for a member with no `sizeOf`, or every member without one. */
  cardSize: { width: number; height: number };
  /** Space between the members' box and the frame. */
  padding: number;
  /** Fit for this view's own positions and frames; the base canvas when absent. */
  viewId?: Id;
  /** Per-node size (017); defaults to `cardSize` for every node. */
  sizeOf?: (node: Node) => { width: number; height: number };
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function unionBox(a: Box | undefined, b: Box): Box {
  if (a === undefined) return b;
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

const boxOfFrame = ({ position, size }: Frame): Box => ({
  left: position.x,
  top: position.y,
  right: position.x + size.width,
  bottom: position.y + size.height,
});

/**
 * Frames for the groups that have none (016 research R2): inner-first, the union of the member
 * cards and the child frames (stored or fitted), plus padding. Empty groups and groups in a parent
 * cycle get none. With `viewId`, positions come from that view and a group counts as framed when
 * the view or the base has a frame. Linear in nodes + groups.
 */
export function fitGroupFrames(
  file: Pick<SododeckFile, 'nodes' | 'groups' | 'views'>,
  options: FitOptions,
): Map<Id, Frame> {
  const { cardSize, padding, viewId, sizeOf } = options;
  const view = viewId === undefined ? undefined : file.views.find((v) => v.id === viewId);
  const stored = new Map<Id, Frame>();
  for (const group of file.groups) {
    const own = view?.groupFrames?.[group.id] ?? frameOf(group);
    if (own !== undefined) stored.set(group.id, own);
  }

  const content = new Map<Id, Box>();
  file.nodes.forEach((node, index) => {
    if (node.group === undefined) return;
    const at = (view === undefined ? node.position : viewNodePosition(view, node)) ?? {
      x: (index % NODE_GRID.columns) * NODE_GRID.dx,
      y: Math.floor(index / NODE_GRID.columns) * NODE_GRID.dy,
    };
    const size = sizeOf?.(node) ?? cardSize;
    const card = {
      left: at.x,
      top: at.y,
      right: at.x + size.width,
      bottom: at.y + size.height,
    };
    content.set(node.group, unionBox(content.get(node.group), card));
  });

  const children = new Map<Id, Id[]>();
  for (const group of file.groups) {
    if (group.parent === undefined) continue;
    const list = children.get(group.parent) ?? [];
    list.push(group.id);
    children.set(group.parent, list);
  }

  const fitted = new Map<Id, Frame>();
  const done = new Map<Id, Box | null>();
  const visiting = new Set<Id>();
  const resolve = (id: Id): Box | null => {
    const known = done.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return null;
    const own = stored.get(id);
    if (own !== undefined) {
      const box = boxOfFrame(own);
      done.set(id, box);
      return box;
    }
    visiting.add(id);
    let inner = content.get(id);
    for (const child of children.get(id) ?? []) {
      const box = resolve(child);
      if (box !== null) inner = unionBox(inner, box);
    }
    visiting.delete(id);
    if (inner === undefined) {
      done.set(id, null);
      return null;
    }
    const box = {
      left: inner.left - padding,
      top: inner.top - padding,
      right: inner.right + padding,
      bottom: inner.bottom + padding,
    };
    done.set(id, box);
    fitted.set(id, {
      position: { x: box.left, y: box.top },
      size: { width: box.right - box.left, height: box.bottom - box.top },
    });
    return box;
  };
  for (const group of file.groups) resolve(group.id);
  return fitted;
}
