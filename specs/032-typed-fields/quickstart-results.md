# Quickstart results (032)

Run 2026-10-03 against the dev server, scripted with Playwright (headless Chromium, 1440×900) on
`/bench?nodes=9&edges=6&fields=1&drawer=1` (real canvas, editor and drawer over a deck of Task /
Warehouse / Issue cards). Screenshots in `screens/`.

| Step                   | Result                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Defaults             | ✅ A Task's drawer lists Status, Assignee, Due date, Owner (light and dark: `walk-1-task-drawer-*.png`). Cards show the header status, person and date chips (`cards-fields-*.png`, compared with frames 120 / 124). JSON with only values and no `fields` is covered by model and drawer tests. |
| 2 Add field            | ✅ Keyboard only: Add field → name → "Kind: Text" menu ("Field type", frame order, `walk-2-kind-menu-light.png`) → Select → three options → ⏎. The field appears in the list (`walk-2-add-field-light.png`).                                                                                     |
| 3 Kinds and validation | ✅ Status picked by keyboard. Refusals (letters in a number, 140 in progress, end before start, `ftp:` link) are covered by `value-control.test.tsx` and `typed-fields-section.test.tsx`.                                                                                                        |
| 4 On card              | ✅ Space on "Status on card" turns it off for the type (`walk-4-on-card-off-light.png`) and back on. "+N fields", System dots and Landscape are covered by `deck-node.test.tsx` and `card-fields.test.ts`; System screenshot in `cards-fields-*.png`.                                            |
| 5 Manage               | ✅ ⌥↑ on "Reorder Owner" moves it up one place and keeps focus on the handle (`walk-5-reordered-light.png`). Rename, options, Also use for…, delete with count and kind change with "1 value will be cleared" are covered by `typed-fields-section.test.tsx`.                                    |
| 6 Built-ins            | ✅ Covered by tests: Tech / Host / Owner rows with values, only reorder and switch, Owner chip on services, "lan" written as "Lan".                                                                                                                                                              |
| 7 Elsewhere            | ✅ Covered by tests: bulk Mixed and one-step writes, search by option label, export (scene and SVG), clipboard values kept and reported.                                                                                                                                                         |
| 8 Older deck           | ✅ Round-trip tests: decks saved before 032 are byte-identical.                                                                                                                                                                                                                                  |
| 9 Keyboard only        | ✅ Steps 2, 4 and 5 above were done without the pointer.                                                                                                                                                                                                                                         |
| Network                | ✅ No request left `localhost` in either theme.                                                                                                                                                                                                                                                  |

Not done by hand: a full pointer walk in a real browser window (drag reorder by mouse, PNG
download). The bench page's fixed 110 px row spacing makes taller cards overlap there; that is the
bench layout, not the editor.
