/**
 * Copy, paste and duplicate (016 US1, research R9 / R10): what the menu actions, the platform
 * copy / cut / paste events and ⌘D share. The fragment itself is built and parsed by
 * `@sododeck/model`; this module only decides what is copied, where a paste lands and what is
 * announced. The clipboard is touched only on these explicit user actions, never sent anywhere.
 */
import {
  fragmentOrigin,
  parseFragment,
  serializeFragment,
  toFragment,
  type DeckEditor,
  type Fragment,
  type PastedIds,
} from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore, type Selection } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { COMPONENT_CARD_SIZE, groupBounds, type Point, type Rect } from '../canvas-geometry';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { commonParent } from './common-parent';
import { dropTarget, frameEntries } from './drop-target';
import { PASTE_STEP, pastePlacement } from './paste-placement';
import { groupSubtree } from './subtree';

/** A timestamp (never content) telling Paste items a fragment was copied (R9). */
export const FRAGMENT_HINT_KEY = 'sododeck:fragment-copied';

export const CLIPBOARD_FAILED = 'Could not use the clipboard';

export function markFragmentCopied(): void {
  try {
    localStorage.setItem(FRAGMENT_HINT_KEY, String(Date.now()));
  } catch {
    // Storage may be off (private mode); Paste still validates what it reads.
  }
}

export function fragmentCopied(): boolean {
  try {
    return localStorage.getItem(FRAGMENT_HINT_KEY) !== null;
  } catch {
    return false;
  }
}

const plural = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

/** "3 components and 2 connections" / "1 component". */
export function countText(fragment: Pick<Fragment, 'deck'>): string {
  const { nodes, edges } = fragment.deck;
  const parts = [plural(nodes.length, 'component')];
  if (edges.length > 0) parts.push(plural(edges.length, 'connection'));
  return parts.join(' and ');
}

/**
 * What a copy of `selection` holds: the selected components and every member of the selected
 * groups (their subtrees, hidden members included), at the positions the current view draws.
 * Null when nothing copyable is selected (connections and notes alone are not copied).
 */
export function selectionFragment(
  deck: SododeckFile,
  selection: Pick<Selection, 'nodes' | 'groups'>,
  viewId: Id,
): Fragment | null {
  const tree = groupSubtree(deck, selection.groups);
  const nodes = [...new Set([...selection.nodes, ...tree.nodes])];
  if (nodes.length === 0 && tree.groups.length === 0) return null;
  return toFragment(deck, { nodes, groups: tree.groups }, viewId);
}

/** The group a paste at `point` goes into: the innermost frame there, else the drilled group. */
export function pasteParent(editor: DeckEditor, point: Point): Id | undefined {
  const view = readViewState(editor.doc);
  const scope = scopeOf(useUiStore.getState().drill);
  const graph = visibleGraph(view.deck, scope, view.collapsed);
  const frames = frameEntries(view.deck, groupBounds(view.deck, COMPONENT_CARD_SIZE), graph.groups);
  return dropTarget(frames, point, new Set()) ?? scope.group ?? undefined;
}

export interface CanvasPoints {
  screenToFlowPosition: (point: Point) => Point;
}

/** The part of the canvas on screen, in canvas coordinates (zero-sized without layout). */
export function visibleRect(canvas: CanvasPoints): Rect {
  const box = canvasElement()?.getBoundingClientRect();
  const topLeft = canvas.screenToFlowPosition({ x: box?.left ?? 0, y: box?.top ?? 0 });
  const bottomRight = canvas.screenToFlowPosition({
    x: (box?.left ?? 0) + (box?.width ?? 0),
    y: (box?.top ?? 0) + (box?.height ?? 0),
  });
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function selectPasted(ids: PastedIds): void {
  useUiStore.getState().select({ nodes: ids.nodes, groups: ids.groups });
}

/**
 * Pastes clipboard `text` (FR-003–FR-008): at `pointer` (canvas coordinates) or the placement
 * fallbacks, into the frame there, as one undo step; selects and announces the copies. Returns
 * false, changing nothing, when the text is not a fragment (plain text is ignored).
 */
export function pasteText(
  editor: DeckEditor,
  text: string,
  pointer: Point | null,
  canvas: CanvasPoints | null,
): boolean {
  const fragment = parseFragment(text);
  if (fragment === null || fragment.deck.nodes.length + fragment.deck.groups.length === 0) {
    return false;
  }
  const ui = useUiStore.getState();
  const origin = fragmentOrigin(fragment);
  const { at, serial } = pastePlacement({
    source: origin,
    pointer,
    visible: canvas === null ? { ...origin, width: 0, height: 0 } : visibleRect(canvas),
    serial: ui.pasteSerial,
  });
  const viewId = readViewState(editor.doc).view.id;
  const ids = editor.pasteFragment(fragment, {
    offset: { x: at.x - origin.x, y: at.y - origin.y },
    parent: pasteParent(editor, at),
    viewId,
  });
  ui.setPasteSerial(serial);
  selectPasted(ids);
  ui.announce(`Pasted ${countText(fragment)}`);
  return true;
}

/** The text a copy of the current selection puts on the clipboard, or null (nothing copyable). */
export function copySelectionText(
  editor: DeckEditor,
  selection: Selection,
): {
  text: string;
  fragment: Fragment;
} | null {
  const viewId = readViewState(editor.doc).view.id;
  const fragment = selectionFragment(readDeck(editor.doc), selection, viewId);
  return fragment === null ? null : { text: serializeFragment(fragment), fragment };
}

/** After a copy reached the clipboard: the Paste hint and the announcement. */
export function copied(fragment: Fragment, verb: 'Copied' | 'Cut'): void {
  markFragmentCopied();
  useUiStore.getState().announce(`${verb} ${countText(fragment)}`);
}

/** Cut (FR-005): the copy, then the Delete key's confirmation and Undo toast. */
export function deleteCut(editor: DeckEditor, selection: Selection): void {
  const deck = readDeck(editor.doc);
  const tree = groupSubtree(deck, selection.groups);
  const nodes = [...new Set([...selection.nodes, ...tree.nodes])];
  useUiStore
    .getState()
    .requestRemoval([
      ...nodes.map((id) => ({ scope: 'nodes' as const, id })),
      ...selection.edges.map((id) => ({ scope: 'edges' as const, id })),
      ...tree.groups.map((id) => ({ scope: 'groups' as const, id })),
    ]);
}

/**
 * Duplicate (⌘D, FR-009): a copy 24 px down-right, in the selection's innermost common group,
 * as one undo step; the clipboard is left alone. Returns false when nothing copyable is selected.
 */
export function duplicateSelection(editor: DeckEditor, selection: Selection): boolean {
  const deck = readDeck(editor.doc);
  const viewId = readViewState(editor.doc).view.id;
  const fragment = selectionFragment(deck, selection, viewId);
  if (fragment === null) return false;
  const ids = editor.pasteFragment(fragment, {
    offset: { x: PASTE_STEP, y: PASTE_STEP },
    parent: commonParent(deck, selection),
    viewId,
  });
  selectPasted(ids);
  useUiStore.getState().announce(`Duplicated ${plural(ids.nodes.length, 'component')}`);
  return true;
}
