import { serializeDeck } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
        flows: [{ id: 'f', title: 'Checkout', steps: [] }],
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

  it('refuses invalid files and adds nothing', async () => {
    const db = await freshLibraryDb();
    const { user } = await renderLibrary({ db });
    await user.upload(input(), new File(['not json'], 'x.sododeck.json'));
    expect(
      await screen.findByText(
        'That file is not a valid .sododeck file. Older .sododeck.json files also open.',
      ),
    ).toBeInTheDocument();
    await user.upload(input(), new File(['{"nodes":1}'], 'y.json'));
    await waitFor(() => {
      expect(
        screen.getAllByText(
          'That file is not a valid .sododeck file. Older .sododeck.json files also open.',
        ),
      ).toHaveLength(2);
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

    it('shows the invalid-file message for text that is neither', async () => {
      const db = await freshLibraryDb();
      await renderLibrary({ db });
      fireEvent.change(input(), {
        target: { files: [new File(['just some words'], 'notes.txt')] },
      });
      expect(
        await screen.findByText(
          'That file is not a valid .sododeck file. Older .sododeck.json files also open.',
        ),
      ).toBeInTheDocument();
      expect(await liveDecks(db)).toEqual([]);
    });
  });
});
