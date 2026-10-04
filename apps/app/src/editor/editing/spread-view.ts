/**
 * The `SpreadView` "Spread ends evenly" reads (050 US7), built from what the canvas draws: the
 * React Flow nodes give every end's box (cards, `group:<id>` frames, `collapsed:<id>` cards, port
 * pills) and the React Flow edges give the side each end is drawn on, which `deck-to-flow`
 * already resolved for automatic ends (`resolveSides` / `autoSides`). Reading the drawn result
 * rather than resolving again keeps one source for automatic sides. Pure.
 */
import type { Edge, Id, Side } from '@sododeck/schema';

import { COLLAPSED_NODE_PREFIX, GROUP_NODE_PREFIX } from '../deck-to-flow';
import type { Box } from '../routing/route-path';
import type { SpreadEdge, SpreadView } from './spread-ends';

/** The parts of a React Flow node this reads (all nodes are absolutely positioned). */
export interface DrawnNode {
  id: string;
  position: { x: number; y: number };
  width?: number | undefined;
  height?: number | undefined;
  measured?: { width?: number | undefined; height?: number | undefined } | undefined;
  hidden?: boolean | undefined;
}

/** The parts of a React Flow edge this reads. */
export interface DrawnEdge {
  id: string;
  type?: string | undefined;
  source: string;
  target: string;
  sourceHandle?: string | null | undefined;
  targetHandle?: string | null | undefined;
  hidden?: boolean | undefined;
  data?: Record<string, unknown> | undefined;
}

const SIDES: ReadonlySet<string> = new Set<Side>(['top', 'right', 'bottom', 'left']);
const isSide = (value: string | null | undefined): value is Side =>
  value != null && SIDES.has(value);

function boxOf(node: DrawnNode): Box | null {
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  if (width === undefined || height === undefined) return null;
  return { x: node.position.x, y: node.position.y, width, height };
}

/**
 * Only plain connectors (`deck` edges) still in the deck count: bundles and sticky leaders are
 * not one connector. A hidden connector, or one drawn to a port pill (`routable: false`, where
 * the drawn side is not the real card's), is kept but marked hidden so `spreadEnds` skips it.
 */
export function spreadViewOf(
  nodes: readonly DrawnNode[],
  edges: readonly DrawnEdge[],
  deckEdges: readonly Pick<Edge, 'id' | 'route'>[],
): SpreadView {
  const boxes = new Map<Id, Box>();
  for (const node of nodes) {
    if (node.hidden === true) continue;
    const box = boxOf(node);
    if (box !== null) boxes.set(node.id, box);
  }
  const routes = new Map(deckEdges.map((edge) => [edge.id, edge.route]));
  const spread: SpreadEdge[] = [];
  for (const edge of edges) {
    if (edge.type !== 'deck' || !routes.has(edge.id)) continue;
    const { sourceHandle, targetHandle } = edge;
    if (!isSide(sourceHandle) || !isSide(targetHandle)) continue;
    spread.push({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      fromSide: sourceHandle,
      toSide: targetHandle,
      route: routes.get(edge.id),
      hidden: edge.hidden === true || edge.data?.routable === false,
    });
  }
  return { edges: spread, boxes };
}

/** The drawn ids a selection spreads: its cards, and each group as a frame or a collapsed card. */
export function spreadTargets(selection: { nodes: readonly Id[]; groups: readonly Id[] }): Id[] {
  return [
    ...selection.nodes,
    ...selection.groups.flatMap((id) => [
      `${GROUP_NODE_PREFIX}${id}`,
      `${COLLAPSED_NODE_PREFIX}${id}`,
    ]),
  ];
}
