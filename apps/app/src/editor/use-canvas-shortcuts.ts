/**
 * The editor keyboard map (contracts/canvas-ui.md). React Flow's own keyboard handling is off
 * (research R3); everything lives here:
 *  - `useCanvasKeyDown`: keys that act on the focused canvas (arrows, C, E, Enter, ⌘A, zoom).
 *  - `useEditorShortcuts`: document-wide keys (undo/redo, ⌘S, Delete, Esc), so they work wherever
 *    focus is in the editor, except in text fields (native text undo, typing) and dialogs.
 *    ⌘Z / ⇧⌘Z / ⌘S work on both screens; Delete and Esc only on the canvas screen (008).
 */
import { useReactFlow } from '@xyflow/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect } from 'react';

import { isTextTarget } from '../lib/is-text-target';
import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { displayPosition, nearestInDirection, NODE_SIZE, type Direction } from './canvas-geometry';
import { edgeName } from './deck-to-flow';
import { candidateEdges } from './flows/candidate-edges';
import { exitFlow } from './flows/flow-mode';
import { analysisOf, recordClick, requestCancel, undoLastStep } from './flows/flow-session';
import { useSaveControls } from './save-context';

export { isTextTarget };

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
  const { zoomIn, zoomOut, fitView, setCenter, getZoom } = useReactFlow();

  return useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.defaultPrevented || isTextTarget(event.target)) return;
      const ui = useUiStore.getState();
      const deck = readDeck(editor.doc);
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
        null;

      const direction = ARROWS[key];
      if (direction) {
        event.preventDefault();
        const points = deck.nodes.map((n, i) => {
          const p = displayPosition(n, i);
          return { id: n.id, x: p.x + NODE_SIZE.width / 2, y: p.y + NODE_SIZE.height / 2 };
        });
        const next =
          current === null
            ? (deck.nodes[0]?.id ?? null)
            : nearestInDirection(points, current, direction);
        if (next === null) return;
        if (event.shiftKey) {
          ui.select({
            nodes: [...new Set([...ui.selection.nodes, ...(current ? [current] : []), next])],
            edges: ui.selection.edges,
          });
        } else {
          ui.select({ nodes: [next] });
        }
        ui.focus(next);
        return;
      }

      switch (key.toLowerCase()) {
        case 'c':
          if (current !== null && deck.nodes.some((n) => n.id === current)) {
            event.preventDefault();
            ui.openConnectPopover(current);
          }
          return;
        case 'e': {
          if (current === null) return;
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
          if (ui.focusedEdgeId !== null) {
            event.preventDefault();
            ui.openEdgePopover(ui.focusedEdgeId);
          } else if (current !== null) {
            event.preventDefault();
            ui.select({ nodes: [current] });
            focusInspectorTitle();
          }
          return;
        default:
          return;
      }
    },
    [editor, zoomIn, zoomOut, fitView, setCenter, getZoom],
  );
}

/** Document-wide editor keys. Install once per editor page. */
export function useEditorShortcuts({ canvas = true }: { canvas?: boolean } = {}): void {
  const editor = useEditor();
  const { flush } = useSaveControls();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // ⌘S / Ctrl+S saves now (a no-op when saved) and never opens the browser's save dialog,
      // wherever focus is (FR-006).
      if (isMod(event) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void flush();
        return;
      }
      if (isTextTarget(event.target) || inDialog(event.target)) return;
      const ui = useUiStore.getState();
      const key = event.key.toLowerCase();

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
        const { nodes, edges } = ui.selection;
        if (nodes.length === 0 && edges.length === 0) return;
        event.preventDefault();
        ui.requestDelete({ nodes, edges });
        return;
      }
      if (key === 'escape' && ui.popover === null && ui.pendingDelete === null) {
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
