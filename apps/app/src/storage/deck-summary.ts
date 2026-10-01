import type { Node, SododeckFile } from '@sododeck/schema';

import {
  displayPosition,
  groupBounds,
  CARD_SIZE_LIMITS,
  NODE_SIZE,
  type Rect,
} from '../editor/canvas-geometry';
import type { DeckThumb } from './library-db';

export interface DeckSummary {
  name: string;
  nodeCount: number;
  edgeCount: number;
  flowCount: number;
  thumb: DeckThumb | null;
}

const BOX = 1000;

/** A card's own size (017 R2), clamped to the drawable range, else the default. */
function sizeOf(node: Pick<Node, 'size'>): { width: number; height: number } {
  const stored = node.size;
  if (stored === undefined) return NODE_SIZE;
  return {
    width: Math.min(Math.max(stored.width, CARD_SIZE_LIMITS.min.width), CARD_SIZE_LIMITS.max.width),
    height: Math.min(
      Math.max(stored.height, CARD_SIZE_LIMITS.min.height),
      CARD_SIZE_LIMITS.max.height,
    ),
  };
}

/**
 * The library's cached view of a deck (research R6, R10): name, counts and a thumbnail drawn
 * from node positions and group bounds exactly as the canvas places them. O(nodes).
 */
export function summarizeDeck(
  file: SododeckFile,
  { maxNodes = 150 }: { maxNodes?: number } = {},
): DeckSummary {
  return {
    name: file.name ?? 'Untitled deck',
    nodeCount: file.nodes.length,
    edgeCount: file.edges.length,
    flowCount: file.flows.length,
    thumb: thumbOf(file, maxNodes),
  };
}

function thumbOf(file: SododeckFile, maxNodes: number): DeckThumb | null {
  if (file.nodes.length === 0) return null;
  const points = file.nodes.map((node, index) => displayPosition(node, index));
  const sizes = file.nodes.map((node) => sizeOf(node));
  const groups = [...groupBounds(file).values()];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (r: Rect) => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  };
  points.forEach((p, i) => {
    include({ ...p, ...(sizes[i] ?? NODE_SIZE) });
  });
  for (const g of groups) include(g);

  const scale = BOX / Math.max(maxX - minX, maxY - minY);
  const n = (value: number) => Math.round(value * scale);
  return {
    w: n(maxX - minX),
    h: n(maxY - minY),
    node: [Math.max(1, n(NODE_SIZE.width)), Math.max(1, n(NODE_SIZE.height))],
    nodes: file.nodes.slice(0, maxNodes).map((node, i) => {
      const p = points[i] ?? displayPosition(node, i);
      if (node.size === undefined) return [n(p.x - minX), n(p.y - minY), node.type];
      const size = sizes[i] ?? NODE_SIZE;
      return [
        n(p.x - minX),
        n(p.y - minY),
        node.type,
        Math.max(1, n(size.width)),
        Math.max(1, n(size.height)),
      ];
    }),
    groups: groups.map((g) => [n(g.x - minX), n(g.y - minY), n(g.width), n(g.height)]),
  };
}
