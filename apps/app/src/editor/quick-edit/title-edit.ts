/**
 * Inline title edit (019 R2), the parts without React: committing a draft and choosing the card
 * Tab moves to.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import { displayPosition } from '../canvas-geometry';
import { oneStep } from '../fields/one-step';

/**
 * Writes a committed title as one undo step. The draft is trimmed; an empty or unchanged title,
 * or an object that is gone, writes nothing (FR-005) and returns `'unchanged'`.
 */
export function commitTitle(
  editor: DeckEditor,
  target: 'node' | 'group',
  id: Id,
  draft: string,
  previous: string,
): 'renamed' | 'unchanged' {
  const title = draft.trim();
  if (title === '' || title === previous) return 'unchanged';
  const deck = readDeck(editor.doc);
  const scope = target === 'node' ? 'nodes' : 'groups';
  if (!deck[scope].some((entry) => entry.id === id)) return 'unchanged';
  oneStep(editor, () => {
    editor.update(scope, id, { title });
  });
  return 'renamed';
}

/**
 * Removes a text whose words were all cleared (founder, 2026-10-06): a text is only its words,
 * so an empty one is not kept as "Untitled text". One undo step brings it back. Returns whether
 * it was removed (`false` when it is gone already).
 */
export function removeEmptyText(editor: DeckEditor, id: Id): boolean {
  if (!readDeck(editor.doc).nodes.some((node) => node.id === id)) return false;
  oneStep(editor, () => {
    editor.remove('nodes', id);
  });
  return true;
}

/** Components in reading order: top to bottom, then left to right (the Tab order of titles). */
export function readingOrder(deck: SododeckFile, visible: readonly Id[]): Id[] {
  const shown = new Set(visible);
  return deck.nodes
    .flatMap((node, index) =>
      shown.has(node.id) ? [{ id: node.id, ...displayPosition(node, index), index }] : [],
    )
    .sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index)
    .map((entry) => entry.id);
}

/** The next (1) or previous (-1) component after `id`; `null` past either end (no wrap). */
export function nextTitleTarget(order: readonly Id[], id: Id, dir: 1 | -1): Id | null {
  const index = order.indexOf(id);
  if (index < 0) return null;
  return order[index + dir] ?? null;
}
