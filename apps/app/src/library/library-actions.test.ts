import { fromJSON, serializeDeck, toJSON } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import * as download from '../storage/download';
import {
  createFolder,
  insertDeck,
  liveDecks,
  loadDeckLog,
  type LibraryDb,
} from '../storage/library-db';
import { inProcessLibraryClient } from '../test/in-process-library-client';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import {
  deleteDeck,
  deleteFolder,
  duplicateDeck,
  exportDeckFile,
  importDeckFile,
  moveDeckTo,
  renameDeck,
  renameFolderInline,
  undoLastDelete,
  type LibraryActionContext,
} from './library-actions';
import { resetLibraryStore } from './library-store';

let db: LibraryDb;
let ctx: LibraryActionContext;
const file = {
  ...emptySododeckFile(),
  name: 'Shop',
  nodes: [{ id: 'a', type: 'service' as const, title: 'Orders' }],
};

async function contentOf(id: string) {
  const log = await loadDeckLog(db, id);
  const doc = new Y.Doc();
  for (const bytes of log?.bytes ?? []) Y.applyUpdate(doc, bytes);
  return toJSON(doc);
}

beforeEach(async () => {
  resetLibraryStore();
  db = await freshLibraryDb();
  ctx = { db, client: inProcessLibraryClient(), now: () => 42 };
  await insertDeck(
    db,
    deckRecord('d1', { name: 'Shop', nodeCount: 1 }),
    Y.encodeStateAsUpdate(fromJSON(file)),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('library actions', () => {
  it('renames through the model and refuses empty or unchanged names', async () => {
    expect(await renameDeck(ctx, 'd1', '  Store ')).toBe(true);
    expect((await db.decks.get('d1'))?.name).toBe('Store');
    expect((await contentOf('d1')).name).toBe('Store');
    expect(await renameDeck(ctx, 'd1', '   ')).toBe(false);
    expect(await renameDeck(ctx, 'd1', 'Store')).toBe(false);
  });

  it('duplicates into the same folder with independent content', async () => {
    const folder = await createFolder(db, 'Payments');
    await moveDeckTo(ctx, 'd1', folder.id);
    const copyId = await duplicateDeck(ctx, 'd1');
    const copy = await db.decks.get(copyId);
    expect(copy).toMatchObject({ name: 'Shop copy', folderId: folder.id, nodeCount: 1 });
    await renameDeck(ctx, copyId, 'Other');
    expect((await contentOf('d1')).name).toBe('Shop');
    expect({ ...(await contentOf(copyId)), name: 'Shop' }).toEqual(file);
  });

  it('deletes and undoes a deck, then a folder with its decks', async () => {
    await deleteDeck(ctx, 'd1', 'Shop');
    expect(await liveDecks(db)).toEqual([]);
    expect(await undoLastDelete(ctx)).toMatchObject({ ok: true, entry: { kind: 'deck' } });
    expect((await contentOf('d1')).nodes).toHaveLength(1);

    const folder = await createFolder(db, 'Payments');
    await moveDeckTo(ctx, 'd1', folder.id);
    await deleteFolder(ctx, folder.id, 'Payments');
    expect((await db.decks.get('d1'))?.folderId).toBeNull();
    expect(await undoLastDelete(ctx)).toMatchObject({ ok: true });
    expect((await db.decks.get('d1'))?.folderId).toBe(folder.id);
    expect(await undoLastDelete(ctx)).toBeNull();
  });

  it('explains a folder undo that clashes with a newer folder', async () => {
    const folder = await createFolder(db, 'Payments');
    await deleteFolder(ctx, folder.id, 'Payments');
    await createFolder(db, 'payments');
    expect(await undoLastDelete(ctx)).toMatchObject({
      ok: false,
      message: `Couldn't restore "Payments": a folder with that name exists.`,
    });
  });

  it('renames folders inline with validation', async () => {
    const a = await createFolder(db, 'Payments');
    await createFolder(db, 'Logistics');
    expect(await renameFolderInline(ctx, a.id, ' logistics')).toBe('duplicate');
    expect(await renameFolderInline(ctx, a.id, '')).toBe('empty');
    expect(await renameFolderInline(ctx, a.id, 'Billing')).toBeNull();
  });

  it('exports the stored deck and records the export', async () => {
    const downloadText = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
    await exportDeckFile(ctx, 'd1');
    expect(downloadText).toHaveBeenCalledWith('Shop.sododeck.json', serializeDeck(file));
    expect((await db.decks.get('d1'))?.exportedAt).toBe(42);
  });

  it('imports a file as a new deck in the given folder', async () => {
    const name = await importDeckFile(ctx, serializeDeck({ ...file, name: 'Imported shop' }), null);
    expect(name).toBe('Imported shop');
    const decks = await liveDecks(db);
    expect(decks.map((d) => d.name).sort()).toEqual(['Imported shop', 'Shop']);
  });
});
