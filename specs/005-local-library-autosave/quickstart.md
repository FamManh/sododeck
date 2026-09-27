# Quickstart: validating 005 Local Deck Library and Autosave

How to prove the feature works. Details of names and texts are in
[contracts/library-ui.md](contracts/library-ui.md); storage behavior in
[contracts/storage-api.md](contracts/storage-api.md) and [data-model.md](data-model.md).

## Prerequisites

- `pnpm install` (Node ≥ 24). `fake-indexeddb` present as a dev dependency of `apps/app` (R13).
- Chrome (plus Safari or Firefox for the cross-browser pass).

## Automated checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm --filter @sododeck/app test -- storage library   # focused run
pnpm bench                                             # before (main) and after; report both
```

Expected: all green; the unit suites cover the write pipeline (flush ≤ 100 ms, one row per flush,
compaction), save-status machine, two-doc channel sync (convergence + per-tab undo), soft delete and
undo, Recent (9 opened → 8 newest), folder-name rules, import errors, export → import round-trip on
the bench deck, and component tests for every story. Smoke suite: 4 tests pass (test 1 updated).

## Manual scenarios (`pnpm dev`, http://localhost:5173)

1. **Autosave (US1)**: New deck → add a component → status "Saving…" then "Saved in this browser"
   within ~0.3 s → wait 0.5 s → close the tab → reopen `/` → open the deck → the component is there.
2. **Save error (US1)**: in DevTools → Application → Storage, simulate a tiny quota (or block
   storage for the site) → edit → clay "Couldn't save — export a backup" + Export; popover shows
   Export .sododeck.json and Retry → restore quota → ⌘S → "Saved in this browser".
3. **Library (US2)**: create 3 decks, 2 folders, move decks → select a folder, search "pay",
   search "zzz" (`No decks match "zzz".`), switch Grid/List (remembered after reload), Recent shows
   opened decks newest first; a fresh profile shows the dashed Recent placeholder.
4. **Organize (US3)**: New folder with "" and " payments " (existing "Payments") → inline errors;
   deck menu by ⋯, right-click and Shift+F10; Rename (F2), Duplicate (⌘D → "<name> copy"), Move to
   folder (checked item), Delete → confirm → Undo toast → Undo restores; delete again, wait past
   the toast, ⌘Z restores; delete a folder → decks in Unfiled → Undo moves them back.
5. **Import/export (US4)**: Export a deck → import the file → identical deck (compare the JSON
   panel's Deck tab); import a broken file and a `.png` → toast, nothing added; select two files →
   "Import one file at a time.".
6. **Storage card (US5)**: card shows usage; "Request persistent storage" → On with shield (Chrome
   may grant or decline; both states render); Firefox/Safari show their result or "Not persistent".
7. **Two tabs (US6)**: open the same deck in two tabs → edit in A, see it in B < 1 s; edit
   different nodes at the same time → both kept after reload; ⌘Z in B undoes only B's edit; rename
   a deck in a library tab → an open editor tab shows the new name; delete the deck in the library
   → the editor tab shows "This deck was deleted in another tab".
8. **Privacy**: DevTools Network during all of the above shows no requests except the app's own
   assets.

## Visual check

Screenshots at 1440×900, light and dark, next to `docs/design/screens/01, 07, 08, 09, 72–79, 81,
83–85` in the PR; differences fixed or listed (allowed: DESIGN.md tokens, lucide icons, confirm
dialogs, no backup/Safari banners, no read-only tab).
