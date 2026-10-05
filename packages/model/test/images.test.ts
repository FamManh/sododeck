import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  createEditor,
  DeckEditError,
  fromJSON,
  getObject,
  loadDeck,
  serializeDeck,
  toJSON,
} from '../src';
import { expectValid, readExample, reopen } from './helpers';
import { newImage, picture, setupDeck } from './image-helpers';

describe('images (055)', () => {
  it('adds N images in one undo step, on top, with the picture facts written once per id', () => {
    const { doc, editor } = setupDeck();
    const same = newImage(1);
    const ids = editor.addImages([same, { ...same, position: { x: 500, y: 0 } }, newImage(2)]);
    expect(ids).toEqual(['img-0', 'img-1', 'img-2']);
    const file = toJSON(doc);
    expect(file.images?.map((i) => i.id)).toEqual(ids);
    // Ranks sit above the 3 cards, in the order given.
    expect(file.images?.map((i) => i.z)).toEqual([3, 4, 5]);
    expect(Object.keys(file.assets ?? {})).toHaveLength(2);
    expectValid(doc);

    editor.undo();
    expect(toJSON(doc).images).toBeUndefined();
    expect(toJSON(doc).assets).toBeUndefined();
    editor.redo();
    expect(toJSON(doc).images?.map((i) => i.id)).toEqual(ids);
    expect(Object.keys(toJSON(doc).assets ?? {})).toHaveLength(2);
  });

  it('keeps the stored facts of a picture that is already known', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1)]);
    const changed = { ...newImage(1), meta: { ...picture(1).meta, name: 'other.png' } };
    editor.addImages([changed]);
    expect(Object.values(toJSON(doc).assets ?? {})[0]?.name).toBe('p1.png');
  });

  it('refuses a bad size, an unknown group and a bad picture id, writing nothing', () => {
    const { doc, editor } = setupDeck();
    expect(() => editor.addImages([newImage(1, { size: { width: 8, height: 60 } })])).toThrow(
      DeckEditError,
    );
    expect(() => editor.addImages([newImage(1, { group: 'nope' })])).toThrow(DeckEditError);
    expect(() => editor.addImages([{ ...newImage(1), asset: 'abc' }])).toThrow(DeckEditError);
    expect(toJSON(doc).images).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
  });

  it('writes no images rows and no meta.assets for a deck without images, byte-identical', async () => {
    const file = await readExample('flow-and-rule.sododeck.json');
    const doc = fromJSON(file);
    expect(doc.getMap('images').size).toBe(0);
    expect(doc.getMap('meta').has('assets')).toBe(false);
    expect(serializeDeck(doc)).toBe(serializeDeck(file));
    expect(toJSON(doc)).not.toHaveProperty('images');
    expect(toJSON(doc)).not.toHaveProperty('assets');
  });

  it('round-trips the full example with one picture of each of the six types, byte for byte', async () => {
    const full = await readExample('full.sododeck.json');
    expect(new Set(Object.values(full.assets ?? {}).map((a) => a.type)).size).toBe(6);
    const { doc, bytes, problems } = loadDeck(full);
    expect(problems).toEqual([]);
    expect(bytes.size).toBe(6);
    expect(serializeDeck(doc, bytes)).toBe(serializeDeck(full));
    expect(reopen(full)).toEqual(full);
    // The document itself holds no picture bytes.
    expect(JSON.stringify(toJSON(doc).assets)).not.toContain('iVBOR');
    for (const asset of Object.values(toJSON(doc).assets ?? {})) expect(asset.data).toBe('');
  });

  it('moves, resizes and edits text in one undo step each', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.moveImage(id, { x: 7, y: 9 });
    editor.setImageSize(id, { width: 200, height: 10 });
    editor.setImageText(id, { alt: 'Wireframe', caption: 'v2' });
    expect(getObject(doc, 'images', id)).toMatchObject({
      position: { x: 7, y: 9 },
      // Clamped to 32 px on the short side.
      size: { width: 200, height: 32 },
      alt: 'Wireframe',
      caption: 'v2',
    });
    editor.undo();
    expect(getObject(doc, 'images', id)).not.toHaveProperty('alt');
    editor.undo();
    expect(getObject(doc, 'images', id)?.size).toEqual({ width: 100, height: 60 });
    editor.undo();
    expect(getObject(doc, 'images', id)?.position).toEqual({ x: 10, y: 10 });
    expectValid(doc);
  });

  it('clears alt and caption with null or an empty string, and ignores no-ops', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1, { alt: 'a', caption: 'c' })]);
    editor.setImageText(id, { alt: '', caption: null });
    expect(getObject(doc, 'images', id)).not.toHaveProperty('alt');
    expect(getObject(doc, 'images', id)).not.toHaveProperty('caption');
    const before = editor.canUndo();
    editor.setImageText(id, { alt: null });
    editor.setImageSize(id, { width: 100, height: 60 });
    editor.moveImage(id, { x: 10, y: 10 });
    expect(editor.canUndo()).toBe(before);
  });

  it('keeps unknown optional data of an image through a round trip', () => {
    const p = picture(4);
    const file = {
      ...toJSON(setupDeck().doc),
      images: [{ id: 'i', asset: p.id, position: { x: 1, y: 2 }, size: { width: 40, height: 40 } }],
      assets: { [p.id]: { ...p.meta, data: p.data } },
    };
    expect(reopen(file)).toEqual(file);
  });

  it('puts an image in a group and out again, one step each', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1)]);
    editor.setImageGroup(id, 'g');
    expect(getObject(doc, 'images', id)?.group).toBe('g');
    editor.setImageGroup(id, null);
    expect(getObject(doc, 'images', id)).not.toHaveProperty('group');
    expect(() => {
      editor.setImageGroup(id, 'nope');
    }).toThrow(DeckEditError);
    editor.undo();
    expect(getObject(doc, 'images', id)?.group).toBe('g');
  });

  it('assigns an image the id prefix img', () => {
    const doc = fromJSON(toJSON(setupDeck().doc));
    const editor = createEditor(doc);
    const [id = ''] = editor.addImages([newImage(1)]);
    expect(id).toMatch(/^img-[0-9a-z]{10}$/);
  });

  it('replicates images and their picture facts to another document', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1), newImage(2)]);
    const replica = new Y.Doc();
    Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc));
    expect(toJSON(replica)).toEqual(toJSON(doc));
    expect(serializeDeck(replica)).toBe(serializeDeck(doc));
  });
});
