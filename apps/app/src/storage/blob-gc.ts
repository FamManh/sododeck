import { deleteBlobs, listBlobIds } from './blob-store';
import type { LibraryDb } from './library-db';

/**
 * Drops pictures no `images` object references (055 R8). Run once when a deck opens, after load
 * and before editing, so a picture whose add was undone can still come back with ⌘⇧Z during the
 * session. Idempotent; never touches another deck. Returns the deleted ids.
 */
export async function sweepBlobs(
  db: LibraryDb,
  deckId: string,
  referencedIds: Iterable<string>,
): Promise<string[]> {
  const keep = new Set(referencedIds);
  const orphans = (await listBlobIds(db, deckId)).filter((id) => !keep.has(id));
  if (orphans.length > 0) await deleteBlobs(db, deckId, orphans);
  return orphans;
}
