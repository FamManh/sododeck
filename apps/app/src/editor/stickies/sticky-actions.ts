import type { DeckEditor, Point } from '@sododeck/model';
import type { Id, StickyColor } from '@sododeck/schema';
import { useEffect } from 'react';

import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';

const normalizePoint = ({ x, y }: Point): Point => ({
  x: Number.isFinite(x) ? Math.round(x) : 0,
  y: Number.isFinite(y) ? Math.round(y) : 0,
});

export function notesAreReadOnly(): boolean {
  return document.querySelector('[role="alertdialog"]') !== null;
}

export interface NewNoteOptions {
  /** The paper colour; defaults to the colour last picked (`lastStickyColour`, UI-only). */
  colour?: StickyColor;
}

/** Adds a note at a canvas point. Notes are always free, even over a card (ADR 0041). */
export function addNoteAt(
  editor: DeckEditor,
  point: Point,
  options: NewNoteOptions = {},
): Id | null {
  const ui0 = useUiStore.getState();
  if (notesAreReadOnly() || isFlowMode(ui0)) return null;
  const at = normalizePoint(point);
  const colour = options.colour ?? ui0.lastStickyColour;
  // Amber is the default look, so it is not written (the file stays as small as before).
  const paper = colour === 'amber' ? {} : { color: colour };
  const id = editor.beginStickyDraft({ text: '', position: at, ...paper });
  const ui = useUiStore.getState();
  ui.select({ stickies: [id] });
  ui.setStickyDraft(id);
  ui.setStickyEditing(id);
  ui.focus(null);
  ui.focusEdge(null);
  ui.closePopover();
  ui.announce('Note added');
  return id;
}

export function finishDraft(editor: DeckEditor, id: Id | null): 'kept' | 'discarded' | null {
  const ui = useUiStore.getState();
  if (id === null) return null;
  if (ui.stickyDraft !== id) {
    if (ui.stickyEditing === id) ui.setStickyEditing(null);
    return null;
  }
  const result = editor.endStickyDraft(id);
  ui.setStickyDraft(null);
  ui.setStickyEditing(null);
  if (result === 'discarded') {
    ui.select({ stickies: [] });
    ui.announce('Empty note removed');
  }
  return result;
}

export function useStickyDraftLifecycle(): void {
  const editor = useEditor();
  useEffect(
    () => () => {
      finishDraft(editor, useUiStore.getState().stickyDraft);
    },
    [editor],
  );
}
