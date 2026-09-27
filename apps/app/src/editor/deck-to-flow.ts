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
import {
  EMPTY_OVERLAY,
  type EdgeFlowMark,
  type FlowOverlay,
  type NodeFlowMark,
} from './flows/flow-overlay';

type DeckNodeObject = SododeckFile['nodes'][number];
type DeckEdgeObject = SododeckFile['edges'][number];
type StickyObject = SododeckFile['stickies'][number];

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
  subtitle: string | undefined;
  hasRules: boolean;
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
}

export interface DeckEdgeData extends Record<string, unknown> {
  label: string | undefined;
  protocol: DeckEdgeObject['protocol'];
  direction: NonNullable<DeckEdgeObject['direction']>;
  showLabel: boolean;
  fromTitle: string;
  toTitle: string;
  focused: boolean;
  /** Marks of the shown or recorded flow (006): step badges and the flow style. */
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
export type StickyFlowNode = Node<StickyNodeData, 'sticky'>;
export type CanvasFlowNode = DeckFlowNode | GroupFlowNode | StickyFlowNode;
export type DeckFlowEdge = Edge<DeckEdgeData, 'deck'>;
export type StickyLeaderFlowEdge = Edge<Record<string, never>, 'sticky-leader'>;

export { NODE_SIZE };

/** Group boundaries are React Flow nodes too; their ids are prefixed so they never clash. */
export const GROUP_NODE_PREFIX = 'group:';
export const STICKY_NODE_PREFIX = 'sticky:';
export const STICKY_LEADER_PREFIX = 'sticky-leader:';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const nodeCache = new WeakMap<DeckNodeObject, DeckFlowNode>();
const groupCache = new Map<string, GroupFlowNode>();
const edgeCache = new WeakMap<DeckEdgeObject, DeckFlowEdge>();
const stickyNodeCache = new WeakMap<StickyObject, StickyFlowNode>();
const stickyLeaderCache = new WeakMap<StickyObject, StickyLeaderFlowEdge>();
/** Last edge list: returned again when every element is the same, so React Flow skips a re-sync. */
let lastEdges: DeckFlowEdge[] = [];

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
  selected: boolean,
  focused: boolean,
  mark: NodeFlowMark | undefined,
): DeckFlowNode {
  const cached = nodeCache.get(node);
  const flowStart = mark?.startsHere;
  const currentStep = mark?.currentStep === true;
  const inFlow = mark?.inPath === true;
  if (
    cached?.selected === selected &&
    cached.data.focused === focused &&
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
  overlay: FlowOverlay = EMPTY_OVERLAY,
): CanvasFlowNode[] {
  const selected = new Set(selection.nodes);
  const components = deck.nodes.map((node, index) =>
    toFlowNode(
      node,
      displayPosition(node, index),
      selected.has(node.id),
      node.id === focusedId,
      overlay.nodes.get(node.id),
    ),
  );
  return [...groupNodes(deck), ...components];
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
export function toFlowEdges(
  deck: SododeckFile,
  selection: Selection,
  labelsOn: boolean,
  focusedEdgeId: string | null = null,
  overlay: FlowOverlay = EMPTY_OVERLAY,
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
    const mark = overlay.edges.get(edge.id);
    const cached = edgeCache.get(edge);
    if (
      cached?.selected === isSelected &&
      sameMark(cached.data?.flow, mark) &&
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
      ...(mark?.inPath === true ? { className: 'in-flow' } : {}),
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
        ...(mark === undefined ? {} : { flow: mark }),
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
