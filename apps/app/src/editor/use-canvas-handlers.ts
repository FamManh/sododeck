/**
 * React Flow event handlers for the controlled canvas. React Flow only reports gestures; every
 * document change goes through the editor and every selection change through the UI store.
 * Exported as a hook so tests can drive the handlers without a real pointer (jsdom has no layout).
 */
import type {
  Connection,
  Edge,
  EdgeChange,
  FinalConnectionState,
  IsValidConnection,
  Node,
  NodeChange,
} from '@xyflow/react';
import { useReactFlow } from '@xyflow/react';
import type { DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { isKnownType } from '@sododeck/model';
import type { Side } from '@sododeck/schema';
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
import { connectionCheck } from './connection-rules';
import {
  endpointIdOf,
  COLLAPSED_NODE_PREFIX,
  GROUP_NODE_PREFIX,
  MERGED_EDGE_PREFIX,
  PORT_NODE_PREFIX,
  SCOPE_LABEL_PREFIX,
  STICKY_NODE_PREFIX,
  IMAGE_NODE_PREFIX,
} from './deck-to-flow';
import { currentPlayback, goToStep } from './flows/flow-mode';
import { recordClick } from './flows/flow-session';
import { stepForEdge, stepForNode } from './flows/played-path';
import { oneStep } from './fields/one-step';
import { connectTarget, targetScene } from './routing/endpoint-target';
import { addNoteAt } from './stickies/sticky-actions';
import { isNodeLocked, refuseLocked } from './lock';
import { DragController, setActiveGesture } from './editing/drag-session';
import { useUndoToast } from './undo-toast';
import { groupTitleOf } from './schema-groups';
import { scopeOf, visibleGraph } from './visible-graph';
import {
  collapsedOf,
  moveStickyInView,
  readViewState,
  setGroupCollapsed,
} from './views/use-current-view';
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
const imageIdOf = (id: string) =>
  id.startsWith(IMAGE_NODE_PREFIX) ? id.slice(IMAGE_NODE_PREFIX.length) : null;
const groupIdOf = (id: string) =>
  id.startsWith(GROUP_NODE_PREFIX)
    ? id.slice(GROUP_NODE_PREFIX.length)
    : id.startsWith(COLLAPSED_NODE_PREFIX)
      ? id.slice(COLLAPSED_NODE_PREFIX.length)
      : null;

/** The side a connection was dragged from: card handles are ids by side (`component-node-parts.tsx`). */
function sideOfHandle(id: string | null | undefined): Side | null {
  return id === 'top' || id === 'right' || id === 'bottom' || id === 'left' ? id : null;
}

/** Shift, ⌘ or Ctrl held: add to / remove from the selection instead of replacing it. */
const isMultiSelect = (event: ReactMouseEvent) => event.shiftKey || event.metaKey || event.ctrlKey;

export function useCanvasHandlers() {
  const editor = useEditor();
  const { getNodes, getViewport, screenToFlowPosition } = useReactFlow();
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
      const stickies = new Set(selection.stickies);
      const images = new Set(selection.images);
      for (const { id, selected, type } of changes as {
        id: string;
        selected: boolean;
        type: 'node' | 'edge';
      }[]) {
        if (type === 'node' && isGroupNode(id)) continue;
        const stickyId = type === 'node' ? stickyIdOf(id) : null;
        const imageId = type === 'node' ? imageIdOf(id) : null;
        const set =
          type === 'edge'
            ? edges
            : imageId !== null
              ? images
              : stickyId === null
                ? nodes
                : stickies;
        const value = imageId ?? stickyId ?? id;
        if (selected) set.add(value);
        else set.delete(value);
      }
      ui().select({
        nodes: [...nodes],
        edges: [...edges],
        stickies: [...stickies],
        images: [...images],
      });
      ui().setMarqueeCount(nodes.size + stickies.size + images.size);
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
        own.stickies.every((id) => selection.stickies.includes(id)) &&
        own.images.every((id) => selection.images.includes(id));
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
        const imageId = imageIdOf(node.id);
        const clicked =
          groupId !== null
            ? { groups: [groupId] }
            : stickyId !== null
              ? { stickies: [stickyId] }
              : imageId !== null
                ? { images: [imageId] }
                : { nodes: [node.id] };
        if (groupId === null && stickyId === null && imageId === null) ui().focus(node.id);
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
        const imageId = imageIdOf(node.id);
        if (flowMode()) {
          if (stickyId === null && imageId === null) jumpTo((p) => stepForNode(p.played, node.id));
          return;
        }
        if (inSession()) {
          if (stickyId === null && imageId === null) ui().focus(node.id);
          return;
        }
        if (imageId !== null) {
          if (isMultiSelect(event)) ui().toggle(imageId, 'image');
          else ui().select({ images: [imageId] });
          ui().focus(null);
          ui().focusEdge(null);
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
          const title = groupTitleOf(deck, groupId);
          if (title === undefined) return;
          if (isCollapsedNode(node.id)) {
            // A collapsed card opens back into its frame; Enter still drills in.
            setGroupCollapsed(editor, groupId, false);
            ui().select({ groups: [groupId] });
            ui().focus(`${GROUP_NODE_PREFIX}${groupId}`);
            ui().announce(`${title} expanded`);
            return;
          }
          // A frame renames in place, like a card (019 FR-001); Enter still drills in.
          ui().select({ groups: [groupId] });
          ui().focus(node.id);
          ui().startTitleEdit({ target: 'group', id: groupId, isNew: false });
          return;
        }
        if (
          stickyIdOf(node.id) !== null ||
          imageIdOf(node.id) !== null ||
          isPortNode(node.id) ||
          isScopeLabel(node.id)
        )
          return;
        // Any component, with or without children, renames in place (019 FR-001); Enter still
        // opens details or drills in, and "Open inside" drills in by pointer.
        ui().select({ nodes: [node.id] });
        ui().focus(node.id);
        // A locked card keeps its title (043 FR-023): say why instead.
        if (isNodeLocked(deck, node.id)) {
          refuseLocked();
          return;
        }
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
        if (isCollapsedNode(node.id)) {
          // A collapsed group moves as a whole: its frame and members follow the card.
          controller.startGroup(node.id.slice(COLLAPSED_NODE_PREFIX.length), {
            id: node.id,
            position: node.position,
          });
          return;
        }
        if (isCollapsedNode(node.id) || isPortNode(node.id) || isScopeLabel(node.id)) return;
        const stickyId = stickyIdOf(node.id);
        const imageId = imageIdOf(node.id);
        if (imageId !== null) {
          if (!ui().selection.images.includes(imageId)) ui().select({ images: [imageId] });
          ui().focus(null);
          ui().focusEdge(null);
        } else if (stickyId !== null) {
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
                  imageId: imageIdOf(c.id),
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
            for (const { id, stickyId, imageId, x, y } of moves) {
              if (imageId !== null) editor.moveImage(imageId, { x, y });
              else if (stickyId !== null) moveStickyInView(editor, stickyId, { x, y });
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
        // Copies made with ⌥ stay (051), otherwise the pointer decides membership (016 FR-018).
        if (controller.dragging) {
          controller.stop(event !== undefined && 'clientX' in event ? event : undefined);
        }
        if (ui().canvasGesture === 'drag') ui().setCanvasGesture(null);
        endGesture();
      },

      // React Flow reports drawn ids; a group frame or collapsed card stands for its group (050).
      isValidConnection: ((c: Connection | Edge) =>
        connectionCheck(readDeck(editor.doc), endpointIdOf(c.source), endpointIdOf(c.target)) ===
        'ok') satisfies IsValidConnection,
      /**
       * Every new connection is made here, on release, not in `onConnect` (050 T021): the drop is
       * resolved with the same hit test the live line draws (`connectTarget`), so the connector
       * attaches where the line showed. The side it was dragged from is pinned on its start and the
       * drop side and position on the dropped end, in one undo step. The drop may be on a card's
       * body or a handle (a valid React Flow connection) or near an outline or group frame.
       */
      onConnectEnd: (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
        if (viewOnly() || state.fromNode === null) return;
        const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
        if (pointer === undefined) return;
        const hit = connectTarget(
          targetScene(getNodes()),
          state.fromNode.id,
          screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY }),
          {
            zoom: getViewport().zoom,
            mod: 'metaKey' in event && (event.metaKey || event.ctrlKey),
          },
        );
        const fromId = endpointIdOf(state.fromNode.id);
        const startSide = sideOfHandle(state.fromHandle.id);
        // Started from a target handle, the drop is the source (as React Flow's `onConnect`).
        const reversed = state.fromHandle.type === 'target';
        if (hit === null) {
          // A valid drop the hit test missed (a handle at the edge of its reach): connect plainly.
          if (state.isValid !== true || state.toNode === null) return;
          const toId = endpointIdOf(state.toNode.id);
          oneStep(editor, () => {
            const id = reversed
              ? connectComponents(editor, toId, fromId)
              : connectComponents(editor, fromId, toId);
            if (id === null || startSide === null) return;
            editor.setEdgeRoute(id, reversed ? { toSide: startSide } : { fromSide: startSide });
          });
          return;
        }
        const { side, at } = hit.attach;
        oneStep(editor, () => {
          const id = reversed
            ? connectComponents(editor, hit.target.id, fromId)
            : connectComponents(editor, fromId, hit.target.id);
          if (id === null) return;
          const start =
            startSide === null ? {} : reversed ? { toSide: startSide } : { fromSide: startSide };
          editor.setEdgeRoute(
            id,
            reversed
              ? { fromSide: side, fromAt: at, ...start }
              : { toSide: side, toAt: at, ...start },
          );
        });
      },

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
          // From the pad: always a free note, even over a card (053 R7).
          addNoteAt(editor, point, { pin: false });
          return;
        }
        if (type === null) return;
        addComponent(editor, type, centredOn(point, type), { edit: true });
      },
    };
  }, [editor, getNodes, getViewport, screenToFlowPosition, controller]);
}
