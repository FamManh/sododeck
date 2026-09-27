/**
 * The Undo toast shown after a delete (§g-19): 6 s, one at a time (the next delete's replaces
 * it), with an Undo button that undoes the last step. ⌘Z keeps working after it is gone. Used by
 * the delete confirmation and by the deletes that ask nothing (rule rows, columns, detach).
 */
import type { DeckEditor } from '@sododeck/model';
import { useToast } from '@sododeck/ui/components/toast';
import { MOTION } from '@sododeck/ui/lib/motion';
import { useCallback } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';

type ToastApi = ReturnType<typeof useToast>;

/** The Undo toast on screen, replaced by the next one (spec edge case). */
let undoToastId: number | null = null;

/** Shows `message` with Undo, replacing any Undo toast still on screen. */
export function showUndoToast(api: ToastApi, editor: DeckEditor, message: string): void {
  if (undoToastId !== null) api.dismiss(undoToastId);
  undoToastId = api.toast({
    message,
    action: {
      label: 'Undo',
      onAction: () => {
        if (editor.undo()) useUiStore.getState().announce('Undone');
      },
    },
    duration: MOTION.toastUndoMs,
  });
}

/** `showUndoToast` bound to this editor and toast host. */
export function useUndoToast(): (message: string) => void {
  const api = useToast();
  const editor = useEditor();
  return useCallback(
    (message: string) => {
      showUndoToast(api, editor, message);
    },
    [api, editor],
  );
}
