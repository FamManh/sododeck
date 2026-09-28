/**
 * React Flow event handlers for the controlled canvas. React Flow only reports gestures; every
 * document change goes through the editor and every selection change through the UI store.
 * Exported as a hook so tests can drive the handlers without a real pointer (jsdom has no layout).
 */
import { toComponentKind } from '@sododeck/ui/lib/icons';
import type {
  Connection,
  Edge,
  EdgeChange,
  IsValidConnection,
  Node,
  NodeChange,
  OnReconnect,
} from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useMemo, useRef } from 'react';

import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { addComponent, centredOn, connectComponents } from './canvas-actions';
import { connectionCheck, REFUSAL_TEXT } from './connection-rules';
import {
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  MERGED_EDGE_PREFIX,
  PORT_NODE_PREFIX,
  STICKY_NODE_PREFIX,
} from './deck-to-flow';
import { currentPlayback, goToStep } from './flows/flow-mode';
import { recordClick } from './flows/flow-session';
import { stepForEdge, stepForNode } from './flows/played-path';
import { addNoteAt } from './stickies/sticky-actions';
import { scopeOf, visibleGraph } from './visible-graph';
import { collapsedOf, moveStickyInView, readViewState } from './views/use-current-view';
import { stepForEdges, stepForGroup } from './collapse-flow-marks';

/** Drag-and-drop type the palette cards set (palette.tsx). */
export const KIND_MIME = 'application/x-sododeck-kind';
export const NOTE_MIME = 'application/x-sododeck-note';

const isGroupNode = (id: string) => id.startsWith(GROUP_NODE_PREFIX);
const isCollapsedNode = (id: string) => id.startsWith(COLLAPSED_NODE_PREFIX);
const isPortNode = (id: string) => id.startsWith(PORT_NODE_PREFIX);
const isMergedEdge = (id: string) => id.startsWith(MERGED_EDGE_PREFIX);
const stickyIdOf = (id: string) =>
  id.startsWith(STICKY_NODE_PREFIX) ? id.slice(STICKY_NODE_PREFIX.length) : null;
const groupIdOf = (id: string) =>
  id.startsWith(GROUP_NODE_PREFIX)
    ? id.slice(GROUP_NODE_PREFIX.length)
    : id.startsWith(COLLAPSED_NODE_PREFIX)
      ? id.slice(COLLAPSED_NODE_PREFIX.length)
      : null;

/** Shift, ⌘ or Ctrl held: add to / remove from the selection instead of replacing it. */
const isMultiSelect = (event: ReactMouseEvent) => event.shiftKey || event.metaKey || event.ctrlKey;

export function useCanvasHandlers() {
  const editor = useEditor();
  const { getViewport, screenToFlowPosition } = useReactFlow();
  const gestureOpen = useRef(false);
  // True between React Flow's onSelectionStart and onSelectionEnd (marquee).
  const marquee = useRef(false);

  return useMemo(() => {
    const ui = () => useUiStore.getState();

    const endGesture = () => {
      if (gestureOpen.current) {
        gestureOpen.current = false;
        editor.endGesture();
      }
    };

    const openScope = (frame: { kind: 'group' | 'node'; id: string }, title: string) => {
      ui().drillInto({ ...frame, viewport: getViewport() });
      ui().announce(`Opened ${title}`);
    };

    /** Applies React Flow's selection deltas; only the marquee is taken from React Flow. */
    const applySelectChanges = (changes: { id: string; selected: boolean }[]) => {
      if (!marquee.current || changes.length === 0 || isFlowMode(ui())) return;
      const { selection } = ui();
      const nodes = new Set(selection.nodes);
      const edges = new Set(selection.edges);
      const stickies = new Set(selection.stickies);
      for (const { id, selected, type } of changes as {
        id: string;
        selected: boolean;
        type: 'node' | 'edge';
      }[]) {
        if (type === 'node' && isGroupNode(id)) continue;
        const stickyId = type === 'node' ? stickyIdOf(id) : null;
        const set = type === 'edge' ? edges : stickyId === null ? nodes : stickies;
        const value = stickyId ?? id;
        if (selected) set.add(value);
        else set.delete(value);
      }
      ui().select({ nodes: [...nodes], edges: [...edges], stickies: [...stickies] });
    };

    /** A flow session pauses structure editing; edge clicks record steps (006 FR-017). */
    const inSession = () => ui().flowSession !== null;
    /** Flow mode is view-only (007): clicks on flow members jump, everything else is refused. */
    const flowMode = () => isFlowMode(ui());
    const viewOnly = () => inSession() || flowMode();
    const jumpTo = (
      find: (playback: NonNullable<ReturnType<typeof currentPlayback>>) => string | null,
    ) => {
      const playback = currentPlayback(readDeck(editor.doc));
      if (playback === null) return;
      const stepId = find(playback);
      // goToStep pauses playback and announces the step.
      if (stepId !== null) goToStep(editor, stepId);
    };

    /**
     * Rail tools (018 R8) act on the next click, then fall back to Select: Sticky adds a note
     * where the click lands (pinned to a card under it), Connector opens a card's connect popover.
     */
    const applyTool = (event: ReactMouseEvent, nodeId: string | null): boolean => {
      const tool = ui().tool;
      if (tool === 'select' || viewOnly()) return false;
      if (tool === 'sticky') {
        addNoteAt(editor, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      } else if (nodeId !== null && readDeck(editor.doc).nodes.some((n) => n.id === nodeId)) {
        ui().select({ nodes: [nodeId] });
        ui().focus(nodeId);
        ui().openConnectPopover(nodeId);
      } else {
        return false;
      }
      ui().setTool('select');
      return true;
    };

    return {
      onNodeClick: (event: ReactMouseEvent, node: Node) => {
        if (applyTool(event, node.id)) return;
        const groupId = groupIdOf(node.id);
        if (groupId !== null) {
          if (flowMode()) {
            if (isCollapsedNode(node.id)) {
              jumpTo((playback) => {
                const deck = readViewState(editor.doc).deck;
                const graph = visibleGraph(deck, scopeOf(ui().drill), collapsedOf(editor.doc));
                return stepForGroup(playback.played, graph, groupId);
              });
            }
            return;
          }
          if (!isCollapsedNode(node.id) && !isGroupNode(node.id)) return;
          if (!isMultiSelect(event)) ui().select({ groups: [groupId] });
          ui().focus(node.id);
          ui().focusEdge(null);
          return;
        }
        const stickyId = stickyIdOf(node.id);
        if (flowMode()) {
          if (stickyId === null) jumpTo((p) => stepForNode(p.played, node.id));
          return;
        }
        if (inSession()) {
          if (stickyId === null) ui().focus(node.id);
          return;
        }
        if (stickyId !== null) {
          if (isMultiSelect(event)) ui().toggle(stickyId, 'sticky');
          else ui().select({ stickies: [stickyId] });
          ui().focus(null);
          ui().focusEdge(null);
          return;
        }
        if (isMultiSelect(event)) ui().toggle(node.id, 'node');
        else ui().select({ nodes: [node.id] });
        ui().focus(node.id);
      },
      onNodeDoubleClick: (_event: ReactMouseEvent, node: Node) => {
        if (viewOnly()) return;
        const deck = readDeck(editor.doc);
        const groupId = groupIdOf(node.id);
        if (groupId !== null) {
          const title = deck.groups.find((group) => group.id === groupId)?.title;
          if (title !== undefined) openScope({ kind: 'group', id: groupId }, title);
          return;
        }
        if (stickyIdOf(node.id) !== null || isPortNode(node.id)) return;
        const graph = visibleGraph(
          readViewState(editor.doc).deck,
          scopeOf(ui().drill),
          collapsedOf(editor.doc),
        );
        if ((graph.childCount.get(node.id) ?? 0) === 0) {
          // A plain component: its details (018 FR-022).
          ui().select({ nodes: [node.id] });
          ui().focus(node.id);
          ui().openDrawer();
          return;
        }
        const title = deck.nodes.find((entry) => entry.id === node.id)?.title;
        if (title !== undefined) openScope({ kind: 'node', id: node.id }, title);
      },
      onEdgeClick: (event: ReactMouseEvent, edge: Edge) => {
        if (isMergedEdge(edge.id)) {
          if (flowMode()) {
            jumpTo((playback) => {
              const deck = readViewState(editor.doc).deck;
              const graph = visibleGraph(deck, scopeOf(ui().drill), collapsedOf(editor.doc));
              const merged = graph.merged.find((entry) => entry.id === edge.id);
              return merged === undefined
                ? null
                : stepForEdges(playback.played, merged.edgeIds, playback.currentStepId);
            });
            return;
          }
          if (inSession()) {
            ui().announce('Expand the group to record this step');
            return;
          }
          ui().focusEdge(edge.id);
          return;
        }
        if (flowMode()) {
          jumpTo((p) => stepForEdge(p.played, edge.id, p.currentStepId));
          return;
        }
        if (inSession()) {
          recordClick(editor, edge.id);
          return;
        }
        if (isMultiSelect(event)) ui().toggle(edge.id, 'edge');
        else ui().select({ edges: [edge.id] });
      },
      onEdgeDoubleClick: (_: ReactMouseEvent, edge: Edge) => {
        if (viewOnly()) return;
        if (isMergedEdge(edge.id)) {
          ui().focusEdge(edge.id);
          ui().openMergedPopover(edge.id);
          return;
        }
        ui().select({ edges: [edge.id] });
        ui().openEdgePopover(edge.id);
      },
      onEdgeMouseEnter: (_: ReactMouseEvent, edge: Edge) => {
        if (inSession()) ui().setHoverEdge(edge.id);
      },
      onEdgeMouseLeave: () => {
        if (ui().hoverEdgeId !== null) ui().setHoverEdge(null);
      },
      onPaneClick: (event: ReactMouseEvent) => {
        // Flow mode keeps going on an empty-canvas click (007); Esc or Back exits.
        if (flowMode()) return;
        if (applyTool(event, null)) return;
        ui().clearSelection();
        ui().closePopover();
      },
      onSelectionStart: () => {
        marquee.current = true;
      },
      onSelectionEnd: () => {
        marquee.current = false;
      },

      onNodeDragStart: (_: unknown, node: Node) => {
        if (viewOnly()) return;
        if (isGroupNode(node.id) || isCollapsedNode(node.id) || isPortNode(node.id)) return;
        const stickyId = stickyIdOf(node.id);
        if (stickyId !== null) {
          if (!ui().selection.stickies.includes(stickyId)) ui().select({ stickies: [stickyId] });
          ui().focus(null);
          ui().focusEdge(null);
        } else {
          if (!ui().selection.nodes.includes(node.id)) ui().select({ nodes: [node.id] });
          ui().focus(node.id);
        }
        if (!gestureOpen.current) {
          gestureOpen.current = true;
          // One drag, however many frames and nodes, is one undo step (research R2).
          editor.beginGesture();
        }
      },
      /**
       * Writes dragged positions straight to the document, all moved nodes in one batch, through
       * the current view (011 FR-020/021: base positions in the base view, overrides elsewhere).
       */
      onNodesChange: (changes: NodeChange[]) => {
        if (flowMode()) return;
        const moves = changes.flatMap((c) =>
          c.type === 'position' &&
          c.position !== undefined &&
          !isGroupNode(c.id) &&
          !isCollapsedNode(c.id) &&
          !isPortNode(c.id)
            ? [
                {
                  id: c.id,
                  stickyId: stickyIdOf(c.id),
                  x: Math.round(c.position.x),
                  y: Math.round(c.position.y),
                },
              ]
            : [],
        );
        if (moves.length > 0) {
          const viewId = readViewState(editor.doc).view.id;
          const positions: Record<string, { x: number; y: number }> = {};
          editor.batch(() => {
            for (const { id, stickyId, x, y } of moves) {
              if (stickyId !== null) moveStickyInView(editor, stickyId, { x, y });
              else positions[id] = { x, y };
            }
            if (Object.keys(positions).length > 0) editor.moveInView(viewId, positions);
          });
        }
        applySelectChanges(
          changes.flatMap((c) => (c.type === 'select' ? [{ ...c, type: 'node' as const }] : [])),
        );
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        applySelectChanges(
          changes.flatMap((c) => (c.type === 'select' ? [{ ...c, type: 'edge' as const }] : [])),
        );
      },
      onNodeDragStop: () => {
        endGesture();
      },

      isValidConnection: ((c: Connection | Edge) =>
        connectionCheck(readDeck(editor.doc), c.source, c.target) ===
        'ok') satisfies IsValidConnection,
      onConnect: (c: Connection) => {
        if (viewOnly()) return;
        connectComponents(editor, c.source, c.target);
      },
      /** Moves one end of an edge; the edge keeps its id and fields (FR-013). */
      onReconnect: ((oldEdge, c) => {
        if (viewOnly()) return;
        const check = connectionCheck(readDeck(editor.doc), c.source, c.target, oldEdge.id);
        if (check !== 'ok') {
          ui().announce(REFUSAL_TEXT[check]);
          return;
        }
        editor.update('edges', oldEdge.id, { from: c.source, to: c.target });
        ui().select({ edges: [oldEdge.id] });
      }) satisfies OnReconnect,

      onDragOver: (event: DragEvent) => {
        const types = event.dataTransfer.types;
        if (viewOnly() || (!types.includes(KIND_MIME) && !types.includes(NOTE_MIME))) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDrop: (event: DragEvent) => {
        if (viewOnly()) return;
        const note = event.dataTransfer.getData(NOTE_MIME);
        const kind = toComponentKind(event.dataTransfer.getData(KIND_MIME));
        if (kind === null && note !== 'note') return;
        event.preventDefault();
        const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        if (note === 'note') {
          addNoteAt(editor, point);
          return;
        }
        if (kind === null) return;
        addComponent(editor, kind, centredOn(point));
      },
    };
  }, [editor, getViewport, screenToFlowPosition]);
}
