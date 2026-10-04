import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createFolder } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary, seedDeck } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

async function threeDecks() {
  const db = await freshLibraryDb();
  const payments = await createFolder(db, 'Payments');
  const logistics = await createFolder(db, 'Logistics');
  await seedDeck(db, 'a', { name: 'Payment flow', folderId: payments.id, updatedAt: 3 });
  await seedDeck(db, 'b', { name: 'Checkout', folderId: payments.id, updatedAt: 2 });
  await seedDeck(
    db,
    'c',
    { name: 'Fleet', folderId: logistics.id, updatedAt: 1 },
    {
      nodes: [{ id: 'n', type: 'service', title: 'Truck', position: { x: 0, y: 0 } }],
    },
  );
  return { db, payments, logistics };
}

const decksList = () => screen.getByRole('list', { name: 'Decks' });
const deckNames = () =>
  within(decksList())
    .queryAllByRole('link')
    .map((link) => link.textContent)
    .filter((name) => name !== 'New deckBlank canvas, saved locally');

describe('LibraryPage', () => {
  it('lists every deck under All decks', async () => {
    const { db } = await threeDecks();
    await renderLibrary({ db });
    expect(screen.getByRole('heading', { level: 1, name: 'All decks' })).toBeInTheDocument();
    expect(await screen.findByText('3 decks · stored in this browser')).toBeInTheDocument();
    await waitFor(() => {
      expect(deckNames()).toEqual(['Payment flow', 'Checkout', 'Fleet']);
    });
    expect(screen.getByText(/1 component · 0 flows · edited/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fleet preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for Fleet' })).toBeInTheDocument();
  });

  it('filters by folder and by search', async () => {
    const { db } = await threeDecks();
    const { user } = await renderLibrary({ db });
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(await within(nav).findByRole('button', { name: /^Payments/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Payments' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Payments/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('2 decks · stored in this browser')).toBeInTheDocument();
    expect(deckNames()).toEqual(['Payment flow', 'Checkout']);

    await user.click(within(nav).getByRole('button', { name: /All decks/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search decks' }), 'pay');
    expect(deckNames()).toEqual(['Payment flow']);
    await user.clear(screen.getByRole('searchbox', { name: 'Search decks' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search decks' }), 'zzz');
    expect(screen.getByText('No decks match "zzz".')).toBeInTheDocument();
  });

  it('switches to a list and remembers it', async () => {
    const { db } = await threeDecks();
    const { user, unmount } = await renderLibrary({ db });
    await screen.findByText('Fleet');
    await user.click(screen.getByRole('radio', { name: 'List' }));
    const table = screen.getByRole('table', { name: 'Decks' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('columnheader', { name: 'Components' })).toBeInTheDocument();
    expect(localStorage.getItem('sododeck.library.view')).toBe('list');
    unmount();
    await renderLibrary({ db, keepPreferences: true });
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(await screen.findByRole('table', { name: 'Decks' })).toBeInTheDocument();
  });

  it('shows the 8 most recently opened decks, newest first', async () => {
    const db = await freshLibraryDb();
    const now = Date.now();
    for (let i = 0; i < 9; i++) {
      await seedDeck(db, `r${String(i)}`, {
        name: `Opened ${String(i)}`,
        openedAt: now - (9 - i) * 60_000,
      });
    }
    const { user } = await renderLibrary({ db });
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(await within(nav).findByRole('button', { name: /Recent/ }));
    await waitFor(() => {
      expect(deckNames()).toEqual([8, 7, 6, 5, 4, 3, 2, 1].map((i) => `Opened ${String(i)}`));
    });
    const sidebarRecent = within(nav).getByRole('region', { name: 'Recent' });
    expect(within(sidebarRecent).getByRole('link', { name: /Opened 8/ })).toHaveTextContent(
      '1 minute ago',
    );
  });

  it('shows placeholders for an empty Recent and for Samples', async () => {
    const { user } = await renderLibrary();
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(within(nav).getByRole('button', { name: /Recent/ }));
    expect(await screen.findByText('Decks you open will appear here.')).toBeInTheDocument();
    await user.click(within(nav).getByRole('button', { name: /Samples/ }));
    expect(screen.getByText('Sample decks are coming soon.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open demo deck' })).toHaveAttribute(
      'href',
      '/deck/demo',
    );
  });

  it('creates new decks in the current folder and opens decks', async () => {
    const { db, payments } = await threeDecks();
    const { user, router } = await renderLibrary({ db });
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(await within(nav).findByRole('button', { name: /^Payments/ }));
    const expected = `/deck/new?folder=${payments.id}`;
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'New deck' }),
    ).toHaveAttribute('href', expected);
    expect(within(decksList()).getByRole('link', { name: /New deck/ })).toHaveAttribute(
      'href',
      expected,
    );

    await user.click(within(decksList()).getByRole('link', { name: 'Checkout' }));
    expect(router.state.location.pathname).toBe('/deck/b');
    expect(screen.getByText('Editor for b')).toBeInTheDocument();
  });

  it('has no persistent storage card (051 US8)', async () => {
    const { db } = await threeDecks();
    await renderLibrary({ db });
    expect(await screen.findByText('3 decks · stored in this browser')).toBeInTheDocument();
    expect(screen.queryByText('Persistent storage')).toBeNull();
    expect(screen.queryByRole('button', { name: /persistent storage/i })).toBeNull();
  });

  it('explains when storage is blocked', async () => {
    await renderLibrary({ db: null });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Decks can't be kept in this browser (storage is blocked).",
    );
  });

  it('shows decks written by another tab without a reload', async () => {
    const { db } = await threeDecks();
    await renderLibrary({ db });
    await screen.findByText('Fleet');
    await act(async () => {
      await seedDeck(db, 'x', { name: 'From another tab', updatedAt: 10 });
    });
    expect(await screen.findByRole('link', { name: 'From another tab' })).toBeInTheDocument();
  });
});
