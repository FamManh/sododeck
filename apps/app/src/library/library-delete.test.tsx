import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createFolder, liveDecks, liveFolders, loadDeckLog } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary, seedDeck } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

async function setup() {
  const db = await freshLibraryDb();
  const payments = await createFolder(db, 'Payments');
  await seedDeck(
    db,
    'd1',
    { name: 'Shop', folderId: payments.id, updatedAt: 2 },
    {
      nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
    },
  );
  await seedDeck(db, 'd2', { name: 'Fleet', folderId: payments.id, updatedAt: 1 });
  const view = await renderLibrary({ db });
  await screen.findByRole('link', { name: 'Shop' });
  return { ...view, db, payments };
}

describe('library delete and Undo', () => {
  it('confirms, deletes, and restores the deck with its content by Undo', async () => {
    const { user, db, payments } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete "Shop"?' });
    expect(dialog).toHaveTextContent('You can undo this until you reload the page.');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Delete deck' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Shop' })).not.toBeInTheDocument();
    });
    const toast = await screen.findByText(/^Shop deleted/);
    expect(toast).toHaveTextContent(/⌘Z|Ctrl\+Z/);
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByRole('link', { name: 'Shop' })).toBeInTheDocument();
    expect((await db.decks.get('d1'))?.folderId).toBe(payments.id);
    expect((await loadDeckLog(db, 'd1'))?.bytes.length).toBeGreaterThan(0);
  });

  it('asks with the Delete key and undoes with ⌘Z after the toast', async () => {
    const { user, db } = await setup();
    act(() => {
      screen.getByRole('link', { name: 'Shop' }).focus();
    });
    await user.keyboard('{Delete}');
    const dialog = screen.getByRole('alertdialog', { name: 'Delete "Shop"?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete deck' }));
    await waitFor(async () => {
      expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Fleet']);
    });
    // The toast may be gone; ⌘Z on the page still undoes the last delete of the session.
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(await screen.findByRole('link', { name: 'Shop' })).toBeInTheDocument();
  });

  it('cancels without deleting', async () => {
    const { user, db } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await liveDecks(db)).toHaveLength(2);
  });

  it('deletes the shown folder: decks go to Unfiled, the view to All decks, Undo restores', async () => {
    const { user, db, payments } = await setup();
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(within(nav).getByRole('button', { name: /^Payments/ }));
    await user.click(within(nav).getByRole('button', { name: 'More actions for folder Payments' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).queryByRole('menuitem', { name: /Export/ })).not.toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Delete folder…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete folder "Payments"?' });
    expect(dialog).toHaveTextContent('Its 2 decks move to Unfiled.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete folder' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'All decks' })).toBeInTheDocument();
    await waitFor(async () => {
      expect((await liveDecks(db)).every((d) => d.folderId === null)).toBe(true);
    });
    expect(await liveFolders(db)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => {
      expect((await liveDecks(db)).every((d) => d.folderId === payments.id)).toBe(true);
    });
    expect(await within(nav).findByRole('button', { name: /^Payments/ })).toBeInTheDocument();
  });

  it('renames a folder inline with F2 and the dialog rules', async () => {
    const { user, db } = await setup();
    await createFolder(db, 'Logistics');
    const nav = screen.getByRole('navigation', { name: 'Library' });
    act(() => {
      within(nav)
        .getByRole('button', { name: /^Payments/ })
        .focus();
    });
    await user.keyboard('{F2}');
    const field = within(nav).getByRole('textbox', { name: 'Folder name' });
    await user.clear(field);
    await user.type(field, ' logistics {Enter}');
    expect(
      await within(nav).findByText('A folder named "logistics" already exists.'),
    ).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(await within(nav).findByText('Enter a folder name.')).toBeInTheDocument();
    await user.type(field, 'Billing{Enter}');
    expect(await within(nav).findByRole('button', { name: /^Billing/ })).toBeInTheDocument();
    expect((await liveFolders(db)).map((f) => f.name)).toEqual(['Billing', 'Logistics']);
  });
});
