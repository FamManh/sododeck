import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  assetId,
  attachAssets,
  decodeBase64,
  encodeBase64,
  fromJSON,
  loadDeck,
  MISSING_DATA,
  serializeDeck,
  toJSON,
  DeckValidationError,
} from '../src';
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
