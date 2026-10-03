import type { SododeckFile } from '@sododeck/schema';

import { cardFieldView } from './card-fields';
import { cardBox, COLLAPSED_CARD_SIZE, groupBounds, type Rect } from './canvas-geometry';
import type { Level } from './levels';

export interface Scope {
  node: string | null;
  group: string | null;
}

export interface DrillFrame {
  kind: 'group' | 'node';
  id: string;
}

export interface CollapsedCard {
  groupId: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  hiddenEdges: readonly string[];
  /** The kind of every member node, in deck order: one tile each on the fanned hand (029). */
  memberKinds: readonly string[];
  rect: Rect;
}

export interface MergedEdge {
  id: string;
  a: string;
  b: string;
  edgeIds: readonly string[];
  direction: 'a-to-b' | 'b-to-a' | 'both';
}

export interface PortPill {
  id: string;
  outsideNodeId: string;
  outsideTitle: string;
  edgeIds: readonly string[];
  insideNodeIds: readonly string[];
}

export interface VisibleGraph {
  scope: Scope;
  nodes: readonly string[];
  groups: readonly string[];
  cards: readonly CollapsedCard[];
  edges: readonly string[];
  merged: readonly MergedEdge[];
  ports: readonly PortPill[];
  representative: ReadonlyMap<string, string>;
  hiddenBy: ReadonlyMap<string, string>;
  childCount: ReadonlyMap<string, number>;
}

const COLLAPSED_NODE_PREFIX = 'collapsed:';
const MERGED_EDGE_PREFIX = 'merged:';
const PORT_NODE_PREFIX = 'port:';

type GroupMap = ReadonlyMap<string, SododeckFile['groups'][number]>;

const graphCache = new WeakMap<
  ReadonlyArray<SododeckFile['nodes'][number]>,
  WeakMap<
    ReadonlyArray<SododeckFile['edges'][number]>,
    WeakMap<ReadonlyArray<SododeckFile['groups'][number]>, Map<string, VisibleGraph>>
  >
>();

function graphCacheFor(deck: SododeckFile): Map<string, VisibleGraph> {
  let byEdges = graphCache.get(deck.nodes);
  if (byEdges === undefined) {
    byEdges = new WeakMap();
    graphCache.set(deck.nodes, byEdges);
  }
  let byGroups = byEdges.get(deck.edges);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    byEdges.set(deck.edges, byGroups);
  }
  let byKey = byGroups.get(deck.groups);
  if (byKey === undefined) {
    byKey = new Map();
    byGroups.set(deck.groups, byKey);
  }
  return byKey;
}

function cacheKey(scope: Scope, collapsed: ReadonlySet<string>): string {
  const collapsedIds = [...collapsed].sort().join(',');
  return `${scope.node ?? ''}|${scope.group ?? ''}|${collapsedIds}`;
}

function effectiveGroupParents(deck: SododeckFile): Map<string, string | undefined> {
  const groupMap = new Map(deck.groups.map((group) => [group.id, group]));
  const out = new Map<string, string | undefined>();
  for (const group of deck.groups) {
    let parent = group.parent;
    if (parent === undefined || !groupMap.has(parent)) {
      out.set(group.id, undefined);
      continue;
    }
    const seen = new Set<string>([group.id]);
    let cyclic = false;
    while (parent !== undefined && groupMap.has(parent)) {
      if (seen.has(parent)) {
        cyclic = true;
        break;
      }
      seen.add(parent);
      parent = groupMap.get(parent)?.parent;
    }
    out.set(group.id, cyclic ? undefined : group.parent);
  }
  return out;
}

function effectiveNodeParents(deck: SododeckFile): Map<string, string | undefined> {
  const nodeMap = new Map(deck.nodes.map((node) => [node.id, node]));
  const out = new Map<string, string | undefined>();
  for (const node of deck.nodes) {
    let parent = node.parent;
    if (parent === undefined || !nodeMap.has(parent)) {
      out.set(node.id, undefined);
      continue;
    }
    const seen = new Set<string>([node.id]);
    let cyclic = false;
    while (parent !== undefined && nodeMap.has(parent)) {
      if (seen.has(parent)) {
        cyclic = true;
        break;
      }
      seen.add(parent);
      parent = nodeMap.get(parent)?.parent;
    }
    out.set(node.id, cyclic ? undefined : node.parent);
  }
  return out;
}

function lineage(
  id: string | undefined,
  parents: ReadonlyMap<string, string | undefined>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let current = id;
  while (current !== undefined && !seen.has(current) && parents.has(current)) {
    out.push(current);
    seen.add(current);
    current = parents.get(current);
  }
  return out;
}

function subtreeMembers(
  groupId: string,
  groups: GroupMap,
  parents: ReadonlyMap<string, string | undefined>,
): Set<string> {
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id) || !groups.has(id)) return;
    out.add(id);
    for (const group of groups.values()) {
      if (parents.get(group.id) === id) visit(group.id);
    }
  };
  visit(groupId);
  return out;
}

function centered(rect: Rect): Rect {
  return {
    x: rect.x + rect.width / 2 - COLLAPSED_CARD_SIZE.width / 2,
    y: rect.y + rect.height / 2 - COLLAPSED_CARD_SIZE.height / 2,
    ...COLLAPSED_CARD_SIZE,
  };
}

function mergeDirection(
  direction: MergedEdge['direction'] | undefined,
  fromRep: string,
  toRep: string,
  a: string,
  b: string,
  edgeDirection: SododeckFile['edges'][number]['direction'],
): MergedEdge['direction'] {
  if (edgeDirection === 'both' || edgeDirection === 'none') return 'both';
  const next: MergedEdge['direction'] = fromRep === a && toRep === b ? 'a-to-b' : 'b-to-a';
  return direction === undefined || direction === next ? next : 'both';
}

export function scopeOf(drill: readonly DrillFrame[]): Scope {
  let node: string | null = null;
  let group: string | null = null;
  for (let index = drill.length - 1; index >= 0; index--) {
    const frame = drill[index];
    if (frame === undefined) continue;
    if (frame.kind === 'node') {
      node = frame.id;
      break;
    }
    if (group === null) group = frame.id;
  }
  if (node !== null) {
    group = null;
    for (let index = drill.length - 1; index >= 0; index--) {
      const frame = drill[index];
      if (frame?.kind === 'node' && frame.id === node) break;
      if (frame?.kind === 'group') {
        group = frame.id;
        break;
      }
    }
  }
  return { node, group };
}

export function visibleGraph(
  deck: SododeckFile,
  scope: Scope,
  collapsed: ReadonlySet<string>,
): VisibleGraph {
  const cached = graphCacheFor(deck).get(cacheKey(scope, collapsed));
  if (cached !== undefined) return cached;

  const nodesById = new Map(deck.nodes.map((node) => [node.id, node]));
  const groupsById = new Map(deck.groups.map((group) => [group.id, group]));
  const groupParents = effectiveGroupParents(deck);
  const nodeParents = effectiveNodeParents(deck);
  const scopeGroups =
    scope.group === null ? null : subtreeMembers(scope.group, groupsById, groupParents);

  const childCount = new Map<string, number>();
  for (const parent of nodeParents.values()) {
    if (parent === undefined) continue;
    childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
  }

  const members = deck.nodes.filter((node) => {
    const parent = nodeParents.get(node.id);
    if (scope.node === null ? parent !== undefined : parent !== scope.node) return false;
    if (scopeGroups === null) return true;
    return lineage(node.group, groupParents).some((groupId) => scopeGroups.has(groupId));
  });
  const memberIds = new Set(members.map((node) => node.id));

  const visibleGroups = new Set<string>();
  const nodeLineages = new Map<string, string[]>();
  for (const node of members) {
    const line = lineage(node.group, groupParents).filter((groupId) => groupId !== scope.group);
    nodeLineages.set(node.id, line);
    for (const groupId of line) visibleGroups.add(groupId);
  }

  const collapsedVisible = new Set([...visibleGroups].filter((groupId) => collapsed.has(groupId)));
  const representative = new Map<string, string>();
  const hiddenBy = new Map<string, string>();
  const nodeCount = new Map<string, number>();
  const cardsByGroup = new Map<
    string,
    {
      nodeCount: number;
      edgeCount: number;
      hiddenEdges: string[];
      memberKinds: string[];
      rect: Rect;
    }
  >();

  if (collapsedVisible.size > 0) {
    const bounds = groupBounds(deck);
    for (const groupId of collapsedVisible) {
      const rect = bounds.get(groupId);
      if (rect !== undefined)
        cardsByGroup.set(groupId, {
          nodeCount: 0,
          edgeCount: 0,
          hiddenEdges: [],
          memberKinds: [],
          rect: centered(rect),
        });
    }
  }

  for (const node of members) {
    const line = nodeLineages.get(node.id) ?? [];
    for (const groupId of line) {
      if (collapsedVisible.has(groupId)) {
        const card = cardsByGroup.get(groupId);
        if (card !== undefined) {
          card.nodeCount += 1;
          card.memberKinds.push(node.type);
        }
      }
      nodeCount.set(groupId, (nodeCount.get(groupId) ?? 0) + 1);
    }

    const outerCollapsed = [...line].reverse().find((groupId) => collapsedVisible.has(groupId));
    if (outerCollapsed !== undefined) {
      representative.set(node.id, `${COLLAPSED_NODE_PREFIX}${outerCollapsed}`);
    } else {
      representative.set(node.id, node.id);
    }
  }

  for (const groupId of visibleGroups) {
    const line = lineage(groupId, groupParents).filter((id) => id !== scope.group);
    const hidden = [...line].reverse().find((id) => collapsedVisible.has(id));
    if (hidden !== undefined) hiddenBy.set(groupId, `${COLLAPSED_NODE_PREFIX}${hidden}`);
  }

  const plainEdges: string[] = [];
  const mergedAcc = new Map<
    string,
    { a: string; b: string; edgeIds: string[]; direction: MergedEdge['direction'] | undefined }
  >();
  const portsAcc = new Map<
    string,
    { edgeIds: string[]; insideNodeIds: string[]; outsideTitle: string }
  >();

  for (const edge of deck.edges) {
    const fromInside = memberIds.has(edge.from);
    const toInside = memberIds.has(edge.to);
    if (!fromInside && !toInside) continue;

    if (fromInside !== toInside) {
      const outsideNodeId = fromInside ? edge.to : edge.from;
      const outside = nodesById.get(outsideNodeId);
      if (outside === undefined) continue;
      const insideNodeId = fromInside ? edge.from : edge.to;
      const existing = portsAcc.get(outsideNodeId);
      if (existing === undefined) {
        portsAcc.set(outsideNodeId, {
          edgeIds: [edge.id],
          insideNodeIds: [insideNodeId],
          outsideTitle: outside.title,
        });
      } else {
        existing.edgeIds.push(edge.id);
        if (!existing.insideNodeIds.includes(insideNodeId))
          existing.insideNodeIds.push(insideNodeId);
      }
      continue;
    }

    const fromRep = representative.get(edge.from);
    const toRep = representative.get(edge.to);
    if (fromRep === undefined || toRep === undefined) continue;
    if (fromRep === toRep) {
      if (fromRep.startsWith(COLLAPSED_NODE_PREFIX)) {
        const groupId = fromRep.slice(COLLAPSED_NODE_PREFIX.length);
        const card = cardsByGroup.get(groupId);
        if (card !== undefined) {
          card.edgeCount += 1;
          card.hiddenEdges.push(edge.id);
        }
      }
      continue;
    }
    if (!fromRep.startsWith(COLLAPSED_NODE_PREFIX) && !toRep.startsWith(COLLAPSED_NODE_PREFIX)) {
      plainEdges.push(edge.id);
      continue;
    }
    const [a, b] = fromRep < toRep ? [fromRep, toRep] : [toRep, fromRep];
    const key = `${a}|${b}`;
    const existing = mergedAcc.get(key);
    if (existing === undefined) {
      mergedAcc.set(key, {
        a,
        b,
        edgeIds: [edge.id],
        direction: mergeDirection(undefined, fromRep, toRep, a, b, edge.direction),
      });
    } else {
      existing.edgeIds.push(edge.id);
      existing.direction = mergeDirection(existing.direction, fromRep, toRep, a, b, edge.direction);
    }
  }

  const graph: VisibleGraph = {
    scope,
    nodes: members.filter((node) => representative.get(node.id) === node.id).map((node) => node.id),
    groups: deck.groups
      .map((group) => group.id)
      .filter((groupId) => visibleGroups.has(groupId) && !hiddenBy.has(groupId)),
    cards: deck.groups.flatMap((group) => {
      const card = cardsByGroup.get(group.id);
      if (card === undefined || hiddenBy.get(group.id) !== `${COLLAPSED_NODE_PREFIX}${group.id}`)
        return [];
      return [
        {
          groupId: group.id,
          title: group.title,
          nodeCount: card.nodeCount,
          edgeCount: card.edgeCount,
          hiddenEdges: card.hiddenEdges,
          memberKinds: card.memberKinds,
          rect: card.rect,
        },
      ];
    }),
    edges: plainEdges,
    merged: [...mergedAcc.entries()].map(([key, value]) => ({
      id: `${MERGED_EDGE_PREFIX}${key}`,
      a: value.a,
      b: value.b,
      edgeIds: value.edgeIds,
      direction: value.direction ?? 'both',
    })),
    ports: [...portsAcc.entries()].map(([outsideNodeId, value]) => ({
      id: `${PORT_NODE_PREFIX}${outsideNodeId}`,
      outsideNodeId,
      outsideTitle: value.outsideTitle,
      edgeIds: value.edgeIds,
      insideNodeIds: value.insideNodeIds,
    })),
    representative,
    hiddenBy,
    childCount,
  };
  graphCacheFor(deck).set(cacheKey(scope, collapsed), graph);
  return graph;
}

export function scopeBounds(deck: SododeckFile, graph: VisibleGraph, level: Level): Rect | null {
  const groupRects = groupBounds(deck, level);
  let box: Rect | null = null;
  const merge = (rect: Rect | undefined) => {
    if (rect === undefined) return;
    if (box === null) {
      box = rect;
      return;
    }
    const x = Math.min(box.x, rect.x);
    const y = Math.min(box.y, rect.y);
    box = {
      x,
      y,
      width: Math.max(box.x + box.width, rect.x + rect.width) - x,
      height: Math.max(box.y + box.height, rect.y + rect.height) - y,
    };
  };

  for (const groupId of graph.groups) merge(groupRects.get(groupId));
  for (const card of graph.cards) merge(card.rect);
  for (const nodeId of graph.nodes) {
    const index = deck.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) continue;
    const node = deck.nodes[index];
    if (node === undefined) continue;
    merge(cardBox(node, index, level, { fields: cardFieldView(deck, node) }));
  }
  return box;
}

export function validDrillDepth(deck: SododeckFile, drill: readonly DrillFrame[]): number {
  const groups = new Set(deck.groups.map((group) => group.id));
  const nodes = new Set(deck.nodes.map((node) => node.id));
  for (let depth = 1; depth <= drill.length; depth++) {
    const frame = drill[depth - 1];
    if (frame === undefined) return depth - 1;
    if (frame.kind === 'group' ? !groups.has(frame.id) : !nodes.has(frame.id)) return depth - 1;
    const graph = visibleGraph(deck, scopeOf(drill.slice(0, depth)), new Set());
    if (graph.nodes.length === 0 && graph.groups.length === 0 && graph.cards.length === 0)
      return depth - 1;
  }
  return drill.length;
}
