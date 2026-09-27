import { readDeck } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { deckOf, editorWrapper } from '../../test/render-canvas';
import { NODE_SIZE } from '../canvas-geometry';
import { addNoteAt, finishDraft } from './sticky-actions';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const ui = () => useUiStore.getState();

describe('sticky actions', () => {
  it('starts a free or pinned draft, selects it, edits it and announces it', () => {
    const free = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: free.wrapper });
    let freeId = '';
    act(() => {
      freeId = addNoteAt(free.editor(), { x: 240, y: 140 });
    });
    expect(readDeck(free.doc).stickies).toContainEqual({
      id: freeId,
      text: '',
      position: { x: 240, y: 140 },
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], stickies: [freeId] });
    expect(ui().stickyDraft).toBe(freeId);
    expect(ui().stickyEditing).toBe(freeId);
    expect(ui().announcement.text).toBe('Note added');

    const pinned = editorWrapper(
      deckOf({
        nodes: [{ id: 'svc', type: 'service', title: 'Order Service', position: { x: 80, y: 60 } }],
      }),
    );
    renderHook(() => null, { wrapper: pinned.wrapper });
    let pinnedId = '';
    act(() => {
      pinnedId = addNoteAt(pinned.editor(), {
        x: 80 + NODE_SIZE.width / 2,
        y: 60 + NODE_SIZE.height / 2,
      });
    });
    expect(readDeck(pinned.doc).stickies).toContainEqual({
      id: pinnedId,
      text: '',
      anchor: 'svc',
      position: { x: NODE_SIZE.width / 2, y: NODE_SIZE.height / 2 },
    });
    expect(ui().selection).toEqual({ nodes: [], edges: [], stickies: [pinnedId] });
    expect(ui().stickyDraft).toBe(pinnedId);
    expect(ui().stickyEditing).toBe(pinnedId);
    expect(ui().announcement.text).toBe('Note added, pinned to Order Service');
  });

  it('discards a blank draft with no undo entry and announces it', () => {
    const env = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: env.wrapper });
    const before = { canUndo: env.editor().canUndo(), canRedo: env.editor().canRedo() };
    let id = '';
    act(() => {
      id = addNoteAt(env.editor(), { x: 24, y: 32 });
    });

    act(() => {
      finishDraft(env.editor(), id);
    });

    expect(readDeck(env.doc).stickies).toEqual([]);
    expect(ui().selection).toEqual({ nodes: [], edges: [], stickies: [] });
    expect(ui().stickyDraft).toBeNull();
    expect(ui().stickyEditing).toBeNull();
    expect(ui().announcement.text).toBe('Empty note removed');
    expect(env.editor().canUndo()).toBe(before.canUndo);
    expect(env.editor().canRedo()).toBe(before.canRedo);
  });

  it('keeps a draft with text as one undoable note', () => {
    const env = editorWrapper(deckOf({}));
    renderHook(() => null, { wrapper: env.wrapper });
    let id = '';
    act(() => {
      id = addNoteAt(env.editor(), { x: 24, y: 32 });
      env.editor().update('stickies', id, { text: 'Remember retries' });
      finishDraft(env.editor(), id);
    });

    expect(readDeck(env.doc).stickies).toContainEqual({
      id,
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
});
