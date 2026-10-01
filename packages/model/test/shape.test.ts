import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createEditor, fromJSON, getObject, toJSON } from '../src';

const file: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 200, y: 0 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b' }],
};

function setup() {
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc) };
}

describe('setCardSize (017)', () => {
  it('sets, replaces and removes (null) a size', () => {
    const { doc, editor } = setup();
    editor.setCardSize('a', { width: 200, height: 72 });
    expect(getObject(doc, 'nodes', 'a')?.size).toEqual({ width: 200, height: 72 });
    editor.setCardSize('a', { width: 244, height: 80 });
    expect(getObject(doc, 'nodes', 'a')?.size).toEqual({ width: 244, height: 80 });
    editor.setCardSize('a', null);
    expect(getObject(doc, 'nodes', 'a')?.size).toBeUndefined();
  });

  it('is one undo step', () => {
    const { doc, editor } = setup();
    editor.setCardSize('a', { width: 200, height: 72 });
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')?.size).toBeUndefined();
  });

  it('joins an open gesture', () => {
    const { doc, editor } = setup();
    editor.beginGesture();
    editor.setCardSize('a', { width: 200, height: 72 });
    editor.setCardSize('a', { width: 244, height: 80 });
    editor.endGesture();
    expect(getObject(doc, 'nodes', 'a')?.size).toEqual({ width: 244, height: 80 });
    editor.undo();
    expect(getObject(doc, 'nodes', 'a')?.size).toBeUndefined();
  });

  it('rejects width <= 0', () => {
    const { editor } = setup();
    expect(() => {
      editor.setCardSize('a', { width: 0, height: 72 });
    }).toThrow();
    expect(() => {
      editor.setCardSize('a', { width: -10, height: 72 });
    }).toThrow();
  });
});

describe('setEdgeRoute (017)', () => {
  it('merges into an existing route', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { fromSide: 'right' });
    editor.setEdgeRoute('e', { toSide: 'left' });
    expect(getObject(doc, 'edges', 'e')?.route).toEqual({ fromSide: 'right', toSide: 'left' });
  });

  it('a null patch key clears that key', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { fromSide: 'right', toSide: 'left', offset: 40 });
    editor.setEdgeRoute('e', { fromSide: null });
    expect(getObject(doc, 'edges', 'e')?.route).toEqual({ toSide: 'left', offset: 40 });
  });

  it('offset: 0 is dropped', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { fromSide: 'right', toSide: 'left', offset: 40 });
    editor.setEdgeRoute('e', { offset: 0 });
    expect(getObject(doc, 'edges', 'e')?.route).toEqual({ fromSide: 'right', toSide: 'left' });
  });

  it('route is removed once no key is left', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { offset: 40 });
    editor.setEdgeRoute('e', { offset: null });
    expect(getObject(doc, 'edges', 'e')?.route).toBeUndefined();
  });

  it('a null patch removes the whole route', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { fromSide: 'right', toSide: 'left', offset: 40 });
    editor.setEdgeRoute('e', null);
    expect(getObject(doc, 'edges', 'e')?.route).toBeUndefined();
  });

  it('is one undo step', () => {
    const { doc, editor } = setup();
    editor.setEdgeRoute('e', { fromSide: 'right' });
    editor.undo();
    expect(getObject(doc, 'edges', 'e')?.route).toBeUndefined();
  });

  it('two docs synced through updates that change fromSide and offset concurrently keep both', () => {
    const docA = fromJSON(file);
    const editorA = createEditor(docA);
    editorA.setEdgeRoute('e', { fromSide: 'right', toSide: 'left' });

    const docB = new Y.Doc();
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    const editorB = createEditor(docB);

    editorA.setEdgeRoute('e', { offset: 40 });
    editorB.setEdgeRoute('e', { fromSide: 'top' });

    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    expect(getObject(docA, 'edges', 'e')?.route).toEqual({
      fromSide: 'top',
      toSide: 'left',
      offset: 40,
    });
    expect(toJSON(docA)).toEqual(toJSON(docB));
  });
});
