import { describe, expect, it } from 'vitest';

import { createEditor, DeckEditError, loadDeck, serializeDeck, toJSON } from '../src';
import { seqIds } from './helpers';
import { picture, newImage, setupDeck } from './image-helpers';

function refused(run: () => void, code: DeckEditError['code']): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DeckEditError);
    expect((error as DeckEditError).code).toBe(code);
    return;
  }
  throw new Error(`expected a ${code} refusal`);
}

/** A deck with one picture on the canvas, and its id. */
function withPicture() {
  const p = picture(1);
  const { doc, editor } = setupDeck();
  editor.addImages([newImage(1)]);
  return { doc, editor, p, bytes: new Map([[p.id, p.bytes]]) };
}

describe('setPicturePath (067)', () => {
  it('writes the path into meta.assets, and the file then has the path and no data', () => {
    const { doc, editor, p, bytes } = withPicture();
    editor.setPicturePath(p.id, 'assets/a.png');
    expect(toJSON(doc).assets?.[p.id]?.path).toBe('assets/a.png');
    const saved = JSON.parse(serializeDeck(doc, bytes)) as {
      assets: Record<string, Record<string, unknown>>;
    };
    const entry = saved.assets[p.id] ?? {};
    expect(entry.path).toBe('assets/a.png');
    expect(entry).not.toHaveProperty('data');
  });

  it('round-trips: loading the saved text gives an equal deck', () => {
    const { doc, editor, p, bytes } = withPicture();
    editor.setPicturePath(p.id, 'assets/a.png');
    const text = serializeDeck(doc, bytes);
    const loaded = loadDeck(JSON.parse(text));
    expect(toJSON(loaded.doc)).toEqual(toJSON(doc));
    expect(serializeDeck(loaded.doc, loaded.bytes)).toBe(text);
  });

  it('is never an undo step: the only step is the one that added the picture', () => {
    const { doc, editor, p } = withPicture();
    editor.setPicturePath(p.id, 'assets/a.png');
    editor.setPicturePath(p.id, null);
    editor.setPicturePath(p.id, 'assets/b.png');
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).images ?? []).toEqual([]);
    expect(editor.canUndo()).toBe(false);
  });

  it('does not end a typing burst: a path written between two keystrokes keeps one undo step', () => {
    const { doc, editor: setup, p } = withPicture();
    const editor = createEditor(doc, { newId: seqIds() });
    editor.updateMeta({ name: 'A' });
    setup.setPicturePath(p.id, 'assets/a.png');
    editor.updateMeta({ name: 'AB' });
    expect(editor.undo()).toBe(true);
    expect(toJSON(doc).name).toBeUndefined();
    expect(toJSON(doc).assets?.[p.id]?.path).toBe('assets/a.png');
    expect(editor.canUndo()).toBe(false);
  });

  it('writes nothing when the value is equal', () => {
    const { doc, editor, p } = withPicture();
    editor.setPicturePath(p.id, 'assets/a.png');
    let updates = 0;
    doc.on('update', () => {
      updates += 1;
    });
    editor.setPicturePath(p.id, 'assets/a.png');
    expect(updates).toBe(0);
  });

  it('refuses an invalid path as invalid, and an unknown picture as not-found', () => {
    const { editor, p } = withPicture();
    refused(() => {
      editor.setPicturePath(p.id, '/abs.png');
    }, 'invalid');
    refused(() => {
      editor.setPicturePath(p.id, 'a\\b.png');
    }, 'invalid');
    refused(() => {
      editor.setPicturePath('f'.repeat(64), 'assets/a.png');
    }, 'not-found');
  });

  it('removes the path with null', () => {
    const { doc, editor, p } = withPicture();
    editor.setPicturePath(p.id, 'assets/a.png');
    editor.setPicturePath(p.id, null);
    expect(toJSON(doc).assets?.[p.id]).not.toHaveProperty('path');
  });
});
