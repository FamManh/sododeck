import { assetId } from '@sododeck/model';
import { serializeDeck } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';

/** A tiny file that sniffs as a PNG (the host only looks at the first bytes and the hash). */
export function png(tag: number): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, 1, 2, 3, 4, 5]);
}

export const PIC = png(1);
export const PIC_ID = assetId(PIC);
export const OTHER = png(2);
export const OTHER_ID = assetId(OTHER);

/** A deck with one image whose picture is the file `path`. */
export function deckWithPicture(path: string, id = PIC_ID): string {
  const file: SododeckFile = {
    ...emptySododeckFile(),
    name: 'Pics',
    images: [{ id: 'img', asset: id, position: { x: 0, y: 0 }, size: { width: 64, height: 64 } }],
    assets: { [id]: { type: 'image/png', bytes: 14, width: 1, height: 1, name: 'dot.png', path } },
  };
  return serializeDeck(file);
}
