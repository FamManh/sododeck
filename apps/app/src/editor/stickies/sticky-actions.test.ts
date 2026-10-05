import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { NODE_SIZE } from '../canvas-geometry';
import { addNoteAt, finishDraft } from './sticky-actions';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const ui = () => useUiStore.getState();

function expectNoteId(id: string | null): string {
  if (id === null) throw new Error('Expected a sticky draft');
  return id;
}

describe('sticky actions', () => {
  it('starts a free or pinned draft, selects it, edits it and announces it', () => {
    const free = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: free.wrapper });
    let freeId: string | null = null;
    act(() => {
      freeId = addNoteAt(free.editor(), { x: 240, y: 140 });
    });
    const actualFreeId = expectNoteId(freeId);
    expect(readDeck(free.doc).stickies).toContainEqual({
      id: actualFreeId,
      text: '',
      position: { x: 240, y: 140 },
    });
    expect(ui().selection).toEqual({
      nodes: [],
      edges: [],
      groups: [],
      stickies: [actualFreeId],
    });
    expect(ui().stickyDraft).toBe(actualFreeId);
    expect(ui().stickyEditing).toBe(actualFreeId);
    expect(ui().announcement.text).toBe('Note added');

    const pinned = editorWrapper(
      deckOf({
        nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 80, y: 60 } }],
      }),
    );
    renderHook(() => null, { wrapper: pinned.wrapper });
    let pinnedId: string | null = null;
    act(() => {
      pinnedId = addNoteAt(pinned.editor(), {
        x: 80 + NODE_SIZE.width / 2,
        y: 60 + NODE_SIZE.height / 2,
      });
    });
    const actualPinnedId = expectNoteId(pinnedId);
    expect(readDeck(pinned.doc).stickies).toContainEqual({
      id: actualPinnedId,
      text: '',
      anchor: 'svc',
      position: { x: NODE_SIZE.width / 2, y: NODE_SIZE.height / 2 },
    });
    expect(ui().selection).toEqual({
      nodes: [],
      edges: [],
      groups: [],
      stickies: [actualPinnedId],
    });
    expect(ui().stickyDraft).toBe(actualPinnedId);
    expect(ui().stickyEditing).toBe(actualPinnedId);
    expect(ui().announcement.text).toBe('Note added, pinned to Order Service');
  });

  it('discards a blank draft with no undo entry and announces it', () => {
    const env = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: env.wrapper });
    const before = { canUndo: env.editor().canUndo(), canRedo: env.editor().canRedo() };
    let id: string | null = null;
    act(() => {
      id = addNoteAt(env.editor(), { x: 24, y: 32 });
    });
    const actualId = expectNoteId(id);

    act(() => {
      finishDraft(env.editor(), actualId);
    });

    expect(readDeck(env.doc).stickies).toEqual([]);
    expect(ui().selection).toEqual({ nodes: [], edges: [], groups: [], stickies: [] });
    expect(ui().stickyDraft).toBeNull();
    expect(ui().stickyEditing).toBeNull();
    expect(ui().announcement.text).toBe('Empty note removed');
    expect(env.editor().canUndo()).toBe(before.canUndo);
    expect(env.editor().canRedo()).toBe(before.canRedo);
  });

  it('keeps a draft with text as one undoable note', () => {
    const env = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: env.wrapper });
    let id: string | null = null;
    act(() => {
      id = addNoteAt(env.editor(), { x: 24, y: 32 });
      const actualId = expectNoteId(id);
      env.editor().update('stickies', actualId, { text: 'Remember retries' });
      finishDraft(env.editor(), actualId);
    });
    const actualId = expectNoteId(id);

    expect(readDeck(env.doc).stickies).toContainEqual({
      id: actualId,
      text: 'Remember retries',
      position: { x: 24, y: 32 },
    });
    expect(ui().stickyDraft).toBeNull();
    expect(ui().stickyEditing).toBeNull();
    expect(env.editor().canUndo()).toBe(true);

    act(() => {
      env.editor().undo();
    });
    expect(readDeck(env.doc).stickies).toEqual([]);
  });

  it('returns early in flow mode', () => {
    const env = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: env.wrapper });
    act(() => {
      ui().openFlow('order', 'o1');
    });

    let id: string | null = null;
    act(() => {
      id = addNoteAt(env.editor(), { x: 24, y: 32 });
    });

    expect(id).toBeNull();
    expect(readDeck(env.doc).stickies).toEqual([]);
  });

  describe('options (053 US3)', () => {
    const cardDeck = () =>
      deckOf({
        nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 80, y: 60 } }],
      });
    const overCard = { x: 80 + NODE_SIZE.width / 2, y: 60 + NODE_SIZE.height / 2 };

    it('with pin: false a note over a card stays free', () => {
      const env = editorWrapper(cardDeck());
      renderHook(() => null, { wrapper: env.wrapper });
      let id: string | null = null;
      act(() => {
        id = addNoteAt(env.editor(), overCard, { pin: false });
      });
      const sticky = readDeck(env.doc).stickies.find((s) => s.id === id);
      expect(sticky?.anchor).toBeUndefined();
      expect(sticky?.position).toEqual(overCard);
      expect(ui().stickyEditing).toBe(id);
      expect(ui().announcement.text).toBe('Note added');
    });

    it('uses the colour given, else the last one picked, and writes nothing for amber', () => {
      const env = editorWrapper(deckOf({}));
      renderHook(() => null, { wrapper: env.wrapper });
      const add = (point: { x: number; y: number }, colour?: 'green') => {
        const id = addNoteAt(env.editor(), point, colour === undefined ? {} : { colour });
        if (id !== null) env.editor().update('stickies', id, { text: 'x' });
        finishDraft(env.editor(), id);
        return id;
      };
      let first: string | null = null;
      let second: string | null = null;
      let third: string | null = null;
      act(() => {
        first = add({ x: 0, y: 0 }, 'green');
        ui().setLastStickyColour('blue');
        second = add({ x: 10, y: 0 });
        ui().setLastStickyColour('amber');
        third = add({ x: 20, y: 0 });
      });
      const colours = readDeck(env.doc).stickies.map((s) => [s.id, s.color]);
      expect(colours).toEqual([
        [first, 'green'],
        [second, 'blue'],
        [third, undefined],
      ]);
    });

    it('is one undo step with its colour', () => {
      const env = editorWrapper(deckOf({}));
      renderHook(() => null, { wrapper: env.wrapper });
      act(() => {
        const id = addNoteAt(env.editor(), { x: 0, y: 0 }, { colour: 'clay' });
        // A non-empty note is kept when the draft ends.
        if (id !== null) env.editor().update('stickies', id, { text: 'kept' });
        finishDraft(env.editor(), id);
      });
      expect(readDeck(env.doc).stickies).toHaveLength(1);
      act(() => {
        env.editor().undo();
      });
      expect(readDeck(env.doc).stickies).toHaveLength(0);
    });
  });
});
