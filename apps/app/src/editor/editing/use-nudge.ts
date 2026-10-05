/**
 * ⌥ arrow nudges (016 research R8, FR-024): 1 px, or 10 px with ⇧. A burst of nudges is one undo
 * step; it ends after 1 s without a nudge, on any other key or on a pointer down, and then says
 * how far the selection moved. Selected groups move with their whole subtree.
 */
import { isLocked, viewNodePosition, type DeckEditor } from '@sododeck/model';
import type { Frame, Id } from '@sododeck/schema';
import { useEffect, useMemo } from 'react';

import { useEditor } from '../../model/use-editor';
import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { displayPosition, groupBounds, type Point } from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { lockedGroupIds } from '../group-lock';
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
  // A locked group never moves either (054).
  const lockedGroups = lockedGroupIds(deck);
  const tree = groupSubtree(
    deck,
    selection.groups.filter((id) => !lockedGroups.has(id)),
  );
  // Locked cards never move (043 FR-024); a group still carries its members.
  const locked = new Set(deck.nodes.filter(isLocked).map((node) => node.id));
  const ids = new Set([...selection.nodes.filter((id) => !locked.has(id)), ...tree.nodes]);
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

export interface Burst {
  /** True while a burst (and its undo step) is open. */
  isOpen: () => boolean;
  /** One step: opens the burst (calling `onFirst`) if it wasn't already, then calls `onStep`. */
  step: () => void;
  /** Closes the open burst now (calling `onEnd`), or does nothing if it's already closed. */
  end: () => void;
}

/**
 * A keyboard repeat that is one undo step until the keys stop coming (017 R9): `onFirst` opens
 * the step, `onStep` runs on every key (including the first), `onEnd` closes it — on a 1 s idle
 * timeout, another key, or a pointer down. Shared by the arrow nudge, the resize keys and the
 * segment-move keys.
 */
export function createBurst(onFirst: () => void, onStep: () => void, onEnd: () => void): Burst {
  let open = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const end = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (!open) return;
    open = false;
    onEnd();
  };

  const step = () => {
    if (!open) {
      open = true;
      onFirst();
    }
    onStep();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(end, NUDGE_IDLE_MS);
  };

  return { isOpen: () => open, step, end };
}

export function createNudger(editor: DeckEditor): Nudger {
  let total: Point = { x: 0, y: 0 };
  let moved = 0;
  let pending: Point = { x: 0, y: 0 };

  const burst = createBurst(
    () => {
      editor.beginGesture();
      total = { x: 0, y: 0 };
    },
    () => {
      moved = moveSelection(editor, pending);
      total = { x: total.x + pending.x, y: total.y + pending.y };
    },
    () => {
      editor.endGesture();
      if (moved > 0 && (total.x !== 0 || total.y !== 0)) {
        useUiStore
          .getState()
          .announce(
            `Moved ${String(moved)} ${moved === 1 ? 'component' : 'components'} ${nudgeDistance(total)}`,
          );
      }
    },
  );
  const end = burst.end;

  const key: Nudger['key'] = (event) => {
    const direction = ARROWS[event.key];
    if (direction === undefined || !event.altKey || event.metaKey || event.ctrlKey) return false;
    const ui = useUiStore.getState();
    if (isFlowMode(ui) || ui.flowSession !== null) return false;
    if (ui.selection.nodes.length + ui.selection.groups.length === 0) return false;
    const step = event.shiftKey ? 10 : 1;
    pending = { x: direction.x * step, y: direction.y * step };
    burst.step();
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
