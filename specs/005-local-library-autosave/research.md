# Research: Local Deck Library and Autosave

Decisions for [plan.md](plan.md). Each item: Decision · Rationale · Alternatives considered.

## R1. Deck content storage: own Yjs provider on Dexie, not y-indexeddb

- **Decision**: Store each deck as an append-only log of Yjs updates in a Dexie table `updates`
  (`++seq, deckId, bytes`), in the same `sododeck-library` database as the metadata. A small
  provider (`deck-persistence.ts`) loads the log into a `Y.Doc`, writes local updates, and compacts.
  Remove `y-indexeddb` from `apps/app/package.json`. Record in ADR 0007.
- **Rationale**:
  - Spec FR-004/FR-005 need to know when a write **failed** (quota, blocked storage) and to retry.
    `y-indexeddb` writes fire-and-forget; its errors surface as unhandled rejections with no
    per-write promise and no retry.
  - The library needs `updatedAt`, cached name, counts and thumbnail to change **in the same
    transaction** as the content, so a crash never shows a stale card or a card for a deck with no
    content. `y-indexeddb` uses one database per deck, so no shared transaction is possible.
  - Delete, soft delete + undo, duplicate and purge become simple row operations in one database.
  - Cross-tab catch-up (R4) can read "rows with `seq` > last seen" cheaply.
  - The provider is ~150 lines and fully unit-testable; the constitution requires storage to attach
    as a Yjs provider, which it does (it listens to `doc.on('update')` and applies stored updates).
- **Alternatives**: keep `y-indexeddb` and wrap it (cannot observe write failures; two databases);
  store `toJSON` snapshots per save (loses CRDT merge for multi-tab, O(deck) per keystroke);
  `localStorage` (5 MB, synchronous — rejected by spec G-1).

## R2. Write pipeline, batching and compaction

- **Decision**:
  - Buffer local updates; flush 100 ms after the first buffered update (not debounced, so a long
    drag still flushes every 100 ms). A flush merges the buffer with `Y.mergeUpdates` and runs one
    Dexie `rw` transaction on `updates` + `decks` (add row; update `updatedAt`, `name`, counts,
    and — at most every 2 s — the thumbnail summary).
  - Also flush on `pagehide` and `visibilitychange → hidden`.
  - Compact when a deck has > 200 rows (checked after a flush) and on open: in one transaction read
    rows ≤ `maxSeq`, `Y.mergeUpdates`, delete them, add the merged row. Idempotent and safe with
    concurrent tabs because re-applying Yjs updates is a no-op.
  - Only updates with the local editor's origins (`local`, `undo`, `redo`) and library-worker deltas
    are written by this tab; updates applied from storage or from the channel are not re-written.
- **Rationale**: 100 ms + one IDB transaction (~5–30 ms) gives ≤ 150 ms durability, well under the
  500 ms target, while keeping a drag at ≤ 10 writes/s. One merged row per flush keeps the log small.
- **Alternatives**: write per Yjs transaction (hundreds of writes per drag); debounce (a long drag
  would not be saved until it ends — breaks FR-001); compact on every flush (O(deck) per write).

## R3. Save status state machine

- **Decision**: per open deck, UI-only Zustand slice `saveStatus`:
  `saved` → (`buffered update`) → `saving` → (`flush resolved`) → `saved`, or (`flush rejected`) →
  `error{firstUnsavedAt, errorName}`. In `error`, new edits stay buffered (in memory) and each new
  edit or ⌘S retries; the state leaves `error` only when a flush resolves. The pill shows
  "Saving…" for at least 200 ms (anti-flicker) and switches to "Saved in this browser" at most
  300 ms after the flush resolved (it resolves typically at ~130 ms, so the hold is ≤ 200 ms).
  Loading, channel and catch-up updates never change the status (FR-007). `prefers-reduced-motion`
  stops the loader spin (token/CSS).
- **Rationale**: matches §g-7 / §g-25 and FR-003–FR-006; the status is truthful (driven by real
  write promises) and cosmetic only in its minimum display time.
- **Alternatives**: fixed 650 ms timer from the design (rejected by §g-25); status without write
  promises (cannot show errors).

## R4. Live multi-tab sync

- **Decision**: `deck-channel.ts` provider per open deck on `BroadcastChannel('sododeck:deck:<id>')`:
  - Local updates (same origins as R2) are posted as `{ t: 'update', from, bytes }`.
  - On open, the tab posts `{ t: 'hello', from, sv }` (its state vector); every peer replies with
    `{ t: 'diff', to, bytes: encodeStateAsUpdate(doc, sv) }` and posts its own `hello` back once, so
    both sides converge even if one had unflushed edits.
  - Received bytes are applied with a dedicated `channelOrigin` object: not re-broadcast, not
    persisted, not tracked by the editor's `UndoManager` (it tracks only the editor origin), so
    **undo stays per tab** (FR-038) with no model change. `observeDeck` reports them as `remote`.
  - Catch-up: on `focus` / `visibilitychange → visible`, read `updates` rows with `seq` > the last
    seq this tab has seen for the deck and apply them with the storage origin. This is also the
    whole mechanism when `BroadcastChannel` is unavailable (feature-detected).
  - Library-worker deltas (rename, …) are posted on the same channel by the library tab so an open
    editor shows them at once.
- **Rationale**: Yjs updates are commutative and idempotent, so relaying them gives convergence
  without locks (§g-35). ≤ 50 ms in practice (FR-036 ≤ 1 s).
- **Risks and handling**: an editor tab that crashes before flushing loses ≤ 100 ms of its own edits
  (same as single-tab); receivers do not persist relayed updates to avoid duplicate writes — the
  sender always persists its own. Tested with two `Y.Doc`s over an in-memory channel, including
  simultaneous edits of the same field (converges to one value) and undo isolation.
- **Alternatives**: edit lock + read-only tab (design 82, rejected §g-35); `y-webrtc`'s
  BroadcastChannel mode (new dependency, signalling code we don't need); `storage` events on
  `localStorage` (5 MB, string-only).

## R5. Library metadata reads and cross-tab library updates

- **Decision**: Dexie `liveQuery` wrapped in a 20-line `useLiveQuery(query, deps)` built on
  `useSyncExternalStore`. Dexie 4 propagates changes between tabs of the same origin, so creates,
  renames, moves, deletes and imports appear in other library tabs without reload (FR-039).
- **Alternatives**: `dexie-react-hooks` (a new dependency for 20 lines); manual BroadcastChannel
  invalidation (duplicates what Dexie already does).

## R6. Deck name and cached fields

- **Decision**: the deck's `name` in the Yjs doc is the truth (spec: name is the file's `name`).
  `DeckRecord.name`, `nodeCount`, `flowCount`, `edgeCount` and `thumb` are caches written in each
  flush from the snapshot. Library rename sends `rename(deckId, name)` to the worker, which loads the
  deck's log into a temporary doc, calls `createEditor(doc).updateMeta({ name })`, and returns the
  delta update; the client stores it like a local update (updating the cache) and posts it on the
  deck channel. Breadcrumb rename in the editor uses `useEditor().updateMeta` directly.
- **Rationale**: constitution I — no second copy of document data that could diverge; the cache is
  derived and overwritten.

## R7. Library operations in a worker

- **Decision**: `library.worker.ts` (thin) calls pure handlers in `library-ops.ts`:
  `create(name)`, `importFile(text)`, `exportDeck(updates)`, `rename(updates, name)`,
  `duplicate(updates, name)`. Each returns update bytes (transferable) plus a `DeckSummary`, or a
  typed error (`invalid-json`, `invalid-deck`, `unsupported-version`). The library page talks to it
  through `library-client.ts` (same request/response pattern as `layout-client.ts`).
- **Rationale**: constitution V (large imports off the main thread, FR-045); keeps the library chunk
  free of Yjs, Zod and the model (plan hint: "library route stays light").
- **Export from the editor** uses the live doc (`serializeDeck(snapshot)`) on the main thread
  (already done every frame by the JSON panel, 0.4 ms) so the error-state Export works even when
  storage is broken.

## R8. Delete, soft delete and Undo

- **Decision**: after the confirm dialog (reusing the 003 dialog pattern and copy style), deleting
  a deck sets `deletedAt`; deleting a folder sets the folder's `deletedAt` and moves its decks to
  Unfiled, remembering their ids. The library store keeps a session stack of undo entries
  (`{kind:'deck', id}` / `{kind:'folder', id, deckIds}`); the 6 s toast's Undo and ⌘Z / Ctrl+Z on
  the library pop it. On app start, `purgeDeleted()` hard-deletes soft-deleted decks (and their
  `updates` rows) and folders. Queries always filter `deletedAt`.
- **Rationale**: restoring content after a delete must be exact (FR-022) and cheap; the spec makes
  deletes final after a reload. Soft delete also lets an open editor tab detect the delete (R16).

## R9. Recent

- **Decision**: `openedAt` set when the editor route loads a stored deck (metadata write only, not
  an edit, no status change). Recent = non-deleted decks with `openedAt`, sorted desc, first 8.
  Relative times via `Intl.RelativeTimeFormat('en')`.

## R10. Thumbnails

- **Decision**: `deck-summary.ts` computes `{ w, h, nodes: [x, y, kind][] (the first 150
in file order), groups: [x, y, w, h][] }` normalized to a 0–1000 box from
  node positions (groups from member bounds, as the canvas does). Stored in `DeckRecord.thumb`,
  rewritten at most every 2 s and on `pagehide`. Rendered in the card as inline SVG with token
  colors. Empty deck → dotted background only.
- **Rationale**: O(n), measured budget < 1 ms at 500 nodes, so no worker needed for the editor
  path; imports compute it in the worker anyway.

## R11. Storage card

- **Decision**: add `supportsStorageEstimate()` to `lib/features.ts`; `storage-estimate.ts`
  wraps `estimate()`, `persisted()`, `persist()`. States: `unsupported` ("not persistent", no
  button), `off` (+ "Request persistent storage"), `declined` (+ "Browser declined. Try again after
  installing the app."), `on` (shield icon + text, DESIGN.md `success` tokens, §g-20). Warning when
  `usage / quota > 0.8`. Refreshed on library mount and after imports/deletes.

## R12. Routes and the smoke suite

- **Decision**: `/` library; `/deck/new` creates a deck (in the current folder passed as
  `?folder=`) and `replace`-navigates to `/deck/<id>`; `/deck/demo` keeps the in-memory demo (not
  stored, status "Demo · not saved") until 013 replaces it; `/deck/:deckId` loader reads the record
  and the merged log, 404 → `DeckNotFoundPage`. The library h1 becomes the section title ("All
  decks", design 01) and the demo link moves into the Samples empty state ("Open demo deck").
  Smoke test 1 changes: heading `All decks`, click `Samples`, then `Open demo deck`. Tests 2–4 are
  unchanged.
- **Rationale**: the smoke suite must be updated only when a change breaks it (constitution VI);
  this change is required by design 01. **Approved by the founder (2026-09-27).**

## R13. Testing IndexedDB

- **Decision**: add `fake-indexeddb` as a **dev** dependency of `apps/app` (imported in
  `test-setup.ts` via `fake-indexeddb/auto`). **Approved by the founder (2026-09-27).**
- **Alternatives**: mock Dexie (tests would not exercise transactions, indexes or liveQuery);
  run storage tests only in Playwright (no new e2e allowed).

## R14. Import and export files

- **Decision**: import accepts exactly one file (`<input type=file accept=".json,.sododeck.json">`
  and drop on the library); several → toast "Import one file at a time.", nothing added. Text read
  on the main thread (`file.text()`), parsed and validated in the worker. Errors → toast
  "That file is not a valid .sododeck.json." (plus "…made with a newer version of Sododeck." for
  `unsupported-version`). New deck goes to the current folder or Unfiled; name from the file (or
  "Imported deck" when absent). Export file name: deck name with `/\:*?"<>|` and control
  characters replaced by `-`, trimmed, max 100 chars, + `.sododeck.json`; `Blob` +
  `URL.createObjectURL` + temporary `<a download>`. `exportedAt` recorded.

## R15. Storage unavailable

- **Decision**: `supportsIndexedDB()` false or Dexie `open()` rejects → the library shows a banner
  "Decks can't be kept in this browser (storage is blocked)." with New deck still working in
  memory; the editor's first flush fails → error state, so Export remains the way out.

## R16. Deck deleted in another tab

- **Decision**: the editor route subscribes to its own `DeckRecord` via `useLiveQuery`; when
  `deletedAt` is set (or the record disappears), a dialog "This deck was deleted in another tab"
  offers "Keep a copy" (creates a new deck from the live doc's state through the worker `duplicate`
  path) and "Back to library". Flushes stop while the dialog is open.

## Checked facts on `main` (2026-09-27)

| Name                                                | Where                                                    | Used for                |
| --------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| `createEditor` — `UndoManager` tracks editor origin | `packages/model/src/editor.ts:108–116`                   | per-tab undo (R4)       |
| `observeDeck` origin `remote` for foreign origins   | `packages/model/src/observe.ts:181`                      | status ignores remote   |
| `fromJSON`, `serializeDeck`, `toJSON`               | `packages/model/src/index.ts`                            | import/export (R7, R14) |
| `LibraryDb` v1 `decks: 'id, name, updatedAt'`       | `apps/app/src/storage/library-db.ts`                     | upgraded to v2          |
| `openDeck('new' \| other)` in-memory                | `apps/app/src/editor/open-deck.ts`                       | replaced (R12)          |
| `ToastOptions.action`, 6 s Undo toast pattern       | `packages/ui/.../toast.tsx`, `confirm-delete-dialog.tsx` | delete Undo (R8)        |
| `radix-ui` umbrella in `packages/ui`                | `packages/ui/package.json`                               | menus without new deps  |
| smoke: heading "Your decks", link "Open demo deck"  | `apps/app/tests/e2e/smoke.spec.ts:5–7`                   | R12                     |
