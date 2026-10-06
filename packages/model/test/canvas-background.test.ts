import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';

import {
  canvasBackgroundOf,
  createEditor,
  DeckEditError,
  fromJSON,
  serializeDeck,
  toJSON,
} from '../src';
import { expectConverged, expectValid, seqIds, sync, twoDocs } from './helpers';

const empty = (): SododeckFile => emptySododeckFile();

function setup(file: SododeckFile = empty()) {
  const doc = fromJSON(file);
  const editor = createEditor(doc, { newId: seqIds() });
  return { doc, editor, deck: () => toJSON(doc) };
}

describe('canvas background (ADR 0044)', () => {
  it('reads dots and the theme colour when absent, and the stored keys otherwise', () => {
    expect(canvasBackgroundOf(empty())).toEqual({ pattern: 'dots', color: undefined });
    expect(
      canvasBackgroundOf({ ...empty(), canvasBackground: { pattern: 'grid', color: '#1f2a44' } }),
    ).toEqual({ pattern: 'grid', color: '#1f2a44' });
    expect(canvasBackgroundOf({ ...empty(), canvasBackground: { pattern: 'none' } })).toEqual({
      pattern: 'none',
      color: undefined,
    });
  });

  it('round-trips every key losslessly', () => {
    const file: SododeckFile = {
      ...empty(),
      canvasBackground: { pattern: 'grid', color: '#f4efe6' },
    };
    expect(serializeDeck(toJSON(fromJSON(file)))).toBe(serializeDeck(file));
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(fromJSON(file)));
    expect(serializeDeck(toJSON(replica))).toBe(serializeDeck(file));
  });

  it('drops a hand-written empty object', () => {
    expect(toJSON(fromJSON({ ...empty(), canvasBackground: {} }))).not.toHaveProperty(
      'canvasBackground',
    );
  });

  it('writes keys in one undo step and removes the object when reset', () => {
    const { doc, editor, deck } = setup();
    const before = serializeDeck(deck());
    editor.setCanvasBackground({ pattern: 'grid', color: '#112233' });
    expect(deck().canvasBackground).toEqual({ pattern: 'grid', color: '#112233' });
    expectValid(doc);
    expect(editor.undo()).toBe(true);
    expect(serializeDeck(deck())).toBe(before);
    expect(editor.redo()).toBe(true);
    editor.setCanvasBackground({ color: null });
    expect(deck().canvasBackground).toEqual({ pattern: 'grid' });
    editor.setCanvasBackground({ pattern: null });
    expect(deck()).not.toHaveProperty('canvasBackground');
  });

  it('attaches the map on the first write of a document stored before it existed', () => {
    const { doc, editor, deck } = setup();
    doc.getMap('meta').delete('canvasBackground');
    editor.setCanvasBackground({ pattern: 'none' });
    expect(deck().canvasBackground).toEqual({ pattern: 'none' });
  });

  it('does nothing for defaults and refuses bad values', () => {
    const { editor, deck } = setup();
    const before = serializeDeck(deck());
    editor.setCanvasBackground({ pattern: null, color: null });
    expect(editor.canUndo()).toBe(false);
    for (const patch of [
      { pattern: 'dots' },
      { color: 'beige' },
      { color: '#ABCDEF' },
      { opacity: 1 },
    ]) {
      expect(() => {
        editor.setCanvasBackground(patch as never);
      }).toThrow(DeckEditError);
    }
    expect(serializeDeck(deck())).toBe(before);
  });

  it('keeps both tabs’ keys when each sets a different one', () => {
    const { a, b } = twoDocs(empty());
    a.editor.setCanvasBackground({ pattern: 'grid' });
    b.editor.setCanvasBackground({ color: '#0a0b0c' });
    sync(a, b);
    expectConverged(a, b);
    expect(toJSON(a.doc).canvasBackground).toEqual({ pattern: 'grid', color: '#0a0b0c' });
  });
});
