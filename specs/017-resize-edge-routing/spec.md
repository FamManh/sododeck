# Feature Specification: Resize Cards and Route Connectors

**Feature Branch**: `017-resize-edge-routing`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "017-resize-edge-routing: Let users shape the diagram. A selected component can be resized with handles (keeping its proportions with Shift) and reset to the default size; its group boundary and everything that measures it follow the new size. A selected connection shows a handle on its middle segment that can be dragged to move that part of the line up, down, left or right, and its ends can be pinned to a chosen side of each card; a reset returns it to automatic routing. Sizes and routes are saved in the deck file as optional fields, so older decks open unchanged. Every change is one undo step and works from the keyboard. Why: automatic lines often run through the wrong place and every card is the same size, so users cannot make a busy diagram look tidy."

**Sources**: `docs/backlog.md` §017 (scope, design deltas, schema, acceptance criteria, risks), `docs/design/design-analysis.md` §a states 100 and 112–114, the component inventory (selection frame + resize handle, segment + endpoint handles, hint bar), §g-37 (optional `node.size` and `edge.route`), §g-44 (no free connector end), §g-45 (nudge keys), §g-55 (groups are frames that never auto-scale), `DESIGN.md` "Canvas-first Editor", `specs/016-canvas-editing/spec.md` (frame resize handles, snapping, guides, hint bar), `specs/019-card-quick-edit/spec.md` (shared action list, selection toolbar, context menu, detail drawer), constitution v1.0.0 (principles I, II, III, V, VII, VIII).

**Dependency note**: 016 (canvas editing) is merged on `main` (`60cfc46`). It provides the resize handles and resize rules for group frames (⇧ keep ratio, ⌥ from centre, Esc cancels, minimum box), alignment guides and snapping while dragging (⌘ disables), the hint bar, and groups as **frames with a stored size that never auto-scale** (§g-55). The file format already has a reusable size shape. 019 provides the shared action list, the toolbar on a connection (100) and the detail drawer. 003 provides reconnecting a connection by dragging an end to another card. This feature adds two **optional** fields to the file format (card size, connector route), so it needs an ADR.

## Scope

**In scope**

- **Resize a card**: eight handles on a single selected component; the size is stored in the deck; ⇧ keeps the ratio, ⌥ resizes from the centre, Esc cancels, sizes step in 4 px and snap to neighbouring card edges; a `W × H` readout; one undo step per drag.
- **Reset size**: double-click a handle, or "Reset size" in the menu, returns the card to the default size and removes the stored size.
- **Everything uses the real size**: connections attach to the real edges, and the selection frame, minimap, fit-to-view, search "go to", group frame fitting (⌘G, fit on open), auto-layout / Tidy (011), deck thumbnails and export (012) measure the real size.
- **Move a connector's middle segment**: a selected connection shows a handle on its middle segment; dragging it moves that segment sideways; the shift is stored in the deck.
- **Pin a connector end to a side**: dragging a connection end onto a side of the same card pins that side; dragging it onto another card reconnects (as today, 003).
- **Reset route**: in the connection toolbar and menu (100), and the R key while a connector gesture is active; disabled while the route is automatic.
- Labels, step badges, the flow token, flow highlights, the focus ring and problems markers follow the adjusted path.
- **Keyboard**: grow / shrink a focused card; move a selected connector's middle segment; pick sides and edit sizes in the detail drawer.
- **Detail drawer** (019): size (W, H) for a component; sides (from, to) and offset for a connection, as editable fields with a reset.
- New actions in 019's shared action list (toolbar, menus, shortcuts, shortcut help); hint bar content for the new gestures.

**Out of scope**

- Connector styling, moved to **022-connector-style** (backlog, 2026-09-29): line type (straight / elbow / curved), free waypoints, dash (solid / dashed / dotted), weight, colour, a draggable label position, an animated "running" line, and line jumps (later).
- Automatic obstacle-avoiding routing (011 keeps its layout; routes are not recomputed around cards).
- Free (unattached) connector ends: every connection keeps a source and a target (§g-44); ⌥ does nothing on endpoint drags.
- Resizing **groups** (done in 016) and **stickies** (009 stays as is).
- Per-view card sizes or per-view routes: a card's size and a connection's route are the same in every view.
- A grid, a grid toggle or snapping to a grid (016 also left it out).
- Card and group colours (020).
- Editing in flow mode, during flow recording or in the view-only editor.

## Clarifications

### Session 2026-09-29

- Q: In a view with its own card positions (011), are card size and connector route stored per view or shared by every view? → A: Shared by every view (option A); only card positions differ between views.
- Q: While dragging a connector's middle segment, should it stop 12 px before any card, only before the two connected cards, or move freely? → A: Freely (option C): the user drags it wherever they want, over any card; only guide snapping applies (⌘ disables it). Frame 113's 12 px stop is dropped.
- Q: Should Miro-like connector options (line type, waypoints, dash, weight, colour, label position, line jumps) be part of 017? → A: No. 017 keeps its scope (sides + middle-segment offset); those options, plus an animated "running" line to show flow direction, go to a new backlog feature **022-connector-style** (after 017 and 020).
- Q: How is the extra space of an enlarged card used? → A: Option A: the font size stays the same; the title and the subtitle wrap onto as many lines as the size allows and are clamped with an ellipsis only when they do not fit. No description text and no font scaling.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Resize a card (Priority: P1)

An architect wants the "API Gateway" card to stand out. They select it; eight small handles appear around it. They drag the bottom-right handle: the active handle fills orange, a `244 × 80` readout follows the corner, connections stay attached to its edges as it grows, and its right edge snaps to the right edge of the card below. They release. One ⌘Z puts it back to the default size. Later they double-click a handle to reset another card.

**Why this priority**: making the key cards bigger is the most direct way to show what matters; it is the first half of the feature's goal.

**Independent Test**: select one card, drag each kind of handle (corner, side) with and without ⇧ / ⌥, check the size in the JSON panel, the readout, the attached connections, one-step undo, Esc cancel, the minimum and maximum, and reset by double-click.

**Acceptance Scenarios**:

1. **Given** a selected component at the default size at the default zoom (164 × 50), **When** the user drags its bottom-right handle by (80, 30), **Then** it is 244 × 80, the JSON panel shows `"size": { "width": 244, "height": 80 }`, and one ⌘Z restores the default size and removes `size`.
2. **Given** a single selected component, **When** the selection shows, **Then** it has eight handles (four corners, four sides); a multi-selection shows no card handles.
3. **Given** a resize in progress, **When** the user drags, **Then** the active handle is filled, a `W × H` readout shows next to it, the width and height change in 4 px steps, and connections re-attach to the card's edges live.
4. **Given** a resize, **When** the user holds ⇧, **Then** the ratio from the start of the drag is kept; **When** the user holds ⌥, **Then** the card grows or shrinks around its centre.
5. **Given** a resize, **When** the dragged edge comes within 6 screen px of the same kind of edge of a visible card, **Then** a guide shows and the edge snaps to it (016 guides); **When** ⌘ is held, **Then** there is no snapping (the 4 px step still applies).
6. **Given** a size below the minimum, **When** the user keeps dragging, **Then** the card stops at 120 × 44; above the maximum, it stops at 800 × 600.
7. **Given** a resize in progress, **When** the user presses Esc, **Then** the card returns to its size and position before the drag and nothing is added to undo history.
8. **Given** a resized component, **When** the user double-clicks any of its handles or chooses "Reset size" from its menu, **Then** it returns to the default size for the zoom level (164 × 50, or 164 × 104 at the component level), `size` is removed from the JSON, and that is one undo step; at the default size "Reset size" is disabled.
9. **Given** a resized component, **When** its title or subtitle is longer than one line, **Then** the text keeps its font size, wraps onto as many lines as the card's size allows, and is clamped with an ellipsis only when it does not fit; the full text stays available in the tooltip and the drawer.
10. **Given** a member of a group, **When** it is resized beyond its group's frame, **Then** the frame does not change (§g-55) and the card overhangs it; the group's own resize minimum (016) then uses the card's real size.

---

### User Story 2 - Move a connector's middle segment (Priority: P1)

Two stacked services are connected, and the automatic connector runs right through a third card. The architect selects the connector; it turns orange and shows a handle on its middle segment. They drag the handle 60 px right: the segment moves with the pointer, a dashed ghost shows the automatic route, and a readout shows `+60`; nothing stops it, so it can pass over any card. They release. The connector keeps that shape, its label and the flow badges sit on the new path, and "Reset route" is now enabled in its toolbar.

**Why this priority**: lines running through the wrong place are the main complaint the feature fixes; this is the second half of the goal.

**Independent Test**: select a connector between two stacked cards, drag the middle handle, check the path, `route.offset` in the JSON panel, label and badge positions, a flow highlight on it, one-step undo, Esc cancel, and R reset during the drag.

**Acceptance Scenarios**:

1. **Given** a selected connector between two stacked components, **When** the user drags its middle handle 60 px right, **Then** the connector's middle segment moves 60 px right, `route.offset` is 60, and a flow highlight on that connector follows the new path.
2. **Given** a selected connector, **When** it shows, **Then** a handle sits at the midpoint of its middle segment and the pointer cursor shows the direction the segment can move (sideways to the segment only).
3. **Given** a segment drag in progress, **When** the user drags, **Then** a dashed ghost shows the automatic route, a readout shows the signed offset (e.g. `−18`), and the connector's label, step badges and flow token move with the path.
4. **Given** a segment drag, **When** the segment passes over any card (including the two it connects), **Then** it keeps following the pointer; there is no stop and no minimum distance to cards.
5. **Given** a segment drag, **When** the segment comes within 6 screen px of a visible card's centre line or edge on its axis, **Then** it snaps to it with a guide (016 guides); **When** ⌘ is held, **Then** it does not snap.
6. **Given** a segment drag in progress, **When** the user presses Esc, **Then** the connector returns to its previous route and nothing is added to undo history; **When** the user presses R, **Then** the drag ends and the route is reset to automatic as one undo step.
7. **Given** a routed connector, **When** either connected card moves, **Then** the middle segment keeps its stored offset from where the automatic route would put it, so the adjusted shape moves with the cards.
8. **Given** a connector with no movable middle segment (a straight line, a single bend because its sides are at right angles, or both ends on the same side), **When** it is selected, **Then** no middle handle shows and a stored offset is not applied; pinning opposite sides (left/right or top/bottom) gives it a middle segment.

---

### User Story 3 - Pin a connector end to a side of a card (Priority: P1)

The architect wants the "Orders → Billing" connector to leave Orders from the top instead of the right. They drag the source end of the selected connector over Orders: four side targets appear on the card, the nearest one "hot"; a dashed orange live path shows the new route and the old route stays as a ghost. They drop on the top target and the connector now leaves from the top. Later they choose "Reset route" from the connector toolbar and it goes back to automatic.

**Why this priority**: sides decide most of a connector's shape; without them the offset alone cannot fix many layouts.

**Independent Test**: drag each end of a selected connector onto each side target of its own card, check `route.fromSide` / `route.toSide`, drag an end to another card (reconnect), press Esc mid-drag, and use Reset route.

**Acceptance Scenarios**:

1. **Given** a connector, **When** the user drags its source end onto the top side of its source card, **Then** it leaves from the top and `route.fromSide` is `"top"`; **When** "Reset route" is chosen, **Then** `route` is removed and the path is automatic again.
2. **Given** an end drag in progress over a card, **When** hovering, **Then** four side targets show on that card, the one nearest the pointer is highlighted (with a non-colour cue), a dashed live path shows the new route, and the old route shows as a ghost.
3. **Given** an end dropped on the same card, **When** released, **Then** only the side changes (the connection still joins the same two cards) as one undo step.
4. **Given** an end dropped on another card, **When** released, **Then** the connection is reconnected as today (003 rules, including disallowed connections), and the side it was dropped on is pinned on the new card.
5. **Given** an end drag, **When** the user presses Esc or releases over empty canvas, **Then** the connection keeps its old card and side; there is no free end (§g-44), and ⌥ changes nothing.
6. **Given** a connector whose route is automatic (no sides, no offset), **When** its toolbar or menu shows, **Then** "Reset route" is disabled with the tooltip "Route is automatic"; after any route change it is enabled.
7. **Given** a pinned side, **When** the connected cards move, **Then** the connector keeps leaving / entering from the pinned side, even when another side would look more natural.

---

### User Story 4 - Older decks stay unchanged (Priority: P1)

A founder opens a deck saved last month. It looks exactly as before: every card has the default size and every connector is routed automatically. They edit a title and export the deck; the file contains no size or route fields for objects they did not resize or route.

**Why this priority**: constitution II; the file format change must be additive and lossless, or users lose trust in their files.

**Independent Test**: open, edit and export a deck without sizes or routes, and compare; open a deck with sizes and routes in every combination and check the round trip.

**Acceptance Scenarios**:

1. **Given** a deck file without `size` or `route`, **When** opened, edited and exported, **Then** those fields are still absent (lossless round-trip).
2. **Given** a deck file with sizes and routes (sides only, offset only, both), **When** opened and exported, **Then** the values are unchanged.
3. **Given** a route whose sides and offset are all reset, **When** saved, **Then** `route` is removed rather than stored empty; a card reset to its default size has no `size`.
4. **Given** a deck file whose `size` is outside 120 × 44 – 800 × 600, **When** imported, **Then** the deck opens, the card is drawn within the limits, and the Problems panel (015) lists "Card size out of range" naming the card.

---

### User Story 5 - Do it from the keyboard and the drawer (Priority: P2)

A keyboard user focuses the "Search" card and presses ⌘⇧→ four times: it grows 16 px wider. They open the drawer and type 240 into W. Then they select a connector, press ⌥⇧↓ twice to move its middle segment 20 px down, and in the drawer pick "Top" for the source side.

**Why this priority**: constitution VII; every positioning action must be reachable without a pointer. The pointer gestures come first because that is how most users shape a diagram.

**Independent Test**: with only the keyboard, resize a card, reset its size, move a connector's middle segment, set both sides, reset the route; check undo steps and announcements.

**Acceptance Scenarios**:

1. **Given** a focused component, **When** the user presses ⌘⇧→ / ⌘⇧← / ⌘⇧↓ / ⌘⇧↑ (Ctrl+Shift on Windows and Linux), **Then** it grows / shrinks by 4 px in width or height, keeping its top-left corner, within the minimum and maximum; bigger changes are typed in the drawer.
2. **Given** a selected connector with a middle segment, **When** the user presses ⌥+arrow across the segment, **Then** the segment moves 1 px (⌥⇧: 10 px); arrows along the segment do nothing.
3. **Given** a burst of size or segment keys less than 1 s apart, **When** the user presses ⌘Z, **Then** the whole burst is undone at once (as 016 nudges).
4. **Given** a selected component, **When** the user opens its drawer, **Then** it shows W and H number fields and "Reset size"; typed values are rounded to whole px, limited to the minimum and maximum, and each commit is one undo step.
5. **Given** a selected connection, **When** the user opens its drawer, **Then** it shows "From side" and "To side" (Auto, Top, Right, Bottom, Left), an Offset number field and "Reset route"; each change is one undo step.
6. **Given** any action in this feature done from the keyboard, **When** it completes, **Then** the result is announced (e.g. "Resized API Gateway to 244 × 80", "Route reset").

---

### User Story 6 - See the gesture's modifier keys (Priority: P3)

While resizing, the hint bar at the bottom centre lists "⇧ Keep ratio · ⌥ From centre · ⌘ No snap · Esc Cancel". While dragging a segment it lists "⌘ No snap · R Reset route · Esc Cancel"; while dragging an end, "Esc Keep old end".

**Why this priority**: helps discovery; the gestures work without it.

**Independent Test**: start each gesture and check the hint bar content; release and check it disappears.

**Acceptance Scenarios**:

1. **Given** a card resize, segment drag or end drag, **When** in progress, **Then** the hint bar lists the keys that apply to that gesture and hides when it ends; screen readers get the same hint once when the gesture starts.

### Edge Cases

- **Semantic zoom levels** (010): a stored size applies at every level; the card's content still switches between the compact and the full layout with the level, inside that size. A card without a stored size keeps today's level size (164 × 50, or 164 × 104 at the component level). Sides and offsets apply unchanged at every level (the offset is in canvas px).
- **Collapsed groups and merged connectors** (010): connectors merged into a collapsed group card, or drawn to its ports, are routed automatically; their stored routes are kept and apply again when the group expands.
- **Sticky leaders** (009) are not connectors: they have no route and no handles.
- **Self-connection** (a connector from a card to itself), if the file has one: sides can be pinned, the middle handle shows only when the path has a middle segment.
- **Pinned sides that face away** (e.g. source leaves from the left while the target is to the right): the connector goes around the source card with the same orthogonal style; while the sides are opposite, the middle segment is still movable.
- **Cards moved so the offset makes no sense** (e.g. the segment now crosses one of the connected cards): the stored offset is kept and drawn as stored until the user changes or resets the route.
- **Resize with connections pinned to a side**: the connection stays on that side and re-attaches to its middle.
- **Resize near the maximum with ⇧**: the ratio is kept until one side hits a limit, then both stop.
- **Resize a card inside a collapsed group**: not possible (the card is hidden); its size is kept.
- **Multi-selection**: no resize handles and no segment handle; drawer size fields show only for a single component.
- **Auto-layout / Tidy (011)**: lays out cards with their real sizes; it does not change sizes, and it keeps pinned sides; offsets are kept as stored.
- **Views with their own positions (011)**: size and route are shared by every view; only positions differ per view.
- **Another tab edits the same card or connector** during a gesture: the gesture ends with the value it computed; a card or connector deleted meanwhile is skipped.
- **Copy / paste / duplicate (016)**: the copy keeps the size and route; a pasted connector whose end card is not pasted is not copied (016 rule).
- **Flow mode, flow recording, view-only editor**: no handles; sizes and routes are drawn but cannot be changed.
- **Export (012)**: PNG and SVG draw the real sizes and adjusted routes exactly as the canvas does.

## Requirements _(mandatory)_

### Functional Requirements

**Card size**

- **FR-001**: A component MUST have an optional stored size (width, height in canvas px). Absent means today's size for the zoom level (164 × 50, or 164 × 104 at the component level). A stored size applies at every zoom level. Allowed sizes are 120 × 44 to 800 × 600; sizes set by dragging are multiples of 4 px.
- **FR-002**: A single selected component MUST show eight resize handles (corners and sides). Dragging one MUST resize the card from that side or corner in 4 px steps, show the active handle filled and a `W × H` readout, and re-attach its connections live.
- **FR-003**: During a resize, ⇧ MUST keep the ratio from the start of the drag, ⌥ MUST resize around the centre, ⌘ MUST disable snapping to neighbouring card edges, and Esc MUST cancel and restore the previous size and position.
- **FR-004**: Resizing MUST snap the moving edges to the same kind of edge of visible, non-selected cards within 6 screen px, with a guide (016 guides).
- **FR-005**: Resizing MUST stop at the minimum and maximum sizes.
- **FR-006**: A resize MUST be one undo step, and resizing from the top or left MUST move the card's position in the same step.
- **FR-007**: Double-clicking a handle or choosing "Reset size" MUST return the card to the default size, keeping its top-left corner, and remove the stored size, as one undo step. "Reset size" MUST be disabled when there is no stored size.
- **FR-008**: A card's title and subtitle MUST keep their font size, wrap onto as many lines as the card's size allows, and clamp with an ellipsis only when they do not fit; the full text stays in the tooltip and the drawer. The card MUST NOT show extra fields (e.g. the description) or scale its text because it is bigger.
- **FR-009**: Everything that measures a card MUST use its real size: connection attachment points, selection frame, focus ring, minimap, fit-to-view, search and problems "go to", marquee hit tests, snapping guides, group frame fitting (⌘G and fit on open, 016), group resize minimum (016), auto-layout and Tidy (011), deck thumbnails and export (012).
- **FR-010**: Resizing a card MUST NOT change any group frame (§g-55) or group membership.

**Connector route**

- **FR-011**: A connection MUST have an optional stored route with an optional source side, an optional target side (top, right, bottom, left) and an optional offset in canvas px. A missing side means the side is picked automatically, as today; a missing offset means 0. A route with nothing set MUST NOT be stored.
- **FR-012**: A selected connection whose sides are opposite (left/right or top/bottom) has a movable middle segment and MUST show a handle on it; other connections (single bend, same side, straight) show no handle and ignore a stored offset when drawn, keeping it in the file. Dragging it MUST move the segment perpendicular to itself, store the shift as the offset, show a dashed ghost of the automatic route and a signed offset readout.
- **FR-013**: During a segment drag the segment MUST follow the pointer freely (it MAY pass over any card, with no stop or minimum distance), MUST snap within 6 screen px to the centre lines and edges of visible cards on its axis (⌘ disables snapping), Esc MUST cancel, and R MUST end the drag and reset the route.
- **FR-014**: The offset MUST be relative to where the automatic route would put the middle segment, so the adjusted shape follows the cards when they move.
- **FR-015**: Dragging a connection end over a card MUST show four side targets on that card with the nearest one highlighted (not by colour alone), a dashed live path and a ghost of the old route. Dropping on the same card MUST pin that side only; dropping on another card MUST reconnect with the existing rules (003) and pin the side dropped on; Esc or dropping elsewhere MUST keep the old end (§g-44).
- **FR-016**: "Reset route" MUST remove the route (sides and offset) and return to automatic routing, as one undo step. It MUST be offered in the connection toolbar (100), the connection menu and the drawer, and be disabled with a tooltip while the route is automatic.
- **FR-017**: Labels, step badges, the flow token, flow highlights (006, 007), the focus ring and problems markers (015) MUST follow the adjusted path.
- **FR-018**: Every route change (segment drag, side pin, reset, drawer edit) MUST be one undo step.

**Keyboard and drawer**

- **FR-019**: With a component focused or selected alone, ⌘⇧+arrow (Ctrl+Shift+arrow on Windows and Linux) MUST change its width (→ / ←) or height (↓ / ↑) by 4 px, keeping its top-left corner and the limits.
- **FR-020**: With a connection selected, ⌥+arrow perpendicular to its middle segment MUST move the segment by 1 px (⌥⇧: 10 px), matching the 016 nudge keys (§g-45).
- **FR-021**: Size and segment key presses less than 1 s apart MUST merge into one undo step.
- **FR-022**: The detail drawer (019) MUST show W and H fields and "Reset size" for a single component, and "From side", "To side" (Auto, Top, Right, Bottom, Left), Offset and "Reset route" for a connection, with the same limits and undo rules as the gestures.
- **FR-023**: Reset size and Reset route MUST be added to 019's shared action list so the toolbar, menus, drawer and shortcuts offer them with the same availability rules; the keyboard-shortcut help MUST list every new shortcut; shortcuts MUST be ignored while a text field has focus.
- **FR-024**: Every action MUST have an accessible name and announce its result through the existing live region; handles MUST have accessible names (e.g. "Resize bottom-right", "Move middle segment").

**Hints, modes and look**

- **FR-025**: The hint bar (016) MUST list the modifier keys of the gesture in progress (resize, segment drag, end drag) and hide when it ends; the hint MUST be announced once when the gesture starts.
- **FR-026**: Resize, segment and end handles MUST NOT be available in flow mode, during flow recording or in the view-only editor; stored sizes and routes MUST still be drawn there.
- **FR-027**: All new surfaces (handles, readouts, ghosts, side targets, live path) MUST use DESIGN.md tokens in light and dark themes, never convey state by colour alone, and appear without animation under reduced motion.

**Document, file format and performance**

- **FR-028**: Every change MUST go through the shared document; gesture state (active handle, readout, ghost, side targets, live path, key burst) MUST be UI-only and never saved in the deck or undo history.
- **FR-029**: The file-format change MUST be additive and optional: component size and connection route. Older files MUST stay valid and unchanged, the schema version MUST NOT change, and the round trip MUST stay lossless with and without the new fields. No id changes.
- **FR-030**: A card size outside the allowed range in an opened or imported file MUST NOT block opening: the card is drawn within the limits and the Problems panel (015) MUST list it by name. The stored value stays until the user resizes or resets the card.
- **FR-031**: Panning and zooming the benchmark deck (500 components / 1,000 connections) with every component resized and 200 routed connections MUST stay at ≥ 60 fps, with no regression against the benchmark measured before this change.

### Key Entities

- **Card size**: an optional width and height on a component, in canvas px (120 × 44 – 800 × 600); absent = today's level size (164 × 50, or 164 × 104 at the component level). Document data, the same in every view.
- **Connector route**: optional on a connection: source side, target side (top / right / bottom / left) and a middle-segment offset in px relative to the automatic route. Document data, the same in every view.
- **Resize gesture**: active handle, start box, modifiers, snap lines, readout. UI only.
- **Route gesture**: segment drag (start offset, ghost, readout) or end drag (hovered card, nearest side, live path). UI only.
- **Action** (from 019): Reset size, Reset route and the size / segment keys, shared by shortcuts, toolbar, menus and drawer.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user makes a card bigger in one drag and one undo reverses it, in 100 % of tested cases; resized cards are within the 4 px step of the pointer (0 px off the step grid).
- **SC-002**: A user moves a connector off a card it runs through in one drag of its middle segment, or one end drop, in 100 % of the tested layouts from the design (113, 114).
- **SC-003**: 100 % of decks saved before this feature open looking the same and export without any new field (byte-for-byte equal content for untouched objects after the round trip).
- **SC-004**: Labels, step badges and flow highlights sit on the adjusted path (0 visible gap) for every routed connector in the tested decks.
- **SC-005**: A keyboard-only tester completes every acceptance scenario of stories 4 and 5, and resizes, routes and resets without a pointer.
- **SC-006**: Pan / zoom stays at ≥ 60 fps on the benchmark deck with every component resized and 200 routed connections, with no regression against the before-change benchmark.
- **SC-007**: Exported PNG and SVG match the canvas for resized cards and routed connectors (positions within 1 px).
- **SC-008**: The implemented states 100 (Reset route), 112, 113 and 114 match the design screenshots in light and dark, with differences either fixed or listed.

## Assumptions

- Frames 112–114 and 100 set the look of the handles, readouts, ghosts and side targets. Where they differ from the founder decisions, the decisions win: no free connector end (§g-44); resizing a member never grows its group frame (§g-55), so the backlog's "its group boundary grows to fit" is replaced by FR-010. The middle segment moves freely over cards (clarification 2026-09-29), so frame 113's 12 px stop is dropped.
- **Keys** follow 016's conventions rather than the first backlog draft: segment moves use ⌥+arrow 1 px / ⌥⇧+arrow 10 px like nudges (§g-45), and size keys use ⌘⇧+arrow in 4 px steps to match the 4 px size step of frame 112. The backlog's ⌥⌘+arrow cannot be used: Chrome on macOS switches tabs with it before the page sees the keys (plan research R10). Larger size changes are typed in the drawer.
- **Snapping during segment drags** uses 016's guides with ⌘ to disable, instead of frame 113's "⇧ snaps to grid": there is no grid (016 kept it out of scope).
- The offset is stored in canvas px relative to the automatic middle segment, not as an absolute coordinate, so routes survive card moves (backlog risk "offset semantics must stay stable"). The ADR records why offsets and sides instead of free waypoints.
- Size and route are shared by every view (clarification 2026-09-29); a view with its own positions (011) does not override them. Per-view sizes can be added later as another optional field.
- Today's card size depends on the zoom level (164 × 50, or 164 × 104 at the component level, 010); a stored size replaces it at every level (plan research R2).
- "Reset route" and "Reset size" do not exist yet: this feature adds them as a new action module in 019's shared action list (ADR 0015), which puts Reset route in the connection toolbar (frame 100) and both in the menus.
- Reconnecting to another card keeps its 003 behaviour and rules; this feature only adds side targets and pinning.
- The canvas already renders connectors as orthogonal paths with rounded corners; this feature keeps that style and adds the offset and pinned sides to it. No new runtime dependency.
- A card without a stored size keeps today's level-dependent size, so untouched decks look identical.
- New e2e tests are not added (constitution VI); behaviour is covered by unit and component tests, and the smoke suite keeps passing.
- Estimate stays at about 4 d; the risk is the number of places that assume a fixed card size.
