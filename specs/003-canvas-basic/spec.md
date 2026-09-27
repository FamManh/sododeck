# Feature Specification: Basic Canvas Editing

**Feature Branch**: `003-canvas-basic`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "003 (canvas-basic) from docs/backlog.md — Let an architect draw a system from a blank canvas. They pick component kinds (client, gateway, service, queue, database, external) from a palette by dragging or clicking, connect components by dragging from one to another, move them, select one or several, delete them, and undo or redo any of that. Components show a colored kind tile, a title and a short subtitle; groups show a dashed boundary with a label; connections show their label on demand. Users can zoom, fit the diagram, pan with a minimap and browse all components in an outline tree. An empty deck explains how to start. Everything must work with the keyboard and stay smooth with 500 components and 1,000 connections. Why: designing a solution before code exists is the first job of the primary user, and diagrams in this domain get large. Base it on the 002 docs (002 is still being implemented in another session)."

**Sources**: `docs/backlog.md` §003, `docs/spec.md` C-1, C-2, C-6, NFR performance and accessibility, `docs/design/design-analysis.md` §g-11, §g-19, §g-28, §g-30, `docs/design/screens/` 02, 10, 11, 12, 14, 37, 38, 52–59, 61 (light and dark), `specs/002-yjs-model/spec.md` and `specs/002-yjs-model/contracts/model-api.md` (the deck model this feature edits through), constitution v1.0.0 (principles I, III, IV, V, VI, VII, VIII).

**Dependency note**: 002 (deck model) is specified but not yet merged. This spec relies only on behavior promised by the 002 spec and its API contract: typed edit operations, delete cascade (a component's connections are removed with it; flow steps and notes that used it are kept and flagged), gesture grouping (one drag = one undo step), undo/redo with availability, change observation, and stable ids. If 002 changes those promises before merge, this spec must be re-checked.

## Scope

**In scope**

- Editor shell layout: top bar, left panel with Outline and Palette tabs, canvas, inspector column, and a reserved slot for the JSON panel (filled by 004).
- Showing components (kind tile, title, subtitle, rule marker), groups (dashed boundary around their members, with a label) and connections (routed line with an end marker and an optional label pill).
- Adding components from the palette by drag or click (keyboard included).
- Drawing connections by dragging between components, and by keyboard ("connect to…"); refusing self-connections and duplicate connections at draw time; reconnecting an endpoint of an existing connection.
- Inline connection popover for label, protocol and direction, after creating a connection or on double-click.
- Selecting (single, shift-click, marquee, select all), moving (drag, including several selected components at once), deleting with confirmation and an Undo toast.
- Undo and redo of every canvas edit.
- Zoom in/out/fit (30–200%), fit on open, minimap with click-to-pan, Labels toggle, outline tree with collapse and select, empty-deck card.
- Minimal inspector: title of the selected component or connection; deck name when nothing is selected.
- Keyboard operation of all of the above, with visible focus.

**Out of scope**

- Full inspector fields, rules and bulk edit (008); JSON panel content (004); flows (006, 007); stickies and ⌘K / global search (009); focus mode, drill-down, semantic zoom, collapsing groups (010); saved views and auto-layout (011); export (012); autosave and the deck library (005).
- Creating, renaming, re-parenting or deleting groups from the canvas (groups are shown and their members can be moved; group editing arrives with 008/010).
- Queue-lane or custom edge routing.
- New end-to-end browser tests (constitution VI; the existing smoke suite must keep passing).
- Cloud and partner kinds (design 61, §g-28) and any other file-format change: a follow-up feature.

## Clarifications

### Session 2026-09-27

- Q: Should the cloud and partner component kinds (design 61, open decision §g-28) be delivered in this feature? → A: No. Leave them to a follow-up feature; 003 ships with the six current kinds and does not change the file format or the 002 model.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Draw a first system from an empty deck (Priority: P1)

An architect opens an empty deck. A card explains how to start. They drag "Service" from the palette onto the canvas, then click "Database" in the palette; each new component appears, is selected, and is listed in the outline. They drag from the service's side handle onto the database; a connection appears and a small popover lets them type its label and pick its protocol and direction.

**Why this priority**: Adding and connecting components is the core job; everything else in the editor assumes a diagram exists.

**Independent Test**: Starting from an empty deck with only this story implemented, create two components and a labeled connection with the mouse, then with the keyboard only, and confirm the deck contains them.

**Acceptance Scenarios**:

1. **Given** an empty deck, **When** the editor opens, **Then** an empty-canvas card explains how to add a first component and the palette is reachable from it.
2. **Given** an empty deck, **When** the user drags "Service" from the palette onto the canvas, **Then** a "New service" component appears at the drop point, is selected, the empty-canvas card disappears, and the outline lists it.
3. **Given** the palette has focus on a kind, **When** the user presses Enter (or clicks the card), **Then** a new component of that kind appears at a free spot in the visible area and is selected.
4. **Given** two components, **When** the user drags from one component's handle and releases on the other, **Then** a new connection exists between them, is selected, and the inline popover opens with focus on the label field.
5. **Given** the inline popover is open, **When** the user sets label, protocol and direction and closes it (Enter, Esc or click outside), **Then** the connection shows those values; double-clicking the connection later reopens the popover.
6. **Given** a component has keyboard focus, **When** the user presses C, types part of another component's title and presses Enter, **Then** a connection to that component is created and the popover opens.

---

### User Story 2 - Only valid connections can be drawn (Priority: P1)

While dragging a new connection, the architect sees which drop targets are valid. Dropping on a component that is already connected to the source, or on the source itself, creates nothing and says why. Dropping on empty canvas cancels. An existing connection's endpoint can be dragged to a different component.

**Why this priority**: Accidental duplicate or self connections silently corrupt diagrams; the design (52–56) treats this feedback as part of drawing.

**Independent Test**: With three components where two are already connected, attempt each invalid drop and one reconnect; check the deck after each.

**Acceptance Scenarios**:

1. **Given** a connection drag in progress, **When** the pointer is over a valid target, **Then** the target shows a valid-target cue (ring plus a "+" mark, not colour alone).
2. **Given** two components already connected, **When** the user drags from one onto the other, **Then** the target shows the invalid state (ban icon plus explanatory text) and releasing creates nothing.
3. **Given** a connection drag in progress, **When** the user releases over the source component or empty canvas, **Then** nothing is created and the canvas returns to its previous state.
4. **Given** the keyboard "connect to…" list is open, **When** it lists components, **Then** components that would duplicate an existing connection (or the source itself) are shown disabled as "already connected" and cannot be chosen.
5. **Given** an existing connection, **When** the user drags one of its endpoints onto a different component, **Then** the connection now links to that component with the same id, label, protocol and direction; dropping on an invalid target or empty canvas leaves it unchanged.

---

### User Story 3 - Select, move and delete safely (Priority: P1)

The architect moves components around, selects several with shift-click or a marquee, and deletes a selection. A confirmation names what will be removed. After confirming, a toast offers Undo for 6 seconds, and ⌘Z works even after the toast is gone.

**Why this priority**: Rearranging and removing are constant during design; founder decisions §g-11 and §g-19 require confirmation plus undo.

**Independent Test**: Build a deck of four components and three connections; move, multi-select, delete, cancel, confirm and undo; check the deck after each step.

**Acceptance Scenarios**:

1. **Given** a component, **When** the user clicks it, **Then** it is selected, shown with the selection style, and the inspector shows its title; **When** the user clicks empty canvas, **Then** the selection is cleared and the inspector shows the deck name.
2. **Given** components on the canvas, **When** the user shift-clicks several, draws a marquee around several, or presses ⌘A, **Then** all of them are selected, a selection frame is drawn around them, and an "n selected" pill shows the count.
3. **Given** several selected components, **When** the user drags one of them, **Then** all selected components move together, and one undo returns them all to their previous positions.
4. **Given** a selected component with two connections, **When** the user presses Delete (or uses the inspector's delete button), **Then** a confirmation dialog names what will be removed (the component and its 2 connections, and the number of flow steps or notes that will be flagged as broken, if any).
5. **Given** that confirmation dialog, **When** the user cancels or presses Esc, **Then** nothing changes; **When** the user confirms, **Then** the component and its connections disappear and a 6-second toast with an Undo button and a ⌘Z hint appears.
6. **Given** a confirmed delete, **When** the user presses Undo in the toast, or ⌘Z (also after the toast has gone), **Then** everything removed comes back with the same ids, positions and fields.
7. **Given** a selected connection, **When** the user deletes it and confirms, **Then** only that connection is removed.

---

### User Story 4 - Undo and redo every canvas edit (Priority: P1)

Every change made on the canvas (add, connect, reconnect, move, popover edit, rename, delete) can be undone and redone with ⌘Z and ⇧⌘Z, one user action at a time.

**Why this priority**: Undo is P0 (C-6) and is the safety net behind confirmed deletes.

**Independent Test**: Perform one of each edit type, then undo all and redo all; the deck must match its state at every step.

**Acceptance Scenarios**:

1. **Given** a component was dragged across the canvas, **When** the pointer is released and ⌘Z pressed once, **Then** the component returns to its position before the drag.
2. **Given** a sequence of edits, **When** ⌘Z is pressed repeatedly, **Then** edits are reverted in reverse order, one user action per press; ⇧⌘Z re-applies them.
3. **Given** there is nothing to undo (or redo), **When** the user looks at the undo/redo controls, **Then** they are shown as unavailable and the shortcut does nothing.
4. **Given** a text field (inspector title or popover label) has focus, **When** the user presses ⌘Z, **Then** the text edit is undone as a unit, never a single keystroke into a half-typed title that differs from any value the user saw.

---

### User Story 5 - Navigate large diagrams (Priority: P2)

On a deck with hundreds of components, the architect zooms, fits the diagram to the screen, pans by clicking the minimap, turns connection labels on and off, and finds a component through the outline tree.

**Why this priority**: Diagrams in this domain get large (spec NFR: 500 components / 1,000 connections), but a small diagram is usable without these tools.

**Independent Test**: Open the 500-component benchmark deck; use zoom, fit, minimap, Labels and outline; measure smoothness.

**Acceptance Scenarios**:

1. **Given** a deck is opened, **When** the canvas first shows, **Then** the whole diagram is fitted into view.
2. **Given** the zoom control, **When** the user presses −, + or fit, **Then** the zoom changes within 30–200% and the current percentage is shown.
3. **Given** the minimap, **When** the user clicks a spot on it, **Then** the canvas pans to centre that spot.
4. **Given** Labels is off, **When** the user turns it on, **Then** every connection that has a label shows it in a label pill; turning it off hides them again.
5. **Given** the outline tab, **When** it shows the deck, **Then** components are listed in a tree under their groups; groups can be collapsed and expanded; choosing an entry selects that component on the canvas and brings it into view.
6. **Given** the 500-component / 1,000-connection benchmark deck, **When** the user pans and zooms, **Then** the canvas stays smooth (see SC-003).

---

### User Story 6 - Everything works from the keyboard (Priority: P2)

A keyboard-only user tabs into the canvas, moves between components with the arrow keys, adds components from the palette, connects them with C, edits labels, deletes with confirmation, and undoes, always seeing where focus is.

**Why this priority**: Accessibility is a constitution principle (VII); it is layered on top of stories 1–5.

**Independent Test**: Complete story 1 and story 3 without a pointing device.

**Acceptance Scenarios**:

1. **Given** focus is before the canvas, **When** the user presses Tab, **Then** focus enters the canvas on the selected component (or the first one) and a visible focus ring is shown.
2. **Given** a focused component, **When** the user presses an arrow key, **Then** focus and selection move to the nearest component in that direction; if there is none, focus stays.
3. **Given** a focused component, **When** the user presses Tab onto a side handle, **Then** the connection handles become visible and can start a connection.
4. **Given** any state change that is shown only visually (item added, deleted, toast shown, drop refused), **When** it happens, **Then** it is also announced to assistive technology.

### Edge Cases

- Deleting a component used by a flow step or a note: the step and note are kept and flagged broken (002 cascade); the confirmation mentions them so the user is not surprised.
- Deleting a mixed selection (components and connections, where some connections are also removed because their component is): the confirmation counts each object once.
- Deleting with nothing selected: Delete does nothing and no dialog opens.
- Delete pressed while typing in a text field (title, popover label): edits the text, never deletes the selection.
- A second delete confirmed while an Undo toast is showing: the toast is replaced by one for the latest delete; ⌘Z still undoes deletes in reverse order.
- Undo that restores a deleted component while it is off-screen: the restored objects are selected so the user can find them.
- Dropping a palette item outside the canvas: nothing is created.
- Very long component titles: truncated on the canvas with the full title available as a tooltip and accessible name.
- Two components at the exact same position (e.g. adding twice by click): the second one is offset so both remain visible and clickable.
- A connection whose label is empty: no pill is shown even when Labels is on.
- A deck file with a connection to a missing component (allowed by 002 and reported by 015): the canvas does not draw that connection and does not crash.
- A deck whose components have no saved position: they are placed on a simple grid so none overlap.
- Zoom at 30% or 200%: the corresponding button is disabled.
- Undo of a component creation while its popover or inspector is open: the popover/inspector closes cleanly.

## Requirements _(mandatory)_

### Functional Requirements

**Editor shell**

- **FR-001**: The editor MUST show a top bar, a left panel with Outline and Palette tabs, the canvas, an inspector column and a reserved JSON panel area, matching the design references for layout in light and dark themes.

**Display**

- **FR-002**: Each component MUST show a kind tile (colour tint and icon per kind), its title, a one-line subtitle (the component's technology, when present) and a marker when rules are attached.
- **FR-003**: Each group MUST be shown as a dashed boundary around its member components with the group title as a label; the boundary MUST follow its members when they move.
- **FR-004**: Each connection MUST be drawn as a routed line with rounded corners and an end marker showing direction (forward, both or none), with a hit area wide enough to select it easily.
- **FR-005**: When Labels is on, every connection with a label MUST show it in a label pill; when off, pills MUST be hidden.
- **FR-006**: Selected, focused, hover, valid-target and invalid-target states MUST each be distinguishable by more than colour (ring, pattern, icon or text).

**Adding and connecting**

- **FR-007**: The palette MUST offer the kinds client, gateway, service, queue, database and external, each addable by dragging onto the canvas (placed at the drop point) or by click/Enter (placed at a free spot in view).
- **FR-008**: A new component MUST get the default title "New <kind>", become the only selection, and appear in the outline.
- **FR-009**: Hovering or focusing a component MUST reveal four side handles from which a connection can be dragged; a dashed preview line MUST follow the pointer.
- **FR-010**: The system MUST refuse, at draw time, a connection from a component to itself or to a component it is already connected to (in either direction), showing why; releasing on empty canvas MUST cancel.
- **FR-011**: A new connection MUST be selected and the inline popover MUST open with focus on the label; the popover MUST edit label, protocol and direction and reopen on double-click of the connection.
- **FR-012**: Pressing C on a focused component MUST open a type-ahead "Connect <title> to…" list of other components, with would-be duplicates shown disabled; choosing one creates the connection.
- **FR-013**: Users MUST be able to drag either endpoint of an existing connection to another component; the connection keeps its id and fields; invalid drops leave it unchanged.

**Selecting and moving**

- **FR-014**: Users MUST be able to select one item by click, add/remove items with shift-click, select by marquee, select all components with ⌘A, and clear the selection by clicking empty canvas or pressing Esc.
- **FR-015**: A multi-selection MUST show a frame around the selected items and an "n selected" count.
- **FR-016**: Dragging a selected component MUST move every selected component together; the whole drag MUST be one undo step.

**Deleting**

- **FR-017**: Delete/Backspace (outside text fields) and the inspector's delete button MUST open a confirmation dialog that names the items to be removed with counts, including connections removed with their components and flow steps or notes that will be flagged broken.
- **FR-018**: Cancel or Esc MUST leave the deck unchanged; confirming MUST remove the items in one undo step and show a 6-second toast with an Undo button and a ⌘Z hint.
- **FR-019**: Undo (toast or ⌘Z, before or after the toast disappears) MUST restore every removed object with the same ids and fields.

**Undo and redo**

- **FR-020**: Every edit in this feature MUST be undoable and redoable with ⌘Z / ⇧⌘Z (Ctrl on non-Mac), one user action per step; the undo/redo controls MUST reflect availability.
- **FR-021**: Undo and redo MUST use the deck model's history; the canvas MUST NOT keep its own copy of the deck or its own history.

**Navigation**

- **FR-022**: The canvas MUST fit the diagram into view when a deck opens and offer zoom −, + and fit, limited to 30–200%, with the current level shown.
- **FR-023**: A minimap MUST show the whole diagram and the visible area; clicking it MUST pan the canvas there.
- **FR-024**: The outline MUST list groups and components as a tree, allow collapsing groups, and select and reveal a component on the canvas when chosen; it MUST stay in sync with canvas changes.
- **FR-025**: An empty deck MUST show an empty-canvas card with how to start; the card MUST disappear once a component exists.

**Inspector (minimal)**

- **FR-026**: With one component or connection selected, the inspector MUST allow editing its title (component) or label (connection); with nothing selected, it MUST allow editing the deck name; with several selected, it MUST show the count.

**Keyboard and accessibility**

- **FR-027**: Every action in this feature MUST be possible without a pointing device: Tab into the canvas, arrow keys to move focus/selection to the nearest component in that direction, Enter to open the popover or edit, C to connect, Delete to delete, Esc to cancel or deselect.
- **FR-028**: Focus MUST always be visible; each component and connection MUST have an accessible name (kind and title; source, target and label).
- **FR-029**: Adds, deletes, refused drops and toasts MUST be announced to assistive technology.

**Data and privacy**

- **FR-030**: All edits MUST go through the deck model's edit operations; the canvas MUST only display what the deck model contains, so every other surface (outline, inspector, later the JSON panel) shows the same state.
- **FR-031**: Component positions set on the canvas MUST be stored in the deck, so they survive export and re-import.
- **FR-032**: No diagram content MUST leave the browser; all icons and fonts used by the canvas MUST be bundled.

### Key Entities

- **Component (node)**: a box on the canvas with a stable id, kind, title, optional subtitle fields, optional group and position.
- **Group**: a named boundary drawn around its member components; may be nested.
- **Connection (edge)**: a directed link between two components with optional label, protocol and direction.
- **Selection**: the set of currently selected components and connections; UI-only, never stored in the deck.
- **Viewport**: current zoom level and pan position; UI-only.
- **Labels setting**: whether connection labels are shown; UI-only preference.
- **Undo toast**: a transient notice after a confirmed delete offering Undo for 6 seconds.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time user can go from an empty deck to three connected, labeled components in under 2 minutes without help beyond the empty-canvas card.
- **SC-002**: A keyboard-only user can complete the same task (User Story 1) and a delete-with-undo (User Story 3) with no pointing device, in 100% of test runs.
- **SC-003**: On the 500-component / 1,000-connection benchmark deck, panning and zooming stay at 60 frames per second or better on a typical laptop, and dragging a component shows no visible lag.
- **SC-004**: 100% of canvas edits (add, connect, reconnect, move, popover edit, rename, delete) are reverted exactly by one undo and re-applied exactly by one redo.
- **SC-005**: 0 self or duplicate connections can be created through drawing, keyboard connect or reconnect.
- **SC-006**: After any sequence of canvas edits, exporting the deck and re-importing it shows the same components, connections and positions.
- **SC-007**: Implemented screens match the referenced design screenshots (light and dark) with only the allowed differences (DESIGN.md token overrides, lucide icons, confirmation dialog before delete).
- **SC-008**: The existing smoke suite, including the "no third-party requests" check, passes.

## Assumptions

- The deck model from 002 provides typed add/update/remove operations, the delete cascade, gesture grouping, undo/redo with availability, change observation and stable ids, as described in `specs/002-yjs-model/spec.md` and its API contract. This feature adds no document logic of its own.
- Duplicate-connection blocking is a canvas rule for drawing only; the model still accepts duplicates (e.g. from imported files or different protocols), and 015 reports them. Two connections between the same pair "in either direction" count as duplicates for drawing.
- Selection, focus, viewport and the Labels setting are UI-only state and are not saved in the deck file; the Labels setting may be remembered per browser.
- The confirmation dialog reuses the design's small dialog (screen 72) with a destructive button, as §g-19 specifies; its wording is a design detail.
- The subtitle shows the component's technology (`tech`); when it is empty no subtitle line is shown. Choosing another subtitle field per view arrives with saved views (011).
- "Free spot in view" for click-to-add means the centre of the visible area, offset if another component already sits there.
- Undo/redo shortcuts inside a text field act on the field's text first, then fall through to the deck history (standard editor behaviour).
- Components that belong to a group are moved individually; the group boundary is recalculated from its members, not stored.
- The M0 placeholder files in the editor are the starting point and may be replaced.
- No new runtime dependency is expected beyond the canvas library already in the app; any addition is justified in `plan.md` and approved by the founder (constitution VIII).
