import { serializeDeck } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach } from 'vitest';

import { resetLibraryStore } from '../library/library-store';
import { LibraryPage } from '../routes/library-page';
import { insertDeck, type DeckRecord, type LibraryDb } from '../storage/library-db';
import { getLibraryDb, setLibraryDbForTests } from '../storage/library-db-instance';
import { importFile } from '../storage/library-ops';
import { DeckStub } from './deck-stub';
import { deckRecord, freshLibraryDb } from './library-fixtures';

afterEach(() => {
  setLibraryDbForTests(undefined);
});

/** Stores a deck whose content is `file` (name from the record). */
export async function seedDeck(
  db: LibraryDb,
  id: string,
  patch: Partial<DeckRecord> = {},
  file: Partial<SododeckFile> = {},
): Promise<DeckRecord> {
  const name = patch.name ?? `Deck ${id}`;
  const { bytes, summary } = importFile(serializeDeck({ ...emptySododeckFile(), ...file, name }));
  const record = deckRecord(id, { ...summary, ...patch, name });
  await insertDeck(db, record, bytes);
  return record;
}

/**
 * The library page on `/` with a fresh in-memory database (or `db: null` for blocked storage).
 * `/deck/*` renders a stub naming the deck.
 */
export async function renderLibrary({
  db,
  path = '/',
  keepPreferences = false,
}: { db?: LibraryDb | null; path?: string; keepPreferences?: boolean } = {}) {
  if (!keepPreferences) localStorage.clear();
  resetLibraryStore();
  const database = db === undefined ? await freshLibraryDb() : db;
  setLibraryDbForTests(database);
  const router = createMemoryRouter(
    [
      { path: '/', Component: LibraryPage },
      { path: '/deck/:deckId', Component: DeckStub },
    ],
    { initialEntries: [path] },
  );
  const tree = (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(tree);
    await getLibraryDb();
  });
  if (!view) throw new Error('not rendered');
  return { ...view, db: database, router, user: userEvent.setup() };
}
