import type { ProblemReport } from '@sododeck/model';
import { createContext, useContext } from 'react';

import type { MermaidImportResult } from '../library/library-actions';

/**
 * What the editor needs from the deck library, which only the web app has (decks live in the
 * browser's library there). The shared editor code reads it from this context instead of importing
 * storage, so the embed build (067), where the host's file is the store, contains no library code.
 * `null` (the context's default) means "no library": every control that needs one is not rendered.
 */
export interface DeckServices {
  /** Goes to the deck library (the deck menu's "All decks"). */
  openLibrary(): void;
  /** Opens a library deck in the editor. */
  openDeck(deckId: string): void;
  /** Adds a deck file's text to the library as a new deck (the deck menu's Import…). */
  importDeckFile(
    text: string,
    fileName: string,
  ): Promise<{ deckId: string; name: string; report: ProblemReport | null }>;
  /** Adds a deck, given as `.sododeck` text, to the library; returns its id (SQL / DBML import). */
  addDeckFromText(text: string): Promise<string>;
  /** Reads Mermaid text and adds the result to the library as a new deck. */
  importMermaidAsNewDeck(text: string): Promise<MermaidImportResult>;
}

/** The browser cannot keep decks (blocked storage), so nothing was added to the library. */
export class LibraryUnavailableError extends Error {
  constructor() {
    super('This browser cannot keep decks, so nothing was imported.');
    this.name = 'LibraryUnavailableError';
  }
}

export const DeckServicesContext = createContext<DeckServices | null>(null);

export function useDeckServices(): DeckServices | null {
  return useContext(DeckServicesContext);
}
