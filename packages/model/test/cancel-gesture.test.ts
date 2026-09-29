import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { createEditor, fromJSON, getObject, toJSON } from '../src';

const file: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 100, y: 0 } },
  ],
};

function setup() {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc) };
}

describe('cancelGesture (016 research R14)', () => {
  it('restores the document and leaves no undo entry', () => {
    const { doc, editor } = setup();
    editor.update('nodes', 'b', { title: 'Before' });
    const before = toJSON(doc);
    editor.beginGesture();
    editor.moveInView('system', { a: { x: 10, y: 10 } });
    editor.moveInView('system', { a: { x: 20, y: 30 } });
    editor.cancelGesture();
    expect(toJSON(doc)).toEqual(before);
    expect(editor.canRedo()).toBe(false);
    // The earlier edit is still the last undo step.
    expect(editor.undo()).toBe(true);
    expect(getObject(doc, 'nodes', 'b')?.title).toBe('B');
    expect(editor.canUndo()).toBe(false);
  });

  it('keeps the redo stack from before the gesture', () => {
    const { doc, editor } = setup();
    editor.update('nodes', 'b', { title: 'Renamed' });
    editor.undo();
    expect(editor.canRedo()).toBe(true);
    editor.beginGesture();
    editor.moveInView('system', { a: { x: 10, y: 10 } });
    editor.cancelGesture();
    expect(getObject(doc, 'nodes', 'a')?.position).toEqual({ x: 0, y: 0 });
    expect(editor.canUndo()).toBe(false);
    expect(editor.redo()).toBe(true);
    expect(getObject(doc, 'nodes', 'b')?.title).toBe('Renamed');
  });

  it('clears the redo stack when the gesture ends normally', () => {
    const { editor } = setup();
    editor.update('nodes', 'b', { title: 'Renamed' });
    editor.undo();
    editor.beginGesture();
    editor.moveInView('system', { a: { x: 10, y: 10 } });
    editor.endGesture();
    expect(editor.canRedo()).toBe(false);
    expect(editor.canUndo()).toBe(true);
  });

  it('is a no-op for a gesture without edits, and ends nested gestures', () => {
    const { editor } = setup();
    editor.beginGesture();
    editor.beginGesture();
    editor.cancelGesture();
    expect(editor.canUndo()).toBe(false);
    expect(() => {
      editor.endGesture();
    }).toThrow(/without beginGesture/);
  });

  it('throws without an open gesture', () => {
    const { editor } = setup();
    expect(() => {
      editor.cancelGesture();
    }).toThrow(/without beginGesture/);
  });

  it('starts a fresh step for the next edit', () => {
    const { doc, editor } = setup();
    editor.beginGesture();
    editor.moveInView('system', { a: { x: 10, y: 10 } });
    editor.cancelGesture();
    editor.moveInView('system', { b: { x: 1, y: 1 } });
    editor.moveInView('system', { b: { x: 2, y: 2 } });
    editor.undo();
    expect(getObject(doc, 'nodes', 'b')?.position).toEqual({ x: 100, y: 0 });
  });
});
