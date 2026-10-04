# Quickstart: validate connector editing (050)

## Prerequisites

```bash
pnpm install
pnpm bench            # BEFORE any change; copy the report summary to bench-before.md
pnpm dev              # app on http://localhost:5173
```

Open a new deck with a sample: create cards A, B, C, D, a group "Data layer" containing C and D, and a nested group "Cache" inside it containing D.

## Automated checks

```bash
pnpm --filter @sododeck/schema test     # parity, descriptions regenerated
pnpm --filter @sododeck/model test      # integrity, cascade, fragment/paste, round-trip with group edges
pnpm --filter @sododeck/app test        # pointer-drag, hit-target, outline-attach, endpoint/segment drag,
                                        # spread-ends, connection rules, handles / slider / guides components
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench            # AFTER; copy to bench-after.md, within 5 % of before (SC-008)
```

## Manual scenarios

| #   | Story | Steps                                                                                                                                     | Expected                                                                                                                          |
| --- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | US1   | Connect A→B and move B so the target end sits under card A. Select the connector and drag the target end.                                 | The end handle is visible above A and drags.                                                                                      |
| 2   | US1   | Drag a midpoint in one long sweep across the canvas and over cards.                                                                       | The bend follows all the way and lands at release. One undo removes it.                                                           |
| 3   | US1   | Press a midpoint and release without moving.                                                                                              | Nothing changes, and there is no undo step.                                                                                       |
| 4   | US2   | Press an end and release without moving.                                                                                                  | The end doesn't move.                                                                                                             |
| 5   | US2   | Drag an end slowly all the way round B, inside and outside its edge.                                                                      | It glides along the outline, rounds corners smoothly, snaps only at side midpoints ("· snapped"), and doesn't snap with ⌘.        |
| 6   | US2   | Give B ten connectors on its right side and nudge them apart by a few px each.                                                            | Each lands exactly where dropped; none is pulled onto a neighbour.                                                                |
| 7   | US2   | Drop a pinned end in the middle of its own card. Repeat on a tiny card (60×40).                                                           | The large card shows "automatic" and the end returns to auto. The tiny card has no automatic zone, so the end is pinned.          |
| 8   | US2   | Focus an end and press Shift + →.                                                                                                         | It moves 1 % along the side.                                                                                                      |
| 9   | US3   | Select a connector and drag the Weight slider from 1 to 4.                                                                                | The selected line changes width at every stop, with a soft halo. One undo restores it. Esc mid-drag restores it too.              |
| 10  | US4   | Drag from A's handle into "Data layer" (empty area inside the frame).                                                                     | Connector A→Data layer is created and attaches to the frame outline.                                                              |
| 11  | US4   | Start from the "Data layer" label's connect handle and drop on B; then on another group.                                                  | Group→card and group→group are created.                                                                                           |
| 12  | US4   | Try "Data layer" → D, and "Cache" → "Data layer".                                                                                         | Refused: "Can't connect a group to something inside it".                                                                          |
| 13  | US4   | Collapse "Data layer". Drill into it. Export SVG. Export and re-import JSON.                                                              | The connector draws to the collapsed card, then to the proxy, then in the SVG. The JSON is identical after the round trip.        |
| 14  | US4   | Delete "Data layer".                                                                                                                      | The confirmation counts its connections. They are deleted, and one undo restores all.                                             |
| 15  | US5   | On an elbow A→B with 3 runs, drag the middle run sideways, then the first run.                                                            | The middle run moves on one axis only. The first run slides the source end along its side. Double-click a run handle to reset it. |
| 16  | US6   | Drag a card with guides showing, then: release outside the window; Alt-Tab mid-drag; Esc; resize a card while zooming out across a level. | No guide remains in any case.                                                                                                     |
| 17  | US7   | On B with 10 bunched right-side ends, choose "Spread ends evenly".                                                                        | The ends are evenly spaced, ordered to avoid crossings. One undo restores them.                                                   |

Record results in `quickstart-results.md` with screenshots for 1, 5, 9, 10, 15 and 17.
