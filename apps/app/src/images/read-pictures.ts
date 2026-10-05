import type { SododeckFile } from '@sododeck/schema';

import type { PictureStore } from './picture-store';

/**
 * The stored bytes of every picture the deck's images use, by picture id (055): what a file or
 * image export embeds. A picture the store does not have is left out, and the export then draws
 * or writes it as missing.
 */
export async function readPictureBytes(
  store: PictureStore | null,
  deck: Pick<SododeckFile, 'images'>,
): Promise<Map<string, Uint8Array>> {
  const bytes = new Map<string, Uint8Array>();
  if (store === null) return bytes;
  for (const image of deck.images ?? []) {
    if (bytes.has(image.asset)) continue;
    try {
      const stored = await store.getBytes(image.asset);
      if (stored !== null) bytes.set(image.asset, stored.bytes);
    } catch {
      // Unreadable counts as missing; the export carries on without it.
    }
  }
  return bytes;
}
