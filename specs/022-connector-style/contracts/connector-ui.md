# Contract: connector UI (022)

What a user and assistive technology can rely on. Tests assert by role and accessible name, not
class names. Visual reference: frames 128–131 and 118 c (`docs/design/screens/`), light and dark;
`DESIGN.md` wins where they differ.

## Selection toolbar (one or more connectors)

| Element         | Role / name            | Keys and behaviour                                                                           |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Line style      | `button` "Line style"  | Replaces the toolbar's "Line type" button. ⏎ / Space / ↓ opens the popover; `aria-expanded`. |
| Reset route     | `button` "Reset route" | Now offered for every shape when the connector has bends, anchors or an offset.              |
| Selection count | text "3 connectors"    | Multi-selection only (frame 128 c).                                                          |

## Line style popover

| Element           | Role / name                  | Keys and behaviour                                                                                                                           |
| ----------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Container         | `dialog` "Line style"        | 288 wide, 8 px under the button. Esc, a canvas click or a new selection closes; focus returns to "Line style".                               |
| Subtitle          | text                         | Multi-selection: "3 connectors · one change applies to all".                                                                                 |
| Type              | `radiogroup` "Type"          | `radio` Curved / Elbow / Straight; ← → choose.                                                                                               |
| Dash              | `radiogroup` "Dash"          | `radio` Solid / Dashed / Dotted; ← → choose.                                                                                                 |
| Weight            | `slider` "Weight"            | 5 stops 1, 1.5, 2, 3, 4 (`aria-valuetext` "2 px, default"); ← → one step, Home / End thinnest / thickest.                                    |
| Colour            | `radiogroup` "Colour"        | `radio` "No colour", 13 named, deck colours (named by hex or name); arrows move in the grid, ⏎ / Space picks.                                |
| Animate direction | `switch` "Animate direction" | Space toggles; announced "Animate direction, on / off". Helper text "Dashes run toward the arrow. Still with reduced motion and in exports." |
| Mixed             | text "Mixed" per section     | When the selection differs in that section; values in use carry `aria-describedby` "Used by some".                                           |
| Tab order         | —                            | Type → Dash → Weight → Colour → Animate; Shift+Tab back.                                                                                     |

Every pick writes at once and is one undo step; with several connectors it writes only that key to
all of them.

## Context menu (connection / connections)

"Line type ▸" (radio), "Dash ▸" (radio), "Weight ▸" (radio), "Colour…" (opens the popover),
"Animate direction" (checkbox item), "Reset route". Labels match the popover.

## Drawer (edge inspector) "Line" section

Same controls as the popover with the same names, plus:

| Element        | Role / name                   | Behaviour                           |
| -------------- | ----------------------------- | ----------------------------------- |
| Label position | `spinbutton` "Label position" | 0–100 %, step 5; absent shows 50 %. |
| Bends          | text "Bends: 2"               | With "Reset route" `button`.        |

The bulk drawer shows Type, Dash, Weight, Colour and Animate with "Mixed" as in the popover.

## Handles (canvas)

Shown only while the connector is hovered or is the single selected connector, never in flow mode
or while recording.

| Handle   | Look (rest / hover)        | Role / name                                | Keys and behaviour                                                                                                                                 |
| -------- | -------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| End      | 10 px ring / 14 px + halo  | `button` "Source end" / "Target end"       | Drag reconnects (017) or slides along the side (anchor). ← → move one snap step along the side, onto the next side at a corner; readout announced. |
| Midpoint | 8 px ring / 12 px + halo   | `button` "Add bend between points 1 and 2" | Drag adds a bend at the drop point; ⏎ adds a bend at the midpoint. Hidden while any handle is dragged.                                             |
| Bend     | 8 px filled / 12 px + halo | `button` "Bend 2 of 3"                     | Drag moves; arrows 22 px, Shift + arrows 1 px; ⌫ / Delete / double-click removes; Esc returns focus to the connector.                              |

Every handle has a 24 px round hit area. Tab order inside a selected connector: ends → midpoints →
bends. Snapping: neighbour alignment then the 22 px grid; ⌘ held disables snapping. While dragging:
40 % dashed ghost of the previous route, guides, readout ("x 288 · y 144", "2 bends",
"left side · 78 %").

Announcements: "Bend added", "Bend removed", "Bend moved", "Route reset", "Anchor left side 75 %",
"Label 20 %".

## Label

| Element | Role / name                         | Keys and behaviour                                                                                                                                                                                                   |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pill    | `button` "Label <text>, 50 % along" | Drag slides along the line (whole pill is the hit area, min 32 × 24); ticks 25 / 50 / 75 with snapping within 4 %; ⌘ disables. ← → 5 %, Shift + ← → previous / next tick, Home / End clamped ends, ⏎ edits the text. |

## Animated lines

`sd-edge-run` only when `style.animated` is true, reduced motion is off, no flow is shown or
recorded, and not in an export. Direction always readable from the arrowhead and the start knob.

## Precedence (drawn, highest first)

Selected → flow / error / candidate / invalid strokes → 034 highlight (own colour kept, 2.75 px;
uncoloured → Ink) → the connector's own colour, dash, width → defaults.
