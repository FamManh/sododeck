/**
 * React Flow event handlers for the controlled canvas. React Flow only reports gestures; every
 * document change goes through the editor and every selection change through the UI store.
 * Exported as a hook so tests can drive the handlers without a real pointer (jsdom has no layout).
 */
import type {
  Connection,
  Edge,
  EdgeChange,
  HandleType,
  IsValidConnection,
  Node,
  NodeChange,
  OnReconnect,
} from '@xyflow/react';
import { useReactFlow, useStore } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isKnownType } from '@sododeck/model';
import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { EMPTY_SELECTION, isFlowMode, useUiStore, type Selection } from '../state/ui-store';
import { targetOf } from './actions/use-action-context';
import {
  addComponent,
  canvasElement,
  centredOn,
  connectComponents,
  nodeElement,
} from './canvas-actions';
import { BUNDLE_EDGE_PREFIX } from './bundles';
import { cardBox, type Rect } from './canvas-geometry';
import { connectionCheck, REFUSAL_TEXT } from './connection-rules';
import {
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  MERGED_EDGE_PREFIX,
  PORT_NODE_PREFIX,
  SCOPE_LABEL_PREFIX,
  STICKY_NODE_PREFIX,
} from './deck-to-flow';
import { currentPlayback, goToStep } from './flows/flow-mode';
import { recordClick } from './flows/flow-session';
import { stepForEdge, stepForNode } from './flows/played-path';
import { oneStep } from './fields/one-step';
import { effectiveLevel, levelSelector } from './levels';
import { nearestSide } from './routing/route-path';
import { addNoteAt } from './stickies/sticky-actions';
import { DragController, setActiveGesture } from './editing/drag-session';
import { useUndoToast } from './undo-toast';
import { scopeOf, visibleGraph } from './visible-graph';
import { collapsedOf, moveStickyInView, readViewState } from './views/use-current-view';
import { stepForEdges, stepForGroup } from './collapse-flow-marks';

/** Drag-and-drop type the palette cards set (palette.tsx). */
export const TYPE_MIME = 'application/x-sododeck-type';
export const NOTE_MIME = 'application/x-sododeck-note';

const isGroupNode = (id: string) => id.startsWith(GROUP_NODE_PREFIX);
const isCollapsedNode = (id: string) => id.startsWith(COLLAPSED_NODE_PREFIX);
const isPortNode = (id: string) => id.startsWith(PORT_NODE_PREFIX);
const isMergedEdge = (id: string) => id.startsWith(MERGED_EDGE_PREFIX);
const isScopeLabel = (id: string) => id.startsWith(SCOPE_LABEL_PREFIX);
const isBundleEdge = (id: string) => id.startsWith(BUNDLE_EDGE_PREFIX);
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
  const undoToast = useUndoToast();
  // Component and group drags (016): one controller for the canvas's lifetime, so a re-render
  // mid-drag (a toast appearing changes `undoToast`) never drops the running session and leaves
  // its gesture open. It gets the latest inputs after each render.
  const [controller] = useState(
    () =>
      new DragController({
        editor,
        getViewport,
        screenToFlowPosition,
        undoToast,
        canvasSize: () => {
          const box = canvasElement()?.getBoundingClientRect();
          return { width: box?.width ?? 0, height: box?.height ?? 0 };
        },
      }),
  );
  useEffect(() => {
    controller.update({ getViewport, screenToFlowPosition, undoToast });
  });

  // True between React Flow's onSelectionStart and onSelectionEnd (marquee).
  const marquee = useRef(false);

  // An endpoint reconnect (R12): which end is moving, and the window listener tracking it while
  // the gesture runs (both outlive a `useMemo` re-creation, unlike a plain closure variable).
  const reconnectEnd = useRef<HandleType | null>(null);
  const endpointMoveHandler = useRef<((event: MouseEvent) => void) | null>(null);
  const zoomLevel = useStore(levelSelector);

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
      ui().setMarqueeCount(nodes.size + stickies.size);
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
      if (tool === 'select' || tool === 'hand' || viewOnly()) return false;
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

    /**
     * Opens the canvas menu for a right-clicked object (019 FR-034): an unselected object becomes
     * the selection first; inside the selection the whole selection is kept. In flow mode and
     * sessions the selection is left alone (selecting would leave the flow).
     */
    const openMenu = (
      event: ReactMouseEvent,
      clicked: Partial<Selection> | null,
      returnFocus: HTMLElement | null,
    ) => {
      event.preventDefault();
      const { selection } = ui();
      const own = clicked === null ? EMPTY_SELECTION : { ...EMPTY_SELECTION, ...clicked };
      const inside =
        own.nodes.every((id) => selection.nodes.includes(id)) &&
        own.edges.every((id) => selection.edges.includes(id)) &&
        own.groups.every((id) => selection.groups.includes(id)) &&
        own.stickies.every((id) => selection.stickies.includes(id));
      let target = own;
      if (clicked !== null && inside) target = selection;
      else if (clicked !== null && !viewOnly()) ui().select(own);
      ui().openContextMenu({
        target: targetOf(target),
        point: { x: event.clientX, y: event.clientY },
        via: 'pointer',
        returnFocus,
      });
    };

    return {
      onNodeContextMenu: (event: ReactMouseEvent, node: Node) => {
        if (isPortNode(node.id) || isScopeLabel(node.id)) {
          event.preventDefault();
          return;
        }
        const groupId = groupIdOf(node.id);
        const stickyId = stickyIdOf(node.id);
        const clicked =
          groupId !== null
            ? { groups: [groupId] }
            : stickyId !== null
              ? { stickies: [stickyId] }
              : { nodes: [node.id] };
        if (groupId === null && stickyId === null) ui().focus(node.id);
        openMenu(event, clicked, nodeElement(node.id));
      },
      onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => {
        if (isMergedEdge(edge.id) || isBundleEdge(edge.id)) {
          event.preventDefault();
          return;
        }
        openMenu(event, { edges: [edge.id] }, null);
      },
      onSelectionContextMenu: (event: ReactMouseEvent) => {
        event.preventDefault();
        ui().openContextMenu({
          target: targetOf(ui().selection),
          point: { x: event.clientX, y: event.clientY },
          via: 'pointer',
        });
      },
      onPaneContextMenu: (event: ReactMouseEvent | MouseEvent) => {
        event.preventDefault();
        ui().openContextMenu({
          target: { kind: 'canvas' },
          point: { x: event.clientX, y: event.clientY },
          via: 'pointer',
        });
      },
      onNodeClick: (event: ReactMouseEvent, node: Node) => {
        if (isScopeLabel(node.id)) return;
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
        if (stickyIdOf(node.id) !== null || isPortNode(node.id) || isScopeLabel(node.id)) return;
        // Any component, with or without children, renames in place (019 FR-001); Enter still
        // opens details or drills in, and "Open inside" drills in by pointer.
        ui().select({ nodes: [node.id] });
        ui().focus(node.id);
        ui().startTitleEdit({ target: 'node', id: node.id, isNew: false });
      },
      onEdgeClick: (event: ReactMouseEvent, edge: Edge) => {
        if (isBundleEdge(edge.id)) {
          // A bundle's curve opens the list of its connectors (034 R6); its pill fans them out.
          if (flowMode() || inSession()) return;
          ui().focusEdge(edge.id);
          ui().openMergedPopover(edge.id);
          return;
        }
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
        if (isMergedEdge(edge.id) || isBundleEdge(edge.id)) {
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
      /** A pan or zoom by the user hides the selection toolbar until it ends (019 R5). */
      onMoveStart: (event: MouseEvent | TouchEvent | null) => {
        if (event !== null) ui().setCanvasGesture('pan');
      },
      onMoveEnd: () => {
        if (ui().canvasGesture === 'pan') ui().setCanvasGesture(null);
      },
      onPaneClick: (event: ReactMouseEvent) => {
        // Flow mode keeps going on an empty-canvas click (007); Esc or Back exits.
        if (flowMode()) return;
        if (applyTool(event, null)) return;
        ui().clearSelection();
        ui().closePopover();
        // Clicking empty canvas folds every fanned-out bundle (034).
        ui().foldBundles();
      },
      /**
       * A marquee (016 R13): its count chip and hint bar; Esc puts the selection back as it was
       * before the marquee started.
       */
      onSelectionStart: () => {
        marquee.current = true;
        const before = ui().selection;
        ui().setCanvasGesture('marquee');
        ui().setMarqueeCount(0);
        setActiveGesture({
          cancel: () => {
            if (!marquee.current) return false;
            marquee.current = false;
            ui().select(before);
            ui().setMarqueeCount(null);
            ui().setCanvasGesture(null);
            ui().announce('Cancelled');
            return true;
          },
          arrow: () => false,
        });
      },
      onSelectionEnd: () => {
        marquee.current = false;
        setActiveGesture(null);
        ui().setMarqueeCount(null);
        if (ui().canvasGesture === 'marquee') ui().setCanvasGesture(null);
      },

      onNodeDragStart: (_: unknown, node: Node) => {
        if (viewOnly()) return;
        // The selection toolbar hides while a card moves (019 FR-026).
        ui().setCanvasGesture('drag');
        if (isGroupNode(node.id)) {
          // A frame dragged by its label or edge (016 R5): the whole subtree moves.
          controller.startGroup(node.id.slice(GROUP_NODE_PREFIX.length));
          return;
        }
        if (isCollapsedNode(node.id) || isPortNode(node.id) || isScopeLabel(node.id)) return;
        const stickyId = stickyIdOf(node.id);
        if (stickyId !== null) {
          if (!ui().selection.stickies.includes(stickyId)) ui().select({ stickies: [stickyId] });
          ui().focus(null);
          ui().focusEdge(null);
        } else {
          if (!ui().selection.nodes.includes(node.id)) ui().select({ nodes: [node.id] });
          ui().focus(node.id);
          // One drag, however many frames and nodes, is one undo step (research R2); snapping,
          // drop into groups, ⌥ copies and Esc live in the controller (016).
          controller.startNodes(node.id);
          return;
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
      /** Pointer and modifier keys during a drag: the drop target, ⌥, ⇧ and ⌘ (016). */
      onNodeDrag: (event: ReactMouseEvent | MouseEvent | TouchEvent) => {
        if ('clientX' in event) controller.pointer(event);
      },
      onNodesChange: (all: NodeChange[]) => {
        if (flowMode()) return;
        // The drag controller moves its components and frames itself; notes go on below.
        const changes = controller.change(all);
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
      onNodeDragStop: (event?: ReactMouseEvent | MouseEvent | TouchEvent) => {
        // ⌥ copies, otherwise the pointer decides membership (016 FR-009, FR-018).
        if (controller.dragging) {
          controller.stop(event);
        }
        if (ui().canvasGesture === 'drag') ui().setCanvasGesture(null);
        endGesture();
      },

      isValidConnection: ((c: Connection | Edge) =>
        connectionCheck(readDeck(editor.doc), c.source, c.target) ===
        'ok') satisfies IsValidConnection,
      onConnect: (c: Connection) => {
        if (viewOnly()) return;
        connectComponents(editor, c.source, c.target);
      },
      /**
       * A reconnect drag (R12): the hovered card's nearest side is "hot" throughout (own
       * `mousemove` listener, since xyflow reports only the final connection on drop).
       */
      onReconnectStart: (_event: ReactMouseEvent, edge: Edge, handleType: HandleType) => {
        if (viewOnly()) return;
        ui().setCanvasGesture('endpoint');
        ui().setReconnectingEdge(edge.id);
        reconnectEnd.current = handleType;
        const level = effectiveLevel(zoomLevel, scopeOf(ui().drill));
        const onMove = (event: MouseEvent) => {
          const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
          const { deck } = readViewState(editor.doc);
          const hovered = deck.nodes.reduce<{ nodeId: string; box: Rect } | null>(
            (acc, node, index) => {
              const box = cardBox(node, index, level);
              return point.x >= box.x &&
                point.x <= box.x + box.width &&
                point.y >= box.y &&
                point.y <= box.y + box.height
                ? { nodeId: node.id, box }
                : acc;
            },
            null,
          );
          ui().setEndpointHover(
            hovered === null
              ? null
              : { nodeId: hovered.nodeId, side: nearestSide(hovered.box, point) },
          );
        };
        endpointMoveHandler.current = onMove;
        window.addEventListener('mousemove', onMove);
      },
      onReconnectEnd: () => {
        if (endpointMoveHandler.current !== null) {
          window.removeEventListener('mousemove', endpointMoveHandler.current);
          endpointMoveHandler.current = null;
        }
        if (ui().canvasGesture === 'endpoint') ui().setCanvasGesture(null);
        ui().setEndpointHover(null);
        ui().setReconnectingEdge(null);
        reconnectEnd.current = null;
      },
      /**
       * Moves one end of an edge; the edge keeps its id and fields (FR-013). The moved end's side
       * comes from `endpointHover` (nearest side of the drop point, R12), so dropping on the
       * body target still pins a side; another card also clears the offset (old geometry).
       */
      onReconnect: ((oldEdge, c) => {
        if (viewOnly()) return;
        const check = connectionCheck(readDeck(editor.doc), c.source, c.target, oldEdge.id);
        if (check !== 'ok') {
          ui().announce(REFUSAL_TEXT[check]);
          return;
        }
        const end = reconnectEnd.current ?? 'target';
        const movedNodeId = end === 'source' ? c.source : c.target;
        const hover = ui().endpointHover;
        const side = hover !== null && hover.nodeId === movedNodeId ? hover.side : null;
        const sameCard = oldEdge.source === c.source && oldEdge.target === c.target;
        if (sameCard && side === null) return;
        oneStep(editor, () => {
          if (!sameCard) editor.update('edges', oldEdge.id, { from: c.source, to: c.target });
          if (side !== null) {
            editor.setEdgeRoute(oldEdge.id, {
              ...(end === 'source' ? { fromSide: side } : { toSide: side }),
              ...(sameCard ? {} : { offset: null }),
            });
          } else if (!sameCard) {
            editor.setEdgeRoute(oldEdge.id, { offset: null });
          }
        });
        ui().select({ edges: [oldEdge.id] });
        if (side !== null) {
          ui().announce(
            `Connection now ${end === 'source' ? 'leaves from' : 'enters from'} the ${side}`,
          );
        }
      }) satisfies OnReconnect,

      onDragOver: (event: DragEvent) => {
        const types = event.dataTransfer.types;
        if (viewOnly() || (!types.includes(TYPE_MIME) && !types.includes(NOTE_MIME))) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDrop: (event: DragEvent) => {
        if (viewOnly()) return;
        const note = event.dataTransfer.getData(NOTE_MIME);
        const dragged = event.dataTransfer.getData(TYPE_MIME);
        const type = isKnownType(dragged) ? dragged : null;
        if (type === null && note !== 'note') return;
        event.preventDefault();
        const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        if (note === 'note') {
          addNoteAt(editor, point);
          return;
        }
        if (type === null) return;
        addComponent(editor, type, centredOn(point), { edit: true });
      },
    };
  }, [editor, getViewport, screenToFlowPosition, controller, zoomLevel]);
}
