# 0007. Local deck storage: one Dexie database, our own Yjs provider, live multi-tab sync

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/005-local-library-autosave` (spec, research R1–R16, contracts)

## Context

Feature 005 turns the in-memory editor into a browser-stored deck library. Guests have no
account, so the browser is the only place their work lives, and "guest data loss" is a top
product risk. The spec asks for three things that shape the storage layer:

- every edit is durable within 500 ms, and the editor shows a **truthful** status: "Saving…",
  "Saved in this browser", or "Couldn't save — export a backup" when a write fails (quota,
  blocked storage), with Retry (FR-001–FR-006);
- the library lists decks with cached name, counts and a thumbnail that must never disagree with
  the stored content after a crash;
- the same deck open in several tabs stays editable in all of them and never loses an edit
  (FR-035–FR-038, clarified 2026-09-27: live sync, not a lock).

`y-indexeddb`, listed as a dependency since M0, writes fire-and-forget into one database per
deck. It cannot tell us when a write failed, and it cannot share a transaction with the library
metadata.

## Decision

1. **One Dexie database, `sododeck-library` v2**, with three tables: `decks` (library records),
   `folders`, and `updates` (`++seq, deckId, [deckId+seq]`). Deck content is stored **only** as
   an append-only log of Yjs updates in `updates`; the record's `name`, counts and thumbnail are
   derived caches written from the document, never read back into it (constitution I).

2. **Our own Yjs provider, `deck-persistence.ts`**, replaces `y-indexeddb` (removed). It buffers
   updates whose origin is not storage or another tab, flushes 100 ms after the first buffered
   update (not debounced, so a long drag still saves every 100 ms), merges the batch with
   `Y.mergeUpdates`, and writes the row **and** the record's cache fields in one Dexie
   transaction. The log is compacted (merged into one row) on open and when it grows past 200
   rows. `pagehide` and `visibilitychange → hidden` flush.

3. **Save status is driven by real write promises.** The provider emits `pending`, `saved` and
   `failed` events; a UI-only Zustand slice turns them into the pill. "Saving…" is shown for at
   least 200 ms (anti-flicker) and "Saved in this browser" appears at most 300 ms after the write
   resolved. A failed write keeps the buffer in memory; the next edit or ⌘S retries, and the error
   state clears only when a write succeeds. Export always uses the live document, so it works
   while storage is broken.

4. **Live multi-tab sync instead of a lock** (`deck-channel.ts`). Each open deck joins
   `BroadcastChannel('sododeck:deck:<id>')`, posts its local updates, and exchanges state vectors
   on open (`hello` / `diff`) so tabs with unflushed edits converge. Received updates carry a
   dedicated origin: they are not re-broadcast, not persisted by the receiver (the sender persists
   its own), and not tracked by the receiver's `UndoManager`, so undo stays per tab with no model
   change. On focus, each tab also reads rows it has not seen from `updates` (catch-up); this is
   the whole mechanism where `BroadcastChannel` is missing. The library itself reads through
   Dexie `liveQuery`, which already propagates between tabs.

5. **Soft delete with a session Undo.** Deleting a deck or folder (after a confirm dialog) sets
   `deletedAt`; a folder delete moves its decks to Unfiled and remembers them. Undo (toast or ⌘Z
   in the library) clears `deletedAt`. `purgeDeleted()` hard-deletes on the next app start, so a
   delete is final after a reload. A soft-deleted folder's unique `nameKey` is rewritten so the
   name can be reused.

6. **Library operations that need the model run in a worker** (`library.worker.ts` →
   `library-ops.ts`): import (parse + validate), export, rename, duplicate. The library route never
   loads Yjs or the model.

## Consequences

- One provider of ~200 lines that we own and unit-test with an in-memory IndexedDB
  (`fake-indexeddb`, dev dependency only). One runtime dependency removed.
- Library cards can never show a deck whose content was not written, nor stale counts after a
  crash: both change in one transaction.
- The persisted Yjs layout (ADR 0005) is now a storage format; changing it needs a migration.
- A tab that crashes loses at most ~100 ms of its own edits. A receiving tab does not persist
  relayed updates, so if the sender dies before flushing, those edits survive only in the
  receiver's memory until the receiver edits again (then its next flush does not include them).
  Accepted: the window is ≤ 100 ms.
- Concurrent edits of the same scalar field resolve by Yjs last-writer-wins, identically in all
  tabs.

## Alternatives considered

- **Keep `y-indexeddb`** and wrap it: no per-write promise (cannot show failures or retry), one
  database per deck (no shared transaction with the library record).
- **Store `toJSON` snapshots per save**: O(deck) per keystroke and no CRDT merge between tabs.
- **Edit lock with a read-only second tab** (design frame 82): rejected by the founder (§g-35);
  live sync is simpler for users and costs little with Yjs.
- **`y-webrtc` BroadcastChannel mode**: a new dependency with signalling code we do not need.
- **`localStorage`**: 5 MB, synchronous, strings only (spec G-1).
