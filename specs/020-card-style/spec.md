# Feature Specification: Card Style (Fill and Stroke Colours)

**Feature Branch**: `020-card-style`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "020 (card-style) from docs/backlog.md. Let users colour components. A selected component (or several) can get a fill colour and a border colour from a fixed palette that looks right in light and dark themes, or be reset to the default. A "+" at the end of the palette lets users add their own colour, which is kept with the deck and offered for every component in it. Colours are saved in the deck file as optional fields, so older decks open unchanged. Text stays readable on any colour, and colour is never the only way a state is shown. Why: in large diagrams people use colour to show team, phase or status at a glance."

**Sources**: `docs/backlog.md` §020 (scope, design deltas, schema, acceptance criteria, risks) and the 016 note (groups store a frame; group style sits next to it), `docs/design/design-analysis.md` §a states 91 and 105–107, component inventory ("Colour popover and swatch", "Card on colour"), "Tokens introduced by states 86–116", founder decisions §g-39 (fixed palette + custom hex swatches), §g-40 (no user-defined attributes), §g-43 (groups get the same fill / stroke), §g-52 (12 custom colours per deck, checked by the model, not the file format), `DESIGN.md` "Card colours" and the selection frame, `specs/019-card-quick-edit/spec.md` (selection toolbar, context menu and shared action list that this feature plugs into), constitution v1.0.0 (principles I, II, III, VI, VII, VIII).

**Dependency note**: 019 (card quick edit) and 016 (canvas editing) are merged on `main` (`55c087e`, `60cfc46`): the selection toolbar, context menu, shared action list, detail drawer and group frames exist. The selection frame already sits outside the card (DESIGN.md). This feature adds the colour fields to the file format and the pickers that set them.

## Scope

**In scope**

- **Fill and stroke on components and groups**: optional, from 13 named colours (red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, slate) or a custom hex colour; "No colour" resets to today's look.
- **Colour picker** (design 105): Fill / Stroke tabs, No colour, the 13-colour grid, the deck's custom colours ending in "+". Opened from the selection toolbar (components and groups), the context menu, and a new **Appearance** section in the detail drawer (design 91).
- **Custom deck colours** (design 106): "+" opens a colour input (saturation box, hue bar, hex field, Add) with a live preview on the selection; the colour is saved to the deck (max 12) and offered in every picker in that deck; a custom colour can be removed from the deck (cards that use it keep it).
- **Readable text on any fill**: named fills keep dark text in both themes; custom fills switch card text between dark and light automatically.
- **Consistent rendering** of the colours on the canvas at every zoom level, in the outline, the minimap and PNG / SVG export, in light and dark themes.
- **File format**: optional `style` on components and groups and an optional deck-level list of custom colours; older files open unchanged and files round-trip without loss.
- Multi-selection in one undo step; keyboard access and screen-reader names for every part of the picker.

**Out of scope**

- Colouring connections and sticky notes (later).
- Opacity, gradients, patterns, text colour or font choices.
- User-defined card attributes and colour-by-attribute rules (§g-40).
- Editing the 13 named colours or reordering the palette; importing palettes from other decks.
- New shortcut keys for colours (the picker is reached through the toolbar, the context menu and the drawer).

## Clarifications

### Session 2026-09-29

- Q: What happens with a mid-tone custom colour where neither dark nor light text reaches 4.5:1 contrast? → A: Allow it, use the higher-contrast text colour, and warn in the add-colour panel ("Text may be hard to read on this colour") (Edge Cases, FR-026, FR-033).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Colour a component from the palette (Priority: P1)

An architect marks everything the Payments team owns. They select "Checkout API", open the colour button in the selection toolbar, and pick Green on the Fill tab. The card turns green in the light theme and stays a matching green when they switch to dark. The JSON panel shows `"style": { "fill": "green" }`. They switch to the Stroke tab and pick Green there too; the card border becomes a stronger green. One ⌘Z removes the stroke, a second removes the fill.

**Why this priority**: showing meaning by colour is the whole point of the feature; a named palette alone already delivers it.

**Independent Test**: on a loaded deck, select one card, set a fill and a stroke from the toolbar picker, check the card in both themes, the JSON panel and the drawer, and undo each change separately.

**Acceptance Scenarios**:

1. **Given** a selected card, **When** the user picks "Green" on the Fill tab, **Then** the card shows the green fill in both themes, the JSON shows `"style": { "fill": "green" }`, and one ⌘Z removes it.
2. **Given** a selected card, **When** the user picks "Blue" on the Stroke tab, **Then** the card border becomes the blue stroke (thicker than the default border) and the JSON shows `"stroke": "blue"`.
3. **Given** a card with a fill, **When** the user opens the picker, **Then** the current colour shows a ring and a check mark and its name is announced as selected.
4. **Given** a card with fill and stroke, **When** the user picks "No colour" on the Fill tab, **Then** only the fill is removed; if both are removed, `style` is gone from the JSON entirely.
5. **Given** a picker swatch, **When** the user hovers or focuses it, **Then** a tooltip and its accessible name give the colour's name (e.g. "Green").
6. **Given** a card with a named fill, **When** rendered, **Then** its title stays in the normal dark text colour and its subtitle switches to the stronger secondary text colour, both readable in light and dark themes.
7. **Given** the detail drawer open on a card, **When** the user opens its Appearance section, **Then** it shows the current fill and stroke and opens the same picker; a change there shows on the card immediately.

---

### User Story 2 - Colour several components at once (Priority: P1)

The architect selects the six cards of the "Orders" domain and sets Amber fill once. All six turn amber; one ⌘Z reverts all six. Later they select three cards with different colours and choose "No colour": all three lose their fill in one step.

**Why this priority**: colouring is done by team, phase or domain, which is almost always many cards; one at a time would make the feature tedious.

**Independent Test**: select several cards with different fills, check the picker shows no check mark, apply a colour and "No colour", and confirm each is one undo step for all cards.

**Acceptance Scenarios**:

1. **Given** three selected cards, **When** the user picks "Amber" fill, **Then** all three get `style.fill = "amber"` and one ⌘Z restores each card's previous fill.
2. **Given** three selected cards, **When** "No colour" is chosen on the Fill tab, **Then** all three lose `style.fill` in one undo step and keep their stroke.
3. **Given** selected cards whose fills differ, **When** the picker opens, **Then** no swatch shows a check mark and the picker states "Mixed".
4. **Given** selected cards that all share the same fill, **When** the picker opens, **Then** that swatch shows as selected.
5. **Given** a selection of cards and groups, **When** the user picks a fill, **Then** it applies to all selected cards and groups in one undo step.

---

### User Story 3 - Add a deck colour (Priority: P2)

The company's brand purple is not in the palette. The architect clicks "+" at the end of the deck colours, types `#7a3cff` in the hex field (or picks it in the saturation box and hue bar) and sees the selected card preview the colour live. They press Add: the card is purple, the colour appears in the deck colours of every picker in this deck, and the footer read "Saved to this deck as 1 of 12". They export the deck, import it on another machine, and the purple is still there in the cards and in the picker.

**Why this priority**: brand and team colours often fall outside a fixed palette; it is a smaller audience than the named palette, so P2.

**Independent Test**: add a custom colour, check it is applied, listed in every picker of the deck, saved in the file, and survives export / import; check invalid hex and the 12-colour limit.

**Acceptance Scenarios**:

1. **Given** the picker, **When** the user clicks "+", enters `#7a3cff` and presses Add, **Then** the colour is applied to the selection on the active tab (fill or stroke), is added to the deck colours, and the JSON shows it both on the card and in the deck's custom colour list.
2. **Given** the custom colour input, **When** the user changes the colour, **Then** the selected cards preview it live; **When** the user cancels (Esc or closing the picker), **Then** the cards return to their previous look and nothing is added to undo history.
3. **Given** the hex field, **When** the value is not a valid 6-digit hex colour (with or without `#`, any letter case), **Then** Add is disabled and the field says why.
4. **Given** a colour that is already one of the deck colours, **When** the user adds it again, **Then** it is not duplicated; the existing swatch is applied.
5. **Given** a deck with 12 custom colours, **When** the picker opens, **Then** "+" is not shown (hidden, not disabled), and the footer explains the limit.
6. **Given** a custom colour added in one deck, **When** the user opens another deck, **Then** that colour is not in its picker.
7. **Given** a deck with custom colours, **When** it is exported and imported again, **Then** the colours are in the picker in the same order and on the same cards.
8. **Given** the custom colour input on a mid-tone colour such as `#7c7c7c`, **When** neither dark nor light text reaches 4.5:1 on it, **Then** the panel shows "Text may be hard to read on this colour" (announced) and Add stays enabled.
9. **Given** a custom colour was added and applied, **When** the user presses ⌘Z, **Then** the application and the new deck colour are undone together in one step.

---

### User Story 4 - Remove a deck colour (Priority: P3)

The architect added a colour by mistake. They hover its swatch, a small × badge appears; they click it (or focus the swatch and press ⌫). The swatch disappears from the deck colours. Cards already painted with it keep their colour.

**Why this priority**: housekeeping for P2; rarely needed and harmless to lack for a while.

**Independent Test**: remove a custom colour used by a card; check the swatch is gone, the card keeps its colour, and ⌘Z brings the swatch back.

**Acceptance Scenarios**:

1. **Given** a custom swatch, **When** the user hovers or focuses it, **Then** a × badge shows with the accessible name "Remove <hex> from deck colours".
2. **Given** a focused custom swatch, **When** the user presses ⌫ or Delete (or clicks ×), **Then** it is removed from the deck colours in one undo step and no card changes.
3. **Given** a card whose fill is a removed custom colour, **When** the picker opens on it, **Then** no swatch shows as selected and the footer shows the card's hex value.
4. **Given** the deck had 12 colours, **When** one is removed, **Then** "+" shows again.

---

### User Story 5 - Colour a group (Priority: P3)

In a dense deck, the architect gives the "Payments" group a teal fill and the "Legacy" group a red stroke. The Payments frame is tinted teal behind its members; the Legacy frame gets a dashed red border.

**Why this priority**: groups already show structure through their frames; colour adds emphasis, but component colour matters more.

**Independent Test**: select a group, set fill and stroke from its toolbar and from the drawer; check the frame at each zoom level, collapsed and expanded, and in the JSON.

**Acceptance Scenarios**:

1. **Given** a selected group, **When** the user picks "Teal" fill from the group toolbar, **Then** the group frame is tinted teal behind its members and the JSON shows `"style": { "fill": "teal" }` on the group.
2. **Given** a selected group, **When** the user picks "Red" stroke, **Then** the frame border becomes a dashed red line.
3. **Given** a coloured group, **When** it is collapsed (010), **Then** the collapsed group card uses the same fill and stroke as a component would.
4. **Given** a coloured group with coloured members, **When** rendered, **Then** the members keep their own colours on top of the group tint.

---

### User Story 6 - States stay visible on colour (Priority: P1)

The architect plays the checkout flow. The current step is a green card; its orange flow ring, halo and step badge are fully visible. A card with a validation problem is violet; its dashed error ring and alert badge are visible. Selecting any coloured card shows the orange selection frame outside the card.

**Why this priority**: colour must never hide the product's core states (flow tracing, errors, selection); this is a constitution rule (VII), so it ships with P1.

**Independent Test**: on cards with each named fill and stroke and a dark and light custom fill, check selected, flow step, error, dimmed, hover and focus states in both themes, and check that they are announced.

**Acceptance Scenarios**:

1. **Given** a flow highlight on a coloured card, **When** rendered, **Then** the flow ring, halo and step badge are visible and the step is announced as today.
2. **Given** a coloured card with a problem (015), **When** rendered, **Then** the dashed error ring outside the card and the alert badge are visible and announced.
3. **Given** a selected coloured card, **When** rendered, **Then** the selection frame sits outside the card and the card is announced as selected.
4. **Given** focus or flow mode dims other cards, **When** they are coloured, **Then** they dim the same way as plain cards.
5. **Given** a card with a coloured stroke, **When** it is selected or on a flow step, **Then** the state marks are still distinct from the stroke (different position or shape, not only a different colour).

---

### Edge Cases

- **Dark custom fill**: card text switches to a light colour and meets 4.5:1 contrast (e.g. `#1f2a44`).
- **Mid-tone custom fill** (relative luminance about 0.18–0.22, e.g. `#7c7c7c`), where neither dark nor light text reaches 4.5:1: the colour is allowed; cards use the text colour with the higher contrast, and the add-colour panel shows the warning "Text may be hard to read on this colour" (FR-026).
- **Custom colour in the other theme**: a custom hex is shown exactly as chosen in both themes; only the text colour adapts.
- **Stroke only**: a card with a stroke but no fill keeps the normal surface background.
- **Card with a hex colour that is not in the deck colours** (the swatch was removed, or the card was pasted from another deck): shown as-is; the picker shows no check and the footer shows the hex; the colour is not added to the deck automatically.
- **Paste from another deck** (016): pasted cards keep their colours; custom colours are not added to the target deck's list.
- **Imported file with more than 12 custom colours** (hand-edited or from another tool): the file opens, all listed colours show in the picker, "+" is hidden until the list is below 12; nothing is dropped silently.
- **Imported file with an unknown colour name or malformed hex**: rejected by the normal file validation with a message naming the field, like any other invalid file.
- **Hex letter case and `#`**: `#7A3CFF`, `7a3cff` and `#7a3cff` are the same colour; it is stored one way (lowercase with `#`) so duplicates cannot appear.
- **Removing a colour while another tab uses it**: tabs sync (§g-35); the swatch disappears in both tabs; cards keep the hex.
- **Two tabs add a custom colour at the same time**: both colours are kept if the list has room; if the limit would be exceeded by the merge, the list may briefly hold more than 12 and "+" stays hidden (as for an over-limit import).
- **Semantic zoom** (010): colours show at every zoom level, including the compact block and landscape levels.
- **Saved views** (011) that dim or hide kinds: dimming applies on top of the colour as on plain cards.
- **Flow mode, flow recording, view-only editor (< 1024 px)**: the picker is not offered (it changes the deck); existing colours still render.
- **Stickies and connections selected with cards**: colour applies only to cards and groups in the selection; the picker says how many items it will change.
- **Reduced motion**: the picker and preview appear without animation.

## Requirements _(mandatory)_

### Functional Requirements

**Colour data**

- **FR-001**: Components and groups MUST support an optional style with an optional fill and an optional stroke; absent means today's look.
- **FR-002**: A colour value MUST be either one of the 13 named colours (red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, slate) or a 6-digit hex colour stored lowercase with a leading `#`.
- **FR-003**: A deck MUST support an optional ordered list of custom colours (hex values, no duplicates), shown after the named palette in every picker of that deck.
- **FR-004**: Adding a custom colour MUST be refused when the deck already has 12; this limit is enforced by the editor, not by file validation, so a file with more still opens (§g-52).
- **FR-005**: Removing all fill and stroke from an object MUST remove its style entirely, so unchanged or reset objects write no style to the file.
- **FR-006**: Files without any of these fields MUST open and save unchanged, and files with them MUST round-trip without loss (export → import gives the same values and the same custom colour order).

**Picker**

- **FR-010**: The colour picker MUST offer Fill and Stroke tabs, "No colour", the 13 named colours in a grid of 7 per row, and the deck's custom colours followed by "+" (hidden when the deck has 12).
- **FR-011**: The picker MUST be reachable from the selection toolbar for one or more components and for groups (019), from the context menu of components and groups, and from an Appearance section in the detail drawer; all three MUST use the same picker and the shared action list (019 FR-040).
- **FR-012**: The current colour of the selection MUST be marked with a ring and a check mark (not colour alone); a selection with differing values MUST show no check and the word "Mixed".
- **FR-013**: Every swatch MUST have a tooltip and an accessible name (the colour name, or the hex for custom colours); the picker MUST show the name of the hovered or selected colour in its footer.
- **FR-014**: The picker MUST be fully operable by keyboard: arrow keys move between swatches, Enter / Space applies, Tab moves between the tabs, "No colour", the grids and "+"; Esc closes it and returns focus to its opener.
- **FR-015**: Picking a colour or "No colour" MUST apply to every component and group in the selection in one undo step, and the change MUST appear at once on the canvas, outline, minimap, drawer and JSON panel.

**Custom colours**

- **FR-020**: "+" MUST open a colour input with a saturation box, a hue bar and a hex field, plus Add and Cancel.
- **FR-021**: While the input is open, the selection MUST preview the colour live; cancelling MUST restore the previous look without an undo entry.
- **FR-022**: Add MUST be disabled for an invalid hex value, with a visible and announced reason.
- **FR-023**: Add MUST apply the colour to the selection on the active tab and append it to the deck colours in one undo step, and show "Saved to this deck as n of 12".
- **FR-024**: Adding a colour already in the deck list MUST apply the existing one without duplicating it.
- **FR-025**: A custom swatch MUST be removable from the deck list via a × badge on hover or focus, or ⌫ / Delete when focused, in one undo step, without changing any card or group that uses that colour.
- **FR-026**: When neither dark nor light text reaches 4.5:1 on the colour in the custom colour input, the input MUST show a visible and announced warning "Text may be hard to read on this colour" while still allowing Add.

**Rendering and readability**

- **FR-030**: Each named colour MUST have a fill and a stroke value for the light theme and for the dark theme, following DESIGN.md "Card colours"; switching theme MUST switch the values.
- **FR-031**: A custom colour MUST be shown exactly as chosen in both themes.
- **FR-032**: On a named fill, the card title MUST keep the normal text colour and the subtitle MUST use the secondary text colour; both MUST meet 4.5:1 contrast in both themes.
- **FR-033**: On a custom fill, the card's title, subtitle and glyphs MUST switch automatically between the normal dark text and light text picking whichever gives the higher contrast, so the title reaches at least 4.5:1 wherever either choice can (DESIGN.md: light text below about 0.18 relative luminance). When neither reaches 4.5:1, the higher-contrast choice is still used and the colour stays allowed (FR-026).
- **FR-034**: A stroke MUST replace the default card border with a thicker border in the stroke colour; on groups the stroke MUST be a dashed frame border and the fill a tint behind the members.
- **FR-035**: Colours MUST show at every semantic zoom level, on collapsed groups, in the outline (a small colour mark next to the item), in the minimap, and in PNG and SVG export (012).
- **FR-036**: Selection, flow step, error, focus, hover, pinned and dimmed states MUST remain visible and distinct on every fill and stroke, and MUST keep their non-colour cues (position outside the card, dashes, badges, announcements) (constitution VII).

**Availability**

- **FR-040**: The picker MUST NOT be offered in flow mode, during flow recording or in the view-only editor; existing colours still render there.
- **FR-041**: Colour changes MUST sync between open tabs of the same deck like any other edit.
- **FR-042**: Colours MUST never be sent over the network; every value, name and swatch is local to the deck (constitution IV).

### Key Entities _(include if feature involves data)_

- **Style**: optional appearance of a component or a group: a fill and a stroke, each a Colour Reference. Absent means the default look.
- **Colour Reference**: either one of 13 named palette colours (theme-aware: each has a light and dark fill and stroke) or a fixed hex colour (the same in both themes).
- **Deck colours**: an ordered list of up to 12 custom hex colours belonging to one deck, offered in every picker of that deck. Removing one does not change objects that use it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can colour one component with a named colour in 3 interactions or fewer from a selected card (open picker, pick), and colour 20 selected components in the same number.
- **SC-002**: Every named fill, in both themes, gives card titles and subtitles at least 4.5:1 contrast; every custom fill does too except mid-tones where no text colour can, which get the add-colour warning instead (checked automatically for all 13 colours and a sample of custom colours).
- **SC-003**: 100 % of decks saved before this feature open, display and save unchanged (no added fields); 100 % of decks with colours round-trip through export / import with identical colours and deck colour order.
- **SC-004**: Selected, flow-step and error states are identifiable on every one of the 13 fills and 13 strokes in both themes without relying on colour (verified against design 107).
- **SC-005**: A 500-component / 1,000-connection deck with every component coloured stays at the same frame rate as the same deck uncoloured (within 5 %), and a flow highlight still appears in under 100 ms.
- **SC-006**: Every part of the picker, including adding and removing a custom colour, can be completed with the keyboard alone and is announced correctly by a screen reader.
- **SC-007**: The implemented states 91 (Appearance section), 105, 106 and 107 match the design screenshots in light and dark, with differences either fixed or listed.

## Assumptions

- Colour data lives in the deck document like every other field, so it autosaves, syncs between tabs and undoes with the rest (019 / 005 behaviour); no separate storage.
- The toolbar shows one colour button (showing the current fill) that opens the picker with both tabs, as in design 105; there are not separate Fill and Stroke buttons.
- Removing a custom colour needs no confirmation: it changes no card, and ⌘Z restores it. §g-11 (confirm before delete) covers deleting diagram objects, not swatches.
- Named colours are stored by name, not by value, so a future palette tweak changes every card that uses the name; custom hex values never change.
- Copy / paste (016) and the JSON fragment carry `style` like any other field; nothing extra is required.
- The PNG / SVG export (012) always uses the light appearance, so named colours export with their light values; custom colours stay fixed.
- No new runtime dependency is expected (the colour input is built from existing primitives); the plan confirms this (constitution VIII).
- Connections and stickies keep their current look; their colouring is a later feature.
