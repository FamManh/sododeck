import { encodeBase64 } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { PictureStore } from '../../images/picture-store';
import { readPictureBytes } from '../../images/read-pictures';

/**
 * The pictures an image export draws, as `data:` URIs by picture id (055 R6). An SVG drawn as an
 * `<img>` (the PNG path and the preview) loads only `data:` sub-resources, so nothing else would
 * show; it also keeps the exported SVG one self-contained file with no outside URL. The type is the
 * one the deck stored for the picture. A picture the store does not have is left out, and the
 * renderer then draws the "missing" placeholder.
 */
export async function pictureDataUris(
  store: PictureStore | null,
  deck: Pick<SododeckFile, 'images' | 'assets'>,
): Promise<Map<string, string>> {
  const bytes = await readPictureBytes(store, deck);
  const uris = new Map<string, string>();
  for (const [id, picture] of bytes) {
    const type = deck.assets?.[id]?.type;
    if (type !== undefined) uris.set(id, `data:${type};base64,${encodeBase64(picture)}`);
  }
  return uris;
}
