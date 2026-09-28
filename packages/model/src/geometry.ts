/**
 * Sticky note geometry: pure functions of a plain `SododeckFile`, shared by the model's cascade
 * and the app's canvas so a note's screen point never disagrees between them (ADR 0010).
 */
import type { Id, SododeckFile, Sticky } from '@sododeck/schema';

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
