# Contract: Deck look UI (029)

What component tests assert, by role and accessible name (constitution VI, VII). Visual values are DESIGN.md "Card system (Deck)"; this file lists behaviour and names.

## Action: `connection.lineType`

| Property | Value |
| --- | --- |
| Id | `connection.lineType` |
| Label | "Line type" |
| Children (radio) | "Curved", "Elbow", "Straight" (icons `Spline`, `CornerDownRight`, `Minus`) |
| Targets | `connection` (one edge), `connections` (two or more edges, nothing else) — new target kind |
| Where | Connection toolbar, context menu, drawer |
| Modes | Edit mode only (hidden in flow mode and read-only views, like the other connection actions) |
| Checked child | The shared effective shape; none when the selection is mixed |
| Run | `setEdgeShape(selectedEdgeIds, shape)` in one `oneStep`; sets `lastLineShape` |
| Announce | "Line type: Elbow" (one), "Line type: Elbow for 3 connectors" (several) |

### Toolbar

- Button `aria-label="Line type: Curved"` (or the current type; "Line type: mixed" for a mixed selection), opens a menu with `role="menuitemradio"` items and `aria-checked`.
- Keyboard: Enter / Space opens; arrows move; Enter picks; Esc closes and returns focus to the button.

### Context menu

- Submenu "Line type ▸" with the same three `menuitemradio` items.

### Drawer

- One edge: section "Line" with a `SegmentedControl` `role="radiogroup"` `aria-label="Line type"`, three `role="radio"` options. "Reset route" and the side pickers (017) are shown only when the effective shape is Elbow.
- Two or more edges only: the multi-selection frame shows "n connectors" and the same `radiogroup`; no option checked when mixed.

### Segment handle (017)

- Rendered only for one selected connector whose effective shape is Elbow.

### New connectors

- A connector drawn with the pointer or the keyboard connect flow gets `lastLineShape`. After reload, new connectors are Curved.

## Card (`DeckNode`)

| Element | Role / name |
| --- | --- |
| Card | `role="group"`, `aria-roledescription="component"`, `aria-label`, `aria-selected`, `aria-description`, `aria-current="step"` — unchanged |
| Problem badge | Moves into the header and shows ⚠ + count as text; stays `aria-hidden` like today, the problems remain in the card's `aria-description` |
| Children pill | Text "n inside" + `⏎` hint; keeps `role="img"` `aria-label="n components inside, press Enter to open"` |
| Tags | `role="list"` `aria-label="Tags"`, `listitem` per tag; at System level the dots keep the list with `aria-label` per tag |
| Title cut | Tooltip with the full title when cut after 3 lines |

States are exposed as today (`aria-selected` on the selected card); the Deck look adds no state that exists only as colour.

## Collapsed group (fanned hand)

| Element | Role / name |
| --- | --- |
| Front card | `button`, `aria-expanded="false"`, existing `aria-label` ("{title}, collapsed group, n nodes, m edges…") unchanged; Enter or double-click expands |
| Member tiles | `aria-hidden` |
| Back sheets | `aria-hidden`, not focusable, no pointer events |

## Expanded group label

- `button` with the group name and count (unchanged behaviour: select / collapse chevron).

## Zoom flags on the canvas wrapper

| Attribute | When | Effect |
| --- | --- | --- |
| `data-lipless` | zoom < 0.6 | Lip size 0 on every card, frame and hand |
| `data-level` | existing | Landscape / System painting (R8) |

## Reduced motion

- With `prefers-reduced-motion: reduce`, hover lift and lip changes have no transition.
