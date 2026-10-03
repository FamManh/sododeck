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
import { useCallback, useEffect, useRef } from 'react';

import { isTextTarget } from '../lib/is-text-target';
import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { EMPTY_SELECTION, isFlowMode, useUiStore, type Selection } from '../state/ui-store';
import { alignSelection } from './actions/align-actions';
import { readActionContext, targetOf, useRunAction } from './actions/use-action-context';
import type { AlignMode } from './editing/align';
import { useNudge } from './editing/use-nudge';
import { useResizeKey } from './editing/use-resize-key';
import { useSegmentKey } from './editing/use-segment-key';
import {
  consumeLeftToolbar,
  focusSelectionToolbar,
  toolbarShown,
} from './quick-edit/toolbar-focus';
import { canvasElement, nodeElement, selectAllComponents } from './canvas-actions';
import {
  cardSize,
  displayPosition,
  groupBounds,
  nearestInDirection,
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
import {
  collapsedOf,
  moveStickyInView,
  readViewState,
  toggleGroupCollapsed,
} from './views/use-current-view';
import { viewCrumbTitle } from './views/view-title';
import { drillScopeTitle } from './outline';
import { cancelActiveGesture, nudgeActiveDrag, resetActiveGesture } from './editing/drag-session';

export { isTextTarget };

function restoreFocus(target: HTMLElement | null): void {
  if (target?.isConnected !== true) return;
  globalThis.setTimeout(() => {
    if (target.isConnected) target.focus();
  }, 0);
}

export function inDialog(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]') !== null
  );
}

/**
 * The details drawer and the JSON overlay (018), the selection toolbar and the canvas menu (019)
 * float over the canvas but are not dialogs: Delete and Esc there belong to their fields and
 * buttons, never to the canvas selection.
 */
export function inOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      '[data-region="drawer"], [data-json-overlay], [data-flyout], [data-quick-toolbar], [role="menu"]',
    ) !== null
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

/** The one real component `⌘⇧` + arrow would resize (T048): never a group or collapsed group. */
function singleComponentId(ui: { focusedId: string | null; selection: Selection }): string | null {
  if (ui.focusedId !== null) return groupIdOf(ui.focusedId) === null ? ui.focusedId : null;
  return ui.selection.nodes.length === 1 ? (ui.selection.nodes[0] ?? null) : null;
}

/**
 * ⇧F10 / ContextMenu (019 R7): the menu of the selection (or the focused card), anchored at the
 * bottom-left of its element, or the canvas menu at the view centre.
 */
function openMenuFromKeyboard(opener: HTMLElement | null): void {
  const ui = useUiStore.getState();
  const selection = hasSelection(ui.selection)
    ? ui.selection
    : ui.focusedId !== null && groupIdOf(ui.focusedId) === null
      ? { ...EMPTY_SELECTION, nodes: [ui.focusedId] }
      : ui.focusedId !== null
        ? { ...EMPTY_SELECTION, groups: [groupIdOf(ui.focusedId) ?? ''] }
        : EMPTY_SELECTION;
  const target = targetOf(selection);
  const anchor =
    (ui.focusedId === null ? null : nodeElement(ui.focusedId)) ??
    (selection.nodes[0] === undefined ? null : nodeElement(selection.nodes[0]));
  const rect = anchor?.getBoundingClientRect();
  const canvas = canvasElement()?.getBoundingClientRect();
  const point =
    target.kind !== 'canvas' && rect !== undefined && rect.width > 0
      ? { x: rect.left, y: rect.bottom }
      : {
          x: (canvas?.left ?? 0) + (canvas?.width ?? 0) / 2,
          y: (canvas?.top ?? 0) + (canvas?.height ?? 0) / 2,
        };
  ui.openContextMenu({ target, point, via: 'keyboard', returnFocus: opener });
}

const hasSelection = (s: Selection) =>
  s.nodes.length + s.edges.length + s.groups.length + s.stickies.length > 0;

const ALIGN_KEYS: Readonly<Record<string, AlignMode>> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'top',
  KeyS: 'bottom',
};

export function useCanvasKeyDown() {
  const editor = useEditor();
  const nudger = useNudge();
  const resizeKeyer = useResizeKey();
  const segmentKeyer = useSegmentKey();
  const { zoomIn, zoomOut, fitView, setCenter, getViewport, getZoom, screenToFlowPosition } =
    useReactFlow();

  return useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.defaultPrevented || isTextTarget(event.target)) return;
      const ui = useUiStore.getState();
      // Geometry and targets as the current view draws them (011).
      const deck = readViewState(editor.doc).deck;
      const collapsed = collapsedOf(editor.doc);
      const graph = visibleGraph(deck, scopeOf(ui.drill), collapsed);
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
            const level = effectiveLevel(levelForZoom(getZoom()), scopeOf(ui.drill));
            const a = displayPosition(from, index2(edge.from));
            const b = displayPosition(to, index2(edge.to));
            const sizeA = cardSize(from, level);
            const sizeB = cardSize(to, level);
            void setCenter(
              (a.x + sizeA.width / 2 + (b.x + sizeB.width / 2)) / 2,
              (a.y + sizeA.height / 2 + (b.y + sizeB.height / 2)) / 2,
              { zoom: getZoom() },
            );
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

      // The canvas menu from the keyboard (019 FR-028), in every mode.
      if ((key === 'F10' && event.shiftKey && !isMod(event)) || key === 'ContextMenu') {
        event.preventDefault();
        openMenuFromKeyboard(event.target instanceof HTMLElement ? event.target : null);
        return;
      }

      // Flow mode is view-only (007 FR-009): only zoom keys and Space on groups / cards.
      const flowMode = isFlowMode(ui);
      if (flowMode && key !== ' ' && !(isMod(event) && ['=', '+', '-', '0'].includes(key))) {
        return;
      }

      if (isMod(event)) {
        // ⌘⇧ arrows resize the focused component (017 R9/R10), one real card at a time.
        if (event.shiftKey && key in ARROWS) {
          const id = singleComponentId(ui);
          const index = id === null ? -1 : deck.nodes.findIndex((n) => n.id === id);
          const node = index === -1 ? undefined : deck.nodes[index];
          if (node !== undefined) {
            const level = effectiveLevel(levelForZoom(getZoom()), scopeOf(ui.drill));
            const size = cardSize(node, level);
            if (
              resizeKeyer.key(event, {
                id: node.id,
                title: node.title,
                width: size.width,
                height: size.height,
              })
            ) {
              event.preventDefault();
              return;
            }
          }
        }
        const handled = (() => {
          switch (key.toLowerCase()) {
            case 'a':
              selectAllComponents(editor);
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
      // ⌥(⇧) arrows move a single selected connection's middle segment (017 R9), or otherwise
      // nudge the selection (016 FR-024); ⌥A / ⌥D / ⌥W / ⌥S align it (R12), by `code` because ⌥
      // changes `key` on macOS.
      if (event.altKey) {
        if (segmentKeyer.key(event, effectiveLevel(levelForZoom(getZoom()), scopeOf(ui.drill)))) {
          event.preventDefault();
          return;
        }
        if (nudger.key(event)) {
          event.preventDefault();
          return;
        }
        const mode = ALIGN_KEYS[event.code];
        if (mode !== undefined && !event.shiftKey && session === null) {
          event.preventDefault();
          alignSelection(
            readActionContext(
              editor,
              { fitView, screenToFlowPosition, getViewport },
              () => undefined,
            ),
            mode,
          );
          return;
        }
      }
      if (event.altKey) return;

      const current =
        ui.focusedId ??
        (ui.selection.nodes.length === 1 ? ui.selection.nodes[0] : undefined) ??
        (ui.selection.groups.length === 1
          ? selectionForFocusedGroup(collapsed, ui.selection.groups[0] ?? '')
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
        moveStickyInView(editor, selectedSticky, { x: point.x + delta.x, y: point.y + delta.y });
        return;
      }
      if (direction) {
        event.preventDefault();
        const scope = scopeOf(ui.drill);
        const level = effectiveLevel(levelForZoom(getZoom()), scope);
        const bounds = groupBounds(deck, level);
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
            const size = cardSize(node, level);
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
        ui.focus(groupId === null ? next : selectionForFocusedGroup(collapsed, groupId));
        return;
      }

      // Tab from a selected object enters its toolbar (019 FR-041), unless it just came back.
      if (key === 'Tab' && !event.shiftKey && !consumeLeftToolbar() && toolbarShown()) {
        event.preventDefault();
        focusSelectionToolbar();
        return;
      }

      switch (key.toLowerCase()) {
        case 'p':
          // The protocol picker of the selected connection (019 FR-042), from its toolbar.
          if (ui.selection.edges.length === 1 && toolbarShown()) {
            event.preventDefault();
            ui.openToolbarField('protocol');
          }
          return;
        case ' ': {
          const groupId = current === null ? null : groupIdOf(current);
          if (groupId === null) return;
          event.preventDefault();
          if (event.repeat) return;
          // Toggle on release, and only for a plain press: holding Space pans the canvas (React
          // Flow's pan key), and the repeating key used to flip the group open and shut.
          let panned = false;
          const onPointer = () => {
            panned = true;
          };
          const onRelease = (up: KeyboardEvent) => {
            if (up.key !== ' ') return;
            document.removeEventListener('keyup', onRelease, true);
            document.removeEventListener('pointerdown', onPointer, true);
            if (panned) return;
            const nextCollapsed = toggleGroupCollapsed(editor, groupId);
            const now = useUiStore.getState();
            if (!flowMode) now.select({ groups: [groupId] });
            now.focus(
              nextCollapsed
                ? `${COLLAPSED_NODE_PREFIX}${groupId}`
                : `${GROUP_NODE_PREFIX}${groupId}`,
            );
            const title = deck.groups.find((group) => group.id === groupId)?.title ?? groupId;
            now.announce(`${title} ${nextCollapsed ? 'collapsed' : 'expanded'}`);
          };
          document.addEventListener('pointerdown', onPointer, true);
          document.addEventListener('keyup', onRelease, true);
          return;
        }
        case 'c':
          if (current !== null && deck.nodes.some((n) => n.id === current)) {
            event.preventDefault();
            ui.openConnectPopover(current);
          }
          return;
        case 'f':
          if (session !== null || flowMode) return;
          event.preventDefault();
          if (ui.focusMode) {
            ui.setFocusMode(false);
            return;
          }
          if (ui.selection.nodes.length + ui.selection.groups.length !== 1) {
            ui.announce('Select a component to focus');
            return;
          }
          if (ui.selection.nodes.length === 1) {
            const nodeId = ui.selection.nodes[0];
            if (nodeId !== undefined) ui.focus(nodeId);
          } else {
            const groupId = ui.selection.groups[0];
            if (groupId !== undefined) ui.focus(selectionForFocusedGroup(collapsed, groupId));
          }
          ui.setFocusMode(true);
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
            ui.focus(selectionForFocusedGroup(collapsed, groupId));
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
            // A plain component: its details drawer (018 FR-022), which focuses the title.
            event.preventDefault();
            ui.select({ nodes: [current] });
            ui.focus(current);
            ui.openDrawer();
          }
          return;
        case 'f2': {
          if (selectedSticky !== null) {
            event.preventDefault();
            ui.setStickyEditing(selectedSticky);
            return;
          }
          // Rename the current component or group in place (019 FR-002, FR-008).
          const groupId = current === null ? null : groupIdOf(current);
          if (groupId !== null) {
            if (ui.startTitleEdit({ target: 'group', id: groupId, isNew: false }))
              event.preventDefault();
          } else if (current !== null && deck.nodes.some((node) => node.id === current)) {
            if (ui.startTitleEdit({ target: 'node', id: current, isNew: false })) {
              event.preventDefault();
              ui.select({ nodes: [current] });
            }
          }
          return;
        }
        default:
          return;
      }
    },
    [
      editor,
      nudger,
      resizeKeyer,
      segmentKeyer,
      zoomIn,
      zoomOut,
      fitView,
      setCenter,
      getViewport,
      getZoom,
      screenToFlowPosition,
    ],
  );
}

/**
 * Document-wide editor keys. Install once per editor page. `onProblem` walks the deck's problems
 * (015 FR-021: ⌘. / Ctrl+. next, ⇧⌘. / ⇧Ctrl+. previous), on both screens.
 */
export function useEditorShortcuts({
  canvas = true,
  onProblem,
}: { canvas?: boolean; onProblem?: (direction: 1 | -1) => void } = {}): void {
  const editor = useEditor();
  const { flush } = useSaveControls();
  const runAction = useRunAction();
  const runRef = useRef(runAction);
  useEffect(() => {
    runRef.current = runAction;
  });
  // The latest handler, without re-installing the listener on every render.
  const problemRef = useRef(onProblem);
  useEffect(() => {
    problemRef.current = onProblem;
  });

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

      // During a pointer drag or resize (016): Esc cancels it (R14), arrows add 1 / 10 px (§g-45).
      if (key === 'escape' && cancelActiveGesture()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // R during a segment drag (017 R7, FR-014): back to automatic routing, mid-drag.
      if (key === 'r' && !isMod(event) && !event.altKey && resetActiveGesture()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const dragArrow = ARROWS[event.key];
      if (dragArrow !== undefined && !isMod(event) && !event.altKey) {
        const step = event.shiftKey ? 10 : 1;
        const [dx, dy] =
          dragArrow === 'left'
            ? [-step, 0]
            : dragArrow === 'right'
              ? [step, 0]
              : dragArrow === 'up'
                ? [0, -step]
                : [0, step];
        if (nudgeActiveDrag(dx, dy)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // `code`, not `key`: Shift turns "." into ">" on many layouts.
      const walkProblems = problemRef.current;
      if (isMod(event) && !event.altKey && event.code === 'Period' && walkProblems !== undefined) {
        event.preventDefault();
        walkProblems(event.shiftKey ? -1 : 1);
        return;
      }

      // ⌘D duplicates (016 FR-009), never the browser's bookmark dialog; the menu's action, so
      // it works exactly when Duplicate is offered. ⌘G below likewise.
      if (isMod(event) && !event.shiftKey && !event.altKey && event.code === 'KeyD' && canvas) {
        event.preventDefault();
        runRef.current('clipboard.duplicate');
        return;
      }
      // ⌘G groups the selection (016 FR-010), never the browser's "find next".
      if (isMod(event) && !event.shiftKey && !event.altKey && event.code === 'KeyG' && canvas) {
        event.preventDefault();
        runRef.current('group.create');
        return;
      }

      // ⇧⌘C copies the selection's JSON, ⇧⌘G ungroups the selected group (019 FR-036, FR-042):
      // the same actions as the menu and the toolbar, so they work exactly when those offer them.
      if (isMod(event) && event.shiftKey && !event.altKey && canvas) {
        const id =
          event.code === 'KeyC' ? 'json.copy' : event.code === 'KeyG' ? 'group.ungroup' : null;
        if (id !== null && runRef.current(id)) {
          event.preventDefault();
          return;
        }
      }

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
      if (!canvas || inOverlay(event.target)) return;
      // An armed rail tool (018) is the first thing Esc undoes.
      if (key === 'escape' && ui.tool !== 'select') {
        event.preventDefault();
        ui.setTool('select');
        return;
      }

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
        const { nodes, edges, groups, stickies } = ui.selection;
        if (nodes.length === 0 && edges.length === 0 && stickies.length === 0) {
          if (groups.length === 0 && ui.drill.length > 0) {
            event.preventDefault();
            ui.drillUp();
            ui.announce(
              `Back to ${drillScopeTitle(
                readDeck(editor.doc),
                useUiStore.getState().drill,
                viewCrumbTitle(readViewState(editor.doc).view),
              )}`,
            );
            return;
          }
          if (groups.length > 0) {
            event.preventDefault();
            ui.announce("Groups can't be deleted from the canvas yet");
          }
          return;
        }
        event.preventDefault();
        ui.requestDelete({ nodes, edges, stickies });
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
          ui.announce(
            `Back to ${drillScopeTitle(
              readDeck(editor.doc),
              useUiStore.getState().drill,
              viewCrumbTitle(readViewState(editor.doc).view),
            )}`,
          );
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
