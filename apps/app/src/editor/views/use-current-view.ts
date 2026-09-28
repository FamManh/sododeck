/**
 * The current view for components and handlers (011). The view list and its settings come from
 * the document (`resolveViews`); which one this tab shows is UI state (`ui.currentViewId`,
 * FR-005). Every view write goes through the model's view ops, with the current view's id.
 */
import {
  nodeCanvasPosition,
  type DeckDoc,
  type DeckEditor,
  type Point,
  type ViewSettingsPatch,
} from '@sododeck/model';
import type { Id, SododeckFile, View } from '@sododeck/schema';
import { useMemo } from 'react';

import { readDeck, useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { viewStateOf, type ViewState } from './view-state';
import { viewCrumbTitle } from './view-title';

/** The current view state without subscribing (event handlers). */
export function readViewState(doc: DeckDoc): ViewState {
  const { currentViewId, revealed } = useUiStore.getState();
  return viewStateOf(readDeck(doc), currentViewId, revealed);
}

/** `file` as the current view draws it (see `ViewState.deck`); for pure helpers given a snapshot. */
export function canvasDeckOf(file: SododeckFile): SododeckFile {
  const { currentViewId, revealed } = useUiStore.getState();
  return viewStateOf(file, currentViewId, revealed).deck;
}

/** The id the view ops write to: the current view (the first one when none is chosen). */
export function currentViewIdOf(doc: DeckDoc): Id {
  return readViewState(doc).view.id;
}

/** The current view state, re-rendering on document and view changes. */
export function useViewState(): ViewState {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);
  const currentViewId = useUiStore((s) => s.currentViewId);
  const revealed = useUiStore((s) => s.revealed);
  return viewStateOf(deck, currentViewId, revealed);
}

/** Stored views, or the presets while the deck has none. */
export function useViews(): readonly View[] {
  return useViewState().views;
}

export function useCurrentView(): View {
  return useViewState().view;
}

export function useIsBaseView(): boolean {
  return useViewState().isBase;
}

/** Collapsed groups of the current view (FR-050); same set while the list is unchanged. */
export function useCollapsed(): ReadonlySet<Id> {
  return useViewState().collapsed;
}

export interface ViewActions {
  move(positions: Readonly<Record<Id, Point>>): void;
  pin(nodeIds: readonly Id[], pinned: boolean): void;
  update(patch: ViewSettingsPatch, viewId?: Id): void;
  add(): Id;
  remove(viewId?: Id): ReturnType<DeckEditor['removeView']>;
  setCollapsed(groupId: Id, collapsed: boolean): void;
}

/** The editor's view ops bound to the view current at call time (or an explicit one). */
export function viewActions(editor: DeckEditor): ViewActions {
  const current = () => currentViewIdOf(editor.doc);
  return {
    move: (positions) => {
      editor.moveInView(current(), positions);
    },
    pin: (nodeIds, pinned) => {
      editor.setPinned(current(), nodeIds, pinned);
    },
    update: (patch, viewId) => {
      editor.updateView(viewId ?? current(), patch);
    },
    add: () => editor.addView(),
    remove: (viewId) => editor.removeView(viewId ?? current()),
    setCollapsed: (groupId, collapsed) => {
      editor.setCollapsed(current(), groupId, collapsed);
    },
  };
}

export function useViewActions(): ViewActions {
  const editor = useEditor();
  return useMemo(() => viewActions(editor), [editor]);
}

/**
 * Moves a note to a point of the current view's canvas. A pinned note keeps an offset from its
 * component, which the model measures from the base position: in a view where the component sits
 * elsewhere, the point is shifted so the note lands where it was dropped.
 */
export function moveStickyInView(editor: DeckEditor, stickyId: Id, point: Point): void {
  const file = readDeck(editor.doc);
  const anchor = file.stickies.find((s) => s.id === stickyId)?.anchor;
  const base = anchor === undefined ? null : nodeCanvasPosition(file, anchor);
  const shown =
    anchor === undefined ? null : nodeCanvasPosition(readViewState(editor.doc).deck, anchor);
  editor.moveSticky(
    stickyId,
    base === null || shown === null
      ? point
      : { x: point.x - shown.x + base.x, y: point.y - shown.y + base.y },
  );
}

/** Shows `view` in this tab: clears selection, drill-in and focus, then announces it (FR-003). */
export function selectView(view: Pick<View, 'id' | 'title'>): void {
  const ui = useUiStore.getState();
  ui.switchView(view.id);
  ui.announce(viewCrumbTitle(view));
}

/** Collapsed groups of the current view, without subscribing (handlers). */
export function collapsedOf(doc: DeckDoc): ReadonlySet<Id> {
  return readViewState(doc).collapsed;
}

/**
 * Collapses or expands a group in the current view (010 → 011 FR-050): saved and synced, never
 * an undo step. Returns whether the group is collapsed afterwards.
 */
export function setGroupCollapsed(editor: DeckEditor, groupId: Id, collapsed: boolean): boolean {
  editor.setCollapsed(currentViewIdOf(editor.doc), groupId, collapsed);
  return collapsed;
}

/** Flips a group's collapse state in the current view; returns the new state. */
export function toggleGroupCollapsed(editor: DeckEditor, groupId: Id): boolean {
  return setGroupCollapsed(editor, groupId, !collapsedOf(editor.doc).has(groupId));
}
