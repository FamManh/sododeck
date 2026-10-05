import { nodeCanvasPosition, type DeckEditor, type Point } from '@sododeck/model';
import type { Id, SododeckFile, StickyColor } from '@sododeck/schema';
import { useEffect } from 'react';

import { useEditor } from '../../model/use-editor';
import { readViewState } from '../views/use-current-view';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { cardSize } from '../canvas-geometry';

const normalizePoint = ({ x, y }: Point): Point => ({
  x: Number.isFinite(x) ? Math.round(x) : 0,
  y: Number.isFinite(y) ? Math.round(y) : 0,
});

function nodeAtPoint(deck: SododeckFile, point: Point): SododeckFile['nodes'][number] | null {
  for (const node of deck.nodes) {
    const position = nodeCanvasPosition(deck, node.id);
    if (position === null) continue;
    // Pinning happens at component scale (011); a resized card uses its own stored size (017 R2).
    const size = cardSize(node, 'component');
    const inside =
      point.x >= position.x &&
      point.x <= position.x + size.width &&
      point.y >= position.y &&
      point.y <= position.y + size.height;
    if (inside) return node;
  }
  return null;
}

export function notesAreReadOnly(): boolean {
  return document.querySelector('[role="alertdialog"]') !== null;
}

export interface NewNoteOptions {
  /**
   * Pin the note to the card under the point (default). The Add flyout's pad passes `false`: a
   * dropped note is always free, whatever lies under the pointer (053 R7).
   */
  pin?: boolean;
  /** The paper colour; defaults to the colour last picked (`lastStickyColour`, UI-only). */
  colour?: StickyColor;
}

export function addNoteAt(
  editor: DeckEditor,
  point: Point,
  options: NewNoteOptions = {},
): Id | null {
  const ui0 = useUiStore.getState();
  if (notesAreReadOnly() || isFlowMode(ui0)) return null;
  // Offsets are measured where the component is drawn in the current view (011).
  const deck = readViewState(editor.doc).deck;
  const at = normalizePoint(point);
  const anchor = options.pin === false ? null : nodeAtPoint(deck, at);
  const colour = options.colour ?? ui0.lastStickyColour;
  // Amber is the default look, so it is not written (the file stays as small as before).
  const paper = colour === 'amber' ? {} : { color: colour };
  const id = editor.beginStickyDraft(
    anchor === null
      ? { text: '', position: at, ...paper }
      : {
          text: '',
          ...paper,
          anchor: anchor.id,
          position: {
            x: at.x - (nodeCanvasPosition(deck, anchor.id)?.x ?? 0),
            y: at.y - (nodeCanvasPosition(deck, anchor.id)?.y ?? 0),
          },
        },
  );
  const ui = useUiStore.getState();
  ui.select({ stickies: [id] });
  ui.setStickyDraft(id);
  ui.setStickyEditing(id);
  ui.focus(null);
  ui.focusEdge(null);
  ui.closePopover();
  ui.announce(anchor === null ? 'Note added' : `Note added, pinned to ${anchor.title}`);
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
