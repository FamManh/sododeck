import { useToast } from '@sododeck/ui/components/toast';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { isApplePlatform } from '../lib/features';
import type { DeckRecord } from '../storage/library-db';
import { getLibraryClient } from '../storage/library-client';
import { useLibraryDb } from '../storage/library-db-instance';
import {
  duplicateDeck,
  exportDeckFile,
  moveDeckTo,
  undoLastDelete,
  type LibraryActionContext,
} from './library-actions';
import { useLibraryStore } from './library-store';

export interface LibraryCommands {
  ctx: LibraryActionContext;
  open: (deck: DeckRecord) => void;
  startRename: (deck: DeckRecord) => void;
  duplicate: (deck: DeckRecord) => Promise<void>;
  move: (deck: DeckRecord, folderId: string | null) => Promise<void>;
  exportDeck: (deck: DeckRecord) => Promise<void>;
  requestDelete: (deck: DeckRecord) => void;
  undo: () => Promise<void>;
}

export const undoHint = () => (isApplePlatform() ? '⌘Z' : 'Ctrl+Z');

/** The deck commands the menus, cards and shortcuts share; `null` without storage. */
export function useLibraryCommands(): LibraryCommands | null {
  const db = useLibraryDb();
  const navigate = useNavigate();
  const { toast } = useToast();

  return useMemo(() => {
    if (!db) return null;
    const ctx: LibraryActionContext = { db, client: getLibraryClient() };
    const store = () => useLibraryStore.getState();
    const failed = () => {
      toast({ message: 'Something went wrong. Nothing was changed.' });
    };
    return {
      ctx,
      open: (deck) => {
        void navigate(`/deck/${deck.id}`);
      },
      startRename: (deck) => {
        store().setRenaming(deck.id);
      },
      duplicate: async (deck) => {
        try {
          await duplicateDeck(ctx, deck.id);
          toast({ message: `Duplicated "${deck.name}"` });
        } catch {
          failed();
        }
      },
      move: async (deck, folderId) => {
        await moveDeckTo(ctx, deck.id, folderId);
      },
      exportDeck: async (deck) => {
        try {
          await exportDeckFile(ctx, deck.id);
        } catch {
          failed();
        }
      },
      requestDelete: (deck) => {
        store().requestDelete({ kind: 'deck', id: deck.id, name: deck.name });
      },
      undo: async () => {
        const result = await undoLastDelete(ctx);
        if (result === null) return;
        toast({ message: result.ok ? `Restored "${result.entry.name}"` : result.message });
      },
    };
  }, [db, navigate, toast]);
}
