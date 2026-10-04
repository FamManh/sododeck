# Contract: connector editing UI (050)

What component tests assert, by role and accessible name (Principle VI, VII). Visuals follow DESIGN.md Connectors and 022's `sd-route-handle` look.

## Selected connector handles (US1, US2, US5)

Shown for exactly one selected connector, outside flow mode and recording, not with the hand tool (unchanged from 022). Rendered above cards.

| Handle               | Role / name                                  | Pointer                                       | Keyboard                                               |
| -------------------- | -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Source end           | `button` "Source end"                        | drag: slide / reconnect (US2)                 | ←↑ / →↓ next stop; Shift + arrow ±1 %; Esc → connector |
| Target end           | `button` "Target end"                        | same                                          | same                                                   |
| Bend                 | `button` "Bend N of M"                       | drag: move; double-click: remove              | arrows 22 px (Shift 1 px); ⌫ remove                    |
| Midpoint             | `button` "Add bend between points N and N+1" | drag (≥ 4 px): add and move                   | ⏎ add                                                  |
| Segment (elbow only) | `button` "Move segment N"                    | drag: perpendicular move; double-click: reset | arrows move 22 px on its axis (Shift 1 px); ⌫ reset    |

- On elbow connectors, segment handles replace midpoint handles (one handle per run). Curved connectors keep midpoints. Straight connectors show only the two ends.
- Midpoint and segment handles are absent on runs shorter than 24 screen px.
- Handles keep their 24 px hit area at any zoom.

## End drag feedback (US2)

- The preview draws the connector in its own type to the live attachment. The original route shows as a ghost (022 look).
- Readout (`aria-hidden`, announced on release): "right side · 37 %", "right side · 50 % · snapped", "automatic", or the target's name when it changes ("→ Data layer (group)").
- The target under the pointer shows the 022 hot outline. A group shows its frame highlighted.
- Announcements on release: "Anchor right side · 37 %", "Connection now enters Data layer", "End back to automatic", "Not connected: drop on a card or group", refusal texts ("Already connected", "Can't connect a group to something inside it").

## Weight slider (US3)

- `slider` named "Weight", `aria-valuemin=1`, `aria-valuemax=4`, `aria-valuenow`, `aria-valuetext` "3 px".
- Pointer down anywhere on the track, then drag: the value follows the nearest stop and the canvas previews live. Release writes one undo step. Esc during the drag restores the previous value.
- Keys unchanged (← → Home End).
- A selected connector is drawn at its own weight with a halo (`data-testid="edge-selection-halo"`).

## Groups (US4)

- A group frame label shows connect handles on hover and focus: `button` "Connect from {group title}". ⏎ opens the existing connect popover, which now lists groups (with a group icon and "(group)").
- Dropping a new connection inside a group frame (not on a card) or near its edge creates the connector. Refusals show the existing refusal note.
- The edge inspector "From" / "To" pickers list cards and groups.
- The delete confirmation for a group counts its connectors ("Also deletes 3 connections").

## Spread ends (US7)

- Card context menu and selection toolbar: menu item / button "Spread ends evenly". Disabled with reason "No side has two or more connector ends".
- Command palette: "Spread connector ends evenly" (alias "distribute ends").
- Announces "Spread N ends on M sides". One undo step.

## Guides (US6)

- Each guide line carries `data-testid="snap-guide"` (added by this feature). None remains after a gesture ends, in any of these ways: release, Esc, `pointercancel`, window blur, unmount.
