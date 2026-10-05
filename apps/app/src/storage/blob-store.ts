import type { BlobRow, LibraryDb } from './library-db';

/**
 * The picture store (055 R4): immutable rows `[deckId+id]` in the library database. `id` is the
 * content hash, so writing the same picture twice is a no-op. A quota failure propagates as the
 * browser's error; callers test it with `isQuotaError` and add nothing to the document.
 */

export interface StoredPicture {
  type: string;
  bytes: Uint8Array;
}

/** Writes a picture once; an existing row is kept (same id means same bytes). */
export async function putBlob(
  db: LibraryDb,
  deckId: string,
  id: string,
  picture: StoredPicture,
): Promise<void> {
  await db.transaction('rw', db.blobs, async () => {
    if ((await db.blobs.get([deckId, id])) !== undefined) return;
    await db.blobs.add({ deckId, id, type: picture.type, bytes: picture.bytes });
  });
}

/** The picture as a `Blob` (for object URLs), or `null` when the row is missing. */
export async function getBlob(db: LibraryDb, deckId: string, id: string): Promise<Blob | null> {
  const row = await db.blobs.get([deckId, id]);
  return row ? new Blob([row.bytes as Uint8Array<ArrayBuffer>], { type: row.type }) : null;
}

/** The stored row (type + bytes), for export and duplicate. */
export function getBlobRow(
  db: LibraryDb,
  deckId: string,
  id: string,
): Promise<BlobRow | undefined> {
  return db.blobs.get([deckId, id]);
}

export async function hasBlob(db: LibraryDb, deckId: string, id: string): Promise<boolean> {
  return (await db.blobs.get([deckId, id])) !== undefined;
}

export async function listBlobIds(db: LibraryDb, deckId: string): Promise<string[]> {
  const keys = await db.blobs.where('deckId').equals(deckId).primaryKeys();
  return keys.map(([, id]) => id);
}

export async function deleteBlobs(db: LibraryDb, deckId: string, ids: string[]): Promise<void> {
  await db.blobs.bulkDelete(ids.map((id): [string, string] => [deckId, id]));
}

export async function deleteDeckBlobs(db: LibraryDb, deckId: string): Promise<void> {
  await db.blobs.where('deckId').equals(deckId).delete();
}
