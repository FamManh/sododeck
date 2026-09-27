import { analyzeFlow, observeDeck } from '@sododeck/model';
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
  useStore,
  useReactFlow,
  type ReactFlowState,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { CANVAS_ATTR, nodeElement } from './canvas-actions';
import { displayPosition, groupBounds, nodeSize } from './canvas-geometry';
import { CanvasToolbar } from './canvas-toolbar';
import { collapseFlowMarks } from './collapse-flow-marks';
import { ConnectPopover } from './connect-popover';
import { DeckEdge } from './deck-edge';
import { DeckNode } from './deck-node';
import {
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  toFlowEdges,
  toFlowNodes,
  toLeaderEdges,
  toStickyNodes,
} from './deck-to-flow';
import { EdgePopover } from './edge-popover';
import { EmptyCanvasCard } from './empty-canvas-card';
import { playbackOf } from './flows/flow-mode';
import { EMPTY_OVERLAY, flowOverlay, type PlaybackMarks } from './flows/flow-overlay';
import { InvalidEdgePopover } from './flows/invalid-edge-popover';
import { findFlow } from './flows/session-path';
import { StepPlayer } from './flows/step-player';
import { useFlowViewport } from './flows/use-flow-viewport';
import { focusSet } from './focus-set';
import { GroupBoundaryNode } from './group-boundary-node';
import { effectiveLevel, levelForZoom, levelWithHysteresis, type Level } from './levels';
import { PortPillNode } from './port-pill-node';
import { SelectionFrame } from './selection-frame';
import { useStickyDraftLifecycle } from './stickies/sticky-actions';
import { StickyLeaderEdge } from './stickies/sticky-leader-edge';
import { StickyNode } from './stickies/sticky-node';
import { useCanvasHandlers } from './use-canvas-handlers';
import { useCanvasKeyDown } from './use-canvas-shortcuts';
import { scopeBounds, scopeOf, validDrillDepth, visibleGraph } from './visible-graph';
import { MAX_ZOOM, MIN_ZOOM, ZoomControl } from './zoom-control';

const nodeTypes: NodeTypes = {
  deck: DeckNode,
  'group-boundary': GroupBoundaryNode,
  port: PortPillNode,
  sticky: StickyNode,
};
const edgeTypes: EdgeTypes = { deck: DeckEdge, 'sticky-leader': StickyLeaderEdge };

const connectionLineStyle = {
  stroke: 'var(--color-primary)',
  strokeWidth: 1.5,
  strokeDasharray: '5 4',
};

let lastZoomLevel: Level = 'system';
const levelSelector = (state: ReactFlowState) => {
  lastZoomLevel = levelWithHysteresis(state.transform[2], lastZoomLevel);
  return lastZoomLevel;
};

export interface CanvasProps {
  onlyRenderVisibleElements?: boolean;
  onReady?: () => void;
}

function scopeTitle(
  deck: ReturnType<typeof readDeck>,
  drill: readonly { kind: 'group' | 'node'; id: string }[],
): string {
  const current = drill.at(-1);
  if (current === undefined) return 'System view';
  if (current.kind === 'group')
    return deck.groups.find((group) => group.id === current.id)?.title ?? 'System view';
  return deck.nodes.find((node) => node.id === current.id)?.title ?? 'System view';
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
        const deck = readDeck(editor.doc);
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
        if (changed) ui.announce(`Went up to ${scopeTitle(deck, useUiStore.getState().drill)}`);
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
              (c.scope === 'nodes' || c.scope === 'edges' || c.scope === 'stickies'),
          )
        ) {
          const deck = readDeck(editor.doc);
          ui.pruneSelection({
            nodes: new Set(deck.nodes.map((n) => n.id)),
            edges: new Set(deck.edges.map((e) => e.id)),
            groups: new Set(deck.groups.map((group) => group.id)),
            stickies: new Set(deck.stickies.map((s) => s.id)),
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
    const deck = readDeck(editor.doc);
    const ui = useUiStore.getState();
    const { zoom: currentZoom } = getViewport();
    const scope = scopeOf(ui.drill);
    const level = effectiveLevel(levelForZoom(currentZoom), scope);
    const graph = visibleGraph(deck, scope, ui.collapsed);
    const point = (() => {
      if (focusedId.startsWith(GROUP_NODE_PREFIX)) {
        const groupId = focusedId.slice(GROUP_NODE_PREFIX.length);
        const rect = groupBounds(deck, nodeSize(level)).get(groupId);
        return rect === undefined ? null : { x: rect.x, y: rect.y, width: 1, height: 1 };
      }
      if (focusedId.startsWith(COLLAPSED_NODE_PREFIX)) {
        const groupId = focusedId.slice(COLLAPSED_NODE_PREFIX.length);
        const card = graph.cards.find((entry) => entry.groupId === groupId);
        return card?.rect ?? null;
      }
      const index = deck.nodes.findIndex((n) => n.id === focusedId);
      const node = index < 0 ? undefined : deck.nodes[index];
      if (node === undefined) return null;
      const size = nodeSize(level);
      return { ...displayPosition(node, index), ...size };
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
    if (element && element !== document.activeElement) element.focus({ preventScroll: true });
  }, [focusedId, editor.doc, getViewport, setCenter, wrapper]);
}

/**
 * The diagram canvas. React Flow is fully controlled: nodes and edges are derived on every render
 * from the deck snapshot and UI state, every edit goes through the editor (research R1–R4), and
 * React Flow's own keyboard and delete handling is off (roving focus, confirmation instead).
 */
export function Canvas({ onlyRenderVisibleElements = false, onReady }: CanvasProps) {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const selection = useUiStore((s) => s.selection);
  const drill = useUiStore((s) => s.drill);
  const collapsed = useUiStore((s) => s.collapsed);
  const focusMode = useUiStore((s) => s.focusMode);
  const focusedId = useUiStore((s) => s.focusedId);
  const focusedEdgeId = useUiStore((s) => s.focusedEdgeId);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const activeFlow = useUiStore((s) => s.activeFlow);
  const session = useUiStore((s) => s.flowSession);
  const hoverEdgeId = useUiStore((s) => s.hoverEdgeId);
  const { setCenter, setViewport, getZoom, getViewport, screenToFlowPosition } = useReactFlow();
  const { dimMs } = resolveMotion(useReducedMotion());
  const wrapper = useRef<HTMLDivElement>(null);
  const previousDrill = useRef(drill);
  // Coming back from the rule editor restores where the canvas was (008 FR-018).
  const [restored] = useState(() => useUiStore.getState().canvasViewport);
  const zoomLevel = useStore(levelSelector);
  useEffect(
    () => () => {
      useUiStore.getState().setCanvasViewport(getViewport());
    },
    [getViewport],
  );
  const handlers = useCanvasHandlers();
  const onKeyDown = useCanvasKeyDown();

  useSelectionSync();
  useViewSync();
  useRovingFocus(wrapper);
  useStickyDraftLifecycle();

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
  const brokenCurrentStep =
    flowMode && activeStepId !== null
      ? (playback?.played.steps.find((step) => step.step.id === activeStepId)?.broken ?? false)
      : false;
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
  const graph = useMemo(() => visibleGraph(deck, scope, collapsed), [deck, scope, collapsed]);
  const level = useMemo(() => effectiveLevel(zoomLevel, scope), [zoomLevel, scope]);
  const focus = useMemo(
    () => (focusMode && focusedId !== null ? focusSet(deck, graph, focusedId) : null),
    [focusMode, focusedId, deck, graph],
  );
  const collapsedMarks = useMemo(() => collapseFlowMarks(overlay, graph), [overlay, graph]);
  const view = useMemo(
    () => ({
      selection,
      focusedId,
      focusedEdgeId,
      labelsOn,
      level,
      focus,
      marks: collapsedMarks,
    }),
    [selection, focusedId, focusedEdgeId, labelsOn, level, focus, collapsedMarks],
  );

  const nodes = useMemo(
    () => [
      ...toFlowNodes(deck, graph, view, overlay),
      ...toStickyNodes(deck, selection, overlay, {
        flowMode,
        notesDisplay,
        emptyFlow,
        brokenCurrentStep,
      }),
    ],
    [deck, graph, view, selection, overlay, flowMode, notesDisplay, emptyFlow, brokenCurrentStep],
  );
  const edges = useMemo(
    () => [...toFlowEdges(deck, graph, view, overlay), ...toLeaderEdges(deck)],
    [deck, graph, view, overlay],
  );
  const recording = session !== null;
  const hasFocusedNode = focusedId !== null && deck.nodes.some((n) => n.id === focusedId);
  const drilledEmpty =
    drill.length > 0 &&
    graph.nodes.length === 0 &&
    graph.groups.length === 0 &&
    graph.cards.length === 0;

  useEffect(() => {
    const before = previousDrill.current;
    previousDrill.current = drill;
    if (drill.length > before.length) {
      const box = scopeBounds(deck, graph, level);
      const root = wrapper.current;
      if (box === null || root === null || root.clientWidth === 0 || root.clientHeight === 0)
        return;
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
    }
    if (drill.length < before.length) {
      const restore = before[drill.length]?.viewport;
      if (restore === undefined) return;
      void setViewport(restore, { duration: dimMs });
    }
  }, [deck, dimMs, drill, graph, level, setViewport]);

  return (
    <div
      ref={wrapper}
      {...{ [CANVAS_ATTR]: '' }}
      {...(flowMode ? { 'data-flow-mode': '' } : {})}
      // One Tab stop: the focused node carries it; the canvas only while no node does.
      tabIndex={hasFocusedNode ? -1 : 0}
      aria-label={hasFocusedNode ? undefined : 'Diagram'}
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return;
        const ui = useUiStore.getState();
        // While recording, the canvas keeps focus: Tab moves between candidate edges (006).
        if (ui.flowSession !== null) return;
        const first = ui.selection.nodes[0] ?? deck.nodes[0]?.id;
        if (first === undefined) return;
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
      onKeyDown={onKeyDown}
      className={cn('relative h-full', focusRing)}
      onMouseLeave={() => {
        useUiStore.getState().setCanvasPointer(null);
      }}
    >
      <ReactFlow
        aria-label="Diagram canvas"
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
        // Selection: click / shift-click / ⌘-click, shift-drag marquee, plain drag pans.
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        selectionKeyCode="Shift"
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        panOnDrag
        zoomOnDoubleClick={false}
        // Recording pauses structure editing (006 FR-017). Flow mode is view-only too, but through
        // the handlers and CSS: toggling these props re-renders every node and edge, which costs
        // ~40 ms on the 500 / 1,000 deck, against 007 SC-001's 100 ms.
        nodesDraggable={!recording}
        nodesConnectable={!recording}
        // Connections: any handle starts or ends one; drawn and reconnected with a dashed ghost.
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={connectionLineStyle}
        edgesReconnectable={!recording}
        {...handlers}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Panel position="top-right">
          <CanvasToolbar />
        </Panel>
        <Panel position="bottom-left">
          <ZoomControl />
        </Panel>
        <MiniMap
          ariaLabel="Minimap"
          position="bottom-right"
          pannable
          nodeColor="var(--color-surface-3)"
          nodeStrokeColor="var(--color-border)"
          maskColor="var(--xy-minimap-mask-background-color)"
          onClick={(_, position) => {
            void setCenter(position.x, position.y, { zoom: getZoom() });
          }}
          className="rounded-card border border-hairline shadow-rest"
        />
        {flowMode && (
          <Panel position="bottom-center">
            <StepPlayer deck={deck} />
          </Panel>
        )}
        <SelectionFrame deck={deck} level={level} />
      </ReactFlow>
      {deck.nodes.length === 0 && <EmptyCanvasCard />}
      {drilledEmpty && (
        <EmptyCanvasCard
          title="No components in this group"
          description="This group is empty right now. Go up to add components elsewhere or move some into this group."
          action={null}
        />
      )}
      <EdgePopover deck={deck} />
      <ConnectPopover deck={deck} />
      <InvalidEdgePopover deck={deck} analysis={analysis} />
    </div>
  );
}
