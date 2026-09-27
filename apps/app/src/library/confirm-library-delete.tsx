import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { useToast } from '@sododeck/ui/components/toast';
import { MOTION } from '@sododeck/ui/lib/motion';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { isTextTarget } from '../lib/is-text-target';
import { deleteDeck, deleteFolder } from './library-actions';
import { useLibraryStore, type PendingDelete } from './library-store';
import { folderSection } from './library-view';
import { undoHint, type LibraryCommands } from './use-library-commands';

/** The Undo toast on screen, replaced by the next delete's. */
let undoToastId: number | null = null;

function describe(pending: PendingDelete): { title: string; body: string; confirm: string } {
  if (pending.kind === 'deck') {
    return {
      title: `Delete "${pending.name}"?`,
      body: 'You can undo this until you reload the page.',
      confirm: 'Delete deck',
    };
  }
  const n = pending.deckCount;
  return {
    title: `Delete folder "${pending.name}"?`,
    body:
      n === 0
        ? 'The folder is empty. You can undo this until you reload the page.'
        : `Its ${String(n)} ${n === 1 ? 'deck moves' : 'decks move'} to Unfiled.`,
    confirm: 'Delete folder',
  };
}

/**
 * Confirm → soft delete → 6 s Undo toast (FR-021, §g-11/§g-19), for decks and folders. ⌘Z /
 * Ctrl+Z in the library undoes the last delete of the session after the toast is gone.
 */
export function ConfirmLibraryDelete({ commands }: { commands: LibraryCommands }) {
  const pending = useLibraryStore((s) => s.pendingDelete);
  const { toast, dismiss } = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTextTarget(event.target)) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')
      )
        return;
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') {
        return;
      }
      event.preventDefault();
      void commands.undo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [commands]);

  if (pending === null) return null;
  const { title, body, confirm } = describe(pending);
  const close = () => {
    useLibraryStore.getState().requestDelete(null);
  };

  const run = async () => {
    close();
    const store = useLibraryStore.getState();
    if (pending.kind === 'deck') {
      await deleteDeck(commands.ctx, pending.id, pending.name);
    } else {
      await deleteFolder(commands.ctx, pending.id, pending.name);
      if (store.section === folderSection(pending.id)) store.setSection('all');
    }
    if (undoToastId !== null) dismiss(undoToastId);
    undoToastId = toast({
      message: `${pending.name} deleted · ${undoHint()} to undo`,
      action: {
        label: 'Undo',
        onAction: () => {
          void commands.undo();
        },
      },
      duration: MOTION.toastUndoMs,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} onClick={close}>
            Cancel
          </Button>
          <Button
            className="border-clay-ink text-clay-ink hover:bg-clay-soft"
            onClick={() => {
              void run();
            }}
          >
            <Trash2 />
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
