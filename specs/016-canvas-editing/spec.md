# Feature Specification: Canvas Editing

**Feature Branch**: `016-canvas-editing`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "016-canvas-editing: Make everyday editing on the canvas fast. Users can copy, cut, paste and duplicate the selected components together with the connections between them, also between decks in other tabs. They can turn the selection into a new group with Cmd/Ctrl+G, ungroup with Shift+Cmd/Ctrl+G, select a group by its label and drag it to move everything inside it, and drop components into or out of a group. Selected components can be aligned and evenly distributed, nudged with Alt+arrow keys, and snap to alignment guides while dragging. A right-click menu offers the actions that apply. Every action is one undo step and works from the keyboard. Dragging on empty canvas still pans; Shift+drag still draws the selection box. Why: building a 30-component diagram today means placing and fixing every box by hand."

**Sources**: `docs/backlog.md` §016 (scope, design deltas, acceptance criteria, risks), `docs/design/design-analysis.md` §a states 92, 99, 102–104 and 108–111, the component inventory (snap guide, marquee, drop target, hint bar), §g-36 (plain drag pans), §g-45 (nudge keys), §g-53 (109's plain-arrow nudge is a mock value), `DESIGN.md` "Canvas-first Editor", `specs/019-card-quick-edit/spec.md` (shared action list, selection toolbar, context menu), constitution v1.0.0 (principles I, III, V, VI, VII, VIII).

**Dependency note**: 019 (card quick edit) is merged on `main` (`55c087e`): the shared action list, selection toolbar and context menus exist, and Ungroup (⇧⌘G), Copy JSON (⇧⌘C), Select members and group selection by its label already work. 003 provides multi-select (Shift / ⌘ click, Shift+drag marquee), dragging with one undo step per drag, and arrow-key focus movement. 010 provides collapsed groups and drill-in. This feature adds **new editing actions and drag behaviours** on top of those surfaces, and turns groups into **frames with a stored position and size** (clarification 2026-09-29). That is an additive file-format change: optional group geometry, and optional per-view group geometry. Today the schema says a group's "bounds are derived from its nodes; no geometry is stored". This feature reverses that, so it needs an ADR.

## Scope

**In scope**

- **Clipboard**: copy, cut, paste and duplicate the selected components, the connections between them and the groups fully inside the selection; paste works in the same deck and in another deck (another tab), with new ids.
- **Alt+drag duplicate** of the dragged selection.
- **Groups as frames**: a group has its own position and size, stored in the deck, and is drawn from them. It no longer grows or shrinks when its members move. Decks saved before this feature get a frame fitted around each group's members when they are opened.
- **Resize a group** with handles on its frame. Resizing never moves cards and never changes membership.
- **Per-view frames**: a view that has its own component positions (011) also keeps its own position and size for each group.
- **Group from selection** (⌘G): the new frame fits the selection and its label is in rename mode. **Ungroup** stays as built in 019.
- **Move a group** by dragging its label or frame edge: the frame, its members and nested groups move together. Esc cancels, ⌥ duplicates, ⇧ locks the axis. Dropping it inside another group's frame nests it.
- **Drop into / out of a group** while dragging components or groups. Releasing inside a frame joins that group; releasing outside the frame the card belonged to takes it out of that group. ⌥ drops without changing membership.
- **Align and distribute** (six alignments, two distributions) for ≥ 2 selected components, with ⌥A / ⌥D / ⌥W / ⌥S shortcuts.
- **Nudge** with ⌥+arrows (1 px) and ⌥⇧+arrows (10 px); arrows nudge the dragged selection while a drag is in progress (§g-45).
- **Alignment guides and snapping** while dragging, with distance and equal-gap labels; ⌘ held disables snapping.
- **Marquee refinements** (108): live count chip at the cursor, ⌥ selects touched cards, Esc cancels.
- **Hint bar** listing the modifier keys during every gesture (shared with 017).
- The new actions appear in 019's selection toolbar and context menus and in the keyboard-shortcut help.

**Out of scope**

- Selecting with a plain drag on empty canvas (§g-36: plain drag keeps panning).
- Resizing **cards** and routing connectors (**017**, which reuses this feature's resize handles and size field); card and group colours (**020**); new auto-layout behaviour (011 keeps working and now also writes group frames, FR-045).
- Membership decided by geometry alone: a component still belongs to a group only through its stored `group`. Drops and pastes set that field; moving or resizing a frame never does.
- A grid, a grid toggle or snapping to a grid.
- Renaming or re-parenting groups other than by ⌘G, drag-and-drop and the existing rename (019); group colours (020).
- Pasting Mermaid, images, plain text or arbitrary JSON (M5+).
- Copying flows, steps, rules, stickies, views or features: only components, connections and groups are copied.
- Editing in flow mode, during flow recording or in the view-only editor.

## Clarifications

### Session 2026-09-29

- Q: Can a component leave a group by being dragged out, given that a group's box used to grow with its members? → A: Yes (option A). Groups become frames with their own stored position and size. Users drag and resize them; frames never auto-scale. A component released outside its group's frame leaves that group, and ⌥ keeps membership unchanged.
- Q: How does a group frame behave in a view that has its own component positions (011)? → A: Per-view frame. Such a view also stores each group's position and size for that view. Moving or resizing a group in one view does not change it in other views.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Copy, paste and duplicate parts of a diagram (Priority: P1)

An architect has built a "checkout" cluster of three services with two connections between them. They select the three cards, press ⌘C, move the pointer to an empty area and press ⌘V: three new cards and two new connections appear under the pointer, already selected, ready to rename. One ⌘Z removes all five. Later they press ⌘D on a single card to get a copy right next to it, and in another tab they paste the same cluster into a different deck.

**Why this priority**: repeating a pattern (per region, per tenant, per environment) is the most common reason a 30-component diagram takes long to build.

**Independent Test**: on a loaded deck select three connected components (plus one connection to an outside component), copy, paste; check ids, connections, placement, selection and one-step undo; paste the same clipboard in a second deck in another tab.

**Acceptance Scenarios**:

1. **Given** three selected components with two connections between them and one connection to an outside component, **When** the user presses ⌘C then ⌘V, **Then** three new components and two new connections appear at the pointer with new ids, the outside connection is not copied, the pasted objects become the selection, and one ⌘Z removes them all.
2. **Given** components copied in deck A, **When** the user pastes in deck B (another tab), **Then** they appear in deck B with new ids and nothing changes in deck A.
3. **Given** a selection, **When** the user presses ⌘D, **Then** a copy appears 24 px right and 24 px below the originals, becomes the selection, and one ⌘Z removes it.
4. **Given** a selection, **When** the user presses ⌘X, **Then** the objects are copied and then removed with the existing delete rules (confirmation where delete asks today, Undo toast), as one undo step.
5. **Given** the pointer is outside the canvas (or a keyboard paste with no pointer position), **When** the user pastes, **Then** the result lands 24 px right and below the copied position if that area is on screen, otherwise at the centre of the view.
6. **Given** the system clipboard holds plain text or JSON that is not a Sododeck fragment, **When** the user presses ⌘V on the canvas, **Then** nothing is pasted and Paste in the canvas menu is disabled with the tooltip "Nothing to paste: copy components first".
7. **Given** the same fragment is pasted three times, **When** each paste lands at the same point, **Then** each is offset by a further 24 px so the copies do not stack exactly.
8. **Given** a group whose members are all selected, **When** copied and pasted, **Then** a new group with the same title holds the pasted members; a group with only some members selected is not copied (its selected members are pasted without it).
9. **Given** the user holds ⌥ and drags a selection, **When** they release, **Then** the originals stay in place and a copy lands where they dropped it, as one undo step.

---

### User Story 2 - Group the selection and move a group as one piece (Priority: P1)

The architect selects four ungrouped cards and presses ⌘G. A dashed group frame appears around them with its label "New group" in rename mode; they type "Payments" and press Enter. They drag the frame's bottom-right handle to make room for two more cards, and the cards inside do not move. Later they drag the "Payments" label to the right: the frame, every card and every nested group inside move with it, a dashed ghost shows where it started and a small readout shows the offset. One ⌘Z puts everything back.

**Why this priority**: groups are how large diagrams stay readable. Today a group can only be made by editing each card's group field, and its box jumps around whenever a member moves.

**Independent Test**: select four cards, press ⌘G, rename, and check the JSON panel. Resize the frame and check that no card moved. Drag the group label by (100, 40), check that the frame and every member moved, and that one undo restores them. Drop the group inside another group's frame and check the nesting and its Undo toast.

**Acceptance Scenarios**:

1. **Given** four selected ungrouped components, **When** the user presses ⌘G, **Then** a group "New group" containing exactly them exists, its frame fits them with the standard group padding, its label is in rename mode, and the JSON panel shows the new group with its position and size and each component's `group`.
2. **Given** a selected group, **When** the user drags one of its eight resize handles, **Then** the frame changes size from that side or corner, no card moves, membership does not change, and the resize is one undo step.
3. **Given** a group resize, **When** the frame would become smaller than the box around its members plus the group padding, **Then** it stops at that size; the frame is never smaller than 160 × 96 px.
4. **Given** a member card dragged inside its group near the frame edge, **When** released with the pointer still inside the frame, **Then** the card stays a member and the frame keeps its size, even if the card now sticks out over the edge.
5. **Given** a selected group, **When** the user opens its details, **Then** the drawer shows its position (X, Y) and size (W, H) as number fields that move or resize it from the keyboard, with the same limits as the handles.
6. **Given** selected components that all sit in the same group, **When** the user presses ⌘G, **Then** the new group is nested in that group.
7. **Given** selected components from different groups, **When** the user presses ⌘G, **Then** the new group is nested in the innermost group that contains all of them (or top level), and the components move into the new group.
8. **Given** a selected group, **When** the user presses ⇧⌘G, **Then** the group is gone and its members belong to its parent group (or to none) (unchanged from 019).
9. **Given** a group with nested groups, **When** the user drags its label by (100, 40), **Then** its frame, every member and every nested group move by (100, 40), and one ⌘Z moves them all back.
10. **Given** a group drag in progress, **When** the user presses Esc, **Then** everything returns to where it started and nothing is added to undo history.
11. **Given** a group drag, **When** the user holds ⌥ on release, **Then** the group and its contents are duplicated at the drop point and the original stays.
12. **Given** a group dragged so the pointer is inside another group's frame, **When** released, **Then** it becomes nested in that group, and a toast "Moved Payments into Checkout" offers Undo; **When** a nested group is released with the pointer outside its parent's frame, **Then** it leaves that parent the same way a component does (User Story 4).
13. **Given** a group label drag, **When** the user holds ⇧, **Then** the movement is locked to the axis with the larger offset.
14. **Given** a deck saved before this feature, **When** it is opened, **Then** each group gets a frame fitted around its members, the canvas looks the same as before, and no undo step is added.
15. **Given** a view with its own component positions (011), **When** the user moves or resizes a group in that view, **Then** only that view's frame changes; the group in the main canvas and in other views is unchanged.
16. **Given** ⌘G with one component or with nothing selected, **When** the user presses it, **Then** nothing happens, and in the menu Group is disabled with the tooltip "Select two or more components".

---

### User Story 3 - Line things up (Priority: P1)

The architect drags "Orders" next to "Payments". When its centre gets within 6 screen pixels of Payments' centre line, an orange guide appears across both cards and Orders snaps to it; a small label shows the distance to its neighbour, and when the gap equals the gap between two other cards an equal-gap label shows too. Holding ⌘ lets them place it freely. Then they select a column of five cards and choose Align left, then Distribute vertically.

**Why this priority**: tidy diagrams are the point of the product; hand-aligning boxes is the slowest part of editing today.

**Independent Test**: drag a card near another card's edges and centres and check the guides and snapping; hold ⌘ and check no snapping; select three cards and run every align and distribute action from the toolbar, the menu and the shortcuts.

**Acceptance Scenarios**:

1. **Given** a component being dragged near another's centre line, **When** within 6 screen px, **Then** a guide shows and the component snaps to it.
2. **Given** a dragged component, **When** its left, right, top or bottom edge or its centre is within 6 screen px of the same kind of line of a visible component, **Then** a guide shows across both and the dragged component snaps; the nearest line wins on each axis.
3. **Given** snapping would apply, **When** the user holds ⌘, **Then** no guide shows and the component follows the pointer exactly.
4. **Given** a snapped position, **When** guides show, **Then** a distance label shows the gap to the nearest neighbour on that axis, and an equal-gap label shows when the gap equals an existing gap between two neighbours in the same row or column.
5. **Given** three selected components, **When** the user chooses "Align left", **Then** their x positions are equal to the leftmost one's; **When** "Distribute horizontally", **Then** the gaps between them are equal and the outermost two do not move.
6. **Given** a multi-selection, **When** the user presses ⌥A / ⌥D / ⌥W / ⌥S, **Then** the selection aligns left / right / top / bottom; each align or distribute is one undo step.
7. **Given** a selection of fewer than two components (or fewer than three for distribute), **When** the toolbar or menu shows, **Then** Align is hidden from the toolbar and disabled in the menu with a tooltip saying how many to select.
8. **Given** a multi-selection, **When** the toolbar shows, **Then** it offers Align ▸ (left, centre, right, top, middle, bottom, distribute horizontally, distribute vertically) and Group, as in frame 99.

---

### User Story 4 - Drop components into or out of a group (Priority: P2)

The architect drags a new "Fraud check" card over the "Payments" frame. While the pointer is inside it, the frame shows a dashed orange boundary, a soft fill, a "Drop into Payments" chip and a dashed slot where the card will land. They release and the card joins the group. Later they drag it back out of the frame onto empty canvas and it leaves the group, while the frame stays the same size. When they only want to move a card across a group without joining it, they hold ⌥.

**Why this priority**: keeps groups correct while arranging, without opening the drawer. It is used less often than copy, group and align.

**Independent Test**: drag a card into a group, out of a group, and across a group with ⌥. Check each membership change in the JSON panel, check that each drop is one undo step, and check that no frame changed size.

**Acceptance Scenarios**:

1. **Given** components dragged so the pointer is inside a group they do not belong to, **When** hovering, **Then** that group shows the drop-target highlight and a "Drop into <group>" chip; **When** released, **Then** they become members of that group in the same undo step as the move.
2. **Given** a drop-target highlight, **When** the pointer leaves the group, **Then** the highlight goes away immediately; only the innermost group under the pointer highlights.
3. **Given** components dragged with ⌥ held over a group, **When** released, **Then** they move but their group does not change, and no drop-target highlight shows.
4. **Given** members of a group dragged so the pointer ends outside that group's frame, **When** released, **Then** they leave the group and join the innermost group whose frame is under the pointer, or the top level; the frame keeps its size, and the move and the membership change are one undo step.
5. **Given** a member dragged out with ⌥ held, **When** released outside the frame, **Then** it stays a member and is drawn outside its frame.
6. **Given** a drop into a collapsed group, **When** released, **Then** the components join it and the group stays collapsed, with its member count updated.
7. **Given** a drop into a group, **When** the card lands, **Then** it keeps the position where it was released (the dashed landing slot shows that spot), and the frame does not grow.

---

### User Story 5 - Nudge and fine-tune from the keyboard (Priority: P2)

A keyboard user has selected two cards. ⌥→ moves them 1 px, ⌥⇧→ 10 px. Pressing it three times and then ⌘Z restores the original position in one step. While dragging with the mouse they can also tap the arrow keys to move the dragged cards by 1 px.

**Why this priority**: constitution VII; the keyboard must reach every positioning action, and fine placement is otherwise fiddly.

**Independent Test**: with only the keyboard, select, nudge, align, distribute, copy, paste, duplicate, group and ungroup; check undo steps.

**Acceptance Scenarios**:

1. **Given** a selected component, **When** the user presses ⌥⇧→ three times, **Then** it moved 30 px right and one ⌘Z restores it.
2. **Given** a selected component, **When** the user presses ⌥←, **Then** it moves 1 px left; plain arrows keep moving focus between cards (003).
3. **Given** a burst of nudges less than 1 s apart, **When** the user presses ⌘Z, **Then** the whole burst is undone at once; a nudge after a pause of 1 s or more starts a new undo step.
4. **Given** a pointer drag in progress, **When** the user presses an arrow key (with ⇧ for 10 px), **Then** the dragged selection moves by that amount (§g-45).
5. **Given** keyboard focus on the canvas, **When** the user presses ⌘C, ⌘V, ⌘D, ⌘X, ⌘G, ⇧⌘G, ⌥A / ⌥D / ⌥W / ⌥S, **Then** each works on the selection exactly as the matching menu item, and the result is announced (e.g. "Pasted 3 components and 2 connections").
6. **Given** the keyboard-shortcut help, **When** opened, **Then** it lists every shortcut added by this feature.

---

### User Story 6 - See what a gesture will do (Priority: P3)

While the architect Shift+drags a selection box, a small chip at the cursor counts the cards fully inside, and a dark hint bar at the bottom centre lists "⇧ Add · ⌥ Touch · Esc Cancel". While dragging a group it lists "⌥ Duplicate · ⇧ Lock axis · ⌘ No snap · Esc Cancel".

**Why this priority**: makes the modifier keys discoverable; the gestures work without it.

**Independent Test**: start each gesture (marquee, card drag, group drag) and check the hint bar content and the marquee count chip; release and check both disappear.

**Acceptance Scenarios**:

1. **Given** a Shift+drag marquee, **When** dragging, **Then** cards fully inside get the selection frame live, a count chip follows the cursor, and releasing selects them.
2. **Given** a marquee with ⌥ held, **When** dragging, **Then** cards the box only touches are also selected.
3. **Given** a marquee, **When** the user presses Esc, **Then** it disappears and the selection is what it was before the marquee started.
4. **Given** a marquee released on empty canvas with nothing inside, **When** released, **Then** the selection is cleared.
5. **Given** any marquee, card drag or group drag, **When** in progress, **Then** the hint bar shows the modifier keys that apply to that gesture and disappears when it ends; screen readers get the same hint once when the gesture starts.

### Edge Cases

- **Paste while drilled into a group** (010): pasted objects land inside the drilled group's scope; pasted groups nest in it.
- **Paste into a deck that lacks referenced rules**: rule attachments that point to rules not present in the target deck are dropped; within the same deck they are kept.
- **Paste with the pointer inside a frame**: the pasted top-level objects join the innermost group whose frame is under the paste point, as a drop would (FR-008).
- **Member outside its frame**: a file edited by hand or by another tool can have a member whose card lies outside its group's frame. It stays a member (membership is the stored `group`) and is drawn where it is. Opening such a deck does not change it.
- **Frame covers a card that is not a member**: nothing changes until that card is dragged and dropped. A frame never takes members by covering them.
- **Resize a parent group** smaller than a nested group's frame: stops at the nested frame plus padding (same rule as members).
- **Semantic zoom levels** (010): cards shrink at lower levels while frames keep their stored size, so members always stay inside.
- **Collapsed group** (010): drawn as its collapsed card at the frame's top-left; the stored size is kept for when it is expanded.
- **Very large paste** (e.g. 500 components): stays one undo step and does not freeze the tab for more than a second; larger fragments are still accepted.
- **Clipboard access denied** by the browser: copy and paste fall back to the browser's own copy / paste events; if both fail, a toast says "Could not use the clipboard"; nothing leaves the device.
- **Copy from a view that hides components** (011): only visible, selected components are copied.
- **Cut of a component that is part of a flow**: follows the existing delete rules (confirmation that lists the affected steps).
- **Group drag onto itself or its own descendant**: never nests; the drop is a plain move.
- **Drag a group whose members are hidden in the current view**: hidden members move with it, so the group's layout stays intact.
- **Align across groups**: aligns positions only; group membership does not change.
- **Guides with hundreds of components**: guides only consider components visible on screen.
- **⌘G on a selection that includes groups**: the selected groups are nested in the new group together with the selected components.
- **⌘G on a selection containing only stickies or connections**: nothing happens (disabled with a tooltip).
- **Stickies** in a selection: they are moved by nudge and group drags as today, but are not copied, grouped or aligned.
- **Flow mode, flow recording, view-only editor**: copy is allowed (it does not change the deck); cut, paste, duplicate, group, align, nudge, snapping drags and drop-into-group are not available.
- **Another tab edits the same deck** during a drag: the drag ends with the positions it computed; a component deleted meanwhile is skipped.
- **Undo after paste in another tab**: undo history is per tab; undo in deck B never touches deck A.

## Requirements _(mandatory)_

### Functional Requirements

**Clipboard**

- **FR-001**: Copy (⌘C) MUST put a Sododeck fragment on the system clipboard containing the selected components, every connection whose both ends are selected, and every group whose members (components and nested groups) are all selected. Nothing else from the deck is included.
- **FR-002**: The fragment MUST be valid against the deck file format (a partial `.sododeck.json` document marked as a fragment) so it pastes across tabs and decks; it MUST never leave the device.
- **FR-003**: Paste (⌘V) MUST create every object of the fragment with new ids, keep references inside the pasted set (connections, group membership, nested groups), drop references to objects that are not in the target deck, and make the pasted objects the selection.
- **FR-004**: Paste MUST place the fragment's top-left at the pointer when the pointer is over the canvas; otherwise 24 px right and below the fragment's original position when that is on screen; otherwise at the view centre. Repeated pastes at the same point MUST each add a further 24 px offset.
- **FR-005**: Duplicate (⌘D) MUST copy and paste the selection 24 px right and below the originals in one step, without changing the system clipboard.
- **FR-006**: Cut (⌘X) MUST copy, then delete the selection with the existing delete rules (confirmation and Undo toast unchanged).
- **FR-007**: Paste MUST ignore clipboard contents that are not a Sododeck fragment; the canvas-menu Paste item MUST be disabled with an explanatory tooltip when there is nothing to paste (103).
- **FR-008**: Pasted top-level objects MUST join the innermost group whose frame contains the paste point. Without such a frame they join the current drill scope (010) or the top level. Pasted groups keep their copied frame size, moved by the paste offset.
- **FR-009**: ⌥+drag of a selection (components or a group) MUST leave the originals and drop a copy at the release point.
- **FR-010**: Paste, duplicate, cut and ⌥+drag MUST each be exactly one undo step.

**Group frames**

- **FR-040**: A group MUST have a position and a size stored in the deck, and the canvas, minimap, export (012) and every other view MUST draw it from them. A group's frame MUST NOT change when its members move, are added or are removed.
- **FR-041**: A view that stores its own component positions (011) MUST also store a position and size for each group it shows. Moving or resizing a group while that view is active MUST change only that view's frame. When such a view has no frame for a group yet, its frame MUST be fitted around the members' positions in that view.
- **FR-042**: Opening or importing a deck whose groups have no frame MUST give each of them a frame fitted around its members (and nested groups) with the standard group padding. This MUST NOT add an undo step, and the canvas MUST look the same as before.
- **FR-043**: A selected group MUST show eight resize handles (corners and sides). Dragging one MUST resize the frame from that side, with ⇧ keeping the aspect ratio and ⌥ resizing from the centre. The frame MUST stop at the box around its members and nested groups plus the padding, and at 160 × 96 px. Resizing MUST NOT move any card or change membership, and MUST be one undo step.
- **FR-044**: The drawer for a selected group MUST show X, Y, W and H number fields that move and resize it with the same rules. This is the keyboard path for resizing. ⌥+arrow nudges MUST also move a selected group.
- **FR-045**: Auto-layout and Tidy (011) MUST write the frames of the groups they lay out, so a laid-out group fits its members.
- **FR-046**: Membership MUST stay explicit: only drops (FR-018–FR-020), pastes (FR-008), ⌘G, Ungroup and the existing group field change a component's or group's parent. Moving or resizing a frame MUST NOT.

**Groups**

- **FR-011**: Group (⌘G) with two or more selected components (and optionally selected groups) MUST create a group named "New group" in the innermost group that contains every selected object (or at top level), with a frame fitted around the selection plus the standard group padding. It MUST move the selection into the group and start renaming its label (019 title edit).
- **FR-012**: Creating the group and moving the selection into it MUST be one undo step; the rename that follows is a separate step (as with new components in 019).
- **FR-013**: Ungroup (⇧⌘G) MUST keep its 019 behaviour.
- **FR-014**: Dragging a group's label or frame edge MUST move its frame, every member and every nested group (with their frames) by the same offset, as one undo step; the drag MUST show a dashed ghost of the start position and an offset readout (e.g. `+96, +20`).
- **FR-015**: During a group drag, Esc MUST cancel and restore every position; ⇧ MUST lock the movement to one axis; ⌥ on release MUST duplicate instead of move.
- **FR-016**: Releasing a group drag with the pointer inside another group's frame MUST nest the dragged group in it (never in itself or a descendant) and show a toast with Undo. Releasing a nested group with the pointer outside its parent's frame MUST move it to the innermost frame under the pointer, or to the top level.
- **FR-017**: Clicks and drags on empty space inside a frame MUST keep their canvas meaning (pan, Shift+drag marquee), and clicks on cards inside MUST select those cards. Only the label, the frame edge (an 8 px band) and the collapsed group card select and drag the group.

**Drop into / out of a group**

- **FR-018**: While components are dragged, the innermost group whose **frame** is under the **pointer**, and that they do not already belong to, MUST show the drop-target highlight (dashed orange boundary, soft fill, "Drop into <group>" chip, dashed landing slot, 110). Releasing MUST make them members of that group in the same undo step as the move. The frame MUST NOT grow.
- **FR-019**: Holding ⌥ during a drag MUST suppress the highlight and keep group membership unchanged.
- **FR-020**: Releasing dragged members with the pointer outside their group's frame MUST take them out of that group, into the innermost frame under the pointer or to the top level, in the same undo step as the move. Releasing with the pointer inside the frame MUST keep them members, even if a card overhangs the edge.

**Align, distribute and nudge**

- **FR-021**: Align left / centre / right / top / middle / bottom MUST be available for two or more selected components; each aligns to the outermost (or, for centre / middle, the selection's centre) edge of the selection.
- **FR-022**: Distribute horizontally / vertically MUST be available for three or more selected components and make the gaps between neighbouring cards equal while the two outermost cards stay put.
- **FR-023**: ⌥A / ⌥D / ⌥W / ⌥S MUST align left / right / top / bottom.
- **FR-024**: ⌥+arrow MUST move the selection 1 px and ⌥⇧+arrow 10 px; plain arrows keep moving focus (003). Nudges less than 1 s apart MUST merge into one undo step.
- **FR-025**: During a pointer drag, arrow keys MUST move the dragged selection by 1 px (⇧: 10 px) (§g-45).
- **FR-026**: Align, distribute and nudge MUST change positions only, never group membership.

**Guides and snapping**

- **FR-027**: While dragging components or a group, the dragged bounding box MUST snap to the edges and centres of visible, non-dragged components within 6 screen px, independently per axis, and show a 1 px guide across the aligned cards.
- **FR-028**: Guides MUST show the distance to the nearest neighbour on that axis and an equal-gap label when the gap equals an existing gap between neighbours in the same row or column (111).
- **FR-029**: Holding ⌘ (Ctrl on Windows and Linux) MUST disable snapping and guides for as long as it is held; ⇧ MUST lock the drag to one axis.

**Marquee and hints**

- **FR-030**: The Shift+drag marquee MUST show the cards fully inside with the selection frame live and a count chip at the cursor; ⌥ MUST also include cards it touches; Esc MUST cancel and restore the previous selection; releasing with nothing inside MUST clear the selection. Plain drag on empty canvas MUST keep panning (§g-36).
- **FR-031**: A hint bar at the bottom centre MUST list the modifier keys of the gesture in progress (marquee, component drag, group drag) and hide when it ends; the same hint MUST be announced once to screen readers when the gesture starts.

**Surfaces and shortcuts**

- **FR-032**: Copy, Cut, Paste, Duplicate, Group, Align ▸ and Distribute MUST be added to 019's shared action list, so the selection toolbar, the context menus and the shortcuts offer them with the same availability rules (019 FR-039, FR-040). The multi-component toolbar gains Align ▸ and Group (99); the component menu gains Copy, Cut, Duplicate and Group (102); the canvas menu gains Paste (103); the group menu gains Copy, Duplicate.
- **FR-033**: The keyboard-shortcut help MUST list every shortcut added by this feature; single-key and ⌥ shortcuts MUST be ignored while a text field has focus.
- **FR-034**: Every action in this feature MUST be operable by keyboard alone (drag gestures excepted, which have keyboard equivalents: nudge, align, group, paste), have an accessible name and announce its result through the existing live region.
- **FR-035**: Editing actions (cut, paste, duplicate, ⌥+drag, group, align, distribute, nudge, drop into group) MUST NOT be available in flow mode, during flow recording or in the view-only editor; copy MUST stay available.

**Document, state and performance**

- **FR-036**: Every change MUST go through the shared document; gesture state (ghost, guides, drop target, hint, marquee, nudge burst) MUST be UI-only and never saved in the deck or undo history.
- **FR-037**: The file-format change MUST be additive and optional: group position and size, and per-view group position and size. Older files MUST stay valid, the schema version MUST NOT change, and the round trip MUST stay lossless with and without frames. New objects MUST get new stable ids, and no existing id MUST change.
- **FR-038**: Dragging 100 selected components on the 500-component / 1,000-connection benchmark deck MUST stay at ≥ 60 fps with guides enabled.
- **FR-039**: All new surfaces (guides, labels, marquee chip, drop target, ghost, readout, hint bar) MUST use DESIGN.md tokens in light and dark themes, never convey state by colour alone, and appear without animation under reduced motion.

### Key Entities

- **Group frame**: a group's position (top-left) and size, in canvas px, stored on the group. A view with its own positions stores an override per group. It is document data.
- **Fragment**: a partial deck (components, connections, groups) on the clipboard, marked as a Sododeck fragment, with its original bounding box for placement.
- **Gesture**: the drag, group drag or marquee in progress: start positions, modifier keys, current snap lines, drop target. UI only.
- **Guide**: an aligned line (axis, position, the cards it spans) plus optional distance and equal-gap labels. UI only.
- **Nudge burst**: the run of nudges merged into one undo step. UI only.
- **Action** (from 019): the new copy / paste / duplicate / group / align commands, shared by shortcuts, toolbar and menus.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Repeating a cluster of 3 components and 2 connections takes one selection gesture plus 2 keystrokes (⌘C, ⌘V) or 1 (⌘D), in 100 % of tested cases, and one undo reverses it.
- **SC-002**: Building a 30-component diagram from a 5-component pattern (copy, paste, align) takes under 5 minutes for a first-time tester.
- **SC-003**: Grouping a selection and naming the group takes one shortcut plus typing the name.
- **SC-003a**: Moving a member inside its frame, adding a member or removing one never changes the frame's size (0 px) in 100 % of tested cases. Resizing a frame never moves a card.
- **SC-003b**: Every deck saved before this feature opens with each group visually where it was (frame within 1 px of the old derived box) and passes the round trip.
- **SC-004**: After "Align" and "Distribute", positions are exactly equal (0 px difference) along the aligned axis and gaps differ by at most 1 px.
- **SC-005**: A dragged card snaps whenever it comes within 6 screen px of a neighbour's edge or centre, and never when ⌘ is held.
- **SC-006**: Canvas drag of 100 selected components stays at ≥ 60 fps at 500 components / 1,000 connections, and pan / zoom shows no regression against the benchmark measured before this change.
- **SC-007**: Every action in this feature can be completed with the keyboard alone; a keyboard-only tester completes every acceptance scenario of stories 1, 2 (except dragging), 3 (except guides) and 5.
- **SC-008**: Paste between two decks in different tabs works in the latest two versions of Chrome, Edge, Firefox and Safari, and no network request carries deck content.
- **SC-009**: The implemented states 92 (Align part), 99, 102–104 (016 items), 108–111 match the design screenshots in light and dark, with differences either fixed or listed.

## Assumptions

- Frames 108–111 set the look of guides, marquee, drop target and hint bar; frame 109's plain-arrow nudge is a mock value (§g-53); nudge keys follow §g-45.
- The clipboard holds text containing the fragment JSON, so paste works across tabs and decks; there is no separate in-app clipboard. Copy JSON (⇧⌘C, 019) stays as it is and copies the selection's JSON for reading, not for pasting.
- Pasting does not copy flows, steps, stickies, views or features; rule attachments are kept only when the rule exists in the target deck (within the same deck they always do).
- Groups get a stored frame (clarification 2026-09-29), reversing the schema's "bounds are derived" note. The plan records this in an ADR and updates the schema, the model (round-trip cases), the canvas, the minimap, export (012) and Tidy / auto-layout (011). The group size uses the same size shape that 017 plans for `node.size`, so 017 reuses it and the resize handles.
- "Standard group padding" is the padding the canvas uses for derived group boxes today, so fitted frames match the current look.
- Membership stays explicit (`node.group`, `group.parent`) for stable references (constitution III); the frame only decides where a drop or paste lands.
- ⌘G nests the new group in the innermost common group, matching 002's group parent model.
- The collapsed group card sits at the frame's top-left, and the stored size is kept for when the group is expanded.
- Estimate grows from 4 d to about 6 d because of the frames (schema, model, migration on open, resize, per-view frames).
- The equal-gap label and distance label consider only components visible on screen, to keep dragging fast.
- The existing 003 drag already writes one undo step per drag; this feature keeps that and adds snapping and drop targets to it.
- Clipboard access uses the platform clipboard with feature detection and the copy / paste event fallback (constitution IV); no new runtime dependency.
- New e2e tests are not added (constitution VI); behaviour is covered by unit and component tests, and the smoke suite keeps passing.
