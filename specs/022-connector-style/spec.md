# Feature Specification: Connector Style

**Feature Branch**: `022-connector-style`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "022 from docs/backlog.md": users style connectors with a line toolbar (dash, weight, colour, animated direction), bend them freely with bend points, attach their ends anywhere along a card side, and place the label where it reads best. The founder added a connector model and interaction rules during specify (2026-10-03).

**Sources**: `docs/backlog.md` §022 (scope, schema draft, acceptance criteria, risks) and §034 "Out of scope / later" (free anchors from frame 118 c moved here); `docs/design/design-analysis.md` and `docs/design/README.md` "Connector rows 128–133": frames 128 (toolbar and Line style popover, multi-selection "Mixed", keyboard), 129 (bend points and handles), 130 (label position), 131 (animated direction), 132 (styles on a board), 133 (what each control writes, line contrast, precedence); frame 118 c (end moved along a side); `docs/decisions/0019-card-size-and-connector-route.md` (017 route: sides and one middle-segment offset); `docs/decisions/0022-schema-roadmap.md` (`edge.style` created by 029 with `shape`, 022 adds keys); `specs/034-connection-focus-and-drill/spec.md` (bundles, Ink highlight, "022 decides"); `docs/backlog-database.md` DB8 (column ports, future reuse for side anchors); founder notes during specify, kept for the plan in [`planning-input.md`](planning-input.md); constitution v1.0.0.

**Dependency note**: 017 (route sides, middle-segment offset, Reset route), 020 (colour palette, deck colours, "No colour") and 029 (`edge.style.shape`: curved, elbow, straight) are merged on `main`. 034 (focus, bundles) is specified and may land before or after 022; the rules between them are stated below.

## Scope

**In scope**

- **Line style popover** from the connection toolbar ("Line style" button, frame 128): Type (curved, elbow, straight; exists from 029, moves into this popover), Dash (solid, dashed, dotted), Weight (1, 1.5, 2, 3, 4 px; default 2, today's line), Colour (no colour, 13 named colours, deck colours), Animate direction (on / off).
- **Multi-selection**: one pick applies to every selected connector in one undo step; sections where the selection differs show "Mixed" (frame 128 c).
- **Bend points** for every shape: a ghost midpoint handle on each segment of a selected connector; dragging it adds a bend point at the drop point; bend points move freely in any direction; removal by double-click or ⌫; Reset route clears them. This replaces 017's one-axis middle-segment drag.
- **Lighter handles**: small round handles (ends ≈ 10 px, midpoints and bends ≈ 8 px, larger on hover), shown only on hover or while the connector is selected, each with a larger invisible hit area (frame 129); the line keeps a wide invisible hit area at every weight.
- **Free anchor points**: an end can attach anywhere along a card side, with snapping and a readout (frame 118 c); dropping an end on the card body keeps the automatic side.
- **Label position**: drag the label along the line; it stays at that fraction of the line when cards move or bends change (frame 130).
- **Animated direction**: dashes run from source to target (both ways for two-way connectors); still under reduced motion, in exports and in print (frame 131).
- Drawer fields and keyboard access for every option; JSON panel in sync; round-trip and schema parity.

**Out of scope**

- **Relationship types** (calls, reads, writes, depends on) with their own dash, the board legend and the "From relationship" lock (frames 133 a, b; 034 deferred them here). Founder decision (2026-10-03): a separate later item that belongs with the Database pack (`docs/backlog-database.md`). 022 must not prevent that lock from being added later.
- Line jumps where connectors cross, arrowhead shapes, line styles for sticky leaders (backlog "Later").
- Automatic obstacle-avoiding routing (011).
- Per-view styles: style, bends, anchors and label position are shared by every view, like 017's route.
- Flow-mode styling: 006 / 007 keep their own highlight, which wins while a flow is shown.
- A darker default connector grey (frame 133 "Open · grey"): the default look stays as today.
- Ports on column rows (Database pack DB8).
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Q: 022 grew past its 5 d estimate (style popover, bends, free anchors, lighter handles, label position). One spec or a split? → A (founder): **one spec**, with prioritised stories that can ship in slices.
- Q: Are relationship types (frame 133) part of 022? → A (founder): **no**, a separate later item that belongs with the Database pack.
- Q: What is stored? → A (founder): **only what the user chose**, never the drawn path. The line is derived from the source anchor, the bend points, the target anchor and the style, so moving cards never makes stored data wrong. One ordered point list (source anchor, bend points, target anchor) drives every shape: straight draws straight runs through the points, elbow inserts right-angle legs between consecutive points with rounded corners, curved draws a smooth curve through every point.
- Q: What happens to a 017 connector whose middle segment was moved (`route.offset`)? → A (founder proposal, confirmed in the ADR): it keeps its look. The offset is treated as two implicit bend points; the first bend-point edit turns it into explicit bend points; Reset route clears both. 017 decks stay valid and round-trip without loss.
- Q: Default weight 1.5 or 2 (frame 133 "Open · weight")? → A (default, corrected in plan): **2 px**, the weight the canvas draws today (`DESIGN.md` `--sd-deck-edge` 2px, set by 029; the backlog's "today's 1.5 px" predates 029). Absent = 2 px, so no existing connector changes; the slider marks 2 "default".
- Q: When 034 highlights a connector (Ink, 2.75 px), does a connector with its own colour keep it? → A (default, confirmed by the founder in clarify): **yes**. A coloured connector keeps its colour and takes the highlight weight; a connector with no colour turns Ink as in 034. Dimming of everything else still carries the highlight, so colour is never the only cue.
- Q: Do connectors with bend points, a free anchor or their own style join a 034 bundle? → A (default, same rule as 034 for adjusted routes): **no**, they always draw on their own.
- Q: How are bend points stored so they stay right when cards move, across views and after auto-layout? → A (founder, clarify): **relative to the connector's two ends**, shared by every view. Bends move and stretch with the two cards (single-card drag, multi-card or group drag, a view with its own card positions, auto-layout), so they never sit far from the cards. The drag readout still shows board x · y. This matches 017's offset, which is also relative.
- Q: What style does a newly created connector get after the user has styled others? → A (founder, clarify): **always the default** (solid, 2 px, no colour, not animated); no "last used" memory and no deck-level default style. Copying or duplicating a connector keeps its own style, as it keeps its other fields.
- Q: What grid step do bend points snap to? → A (founder, clarify): **the canvas's existing dot grid, 22 px**; arrows move a focused bend 22 px, Shift + arrow 1 px. The canvas dots do not change (frames 129 / 133 show 24 and 26; the app wins).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Style a connector from the toolbar (Priority: P1)

A user selects the connector from "API Gateway" to "Order Service", opens "Line style" in the toolbar, picks Dashed, weight 3 and blue. The line changes as they pick. They then select three connectors at once and set them all to dotted in one step.

**Why this priority**: This is the most visible request and the smallest useful slice: users can tell kinds of lines apart without any geometry work.

**Independent Test**: In a deck with five connectors, style one, then three at once, using the pointer and then only the keyboard; undo each change in one step; check the JSON panel.

**Acceptance Scenarios**:

1. **Given** one selected connector, **When** the user opens "Line style", **Then** a popover shows Type, Dash, Weight (with 2 marked "default"), Colour (no colour, 13 named colours, deck colours) and Animate direction, each showing the connector's current value.
2. **Given** the popover is open, **When** the user picks Dashed, weight 3 and blue, **Then** the line redraws after each pick, each pick is one undo step, and the JSON panel shows the new values in the connector's style.
3. **Given** three selected connectors with different dashes, **When** the popover opens, **Then** the Dash section reads "Mixed" and marks each value in use; **When** the user picks Dotted, **Then** all three become dotted in one undo step and their other values stay their own.
4. **Given** a connector with a colour, **When** the user picks "No colour", **Then** it returns to the default line colour and the colour entry disappears from the JSON.
5. **Given** a selected connector, **When** the user works only with the keyboard (focus the toolbar, open Line style, move between sections, choose with arrows, Space for the switch, Esc to close), **Then** every option can be set and Esc returns focus to the "Line style" button (frame 128 d).
6. **Given** a connector selected, **When** the user opens the drawer, **Then** the same options are available as fields with the same values.
7. **Given** a connector with no style, **When** the deck is saved, **Then** nothing about style is written for it, and the line looks as before 022.
8. **Given** the user has just set another connector to dashed, 3 px, blue, **When** they create a new connector, **Then** it is drawn with the default style and has no style data in the JSON.

---

### User Story 2 - Bend a connector freely (Priority: P1)

A user selects the elbow connector from "Cart" to "Orders". Small handles appear between its points. They drag the middle handle down-left; a bend point appears where they drop it and the line runs through it. They drag the bend again, in any direction, and it snaps into line with the neighbouring point. A bend that ends up on a straight run disappears by itself.

**Why this priority**: The founder found 017's one-axis segment drag rigid. Free bends are the main reason for this feature's geometry work, and the lighter handles come with them.

**Independent Test**: On an elbow and a curved connector, add two bends, move one in both axes, drop one in line with its neighbours, remove one with ⌫, then Reset route; undo each in one step.

**Acceptance Scenarios**:

1. **Given** an unselected connector, **When** the pointer is not over it, **Then** no handles are drawn; **When** the pointer hovers it or it is selected, **Then** small round handles show at both ends and one ghost midpoint handle sits on each segment between neighbouring points (frame 129 a).
2. **Given** a selected elbow connector, **When** the user drags a midpoint handle and drops it, **Then** a bend point is added at the drop point, the line runs through it, a dashed ghost of the previous route shows until release, a readout shows the new bend count, and one undo step removes it.
3. **Given** a bend point, **When** the user drags it, **Then** it moves freely in both directions, snaps to the horizontal or vertical line of a neighbouring point and to the 22 px dot grid drawn on the canvas (with guides and an "x · y" readout), and holding the existing no-snap modifier places it freely.
4. **Given** a bend point dropped (nearly) in line with its two neighbours, **When** it is released, **Then** it is removed automatically, so the stored bends stay minimal.
5. **Given** a bend point, **When** the user double-clicks it, or focuses it and presses ⌫, **Then** it is removed; removing the last bend returns the automatic route.
6. **Given** the same bend points, **When** the shape is curved, elbow or straight, **Then** curved passes smoothly through every bend, elbow draws right-angle runs with rounded corners through them, and straight keeps the stored bends but draws a straight line and hides their handles.
7. **Given** a connector with bends, **When** either card moves, **Then** the bends move and stretch with the two ends (keeping their order and an elbow's right angles), and the line stays attached to both cards; **When** both cards move together by the same amount, **Then** the bends move by that amount and the line keeps its exact shape.
8. **Given** a connector with bends and a view where its cards sit elsewhere, **When** that view is shown, **Then** the same bends are drawn placed relative to the cards' positions in that view, with no extra data stored for the view.
9. **Given** a connector selected, **When** the user presses Tab, **Then** focus cycles ends → midpoints → bends; arrows move a focused bend 22 px, one grid step (with Shift, 1 px); ⏎ on a midpoint adds a bend; Esc ends (frame 129).
10. **Given** a 017 connector with a moved middle segment, **When** the deck is opened, **Then** it looks exactly as before; **When** the user first edits its bends, **Then** the offset becomes explicit bend points with no visible jump; **When** they choose Reset route, **Then** both are cleared.

---

### User Story 3 - Attach an end anywhere along a side (Priority: P2)

A user wants two connectors leaving "Order Service" on its right side not to start at the same point. They drag one end along the side; it slides, snaps at a quarter, and a "right side · 25 %" readout follows the pointer.

**Why this priority**: It makes busy cards readable, but users can work around it with bends. It needs the same handles and model as US2.

**Independent Test**: Drag an end along each side of a card, check snapping and readout, cancel with Esc, drop an end on the card body, move the card; undo each step.

**Acceptance Scenarios**:

1. **Given** a selected connector, **When** the user drags an end along a card side, **Then** the end follows the pointer projected onto the nearest side, snaps at 0 / 25 / 50 / 75 / 100 %, a readout "left side · 78 %" follows the pointer, and the old route shows dashed until release (frame 118 c).
2. **Given** an end being dragged, **When** the user presses Esc, **Then** the drag is cancelled and nothing changes.
3. **Given** an end with a free anchor, **When** the user drops it on the card body (not near a side), **Then** the end goes back to the automatic side and middle.
4. **Given** an end anchored at "right side · 25 %", **When** the card moves or is resized, **Then** the end stays at 25 % of that side.
5. **Given** an end, **When** it is dropped on a different card, **Then** the connector reconnects as today (017), anchored where it was dropped if near a side.
6. **Given** an end focused with the keyboard, **When** the user presses the arrows, **Then** it moves along its side by one snap step and onto the next side at a corner, with the readout announced.

---

### User Story 4 - Place the label where it reads best (Priority: P3)

A user drags the label "charge" from the middle of a connector towards "Checkout" so it no longer sits on a bend. Later they move "Payments"; the label stays at the same place along the line.

**Why this priority**: It polishes readability; the default middle placement already works for most connectors.

**Independent Test**: Drag a label to 20 %, snap it to 75 %, move a card, add a bend, use the keyboard; undo each step.

**Acceptance Scenarios**:

1. **Given** a connector with a label, **When** the user drags the label, **Then** it slides along the drawn line (never off it), ticks show at 25 / 50 / 75 % with a "label 20 %" readout, and it snaps within a short distance of a tick (readout adds "snapped"), unless the no-snap modifier is held (frame 130).
2. **Given** a label at 20 %, **When** either card moves or bends are added or removed, **Then** the label stays at 20 % of the new line's length, centred on it, never rotated.
3. **Given** a label dragged towards an end, **When** it reaches the end, **Then** it stops a small distance short of the end so it never covers the card or the arrowhead.
4. **Given** a focused label, **When** the user presses ← / →, **Then** it moves 5 %; Shift + ← / → jumps to the previous or next tick; Home / End go to the ends; ⏎ edits the text.
5. **Given** a label never moved, **When** the deck is saved, **Then** no label position is written and the label sits at the middle as today.

---

### User Story 5 - Show the direction of a flow with moving dashes (Priority: P3)

A user turns on "Animate direction" for the connectors along an order path. Dashes run from source to target; a two-way connector runs dashes both ways.

**Why this priority**: It is a presentation nicety, but it must never hurt accessibility or performance.

**Independent Test**: Animate one forward and one two-way connector; switch on reduced motion; export PNG and SVG; play a flow; pan the bench deck with 200 animated connectors.

**Acceptance Scenarios**:

1. **Given** a forward connector with Animate direction on, **When** it is shown, **Then** dashes run from source to target at a steady pace; a solid line shows a faint track under the moving dashes; a dashed or dotted line runs its own pattern (frame 131 a).
2. **Given** a two-way connector with Animate direction on, **When** it is shown, **Then** two dash trains run in opposite directions (frame 131 b).
3. **Given** reduced motion is set, or the deck is exported to PNG / SVG / PDF, or printed, **When** an animated connector is drawn, **Then** it is drawn exactly as with animation off; direction stays readable from the arrowhead and the start knob.
4. **Given** a flow is being shown or played, **When** connectors have animation on, **Then** their animation pauses and the flow highlight wins; it resumes when the flow closes (frame 131 d).
5. **Given** an animated connector off-screen or the tab hidden, **When** time passes, **Then** it does no drawing work.
6. **Given** the switch is focused, **When** the user presses Space, **Then** it toggles and is announced "Animate direction, on / off".

---

### User Story 6 - Existing decks, other views and exports keep working (Priority: P2)

A deck saved before 022 opens unchanged. Styled connectors look right in exports, in focus mode, in bundles and during flows.

**Why this priority**: Protects existing work and keeps the document model coherent across the features that touch connectors.

**Independent Test**: Open a 017-era deck with moved segments and a 029 deck with shapes; export, re-import and compare; turn on focus and a flow over styled connectors.

**Acceptance Scenarios**:

1. **Given** a deck without any 022 data, **When** it is opened, edited elsewhere and exported, **Then** no style, bend, anchor or label-position data appears in the file.
2. **Given** a deck with every 022 option in use, **When** it is exported and imported, or saved and reopened, **Then** every connector looks the same and the data is unchanged.
3. **Given** styled connectors with bends and moved labels, **When** the deck is exported to PNG / SVG / PDF, **Then** shapes, bends, anchors, dashes, weights, colours and label positions match the canvas (animation drawn still).
4. **Given** a flow is shown, **When** styled connectors are part of it or not, **Then** the flow's own look replaces their dash, colour and animation while shown, and they return after.
5. **Given** focus highlight (034) on a card, **When** a coloured connector is highlighted, **Then** it keeps its colour and takes the highlight weight; an uncoloured one turns Ink.
6. **Given** two connectors between the same cards, one with a bend or its own style, **When** 034 would bundle them, **Then** the styled or bent one draws on its own.
7. **Given** a connector selected, in an error state, or the current flow step, **When** it has its own colour or dash, **Then** the selection, error and flow cues still show and win over the connector's colour and dash, so those states never depend on colour alone.

---

### Edge Cases

- A connector between two cards so close that a bend or a free anchor would put the line inside a card: the line still attaches at the anchor and draws; nothing is rejected.
- Two cards moved so their ends line up (same x or same y, or very close together): bends placed relative to the ends must still draw at sensible positions and never collapse onto one point or jump to infinity; they stay stored unchanged and spread out again when the cards move apart.
- A bend dropped inside a card: allowed; the line passes over the card as any line would (no avoidance).
- A self-loop: shows no midpoint handles on the automatic loop; adding bends works the same as on other connectors.
- Many bends (for example 20): each drag stays smooth; the auto-simplify rule never removes a bend the user placed out of line.
- A free anchor on a side that disappears from use (card resized very small): the fraction is kept and clamped to the side; the end never leaves the card.
- Changing shape keeps bends, anchors and label position; straight hides bends but does not delete them.
- A label on a very short line: it sits centred and is clamped so it never covers either end.
- A deck colour later removed from the deck colours while a connector uses it: the connector keeps the stored colour and the popover shows it as a one-off swatch (same rule as 020 / 033).
- A custom colour too light to see on the canvas: the line is drawn darkened (light theme) or lightened (dark theme) just enough to stay visible, while the stored colour stays as chosen (frame 133 "Custom colours").
- Reduced motion turned on while connectors are animating: animation stops at once and lines are drawn still.
- Collapsed groups and drill-in (010, 034): merged and proxy connectors keep their own look; the styles of the connectors inside apply when they are drawn individually.
- Undo and redo of a drag that added a bend, then auto-simplified it, is one step.
- Two tabs editing the same connector: the last write per value wins and the connector stays valid (collaboration-ready document, 036).

## Requirements _(mandatory)_

### Functional Requirements

**Style**

- **FR-001**: The connection toolbar MUST offer a "Line style" control that opens a popover with Type, Dash, Weight, Colour and Animate direction, each showing the current value (frame 128).
- **FR-002**: Dash MUST offer solid (default), dashed and dotted; dashed and dotted patterns MUST scale with the weight and have round ends.
- **FR-003**: Weight MUST offer the steps 1, 1.5, 2, 3 and 4 px, with 2 (today's line) as the default and marked "default".
- **FR-004**: Colour MUST offer "No colour" (the default line colour), the 13 named colours and the deck's colours; a colour too faint against the canvas MUST be drawn adjusted for visibility without changing the stored choice.
- **FR-005**: Each pick MUST apply at once and be one undo step; with several connectors selected, a pick MUST write only that option to every selected connector, and sections whose values differ MUST read "Mixed".
- **FR-005a**: A newly created connector MUST start with the default style and no stored style data, whatever was picked for other connectors; the deck MUST NOT hold a default connector style. Copy, paste and duplicate MUST keep the copied connector's style.
- **FR-006**: Every option MUST be available as a drawer field and through the keyboard, with focus returned to the toolbar on Esc (frame 128 d).

**Bends and handles**

- **FR-007**: A selected connector MUST show a midpoint handle on each segment between neighbouring points; dragging one MUST add a bend point at the drop point.
- **FR-008**: Bend points MUST move freely in both directions, snapping to the horizontal or vertical line of a neighbouring point and to the canvas's 22 px dot grid, with the no-snap modifier disabling snapping.
- **FR-009**: A bend point released (nearly) in line with its neighbours MUST be removed automatically, in the same undo step as the drag.
- **FR-010**: A bend point MUST be removable by double-click or ⌫ while focused; Reset route (017) MUST clear all bend points and free anchors.
- **FR-011**: The same ordered points (source end, bends, target end) MUST drive every shape: curved passes smoothly through them, elbow draws right-angle runs with rounded corners through them, straight hides them without deleting them.
- **FR-012**: Handles MUST be small and round, shown only on hover or while the connector is selected, each with a larger invisible hit area; the line MUST keep an easy-to-hit area at every weight (frame 129). They replace 017's end grips and segment pill.
- **FR-013**: A 017 connector with a moved middle segment MUST look unchanged when opened; its first bend edit MUST convert the segment offset into equivalent bend points without a visible jump.

**Anchors**

- **FR-014**: Dragging an end along a card side MUST set its anchor as the side plus a position along it, snapping at 0 / 25 / 50 / 75 / 100 %, with a readout, a dashed preview of the old route and Esc to cancel (frame 118 c).
- **FR-015**: Dropping an end on the card body MUST return it to the automatic side; an anchored end MUST keep its relative position when the card moves or resizes.

**Label**

- **FR-016**: The label MUST be draggable along the drawn line; its position MUST be stored as a fraction of the line's length (default middle), snap at 25 / 50 / 75 %, stay clamped short of both ends, and stay at the same fraction when cards or bends change.
- **FR-017**: A focused label MUST move 5 % with ← / →, jump between ticks with Shift, go to the ends with Home / End, and enter text editing with ⏎.

**Animation**

- **FR-018**: Animate direction MUST run dashes from source to target, both ways for two-way connectors, and be off by default.
- **FR-019**: Animated connectors MUST be drawn still under reduced motion, in PNG / SVG / PDF export and in print, MUST pause while a flow is shown, and MUST do no drawing work while off-screen or while the tab is hidden.

**Data, precedence and compatibility**

- **FR-020**: Only what the user chose MUST be stored (style values, bend points relative to the connector's two ends, anchors, label position); the drawn line MUST be derived, so moving cards never invalidates stored data. All new data MUST be optional; absent means today's look.
- **FR-021**: A deck without 022 data MUST round-trip with no 022 data added; a deck with 022 data MUST round-trip without loss; the JSON panel MUST show the data in sync with the canvas.
- **FR-022**: Style, bends, anchors and label position MUST be shared by every view; bends MUST be placed relative to where the two cards sit in the view being shown, so they follow the cards through drags, group moves, per-view positions and auto-layout.
- **FR-023**: Flow, error and selection cues MUST win over a connector's own colour, dash and animation while shown; a connector's colour MUST never be the only cue for any state.
- **FR-024**: Under 034's focus highlight, a coloured connector MUST keep its colour and take the highlight weight; an uncoloured one MUST turn Ink. Connectors with bend points, a free anchor or their own style MUST NOT join a 034 bundle.
- **FR-025**: Exports MUST draw shapes, bends, anchors, dash, weight, colour and label position as on the canvas.
- **FR-026**: The popover, handles and label MUST expose roles and labels to assistive technology and announce changes (bend added / removed, anchor readout, label position, switch state).
- **FR-027**: No part of this feature MUST make a network call.

### Key Entities

- **Connector style**: the user's choices for one connector: shape (029), dash, weight, colour, animated. Each optional; absent means the default.
- **Bend point**: a point the line passes through, stored relative to the connector's two ends (not as a fixed board position) so it follows the cards; ordered from source to target; stored only when the user places one.
- **Anchor**: where an end attaches to its card: a side plus a position along it (0–1); absent means the automatic side and middle.
- **Label position**: a fraction (0–1) of the drawn line's length where the label sits; absent means the middle.
- **Drawn line**: derived from anchors, bend points and style each time it is drawn; never stored.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can set dash, weight and colour on one connector in under 10 seconds from selecting it, and on three connectors at once in one undo step.
- **SC-002**: A user can add, move and remove a bend point on an elbow and a curved connector without leaving the canvas, and every such change is undone in exactly one step in 100 % of cases tried.
- **SC-003**: After moving either card 20 times, switching between views and running auto-layout, 100 % of stored bend points, anchors and label positions are unchanged, every bend stays between or around its two cards (never left behind), and every line stays attached to both cards.
- **SC-004**: 100 % of decks saved before 022 (including 017 decks with moved segments and 029 decks with shapes) open looking the same and export with no 022 data added.
- **SC-005**: A deck with every 022 option in use survives export, import, save and reopen with no data loss.
- **SC-006**: Every option (style, bends, anchors, label position, animation) can be set with the keyboard alone.
- **SC-007**: On the benchmark deck with 200 animated connectors, panning stays at 60 frames per second or better; with no animated connectors, canvas timings stay within run-to-run variation of the numbers before 022.
- **SC-008**: Every named colour at the default weight reaches at least 3:1 against the canvas in light and dark themes, and so does a deck colour after its visibility adjustment.

## Assumptions

- The ordered points model, the 017 offset conversion, and the stored names (`edge.style` keys `dash`, `width`, `color`, `animated`; bend points; anchor position along a side; `edge.labelAt`) are settled in one ADR that extends ADR 0019 and 0022. All additions are optional, so no version bump. Per founder decision §g-81 the format may change freely before the first release.
- The anchor field is designed so the Database pack's column ports (DB8) can later reuse the same place for ends.
- Bend points snap to the canvas's existing 22 px dot grid (clarify Q3); the 24 px and 26 px values in frames 129 and 133 are not used and the canvas dots do not change.
- The default connector colour and the 2 px default weight are unchanged; frame 133's darker grey is not applied.
- The line style popover replaces the place where 029's shape choice lives in the toolbar today; the connection menu, drawer and keys get the same options through the existing action registry (ADR 0015).
- Real-time collaboration is out of scope; the document stays collaboration-ready (036).
- Frames 128–131 (light and dark) are the visual reference; `DESIGN.md` wins where they differ.
