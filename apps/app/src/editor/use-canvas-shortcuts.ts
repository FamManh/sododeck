/**
 * The editor keyboard map (contracts/canvas-ui.md). React Flow's own keyboard handling is off
 * (research R3); everything lives here:
 *  - `useCanvasKeyDown`: keys that act on the focused canvas (arrows, C, E, Enter, ⌘A, zoom).
 *  - `useEditorShortcuts`: document-wide keys (undo/redo, ⌘S, Delete, Esc), so they work wherever
 *    focus is in the editor, except in text fields (native text undo, typing) and dialogs.
 *    ⌘Z / ⇧⌘Z / ⌘S work on both screens; Delete and Esc only on the canvas screen (008).
 */
import { stickyCanvasPosition } from '@sododeck/model';
import { useReactFlow } from '@xyflow/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect } from 'react';

import { isTextTarget } from '../lib/is-text-target';
import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { canvasElement } from './canvas-actions';
import {
  displayPosition,
  groupBounds,
  nearestInDirection,
  nodeSize,
  NODE_SIZE,
  type Direction,
} from './canvas-geometry';
import {
  COLLAPSED_NODE_PREFIX,
  edgeName,
  GROUP_NODE_PREFIX,
  MERGED_EDGE_PREFIX,
} from './deck-to-flow';
import { candidateEdges } from './flows/candidate-edges';
import { exitFlow } from './flows/flow-mode';
import { analysisOf, recordClick, requestCancel, undoLastStep } from './flows/flow-session';
import { effectiveLevel, levelForZoom } from './levels';
import { useSaveControls } from './save-context';
import { addNoteAt } from './stickies/sticky-actions';
import { scopeOf, visibleGraph } from './visible-graph';

export { isTextTarget };

function restoreFocus(target: HTMLElement | null): void {
  if (target?.isConnected !== true) return;
  globalThis.setTimeout(() => {
    if (target.isConnected) target.focus();
  }, 0);
}

function inDialog(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]') !== null
  );
}

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const isMod = (e: { metaKey: boolean; ctrlKey: boolean }) => e.metaKey || e.ctrlKey;

const groupIdOf = (id: string) =>
  id.startsWith(GROUP_NODE_PREFIX)
    ? id.slice(GROUP_NODE_PREFIX.length)
    : id.startsWith(COLLAPSED_NODE_PREFIX)
      ? id.slice(COLLAPSED_NODE_PREFIX.length)
      : null;

function selectionForFocusedGroup(collapsed: ReadonlySet<string>, groupId: string) {
  return collapsed.has(groupId)
    ? `${COLLAPSED_NODE_PREFIX}${groupId}`
    : `${GROUP_NODE_PREFIX}${groupId}`;
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

/** Focuses the inspector's title field once the inspector shows the selected node. */
function focusInspectorTitle(): void {
  setTimeout(() => {
    document
      .querySelector<HTMLInputElement>('[aria-label="Inspector"] input[aria-label="Title"]')
      ?.focus();
  }, 0);
}

export function useCanvasKeyDown() {
  const editor = useEditor();
  const { zoomIn, zoomOut, fitView, setCenter, getViewport, getZoom, screenToFlowPosition } =
    useReactFlow();

  return useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.defaultPrevented || isTextTarget(event.target)) return;
      const ui = useUiStore.getState();
      const deck = readDeck(editor.doc);
      const graph = visibleGraph(deck, scopeOf(ui.drill), ui.collapsed);
      const key = event.key;
      const session = ui.flowSession;

      // Recording by keyboard (006 FR-015): Tab / Shift+Tab move between candidate edges, Enter
      // records the focused one. With no candidates Tab leaves the canvas, so Done stays reachable.
      if (session !== null && !isMod(event) && !event.altKey) {
        if (key === 'Tab') {
          const candidates = candidateEdges(deck, analysisOf(deck, session.flowId), session.target);
          if (candidates.length === 0) return;
          const index = candidates.indexOf(session.candidateEdgeId ?? '');
          const next = event.shiftKey
            ? index <= 0
              ? undefined
              : candidates[index - 1]
            : index === candidates.length - 1
              ? undefined
              : candidates[index + 1];
          // Past either end, Tab moves on to the rest of the page.
          if (next === undefined) {
            ui.setCandidate(null);
            ui.focusEdge(null);
            return;
          }
          event.preventDefault();
          ui.setCandidate(next);
          ui.focusEdge(next);
          const edge = deck.edges.find((e) => e.id === next);
          const index2 = (id: string | undefined) => deck.nodes.findIndex((n) => n.id === id);
          const from = deck.nodes[index2(edge?.from)];
          const to = deck.nodes[index2(edge?.to)];
          if (edge && from && to) {
            const a = displayPosition(from, index2(edge.from));
            const b = displayPosition(to, index2(edge.to));
            void setCenter((a.x + b.x + NODE_SIZE.width) / 2, (a.y + b.y + NODE_SIZE.height) / 2, {
              zoom: getZoom(),
            });
            ui.announce(edgeName(from.title, to.title, edge.label));
          }
          return;
        }
        if (key === 'Enter' && session.candidateEdgeId !== null) {
          event.preventDefault();
          recordClick(editor, session.candidateEdgeId);
          ui.setCandidate(null);
          ui.focusEdge(null);
          return;
        }
        // Structure editing is paused while recording (FR-017).
        if (['c', 'e', 'enter'].includes(key.toLowerCase())) return;
      }

      // Flow mode is view-only (007 FR-009): only zoom keys; ← / → belong to the player.
      const flowMode = isFlowMode(ui);
      if (flowMode && !(isMod(event) && ['=', '+', '-', '0'].includes(key))) return;

      if (isMod(event)) {
        const handled = (() => {
          switch (key.toLowerCase()) {
            case 'a':
              ui.select({ nodes: deck.nodes.map((n) => n.id) });
              ui.announce(`${String(deck.nodes.length)} selected`);
              return true;
            case '=':
            case '+':
              void zoomIn();
              return true;
            case '-':
              void zoomOut();
              return true;
            case '0':
              void fitView({ padding: 0.2 });
              return true;
            default:
              return false;
          }
        })();
        if (handled) event.preventDefault();
        return;
      }
      if (event.altKey) return;

      const current =
        ui.focusedId ??
        (ui.selection.nodes.length === 1 ? ui.selection.nodes[0] : undefined) ??
        (ui.selection.groups.length === 1
          ? selectionForFocusedGroup(ui.collapsed, ui.selection.groups[0] ?? '')
          : undefined) ??
        null;
      const selectedSticky =
        ui.selection.stickies.length === 1 ? (ui.selection.stickies[0] ?? null) : null;
      const altKey = event.getModifierState('Alt');

      if (key.toLowerCase() === 'n') {
        if (session !== null || flowMode) return;
        event.preventDefault();
        const pointer = ui.canvasPointer;
        const rect = canvasElement()?.getBoundingClientRect();
        const point =
          pointer ??
          screenToFlowPosition({
            x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
            y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
          });
        addNoteAt(editor, point);
        return;
      }

      if (altKey && event.code === 'KeyC' && selectedSticky !== null) {
        event.preventDefault();
        const sticky = deck.stickies.find((entry) => entry.id === selectedSticky);
        if (sticky === undefined) return;
        const collapsed = sticky.collapsed === true;
        editor.update('stickies', selectedSticky, { collapsed: collapsed ? null : true });
        ui.announce(collapsed ? 'Note expanded' : 'Note collapsed');
        return;
      }
      if (altKey) return;

      const direction = ARROWS[key];
      if (selectedSticky !== null && direction !== undefined) {
        event.preventDefault();
        const sticky = deck.stickies.find((entry) => entry.id === selectedSticky);
        if (sticky === undefined) return;
        const point = stickyCanvasPosition(deck, sticky).point;
        const step = event.shiftKey ? 32 : 8;
        const delta =
          direction === 'up'
            ? { x: 0, y: -step }
            : direction === 'down'
              ? { x: 0, y: step }
              : direction === 'left'
                ? { x: -step, y: 0 }
                : { x: step, y: 0 };
        editor.moveSticky(selectedSticky, { x: point.x + delta.x, y: point.y + delta.y });
        return;
      }
      if (direction) {
        event.preventDefault();
        const scope = scopeOf(ui.drill);
        const level = effectiveLevel(levelForZoom(getZoom()), scope);
        const bounds = groupBounds(deck, nodeSize(level));
        const points = [
          ...graph.groups.flatMap((groupId) => {
            const boundsForGroup = bounds.get(groupId);
            if (boundsForGroup === undefined) return [];
            return [
              { id: `${GROUP_NODE_PREFIX}${groupId}`, x: boundsForGroup.x, y: boundsForGroup.y },
            ];
          }),
          ...graph.cards.map((card) => ({
            id: `${COLLAPSED_NODE_PREFIX}${card.groupId}`,
            x: card.rect.x + card.rect.width / 2,
            y: card.rect.y + card.rect.height / 2,
          })),
          ...graph.nodes.flatMap((nodeId) => {
            const index = deck.nodes.findIndex((node) => node.id === nodeId);
            const node = index < 0 ? undefined : deck.nodes[index];
            if (node === undefined) return [];
            const p = displayPosition(node, index);
            const size = nodeSize(level);
            return [{ id: node.id, x: p.x + size.width / 2, y: p.y + size.height / 2 }];
          }),
        ];
        const next =
          current === null
            ? (points[0]?.id ?? null)
            : nearestInDirection(points, current, direction);
        if (next === null) return;
        const groupId = groupIdOf(next);
        if (event.shiftKey) {
          if (groupId !== null) {
            const currentGroupId = current === null ? null : groupIdOf(current);
            ui.select({
              nodes: ui.selection.nodes,
              edges: ui.selection.edges,
              groups: [
                ...new Set([
                  ...ui.selection.groups,
                  ...(currentGroupId === null ? [] : [currentGroupId]),
                  groupId,
                ]),
              ],
              stickies: ui.selection.stickies,
            });
          } else {
            ui.select({
              nodes: [...new Set([...ui.selection.nodes, ...(current ? [current] : []), next])],
              edges: ui.selection.edges,
              groups: ui.selection.groups,
              stickies: ui.selection.stickies,
            });
          }
        } else {
          if (groupId !== null) ui.select({ groups: [groupId] });
          else ui.select({ nodes: [next] });
        }
        ui.focus(groupId === null ? next : selectionForFocusedGroup(ui.collapsed, groupId));
        return;
      }

      switch (key.toLowerCase()) {
        case ' ': {
          const groupId = current === null ? null : groupIdOf(current);
          if (groupId === null) return;
          event.preventDefault();
          const nextCollapsed = !ui.collapsed.has(groupId);
          ui.toggleCollapsed(groupId);
          ui.select({ groups: [groupId] });
          ui.focus(
            nextCollapsed ? `${COLLAPSED_NODE_PREFIX}${groupId}` : `${GROUP_NODE_PREFIX}${groupId}`,
          );
          const title = deck.groups.find((group) => group.id === groupId)?.title ?? groupId;
          ui.announce(`${title} ${nextCollapsed ? 'collapsed' : 'expanded'}`);
          return;
        }
        case 'c':
          if (current !== null && deck.nodes.some((n) => n.id === current)) {
            event.preventDefault();
            ui.openConnectPopover(current);
          }
          return;
        case 'e': {
          if (current === null) return;
          const groupId = groupIdOf(current);
          if (groupId !== null) {
            const ownMerged = graph.merged.filter(
              (edge) =>
                edge.a === `${COLLAPSED_NODE_PREFIX}${groupId}` ||
                edge.b === `${COLLAPSED_NODE_PREFIX}${groupId}`,
            );
            if (ownMerged.length === 0) return;
            event.preventDefault();
            const index = ownMerged.findIndex((edge) => edge.id === ui.focusedEdgeId);
            const edge = ownMerged[(index + 1) % ownMerged.length];
            if (edge === undefined) return;
            ui.focus(selectionForFocusedGroup(ui.collapsed, groupId));
            ui.focusEdge(edge.id);
            const titles = new Map(deck.groups.map((group) => [group.id, group.title]));
            const nameOf = (id: string) =>
              id.startsWith(COLLAPSED_NODE_PREFIX)
                ? (titles.get(id.slice(COLLAPSED_NODE_PREFIX.length)) ?? id)
                : (deck.nodes.find((node) => node.id === id)?.title ?? id);
            ui.announce(
              `${String(edge.edgeIds.length)} connections between ${nameOf(edge.a)} and ${nameOf(edge.b)}`,
            );
            return;
          }
          const titles = new Map(deck.nodes.map((n) => [n.id, n.title]));
          const own = deck.edges.filter(
            (e) =>
              (e.from === current || e.to === current) && titles.has(e.from) && titles.has(e.to),
          );
          if (own.length === 0) return;
          event.preventDefault();
          const index = own.findIndex((e) => e.id === ui.focusedEdgeId);
          const edge = own[(index + 1) % own.length];
          if (!edge) return;
          if (ui.focusedId !== current) ui.focus(current);
          useUiStore.getState().focusEdge(edge.id);
          ui.select({ edges: [edge.id] });
          ui.announce(edgeName(titles.get(edge.from) ?? '', titles.get(edge.to) ?? '', edge.label));
          return;
        }
        case 'enter':
          if (selectedSticky !== null) {
            event.preventDefault();
            ui.setStickyEditing(selectedSticky);
          } else if (ui.focusedEdgeId?.startsWith(MERGED_EDGE_PREFIX) === true) {
            event.preventDefault();
            ui.openMergedPopover(ui.focusedEdgeId);
          } else if (current !== null && groupIdOf(current) !== null) {
            const groupId = groupIdOf(current);
            if (groupId === null) return;
            const title = deck.groups.find((group) => group.id === groupId)?.title;
            if (title === undefined) return;
            event.preventDefault();
            ui.drillInto({ kind: 'group', id: groupId, viewport: getViewport() });
            ui.announce(`Opened ${title}`);
          } else if (current !== null && (graph.childCount.get(current) ?? 0) > 0) {
            const title = deck.nodes.find((node) => node.id === current)?.title;
            if (title === undefined) return;
            event.preventDefault();
            ui.drillInto({ kind: 'node', id: current, viewport: getViewport() });
            ui.announce(`Opened ${title}`);
          } else if (ui.focusedEdgeId !== null) {
            event.preventDefault();
            ui.openEdgePopover(ui.focusedEdgeId);
          } else if (current !== null) {
            event.preventDefault();
            ui.select({ nodes: [current] });
            focusInspectorTitle();
          }
          return;
        case 'f2':
          if (selectedSticky !== null) {
            event.preventDefault();
            ui.setStickyEditing(selectedSticky);
          }
          return;
        default:
          return;
      }
    },
    [editor, zoomIn, zoomOut, fitView, setCenter, getViewport, getZoom, screenToFlowPosition],
  );
}

/** Document-wide editor keys. Install once per editor page. */
export function useEditorShortcuts({ canvas = true }: { canvas?: boolean } = {}): void {
  const editor = useEditor();
  const { flush } = useSaveControls();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const key = event.key.toLowerCase();
      if (isMod(event) && !event.altKey && key === 'k') {
        event.preventDefault();
        const ui = useUiStore.getState();
        if (isTextTarget(event.target) && event.target instanceof HTMLElement) {
          event.target.blur();
        }
        if (ui.palette.open) {
          const returnFocus = ui.palette.returnFocus;
          ui.closePalette();
          restoreFocus(returnFocus);
        } else {
          ui.openPalette(event.target instanceof HTMLElement ? event.target : null);
        }
        return;
      }
      // ⌘S / Ctrl+S saves now (a no-op when saved) and never opens the browser's save dialog,
      // wherever focus is (FR-006).
      if (isMod(event) && !event.altKey && key === 's') {
        event.preventDefault();
        void flush();
        return;
      }
      if (isTextTarget(event.target) || inDialog(event.target)) return;
      const ui = useUiStore.getState();

      if (isMod(event) && (key === 'z' || (key === 'y' && event.ctrlKey && !event.metaKey))) {
        event.preventDefault();
        const redo = key === 'y' || event.shiftKey;
        // While recording, ⌘Z takes back the last recorded step (006 FR-014).
        if (!redo && ui.flowSession?.mode === 'record') {
          undoLastStep(editor);
          return;
        }
        if (redo ? editor.redo() : editor.undo()) ui.announce(redo ? 'Redone' : 'Undone');
        return;
      }
      if (isMod(event) || event.altKey) return;
      // Delete and Esc act on the canvas selection: only on the canvas screen (008 research R8).
      if (!canvas) return;

      if (isFlowMode(ui)) {
        // View-only: no deletes; Esc leaves flow mode unless a popover or dialog owns it.
        if (key === 'escape' && ui.popover === null && ui.pendingDelete === null) {
          if (event.target instanceof Element && event.target.closest('[role="menu"]') !== null) {
            return;
          }
          event.preventDefault();
          exitFlow();
        }
        return;
      }

      if (ui.flowSession !== null) {
        // Sessions pause canvas deletes; ⌫ on a step row is the step list's (FR-017, FR-020).
        if (key === 'escape' && ui.pendingDelete === null) {
          event.preventDefault();
          if (ui.flowSession.invalid !== null) ui.setInvalid(null);
          else if (!ui.flowSession.confirmingCancel) requestCancel(editor);
        }
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (ui.pendingDelete !== null) return;
        const { nodes, edges, groups } = ui.selection;
        if (nodes.length === 0 && edges.length === 0) {
          if (groups.length === 0 && ui.drill.length > 0) {
            event.preventDefault();
            ui.drillUp();
            ui.announce(`Back to ${scopeTitle(readDeck(editor.doc), useUiStore.getState().drill)}`);
            return;
          }
          if (groups.length > 0) {
            event.preventDefault();
            ui.announce("Groups can't be deleted from the canvas yet");
          }
          return;
        }
        event.preventDefault();
        ui.requestDelete({ nodes, edges });
        return;
      }
      if (key === 'escape' && ui.popover === null && ui.pendingDelete === null) {
        if (
          ui.selection.nodes.length === 0 &&
          ui.selection.edges.length === 0 &&
          ui.selection.groups.length === 0 &&
          ui.selection.stickies.length === 0
        ) {
          if (ui.drill.length === 0) return;
          event.preventDefault();
          ui.drillUp();
          ui.announce(`Back to ${scopeTitle(readDeck(editor.doc), useUiStore.getState().drill)}`);
          return;
        }
        ui.clearSelection();
        ui.focusEdge(null);
      }
    };
    // Capture: runs before Radix's own Escape handling can change the store under us.
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [editor, flush, canvas]);
}
