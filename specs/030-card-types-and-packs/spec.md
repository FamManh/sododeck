# Feature Specification: Card Types and Packs

**Feature Branch**: `030-card-types-and-packs`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "30 from docs/backlog.md": card types become data, grouped in packs a deck turns on and off; an Add flyout with search, category tabs and sections; everything that depends on today's six kinds reads the type list instead.

**Sources**: `docs/backlog.md` §030 (scope, schema, out of scope, acceptance criteria), §024 (superseded; its list of places where kinds are hard-coded), §031 and §032 (which build on 030); `docs/decisions/0022-schema-roadmap.md` "Card types and packs (030, 031)" (`node.type` becomes a type id, root `packs`, views' kind lists take type ids, types and packs defined by the app not the file, unknown type ids render as a generic card and are reported); `docs/design/design-analysis.md` frame 127 "Type palette" (Add flyout and "Packs in this deck"), frame 120 "Sample set" (warehouse, truck route, task, issue cards), §g-61 D1 / D10 (five category packs, data-driven types), §g-77 (packs beyond D1 only illustrate the list); `DESIGN.md` "Card system (Deck)" and the left rail; constitution v1.0.0.

**Dependency note**: 029 (Deck card) is merged. 031 (shapes) and 032 (typed fields) depend on this feature; 032's spec is on hold until this one is specified (founder, 2026-10-03).

## Scope

**In scope**

- **A list of card types defined by the app**, each with a stable id, a name, an icon, a category and a family (card or shape). This feature ships four packs of card-family types:
  - **Architecture** (7): Service, Database, API gateway, Client, Queue, External (today's six kinds, same ids) and Component (new).
  - **Process** (3): Task, Decision, Document.
  - **Logistics** (2): Warehouse, Truck route.
  - **Data cards** (1): Issue.
- **Packs per deck**, on or off. Turning a pack off hides its types from Add and from the type picker; cards of that type already on the board keep rendering and stay editable.
- **Add flyout** from the left rail (frame 127): search (focus with `/`), category tabs (All · Architecture · Process · Logistics · Data), one section per category with a count and 3-column tiles, a "Packs · N on" footer that opens "Packs in this deck" with on / off switches and type counts.
- **Changing a card's type** from the toolbar and drawer, listing the types of the packs that are on (plus the card's current type).
- **Everything that depends on the kind today reads the type list**: card header icon and type name, Add, the type picker, views' hidden and dimmed kinds, search, export icons, the deck library thumbnail, problems.
- Older decks open unchanged; a type id the app does not know still loads, draws as a generic card and is reported.

**Out of scope**

- **Basic shapes pack and the Shapes tab** (founder, 2026-10-03): they need real geometry and come with 031. The start / end and actor types listed in the backlog's Process pack are shapes and also come with 031.
- User-defined types, a pack marketplace, packs beyond the four above (C4 model, BPMN, cloud packs in frame 127 illustrate the list only, §g-77).
- Typed fields per type (032): the type list leaves room for each type's default fields, filled by 032.
- Connection rules per type (today's rules do not depend on kind).
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from backlog §030 and ADR 0022 are taken as decided: types and packs are defined by the app; `node.type` holds a type id; the deck stores which packs are on; today's six kinds are the Architecture pack's ids unchanged; unknown type ids load, draw generic and are reported; renaming a type's label never changes its id.
- Q: Does 030 include the Basic shapes pack? → A (founder): **no, it comes with 031.** 030 ships Architecture, Process, Logistics and Data cards; the Shapes tab and pack appear when 031 lands.
- Q: Which packs are on in a new deck? → A (founder): **every pack 030 ships** (Architecture, Process, Logistics, Data cards). A deck saved before 030 stays Architecture only. Whether Basic shapes is on by default in new decks is decided with 031.
- Q: What do the number keys do in the Add flyout now that there are more than six types? → A (default, extends 018): keys 1–9 add the first nine tiles visible in the current tab and search, in order; tiles show their number.
- Q: Can a card change to a type whose pack is off? → A (default): no; the picker lists the types of packs that are on, plus the card's current type so the current value is always shown.
- Q: Does the UI label "Kind" become "Type"? → A (founder, clarify): **yes, everywhere.** Toolbar, drawer, bulk drawer, menus and view settings say "Type" ("Hide types", "Dim types"); no UI copy says "kind" any more. The stored field already is `type`, so no data changes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Add a card of any type from the Add flyout (Priority: P1)

A user models a fulfilment process. They open Add from the rail, press `/`, type "ware", and add a Warehouse. They switch to the Process tab and drag a Task onto the board.

**Why this priority**: The point of the feature is that users can model more than software architecture. Without Add listing the new types, nothing else is visible.

**Independent Test**: In a new deck, add one card of each of the 13 types by click, ⏎, drag and number key; search by name; check each card shows the right icon and type name.

**Acceptance Scenarios**:

1. **Given** a new deck, **When** the user opens Add, **Then** the flyout shows a search field, the tabs All · Architecture · Process · Logistics · Data, and sections Architecture (7), Process (3), Logistics (2), Data (1) of 3-column tiles with icon and name, and a "Packs · 4 on" footer.
2. **Given** the flyout is open, **When** the user presses `/` and types "ware", **Then** only matching types show (by name, case ignored), sections with no match are hidden, and ⏎ adds the first match at the centre of the view.
3. **Given** a tab is chosen, **When** the user clicks a tile, presses ⏎ on it, drags it onto the canvas, or presses its number key (1–9), **Then** a card of that type is added (at the centre, or where dropped) and its title is ready to edit, as today.
4. **Given** a card of a new type (for example Warehouse), **When** it is drawn, **Then** its header shows that type's icon and name, at every zoom level where the header is shown, in light and dark themes.
5. **Given** a deck saved before this feature, **When** the user opens Add, **Then** only the Architecture section shows (its pack is the only one on) and the footer reads "Packs · 1 on".

---

### User Story 2 - Turn packs on and off per deck (Priority: P1)

A user working on an architecture deck opens "Packs in this deck" from the Add footer, turns Logistics on, and adds a Warehouse. Later they turn Logistics off: Warehouse disappears from Add, but the warehouse card on the board stays as it is.

**Why this priority**: Packs keep Add short and focused per deck; they are the mechanism the founder chose (§g-61 D1).

**Independent Test**: Toggle each pack in a deck that holds cards of that pack, check Add, the type picker and the board; undo each toggle.

**Acceptance Scenarios**:

1. **Given** "Packs in this deck", **When** it opens, **Then** it lists Architecture, Process, Logistics and Data cards, each with its type count and an On / Off switch, and the note "Turning a pack off hides its types from Add. Cards already on the board keep rendering."
2. **Given** Logistics is off, **When** the user turns it on, **Then** Add lists Warehouse and Truck route, the footer count rises by one, and one undo step turns it off again.
3. **Given** Logistics is on and the board holds a Warehouse card, **When** the user turns Logistics off, **Then** Warehouse and Truck route leave Add and the type picker, and the card still renders, can be selected, edited, moved, connected, exported and found by search.
4. **Given** only one pack is on, **When** the user tries to turn it off, **Then** the switch is disabled with the reason "At least one pack stays on".
5. **Given** a pack change, **When** the deck is saved, reopened, exported or imported, **Then** the same packs are on.

---

### User Story 3 - Change a card's type (Priority: P2)

A user added a Service by mistake; they change it to a Queue from the toolbar's type control. Later they change a Task to a Decision from the drawer.

**Why this priority**: Users already change kinds today; with more types, the picker must list them by category and respect packs.

**Independent Test**: Change the type of single and multiple cards from the toolbar and the drawer; check id, title, connections, colour and position stay; undo.

**Acceptance Scenarios**:

1. **Given** a selected card, **When** the user opens the type control, **Then** it lists the types of the packs that are on, grouped by category, with a filter field, and marks the current type.
2. **Given** a card, **When** the user picks another type, **Then** the header icon and name change, and the card keeps its id, title, description, tags, colour, size, position and connections; one undo step reverts it.
3. **Given** three selected cards of different types, **When** the user picks a type, **Then** all three change in one undo step; the control reads "Mixed" before the pick.
4. **Given** a card whose type belongs to a pack that is off, **When** the type control opens, **Then** that current type is still listed and marked, and the other types of that pack are not.

---

### User Story 4 - Views, search, export and the library follow the types (Priority: P2)

A user hides Warehouse cards in a view, searches "truck" to find truck routes, exports the board to SVG, and sees the deck's thumbnail in the library.

**Why this priority**: Every place that knew the six kinds must know every type, or new cards would vanish or show the wrong icon there.

**Independent Test**: With cards of every type, check view settings, search, PNG / SVG export and the library thumbnail.

**Acceptance Scenarios**:

1. **Given** view settings, **When** the user opens the hide / dim lists, **Then** they list the types in use in the deck plus the types of packs that are on, by category; hiding Warehouse hides every warehouse card in that view.
2. **Given** a search for a type name (for example "truck route"), **When** results show, **Then** cards of that type are found, as kinds are today.
3. **Given** an export to PNG or SVG, **When** cards of every type are drawn, **Then** each shows its own icon and type name.
4. **Given** the deck library, **When** a deck holds new types, **Then** its thumbnail draws them with the right icon or a neutral mark, never an error.

---

### User Story 5 - Older and unknown types keep working (Priority: P1)

A deck saved before this feature opens and looks exactly the same. A file made by a newer version that uses a type this version does not know still opens; those cards draw as generic cards and Problems lists them.

**Why this priority**: Protects every existing deck (constitution II) and keeps files from newer versions usable.

**Independent Test**: Open a deck saved before 030 and compare it; import a file with an unknown type id; export both.

**Acceptance Scenarios**:

1. **Given** a deck saved before this feature, **When** it is opened, edited elsewhere and exported, **Then** every card looks the same, Architecture is the only pack on, and the file gains no pack data.
2. **Given** a file with a card whose type id is unknown, **When** it is opened, **Then** the deck loads, the card draws as a generic card with its id shown as the type name and a neutral icon, and Problems reports "Unknown card type <id>" for it.
3. **Given** a card of an unknown type, **When** the deck is saved and exported, **Then** its type id is kept unchanged.
4. **Given** a type whose display name changes in a later version, **When** an older deck is opened, **Then** its cards keep their type (ids never change with names).

---

### Edge Cases

- A search that matches nothing: the flyout shows "No types match" and ⏎ does nothing.
- The flyout open while the user turns a pack off: tiles of that pack disappear at once; focus moves to the next tile.
- A pack turned off while one of its cards is selected: the card stays selected and its drawer still shows its type.
- A view that hides a type whose pack is off: the setting is kept and still applies.
- Two tabs changing packs at the same time: the document stays valid; each pack's on / off is its own value, last write wins (036).
- Undo of a pack toggle restores the exact previous list.
- Cards of the new Component type and the zoom level named "component" are unrelated; the type name is shown as "Component" in the header only.
- Pasting cards of a type whose pack is off into a deck: the cards are pasted with their type; the pack is not turned on automatically.
- A deck with every pack on and 13 types: the flyout scrolls; the search field and tabs stay visible.
- Read-only states (narrow window, flow playback): Add is unavailable as today.

## Requirements _(mandatory)_

### Functional Requirements

**Types and packs**

- **FR-001**: The app MUST define card types, each with a stable id, a display name, an icon, a category, a family (card or shape) and the pack it belongs to; this feature MUST ship the 13 card-family types of the four packs listed in Scope.
- **FR-002**: Today's six kinds MUST be the ids of six Architecture types, so a card's stored type never changes because of this feature.
- **FR-003**: A deck MUST record which packs are on; a deck saved before this feature MUST read as Architecture only and MUST be written without pack data until the user changes packs; a new deck MUST start with every pack of this feature on.
- **FR-004**: At least one pack MUST stay on.
- **FR-005**: Turning a pack off MUST hide its types from Add and from the type picker and MUST NOT change, hide or restrict existing cards of those types.

**Add flyout**

- **FR-006**: The Add flyout MUST show a search field (focused by `/`), the category tabs of the packs that are on (All first), one section per category with a type count, tiles with icon and name, and a "Packs · N on" footer that opens "Packs in this deck".
- **FR-007**: Search MUST filter types by name ignoring case and hide empty sections; ⏎ MUST add the first match.
- **FR-008**: A type MUST be addable by click, ⏎, drag onto the canvas, or its number key (1–9 for the first nine visible tiles); the new card's title MUST be ready to edit, as today.
- **FR-009**: "Packs in this deck" MUST list each pack with its type count and an On / Off switch, and the note about existing cards; each toggle MUST be one undo step.

**Type changes and other places**

- **FR-010**: Users MUST be able to change the type of one or more cards from the toolbar and the drawer; the picker MUST group types by category, filter by name, show "Mixed" for differing selections, and list only the types of packs that are on plus each card's current type. A change MUST keep every other property of the card and be one undo step.
- **FR-011**: Card headers, the canvas at every zoom level, view hide / dim settings, search, PNG / SVG export and the library thumbnail MUST show every type's own icon and name.
- **FR-012**: View hide / dim lists MUST offer the types in use plus the types of packs that are on.
- **FR-012a**: Every UI label, menu item, tooltip and announcement that says "Kind" today MUST say "Type" (for example "Type" in the toolbar and drawer, "Hide types" and "Dim types" in view settings).

**Compatibility and integrity**

- **FR-013**: A card whose type id is unknown MUST load, draw as a generic card (neutral icon, its id as the type name), keep its id on save and export, and be reported in Problems.
- **FR-014**: Pack choices MUST survive save, reload, export and import, and MUST appear in the JSON panel in sync with the canvas.
- **FR-015**: Renaming a type's display name in a later version MUST NOT change any stored data.
- **FR-016**: The flyout, packs panel and type picker MUST be fully operable by keyboard with visible focus (tabs as a tab list, tiles as a grid, switches named by pack), expose roles and names to assistive technology, and announce added cards and pack changes.
- **FR-017**: No part of this feature MUST make a network call; all icons are bundled.

### Key Entities

- **Card type**: a kind of card the app knows: stable id, display name, icon, category, family (card or shape), pack. Defined by the app, not stored in the deck. Room for default fields (032) and shape geometry (031).
- **Pack**: a named group of card types (Architecture, Process, Logistics, Data cards; Basic shapes with 031) with a type count. Defined by the app.
- **Deck pack choice**: which packs are on in one deck; stored with the deck; absent means Architecture only.
- **Card's type**: the type id stored on each card (today's "kind" field, same values for existing cards).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can find and add any of the 13 types in under 5 seconds from opening Add, by search or by tab.
- **SC-002**: 100 % of decks saved before this feature open looking the same (card icons, names, sizes, positions) and save with no pack data added.
- **SC-003**: Turning a pack off leaves 100 % of that pack's existing cards visible, editable and exportable.
- **SC-004**: A file with unknown type ids opens in 100 % of cases tried, with every such card reported in Problems and its type id kept on export.
- **SC-005**: Every type shows its own icon and name in the card header, the type picker, view settings, search results, PNG / SVG export and the library thumbnail (13 of 13).
- **SC-006**: The whole flow (open Add, search, switch tab, add, open packs, toggle a pack, change a card's type) can be done with the keyboard alone.
- **SC-007**: On the 500-card benchmark deck with a mix of all 13 types, panning and dragging stay within the existing canvas targets (no drop beyond run-to-run variation).

## Assumptions

- The stored shape follows ADR 0022 "Card types and packs (030, 031)": the card's type field keeps its name and becomes an open set of ids; a root list of pack ids (absent = Architecture only); views' kind lists take type ids. The ADR row is confirmed or refined by this feature, with a new ADR for the type registry (backlog: "change + ADR (024's options A / B)"). No version bump (§g-81).
- New decks store their pack list; Basic shapes joins the default list when 031 lands (decided there).
- Icons come from the bundled icon set (`DESIGN.md`: icons from one library); frame 127 shows the intended icons; `DESIGN.md` wins where they differ.
- New types draw as Deck cards (029) with no special colour; a type does not set a card colour.
- Connection rules, zoom levels, flows, rules and stickies do not change.
- The flyout keeps today's Add behaviour (adding at the view centre, drag to place, title ready to edit, unavailable in read-only states).
- Real-time collaboration is out of scope; the document stays collaboration-ready (036).
