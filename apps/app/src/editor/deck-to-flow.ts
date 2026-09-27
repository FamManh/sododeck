import type { SododeckFile } from '@sododeck/schema';
import type { Edge, Node, XYPosition } from '@xyflow/react';

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
}

export type DeckFlowNode = Node<DeckNodeData, 'deck'>;

/** DESIGN.md: nodes are a fixed 164×50. Declaring it lets React Flow skip measuring (minimap, culling, perf). */
export const NODE_SIZE = { width: 164, height: 50 } as const;

const GRID = { columns: 10, dx: 220, dy: 110 };

/** Maps deck nodes to React Flow nodes. Pure; the document stays the source of truth. */
export function toFlowNodes(
  deck: SododeckFile,
  positions: Record<string, XYPosition>,
  selectedId: string | null,
): DeckFlowNode[] {
  return deck.nodes.map((node, index) => ({
    id: node.id,
    type: 'deck',
    ...NODE_SIZE,
    position: positions[node.id] ?? {
      x: (index % GRID.columns) * GRID.dx,
      y: Math.floor(index / GRID.columns) * GRID.dy,
    },
    selected: node.id === selectedId,
    data: {
      title: typeof node.title === 'string' ? node.title : node.id,
      kind: typeof node.type === 'string' ? node.type : 'default',
    },
  }));
}

/** Maps deck edges to React Flow edges, skipping edges whose endpoints are missing. */
export function toFlowEdges(deck: SododeckFile): Edge[] {
  const ids = new Set(deck.nodes.map((node) => node.id));
  return deck.edges.flatMap((edge) => {
    const { from, to, label } = edge;
    if (typeof from !== 'string' || typeof to !== 'string') return [];
    if (!ids.has(from) || !ids.has(to)) return [];
    return [
      {
        id: edge.id,
        source: from,
        target: to,
        type: 'smoothstep',
        ...(typeof label === 'string' ? { label } : {}),
      },
    ];
  });
}
