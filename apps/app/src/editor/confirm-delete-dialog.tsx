import { previewRemoval, removeTarget, type RemovalTarget } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
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
import { useMemo, useRef } from 'react';

import { isApplePlatform } from '../lib/features';
import { useEditor } from '../model/use-editor';
import { useUiStore, type PendingDelete } from '../state/ui-store';
import { focusCanvas } from './canvas-actions';
import { describeRemoval, removalToast } from './describe-removal';

/** The Undo toast on screen, replaced by the next delete's (spec edge case). */
let undoToastId: number | null = null;

/**
 * Delete confirmation (§g-11/§g-19, FR-017–019). The counts come from `previewRemoval`, which
 * runs the model's real cascade, so they match what the delete does. Confirm = one batch = one
 * undo step, then a 6 s toast with Undo (⌘Z keeps working after it is gone).
 */
export function ConfirmDeleteDialog({ deck }: { deck: SododeckFile }) {
  const pending = useUiStore((s) => s.pendingDelete);
  if (pending === null) return null;
  return <ConfirmDeleteContent deck={deck} pending={pending} />;
}

function ConfirmDeleteContent({ deck, pending }: { deck: SododeckFile; pending: PendingDelete }) {
  const editor = useEditor();
  const { toast, dismiss } = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const targets = pending.targets as RemovalTarget[];
  // Computed once when the dialog opens; the deck cannot change underneath a modal dialog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preview = useMemo(() => previewRemoval(deck, targets), [targets]);
  const canvasDelete = targets.every((t) => t.scope === 'nodes' || t.scope === 'edges');
  const { title, body } = describeRemoval(deck, targets, preview);

  const cancel = () => {
    useUiStore.getState().cancelDelete();
  };

  const confirm = () => {
    const message = removalToast(deck, targets, preview, isApplePlatform());
    editor.batch(() => {
      // A connection may already be gone with its component (cascade): removeTarget skips it.
      for (const target of targets) removeTarget(editor, editor.doc, target);
    });
    const ui = useUiStore.getState();
    ui.cancelDelete();
    if (canvasDelete) ui.clearSelection();
    ui.announce(message);
    if (undoToastId !== null) dismiss(undoToastId);
    undoToastId = toast({
      message,
      action: {
        label: 'Undo',
        onAction: () => {
          if (editor.undo()) useUiStore.getState().announce('Undone');
        },
      },
      duration: MOTION.toastUndoMs,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent
        role="alertdialog"
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          // Deletes from the flow list return focus to where they came from (Radix default).
          if (!canvasDelete) return;
          event.preventDefault();
          focusCanvas();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button ref={cancelRef} onClick={cancel}>
            Cancel
          </Button>
          <Button className="border-clay-ink text-clay-ink hover:bg-clay-soft" onClick={confirm}>
            <Trash2 />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
