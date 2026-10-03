# Quickstart: validating Deck Tag Colours (033)

Run from the repo root. Prerequisites: `pnpm install`, Node ≥ 24 (`.nvmrc`). Details of the format are in [data-model.md](data-model.md); UI contracts in [contracts/tag-ui.md](contracts/tag-ui.md); API in [contracts/tag-editor-api.md](contracts/tag-editor-api.md).

## 1. Automated checks

```bash
pnpm schema:generate        # after editing packages/schema/schema/v1.json; commit the generated files
pnpm --filter @sododeck/schema test    # parity, S8, coverage, key order
pnpm --filter @sododeck/model test     # tag ops, round-trip, undo, concurrency
pnpm --filter @sododeck/ui test        # case rules, contrast for custom hex
pnpm --filter @sododeck/app test       # deckTags, picker, editor, drawer row, bulk, export, view filter
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green, no skipped tests; the smoke e2e (including no third-party requests) passes unchanged.

## 2. Manual scenarios (`pnpm dev`, app on :5173)

Use a deck with at least six cards and a mix of tags. Check light and dark.

| #   | Do                                                                                     | Expect                                                                                      | Spec        |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------- |
| 1   | Select a card, open the drawer Tags row, press ⏎ on "Add tag".                         | Picker opens with deck tags, colour dots and counts; focus is in the search field.          | US2         |
| 2   | Type "PIC", ⏎ on "Create tag “PIC”".                                                   | Card shows "PIC" as typed, slate pill; "PIC added" announced.                               | US2, US3    |
| 3   | On another card add "pic".                                                             | The picker offers the existing "PIC"; the card shows "PIC"; the picker still lists one tag. | US3         |
| 4   | Open the pencil on "PIC", pick violet.                                                 | Every card with the tag turns violet at once; ⌘Z returns all to slate in one step.          | US1         |
| 5   | Pick a deck colour (custom hex), then switch theme.                                    | Pill uses the hex with readable text in both themes.                                        | US1         |
| 6   | Rename "PIC" to "PCI-DSS".                                                             | All cards, connections and flows carrying it change; colour kept; one undo restores.        | US4         |
| 7   | Rename it to an existing tag.                                                          | "Merge into …? N cards change"; after Merge one tag remains; one undo restores both.        | US4         |
| 8   | Open the editor, read the Delete button, delete.                                       | Label shows "used on N cards"; after confirm the tag is gone everywhere; one undo restores. | US4         |
| 9   | Fill a card with 10 tags, try an 11th.                                                 | Refused with "10 tags max"; nothing changes.                                                | FR-009      |
| 10  | Focus a pill ×, press ⌫; press ⏎ on "Add tag".                                         | Tag removed from that card only; picker opens.                                              | FR-007      |
| 11  | Select three cards, open the toolbar Tags popover.                                     | Same picker; shared tags solid, partial dashed "n of N", all coloured.                      | FR-016      |
| 12  | Zoom out to System level, then Landscape.                                              | Dots in the tag colours with names; no tags at Landscape.                                   | 029 rules   |
| 13  | Open the JSON panel after colouring.                                                   | `tagColors` appears after `swatches` and matches the canvas.                                | US5         |
| 14  | Export SVG / PNG of the deck.                                                          | Tag pills carry the tag colours.                                                            | FR-015      |
| 15  | Open a deck saved before 033 (import an old `.sododeck.json`).                         | Tags unchanged and slate; nothing rewritten until an edit (check Export unchanged).         | US5, FR-014 |
| 16  | Keyboard only: open picker, search, create, edit colour, rename, delete, Esc back out. | Every step reachable with visible focus; announcements present.                             | SC-006      |
| 17  | In view settings choose "Hide tags" → "pci" while cards carry "PCI".                   | Those cards hide.                                                                           | R4          |

## 3. Performance (canvas change)

```bash
pnpm bench                      # before: save to specs/033-deck-tag-colours/bench-before.md
BENCH_TAGS=1 pnpm bench         # after, with 3–10 tags per card and 8 coloured tags: bench-after.md
```

Expected: pan fps and long frames within run-to-run variation of the before run (constitution V target 60 fps at 500 / 1,000). Model ops on 500 cards (recolour, rename, delete) each under 100 ms in the Vitest case.

## 4. Docs to confirm at the end

ADR 0022 row, ADR 0021 comment, `DESIGN.md` tag chip and card pill text, the four `CLAUDE.md` files, `docs/backlog.md` §033 status.
