import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  assetId,
  attachAssets,
  type AssetMeta,
  decodeBase64,
  encodeBase64,
  fromJSON,
  createEditor,
  loadDeck,
  metaOf,
  MISSING_DATA,
  repairAssets,
  serializeDeck,
  toJSON,
  DeckValidationError,
} from '../src';
import { seqIds } from './helpers';
import { assetKeys, newImage, picture, setupDeck } from './image-helpers';

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe('assetId (055)', () => {
  it('is the lowercase hex SHA-256, matching the published test vectors', () => {
    expect(assetId(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(assetId(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(assetId(bytesOf('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('hashes inputs around the block boundaries the same as in one go', () => {
    // 55, 56, 63, 64, 65 bytes straddle where the padding no longer fits one block.
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const data = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 255);
      const a = assetId(data);
      // A copy with an offset into a bigger buffer must hash the same.
      const buffer = new Uint8Array(n + 5);
      buffer.set(data, 5);
      expect(assetId(buffer.subarray(5))).toBe(a);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('is stable, and differs for different bytes', () => {
    const a = picture(1);
    expect(assetId(a.bytes)).toBe(a.id);
    expect(picture(2).id).not.toBe(a.id);
  });
});

describe('base64 (055)', () => {
  it('round-trips every length around the padding', () => {
    for (let n = 0; n < 40; n++) {
      const data = new Uint8Array(n).map((_, i) => (i * 31 + 5) & 255);
      expect(decodeBase64(encodeBase64(data))).toEqual(data);
    }
    expect(encodeBase64(bytesOf('Man'))).toBe('TWFu');
    expect(encodeBase64(bytesOf('Ma'))).toBe('TWE=');
    expect(encodeBase64(bytesOf('M'))).toBe('TQ==');
  });

  it('refuses text that is not padded base64', () => {
    expect(decodeBase64('TWF')).toBeUndefined();
    expect(decodeBase64('TW!u')).toBeUndefined();
    expect(decodeBase64('=WFu')).toBeUndefined();
  });
});

function deckWith(p: ReturnType<typeof picture>, data = p.data, bytes = p.meta.bytes) {
  return {
    ...emptySododeckFile(),
    images: [{ id: 'i', asset: p.id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } }],
    assets: { [p.id]: { ...p.meta, bytes, data } },
  } satisfies SododeckFile;
}

describe('serializeDeck with bytes (055)', () => {
  it('fills data from the byte map and omits pictures no image uses', () => {
    const { doc, editor } = setupDeck();
    const [id = ''] = editor.addImages([newImage(1), newImage(2)]);
    editor.remove('images', id);
    const kept = picture(2);
    const text = serializeDeck(
      doc,
      new Map([
        [picture(1).id, picture(1).bytes],
        [kept.id, kept.bytes],
      ]),
    );
    const out = JSON.parse(text) as SododeckFile;
    expect(Object.keys(out.assets ?? {})).toEqual([kept.id]);
    expect(out.assets?.[kept.id]?.data).toBe(kept.data);
    expect(out.images?.map((i) => i.asset)).toEqual([kept.id]);
  });

  it('writes a picture without bytes as missing, and a deck without images without assets', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1)]);
    const out = JSON.parse(serializeDeck(doc)) as SododeckFile;
    expect(Object.values(out.assets ?? {})[0]).toMatchObject({ bytes: 1, data: MISSING_DATA });
    const bare = emptySododeckFile();
    expect(Object.keys(JSON.parse(serializeDeck({ ...bare, assets: {} })) as object)).not.toContain(
      'assets',
    );
  });

  it('lists assets in picture id order whatever order they were added in', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(9), newImage(1), newImage(5)]);
    const ids = assetKeys(serializeDeck(doc));
    expect(ids).toEqual([...ids].sort());
  });

  it('keeps the data a parsed file already carries when no bytes are given', () => {
    const p = picture(3);
    const file = deckWith(p);
    expect(attachAssets(file).assets?.[p.id]?.data).toBe(p.data);
  });
});

describe('loadDeck (055)', () => {
  it('returns the document and the decoded bytes, and strips data from the document', () => {
    const p = picture(1);
    const { doc, bytes, problems } = loadDeck(deckWith(p));
    expect(problems).toEqual([]);
    expect(bytes.get(p.id)).toEqual(p.bytes);
    expect(toJSON(doc).assets?.[p.id]?.data).toBe('');
    expect(JSON.stringify(doc.getMap('meta').toJSON())).not.toContain(p.data);
  });

  it('takes data "" as a picture that carries no bytes: no problem, facts kept as stored', () => {
    const p = picture(1);
    const { doc, bytes, problems } = loadDeck(deckWith(p, '', p.meta.bytes));
    expect(problems).toEqual([]);
    expect(bytes.size).toBe(0);
    expect(toJSON(doc).assets?.[p.id]).toEqual({ ...p.meta, data: '' });
  });

  it('round-trips toJSON through fromJSON without changing the stored facts', () => {
    const { doc, editor } = setupDeck();
    editor.addImages([newImage(1)]);
    expect(toJSON(fromJSON(toJSON(doc)))).toEqual(toJSON(doc));
  });

  it('fromJSON still returns just the document', () => {
    expect(fromJSON(deckWith(picture(1))).getMap('images').size).toBe(1);
  });

  it.each([
    ['bad base64', (p: ReturnType<typeof picture>) => deckWith(p, '!!!!'), 'bad-data'],
    ['wrong length', (p: ReturnType<typeof picture>) => deckWith(p, p.data, 3), 'size-mismatch'],
    [
      'hash that is not the key',
      (p: ReturnType<typeof picture>) =>
        deckWith(p, encodeBase64(new Uint8Array([1, 2, 3, 4, 5, 6, 7]))),
      'hash-mismatch',
    ],
  ])('opens a deck whose picture has %s, as a missing picture', (_name, make, reason) => {
    const p = picture(1);
    const { doc, bytes, problems } = loadDeck(make(p));
    expect(problems).toEqual([{ id: p.id, name: p.meta.name, reason }]);
    expect(bytes.size).toBe(0);
    expect(doc.getMap('images').size).toBe(1);
    // Saving it again keeps the image and writes the picture as missing, which reloads as missing.
    const again = loadDeck(JSON.parse(serializeDeck(doc, bytes)));
    expect(again.problems.map((x) => x.reason)).toEqual(['hash-mismatch']);
  });

  it('treats a type outside the allow-list and an over-size picture as missing', () => {
    const p = picture(1);
    const odd = deckWith(p);
    (odd.assets[p.id] as { type: string }).type = 'image/bmp';
    expect(loadDeck(odd).problems.map((x) => x.reason)).toEqual(['bad-type']);
    const big = deckWith(p);
    (big.assets[p.id] as { bytes: number }).bytes = 5_242_881;
    expect(loadDeck(big).problems.map((x) => x.reason)).toEqual(['size-mismatch']);
  });

  it('still refuses a file whose image names a picture that is not in assets', () => {
    const p = picture(1);
    const file = { ...deckWith(p), assets: {} };
    expect(() => loadDeck(file)).toThrow(DeckValidationError);
  });

  it('drops an asset no image uses on the next save', () => {
    const p = picture(1);
    const q = picture(2);
    const file = {
      ...deckWith(p),
      assets: { ...deckWith(p).assets, [q.id]: { ...q.meta, data: q.data } },
    };
    const { doc, bytes } = loadDeck(file);
    expect(assetKeys(serializeDeck(doc, bytes))).toEqual([p.id]);
  });
});

/** A deck whose one picture is a file next to it (068): facts and `path`, no `data`. */
function pointedDeck(p: ReturnType<typeof picture>, path = 'assets/login.png') {
  return {
    ...emptySododeckFile(),
    images: [{ id: 'i', asset: p.id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } }],
    assets: { [p.id]: { ...p.meta, path } },
  } satisfies SododeckFile;
}

describe('pictures that point at a file (068)', () => {
  it('metaOf keeps the path and drops the data', () => {
    const p = picture(1);
    expect(metaOf({ ...p.meta, path: 'a/b.png' })).toEqual({ ...p.meta, path: 'a/b.png' });
    expect(metaOf({ ...p.meta, data: p.data })).toEqual(p.meta);
  });

  it('repairAssets passes a pointed-at entry through, with no problem', () => {
    const p = picture(1);
    const file = pointedDeck(p);
    const out = repairAssets(file);
    expect(out.problems).toEqual([]);
    expect(out.input).toEqual(file);
    expect(out.metas.get(p.id)).toEqual({ ...p.meta, path: 'assets/login.png' });
    expect(out.bytes.size).toBe(0);
    expect(out.fileRefs).toEqual([{ id: p.id, name: p.meta.name, path: 'assets/login.png' }]);
  });

  it('loads such a deck and lists its file references sorted by id', () => {
    const [a, b] = [picture(1), picture(2)];
    const base = pointedDeck(a);
    const file = {
      ...base,
      images: [
        ...base.images,
        { id: 'j', asset: b.id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
      ],
      assets: { ...base.assets, [b.id]: { ...b.meta, path: '../../Attachments/b.png' } },
    };
    const { fileRefs, problems, bytes } = loadDeck(file);
    expect(problems).toEqual([]);
    expect(bytes.size).toBe(0);
    expect(fileRefs.map((ref) => ref.id)).toEqual([a.id, b.id].sort());
    expect(fileRefs.find((ref) => ref.id === b.id)?.path).toBe('../../Attachments/b.png');
  });

  it('refuses a picture with both data and path, or neither (I8)', () => {
    const p = picture(1);
    const both = { ...deckWith(p), assets: { [p.id]: { ...p.meta, data: p.data, path: 'a.png' } } };
    const neither = { ...deckWith(p), assets: { [p.id]: { ...p.meta } } };
    for (const file of [both, neither]) {
      try {
        loadDeck(file);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(DeckValidationError);
        expect((error as DeckValidationError).issues.map((i) => i.code)).toContain(
          'image-asset-source',
        );
      }
    }
  });

  it('refuses a malformed path (I9)', () => {
    const p = picture(1);
    expect(() => loadDeck(pointedDeck(p, 'a/../x.png'))).toThrow(DeckValidationError);
  });

  describe('on write', () => {
    it('readAssets gives the facts and path, never data', () => {
      const p = picture(1);
      const { doc } = loadDeck(pointedDeck(p));
      expect(toJSON(doc).assets?.[p.id]).toEqual({ ...p.meta, path: 'assets/login.png' });
    });

    it('attachAssets keeps path and writes no data, with or without bytes', () => {
      const p = picture(1);
      const file = pointedDeck(p);
      const expected = { ...p.meta, path: 'assets/login.png' };
      expect(attachAssets(file).assets?.[p.id]).toEqual(expected);
      expect(attachAssets(file, new Map([[p.id, p.bytes]])).assets?.[p.id]).toEqual(expected);
    });

    it('serializeDeck gives back the loaded file', () => {
      const p = picture(1);
      const file = pointedDeck(p);
      const out = JSON.parse(serializeDeck(loadDeck(file).doc)) as SododeckFile;
      expect(out.assets).toEqual(file.assets);
    });

    it('drops the entry once the last image using it is removed', () => {
      const p = picture(1);
      const { doc } = loadDeck(pointedDeck(p));
      const editor = createEditor(doc, { newId: seqIds(), captureTimeout: 0 });
      editor.remove('images', 'i');
      expect(assetKeys(serializeDeck(doc))).toEqual([]);
    });

    it('keeps one embedded and one pointed-at picture side by side', () => {
      const [a, b] = [picture(1), picture(2)];
      const base = deckWith(a);
      const file = {
        ...base,
        images: [
          ...base.images,
          { id: 'j', asset: b.id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
        ],
        assets: { ...base.assets, [b.id]: { ...b.meta, path: 'b.png' } },
      };
      const loaded = loadDeck(file);
      const out = JSON.parse(serializeDeck(loaded.doc, loaded.bytes)) as SododeckFile;
      expect(out.assets?.[a.id]?.data).toBe(a.data);
      expect(out.assets?.[b.id]).toEqual({ ...b.meta, path: 'b.png' });
    });
  });

  it('a pointed-at picture is far smaller than the same one embedded (SC-005)', () => {
    const big = new Uint8Array(200_000).map((_, i) => (i * 31) % 251);
    const id = assetId(big);
    const meta: AssetMeta = {
      type: 'image/png',
      bytes: big.length,
      width: 10,
      height: 10,
      name: 'big.png',
    };
    const images = [
      { id: 'i', asset: id, position: { x: 0, y: 0 }, size: { width: 40, height: 40 } },
    ] satisfies SododeckFile['images'];
    const embedded = {
      ...emptySododeckFile(),
      images,
      assets: { [id]: { ...meta, data: encodeBase64(big) } },
    } satisfies SododeckFile;
    const pointed = {
      ...emptySododeckFile(),
      images,
      assets: { [id]: { ...meta, path: 'big.png' } },
    } satisfies SododeckFile;
    const a = loadDeck(embedded);
    const b = loadDeck(pointed);
    const embeddedSize = serializeDeck(a.doc, a.bytes).length;
    const pointedSize = serializeDeck(b.doc).length;
    expect(pointedSize).toBeLessThan(embeddedSize * 0.1);
  });
});
