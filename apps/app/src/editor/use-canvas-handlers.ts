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
import { GROUP_NODE_PREFIX } from './deck-to-flow';
import { currentPlayback, goToStep } from './flows/flow-mode';
import { recordClick } from './flows/flow-session';
import { stepForEdge, stepForNode } from './flows/played-path';

/** Drag-and-drop type the palette cards set (palette.tsx). */
export const KIND_MIME = 'application/x-sododeck-kind';

const isGroupNode = (id: string) => id.startsWith(GROUP_NODE_PREFIX);

/** Shift, ⌘ or Ctrl held: add to / remove from the selection instead of replacing it. */
const isMultiSelect = (event: ReactMouseEvent) => event.shiftKey || event.metaKey || event.ctrlKey;

export function useCanvasHandlers() {
  const editor = useEditor();
  const { screenToFlowPosition } = useReactFlow();
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

    /** Applies React Flow's selection deltas; only the marquee is taken from React Flow. */
    const applySelectChanges = (changes: { id: string; selected: boolean }[]) => {
      if (!marquee.current || changes.length === 0 || isFlowMode(ui())) return;
      const { selection } = ui();
      const nodes = new Set(selection.nodes);
      const edges = new Set(selection.edges);
      for (const { id, selected, type } of changes as {
        id: string;
        selected: boolean;
        type: 'node' | 'edge';
      }[]) {
        if (type === 'node' && isGroupNode(id)) continue;
        const set = type === 'node' ? nodes : edges;
        if (selected) set.add(id);
        else set.delete(id);
      }
      ui().select({ nodes: [...nodes], edges: [...edges] });
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

    return {
      onNodeClick: (event: ReactMouseEvent, node: Node) => {
        if (isGroupNode(node.id)) return;
        if (flowMode()) {
          jumpTo((p) => stepForNode(p.played, node.id));
          return;
        }
        if (inSession()) {
          ui().focus(node.id);
          return;
        }
        if (isMultiSelect(event)) ui().toggle(node.id, 'node');
        else ui().select({ nodes: [node.id] });
        ui().focus(node.id);
      },
      onEdgeClick: (event: ReactMouseEvent, edge: Edge) => {
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
        ui().select({ edges: [edge.id] });
        ui().openEdgePopover(edge.id);
      },
      onEdgeMouseEnter: (_: ReactMouseEvent, edge: Edge) => {
        if (inSession()) ui().setHoverEdge(edge.id);
      },
      onEdgeMouseLeave: () => {
        if (ui().hoverEdgeId !== null) ui().setHoverEdge(null);
      },
      onPaneClick: () => {
        // Flow mode keeps going on an empty-canvas click (007); Esc or Back exits.
        if (flowMode()) return;
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
        if (!ui().selection.nodes.includes(node.id)) ui().select({ nodes: [node.id] });
        ui().focus(node.id);
        if (!gestureOpen.current) {
          gestureOpen.current = true;
          // One drag, however many frames and nodes, is one undo step (research R2).
          editor.beginGesture();
        }
      },
      /** Writes dragged positions straight to the document, all moved nodes in one batch. */
      onNodesChange: (changes: NodeChange[]) => {
        if (flowMode()) return;
        const moves = changes.flatMap((c) =>
          c.type === 'position' && c.position !== undefined && !isGroupNode(c.id)
            ? [{ id: c.id, x: Math.round(c.position.x), y: Math.round(c.position.y) }]
            : [],
        );
        if (moves.length > 0) {
          editor.batch(() => {
            for (const { id, x, y } of moves) editor.update('nodes', id, { position: { x, y } });
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
        if (viewOnly() || !event.dataTransfer.types.includes(KIND_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDrop: (event: DragEvent) => {
        const kind = toComponentKind(event.dataTransfer.getData(KIND_MIME));
        if (kind === null || viewOnly()) return;
        event.preventDefault();
        const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addComponent(editor, kind, centredOn(point));
      },
    };
  }, [editor, screenToFlowPosition]);
}
