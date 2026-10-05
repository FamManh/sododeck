/**
 * Deck → React Flow view models (003 research R10). Pure and derived on every render from the
 * snapshot; React Flow never owns document state. Results are cached per source object, so an
 * edit to one node returns the same React Flow objects for all the others and `memo` skips them.
 */
import {
  deckDialect,
  edgeShape,
  isDbTable,
  relationshipDisplayOf,
  type ResolvedRelationshipDisplay,
  type Geometry,
  STICKY_DEFAULT_SIZE,
  stickyBox,
  stickyCanvasPosition,
  stickyLabel,
  type StickyPlacement,
} from '@sododeck/model';
import type { TouchAccess } from '@sododeck/model';
import type { EdgeShape, SododeckFile, Size } from '@sododeck/schema';
import type { Edge, Node } from '@xyflow/react';

import {
  cardBox,
  cardLayoutOf,
  displayPosition,
  geometryOf,
  groupBounds,
  NODE_SIZE,
  tableLayoutOf,
  type Point,
} from './canvas-geometry';
import {
  hasColumnEnds,
  isRelationship,
  relationshipEnds,
  relationshipSides,
  sameEnds,
  type RelationshipEnds,
} from './relationships/relationship-ends';
import { relationshipLabel, relationshipName } from './relationships/relationship-label';
import { tableContextOf, type TableContext } from './table-keys';
import { autoSides, cardCentre, decodeWaypoints } from './routing/connector-geometry';
import { resolveSides, type Box } from './routing/route-path';
import { stickyFlowState, type NotesDisplay, type StickyFlowState } from './stickies/sticky-flow';
import type { Selection } from '../state/ui-store';
import type { CollapsedFlowMarks } from './collapse-flow-marks';
import type { BundleResult, PlainEdge } from './bundles';
import type { FocusSet } from './focus-set';
import { lockedGroupIds } from './group-lock';
import {
  EMPTY_OVERLAY,
  type EdgeFlowMark,
  type FlowOverlay,
  type NodeFlowMark,
} from './flows/flow-overlay';
import type { NodeStepMark, StepState } from './flows/step-marks';
import type { CardLayout } from './card-layout';
import type { Level } from './levels';
import { sameProblemMark, type ProblemMark, type ProblemMarks } from './problems/problem-marks';
import { resolveLook, type CardLook, type StylePreview } from './style/card-style';
import { cardTagLooks, sameTagLooks, tagColourMap, type TagColourMap } from './tags/card-tag-looks';
import type { TagLook } from './tags/tag-colours';
import { cardFieldView, sameFieldView, type CardFieldView } from './card-fields';
import { dialectLabel, isDatabaseCard, tableCounts } from '../db/owner';
import type { TouchChip } from '../db/touches';
import { PROXY_SIZE, proxyLayout } from './proxy-layout';
import { scopeBounds, type CollapsedMember, type VisibleGraph } from './visible-graph';
import { subtitleOf, type ViewRender } from './views/view-state';

type DeckNodeObject = SododeckFile['nodes'][number];
type DeckEdgeObject = SododeckFile['edges'][number];
type StickyObject = SododeckFile['stickies'][number];

export interface DeckNodeData extends Record<string, unknown> {
  title: string;
  kind: string;
  /** The node's stored icon reference (038), as written; the card resolves it with `nodeIcon`. */
  icon?: string;
  subtitle: string | undefined;
  owner: string | undefined;
  /** The first ten tags with their own colours (033); empty without tags. */
  tagLooks: readonly TagLook[];
  /** What the card shows of its typed fields (032): header status, chips, rows, "+N fields". */
  fields: CardFieldView;
  hasRules: boolean;
  level: Level;
  childCount: number;
  dimmed: boolean;
  /** Carries the canvas's single Tab stop (roving tabindex). */
  focused: boolean;
  /** "Step n starts here" while recording a flow (006): a ring and a tag. */
  flowStart?: string;
  /** Flow mode (007): the target card of the current step, lifted, with `aria-current="step"`. */
  currentStep?: boolean;
  /** Flow mode (035): the card's corner sticker (✓, number or dashed number). */
  step?: NodeStepMark;
  /** Dimmed by the view's settings (011 FR-013): reduced opacity, still interactive. */
  viewDimmed?: boolean;
  /** Pinned in the current view (011 FR-023): a pin glyph; Tidy layout leaves it in place. */
  pinned?: boolean;
  /** Created here while the view hides it (011): shown until the view is left, with a note. */
  hiddenInView?: boolean;
  /** A table created outside the view's schema / table filter (048): note and "Add to this view". */
  outsideFilter?: boolean;
  /** The component's problems (015): an amber glyph and a count in its accessible name. */
  problems?: ProblemMark;
  /** Resolved fill/stroke colour (020); absent when the card has no colour. */
  look?: CardLook;
  /** The card's drawn box and how many lines its text gets (029 R7): one pure function of the content. */
  layout: CardLayout;
  /** Drawn as a shape (031): its geometry; the node type is then `shape`. */
  geometry?: Geometry;
  /** Locked (043): not draggable or resizable, a lock badge in the header. */
  locked?: boolean;
  /** A database card (049): how many tables it owns and the deck's dialect chip. */
  database?: DatabaseFace;
  /** Flow mode (049): the database card's chip for the current step, "writes orders +1". */
  touchChip?: TouchChip;
  /** Flow mode (049): a table the current step reads or writes. */
  touch?: TouchAccess;
  /** Flow mode (049): the columns of this table the current step touches. */
  touchedColumns?: ReadonlyMap<string, TouchAccess>;
}

/** What a database card's face shows (049). */
export interface DatabaseFace {
  count: number;
  dialect: string;
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
  /** Resolved fill/stroke colour (020); absent when the group has no colour. */
  look?: CardLook;
  /** Every card inside is locked (054): the frame refuses move, resize and delete. */
  locked?: boolean;
}

const sameSize = (a: { width: number; height: number } | undefined, b: Box): boolean =>
  a?.width === b.width && a.height === b.height;

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
  /** The effective line type (029): the stored one, else elbow with a route offset, else curved. */
  shape: EdgeShape;
  /** Pinned sides and middle-segment offset (017 R6); absent means automatic routing. */
  route?: DeckEdgeObject['route'];
  /** Both cards' sizes (022): with a side midpoint they give the boxes bends and anchors need. */
  fromSize?: { width: number; height: number };
  toSize?: { width: number; height: number };
  /** An end drawn as a shape (031): anchors and bends follow its outline, not its box. */
  fromGeometry?: Geometry;
  toGeometry?: Geometry;
  /** Dash, weight, colour and animation (022); absent means the default look. */
  style?: DeckEdgeObject['style'];
  /** Where the label sits along the line, 0 to 1 (022); absent means the middle. */
  labelAt?: number;
  /** The zoom level cards are drawn at (017 R7): the segment handle needs each endpoint's box. */
  level: Level;
  /**
   * Both endpoints are real, on-screen cards (017 R7): a route can be edited. False for an edge
   * drawn to a collapsed group's port pill, where the resolved sides don't match either card's
   * real box and a route offset would not mean what it looks like.
   */
  routable: boolean;
  /** This connector's slot among the fanned-out members of a bundle (034 R6). */
  fan?: { index: number; count: number };
  /** A relationship between tables (042): row anchors, marks and how they show. */
  rel?: RelationshipData;
  /**
   * The label is drawn but hidden until the connector is hovered or lit (042 R10: "hover" mode,
   * and "follow" with the Labels tool off), so hovering changes no React Flow object.
   */
  hoverLabel?: boolean;
  /** Locked (053): it cannot be rerouted, reattached or deleted; a small lock mark shows it. */
  locked?: boolean;
}

/** What a relationship edge draws besides an ordinary connector (042). */
export interface RelationshipData {
  ends: RelationshipEnds;
  /** Ends sit on rows (≥ 90 % and a column end); otherwise on the outline as a connector. */
  rows: boolean;
  /** Both ends on one table: a loop on its right side. */
  self: boolean;
  notation: ResolvedRelationshipDisplay['notation'];
  hideEnds: boolean;
  /** Each end's column ids (US7: a single-column end can be dragged to another row). */
  columns: { from: readonly string[]; to: readonly string[] };
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

function sameRel(a: RelationshipData | undefined, b: RelationshipData | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.rows === b.rows &&
    a.self === b.self &&
    a.notation === b.notation &&
    a.hideEnds === b.hideEnds &&
    sameIds(a.columns.from, b.columns.from) &&
    sameIds(a.columns.to, b.columns.to) &&
    sameEnds(a.ends, b.ends)
  );
}

/** Levels at which table rows are drawn (≥ 90 %, DESIGN.md "Table zoom levels"). */
export function rowsDrawn(level: Level): boolean {
  return level === 'container' || level === 'component';
}

/**
 * Whether a relationship's label shows, per the deck's label mode (042 R10). `lit` is a focus or
 * a selection; `hover` says the label is drawn hidden until the pointer lights it.
 */
export function relationshipLabelShown(
  mode: ResolvedRelationshipDisplay['labels'],
  labelsOn: boolean,
  lit: boolean,
): { show: boolean; hover: boolean } {
  switch (mode) {
    case 'off':
      return { show: false, hover: false };
    case 'always':
      return { show: true, hover: false };
    case 'hover':
      return { show: lit, hover: !lit };
    case 'follow':
      return { show: labelsOn || lit, hover: !labelsOn && !lit };
  }
}

export interface CollapsedGroupData extends Record<string, unknown> {
  groupId: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  /** Member kinds for the tiles on the fanned hand (029 US5). */
  members: readonly CollapsedMember[];
  focused: boolean;
  dimmed: boolean;
  /** Flow mode (035): the front card's folded step state, drawn as the same sticker. */
  flowInside?: StepState;
  /** The number the folded sticker prints; absent when played (✓). */
  flowNumber?: string;
  /** Flow mode (049): the chip of the database cards inside, merged ("writes orders +2"). */
  touchChip?: TouchChip;
  /** Resolved fill/stroke colour (020); absent when the group has no colour. */
  look?: CardLook;
  /** Every card inside is locked (054): the card refuses move and delete. */
  locked?: boolean;
}

export interface PortNodeData extends Record<string, unknown> {
  outsideNodeId: string;
  outsideTitle: string;
  /** The outside card's kind, for the proxy's icon (034). */
  kind: string;
  /** The outside card's stored icon reference (038). */
  icon?: string;
  /** Inputs stand left of the scope, the rest right (034 R7). */
  side: 'left' | 'right';
}

export interface ScopeLabelData extends Record<string, unknown> {
  title: string;
  /** Cards inside the scope: visible ones plus the members of collapsed cards. */
  count: number;
}

export interface MergedEdgeData extends Record<string, unknown> {
  count: number;
  direction: 'a-to-b' | 'b-to-a' | 'both';
  edgeIds: readonly string[];
  focused: boolean;
  inFocus: boolean;
  flow?: EdgeFlowMark;
  /** `bundle` for parallel connectors folded into one curve (034); absent for a collapsed group. */
  kind?: 'bundle';
  /** A bundle the user fanned out: its connectors draw on their own, the pill stays. */
  fanned?: boolean;
  /** The zoom level (029): at System a bundle is a dot, at Landscape no pill. */
  level?: Level;
  /** "3 connections between A and B": the accessible name of a bundle's pill. */
  name?: string;
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
  /** The box the note is drawn in: the stored size or the default (053), whatever the collapse. */
  size: Size;
  /** The first ten tags with their own colours (033); empty without tags. */
  tagLooks: readonly TagLook[];
  /** A locked note cannot be moved, resized, reconnected or deleted (053). */
  locked: boolean;
  /** A pinned text size in px; absent = fit the text to the note (Auto). */
  fontSize: number | undefined;
  align: 'left' | 'center' | 'right';
}

/** A component: a card (`deck`) or a shape (`shape`, 031), from the same data. */
export type DeckFlowNode = Node<DeckNodeData, 'deck' | 'shape'>;
export type GroupFlowNode = Node<GroupBoundaryData, 'group-boundary'>;
export type CollapsedFlowNode = Node<CollapsedGroupData, 'collapsed-group'>;
export type PortFlowNode = Node<PortNodeData, 'port'>;
export type StickyFlowNode = Node<StickyNodeData, 'sticky'>;
export type ScopeLabelFlowNode = Node<ScopeLabelData, 'scope-label'>;
export type CanvasFlowNode =
  | DeckFlowNode
  | GroupFlowNode
  | CollapsedFlowNode
  | PortFlowNode
  | ScopeLabelFlowNode
  | StickyFlowNode;
export type DeckFlowEdge = Edge<DeckEdgeData, 'deck'>;
export type MergedFlowEdge = Edge<MergedEdgeData, 'merged'>;
export type StickyLeaderFlowEdge = Edge<Record<string, never>, 'sticky-leader'>;

export { NODE_SIZE };

/** Group boundaries are React Flow nodes too; their ids are prefixed so they never clash. */
export const GROUP_NODE_PREFIX = 'group:';
/** What a group frame is dragged by: its label and an 8 px edge band (016 R5). */
export const GROUP_HANDLE_CLASS = 'sd-group-handle';
export const COLLAPSED_NODE_PREFIX = 'collapsed:';
/** The class of an ⌥ duplicate-drag's copies (051): the drag lift moves from the original to them. */
export const DRAG_COPY_CLASS = 'sd-drag-copy';
export const PORT_NODE_PREFIX = 'port:';
export const SCOPE_LABEL_PREFIX = 'scope-label:';
/** How far the "Inside <name>" label floats above the scope's top edge. */
const SCOPE_LABEL_LIFT = 44;
export const MERGED_EDGE_PREFIX = 'merged:';
export const STICKY_NODE_PREFIX = 'sticky:';
export const STICKY_LEADER_PREFIX = 'sticky-leader:';

/**
 * The deck id a drawn node stands for as a connector end (050 R6): a card's own id, or the group
 * behind a `group:` frame or a `collapsed:` card, or the note behind a `sticky:` node (053). React Flow reports flow ids; edges store these.
 */
export function endpointIdOf(flowId: string): string {
  if (flowId.startsWith(STICKY_NODE_PREFIX)) return flowId.slice(STICKY_NODE_PREFIX.length);
  if (flowId.startsWith(GROUP_NODE_PREFIX)) return flowId.slice(GROUP_NODE_PREFIX.length);
  if (flowId.startsWith(COLLAPSED_NODE_PREFIX)) return flowId.slice(COLLAPSED_NODE_PREFIX.length);
  return flowId;
}

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

const nodeCache = new WeakMap<DeckNodeObject, DeckFlowNode>();
const groupCache = new Map<string, GroupFlowNode>();
const collapsedCache = new Map<string, CollapsedFlowNode>();
const portCache = new Map<string, PortFlowNode>();
const scopeLabelCache = new Map<string, ScopeLabelFlowNode>();
const edgeCache = new WeakMap<DeckEdgeObject, DeckFlowEdge>();
const mergedCache = new Map<string, MergedFlowEdge>();
const bundleCache = new Map<string, MergedFlowEdge>();
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

function sameMembers(a: readonly CollapsedMember[], b: readonly CollapsedMember[]): boolean {
  return (
    a.length === b.length &&
    a.every((member, index) => {
      const other = b[index];
      return other !== undefined && member.kind === other.kind && member.icon === other.icon;
    })
  );
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((item, index) => item === b[index]));
}

function sameClassName(actual: string | undefined, expected: string): boolean {
  return (actual ?? '') === expected;
}

/** Structural compare of a resolved look (020): a new object every render, cached by value. */
function sameLook(a: CardLook | undefined, b: CardLook | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return (
    a.fill === b.fill &&
    a.stroke === b.stroke &&
    a.chip === b.chip &&
    a.ink === b.ink &&
    a.dot === b.dot &&
    a.text === b.text &&
    a.namedFill === b.namedFill
  );
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
  /** Live, unsaved colour edit (020, R9); applied only to selected nodes/groups. */
  stylePreview?: StylePreview | null;
  /** The drilled-in group or card's name (034): drives the "Inside <name>" label; none at the top. */
  scopeTitle?: string | undefined;
  /** Node and group ids of an ⌥ duplicate-drag's copies (051): they get `sd-drag-copy`. */
  dragCopyIds?: ReadonlySet<string>;
  /** Notes are hidden (flow mode, notes display off): their connectors are not drawn (053). */
  notesHidden?: boolean;
}

/** Marks are rebuilt with every overlay; equal ones keep the cached React Flow object. */
function sameMark(a: EdgeFlowMark | undefined, b: EdgeFlowMark | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return (
    a.style === b.style &&
    a.errorIcon === b.errorIcon &&
    a.inPath === b.inPath &&
    a.state === b.state &&
    a.current?.speed === b.current?.speed &&
    a.current?.number === b.current?.number &&
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

/**
 * Class names a focus member carries (010, 034): every member is `in-focus`; the ones that are
 * not the focus card itself also get the neighbour look (Secondary border and lip).
 */
function focusClass(view: CanvasView, id: string): string | null {
  if (view.focus?.members.has(id) !== true) return null;
  return view.focus.focusId === id ? 'in-focus' : 'in-focus sd-focus-neighbour';
}

/** The tag colour map each cached card was built with: a recolour revisits only cards with tags. */
const nodeTagColours = new WeakMap<DeckFlowNode, TagColourMap>();

function toFlowNode(
  node: DeckNodeObject,
  position: Point,
  view: CanvasView,
  childCount: number,
  mark: NodeFlowMark | undefined,
  tagColours: TagColourMap,
  fields: CardFieldView,
  database: DatabaseFace | undefined,
): DeckFlowNode {
  const cached = nodeCache.get(node);
  const tagLooks =
    cached !== undefined && nodeTagColours.get(cached) === tagColours
      ? cached.data.tagLooks
      : cardTagLooks(node.tags, tagColours);
  const flowStart = mark?.startsHere;
  const currentStep = mark?.currentStep === true;
  const step = mark?.step ?? undefined;
  const inFlow = mark?.inPath === true;
  const touchChip = mark?.chip;
  const touch = mark?.touch;
  const touchedColumns = mark?.columns;
  const selected = view.selection.nodes.includes(node.id);
  const focused = node.id === view.focusedId;
  const dimmed = view.focus !== null && !view.focus.members.has(node.id);
  const render = view.render;
  const subtitle = render === undefined ? node.tech : subtitleOf(node, render);
  const viewDimmed = render?.dimmed.has(node.id) === true;
  const pinned = render?.pinned.has(node.id) === true;
  const hiddenInView = render?.revealedHidden.has(node.id) === true;
  const outsideFilter = hiddenInView && render.tableFilter && isDbTable(node);
  const problems = view.problems?.get(node.id);
  const look = resolveLook(node.style, selected ? (view.stylePreview ?? undefined) : undefined);
  const className = [
    inFlow ? 'in-flow' : null,
    focusClass(view, node.id),
    viewDimmed ? 'view-dimmed' : null,
    view.dragCopyIds?.has(node.id) === true ? DRAG_COPY_CLASS : null,
  ]
    .filter(Boolean)
    .join(' ');
  // The view's own subtitle and the "n inside" row take part, so the box fits what is drawn. A
  // database card always draws its row ("No tables yet" included, 049).
  const layout = cardLayoutOf(node, {
    description: subtitle,
    childCount: database === undefined ? childCount : Math.max(1, childCount),
    fields,
  });
  const size = { width: layout.width, height: layout.height };
  const geometry = geometryOf(node) ?? undefined;
  const locked = node.locked === true;
  if (
    cached?.data.geometry === geometry &&
    cached?.selected === selected &&
    (cached.data.locked === true) === locked &&
    // A table's rows (041) follow its deck too (keys, enums, display): same object while unchanged.
    cached.data.layout.table === layout.table &&
    cached.data.icon === node.icon &&
    cached.data.subtitle === subtitle &&
    (cached.data.viewDimmed === true) === viewDimmed &&
    (cached.data.pinned === true) === pinned &&
    (cached.data.hiddenInView === true) === hiddenInView &&
    (cached.data.outsideFilter === true) === outsideFilter &&
    sameProblemMark(cached.data.problems, problems) &&
    sameLook(cached.data.look, look) &&
    sameTagLooks(cached.data.tagLooks, tagLooks) &&
    // The field view is memoised per node and per type's field list (032), so toggling "On card"
    // for a type rebuilds only that type's cards.
    sameFieldView(cached.data.fields, fields) &&
    cached.data.focused === focused &&
    cached.data.level === view.level &&
    cached.data.childCount === childCount &&
    cached.data.dimmed === dimmed &&
    cached.data.flowStart === flowStart &&
    (cached.data.currentStep === true) === currentStep &&
    cached.data.step?.state === step?.state &&
    cached.data.step?.number === step?.number &&
    cached.data.database?.count === database?.count &&
    cached.data.database?.dialect === database?.dialect &&
    cached.data.touchChip?.text === touchChip?.text &&
    cached.data.touch === touch &&
    cached.data.touchedColumns === touchedColumns &&
    sameClassName(cached.className, className) &&
    cached.position.x === position.x &&
    cached.position.y === position.y &&
    cached.width === size.width &&
    cached.height === size.height
  ) {
    nodeTagColours.set(cached, tagColours);
    return cached;
  }
  const flowNode: DeckFlowNode = {
    id: node.id,
    type: geometry === undefined ? 'deck' : 'shape',
    ...size,
    position,
    selected,
    ...(className === '' ? {} : { className }),
    ...(dimmed ? { domAttributes: { 'aria-hidden': true, inert: true } } : {}),
    // A locked card never starts a drag, nor moves with a multi-drag (043 FR-023).
    ...(locked ? { draggable: false } : {}),
    data: {
      title: node.title,
      kind: node.type,
      ...(node.icon === undefined ? {} : { icon: node.icon }),
      subtitle,
      owner: node.owner,
      tagLooks,
      fields,
      hasRules: (node.rules?.length ?? 0) > 0,
      level: view.level,
      childCount,
      dimmed,
      focused,
      ...(flowStart === undefined ? {} : { flowStart }),
      ...(currentStep ? { currentStep } : {}),
      ...(step === undefined ? {} : { step }),
      ...(viewDimmed ? { viewDimmed } : {}),
      ...(pinned ? { pinned } : {}),
      ...(hiddenInView ? { hiddenInView } : {}),
      ...(outsideFilter ? { outsideFilter } : {}),
      ...(problems === undefined ? {} : { problems }),
      ...(look === undefined ? {} : { look }),
      ...(geometry === undefined ? {} : { geometry }),
      ...(locked ? { locked } : {}),
      ...(database === undefined ? {} : { database }),
      ...(touchChip === undefined ? {} : { touchChip }),
      ...(touch === undefined ? {} : { touch }),
      ...(touchedColumns === undefined ? {} : { touchedColumns }),
      layout,
    },
  };
  nodeCache.set(node, flowNode);
  nodeTagColours.set(flowNode, tagColours);
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
  const lockedGroups = lockedGroupIds(deck);
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
    const locked = lockedGroups.has(groupId);
    const look = resolveLook(group.style, selected ? (view.stylePreview ?? undefined) : undefined);
    const groupClass = [
      inFocus ? 'in-focus' : null,
      view.dragCopyIds?.has(groupId) === true ? DRAG_COPY_CLASS : null,
    ]
      .filter(Boolean)
      .join(' ');
    const cached = groupCache.get(id);
    if (
      (cached?.data.selected === true) === selected &&
      cached?.data.title === group.title &&
      (cached.data.locked === true) === locked &&
      cached.data.count === count &&
      cached.data.level === level &&
      cached.data.focused === focused &&
      sameLook(cached.data.look, look) &&
      sameClassName(cached.className, groupClass) &&
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
      // A locked group never starts a drag (054), like a locked card (043).
      draggable: !locked,
      dragHandle: `.${GROUP_HANDLE_CLASS}`,
      style: { pointerEvents: 'none' },
      focusable: false,
      // The label's connect handle starts connections (050 R6); the side handles opt out.
      connectable: true,
      ...(groupClass === '' ? {} : { className: groupClass }),
      ...(view.focus !== null && !inFocus
        ? { domAttributes: { 'aria-hidden': true, inert: true } }
        : {}),
      zIndex: -1,
      data: {
        title: group.title,
        count,
        level,
        focused,
        ...(selected ? { selected } : {}),
        ...(look === undefined ? {} : { look }),
        ...(locked ? { locked } : {}),
      },
    };
    groupCache.set(id, flowNode);
    return flowNode;
  });
}

function collapsedNodes(
  deck: SododeckFile,
  view: CanvasView,
  graph: VisibleGraph,
): CollapsedFlowNode[] {
  const groupsById = groupLookup(deck.groups);
  const lockedGroups = lockedGroupIds(deck);
  return graph.cards.map((card) => {
    const id = `${COLLAPSED_NODE_PREFIX}${card.groupId}`;
    const focused = view.focusedId === id;
    const selected = view.selection.groups.includes(card.groupId);
    const inFocus = view.focus?.members.has(id) === true;
    const dimmed = view.focus !== null && !inFocus;
    const flowInside = view.marks.cards.get(card.groupId);
    const flowNumber = view.marks.cardNumbers.get(card.groupId);
    const touchChip = view.marks.chips?.get(card.groupId);
    const look = resolveLook(
      groupsById.get(card.groupId)?.style,
      selected ? (view.stylePreview ?? undefined) : undefined,
    );
    const locked = lockedGroups.has(card.groupId);
    const lit = flowInside !== undefined || touchChip !== undefined;
    const className = [lit ? 'in-flow' : null, focusClass(view, id)].filter(Boolean).join(' ');
    const cached = collapsedCache.get(id);
    if (
      cached?.selected === selected &&
      (cached.data.locked === true) === locked &&
      cached.data.focused === focused &&
      cached.data.dimmed === dimmed &&
      cached.data.flowInside === flowInside &&
      cached.data.flowNumber === flowNumber &&
      cached.data.touchChip?.text === touchChip?.text &&
      sameLook(cached.data.look, look) &&
      sameClassName(cached.className, className) &&
      Boolean(cached.domAttributes?.['aria-hidden']) === dimmed &&
      cached.position.x === card.rect.x &&
      cached.position.y === card.rect.y &&
      cached.width === card.rect.width &&
      cached.height === card.rect.height &&
      cached.data.title === card.title &&
      cached.data.nodeCount === card.nodeCount &&
      cached.data.edgeCount === card.edgeCount &&
      sameMembers(cached.data.members, card.members)
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
      ...(locked ? { draggable: false } : {}),
      ...(className === '' ? {} : { className }),
      ...(dimmed ? { domAttributes: { 'aria-hidden': true, inert: true } } : {}),
      data: {
        groupId: card.groupId,
        title: card.title,
        nodeCount: card.nodeCount,
        edgeCount: card.edgeCount,
        members: card.members,
        focused,
        dimmed,
        ...(flowInside === undefined ? {} : { flowInside }),
        ...(flowNumber === undefined ? {} : { flowNumber }),
        ...(touchChip === undefined ? {} : { touchChip }),
        ...(look === undefined ? {} : { look }),
        ...(locked ? { locked } : {}),
      },
    };
    collapsedCache.set(id, flowNode);
    return flowNode;
  });
}

/** Cache-free proxy geometry for export; React Flow's identity caches stay untouched. */
export function exportPortRects(
  deck: SododeckFile,
  graph: VisibleGraph,
  level: Level = 'system',
): {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  label: string;
  kind: string;
  icon?: string;
  side: 'left' | 'right';
}[] {
  return proxyLayout(deck, graph, level).map((proxy) => ({
    id: proxy.id,
    rect: proxy.rect,
    label: proxy.title,
    kind: proxy.kind,
    ...(proxy.icon === undefined ? {} : { icon: proxy.icon }),
    side: proxy.side,
  }));
}

function portNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  level: Level = 'system',
): PortFlowNode[] {
  return exportPortRects(deck, graph, level).map((port) => {
    const { x, y } = port.rect;
    const outsideNodeId = port.id.slice(PORT_NODE_PREFIX.length);
    const cached = portCache.get(port.id);
    if (
      cached?.position.x === x &&
      cached.position.y === y &&
      cached.data.outsideNodeId === outsideNodeId &&
      cached.data.outsideTitle === port.label &&
      cached.data.kind === port.kind &&
      cached.data.icon === port.icon &&
      cached.data.side === port.side
    ) {
      return cached;
    }
    const flowNode: PortFlowNode = {
      id: port.id,
      type: 'port',
      position: { x, y },
      width: port.rect.width,
      height: port.rect.height,
      // A proxy stands for a card outside the scope: it is never moved, picked or connected.
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        outsideNodeId,
        outsideTitle: port.label,
        kind: port.kind,
        ...(port.icon === undefined ? {} : { icon: port.icon }),
        side: port.side,
      },
    };
    portCache.set(port.id, flowNode);
    return flowNode;
  });
}

/** "Inside <name> · n", on the drilled scope's top edge (034 R8); none at the top level. */
function scopeLabelNodes(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
): ScopeLabelFlowNode[] {
  const frame = graph.scope.node ?? graph.scope.group;
  if (frame === null || view.scopeTitle === undefined) return [];
  const bounds = scopeBounds(deck, graph, view.level);
  if (bounds === null) return [];
  const id = `${SCOPE_LABEL_PREFIX}${frame}`;
  const count = graph.nodes.length + graph.cards.reduce((sum, card) => sum + card.nodeCount, 0);
  const x = bounds.x;
  const y = bounds.y - SCOPE_LABEL_LIFT;
  const cached = scopeLabelCache.get(id);
  if (
    cached?.position.x === x &&
    cached.position.y === y &&
    cached.data.title === view.scopeTitle &&
    cached.data.count === count
  ) {
    return [cached];
  }
  const node: ScopeLabelFlowNode = {
    id,
    type: 'scope-label',
    position: { x, y },
    draggable: false,
    selectable: false,
    focusable: false,
    connectable: false,
    deletable: false,
    zIndex: 1,
    data: { title: view.scopeTitle, count },
  };
  scopeLabelCache.set(id, node);
  return [node];
}

function portNodesWithView(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
): PortFlowNode[] {
  return portNodes(deck, graph, view.level).map((port) => {
    const inFocus = view.focus?.members.has(port.id) === true;
    const dimmed = view.focus !== null && !inFocus;
    const className = focusClass(view, port.id);
    if (className === null && !dimmed) return port;
    return {
      ...port,
      ...(className === null ? {} : { className }),
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
  const tagColours = tagColourMap(deck.tagColors);
  const ports = portNodesWithView(deck, graph, view);
  const counts = tableCounts(deck);
  const dialect = dialectLabel(deckDialect(deck));
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
        tagColours,
        cardFieldView(deck, node),
        isDatabaseCard(node) ? { count: counts.get(node.id) ?? 0, dialect } : undefined,
      ),
    ];
  });
  const next: CanvasFlowNode[] = [
    ...groupNodes(deck, graph, view.level, view),
    ...scopeLabelNodes(deck, graph, view),
    ...collapsedNodes(deck, view, graph),
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
  const tagColours = tagColourMap(deck.tagColors);
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
    const locked = sticky.locked === true;
    // A locked note stays put (053); flow mode is view-only.
    const draggable = !flow.flowMode && !locked;
    const box = stickyBox(sticky, placement.point);
    const size = sticky.size ?? STICKY_DEFAULT_SIZE;
    const tagLooks = cardTagLooks(sticky.tags, tagColours);
    const fontSize = sticky.fontSize;
    const align = sticky.align ?? 'center';
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
      cached.data.size.width === size.width &&
      cached.data.size.height === size.height &&
      sameTagLooks(cached.data.tagLooks, tagLooks) &&
      cached.data.locked === locked &&
      cached.data.fontSize === fontSize &&
      cached.data.align === align &&
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
      width: box.width,
      height: box.height,
      zIndex: 1,
      connectable: true,
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
        size,
        tagLooks,
        locked,
        fontSize,
        align,
      },
    };
    stickyNodeCache.set(sticky, flowNode);
    return flowNode;
  });
}

/**
 * Picks the facing sides of two boxes by comparing their centres, so edges leave and enter where
 * it looks natural (017 R6: identical to the old position-based comparison for equal-size cards).
 */
export function facingSides(from: Box, to: Box): readonly [HandleSide, HandleSide] {
  return resolveSides(from, to);
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
  if (graph.cards.length === 0 && graph.ports.length === 0 && graph.groups.length === 0)
    return nodeTitleById;
  const titles = new Map(nodeTitleById);
  const groupsById = groupLookup(deck.groups);
  for (const groupId of graph.groups) {
    const group = groupsById.get(groupId);
    if (group !== undefined) titles.set(`${GROUP_NODE_PREFIX}${groupId}`, group.title);
  }
  for (const card of graph.cards) titles.set(`${COLLAPSED_NODE_PREFIX}${card.groupId}`, card.title);
  for (const port of graph.ports) titles.set(port.id, port.outsideTitle);
  return titles;
}

function fanOf(entry: PlainEdge | undefined): { index: number; count: number } | undefined {
  return entry?.fanIndex === undefined || entry.fanCount === undefined
    ? undefined
    : { index: entry.fanIndex, count: entry.fanCount };
}

function sameFan(
  a: { index: number; count: number } | undefined,
  b: { index: number; count: number } | undefined,
): boolean {
  return a === b || (a?.index === b?.index && a?.count === b?.count);
}

export function toFlowEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  view: CanvasView,
  overlay: FlowOverlay = EMPTY_OVERLAY,
  /** Parallel connectors folded into bundles (034); absent = every connector draws on its own. */
  bundles?: BundleResult,
): (DeckFlowEdge | MergedFlowEdge)[] {
  const lookups = deckLookups(deck);
  const plainInfo: ReadonlyMap<string, PlainEdge> | undefined =
    bundles === undefined
      ? undefined
      : new Map(bundles.plain.map((entry) => [entry.edgeId, entry]));
  const ports = portNodes(deck, graph, view.level);
  // Group frames are connector ends (050 R6); their boxes are only needed when one is drawn.
  const frames = graph.groups.length === 0 ? undefined : groupBounds(deck, view.level);
  // Notes that end a connector (053), boxed as they are drawn; none when notes are hidden.
  const notes = new Map<string, { box: Box; title: string }>();
  if (view.notesHidden !== true) {
    const stickiesById = new Map(deck.stickies.map((sticky) => [sticky.id, sticky]));
    for (const stickyId of graph.stickies) {
      const sticky = stickiesById.get(stickyId);
      if (sticky === undefined) continue;
      notes.set(`${STICKY_NODE_PREFIX}${stickyId}`, {
        box: stickyBox(sticky, stickyCanvasPosition(deck, sticky).point),
        title: stickyLabel(sticky.text) ?? 'Empty note',
      });
    }
  }
  const nodes =
    graph.cards.length === 0 && ports.length === 0 && frames === undefined && notes.size === 0
      ? lookups.edgeNodeViews
      : new Map(lookups.edgeNodeViews);
  if (nodes instanceof Map) {
    const groupsById = groupLookup(deck.groups);
    for (const groupId of graph.groups) {
      const group = groupsById.get(groupId);
      const rect = frames?.get(groupId);
      if (group === undefined || rect === undefined) continue;
      nodes.set(`${GROUP_NODE_PREFIX}${groupId}`, {
        position: { x: rect.x, y: rect.y },
        title: group.title,
      });
    }
    for (const card of graph.cards) {
      nodes.set(`${COLLAPSED_NODE_PREFIX}${card.groupId}`, {
        position: { x: card.rect.x, y: card.rect.y },
        title: card.title,
      });
    }
    for (const port of ports) {
      nodes.set(port.id, { position: port.position, title: port.data.outsideTitle });
    }
    for (const [flowId, note] of notes) {
      nodes.set(flowId, { position: { x: note.box.x, y: note.box.y }, title: note.title });
    }
  }
  const titles = representativeTitles(deck, graph);
  const selected = new Set(view.selection.edges);
  const cardsByGroupId = new Map(graph.cards.map((card) => [card.groupId, card]));
  const portsById = new Map(ports.map((port) => [port.id, port]));
  /**
   * A representative id's box (017 R6): a plain node, a group frame (050), a collapsed group card,
   * or a port pill.
   */
  function boxFor(id: string): Box | undefined {
    if (id.startsWith(GROUP_NODE_PREFIX)) return frames?.get(id.slice(GROUP_NODE_PREFIX.length));
    if (id.startsWith(COLLAPSED_NODE_PREFIX)) {
      return cardsByGroupId.get(id.slice(COLLAPSED_NODE_PREFIX.length))?.rect;
    }
    const note = notes.get(id);
    if (note !== undefined) return note.box;
    const port = portsById.get(id);
    if (port !== undefined)
      return {
        x: port.position.x,
        y: port.position.y,
        width: port.width ?? PROXY_SIZE.width,
        height: port.height ?? PROXY_SIZE.height,
      };
    const node = lookups.nodesById.get(id);
    const index = lookups.nodeIndexById.get(id);
    if (node === undefined || index === undefined) return undefined;
    return cardBox(node, index, view.level, {
      fields: cardFieldView(deck, node),
      table: tableContext,
    });
  }
  /** A plain end's shape geometry (031); frames, collapsed cards, notes and port pills are boxes. */
  function endGeometry(id: string): Geometry | undefined {
    if (id.startsWith(GROUP_NODE_PREFIX) || id.startsWith(COLLAPSED_NODE_PREFIX)) return undefined;
    if (portsById.has(id) || notes.has(id)) return undefined;
    const node = lookups.nodesById.get(id);
    return node === undefined ? undefined : (geometryOf(node) ?? undefined);
  }
  // Relationships (042): read the table layouts the cards are drawn with.
  const tableContext: TableContext = tableContextOf(deck);
  let display: ResolvedRelationshipDisplay | undefined;
  const relDisplay = () => (display ??= relationshipDisplayOf(deck));
  const isTable = (id: string) => {
    const node = lookups.nodesById.get(id);
    return node !== undefined && isDbTable(node);
  };
  function relationshipOf(edge: DeckEdgeObject): RelationshipData | undefined {
    if (!isRelationship(edge, isTable)) return undefined;
    const fromNode = lookups.nodesById.get(edge.from);
    const toNode = lookups.nodesById.get(edge.to);
    if (fromNode === undefined || toNode === undefined) return undefined;
    const { notation, hideEnds } = relDisplay();
    return {
      ends: relationshipEnds(
        edge,
        tableLayoutOf(fromNode, tableContext),
        tableLayoutOf(toNode, tableContext),
      ),
      rows: hasColumnEnds(edge) && rowsDrawn(view.level),
      self: edge.from === edge.to,
      notation,
      hideEnds,
      columns: { from: edge.fromColumns ?? [], to: edge.toColumns ?? [] },
    };
  }
  const plainEdges = graph.edges.flatMap((edgeId) => {
    const edge = lookups.edgesById.get(edgeId);
    if (edge === undefined) return [];
    if (plainInfo !== undefined && !plainInfo.has(edgeId)) return [];
    const fan = fanOf(plainInfo?.get(edgeId));
    // A card draws as itself; a group end draws on its frame (`group:<id>`, 050 R6).
    const fromId = graph.representative.get(edge.from) ?? edge.from;
    const toId = graph.representative.get(edge.to) ?? edge.to;
    const from = nodes.get(fromId);
    const to = nodes.get(toId);
    const fromBox = boxFor(fromId);
    const toBox = boxFor(toId);
    // The schema does not check references; a file may still point at missing nodes.
    if (!from || !to || fromBox === undefined || toBox === undefined) return [];
    // With free bends the automatic sides face the first and last bend (022 R4).
    const waypoints = edge.route?.waypoints;
    const autoHandles =
      waypoints === undefined
        ? resolveSides(fromBox, toBox, edge.route)
        : autoSides(
            fromBox,
            toBox,
            decodeWaypoints(waypoints, cardCentre(fromBox), cardCentre(toBox)),
            edge.route,
          );
    const isSelected = selected.has(edge.id);
    const focused = edge.id === view.focusedEdgeId;
    const dimmed = view.focus !== null && !view.focus.edges.has(edge.id);
    const inFocus = view.focus?.edges.has(edge.id) === true;
    const rel = relationshipOf(edge);
    const label =
      rel === undefined ? edge.label : relationshipLabel(edge, (id) => lookups.nodesById.get(id));
    const relLabel =
      rel === undefined
        ? undefined
        : relationshipLabelShown(relDisplay().labels, view.labelsOn, inFocus || isSelected);
    const hasLabel = label !== undefined && label !== '';
    const showLabel =
      relLabel === undefined
        ? (view.labelsOn && hasLabel) ||
          view.focus?.edges.has(edge.id) === true ||
          (fan !== undefined && hasLabel)
        : hasLabel && relLabel.show;
    const hoverLabel = hasLabel && relLabel?.hover === true;
    const mark = overlay.edges.get(edge.id);
    const problems = view.problems?.get(edge.id);
    const shape = edgeShape(edge);
    const fromGeometry = endGeometry(fromId);
    const toGeometry = endGeometry(toId);
    // Column ends sit on the left / right side facing the other table (R3); the handles only
    // keep React Flow's bookkeeping, `DeckEdge` draws from the row anchors.
    const [sourceHandle, targetHandle] =
      rel?.rows === true
        ? (() => {
            const sides = relationshipSides(fromBox, toBox, rel.self);
            return [sides.from, sides.to] as const;
          })()
        : autoHandles;
    const cached = edgeCache.get(edge);
    if (
      cached?.selected === isSelected &&
      sameRel(cached.data?.rel, rel) &&
      cached.data?.label === label &&
      (cached.data?.hoverLabel === true) === hoverLabel &&
      cached.source === fromId &&
      cached.target === toId &&
      cached.data?.shape === shape &&
      cached.data.fromGeometry === fromGeometry &&
      cached.data.toGeometry === toGeometry &&
      sameMark(cached.data.flow, mark) &&
      sameProblemMark(cached.data.problems, problems) &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      cached.data.showLabel === showLabel &&
      cached.data.focused === focused &&
      cached.data.inFocus === inFocus &&
      cached.data.dimmed === dimmed &&
      cached.data.fromTitle === from.title &&
      cached.data.toTitle === to.title &&
      cached.data.level === view.level &&
      sameSize(cached.data.fromSize, fromBox) &&
      sameSize(cached.data.toSize, toBox) &&
      sameFan(cached.data.fan, fan)
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
      // Row ends are moved by 042's column drag, not React Flow's handle-based reconnect.
      ...(rel?.rows === true ? { reconnectable: false } : {}),
      interactionWidth: 12,
      ariaLabel: [
        rel === undefined
          ? edgeName(from.title, to.title, edge.label)
          : relationshipName(edge, (id) => lookups.nodesById.get(id)),
        problems?.label,
      ]
        .filter(Boolean)
        .join(', '),
      data: {
        label,
        protocol: edge.protocol,
        direction: edge.direction ?? 'forward',
        showLabel,
        fromTitle: from.title,
        toTitle: to.title,
        focused,
        inFocus,
        dimmed,
        shape,
        level: view.level,
        routable: true,
        fromSize: { width: fromBox.width, height: fromBox.height },
        toSize: { width: toBox.width, height: toBox.height },
        ...(fromGeometry === undefined ? {} : { fromGeometry }),
        ...(toGeometry === undefined ? {} : { toGeometry }),
        ...(fan === undefined ? {} : { fan }),
        ...(mark === undefined ? {} : { flow: mark }),
        ...(problems === undefined ? {} : { problems }),
        ...(edge.route === undefined ? {} : { route: edge.route }),
        ...(edge.style === undefined ? {} : { style: edge.style }),
        ...(edge.labelAt === undefined ? {} : { labelAt: edge.labelAt }),
        ...(rel === undefined ? {} : { rel }),
        ...(hoverLabel ? { hoverLabel } : {}),
        ...(edge.locked === true ? { locked: true } : {}),
      },
    };
    edgeCache.set(edge, flowEdge);
    return [flowEdge];
  });
  const portEdges = graph.ports.flatMap((port) =>
    port.edgeIds.flatMap((edgeId) => {
      const edge = lookups.edgesById.get(edgeId);
      if (edge === undefined) return [];
      if (plainInfo !== undefined && !plainInfo.has(edgeId)) return [];
      const fan = fanOf(plainInfo?.get(edgeId));
      const insideNodeId = port.insideNodeIds.find(
        (nodeId) => edge.from === nodeId || edge.to === nodeId,
      );
      if (insideNodeId === undefined) return [];
      const representative = graph.representative.get(insideNodeId) ?? insideNodeId;
      const fromId = edge.from === insideNodeId ? representative : port.id;
      const toId = edge.to === insideNodeId ? representative : port.id;
      const from = nodes.get(fromId);
      const to = nodes.get(toId);
      const fromBox = boxFor(fromId);
      const toBox = boxFor(toId);
      if (from === undefined || to === undefined || fromBox === undefined || toBox === undefined)
        return [];
      const [sourceHandle, targetHandle] = facingSides(fromBox, toBox);
      const isSelected = selected.has(edge.id);
      const focused = edge.id === view.focusedEdgeId;
      const dimmed = view.focus !== null && !view.focus.edges.has(edge.id);
      const inFocus = view.focus?.edges.has(edge.id) === true;
      const showLabel =
        (view.labelsOn && edge.label !== undefined && edge.label !== '') ||
        view.focus?.edges.has(edge.id) === true ||
        (fan !== undefined && edge.label !== undefined && edge.label !== '');
      const mark = overlay.edges.get(edge.id);
      const shape = edgeShape(edge);
      const cached = edgeCache.get(edge);
      if (
        cached?.selected === isSelected &&
        cached.data?.shape === shape &&
        sameMark(cached.data.flow, mark) &&
        cached.source === fromId &&
        cached.target === toId &&
        cached.sourceHandle === sourceHandle &&
        cached.targetHandle === targetHandle &&
        cached.data.showLabel === showLabel &&
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
        cached.data.toTitle === to.title &&
        cached.data.level === view.level &&
        sameFan(cached.data.fan, fan)
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
          shape,
          level: view.level,
          routable: false,
          ...(fan === undefined ? {} : { fan }),
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
    const fromBox = boxFor(edge.a);
    const toBox = boxFor(edge.b);
    if (from === undefined || to === undefined || fromBox === undefined || toBox === undefined)
      return [];
    const [sourceHandle, targetHandle] = facingSides(fromBox, toBox);
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
      cached.data.level === view.level &&
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
        level: view.level,
        ...(flow === undefined ? {} : { flow }),
      },
    };
    mergedCache.set(edge.id, flowEdge);
    return [flowEdge];
  });
  const bundleEdgesOut = (bundles?.bundles ?? []).flatMap((bundle) => {
    const from = nodes.get(bundle.a);
    const to = nodes.get(bundle.b);
    const fromBox = boxFor(bundle.a);
    const toBox = boxFor(bundle.b);
    if (from === undefined || to === undefined || fromBox === undefined || toBox === undefined)
      return [];
    const [sourceHandle, targetHandle] = facingSides(fromBox, toBox);
    const focused = bundle.id === view.focusedEdgeId;
    const inFocus = view.focus?.edges.has(bundle.id) === true;
    const dimmed = view.focus !== null && !inFocus;
    const className = inFocus ? 'in-focus' : '';
    const name = `${String(bundle.edgeIds.length)} connections between ${titles.get(bundle.a) ?? bundle.a} and ${titles.get(bundle.b) ?? bundle.b}`;
    const cached = bundleCache.get(bundle.id);
    if (
      cached?.data !== undefined &&
      cached.data.name === name &&
      cached.data.count === bundle.edgeIds.length &&
      cached.data.direction === bundle.direction &&
      cached.data.fanned === bundle.fanned &&
      cached.data.focused === focused &&
      cached.data.inFocus === inFocus &&
      cached.data.level === view.level &&
      sameClassName(cached.className, className) &&
      Boolean(cached.domAttributes?.['aria-hidden']) === dimmed &&
      cached.source === bundle.a &&
      cached.target === bundle.b &&
      cached.sourceHandle === sourceHandle &&
      cached.targetHandle === targetHandle &&
      sameList(cached.data.edgeIds, bundle.edgeIds)
    ) {
      return [cached];
    }
    const flowEdge: MergedFlowEdge = {
      id: bundle.id,
      type: 'merged',
      source: bundle.a,
      target: bundle.b,
      sourceHandle,
      targetHandle,
      interactionWidth: 12,
      ...(className === '' ? {} : { className }),
      ...(dimmed ? { domAttributes: { 'aria-hidden': true } } : {}),
      ariaLabel: name,
      data: {
        kind: 'bundle',
        name,
        count: bundle.edgeIds.length,
        direction: bundle.direction,
        edgeIds: bundle.edgeIds,
        fanned: bundle.fanned,
        focused,
        inFocus,
        level: view.level,
      },
    };
    bundleCache.set(bundle.id, flowEdge);
    return [flowEdge];
  });
  const next = [...plainEdges, ...portEdges, ...mergedEdges, ...bundleEdgesOut];
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
