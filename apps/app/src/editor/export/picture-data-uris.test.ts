import { describe, expect, it } from 'vitest';

import { memoryPictureStore } from '../../images/picture-store';
import { pictureDataUris } from './picture-data-uris';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const GONE = 'c'.repeat(64);
const image = (id: string, asset: string) => ({
  id,
  asset,
  position: { x: 0, y: 0 },
  size: { width: 10, height: 10 },
});
const meta = (type: 'image/png' | 'image/svg+xml') => ({
  type,
  bytes: 3,
  width: 1,
  height: 1,
  name: 'x',
  data: '',
});

describe('pictureDataUris (055)', () => {
  it('turns stored bytes into data URIs of the stored type, each picture once', async () => {
    const store = memoryPictureStore();
    await store.put(A, { type: 'image/png', bytes: new Uint8Array([1, 2, 3]) });
    await store.put(B, { type: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') });
    const uris = await pictureDataUris(store, {
      images: [image('i1', A), image('i2', A), image('i3', B)],
      assets: { [A]: meta('image/png'), [B]: meta('image/svg+xml') },
    });
    expect([...uris.keys()]).toEqual([A, B]);
    expect(uris.get(A)).toBe('data:image/png;base64,AQID');
    expect(uris.get(B)).toBe('data:image/svg+xml;base64,PHN2Zy8+');
  });

  it('leaves out a picture the store has not got, and any picture the deck does not know', async () => {
    const store = memoryPictureStore();
    await store.put(A, { type: 'image/png', bytes: new Uint8Array([1]) });
    const uris = await pictureDataUris(store, {
      images: [image('i1', A), image('i2', GONE)],
      assets: { [A]: meta('image/png') },
    });
    expect([...uris.keys()]).toEqual([A]);
    const noMeta = await pictureDataUris(store, { images: [image('i1', A)], assets: {} });
    expect(noMeta.size).toBe(0);
  });

  it('is empty without a store', async () => {
    expect((await pictureDataUris(null, { images: [image('i1', A)] })).size).toBe(0);
  });
});
