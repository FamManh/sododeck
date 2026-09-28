import type { View } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sododeck/ui/components/dialog';
import { Trash2 } from 'lucide-react';
import { useRef } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useUndoToast } from '../undo-toast';

/**
 * Confirms deleting a view (011 FR-042). The view's positions, pins, filters and collapse state go
 * with it; the Undo toast (6 s) or ⌘Z brings everything back. The current view, when deleted,
 * hands over to the view on its left (`useCurrentViewSync`).
 */
export function DeleteViewDialog({
  view,
  onClose,
}: {
  view: View;
  onClose: (deleted: boolean) => void;
}) {
  const editor = useEditor();
  const showUndoToast = useUndoToast();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirm = () => {
    editor.removeView(view.id);
    const message = `View "${view.title}" deleted`;
    useUiStore.getState().announce(message);
    showUndoToast(message);
    onClose(true);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose(false);
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
          <DialogTitle>{`Delete view "${view.title}"?`}</DialogTitle>
          <DialogDescription>
            Its own positions, pins, filters and collapsed groups are deleted with it. Components
            and connections stay in every other view.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            onClick={() => {
              onClose(false);
            }}
          >
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
