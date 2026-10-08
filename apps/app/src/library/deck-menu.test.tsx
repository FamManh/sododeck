import { serializeDeck, toMarkdown } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as download from '../storage/download';
import { createFolder, liveDecks, type LibraryDb } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary, seedDeck } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup() {
  const db = await freshLibraryDb();
  const payments = await createFolder(db, 'Payments');
  await createFolder(db, 'Logistics');
  await seedDeck(
    db,
    'd1',
    { name: 'Shop', folderId: payments.id, updatedAt: 2 },
    {
      nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
    },
  );
  const view = await renderLibrary({ db });
  await screen.findByRole('link', { name: 'Shop' });
  return { ...view, db, payments };
}

const names = async (db: LibraryDb) => (await liveDecks(db)).map((d) => d.name).sort();

describe('deck menu', () => {
  it('opens from ⋯ with every action, the current folder checked', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    const menu = screen.getByRole('menu');
    for (const name of [
      'Open',
      'Rename',
      'Duplicate',
      'Move to folder',
      'Export .sododeck',
      'Delete…',
    ]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('menuitem', { name: 'Rename' })).toHaveTextContent('F2');
    await user.hover(within(menu).getByRole('menuitem', { name: 'Move to folder' }));
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('menuitemradio', { name: 'Payments' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Unfiled' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('opens by right-click and by Shift+F10 on the focused card', async () => {
    const { user } = await setup();
    fireEvent.contextMenu(screen.getByRole('link', { name: 'Shop' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    act(() => {
      screen.getByRole('link', { name: 'Shop' }).focus();
    });
    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('moves a deck to another folder', async () => {
    const { user, db } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
    await user.keyboard('{ArrowRight}');
    // Keyboard only: Unfiled, Logistics, Payments.
    await waitFor(() => {
      expect(screen.getByRole('menuitemradio', { name: 'Unfiled' })).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(async () => {
      const [deck] = await liveDecks(db);
      const folders = await db.folders.toArray();
      expect(folders.find((f) => f.id === deck?.folderId)?.name).toBe('Logistics');
    });
  });

  it('duplicates as "<name> copy" in the same folder, from the menu and with ⌘D', async () => {
    const { user, db, payments } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('link', { name: 'Shop copy' })).toBeInTheDocument();
    const copy = (await liveDecks(db)).find((d) => d.name === 'Shop copy');
    expect(copy).toMatchObject({ folderId: payments.id, nodeCount: 1 });

    act(() => {
      screen.getByRole('link', { name: 'Shop' }).focus();
    });
    await user.keyboard('{Meta>}d{/Meta}');
    await waitFor(async () => {
      expect(await names(db)).toEqual(['Shop', 'Shop copy', 'Shop copy']);
    });
  });

  it('renames inline with F2: Enter saves, Esc cancels, empty is refused', async () => {
    const { user, db } = await setup();
    act(() => {
      screen.getByRole('link', { name: 'Shop' }).focus();
    });
    await user.keyboard('{F2}');
    const field = screen.getByRole('textbox', { name: 'Deck name' });
    expect(field).toHaveFocus();
    await user.clear(field);
    await user.type(field, 'Store{Enter}');
    expect(await screen.findByRole('link', { name: 'Store' })).toBeInTheDocument();
    expect(await names(db)).toEqual(['Store']);

    act(() => {
      screen.getByRole('link', { name: 'Store' }).focus();
    });
    await user.keyboard('{F2}');
    await user.type(screen.getByRole('textbox', { name: 'Deck name' }), 'xx{Escape}');
    expect(screen.getByRole('link', { name: 'Store' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More actions for Store' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const again = await screen.findByRole('textbox', { name: 'Deck name' });
    await user.clear(again);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('link', { name: 'Store' })).toBeInTheDocument();
    expect(await names(db)).toEqual(['Store']);
  });

  it('exports <name>.sododeck with the model export and records it', async () => {
    const downloadText = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const { user, db } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export .sododeck' }));
    await waitFor(() => {
      expect(downloadText).toHaveBeenCalledOnce();
    });
    expect(downloadText).toHaveBeenCalledWith(
      'Shop.sododeck',
      serializeDeck({
        ...emptySododeckFile(),
        name: 'Shop',
        nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
      }),
    );
    await waitFor(async () => {
      expect((await db.decks.get('d1'))?.exportedAt).not.toBeNull();
    });
  });

  it('exports <name>.sododeck.md, the readable note form, and records it (070)', async () => {
    const downloadText = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    const { user, db } = await setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Shop' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export .sododeck.md' }));
    await waitFor(() => {
      expect(downloadText).toHaveBeenCalledOnce();
    });
    expect(downloadText).toHaveBeenCalledWith(
      'Shop.sododeck.md',
      toMarkdown(
        serializeDeck({
          ...emptySododeckFile(),
          name: 'Shop',
          nodes: [{ id: 'a', type: 'service', title: 'Orders' }],
        }),
      ),
      'text/markdown',
    );
    await waitFor(async () => {
      expect((await db.decks.get('d1'))?.exportedAt).not.toBeNull();
    });
  });
});
