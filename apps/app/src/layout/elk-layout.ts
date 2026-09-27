import ELK from 'elkjs/lib/elk.bundled.js';

export interface LayoutRequest {
  nodes: { id: string; width: number; height: number }[];
  edges: { id: string; source: string; target: string }[];
}

export type LayoutResult = Record<string, { x: number; y: number }>;

const elk = new ELK();

/**
 * Pure layout function. Runs inside the layout Web Worker (rule 4: heavy work off
 * the main thread) and directly in tests. TODO(M4): pinned positions, groups.
 */
export async function computeLayout(request: LayoutRequest): Promise<LayoutResult> {
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: request.nodes.map((node) => ({ ...node })),
    edges: request.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  });

  const result: LayoutResult = {};
  for (const child of graph.children ?? []) {
    result[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }
  return result;
}
