/**
 * Copy, paste and duplicate (016 US1, research R9 / R10): what the menu actions, the platform
 * copy / cut / paste events and ⌘D share. The fragment itself is built and parsed by
 * `@sododeck/model`; this module only decides what is copied, where a paste lands and what is
 * announced. The clipboard is touched only on these explicit user actions, never sent anywhere.
 */
import {
  fragmentOrigin,
  isDbTable,
  parseFragment,
  serializeFragment,
  toFragment,
  type DeckEditor,
  type Fragment,
  type PastedIds,
} from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { selectionTargets } from '../../state/selection-kinds';
import { useUiStore, type Selection } from '../../state/ui-store';
import { canvasElement } from '../canvas-actions';
import { groupBounds, type Point, type Rect } from '../canvas-geometry';
import { scopeOf, visibleGraph } from '../visible-graph';
import { readViewState } from '../views/use-current-view';
import { commonParent } from './common-parent';
import { dropTarget, frameEntries } from './drop-target';
import { PASTE_STEP, pastePlacement } from './paste-placement';
import { groupSubtree, groupSubtreeImages } from './subtree';

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

/** "3 components and 2 connections" / "1 component" / "2 images" (055) / "1 note". */
export function countText(
  fragment: Pick<Fragment, 'deck'> & Partial<Pick<Fragment, 'images'>>,
): string {
  const { nodes, edges, stickies } = fragment.deck;
  const images = fragment.images?.length ?? 0;
  const parts = itemParts(nodes.length, images, stickies.length);
  if (edges.length > 0) parts.push(plural(edges.length, 'connection'));
  return parts.join(' and ');
}

/** "2 components", "1 image", "1 component and 2 notes": components always, unless only others. */
function itemParts(nodes: number, images: number, notes: number): string[] {
  const parts = nodes === 0 && images + notes > 0 ? [] : [plural(nodes, 'component')];
  if (images > 0) parts.push(plural(images, 'image'));
  if (notes > 0) parts.push(plural(notes, 'note'));
  return parts;
}

/** "Duplicated 2 components and 1 note" (⌘D and the ⌥ drag). */
export function duplicatedText(ids: {
  readonly nodes: readonly Id[];
  readonly images: readonly Id[];
  readonly stickies: readonly Id[];
}): string {
  return `Duplicated ${itemParts(ids.nodes.length, ids.images.length, ids.stickies.length).join(' and ')}`;
}

/**
 * What a copy of `selection` holds: the selected components, notes and images and every member of
 * the selected groups (their subtrees, hidden members included), at the positions the current view
 * draws, plus the connectors with both ends in the copy. Null when nothing copyable is selected
 * (connections alone are not copied).
 */
export function selectionFragment(
  deck: SododeckFile,
  selection: Pick<Selection, 'nodes' | 'groups'> & Partial<Pick<Selection, 'images' | 'stickies'>>,
  viewId: Id,
): Fragment | null {
  const tree = groupSubtree(deck, selection.groups);
  const nodes = [...new Set([...selection.nodes, ...tree.nodes])];
  const images = [
    ...new Set([...(selection.images ?? []), ...groupSubtreeImages(deck, selection.groups)]),
  ];
  const stickies = [...new Set(selection.stickies ?? [])];
  if (nodes.length + tree.groups.length + images.length + stickies.length === 0) return null;
  // Tables keep their outgoing foreign keys (043 R10): paste keeps them when the target exists.
  return toFragment(
    deck,
    {
      nodes,
      groups: tree.groups,
      ...(images.length === 0 ? {} : { images }),
      ...(stickies.length === 0 ? {} : { stickies }),
    },
    { viewId, keepOutgoing: true },
  );
}

/** The group a paste at `point` goes into: the innermost frame there, else the drilled group. */
export function pasteParent(editor: DeckEditor, point: Point): Id | undefined {
  const view = readViewState(editor.doc);
  const scope = scopeOf(useUiStore.getState().drill);
  const graph = visibleGraph(view.deck, scope, view.collapsed);
  const frames = frameEntries(view.deck, groupBounds(view.deck, 'component'), graph.groups);
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

function selectPasted(editor: DeckEditor, ids: PastedIds): void {
  const ui = useUiStore.getState();
  ui.select({ nodes: ids.nodes, groups: ids.groups, images: ids.images, stickies: ids.stickies });
  // One pasted or duplicated table opens its title for renaming, all text selected (043 R10).
  const [only, ...rest] = ids.nodes;
  const node =
    only === undefined || rest.length > 0 || ids.groups.length + ids.stickies.length > 0
      ? undefined
      : readDeck(editor.doc).nodes.find((n) => n.id === only);
  if (node !== undefined && isDbTable(node)) {
    ui.focus(node.id);
    ui.startTitleEdit({ target: 'node', id: node.id, isNew: false });
  }
}

/** "orders" for one card, else "3 components and 2 connections". */
function pastedName(fragment: Pick<Fragment, 'deck'> & Partial<Pick<Fragment, 'images'>>): string {
  const [only, ...rest] = fragment.deck.nodes;
  return only !== undefined &&
    rest.length === 0 &&
    (fragment.images?.length ?? 0) + fragment.deck.stickies.length === 0
    ? only.title
    : countText(fragment);
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
  undoToast?: (message: string) => void,
): boolean {
  const fragment = parseFragment(text);
  if (
    fragment === null ||
    fragment.deck.nodes.length +
      fragment.deck.groups.length +
      fragment.deck.stickies.length +
      (fragment.images?.length ?? 0) ===
      0
  ) {
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
  selectPasted(editor, ids);
  const dropped = ids.droppedRelationships;
  if (dropped > 0) {
    // Relationships whose other table is not in this deck (043 FR-019): said, with Undo.
    const message = `Pasted ${pastedName(fragment)} · ${plural(dropped, 'relationship')} dropped`;
    if (undoToast === undefined) ui.announce(message);
    else undoToast(message);
  } else {
    ui.announce(`Pasted ${countText(fragment)}`);
  }
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

/**
 * Cut (FR-005): the copy, then the Delete key's confirmation and Undo toast. Unlike Delete, a cut
 * group goes with its members (they were copied): the selection is widened to the subtrees.
 */
export function deleteCut(editor: DeckEditor, selection: Selection): void {
  const deck = readDeck(editor.doc);
  const tree = groupSubtree(deck, selection.groups);
  useUiStore.getState().requestRemoval(
    selectionTargets({
      ...selection,
      nodes: [...new Set([...selection.nodes, ...tree.nodes])],
      images: [...new Set([...selection.images, ...groupSubtreeImages(deck, selection.groups)])],
      groups: tree.groups,
    }),
  );
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
  selectPasted(editor, ids);
  useUiStore.getState().announce(duplicatedText(ids));
  return true;
}
