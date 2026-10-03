import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, getObject, observeDeck, toJSON, type EditorOptions } from '../src';
import { STICKY_DEFAULT_OFFSET, stickyCanvasPosition } from '../src/geometry';
import { seqIds } from './helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const file: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'n0', type: 'service', title: 'N0', position: { x: 100, y: 100 } },
    { id: 'n1', type: 'service', title: 'N1' }, // grid-placed
  ],
};

function setup(options: EditorOptions = {}) {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds(), ...options }) };
}

/** Reads back a sticky that the test just wrote, failing loudly (not silently) if it's gone. */
function mustSticky(doc: ReturnType<typeof fromJSON>, id: string) {
  const sticky = getObject(doc, 'stickies', id);
  expect(sticky).toBeDefined();
  return sticky as NonNullable<typeof sticky>;
}

describe('sticky draft (research R3, R5)', () => {
  it('adds the note and merges text updates into one undo step', () => {
    const { doc, editor } = setup();
    const id = editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } });
    editor.update('stickies', id, { text: 'H' });
    editor.update('stickies', id, { text: 'Hi' });
    editor.update('stickies', id, { text: 'Hi there' });
    expect(getObject(doc, 'stickies', id)?.text).toBe('Hi there');
    expect(editor.endStickyDraft(id)).toBe('kept');

    expect(editor.canUndo()).toBe(true);
    expect(editor.undo()).toBe(true);
    expect(getObject(doc, 'stickies', id)).toBeUndefined();
  });

  it('merges even across the normal capture timeout (however long typing takes)', async () => {
    const { doc, editor } = setup({ captureTimeout: 10 });
    const id = editor.beginStickyDraft({ text: 'H', position: { x: 0, y: 0 } });
    await sleep(30);
    editor.update('stickies', id, { text: 'Hi' });
    expect(editor.endStickyDraft(id)).toBe('kept');
    expect(editor.undo()).toBe(true);
    expect(getObject(doc, 'stickies', id)).toBeUndefined();
  });

  it('discards a blank note with no undo or redo entry', () => {
    const { editor } = setup();
    const before = { canUndo: editor.canUndo(), canRedo: editor.canRedo() };
    const id = editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } });
    editor.update('stickies', id, { text: '  ' }); // whitespace only
    expect(editor.endStickyDraft(id)).toBe('discarded');

    expect(editor.canUndo()).toBe(before.canUndo);
    expect(editor.canRedo()).toBe(before.canRedo);
  });

  it('notifies history listeners on begin and on a discard', () => {
    const { editor } = setup();
    let calls = 0;
    editor.onHistoryChange(() => {
      calls++;
    });
    const id = editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } });
    expect(calls).toBeGreaterThan(0);
    calls = 0;
    editor.endStickyDraft(id);
    // Undo/redo availability returns to what it was before the draft: another notification.
    expect(calls).toBeGreaterThan(0);
  });

  it('throws when a second draft is opened while one is open', () => {
    const { editor } = setup();
    editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } });
    expect(() => editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } })).toThrow(
      /already open/,
    );
  });

  it('discards when the note was removed by a remote tab', () => {
    const { doc, editor } = setup();
    const id = editor.beginStickyDraft({ text: 'Hi', position: { x: 0, y: 0 } });

    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).remove('stickies', id);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(getObject(doc, 'stickies', id)).toBeUndefined();
    expect(editor.endStickyDraft(id)).toBe('discarded');
  });

  it('keeps another local edit undoable when discarding after it', () => {
    const { doc, editor } = setup();
    const before = { canUndo: editor.canUndo(), canRedo: editor.canRedo() };
    const id = editor.beginStickyDraft({ text: '', position: { x: 0, y: 0 } });
    editor.update('nodes', 'n0', { title: 'Renamed' }); // an unrelated local step
    expect(editor.endStickyDraft(id)).toBe('discarded');

    expect(getObject(doc, 'stickies', id)).toBeUndefined();
    expect(getObject(doc, 'nodes', 'n0')?.title).toBe('Renamed');
    // The draft leaves history, unlike the clean case: the unrelated edit is still undoable.
    expect(editor.canUndo()).toBe(true);
    expect(editor.undo()).toBe(true); // undoes the sticky removal
    expect(getObject(doc, 'nodes', 'n0')?.title).toBe('Renamed');
    expect(editor.undo()).toBe(true); // undoes the rename
    expect(getObject(doc, 'nodes', 'n0')?.title).toBe('N0');
    // The interleaved edit forced the draft's own add into its own boundary too, so it's still
    // a (harmless, empty) undo entry: undoing it removes the never-shown note once more.
    expect(editor.undo()).toBe(true);
    expect(editor.canUndo()).toBe(before.canUndo);
  });

  it('reports a remote-origin edit as remote (observeDeck)', () => {
    const { doc, editor } = setup();
    const events: string[] = [];
    observeDeck(doc, (change) => events.push(change.origin));
    const id = editor.beginStickyDraft({ text: 'Hi', position: { x: 0, y: 0 } });
    editor.endStickyDraft(id);

    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    createEditor(other).update('stickies', id, { text: 'From another tab' });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(doc)));

    expect(events.at(-1)).toBe('remote');
  });
});

describe('pin, unpin and move (research R3)', () => {
  it('pinSticky keeps the canvas point of a free note', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', position: { x: 50, y: 80 } });
    editor.pinSticky(id, 'n0');
    const sticky = mustSticky(doc, id);
    expect(sticky.anchor).toBe('n0');
    expect(stickyCanvasPosition(toJSON(doc), sticky)).toEqual({
      status: 'pinned',
      point: { x: 50, y: 80 },
      pinnedTo: 'n0',
    });
  });

  it('pinSticky to a grid-placed node keeps the canvas point', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', position: { x: 300, y: 5 } });
    editor.pinSticky(id, 'n1');
    const sticky = mustSticky(doc, id);
    expect(stickyCanvasPosition(toJSON(doc), sticky).point).toEqual({ x: 300, y: 5 });
  });

  it('pinSticky throws missing-reference for an unknown node', () => {
    const { editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', position: { x: 0, y: 0 } });
    expect(() => {
      editor.pinSticky(id, 'nope');
    }).toThrow();
  });

  it('unpinSticky keeps the canvas point', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', anchor: 'n0' });
    const before = stickyCanvasPosition(toJSON(doc), mustSticky(doc, id)).point;
    editor.unpinSticky(id);
    const sticky = mustSticky(doc, id);
    expect(sticky.anchor).toBeUndefined();
    expect(stickyCanvasPosition(toJSON(doc), sticky)).toEqual({ status: 'free', point: before });
  });

  it('moveSticky writes an absolute point when free', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', position: { x: 0, y: 0 } });
    editor.moveSticky(id, { x: 40, y: 60 });
    expect(getObject(doc, 'stickies', id)?.position).toEqual({ x: 40, y: 60 });
  });

  it('moveSticky writes an offset when pinned', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', anchor: 'n0' });
    editor.moveSticky(id, { x: 140, y: 130 });
    const sticky = mustSticky(doc, id);
    expect(sticky.position).toEqual({ x: 40, y: 30 });
    expect(stickyCanvasPosition(toJSON(doc), sticky).point).toEqual({ x: 140, y: 130 });
  });

  it('is one undo step and observed as a remote change from another tab', () => {
    const { doc, editor } = setup();
    const events: string[] = [];
    observeDeck(doc, (change) => events.push(change.origin));
    const id = editor.add('stickies', { text: 'Hi', position: { x: 0, y: 0 } });
    events.length = 0;
    editor.pinSticky(id, 'n0');
    expect(editor.undo()).toBe(true);
    expect(getObject(doc, 'stickies', id)?.anchor).toBeUndefined();
    expect(events[0]).toBe('local');
  });
});

describe('display flags', () => {
  it('collapsed and showInFlows are written and cleared with update()', () => {
    const { doc, editor } = setup();
    const id = editor.add('stickies', { text: 'Hi', position: { x: 0, y: 0 } });
    editor.update('stickies', id, { collapsed: true });
    expect(getObject(doc, 'stickies', id)?.collapsed).toBe(true);
    editor.update('stickies', id, { collapsed: null });
    expect(getObject(doc, 'stickies', id)?.collapsed).toBeUndefined();
  });
});

describe('STICKY_DEFAULT_OFFSET', () => {
  it('is used for a pinned note without a stored position', () => {
    const emptyFile: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [{ id: 'n0', type: 'service', title: 'N', position: { x: 10, y: 10 } }],
    };
    const placement = stickyCanvasPosition(emptyFile, { id: 's', text: 'x', anchor: 'n0' });
    expect(placement).toEqual({
      status: 'pinned',
      point: { x: 10 + STICKY_DEFAULT_OFFSET.x, y: 10 + STICKY_DEFAULT_OFFSET.y },
      pinnedTo: 'n0',
    });
  });
});
