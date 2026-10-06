import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FileCode,
  Image as ImageIcon,
  Scissors,
} from 'lucide-react';

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
  rememberedFragment,
} from '../editing/clipboard-ops';
import { copyImage } from '../export/copy-image';
import type { RenderedImage } from '../export/render-image';
import { shortcutLabel } from '../shell/shortcuts';
import type { Action, ActionContext } from './types';

const ALL_MODES = ['edit', 'flow', 'session', 'viewOnly'] as const;
/** Targets with something to copy: components, groups, notes, pictures, or a mix of them. */
const COPYABLE = [
  'component',
  'components',
  'group',
  'sticky',
  'image',
  'images',
  'mixed',
] as const;

export const NOTHING_TO_COPY = 'Nothing to copy: select components, notes or images';
export const IMAGE_COPY_FAILED = "Couldn't copy the image";

/** A mix of connectors only has nothing a copy or a picture keeps (connectors need both ends). */
function copyBlock(ctx: ActionContext): string | null {
  const { nodes, groups, stickies, images } = ctx.selection;
  return nodes.length + groups.length + stickies.length + images.length === 0
    ? NOTHING_TO_COPY
    : null;
}

/** Writes the selection's fragment to the clipboard from a menu (the keys use the copy event). */
function copyFromMenu(ctx: ActionContext, verb: 'Copied' | 'Cut', then?: () => void) {
  const copy = copySelectionText(ctx.editor, ctx.selection);
  if (copy === null) return;
  void copyText(copy.text).then((ok) => {
    if (!ok) {
      ctx.toast(CLIPBOARD_FAILED);
      return;
    }
    ctx.toast(copied(copy, verb));
    then?.();
  });
}

/**
 * Why the menu's Paste can't run: nothing copied yet, or no way to read it (R9). The in-memory
 * copy of this tab works even where the clipboard cannot be read.
 */
function pasteBlock(): string | null {
  if (rememberedFragment() !== null) return null;
  if (!supportsClipboardRead()) return `Press ${shortcutLabel('paste')} to paste`;
  if (!fragmentCopied()) return 'Nothing to paste: copy components first';
  return null;
}

/** The menu's Paste: the system clipboard, else this tab's last copy; at the menu point. */
function pasteFromMenu(ctx: ActionContext): void {
  const point =
    ctx.point === null || ctx.canvas === null ? null : ctx.canvas.screenToFlowPosition(ctx.point);
  const paste = (text: string) => {
    if (!pasteText(ctx.editor, text, point, ctx.canvas, ctx.undoToast)) {
      useUiStore.getState().announce('Nothing to paste');
    }
  };
  const fallback = () => {
    const text = rememberedFragment();
    if (text === null) ctx.toast(CLIPBOARD_FAILED);
    else paste(text);
  };
  if (!supportsClipboardRead()) {
    fallback();
    return;
  }
  navigator.clipboard.readText().then(paste, fallback);
}

/**
 * Copy as PNG / SVG: the selection drawn by the Export dialog's own path (`renderImage`, light
 * palette, 2× PNG) and copied by its Copy (`copyImage`). The renderer loads with the export
 * chunk; the clipboard item is created at once, inside the click, and filled when it is drawn.
 */
function copySelectionImage(ctx: ActionContext, format: 'png' | 'svg'): void {
  const ui = useUiStore.getState();
  const { nodes, groups, stickies, images } = ctx.selection;
  const image: Promise<RenderedImage> = import('../export/render-image')
    .then(({ renderImage }) =>
      renderImage({
        deck: ctx.deck,
        scope: 'selection',
        ui: {
          currentViewId: ui.currentViewId,
          revealed: ui.revealed,
          drill: ui.drill,
          activeFlowId: null,
          labelsOn: ui.labelsOn,
          selection: { nodes, groups, stickies, images },
        },
        transparent: false,
        store: ctx.pictures ?? null,
      }),
    )
    .then((rendered) => {
      if (rendered === null) throw new Error('empty');
      return rendered;
    });
  void copyImage(format, image).then((ok) => {
    ctx.toast(ok ? `Copied as ${format.toUpperCase()}` : IMAGE_COPY_FAILED);
  });
}

/**
 * Cut, Copy, Paste, Duplicate and Copy as PNG / SVG (016 US1, contracts/canvas-editing-ui.md),
 * plus the canvas menu's Paste.
 */
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
    run: pasteFromMenu,
  },
  {
    id: 'clipboard.cut',
    label: 'Cut',
    icon: Scissors,
    shortcut: 'cut',
    section: 'clipboard',
    where: { menu: COPYABLE },
    disabledReason: copyBlock,
    run: (ctx) => {
      copyFromMenu(ctx, 'Cut', () => {
        deleteCut(ctx.editor, ctx.selection);
      });
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
    disabledReason: copyBlock,
    run: (ctx) => {
      copyFromMenu(ctx, 'Copied');
    },
  },
  {
    id: 'clipboard.pasteHere',
    label: 'Paste',
    icon: ClipboardPaste,
    shortcut: 'paste',
    section: 'clipboard',
    where: { menu: COPYABLE },
    disabledReason: pasteBlock,
    run: pasteFromMenu,
  },
  {
    id: 'clipboard.duplicate',
    label: 'Duplicate',
    icon: CopyPlus,
    shortcut: 'duplicate',
    section: 'clipboard',
    where: { menu: COPYABLE },
    disabledReason: copyBlock,
    run: (ctx) => {
      duplicateSelection(ctx.editor, ctx.selection);
    },
  },
  {
    id: 'clipboard.copyPng',
    label: 'Copy as PNG',
    icon: ImageIcon,
    section: 'clipboard',
    where: { menu: COPYABLE },
    modes: ALL_MODES,
    disabledReason: copyBlock,
    run: (ctx) => {
      copySelectionImage(ctx, 'png');
    },
  },
  {
    id: 'clipboard.copySvg',
    label: 'Copy as SVG',
    icon: FileCode,
    section: 'clipboard',
    where: { menu: COPYABLE },
    modes: ALL_MODES,
    disabledReason: copyBlock,
    run: (ctx) => {
      copySelectionImage(ctx, 'svg');
    },
  },
];
