import { emptySododeckFile } from '@sododeck/schema';
import { ToastProvider, Toaster } from '@sododeck/ui/components/toast';
import { TooltipProvider } from '@sododeck/ui/components/tooltip';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { liveDecks } from '../../storage/library-db';
import { getLibraryDb, setLibraryDbForTests } from '../../storage/library-db-instance';
import { DeckStub } from '../../test/deck-stub';
import { freshLibraryDb } from '../../test/library-fixtures';
import { WebDeckServicesProvider } from '../../test/web-deck-services-provider';
import { DeckMenu } from './deck-menu';

vi.mock('../../storage/library-client', (importOriginal) =>
  import('../../test/mock-library-client').then((m) => m.mockLibraryClient(importOriginal)),
);

afterEach(() => {
  setLibraryDbForTests(undefined);
});

async function setup() {
  const db = await freshLibraryDb();
  setLibraryDbForTests(db);
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ToastProvider>
            <WebDeckServicesProvider>
              <DeckMenu />
            </WebDeckServicesProvider>
            <Toaster />
          </ToastProvider>
        ),
      },
      { path: '/deck/:deckId', Component: DeckStub },
    ],
    { initialEntries: ['/'] },
  );
  await act(async () => {
    render(
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>,
    );
    await getLibraryDb();
  });
  return { db, router, user: userEvent.setup() };
}

const pick = (file: File) => {
  fireEvent.change(screen.getByTestId('deck-menu-import'), { target: { files: [file] } });
};

describe('DeckMenu import (062)', () => {
  it('opens the problems dialog for a refused file and adds nothing', async () => {
    const { db } = await setup();
    pick(new File(['{ "nodes": 1 }'], 'broken.sododeck'));
    const dialog = await screen.findByRole('dialog', { name: 'Couldn\'t open "broken.sododeck"' });
    expect(within(dialog).getByRole('button', { name: 'Copy problems' })).toBeInTheDocument();
    expect(await liveDecks(db)).toEqual([]);
  });

  it('offers Show for a deck that opened with problems, and Open deck goes to it', async () => {
    const { user, router } = await setup();
    const file = {
      ...emptySododeckFile(),
      name: 'Gaps',
      flows: [{ id: 'f', title: 'F', steps: [] }],
    };
    pick(new File([JSON.stringify(file)], 'gaps.sododeck'));
    expect(
      await screen.findByText('Imported "Gaps" into the library with 1 problem'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show' }));
    const dialog = await screen.findByRole('dialog', { name: '"Gaps" opened with problems' });
    expect(within(dialog).getByText('Incomplete flow: F has no steps.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Open deck' }));
    expect(router.state.location.pathname).toMatch(/^\/deck\//);
  });
});
