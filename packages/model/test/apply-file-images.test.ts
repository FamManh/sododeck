import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { applyFile, loadDeck, toJSON, type ApplyResult } from '../src';
import { fromY } from '../src/convert';
import { assetsMap } from '../src/layout';
import { picture } from './image-helpers';

const origin = { test: 'host' };
const a = picture(1);
const b = picture(2);

const image = (id: string, asset: string) => ({
  id,
  asset,
  position: { x: 0, y: 0 },
  size: { width: 40, height: 40 },
});

function deckWith(images: SododeckFile['images'], assets: SododeckFile['assets']): SododeckFile {
  return { ...emptySododeckFile(), images, assets };
}

function applied(result: ApplyResult) {
  if (result.status !== 'applied') throw new Error('expected the file to be applied');
  return result;
}

describe('applyFile and pictures (066 US4)', () => {
  it('adds an image with its bytes returned and its facts stored', () => {
    const { doc } = loadDeck(
      deckWith([image('img-a', a.id)], { [a.id]: { ...a.meta, data: a.data } }),
    );
    const file = deckWith([image('img-a', a.id), image('img-b', b.id)], {
      [a.id]: { ...a.meta, data: a.data },
      [b.id]: { ...b.meta, data: b.data },
    });
    const result = applied(applyFile(doc, file, origin));
    expect(result.bytes.get(b.id)).toEqual(b.bytes);
    expect(result.summary.images?.added).toBe(1);
    expect(toJSON(doc).images?.map((i) => i.id)).toEqual(['img-a', 'img-b']);
    expect(fromY(assetsMap(doc)?.get(b.id))).toEqual(b.meta);
  });

  it('applies a file with a damaged picture, lists it and stores the placeholder as a load does', () => {
    const { doc } = loadDeck(emptySododeckFile());
    const file = deckWith([image('img-a', a.id)], { [a.id]: { ...a.meta, data: '!!bad!!' } });
    const result = applied(applyFile(doc, file, origin));
    expect(result.problems).toEqual([{ id: a.id, name: a.meta.name, reason: 'bad-data' }]);
    expect(result.bytes.size).toBe(0);
    expect(toJSON(doc)).toEqual(toJSON(loadDeck(file).doc));
  });

  it('changes nothing for the same deck written with empty picture data', () => {
    const { doc } = loadDeck(
      deckWith([image('img-a', a.id)], { [a.id]: { ...a.meta, data: a.data } }),
    );
    const echo = toJSON(doc);
    expect(echo.assets?.[a.id]?.data).toBe('');
    const result = applied(applyFile(doc, echo, origin));
    expect(result.changed).toBe(false);
  });

  it('removes an image and keeps its picture facts for an undo', () => {
    const { doc } = loadDeck(
      deckWith([image('img-a', a.id)], { [a.id]: { ...a.meta, data: a.data } }),
    );
    const result = applied(applyFile(doc, emptySododeckFile(), origin));
    expect(result.summary.images?.removed).toBe(1);
    expect(toJSON(doc).images).toBeUndefined();
    expect(toJSON(doc).assets).toBeUndefined();
    expect(fromY(assetsMap(doc)?.get(a.id))).toEqual(a.meta);
  });
});
