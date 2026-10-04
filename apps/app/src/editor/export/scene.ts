import {
  analyzeFlow,
  edgeLineStyle,
  edgeShape,
  type Geometry,
  stickyCanvasPosition,
  stickyLabel,
  tagKey,
} from '@sododeck/model';
import type { Direction, SododeckFile } from '@sododeck/schema';
import { nodeIcon, type ResolvedIcon } from '@sododeck/ui/icon-sets';

import type { DrillFrame } from '../../state/ui-store';
import { bundleEdges, type BundleResult } from '../bundles';
import {
  cardLayoutOf,
  displayPosition,
  geometryOf,
  groupBounds,
  type Rect,
} from '../canvas-geometry';
import { cardIconRef } from '../card-icon';
import { DECK_CARD, wrapText, type CardLayout } from '../card-layout';
import { cardTags, tagChips, textMeasurer, type TagChip } from '../card-tags';
import { tagColourMap } from '../tags/card-tag-looks';
import { collapseFlowMarks } from '../collapse-flow-marks';
import {
  COLLAPSED_NODE_PREFIX,
  exportPortRects,
  GROUP_NODE_PREFIX,
  groupCounts,
} from '../deck-to-flow';
import { flowOverlay, type EdgeFlowMark, type FlowOverlay } from '../flows/flow-overlay';
import { typeName } from '../type-label';
import { effectiveLevel, type Level } from '../levels';
import type { PathEnds, PathShape } from '../routing/route-path';
import { labelClamp } from '../editing/label-drag';
import { labelPoint, samplePath } from '../routing/connector-geometry';
import { lineCap, lineDash } from '../style/line-colour';
import { stickyFlowState, type NotesDisplay } from '../stickies/sticky-flow';
import { scopeOf, visibleGraph, type VisibleGraph } from '../visible-graph';
import { subtitleOf, viewStateOf } from '../views/view-state';
import {
  cardFieldView,
  EMPTY_FIELD_VIEW,
  fieldBlock,
  fieldChipBoxes,
  type CardFieldView,
  type FieldBlock,
  type FieldChip,
  type FieldChipBox,
  type FieldRow,
} from '../card-fields';
import { SHAPE_TITLE_FONT, titleBox } from '../shapes/shape-geometry';
import { shapeTitleLines } from '../shapes/shape-layout';
import { tableContextOf } from '../table-keys';
import { TABLE_CARD, type TableLayout } from '../table-layout';
import { edgePath } from './edge-geometry';
import { exportLineColour, exportLook, exportTagColours, type ExportLook } from './export-palette';
import { truncate, type TextMeasurer } from './text-measure';
import type { ImageScope } from './types';

/** The icon a node's tile draws; a node drawn as a shape keeps its type's (038). */
function iconOf(node: SododeckFile['nodes'][number]): ResolvedIcon {
  return nodeIcon({ icon: cardIconRef(node), type: node.type }).icon;
}

export const EXPORT_MARGIN = 32;
/** A sticky note in its one-line form (the canvas's collapsed note). */
export const STICKY_SIZE = { width: 180, height: 40 } as const;

export interface SceneCard {
  id: string;
  rect: Rect;
  /** The icon the header tile draws: the card's own or its type's (038). */
  icon: ResolvedIcon;
  /** The type name next to the header tile ("Service"). */
  typeName: string;
  title: string;
  /** The title as drawn: wrapped, clamped to `layout.titleLines`, the last line cut with "…". */
  titleLines: readonly string[];
  /** The trimmed description (the view's subtitle), or null when there is none. */
  description: string | null;
  descriptionLines: readonly string[];
  /** The first ten tags, and where each pill sits in the tag block. */
  tags: readonly string[];
  /** Each pill's box with its own tag's export colours (033), slate when it has none. */
  tagChips: readonly (TagChip & { chip: string; ink: string })[];
  /** Typed fields (032): header status, chip shelf, rows and "+N fields", laid out like the card. */
  fields: SceneFields;
  hasRules: boolean;
  childCount: number;
  level: Level;
  /** The same `cardLayout` the canvas used for this card; `rect` is its box. */
  layout: CardLayout;
  /** Drawn as a shape (031): its geometry; `titleLines` then wrap in its title box. */
  geometry?: Geometry;
  /** A table card's body (041): the same `tableLayout` the canvas draws (`layout.table`). */
  table?: TableLayout;
  fill?: string;
  stroke?: string;
  /** Tile and pill colours that follow the card colour; absent means the neutral ones. */
  chip?: string;
  ink?: string;
  /** The fill is a named colour, so the type name reads Secondary instead of Muted. */
  namedFill?: boolean;
  text: 'default' | 'dark' | 'light';
}

/** A field chip with its export colours: an option's own, else the card's tile (absent). */
export interface SceneFieldChip extends FieldChip {
  colours?: { chip: string; ink: string };
}

export interface SceneFields {
  header: SceneFieldChip | undefined;
  chips: readonly (FieldChipBox & { chip: SceneFieldChip })[];
  rows: readonly FieldRow[];
  hidden: number;
  block: FieldBlock;
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
  /** One tile per member on the fanned hand, in deck order. */
  memberIcons: readonly ResolvedIcon[];
  fill?: string;
  stroke?: string;
  chip?: string;
  ink?: string;
  text: 'default' | 'dark' | 'light';
}
export interface ScenePort {
  id: string;
  /** 150 × 52, placed by `proxyLayout` exactly as on the canvas (034 R7). */
  rect: Rect;
  label: string;
  /** The outside card's icon, for the proxy. */
  icon: ResolvedIcon;
}
export interface SceneBadge {
  label: string;
  errorPath: boolean;
}
/** Dash, weight and colour of a styled connector, already resolved for the light export. */
export interface SceneEdgeStyle {
  width: number;
  /** A literal colour (named colours use their light stroke), or null for the default grey. */
  colour: string | null;
  dash?: string;
  cap?: 'round';
}
export interface SceneEdge {
  id: string;
  path: string;
  /** The line type (`edgeShape`), already applied to `path`. */
  shape: PathShape;
  /** Which ends carry an arrow or a knob (`endMarks`). */
  direction: Direction;
  /** Start and end of the path (the card side midpoints). */
  source: { x: number; y: number };
  target: { x: number; y: number };
  /** Where the end marks sit and point, from `routedPath`. */
  ends: PathEnds;
  extent: Rect;
  labelPoint: { x: number; y: number };
  stroke: 'default' | 'flow' | 'flow-error';
  /** The connector's own look (022); absent for the default one. Flow strokes ignore it. */
  style?: SceneEdgeStyle;
  label: string | null;
  /** The label is a folded count ("×n"): drawn as the Ink pill, like the canvas (034). */
  count?: true;
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

/** The first `max` lines; when more follow, the last shown one is cut with "…" like the canvas's line clamp. */
function clampLines(
  lines: readonly string[],
  max: number,
  width: number,
  font: string,
  measure: TextMeasurer,
): string[] {
  if (lines.length <= max) return [...lines];
  const shown = lines.slice(0, max);
  const last = lines.slice(max - 1).join(' ');
  shown[max - 1] = truncate(last, font, width, measure);
  return shown;
}

/**
 * A table card (041 R11): header, one title line, the note lines and the column body, all from
 * the table's layout; no tags, fields or "n inside" row.
 */
function tableCard(
  node: SododeckFile['nodes'][number],
  index: number,
  layout: CardLayout,
  table: TableLayout,
  level: Level,
): SceneCard {
  const inner = layout.width - 2 * TABLE_CARD.paddingX;
  return {
    id: node.id,
    rect: { ...displayPosition(node, index), width: layout.width, height: layout.height },
    icon: iconOf(node),
    typeName: table.typeName,
    title: node.title,
    titleLines: [truncate(node.title, TABLE_CARD.titleFont, inner, textMeasurer())],
    description: table.noteLines.length === 0 ? null : table.noteLines.join(' '),
    descriptionLines: table.noteLines,
    tags: [],
    tagChips: [],
    fields: sceneFields(EMPTY_FIELD_VIEW, layout.width, inner, textMeasurer()),
    hasRules: false,
    childCount: 0,
    level,
    layout,
    table,
    ...(exportLook(node.style) ?? EMPTY_LOOK),
  };
}

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
/**
 * A shape's scene entry (031 R7): its box, geometry and title lines as the canvas wraps them;
 * no description, tags or fields (they stay in the drawer). The text shape takes no colour.
 */
function shapeCard(
  node: SododeckFile['nodes'][number],
  index: number,
  geometry: Geometry,
  layout: CardLayout,
  childCount: number,
  level: Level,
): SceneCard {
  const measure = textMeasurer();
  const size = { width: layout.width, height: layout.height };
  const width = titleBox(geometry, { x: 0, y: 0, ...size }).width;
  return {
    id: node.id,
    rect: { ...displayPosition(node, index), ...size },
    icon: iconOf(node),
    typeName: typeName(node.type),
    title: node.title,
    titleLines: clampLines(
      shapeTitleLines(geometry, size, node.title, measure),
      layout.titleLines,
      width,
      SHAPE_TITLE_FONT,
      measure,
    ),
    description: null,
    descriptionLines: [],
    tags: [],
    tagChips: [],
    // Shapes keep their typed fields in the drawer only (031 / 032).
    fields: sceneFields(EMPTY_FIELD_VIEW, layout.width, width, measure),
    hasRules: false,
    childCount,
    level,
    layout,
    geometry,
    ...((geometry === 'none' ? undefined : exportLook(node.style)) ?? EMPTY_LOOK),
  };
}

export function buildScene({ deck, scope, ui }: SceneInput): ExportScene {
  const view = scope === 'deck' ? null : viewStateOf(deck, ui.currentViewId, ui.revealed);
  const source = view?.deck ?? deck;
  const graph = visibleGraph(
    source,
    scopeOf(view === null ? [] : ui.drill),
    view?.collapsed ?? new Set(),
  );
  const level = effectiveLevel('container', graph.scope);
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
  const tagColours = tagColourMap(source.tagColors);
  const measure = textMeasurer();
  // Tables read their deck (keys, enums, display), from the whole deck as the canvas does (041).
  const tableContext = tableContextOf(deck);
  const cards: SceneCard[] = graph.nodes.flatMap((id) => {
    const entry = nodes.get(id);
    if (entry === undefined || !keep(id)) return [];
    const { node, index } = entry;
    const subtitle = (view === null ? node.tech : subtitleOf(node, view.render)) ?? null;
    const childCount = graph.childCount.get(id) ?? 0;
    // The box and the lines come from the canvas's own `cardLayout`, so a card exports at the size
    // it has on screen (029 R7).
    const fieldView = cardFieldView(source, node);
    const layout = cardLayoutOf(node, {
      description: subtitle ?? undefined,
      childCount,
      fields: fieldView,
      table: tableContext,
    });
    const geometry = geometryOf(node);
    if (geometry !== null) return [shapeCard(node, index, geometry, layout, childCount, level)];
    if (layout.table !== undefined) return [tableCard(node, index, layout, layout.table, level)];
    const inner = layout.width - 2 * DECK_CARD.paddingX;
    const description = subtitle?.trim() ?? '';
    const tags = cardTags(node.tags);
    return [
      {
        id,
        rect: { ...displayPosition(node, index), width: layout.width, height: layout.height },
        icon: iconOf(node),
        typeName: typeName(node.type),
        title: node.title,
        titleLines: clampLines(
          wrapText(node.title, inner, DECK_CARD.titleFont, measure),
          layout.titleLines,
          inner,
          DECK_CARD.titleFont,
          measure,
        ),
        description: description === '' ? null : description,
        descriptionLines:
          description === '' || layout.descriptionLines === 0
            ? []
            : clampLines(
                wrapText(description, inner, DECK_CARD.descriptionFont, measure),
                layout.descriptionLines,
                inner,
                DECK_CARD.descriptionFont,
                measure,
              ),
        tags,
        tagChips: tagChips(tags, inner, measure).map((box) => ({
          ...box,
          ...exportTagColours(tagColours.get(tagKey(box.tag))),
        })),
        fields: sceneFields(fieldView, layout.width, inner, measure),
        hasRules: (node.rules?.length ?? 0) > 0,
        childCount,
        level,
        layout,
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
      memberIcons: card.members.map(
        (member) => nodeIcon({ icon: member.icon, type: member.kind }).icon,
      ),
      ...(exportLook(groupsById.get(card.groupId)?.style) ?? EMPTY_LOOK),
    }));
  const ports: ScenePort[] = exportPortRects(source, graph)
    .filter((port) => keep(port.id))
    .map(({ id, rect, label, kind, icon }) => ({
      id,
      rect,
      label,
      icon: nodeIcon({ icon, type: kind }).icon,
    }));
  // Parallel connectors export folded, as on the canvas; hover and focus are UI state and never
  // reach a file. A flow's own connectors stay out of the bundles (034 R9).
  const bundles = bundleEdges(source, graph, {
    exclude: overlay === null ? new Set() : new Set(overlay.edges.keys()),
    fanned: new Set(),
    off: false,
  });

  const rects = new Map<string, Rect>([
    ...cards.map((card) => [card.id, card.rect] as const),
    ...collapsed.map((card) => [`${COLLAPSED_NODE_PREFIX}${card.id}`, card.rect] as const),
    ...ports.map((port) => [port.id, port.rect] as const),
  ]);

  const groups = sceneGroups(source, graph, level, cards, inFlow);
  // Group frames are connector ends too (050 R6).
  for (const group of groups) rects.set(`${GROUP_NODE_PREFIX}${group.id}`, group.rect);
  // Shape ends meet the outline (031), as on the canvas.
  const shapeEnds = new Map(
    cards.flatMap((card) =>
      card.geometry === undefined ? [] : [[card.id, card.geometry] as const],
    ),
  );
  const edges = sceneEdges(source, graph, rects, overlay, bundles, shapeEnds);

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
  level: Level,
  cards: readonly SceneCard[],
  /** Flow scope: the drawn ids the flow travels through; null outside it. */
  inFlow: ReadonlySet<string> | null,
): SceneGroup[] {
  const frames = groupBounds(deck, level);
  const counts = groupCounts(deck);
  const byId = new Map(deck.groups.map((group) => [group.id, group]));
  const nodeGroup = new Map(deck.nodes.map((node) => [node.id, node.group]));
  // Flow scope: only the frames around a kept card, the frames a step ends on (050 R6), and their
  // ancestors.
  const withCard = new Set<string>();
  const keepWithAncestors = (start: string | undefined) => {
    let group = start;
    while (group !== undefined && !withCard.has(group)) {
      withCard.add(group);
      group = byId.get(group)?.parent;
    }
  };
  for (const card of cards) keepWithAncestors(nodeGroup.get(card.id));
  for (const id of inFlow ?? []) {
    if (id.startsWith(GROUP_NODE_PREFIX)) keepWithAncestors(id.slice(GROUP_NODE_PREFIX.length));
  }
  const flowOnly = inFlow !== null;
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

/** The own look of a connector for the light export, or undefined when it has none. */
function sceneStyle(style: SododeckFile['edges'][number]['style']): SceneEdgeStyle | undefined {
  if (style === undefined) return undefined;
  const own = edgeLineStyle({ style });
  const colour = own.color === null ? null : exportLineColour(own.color);
  if (own.dash === 'solid' && own.width === 2 && colour === null) return undefined;
  const dash = lineDash(own.dash, own.width);
  const cap = lineCap(own.dash);
  return {
    width: own.width,
    colour,
    ...(dash === undefined ? {} : { dash }),
    ...(cap === undefined ? {} : { cap }),
  };
}

function sceneEdges(
  deck: SododeckFile,
  graph: VisibleGraph,
  rects: ReadonlyMap<string, Rect>,
  overlay: FlowOverlay | null,
  bundles: BundleResult,
  shapeEnds: ReadonlyMap<string, Geometry>,
): SceneEdge[] {
  const drawnAlone = new Set(bundles.plain.map((entry) => entry.edgeId));
  const byId = new Map(deck.edges.map((edge) => [edge.id, edge]));
  const edges: SceneEdge[] = [];
  const add = (
    id: string,
    from: string,
    to: string,
    label: string | null,
    direction: Direction,
    shape: PathShape,
    memberIds: readonly string[],
    route?: SododeckFile['edges'][number]['route'],
    style?: SododeckFile['edges'][number]['style'],
    labelAt?: number,
    count?: true,
  ) => {
    const a = rects.get(from);
    const b = rects.get(to);
    if (a === undefined || b === undefined) return;
    const marks = memberIds.flatMap((memberId) => overlay?.edges.get(memberId) ?? []);
    if (overlay !== null && marks.length === 0) return;
    const geometry = edgePath(a, b, route, shape, direction, {
      fromGeometry: shapeEnds.get(from),
      toGeometry: shapeEnds.get(to),
    });
    const badgeCount = marks.reduce((sum, mark) => sum + mark.badges.length, 0);
    // The label at its stored fraction of the drawn line, as on the canvas (022 R10).
    const spot =
      labelAt === undefined
        ? { x: geometry.labelX, y: geometry.labelY }
        : labelPoint(samplePath(geometry.path), labelAt, labelClamp(label, badgeCount));
    edges.push({
      id,
      path: geometry.path,
      shape,
      direction,
      source: geometry.source,
      target: geometry.target,
      ends: geometry.ends,
      extent: geometry.extent,
      labelPoint: spot,
      stroke: strokeOf(marks),
      ...(sceneStyle(style) === undefined ? {} : { style: sceneStyle(style) }),
      label,
      ...(count === undefined ? {} : { count }),
      badges: marks.flatMap((mark) =>
        mark.badges.map((badge) => ({ label: badge.label, errorPath: badge.errorPath })),
      ),
    });
  };
  for (const id of graph.edges) {
    const edge = byId.get(id);
    if (edge === undefined || !drawnAlone.has(id)) continue;
    const direction = edge.direction ?? 'forward';
    // A card draws as itself, a group end on its frame (`group:<id>`, 050 R6).
    add(
      id,
      graph.representative.get(edge.from) ?? edge.from,
      graph.representative.get(edge.to) ?? edge.to,
      edge.label || null,
      direction,
      edgeShape(edge),
      [id],
      edge.route,
      edge.style,
      edge.labelAt,
    );
  }
  // Edges that leave a drilled scope end at the outside component's port pill, as on the canvas.
  for (const port of graph.ports) {
    for (const edgeId of port.edgeIds) {
      const edge = byId.get(edgeId);
      const inside = port.insideNodeIds.find((id) => id === edge?.from || id === edge?.to);
      if (edge === undefined || inside === undefined || !drawnAlone.has(edgeId)) continue;
      const representative = graph.representative.get(inside) ?? inside;
      const from = edge.from === inside ? representative : port.id;
      const to = edge.to === inside ? representative : port.id;
      add(edge.id, from, to, edge.label || null, edge.direction ?? 'forward', edgeShape(edge), [
        edge.id,
      ]);
    }
  }
  // A merged edge (to a collapsed group) shows its count, like the canvas's "×n" pill.
  for (const merged of graph.merged) {
    const [from, to] = merged.direction === 'b-to-a' ? [merged.b, merged.a] : [merged.a, merged.b];
    // Curved, with a knob to an arrow (or two arrows), as the canvas's merged connector.
    add(
      merged.id,
      from,
      to,
      `×${String(merged.edgeIds.length)}`,
      merged.direction === 'both' ? 'both' : 'forward',
      'curved',
      merged.edgeIds,
      undefined,
      undefined,
      undefined,
      true,
    );
  }
  // A bundle of parallel connectors: one curve with the same "×n" pill (034).
  for (const bundle of bundles.bundles) {
    const [from, to] = bundle.direction === 'b-to-a' ? [bundle.b, bundle.a] : [bundle.a, bundle.b];
    add(
      bundle.id,
      from,
      to,
      `×${String(bundle.edgeIds.length)}`,
      bundle.direction === 'both' ? 'both' : 'forward',
      'curved',
      bundle.edgeIds,
      undefined,
      undefined,
      undefined,
      true,
    );
  }
  return edges;
}

function withColours(chip: FieldChip): SceneFieldChip {
  return chip.kind === 'select' || chip.kind === 'status'
    ? { ...chip, colours: exportTagColours(chip.color) }
    : chip;
}

/** A card's fields for the image (032): the same view and block geometry the canvas uses. */
function sceneFields(
  view: CardFieldView,
  cardWidth: number,
  inner: number,
  measure: TextMeasurer,
): SceneFields {
  return {
    header: view.header === undefined ? undefined : withColours(view.header),
    chips: fieldChipBoxes(view.chips, inner, measure).map((box) => ({
      ...box,
      chip: withColours(box.chip),
    })),
    rows: view.rows,
    hidden: view.hidden,
    block: fieldBlock(view, cardWidth, measure),
  };
}
