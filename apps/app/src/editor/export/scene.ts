import { analyzeFlow, stickyCanvasPosition, stickyLabel } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { toComponentKind, type ComponentKind } from '@sododeck/ui/lib/icons';

import type { DrillFrame } from '../../state/ui-store';
import { displayPosition, groupBounds, nodeSize, type Rect } from '../canvas-geometry';
import { collapseFlowMarks } from '../collapse-flow-marks';
import { COLLAPSED_NODE_PREFIX, exportPortRects, groupCounts } from '../deck-to-flow';
import { flowOverlay, type EdgeFlowMark, type FlowOverlay } from '../flows/flow-overlay';
import { effectiveLevel, type Level } from '../levels';
import { stickyFlowState, type NotesDisplay } from '../stickies/sticky-flow';
import { scopeOf, visibleGraph, type VisibleGraph } from '../visible-graph';
import { subtitleOf, viewStateOf } from '../views/view-state';
import { edgePath } from './edge-geometry';
import { exportLook, type ExportLook } from './export-palette';
import type { ImageScope } from './types';

export const EXPORT_MARGIN = 32;
/** A sticky note in its one-line form (the canvas's collapsed note). */
export const STICKY_SIZE = { width: 180, height: 40 } as const;

type Direction = SododeckFile['edges'][number]['direction'];

export interface SceneCard {
  id: string;
  rect: Rect;
  kind: ComponentKind | 'fallback';
  title: string;
  subtitle: string | null;
  hasRules: boolean;
  childCount: number;
  level: Level;
  fill?: string;
  stroke?: string;
  text: 'default' | 'dark' | 'light';
}
export interface SceneGroup {
  id: string;
  rect: Rect;
  label: string;
  count: number;
  fill?: string;
  stroke?: string;
  text: 'default' | 'dark' | 'light';
}
export interface SceneCollapsed {
  id: string;
  rect: Rect;
  title: string;
  nodeCount: number;
  edgeCount: number;
  fill?: string;
  stroke?: string;
  text: 'default' | 'dark' | 'light';
}
export interface ScenePort {
  id: string;
  rect: Rect;
  label: string;
}
export interface SceneBadge {
  label: string;
  errorPath: boolean;
}
export interface SceneEdge {
  id: string;
  path: string;
  /** Start and end of the path (the handle points), for the direction dots. */
  source: { x: number; y: number };
  target: { x: number; y: number };
  extent: Rect;
  labelPoint: { x: number; y: number };
  dots: 'target' | 'both' | 'none';
  stroke: 'default' | 'flow' | 'flow-error';
  label: string | null;
  badges: SceneBadge[];
}
export interface SceneSticky {
  id: string;
  rect: Rect;
  tint: SododeckFile['stickies'][number]['color'];
  label: string;
}
export interface ExportScene {
  bounds: Rect;
  groups: SceneGroup[];
  collapsed: SceneCollapsed[];
  ports: ScenePort[];
  cards: SceneCard[];
  edges: SceneEdge[];
  stickies: SceneSticky[];
}
export interface SceneInput {
  deck: SododeckFile;
  scope: ImageScope;
  ui: {
    currentViewId: string | null;
    revealed: ReadonlySet<string>;
    drill: readonly DrillFrame[];
    activeFlowId: string | null;
    notesDisplay: NotesDisplay;
  };
}

const EMPTY_BOUNDS: Rect = { x: 0, y: 0, width: 0, height: 0 };
const EMPTY_LOOK: ExportLook = { text: 'default' };

/** Estimated label pill width; the renderer measures the real one (R6). */
function labelPill(edge: SceneEdge): Rect | null {
  if (edge.label === null && edge.badges.length === 0) return null;
  const width = (edge.label?.length ?? 0) * 6.3 + edge.badges.length * 20 + 16;
  return { x: edge.labelPoint.x - width / 2, y: edge.labelPoint.y - 10, width, height: 20 };
}

function union(a: Rect | null, b: Rect): Rect {
  if (a === null) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function strokeOf(marks: readonly EdgeFlowMark[]): SceneEdge['stroke'] {
  if (marks.length === 0) return 'default';
  return marks.every((mark) => mark.style === 'error') ? 'flow-error' : 'flow';
}

function dotsOf(direction: Direction): SceneEdge['dots'] {
  if (direction === 'both') return 'both';
  return direction === 'none' ? 'none' : 'target';
}

/** Canvas ids (cards, `collapsed:<group>`, ports) that a flow travels through. */
function flowMembers(deck: SododeckFile, graph: VisibleGraph, overlay: FlowOverlay): Set<string> {
  const ids = new Set<string>();
  const edges = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const ports = new Map(graph.ports.map((port) => [port.outsideNodeId, port.id]));
  for (const edgeId of overlay.edges.keys()) {
    const edge = edges.get(edgeId);
    if (edge === undefined) continue;
    for (const end of [edge.from, edge.to]) {
      const drawnAs = graph.representative.get(end) ?? ports.get(end);
      if (drawnAs !== undefined) ids.add(drawnAs);
    }
  }
  return ids;
}

/**
 * The picture an export draws, as positioned shapes in diagram coordinates (012 R1, R2). Pure:
 * it reuses the canvas's view, scope and flow helpers, never `toFlowNodes` / `toFlowEdges`
 * (their single-slot caches belong to React Flow).
 *
 * - `deck`: the raw deck at the top level with every group expanded.
 * - `view`: what the current view shows at the current drill level, over its whole extent.
 * - `flow`: the current view reduced to the shown flow's objects, with step badges.
 */
export function buildScene({ deck, scope, ui }: SceneInput): ExportScene {
  const view = scope === 'deck' ? null : viewStateOf(deck, ui.currentViewId, ui.revealed);
  const source = view?.deck ?? deck;
  const graph = visibleGraph(
    source,
    scopeOf(view === null ? [] : ui.drill),
    view?.collapsed ?? new Set(),
  );
  const level = effectiveLevel('container', graph.scope);
  const size = nodeSize(level); // TODO(017): use the card's own node.size when it exists.
  const flow =
    scope === 'flow' ? source.flows.find((entry) => entry.id === ui.activeFlowId) : undefined;
  if (scope === 'flow' && (flow === undefined || flow.steps.length === 0)) {
    return emptyScene();
  }
  const overlay =
    flow === undefined ? null : flowOverlay(source, analyzeFlow(flow, source.edges), null, null);
  const inFlow = overlay === null ? null : flowMembers(source, graph, overlay);
  const hiddenMarks = overlay === null ? null : collapseFlowMarks(overlay, graph).cards;
  const keep = (id: string) => inFlow === null || inFlow.has(id);

  const nodes = new Map(source.nodes.map((node, index) => [node.id, { node, index }]));
  const cards: SceneCard[] = graph.nodes.flatMap((id) => {
    const entry = nodes.get(id);
    if (entry === undefined || !keep(id)) return [];
    const { node, index } = entry;
    return [
      {
        id,
        rect: { ...displayPosition(node, index), ...size },
        kind: toComponentKind(node.type) ?? 'fallback',
        title: node.title,
        subtitle: (view === null ? node.tech : subtitleOf(node, view.render)) ?? null,
        hasRules: (node.rules?.length ?? 0) > 0,
        childCount: graph.childCount.get(id) ?? 0,
        level,
        ...(exportLook(node.style) ?? EMPTY_LOOK),
      },
    ];
  });
  const groupsById = new Map(source.groups.map((group) => [group.id, group]));
  const collapsed: SceneCollapsed[] = graph.cards
    .filter(
      (card) =>
        keep(`${COLLAPSED_NODE_PREFIX}${card.groupId}`) || hiddenMarks?.has(card.groupId) === true,
    )
    .map((card) => ({
      id: card.groupId,
      rect: card.rect,
      title: card.title,
      nodeCount: card.nodeCount,
      edgeCount: card.edgeCount,
      ...(exportLook(groupsById.get(card.groupId)?.style) ?? EMPTY_LOOK),
    }));
  const ports: ScenePort[] = exportPortRects(source, graph).filter((port) => keep(port.id));

  const rects = new Map<string, Rect>([
    ...cards.map((card) => [card.id, card.rect] as const),
    ...collapsed.map((card) => [`${COLLAPSED_NODE_PREFIX}${card.id}`, card.rect] as const),
    ...ports.map((port) => [port.id, port.rect] as const),
  ]);

  const groups = sceneGroups(source, graph, size, cards, inFlow !== null);
  const edges = sceneEdges(source, graph, rects, overlay);

  // Notes as the canvas draws them: free notes and notes on non-components (edges, flows,
  // steps) at their own point, notes pinned to a component only when that card is drawn. The
  // flow scope keeps notes on its kept cards or on the flow and its steps.
  const flowIds = new Set(
    flow === undefined ? [] : [flow.id, ...flow.steps.map((step) => step.id)],
  );
  const stickies: SceneSticky[] = source.stickies.flatMap((sticky) => {
    const placement = stickyCanvasPosition(source, sticky);
    if (placement.status === 'pinned' && !rects.has(placement.pinnedTo)) return [];
    if (inFlow !== null) {
      const onFlow =
        placement.status === 'pinned' ||
        (placement.status === 'foreign' && flowIds.has(placement.anchor));
      const state = stickyFlowState(sticky, placement, {
        flowMode: true,
        display: ui.notesDisplay,
        currentStepNodes: new Map(),
        emptyFlow: false,
        brokenCurrentStep: false,
      });
      if (!onFlow || state === 'hidden') return [];
    }
    return [
      {
        id: sticky.id,
        rect: { ...placement.point, ...STICKY_SIZE },
        tint: sticky.color,
        label: stickyLabel(sticky.text) ?? 'Empty note',
      },
    ];
  });

  if (cards.length + collapsed.length + ports.length === 0) return emptyScene();
  let extent: Rect | null = null;
  for (const item of [...groups, ...collapsed, ...ports, ...cards, ...stickies]) {
    extent = union(extent, item.rect);
  }
  for (const edge of edges) {
    extent = union(extent, edge.extent);
    const pill = labelPill(edge);
    if (pill !== null) extent = union(extent, pill);
  }
  const box = extent ?? EMPTY_BOUNDS;
  return {
    bounds: {
      x: box.x - EXPORT_MARGIN,
      y: box.y - EXPORT_MARGIN,
      width: box.width + EXPORT_MARGIN * 2,
      height: box.height + EXPORT_MARGIN * 2,
    },
    groups,
    collapsed,
    ports,
    cards,
    edges,
    stickies,
  };
}

function emptyScene(): ExportScene {
  return {
    bounds: EMPTY_BOUNDS,
    groups: [],
    collapsed: [],
    ports: [],
    cards: [],
    edges: [],
    stickies: [],
  };
}

function sceneGroups(
  deck: SododeckFile,
  graph: VisibleGraph,
  size: { width: number; height: number },
  cards: readonly SceneCard[],
  flowOnly: boolean,
): SceneGroup[] {
  const frames = groupBounds(deck, size);
  const counts = groupCounts(deck);
  const byId = new Map(deck.groups.map((group) => [group.id, group]));
  const nodeGroup = new Map(deck.nodes.map((node) => [node.id, node.group]));
  // Flow scope: only the frames around a kept card (and their ancestors).
  const withCard = new Set<string>();
  for (const card of cards) {
    let group = nodeGroup.get(card.id);
    while (group !== undefined && !withCard.has(group)) {
      withCard.add(group);
      group = byId.get(group)?.parent;
    }
  }
  return graph.groups.flatMap((id) => {
    const rect = frames.get(id);
    const group = byId.get(id);
    if (rect === undefined || group === undefined || (flowOnly && !withCard.has(id))) return [];
    return [
      {
        id,
        rect,
        label: group.title,
        count: counts.get(id) ?? 0,
        ...(exportLook(group.style) ?? EMPTY_LOOK),
      },
    ];
  });
}

function sceneEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  rects: ReadonlyMap<string, Rect>,
  overlay: FlowOverlay | null,
): SceneEdge[] {
  const byId = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const edges: SceneEdge[] = [];
  const add = (
    id: string,
    from: string,
    to: string,
    label: string | null,
    dots: SceneEdge['dots'],
    memberIds: readonly string[],
  ) => {
    const a = rects.get(from);
    const b = rects.get(to);
    if (a === undefined || b === undefined) return;
    const marks = memberIds.flatMap((memberId) => overlay?.edges.get(memberId) ?? []);
    if (overlay !== null && marks.length === 0) return;
    const geometry = edgePath(a, b);
    edges.push({
      id,
      path: geometry.path,
      source: geometry.source,
      target: geometry.target,
      extent: geometry.extent,
      labelPoint: { x: geometry.labelX, y: geometry.labelY },
      dots,
      stroke: strokeOf(marks),
      label,
      badges: marks.flatMap((mark) =>
        mark.badges.map((badge) => ({ label: badge.label, errorPath: badge.errorPath })),
      ),
    });
  };
  for (const id of graph.edges) {
    const edge = byId.get(id);
    if (edge === undefined) continue;
    add(id, edge.from, edge.to, edge.label || null, dotsOf(edge.direction), [id]);
  }
  // Edges that leave a drilled scope end at the outside component's port pill, as on the canvas.
  for (const port of graph.ports) {
    for (const edgeId of port.edgeIds) {
      const edge = byId.get(edgeId);
      const inside = port.insideNodeIds.find((id) => id === edge?.from || id === edge?.to);
      if (edge === undefined || inside === undefined) continue;
      const representative = graph.representative.get(inside) ?? inside;
      const from = edge.from === inside ? representative : port.id;
      const to = edge.to === inside ? representative : port.id;
      add(edge.id, from, to, edge.label || null, dotsOf(edge.direction), [edge.id]);
    }
  }
  // A merged edge (to a collapsed group) shows its count, like the canvas's "×n" pill.
  for (const merged of graph.merged) {
    const [from, to] = merged.direction === 'b-to-a' ? [merged.b, merged.a] : [merged.a, merged.b];
    add(merged.id, from, to, `×${String(merged.edgeIds.length)}`, 'none', merged.edgeIds);
  }
  return edges;
}
