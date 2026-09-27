import { fromJSON, type DeckDoc } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';

import { demoDeck } from './demo-deck';

/**
 * In-memory decks until the local library (005, research R12): `/deck/new` is an empty deck,
 * anything else the demo. Loading is not an edit, so neither is undoable.
 */
export function openDeck(deckId: string): DeckDoc {
  if (deckId === 'new') return fromJSON({ ...emptySododeckFile(), name: 'Untitled deck' });
  return fromJSON(demoDeck);
}
