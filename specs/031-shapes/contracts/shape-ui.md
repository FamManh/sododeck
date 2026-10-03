# Contract: shape UI (031)

What a user and assistive technology can rely on. Tests assert by role and accessible name. Visual
reference: frames 120 (shapes, two forms), 122 (shape states), 123 (zoom), 127 (Add);
`DESIGN.md` wins where they differ.

## Add flyout, Shapes tab (030 flyout)

| Tile                  | Role / name                                    | Adds                                                                  |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| Rectangle … Text (11) | `gridcell` `button` "<Name>"                   | a shape of that type at its default size, title in edit               |
| Sticky                | `button` "Sticky"                              | today's sticky note (same as the rail tool)                           |
| Frame                 | `button` "Frame", tooltip "Draw a group frame" | activates the frame tool; ⏎ places a default frame at the view centre |

The packs panel lists "Basic shapes · 13 types".

## Shape on the canvas

| Element   | Contract                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| Node      | `group` named "<title>, <shape name>" (for example "Payment OK?, diamond"); focusable like cards; ⏎ edits the title |
| Outline   | 1.5 px, colour stroke or Border-strong; lip 3 px below in the stroke colour where research R1 says "yes"            |
| Title     | centred in the title box, 13 / 600, up to 3 lines, "…" plus a title-only tooltip when cut                           |
| Handles   | one per side on the outline (`outlinePoint`); resize handles as cards (017) with per-shape minimum                  |
| States    | `DESIGN.md` States, shape column; every state has a non-colour cue                                                  |
| Landscape | geometry only, no title                                                                                             |

## Two forms

| Surface | Role / name                                                                         | Behaviour                                                      |
| ------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Toolbar | `button` "Show as: Card" / "Show as: Shape" / "Show as: Mixed" opening a radio menu | only for decision, database, document selections               |
| Menu    | radio items "Show as card", "Show as shape"                                         | same                                                           |
| Drawer  | `radiogroup` "Show as" with Card / Shape                                            | same; description, fields and tags stay editable in both forms |

One undo step per change; announces "Shown as shape" / "Shown as card".

## Frame tool

| Step    | Behaviour                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active  | pointer is a crosshair; the rail and the Frame tile show the active state; Esc returns to select                                                                             |
| Drag    | dashed Deck Orange rectangle with a "W × H" readout; the frame that will be the parent shows its drop look                                                                   |
| Release | one undo step creates the group (frame = rectangle, at least 160 × 96) with the items fully inside; the label opens for typing "New group"; announces "Frame added, n items" |
| Click   | default 320 × 200 frame centred on the point                                                                                                                                 |

Moving a frame never changes membership; dropping into and out of frames works as today.
