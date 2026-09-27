/**
 * Deck → React Flow view models (003 research R10). Pure and derived on every render from the
 * snapshot; React Flow never owns document state. Results are cached per source object, so an
 * edit to one node returns the same React Flow objects for all the others and `memo` skips them.
 */
import { stickyCanvasPosition, stickyLabel, type StickyPlacement } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import type { Edge, Node } from '@xyflow/react';

import { displayPosition, groupBounds, NODE_SIZE, type Point } from './canvas-geometry';
import { stickyFlowState, type NotesDisplay, type StickyFlowState } from './stickies/sticky-flow';
import type { Selection } from '../state/ui-store';
import type { CollapsedFlowMarks } from './collapse-flow-marks';
import type { FocusSet } from './focus-set';
import {
  EMPTY_OVERLAY,
  type EdgeFlowMark,
  type FlowOverlay,
  type NodeFlowMark,
} from './flows/flow-overlay';
import type { Level } from './levels';
import type { VisibleGraph } from './visible-graph';

type DeckNodeObject = SododeckFile['nodes'][number];
type DeckEdgeObject = SododeckFile['edges'][number];
type StickyObject = SododeckFile['stickies'][number];

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
  subtitle: string | undefined;
  hasRules: boolean;
  level: Level;
  childCount: number;
  dimmed: boolean;
  /** Carries the canvas's single Tab stop (roving tabindex). */
  focused: boolean;
  /** "Step n starts here" while recording a flow (006): a ring and a tag. */
  flowStart?: string;
  /** Flow mode (007): from/to of the current step, a ring and `aria-current="step"`. */
  currentStep?: boolean;
}

export interface GroupBoundaryData extends Record<string, unknown> {
  title: string;
  count: number;
  level: Level;
  focused: boolean;
}

export interface DeckEdgeData extends Record<string, unknown> {
  label: string | undefined;
  protocol: DeckEdgeObject['protocol'];
  direction: NonNullable<DeckEdgeObject['direction']>;
  showLabel: boolean;
  fromTitle: string;
  toTitle: string;
  focused: boolean;
  dimmed: boolean;
  /** Marks of the shown or recorded flow (006): step badges and the flow style. */
  flow?: EdgeFlowMark;
}

export interface CollapsedGroupData extends Record<string, unknown> {
  groupId: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  focused: boolean;
}

export interface PortNodeData extends Record<string, unknown> {
  outsideNodeId: string;
  outsideTitle: string;
}

export interface MergedEdgeData extends Record<string, unknown> {
  count: number;
  direction: 'a-to-b' | 'b-to-a' | 'both';
  edgeIds: readonly string[];
  focused: boolean;
}

export interface StickyNodeData extends Record<string, unknown> {
  stickyId: string;
  text: string;
  label: string;
  color: StickyObject['color'];
  status: StickyPlacement['status'];
  pinnedTo: string | null;
  pinnedToTitle: string | null;
  collapsed: boolean;
  showInFlows: boolean;
  flowState: StickyFlowState;
}

export type DeckFlowNode = Node<DeckNodeData, 'deck'>;
export type GroupFlowNode = Node<GroupBoundaryData, 'group-boundary'>;
export type CollapsedFlowNode = Node<CollapsedGroupData, 'collapsed-group'>;
export type PortFlowNode = Node<PortNodeData, 'port'>;
export type StickyFlowNode = Node<StickyNodeData, 'sticky'>;
export type CanvasFlowNode =
  DeckFlowNode | GroupFlowNode | CollapsedFlowNode | PortFlowNode | StickyFlowNode;
export type DeckFlowEdge = Edge<DeckEdgeData, 'deck'>;
export type MergedFlowEdge = Edge<MergedEdgeData, 'merged'>;
export type StickyLeaderFlowEdge = Edge<Record<string, never>, 'sticky-leader'>;

export { NODE_SIZE };

/** Group boundaries are React Flow nodes too; their ids are prefixed so they never clash. */
export const GROUP_NODE_PREFIX = 'group:';
export const COLLAPSED_NODE_PREFIX = 'collapsed:';
export const PORT_NODE_PREFIX = 'port:';
export const MERGED_EDGE_PREFIX = 'merged:';
export const STICKY_NODE_PREFIX = 'sticky:';
export const STICKY_LEADER_PREFIX = 'sticky-leader:';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const nodeCache = new WeakMap<DeckNodeObject, DeckFlowNode>();
const groupCache = new Map<string, GroupFlowNode>();
const collapsedCache = new Map<string, CollapsedFlowNode>();
const portCache = new Map<string, PortFlowNode>();
const edgeCache = new WeakMap<DeckEdgeObject, DeckFlowEdge>();
const mergedCache = new Map<string, MergedFlowEdge>();
const stickyNodeCache = new WeakMap<StickyObject, StickyFlowNode>();
const stickyLeaderCache = new WeakMap<StickyObject, StickyLeaderFlowEdge>();
/** Last edge list: returned again when every element is the same, so React Flow skips a re-sync. */
let lastEdges: (DeckFlowEdge | MergedFlowEdge)[] = [];

export interface CanvasView {
  selection: Selection;
  focusedId: string | null;
  focusedEdgeId: string | null;
  labelsOn: boolean;
  level: Level;
  focus: FocusSet | null;
  marks: CollapsedFlowMarks;
}

/** Marks are rebuilt with every overlay; equal ones keep the cached React Flow object. */
function sameMark(a: EdgeFlowMark | undefined, b: EdgeFlowMark | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return (
    a.style === b.style &&
    a.errorIcon === b.errorIcon &&
    a.inPath === b.inPath &&
    a.current?.speed === b.current?.speed &&
    a.badges.length === b.badges.length &&
    a.badges.every((x, i) => {
      const y = b.badges[i];
      return (
        y !== undefined &&
        x.label === y.label &&
        x.errorPath === y.errorPath &&
        x.current === y.current &&
        x.chainBreak === y.chainBreak
      );
    })
  );
}

function toFlowNode(
  node: DeckNodeObject,
  position: Point,
  view: CanvasView,
  childCount: number,
  mark: NodeFlowMark | undefined,
): DeckFlowNode {
  const cached = nodeCache.get(node);
  const flowStart = mark?.startsHere;
  const currentStep = mark?.currentStep === true;
  const inFlow = mark?.inPath === true;
  const selected = view.selection.nodes.includes(node.id);
  const focused = node.id === view.focusedId;
  const dimmed = view.focus !== null && !view.focus.members.has(node.id);
  if (
    cached?.selected === selected &&
    cached.data.focused === focused &&
    cached.data.level === view.level &&
    cached.data.childCount === childCount &&
    cached.data.dimmed === dimmed &&
    cached.data.flowStart === flowStart &&
    (cached.data.currentStep === true) === currentStep &&
    (cached.className === 'in-flow') === inFlow &&
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
    ...(inFlow ? { className: 'in-flow' } : {}),
    data: {
      title: node.title,
      kind: node.type,
      subtitle: node.tech,
      hasRules: (node.rules?.length ?? 0) > 0,
      level: view.level,
      childCount,
      dimmed,
      focused,
      ...(flowStart === undefined ? {} : { flowStart }),
      ...(currentStep ? { currentStep } : {}),
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

function groupNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  level: Level,
  view: CanvasView,
): GroupFlowNode[] {
  if (deck.groups.length === 0) return [];
  const bounds = groupBounds(deck);
  const counts = groupCounts(deck);
  return graph.groups.flatMap((groupId) => {
    const group = deck.groups.find((entry) => entry.id === groupId);
    const rect = bounds.get(groupId);
    if (group === undefined) return [];
    if (!rect) return [];
    const id = GROUP_NODE_PREFIX + groupId;
    const count = counts.get(groupId) ?? 0;
    const focused = view.focusedId === id;
    const cached = groupCache.get(id);
    if (
      cached?.data.title === group.title &&
      cached.data.count === count &&
      cached.data.level === level &&
      cached.data.focused === focused &&
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
      data: { title: group.title, count, level, focused },
    };
    groupCache.set(id, flowNode);
    return [flowNode];
  });
}

function collapsedNodes(view: CanvasView, graph: VisibleGraph): CollapsedFlowNode[] {
  return graph.cards.map((card) => {
    const id = `${COLLAPSED_NODE_PREFIX}${card.groupId}`;
    const focused = view.focusedId === id;
    const selected = view.selection.groups.includes(card.groupId);
    const cached = collapsedCache.get(id);
    if (
      cached?.selected === selected &&
      cached.data.focused === focused &&
      cached.position.x === card.rect.x &&
      cached.position.y === card.rect.y &&
      cached.width === card.rect.width &&
      cached.height === card.rect.height &&
      cached.data.title === card.title &&
      cached.data.nodeCount === card.nodeCount &&
      cached.data.edgeCount === card.edgeCount
    ) {
      return cached;
    }
    const flowNode: CollapsedFlowNode = {
      id,
      type: 'collapsed-group',
      position: { x: card.rect.x, y: card.rect.y },
      width: card.rect.width,
      height: card.rect.height,
      selected,
      data: {
        groupId: card.groupId,
        title: card.title,
        nodeCount: card.nodeCount,
        edgeCount: card.edgeCount,
        focused,
      },
    };
    collapsedCache.set(id, flowNode);
    return flowNode;
  });
}

function portNodes(deck: SododeckFile, graph: VisibleGraph): PortFlowNode[] {
  const positions = new Map(
    deck.nodes.map((node, index) => [node.id, displayPosition(node, index)]),
  );
  return graph.ports.flatMap((port) => {
    const anchors = port.insideNodeIds
      .map((nodeId) => positions.get(nodeId))
      .filter((point): point is Point => point !== undefined);
    if (anchors.length === 0) return [];
    const x =
      anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length + NODE_SIZE.width + 32;
    const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length;
    const cached = portCache.get(port.id);
    if (
      cached?.position.x === x &&
      cached.position.y === y &&
      cached.data.outsideNodeId === port.outsideNodeId &&
      cached.data.outsideTitle === port.outsideTitle
    ) {
      return [cached];
    }
    const flowNode: PortFlowNode = {
      id: port.id,
      type: 'port',
      position: { x, y },
      width: 120,
      height: 36,
      selectable: false,
      data: {
        outsideNodeId: port.outsideNodeId,
        outsideTitle: port.outsideTitle,
      },
    };
    portCache.set(port.id, flowNode);
    return [flowNode];
  });
}

/** Group boundaries first (drawn below), then components. */
export function toFlowNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
  overlay: FlowOverlay = EMPTY_OVERLAY,
): CanvasFlowNode[] {
  const components = graph.nodes.flatMap((nodeId) => {
    const index = deck.nodes.findIndex((node) => node.id === nodeId);
    const node = index < 0 ? undefined : deck.nodes[index];
    if (node === undefined) return [];
    return [
      toFlowNode(
        node,
        displayPosition(node, index),
        view,
        graph.childCount.get(node.id) ?? 0,
        overlay.nodes.get(node.id),
      ),
    ];
  });
  return [
    ...groupNodes(deck, graph, view.level, view),
    ...collapsedNodes(view, graph),
    ...portNodes(deck, graph),
    ...components,
  ];
}

export function toStickyNodes(
  deck: SododeckFile,
  selection: Selection,
  overlay: FlowOverlay = EMPTY_OVERLAY,
  flow: {
    flowMode: boolean;
    notesDisplay: NotesDisplay;
    emptyFlow: boolean;
    brokenCurrentStep: boolean;
  } = {
    flowMode: false,
    notesDisplay: 'dimmed',
    emptyFlow: false,
    brokenCurrentStep: false,
  },
): StickyFlowNode[] {
  const selected = new Set(selection.stickies);
  const titles = new Map(deck.nodes.map((node) => [node.id, node.title]));
  return deck.stickies.map((sticky) => {
    const placement = stickyCanvasPosition(deck, sticky);
    const pinnedTo = placement.status === 'pinned' ? placement.pinnedTo : null;
    const pinnedToTitle = pinnedTo === null ? null : (titles.get(pinnedTo) ?? null);
    const label = stickyLabel(sticky.text) ?? 'Empty note';
    const collapsed = sticky.collapsed === true;
    const showInFlows = sticky.showInFlows === true;
    const flowState = stickyFlowState(sticky, placement, {
      flowMode: flow.flowMode,
      display: flow.notesDisplay,
      currentStepNodes: overlay.nodes,
      emptyFlow: flow.emptyFlow,
      brokenCurrentStep: flow.brokenCurrentStep,
    });
    const hidden = flowState === 'hidden';
    const draggable = !flow.flowMode;
    const className = hidden
      ? undefined
      : flowState === 'dimmed'
        ? 'sd-note-dimmed'
        : flow.flowMode
          ? 'in-flow sd-note-shown'
          : undefined;
    const cached = stickyNodeCache.get(sticky);
    if (
      cached?.selected === selected.has(sticky.id) &&
      cached.position.x === placement.point.x &&
      cached.position.y === placement.point.y &&
      cached.data.label === label &&
      cached.data.text === sticky.text &&
      cached.data.color === sticky.color &&
      cached.data.status === placement.status &&
      cached.data.pinnedTo === pinnedTo &&
      cached.data.pinnedToTitle === pinnedToTitle &&
      cached.data.collapsed === collapsed &&
      cached.data.showInFlows === showInFlows &&
      cached.data.flowState === flowState &&
      cached.className === className &&
      Boolean(cached.hidden) === hidden &&
      cached.draggable === draggable
    ) {
      return cached;
    }
    const flowNode: StickyFlowNode = {
      id: `${STICKY_NODE_PREFIX}${sticky.id}`,
      type: 'sticky',
      position: placement.point,
      width: 180,
      zIndex: 1,
      ...(className === undefined ? {} : { className }),
      ...(hidden ? { hidden: true } : {}),
      draggable,
      selected: selected.has(sticky.id),
      data: {
        stickyId: sticky.id,
        text: sticky.text,
        label,
        color: sticky.color,
        status: placement.status,
        pinnedTo,
        pinnedToTitle,
        collapsed,
        showInFlows,
        flowState,
      },
    };
    stickyNodeCache.set(sticky, flowNode);
    return flowNode;
  });
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
function representativeTitles(deck: SododeckFile, graph: VisibleGraph): Map<string, string> {
  const titles = new Map(deck.nodes.map((node) => [node.id, node.title]));
  for (const card of graph.cards) titles.set(`${COLLAPSED_NODE_PREFIX}${card.groupId}`, card.title);
  for (const port of graph.ports) titles.set(port.id, port.outsideTitle);
  return titles;
}

export function toFlowEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
  overlay: FlowOverlay = EMPTY_OVERLAY,
): (DeckFlowEdge | MergedFlowEdge)[] {
  const ports = portNodes(deck, graph);
  const nodes = new Map<string, { position: Point; title: string }>(
    deck.nodes.map((node, index) => [
      node.id,
      { position: displayPosition(node, index), title: node.title },
    ]),
  );
  for (const card of graph.cards) {
    nodes.set(`${COLLAPSED_NODE_PREFIX}${card.groupId}`, {
      position: { x: card.rect.x, y: card.rect.y },
      title: card.title,
    });
  }
  for (const port of ports) {
    nodes.set(port.id, { position: port.position, title: port.data.outsideTitle });
  }
  const titles = representativeTitles(deck, graph);
  const selected = new Set(view.selection.edges);
  const plainEdges = graph.edges.flatMap((edgeId) => {
    const edge = deck.edges.find((entry) => entry.id === edgeId);
    if (edge === undefined) return [];
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    // The schema does not check references; a file may still point at missing nodes.
    if (!from || !to) return [];
    const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
    const isSelected = selected.has(edge.id);
    const focused = edge.id === view.focusedEdgeId;
    const dimmed = view.focus !== null && !view.focus.edges.has(edge.id);
    const showLabel =
      (view.labelsOn && edge.label !== undefined && edge.label !== '') ||
      view.focus?.edges.has(edge.id) === true;
    const mark = overlay.edges.get(edge.id);
    const cached = edgeCache.get(edge);
    if (
      cached?.selected === isSelected &&
      sameMark(cached.data?.flow, mark) &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      cached.data?.showLabel === showLabel &&
      cached.data.focused === focused &&
      cached.data.dimmed === dimmed &&
      cached.data.fromTitle === from.title &&
      cached.data.toTitle === to.title
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
      ...(mark?.inPath === true ? { className: 'in-flow' } : {}),
      interactionWidth: 12,
      ariaLabel: edgeName(from.title, to.title, edge.label),
      data: {
        label: edge.label,
        protocol: edge.protocol,
        direction: edge.direction ?? 'forward',
        showLabel,
        fromTitle: from.title,
        toTitle: to.title,
        focused,
        dimmed,
        ...(mark === undefined ? {} : { flow: mark }),
      },
    };
    edgeCache.set(edge, flowEdge);
    return [flowEdge];
  });
  const portEdges = graph.ports.flatMap((port) =>
    port.edgeIds.flatMap((edgeId) => {
      const edge = deck.edges.find((entry) => entry.id === edgeId);
      if (edge === undefined) return [];
      const insideNodeId = port.insideNodeIds.find(
        (nodeId) => edge.from === nodeId || edge.to === nodeId,
      );
      if (insideNodeId === undefined) return [];
      const representative = graph.representative.get(insideNodeId) ?? insideNodeId;
      const fromId = edge.from === insideNodeId ? representative : port.id;
      const toId = edge.to === insideNodeId ? representative : port.id;
      const from = nodes.get(fromId);
      const to = nodes.get(toId);
      if (from === undefined || to === undefined) return [];
      const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
      const isSelected = selected.has(edge.id);
      const focused = edge.id === view.focusedEdgeId;
      const dimmed = view.focus !== null && !view.focus.edges.has(edge.id);
      const showLabel =
        (view.labelsOn && edge.label !== undefined && edge.label !== '') ||
        view.focus?.edges.has(edge.id) === true;
      const mark = overlay.edges.get(edge.id);
      const cached = edgeCache.get(edge);
      if (
        cached?.selected === isSelected &&
        sameMark(cached.data?.flow, mark) &&
        cached.source === fromId &&
        cached.target === toId &&
        cached.sourceHandle === sourceHandle &&
        cached.targetHandle === targetHandle &&
        cached.data?.showLabel === showLabel &&
        cached.data.focused === focused &&
        cached.data.dimmed === dimmed &&
        cached.data.fromTitle === from.title &&
        cached.data.toTitle === to.title
      ) {
        return [cached];
      }
      const flowEdge: DeckFlowEdge = {
        id: edge.id,
        type: 'deck',
        source: fromId,
        target: toId,
        sourceHandle,
        targetHandle,
        selected: isSelected,
        ...(mark?.inPath === true ? { className: 'in-flow' } : {}),
        interactionWidth: 12,
        ariaLabel: edgeName(from.title, to.title, edge.label),
        data: {
          label: edge.label,
          protocol: edge.protocol,
          direction: edge.direction ?? 'forward',
          showLabel,
          fromTitle: from.title,
          toTitle: to.title,
          focused,
          dimmed,
          ...(mark === undefined ? {} : { flow: mark }),
        },
      };
      edgeCache.set(edge, flowEdge);
      return [flowEdge];
    }),
  );
  const mergedEdges = graph.merged.flatMap((edge) => {
    const from = nodes.get(edge.a);
    const to = nodes.get(edge.b);
    if (from === undefined || to === undefined) return [];
    const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
    const focused = edge.id === view.focusedEdgeId;
    const cached = mergedCache.get(edge.id);
    if (
      cached !== undefined &&
      cached.data !== undefined &&
      cached.data.count === edge.edgeIds.length &&
      cached.data.direction === edge.direction &&
      cached.data.focused === focused &&
      cached.source === edge.a &&
      cached.target === edge.b &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      cached.data.edgeIds.length === edge.edgeIds.length &&
      cached.data.edgeIds.every((edgeId, index) => edgeId === edge.edgeIds[index])
    ) {
      return [cached];
    }
    const flowEdge: MergedFlowEdge = {
      id: edge.id,
      type: 'merged',
      source: edge.a,
      target: edge.b,
      sourceHandle,
      targetHandle,
      interactionWidth: 12,
      ariaLabel: `${String(edge.edgeIds.length)} connections between ${titles.get(edge.a) ?? edge.a} and ${titles.get(edge.b) ?? edge.b}`,
      data: {
        count: edge.edgeIds.length,
        direction: edge.direction,
        edgeIds: edge.edgeIds,
        focused,
      },
    };
    mergedCache.set(edge.id, flowEdge);
    return [flowEdge];
  });
  const next = [...plainEdges, ...portEdges, ...mergedEdges];
  // A drag moves nodes, rarely edges: keep the array identity when nothing in it changed.
  if (next.length === lastEdges.length && next.every((e, i) => e === lastEdges[i]))
    return lastEdges;
  lastEdges = next;
  return next;
}

export function toLeaderEdges(deck: SododeckFile): StickyLeaderFlowEdge[] {
  return deck.stickies.flatMap((sticky) => {
    const placement = stickyCanvasPosition(deck, sticky);
    if (placement.status !== 'pinned') return [];
    const cached = stickyLeaderCache.get(sticky);
    if (
      cached?.source === placement.pinnedTo &&
      cached.target === `${STICKY_NODE_PREFIX}${sticky.id}`
    ) {
      return [cached];
    }
    const leader: StickyLeaderFlowEdge = {
      id: `${STICKY_LEADER_PREFIX}${sticky.id}`,
      type: 'sticky-leader',
      source: placement.pinnedTo,
      target: `${STICKY_NODE_PREFIX}${sticky.id}`,
      selectable: false,
      focusable: false,
    };
    stickyLeaderCache.set(sticky, leader);
    return [leader];
  });
}
