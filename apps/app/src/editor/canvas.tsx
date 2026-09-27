import { observeDeck } from '@sododeck/model';
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
import { useEffect, useMemo, useRef } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { CANVAS_ATTR, nodeElement } from './canvas-actions';
import { displayPosition, NODE_SIZE } from './canvas-geometry';
import { CanvasToolbar } from './canvas-toolbar';
import { ConnectPopover } from './connect-popover';
import { DeckEdge } from './deck-edge';
import { DeckNode } from './deck-node';
import { toFlowEdges, toFlowNodes } from './deck-to-flow';
import { EdgePopover } from './edge-popover';
import { EmptyCanvasCard } from './empty-canvas-card';
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
  const { setCenter, getZoom } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const handlers = useCanvasHandlers();
  const onKeyDown = useCanvasKeyDown();

  useSelectionSync();
  useRovingFocus(wrapper);

  const nodes = useMemo(
    () => toFlowNodes(deck, selection, focusedId),
    [deck, selection, focusedId],
  );
  const edges = useMemo(
    () => toFlowEdges(deck, selection, labelsOn, focusedEdgeId),
    [deck, selection, labelsOn, focusedEdgeId],
  );
  const hasFocusedNode = focusedId !== null && deck.nodes.some((n) => n.id === focusedId);

  return (
    <div
      ref={wrapper}
      {...{ [CANVAS_ATTR]: '' }}
      // One Tab stop: the focused node carries it; the canvas only while no node does.
      tabIndex={hasFocusedNode ? -1 : 0}
      aria-label={hasFocusedNode ? undefined : 'Diagram'}
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return;
        const ui = useUiStore.getState();
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
        fitView
        fitViewOptions={{ padding: 0.2 }}
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
        // Connections: any handle starts or ends one; drawn and reconnected with a dashed ghost.
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={connectionLineStyle}
        edgesReconnectable
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
        <SelectionFrame deck={deck} />
      </ReactFlow>
      {deck.nodes.length === 0 && <EmptyCanvasCard />}
      <EdgePopover deck={deck} />
      <ConnectPopover deck={deck} />
    </div>
  );
}
