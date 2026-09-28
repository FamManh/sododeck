import { nodeCanvasPosition, type DeckEditor, type Point } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';
import { useEffect } from 'react';

import { useEditor } from '../../model/use-editor';
import { readViewState } from '../views/use-current-view';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { NODE_SIZE } from '../canvas-geometry';

const normalizePoint = ({ x, y }: Point): Point => ({
  x: Number.isFinite(x) ? Math.round(x) : 0,
  y: Number.isFinite(y) ? Math.round(y) : 0,
});

function nodeAtPoint(deck: SododeckFile, point: Point): SododeckFile['nodes'][number] | null {
  for (const node of deck.nodes) {
    const position = nodeCanvasPosition(deck, node.id);
    if (position === null) continue;
    const inside =
      point.x >= position.x &&
      point.x <= position.x + NODE_SIZE.width &&
      point.y >= position.y &&
      point.y <= position.y + NODE_SIZE.height;
    if (inside) return node;
  }
  return null;
}

export function notesAreReadOnly(): boolean {
  return document.querySelector('[role="alertdialog"]') !== null;
}

export function addNoteAt(editor: DeckEditor, point: Point): Id | null {
  if (notesAreReadOnly() || isFlowMode(useUiStore.getState())) return null;
  // Offsets are measured where the component is drawn in the current view (011).
  const deck = readViewState(editor.doc).deck;
  const at = normalizePoint(point);
  const anchor = nodeAtPoint(deck, at);
  const id = editor.beginStickyDraft(
    anchor === null
      ? { text: '', position: at }
      : {
          text: '',
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
