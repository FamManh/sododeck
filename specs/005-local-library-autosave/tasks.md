# Tasks: Local Deck Library and Autosave

**Input**: design documents in `specs/005-local-library-autosave/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27
  (single-file import/export, G-5 deferred, live multi-tab sync).
- [research.md](research.md) (R1–R16), [data-model.md](data-model.md).
- [contracts/storage-api.md](contracts/storage-api.md), [contracts/library-ui.md](contracts/library-ui.md).
- [quickstart.md](quickstart.md).

**Tests**: required. Constitution VI requires unit tests for every pure module and store and
component tests (Testing Library, by role and label) for user-visible behavior. Write each test
first and see it fail. No new Playwright tests; the smoke suite is updated only where R12 says.

**Founder approvals (2026-09-27)**: `fake-indexeddb` as a dev dependency (R13); smoke test 1
selector change (R12). No new runtime dependency; `y-indexeddb` is removed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- App: `apps/app/src/…`; tests next to code (`*.test.ts(x)`).
- UI package: `packages/ui/src/components/…`, tests in `packages/ui/test/` (follow existing layout).
- Commit after each task or logical group (Conventional Commits, no AI attribution lines).

---

## Phase 1: Setup

- [x] T001 Gate and branch: confirm `main` contains 003 and 004 (`git log --oneline | head`),
      create branch `005-local-library-autosave`, and re-check the names in research "Checked facts on
      `main`"; if any moved, update research.md before continuing.
- [x] T002 Record the performance baseline on `main`: run `pnpm bench` and save the numbers in
      `specs/005-local-library-autosave/bench-before.md` (drag scenario at 500 nodes / 1,000 edges).
- [x] T003 Add `fake-indexeddb` as a devDependency of `apps/app` (`pnpm --filter @sododeck/app add -D fake-indexeddb`),
      import `fake-indexeddb/auto` at the top of `apps/app/src/test-setup.ts`, and remove the unused
      `y-indexeddb` dependency from `apps/app/package.json` (R1). Run `pnpm install && pnpm test` green.
- [x] T004 [P] Write ADR `docs/decisions/0007-local-deck-storage.md`: update-log storage in one Dexie DB
      (R1, R2), save-status truthfulness (R3), live multi-tab sync instead of a lock (R4, §g-35), soft
      delete with session undo (R8); context, decision, consequences, alternatives.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: storage schema, pure helpers, the worker and the menu components used by every story.
No user story work starts before this phase is done.

### Browser features and small helpers

- [x] T005 [P] Add `supportsStorageEstimate()` and `isQuotaError(error: unknown)` (true for
      `DOMException` names `QuotaExceededError` and Dexie `QuotaExceededError`, incl. `inner`) to
      `apps/app/src/lib/features.ts`, with cases in `apps/app/src/lib/features.test.ts`.
- [x] T006 [P] Create `apps/app/src/storage/download.ts` with `safeFileName(name)` (replace
      `/\:*?"<>|` and control chars with `-`, collapse spaces, trim, max 100 chars, fallback
      `Untitled deck`) and `downloadText(fileName, text, mime = 'application/json')` (Blob +
      object URL + temporary `<a download>`, revoke URL); test `download.test.ts` (names, and that
      an anchor with the right `download` attribute is clicked).

### Library database (data-model.md)

- [x] T007 Write `apps/app/src/storage/library-db.test.ts` first (fake-indexeddb, a fresh DB name
      per test): v1 → v2 upgrade keeps rows and fills defaults; `insertDeck` writes record + update row
      in one transaction; `moveDeck`, `markOpened`, `markExported`; `softDeleteDeck`/`restoreDeck`;
      `loadDeckLog` returns rows in `seq` order and `null` for unknown or deleted ids;
      `createFolder`/`renameFolder` throw `FolderNameError` `empty` / `duplicate` (case and spaces
      ignored) / `too-long`; `softDeleteFolder` moves decks to Unfiled, returns their ids and frees the
      name; `restoreFolder` puts them back and fails with `duplicate` if the name was reused;
      `purgeDeleted` removes soft-deleted decks, their update rows and folders.
- [x] T008 Implement `apps/app/src/storage/library-db.ts` per [contracts/storage-api.md](contracts/storage-api.md):
      `DeckRecord`, `FolderRecord`, `UpdateRow`, `DeckThumb` types; Dexie v2 stores
      (`decks: 'id, folderId, updatedAt, openedAt, deletedAt'`, `folders: 'id, &nameKey, deletedAt'`,
      `updates: '++seq, deckId, [deckId+seq]'`) with an `upgrade()` filling defaults; `openLibraryDb()`
      returning `null` when IndexedDB is unsupported or `open()` rejects (R15); all functions listed in
      the contract, multi-table ones in one `db.transaction('rw', …)`. Make T007 green.
- [x] T009 [P] Create `apps/app/src/storage/folder-names.ts` (pure): `folderNameKey(name)`,
      `validateFolderName(name, existingKeys)` → `null | 'empty' | 'duplicate' | 'too-long'`,
      `folderNameMessage(error, name)` with the texts in contracts/library-ui.md; test
      `folder-names.test.ts`. Use it inside `library-db.ts` (T008) and the UI later.
- [x] T010 [P] Create `apps/app/src/storage/use-live-query.ts` (`liveQuery` + `useSyncExternalStore`,
      `undefined` while loading, re-subscribes when `deps` change) and `use-live-query.test.tsx`
      (renders the result, updates after a write to the DB, unsubscribes on unmount).
- [x] T011 Create a library DB provider: `apps/app/src/storage/library-db-context.tsx` exposing
      `useLibraryDb(): LibraryDb | null` and `LibraryDbProvider` that opens the DB once and calls
      `purgeDeleted()` once per app start; wrap the router in `apps/app/src/main.tsx`. Test that
      `purgeDeleted` runs once and that a `null` DB is provided when IndexedDB is missing.

### Pure models

- [x] T012 [P] Create `apps/app/src/storage/deck-summary.ts` (`summarizeDeck(file, { maxNodes = 150 })`
      → name (default `Untitled deck`), node/edge/flow counts, `thumb` normalized to a 0–1000 box keeping
      aspect ratio, groups from member bounds as the canvas computes them — reuse the helper in
      `apps/app/src/editor/canvas-geometry.ts` if it is pure, else compute in this file; `null` thumb for
      an empty deck) with `deck-summary.test.ts` including a timing case: 500-node bench deck
      (`apps/app/src/bench/generate-deck.ts`) summarized in < 5 ms.
- [x] T013 [P] Create `apps/app/src/storage/save-status.ts`: `SaveStatus`, `SaveEvent`,
      `reduceSaveStatus`, `SAVING_MIN_MS = 200`, `SAVED_MAX_HOLD_MS = 300`, plus a Zustand slice
      `useSaveStatusStore` (`status`, `dispatch(event)`, `reset()`) that applies the minimum display
      time with a timer (data-model.md state machine); test `save-status.test.ts` with fake timers:
      pending → saving; resolve at 130 ms → saved shown at 200 ms; resolve at 400 ms → saved
      immediately; failed → error keeps `firstUnsavedAt` of the first failure; a later `saved` clears
      error; `saved` while `saved` is a no-op.
- [x] T014 [P] Create `apps/app/src/library/library-view.ts` (pure, data-model "Derived views"):
      `selectDecks(decks, { section, search })`, `recentDecks(decks)` (8 by `openedAt` desc),
      `sectionTitle(section, folders)`, `deckCountLabel(n)` (`1 deck` / `n decks · stored in this
browser`), `relativeTime(ms, now)` via `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`;
      test `library-view.test.ts` (folder filter, case-insensitive trimmed search, 9 opened → 8 newest,
      deleted excluded, Samples empty).

### Library worker (R7)

- [x] T015 Write `apps/app/src/storage/library-ops.test.ts` first (Node, no worker): `create('Untitled deck')`
      bytes load into a doc whose `toJSON` equals `emptySododeckFile()` + name; `importFile` of the
      bench deck JSON returns bytes + summary and `exportDeck` of those bytes returns text equal to
      `serializeDeck` of the input (round trip); `importFile` errors: not JSON → `invalid-json`,
      schema-invalid → `invalid-deck`, `version` newer than supported → `unsupported-version`;
      `rename(updates, 'X')` returns a delta that, applied to the original doc, sets `name` to `X`;
      `duplicate(updates, 'A copy')` gives an independent deck with identical content except `name`.
- [x] T016 Implement `apps/app/src/storage/library-ops.ts` (pure, only `@sododeck/model`,
      `@sododeck/schema`, `yjs`), `apps/app/src/storage/library.worker.ts` (thin message shell,
      transferable `Uint8Array`s) and `apps/app/src/storage/library-client.ts`
      (`createLibraryClient()` request/response like `apps/app/src/layout/layout-client.ts`, typed
      `LibraryOpError`, `terminate()`); make T015 green. The worker must be the only importer of
      `@sododeck/model` on the library route (checked in T062).

### Menu components (`packages/ui`)

- [x] T017 [P] Add `packages/ui/src/components/dropdown-menu.tsx` and `context-menu.tsx`: thin,
      token-styled wrappers over `radix-ui` `DropdownMenu` / `ContextMenu` (Content, Item with optional
      shortcut hint, Separator, Sub/SubTrigger/SubContent, RadioGroup/RadioItem with check, destructive
      item variant) matching the context menu in design 74/76; export them like the other components;
      component tests by role (`menu`, `menuitem`, `menuitemradio` checked, submenu opens with
      ArrowRight, Esc closes) and a section in the dev gallery `apps/app/src/design-gallery/overlays-section.tsx`.

### Library UI state

- [x] T018 [P] Create `apps/app/src/library/library-store.ts` (Zustand, UI only): `section`,
      `search`, `viewMode` (mirrored to `localStorage["sododeck.library.view"]` in try/catch, default
      `grid`), `renamingId`, `undoStack` (`push`, `pop`, session only); test `library-store.test.ts`.

**Checkpoint**: storage, worker, pure models and menus are ready.

---

## Phase 3: User Story 1 - Never lose work: autosave and reopen (Priority: P1) 🎯 MVP

**Goal**: every edit is stored within 500 ms with a truthful status; decks reopen exactly.

**Independent Test**: go to `/deck/new`, add a component, wait 0.5 s, reload `/deck/<id>`: the
component is there; status went "Saving…" → "Saved in this browser"; a failing write shows the error
state until a later write succeeds.

### Tests for User Story 1 ⚠️ (write first, see them fail)

- [x] T019 [P] [US1] Write `apps/app/src/storage/deck-persistence.test.ts` (fake timers +
      fake-indexeddb): `whenLoaded` applies the stored log with `storageOrigin` and leaves
      `editor.canUndo()` false; a local edit produces one `pending` event and, 100 ms later, one update
      row + `DeckRecord.updatedAt`/`name`/counts in the same transaction and a `saved` event; a
      200-ms drag (updates every 16 ms) writes ≤ 3 rows; updates applied with `storageOrigin` or a
      foreign `channelOrigin` are not written; the thumbnail is rewritten at most every 2 s; after a
      flush with > 200 rows the log compacts to one row and reloads to the same `toJSON`; a rejected
      write (stub `db.updates.add` to throw `QuotaExceededError`) emits `failed` with the error name,
      keeps the buffer, and the next edit or `flush()` retries and emits `saved`; `destroy()` flushes;
      `pagehide` flushes.
- [x] T020 [P] [US1] Write `apps/app/src/editor/save-status.test.tsx`: renders "Saving…" and "Saved in
      this browser" as a polite `status` with icons; error renders button "Couldn't save — export a
      backup" and button "Export"; opening it shows "Couldn't save your last change", "Unsaved since …",
      the error name, "Export .sododeck.json" and "Retry"; Retry calls `flush`; Export downloads
      (mock `downloadText`) the live deck's `serializeDeck` text.
- [x] T021 [P] [US1] Write `apps/app/src/routes/editor-page.test.tsx` cases (extend the existing file):
      `/deck/new` creates a record and replaces the URL with `/deck/<id>`; `/deck/<id>` renders the
      stored deck; unknown id renders "Deck not found" with "Back to library"; `/deck/demo` still renders
      the demo with "Demo · not saved" and writes nothing; opening a stored deck sets `openedAt` and does
      not change `updatedAt`; ⌘S / Ctrl+S calls `flush` and `preventDefault`s; the top-bar Export button
      downloads `<name>.sododeck.json`.

### Implementation for User Story 1

- [x] T022 [US1] Implement `apps/app/src/storage/deck-persistence.ts` per the contract (buffer,
      100 ms flush from the first buffered update, `Y.mergeUpdates`, one `rw` transaction on
      `updates` + `decks`, `summarizeDeck` from a snapshot for the cached fields, thumb every 2 s,
      compaction above 200 rows and on load, `pagehide`/`visibilitychange` flush, `onStatus` events,
      `lastSeq`, `catchUp`, `storeRemoteDelta`, `destroy`). Make T019 green.
- [x] T023 [US1] Update routing in `apps/app/src/app/router.tsx`: `/deck/new` (loader: create via
      the library client, `insertDeck` into `?folder=` or Unfiled, `redirect` with replace to
      `/deck/<id>`), `/deck/demo` (existing in-memory demo), `/deck/:deckId` (lazy route with a loader
      calling `loadDeckLog`; `null` → render `apps/app/src/routes/deck-not-found-page.tsx`, new). Keep
      the library route light (no model/Yjs imports).
- [x] T024 [US1] Rework `apps/app/src/routes/editor-page.tsx` and `apps/app/src/editor/open-deck.ts`:
      build the `Y.Doc` from the loader's bytes (storage origin) or the demo; attach
      `attachDeckPersistence` for stored decks with `onStatus` → `useSaveStatusStore.dispatch`;
      `markOpened` once; destroy providers on unmount (StrictMode-safe, like `EditorProvider`); pass a
      `mode: 'stored' | 'demo'` to the top bar. Remove the `TODO(M1)` notes it resolves.
- [x] T025 [US1] Create `apps/app/src/editor/save-status.tsx` (pill + popover, lucide `Loader`
      (no spin under `prefers-reduced-motion`), `Check`, `TriangleAlert`; clay tokens for error;
      "Demo · not saved" in demo mode) and wire it into `apps/app/src/editor/top-bar.tsx` replacing the
      placeholder; enable the top-bar Export button (`serializeDeck(snapshot)` → `downloadText`,
      `markExported`). Make T020 green.
- [x] T026 [US1] Add ⌘S / Ctrl+S to `apps/app/src/editor/use-canvas-shortcuts.ts` (document-wide,
      `preventDefault`, calls the persistence `flush` through a small context or the save-status store
      action) and a case in `use-canvas-shortcuts.test.tsx`. Make T021 green.

**Checkpoint**: US1 works on its own through `/deck/new` and direct links.

---

## Phase 4: User Story 2 - Find and open decks in the library (Priority: P1)

**Goal**: the library home lists stored decks with folders, Recent, Samples, search, grid/list.

**Independent Test**: seed three decks in two folders (test helper using `insertDeck`), then check
each section, search, the no-results text, grid/list, Recent (9 → 8), empty Recent, and opening a deck.

### Tests for User Story 2 ⚠️

- [x] T027 [P] [US2] Write `apps/app/src/routes/library-page.test.tsx`: heading "All decks" and
      "3 decks · stored in this browser"; selecting a folder shows its decks and title; typing "pay" in
      "Search decks" filters; "zzz" shows `No decks match "zzz".`; "List" shows a table with the same
      decks and survives remount (localStorage); Recent shows 8 of 9 opened decks newest first with
      relative times; empty Recent shows "Decks you open will appear here."; Samples shows "Sample decks
      are coming soon." and link "Open demo deck"; "New deck" (button and dashed card) navigates to
      `/deck/new?folder=<current>`; a deck link navigates to `/deck/<id>`; a `null` DB shows the alert
      "Decks can't be kept in this browser (storage is blocked)."; another write to the DB (simulated
      other tab) appears without remount.
- [x] T028 [P] [US2] Write `apps/app/src/library/deck-thumbnail.test.tsx`: renders an `img`-role SVG
      named "<name> preview" with one shape per node and group; `null` thumb renders the dotted
      background only.

### Implementation for User Story 2

- [x] T029 [P] [US2] Create `apps/app/src/library/deck-thumbnail.tsx` (inline SVG, token colors, kind
      tint per DESIGN.md) — T028 green.
- [x] T030 [P] [US2] Create `apps/app/src/library/deck-card.tsx` (thumbnail, name link, meta line,
      hover float shadow, focusable, "More actions for <name>" button placeholder for US3) and
      `apps/app/src/library/deck-row.tsx` (table row with Name, Folder, Components, Flows, Edited).
- [x] T031 [P] [US2] Create `apps/app/src/library/library-sidebar.tsx` (`navigation` "Library": All
      decks, Recent, Samples, "Folders" heading and folder items with `aria-current`, "New folder"
      button placeholder for US3, slot for the storage card) and `apps/app/src/library/recent-list.tsx`
      (design 78/79).
- [x] T032 [US2] Create `apps/app/src/library/deck-grid.tsx` (`list` "Decks" with the dashed "New deck"
      card first; list mode renders a `table`) with roving arrow-key focus between cards.
- [x] T033 [US2] Rewrite `apps/app/src/routes/library-page.tsx`: top bar (wordmark, `SearchField`
      "Search decks", theme toggle, "Import .sododeck.json" placeholder for US4, "New deck"), sidebar,
      header (h1 section title, count, `SegmentedControl` "View" Grid/List), content from
      `useLiveQuery` + `library-view.ts`, empty states, storage-blocked alert. Match design 01, 07, 08,
      09 (without the backup banner), 78, 79 in light and dark. Make T027 green.
- [x] T034 [US2] Update `apps/app/tests/e2e/smoke.spec.ts` test 1 only (R12, approved): heading
      "All decks" → click "Samples" → click link "Open demo deck" → 3 `deck-node`s. Run `pnpm e2e`.

**Checkpoint**: MVP = US1 + US2 (store, list, reopen).

---

## Phase 5: User Story 3 - Organize decks (Priority: P2)

**Goal**: rename, duplicate, move, delete (confirm + Undo), folders with validation.

**Independent Test**: with a few decks and no folders, run every deck and folder action by pointer
and keyboard, including Undo by toast and by ⌘Z after the toast.

### Tests for User Story 3 ⚠️

- [x] T035 [P] [US3] Write `apps/app/src/library/new-folder-dialog.test.tsx`: Create with "" shows
      "Enter a folder name." with an icon, `aria-invalid`, focus stays; " payments " when "Payments"
      exists shows `A folder named "payments" already exists.`; valid name creates and selects it; Esc
      cancels.
- [x] T036 [P] [US3] Write `apps/app/src/library/deck-menu.test.tsx`: menu opens from "More actions
      for <name>", right-click and Shift+F10; items Open, Rename (F2), Duplicate (⌘D), Move to folder
      (submenu, current folder checked), Export .sododeck.json, Delete…; Move puts the deck in the
      folder; Duplicate adds "<name> copy" in the same folder (worker mocked with `library-ops`); F2
      renames inline (Enter saves via worker `rename`, Esc cancels, empty refused).
- [x] T037 [P] [US3] Write `apps/app/src/library/library-delete.test.tsx`: Delete… opens
      `alertdialog` "Delete "<name>"?"; confirm removes the card and shows toast "<name> deleted" with
      Undo; Undo restores name, folder and content; after the toast is gone ⌘Z / Ctrl+Z restores the
      last deleted item; folder delete dialog says "Its <n> decks move to Unfiled.", confirm moves
      decks to Unfiled, Undo restores folder and decks; deleting the shown folder switches to All
      decks; folder F2 inline rename validates like the dialog.
- [x] T038 [P] [US3] Add breadcrumb rename cases to `apps/app/src/editor/top-bar.test.tsx`: button
      "Rename deck" → field; Enter calls `updateMeta({ name })` (one undo step); Esc cancels; empty
      keeps the old name.

### Implementation for User Story 3

- [x] T039 [P] [US3] Create `apps/app/src/library/new-folder-dialog.tsx` (`Dialog` small, design
      72/73, `validateFolderName`, `createFolder`) and wire "New folder" in the sidebar. T035 green.
- [x] T040 [US3] Create `apps/app/src/library/library-actions.ts`: `renameDeck`, `duplicateDeck`,
      `moveDeckTo`, `deleteDeck`, `undoLastDelete`, `deleteFolder`, `renameFolderInline` — each calls
      the worker (for doc changes) and `library-db`, stores worker deltas as update rows through a
      shared `storeDeckUpdate(db, deckId, bytes, summary)` in `library-db.ts`, and pushes undo entries
      (R6, R8). Unit test `library-actions.test.ts` against fake-indexeddb + `library-ops` in-process.
- [x] T041 [US3] Create `apps/app/src/library/deck-menu.tsx` (DropdownMenu from ⋯ + ContextMenu on
      card/row, Shift+F10 and ContextMenu key, shortcut hints per platform via `isApplePlatform`) and
      inline name editing in `deck-card.tsx`/`deck-row.tsx` (`packages/ui` `InlineEdit`), keyboard
      F2 / ⌘D / Delete on a focused card. T036 green.
- [x] T042 [US3] Create `apps/app/src/library/folder-menu.tsx` (Rename, Delete folder…; no Export
      folder) with inline rename in `library-sidebar.tsx`, and
      `apps/app/src/library/confirm-library-delete.tsx` (`alertdialog`, destructive button, 6 s Undo
      toast using `MOTION.toastUndoMs` like `confirm-delete-dialog.tsx`, library ⌘Z listener that
      ignores text fields). T037 green.
- [x] T043 [US3] Breadcrumb rename in `apps/app/src/editor/top-bar.tsx` using `InlineEdit` and
      `useEditor().updateMeta`. T038 green.

**Checkpoint**: US3 complete; match design 72–77 (confirm dialog added per §g-11/§g-19).

---

## Phase 6: User Story 4 - Import and export one deck (Priority: P2)

**Goal**: import one valid file as a new deck, refuse invalid or multiple files, export one deck.

**Independent Test**: import valid/invalid/two files; export a deck and re-import it; compare JSON.

### Tests for User Story 4 ⚠️

- [x] T044 [P] [US4] Write `apps/app/src/library/import-button.test.tsx`: choosing a valid file adds a
      deck in the current folder with counts and toast `Imported "<name>"`; invalid JSON and invalid
      deck toast "That file is not a valid .sododeck.json." and add nothing; newer version toasts
      "That file was made with a newer version of Sododeck."; two files toast "Import one file at a
      time."; dropping one file on the library main area imports it; dropping two refuses.
- [x] T045 [P] [US4] Write cases for export in `apps/app/src/library/deck-menu.test.tsx` and
      `apps/app/src/editor/inspector.test.tsx`: deck-menu Export downloads `<safe name>.sododeck.json`
      whose text equals `serializeDeck` of the stored deck and sets `exportedAt`; the deck inspector
      (nothing selected) shows heading "Storage", "Stored in this browser" and button "Export
      .sododeck.json".

### Implementation for User Story 4

- [x] T046 [US4] Create `apps/app/src/library/import-button.tsx` (hidden file input
      `accept=".json,.sododeck.json"` without `multiple`, plus drop zone handling on the library
      `main`; `file.text()` → worker `importFile` → `insertDeck`; toasts per contract) and wire it in
      the library top bar. T044 green.
- [x] T047 [US4] Add "Export .sododeck.json" to `deck-menu.tsx` (worker `exportDeck` from
      `loadDeckLog` → `downloadText` → `markExported`) and create
      `apps/app/src/editor/deck-inspector-storage.tsx` rendered by `apps/app/src/editor/inspector.tsx`
      when nothing is selected (design 10). T045 green.

---

## Phase 7: User Story 5 - Keep data safe in the browser: storage card (Priority: P2)

**Goal**: show usage and persistent-storage state; request persistence; silent fallback.

**Independent Test**: stub `navigator.storage` as granting, declining, unsupported, and > 80 %
usage; check the card in each case.

- [x] T048 [P] [US5] Write `apps/app/src/storage/storage-estimate.test.ts` (unsupported → `unsupported`;
      `persisted()` true → `on`; `persist()` false → `declined`; usage/quota passed through) and
      `apps/app/src/library/storage-card.test.tsx` (region "Browser storage", `meter` value, "<used> of
      <quota> used", "Persistent storage · Off" + "Request persistent storage" → granted: "On" with
      shield icon and toast "Persistent storage is on"; declined text; unsupported: "Not persistent in
      this browser", no button; > 80 % warning text with icon).
- [x] T049 [US5] Implement `apps/app/src/storage/storage-estimate.ts` (uses `supportsPersistentStorage`,
      `supportsStorageEstimate`) and `apps/app/src/library/storage-card.tsx` (design 80 card only, 81;
      DESIGN.md `success` tokens for On, §g-20; `Intl.NumberFormat` byte units), mounted in the
      sidebar and refreshed after imports and deletes. T048 green.

---

## Phase 8: User Story 6 - Two tabs never overwrite each other (Priority: P3)

**Goal**: same deck in several tabs stays editable, edits sync within 1 s and merge; undo per tab.

**Independent Test**: two `Y.Doc`s + editors over an in-memory channel and a shared fake-indexeddb;
then a manual two-tab check (quickstart scenario 7).

### Tests for User Story 6 ⚠️

- [x] T050 [P] [US6] Write `apps/app/src/storage/deck-channel.test.ts` with an in-memory
      `BroadcastChannel` stub shared by two docs: an edit in A appears in B; B's copy is not
      re-broadcast and not written by B's persistence; simultaneous edits of different nodes converge in
      both; simultaneous edits of the same title converge to one value; `hello`/`diff` gives a newly
      attached tab the other tab's unflushed edits; ⌘Z (`editor.undo()`) in B undoes only B's edit;
      without `BroadcastChannel` (feature detect false) `focus` triggers `catchUp()` and B gets A's
      stored edits.
- [x] T051 [P] [US6] Write `apps/app/src/routes/editor-page.test.tsx` cases: soft-deleting the open
      deck (DB write from outside) shows `alertdialog` "This deck was deleted in another tab" with
      "Keep a copy" (creates a new deck with the live content and navigates to it) and "Back to
      library"; a library rename delta posted on the deck channel updates the breadcrumb.

### Implementation for User Story 6

- [x] T052 [US6] Implement `apps/app/src/storage/deck-channel.ts` per the contract (`channelOrigin`,
      `update`/`hello`/`diff` messages, random `tabId`, focus/visibility catch-up, fallback via
      `supportsBroadcastChannel`). T050 green.
- [x] T053 [US6] Attach `attachDeckChannel` next to the persistence in `editor-page.tsx`; make
      `library-actions.ts` post worker deltas (rename) on `sododeck:deck:<id>` after storing them.
- [x] T054 [US6] Create `apps/app/src/editor/deck-deleted-dialog.tsx` (watches the open deck's record
      with `useLiveQuery`; stops flushing while shown; "Keep a copy" uses worker `duplicate` from
      `Y.encodeStateAsUpdate(doc)`), render it in `editor-page.tsx`. T051 green.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T055 [P] Accessibility pass (constitution VII): keyboard-only run of quickstart scenarios 3–7;
      focus rings on cards/rows/menus; live-region announcements for saved/error/deleted/undone;
      no state by color alone (save error, storage On/Off, folder errors). Fix and add missing
      role/label assertions to the relevant tests.
- [ ] T056 [P] Performance: `pnpm bench` on the branch, write `bench-after.md` next to
      `bench-before.md`, compare the drag scenario (≤ 5 % regression allowed); add a unit timing test
      that a 500-node deck flush (merge + summary + transaction) completes < 50 ms in fake-indexeddb.
- [ ] T057 [P] Verify the library chunk stays light: after `pnpm build`, check the library route
      chunk does not include `yjs`, `@sododeck/model`, `@xyflow/react` or `monaco-editor` (inspect
      `apps/app/dist` or the Vite manifest); fix imports if it does.
- [ ] T058 [P] Visual check: screenshots at 1440×900 light and dark of library (01, 07, 08, 09 without
      banner), folder dialogs/menus (72–77), Recent (78, 79), storage card (80 card, 81), autosave
      states (83–85); list differences vs `docs/design/screens/` in the PR description.
- [ ] T059 [P] Docs: update `apps/app/CLAUDE.md` map (`src/storage/*`, `src/library/*`, routes, "deck
      content only as Yjs updates in `updates`; library record fields are caches"), `packages/ui`
      `CLAUDE.md` (new menu components), `packages/model/CLAUDE.md` Boundaries line about y-indexeddb
      (now our own provider in `apps/app/src/storage`), and mark 005 status in `docs/backlog.md`.
- [ ] T060 Privacy check: run the smoke suite (no third-party requests) and search the new code for
      `fetch(`, `navigator.sendBeacon`, telemetry calls carrying names or content — none allowed.
- [ ] T061 Run quickstart.md manual scenarios 1–8 in Chrome and one of Safari/Firefox; note results.
- [ ] T062 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
      all green; no `.only`/skipped tests; final report (what changed, skipped, uncertain; bench
      numbers; screenshots).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: T001 first; T002, T003, T004 after it (parallel).
- **Foundational (Phase 2)**: needs T003. Blocks all stories.
- **US1 (Phase 3)**: needs Foundational. MVP part 1.
- **US2 (Phase 4)**: needs Foundational; opening decks end to end needs US1's routes (T023). MVP part 2.
- **US3 (Phase 5)**, **US4 (Phase 6)**, **US5 (Phase 7)**: need US2's library page (T033). They
  touch different files except `library-page.tsx`, `deck-menu.tsx` (US3, US4) and
  `library-sidebar.tsx` (US3, US5): coordinate or run in order US3 → US4 → US5.
- **US6 (Phase 8)**: needs US1 (persistence in the editor); T053 needs US3's `library-actions.ts`.
- **Polish (Phase 9)**: after the stories being shipped.

### Within Phase 2

- T007 → T008; T009 is used by T008 (do T009 first or together).
- T010, T012, T013, T014, T017, T018, T005, T006 are independent.
- T008 → T011. T015 → T016.

### Within each story

Tests first (fail) → implementation → tests green → commit.

## Parallel Example: Phase 2

```text
Agent A (storage):   T009 → T007 → T008 → T011, T010
Agent B (pure):      T012, T013, T014, T005, T006, T018
Agent C (worker/ui): T015 → T016, T017
```

## Parallel Example: User Story 1

```text
T019 ∥ T020 ∥ T021  →  T022  →  T023 → T024  →  T025 ∥ T026
```

## Parallel Example: User Story 2

```text
T027 ∥ T028  →  T029 ∥ T030 ∥ T031  →  T032  →  T033  →  T034
```

## Implementation Strategy

1. **MVP (US1 + US2)**: Phases 1–4. Decks are stored, autosaved with a truthful status, listed and
   reopened. Demo and ship behind nothing (it replaces placeholders).
2. **Increment 2**: US3 (organize) and US4 (import/export) — the no-lock-in promise.
3. **Increment 3**: US5 (storage card) and US6 (live multi-tab).
4. **Polish**: a11y, bench, bundle check, visual check, docs, DoD.

Each increment keeps `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
