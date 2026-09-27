import { analyzeFlow, observeDeck } from '@sododeck/model';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { CANVAS_ATTR, nodeElement } from './canvas-actions';
import { displayPosition, NODE_SIZE } from './canvas-geometry';
import { CanvasToolbar } from './canvas-toolbar';
import { ConnectPopover } from './connect-popover';
import { DeckEdge } from './deck-edge';
import { DeckNode } from './deck-node';
import { toFlowEdges, toFlowNodes } from './deck-to-flow';
import { EdgePopover } from './edge-popover';
import { EmptyCanvasCard } from './empty-canvas-card';
import { playbackOf } from './flows/flow-mode';
import { EMPTY_OVERLAY, flowOverlay, type PlaybackMarks } from './flows/flow-overlay';
import { InvalidEdgePopover } from './flows/invalid-edge-popover';
import { findFlow } from './flows/session-path';
import { StepPlayer } from './flows/step-player';
import { useFlowViewport } from './flows/use-flow-viewport';
import { GroupBoundaryNode } from './group-boundary-node';
import { SelectionFrame } from './selection-frame';
import { useCanvasHandlers } from './use-canvas-handlers';
import { useCanvasKeyDown } from './use-canvas-shortcuts';
import { MAX_ZOOM, MIN_ZOOM, ZoomControl } from './zoom-control';

const nodeTypes: NodeTypes = { deck: DeckNode, 'group-boundary': GroupBoundaryNode };
const edgeTypes: EdgeTypes = { deck: DeckEdge };

const connectionLineStyle = {
  stroke: 'var(--color-primary)',
  strokeWidth: 1.5,
  strokeDasharray: '5 4',
};

export interface CanvasProps {
  onlyRenderVisibleElements?: boolean;
  onReady?: () => void;
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
          changes.some((c) => c.kind === 'removed' && (c.scope === 'nodes' || c.scope === 'edges'))
        ) {
          const deck = readDeck(editor.doc);
          ui.pruneSelection({
            nodes: new Set(deck.nodes.map((n) => n.id)),
            edges: new Set(deck.edges.map((e) => e.id)),
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
    const index = deck.nodes.findIndex((n) => n.id === focusedId);
    const node = deck.nodes[index];
    if (!node) return;
    const { x, y } = displayPosition(node, index);
    const { x: vx, y: vy, zoom } = getViewport();
    const left = x * zoom + vx;
    const top = y * zoom + vy;
    const outside =
      left < 0 ||
      top < 0 ||
      left + NODE_SIZE.width * zoom > root.clientWidth ||
      top + NODE_SIZE.height * zoom > root.clientHeight;
    if (outside && root.clientWidth > 0) {
      void setCenter(x + NODE_SIZE.width / 2, y + NODE_SIZE.height / 2, { zoom });
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
  const focusedId = useUiStore((s) => s.focusedId);
  const focusedEdgeId = useUiStore((s) => s.focusedEdgeId);
  const labelsOn = useUiStore((s) => s.labelsOn);
  const activeFlow = useUiStore((s) => s.activeFlow);
  const session = useUiStore((s) => s.flowSession);
  const hoverEdgeId = useUiStore((s) => s.hoverEdgeId);
  const { setCenter, getZoom, getViewport } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  // Coming back from the rule editor restores where the canvas was (008 FR-018).
  const [restored] = useState(() => useUiStore.getState().canvasViewport);
  useEffect(
    () => () => {
      useUiStore.getState().setCanvasViewport(getViewport());
    },
    [getViewport],
  );
  const handlers = useCanvasHandlers();
  const onKeyDown = useCanvasKeyDown();

  useSelectionSync();
  useRovingFocus(wrapper);

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

  const nodes = useMemo(
    () => toFlowNodes(deck, selection, focusedId, overlay),
    [deck, selection, focusedId, overlay],
  );
  const edges = useMemo(
    () => toFlowEdges(deck, selection, labelsOn, focusedEdgeId, overlay),
    [deck, selection, labelsOn, focusedEdgeId, overlay],
  );
  const recording = session !== null;
  const hasFocusedNode = focusedId !== null && deck.nodes.some((n) => n.id === focusedId);

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
    >
      <ReactFlow
        aria-label="Diagram canvas"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onlyRenderVisibleElements={onlyRenderVisibleElements}
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
        <SelectionFrame deck={deck} />
      </ReactFlow>
      {deck.nodes.length === 0 && <EmptyCanvasCard />}
      <EdgePopover deck={deck} />
      <ConnectPopover deck={deck} />
      <InvalidEdgePopover deck={deck} analysis={analysis} />
    </div>
  );
}
