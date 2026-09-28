# Quickstart: validating saved views and auto-layout (011)

Contracts: [model-views.md](contracts/model-views.md) and [views-ui.md](contracts/views-ui.md). Data: [data-model.md](data-model.md).

## Prerequisites

- Node ≥ 24 and `pnpm install` at the repo root.
- `pnpm dev`, then open http://localhost:5173 and use the demo deck (`/deck/demo`) or the "Logistics Delivery" sample.

## Automated checks

```bash
pnpm schema:generate && git diff --exit-code packages/schema/src/generated   # generated files committed
pnpm --filter @sododeck/schema test      # Ajv/Zod parity incl. new view fields and fixtures
pnpm --filter @sododeck/model test       # views.test, round-trip, cascade, integrity
pnpm --filter @sododeck/app test         # view-filter, tidy-layout, elk-layout (pins, perf), components
pnpm bench                               # view-switch, tidy-layout-200, pan-during-layout (before/after)
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green. `bench-after.md` shows view-switch ≤ 200 ms, tidy-layout-200 < 2 s and pan-during-layout ≥ 60 fps. The smoke e2e (with no third-party requests) still passes.

## Manual scenarios

| #   | Steps                                                                                                                     | Expected                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open a deck that has no `views`. Look at the JSON panel's Deck tab.                                                       | The tabs are System, Feature and Infra. The JSON has no `views`.                                                                                               |
| 2   | Click Infra.                                                                                                              | Subtitles show the host and clients are dimmed. The announcement is "Infra view". The crumb reads "Infra view".                                                |
| 3   | In Infra, drag Orders DB. Check the JSON.                                                                                 | `views` now holds 3 views, and `infra.positions` has Orders DB. ⌘Z removes `views` again.                                                                      |
| 4   | Rename Order Service in Infra, then switch to System.                                                                     | The new title shows in System.                                                                                                                                 |
| 5   | Drag a node in System, then switch to Feature, where the node has no override.                                            | Feature shows the new base position.                                                                                                                           |
| 6   | Click "+", rename the view to "Checkout path", open View settings… and hide the Clients group and the `external` kind.    | The toast `View "Custom 1" created` shows. Those components and their edges are hidden only in this view.                                                      |
| 7   | Use ⌘K to find "Customer App" while in "Checkout path".                                                                   | The result says "Hidden in this view". Choosing it shows a toast with "Show in System"; Enter switches views and selects it.                                   |
| 8   | Delete "Checkout path", confirm, then click Undo in the toast.                                                            | The view comes back with its settings.                                                                                                                         |
| 9   | On the `/bench` 200-node deck, pin 5 nodes (inspector switch), then click Tidy layout.                                    | It finishes in < 2 s, and panning works during the layout. The pinned nodes don't move, groups stay together and nothing overlaps. One ⌘Z restores everything. |
| 10  | Click Tidy layout on the 500-node deck, then Cancel.                                                                      | The progress bar appears after 500 ms. After Cancel, the positions are unchanged.                                                                              |
| 11  | Collapse Core services in System; switch to Infra; reload.                                                                | Infra is expanded and System is collapsed after the reload. ⌘Z doesn't expand it.                                                                              |
| 12  | Open the deck in two tabs and collapse a group in one.                                                                    | The other tab, showing the same view, collapses it too.                                                                                                        |
| 13  | Move a node in Infra, switch to System, press ⌘Z.                                                                         | You stay in System. The toast reads "Undid move in Infra" with "Go to Infra".                                                                                  |
| 14  | Do the whole flow with the keyboard only (tab list arrows, Shift+F10 menu, popover, Tidy, pin), in light and dark themes. | Every step is reachable, with visible focus and no axe violations.                                                                                             |
| 15  | Export `.sododeck.json` and re-import it.                                                                                 | Every view, position, pin, filter and collapse state is the same.                                                                                              |

## Visual check

Take screenshots at 1440×900, light and dark, next to `docs/design/screens/02-*`, `20-*`, `21-*` and `22-*`, and record them in `visual-check.md`. Screens with no design go to the founder for approval: the settings popover, the Tidy button with its progress bar, and the pin glyph.
