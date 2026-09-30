/**
 * Deck → React Flow view models (003 research R10). Pure and derived on every render from the
 * snapshot; React Flow never owns document state. Results are cached per source object, so an
 * edit to one node returns the same React Flow objects for all the others and `memo` skips them.
 */
import { stickyCanvasPosition, stickyLabel, type StickyPlacement } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import type { Edge, Node } from '@xyflow/react';

import {
  displayPosition,
  groupBounds,
  NODE_SIZE,
  nodeSize as sizeForLevel,
  type Point,
} from './canvas-geometry';
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
import { sameProblemMark, type ProblemMark, type ProblemMarks } from './problems/problem-marks';
import type { VisibleGraph } from './visible-graph';
import { subtitleOf, type ViewRender } from './views/view-state';

type DeckNodeObject = SododeckFile['nodes'][number];
type DeckEdgeObject = SododeckFile['edges'][number];
type StickyObject = SododeckFile['stickies'][number];

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
  subtitle: string | undefined;
  owner: string | undefined;
  tags: readonly string[];
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
  /** Dimmed by the view's settings (011 FR-013): reduced opacity, still interactive. */
  viewDimmed?: boolean;
  /** Pinned in the current view (011 FR-023): a pin glyph; Tidy layout leaves it in place. */
  pinned?: boolean;
  /** Created here while the view hides it (011): shown until the view is left, with a note. */
  hiddenInView?: boolean;
  /** The component's problems (015): an amber glyph and a count in its accessible name. */
  problems?: ProblemMark;
}

export interface GroupBoundaryData extends Record<string, unknown> {
  title: string;
  count: number;
  level: Level;
  focused: boolean;
  /**
   * Selected (016): shows the resize handles. Not React Flow's `selected`, which would raise the
   * frame above its members (`elevateNodesOnSelect`).
   */
  selected?: boolean;
}

export interface DeckEdgeData extends Record<string, unknown> {
  label: string | undefined;
  protocol: DeckEdgeObject['protocol'];
  direction: NonNullable<DeckEdgeObject['direction']>;
  showLabel: boolean;
  fromTitle: string;
  toTitle: string;
  focused: boolean;
  inFocus: boolean;
  dimmed: boolean;
  /** Marks of the shown or recorded flow (006): step badges and the flow style. */
  flow?: EdgeFlowMark;
  /** The connection's problems (015): an amber glyph on its label pill. */
  problems?: ProblemMark;
}

export interface CollapsedGroupData extends Record<string, unknown> {
  groupId: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  focused: boolean;
  dimmed: boolean;
  flowInside?: 'current' | 'path';
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
  inFocus: boolean;
  flow?: EdgeFlowMark;
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
/** What a group frame is dragged by: its label and an 8 px edge band (016 R5). */
export const GROUP_HANDLE_CLASS = 'sd-group-handle';
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
let lastNodes: CanvasFlowNode[] = [];
/** Last edge list: returned again when every element is the same, so React Flow skips a re-sync. */
let lastEdges: (DeckFlowEdge | MergedFlowEdge)[] = [];
const groupCountCache = new WeakMap<
  ReadonlyArray<DeckNodeObject>,
  WeakMap<ReadonlyArray<SododeckFile['groups'][number]>, Map<string, number>>
>();

interface DeckLookups {
  nodesById: ReadonlyMap<string, DeckNodeObject>;
  nodeIndexById: ReadonlyMap<string, number>;
  nodePositionById: ReadonlyMap<string, Point>;
  nodeTitleById: ReadonlyMap<string, string>;
  edgeNodeViews: ReadonlyMap<string, { position: Point; title: string }>;
  edgesById: ReadonlyMap<string, DeckEdgeObject>;
}

const deckLookupCache = new WeakMap<
  ReadonlyArray<DeckNodeObject>,
  WeakMap<ReadonlyArray<DeckEdgeObject>, DeckLookups>
>();

const groupLookupCache = new WeakMap<
  SododeckFile['groups'],
  ReadonlyMap<string, SododeckFile['groups'][number]>
>();

/**
 * Groups by id, keyed by the groups array itself: a rename or a frame edit changes only
 * `deck.groups` (016), so it must not hide behind the node / edge lookups.
 */
function groupLookup(
  groups: SododeckFile['groups'],
): ReadonlyMap<string, SododeckFile['groups'][number]> {
  let lookup = groupLookupCache.get(groups);
  if (lookup === undefined) {
    lookup = new Map(groups.map((group) => [group.id, group]));
    groupLookupCache.set(groups, lookup);
  }
  return lookup;
}

function deckLookups(deck: SododeckFile): DeckLookups {
  let byEdges = deckLookupCache.get(deck.nodes);
  if (byEdges === undefined) {
    byEdges = new WeakMap();
    deckLookupCache.set(deck.nodes, byEdges);
  }
  const cached = byEdges.get(deck.edges);
  if (cached !== undefined) return cached;

  const nodesById = new Map<string, DeckNodeObject>();
  const nodeIndexById = new Map<string, number>();
  const nodePositionById = new Map<string, Point>();
  const nodeTitleById = new Map<string, string>();
  const edgeNodeViews = new Map<string, { position: Point; title: string }>();
  deck.nodes.forEach((node, index) => {
    const position = displayPosition(node, index);
    nodesById.set(node.id, node);
    nodeIndexById.set(node.id, index);
    nodePositionById.set(node.id, position);
    nodeTitleById.set(node.id, node.title);
    edgeNodeViews.set(node.id, { position, title: node.title });
  });
  const edgesById = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const lookups = {
    nodesById,
    nodeIndexById,
    nodePositionById,
    nodeTitleById,
    edgeNodeViews,
    edgesById,
  };
  byEdges.set(deck.edges, lookups);
  return lookups;
}

function sameClassName(actual: string | undefined, expected: string): boolean {
  return (actual ?? '') === expected;
}

export interface CanvasView {
  selection: Selection;
  focusedId: string | null;
  focusedEdgeId: string | null;
  labelsOn: boolean;
  level: Level;
  focus: FocusSet | null;
  marks: CollapsedFlowMarks;
  /** The current view's subtitles, dimming, pins and notes (011); none = System defaults. */
  render?: ViewRender;
  /** Problems by component / connection id (015); none = no glyphs. */
  problems?: ProblemMarks;
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
  const inFocus = view.focus?.members.has(node.id) === true;
  const selected = view.selection.nodes.includes(node.id);
  const focused = node.id === view.focusedId;
  const dimmed = view.focus !== null && !view.focus.members.has(node.id);
  const render = view.render;
  const subtitle = render === undefined ? node.tech : subtitleOf(node, render);
  const viewDimmed = render?.dimmed.has(node.id) === true;
  const pinned = render?.pinned.has(node.id) === true;
  const hiddenInView = render?.revealedHidden.has(node.id) === true;
  const problems = view.problems?.get(node.id);
  const className = [
    inFlow ? 'in-flow' : null,
    inFocus ? 'in-focus' : null,
    viewDimmed ? 'view-dimmed' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const size = sizeForLevel(view.level);
  if (
    cached?.selected === selected &&
    cached.data.subtitle === subtitle &&
    (cached.data.viewDimmed === true) === viewDimmed &&
    (cached.data.pinned === true) === pinned &&
    (cached.data.hiddenInView === true) === hiddenInView &&
    sameProblemMark(cached.data.problems, problems) &&
    cached.data.focused === focused &&
    cached.data.level === view.level &&
    cached.data.childCount === childCount &&
    cached.data.dimmed === dimmed &&
    cached.data.flowStart === flowStart &&
    (cached.data.currentStep === true) === currentStep &&
    sameClassName(cached.className, className) &&
    cached.position.x === position.x &&
    cached.position.y === position.y
  ) {
    return cached;
  }
  const flowNode: DeckFlowNode = {
    id: node.id,
    type: 'deck',
    ...size,
    position,
    selected,
    ...(className === '' ? {} : { className }),
    ...(dimmed ? { domAttributes: { 'aria-hidden': true, inert: true } } : {}),
    data: {
      title: node.title,
      kind: node.type,
      subtitle,
      owner: node.owner,
      tags: node.tags ?? [],
      hasRules: (node.rules?.length ?? 0) > 0,
      level: view.level,
      childCount,
      dimmed,
      focused,
      ...(flowStart === undefined ? {} : { flowStart }),
      ...(currentStep ? { currentStep } : {}),
      ...(viewDimmed ? { viewDimmed } : {}),
      ...(pinned ? { pinned } : {}),
      ...(hiddenInView ? { hiddenInView } : {}),
      ...(problems === undefined ? {} : { problems }),
    },
  };
  nodeCache.set(node, flowNode);
  return flowNode;
}

/**
 * Number of nodes in each group, nested groups included. Its cache is keyed weakly by the deck's
 * arrays (not a single slot), so export may call it without disturbing the canvas.
 */
export function groupCounts(deck: SododeckFile): Map<string, number> {
  let byGroups = groupCountCache.get(deck.nodes);
  if (byGroups === undefined) {
    byGroups = new WeakMap();
    groupCountCache.set(deck.nodes, byGroups);
  }
  const cached = byGroups.get(deck.groups);
  if (cached !== undefined) return cached;
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
  byGroups.set(deck.groups, counts);
  return counts;
}

function groupNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  level: Level,
  view: CanvasView,
): GroupFlowNode[] {
  if (deck.groups.length === 0) return [];
  const groupsById = groupLookup(deck.groups);
  const bounds = groupBounds(deck, level);
  const counts = groupCounts(deck);
  return graph.groups.flatMap((groupId) => {
    const group = groupsById.get(groupId);
    const rect = bounds.get(groupId);
    if (group === undefined) return [];
    if (!rect) return [];
    const id = GROUP_NODE_PREFIX + groupId;
    const count = counts.get(groupId) ?? 0;
    const focused = view.focusedId === id;
    const inFocus = view.focus?.members.has(id) === true;
    const selected = view.selection.groups.includes(groupId);
    const cached = groupCache.get(id);
    if (
      (cached?.data.selected === true) === selected &&
      cached?.data.title === group.title &&
      cached.data.count === count &&
      cached.data.level === level &&
      cached.data.focused === focused &&
      sameClassName(cached.className, inFocus ? 'in-focus' : '') &&
      cached.position.x === rect.x &&
      cached.position.y === rect.y &&
      cached.width === rect.width &&
      cached.height === rect.height
    ) {
      return cached;
    }
    const flowNode: GroupFlowNode = {
      id,
      type: 'group-boundary',
      position: { x: rect.x, y: rect.y },
      width: rect.width,
      height: rect.height,
      // A frame (016 R5): dragged by its label or edge band only, resized with its handles.
      // The wrapper lets the pointer through, so empty space inside still pans and marquees
      // (FR-017); the handles opt back in.
      selectable: true,
      draggable: true,
      dragHandle: `.${GROUP_HANDLE_CLASS}`,
      style: { pointerEvents: 'none' },
      focusable: false,
      connectable: false,
      ...(inFocus ? { className: 'in-focus' } : {}),
      ...(view.focus !== null && !inFocus
        ? { domAttributes: { 'aria-hidden': true, inert: true } }
        : {}),
      zIndex: -1,
      data: { title: group.title, count, level, focused, ...(selected ? { selected } : {}) },
    };
    groupCache.set(id, flowNode);
    return flowNode;
  });
}

function collapsedNodes(view: CanvasView, graph: VisibleGraph): CollapsedFlowNode[] {
  return graph.cards.map((card) => {
    const id = `${COLLAPSED_NODE_PREFIX}${card.groupId}`;
    const focused = view.focusedId === id;
    const selected = view.selection.groups.includes(card.groupId);
    const inFocus = view.focus?.members.has(id) === true;
    const dimmed = view.focus !== null && !inFocus;
    const flowInside = view.marks.cards.get(card.groupId);
    const className = [flowInside !== undefined ? 'in-flow' : null, inFocus ? 'in-focus' : null]
      .filter(Boolean)
      .join(' ');
    const cached = collapsedCache.get(id);
    if (
      cached?.selected === selected &&
      cached.data.focused === focused &&
      cached.data.dimmed === dimmed &&
      cached.data.flowInside === flowInside &&
      sameClassName(cached.className, className) &&
      Boolean(cached.domAttributes?.['aria-hidden']) === dimmed &&
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
      ...(className === '' ? {} : { className }),
      ...(dimmed ? { domAttributes: { 'aria-hidden': true, inert: true } } : {}),
      data: {
        groupId: card.groupId,
        title: card.title,
        nodeCount: card.nodeCount,
        edgeCount: card.edgeCount,
        focused,
        dimmed,
        ...(flowInside === undefined ? {} : { flowInside }),
      },
    };
    collapsedCache.set(id, flowNode);
    return flowNode;
  });
}

/** Cache-free port geometry for export; React Flow's identity caches stay untouched. */
export function exportPortRects(
  deck: SododeckFile,
  graph: VisibleGraph,
): { id: string; rect: { x: number; y: number; width: number; height: number }; label: string }[] {
  const { nodePositionById: positions } = deckLookups(deck);
  return graph.ports.flatMap((port) => {
    const anchors = port.insideNodeIds
      .map((nodeId) => positions.get(nodeId))
      .filter((point): point is Point => point !== undefined);
    if (anchors.length === 0) return [];
    const x =
      anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length + NODE_SIZE.width + 32;
    const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length;
    return [{ id: port.id, rect: { x, y, width: 120, height: 36 }, label: port.outsideTitle }];
  });
}

function portNodes(deck: SododeckFile, graph: VisibleGraph): PortFlowNode[] {
  return exportPortRects(deck, graph).map((port) => {
    const { x, y } = port.rect;
    const outsideNodeId = port.id.slice(PORT_NODE_PREFIX.length);
    const cached = portCache.get(port.id);
    if (
      cached?.position.x === x &&
      cached.position.y === y &&
      cached.data.outsideNodeId === outsideNodeId &&
      cached.data.outsideTitle === port.label
    ) {
      return cached;
    }
    const flowNode: PortFlowNode = {
      id: port.id,
      type: 'port',
      position: { x, y },
      width: 120,
      height: 36,
      selectable: false,
      data: {
        outsideNodeId,
        outsideTitle: port.label,
      },
    };
    portCache.set(port.id, flowNode);
    return flowNode;
  });
}

function portNodesWithView(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
): PortFlowNode[] {
  return portNodes(deck, graph).map((port) => {
    const inFocus = view.focus?.members.has(port.id) === true;
    const dimmed = view.focus !== null && !inFocus;
    return {
      ...port,
      ...(inFocus ? { className: 'in-focus' } : {}),
      ...(dimmed ? { domAttributes: { 'aria-hidden': true, inert: true } } : {}),
    };
  });
}

/** Group boundaries first (drawn below), then components. */
export function toFlowNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
  overlay: FlowOverlay = EMPTY_OVERLAY,
): CanvasFlowNode[] {
  const lookups = deckLookups(deck);
  const ports = portNodesWithView(deck, graph, view);
  const components = graph.nodes.flatMap((nodeId) => {
    const node = lookups.nodesById.get(nodeId);
    const index = lookups.nodeIndexById.get(nodeId);
    const position = lookups.nodePositionById.get(nodeId);
    if (node === undefined || index === undefined || position === undefined) return [];
    return [
      toFlowNode(
        node,
        position,
        view,
        graph.childCount.get(node.id) ?? 0,
        overlay.nodes.get(node.id),
      ),
    ];
  });
  const next: CanvasFlowNode[] = [
    ...groupNodes(deck, graph, view.level, view),
    ...collapsedNodes(view, graph),
    ...ports,
    ...components,
  ];
  if (next.length === lastNodes.length && next.every((node, index) => node === lastNodes[index])) {
    return lastNodes;
  }
  lastNodes = next;
  return next;
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
function representativeTitles(
  deck: SododeckFile,
  graph: VisibleGraph,
): ReadonlyMap<string, string> {
  const { nodeTitleById } = deckLookups(deck);
  if (graph.cards.length === 0 && graph.ports.length === 0) return nodeTitleById;
  const titles = new Map(nodeTitleById);
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
  const lookups = deckLookups(deck);
  const ports = portNodes(deck, graph);
  const nodes =
    graph.cards.length === 0 && ports.length === 0
      ? lookups.edgeNodeViews
      : new Map(lookups.edgeNodeViews);
  if (nodes instanceof Map) {
    for (const card of graph.cards) {
      nodes.set(`${COLLAPSED_NODE_PREFIX}${card.groupId}`, {
        position: { x: card.rect.x, y: card.rect.y },
        title: card.title,
      });
    }
    for (const port of ports) {
      nodes.set(port.id, { position: port.position, title: port.data.outsideTitle });
    }
  }
  const titles = representativeTitles(deck, graph);
  const selected = new Set(view.selection.edges);
  const plainEdges = graph.edges.flatMap((edgeId) => {
    const edge = lookups.edgesById.get(edgeId);
    if (edge === undefined) return [];
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    // The schema does not check references; a file may still point at missing nodes.
    if (!from || !to) return [];
    const [sourceHandle, targetHandle] = facingSides(from.position, to.position);
    const isSelected = selected.has(edge.id);
    const focused = edge.id === view.focusedEdgeId;
    const dimmed = view.focus !== null && !view.focus.edges.has(edge.id);
    const inFocus = view.focus?.edges.has(edge.id) === true;
    const showLabel =
      (view.labelsOn && edge.label !== undefined && edge.label !== '') ||
      view.focus?.edges.has(edge.id) === true;
    const mark = overlay.edges.get(edge.id);
    const problems = view.problems?.get(edge.id);
    const cached = edgeCache.get(edge);
    if (
      cached?.selected === isSelected &&
      sameMark(cached.data?.flow, mark) &&
      sameProblemMark(cached.data?.problems, problems) &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      cached.data?.showLabel === showLabel &&
      cached.data.focused === focused &&
      cached.data.inFocus === inFocus &&
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
      ...(mark?.inPath === true || inFocus
        ? {
            className: [mark?.inPath === true ? 'in-flow' : null, inFocus ? 'in-focus' : null]
              .filter(Boolean)
              .join(' '),
          }
        : {}),
      ...(dimmed ? { domAttributes: { 'aria-hidden': true } } : {}),
      interactionWidth: 12,
      ariaLabel:
        problems === undefined
          ? edgeName(from.title, to.title, edge.label)
          : `${edgeName(from.title, to.title, edge.label)}, ${problems.label}`,
      data: {
        label: edge.label,
        protocol: edge.protocol,
        direction: edge.direction ?? 'forward',
        showLabel,
        fromTitle: from.title,
        toTitle: to.title,
        focused,
        inFocus,
        dimmed,
        ...(mark === undefined ? {} : { flow: mark }),
        ...(problems === undefined ? {} : { problems }),
      },
    };
    edgeCache.set(edge, flowEdge);
    return [flowEdge];
  });
  const portEdges = graph.ports.flatMap((port) =>
    port.edgeIds.flatMap((edgeId) => {
      const edge = lookups.edgesById.get(edgeId);
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
      const inFocus = view.focus?.edges.has(edge.id) === true;
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
        cached.data.inFocus === inFocus &&
        cached.data.dimmed === dimmed &&
        sameClassName(
          cached.className,
          [mark?.inPath === true ? 'in-flow' : null, inFocus ? 'in-focus' : null]
            .filter(Boolean)
            .join(' '),
        ) &&
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
        ...(mark?.inPath === true || inFocus
          ? {
              className: [mark?.inPath === true ? 'in-flow' : null, inFocus ? 'in-focus' : null]
                .filter(Boolean)
                .join(' '),
            }
          : {}),
        ...(dimmed ? { domAttributes: { 'aria-hidden': true } } : {}),
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
          inFocus,
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
    const inFocus = view.focus?.edges.has(edge.id) === true;
    const flow = view.marks.merged.get(edge.id);
    const className = [flow?.inPath === true ? 'in-flow' : null, inFocus ? 'in-focus' : null]
      .filter(Boolean)
      .join(' ');
    const cached = mergedCache.get(edge.id);
    if (
      cached !== undefined &&
      cached.data !== undefined &&
      cached.data.count === edge.edgeIds.length &&
      cached.data.direction === edge.direction &&
      cached.data.focused === focused &&
      cached.data.inFocus === inFocus &&
      sameMark(cached.data.flow, flow) &&
      sameClassName(cached.className, className) &&
      Boolean(cached.domAttributes?.['aria-hidden']) === (view.focus !== null && !inFocus) &&
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
      ...(className === '' ? {} : { className }),
      ...(view.focus !== null && !inFocus ? { domAttributes: { 'aria-hidden': true } } : {}),
      ariaLabel: `${String(edge.edgeIds.length)} connections between ${titles.get(edge.a) ?? edge.a} and ${titles.get(edge.b) ?? edge.b}`,
      data: {
        count: edge.edgeIds.length,
        direction: edge.direction,
        edgeIds: edge.edgeIds,
        focused,
        inFocus,
        ...(flow === undefined ? {} : { flow }),
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
