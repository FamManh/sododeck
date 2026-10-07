import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { LibraryUnavailableError, type DeckServices } from '../editor/deck-services';
import { addDeck, importDeckFile, importMermaidDeck } from '../library/library-actions';
import { getLibraryClient } from '../storage/library-client';
import { getLibraryDb } from '../storage/library-db-instance';

async function context() {
  const db = await getLibraryDb();
  if (db === null) throw new LibraryUnavailableError();
  return { db, client: getLibraryClient() };
}

/** The web app's library-backed `DeckServices` (provided by the editor page; the embed has none). */
export function useWebDeckServices(): DeckServices {
  const navigate = useNavigate();
  return useMemo<DeckServices>(
    () => ({
      openLibrary: () => {
        void navigate('/');
      },
      openDeck: (deckId) => {
        void navigate(`/deck/${deckId}`);
      },
      importDeckFile: async (text, fileName) =>
        importDeckFile(await context(), text, null, fileName),
      addDeckFromText: async (text) => {
        const ctx = await context();
        return addDeck(ctx, await ctx.client.importFile(text), null);
      },
      importMermaidAsNewDeck: async (text) => importMermaidDeck(await context(), text, null),
    }),
    [navigate],
  );
}
