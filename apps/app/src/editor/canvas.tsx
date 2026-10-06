import {
  analyzeFlow,
  canvasBackgroundOf,
  deckPacks,
  isDbTable,
  observeDeck,
} from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { resolveMotion } from '@sododeck/ui/lib/motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useStore,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import {
  addTable,
  CANVAS_ATTR,
  canvasElement,
  isReturningFocus,
  nodeElement,
} from './canvas-actions';
import { bundleEdges, bundleOptions } from './bundles';
import { BACKGROUND_GAP, backgroundVariant, canvasBackgroundVars } from './canvas-background';
import { cardBox, groupBounds, CARD_SIZE_LIMITS, nearestToCentre } from './canvas-geometry';
import { collapseFlowMarks } from './collapse-flow-marks';
import { ConnectPopover } from './connect-popover';
import { CollapsedGroupNode } from './collapsed-group-node';
import { focusTargetId } from './focus-target';
import { DeckEdge } from './deck-edge';
import { minimapFill, minimapStroke } from './minimap-colors';
import { DeckNode } from './deck-node';
import {
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  PORT_NODE_PREFIX,
  toFlowEdges,
  toFlowNodes,
  toStickyNodes,
  toImageNodes,
  stackImages,
  rowsDrawn,
  type CanvasFlowNode,
  type DeckEdgeData,
} from './deck-to-flow';
import { EdgePopover } from './edge-popover';
import { EnumPopover } from './table/enum-popover';
import { EmptyCanvasCard } from './empty-canvas-card';
import { playbackOf } from './flows/flow-mode';
import { EMPTY_OVERLAY, flowOverlay, type PlaybackMarks } from './flows/flow-overlay';
import { InvalidEdgePopover } from './flows/invalid-edge-popover';
import { findFlow } from './flows/session-path';
import { StepPlayer } from './flows/step-player';
import { useFlowViewport } from './flows/use-flow-viewport';
import { connectionCount, connectionsText, focusSet } from './focus-set';
import { HoverFocusStyle } from './hover-focus/hover-focus-style';
import { SelectedRelationshipStyle } from './hover-focus/selected-relationship-style';
import { setColumnDragEnv } from './editing/column-connect-drag';
import { ColumnConnectLine } from './editing/column-connect-line';
import { targetTablesOf, type TargetTable } from './relationships/column-target';
import { useHoverFocus } from './hover-focus/use-hover-focus';
import { GroupBoundaryNode } from './group-boundary-node';
import { effectiveLevel, levelForZoom, levelSelector, type Level } from './levels';
import { MergedEdge } from './merged-edge';
import { MergedEdgePopover } from './merged-edge-popover';
import { ProblemFixPopover } from './problems/problem-fix-popover';
import { OutsideProxyNode } from './outside-proxy-node';
import { proxyLayout } from './proxy-layout';
import { ScopeLabelNode } from './scope-label-node';
import { EndpointConnectionLine } from './routing/endpoint-connection-line';
import { SelectionFrame } from './selection-frame';
import { useStickyDraftLifecycle } from './stickies/sticky-actions';
import { ImageNode } from './images/image-node';
import { StickyNode } from './stickies/sticky-node';
import { useCanvasHandlers } from './use-canvas-handlers';
import { GuidesOverlay } from './editing/guides-overlay';
import { MarqueeChip } from './editing/marquee-chip';
import { FrameDrawLayer } from './frame-tool/frame-draw-layer';
import { useClipboardEvents } from './editing/use-clipboard-events';
import { useGuideSafetyNet } from './editing/use-guide-safety-net';
import { useMarqueeEdges } from './editing/use-marquee-edges';
import { drillScopeTitle } from './outline';
import { useCanvasKeyDown } from './use-canvas-shortcuts';
import { scopeBounds, scopeOf, validDrillDepth, visibleGraph } from './visible-graph';
import { collapsedOf, readViewState, useViewState } from './views/use-current-view';
import { viewCrumbTitle } from './views/view-title';
import { useCurrentViewSync } from './views/use-view-sync';
import { useUndoAcrossViews } from './views/undo-context';
import { PANEL_COLLAPSED as JSON_COLLAPSED } from './panel-height';
import { MAX_ZOOM, MIN_ZOOM } from './zoom-limits';
import { EDGE, ISLAND_HEIGHT, STACK_GAP, zoomIslandBottom } from './shell/shell-geometry';
import { useDrawerWidths } from './shell/use-drawer-widths';
import { problemMarks } from './problems/problem-marks';
import { ShapeNode } from './shapes/shape-node';
import { useProblems } from './problems/use-problems';

const nodeTypes: NodeTypes = {
  'collapsed-group': CollapsedGroupNode,
  deck: DeckNode,
  'group-boundary': GroupBoundaryNode,
  port: OutsideProxyNode,
  'scope-label': ScopeLabelNode,
  shape: ShapeNode,
  sticky: StickyNode,
  image: ImageNode,
};
const edgeTypes: EdgeTypes = {
  deck: DeckEdge,
  merged: MergedEdge,
};

/** Cards narrower than 80 px on screen hide their details button (019 FR-018). */
/** Text is unreadable below this; a resized card can be as narrow as the minimum (017 R4). */
const tinyCardsSelector = (s: { transform: [number, number, number] }) =>
  s.transform[2] * CARD_SIZE_LIMITS.min.width < 80;

/**
 * Below 60 % zoom the lip is gone (029 R8, §g-63): one boolean for the wrapper, read by CSS, so
 * crossing 60 % re-renders no card (the level boundaries are 30 %, 50 % and 150 %).
 */
export const liplessSelector = (s: { transform: [number, number, number] }) => s.transform[2] < 0.6;

/** With the Select tool only the middle mouse button pans (plus Space+drag, React Flow's default). */
const PAN_BUTTONS = [1];

/** Focus arriving within this long after a key press counts as keyboard navigation. */
const KEY_FOCUS_WINDOW_MS = 100;

const connectionLineStyle = {
  stroke: 'var(--color-primary)',
  strokeWidth: 1.5,
  strokeDasharray: '5 4',
};

export interface CanvasProps {
  onlyRenderVisibleElements?: boolean;
  onReady?: () => void;
}

/** Keeps drill/collapse state pointing at existing, non-empty scopes after document removals. */
function useViewSync(): void {
  const editor = useEditor();

  useEffect(
    () =>
      observeDeck(editor.doc, ({ changes }) => {
        if (
          !changes.some(
            (c) => c.kind === 'removed' && (c.scope === 'nodes' || c.scope === 'groups'),
          )
        ) {
          return;
        }
        const deck = readViewState(editor.doc).deck;
        const ui = useUiStore.getState();
        const before = ui.drill;
        ui.pruneView({
          nodes: new Set(deck.nodes.map((node) => node.id)),
          groups: new Set(deck.groups.map((group) => group.id)),
        });
        let changed = useUiStore.getState().drill.length < before.length;
        const drill = useUiStore.getState().drill;
        const depth = validDrillDepth(deck, drill);
        if (depth < drill.length) {
          ui.drillUp(depth);
          changed = true;
        }
        if (changed)
          ui.announce(
            `Went up to ${drillScopeTitle(deck, useUiStore.getState().drill, viewCrumbTitle(readViewState(editor.doc).view))}`,
          );
      }),
    [editor.doc],
  );
}

/** Keeps UI state pointing at objects that still exist; selects what undo/redo brings back. */
function useSelectionSync(): void {
  const editor = useEditor();

  useEffect(
    () =>
      observeDeck(editor.doc, ({ origin, changes }) => {
        const ui = useUiStore.getState();
        // Only removals can leave dangling ids (not the moves of a drag, which are most changes).
        if (
          changes.some(
            (c) =>
              c.kind === 'removed' &&
              (c.scope === 'nodes' ||
                c.scope === 'edges' ||
                c.scope === 'groups' ||
                c.scope === 'stickies' ||
                c.scope === 'images'),
          )
        ) {
          const deck = readDeck(editor.doc);
          ui.pruneSelection({
            nodes: new Set(deck.nodes.map((n) => n.id)),
            edges: new Set(deck.edges.map((e) => e.id)),
            groups: new Set(deck.groups.map((group) => group.id)),
            stickies: new Set(deck.stickies.map((s) => s.id)),
            images: new Set((deck.images ?? []).map((i) => i.id)),
          });
        }
        // Restored objects may be off-screen: select them so the user can find them.
        if (origin !== 'undo' && origin !== 'redo') return;
        const added = (scope: 'nodes' | 'edges') =>
          changes.filter((c) => c.scope === scope && c.kind === 'added').map((c) => c.id);
        const nodes = added('nodes');
        const edges = added('edges');
        if (nodes.length > 0 || edges.length > 0) ui.select({ nodes, edges });
      }),
    [editor.doc],
  );
}

/** The rendered card nearest the middle of the canvas, by its on-screen box. */
function nearestVisibleCard(root: HTMLElement): string | null {
  const box = root.getBoundingClientRect();
  const cards = [...root.querySelectorAll<HTMLElement>('[data-testid="deck-node"]')].flatMap(
    (element) => {
      const id = element.dataset.nodeId;
      return id === undefined ? [] : [{ id, rect: element.getBoundingClientRect() }];
    },
  );
  return nearestToCentre(cards, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
}

/**
 * Roving focus (research R3): the canvas is one Tab stop. Keyboard focus follows `focusedId`
 * while focus is inside the canvas, and the focused node is panned into view.
 */
function useRovingFocus(wrapper: React.RefObject<HTMLDivElement | null>): void {
  const editor = useEditor();
  const focusedId = useUiStore((s) => s.focusedId);
  const { getViewport, setCenter } = useReactFlow();

  useEffect(() => {
    const root = wrapper.current;
    if (focusedId === null || !root?.contains(document.activeElement)) return;
    const deck = readViewState(editor.doc).deck;
    const ui = useUiStore.getState();
    const { zoom: currentZoom } = getViewport();
    const scope = scopeOf(ui.drill);
    const level = effectiveLevel(levelForZoom(currentZoom), scope);
    const graph = visibleGraph(deck, scope, collapsedOf(editor.doc));
    const point = (() => {
      if (focusedId.startsWith(GROUP_NODE_PREFIX)) {
        const groupId = focusedId.slice(GROUP_NODE_PREFIX.length);
        const rect = groupBounds(deck, level).get(groupId);
        return rect === undefined ? null : { x: rect.x, y: rect.y, width: 1, height: 1 };
      }
      if (focusedId.startsWith(PORT_NODE_PREFIX)) {
        return (
          proxyLayout(deck, graph, level).find((proxy) => proxy.id === focusedId)?.rect ?? null
        );
      }
      if (focusedId.startsWith(COLLAPSED_NODE_PREFIX)) {
        const groupId = focusedId.slice(COLLAPSED_NODE_PREFIX.length);
        const card = graph.cards.find((entry) => entry.groupId === groupId);
        return card?.rect ?? null;
      }
      const index = deck.nodes.findIndex((n) => n.id === focusedId);
      const node = index < 0 ? undefined : deck.nodes[index];
      if (node === undefined) return null;
      return cardBox(node, index, level);
    })();
    if (point === null) return;
    const { x: vx, y: vy, zoom } = getViewport();
    const left = point.x * zoom + vx;
    const top = point.y * zoom + vy;
    const outside =
      left < 0 ||
      top < 0 ||
      left + point.width * zoom > root.clientWidth ||
      top + point.height * zoom > root.clientHeight;
    if (outside && root.clientWidth > 0) {
      void setCenter(point.x + point.width / 2, point.y + point.height / 2, { zoom });
    }
    const element = nodeElement(focusedId);
    // Focus already inside the card (its title field, 019) stays there.
    if (element && !element.contains(document.activeElement))
      element.focus({ preventScroll: true });
  }, [focusedId, editor.doc, getViewport, setCenter, wrapper]);
}

/**
 * The diagram canvas. React Flow is fully controlled: nodes and edges are derived on every render
 * from the deck snapshot and UI state, every edit goes through the editor (research R1–R4), and
 * React Flow's own keyboard and delete handling is off (roving focus, confirmation instead).
 */
export function Canvas({ onlyRenderVisibleElements = false, onReady }: CanvasProps) {
  const editor = useEditor();
  const fullDeck = useDeckSnapshot(editor.doc);
  // The canvas draws the deck as the current view shows it (011, ADR 0012 §6).
  const viewState = useViewState();
  const deck = viewState.deck;
  const render = viewState.render;
  // The deck's canvas background (ADR 0044): the whole deck's setting, whatever the view.
  const background = canvasBackgroundOf(fullDeck);
  const variant = backgroundVariant(background.pattern);
  const backgroundStyle = useMemo(() => canvasBackgroundVars(background.color), [background.color]);
  // Collapsed groups are saved per view (011 FR-050).
  const collapsed = viewState.collapsed;
  const selection = useUiStore((s) => s.selection);
  const drill = useUiStore((s) => s.drill);
  const focusMode = useUiStore((s) => s.focusMode);
  const minimap = useUiStore((s) => s.minimap);
  const jsonShown = useUiStore((s) => s.jsonShown);
  const jsonHeight = useUiStore((s) => (s.jsonPanel.open ? s.jsonPanel.height : JSON_COLLAPSED));
  const minimapBottom = zoomIslandBottom(jsonShown, jsonHeight) + ISLAND_HEIGHT + STACK_GAP;
  const hideUi = useUiStore((s) => s.hideUi);
  const hand = useUiStore((s) => s.tool === 'hand');
  const frameTool = useUiStore((s) => s.tool === 'frame');
  const { stack: drawerWidth } = useDrawerWidths();
  const minimapRight = drawerWidth === null ? EDGE : EDGE + drawerWidth + EDGE;
  const playerStyle = {
    ...(drawerWidth === null ? {} : { left: `calc(50% - ${String((drawerWidth + EDGE) / 2)}px)` }),
    ...(jsonShown ? { bottom: zoomIslandBottom(true, jsonHeight) - EDGE } : {}),
  };
  const focusedId = useUiStore((s) => s.focusedId);
  const focusedEdgeId = useUiStore((s) => s.focusedEdgeId);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const activeFlow = useUiStore((s) => s.activeFlow);
  const session = useUiStore((s) => s.flowSession);
  const hoverEdgeId = useUiStore((s) => s.hoverEdgeId);
  const { setCenter, setViewport, getZoom, getViewport, screenToFlowPosition } = useReactFlow();
  const { dimMs } = resolveMotion(useReducedMotion());
  const wrapper = useRef<HTMLDivElement>(null);
  // The column row under the pointer (042), so moving inside one row does nothing.
  const hoveredRow = useRef<string | null>(null);
  // Set by a pointer press: focus that lands on the wrapper from a click must not move focus to a
  // card (and pan to it); only Tab into the canvas does.
  const pointerFocus = useRef(false);
  // When the user last pressed a navigation key in the canvas: only focus that follows an arrow or
  // Tab is read out (034), not focus a command moves (a rename announces "Renamed …" instead).
  const lastKeyAt = useRef(Number.NEGATIVE_INFINITY);
  const previousDrill = useRef(drill);
  const announcedZoomLevel = useRef<Level | null>(null);
  // Coming back from the rule editor restores where the canvas was (008 FR-018).
  const [restored] = useState(() => useUiStore.getState().canvasViewport);
  const zoomLevel = useStore(levelSelector);
  // One boolean for the whole canvas: cards never subscribe to the zoom (019 R4).
  const tinyCards = useStore(tinyCardsSelector);
  const lipless = useStore(liplessSelector);
  const dragging = useUiStore((s) => s.canvasGesture === 'drag');
  useEffect(
    () => () => {
      useUiStore.getState().setCanvasViewport(getViewport());
    },
    [getViewport],
  );
  const handlers = useCanvasHandlers();
  const onKeyDown = useCanvasKeyDown();
  const hover = useHoverFocus();

  useSelectionSync();
  useViewSync();
  useCurrentViewSync();
  useUndoAcrossViews();
  useRovingFocus(wrapper);
  useStickyDraftLifecycle();
  // ⌘C / ⌘X / ⌘V through the platform clipboard events (016 R9).
  useClipboardEvents();
  // No guide or connector preview outlives its gesture (050 R9).
  useGuideSafetyNet();
  // ⌥ held during a marquee switches it to "touch" selection (016 R13). Only while a marquee
  // runs, so the prop (which re-renders React Flow) does not change for other ⌥ keys.
  const marqueeRunning = useUiStore((s) => s.canvasGesture === 'marquee');
  const [touchSelect, setTouchSelect] = useState(false);
  useEffect(() => {
    if (!marqueeRunning) return;
    const onKey = (event: KeyboardEvent) => {
      setTouchSelect(event.altKey);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      setTouchSelect(false);
    };
  }, [marqueeRunning]);
  // React Flow's marquee catches cards only; connectors it catches are added here.
  useMarqueeEdges(marqueeRunning);

  // The shown or recorded flow's marks (006): badges, candidates, preview, invalid, start ring.
  const flow = findFlow(deck, session?.flowId ?? activeFlow?.flowId ?? null);
  const analysis = useMemo(
    () => (flow === undefined ? null : analyzeFlow(flow, deck.edges)),
    [flow, deck.edges],
  );
  // Flow mode (007): a flow is open without a session; the canvas becomes view-only.
  const flowMode = isFlowMode({ activeFlow, flowSession: session });
  const playback = useMemo(
    () =>
      flowMode && flow !== undefined && activeFlow !== null
        ? playbackOf(deck, flow, activeFlow.alternativeId, activeFlow.stepId)
        : null,
    [flowMode, deck, flow, activeFlow],
  );
  const speed = activeFlow?.speed ?? 1;
  const marks = useMemo<PlaybackMarks | null>(
    () =>
      playback === null
        ? null
        : {
            played: new Set(playback.played.steps.map((s) => s.step.id)),
            currentStepId: playback.currentStepId,
            speed,
          },
    [playback, speed],
  );
  const activeStepId = playback === null ? (activeFlow?.stepId ?? null) : playback.currentStepId;
  const emptyFlow = flowMode && playback?.view === null;
  const notesDisplay = useUiStore((s) => s.notesDisplay);
  const overlay = useMemo(
    () =>
      analysis === null && session === null
        ? EMPTY_OVERLAY
        : flowOverlay(
            deck,
            analysis,
            session,
            session === null ? null : hoverEdgeId,
            activeStepId,
            marks,
          ),
    [deck, analysis, session, hoverEdgeId, activeStepId, marks],
  );
  useFlowViewport(deck, playback, wrapper);
  const scope = useMemo(() => scopeOf(drill), [drill]);
  const outside = viewState.outside;
  const graph = useMemo(
    () => visibleGraph(deck, scope, collapsed, outside),
    [deck, scope, collapsed, outside],
  );
  const level = useMemo(() => effectiveLevel(zoomLevel, scope), [zoomLevel, scope]);
  // Relationship drags (042) read the drawn tables' boxes and rows, computed once per drag frame.
  useEffect(() => {
    let tables: readonly TargetTable[] | null = null;
    setColumnDragEnv({
      toFlow: (point) => screenToFlowPosition(point),
      tables: () => (tables ??= targetTablesOf(deck, new Set(graph.nodes), level)),
      editor,
    });
    return () => {
      setColumnDragEnv(null);
    };
  }, [deck, graph, level, editor, screenToFlowPosition]);
  const focusId = useMemo(
    () => (focusMode ? focusTargetId(selection, collapsed) : null),
    [focusMode, selection, collapsed],
  );
  // Parallel automatic connectors fold into bundles (034). A shown flow draws its own connectors
  // on their own; recording a flow turns bundles off so every connector is a candidate step.
  const fannedBundles = useUiStore((s) => s.fannedBundles);
  const flowShown = activeFlow !== null;
  const recordingFlow = session !== null;
  const bundles = useMemo(
    () =>
      bundleEdges(
        deck,
        graph,
        bundleOptions(
          { shown: flowShown, recording: recordingFlow, markedEdges: overlay.edges.keys() },
          fannedBundles,
          rowsDrawn(level),
        ),
      ),
    [deck, graph, flowShown, recordingFlow, overlay, fannedBundles, level],
  );
  useEffect(() => {
    const ui = useUiStore.getState();
    ui.pruneFannedBundles(new Set(bundles.bundles.map((bundle) => bundle.id)));
    if (ui.focusedEdgeId?.startsWith('bundle:') === true) {
      if (!bundles.bundles.some((bundle) => bundle.id === ui.focusedEdgeId)) ui.focusEdge(null);
    }
  }, [bundles]);
  // A focused proxy (034) is dropped when the drill-in changes and it no longer exists.
  const proxyIds = useMemo(
    () => new Set(proxyLayout(deck, graph, level).map((proxy) => proxy.id)),
    [deck, graph, level],
  );
  useEffect(() => {
    const ui = useUiStore.getState();
    if (ui.focusedId?.startsWith('port:') === true && !proxyIds.has(ui.focusedId)) ui.focus(null);
  }, [proxyIds]);
  const focus = useMemo(
    () => (focusId !== null ? focusSet(deck, graph, focusId, bundles) : null),
    [focusId, deck, graph, bundles],
  );
  const collapsedMarks = useMemo(() => collapseFlowMarks(overlay, graph), [overlay, graph]);
  const problems = problemMarks(useProblems());
  const stylePreview = useUiStore((s) => s.stylePreview);
  // The copies of an ⌥ duplicate-drag carry the drag lift (051 R2).
  const dragCopyIds = useUiStore((s) => s.dragCopyIds);
  const scopeTitle = useMemo(
    () => (drill.length === 0 ? undefined : drillScopeTitle(deck, drill, '')),
    [deck, drill],
  );
  const view = useMemo(
    () => ({
      scopeTitle,
      selection,
      focusedId,
      focusedEdgeId,
      labelsOn,
      level,
      focus,
      marks: collapsedMarks,
      render,
      problems,
      stylePreview,
      dragCopyIds,
      notesHidden: flowMode && notesDisplay === 'hidden',
    }),
    [
      scopeTitle,
      selection,
      focusedId,
      focusedEdgeId,
      labelsOn,
      level,
      focus,
      collapsedMarks,
      render,
      problems,
      stylePreview,
      dragCopyIds,
      flowMode,
      notesDisplay,
    ],
  );

  const nodes = useMemo(
    () => [
      ...stackImages(
        toFlowNodes(deck, graph, view, overlay),
        toImageNodes(deck, selection, flowMode, graph.hiddenImages),
        deck,
      ),
      ...toStickyNodes(deck, selection, { flowMode, notesDisplay, emptyFlow }),
    ],
    [deck, graph, view, selection, overlay, flowMode, notesDisplay, emptyFlow],
  );
  const edges = useMemo(
    () => toFlowEdges(deck, graph, view, overlay, bundles),
    [deck, graph, view, overlay, bundles],
  );
  const recording = session !== null;
  const hasFocusedNode = focusedId !== null && deck.nodes.some((n) => n.id === focusedId);
  // A view whose filter shows no table (048): say so, and lead back to the filter.
  const emptyView =
    drill.length === 0 &&
    viewState.deck.nodes.length === 0 &&
    fullDeck.nodes.some(isDbTable) &&
    (viewState.view.schemas !== undefined || viewState.view.includes !== undefined);
  const drilledEmpty =
    drill.length > 0 &&
    graph.nodes.length === 0 &&
    graph.groups.length === 0 &&
    graph.cards.length === 0;

  useEffect(() => {
    const visibleNodes = new Set(graph.nodes);
    const visibleEdges = new Set(graph.edges);
    const visibleGroups = new Set([...graph.groups, ...graph.cards.map((card) => card.groupId)]);
    const replacementGroups = new Set<string>();

    const nextNodes = selection.nodes.filter((nodeId) => {
      if (visibleNodes.has(nodeId)) return true;
      const representative = graph.representative.get(nodeId);
      if (representative?.startsWith(COLLAPSED_NODE_PREFIX) === true) {
        replacementGroups.add(representative.slice(COLLAPSED_NODE_PREFIX.length));
      }
      return false;
    });

    const nextEdges = selection.edges.filter((edgeId) => {
      if (visibleEdges.has(edgeId)) return true;
      const edge = deck.edges.find((entry) => entry.id === edgeId);
      if (edge === undefined) return false;
      for (const nodeId of [edge.from, edge.to]) {
        const representative = graph.representative.get(nodeId);
        if (representative?.startsWith(COLLAPSED_NODE_PREFIX) === true) {
          replacementGroups.add(representative.slice(COLLAPSED_NODE_PREFIX.length));
        }
      }
      return false;
    });

    const nextGroups = [...new Set([...selection.groups, ...replacementGroups])].filter((groupId) =>
      visibleGroups.has(groupId),
    );

    if (
      nextNodes.length === selection.nodes.length &&
      nextEdges.length === selection.edges.length &&
      nextGroups.length === selection.groups.length &&
      nextNodes.every((id, index) => id === selection.nodes[index]) &&
      nextEdges.every((id, index) => id === selection.edges[index]) &&
      nextGroups.every((id, index) => id === selection.groups[index])
    ) {
      return;
    }

    useUiStore.getState().select({
      nodes: nextNodes,
      edges: nextEdges,
      groups: nextGroups,
      stickies: selection.stickies,
    });
  }, [deck.edges, graph, selection]);

  useEffect(() => {
    if (announcedZoomLevel.current === zoomLevel) return;
    if (announcedZoomLevel.current !== null) {
      useUiStore.getState().announce(`${level.charAt(0).toUpperCase()}${level.slice(1)} level`);
    }
    announcedZoomLevel.current = zoomLevel;
  }, [level, zoomLevel]);

  // Fits a box in the canvas, zoom clamped to 40–130% (010 drill-in, 011 view switch).
  const fitBox = useCallback(
    (box: ReturnType<typeof scopeBounds>) => {
      const root = wrapper.current;
      if (box === null || root === null || root.clientWidth === 0 || root.clientHeight === 0)
        return undefined;
      const frame = requestAnimationFrame(() => {
        const padding = 0.2;
        const width = root.clientWidth;
        const height = root.clientHeight;
        const zoom = Math.max(
          0.4,
          Math.min(
            1.3,
            Math.min(
              (width * (1 - padding * 2)) / Math.max(box.width, 1),
              (height * (1 - padding * 2)) / Math.max(box.height, 1),
            ),
          ),
        );
        void setViewport(
          {
            zoom,
            x: width / 2 - (box.x + box.width / 2) * zoom,
            y: height / 2 - (box.y + box.height / 2) * zoom,
          },
          { duration: dimMs },
        );
      });
      return () => {
        cancelAnimationFrame(frame);
      };
    },
    [dimMs, setViewport],
  );

  useEffect(() => {
    const before = previousDrill.current;
    previousDrill.current = drill;
    if (drill.length > before.length) return fitBox(scopeBounds(deck, graph, level));
    if (drill.length < before.length) {
      const restore = before[drill.length]?.viewport;
      if (restore === undefined) return;
      void setViewport(restore, { duration: dimMs });
    }
    return undefined;
  }, [deck, dimMs, drill, fitBox, graph, level, setViewport]);

  // A view switch fits the new view's visible components (011 FR-003).
  const viewId = viewState.view.id;
  const previousViewId = useRef(viewId);
  useEffect(() => {
    if (previousViewId.current === viewId) return undefined;
    previousViewId.current = viewId;
    return fitBox(scopeBounds(deck, graph, level));
    // Only the switch itself fits; later edits in the view must not move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  return (
    <div
      ref={wrapper}
      {...{ [CANVAS_ATTR]: '' }}
      data-region="canvas"
      {...(flowMode ? { 'data-flow-mode': '' } : {})}
      {...(focus !== null ? { 'data-focus-mode': '' } : {})}
      {...(session !== null ? { 'data-flow-session': '' } : {})}
      {...(hideUi ? { 'data-hide-ui': '' } : {})}
      {...(hand ? { 'data-tool-hand': '' } : {})}
      {...(dragging ? { 'data-dragging': '' } : {})}
      {...(dragCopyIds.size > 0 ? { 'data-duplicating': '' } : {})}
      {...(tinyCards ? { 'data-tiny-cards': '' } : {})}
      {...(lipless ? { 'data-lipless': '' } : {})}
      data-level={level}
      // One Tab stop: the focused node carries it; the canvas only while no node does.
      tabIndex={hasFocusedNode ? -1 : 0}
      aria-label={hasFocusedNode ? undefined : 'Diagram'}
      onPointerOverCapture={(event) => {
        hover.notePointerType(event.pointerType);
        // Column rows (042 R14): delegated here, rows are plain elements with `data-row`.
        const target = event.target instanceof Element ? event.target : null;
        const card = target?.closest<HTMLElement>('[data-node-id]');
        const tableId = card?.dataset.nodeId;
        const row = target?.closest<HTMLElement>('[data-row]')?.dataset.row ?? null;
        if (tableId === undefined) {
          hoveredRow.current = null;
          return;
        }
        if (row === hoveredRow.current) return;
        hoveredRow.current = row;
        hover.onRowHover(tableId, row);
      }}
      onPointerDownCapture={(event) => {
        hover.notePointerType(event.pointerType);
        pointerFocus.current = true;
        setTimeout(() => {
          pointerFocus.current = false;
        }, 0);
      }}
      onFocus={(event) => {
        const focusedRow = (event.target as HTMLElement).dataset.row;
        if (focusedRow !== undefined && event.target !== event.currentTarget) {
          // A focused column row lights its relationships (042 FR-022).
          const { focusedRow: row } = useUiStore.getState();
          if (row !== null) hover.onRowFocus(row.tableId, row.columnId);
          return;
        }
        if (event.target !== event.currentTarget) {
          // Roving keyboard focus on a card lights its connections at once (034 R3).
          const cardId = (event.target as HTMLElement)
            .closest<HTMLElement>('[data-node-id]')
            ?.getAttribute('data-node-id');
          if (cardId !== null && cardId !== undefined && !pointerFocus.current) {
            const set = focusSet(deck, graph, cardId, bundles);
            const title = deck.nodes.find((node) => node.id === cardId)?.title;
            const keyed = performance.now() - lastKeyAt.current < KEY_FOCUS_WINDOW_MS;
            hover.onCardFocus(
              cardId,
              !keyed || set === null || title === undefined
                ? undefined
                : connectionsText(title, connectionCount(set, graph, bundles)),
            );
          }
          return;
        }
        // Focus put back by the app (after a delete, a closed menu) stays on the canvas: picking
        // a card here would pan to it.
        if (pointerFocus.current || isReturningFocus()) return;
        const ui = useUiStore.getState();
        // While recording, the canvas keeps focus: Tab moves between candidate edges (006).
        if (ui.flowSession !== null) return;
        // The selection, else the card nearest the middle of the view: never the deck's first
        // card, which may be far away and would pan the canvas there.
        const first = ui.selection.nodes[0] ?? nearestVisibleCard(event.currentTarget);
        if (first === null) return;
        ui.focus(first);
        // Moving focus inside a focus event is fragile; hand it over once this event is done.
        setTimeout(() => {
          if (
            document.activeElement === event.currentTarget ||
            document.activeElement === document.body
          ) {
            nodeElement(first)?.focus({ preventScroll: true });
          }
        }, 0);
      }}
      onBlur={hover.onCardBlur}
      onKeyDownCapture={(event) => {
        if (event.key.startsWith('Arrow') || event.key === 'Tab')
          lastKeyAt.current = performance.now();
      }}
      onKeyDown={onKeyDown}
      className={cn('relative h-full', focusRing)}
      onMouseLeave={() => {
        useUiStore.getState().setCanvasPointer(null);
      }}
    >
      <ReactFlow
        aria-label="Diagram canvas"
        style={backgroundStyle}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onlyRenderVisibleElements={onlyRenderVisibleElements}
        onPaneMouseMove={(event) => {
          useUiStore
            .getState()
            .setCanvasPointer(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
        onInit={onReady}
        fitView={restored === null}
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={restored ?? undefined}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        proOptions={{ hideAttribution: true }}
        // Keyboard: our roving focus and confirmation replace React Flow's (research R3).
        disableKeyboardA11y
        nodesFocusable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        // Selection: click / shift-click / ⌘-click. A plain drag draws a marquee with Select and
        // pans with Hand (§g-57); Space+drag and the middle button always pan, Shift+drag always
        // marquees. ⌥ during a marquee also selects the cards it touches (016 R13).
        selectionMode={marqueeRunning && touchSelect ? SelectionMode.Partial : SelectionMode.Full}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionKeyCode="Shift"
        selectionOnDrag={!hand}
        selectNodesOnDrag={false}
        panOnDrag={hand ? true : PAN_BUTTONS}
        zoomOnDoubleClick={false}
        // Recording pauses structure editing (006 FR-017). Flow mode is view-only too, but through
        // the handlers and CSS: toggling these props re-renders every node and edge, which costs
        // ~40 ms on the 500 / 1,000 deck, against 007 SC-001's 100 ms.
        nodesDraggable={!recording}
        nodesConnectable={!recording}
        // Connections: any handle starts or ends one, drawn with a dashed line. Existing ends are
        // dragged by the selected connector's own handles (050 R3), not React Flow's reconnect.
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={connectionLineStyle}
        connectionLineComponent={EndpointConnectionLine}
        edgesReconnectable={false}
        onNodeMouseEnter={hover.onNodeMouseEnter}
        onNodeMouseLeave={hover.onNodeMouseLeave}
        {...handlers}
        // A hovered relationship lights its end rows (042 FR-023), on top of the session hover.
        onEdgeMouseEnter={(event, edge) => {
          handlers.onEdgeMouseEnter(event, edge);
          if ((edge.data as DeckEdgeData | undefined)?.rel !== undefined) {
            hover.onRelationshipEnter(edge.id);
          }
        }}
        onEdgeMouseLeave={(_event, edge) => {
          handlers.onEdgeMouseLeave();
          hover.onRelationshipLeave(edge.id);
        }}
      >
        {variant !== null && (
          <Background
            variant={variant}
            gap={BACKGROUND_GAP}
            size={1}
            {...(variant === BackgroundVariant.Lines ? { lineWidth: 1 } : {})}
          />
        )}
        {/* The minimap (018 FR-033): off by default, above the zoom island (M). */}
        {minimap && !hideUi && (
          <MiniMap<CanvasFlowNode>
            ariaLabel="Minimap"
            position="bottom-right"
            pannable
            nodeColor={minimapFill}
            nodeStrokeColor={minimapStroke}
            maskColor="var(--xy-minimap-mask-background-color)"
            onClick={(_, position) => {
              void setCenter(position.x, position.y, { zoom: getZoom() });
            }}
            style={{ margin: 0, right: minimapRight, bottom: minimapBottom }}
            className="rounded-card border border-hairline shadow-float"
          />
        )}
        {flowMode && !hideUi && (
          // Centred on the canvas left free by the drawer, above the JSON overlay (018).
          <Panel position="bottom-center" style={playerStyle}>
            <StepPlayer deck={deck} />
          </Panel>
        )}
        <SelectionFrame deck={deck} level={level} />
        <GuidesOverlay />
        <ColumnConnectLine />
      </ReactFlow>
      {fullDeck.nodes.length === 0 &&
        fullDeck.groups.length === 0 &&
        (fullDeck.images ?? []).length === 0 && (
          <EmptyCanvasCard
            showImport={deckPacks(fullDeck).includes('database')}
            {...(deckPacks(fullDeck).includes('database')
              ? {
                  onAddTable: () => {
                    const rect = canvasElement()?.getBoundingClientRect();
                    addTable(
                      editor,
                      screenToFlowPosition({
                        x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
                        y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
                      }),
                    );
                  },
                }
              : {})}
          />
        )}
      {emptyView && (
        <EmptyCanvasCard
          title="No tables match this view"
          description="This view's schemas and tables filter hides every table. Change the filter to bring some back."
          action={
            <Button
              variant="primary"
              onClick={() => {
                useUiStore.getState().requestViewSettings(viewState.view.id);
              }}
            >
              Edit filter
            </Button>
          }
        />
      )}
      {drilledEmpty && (
        <EmptyCanvasCard
          title="No components in this group"
          description="This group is empty right now. Go up to add components elsewhere or move some into this group."
          action={null}
        />
      )}
      <HoverFocusStyle deck={deck} graph={graph} bundles={bundles} wrapper={wrapper} />
      <SelectedRelationshipStyle deck={deck} />
      <EdgePopover deck={fullDeck} />
      {/* The one enum values popover (041): renders nothing until a chip opens it. */}
      <EnumPopover deck={fullDeck} />
      <ProblemFixPopover />
      <MergedEdgePopover deck={deck} bundles={bundles} />
      <ConnectPopover deck={fullDeck} />
      <InvalidEdgePopover deck={deck} analysis={analysis} />
      <MarqueeChip />
      {frameTool && <FrameDrawLayer />}
    </div>
  );
}
