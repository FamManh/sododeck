import { assetId, createEditor, fromJSON, MISSING_DATA, serializeDeck } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PNG_1X1 } from '../images/test-pictures';
import { listBlobIds } from '../storage/blob-store';
import type * as LayoutClientModule from '../layout/layout-client';
import { createFolder, liveDecks } from '../storage/library-db';
import { freshLibraryDb } from '../test/library-fixtures';
import { renderLibrary } from '../test/render-library';

vi.mock('../layout/layout-client', async (importOriginal) => {
  const actual = await importOriginal<typeof LayoutClientModule>();
  const client = {
    layout: (request: { nodes: { id: string }[] }) =>
      Promise.resolve(
        Object.fromEntries(request.nodes.map((n, i) => [n.id, { x: i * 260, y: 0 }])),
      ),
    cancel: () => undefined,
    terminate: () => undefined,
  };
  return { ...actual, getLayoutClient: () => client };
});

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
        // A flow with a step, so the deck opens with no problems (062 counts an empty flow).
        edges: [{ id: 'e', from: 'a', to: 'a' }],
        flows: [{ id: 'f', title: 'Checkout', steps: [{ id: 's', edge: 'e' }] }],
      }),
    ],
    `${name}.sododeck`,
    { type: 'application/json' },
  );

const input = () => screen.getByTestId('import-input');

describe('import', () => {
  it('reads "Import" and names the file type for assistive tech (051 US8)', async () => {
    const db = await freshLibraryDb();
    await renderLibrary({ db });
    const button = await screen.findByRole('button', {
      name: 'Import deck file (.sododeck)',
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
    expect(input()).toHaveAttribute('accept', expect.stringContaining('.sododeck'));

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

  it.each(['a.sododeck', 'a.sododeck.json', 'a.json', 'no-extension'])(
    'opens %s by content, whatever its name (FR-003)',
    async (fileName) => {
      const db = await freshLibraryDb();
      await renderLibrary({ db });
      const text = await deckFile('Same').text();
      // fireEvent: user.upload honours `accept`, and a renamed file must open anyway.
      fireEvent.change(input(), { target: { files: [new File([text], fileName)] } });
      expect(await screen.findByText('Imported "Same"')).toBeInTheDocument();
      expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Same']);
    },
  );

  it('refuses invalid files with the problems dialog and adds nothing (062 US1)', async () => {
    const db = await freshLibraryDb();
    const { user } = await renderLibrary({ db });
    await user.upload(input(), new File(['not json'], 'x.sododeck.json'));
    let dialog = await screen.findByRole('dialog', { name: 'Couldn\'t open "x.sododeck.json"' });
    expect(within(dialog).getByText('1 problem. Nothing was added.')).toBeInTheDocument();
    expect(within(dialog).getByText(/^The file is not valid JSON/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await user.upload(input(), new File(['{"nodes":1}'], 'y.json'));
    dialog = await screen.findByRole('dialog', { name: 'Couldn\'t open "y.json"' });
    expect(within(dialog).getByText('/nodes')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.upload(
      input(),
      new File([JSON.stringify({ ...emptySododeckFile(), version: 99 })], 'z.sododeck.json'),
    );
    dialog = await screen.findByRole('dialog', { name: 'Couldn\'t open "z.sododeck.json"' });
    expect(
      within(dialog).getByText(
        'The file is written for format version 99; this app reads version 1.',
      ),
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

    it('opens a file with a damaged picture, says so once and lists it on Show (062 US2)', async () => {
      const db = await freshLibraryDb();
      const { user } = await renderLibrary({ db });
      await user.upload(input(), pictureFile(MISSING_DATA));
      expect(await screen.findByText('Imported "Pictures" with 1 problem')).toBeInTheDocument();
      const [deck] = await liveDecks(db);
      expect(await listBlobIds(db, deck?.id ?? '')).toEqual([]);
      await user.click(screen.getByRole('button', { name: 'Show' }));
      const dialog = await screen.findByRole('dialog', {
        name: '"Pictures" opened with problems',
      });
      expect(within(dialog).getByText(/^Picture "dot.png" is damaged: /)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Open deck' })).toHaveFocus();
    });
  });

  describe('Mermaid files (056)', () => {
    it('imports a .mmd flowchart through the Mermaid dialog', async () => {
      const db = await freshLibraryDb();
      await renderLibrary({ db });
      fireEvent.change(input(), {
        target: { files: [new File(['flowchart LR\n  A --> B'], 'diagram.mmd')] },
      });
      expect(await screen.findByText('2 components, 1 connection, 0 groups')).toBeInTheDocument();
      expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Imported diagram']);
    });

    it('still imports a deck file by its content, even named .mmd', async () => {
      const db = await freshLibraryDb();
      await renderLibrary({ db });
      const text = await deckFile('Real deck').text();
      fireEvent.change(input(), { target: { files: [new File([text], 'oops.mmd')] } });
      expect(await screen.findByText('Imported "Real deck"')).toBeInTheDocument();
    });

    it('refuses text that is neither as not JSON', async () => {
      const db = await freshLibraryDb();
      await renderLibrary({ db });
      fireEvent.change(input(), {
        target: { files: [new File(['just some words'], 'notes.txt')] },
      });
      const dialog = await screen.findByRole('dialog', { name: 'Couldn\'t open "notes.txt"' });
      expect(within(dialog).getByText(/^The file is not valid JSON/)).toBeInTheDocument();
      expect(await liveDecks(db)).toEqual([]);
    });
  });
});
