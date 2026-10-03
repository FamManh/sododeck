# Quickstart: validate 034 (Connection focus and drill-in)

## Prerequisites

```bash
pnpm install
pnpm bench   # before any change → copy the report to specs/034-…/bench-before.md
pnpm dev                            # app on http://localhost:5173
```

Use the demo deck, then add: three connectors between two cards (one of them with an adjusted route, 017), a flow over one of the three, and a group with connections to cards outside it.

## Walk

| #   | Do                                                   | Expect                                                                                                                                                       | Covers                    |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 1   | Rest the pointer on a card with neighbours           | After ~150 ms: card, neighbours and their connectors full strength; connectors Ink 2.75px; neighbours with Secondary border and lip; the rest at 20 % / 22 % | Story 1.1, FR-001/002     |
| 2   | Sweep the pointer quickly across many cards          | Nothing dims                                                                                                                                                 | FR-001, clarification 4   |
| 3   | Move from the focused card straight onto a neighbour | Focus switches with no flash                                                                                                                                 | Story 1.3                 |
| 4   | Leave to empty canvas                                | Restored after ~100 ms                                                                                                                                       | Story 1.2                 |
| 5   | Tab into the canvas, arrow between cards             | Each focused card highlights at once                                                                                                                         | Story 1.4, SC-006         |
| 6   | Select a card, press F, hover another card           | Pinned focus stays                                                                                                                                           | Story 1.5, FR-003         |
| 7   | Look at the two cards with three connectors          | "×2" bundle plus the adjusted connector on its own route                                                                                                     | FR-005, clarification 1   |
| 8   | Press `R` on the adjusted connector                  | It joins: "×3"                                                                                                                                               | edge case                 |
| 9   | Click "×3"                                           | Three connectors spread apart with their labels; Esc folds them                                                                                              | Story 2.2, FR-006         |
| 10  | Click the bundle curve                               | Popover lists each connector; select one, delete another (⌘Z restores)                                                                                       | Story 2.6, FR-007         |
| 11  | Open the flow that uses one of the three             | That connector draws on its own with the flow look; the others show "×2"; closing the flow shows "×3"                                                        | FR-005a                   |
| 12  | Start recording a flow                               | No bundles while recording                                                                                                                                   | research R5               |
| 13  | Drill into the group                                 | "Inside <name> · n" on the scope's top edge; dashed Outside proxies, inputs left, outputs right                                                              | Story 3.1/3.2, FR-009/010 |
| 14  | Click a proxy, then press ⏎                          | Leaves the drill-in; the real card is selected, focused and centred                                                                                          | Story 3.4, FR-011         |
| 15  | Try to drag a proxy                                  | Nothing moves; the deck is unchanged                                                                                                                         | Story 3.5                 |
| 16  | Switch to dark theme; turn on reduced motion         | Same states readable; no fades                                                                                                                               | FR-013/014                |
| 17  | Export PNG and SVG of the deck and of the drill-in   | Folded bundles and proxies shown; no hover dim                                                                                                               | research R9               |

## Automated

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench   # → bench-after.md; compare pan / drag / focus and "hover → focus painted" (< 16 ms)
```

Record results in `quickstart-results.md` and screenshots of steps 1, 7, 9 and 13 (light and dark) in `screens/`.
