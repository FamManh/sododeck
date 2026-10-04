/**
 * Writes the icon of the selected cards (038 T024). Only nodes drawn as cards take part: a shape
 * draws its outline, so its stored icon is left exactly as it is. One `setNodeIcon` call is one
 * undo step.
 */
import { effectiveFamily, type DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { readDeck } from '../../model/use-deck-snapshot';
import type { Selection } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';

/** The selected nodes drawn as cards, in deck order. */
export function cardIds(deck: SododeckFile, selection: Pick<Selection, 'nodes'>): Id[] {
  const selected = new Set(selection.nodes);
  return deck.nodes
    .filter((node) => selected.has(node.id) && effectiveFamily(node) === 'card')
    .map((node) => node.id);
}

/** Sets (`ref`) or removes (`null`) the icon of every selected card; returns how many were targeted. */
export function applyIcon(
  editor: DeckEditor,
  selection: Pick<Selection, 'nodes'>,
  ref: string | null,
): number {
  const ids = cardIds(readDeck(editor.doc), selection);
  if (ids.length === 0) return 0;
  oneStep(editor, () => {
    editor.setNodeIcon(ids, ref);
  });
  return ids.length;
}
