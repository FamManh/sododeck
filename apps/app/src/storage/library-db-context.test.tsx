import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import * as libraryDb from './library-db';
import { LibraryDbProvider } from './library-db-context';
import { getLibraryDb, setLibraryDbForTests, useLibraryDb } from './library-db-instance';

afterEach(() => {
  setLibraryDbForTests(undefined);
  vi.restoreAllMocks();
});

function Probe() {
  const db = useLibraryDb();
  return <p>{db === null ? 'no storage' : 'storage'}</p>;
}

describe('library database provider', () => {
  it('opens the database once and purges deleted decks once per start', async () => {
    const db = await freshLibraryDb();
    await db.decks.add(deckRecord('gone', { deletedAt: 1 }));
    const open = vi.spyOn(libraryDb, 'openLibraryDb').mockResolvedValue(db);
    const purge = vi.spyOn(libraryDb, 'purgeDeleted');

    expect(await getLibraryDb()).toBe(db);
    expect(await getLibraryDb()).toBe(db);
    expect(open).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(await db.decks.count()).toBe(0);

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LibraryDbProvider>
            <Probe />
          </LibraryDbProvider>
        </Suspense>,
      );
      await getLibraryDb();
    });
    expect(await screen.findByText('storage')).toBeInTheDocument();
  });

  it('provides null when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LibraryDbProvider>
            <Probe />
          </LibraryDbProvider>
        </Suspense>,
      );
      await getLibraryDb();
    });
    expect(await screen.findByText('no storage')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
