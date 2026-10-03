# Feature Specification: Shapes

**Feature Branch**: `031-shapes`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "31 from docs/backlog.md": the shape family, with real geometry and centred text; the Basic shapes pack; decision, database and document switch between card and shape; plus a way to draw a frame first and drag cards into it (founder, specify 2026-10-03).

**Sources**: `docs/backlog.md` §031 (scope, out of scope, acceptance criteria), §030 (Basic shapes pack moved here, start / end and actor are shapes); `specs/030-card-types-and-packs/spec.md` and its plan (type registry with `family: 'shape'`, packs, Add flyout, "Basic shapes' default in new decks is decided with 031"); `docs/decisions/0022-schema-roadmap.md` (`node.display`: `card` | `shape`, absent = the type's own family); `docs/decisions/0017-group-frames-and-clipboard.md` (groups are stored frames, membership is explicit, drop into a frame joins its group); `specs/016-canvas-editing/spec.md` (drop into / out of a group, ⌥ keeps membership, frames never capture by covering, FR-046); `DESIGN.md` "Card system (Deck)" (Shape component row: true geometry, 1.5 stroke, lip = the path offset 3px, text 13 / 600 centred, max 3 lines; States table, shape column; zoom levels: Landscape shows only geometry; drag tilt −3° for shapes) and the open item "Card ↔ shape switch"; `docs/design/design-analysis.md` frame 120 "Sample set" (13 shapes and the two forms of decision, database, document), frame 122 (states for a shape), frame 123 (zoom levels), frame 127 (Basic shapes in Add), §g-61 D2, §g-74 (tilt is paint-only); constitution v1.0.0.

**Dependency note**: depends on 030 (type registry, packs, Add flyout; spec, plan and tasks merged, not built). 029 (Deck card), 016 / 017 (groups as frames, resize) and 009 (stickies) are built. 022 (connector style, free anchors) is specified and may land before or after; the outline rule below applies to it.

## Scope

**In scope**

- **Shape family**: eleven shape types with real geometry: rectangle, rounded rectangle, ellipse, diamond, pill (start / end), cylinder, document, parallelogram, hexagon, actor, and text (words only, no outline).
- **Basic shapes pack** in Add (the Shapes tab of 030's flyout) with 13 tiles: the eleven shapes, plus **Sticky** (creates today's sticky note) and **Frame** (draws a group frame, below).
- **Shape look** (`DESIGN.md`): 1.5px outline, a lip drawn as the outline offset 3px where the shape allows it, title centred up to 3 lines; no fields or tags on the shape (they stay in the drawer); fill and stroke colours (020) apply; every state in the States table has its shape form.
- **Connectors meet the outline**, not the bounding box: each side's connection point sits on the shape's edge (for example the four points of a diamond, the top of a cylinder).
- **Resize keeps the geometry**: the shape scales to its box; text re-wraps.
- **Two forms for decision, database and document**: "Show as shape" / "Show as card" from the toolbar and drawer; the object keeps its id, title, description, fields, tags, colour and connections.
- **Frame tool** (founder, specify 2026-10-03: Frame = Group): the Frame tile draws an empty group frame by dragging a rectangle (a click places a default-size frame), with its name ready to type; drawing it around existing cards adds the cards fully inside, once, as "Group" does; dragging cards into it and out of it works as today.
- Shapes work everywhere cards do: selection, drag, snapping, alignment, copy / paste, groups, connections, flows and playback, rules, search, views, export, JSON panel.
- New decks turn the Basic shapes pack on (030 left this to 031); older decks keep their packs.

**Out of scope**

- Free drawing, arbitrary or user-made shapes, rotation, per-shape corner radius.
- A separate decorative frame object (rejected in favour of Frame = Group).
- Frames that capture cards by being moved over them (016 FR-046 stays).
- Renaming "Group" anywhere outside the Add tile (founder: "Frame" in Add, "Group" elsewhere).
- Colour for the text shape (it shows text only, in the default ink).
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from backlog §031, ADR 0022 and `DESIGN.md` are taken as decided: shapes are card types with the shape family; `node.display` records the form of an in-between type (absent = the type's own family); shapes carry no fields or tags on the canvas; tilt and lift are paint-only.
- Q: How do the Sticky, Text and Frame tiles relate to today's stickies and groups? → A (founder): **Sticky reuses today's sticky note. Frame = Group**: the Frame tile is a tool that draws an empty group frame; drawing it around cards adds the cards fully inside once; dragging cards in and out works as today; moving a frame never captures cards. Text is a new shape type (text only).
- Q: What is the frame called in the UI? → A (founder): **"Frame" on the Add tile** (tooltip "Draw a group frame"), **"Group" everywhere else** (⌘G, drawer, menus, Problems).
- Q: Is Basic shapes on in new decks? → A (founder, during 030): **yes**; decks saved before 031 keep the packs they have.
- Q: Which shape does each in-between type use? → A (default, frame 120): decision → diamond, database → cylinder, document → document.
- Q: What does a shape show at each zoom level? → A (default, `DESIGN.md` zoom table): Landscape shows only the geometry; System and closer show the geometry and the centred title; the size never changes with zoom.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Draw a process with real shapes (Priority: P1)

A user maps a checkout process: a "Start checkout" pill, a "Validate cart" rectangle, a "Payment OK?" diamond, an "Orders DB" cylinder and an "Order shipped" pill, connected in order.

**Why this priority**: Process and flow diagrams need standard shapes; without them the Process pack and flows look like architecture cards.

**Independent Test**: In a new deck, add each of the eleven shapes from Add, type a title, connect them, resize two, and check light and dark themes at every zoom level.

**Acceptance Scenarios**:

1. **Given** a new deck, **When** the user opens Add, **Then** a Shapes tab and a Basic shapes section list 13 tiles: Rectangle, Rounded rectangle, Ellipse, Diamond, Pill, Cylinder, Document, Parallelogram, Hexagon, Actor, Text, Sticky, Frame.
2. **Given** a shape tile, **When** the user adds it, **Then** the shape appears at its default size with its true geometry, a 1.5px outline, the lip where the shape allows it, and its title ready to edit, centred.
3. **Given** a long title, **When** it is drawn, **Then** it wraps inside the shape, is cut at 3 lines with "…", and the full title shows on hover.
4. **Given** a shape, **When** the user resizes it, **Then** the geometry stretches to the new box (a diamond stays a diamond touching all four sides), the title re-wraps, and one undo step restores the size.
5. **Given** a diamond connected to two cards, **When** the connectors are drawn, **Then** they meet the diamond at its points, not at the corners of its box; the same holds for every shape's sides.
6. **Given** a shape and a colour, **When** the user picks a fill and stroke (020), **Then** the shape's inside and outline take them, and the title stays readable.
7. **Given** zoom levels, **When** the user zooms out to Landscape, **Then** shapes show only their geometry; at System and closer they also show the title; their size never changes.
8. **Given** each state (hover, selected, editing, problem, current flow step, dimmed, dragged, connection target, has children, highlighted neighbour), **When** a shape is in it, **Then** it shows the shape form from `DESIGN.md`, each with a cue that does not rely on colour.

---

### User Story 2 - Draw a frame first, then fill it (Priority: P1)

A user picks Frame in Add and drags a large rectangle on empty canvas. A frame named "New group" appears with its name ready to type; they type "Payments". They then drag three cards into it; each joins the group. Later they draw a second frame around two existing cards; both join it at once.

**Why this priority**: The founder asked for this workflow explicitly: many people draw the container first and drop things in; today a group can only be made from two or more selected items.

**Independent Test**: Draw an empty frame, rename it, drag cards in and out, draw a frame around existing cards, move a frame over other cards, undo each step.

**Acceptance Scenarios**:

1. **Given** the Frame tile is chosen, **When** the user drags a rectangle on the canvas, **Then** an empty group frame of that size is created (never smaller than the minimum frame size), its name field opens for typing, and one undo step removes it.
2. **Given** the Frame tile is chosen, **When** the user clicks without dragging, **Then** a default-size empty frame is placed at that point.
3. **Given** an empty frame, **When** the user drags a card onto it, **Then** the card joins the group as drops do today ("Drop into <name>" cue), and dragging it back out leaves the group while the frame keeps its size.
4. **Given** cards on the canvas, **When** the user draws a frame that fully contains some of them, **Then** those cards (and groups fully inside) join the new group in the same undo step; cards only partly inside do not.
5. **Given** an existing frame, **When** the user moves it over other cards, **Then** those cards do not join it (frames never capture by covering).
6. **Given** a frame drawn inside another frame, **When** it is created, **Then** it becomes a child group of the outer one.
7. **Given** an empty frame, **When** it is collapsed, saved, exported or reopened, **Then** it behaves as any group with zero members (shown with a count of 0) and is never deleted automatically.
8. **Given** the keyboard, **When** the user activates the Frame tile with ⏎, **Then** a default-size frame is placed at the centre of the view with its name ready to type.

---

### User Story 3 - Switch decision, database and document between card and shape (Priority: P2)

A user has an "Orders DB" database card with a description and fields. For an overview diagram they choose "Show as shape": it becomes a cylinder titled "Orders DB". Later they switch it back and every field is still there.

**Why this priority**: Lets the same object read as a detailed card or a compact symbol without retyping or reconnecting.

**Independent Test**: Switch each in-between type both ways with connections, fields, tags, colour and flow steps attached; undo each switch.

**Acceptance Scenarios**:

1. **Given** a decision, database or document card, **When** the user chooses "Show as shape" in the toolbar or drawer, **Then** it draws as a diamond, cylinder or document shape with its title centred, and one undo step switches it back.
2. **Given** a switched object, **When** it switches back to a card, **Then** its id, title, description, fields, tags, colour, connections, group membership and flow steps are unchanged.
3. **Given** a shape form, **When** the drawer opens, **Then** it still shows the description, fields and tags for editing; they are only hidden on the canvas.
4. **Given** several selected in-between objects, **When** the user switches them, **Then** all switch in one undo step; the control reads "Mixed" when their forms differ and is not offered for types that have only one form.
5. **Given** a switch, **When** the size of the object was set by the user, **Then** it keeps that size in the new form; otherwise each form uses its own default size.

---

### User Story 4 - Sticky and text from the Shapes tab (Priority: P3)

The user adds a Sticky from the Shapes tab and gets the same sticky note the rail makes; they add a Text shape "Checkout v2" as a heading on the board.

**Why this priority**: Completes the Basic shapes set from frame 127 without new concepts.

**Independent Test**: Add a Sticky and a Text from Add; check the sticky is a normal sticky (pin, edit, export) and the text has no outline.

**Acceptance Scenarios**:

1. **Given** the Sticky tile, **When** the user adds it, **Then** a sticky note is created exactly as the rail's Sticky tool creates one (same object, same editing and pinning).
2. **Given** the Text tile, **When** the user adds it, **Then** a text-only shape appears with no outline, no fill and no lip, its words centred and ready to edit.
3. **Given** a Text shape, **When** connected, **Then** connectors meet the edge of its box (it has no outline).

---

### User Story 5 - Older decks and every other place keep working (Priority: P2)

Decks saved before 031 open unchanged. Shapes are found by search, filtered in views, played in flows, exported, and shown in the JSON panel.

**Why this priority**: Protects existing decks and keeps shapes first-class objects.

**Independent Test**: Open a deck saved before 031; build a flow through shapes, export PNG / SVG, search a shape title, hide a shape type in a view.

**Acceptance Scenarios**:

1. **Given** a deck saved before 031, **When** it is opened, **Then** every card and group looks the same, its packs are unchanged, and the file gains no data until the user changes something.
2. **Given** a flow through a pill, a diamond and a cylinder, **When** it plays, **Then** each shape shows the current-step look (orange outline, halo, step sticker) and the connectors' flow look.
3. **Given** shapes on the board, **When** exported to PNG or SVG, **Then** the geometry, colour, lip and title are drawn as on the canvas; the drag tilt is never exported.
4. **Given** a search for a shape's title, **When** results show, **Then** the shape is found; view settings can hide or dim each shape type.
5. **Given** the JSON panel, **When** a shape is added or switched, **Then** the panel shows its type and form in sync with the canvas.

---

### Edge Cases

- A shape resized very small: never below a minimum size per shape that still fits one line of title; the title is cut with "…".
- A very wide or tall shape: geometry stretches (an ellipse becomes elongated, an actor figure stays upright and centred, keeping its proportions within the box).
- Actor: the figure sits in the box with the title below it, inside the box.
- Cylinder and document: the title sits in the visual body, not on the top ellipse or the wavy bottom.
- A parallelogram's left and right connection points sit on the slanted edges at mid-height.
- Lip: drawn for closed shapes with a bottom edge; not for text, actor or pill-less outlines where an offset would look wrong (the plan lists which).
- A connector's free anchor along a side (022) on a shape follows the outline of that side.
- Dragging a shape tilts it −3° (paint-only): snapping, hit tests, connector points and export use the untilted box.
- Switching a card that has children ("n inside") to a shape: the "n inside" pill shows below the shape; drill-in still works.
- A Frame drawn on empty space inside a collapsed group's area, or while drilled into a group: the new frame belongs to the current scope (drilled-in group), as other adds do.
- A Frame dragged smaller than the minimum frame size: the minimum is used.
- Undo of drawing a frame that captured cards: one step removes the frame and restores the cards' previous groups.
- Pack off (030): turning Basic shapes off hides the 13 tiles from Add; shapes on the board keep rendering; Sticky and Frame stay available from their usual places (rail, ⌘G).
- An unknown shape type id from a newer file: drawn as a generic card and reported (030 rule).
- Two tabs switching the same object's form: last write wins; the object stays valid.

## Requirements _(mandatory)_

### Functional Requirements

**Shapes**

- **FR-001**: The app MUST provide eleven shape types (rectangle, rounded rectangle, ellipse, diamond, pill, cylinder, document, parallelogram, hexagon, actor, text) in a Basic shapes pack, shown in the Shapes tab of Add with Sticky and Frame tiles (13 tiles).
- **FR-002**: A shape MUST draw its true geometry with a 1.5px outline, a lip offset 3px where the shape allows it, and its title centred up to 3 lines with "…" and a full-title tooltip when cut; it MUST NOT draw fields or tags on the canvas.
- **FR-003**: Shapes MUST accept the 13 named colours and deck colours for fill and stroke (020), except the text shape, which has none.
- **FR-004**: Each side's connection point MUST lie on the shape's outline (the text shape uses its box); connectors MUST attach there.
- **FR-005**: Resizing MUST scale the geometry to the box and re-wrap the title, with a minimum size per shape; it MUST be one undo step.
- **FR-006**: Every card state in `DESIGN.md` MUST have its shape form, each with a non-colour cue; zoom levels MUST follow the `DESIGN.md` table (Landscape: geometry only); the size MUST NOT change with zoom.

**Two forms**

- **FR-007**: Decision, database and document MUST offer "Show as shape" / "Show as card" in the toolbar, the context menu and the drawer; switching MUST keep every stored property except the form and be one undo step, also for several objects at once ("Mixed" when forms differ).
- **FR-008**: In shape form, the drawer MUST still edit the description, fields and tags.

**Frame tool, sticky and text**

- **FR-009**: The Frame tile MUST draw an empty group frame by dragging (or place a default-size one by click or ⏎), with its name field open; it MUST add every card and group fully inside the drawn rectangle, once, in the same undo step; it MUST be created in the current scope.
- **FR-010**: Empty groups MUST be valid, saved, exported and shown (count 0) and MUST NOT be removed automatically.
- **FR-011**: Moving a frame MUST NOT change membership; dropping into and out of frames MUST work as today.
- **FR-012**: The Add tile MUST be named "Frame" (tooltip "Draw a group frame"); every other place MUST keep the name "Group".
- **FR-013**: The Sticky tile MUST create the same sticky note as the rail's Sticky tool; the Text tile MUST create a text-only shape.

**Compatibility and integration**

- **FR-014**: New decks MUST have the Basic shapes pack on; decks saved before 031 MUST keep their packs and open unchanged, with no data added until the user changes something.
- **FR-015**: Shapes MUST work with selection, drag, snapping, alignment, copy / paste / duplicate, groups, connections, flows and playback, rules, search, views (hide / dim by type), export and the JSON panel, as cards do.
- **FR-016**: PNG and SVG export MUST draw shape geometry, colour, lip and title as on the canvas, without tilt or lift.
- **FR-017**: Shapes, the form switch and the Frame tool MUST be operable by keyboard with visible focus, expose a role and name (title plus shape type, for example "Payment OK?, diamond") to assistive technology, and announce adds and switches.
- **FR-018**: No part of this feature MUST make a network call.

### Key Entities

- **Shape type**: a card type of the shape family (030 registry) with a geometry: rectangle, rounded rectangle, ellipse, diamond, pill, cylinder, document, parallelogram, hexagon, actor, text.
- **In-between type**: decision, database or document; a card type that can also draw as a shape.
- **Form**: whether an in-between object draws as a card or a shape; stored per object, absent = its type's own family.
- **Frame**: the Add tile's name for drawing a group frame; the object is a group (016 / ADR 0017).
- **Sticky note**: the existing sticky (009), offered from the Shapes tab too.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can build a five-step process (pill, rectangle, diamond, cylinder, pill, connected) in under 60 seconds from opening Add.
- **SC-002**: For every shape, connectors attach on the outline: the distance between each connection point and the outline is under 1 px at 100 % zoom, in 100 % of the shapes and sides tried.
- **SC-003**: Switching an in-between object to a shape and back keeps 100 % of its stored properties (compared field by field).
- **SC-004**: A user can draw an empty frame and drop three cards into it in under 15 seconds; drawing a frame around existing cards adds exactly the cards fully inside in 100 % of cases tried.
- **SC-005**: 100 % of decks saved before 031 open looking the same and save with no data added.
- **SC-006**: Shape titles reach at least 4.5:1 contrast on every named fill in both themes.
- **SC-007**: Adding a shape, switching a form and drawing a frame can each be done with the keyboard alone.
- **SC-008**: On the 500-card benchmark deck with a third of the objects as shapes, panning and dragging stay within the existing canvas targets.

## Assumptions

- 030 is built first: shape types are entries of its registry (`family: 'shape'`, pack `shapes`, category Shapes), Add's Shapes tab is its tab, and the new-deck pack list gains Basic shapes here.
- The stored form follows ADR 0022 (`node.display`), written only when it differs from the type's own family; no version bump (§g-81). The Sticky and Frame tiles store nothing new (they create a sticky and a group).
- Empty groups need no format change (a group's membership comes from its members); the plan checks that no code path deletes or skips a group with no members.
- Shape geometry, default and minimum sizes, the lip rule per shape and title boxes follow frame 120 and `DESIGN.md`; the plan lists them per shape.
- Connector rules, flows, rules and stickies do not change behaviour; they treat shapes as cards.
- Real-time collaboration is out of scope; the document stays collaboration-ready (036).
