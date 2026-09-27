import type { DeckDoc } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import * as Y from 'yjs';

import { isQuotaError } from '../lib/features';
import { readDeck } from '../model/use-deck-snapshot';
import { summarizeDeck } from './deck-summary';
import { deckRows, storeDeckUpdate, type DeckCache, type LibraryDb } from './library-db';
import { isOwnUpdate, storageOrigin } from './origins';
import type { SaveEvent } from './save-status';

export { storageOrigin };

export interface DeckPersistence {
  /** Resolves once the stored log is applied (storage origin: not an edit, not undoable). */
  readonly whenLoaded: Promise<void>;
  /** Writes the buffer now (⌘S, Retry, pagehide). Resolves when the write settled. */
  flush(): Promise<void>;
  /** Applies a change made outside the editor (library worker) and stores it. */
  storeRemoteDelta(bytes: Uint8Array): Promise<void>;
  /** Highest `seq` of the deck's log this tab has applied (catch-up). */
  lastSeq(): number;
  /** Applies rows other tabs wrote since `lastSeq()` (focus, or no BroadcastChannel). */
  catchUp(): Promise<void>;
  /** Flushes, then stops listening. */
  destroy(): void;
}

export interface PersistenceOptions {
  /** Time from the first buffered update to its write. Not a debounce (research R2). */
  flushMs?: number;
  thumbEveryMs?: number;
  /** Rows above which the log is merged into one. */
  compactAbove?: number;
  onStatus?: (event: SaveEvent) => void;
  now?: () => number;
  /** The deck as JSON; defaults to the shared incremental snapshot of `doc`. */
  snapshot?: () => SododeckFile;
}

function errorName(error: unknown): string {
  if (isQuotaError(error)) return 'QuotaExceededError';
  if (error instanceof Error || error instanceof DOMException) return error.name;
  return 'UnknownError';
}

/**
 * The deck's storage provider (research R1–R3, ADR 0007). Buffers this tab's updates and writes
 * them 100 ms after the first one as one merged row, together with the library record's cached
 * fields, in one transaction. Every write reports `pending` / `saved` / `failed`; a failed write
 * keeps its updates for the next attempt.
 */
export function attachDeckPersistence(
  db: LibraryDb,
  deckId: string,
  doc: DeckDoc,
  options: PersistenceOptions = {},
): DeckPersistence {
  const {
    flushMs = 100,
    thumbEveryMs = 2000,
    compactAbove = 200,
    onStatus,
    now = Date.now,
    snapshot = () => readDeck(doc),
  } = options;

  let buffer: Uint8Array[] = [];
  let firstBufferedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seen = 0;
  let rowCount = 0;
  let lastThumbAt = -Infinity;
  /** Rows this tab wrote: catch-up need not apply them again. */
  const own = new Set<number>();
  let queue: Promise<void> = Promise.resolve();
  let destroyed = false;

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    queue = queue.then(task, task);
    return queue;
  };

  const apply = (rows: readonly { seq: number; bytes: Uint8Array }[]) => {
    const fresh = rows.filter((row) => !own.has(row.seq));
    if (fresh.length > 0) {
      doc.transact(() => {
        for (const row of fresh) Y.applyUpdate(doc, row.bytes, storageOrigin);
      }, storageOrigin);
    }
    for (const row of rows) seen = Math.max(seen, row.seq);
  };

  const cache = (): DeckCache => {
    const file = snapshot();
    if (now() - lastThumbAt < thumbEveryMs) {
      return {
        name: file.name ?? 'Untitled deck',
        nodeCount: file.nodes.length,
        edgeCount: file.edges.length,
        flowCount: file.flows.length,
      };
    }
    lastThumbAt = now();
    return summarizeDeck(file);
  };

  /** Merges the whole log into one row (on open and when it grows past `compactAbove`). */
  const compact = async () => {
    const merged = await db.transaction('rw', db.updates, async () => {
      const rows = await deckRows(db, deckId, 0);
      if (rows.length < 2) return null;
      const bytes = Y.mergeUpdates(rows.map((row) => row.bytes));
      await db.updates.bulkDelete(rows.map((row) => row.seq));
      const seq = await db.updates.add({ deckId, bytes });
      return { seq, bytes };
    });
    if (!merged) return;
    rowCount = 1;
    // The merged row may hold rows of other tabs this tab has not seen yet: apply it.
    apply([merged]);
  };

  const write = async () => {
    if (buffer.length === 0) return;
    // Updates that arrive during the write stay in the buffer for the next one.
    const count = buffer.length;
    const batch = buffer.slice(0, count);
    const bytes = batch.length === 1 && batch[0] ? batch[0] : Y.mergeUpdates(batch);
    const lastThumb = lastThumbAt;
    try {
      const seq = await storeDeckUpdate(db, deckId, bytes, { at: now(), summary: cache() });
      own.add(seq);
      rowCount++;
      buffer = buffer.slice(count);
      if (buffer.length === 0) onStatus?.({ type: 'saved', at: now() });
      else firstBufferedAt = now();
    } catch (error) {
      lastThumbAt = lastThumb;
      onStatus?.({ type: 'failed', firstUnsavedAt: firstBufferedAt, errorName: errorName(error) });
      return;
    }
    if (rowCount > compactAbove) {
      try {
        await compact();
      } catch {
        // Compaction only saves space; the log stays valid without it.
      }
    }
  };

  const flush = (): Promise<void> => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    return enqueue(write);
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (destroyed || !isOwnUpdate(origin)) return;
    if (buffer.length === 0) {
      firstBufferedAt = now();
      onStatus?.({ type: 'pending' });
    }
    buffer.push(update);
    timer ??= setTimeout(() => {
      timer = undefined;
      void enqueue(write);
    }, flushMs);
  };

  const onPageHide = () => {
    void flush();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush();
  };

  const whenLoaded = enqueue(async () => {
    try {
      const rows = await deckRows(db, deckId, 0);
      apply(rows);
      rowCount = rows.length;
      if (rowCount > 1) await compact();
    } catch {
      // The page already has the deck from its loader; a failing read shows up on the next write.
    }
  });

  doc.on('update', onUpdate);
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
  }

  return {
    whenLoaded,
    flush,
    storeRemoteDelta: (bytes) => {
      Y.applyUpdate(doc, bytes, storageOrigin);
      return enqueue(async () => {
        const seq = await storeDeckUpdate(db, deckId, bytes, { at: now(), summary: cache() });
        own.add(seq);
        rowCount++;
      });
    },
    lastSeq: () => seen,
    catchUp: () =>
      enqueue(async () => {
        try {
          apply(await deckRows(db, deckId, seen));
        } catch {
          // Try again on the next focus.
        }
      }),
    destroy: () => {
      if (destroyed) return;
      void flush();
      destroyed = true;
      doc.off('update', onUpdate);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    },
  };
}
