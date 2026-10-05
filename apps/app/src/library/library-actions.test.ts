import {
  assetId,
  createEditor,
  fromJSON,
  MISSING_DATA,
  serializeDeck,
  toJSON,
} from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { getBlobRow, listBlobIds, putBlob } from '../storage/blob-store';
import * as download from '../storage/download';
import {
  createFolder,
  insertDeck,
  liveDecks,
  loadDeckLog,
  type LibraryDb,
} from '../storage/library-db';
import { inProcessLibraryClient } from '../test/in-process-library-client';
import { PNG_1X1 } from '../images/test-pictures';
import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import {
  deleteDeck,
  deleteFolder,
  duplicateDeck,
  exportDeckFile,
  importDeckFile,
  importedMessage,
  importMermaidDeck,
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
    expect(downloadText).toHaveBeenCalledWith('Shop.sododeck', serializeDeck(file));
    expect((await db.decks.get('d1'))?.exportedAt).toBe(42);
  });

  it('imports a file as a new deck in the given folder', async () => {
    const { name } = await importDeckFile(
      ctx,
      serializeDeck({ ...file, name: 'Imported shop' }),
      null,
    );
    expect(name).toBe('Imported shop');
    const decks = await liveDecks(db);
    expect(decks.map((d) => d.name).sort()).toEqual(['Imported shop', 'Shop']);
  });

  describe('pictures (055)', () => {
    const pictureId = assetId(PNG_1X1);
    const meta = {
      type: 'image/png' as const,
      bytes: PNG_1X1.length,
      width: 1,
      height: 1,
      name: 'dot.png',
    };

    /** A deck file with one image whose picture bytes are `PNG_1X1`. */
    function imageDeckJson(withBytes = true): string {
      const doc = fromJSON(file);
      createEditor(doc).addImages([
        {
          asset: pictureId,
          meta,
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
        },
      ]);
      return serializeDeck(doc, withBytes ? new Map([[pictureId, PNG_1X1]]) : new Map());
    }

    it('imports a file with pictures: the bytes reach the blob store of the new deck', async () => {
      const result = await importDeckFile(ctx, imageDeckJson(), null);
      expect(result.missingPictures).toBe(0);
      const deck = (await liveDecks(db)).find((d) => d.name === 'Shop' && d.id !== 'd1');
      expect(deck).toBeDefined();
      const row = await getBlobRow(db, deck?.id ?? '', pictureId);
      expect(row?.type).toBe('image/png');
      expect([...(row?.bytes ?? [])]).toEqual([...PNG_1X1]);
    });

    it('imports a file whose picture data is damaged: opens, counts it, stores nothing', async () => {
      const damaged = imageDeckJson().replace(/"data": ?"[^"]*"/, `"data":"${MISSING_DATA}"`);
      const result = await importDeckFile(ctx, damaged, null);
      expect(result.missingPictures).toBe(1);
      const ids = (await liveDecks(db)).map((d) => d.id).filter((id) => id !== 'd1');
      expect(await listBlobIds(db, ids[0] ?? '')).toEqual([]);
    });

    it('counts image crops trimmed to the picture edge (057)', async () => {
      const text = imageDeckJson().replace(
        /("size": \{[^}]*\})/,
        '$1,\n"crop": { "x": 0.6, "y": 0, "width": 0.6, "height": 1 }',
      );
      expect(text).toContain('"crop"');
      const result = await importDeckFile(ctx, text, null);
      expect(result).toMatchObject({ missingPictures: 0, trimmedCrops: 1 });
      expect((await importDeckFile(ctx, imageDeckJson(), null)).trimmedCrops).toBe(0);
    });

    it('exports the pictures its images use, byte for byte', async () => {
      const stored = fromJSON(JSON.parse(imageDeckJson(false)));
      await insertDeck(db, deckRecord('d2', { name: 'Pics' }), Y.encodeStateAsUpdate(stored));
      await putBlob(db, 'd2', pictureId, { type: 'image/png', bytes: PNG_1X1 });
      await putBlob(db, 'd2', 'f'.repeat(64), { type: 'image/png', bytes: new Uint8Array([1]) });
      const spy = vi.spyOn(download, 'downloadText').mockImplementation(() => undefined);
      await exportDeckFile(ctx, 'd2');
      const [, json] = spy.mock.calls[0] ?? [];
      expect(json).toBe(serializeDeck(stored, new Map([[pictureId, PNG_1X1]])));
    });

    it('duplicates a deck with its pictures under the new deck id', async () => {
      await insertDeck(
        db,
        deckRecord('d2', { name: 'Pics' }),
        Y.encodeStateAsUpdate(fromJSON(JSON.parse(imageDeckJson(false)))),
      );
      await putBlob(db, 'd2', pictureId, { type: 'image/png', bytes: PNG_1X1 });
      const copyId = await duplicateDeck(ctx, 'd2');
      expect(await listBlobIds(db, copyId)).toEqual([pictureId]);
      expect(await listBlobIds(db, 'd2')).toEqual([pictureId]);
    });
  });

  describe('importMermaidDeck', () => {
    const gridLayout = {
      layout: vi.fn((request: { nodes: { id: string }[] }) =>
        Promise.resolve(
          Object.fromEntries(request.nodes.map((n, i) => [n.id, { x: i * 300, y: 0 }])),
        ),
      ),
    };
    beforeEach(() => {
      gridLayout.layout.mockClear();
      ctx = { ...ctx, layout: gridLayout };
    });

    it('lays out a flowchart and stores it as a new deck', async () => {
      const result = await importMermaidDeck(ctx, 'flowchart LR\nA[Web] --> B(API)', null);
      expect(result.report.counts).toMatchObject({ components: 2, connections: 1 });
      expect(gridLayout.layout).toHaveBeenCalledOnce();
      const stored = await contentOf(result.deckId);
      expect(stored.name).toBe('Imported diagram');
      expect(stored.nodes.map((n) => [n.title, n.position?.x])).toEqual([
        ['Web', 0],
        ['API', 300],
      ]);
      expect((await liveDecks(db)).map((d) => d.id)).toContain(result.deckId);
    });

    it('skips the layout for a sequence diagram', async () => {
      const result = await importMermaidDeck(ctx, 'sequenceDiagram\nA->>B: hi\nB-->>A: ok', 'f1');
      expect(gridLayout.layout).not.toHaveBeenCalled();
      const stored = await contentOf(result.deckId);
      expect(stored.flows[0]?.steps).toHaveLength(2);
      expect((await db.decks.get(result.deckId))?.folderId).toBe('f1');
    });

    it('creates nothing when the text is refused', async () => {
      await expect(importMermaidDeck(ctx, 'erDiagram\nA ||--o{ B : x', null)).rejects.toMatchObject(
        {
          code: 'mermaid-unsupported-type',
        },
      );
      expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Shop']);
    });

    it('creates nothing when the layout fails or is cancelled', async () => {
      gridLayout.layout.mockRejectedValueOnce(new Error('layout cancelled'));
      await expect(importMermaidDeck(ctx, 'flowchart LR\nA --> B', null)).rejects.toThrow(
        'layout cancelled',
      );
      expect((await liveDecks(db)).map((d) => d.name)).toEqual(['Shop']);
    });
  });
});

describe('importedMessage (055, 057)', () => {
  it('names the deck, then missing pictures and trimmed crops, singular or plural', () => {
    expect(importedMessage('Shop', { missingPictures: 0, trimmedCrops: 0 })).toBe(
      'Imported "Shop"',
    );
    expect(importedMessage('Shop', { missingPictures: 2, trimmedCrops: 0 })).toBe(
      'Imported "Shop". 2 pictures are missing from the file.',
    );
    expect(importedMessage('Shop', { missingPictures: 0, trimmedCrops: 1 })).toBe(
      'Imported "Shop". 1 image crop was trimmed to the picture edge.',
    );
    expect(
      importedMessage('Shop', { missingPictures: 1, trimmedCrops: 3 }, ' into the library'),
    ).toBe(
      'Imported "Shop" into the library. 1 picture is missing from the file. 3 image crops were trimmed to the picture edge.',
    );
  });
});
