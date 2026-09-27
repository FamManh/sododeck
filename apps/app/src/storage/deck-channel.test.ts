import { createEditor, fromJSON, toJSON, type DeckDoc, type DeckEditor } from '@sododeck/model';
import { emptySododeckFile } from '@sododeck/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { deckRecord, freshLibraryDb } from '../test/library-fixtures';
import { attachDeckChannel, type DeckChannel } from './deck-channel';
import { attachDeckPersistence, storageOrigin, type DeckPersistence } from './deck-persistence';
import { insertDeck, loadDeckLog, type LibraryDb } from './library-db';

/** In-memory BroadcastChannel: delivers to the other instances of a name, asynchronously. */
class FakeChannel {
  static open = new Map<string, Set<FakeChannel>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) {
    const peers = FakeChannel.open.get(name) ?? new Set();
    peers.add(this);
    FakeChannel.open.set(name, peers);
  }
  postMessage(data: unknown) {
    for (const peer of FakeChannel.open.get(this.name) ?? []) {
      if (peer === this) continue;
      queueMicrotask(() => {
        peer.onmessage?.({ data } as MessageEvent);
      });
    }
  }
  close() {
    FakeChannel.open.get(this.name)?.delete(this);
  }
}

const DECK = 'deck-1';
let db: LibraryDb;
const cleanup: (() => void)[] = [];

interface Tab {
  doc: DeckDoc;
  editor: DeckEditor;
  persistence: DeckPersistence;
  channel: DeckChannel;
}

async function openTab(): Promise<Tab> {
  const log = await loadDeckLog(db, DECK);
  const doc = new Y.Doc();
  for (const bytes of log?.bytes ?? []) Y.applyUpdate(doc, bytes, storageOrigin);
  const editor = createEditor(doc);
  const persistence = attachDeckPersistence(db, DECK, doc, { snapshot: () => toJSON(doc) });
  await persistence.whenLoaded;
  const channel = attachDeckChannel(DECK, doc, { persistence });
  cleanup.push(() => {
    channel.destroy();
    persistence.destroy();
  });
  return { doc, editor, persistence, channel };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const titles = (tab: Tab) =>
  toJSON(tab.doc)
    .nodes.map((n) => n.title)
    .sort();

beforeEach(async () => {
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  db = await freshLibraryDb();
  const doc = fromJSON({
    ...emptySododeckFile(),
    name: 'Shop',
    nodes: [
      { id: 'a', type: 'service', title: 'A' },
      { id: 'b', type: 'service', title: 'B' },
    ],
  });
  await insertDeck(db, deckRecord(DECK), Y.encodeStateAsUpdate(doc));
});

afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  FakeChannel.open.clear();
  vi.unstubAllGlobals();
});

describe('deck channel', () => {
  it('shows an edit of tab A in tab B, which neither relays nor stores it', async () => {
    const a = await openTab();
    const b = await openTab();
    await settle(); // the hello/diff handshake
    const sent = vi.spyOn(FakeChannel.prototype, 'postMessage');
    a.editor.update('nodes', 'a', { title: 'A renamed' });
    await settle();
    expect(titles(b)).toEqual(['A renamed', 'B']);
    // A posted its update; B posted nothing back.
    expect(sent).toHaveBeenCalledTimes(1);

    await a.persistence.flush();
    await b.persistence.flush();
    const rows = await db.updates.where('deckId').equals(DECK).count();
    expect(rows).toBe(2); // the deck + A's one write
  });

  it('merges simultaneous edits of different and of the same item', async () => {
    const a = await openTab();
    const b = await openTab();
    a.editor.update('nodes', 'a', { title: 'From A' });
    b.editor.update('nodes', 'b', { title: 'From B' });
    await settle();
    expect(titles(a)).toEqual(['From A', 'From B']);
    expect(titles(b)).toEqual(['From A', 'From B']);

    a.editor.update('nodes', 'a', { title: 'A wins?' });
    b.editor.update('nodes', 'a', { title: 'B wins?' });
    await settle();
    expect(toJSON(a.doc)).toEqual(toJSON(b.doc));

    await a.persistence.flush();
    await b.persistence.flush();
    const log = await loadDeckLog(db, DECK);
    const stored = new Y.Doc();
    for (const bytes of log?.bytes ?? []) Y.applyUpdate(stored, bytes);
    expect(toJSON(stored)).toEqual(toJSON(a.doc));
  });

  it('gives a newly opened tab the edits another tab has not stored yet', async () => {
    const a = await openTab();
    a.editor.add('nodes', { id: 'c', type: 'service', title: 'Unflushed' });
    const b = await openTab(); // storage does not have "Unflushed" yet
    await settle();
    await settle();
    expect(titles(b)).toContain('Unflushed');
  });

  it('undoes only this tab’s own edit', async () => {
    const a = await openTab();
    const b = await openTab();
    b.editor.update('nodes', 'b', { title: 'B edit' });
    await settle();
    a.editor.update('nodes', 'a', { title: 'A edit' });
    await settle();
    expect(b.editor.undo()).toBe(true);
    await settle();
    expect(titles(b)).toEqual(['A edit', 'B']);
    expect(titles(a)).toEqual(['A edit', 'B']);
    expect(b.editor.canUndo()).toBe(false);
  });

  it('catches up from storage on focus without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const a = await openTab();
    const b = await openTab();
    a.editor.update('nodes', 'a', { title: 'Stored by A' });
    await a.persistence.flush();
    await settle();
    expect(titles(b)).toEqual(['A', 'B']);
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => {
      expect(titles(b)).toEqual(['B', 'Stored by A']);
    });
    expect(b.editor.canUndo()).toBe(false);
  });
});
