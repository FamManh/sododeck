import { assetId, createEditor, fromJSON, MISSING_DATA, serializeDeck } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../images/test-pictures';
import { listBlobIds } from '../storage/blob-store';
import { createFolder, liveDecks } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary } from '../test/render-library';

vi.mock('../storage/library-client', (importOriginal) =>
  import('../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

const deckFile = (name: string) =>
  new File(
    [
      serializeDeck({
        ...emptySododeckFile(),
        name,
        nodes: [{ id: 'a', type: 'service', title: 'A' }],
        flows: [{ id: 'f', title: 'Checkout', steps: [] }],
      }),
    ],
    `${name}.sododeck.json`,
    { type: 'application/json' },
  );

const input = () => screen.getByTestId('import-input');

describe('import', () => {
  it('reads "Import" and names the file type for assistive tech (051 US8)', async () => {
    const db = await freshLibraryDb();
    await renderLibrary({ db });
    const button = await screen.findByRole('button', {
      name: 'Import deck file (.sododeck.json)',
    });
    expect(button).toHaveTextContent(/^Import$/);
  });

  it('adds a valid file to the current folder with its counts', async () => {
    const db = await freshLibraryDb();
    const folder = await createFolder(db, 'Payments');
    const { user } = await renderLibrary({ db });
    const nav = screen.getByRole('navigation', { name: 'Library' });
    await user.click(await within(nav).findByRole('button', { name: /^Payments/ }));
    expect(input()).not.toHaveAttribute('multiple');
    expect(input()).toHaveAttribute('accept', expect.stringContaining('.sododeck.json'));

    await user.upload(input(), deckFile('Colleague deck'));
    expect(await screen.findByText('Imported "Colleague deck"')).toBeInTheDocument();
    const [deck] = await liveDecks(db);
    expect(deck).toMatchObject({
      name: 'Colleague deck',
      folderId: folder.id,
      nodeCount: 1,
      flowCount: 1,
    });
    expect(await screen.findByText(/1 component · 1 flow/)).toBeInTheDocument();
  });

  it('refuses invalid files and adds nothing', async () => {
    const db = await freshLibraryDb();
    const { user } = await renderLibrary({ db });
    await user.upload(input(), new File(['not json'], 'x.sododeck.json'));
    expect(await screen.findByText('That file is not a valid .sododeck.json.')).toBeInTheDocument();
    await user.upload(input(), new File(['{"nodes":1}'], 'y.json'));
    await waitFor(() => {
      expect(screen.getAllByText('That file is not a valid .sododeck.json.')).toHaveLength(2);
    });
    await user.upload(
      input(),
      new File([JSON.stringify({ ...emptySododeckFile(), version: 99 })], 'z.sododeck.json'),
    );
    expect(
      await screen.findByText('That file was made with a newer version of Sododeck.'),
    ).toBeInTheDocument();
    expect(await liveDecks(db)).toEqual([]);
  });

  it('imports one dropped file and refuses several', async () => {
    const db = await freshLibraryDb();
    await renderLibrary({ db });
    const main = screen.getByRole('main');

    fireEvent.drop(main, {
      dataTransfer: { files: [deckFile('One'), deckFile('Two')], types: ['Files'] },
    });
    expect(await screen.findByText('Import one file at a time.')).toBeInTheDocument();
    expect(await liveDecks(db)).toEqual([]);

    fireEvent.drop(main, { dataTransfer: { files: [deckFile('Dropped')], types: ['Files'] } });
    expect(await screen.findByText('Imported "Dropped"')).toBeInTheDocument();
    expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Dropped']);
  });

  it('refuses several files picked at once', async () => {
    const db = await freshLibraryDb();
    await renderLibrary({ db });
    fireEvent.change(input(), { target: { files: [deckFile('One'), deckFile('Two')] } });
    expect(await screen.findByText('Import one file at a time.')).toBeInTheDocument();
    expect(await liveDecks(db)).toEqual([]);
  });

  describe('pictures (055)', () => {
    const id = assetId(PNG_1X1);
    const pictureFile = (data?: string) => {
      const doc = fromJSON({ ...emptySododeckFile(), name: 'Pictures' });
      createEditor(doc).addImages([
        {
          asset: id,
          meta: { type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, name: 'dot.png' },
          position: { x: 0, y: 0 },
          size: { width: 64, height: 64 },
        },
      ]);
      let text = serializeDeck(doc, new Map([[id, PNG_1X1]]));
      if (data !== undefined) text = text.replace(/"data": "[^"]*"/, `"data": "${data}"`);
      return new File([text], 'Pictures.sododeck.json', { type: 'application/json' });
    };

    it('stores the pictures of an imported file with its deck, once per deck', async () => {
      const db = await freshLibraryDb();
      const { user } = await renderLibrary({ db });
      await user.upload(input(), pictureFile());
      expect(await screen.findByText('Imported "Pictures"')).toBeInTheDocument();
      await user.upload(input(), pictureFile());
      await waitFor(async () => {
        expect(await liveDecks(db)).toHaveLength(2);
      });
      for (const deck of await liveDecks(db)) {
        expect(await listBlobIds(db, deck.id)).toEqual([id]);
      }
    });

    it('opens a file with a damaged picture and says once how many are missing', async () => {
      const db = await freshLibraryDb();
      const { user } = await renderLibrary({ db });
      await user.upload(input(), pictureFile(MISSING_DATA));
      expect(
        await screen.findByText('Imported "Pictures". 1 picture is missing from the file.'),
      ).toBeInTheDocument();
      const [deck] = await liveDecks(db);
      expect(await listBlobIds(db, deck?.id ?? '')).toEqual([]);
    });
  });
});
