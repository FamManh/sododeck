import { Dexie, type EntityTable } from 'dexie';

/**
 * Local deck library METADATA (name, timestamps). Deck contents live in a
 * separate y-indexeddb database per deck, never here. Wired up in M1.
 */
export interface DeckRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export class LibraryDb extends Dexie {
  decks!: EntityTable<DeckRecord, 'id'>;

  constructor(name = 'sododeck-library') {
    super(name);
    this.version(1).stores({ decks: 'id, name, updatedAt' });
  }
}
