import { describe, expect, it } from 'vitest';

import { emptySododeckFile, type Image, type SododeckFile } from '@sododeck/schema';

import {
  DeckEditError,
  createEditor,
  getObject,
  loadDeck,
  serializeDeck,
  toJSON,
  type NewImage,
} from '../src';
import { expectValid, seqIds } from './helpers';
import { newImage, picture, setupDeck } from './image-helpers';

/** A 400 × 200 picture drawn at scale 1 at the origin. */
function wide(seed: number, extra: Partial<NewImage> = {}): NewImage {
  return newImage(seed, {
    meta: { ...picture(seed).meta, width: 400, height: 200 },
    position: { x: 0, y: 0 },
    size: { width: 400, height: 200 },
    ...extra,
  });
}

const RIGHT = { x: 0.5, y: 0, width: 0.5, height: 1 };

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

describe('crop and flip (057)', () => {
  it('writes crop, size and position in one undo step, keeping the scale', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(id, RIGHT);
    const image = getObject(doc, 'images', id);
    expect(image?.crop).toEqual(RIGHT);
    expect(image?.size).toEqual({ width: 200, height: 200 });
    expect(image?.position).toEqual({ x: 200, y: 0 });
    expectValid(doc);

    editor.undo();
    const back = getObject(doc, 'images', id);
    expect(back?.crop).toBeUndefined();
    expect(back?.size).toEqual({ width: 400, height: 200 });
    expect(back?.position).toEqual({ x: 0, y: 0 });
  });

  it('works on the group-relative position of an image in a group', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1, { group: 'g', position: { x: 10, y: 20 } })]);
    editor.setImageCrop(id, RIGHT);
    expect(getObject(doc, 'images', id)?.position).toEqual({ x: 210, y: 20 });
  });

  it('resets with null, restoring the whole picture where it was drawn', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(id, RIGHT);
    editor.setImageCrop(id, null);
    const image = getObject(doc, 'images', id);
    expect(image?.crop).toBeUndefined();
    expect(image?.size).toEqual({ width: 400, height: 200 });
    expect(image?.position).toEqual({ x: 0, y: 0 });
    expect(toJSON(doc).images?.[0]).not.toHaveProperty('crop');
  });

  it('stores a whole-picture crop as no crop, and rounds to 6 decimals', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(id, { x: 0, y: 0, width: 1, height: 1 });
    expect(editor.canUndo()).toBe(true); // only the add
    editor.undo();
    expect(toJSON(doc).images).toBeUndefined();

    const [again = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(again, { x: 1 / 3, y: 0, width: 1 / 3, height: 1 });
    expect(getObject(doc, 'images', again)?.crop).toEqual({
      x: 0.333333,
      y: 0,
      width: 0.333333,
      height: 1,
    });
  });

  it('writes nothing when the crop does not change', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(id, RIGHT);
    editor.setImageCrop(id, RIGHT);
    // One undo removes the only crop step: the second call wrote nothing.
    editor.undo();
    expect(getObject(doc, 'images', id)?.crop).toBeUndefined();
  });

  it('refuses a locked image, a bad or too small crop, and unknown picture facts', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setLocked([id], true, 'images');
    refused(() => {
      editor.setImageCrop(id, RIGHT);
    }, 'locked');
    editor.setLocked([id], false, 'images');

    refused(() => {
      editor.setImageCrop(id, { x: 0.6, y: 0, width: 0.6, height: 1 });
    }, 'invalid');
    refused(() => {
      editor.setImageCrop(id, { x: -0.1, y: 0, width: 0.5, height: 1 });
    }, 'invalid');
    // 0.05 of 400 px is 20 px on the canvas, under the 32 px minimum.
    refused(() => {
      editor.setImageCrop(id, { x: 0, y: 0, width: 0.05, height: 1 });
    }, 'invalid');

    doc.getMap('meta').delete('assets');
    refused(() => {
      editor.setImageCrop(id, RIGHT);
    }, 'missing-reference');
    expect(getObject(doc, 'images', id)?.crop).toBeUndefined();
  });

  it('flips every listed image in one undo step, and unflips by removing the key', () => {
    const { doc, editor } = setupDeck();
    const ids = editor.addImages([wide(1), wide(2)]);
    editor.setImageFlip(ids, 'x', true);
    expect(toJSON(doc).images?.map((i) => i.flipX)).toEqual([true, true]);
    editor.undo();
    expect(toJSON(doc).images?.map((i) => i.flipX)).toEqual([undefined, undefined]);
    editor.redo();

    editor.setImageFlip(ids, 'y', true);
    editor.setImageFlip(ids, 'x', false);
    const images = toJSON(doc).images ?? [];
    expect(images.map((i) => [i.flipX, i.flipY])).toEqual([
      [undefined, true],
      [undefined, true],
    ]);
    expect(images[0]).not.toHaveProperty('flipX');
    expectValid(doc);
  });

  it('keeps the box when flipping, and the same region visible', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageCrop(id, RIGHT);
    editor.setImageFlip([id], 'x', true);
    const image = getObject(doc, 'images', id);
    expect(image?.crop).toEqual(RIGHT);
    expect(image?.position).toEqual({ x: 200, y: 0 });
    expect(image?.size).toEqual({ width: 200, height: 200 });
  });

  it('refuses a flip when any listed image is locked, and is a no-op when nothing changes', () => {
    const { doc, editor } = setupDeck();
    const ids = editor.addImages([wide(1), wide(2)]);
    editor.setLocked([ids[1] ?? ''], true, 'images');
    refused(() => {
      editor.setImageFlip(ids, 'x', true);
    }, 'locked');
    expect(toJSON(doc).images?.map((i) => i.flipX)).toEqual([undefined, undefined]);

    editor.setImageFlip([ids[0] ?? ''], 'x', false);
    editor.undo(); // the lock
    expect(toJSON(doc).images?.[1]?.locked).toBeUndefined();
    refused(() => {
      editor.setImageFlip(['nope'], 'x', true);
    }, 'not-found');
  });

  it('places the crop of a flipped image where its region is drawn', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([wide(1)]);
    editor.setImageFlip([id], 'x', true);
    editor.setImageCrop(id, RIGHT);
    // The right half of the picture is drawn on the left once mirrored.
    expect(getObject(doc, 'images', id)?.position).toEqual({ x: 0, y: 0 });
    editor.setImageCrop(id, null);
    expect(getObject(doc, 'images', id)?.position).toEqual({ x: 0, y: 0 });
    expect(getObject(doc, 'images', id)?.size).toEqual({ width: 400, height: 200 });
  });
});

/** A saved deck with one image of `picture(1)` carrying `extra` (057 fields). */
function fileWith(extra: Partial<Image>): SododeckFile {
  const p = picture(1);
  return {
    ...emptySododeckFile(),
    images: [
      {
        id: 'img-a',
        asset: p.id,
        position: { x: 10, y: 20 },
        size: { width: 100, height: 100 },
        ...extra,
      },
    ],
    assets: { [p.id]: { ...p.meta, data: p.data } },
  };
}

describe('crop and flip in the file (057)', () => {
  it('round-trips crop and flips byte-identically, after the 055 keys', () => {
    const file = fileWith({
      locked: true,
      crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.5 },
      flipX: true,
      flipY: true,
    });
    const text = serializeDeck(file, loadDeck(file).bytes);
    const { doc, bytes } = loadDeck(JSON.parse(text));
    expect(serializeDeck(doc, bytes)).toBe(text);
    expect(Object.keys(toJSON(doc).images?.[0] ?? {})).toEqual([
      'id',
      'asset',
      'position',
      'size',
      'locked',
      'crop',
      'flipX',
      'flipY',
    ]);
  });

  it('writes a 055 image back with no new keys', () => {
    const file = fileWith({});
    const text = serializeDeck(file, loadDeck(file).bytes);
    const { doc, bytes } = loadDeck(JSON.parse(text));
    expect(serializeDeck(doc, bytes)).toBe(text);
    expect(text).not.toMatch(/crop|flipX|flipY/);
  });

  it('never changes the picture bytes when an image is edited', () => {
    const file = fileWith({ size: { width: 100, height: 100 } });
    const { doc, bytes } = loadDeck(file);
    const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 0 });
    editor.setImageFlip(['img-a'], 'x', true);
    editor.setImageCrop('img-a', { x: 0, y: 0, width: 0.5, height: 1 });
    const saved = JSON.parse(serializeDeck(doc, bytes)) as SododeckFile;
    expect(saved.assets?.[picture(1).id]?.data).toBe(picture(1).data);
  });

  it('trims a crop past the picture edge on load and lists it once', () => {
    const loaded = loadDeck(fileWith({ crop: { x: 0.6, y: 0, width: 0.6, height: 1 } }));
    expect(toJSON(loaded.doc).images?.[0]?.crop).toEqual({ x: 0.6, y: 0, width: 0.4, height: 1 });
    expect(loaded.trimmedCrops).toEqual([{ imageId: 'img-a', path: 'images.0.crop' }]);
  });

  it('drops a crop that trims to nothing', () => {
    const loaded = loadDeck(fileWith({ crop: { x: 0.9999999, y: 0, width: 0.5, height: 1 } }));
    expect(toJSON(loaded.doc).images?.[0]).not.toHaveProperty('crop');
    expect(loaded.trimmedCrops).toEqual([{ imageId: 'img-a', path: 'images.0.crop' }]);
  });

  it('lists nothing for a well-formed crop or a deck without images', () => {
    const crop = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
    expect(loadDeck(fileWith({ crop })).trimmedCrops).toEqual([]);
    expect(loadDeck(emptySododeckFile()).trimmedCrops).toEqual([]);
  });
});
