/**
 * Builds the `ActionContext` the action list runs against (019 R1): from the store and the
 * document at call time (`readActionContext`, for keys) or subscribed (`useActionContext`, for the
 * menu and the toolbar). `useRunAction` is how keys run actions, so a key works exactly when the
 * menu or toolbar would offer the same action (FR-039).
 */
import type { DeckEditor } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import { readDeck, useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import {
  EMPTY_SELECTION,
  isFlowMode,
  useUiStore,
  type MenuTarget,
  type Selection,
  type UiState,
} from '../../state/ui-store';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState, useViewState } from '../views/use-current-view';
import type { ViewState } from '../views/view-state';
import { ACTIONS } from './index';
import { runAction } from './actions-for';
import type { ActionContext, CanvasApi, Mode } from './types';

/**
 * What a selection is, as a menu target: nothing → the canvas; only stickies → `sticky`; one or
 * more components; one connection; one group; anything else → `mixed`.
 */
export function targetOf(selection: Selection): MenuTarget {
  const { nodes, edges, groups, stickies } = selection;
  const total = nodes.length + edges.length + groups.length + stickies.length;
  if (total === 0) return { kind: 'canvas' };
  const ids = selection;
  if (stickies.length === total) return { kind: 'sticky', ids };
  if (nodes.length === total) return { kind: nodes.length === 1 ? 'component' : 'components', ids };
  if (total === 1 && edges.length === 1) return { kind: 'connection', ids };
  if (total === 1 && groups.length === 1) return { kind: 'group', ids };
  return { kind: 'mixed', ids };
}

/**
 * The editing mode. `viewOnly` (the spec's < 1024 px editor) is never returned: the app has no
 * narrow view-only editor yet, so actions list it only to be ready for one.
 */
export function modeOf(ui: Pick<UiState, 'activeFlow' | 'flowSession'>): Mode {
  if (ui.flowSession !== null) return 'session';
  if (isFlowMode(ui)) return 'flow';
  return 'edit';
}

function contextOf(
  editor: DeckEditor,
  deck: SododeckFile,
  view: ViewState,
  ui: Pick<UiState, 'activeFlow' | 'flowSession' | 'selection' | 'drill'>,
  canvas: CanvasApi | null,
  target: MenuTarget = targetOf(ui.selection),
  point: { x: number; y: number } | null = null,
): ActionContext {
  const graph = visibleGraph(view.deck, scopeOf(ui.drill), view.collapsed);
  return {
    editor,
    deck,
    view,
    target,
    selection: target.kind === 'canvas' ? EMPTY_SELECTION : target.ids,
    mode: modeOf(ui),
    point,
    childCount: graph.childCount,
    canvas,
  };
}

/** The context right now, without subscribing (key handlers). */
export function readActionContext(
  editor: DeckEditor,
  canvas: CanvasApi | null,
  target?: MenuTarget,
  point?: { x: number; y: number } | null,
): ActionContext {
  return contextOf(
    editor,
    readDeck(editor.doc),
    readViewState(editor.doc),
    useUiStore.getState(),
    canvas,
    target,
    point ?? null,
  );
}

/** The context for a menu or the toolbar, rebuilt when the deck, the view or the mode changes. */
export function useActionContext(
  target?: MenuTarget,
  point?: { x: number; y: number } | null,
): ActionContext {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const view = useViewState();
  const selection = useUiStore((s) => s.selection);
  const drill = useUiStore((s) => s.drill);
  const activeFlow = useUiStore((s) => s.activeFlow);
  const flowSession = useUiStore((s) => s.flowSession);
  const { fitView, screenToFlowPosition, getViewport } = useReactFlow();
  return useMemo(
    () =>
      contextOf(
        editor,
        deck,
        view,
        { activeFlow, flowSession, selection, drill },
        { fitView, screenToFlowPosition, getViewport },
        target,
        point ?? null,
      ),
    [
      editor,
      deck,
      view,
      activeFlow,
      flowSession,
      selection,
      drill,
      fitView,
      screenToFlowPosition,
      getViewport,
      target,
      point,
    ],
  );
}

/** Runs an action by id for the current selection (or `target`), if it applies. */
export function useRunAction(): (id: string, target?: MenuTarget) => boolean {
  const editor = useEditor();
  const { fitView, screenToFlowPosition, getViewport } = useReactFlow();
  return useCallback(
    (id, target) =>
      runAction(
        ACTIONS,
        id,
        readActionContext(editor, { fitView, screenToFlowPosition, getViewport }, target),
      ),
    [editor, fitView, screenToFlowPosition, getViewport],
  );
}
