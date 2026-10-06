/**
 * Builds the `ActionContext` the action list runs against (019 R1): from the store and the
 * document at call time (`readActionContext`, for keys) or subscribed (`useActionContext`, for the
 * menu and the toolbar). `useRunAction` is how keys run actions, so a key works exactly when the
 * menu or toolbar would offer the same action (FR-039).
 */
import type { DeckEditor } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { useToast } from '@sododeck/ui/components/toast';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useMemo } from 'react';

import { usePictureStore, type PictureStore } from '../../images/picture-store';
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
import { useUndoToast } from '../undo-toast';
import { readViewState, useViewState } from '../views/use-current-view';
import type { ViewState } from '../views/view-state';
import { ACTIONS } from './index';
import { runAction } from './actions-for';
import type { ActionContext, CanvasApi, Mode } from './types';

/**
 * What a selection is, as a menu target: nothing → the canvas; only stickies → `sticky`; only pictures → `image` / `images`; one or
 * more components; one connection; two or more connections; one group; anything else → `mixed`.
 */
export function targetOf(selection: Selection): MenuTarget {
  const { nodes, edges, groups, stickies, images } = selection;
  const total = nodes.length + edges.length + groups.length + stickies.length + images.length;
  if (total === 0) return { kind: 'canvas' };
  const ids = selection;
  if (stickies.length === total) return { kind: 'sticky', ids };
  if (images.length === total) return { kind: images.length === 1 ? 'image' : 'images', ids };
  if (nodes.length === total) return { kind: nodes.length === 1 ? 'component' : 'components', ids };
  if (edges.length === total && total > 1) return { kind: 'connections', ids };
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
  toast: (message: string) => void,
  target: MenuTarget = targetOf(ui.selection),
  point: { x: number; y: number } | null = null,
  undoToast?: (message: string) => void,
  pictures?: PictureStore | null,
): ActionContext {
  const graph = visibleGraph(view.deck, scopeOf(ui.drill), view.collapsed);
  return {
    ...(undoToast === undefined ? {} : { undoToast }),
    ...(pictures === undefined ? {} : { pictures }),
    editor,
    deck,
    view,
    target,
    selection: target.kind === 'canvas' ? EMPTY_SELECTION : target.ids,
    mode: modeOf(ui),
    point,
    childCount: graph.childCount,
    canvas,
    toast,
  };
}

/** The context right now, without subscribing (key handlers). */
export function readActionContext(
  editor: DeckEditor,
  canvas: CanvasApi | null,
  toast: (message: string) => void,
  target?: MenuTarget,
  point?: { x: number; y: number } | null,
  undoToast?: (message: string) => void,
): ActionContext {
  return contextOf(
    editor,
    readDeck(editor.doc),
    readViewState(editor.doc),
    useUiStore.getState(),
    canvas,
    toast,
    target,
    point ?? null,
    undoToast,
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
  const { fitView, screenToFlowPosition, getViewport, getNodes, getEdges } = useReactFlow();
  const toast = useToastMessage();
  const undoToast = useUndoToast();
  const pictures = usePictureStore();
  return useMemo(
    () =>
      contextOf(
        editor,
        deck,
        view,
        { activeFlow, flowSession, selection, drill },
        { fitView, screenToFlowPosition, getViewport, getNodes, getEdges },
        toast,
        target,
        point ?? null,
        undoToast,
        pictures,
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
      getNodes,
      getEdges,
      toast,
      target,
      point,
      undoToast,
      pictures,
    ],
  );
}

/** A stable `toast(message)` for action contexts. */
function useToastMessage(): (message: string) => void {
  const { toast } = useToast();
  return useCallback(
    (message: string) => {
      toast({ message });
    },
    [toast],
  );
}

/** Runs an action by id for the current selection (or `target`), if it applies. */
export function useRunAction(): (id: string, target?: MenuTarget) => boolean {
  const editor = useEditor();
  const { fitView, screenToFlowPosition, getViewport, getNodes, getEdges } = useReactFlow();
  const toast = useToastMessage();
  const undoToast = useUndoToast();
  return useCallback(
    (id, target) =>
      runAction(
        ACTIONS,
        id,
        readActionContext(
          editor,
          { fitView, screenToFlowPosition, getViewport, getNodes, getEdges },
          toast,
          target,
          null,
          undoToast,
        ),
      ),
    [editor, fitView, screenToFlowPosition, getViewport, getNodes, getEdges, toast, undoToast],
  );
}
