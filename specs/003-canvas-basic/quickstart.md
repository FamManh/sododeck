# Quickstart: validate Basic Canvas Editing (003)

## Prerequisites

- 002 (`@sododeck/model` editor) merged to `main` (done); `createDeckSnapshot` and `previewRemoval`
  added by this feature ([contracts/model-additions.md](contracts/model-additions.md)).
- Node ≥ 24, `pnpm install`.
- Baseline bench recorded before any canvas change: `pnpm bench` → keep the report path.

## Automated checks

```bash
pnpm --filter @sododeck/model test   # snapshot parity + structural sharing, previewRemoval = remove
pnpm --filter @sododeck/app test     # pure view models + component tests (roles/labels)
pnpm --filter @sododeck/ui test      # Popover, toast-undo token, tokens-only, contrast
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                           # after: pan/zoom + drag scenarios ≥ 60 fps at 500 / 1,000
```

Expected: all green; the smoke suite unchanged; bench report shows no regression vs baseline.

## Manual scenarios (`pnpm dev`, 1440×900, light and dark)

| #   | Steps                                                                                                      | Expected                                                                                         | Spec           |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| 1   | Open `/deck/new`                                                                                           | Empty-canvas card; "Open palette" focuses the palette                                            | US1-1, FR-025  |
| 2   | Drag "Service" onto the canvas; click "Database"                                                           | "New service" at the drop point, "New database" at the centre; each selected and in the outline  | US1-2/3        |
| 3   | Drag from the service's handle onto the database                                                           | Edge created, selected; popover open, focus in Label; set label/protocol/direction               | US1-4/5        |
| 4   | Drag again from service onto database; then onto itself; then release on empty canvas                      | Ban icon + "Already connected" / "Can't connect to itself"; nothing created                      | US2            |
| 5   | Focus service, press C, type "dat", Enter                                                                  | Database listed disabled "already connected"; add a third node and connect to it instead         | US1-6, US2-4   |
| 6   | Drag the edge's end onto the third node                                                                    | Same edge id, new target (check JSON panel/export)                                               | US2-5          |
| 7   | Shift-click two nodes, drag one; ⌘Z                                                                        | Both move; one undo restores both                                                                | US3-2/3, US4-1 |
| 8   | Select a node with 2 edges, press Delete; Esc; Delete again, confirm; wait 7 s; ⌘Z                         | Dialog names node + 2 connections; Esc changes nothing; toast 6 s; ⌘Z restores all with same ids | US3-4..6       |
| 9   | ⌘Z / ⇧⌘Z through the whole session                                                                         | Each action reverts/re-applies once; buttons disable at the ends                                 | US4            |
| 10  | Open `/bench?nodes=500&edges=1000`; zoom −/+/fit, click minimap, toggle Labels, pick a node in the outline | Smooth; zoom limited to 30–200%; labels shown/hidden; node selected and revealed                 | US5            |
| 11  | Keyboard only: repeat 1–3 and 8                                                                            | Always a visible focus ring; arrows move between nodes; live region announces                    | US6, SC-002    |
| 12  | Export the deck (or read the JSON panel), re-import                                                        | Same nodes, edges, positions                                                                     | SC-006         |

## Visual check

Screenshots of 02, 10, 11, 12, 14, 37, 38, 52–59 (light + dark) next to `docs/design/screens/*`
in the PR; differences fixed or listed (allowed: DESIGN.md tokens, lucide icons, confirmation
dialog before delete).
