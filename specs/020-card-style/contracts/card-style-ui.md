# UI Contract: Card Style (020)

Component tests assert these roles, names, keys and texts. Mac key labels are shown. No new shortcut is added (spec out of scope).

## Action (`actions/style-actions.ts`, registered in `ACTIONS`)

| Action id      | Label (menu) | Toolbar                         | Where (targets)                                     | Section | Modes  |
| -------------- | ------------ | ------------------------------- | --------------------------------------------------- | ------- | ------ |
| `style.colour` | "Colour…"    | swatch button, `field: 'style'` | toolbar + menu: component, components, group, mixed | `edit`  | `edit` |

- **Toolbar button**:
  - Accessible name: "Colour: Green", "Colour: #7a3cff", "Colour: Mixed" or "Colour: none". The name reflects the fill, or the stroke when there is no fill.
  - Tooltip: "Colour". It has `aria-haspopup="dialog"` and `aria-expanded`.
  - Position: after Rules in the one-component and components toolbars (019 FR-020 "Fill and Stroke join it when 020 lands"), and after Collapse in the group toolbar.
- **Menu item** "Colour…": closes the menu and opens the picker from the toolbar button. It is shown on component, components, group and mixed menus. It is not shown on the connection, sticky or canvas menus.
- **Flow mode, flow session**: not shown on any surface.

## Picker (`StylePopover`, dialog)

The picker is a `dialog` named "Colour", 272 px wide. It contains, in tab order:

1. **Fill / Stroke tabs**: a `radiogroup` "Colour target" with the radios "Fill" and "Stroke". ←/→ switch between them.
2. **No colour**: a `button` "No colour" with `aria-pressed` = true when the channel is unset on every target.
3. **Palette**: a `radiogroup` "Colours".
   - It holds 13 `radio`s named after the colours ("Red" … "Slate"), in 7 columns.
   - Keys: arrows move (←/→ within a row, ↑/↓ by 7), Home and End jump to the ends, and Enter or Space applies.
   - The checked radio shows a ring and a check icon.
4. **Deck colours**: a `radiogroup` "Deck colours".
   - It holds one `radio` per custom colour, named by its hex (e.g. "#7a3cff"). The same arrow keys work.
   - On hover or focus, a remove `button` appears, named "Remove #7a3cff from deck colours".
   - ⌫ or Delete on a focused custom radio removes it.
5. **Add**: a `button` "Add a deck colour" ("+"). It is not rendered when the deck has 12 or more colours.
6. **Footer**: a `status` line.
   - It shows the hovered or checked colour's name and token (e.g. "Green · card-green-fill"), or the hex, or "Mixed".
   - With 12 colours it reads "12 of 12 deck colours: remove one to add another".
   - When some selected items can't be coloured it reads "Colours 3 of 5 selected items".

**Mixed selection**: no radio is checked, and the footer reads "Mixed".

**Behaviour**:

- Picking a radio or "No colour" applies it at once (one undo step), and the picker stays open.
- Esc closes the picker, and focus returns to the toolbar button (or to the drawer row that opened it).

## Add a deck colour (panel inside the picker)

| Element        | Role / name                                                                               | Behaviour                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Saturation box | `slider` "Saturation and brightness", `aria-valuetext` "Saturation 60 %, brightness 40 %" | ←/→ change saturation and ↑/↓ change brightness, 1 % per press or 10 % with ⇧; pointer drag                                                  |
| Hue bar        | `slider` "Hue", 0–359, `aria-valuetext` "Hue 262°"                                        | ←/→ move 1° per press, or 10° with ⇧; pointer drag                                                                                           |
| Hex field      | `textbox` "Hex colour"                                                                    | accepts `7a3cff`, `#7A3CFF` and so on; normalized on Add                                                                                     |
| Error          | text linked by `aria-describedby`: "Enter a 6-digit hex colour, e.g. #7a3cff"             | shown and announced while the hex is invalid                                                                                                 |
| Warning        | `status`: "Text may be hard to read on this colour"                                       | shown while no text colour reaches 4.5:1 (FR-026); Add stays enabled                                                                         |
| Add            | `button` "Add"                                                                            | disabled while the hex is invalid. It applies the colour and adds it to the deck in one step, then announces "Saved to this deck as n of 12" |
| Cancel         | `button` "Cancel"                                                                         | returns to the palette. Esc does the same. The preview is cleared                                                                            |

**Live preview**: while the panel is open with a valid value, the selected cards and groups show that colour on the active channel. Nothing is written to the deck.

## Detail drawer: Appearance section

- It is a `PanelSection` labelled "Appearance", in the component, bulk and group inspectors. It is not shown in `FlowInspector`.
- It holds two rows, each a `button` with `aria-haspopup="dialog"`, e.g. "Fill: Green" and "Stroke: none". Each row opens the same picker with its tab preselected.

## Canvas rendering

| State on a coloured card | Visible cue (never colour alone)                                                        | Announced                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Fill                     | background in the fill colour                                                           | the card's accessible description includes "Green fill" / "Custom fill #7a3cff" |
| Stroke                   | 1.5 px border in the stroke colour                                                      | "Blue stroke"                                                                   |
| Selected                 | 2 px orange frame 2 px **outside** the card (unchanged)                                 | "Selected" (unchanged)                                                          |
| Current flow step        | 1.5 px orange border + halo + step badge; **replaces** the coloured stroke while active | unchanged (007)                                                                 |
| Problem (015)            | 3 px dashed clay ring outside the card + alert badge on a surface disc (design 107)     | unchanged (015)                                                                 |
| Dimmed                   | same opacity rules as plain cards                                                       | unchanged                                                                       |

**Text**:

- On a named fill: title in ink, subtitle in secondary.
- On a custom fill: title, subtitle, owner and glyphs all use `card-text-dark` or `card-text-light`, whichever gives more contrast.

**Groups**:

- Fill: a solid frame background.
- Stroke: a 1.5 px dashed frame border.
- The label follows the same text rule.
- Collapsed groups render like cards.

**Outline**: an `aria-hidden` 8 px mark before the title. The row's accessible description includes the colour.

**Minimap**: node rectangles use the fill (and the stroke for their outline).

**Export (PNG / SVG)**: always light. Named colours use their light values, custom hex values stay as they are, and text follows the same rule.

## Announcements (polite live region)

- "Fill set to Green on 3 components"
- "Fill removed from 3 components"
- "Stroke set to #7a3cff on 1 group"
- "Saved to this deck as 4 of 12"
- "Removed #7a3cff from deck colours"
