/**
 * Deck → React Flow view models (003 research R10). Pure and derived on every render from the
 * snapshot; React Flow never owns document state. Results are cached per source object, so an
 * edit to one node returns the same React Flow objects for all the others and `memo` skips them.
 */
import type { SododeckFile } from '@sododeck/schema';
import type { Edge, Node } from '@xyflow/react';

import { displayPosition, groupBounds, NODE_SIZE, type Point } from './canvas-geometry';
import type { Selection } from '../state/ui-store';

type DeckNodeObject = SododeckFile['nodes'][number];
type DeckEdgeObject = SododeckFile['edges'][number];

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
  subtitle: string | undefined;
  hasRules: boolean;
  /** Carries the canvas's single Tab stop (roving tabindex). */
  focused: boolean;
}

export interface GroupBoundaryData extends Record<string, unknown> {
  title: string;
  count: number;
}

export interface DeckEdgeData extends Record<string, unknown> {
  label: string | undefined;
  protocol: DeckEdgeObject['protocol'];
  direction: NonNullable<DeckEdgeObject['direction']>;
  showLabel: boolean;
  fromTitle: string;
  toTitle: string;
  focused: boolean;
}

export type DeckFlowNode = Node<DeckNodeData, 'deck'>;
export type GroupFlowNode = Node<GroupBoundaryData, 'group-boundary'>;
export type CanvasFlowNode = DeckFlowNode | GroupFlowNode;
export type DeckFlowEdge = Edge<DeckEdgeData, 'deck'>;

export { NODE_SIZE };

/** Group boundaries are React Flow nodes too; their ids are prefixed so they never clash. */
export const GROUP_NODE_PREFIX = 'group:';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const nodeCache = new WeakMap<DeckNodeObject, DeckFlowNode>();
const groupCache = new Map<string, GroupFlowNode>();
const edgeCache = new WeakMap<DeckEdgeObject, DeckFlowEdge>();
/** Last edge list: returned again when every element is the same, so React Flow skips a re-sync. */
let lastEdges: DeckFlowEdge[] = [];

function toFlowNode(
  node: DeckNodeObject,
  position: Point,
  selected: boolean,
  focused: boolean,
): DeckFlowNode {
  const cached = nodeCache.get(node);
  if (
    cached?.selected === selected &&
    cached.data.focused === focused &&
    cached.position.x === position.x &&
    cached.position.y === position.y
  ) {
    return cached;
  }
  const flowNode: DeckFlowNode = {
    id: node.id,
    type: 'deck',
    ...NODE_SIZE,
    position,
    selected,
    data: {
      title: node.title,
      kind: node.type,
      subtitle: node.tech,
      hasRules: (node.rules?.length ?? 0) > 0,
      focused,
    },
  };
  nodeCache.set(node, flowNode);
  return flowNode;
}

/** Number of nodes in each group, nested groups included. */
function groupCounts(deck: SododeckFile): Map<string, number> {
  const parentOf = new Map(deck.groups.map((g) => [g.id, g.parent]));
  const counts = new Map<string, number>();
  for (const node of deck.nodes) {
    const seen = new Set<string>();
    let group = node.group;
    while (group !== undefined && !seen.has(group) && parentOf.has(group)) {
      seen.add(group);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      group = parentOf.get(group);
    }
  }
  return counts;
}

function groupNodes(deck: SododeckFile): GroupFlowNode[] {
  if (deck.groups.length === 0) return [];
  const bounds = groupBounds(deck);
  const counts = groupCounts(deck);
  return deck.groups.flatMap((group) => {
    const rect = bounds.get(group.id);
    if (!rect) return [];
    const id = GROUP_NODE_PREFIX + group.id;
    const count = counts.get(group.id) ?? 0;
    const cached = groupCache.get(id);
    if (
      cached?.data.title === group.title &&
      cached.data.count === count &&
      cached.position.x === rect.x &&
      cached.position.y === rect.y &&
      cached.width === rect.width &&
      cached.height === rect.height
    ) {
      return [cached];
    }
    const flowNode: GroupFlowNode = {
      id,
      type: 'group-boundary',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      selectable: false,
      draggable: false,
      focusable: false,
      connectable: false,
      zIndex: -1,
      data: { title: group.title, count },
    };
    groupCache.set(id, flowNode);
    return [flowNode];
  });
}

/** Group boundaries first (drawn below), then components. */
export function toFlowNodes(
  deck: SododeckFile,
  selection: Selection,
  focusedId: string | null,
): CanvasFlowNode[] {
  const selected = new Set(selection.nodes);
  const components = deck.nodes.map((node, index) =>
    toFlowNode(node, displayPosition(node, index), selected.has(node.id), node.id === focusedId),
  );
  return [...groupNodes(deck), ...components];
}

/** Picks the facing sides of two boxes, so edges leave and enter where it looks natural. */
export function facingSides(from: Point, to: Point): [HandleSide, HandleSide] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** Accessible name of a connection: "<from> to <to>[: label]". */
export function edgeName(fromTitle: string, toTitle: string, label?: string): string {
  return `${fromTitle} to ${toTitle}${label ? `: ${label}` : ''}`;
}

/** Maps deck edges to React Flow edges, skipping edges whose endpoints are missing. */
export function toFlowEdges(
  deck: SododeckFile,
  selection: Selection,
  labelsOn: boolean,
  focusedEdgeId: string | null = null,
): DeckFlowEdge[] {
  const nodes = new Map(
    deck.nodes.map((node, index) => [node.id, { node, position: displayPosition(node, index) }]),
  );
  const selected = new Set(selection.edges);
  const next = deck.edges.flatMap((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    // The schema does not check references; a file may still point at missing nodes.
    if (!from || !to) return [];
    const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
    const isSelected = selected.has(edge.id);
    const showLabel = labelsOn && edge.label !== undefined && edge.label !== '';
    const focused = edge.id === focusedEdgeId;
    const cached = edgeCache.get(edge);
    if (
      cached?.selected === isSelected &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      cached.data?.showLabel === showLabel &&
      cached.data.focused === focused &&
      cached.data.fromTitle === from.node.title &&
      cached.data.toTitle === to.node.title
    ) {
      return [cached];
    }
    const flowEdge: DeckFlowEdge = {
      id: edge.id,
      type: 'deck',
      source: edge.from,
      target: edge.to,
      sourceHandle,
      targetHandle,
      selected: isSelected,
      interactionWidth: 12,
      ariaLabel: edgeName(from.node.title, to.node.title, edge.label),
      data: {
        label: edge.label,
        protocol: edge.protocol,
        direction: edge.direction ?? 'forward',
        showLabel,
        fromTitle: from.node.title,
        toTitle: to.node.title,
        focused,
      },
    };
    edgeCache.set(edge, flowEdge);
    return [flowEdge];
  });
  // A drag moves nodes, rarely edges: keep the array identity when nothing in it changed.
  if (next.length === lastEdges.length && next.every((e, i) => e === lastEdges[i]))
    return lastEdges;
  lastEdges = next;
  return next;
}
