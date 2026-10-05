import { deckPacks, isDbTable } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

/**
 * Deck settings show the Database tab in a deck with a table, or with the Database pack on
 * (041 R10).
 */
export function showsDatabaseSection(deck: SododeckFile): boolean {
  return deck.nodes.some(isDbTable) || deckPacks(deck).includes('database');
}
