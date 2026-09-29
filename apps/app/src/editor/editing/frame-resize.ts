/**
 * Resizing a group frame (016 research R5, FR-013–FR-015): one of the eight handles, ⇧ keeps the
 * ratio, ⌥ resizes from the centre, and the frame never gets smaller than its members plus
 * padding (and 160 × 96). Only the frame changes: no card moves and membership stays. The whole
 * resize is one undo step; Esc cancels it. The drawer's X / Y / W / H fields use `frameRect`.
 */
import type { DeckEditor } from '@sododeck/model';
import type { Frame, Id, SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../../state/ui-store';
import {
  COMPONENT_CARD_SIZE,
  displayPosition,
  GROUP_PADDING,
  groupBounds,
  type Rect,
} from '../canvas-geometry';
import { readViewState } from '../views/use-current-view';
import { setActiveGesture } from './drag-session';
import { clampFrame, resizeFrame, type Handle } from './resize-limits';

/**
 * What a frame must keep inside: its direct members at full detail and its nested frames (as the
 * view draws them). Null for an empty group.
 */
export function frameContent(deck: SododeckFile, groupId: Id): Rect | null {
  const rects: Rect[] = [];
  deck.nodes.forEach((node, index) => {
    if (node.group === groupId)
      rects.push({ ...displayPosition(node, index), ...COMPONENT_CARD_SIZE });
  });
  const bounds = groupBounds(deck, COMPONENT_CARD_SIZE);
  for (const group of deck.groups) {
    const rect = group.parent === groupId ? bounds.get(group.id) : undefined;
    if (rect !== undefined) rects.push(rect);
  }
  if (rects.length === 0) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return {
    x,
    y,
    width: Math.max(...rects.map((r) => r.x + r.width)) - x,
    height: Math.max(...rects.map((r) => r.y + r.height)) - y,
  };
}

const toFrame = (rect: Rect): Frame => ({
  position: { x: rect.x, y: rect.y },
  size: { width: rect.width, height: rect.height },
});

/** A frame typed in the drawer, clamped like a handle drag would be (FR-044). */
export function frameRect(deck: SododeckFile, groupId: Id, rect: Rect): Frame {
  return toFrame(clampFrame(rect, frameContent(deck, groupId), GROUP_PADDING));
}

export interface ResizeSession {
  groupId: Id;
  viewId: Id;
  handle: Handle;
  start: Rect;
  content: Rect | null;
  cancelled: boolean;
}

/** Starts a resize from `handle`: one gesture until `endResize`. Null for a frame not drawn. */
export function startResize(editor: DeckEditor, groupId: Id, handle: Handle): ResizeSession | null {
  const view = readViewState(editor.doc);
  const start = groupBounds(view.deck, COMPONENT_CARD_SIZE).get(groupId);
  if (start === undefined) return null;
  const session: ResizeSession = {
    groupId,
    viewId: view.view.id,
    handle,
    start,
    content: frameContent(view.deck, groupId),
    cancelled: false,
  };
  editor.beginGesture();
  const ui = useUiStore.getState();
  ui.setCanvasGesture('resize');
  setActiveGesture({
    cancel: () => {
      if (session.cancelled) return false;
      session.cancelled = true;
      editor.cancelGesture();
      ui.setCanvasGesture(null);
      ui.announce('Cancelled');
      return true;
    },
    arrow: () => false,
  });
  return session;
}

/** One frame of the resize: the pointer's proposal, clamped, written to the current view. */
export function applyResize(
  editor: DeckEditor,
  session: ResizeSession,
  proposed: Rect,
  mods: { shift: boolean; alt: boolean },
): void {
  if (session.cancelled) return;
  const rect = resizeFrame({
    start: session.start,
    proposed,
    handle: session.handle,
    content: session.content,
    padding: GROUP_PADDING,
    keepRatio: mods.shift,
    fromCentre: mods.alt,
  });
  editor.setGroupFrames(session.viewId, { [session.groupId]: toFrame(rect) });
}

export function endResize(editor: DeckEditor, session: ResizeSession): void {
  setActiveGesture(null);
  const ui = useUiStore.getState();
  if (ui.canvasGesture === 'resize') ui.setCanvasGesture(null);
  if (!session.cancelled) editor.endGesture();
}
