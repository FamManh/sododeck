/**
 * ⌥ arrow nudges (016 research R8, FR-024): 1 px, or 10 px with ⇧. A burst of nudges is one undo
 * step; it ends after 1 s without a nudge, on any other key or on a pointer down, and then says
 * how far the selection moved. Selected groups move with their whole subtree.
 */
import { viewNodePosition, type DeckEditor } from '@sododeck/model';
import type { Frame, Id } from '@sododeck/schema';
import { useEffect, useMemo } from 'react';

import { useEditor } from '../../model/use-editor';
import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { displayPosition, groupBounds, type Point } from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { groupSubtree } from './subtree';

/** How long a burst stays open after the last nudge. */
export const NUDGE_IDLE_MS = 1000;

const ARROWS: Readonly<Record<string, Point>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** "30 px right", "10 px up", "30 px right and 10 px down". */
export function nudgeDistance(total: Point): string {
  const parts: string[] = [];
  if (total.x !== 0)
    parts.push(`${String(Math.abs(total.x))} px ${total.x > 0 ? 'right' : 'left'}`);
  if (total.y !== 0) parts.push(`${String(Math.abs(total.y))} px ${total.y > 0 ? 'down' : 'up'}`);
  return parts.join(' and ');
}

/** Moves the selection (and selected groups' subtrees) by a delta in the current view. */
function moveSelection(editor: DeckEditor, delta: Point): number {
  const { selection } = useUiStore.getState();
  const deck = readDeck(editor.doc);
  const view = readViewState(editor.doc);
  const tree = groupSubtree(deck, selection.groups);
  const ids = new Set([...selection.nodes, ...tree.nodes]);
  const positions: Record<Id, Point> = {};
  deck.nodes.forEach((node, index) => {
    if (!ids.has(node.id)) return;
    const at = viewNodePosition(view.view, node) ?? displayPosition(node, index);
    positions[node.id] = { x: at.x + delta.x, y: at.y + delta.y };
  });
  const bounds = groupBounds(view.deck, 'component');
  const frames: Record<Id, Frame> = {};
  for (const id of tree.groups) {
    const rect = bounds.get(id);
    if (rect === undefined) continue;
    frames[id] = {
      position: { x: rect.x + delta.x, y: rect.y + delta.y },
      size: { width: rect.width, height: rect.height },
    };
  }
  if (Object.keys(positions).length + Object.keys(frames).length === 0) return 0;
  editor.batch(() => {
    if (Object.keys(positions).length > 0) editor.moveInView(view.view.id, positions);
    if (Object.keys(frames).length > 0) editor.setGroupFrames(view.view.id, frames);
  });
  return ids.size;
}

export interface Nudger {
  /** Handles ⌥(⇧) arrow; returns whether it nudged. */
  key: (
    event: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'>,
  ) => boolean;
  /** Ends the open burst (another key, a pointer down, the idle timer). */
  end: () => void;
}

export function createNudger(editor: DeckEditor): Nudger {
  let open = false;
  let total: Point = { x: 0, y: 0 };
  let moved = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const end = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!open) return;
    open = false;
    editor.endGesture();
    if (moved > 0 && (total.x !== 0 || total.y !== 0)) {
      useUiStore
        .getState()
        .announce(
          `Moved ${String(moved)} ${moved === 1 ? 'component' : 'components'} ${nudgeDistance(total)}`,
        );
    }
  };

  const key: Nudger['key'] = (event) => {
    const direction = ARROWS[event.key];
    if (direction === undefined || !event.altKey || event.metaKey || event.ctrlKey) return false;
    const ui = useUiStore.getState();
    if (isFlowMode(ui) || ui.flowSession !== null) return false;
    if (ui.selection.nodes.length + ui.selection.groups.length === 0) return false;
    const step = event.shiftKey ? 10 : 1;
    const delta = { x: direction.x * step, y: direction.y * step };
    if (!open) {
      editor.beginGesture();
      open = true;
      total = { x: 0, y: 0 };
    }
    moved = moveSelection(editor, delta);
    total = { x: total.x + delta.x, y: total.y + delta.y };
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(end, NUDGE_IDLE_MS);
    return true;
  };

  return { key, end };
}

/** The canvas's nudger; any other key or a pointer down ends its burst. */
export function useNudge(): Nudger {
  const editor = useEditor();
  const nudger = useMemo(() => createNudger(editor), [editor]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key in ARROWS && event.altKey) return;
      // Modifier presses on their own keep the burst (⇧ between nudges).
      if (['Alt', 'Shift', 'Meta', 'Control'].includes(event.key)) return;
      nudger.end();
    };
    const onPointer = () => {
      nudger.end();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
      nudger.end();
    };
  }, [nudger]);
  return nudger;
}
