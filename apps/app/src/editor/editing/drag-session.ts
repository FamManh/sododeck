/**
 * One pointer drag of components or a group (016 research R5–R8): where everything started, so
 * the drag can be moved as a whole, snapped, cancelled (Esc) or turned into a copy (⌥ on release).
 * Lives in a handler ref for the length of one gesture, never in the document or the store.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Frame, Id } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { displayPosition, type Point } from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { selectionFragment } from './clipboard-ops';
import { commonParent } from './common-parent';

export interface DragSession {
  viewId: Id;
  /** The React Flow node the pointer holds. */
  anchor: string;
  /** Dragged components (the selection), and dragged groups (their subtrees move along). */
  nodes: readonly Id[];
  groups: readonly Id[];
  /** Where every moving component and frame started, as the view draws them. */
  start: Readonly<Record<Id, Point>>;
  frames: Readonly<Record<Id, Frame>>;
}

/** A drag of the selected components, starting now. */
export function startNodeDrag(
  editor: DeckEditor,
  anchor: string,
  nodes: readonly Id[],
): DragSession {
  const view = readViewState(editor.doc);
  const ids = new Set(nodes);
  const start: Record<Id, Point> = {};
  view.deck.nodes.forEach((node, index) => {
    if (ids.has(node.id)) start[node.id] = displayPosition(node, index);
  });
  return { viewId: view.view.id, anchor, nodes, groups: [], start, frames: {} };
}

/**
 * ⌥ on release (FR-009): the originals go back where they started and a copy lands where they
 * were dropped, in the originals' innermost common group. Call inside the drag's gesture, so the
 * move back and the copy are one undo step.
 */
export function duplicateOnDrop(editor: DeckEditor, session: DragSession): void {
  const deck = readDeck(editor.doc);
  const fragment = selectionFragment(deck, session, session.viewId);
  if (fragment === null) return;
  editor.moveInView(session.viewId, session.start);
  if (Object.keys(session.frames).length > 0) editor.setGroupFrames(session.viewId, session.frames);
  const ids = editor.pasteFragment(fragment, {
    offset: { x: 0, y: 0 },
    parent: commonParent(deck, session),
    viewId: session.viewId,
  });
  const ui = useUiStore.getState();
  ui.select({ nodes: ids.nodes, groups: ids.groups });
  const n = ids.nodes.length;
  ui.announce(`Duplicated ${String(n)} ${n === 1 ? 'component' : 'components'}`);
}
