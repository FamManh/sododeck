import type { DeckDoc } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { useNavigate } from 'react-router';
import * as Y from 'yjs';

import { readDeck } from '../model/use-deck-snapshot';
import { insertDeck, type LibraryDb } from '../storage/library-db';
import { duplicate } from '../storage/library-ops';
import { useLiveQuery } from '../storage/use-live-query';

/**
 * The open deck was deleted in another tab (FR-040, research R16). Watching its record live, the
 * editor offers to keep what is on screen as a new deck, or to go back to the library. Edits
 * keep being written meanwhile: if the other tab undoes the delete, nothing was lost.
 */
export function DeckDeletedDialog({
  db,
  deckId,
  doc,
}: {
  db: LibraryDb;
  deckId: string;
  doc: DeckDoc;
}) {
  const navigate = useNavigate();
  const state = useLiveQuery(
    async () => ({ record: (await db.decks.get(deckId)) ?? null }),
    [db, deckId],
  );
  if (state === undefined) return null;
  const deleted = state.record === null || state.record.deletedAt !== null;
  if (!deleted) return null;

  const keepCopy = async () => {
    const name = readDeck(doc).name ?? 'Untitled deck';
    const { bytes, summary } = duplicate([Y.encodeStateAsUpdate(doc)], name);
    const id = crypto.randomUUID();
    const now = Date.now();
    await insertDeck(
      db,
      {
        id,
        folderId: null,
        createdAt: now,
        updatedAt: now,
        openedAt: now,
        exportedAt: null,
        deletedAt: null,
        ...summary,
      },
      bytes,
    );
    await navigate(`/deck/${id}`, { replace: true });
  };

  return (
    <Dialog open>
      <DialogContent
        role="alertdialog"
        className="max-w-md"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>This deck was deleted in another tab</DialogTitle>
          <DialogDescription>
            Keep a copy of what you see here as a new deck, or go back to the library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              void navigate('/');
            }}
          >
            Back to library
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void keepCopy();
            }}
          >
            Keep a copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
