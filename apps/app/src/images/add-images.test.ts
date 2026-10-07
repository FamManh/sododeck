import { assetId, createEditor, fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  addImages,
  pictureBytesOf,
  resetSoftLimitWarning,
  type AddImagesInput,
} from './add-images';
import type { IngestPorts } from './ingest';
import { MAX_INPUT_BYTES } from './limits';
import { memoryPictureStore, type PictureStore } from './picture-store';
import { GIF_1X1, PNG_1X1, SVG_BYTES } from './test-pictures';

const ports: IngestPorts = {
  decode: () => Promise.resolve({ width: 80, height: 40 }),
  encode: (bytes) => Promise.resolve({ bytes, type: 'image/png' }),
  digest: (bytes) => Promise.resolve(assetId(bytes)),
};

const file = (name: string, bytes: Uint8Array) =>
  new File([bytes.slice().buffer], name, { type: 'application/octet-stream' });

function setup(overrides: Partial<AddImagesInput> = {}) {
  const doc = fromJSON(emptySododeckFile());
  const editor = createEditor(doc, { captureTimeout: 0 });
  const input: AddImagesInput = {
    editor,
    store: memoryPictureStore(),
    ports,
    at: { x: 500, y: 300 },
    viewportWidth: 1000,
    ...overrides,
  };
  return { doc, editor, input };
}

describe('addImages (055)', () => {
  it('always embeds a new picture: its entry has data and no path (068)', async () => {
    const { doc, input } = setup();
    await addImages(input, [file('a.png', PNG_1X1)]);
    const out = JSON.parse(serializeDeck(doc, new Map([[assetId(PNG_1X1), PNG_1X1]]))) as {
      assets: Record<string, { data?: string; path?: string }>;
    };
    const [entry] = Object.values(out.assets);
    expect(entry?.data?.length).toBeGreaterThan(10);
    expect(entry).not.toHaveProperty('path');
  });

  it('writes the pictures to the store before the model add, in one undo step', async () => {
    const store = memoryPictureStore();
    const order: string[] = [];
    const put = store.put.bind(store);
    store.put = async (id, picture) => {
      order.push('put');
      await put(id, picture);
    };
    const { doc, editor, input } = setup({ store });
    const add = editor.addImages.bind(editor);
    editor.addImages = (items) => {
      order.push('add');
      return add(items);
    };
    const result = await addImages(input, [file('a.png', PNG_1X1), file('b.svg', SVG_BYTES)]);
    expect(order).toEqual(['put', 'put', 'add']);
    expect(result.ids).toHaveLength(2);
    expect(result.messages.at(-1)).toBe('Added 2 images.');
    expect(toJSON(doc).images).toHaveLength(2);
    editor.undo();
    expect(toJSON(doc).images).toBeUndefined();
  });

  it('refuses unusable files with their reasons and still adds the rest', async () => {
    const { doc, input } = setup();
    const result = await addImages(input, [
      file('notes.txt', new TextEncoder().encode('hello')),
      file('ok.png', PNG_1X1),
    ]);
    expect(result.messages[0]).toBe(
      'notes.txt: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF).',
    );
    expect(result.ids).toHaveLength(1);
    expect(toJSON(doc).images).toHaveLength(1);
  });

  it('adds nothing when every file is refused', async () => {
    const { doc, input } = setup();
    const result = await addImages(input, [file('big.png', new Uint8Array(MAX_INPUT_BYTES + 1))]);
    expect(result.ids).toEqual([]);
    expect(result.messages).toHaveLength(1);
    expect(toJSON(doc).images).toBeUndefined();
  });

  it('adds nothing and says so when the store is full', async () => {
    const store: PictureStore = {
      ...memoryPictureStore(),
      put: () => Promise.reject(Object.assign(new Error('full'), { name: 'QuotaExceededError' })),
    };
    const { doc, input } = setup({ store });
    const result = await addImages(input, [file('a.png', PNG_1X1)]);
    expect(result.ids).toEqual([]);
    expect(result.messages).toEqual(['Could not save the picture: browser storage is full.']);
    expect(toJSON(doc).images).toBeUndefined();
  });

  it('adds nothing without a store', async () => {
    const { doc, input } = setup({ store: null });
    const result = await addImages(input, [file('a.png', PNG_1X1)]);
    expect(result.ids).toEqual([]);
    expect(toJSON(doc).images).toBeUndefined();
  });

  it('centres one picture on the point at its natural size', async () => {
    const { doc, input } = setup();
    await addImages(input, [file('a.png', PNG_1X1)]);
    const [one] = toJSON(doc).images ?? [];
    expect(one?.size).toEqual({ width: 80, height: 40 });
    expect(one?.position).toEqual({ x: 460, y: 280 });
  });

  it('puts several pictures in a row without overlap, centred on the point', async () => {
    const { doc, input } = setup();
    await addImages(input, [file('a.png', PNG_1X1), file('b.svg', SVG_BYTES)]);
    const images = toJSON(doc).images ?? [];
    expect(images).toHaveLength(2);
    const [a, b] = images;
    expect(a?.position.y).toBe(b?.position.y);
    expect((b?.position.x ?? 0) - (a?.position.x ?? 0)).toBe((a?.size.width ?? 0) + 16);
  });

  it('notes that an animated GIF shows only its first frame', async () => {
    const { input } = setup();
    const gce = [0x21, 0xf9, 0x04, 0, 0, 0, 0, 0];
    const frames = new Uint8Array([...GIF_1X1.slice(0, 13), ...gce, ...gce, 0x3b]);
    const result = await addImages(input, [file('spin.gif', frames)]);
    expect(result.messages).toContain('spin.gif: animated GIFs show only the first frame.');
  });

  describe('the soft deck limit', () => {
    // A deck whose existing pictures already weigh 100 MB, and one more small picture on top.
    const heavy = (): ReturnType<typeof setup> => {
      const base = setup();
      const big = 'd'.repeat(64);
      base.editor.addImages([
        {
          asset: big,
          meta: { type: 'image/png', bytes: 5_000_000, width: 100, height: 100, name: 'big.png' },
          position: { x: 0, y: 0 },
          size: { width: 64, height: 64 },
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          asset: String(i).padStart(64, 'a'),
          meta: {
            type: 'image/png' as const,
            bytes: 5_242_880,
            width: 10,
            height: 10,
            name: 'x.png',
          },
          position: { x: i, y: 0 },
          size: { width: 64, height: 64 },
        })),
      ]);
      return base;
    };

    it('counts each picture once, whatever number of images use it', () => {
      expect(
        pictureBytesOf({
          images: [
            { id: 'a', asset: 'p', position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
            { id: 'b', asset: 'p', position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
          ],
          assets: { p: { type: 'image/png', bytes: 10, width: 1, height: 1, name: 'p', data: '' } },
        }),
      ).toBe(10);
    });

    it('warns once per session when the pictures pass 100 MB, after the add', async () => {
      resetSoftLimitWarning();
      const { input } = heavy();
      const first = await addImages(input, [file('a.png', PNG_1X1)]);
      expect(first.messages.at(-1)).toBe('Added 1 image.');
      expect(
        first.messages.some((m) => /^Pictures in this deck use \d+ MB\. Large decks/.test(m)),
      ).toBe(true);
      const second = await addImages(input, [file('b.png', PNG_1X1)]);
      expect(second.messages).toEqual(['Added 1 image.']);
    });
  });
});
