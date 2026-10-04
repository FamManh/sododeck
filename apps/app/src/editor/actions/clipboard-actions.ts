import { ClipboardPaste, Copy, CopyPlus, Scissors } from 'lucide-react';

import { copyText } from '../../lib/clipboard';
import { supportsClipboardRead } from '../../lib/features';
import { useUiStore } from '../../state/ui-store';
import {
  CLIPBOARD_FAILED,
  copied,
  copySelectionText,
  deleteCut,
  duplicateSelection,
  fragmentCopied,
  pasteText,
} from '../editing/clipboard-ops';
import { shortcutLabel } from '../shell/shortcuts';
import type { Action, ActionContext } from './types';

const ALL_MODES = ['edit', 'flow', 'session', 'viewOnly'] as const;
const COPYABLE = ['component', 'components', 'group'] as const;

/** Writes the selection's fragment to the clipboard from a menu (the keys use the copy event). */
function copyFromMenu(ctx: ActionContext, verb: 'Copied' | 'Cut', then?: () => void) {
  const copy = copySelectionText(ctx.editor, ctx.selection);
  if (copy === null) return;
  void copyText(copy.text).then((ok) => {
    if (!ok) {
      ctx.toast(CLIPBOARD_FAILED);
      return;
    }
    copied(copy.fragment, verb);
    then?.();
  });
}

/** Why the menu's Paste can't run: nothing copied yet, or no clipboard reading here (R9). */
function pasteBlock(): string | null {
  if (!supportsClipboardRead()) return `Press ${shortcutLabel('paste')} to paste`;
  if (!fragmentCopied()) return 'Nothing to paste: copy components first';
  return null;
}

/** Copy, Cut, Duplicate and the canvas menu's Paste (016 US1, contracts/canvas-editing-ui.md). */
export const CLIPBOARD_ACTIONS: readonly Action[] = [
  {
    id: 'clipboard.paste',
    label: 'Paste',
    icon: ClipboardPaste,
    shortcut: 'paste',
    // The canvas menu's first item (contract, screen 103).
    section: 'open',
    where: { menu: ['canvas'] },
    disabledReason: pasteBlock,
    run: (ctx) => {
      const point =
        ctx.point === null || ctx.canvas === null
          ? null
          : ctx.canvas.screenToFlowPosition(ctx.point);
      navigator.clipboard.readText().then(
        (text) => {
          if (!pasteText(ctx.editor, text, point, ctx.canvas, ctx.undoToast)) {
            useUiStore.getState().announce('Nothing to paste');
          }
        },
        () => {
          ctx.toast(CLIPBOARD_FAILED);
        },
      );
    },
  },
  {
    id: 'clipboard.copy',
    label: 'Copy',
    icon: Copy,
    shortcut: 'copy',
    section: 'clipboard',
    where: { menu: COPYABLE },
    // Copying never changes the deck, so it works in flow mode and view-only too (FR-035).
    modes: ALL_MODES,
    run: (ctx) => {
      copyFromMenu(ctx, 'Copied');
    },
  },
  {
    id: 'clipboard.cut',
    label: 'Cut',
    icon: Scissors,
    shortcut: 'cut',
    section: 'clipboard',
    where: { menu: COPYABLE },
    run: (ctx) => {
      copyFromMenu(ctx, 'Cut', () => {
        deleteCut(ctx.editor, ctx.selection);
      });
    },
  },
  {
    id: 'clipboard.duplicate',
    label: 'Duplicate',
    icon: CopyPlus,
    shortcut: 'duplicate',
    section: 'clipboard',
    where: { menu: COPYABLE },
    run: (ctx) => {
      duplicateSelection(ctx.editor, ctx.selection);
    },
  },
];
