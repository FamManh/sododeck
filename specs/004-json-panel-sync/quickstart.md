# Quickstart: validate the Read-only JSON Panel (004)

## Prerequisites

- 003 (canvas-basic) merged to `main`. Re-check the 003 names listed in research R10.
- Node ≥ 24, `pnpm install`.
- Baseline bench recorded before any change: `pnpm bench` → keep the report path.

## Automated checks

```bash
pnpm --filter @sododeck/model test   # serializeEntry/serializeEntries = file slices; serializeDeck < 16 ms (rich 500/1,000)
pnpm --filter @sododeck/app test     # pure view models + JsonPanel component tests (roles/labels, contracts/json-panel-ui.md)
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                           # + "drag with JSON Deck tab open" within 10% of "panel collapsed"
```

Expected: everything green; the smoke suite passes unchanged; the bench shows no regression
against the baseline.

## Manual scenarios (`pnpm dev`, 1440×900, light and dark, fresh browser profile)

| #   | Steps                                                                                                             | Expected                                                                                      | Spec            |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| 1   | Open `/deck/demo`                                                                                                 | Panel expanded on **Deck**; lock + "Read-only · synced with canvas"; line count; colored JSON | US2-1, FR-002   |
| 2   | Click "Order Service" on the canvas                                                                               | Panel stays on Deck at the same scroll position                                               | US2-5, FR-004   |
| 3   | Switch to the Selection tab; rename the node in the inspector                                                     | Tab labelled "Order Service"; `"title"` updates while typing                                  | US1-1           |
| 4   | Drag the node                                                                                                     | Position values update after the drop                                                         | US1-2           |
| 5   | Click an edge; edit its label/protocol in the popover                                                             | Edge JSON shown and updated; unlabeled edge tab reads "Source → Target"                       | US1-3, FR-003   |
| 6   | Shift-click 3 nodes + 1 edge                                                                                      | Array of 4 objects, nodes first; tab "4 selected"                                             | US1-5           |
| 7   | Click empty canvas                                                                                                | Empty message + "Show Deck JSON"; Copy disabled; no line count                                | US1-4, FR-007   |
| 8   | Deck tab: add a node, delete one (confirm), ⌘Z, ⇧⌘Z; then export and diff with the panel text                     | Text follows each step; identical to the exported file                                        | US2-2/3, SC-001 |
| 9   | Fold `"nodes"`; add a node elsewhere via the palette                                                              | Fold kept; line count still the full text                                                     | US2-4, FR-013   |
| 10  | Click into the code; type, paste, cut, Backspace, drop a file                                                     | Nothing changes; read-only message at the caret; screen reader hears the hint once per 3 s    | US3, SC-004     |
| 11  | Press Copy on Deck, then on a selected node; paste into a text editor                                             | Exact text; toasts "Copied Deck JSON" / "Copied Order Service JSON"                           | US4, SC-005     |
| 12  | Collapse; reload; expand; drag the top edge up; reload                                                            | Stays collapsed; then the chosen height is restored; the canvas never goes below 200 px       | US5, SC-007     |
| 13  | Keyboard only: Tab to the tab switch (←/→), the code area (select, fold, ⌘C), Copy, resize handle (↑/↓), collapse | All reachable with visible focus                                                              | SC-006          |
| 14  | `/bench?nodes=500&edges=1000`, Deck tab open; drag a node for 3 s                                                 | Canvas smooth; panel catches up ≤ 0.5 s after the drop                                        | US2-6, SC-003   |
| 15  | DevTools → offline; reload                                                                                        | Panel renders and highlights; Network shows no third-party requests                           | FR-029          |

## Visual check

Put screenshots of the expanded Deck tab, the Selection tab (component selected), the empty
selection and the collapsed bar (light and dark) next to `docs/design/screens/02`, `16` and `17`
in the PR. Differences must be fixed or listed. Allowed differences: the status text and lock
icon, DESIGN.md tokens, lucide icons. **Ask the founder to confirm the syntax colors (research R6).**
