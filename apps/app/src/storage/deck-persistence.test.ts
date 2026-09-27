import { createEditor, fromJSON, toJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import { attachDeckPersistence, storageOrigin, type DeckPersistence } from './deck-persistence';
import { insertDeck, loadDeckLog, type LibraryDb } from './library-db';
import { channelOrigin } from './origins';
import type { SaveEvent } from './save-status';

const DECK = 'deck-1';

let db: LibraryDb;
let events: SaveEvent[];
const attached: DeckPersistence[] = [];

beforeEach(async () => {
  // Only timers and the clock are fake: fake-indexeddb schedules with setImmediate.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(1_000_000);
  db = await freshLibraryDb();
  events = [];
  const doc = fromJSON({ ...emptySododeckFile(), name: 'Shop' });
  await insertDeck(
    db,
    deckRecord(DECK, { name: 'Shop', updatedAt: 1 }),
    Y.encodeStateAsUpdate(doc),
  );
});

afterEach(() => {
  for (const p of attached.splice(0)) p.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function open(options: Parameters<typeof attachDeckPersistence>[3] = {}) {
  const log = await loadDeckLog(db, DECK);
  if (!log) throw new Error('missing deck');
  const doc: DeckDoc = new Y.Doc();
  doc.transact(() => {
    for (const bytes of log.bytes) Y.applyUpdate(doc, bytes, storageOrigin);
  }, storageOrigin);
  const editor = createEditor(doc);
  const persistence = attachDeckPersistence(db, DECK, doc, {
    snapshot: () => toJSON(doc),
    onStatus: (event) => events.push(event),
    ...options,
  });
  attached.push(persistence);
  await persistence.whenLoaded;
  return { doc, editor, persistence };
}

const rows = () => db.updates.where('deckId').equals(DECK).count();
const record = async () => {
  const deck = await db.decks.get(DECK);
  if (!deck) throw new Error('missing record');
  return deck;
};

async function reload(): Promise<DeckDoc> {
  const log = await loadDeckLog(db, DECK);
  const doc = new Y.Doc();
  for (const bytes of log?.bytes ?? []) Y.applyUpdate(doc, bytes);
  return doc;
}

const addNode = (editor: DeckEditor, title: string) =>
  editor.add('nodes', { type: 'service', title, position: { x: 0, y: 0 } });

describe('deck persistence', () => {
  it('loads the stored log without an undo step or a status event', async () => {
    const { doc, editor } = await open();
    expect(toJSON(doc).name).toBe('Shop');
    expect(editor.canUndo()).toBe(false);
    expect(events).toEqual([]);
  });

  it('writes a local edit 100 ms later as one row with the cached fields', async () => {
    const { editor, persistence } = await open();
    const before = await rows();
    addNode(editor, 'Orders');
    expect(events).toEqual([{ type: 'pending' }]);

    await vi.advanceTimersByTimeAsync(99);
    expect(await rows()).toBe(before);
    await vi.advanceTimersByTimeAsync(1);
    await persistence.flush();

    expect(await rows()).toBe(before + 1);
    expect(await record()).toMatchObject({
      name: 'Shop',
      nodeCount: 1,
      updatedAt: 1_000_100,
    });
    expect((await record()).thumb?.nodes).toHaveLength(1);
    expect(events).toEqual([{ type: 'pending' }, { type: 'saved', at: 1_000_100 }]);
  });

  it('writes a 200 ms drag (a change every 16 ms) in at most 3 rows', async () => {
    const { editor, persistence } = await open();
    const id = addNode(editor, 'A');
    await persistence.flush();
    const before = await rows();
    editor.beginGesture();
    for (let t = 0; t <= 200; t += 16) {
      editor.update('nodes', id, { position: { x: t, y: t } });
      await vi.advanceTimersByTimeAsync(16);
    }
    editor.endGesture();
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect((await rows()) - before).toBeLessThanOrEqual(3);
    expect(toJSON(await reload()).nodes[0]?.position).toEqual({ x: 192, y: 192 });
  });

  it('never writes updates from storage or from another tab', async () => {
    const { doc, persistence } = await open();
    const before = await rows();
    const other = createEditor(fromJSON({ ...emptySododeckFile(), name: 'x' }));
    const remote = Y.encodeStateAsUpdate(other.doc);
    Y.applyUpdate(doc, remote, channelOrigin);
    Y.applyUpdate(doc, remote, storageOrigin);
    await vi.advanceTimersByTimeAsync(200);
    await persistence.flush();
    expect(await rows()).toBe(before);
    expect(events).toEqual([]);
    expect((await record()).updatedAt).toBe(1);
  });

  it('rewrites the thumbnail at most every 2 s', async () => {
    const { editor, persistence } = await open();
    addNode(editor, 'A');
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect((await record()).thumb?.nodes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(500);
    addNode(editor, 'B');
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect(await record()).toMatchObject({ nodeCount: 2 });
    expect((await record()).thumb?.nodes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2000);
    addNode(editor, 'C');
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect((await record()).thumb?.nodes).toHaveLength(3);
  });

  it('compacts the log past the limit and on open, and reloads the same deck', async () => {
    const { doc, editor, persistence } = await open({ compactAbove: 5 });
    // 1 row from the insert, then 5 writes: the 6th row triggers compaction.
    for (let i = 0; i < 5; i++) {
      addNode(editor, `N${String(i)}`);
      await persistence.flush();
    }
    expect(await rows()).toBe(1);
    expect(toJSON(await reload())).toEqual(toJSON(doc));

    addNode(editor, 'Extra');
    await persistence.flush();
    expect(await rows()).toBe(2);
    await open();
    expect(await rows()).toBe(1);
    expect(toJSON(await reload()).nodes).toHaveLength(6);
  });

  it('reports a failed write, keeps the edit and retries on the next edit or flush', async () => {
    const { editor, persistence } = await open();
    const add = vi
      .spyOn(db.updates, 'add')
      .mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    addNode(editor, 'A');
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect(events.at(-1)).toEqual({
      type: 'failed',
      firstUnsavedAt: 1_000_000,
      errorName: 'QuotaExceededError',
    });

    await vi.advanceTimersByTimeAsync(1000);
    addNode(editor, 'B');
    await vi.advanceTimersByTimeAsync(100);
    await persistence.flush();
    expect(events.at(-1)).toMatchObject({ type: 'failed', firstUnsavedAt: 1_000_000 });

    add.mockRestore();
    await persistence.flush();
    expect(events.at(-1)).toMatchObject({ type: 'saved' });
    expect(toJSON(await reload()).nodes.map((n) => n.title)).toEqual(['A', 'B']);
  });

  it('flushes on destroy and on pagehide', async () => {
    const first = await open();
    addNode(first.editor, 'A');
    window.dispatchEvent(new Event('pagehide'));
    await first.persistence.flush();
    expect(toJSON(await reload()).nodes).toHaveLength(1);

    addNode(first.editor, 'B');
    first.persistence.destroy();
    await vi.advanceTimersByTimeAsync(0);
    // destroy() queued the write; wait for fake-indexeddb.
    await new Promise((resolve) => setImmediate(resolve));
    await vi.waitFor(async () => {
      expect(toJSON(await reload()).nodes).toHaveLength(2);
    });
  });

  it('catches up with rows another tab wrote', async () => {
    const a = await open();
    const b = await open();
    addNode(a.editor, 'From A');
    await a.persistence.flush();
    expect(toJSON(b.doc).nodes).toHaveLength(0);
    await b.persistence.catchUp();
    expect(toJSON(b.doc).nodes.map((n) => n.title)).toEqual(['From A']);
    expect(b.editor.canUndo()).toBe(false);
    expect(b.persistence.lastSeq()).toBeGreaterThan(0);
  });

  it('stores a delta made outside the editor', async () => {
    const { doc, persistence } = await open();
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    const before = Y.encodeStateVector(other);
    createEditor(other).updateMeta({ name: 'Renamed' });
    await persistence.storeRemoteDelta(Y.encodeStateAsUpdate(other, before));
    expect(toJSON(doc).name).toBe('Renamed');
    expect((await record()).name).toBe('Renamed');
    expect(toJSON(await reload()).name).toBe('Renamed');
  });
});
