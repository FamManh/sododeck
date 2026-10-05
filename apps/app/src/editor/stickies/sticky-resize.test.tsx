import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { cancelActiveGesture } from '../editing/drag-session';
import { applyStickyResize, endStickyResize, startStickyResize } from '../editing/sticky-resize';

const file = (): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [{ id: 'n', type: 'service', title: 'Card', position: { x: 400, y: 0 } }],
  stickies: [
    { id: 'a', text: 'Note A', position: { x: 0, y: 0 } },
    { id: 'b', text: 'Note B', position: { x: 0, y: 400 } },
    { id: 'folded', text: 'Folded', position: { x: 0, y: 800 }, collapsed: true },
    { id: 'locked', text: 'Locked', position: { x: 0, y: 900 }, locked: true },
  ],
});

const noMods = { shift: false, alt: false, mod: false };
const initialUi = useUiStore.getState();

function setup() {
  const doc = fromJSON(file());
  return { doc, editor: createEditor(doc) };
}
const stickyOf = (doc: ReturnType<typeof setup>['doc'], id: string) =>
  toJSON(doc).stickies.find((s) => s.id === id);

beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

describe('sticky resize (053 US2)', () => {
  it('resizes live from a corner, writing size once as one undo step', () => {
    const { doc, editor } = setup();
    const session = startStickyResize(editor, 'a', 'bottom-right');
    if (session === null) throw new Error('no session');
    expect(session.start).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    applyStickyResize(editor, session, { x: 0, y: 0, width: 240, height: 220 }, noMods, 1);
    // Live: the document already holds the size.
    expect(stickyOf(doc, 'a')?.size).toEqual({ width: 240, height: 220 });
    applyStickyResize(editor, session, { x: 0, y: 0, width: 280, height: 260 }, noMods, 1);
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')?.size).toEqual({ width: 280, height: 260 });
    expect(editor.undo()).toBe(true);
    expect(stickyOf(doc, 'a')?.size).toBeUndefined();
    expect(editor.undo()).toBe(false);
  });

  it('resizes from a side handle: only that axis changes', () => {
    const { doc, editor } = setup();
    const session = startStickyResize(editor, 'a', 'right');
    if (session === null) throw new Error('no session');
    applyStickyResize(editor, session, { x: 0, y: 0, width: 260, height: 500 }, noMods, 1);
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')?.size).toEqual({ width: 260, height: 200 });
  });

  it('moves the position too from a top-left handle', () => {
    const { doc, editor } = setup();
    const session = startStickyResize(editor, 'a', 'top-left');
    if (session === null) throw new Error('no session');
    applyStickyResize(editor, session, { x: -40, y: -24, width: 240, height: 224 }, noMods, 1);
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')).toMatchObject({
      position: { x: -40, y: -24 },
      size: { width: 240, height: 224 },
    });
  });

  it('stops at 96 × 96', () => {
    const { doc, editor } = setup();
    const session = startStickyResize(editor, 'a', 'bottom-right');
    if (session === null) throw new Error('no session');
    // ⌘: the neighbouring note's centre line (x 100) would otherwise catch the edge.
    applyStickyResize(
      editor,
      session,
      { x: 0, y: 0, width: 10, height: 20 },
      { ...noMods, mod: true },
      1,
    );
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')?.size).toEqual({ width: 96, height: 96 });
  });

  it('snaps a dragged edge to a neighbour, and ⌘ turns snapping off', () => {
    const snapped = setup();
    const near = startStickyResize(snapped.editor, 'a', 'bottom-right');
    if (near === null) throw new Error('no session');
    // The card's left edge is at x 400: 397 is within 6 px of it.
    applyStickyResize(snapped.editor, near, { x: 0, y: 0, width: 397, height: 200 }, noMods, 1);
    endStickyResize(snapped.editor, near);
    expect(stickyOf(snapped.doc, 'a')?.size?.width).toBe(400);

    const free = setup();
    const far = startStickyResize(free.editor, 'a', 'bottom-right');
    if (far === null) throw new Error('no session');
    applyStickyResize(
      free.editor,
      far,
      { x: 0, y: 0, width: 396, height: 200 },
      { ...noMods, mod: true },
      1,
    );
    endStickyResize(free.editor, far);
    expect(stickyOf(free.doc, 'a')?.size?.width).toBe(396);
  });

  it('Esc puts the note back and writes nothing', () => {
    const { doc, editor } = setup();
    const session = startStickyResize(editor, 'a', 'bottom-right');
    if (session === null) throw new Error('no session');
    applyStickyResize(editor, session, { x: 0, y: 0, width: 300, height: 300 }, noMods, 1);
    expect(cancelActiveGesture()).toBe(true);
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')?.size).toBeUndefined();
    expect(editor.undo()).toBe(false);
    expect(useUiStore.getState().canvasGesture).toBeNull();
  });

  it('resizes only the note whose handle is dragged, whatever else is selected', () => {
    const { doc, editor } = setup();
    useUiStore.getState().select({ stickies: ['a', 'b'] });
    const session = startStickyResize(editor, 'a', 'bottom-right');
    if (session === null) throw new Error('no session');
    applyStickyResize(editor, session, { x: 0, y: 0, width: 300, height: 300 }, noMods, 1);
    endStickyResize(editor, session);
    expect(stickyOf(doc, 'a')?.size).toEqual({ width: 300, height: 300 });
    expect(stickyOf(doc, 'b')?.size).toBeUndefined();
  });

  it('refuses a collapsed, a locked and a missing note', () => {
    const { editor } = setup();
    expect(startStickyResize(editor, 'folded', 'bottom-right')).toBeNull();
    expect(startStickyResize(editor, 'locked', 'bottom-right')).toBeNull();
    expect(startStickyResize(editor, 'nope', 'bottom-right')).toBeNull();
  });
});
