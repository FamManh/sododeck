import { createContext, useContext } from 'react';

import { openLibraryDb, purgeDeleted, type LibraryDb } from './library-db';

let shared: Promise<LibraryDb | null> | undefined;

/**
 * The app's one library database, opened once per page load. Deletes become final here
 * (research R8): soft-deleted decks and folders of the previous session are purged.
 */
export function getLibraryDb(): Promise<LibraryDb | null> {
  shared ??= openLibraryDb().then(async (db) => {
    if (db) {
      try {
        await purgeDeleted(db);
      } catch {
        // Purging is housekeeping; a failure must not hide the library.
      }
    }
    return db;
  });
  return shared;
}

/** Tests: use this database (`null`: none) from now on; `undefined` opens the real one again. */
export function setLibraryDbForTests(db: LibraryDb | null | undefined): void {
  shared = db === undefined ? undefined : Promise.resolve(db);
}

/** Provided by `LibraryDbProvider` (library-db-context.tsx). */
export const LibraryDbContext = createContext<LibraryDb | null>(null);

/** The library database, or `null` when this browser cannot keep decks (research R15). */
export function useLibraryDb(): LibraryDb | null {
  return useContext(LibraryDbContext);
}
