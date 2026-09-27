import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createFolder,
  FolderNameError,
  insertDeck,
  liveDecks,
  liveFolders,
  loadDeckLog,
  markExported,
  markOpened,
  moveDeck,
  openLibraryDb,
  purgeDeleted,
  renameFolder,
  restoreDeck,
  restoreFolder,
  softDeleteDeck,
  softDeleteFolder,
  storeDeckUpdate,
} from './library-db';
import { deckRecord, freshLibraryDb as freshDb } from '../test/library-fixtures';

let counter = 0;
const opened: { delete: () => Promise<void> }[] = [];

afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
});

const bytes = (...values: number[]) => new Uint8Array(values);

describe('library-db schema', () => {
  it('upgrades v1 rows and fills the new fields with defaults', async () => {
    const name = `library-db-upgrade-${String(counter++)}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ decks: 'id, name, updatedAt' });
    await v1.table('decks').add({ id: 'old', name: 'Old deck', createdAt: 1, updatedAt: 2 });
    v1.close();

    const db = await openLibraryDb(name);
    if (!db) throw new Error('no db');
    opened.push(db);
    expect(await db.decks.get('old')).toEqual(
      deckRecord('old', { name: 'Old deck', createdAt: 1, updatedAt: 2 }),
    );
  });
});

describe('decks', () => {
  it('inserts the record and its first update in one go and loads the log in seq order', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('a'), bytes(1));
    await db.updates.add({ deckId: 'a', bytes: bytes(2) });
    await db.updates.add({ deckId: 'b', bytes: bytes(9) });
    await db.updates.add({ deckId: 'a', bytes: bytes(3) });

    const log = await loadDeckLog(db, 'a');
    expect(log?.record.id).toBe('a');
    expect(log?.bytes.map((b) => Array.from(b))).toEqual([[1], [2], [3]]);
    expect(log?.maxSeq).toBeGreaterThan(0);
  });

  it('returns null for unknown and deleted decks', async () => {
    const db = await freshDb();
    expect(await loadDeckLog(db, 'nope')).toBeNull();
    await insertDeck(db, deckRecord('a'), bytes(1));
    await softDeleteDeck(db, 'a');
    expect(await loadDeckLog(db, 'a')).toBeNull();
  });

  it('writes nothing when the record insert fails', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('a'), bytes(1));
    await expect(insertDeck(db, deckRecord('a'), bytes(2))).rejects.toThrow();
    expect(await db.updates.where('deckId').equals('a').count()).toBe(1);
  });

  it('moves, marks opened and exported without touching updatedAt', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('a', { updatedAt: 5 }), bytes(1));
    await moveDeck(db, 'a', 'f1');
    await markOpened(db, 'a', 100);
    await markExported(db, 'a', 200);
    expect(await db.decks.get('a')).toMatchObject({
      folderId: 'f1',
      openedAt: 100,
      exportedAt: 200,
      updatedAt: 5,
    });
  });

  it('stores an update row and the cached fields together', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('a'), bytes(1));
    const seq = await storeDeckUpdate(db, 'a', bytes(2), {
      at: 50,
      summary: { name: 'Renamed', nodeCount: 3, edgeCount: 2, flowCount: 1, thumb: null },
    });
    expect(seq).toBeGreaterThan(0);
    expect(await db.decks.get('a')).toMatchObject({
      name: 'Renamed',
      nodeCount: 3,
      updatedAt: 50,
    });
    expect(await db.updates.where('deckId').equals('a').count()).toBe(2);
  });

  it('soft-deletes and restores a deck', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('a'), bytes(1));
    await softDeleteDeck(db, 'a', 10);
    expect((await db.decks.get('a'))?.deletedAt).toBe(10);
    expect(await liveDecks(db)).toEqual([]);
    await restoreDeck(db, 'a');
    expect((await liveDecks(db)).map((d) => d.id)).toEqual(['a']);
  });
});

describe('folders', () => {
  it('creates folders and refuses empty, duplicate and too-long names', async () => {
    const db = await freshDb();
    const folder = await createFolder(db, '  Payments ');
    expect(folder.name).toBe('Payments');
    await expect(createFolder(db, '  ')).rejects.toMatchObject({ code: 'empty' });
    await expect(createFolder(db, ' payments ')).rejects.toMatchObject({ code: 'duplicate' });
    await expect(createFolder(db, 'x'.repeat(61))).rejects.toBeInstanceOf(FolderNameError);
    expect((await liveFolders(db)).map((f) => f.name)).toEqual(['Payments']);
  });

  it('renames with the same rules; its own name in another case is fine', async () => {
    const db = await freshDb();
    const a = await createFolder(db, 'Payments');
    await createFolder(db, 'Logistics');
    await expect(renameFolder(db, a.id, 'LOGISTICS')).rejects.toMatchObject({
      code: 'duplicate',
    });
    await expect(renameFolder(db, a.id, '')).rejects.toMatchObject({ code: 'empty' });
    await renameFolder(db, a.id, 'PAYMENTS');
    expect((await db.folders.get(a.id))?.name).toBe('PAYMENTS');
  });

  it('soft-deletes a folder: decks go to Unfiled and the name is free again', async () => {
    const db = await freshDb();
    const f = await createFolder(db, 'Payments');
    await insertDeck(db, deckRecord('a', { folderId: f.id }), bytes(1));
    await insertDeck(db, deckRecord('b', { folderId: f.id }), bytes(1));
    await insertDeck(db, deckRecord('c'), bytes(1));

    const { deckIds } = await softDeleteFolder(db, f.id);
    expect(deckIds.sort()).toEqual(['a', 'b']);
    expect((await db.decks.get('a'))?.folderId).toBeNull();
    expect(await liveFolders(db)).toEqual([]);

    const again = await createFolder(db, 'payments');
    expect(again.name).toBe('payments');
  });

  it('restores a folder and its decks, unless the name was reused', async () => {
    const db = await freshDb();
    const f = await createFolder(db, 'Payments');
    await insertDeck(db, deckRecord('a', { folderId: f.id }), bytes(1));
    const { deckIds } = await softDeleteFolder(db, f.id);

    await restoreFolder(db, f.id, deckIds);
    expect((await liveFolders(db)).map((x) => x.name)).toEqual(['Payments']);
    expect((await db.decks.get('a'))?.folderId).toBe(f.id);

    const second = await softDeleteFolder(db, f.id);
    await createFolder(db, 'PAYMENTS');
    await expect(restoreFolder(db, f.id, second.deckIds)).rejects.toMatchObject({
      code: 'duplicate',
    });
  });

  it('keeps a deck that was moved elsewhere meanwhile where it is on restore', async () => {
    const db = await freshDb();
    const f = await createFolder(db, 'Payments');
    const g = await createFolder(db, 'Other');
    await insertDeck(db, deckRecord('a', { folderId: f.id }), bytes(1));
    const { deckIds } = await softDeleteFolder(db, f.id);
    await moveDeck(db, 'a', g.id);
    await restoreFolder(db, f.id, deckIds);
    expect((await db.decks.get('a'))?.folderId).toBe(g.id);
  });
});

describe('purgeDeleted', () => {
  it('removes soft-deleted decks with their updates, and deleted folders', async () => {
    const db = await freshDb();
    await insertDeck(db, deckRecord('gone'), bytes(1));
    await insertDeck(db, deckRecord('kept'), bytes(1));
    await softDeleteDeck(db, 'gone');
    const f = await createFolder(db, 'Old');
    await softDeleteFolder(db, f.id);

    await purgeDeleted(db);
    expect(await db.decks.toCollection().primaryKeys()).toEqual(['kept']);
    expect(await db.updates.where('deckId').equals('gone').count()).toBe(0);
    expect(await db.updates.where('deckId').equals('kept').count()).toBe(1);
    expect(await db.folders.count()).toBe(0);
  });
});
