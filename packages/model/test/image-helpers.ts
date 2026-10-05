import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';

import {
  assetId,
  createEditor,
  encodeBase64,
  fromJSON,
  type AssetMeta,
  type DeckEditor,
  type NewImage,
} from '../src';
import { seqIds } from './helpers';

/** Tiny stand-in picture bytes: the model never decodes them, it only hashes and stores them. */
export function picture(seed: number, type: AssetMeta['type'] = 'image/png') {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, seed, seed + 1, seed + 2]);
  const id = assetId(bytes);
  const meta: AssetMeta = {
    type,
    bytes: bytes.length,
    width: 10,
    height: 10,
    name: `p${String(seed)}.png`,
  };
  return { bytes, id, meta, data: encodeBase64(bytes) };
}

export function newImage(seed: number, extra: Partial<NewImage> = {}): NewImage {
  const p = picture(seed);
  return {
    asset: p.id,
    meta: p.meta,
    position: { x: seed * 10, y: seed * 10 },
    size: { width: 100, height: 60 },
    ...extra,
  };
}

/** An editor over a deck with a few cards, a group and a note. */
export function setupDeck(extra: Partial<SododeckFile> = {}): {
  doc: ReturnType<typeof fromJSON>;
  editor: DeckEditor;
} {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'a', type: 'service', title: 'A' },
      { id: 'b', type: 'service', title: 'B' },
      { id: 'c', type: 'service', title: 'C' },
    ],
    groups: [{ id: 'g', title: 'G' }],
    stickies: [{ id: 's', text: 'Note', position: { x: 0, y: 0 } }],
    ...extra,
  };
  const doc = fromJSON(file);
  return { doc, editor: createEditor(doc, { newId: seqIds(), captureTimeout: 0 }) };
}

/** The picture ids a saved deck lists in `assets`, in file order. */
export function assetKeys(text: string): string[] {
  return Object.keys((JSON.parse(text) as SododeckFile).assets ?? {});
}
