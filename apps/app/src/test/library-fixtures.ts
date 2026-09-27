import { afterEach } from 'vitest';

import { openLibraryDb, type DeckRecord, type LibraryDb } from '../storage/library-db';

let counter = 0;
const opened: LibraryDb[] = [];

/** A fresh, uniquely named in-memory library database, deleted after the test. */
export async function freshLibraryDb(): Promise<LibraryDb> {
  const db = await openLibraryDb(`test-library-${String(Date.now())}-${String(counter++)}`);
  if (!db) throw new Error('fake-indexeddb is not installed (test-setup.ts)');
  opened.push(db);
  return db;
}

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

/** A deck record with defaults; `patch` overrides any field. */
export function deckRecord(id: string, patch: Partial<DeckRecord> = {}): DeckRecord {
  return {
    id,
    folderId: null,
    name: `Deck ${id}`,
    createdAt: 1,
    updatedAt: 1,
    openedAt: null,
    exportedAt: null,
    deletedAt: null,
    nodeCount: 0,
    edgeCount: 0,
    flowCount: 0,
    thumb: null,
    ...patch,
  };
}
