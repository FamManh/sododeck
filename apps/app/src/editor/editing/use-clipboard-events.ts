/**
 * ⌘C / ⌘X / ⌘V on the canvas (016 research R9): the platform `copy`, `cut` and `paste` events,
 * which need no permission prompt and work in every target browser. Text fields, dialogs, the
 * drawer and other overlays, and a text selection on the page keep the browser's own behaviour;
 * a paste that is not a fragment is left alone (FR-007).
 */
import { useToast } from '@sododeck/ui/components/toast';
import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';

import { isTextTarget } from '../../lib/is-text-target';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { inDialog, inOverlay } from '../use-canvas-shortcuts';
import { CLIPBOARD_FAILED, copied, copySelectionText, deleteCut, pasteText } from './clipboard-ops';

/** Whether the page has selected text the user may be copying. */
function hasTextSelection(): boolean {
  const selection = globalThis.getSelection();
  return selection !== null && !selection.isCollapsed;
}

function leaveToBrowser(event: ClipboardEvent): boolean {
  return (
    event.defaultPrevented ||
    isTextTarget(event.target) ||
    inDialog(event.target) ||
    inOverlay(event.target) ||
    hasTextSelection()
  );
}

/** Edits are off in flow mode and while recording; copying stays on (FR-035). */
function editable(): boolean {
  const ui = useUiStore.getState();
  return !isFlowMode(ui) && ui.flowSession === null;
}

export function useClipboardEvents(): void {
  const editor = useEditor();
  const { screenToFlowPosition } = useReactFlow();
  const { toast } = useToast();

  useEffect(() => {
    const write = (event: ClipboardEvent, cut: boolean) => {
      if (leaveToBrowser(event) || (cut && !editable())) return;
      const { selection } = useUiStore.getState();
      const copy = copySelectionText(editor, selection);
      if (copy === null) return;
      event.preventDefault();
      if (event.clipboardData === null) {
        toast({ message: CLIPBOARD_FAILED });
        return;
      }
      event.clipboardData.setData('text/plain', copy.text);
      copied(copy.fragment, cut ? 'Cut' : 'Copied');
      if (cut) deleteCut(editor, selection);
    };
    const onCopy = (event: ClipboardEvent) => {
      write(event, false);
    };
    const onCut = (event: ClipboardEvent) => {
      write(event, true);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (leaveToBrowser(event) || !editable()) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (pasteText(editor, text, useUiStore.getState().canvasPointer, { screenToFlowPosition })) {
        event.preventDefault();
      }
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [editor, screenToFlowPosition, toast]);
}
