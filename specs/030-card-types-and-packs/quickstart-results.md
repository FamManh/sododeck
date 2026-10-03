# Quickstart results (030)

Run on 2026-10-03, Chromium 1440 × 900, dev server, light and dark. Screenshots in `screens/`.

## Verified in the browser

| Step             | Result                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 New deck (US1) | Library "New deck": Add shows tabs All · Architecture · Process · Logistics · Data, sections 7 / 3 / 2 / 1, number badges 1–9, footer "Packs · 4 on". `add-flyout-all-{light,dark}.png` match frame 127 (tile grid, pill tabs, section counts); frame 127's extra tabs and packs belong to 031 and later. |
| 2 Add (US1)      | `/` focuses the search; "ware" + ⏎ adds a Warehouse with the title in edit. `add-flyout-search-*.png`, `add-flyout-process-*.png`.                                                                                                                                                                        |
| 3 Packs (US2)    | Footer → `packs-*.png`. Logistics off: its tiles leave Add, the warehouse card stays on the board, "Packs · 3 on". ⌘Z (canvas focused) turns it back on ("Packs · 4 on"). `add-flyout-logistics-off-*.png`.                                                                                               |

Found and fixed while walking: the library's "New deck" built its file with `emptySododeckFile()`, so new decks had no `packs` and showed Architecture only. `create()` in `storage/library-ops.ts` now stores every pack (test added). The footer is sticky so "Packs · N on" stays visible in a long list.

## Covered by automated tests, not walked by hand

| Step                    | Where                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 last pack disabled    | `packs-panel.test.tsx`                                                                                                                                                 |
| 4 Type change (US3)     | `type-picker.test.tsx` (toolbar, mixed, one undo step, ids and positions kept), `selection-toolbar` / `bulk-inspector` / `node-inspector` tests                        |
| 5 Views, search, export | `view-settings-popover.test.tsx`, `view-filter.test.ts`, `search.test.ts`, `palette-results.test.ts`, `scene.test.ts`, `render-svg.test.ts`, `deck-thumbnail.test.tsx` |
| 6 Older deck (US5)      | `round-trip.test.ts`, `packs.test.ts` (no `packs` key in, none out), `palette.test.tsx` (Architecture only, "Packs · 1 on")                                            |
| 7 Unknown type (US5)    | `deck-node.test.tsx`, `problems.test.ts`, `problems-panel.test.tsx`, `go-to-problem.test.ts`, round-trip of `robot`                                                    |
| 8 Copy check            | `no-kind-copy.test.tsx`                                                                                                                                                |
| 9 Keyboard only         | arrow, Enter, `/`, 1–9 and tab keys in `palette.test.tsx` and `flyouts.test.tsx`                                                                                       |

## Not done

- A greyscale screenshot to check types read apart without colour (each type has its own icon; the tone is never the only cue).
- A manual screen-reader pass; roles and names are asserted by the tests.
