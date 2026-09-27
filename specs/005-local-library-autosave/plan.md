# Implementation Plan: Local Deck Library and Autosave

**Branch**: `005-local-library-autosave` (git branch not created yet) | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-local-library-autosave/spec.md` (clarified 2026-09-27)

**Dependency**: 000, 002, 003 and 004 are merged on `main` (`2cd2f2f`). Names used here were checked
against `main` on 2026-09-27: `EditorProvider`, `useDeckSnapshot`, `createEditor` (undo tracks only
the editor's own origin), `observeDeck` origins `local | undo | redo | remote`, `serializeDeck`,
`fromJSON` / `DeckValidationError`, `emptySododeckFile`, `LibraryDb` (Dexie v1, never written),
`lib/features.ts`, `ToastOptions.action`, `ConfirmDeleteDialog` + Undo toast. `dexie` 4.4,
`yjs` 13.6 and `y-indexeddb` 9 are already dependencies.

## Summary

Turn the in-memory editor and placeholder library into a real, browser-stored deck library.

- **Deck storage**: one small Yjs provider of our own (`deck-persistence`) that appends Yjs updates
  to a Dexie table and compacts them. Local edits are buffered ≤ 100 ms and written in one Dexie
  transaction together with the deck's library record (updated time, cached name, counts,
  thumbnail). Every write has a promise, which drives the "Saving… / Saved in this browser /
  Couldn't save" status and Retry (⌘S). `y-indexeddb` is removed (research R1, ADR 0007).
- **Live multi-tab sync**: a `BroadcastChannel` per deck relays Yjs updates between tabs, with a
  state-vector handshake when a tab opens and a catch-up read from storage on focus (fallback when
  `BroadcastChannel` is missing). Remote updates are never undone by the local `UndoManager`, so
  undo is per tab for free (research R4).
- **Library**: Dexie metadata (decks, folders) read through a tiny `liveQuery` hook, so every tab's
  library updates live. Grid/list, All / Recent (8 by `openedAt`) / Samples (empty) / folders,
  search, deck and folder menus (new Radix-based `DropdownMenu` + `ContextMenu` in `packages/ui`),
  New folder dialog with inline validation, confirm → soft delete → 6 s Undo toast + ⌘Z (session).
- **Worker**: create, import (parse + validate), export, rename, duplicate run in
  `library.worker.ts` through `@sododeck/model`, so the library route never loads Yjs or the model
  and large imports never block the page (research R7).
- **Storage card**: `navigator.storage.estimate/persisted/persist`, feature-detected, 80 % warning.
- **No file-format change, no new runtime dependency** (one removed).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; no new dependency. `y-indexeddb` is removed.

- `dexie` 4.4 (metadata + update log, `liveQuery` cross-tab), `yjs` 13.6 (`mergeUpdates`,
  `encodeStateVector`, `encodeStateAsUpdate`), `@sododeck/model` (`fromJSON`, `createEditor`,
  `serializeDeck`, snapshot), `@sododeck/schema` (`emptySododeckFile`).
- `@sododeck/ui`: `Dialog`, `Banner`, `Button`, `Input`, `SearchField`, `SegmentedControl`,
  `Tooltip`, toast; **new** `DropdownMenu` and `ContextMenu` wrappers over the existing `radix-ui`
  umbrella package.
- `react-router` 8 (data mode loaders), Zustand 5, `lucide-react`.

**Storage**: IndexedDB via Dexie, database `sododeck-library` v2: `decks`, `folders`, `updates`
([data-model.md](data-model.md)). UI preferences (view mode) in `localStorage`, wrapped in
try/catch. Nothing else.

**Testing**:

- Vitest with `fake-indexeddb` (dev dependency only, approved by the founder 2026-09-27;
  research R13) for `deck-persistence`, `library-db`, the write pipeline, compaction,
  soft delete/undo, Recent, folder-name rules, and two-`Y.Doc` sync over a fake channel.
- Worker handlers are plain functions tested directly in Node; the worker file is a thin shell.
- Testing Library component tests by role/label for the library page, menus, dialogs, storage card,
  save status and the deleted-elsewhere dialog.
- Existing Playwright smoke suite; two selectors updated because the library page changes
  (research R12). `pnpm bench` before/after (the editor's update path changes).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari; desktop 1440×900
reference; offline-capable.

**Project Type**: Web SPA (`apps/app`) plus internal packages in the pnpm/Turborepo monorepo.

**Performance Goals**:

- An edit is durable ≤ 500 ms after it happens (target ≤ 150 ms: 100 ms buffer + one IDB
  transaction).
- "Saving…" is never shown > 300 ms after the write resolved; minimum 200 ms display to avoid
  flicker (research R3).
- Another tab shows an edit ≤ 1 s (target ≤ 50 ms over `BroadcastChannel`).
- Library with 100 decks usable ≤ 1 s; search filters in the same frame.
- Canvas frame rate while dragging on the 500 / 1,000 bench deck within 5 % of `main`.

**Constraints**: document data only in the Yjs doc (library `name`/counts/thumbnail are derived
caches written from the doc, never read back into it); serialization only through
`@sododeck/model`; library route free of Yjs, model, React Flow and Monaco imports; everything
browser-specific through `lib/features.ts`; no network.

**Scale/Scope**: ~100 decks, decks up to 500 nodes / 1,000 edges; 1 route rewritten, 1 route
reworked, ~12 components, 2 new `ui` wrappers, 1 worker, ~10 pure modules, Dexie schema v2.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Check                                                                                                                                                                                                                                                                                                                                                                                                                  | Result |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth         | Deck content is stored only as Yjs updates. Storage and tab sync attach as Yjs providers (`deck-persistence`, `deck-channel`). The library record's `name`, counts and thumbnail are **derived caches** written from the doc on every flush and never written back; library rename goes through `DeckEditor.updateMeta` in the worker. Save status, library selection and undo stack of deletes are UI-only (Zustand). | ✅     |
| II. Schema-owned format, lossless | No format change. Import = `fromJSON` (validation incl. version), export = `serializeDeck(toJSON)`; both in `@sododeck/model`, run in the worker. Round-trip export → import → export is tested on the bench deck. No model change, so no new round-trip case is required; the existing suite stays green.                                                                                                             | ✅     |
| III. Stable identity              | Deck and folder ids are random (`crypto.randomUUID`), never from names. Renames change only `name`. Object ids inside the deck are untouched by duplicate/import.                                                                                                                                                                                                                                                      | ✅     |
| IV. Local-first, private          | Everything in IndexedDB; export is a local `Blob` download; `BroadcastChannel` is same-origin, in-browser. `storage.persist/estimate`, `BroadcastChannel`, IndexedDB, downloads feature-detected in `lib/features.ts` with fallbacks (R4, R11, R15). Smoke no-third-party check stays.                                                                                                                                 | ✅     |
| V. Performance                    | Imports, exports, create, rename, duplicate run in `library.worker.ts`. Writes are batched ≤ 100 ms, one transaction each; compaction merges in the worker-free path only when the log is large (R2). Thumbnail summary is O(n) < 1 ms at 500 nodes, throttled to 2 s (R10). `pnpm bench` before/after, numbers reported. Autosave ≤ 500 ms tested.                                                                    | ✅     |
| VI. Strict types, tested          | Unit tests for every pure module and store; storage tests on an in-memory IndexedDB; two-doc sync tests; component tests by role/label for US1–US6. No new e2e; the smoke suite keeps passing (two selectors updated, R12).                                                                                                                                                                                            | ✅     |
| VII. Accessible by default        | Menus via Radix (keyboard, Shift+F10, roles); dialogs trap focus; inline errors linked with `aria-describedby`; save status in a polite live region with icon + text; storage On/Off with icon + text; Undo toast plus ⌘Z; visible focus on cards/rows (roving grid focus, F2, Enter, Delete).                                                                                                                         | ✅     |
| VIII. Simplicity, dependencies    | No new runtime dependency; `y-indexeddb` removed (replaced by ~150 lines we can test and that report errors). Test-only in-memory IndexedDB approved (R13). ADR 0007 records the storage layout and the live-sync decision.                                                                                                                                                                                            | ✅     |

**Post-design re-check (after Phase 1)**: all ✅. The founder approved
the test-only IndexedDB shim (R13) and the smoke-test selector update (R12) on 2026-09-27.

## Project Structure

### Documentation (this feature)

```text
specs/005-local-library-autosave/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R16
├── data-model.md        # Phase 1: Dexie schema v2, records, state machines
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── storage-api.md   # deck-persistence, deck-channel, library-db, worker protocol
│   └── library-ui.md    # routes, roles/labels, keyboard, status texts, smoke hooks
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
apps/app/src/
├── app/router.tsx                      # / library, /deck/new, /deck/demo (in-memory), /deck/:deckId (loader)
├── routes/
│   ├── library-page.tsx                # rewritten: sidebar + content (grid/list), dialogs
│   ├── editor-page.tsx                 # loads stored deck, attaches providers, status, deleted dialog
│   └── deck-not-found-page.tsx         # new
├── library/                            # new — library UI (no Yjs/model imports)
│   ├── library-sidebar.tsx, deck-grid.tsx, deck-card.tsx, deck-row.tsx, deck-thumbnail.tsx
│   ├── deck-menu.tsx, folder-menu.tsx, new-folder-dialog.tsx, confirm-library-delete.tsx
│   ├── storage-card.tsx, recent-list.tsx, import-button.tsx
│   ├── library-view.ts                 # pure: filter/search/sort/Recent/relative time
│   ├── folder-names.ts                 # pure: normalize + validate
│   └── library-store.ts                # Zustand: section, search, view mode, delete-undo stack (session)
├── storage/
│   ├── library-db.ts                   # Dexie v2 schema + queries + soft delete/purge
│   ├── use-live-query.ts               # liveQuery → useSyncExternalStore
│   ├── deck-persistence.ts             # Yjs provider: load, buffered writes, compaction, status
│   ├── deck-channel.ts                 # BroadcastChannel provider + focus catch-up
│   ├── deck-summary.ts                 # pure: counts + thumbnail summary from a SododeckFile
│   ├── save-status.ts                  # pure state machine + Zustand slice
│   ├── storage-estimate.ts             # estimate/persisted/persist wrappers
│   ├── download.ts                     # Blob download + safe file name
│   ├── library-client.ts               # main-thread client for the worker
│   ├── library.worker.ts               # thin shell
│   └── library-ops.ts                  # pure worker handlers (create/import/export/rename/duplicate)
├── editor/top-bar.tsx                  # save status, breadcrumb rename, Export enabled
├── editor/save-status.tsx              # status pill + error popover
├── editor/deck-inspector-storage.tsx   # STORAGE section (FR-034)
└── lib/features.ts                     # + supportsStorageEstimate, isQuotaError

packages/ui/src/components/
├── dropdown-menu.tsx                   # new wrapper (radix-ui), sub-menu + checked item
└── context-menu.tsx                    # new wrapper (radix-ui)

docs/decisions/0007-local-deck-storage.md   # new ADR
apps/app/tests/e2e/smoke.spec.ts            # two selectors updated (R12)
```

**Structure Decision**: all feature code lives in `apps/app` (storage in `src/storage`, library UI
in a new `src/library` folder mirroring `src/editor`); only two generic menu wrappers go into
`packages/ui`. `packages/model` and `packages/schema` are unchanged.

## Complexity Tracking

No constitution violations. The founder approved R12 (smoke selectors) and R13 (test-only
IndexedDB shim) on 2026-09-27; neither adds a runtime dependency.
