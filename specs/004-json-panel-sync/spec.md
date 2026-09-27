# Feature Specification: Read-only JSON Panel in Sync with the Canvas

**Feature Branch**: `004-json-panel-sync`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "004 (json-panel-sync) from docs/backlog.md — Show the deck as JSON in a panel under the canvas, always in sync with the diagram. Users can view the JSON of the current selection or of the whole deck, fold and scroll it, copy it, and collapse or resize the panel. The panel is read-only in this version: it explains that edits happen on the canvas and in the inspector. Why: developers think in text and the product promise is 'the diagram is data'; seeing the exact file content next to the picture builds trust before two-way editing arrives. Base it on specs/003-canvas-basic (003 is still being implemented in another session)."

**Sources**: `docs/backlog.md` §004 and founder decision §g-3, `docs/spec.md` C-5 (read-only part), NFR performance and accessibility, `docs/design/design-analysis.md` §g-3, §g-23, §g-32, `docs/design/screens/` 02 (selection tab, light and dark), 16 (Deck tab), 17 (collapsed), `specs/003-canvas-basic/spec.md` (editor shell with the reserved JSON panel slot, selection, UI-only state), `specs/003-canvas-basic/contracts/canvas-ui.md` (smoke-suite hooks, including the JSON region), `specs/002-yjs-model/spec.md` (the model's deck export), constitution v1.0.0 (principles I, II, IV, V, VI, VII, VIII).

**Dependency note**: 003 (canvas-basic) is specified and planned but still being implemented. This spec relies only on what the 003 spec and its contracts promise: an editor shell with a reserved JSON panel slot under the canvas, a selection of components and connections kept as UI-only state, a minimal inspector that renames the selection, an Undo toast mechanism, and a fast deck snapshot from the model that always equals the model's export. If 003 changes those promises before merge, re-check this spec. 004 must not start implementation before 003 is merged (backlog rule).

## Scope

**In scope**

- Filling the reserved JSON panel slot from 003 under the canvas.
- Panel header: JSON label, a two-segment switch (Selection tab labelled with the selected item's title, and Deck), a status "Read-only · synced with canvas" with an icon, the line count of the shown text, a Copy button and a collapse/expand control.
- Selection tab: the JSON of the selected component or connection exactly as it appears in the deck file; the JSON of several selected items; a message when nothing is selected.
- Deck tab: the whole deck file content, identical to what the model's export produces.
- Live updates as the canvas, outline or inspector change the deck, including undo and redo, without slowing the canvas on large decks.
- Syntax highlighting, folding of objects and arrays, scrolling and text selection by pointer and keyboard.
- Resizing the panel by dragging its top edge and collapsing it to a thin bar; collapsed state and height remembered per browser.
- Refusing any typed change, with a clear read-only explanation.

**Out of scope**

- Editing JSON, schema autocomplete, parse or schema errors, pasting a deck into the panel (all deferred with C-5, `TODO(C-5)`; design 15 and 39 are not used).
- Flow step JSON in the Selection tab (arrives with 007).
- Group selection JSON (groups are not selectable in 003; arrives with group editing in 008/010).
- Derived values in the panel (problems, group member counts, selection wrappers, merged edges); design frames that show them are not followed (§g-23).
- YAML view (P1), diff view, search inside the panel beyond standard text find.
- Any file-format or model change.
- New end-to-end browser tests (constitution VI; the existing smoke suite must keep passing).

## Clarifications

### Session 2026-09-27

- Q: When several components or connections are selected, what should the Selection tab show? → A: A plain JSON array of the selected objects, each exactly as in the deck file, in file order (components first, then connections); no wrapper and no derived values.
- Q: When the user selects something while the Deck tab is open, should the panel switch tabs by itself? → A: No. The panel never switches tabs on its own; it keeps the tab the user last chose (remembered per browser), and the Deck tab does not scroll to or highlight the selection.
- Q: Which tab does the panel show before the user has ever chosen one in this browser? → A: The Deck tab.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See the selected component as JSON while editing (Priority: P1)

A developer switches the panel under the canvas to the Selection tab and clicks "Order Service" on the canvas. The tab, now labelled "Order Service", shows that component's JSON exactly as it will be written in the file. They rename the component in the inspector; the `"title"` line in the panel changes as they type. They drag the component; its position values update. They click a connection; the panel now shows that connection's JSON. They click the empty canvas; the panel explains that nothing is selected and points to the Deck tab.

**Why this priority**: Seeing the data behind what you just selected is the core "the diagram is data" moment, and it is what developers use most while drawing.

**Independent Test**: With a deck of a few components, select, rename, move and deselect items and check the Selection tab after each action, without using the Deck tab, Copy or resize.

**Acceptance Scenarios**:

1. **Given** a selected component, **When** the user renames it on the canvas or in the inspector, **Then** the Selection tab shows the new `"title"` without reload.
2. **Given** a selected component, **When** the user moves it on the canvas, **Then** the Selection tab shows the new position once the change is applied.
3. **Given** a selected connection, **When** the user changes its label, protocol or direction in the connection popover, **Then** the Selection tab shows the new values.
4. **Given** nothing is selected, **When** the user opens the Selection tab, **Then** it shows a short message ("Select a component or connection to see its JSON") instead of code.
5. **Given** three components and one connection are selected, **When** the user views the Selection tab, **Then** it shows a JSON array of the four objects, each exactly as in the deck file, components first then connections, each group in deck-file order, and the tab label reads "4 selected".
6. **Given** a selected component, **When** the user undoes the last edit, **Then** the Selection tab shows the restored values; **When** the selected item is deleted, **Then** the tab shows the empty-selection message.

---

### User Story 2 - See the whole deck file, always in sync (Priority: P1)

A developer opens the editor for the first time; the panel starts on the Deck tab. It shows the complete deck file with syntax colors and a line count. They add a component from the palette and delete another one; the text updates each time and is always identical to the file an export would produce. They fold the `"nodes"` array to see the rest of the file, then scroll with the keyboard.

**Why this priority**: The Deck tab proves the diagram and the file are the same thing; it is the trust feature before two-way editing arrives.

**Independent Test**: Make a series of canvas edits (add, connect, move, rename, delete, undo, redo) with the Deck tab open, and after each one compare the shown text with the model's export of the deck.

**Acceptance Scenarios**:

1. **Given** a browser where the user has never chosen a tab, **When** the editor opens, **Then** the panel shows the Deck tab.
2. **Given** the Deck tab, **When** the user adds or deletes a component on the canvas, **Then** the JSON updates and equals the model's export of the deck (same text as the exported file).
3. **Given** the Deck tab, **When** the user undoes or redoes an edit, **Then** the text matches the export of the restored deck.
4. **Given** the Deck tab on a long file, **When** the user folds an object or array, **Then** it collapses to one line with a fold marker and the line count still reports the full text; **When** they unfold it, **Then** it expands again.
5. **Given** the panel has keyboard focus, **When** the user presses arrow, Page Up/Down, Home/End keys or selects text with Shift + arrows, **Then** the view scrolls and the text is selected as in any code viewer.
6. **Given** the Deck tab is open and scrolled, **When** the user selects a component on the canvas, **Then** the panel stays on the Deck tab at the same scroll position.
7. **Given** the 500-component / 1,000-connection benchmark deck with the Deck tab open, **When** the user drags a component, **Then** the canvas stays smooth and the panel catches up shortly after, without freezing the page.

---

### User Story 3 - Understand that the panel is read-only (Priority: P2)

A developer clicks into the JSON and starts typing to change a title. Nothing changes; the header status shows a lock icon with "Read-only · synced with canvas", and a short hint tells them to edit on the canvas or in the inspector.

**Why this priority**: Without a clear message, a developer who expects an editable code panel thinks the app is broken. It is cheap and prevents confusion.

**Independent Test**: Focus the panel on either tab, type, paste, cut and delete; confirm the text and the deck are unchanged and the explanation appears.

**Acceptance Scenarios**:

1. **Given** the panel, **When** the user tries to type, paste, cut or delete in it, **Then** nothing changes in the panel or the deck and the status says "Read-only" (with an icon, not color only).
2. **Given** a refused edit attempt, **When** it happens, **Then** a short hint "Edit on the canvas or in the inspector" is shown near the cursor or in the header and is announced to assistive technology, at most once per few seconds so repeated keypresses do not flood it.

---

### User Story 4 - Copy the JSON (Priority: P2)

A developer wants to paste a component's JSON into a ticket. They press Copy; the text shown in the current tab is on the clipboard and a toast says so.

**Why this priority**: Copying is the main way the JSON leaves the editor before export and editing exist; it is small and self-contained.

**Independent Test**: Press Copy on each tab (component, connection, several selected, Deck) and compare the clipboard with the shown text.

**Acceptance Scenarios**:

1. **Given** the Copy button, **When** pressed, **Then** the shown JSON is on the clipboard and a toast confirms it (for example "Copied Deck JSON").
2. **Given** some text is selected inside the panel, **When** the user presses the standard copy shortcut, **Then** only the selected text is copied (the Copy button always copies the whole tab).
3. **Given** the Selection tab with nothing selected, **When** the user looks at the header, **Then** Copy is disabled.
4. **Given** the clipboard is not available (browser refuses access), **When** the user presses Copy, **Then** an error toast says the text could not be copied and suggests selecting it and using the copy shortcut.

---

### User Story 5 - Collapse and resize the panel (Priority: P3)

A developer needs more room for the canvas. They collapse the panel to a thin "JSON" bar; later they expand it again and drag its top edge to make it taller. After a reload the panel is still collapsed or at the height they chose.

**Why this priority**: Layout comfort; the panel is useful at its default size, so this can come last.

**Independent Test**: Collapse, reload, expand, resize, reload; check the collapsed state and height after each reload.

**Acceptance Scenarios**:

1. **Given** the expanded panel, **When** the user presses the collapse control, **Then** the panel shrinks to a thin bar labelled "JSON" with an expand control, and the canvas gains the space.
2. **Given** the panel is collapsed, **When** the page reloads, **Then** it stays collapsed (UI preference).
3. **Given** the expanded panel, **When** the user drags its top edge (or focuses the resize handle and uses arrow keys), **Then** the height changes within a minimum and a maximum that always leave room for the canvas; the chosen height is remembered after reload.
4. **Given** the panel is collapsed, **When** the selection or deck changes, **Then** nothing is lost: expanding shows the current JSON.

### Edge Cases

- **Empty deck**: the Deck tab shows the export of an empty deck (header fields and empty collections), never an error; the Selection tab shows the empty-selection message.
- **Selected item deleted** (by the user, by an undo of its creation, or by the delete cascade): the Selection tab falls back to the empty-selection message, or to the remaining items if several were selected.
- **Very long values** (long descriptions, many tags): lines are not wrapped by default and the panel scrolls horizontally; the canvas layout is not affected.
- **Large deck**: updates are grouped so a continuous drag does not recompute the whole file every frame; the panel may lag the canvas briefly but must show the final state once the user stops.
- **Rapid tab switching** while updates are pending: the panel always shows the latest state of the chosen tab, never a stale tab's text.
- **User has scrolled or folded** in the Deck tab and an update arrives: the scroll position is kept as close as possible and folded regions stay folded when they still exist.
- **Panel focused while the canvas changes** (e.g. undo via shortcut): keyboard focus stays in the panel.
- **Undo/redo shortcuts pressed while the panel has focus**: they act on the deck history (the panel has no text history of its own, since it is read-only).
- **Offline**: the panel renders and highlights with no network (all code viewer assets bundled).
- **Narrow window**: the panel keeps its header usable (tab labels truncate with an ellipsis; the full title is available on hover and to assistive technology).
- **Dark theme**: code colors follow the theme tokens in both light and dark.

## Requirements _(mandatory)_

### Functional Requirements

**Panel and header**

- **FR-001**: The editor MUST show the JSON panel in the slot reserved by 003, under the canvas and between the left panel and the inspector, matching design references 02, 16 and 17 (light and dark) except for the status text and the allowed differences in DESIGN.md.
- **FR-002**: The panel header MUST show a "JSON" label with a code icon, a two-segment switch (Selection and Deck), a status "Read-only · synced with canvas" with a lock icon, the number of lines of the shown text, a Copy button and a collapse/expand control.
- **FR-003**: The Selection segment MUST be labelled with the selected item's title (component title, or connection label, or "source → target" when a connection has no label), "<n> selected" for several items, and "Selection" when nothing is selected.
- **FR-004**: When the user selects something on the canvas, in the outline or elsewhere, the panel MUST keep the tab the user last chose; it MUST NOT switch tabs on its own, and the Deck tab MUST NOT scroll to or highlight the selected object. The chosen tab MUST be remembered per browser; before any choice has been made in this browser (or if the remembered value cannot be read), the panel MUST open on the Deck tab.

**Content**

- **FR-005**: The Selection tab MUST show, for one selected component or connection, that object's JSON exactly as it appears inside the deck file (same fields, same values, same formatting and indentation).
- **FR-006**: For several selected items, the Selection tab MUST show a JSON array of those objects, each as in FR-005, components first, then connections, each group in deck-file order. No wrapper object, no "mixed" markers and no derived values (the design's selection object in screen 58 is not followed, §g-23).
- **FR-007**: With nothing selected, the Selection tab MUST show a message explaining how to get content (select a component or connection, or open the Deck tab), and MUST show no code and no line count.
- **FR-008**: The Deck tab MUST show text identical, character for character, to the deck file the model exports.
- **FR-009**: The panel MUST show only what the deck model contains; it MUST NOT add derived or UI-only values (problems, member counts, selection state, viewport, collapsed state).

**Live sync**

- **FR-010**: The panel MUST update after every change to the deck, from any surface (canvas, outline, inspector, popover, undo, redo), without a reload or user action.
- **FR-011**: On the 500-component / 1,000-connection benchmark deck, updating the panel MUST NOT cause visible stutter on the canvas; updates MAY be grouped during continuous gestures but the panel MUST show the final state no later than 0.5 seconds after the gesture ends.
- **FR-012**: When the selection changes, the Selection tab MUST show the new selection immediately (within one frame for small decks, within 0.2 seconds on the benchmark deck).
- **FR-013**: On updates, the panel MUST keep the user's scroll position and folded regions as far as the new text allows.

**Viewing**

- **FR-014**: The panel MUST highlight JSON syntax (keys, strings, numbers, booleans/null, punctuation) using theme tokens for the code surface in light and dark themes.
- **FR-015**: The panel MUST let users fold and unfold every multi-line object and array, by pointer and by keyboard.
- **FR-016**: The panel MUST support scrolling and text selection by pointer and keyboard, and standard copy of selected text.
- **FR-017**: The panel MUST remain responsive when showing the benchmark deck's full file (scrolling and folding without visible lag).

**Read-only**

- **FR-018**: The panel MUST refuse every change to its text (typing, paste, cut, delete, drag-and-drop) on both tabs, and MUST never change the deck.
- **FR-019**: On a refused change, the panel MUST show and announce the hint "Edit on the canvas or in the inspector", throttled so repeated attempts do not repeat the announcement more than once every few seconds.
- **FR-020**: The read-only state MUST be conveyed by icon and text, not by color only.

**Copy**

- **FR-021**: The Copy button MUST place the full text of the current tab on the clipboard and show a confirming toast naming what was copied.
- **FR-022**: Copy MUST be disabled when the current tab shows no code (empty selection).
- **FR-023**: If writing to the clipboard fails, the panel MUST show an error toast suggesting manual selection and the copy shortcut.

**Collapse and resize**

- **FR-024**: The panel MUST collapse to a thin bar showing "JSON" and an expand control, and expand back; the canvas MUST take the freed space.
- **FR-025**: The panel MUST be resizable by dragging its top edge and by keyboard on a focusable resize handle, between a minimum height (header plus a few lines) and a maximum that leaves the canvas at least a usable height.
- **FR-026**: Collapsed state, height and chosen tab MUST be remembered per browser and restored on reload; they MUST NOT be stored in the deck.

**Keyboard and accessibility**

- **FR-027**: Every control in the panel (tabs, Copy, collapse, resize handle, code area) MUST be reachable and operable by keyboard with visible focus.
- **FR-028**: The panel MUST be a labelled region ("JSON"); the tabs MUST expose their selected state; the code area MUST be announced as read-only; copy results and refused edits MUST be announced.

**Privacy and assets**

- **FR-029**: No diagram content MUST leave the browser; the code viewer and its assets MUST be bundled, with no network requests (the existing "no third-party requests" smoke check must stay green).
- **FR-030**: The existing smoke-suite hooks from 003 (including the JSON region) MUST keep working.

### Key Entities

- **Deck file text**: the text of the deck as the model exports it; the Deck tab shows exactly this.
- **Selection JSON**: the deck-file representation of the selected component(s) and connection(s); a view derived from the deck and the UI selection, never stored.
- **Panel preferences**: collapsed state, height and chosen tab; UI-only, remembered per browser, never in the deck.
- **Copy toast**: a transient notice confirming (or failing) a copy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After 100% of tested edit sequences (add, connect, move, rename, popover edit, delete, undo, redo), the Deck tab text equals the exported file character for character.
- **SC-002**: After a rename in the inspector, the new title appears in the Selection tab in under 0.2 seconds on a small deck.
- **SC-003**: On the 500-component / 1,000-connection benchmark deck with the Deck tab open, canvas panning, zooming and dragging stay at the same frame rate as with the panel collapsed (within 10%), and the panel shows the final state within 0.5 seconds after a drag ends.
- **SC-004**: 0 characters of the panel text or the deck change from any typing, paste, cut, delete or drop attempt in the panel.
- **SC-005**: Copy puts exactly the shown text on the clipboard in 100% of test runs on both tabs.
- **SC-006**: A keyboard-only user can switch tabs, fold a section, select and copy text, collapse and resize the panel with no pointing device.
- **SC-007**: Collapsed state and height survive a reload in 100% of test runs.
- **SC-008**: Implemented screens match design references 02, 16 and 17 (light and dark) with only the allowed differences (status text "Read-only · synced with canvas" with a lock icon, DESIGN.md token overrides, lucide icons).
- **SC-009**: The existing smoke suite, including the "no third-party requests" check, passes.

## Assumptions

- 003 provides the editor shell with a reserved JSON panel slot, the UI-only selection of components and connections, a minimal inspector for renaming, a toast mechanism and a fast deck snapshot that equals the model's export after every change. 004 adds no document logic and no model change.
- The model's export (from 002) is the single definition of the deck file text, including field order and indentation; the Selection tab reuses the same formatting for individual objects so its lines match the Deck tab's lines for that object.
- The Selection tab label uses the connection's label, or "source → target" titles when the label is empty.
- Default panel height is the design's 212 px; the collapsed bar is 36 px; the header is 40 px (design-analysis layout). The minimum height is the header plus about three lines; the maximum leaves at least about 200 px of canvas.
- The design's "Read-only" status (orange dot) is replaced by a lock icon and "Read-only · synced with canvas" in the secondary text color, following the backlog wording and the non-color-only rule.
- The design's line count reflects the shown text ("1038 lines"); the mock's "1 lines" (§g-32) is a glitch — the label uses correct singular/plural.
- A rich code viewer (the one already bundled in the app for the smoke suite's JSON region) is used rather than plain highlighted text, so folding and large files work now and editing later is cheap; this is the backlog's stated trade-off and adds no new runtime dependency. Serializing large decks off the main thread is a planning decision if timing requires it (constitution V).
- Panel preferences are stored with the same per-browser mechanism 003 uses for the Labels setting.
- Toast wording is a design detail; the confirming toast lasts the standard (non-undo) toast duration.
