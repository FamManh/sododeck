import type { SododeckFile } from '@sododeck/schema';

import { cardIconRef } from './card-icon';
import { cardBox, type Rect } from './canvas-geometry';
import type { Level } from './levels';
import { scopeBounds, type VisibleGraph } from './visible-graph';

/** An Outside proxy is 150 × 52 (DESIGN.md frame 118 d). */
export const PROXY_SIZE = { width: 150, height: 52 } as const;
/** Clear space between the scope and a proxy column. */
export const PROXY_OFFSET = 72;
export const PROXY_GAP = 16;

function iconField(node: SododeckFile['nodes'][number]): { icon?: string } {
  const icon = cardIconRef(node);
  return icon === undefined ? {} : { icon };
}

export interface OutsideProxy {
  /** `port:<outside node id>`: the prefix is kept from the old port pill. */
  id: string;
  outsideNodeId: string;
  title: string;
  /** The outside card's kind, for its icon. */
  kind: string;
  /** The outside card's stored icon (038); none for a node drawn as a shape. */
  icon?: string;
  /** Left when every connection comes in from outside. */
  side: 'left' | 'right';
  rect: Rect;
  edgeIds: readonly string[];
}

/**
 * Where the Outside proxies of a drill-in sit (034 R7): inputs in a column left of the scope,
 * everything else on the right, each column sorted by the mean height of the inside cards it
 * connects to and pushed down so proxies never overlap. One placement for canvas and export.
 */
export function proxyLayout(
  deck: SododeckFile,
  graph: VisibleGraph,
  level: Level,
): readonly OutsideProxy[] {
  if (graph.ports.length === 0) return [];
  const bounds = scopeBounds(deck, graph, level);
  if (bounds === null) return [];
  const edgesById = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const nodesById = new Map(deck.nodes.map((node, index) => [node.id, { node, index }]));

  const entries = graph.ports.flatMap((port) => {
    const outside = nodesById.get(port.outsideNodeId)?.node;
    if (outside === undefined) return [];
    const centres = port.insideNodeIds.flatMap((id) => {
      const found = nodesById.get(id);
      if (found === undefined) return [];
      const box = cardBox(found.node, found.index, level);
      return [box.y + box.height / 2];
    });
    if (centres.length === 0) return [];
    const incomingOnly = port.edgeIds.every((edgeId) => {
      const edge = edgesById.get(edgeId);
      if (edge === undefined) return false;
      if (edge.direction === 'both' || edge.direction === 'none') return false;
      return edge.from === port.outsideNodeId;
    });
    return [
      {
        port,
        outside,
        incomingOnly,
        mean: centres.reduce((sum, y) => sum + y, 0) / centres.length,
      },
    ];
  });

  const placed = new Map<string, OutsideProxy>();
  for (const side of ['left', 'right'] as const) {
    const column = entries
      .filter((entry) => entry.incomingOnly === (side === 'left'))
      .sort((a, b) => a.mean - b.mean);
    const x =
      side === 'left'
        ? bounds.x - PROXY_SIZE.width - PROXY_OFFSET
        : bounds.x + bounds.width + PROXY_OFFSET;
    let floor = Number.NEGATIVE_INFINITY;
    for (const entry of column) {
      const y = Math.max(entry.mean - PROXY_SIZE.height / 2, floor);
      floor = y + PROXY_SIZE.height + PROXY_GAP;
      placed.set(entry.port.id, {
        id: entry.port.id,
        outsideNodeId: entry.port.outsideNodeId,
        title: entry.outside.title,
        kind: entry.outside.type,
        ...iconField(entry.outside),
        side,
        rect: { x, y, ...PROXY_SIZE },
        edgeIds: entry.port.edgeIds,
      });
    }
  }
  // Left column first, each top to bottom: a stable order for focus and tests.
  return [...placed.values()].sort((a, b) =>
    a.side === b.side ? a.rect.y - b.rect.y : a.side === 'left' ? -1 : 1,
  );
}
