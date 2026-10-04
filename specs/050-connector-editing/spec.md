# Feature Specification: Connector editing

**Feature Branch**: `050-connector-editing`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Connector editing UX overhaul (follow-up to 022 connector style and 017 edge routing), based on founder manual testing: anchor dragging jumps; dragging the line stops after a few pixels; weight shows no visible change and needs a draggable slider; handles under cards can't be grabbed; connectors can't attach to groups; alignment guides sometimes stay on screen. Inspired by mature whiteboard editors (continuous outline attachment, handles above everything, segment drag), described on its own terms."

## Clarifications

### Session 2026-10-04

- Q: How does a connector end go back to automatic placement? → A: Dropping it in the centre zone of its own card (the middle 40 % of the card's width and height) makes it automatic; the existing reset command also does.
- Q: Which weight stops? → A: Keep the current five stops (1 / 1.5 / 2 / 3 / 4 px); stored values do not change. The visibility problem is fixed by drawing the selected connector at its real weight.
- Q: Are groups connector endpoints in this feature? → A: Yes, in this feature. The founder uses card↔group and group↔group connectors often, so it is high priority.

## Context

Founder manual testing of the connector features from 022 (style, bends, anchors, label position) found that editing a connector's shape feels unreliable. Observed problems:

1. **Ends jump.** When dragging a connector end, it jumps unexpectedly: it leaps to the middle of a side or back to "automatic" as soon as the pointer goes a little way into the card, and the side flips suddenly near a corner.
2. **The line can't be dragged.** Dragging the line (a midpoint handle) moves it a few pixels, then it stops following the pointer.
3. **Weight seems to do nothing.** Changing the weight makes no visible difference. A selected connector is always drawn at one fixed width, and the weight steps are very close together.
4. **The weight control is fiddly.** It is a row of dots that must be clicked exactly; it cannot be dragged.
5. **Handles hide under cards.** An end or bend that sits under or inside a card cannot be grabbed, because the handles are drawn beneath the cards.
6. **Groups can't be connected.** A connector cannot go from a card to a group, from a group to a card, or between two groups.
7. **Guides stay on screen.** The alignment guide lines shown while dragging a card or a connector sometimes stay visible after the drag ends.

The connector **type** (curved, elbow, straight) works well and is out of scope.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Grab and drag any handle of the selected connector (Priority: P1)

A user selects a connector and drags its ends, bends and midpoints. Every handle can be grabbed wherever it is, even under or inside a card, and keeps following the pointer until release.

**Why this priority**: None of the other editing improvements matter while handles are unreachable or drags die after a few pixels. This is the core breakage.

**Independent Test**: Select a connector whose end sits under a card and drag the end. Then drag a midpoint across the canvas in one long motion. Both follow the pointer all the way and land where released.

**Acceptance Scenarios**:

1. **Given** a selected connector whose end or bend lies under or inside a card, **When** the user presses on that handle, **Then** the handle (not the card) starts dragging.
2. **Given** a selected connector, **When** the user drags a midpoint handle in one continuous motion across the canvas, **Then** the new bend follows the pointer for the whole drag and lands where the pointer is released.
3. **Given** a selected connector, **When** the user drags an existing bend, **Then** it follows the pointer for the whole drag, including over cards.
4. **Given** the user presses on a handle and moves less than the drag threshold before releasing, **When** they release, **Then** nothing changes in the document (no bend added, no undo step).
5. **Given** a drag in progress, **When** the user presses Esc, **Then** the connector returns to its shape before the drag and nothing is written.
6. **Given** a segment shorter than the minimum handle spacing, **When** the connector is selected, **Then** that segment shows no midpoint handle, so handles never overlap.

---

### User Story 2 - Slide a connector end smoothly along a card (Priority: P1)

A user drags a connector end around a card. The end glides continuously along the card's outline, following the pointer, with gentle snapping to the quarter points of a side. It never jumps on grab or mid-drag.

**Why this priority**: Anchor placement is the most visible problem the founder reported, and the reason connector routing feels "not under my control".

**Independent Test**: Drag one end of a connector slowly all the way around its card, both outside and inside the card's edge. The end follows the outline continuously, snaps near the quarter points, and lands where released.

**Acceptance Scenarios**:

1. **Given** a selected connector, **When** the user presses on an end without moving, **Then** the end does not move at all (no jump to the pointer or to a side midpoint).
2. **Given** an end being dragged near or inside its card, **When** the pointer moves, **Then** the end sits on the point of the card's outline closest to the pointer and moves continuously with it.
3. **Given** an end being dragged, **When** the pointer passes a card corner, **Then** the end moves around the corner onto the next side without skipping or jumping elsewhere on the card.
4. **Given** an end being dragged, **When** it comes within the snap reach of 0, 25, 50, 75 or 100 % of a side, **Then** it snaps there and the readout says so. **When** the user holds ⌘ (Ctrl on Windows/Linux), **Then** there is no snapping.
5. **Given** an end being dragged, **When** the pointer moves onto a different card (or group, see US4), **Then** the end attaches to that card's outline in the same continuous way, and releasing reconnects the connector to it.
6. **Given** an end being dragged, **When** it is released away from any card, **Then** the connector keeps its previous end (nothing changes) and the user is told why.
7. **Given** an end with a pinned position, **When** the user drops it in the centre zone of its own card, or uses the existing reset command on the end, **Then** the end goes back to automatic placement.
8. **Given** a connector end focused with the keyboard, **When** the user presses the arrow keys, **Then** it steps along the side to the next snap stop, as today (022).

---

### User Story 3 - See and set the weight (Priority: P2)

A user changes a connector's weight and sees the line get thicker or thinner right away, even while the connector is selected. The weight control is a slider they can drag.

**Why this priority**: The weight control currently looks broken. The fix is small and self-contained.

**Independent Test**: Select a connector, drag the weight slider from thinnest to thickest, and watch the selected line change width at every step. Undo once and the weight returns to where it was.

**Acceptance Scenarios**:

1. **Given** a selected connector, **When** its weight is changed, **Then** the line is drawn at the new weight while it stays selected. Selection is shown by the selection colour and a soft halo around the line, not by changing the width.
2. **Given** the weight slider, **When** the user presses anywhere on its track and drags, **Then** the value follows the pointer to the nearest stop, and the connector previews each stop live.
3. **Given** a weight drag, **When** the user releases, **Then** exactly one undo step is recorded. **When** they press Esc during the drag, **Then** the weight returns to its value before the drag.
4. **Given** the weight stops (1 / 1.5 / 2 / 3 / 4 px), **When** the user moves between them on a selected connector, **Then** the drawn width changes at every stop.
5. **Given** the slider has keyboard focus, **When** the user presses ← → / Home / End, **Then** it moves one stop / to the ends, as today.
6. **Given** several selected connectors with different weights, **When** the slider is dragged, **Then** all of them take the new weight in one undo step.

---

### User Story 4 - Connect cards and groups (Priority: P1)

A user draws a connector from a card to a group, from a group to a card, or between two groups, the same way they connect two cards.

**Why this priority**: A real gap in what can be expressed (for example "service → whole data layer"), and something the founder needs often. It is independent of the editing fixes, so it can ship on its own.

**Independent Test**: Draw a connector from a card to a group, one from a group to a card and one between two groups. Each is saved, survives reload and export/import, and can be selected, styled and reconnected like any other connector.

**Acceptance Scenarios**:

1. **Given** a card and a group, **When** the user drags from the card's connect handle and drops on the group (its frame or label), **Then** a connector from the card to the group is created.
2. **Given** a group, **When** the user starts a connection from the group, **Then** they can drop it on a card or another group, and a connector is created.
3. **Given** a connector to a group, **When** the group is moved or resized, **Then** the connector stays attached to the group's outline.
4. **Given** a connector to a group, **When** the group is deleted, **Then** the connector is deleted with it, in the same undo step, as happens for cards.
5. **Given** a connector between a group and one of its own members, or between a group and a group it contains, **When** the user tries to create it, **Then** it is refused with a short reason.
6. **Given** a connector attached to a group, **When** the deck is exported and re-imported, **Then** the connector is unchanged (lossless round-trip).
7. **Given** a connector attached to a group, **When** the group is collapsed, **Then** the connector still draws to the collapsed group.

---

### User Story 5 - Drag a whole elbow segment (Priority: P3)

On an elbow connector, a user drags a straight segment sideways, and the whole segment moves while staying straight and keeping its right angles.

**Why this priority**: A convenience on top of US1. Bends already allow reshaping.

**Independent Test**: Select an elbow connector with three segments and drag the middle one sideways. The segment moves as a whole, stays horizontal or vertical, and its neighbours stretch to stay connected.

**Acceptance Scenarios**:

1. **Given** a selected elbow connector, **When** the user drags the handle in the middle of a horizontal segment, **Then** the segment moves only up and down. A vertical segment moves only left and right.
2. **Given** a segment drag, **When** it is released, **Then** the connector keeps right angles everywhere and one undo step is recorded.
3. **Given** a moved segment, **When** the user double-clicks its handle, **Then** the segment returns to its automatic position.
4. **Given** a segment drag near the line of a neighbouring segment or the grid, **When** the pointer is within snap reach, **Then** it snaps (⌘ turns snapping off).

---

### User Story 6 - Guides always disappear (Priority: P2)

Alignment guides appear while dragging a card, resizing, or dragging a connector handle, and always disappear when the gesture ends, however it ends.

**Why this priority**: A visible glitch that makes the canvas look broken, with a small, contained fix.

**Independent Test**: Repeat card drags, connector handle drags and resizes, ending them by releasing, by pressing Esc, by releasing outside the window and by switching tabs mid-drag. No guide remains after any of them.

**Acceptance Scenarios**:

1. **Given** guides on screen during any drag, **When** the drag ends by release, Esc, the pointer being released outside the window, the window losing focus, or the gesture being interrupted, **Then** all guides are removed.
2. **Given** a drag that ends with no change, **When** it ends, **Then** no guide remains either.

---

### Edge Cases

- **Tiny cards**: when a card is so small that the snap stops overlap, the end follows the pointer without snapping instead of flickering between stops.
- **Shapes**: on a non-rectangular shape (031), the end follows the shape's outline as it does today, not its bounding box.
- **Overlapping targets**: when the pointer is over a card that sits on top of a group, the card is the target. A group is the target only where no card is on top.
- **Both ends on the same card** (self-loop): each end can still be dragged independently, and the two ends never land on exactly the same point.
- **Zoom**: drag threshold, snap reach and handle hit areas stay the same size on screen at any zoom.
- **Fanned bundles** (034): a connector drawn offset inside a fan can still be selected and its handles grabbed at their drawn positions.
- **View-only states**: in flow mode, while recording a flow, and with the hand tool, handles stay hidden or inert, as today.
- **Hidden groups / drill-in**: a connector whose group end is outside the current drill scope draws to the scope's outside proxy, like card ends do today.
- **Duplicate check**: a second connector between the same card and group (either direction) is refused, as for cards.
- **Older files**: files written before this feature open unchanged.

## Requirements _(mandatory)_

### Functional Requirements

**Handles (US1)**

- **FR-001**: The selected connector's handles (both ends, bends, midpoints, segment handles) MUST be drawn above all cards, groups and stickies, and MUST receive the pointer before anything under them.
- **FR-002**: A handle drag MUST keep following the pointer until release or cancel, wherever the pointer goes, including over cards, outside the canvas and while handles are being added or removed during the drag.
- **FR-003**: A handle press MUST NOT change the document until the pointer has moved at least 4 screen px (the drag threshold). Below that it counts as a click.
- **FR-004**: Midpoint and segment handles MUST be hidden on segments shorter than 24 screen px.
- **FR-005**: Esc during any handle drag MUST restore the connector's shape before the drag without writing to the document.
- **FR-006**: Every completed handle drag MUST write to the document once, as one undo step.

**Ends (US2)**

- **FR-007**: Pressing an end MUST NOT move it. The offset between the pointer and the end at press time MUST be kept for the whole drag.
- **FR-008**: While dragging, an end over or near a target MUST attach to the point on the target's outline nearest the pointer, inside or outside the target. It MUST move continuously, including around corners.
- **FR-009**: An end MUST attach to a target when the pointer is inside it or within 16 screen px of its outline. The topmost target under the pointer wins.
- **FR-010**: An end MUST snap to 0, 25, 50, 75 and 100 % of a side within 8 screen px. Holding ⌘ / Ctrl MUST turn snapping off. The readout MUST show side, position and "snapped".
- **FR-011**: An end MUST return to automatic placement only when dropped in the centre zone of its own card (the middle 40 % of its width and height), or through the existing reset command. While the pointer is in that zone, the preview and readout MUST show "automatic"; anywhere else on the card the end follows the outline (FR-008).
- **FR-012**: An end released away from every target MUST leave the connector unchanged and announce the reason.
- **FR-013**: The preview line during an end drag MUST be drawn in the connector's own type (curved, elbow or straight) and end exactly where the end will land.
- **FR-014**: Keyboard stepping of ends (022) MUST keep working unchanged.

**Weight (US3)**

- **FR-015**: A selected connector MUST be drawn at its own weight. Selection MUST be shown by the selection colour plus a soft halo that does not hide the line's width.
- **FR-016**: The weight control MUST be a slider that can be pressed anywhere on its track and dragged. It snaps to the weight stops and previews live on the canvas.
- **FR-017**: A weight drag MUST write one undo step on release, and Esc MUST cancel it. Keyboard behaviour (← → Home End) stays.
- **FR-018**: The weight stops MUST stay 1 / 1.5 / 2 / 3 / 4 px (default 2), so stored values and existing files are unchanged.
- **FR-019**: End marks (knob, arrow) MUST keep scaling with the weight, as today.

**Groups (US4)**

- **FR-020**: A group MUST be allowed as the source and/or target of a connector, alongside cards. A connector's source or target may name a group in the file format; validation MUST accept a group id there and still flag ids that match neither a card nor a group.
- **FR-020a**: Group connectors MUST be usable in flows like any other connector (recordable as steps, highlighted and played).
- **FR-020b**: Exports to text diagram formats MUST draw a group connector to the group's box where the format supports it, and MUST NOT drop it silently where it does not (it is reported in the export's notes).
- **FR-021**: A connector between a group and anything it contains (directly or deeper) MUST be refused with a short reason. Duplicate and self-connection rules MUST apply to groups as to cards.
- **FR-022**: Deleting a group MUST delete its connectors in the same undo step.
- **FR-023**: Group connectors MUST round-trip losslessly through save, export and import, and files without group connectors MUST be unchanged.
- **FR-024**: Group connectors MUST support everything other connectors do: label, style, type, bends, anchors, reconnect, inspector.

**Segments (US5)**

- **FR-025**: On a selected elbow connector, each straight segment between two bends or ends MUST show a segment handle. Dragging it MUST move the segment only perpendicular to its direction, keeping right angles.
- **FR-026**: Double-clicking a segment handle MUST return that segment to automatic placement.
- **FR-027**: Segment drags MUST snap to neighbouring segment lines and the grid (⌘ off), like bends.

**Guides (US6)**

- **FR-028**: Guides MUST be removed whenever any gesture that shows them ends: release, cancel, pointer released outside the window, window blur, or the gesture being interrupted by another.
- **FR-029**: No guide MUST remain on screen when no gesture is in progress.

**General**

- **FR-030**: Drag threshold, snap reach, attachment distance and handle hit areas MUST be defined in screen px and stay the same size at any zoom.
- **FR-031**: Every new handle MUST be focusable with an accessible name, and every change MUST be announced (as in 022).
- **FR-032**: Editing a connector MUST NOT slow down card drag or panning on the 500-card / 1,000-connector benchmark deck.

### Key Entities

- **Connector end**: what an end is attached to (a card or a group), on which side, and where along that side (0–1), or automatic.
- **Segment offset**: for an elbow connector, a user-moved segment's position, kept relative to the cards so it follows them.
- **Weight**: one of a fixed set of line widths.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 20 consecutive attempts, a handle drag (end, bend, midpoint) follows the pointer to the release point every time, including handles under cards.
- **SC-002**: Pressing and releasing a connector end without moving it changes nothing in 100 % of attempts.
- **SC-003**: While dragging an end once around a card, the end never moves more than the pointer movement plus the snap reach in a single frame (no jumps).
- **SC-004**: A user can place a connector end at a chosen quarter point of a side on the first try, without retrying.
- **SC-005**: After a weight change, the selected line's drawn width matches the chosen weight in 100 % of cases.
- **SC-006**: Connectors card→group, group→card and group→group can be created, styled, reloaded and exported/imported with no loss.
- **SC-007**: Across 50 mixed gestures ended in every supported way, no alignment guide remains visible afterwards.
- **SC-008**: The benchmark deck's card drag and pan frame times stay within 5 % of the numbers before this feature.

## Assumptions

- This feature changes interaction and drawing only, except FR-020 (group endpoints, a file-format change). Everything else keeps the current file format; weight values are unchanged.
- "Target" means a card or (with US4) a group. Stickies and notes are not connector targets.
- Thresholds (4 px drag, 16 px attach, 8 px snap, 24 px minimum segment) come from common practice in mature whiteboard editors and can be tuned during implementation.
- Existing keyboard paths (022 bend nudging, end stepping, reset) stay as they are.
- The selection halo uses the existing Orange Soft selection token (DESIGN.md).
- No new e2e tests (Principle VI, TODO(e2e)); behaviour is covered by unit and component tests, and the existing smoke suite must keep passing.
- Connector type selection (curved / elbow / straight) is out of scope; it works.
