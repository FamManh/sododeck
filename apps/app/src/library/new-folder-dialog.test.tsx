import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createFolder, liveFolders, type LibraryDb } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

async function openDialog(given?: LibraryDb) {
  const db = given ?? (await freshLibraryDb());
  const view = await renderLibrary({ db });
  await view.user.click(screen.getByRole('button', { name: 'New folder' }));
  const dialog = screen.getByRole('dialog', { name: 'New folder' });
  return {
    ...view,
    db,
    dialog,
    field: within(dialog).getByRole('textbox', { name: 'Folder name' }),
  };
}

describe('NewFolderDialog', () => {
  it('refuses an empty name with an inline error and keeps focus in the field', async () => {
    const { user, dialog, db } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    const field = within(dialog).getByRole('textbox', { name: 'Folder name' });
    expect(await within(dialog).findByText('Enter a folder name.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Enter a folder name.');
    await waitFor(() => {
      expect(field).toHaveFocus();
    });
    // The error has an icon, not color alone.
    expect(field.parentElement?.querySelector('svg')).not.toBeNull();
    expect(await liveFolders(db)).toEqual([]);
  });

  it('refuses a name that exists ignoring case and spaces', async () => {
    const db = await freshLibraryDb();
    await createFolder(db, 'Payments');
    const { user, dialog, field } = await openDialog(db);
    await user.type(field, ' payments ');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(
      await within(dialog).findByText('A folder named "payments" already exists.'),
    ).toBeInTheDocument();
    expect(await liveFolders(db)).toHaveLength(1);
  });

  it('creates a valid folder and shows it', async () => {
    const { user, field, db } = await openDialog();
    await user.type(field, 'Platform{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await liveFolders(db)).map((f) => f.name)).toEqual(['Platform']);
  });

  it('cancels with Esc', async () => {
    const { user, field, db } = await openDialog();
    await user.type(field, 'Nope{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await liveFolders(db)).toEqual([]);
  });
});
