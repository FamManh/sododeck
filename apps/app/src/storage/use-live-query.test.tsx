import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import type { LibraryDb } from './library-db';
import { useLiveQuery } from './use-live-query';

function Names({ db, folder }: { db: LibraryDb; folder: string | null }) {
  const names = useLiveQuery(
    async () => (await db.decks.toArray()).filter((d) => d.folderId === folder).map((d) => d.name),
    [db, folder],
  );
  return <p>{names === undefined ? 'loading' : names.join(',') || 'none'}</p>;
}

describe('useLiveQuery', () => {
  it('renders the result, updates after a write and follows its deps', async () => {
    const db = await freshLibraryDb();
    await db.decks.add(deckRecord('a', { name: 'A' }));
    const { rerender, unmount } = render(<Names db={db} folder={null} />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('A')).toBeInTheDocument();

    await act(async () => {
      await db.decks.add(deckRecord('b', { name: 'B' }));
    });
    expect(await screen.findByText('A,B')).toBeInTheDocument();

    rerender(<Names db={db} folder="f" />);
    expect(await screen.findByText('none')).toBeInTheDocument();

    unmount();
    // No subscriber left: a later write must not throw or warn.
    await db.decks.add(deckRecord('c', { name: 'C', folderId: 'f' }));
  });
});
