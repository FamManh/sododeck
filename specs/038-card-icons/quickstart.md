# Quickstart: validating Card Icons (038)

Run guide for proving the feature works. Contracts: [icons-api](contracts/icons-api.md),
[icons-ui](contracts/icons-ui.md). Data: [data-model](data-model.md).

## Prerequisites

```bash
pnpm install
pnpm icons:generate          # must leave git clean (generated files are current)
git status --short packages/ui/src/icon-sets apps/app/public/third-party-notices.txt
```

## Automated

```bash
pnpm --filter @sododeck/ui test        # parse / resolve / aliases / search ranking / IconGlyph line + solid / generated-file freshness / notices
pnpm --filter @sododeck/model test     # setNodeIcon (one undo step, null deletes, skips), iconUsage, round-trip of odd refs
pnpm --filter @sododeck/app test       # picker by role + name, toolbar / menu / drawer entry, multi-select, mixed, reset, shapes excluded, surfaces, export scene + SVG
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e   # smoke suite incl. no third-party requests
```

## Bench and bundle (SC-005, R10)

```bash
pnpm bench                       # before: specs/038-card-icons/bench-before.md (on main, before T001)
BENCH_ICONS=1 pnpm bench         # after:  bench-after.md, every card with a custom icon
```

Pan / zoom and editor-open within 5 % of `bench-before.md`. Record the editor chunk size (gzip)
from `pnpm --filter @sododeck/app build` before and after in `bundle-size.md`; budget + 25 KB.

## Manual (pnpm dev, http://localhost:5173)

| #   | Steps                                                                                                    | Expected                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Select a Service card → toolbar "Icon" → type "search" → Enter                                           | tile shows magnifier, "Service" still shown, JSON `"icon": "lucide:search"`; ⌘Z restores the box icon                      |
| 2   | Type "db" in the picker                                                                                  | Database, Server, Hard drive near the top                                                                                  |
| 3   | Select 5 cards with different icons → open picker                                                        | "Mixed", no check; pick "Zap" → all five; one ⌘Z restores each                                                             |
| 4   | Select cards + a sticky + a connector → open picker                                                      | "Changes N cards"; only cards change                                                                                       |
| 5   | Switch a Decision to shape; set an icon via another card's selection with it included                    | shape not counted, draws no icon; switching back to card keeps its previous icon                                           |
| 6   | Zoom through all levels; collapse a group; drill into a card (034); open outline, ⌘K search, drawer      | custom icon everywhere the type icon was                                                                                   |
| 7   | Export PNG and SVG                                                                                       | every custom icon present, same drawing                                                                                    |
| 8   | Import a file with `simple:kafka`, `lucide:no-such-icon`, `server`, `Server`, `mdi:database`; save; diff | type icons for unknowns, server icon for `server` / `Server`; drawer note; values byte-identical                           |
| 9   | Keyboard only: open picker from toolbar, arrows, Tab to Reset, Esc                                       | focus visible, focus returns to the "Icon" button                                                                          |
| 10  | Dark theme + coloured cards (020)                                                                        | icons readable, same ink as type icons                                                                                     |
| 11  | Enter flow mode                                                                                          | no "Icon" in toolbar / menu; icons still drawn                                                                             |
| 12  | Open `/third-party-notices.txt` on the built app                                                         | lucide ISC notice present                                                                                                  |
| 13  | Open the drawer on a card → click the icon tile at the top (or Tab to it, Enter) → pick "Bell"           | picker opens next to the tile; tile and card show the bell; Esc returns focus to the tile; a shape's tile is not clickable |

Record results and screenshots in `quickstart-results.md` and `screens/`.
