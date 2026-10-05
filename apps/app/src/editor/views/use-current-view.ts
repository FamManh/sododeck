/**
 * The current view for components and handlers (011). The view list and its settings come from
 * the document (`resolveViews`); which one this tab shows is UI state (`ui.currentViewId`,
 * FR-005). Every view write goes through the model's view ops, with the current view's id.
 */
import { type DeckDoc, type DeckEditor, type Point, type ViewSettingsPatch } from '@sododeck/model';
import type { Id, SododeckFile, View } from '@sododeck/schema';
import { useMemo } from 'react';

import { readDeck, useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { newRowAt, rowEditTableId, useUiStore, type UiState } from '../../state/ui-store';
import { touchSets } from '../../db/touches';
import { currentFlowStep } from '../flows/current-step';
import {
  viewStateOf,
  type RowEditView,
  type TableFilterView,
  type TouchedRows,
  type ViewState,
} from './view-state';
import { viewCrumbTitle } from './view-title';

function rowEditView(tableId: string | null, at: number | null): RowEditView | null {
  return tableId === null ? null : { tableId, newRowAt: at };
}

/** The table in row editing (043 R4) as the view projection takes it. */
function rowEditOf(state: UiState): RowEditView | null {
  return rowEditView(rowEditTableId(state), newRowAt(state));
}

/** The rows the current flow step touches (049), the same object while the step is unchanged. */
function touchedRowsOf(
  file: SododeckFile,
  state: Pick<UiState, 'activeFlow' | 'flowSession'>,
): TouchedRows | null {
  const rows = touchSets(currentFlowStep(file, state)).rows;
  return rows.size === 0 ? null : rows;
}

function tableFilterOf(state: UiState): TableFilterView | null {
  return state.tableFilter;
}

/** The current view state without subscribing (event handlers). */
export function readViewState(doc: DeckDoc): ViewState {
  const state = useUiStore.getState();
  const file = readDeck(doc);
  return viewStateOf(
    file,
    state.currentViewId,
    state.revealed,
    rowEditOf(state),
    tableFilterOf(state),
    touchedRowsOf(file, state),
  );
}

/** `file` as the current view draws it (see `ViewState.deck`); for pure helpers given a snapshot. */
export function canvasDeckOf(file: SododeckFile): SododeckFile {
  const state = useUiStore.getState();
  return viewStateOf(
    file,
    state.currentViewId,
    state.revealed,
    rowEditOf(state),
    tableFilterOf(state),
    touchedRowsOf(file, state),
  ).deck;
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
  const editTable = useUiStore(rowEditTableId);
  const at = useUiStore(newRowAt);
  const rowEdit = useMemo(() => rowEditView(editTable, at), [editTable, at]);
  const filter = useUiStore(tableFilterOf);
  // The rows object is cached per step, so a step change without touches re-renders nothing.
  const touched = useUiStore((s) => touchedRowsOf(deck, s));
  return viewStateOf(deck, currentViewId, revealed, rowEdit, filter, touched);
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

/** Moves a note to a point of the canvas (notes are free, ADR 0041: the same in every view). */
export function moveStickyInView(editor: DeckEditor, stickyId: Id, point: Point): void {
  editor.moveSticky(stickyId, point);
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
