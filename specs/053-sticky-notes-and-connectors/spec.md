# Feature Specification: Sticky notes and connector multi-select

> **Note (2026-10-05):** pinning a note to a card was removed by [ADR 0041](../../docs/decisions/0041-remove-note-pinning.md). Notes are always free; a connector links a note to a card. The pin parts of this spec are kept as history.

**Feature Branch**: `053-sticky-notes-and-connectors`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "053 from docs/backlog.md: sticky notes and connector multi-select. Founder manual-testing feedback (2026-10-05). Sticky note: its shape looks like a card, so it is not recognizable as a sticky note; it cannot be resized; a connector cannot be dragged from a sticky to another item (the founder often has a card they do not understand, creates a sticky as a comment and drags a connector to that card); there is no toolbar for a sticky (change colour, …). Connector: several connectors cannot be selected at once to quickly change colour, weight, …"

**Sources**: `docs/backlog.md` §053; `specs/009-stickies-search/` (sticky model: text, colour, anchor, position, collapsed, show in flows); `specs/050-connector-editing/` (connector handles, weight slider, "several selected connectors" already named in its US3 scenario 6); `specs/022-connector-style/`; `specs/016-canvas-editing/` and `specs/017-resize-edge-routing/` (selection, resize); DESIGN.md (sticky, selection, floating toolbars); constitution v1.0.0.

## Scope

**In scope**

- **Sticky look**: a sticky note is drawn as a paper note (soft shadow, light gradient, no card header or fields; tags show as small chips along the bottom), clearly different from a card, recognised at a glance in both themes and for each colour.
- **Sticky stack**: in the Add flyout, a "Sticky" tile shows a pad of notes in the current colour. The user can click it or drag a note straight from the pad onto the canvas, instead of using a toolbar button.
- **Sticky resize and auto-fit text**: a selected sticky is resized with its handles. By default the text size adjusts itself to the note: short text is large, long text gets smaller, and text is never cut off. The user can also pick a fixed text size.
- **Sticky as a connector end**: a connector can start or end on a sticky, so a note can point at any card, group or other sticky. It can be created by dragging from the sticky, and an existing connector end can be moved onto a sticky.
- **Sticky tags**: a sticky can carry the deck's tags. They show as small coloured chips along the bottom of the note and are added or removed from the toolbar's tag button, using the same tag picker, colours, rename and delete as cards.
- **Sticky toolbar**: a floating toolbar for the selected sticky: text size (Auto or a fixed size), bold, alignment, link, colour (the existing five colours), tags, and the quick actions (expand / collapse, pin / unpin, lock, delete).
- **Connector multi-select and toolbar**: several connectors can be selected together, by shift-click and by marquee, with a floating toolbar for them (arrow ends, type, colour, weight, lock). Style changes apply to all of them in one undo step.

**Out of scope**

- New sticky types, sticky templates, comment threads, replies, authors or timestamps.
- Changing how a sticky is pinned to an object (the existing Free / Pinned choice stays as is).
- Editing the shape of several connectors at once (bends, anchors); only style properties are shared.
- Flow playback through a sticky (a connector to a sticky is a plain connection, not a flow step).
- Rich text beyond bold, links and the existing markdown; images in stickies (images are 055).
- Converting a sticky into another kind of object, owner and reactions on stickies, comment threads, tags with their own colours (sticky tags are the deck's tags).

## Clarifications

### Session 2026-10-05

- Q: Which sticky colours? → A: Keep the existing five (amber, blue, green, clay, grey); no 16-colour palette.
- Q: Do sticky tags share the deck-wide tag list with cards? → A: Yes (option A): same tags, colours, picker, rename and delete; a sticky simply gains tags.
- Q: Where do reference screenshots live? → A: Locally under `specs/053-sticky-notes-and-connectors/reference/`, git-ignored, never pushed (copyright).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Comment on a card with a sticky and a connector (Priority: P1)

A user meets a card they do not understand. They add a sticky note, write the question in it, then drag a connector from the sticky to that card. The note stays visibly linked to the card, so anyone reading the deck sees what the comment is about.

**Why this priority**: This is the founder's main use of stickies and is impossible today; it is the reason for the feature.

**Independent Test**: Add a sticky, type text, drag from the sticky's connection handle onto a card. A connector appears between them. Move the card: the connector follows. Undo once removes the connector only.

**Acceptance Scenarios**:

1. **Given** a sticky and a card on the canvas, **When** the user drags from the sticky's connection handle and drops on the card, **Then** a connector joins the sticky to the card, in one undo step.
2. **Given** a sticky and a card, **When** the user drags from the card's connection handle and drops on the sticky, **Then** a connector joins the card to the sticky.
3. **Given** a connector between two cards, **When** the user drags one end and drops it on a sticky, **Then** the connector now ends on the sticky.
4. **Given** a connector to a sticky, **When** either end object moves, **Then** the connector follows and keeps its routing.
5. **Given** a connector to a sticky, **When** the sticky is deleted, **Then** the connector is deleted with it (same rule as for cards), and the delete confirmation lists the connector.
6. **Given** a sticky that is pinned to a card, **When** the user also connects it to another item, **Then** both the pin and the connector exist and neither affects the other.
7. **Given** a connector between a sticky and a group, **When** the deck is saved and reopened, **Then** the connector is restored unchanged.

---

### User Story 2 - A sticky looks like a sticky, resizes, and fits its text (Priority: P1)

A user can tell a sticky from a card at a glance, and can resize it. The text always fits: short text is big and easy to read, long text shrinks so nothing is cut, and the user zooms in to read it.

**Why this priority**: The founder cannot recognise stickies today, and a fixed size makes notes either cramped or wasteful.

**Independent Test**: Place a sticky next to a card in light and dark themes: they look clearly different. Select the sticky and drag a corner handle: the size follows the pointer and persists after reload. Undo restores the old size.

**Acceptance Scenarios**:

1. **Given** a sticky and a card side by side, **When** viewed in either theme and with each of the five colours, **Then** the sticky is clearly distinguishable from the card without reading its content.
2. **Given** a selected sticky, **When** the user drags a corner or side handle, **Then** the sticky resizes live, and the size is saved on release as one undo step.
3. **Given** a resize in progress, **When** the user drags below the minimum size, **Then** the size stops at the minimum (a note stays readable and its handles stay reachable).
4. **Given** a sticky with text size on Auto, **When** the text is short, **Then** it is shown large; **When** the user types more text or makes the note smaller, **Then** the text size shrinks step by step so all of it stays visible, and it grows back when text is removed or the note is enlarged.
5. **Given** text so long that it would need a size below a readable minimum, **When** displayed, **Then** the size stops at that minimum and the extra text is clipped with a visible cue; the full text stays in the document and in the inspector.
6. **Given** a sticky whose text size is set to a fixed value, **When** the note is resized or edited, **Then** the size does not change on its own.
7. **Given** a collapsed sticky, **When** selected, **Then** it cannot be resized until it is expanded, and the handles are not shown.
8. **Given** a deck saved before this feature (stickies with no size), **When** opened, **Then** every sticky shows at the default size and is unchanged when saved without edits.
9. **Given** several selected items including stickies, **When** the user resizes a sticky by its handle, **Then** only that sticky is resized.

---

### User Story 3 - Sticky toolbar (Priority: P2)

A user selects a sticky and a small floating toolbar appears next to it with text, colour and quick actions, instead of opening the inspector for every change. A user also adds a sticky by dragging a note from the stack in the Add flyout.

**Why this priority**: Makes stickies quick to use, but the notes work without it (inspector today).

**Independent Test**: Select a sticky: the toolbar appears. Click another colour: the note changes colour immediately; undo reverts. Select several stickies: one colour click changes them all.

**Acceptance Scenarios**:

1. **Given** a sticky is selected, **When** it is the only selected item, **Then** a floating toolbar appears near it and follows it while it moves, stays out of the way of its resize handles, and hides while dragging.
2. **Given** the toolbar, **When** the user opens the colour control, **Then** the five sticky colours show (the current one ticked), and picking one changes the sticky at once, in one undo step.
3. **Given** the toolbar, **When** the user uses the quick actions (expand / collapse, pin / unpin, lock / unlock, delete), **Then** each does what the same action does elsewhere (inspector, context menu).
4. **Given** several stickies selected, **When** the user picks a colour, text size, bold or alignment, **Then** all of them change in one undo step.
5. **Given** the toolbar, **When** the user navigates with the keyboard, **Then** every control is reachable, labelled, and shows a tooltip with its shortcut where one exists.
6. **Given** a sticky near the edge of the viewport, **When** it is selected, **Then** the toolbar stays fully visible (it flips to another side).
7. **Given** the toolbar's text size control, **When** the user opens it, **Then** it offers Auto (default) and a short list of fixed sizes, and shows the current choice.
8. **Given** the toolbar, **When** the user applies bold, alignment or a link to the note's text, **Then** the note shows it and the saved text keeps it.
9. **Given** the Add flyout, **When** it opens, **Then** it shows a Sticky tile drawn as a pad of notes in the colour last used; clicking it places a note in the centre of the view, and dragging a note from the pad drops it where released, with the new note ready for typing.
10. **Given** the Sticky tile is dragged over the canvas, **When** the pointer is over a card or group, **Then** the note is dropped as a free note (it is never pinned by accident).
11. **Given** the toolbar's tag button, **When** the user opens it, **Then** the same tag picker as for cards opens (search, the deck's tags with colour and usage count, "Create tag" row); picking a tag adds it as a coloured chip along the bottom of the note, in one undo step.
12. **Given** a sticky with tags, **When** the user removes a tag from the picker or renames, recolours or deletes that tag deck-wide, **Then** the sticky chips update the same way as on cards.

---

### User Story 4 - Select several connectors and restyle them together (Priority: P2)

A user selects many connectors at once (shift-click or marquee). A floating toolbar appears with their arrow ends, type, colour, weight and lock, and a change applies to every selected connector in one go.

**Why this priority**: Saves repeated work on big decks, and the weight slider scenario in 050 already assumes several selected connectors.

**Independent Test**: Shift-click three connectors, pick a colour and a weight: all three change. One undo reverts all of them.

**Acceptance Scenarios**:

1. **Given** a selected connector, **When** the user shift-clicks another connector, **Then** both are selected; shift-clicking a selected one removes it.
2. **Given** a marquee drag over an area, **When** it covers connectors, **Then** the connectors it touches are selected together with the cards it covers, as today.
3. **Given** several connectors selected, **When** the user changes colour, weight, type (curved / elbow / straight), line style or arrow ends, **Then** all of them change in one undo step.
4. **Given** selected connectors with different values for a property, **When** the style controls show, **Then** that property displays as "mixed" until the user picks a value.
5. **Given** a selection of connectors plus other objects, **When** the user changes a style, **Then** only the properties that apply to each object type change, and each object keeps the rest.
6. **Given** several connectors selected, **When** the user looks at the canvas, **Then** per-connector shape handles (bends, anchors) are not shown, so handles from different connectors do not overlap; with one connector selected they show as today.
7. **Given** several connectors selected, **When** the user presses Delete, **Then** the delete confirmation lists them and one undo restores all.
8. **Given** several connectors selected, **When** the selection settles, **Then** a floating toolbar shows above the group of connectors with: arrow ends (start and end), line type, colour, weight, lock / unlock and a more menu; it hides while dragging and stays inside the viewport.
9. **Given** several connectors selected, **When** the user locks them, **Then** none of them can be moved, reshaped or reconnected until unlocked, in one undo step.

### Edge Cases

- A connector from a sticky to itself: not allowed (same rule as for cards).
- A sticky connected to a sticky: allowed.
- A collapsed sticky with a connector: the connector attaches to the collapsed shape and follows its size when expanded or collapsed.
- A sticky inside a group or over a card: the connector drag target is the topmost item under the pointer, with the group frame as the fallback.
- Hidden stickies (sticky visibility off): their connectors are hidden too, and they return with the stickies.
- Flow playback: connectors to stickies are never part of a flow and are dimmed like other non-flow items.
- Export (PNG, SVG, JSON) and the JSON panel show the resized stickies and their connectors.
- Search and outline: connectors to stickies appear like any connector, labelled with both ends.
- Very small resize or extreme zoom: handles keep a usable hit area at any zoom.
- Auto text size with markdown (lists, headings, code): the whole note is measured, so formatted text fits like plain text.
- Text stays readable in each of the five sticky colours in both themes.
- Many tags on a small sticky: chips never cover the text; they wrap or collapse to "+N", and auto text size accounts for the space they use.
- Locked sticky or connector: cannot be moved, resized, reshaped or deleted by accident; it can still be selected, restyled only after unlocking, and unlocked from the toolbar.
- Opening a deck made after this feature in an older build: an unknown sticky size or sticky connector end is kept and not dropped on save, as for other unknown optional data.

## Requirements _(mandatory)_

### Functional Requirements

**Sticky look**

- **FR-001**: A sticky MUST be drawn as a paper note that differs from a card in silhouette and surface: no header, no fields, no card lip, in both themes and for all five colours.
- **FR-002**: The sticky look MUST meet the design system's contrast requirements for its text in every colour and theme.

**Sticky resize**

- **FR-003**: Users MUST be able to resize a selected, expanded sticky with handles at its corners and sides, with live feedback.
- **FR-004**: The sticky's size MUST be saved in the deck as an optional value; absent means the default size, and existing files stay valid without migration.
- **FR-005**: A sticky MUST NOT shrink below a minimum size; the minimum MUST keep the text area and handles usable.
- **FR-006**: With text size on Auto, the text size MUST adjust to the note's size and text length so that all text is visible, between a maximum size and a readable minimum. Only below the minimum MAY text be clipped, with a visible cue; text MUST never be deleted or shortened in the document.
- **FR-006a**: The user MUST be able to choose a fixed text size instead of Auto; a fixed size is saved with the note and never changes by itself.
- **FR-007**: A resize MUST be one undo step and respect the same alignment guides and grid behaviour as card resize, with the same key to turn snapping off.

**Sticky connections**

- **FR-008**: A sticky MUST expose the same connection handle behaviour as a card and a group: drag from it to create a connector.
- **FR-009**: A connector's end MUST be allowed to be a sticky, for new connectors and when moving an existing end. The file format MUST accept it as an additive change (existing files stay valid).
- **FR-010**: Deleting a sticky MUST delete its connectors, with the same confirmation and undo behaviour as other objects.
- **FR-011**: A connector to a sticky MUST support the same style, routing and label features as other connectors.
- **FR-012**: A connector from an object to itself MUST be refused for stickies as for cards.
- **FR-013**: The existing Free / Pinned behaviour MUST be unchanged and independent of connectors.

**Sticky toolbar**

- **FR-014**: Selecting one or more stickies MUST show a floating toolbar with: text size (Auto or fixed), bold, alignment, link, colour (the existing five), tags, and the quick actions expand / collapse, pin / unpin, lock / unlock and delete.
- **FR-014a**: The sticky colour set MUST stay the existing five (amber, blue, green, clay, grey); absent colour still means amber. No new colours and no format change for colour.
- **FR-014c**: A sticky MUST be able to carry tags from the deck's tag list (the same list, colours, case rules, rename and delete as cards, 033); chips show along the bottom of the note, up to the same limit of ten per object, and wrap or collapse to a "+N" chip when they do not fit the note's width; the tag button and picker are in the toolbar. Tags are part of the deck's tag usage counts and search.
- **FR-014b**: The Add flyout MUST show a Sticky tile as a pad of notes in the last-used colour; click places a note at the centre of the view, drag places it where dropped, and both create one undo step with the note in edit mode.
- **FR-015**: Toolbar actions MUST apply to all selected stickies in one undo step and MUST behave exactly like the same actions in the inspector.
- **FR-016**: The toolbar MUST be keyboard accessible, labelled, and kept inside the viewport.

**Connector multi-select**

- **FR-017**: Users MUST be able to add and remove connectors from the selection by shift-click and to select them with a marquee.
- **FR-018**: With several connectors selected, a style change MUST apply to all of them in one undo step, for every style property a single connector supports.
- **FR-019**: When selected connectors differ on a property, the control MUST show a "mixed" state and MUST NOT change the property until the user picks a value.
- **FR-020**: With several connectors selected, per-connector shape handles MUST NOT be shown.
- **FR-020a**: With several connectors selected, a floating toolbar MUST offer arrow ends, type, colour, weight, lock / unlock and a more menu, apply each change to all of them in one undo step, and stay inside the viewport.
- **FR-021**: With a mixed selection of object types, a style change MUST apply only the properties that exist for each type.

**Cross-cutting**

- **FR-022**: Every change in this feature MUST be a single undo step and keep the canvas, the JSON panel and the inspector in sync; the saved file MUST round-trip losslessly.
- **FR-023**: No network request carrying deck content MAY be made.
- **FR-024**: Canvas performance MUST not regress (500 nodes / 1,000 edges benchmark, before and after numbers reported).

### Key Entities

- **Sticky note**: existing note (text, colour, pin, position, collapsed, show in flows). Gains an optional size, an optional fixed text size (absent means Auto), optional tags, an optional lock, and can be the end of a connector.
- **Connector**: existing connection. Its end may now be a sticky as well as a card or a group.
- **Selection**: the set of selected objects. May contain several connectors, with style controls that work on all of them.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a quick check with 5 people who have not used Sododeck, at least 4 of 5 name a sticky as a "note" when shown a deck with stickies and cards, without hints.
- **SC-002**: A user can attach a comment sticky to a card (add sticky, type, connect) in under 20 seconds.
- **SC-003**: Restyling 10 connectors takes one selection and one control change (instead of 10 repeats), and one undo reverts all of them.
- **SC-004**: A resized sticky keeps its size after save and reload in 100 % of tested cases, and decks made before this feature open with all stickies unchanged.
- **SC-005**: The canvas benchmark shows no regression beyond measurement noise.
- **SC-006**: All new controls are usable with the keyboard alone.
- **SC-007**: A user can add a sticky by dragging from the Add flyout stack and start typing in under 5 seconds, without using the toolbar.
- **SC-008**: In a note with 5 to 400 characters, all text is visible at the default note size, with no manual resizing or size changes.

## Assumptions

- The sticky colours stay the existing five (founder decision 2026-10-05); no free colour picker.
- Auto text size is a display behaviour: it is not stored; only a fixed size is. Minimum readable size and the list of fixed sizes are chosen at planning.
- Sticky tags are an additive format field using the deck's existing tag type and rules; no new tag kinds.
- Bold, alignment and link use the note's existing markdown text; no new rich-text format.
- Lock for stickies and connectors uses the same meaning as lock for cards; a lock field for them is an additive format change. The wider lock work (select all and lock, lock a group) is 054.
- The toolbars' look follows the existing floating-toolbar style in DESIGN.md. Reference screenshots from the founder (sticky stack, toolbars, auto-fit text, multi-connector toolbar, tag chips) are third-party material: they are kept locally in `specs/053-sticky-notes-and-connectors/reference/` and are git-ignored (`specs/*/reference/`); they are never committed or pushed, and the spec, plan and UI describe behaviour in our own terms and our own design.
- Sticky size is a plain width and height with a default equal to today's look; the default size is chosen at planning.
- A sticky connector is a regular connector (same style options, same label); there is no special "comment link" kind.
- Connectors to stickies are not flow steps; flows are unchanged.
- Shift-click and marquee are the multi-select gestures, matching how cards already behave.
- The single-connector popover keeps its behaviour; with several connectors selected the same style controls apply to all.
- File format changes (sticky size, sticky as connector end) are additive and do not bump the format version; the exact fields are decided in the plan and recorded in the schema with Ajv / Zod parity tests.
- Out-of-scope items (inline comment threads, per-connector shape editing in bulk) can be separate backlog items if wanted later.
