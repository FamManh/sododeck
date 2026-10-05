import { Dexie } from 'dexie';
import { describe, expect, it, vi } from 'vitest';

import { deleteBlobs, deleteDeckBlobs, getBlob, hasBlob, listBlobIds, putBlob } from './blob-store';
import { insertDeck, openLibraryDb, purgeDeleted, softDeleteDeck } from './library-db';
import { isQuotaError } from '../lib/features';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';

const picture = (...values: number[]) => ({ type: 'image/png', bytes: new Uint8Array(values) });

describe('blob store', () => {
  it('writes a picture once and ignores a duplicate', async () => {
    const db = await freshLibraryDb();
    await putBlob(db, 'd1', 'aa', picture(1, 2, 3));
    await putBlob(db, 'd1', 'aa', picture(9, 9));
    expect(await db.blobs.count()).toBe(1);
    expect([...((await db.blobs.get(['d1', 'aa']))?.bytes ?? [])]).toEqual([1, 2, 3]);
  });

  it('reads, tests and lists pictures', async () => {
    const db = await freshLibraryDb();
    await putBlob(db, 'd1', 'aa', picture(1));
    await putBlob(db, 'd1', 'bb', picture(2));
    expect(await hasBlob(db, 'd1', 'aa')).toBe(true);
    expect(await hasBlob(db, 'd1', 'zz')).toBe(false);
    expect((await getBlob(db, 'd1', 'aa'))?.type).toBe('image/png');
    expect(await getBlob(db, 'd1', 'zz')).toBeNull();
    expect((await listBlobIds(db, 'd1')).sort()).toEqual(['aa', 'bb']);
  });

  it('keeps separate rows per deck for the same id', async () => {
    const db = await freshLibraryDb();
    await putBlob(db, 'd1', 'aa', picture(1));
    await putBlob(db, 'd2', 'aa', picture(1));
    expect(await db.blobs.count()).toBe(2);
    await deleteBlobs(db, 'd1', ['aa']);
    expect(await hasBlob(db, 'd1', 'aa')).toBe(false);
    expect(await hasBlob(db, 'd2', 'aa')).toBe(true);
    await deleteDeckBlobs(db, 'd2');
    expect(await db.blobs.count()).toBe(0);
  });

  it('lets a quota error through so callers can map it', async () => {
    const db = await freshLibraryDb();
    const quota = new DOMException('full', 'QuotaExceededError');
    const spy = vi.spyOn(db.blobs, 'add').mockRejectedValue(quota);
    const error: unknown = await putBlob(db, 'd1', 'aa', picture(1)).catch((e: unknown) => e);
    spy.mockRestore();
    expect(isQuotaError(error)).toBe(true);
  });

  it('purgeDeleted removes a purged deck blobs and keeps the others', async () => {
    const db = await freshLibraryDb();
    await insertDeck(db, deckRecord('gone'), new Uint8Array([1]));
    await insertDeck(db, deckRecord('kept'), new Uint8Array([1]));
    await putBlob(db, 'gone', 'aa', picture(1));
    await putBlob(db, 'kept', 'aa', picture(1));
    await softDeleteDeck(db, 'gone');
    await purgeDeleted(db);
    expect(await hasBlob(db, 'gone', 'aa')).toBe(false);
    expect(await hasBlob(db, 'kept', 'aa')).toBe(true);
  });
});

describe('library db upgrade to version 3', () => {
  it('keeps decks and updates from version 2', async () => {
    const name = `blob-upgrade-${String(Date.now())}`;
    const v2 = new Dexie(name);
    v2.version(2).stores({
      decks: 'id, folderId, updatedAt, openedAt, deletedAt',
      folders: 'id, &nameKey, deletedAt',
      updates: '++seq, deckId, [deckId+seq]',
    });
    await v2.table('decks').add(deckRecord('old'));
    await v2.table('updates').add({ deckId: 'old', bytes: new Uint8Array([7]) });
    v2.close();

    const db = await openLibraryDb(name);
    expect(db).not.toBeNull();
    if (!db) return;
    expect((await db.decks.get('old'))?.name).toBe('Deck old');
    expect(await db.updates.count()).toBe(1);
    await putBlob(db, 'old', 'aa', picture(1));
    expect(await hasBlob(db, 'old', 'aa')).toBe(true);
    await db.delete();
  });
});
