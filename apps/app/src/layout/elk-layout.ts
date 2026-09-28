import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';

type Point = { x: number; y: number };

/**
 * A Tidy layout request (011 research R9): the components to arrange (a collapsed group comes in
 * as one component), the groups they sit in (laid out as compound nodes), the connections that
 * shape the layers, and the pinned components with the positions they must keep.
 */
export interface LayoutRequest {
  nodes: { id: string; width: number; height: number; parent?: string }[];
  groups: { id: string; parent?: string }[];
  edges: { id: string; source: string; target: string }[];
  pinned: Record<string, Point>;
}

/** Top-left positions of every requested component, in canvas coordinates. */
export type LayoutResult = Record<string, Point>;

const elk = new ELK();

/** Space between boxes; matches the look of hand-made decks (220 × 110 grid, 164 × 50 nodes). */
const SPACING = 40;
/** Inside a group: `GROUP_PADDING` (canvas-geometry) around members, more on top for the title. */
const GROUP_PADDING = '[top=40,left=32,bottom=32,right=32]';
/** Gap kept between boxes by the overlap sweep. */
const GAP = 24;

/**
 * Pure layout function (constitution V: runs in the layout Web Worker, and directly in tests).
 * ELK `layered`, left to right, with groups as compound nodes (`INCLUDE_CHILDREN`) so members stay
 * together; pinned components take part (their connections still shape the layers) and are then
 * put back by `applyPins`.
 */
export async function computeLayout(request: LayoutRequest): Promise<LayoutResult> {
  const groupIds = new Set(request.groups.map((g) => g.id));
  const parentOf = (parent: string | undefined) =>
    parent !== undefined && groupIds.has(parent) ? parent : undefined;

  // Groups with nothing inside are left out (ELK would give them an empty box).
  const used = new Set<string>();
  const groupParent = new Map(request.groups.map((g) => [g.id, parentOf(g.parent)]));
  for (const node of request.nodes) {
    let group = parentOf(node.parent);
    while (group !== undefined && !used.has(group)) {
      used.add(group);
      group = groupParent.get(group);
    }
  }

  const compounds = new Map<string, ElkNode>();
  for (const group of request.groups) {
    if (!used.has(group.id)) continue;
    compounds.set(group.id, {
      id: `group:${group.id}`,
      layoutOptions: { 'elk.padding': GROUP_PADDING },
      children: [],
    });
  }
  const root: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': String(SPACING),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(SPACING * 2),
      'elk.spacing.componentComponent': String(SPACING * 2),
    },
    children: [],
  };
  const childrenOf = (group: string | undefined) =>
    (group === undefined ? root : compounds.get(group))?.children ?? root.children ?? [];
  for (const group of request.groups) {
    const compound = compounds.get(group.id);
    if (compound !== undefined) childrenOf(parentOf(group.parent)).push(compound);
  }
  const nodeIds = new Set<string>();
  for (const node of request.nodes) {
    nodeIds.add(node.id);
    childrenOf(parentOf(node.parent)).push({ id: node.id, width: node.width, height: node.height });
  }
  root.edges = request.edges
    .filter((e) => e.source !== e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }));

  const graph = await elk.layout(root);

  // ELK positions children relative to their parent: add the offsets up.
  const result: LayoutResult = {};
  const walk = (node: ElkNode, dx: number, dy: number) => {
    for (const child of node.children ?? []) {
      const x = dx + (child.x ?? 0);
      const y = dy + (child.y ?? 0);
      if (nodeIds.has(child.id)) result[child.id] = { x: Math.round(x), y: Math.round(y) };
      else walk(child, x, y);
    }
  };
  walk(graph, 0, 0);
  return applyPins(result, request);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

type Box = Point & { width: number; height: number };

const hits = (a: Box, b: Box) =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

/**
 * Enforces pins on a finished layout (011 research R9, SC-001):
 *  1. shifts everything by the median offset between the pinned components' laid-out and real
 *     positions, so the arrangement lands near the pins;
 *  2. puts pinned components back exactly;
 *  3. sweeps the free components in reading order, pushing each one right (or down, when right is
 *     far) off anything already placed, until no two boxes overlap.
 * Deterministic; pinned components never move.
 */
export function applyPins(layout: LayoutResult, request: LayoutRequest): LayoutResult {
  const pinnedIds = Object.keys(request.pinned).filter((id) => layout[id] !== undefined);
  if (pinnedIds.length === 0) return layout;
  const dx = Math.round(
    median(pinnedIds.map((id) => (request.pinned[id]?.x ?? 0) - (layout[id]?.x ?? 0))),
  );
  const dy = Math.round(
    median(pinnedIds.map((id) => (request.pinned[id]?.y ?? 0) - (layout[id]?.y ?? 0))),
  );

  const sizes = new Map(request.nodes.map((n) => [n.id, n]));
  const box = (id: string, point: Point): Box => ({
    ...point,
    width: sizes.get(id)?.width ?? 0,
    height: sizes.get(id)?.height ?? 0,
  });
  const result: LayoutResult = {};
  const placed: Box[] = [];
  for (const id of pinnedIds) {
    const point = request.pinned[id] as Point;
    result[id] = point;
    placed.push(box(id, point));
  }
  const free = Object.entries(layout)
    .filter(([id]) => !Object.hasOwn(request.pinned, id))
    .map(([id, p]) => ({ id, point: { x: p.x + dx, y: p.y + dy } }))
    .sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x || (a.id < b.id ? -1 : 1));

  const push = (start: Box, axis: 'x' | 'y'): Box => {
    const current = { ...start };
    for (let guard = 0; guard <= placed.length; guard++) {
      const blocker = placed.find((other) => hits(current, other));
      if (blocker === undefined) break;
      current[axis] =
        axis === 'x' ? blocker.x + blocker.width + GAP : blocker.y + blocker.height + GAP;
    }
    return current;
  };
  for (const { id, point } of free) {
    const start = box(id, point);
    const right = push(start, 'x');
    const down = right.x - start.x > start.width * 3 ? push(start, 'y') : null;
    const final = down !== null && !placed.some((other) => hits(down, other)) ? down : right;
    result[id] = { x: final.x, y: final.y };
    placed.push(final);
  }
  return result;
}
