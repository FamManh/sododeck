# Feature Specification: Database Architecture Link

**Feature Branch**: `049-db-architecture-link`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "049 from docs/backlog-database.md" — The schema and the architecture become one model: a database card shows "n tables inside" and opens "Inside <card>"; tables created inside belong to the card; foreign keys to tables in another database card show as dashed outside proxies; the deck's dialect shows on every database card; "Export SQL" from a database card writes its tables only; flow steps can list the tables and columns they read or write, lit during playback at both levels; three samples (Shop, SaaS auth, Blog).

**Sources**: `docs/backlog-database.md` §049 (scope, draft acceptance criteria, founder decision 2026-10-03: architecture flows only), §040 (table `parent`, dialect), §041 (table card), §042 (relationships), §043 (editing), §045 (SQL export), founder decision DB11 (one dialect per deck); `specs/034-connection-focus-and-drill/` (drill-in, outside proxies), `specs/035-flow-playback-deck/` and `specs/007-flow-playback/` (step player, flow chip), `specs/030-card-types-and-packs/` (Database card kind); constitution v1.0.0.

**Dependency note**: 034, 040–046 and 048 are merged or specified. Samples (013) is held until the end; the three samples here are authored as data and can ship before or after the 013 gallery.

## Scope

**In scope**

- **Tables inside a database card**: a database card shows "n tables inside"; Enter or double-click opens "Inside <card>"; a table created while inside belongs to that card; moving a table to another database card changes its owner.
- **Cross-database relationships**: a foreign key to a table in another database card draws as a dashed outside proxy named after that table; double-clicking the proxy goes to the real table.
- **Dialect chip**: the deck's dialect (DB11) shows as a chip on every database card.
- **Export SQL from a database card**: writes only that card's tables, in the deck's dialect; for a Generic deck it asks which dialect.
- **Flow steps that touch tables**: a step can list tables, and optionally columns, it reads or writes. At architecture level the database card shows a chip such as "writes orders +1" on the current step. Drilled into the database, every table the step touches is lit as the current step, touched columns are highlighted (reads and writes tell apart without colour), and the step player and flow chip stay on screen so the user can keep stepping.
- **Samples**: "Shop" (architecture + schema + a Checkout flow), "SaaS auth" and "Blog".
- Keyboard and screen-reader support for every new control; light and dark themes; English UI copy.

**Out of scope**

- Flows drawn between tables (founder, 2026-10-03: architecture flows only).
- Importing a schema into a chosen database card beyond what 044 already does; new import formats.
- Per-card dialects (one dialect per deck, DB11) and any change to type conversion.
- Lint rules, lineage, sample rows, SQL views (backlog "Later").
- The sample gallery and onboarding tour (013); this feature only supplies the three decks.
- Any network call; samples ship inside the app.

## Clarifications

### Session 2026-10-04

- Q: Can a table belong to no database card? → A: Yes. Tables on the top-level canvas without an owner keep working exactly as today.
- Q: Can a table belong to two database cards? → A: No. One owner at most; moving it changes the owner.
- Q: Do flow steps add arrows between tables? → A: No. A step only lists the tables and columns it touches; flows stay between architecture cards.
- Q: When a table is deleted or renamed, what happens to steps that list it? → A: A rename changes nothing (references are by id). A delete removes it from the step's list and the step keeps working.
- Q: Where does the author attach the tables and columns a step reads or writes? → A: A "Touches" section in the step's inspector: a search field to pick a table (then optionally a column), and a Read / Write toggle on every row. No separate canvas shortcut in this feature.
- Q: How does the user move a table to another database card? → A: A "Move to database…" action in the table's context menu and inspector, listing the deck's database cards, plus "Remove from card". No drag-and-drop between cards in this feature.
- Q: At architecture level, how does playback show a step that touches a table with no owner, or a table whose card sits in a collapsed group? → A: An unowned table is only named in the step player (no chip, there is no card to light). A card inside a collapsed group merges its chip onto the group's stacked card.
- Q: What happens to the tables inside a database card when the card is deleted? → A: The user confirms; the card is removed and its tables are kept, becoming unowned (shown on the level above). Undo restores the card and the ownership in one step.
- Q: Do lit tables and chips still show for a locked table, or a table hidden by a filtered view (048)? → A: Locking never affects playback. A table hidden by the view's filter is not drawn, but the step player says "also touches: <table> (hidden in this view)"; the saved filter is never changed.
- Q: Does "Export SQL" from a card include foreign keys to tables owned by another card? → A: No statements for the other card's tables; the foreign key is written as a comment noting the external table, so the output runs on its own.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a database card and work on its tables (Priority: P1)

An architect has an "Orders DB" card on the architecture board. The card says "12 tables inside". They press Enter, the canvas shows "Inside Orders DB" with its 12 tables and relationships, and they add a new `refunds` table. Leaving the drill-in, the card now says "13 tables inside". The card also shows a "Postgres" chip.

**Why this priority**: it is the link itself; without it schema and architecture stay two separate boards.

**Independent Test**: on a deck with one database card and a few tables, drill in, add a table, leave, and read the count and chip.

**Acceptance Scenarios**:

1. **Given** a database card with 12 tables, **When** drawn, **Then** it shows "12 tables inside" and the dialect chip; a card with none shows "No tables yet".
2. **Given** the card, **When** the user presses Enter or double-clicks it, **Then** the canvas shows "Inside Orders DB" with only its tables and the relationships between them.
3. **Given** the drill-in is open, **When** the user creates a table, **Then** it belongs to this card and the count updates when the drill-in closes.
4. **Given** a table inside Orders DB, **When** the user chooses "Move to database…" from its context menu or inspector and picks another database card, **Then** it leaves the first card (count −1) and appears in the other (count +1), keeping its columns and relationships.
5. **Given** a deck with a dialect set, **When** any database card is drawn, **Then** the chip shows that dialect; changing the dialect updates every chip.
6. **Given** the user presses undo after creating or moving a table, **Then** ownership and counts return to the earlier state in one step.

---

### User Story 2 - See relationships that cross databases (Priority: P1)

`orders.customer_id` points to `customers.id`, which lives in "Customers DB". Inside Orders DB the user sees a dashed outside proxy "customers" with the relationship drawn to it. Double-clicking the proxy leaves the drill-in and selects the real table. Moving `customers` into Orders DB turns the proxy into a normal connector.

**Why this priority**: it shows where data dependencies leave a database, which is the architectural point of linking the two models.

**Independent Test**: build two database cards with one foreign key across them; check the proxy, jump, and the effect of moving a table.

**Acceptance Scenarios**:

1. **Given** a foreign key to a table owned by another card, **When** drilled into the first card, **Then** it ends on a dashed outside proxy named after the other table.
2. **Given** an outside proxy, **When** the user double-clicks it or presses Enter, **Then** the drill-in closes to the level that contains the other card and the real table is selected and in view.
3. **Given** two tables joined by a foreign key, **When** the user moves one to another database card, **Then** the relationship becomes a proxy relationship on both sides; moving it back restores the plain connector.
4. **Given** a table with no owner and a foreign key to a table inside a card, **When** drilled into that card, **Then** the unowned table shows as an outside proxy too.

---

### User Story 3 - Play a flow and watch it touch the database (Priority: P1)

The "Checkout" flow has a step "Create order" that writes `orders` and `order_items` and reads `customers.email`. At architecture level, playing the step lights the Orders DB card with a chip "writes orders +1". The user drills into Orders DB, still on that step: `orders` and `order_items` are lit as current, the touched column rows are highlighted with a write or read marker, and the step player and flow chip are still on screen. Pressing Next inside the database moves to the next step.

**Why this priority**: it is the founder's headline use case: showing what a flow does to data.

**Independent Test**: author a step that lists two tables and one column, play it at architecture level, drill in, and step forward.

**Acceptance Scenarios**:

1. **Given** a step selected in the flow inspector, **When** the author opens its "Touches" section, searches for a table (and optionally one of its columns) and adds it, **Then** a row appears with a Read / Write toggle that the author can flip or remove, and the list is kept with the step and survives export and import.
2. **Given** playback is on a step that touches tables in Orders DB, **When** viewed at architecture level, **Then** the Orders DB card shows a chip summarising the first touch and a count of the rest ("writes orders +1").
3. **Given** the same step, **When** the user drills into Orders DB, **Then** every touched table is lit as the current step and the touched column rows are highlighted; a read marker and a write marker differ in shape or label, not only in colour.
4. **Given** a touched column cut by the row limit (048), **When** drawn, **Then** the row is still shown, so a touched column is never hidden.
5. **Given** the user is drilled in, **When** they press Next or Previous, **Then** playback advances, the player and flow chip stay visible, and the lit tables follow the new step.
6. **Given** a step whose tables live in a different database card than the one drilled into, **Then** nothing is lit inside this card and the step's other card is named in the player ("also touches Customers DB").
7. **Given** a table that is deleted, **When** a step listed it, **Then** it disappears from the list and playback still works; a rename changes nothing.
8. **Given** a step with no table list, **Then** playback is exactly as before this feature.

---

### User Story 4 - Export one database as SQL (Priority: P2)

From the "Orders DB" card the user chooses "Export SQL". The output holds only Orders DB's tables, in the deck's dialect. In a Generic deck, the user is first asked which dialect to use.

**Why this priority**: a team that owns one database wants its own script; useful but not blocking.

**Independent Test**: export from a card in a Postgres deck and in a Generic deck; compare tables and dialect.

**Acceptance Scenarios**:

1. **Given** a card with 12 tables, **When** the user chooses Export SQL, **Then** the file holds exactly those 12 tables, their keys and indexes, in the deck's dialect.
2. **Given** a Generic deck, **When** the user chooses Export SQL, **Then** a dialect choice appears first; cancelling writes nothing.
3. **Given** a foreign key to a table in another card, **When** exported, **Then** no statement is written for the other table and the foreign key appears as a comment naming it.
4. **Given** a card with no tables, **Then** the action is disabled with a reason.

---

### User Story 5 - Start from a Shop, SaaS auth or Blog sample (Priority: P3)

A new user opens the "Shop" sample and sees an architecture board with a Storefront, an Orders service, and Orders DB and Customers DB cards. Drilling in shows real schemas, and the "Checkout" flow plays through them as in story 3. "SaaS auth" and "Blog" are smaller decks with one database card each.

**Why this priority**: samples teach the feature and double as test fixtures, but the feature works without them.

**Independent Test**: open each sample, check it validates, drill into a database card, and play its flow.

**Acceptance Scenarios**:

1. **Given** the Shop sample, **When** opened, **Then** it has at least two database cards with tables inside, one cross-database foreign key, and a "Checkout" flow with steps that touch tables.
2. **Given** each sample, **When** loaded, **Then** it passes the same validation as an imported file and works offline.
3. **Given** the SaaS auth and Blog samples, **Then** each has a database card with its schema and, for SaaS auth, a sign-up flow touching tables.
4. **Given** the sample set, **Then** no sample names another diagram or database product.

---

### Edge Cases

- A database card collapsed inside a group: its count still shows on the collapsed stack; playback chips merge into the stack's chip.
- A step touches a table owned by no card: at architecture level nothing lights and no chip shows; the step player names the table.
- A step touches tables in two database cards: both cards show their own chip; drilling into either lights only its own tables.
- A table is moved while a flow is playing: the lit state follows the table's new owner on the next frame.
- A deck with no database cards: nothing changes.
- A database card with tables is deleted: the user confirms with the table count shown; the tables stay in the deck as unowned, and their relationships and step touches are kept.
- A table inside a card cannot be dragged out of the drill-in; it leaves the card only through "Remove from card" or "Move to database…" (undoable).
- A foreign key where both tables belong to the same card: normal connector, no proxy.
- Self-referencing foreign key: normal connector.
- Locked table touched by a step: it lights; locking is only about editing.
- A touched table is hidden by the current view's filter: it is not drawn and the saved filter is not changed; the step player names it as "hidden in this view".
- A very large step (30 tables): the chip shows "writes orders +29" and the drill-in lists them all without scrolling the card.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A database card MUST show the number of tables it owns ("n tables inside", "No tables yet" when none) and the deck's dialect as a chip.
- **FR-002**: Users MUST be able to open a database card (Enter or double-click) to see "Inside <card>" with its tables and the relationships between them.
- **FR-003**: A table created while a database card is open MUST belong to that card; a table MUST belong to at most one card.
- **FR-004**: Users MUST be able to move a table to another database card ("Move to database…" in the table's context menu and inspector, listing the deck's database cards) or remove it from its card ("Remove from card"); both MUST be keyboard reachable, keep columns and relationships, and be one undo step.
- **FR-004a**: Deleting a database card that owns tables MUST ask for confirmation showing the table count, keep every table (now unowned) with its relationships and step touches, and be one undo step that restores the card and its ownership.
- **FR-005**: A foreign key between tables with different owners (or an owner and none) MUST draw as a dashed outside proxy named after the other table when drilled into either side; opening the proxy MUST select the real table in view.
- **FR-006**: The dialect chip MUST update on every database card when the deck's dialect changes.
- **FR-007**: A database card MUST offer "Export SQL" that writes only its own tables, in the deck's dialect, asking for a dialect first when the deck is Generic; foreign keys to tables outside the card MUST be written as comments.
- **FR-008**: A flow step MUST be able to list tables and, optionally, columns of those tables, each marked as read or write, edited in a "Touches" section of the step inspector (searchable picker, Read / Write toggle per row, remove per row, keyboard reachable); the list MUST be kept in the deck file, by id, and survive export, import and renames.
- **FR-009**: Deleting a table or column MUST remove it from every step's list without breaking playback.
- **FR-010**: At architecture level, a database card owning a table touched by the current step MUST show a chip with the first touch and a count of the others (for example "writes orders +1"). A table with no owner MUST be named in the step player instead; a card inside a collapsed group MUST merge its chip onto the group's stacked card.
- **FR-011**: Drilled into a database card, every table touched by the current step MUST be lit as the current step and touched columns MUST be highlighted; reads and writes MUST be distinguishable without colour (marker shape or label), and touched columns MUST NOT be hidden by the row limit. A touched table hidden by a view filter MUST be named in the step player as hidden in this view, without changing the filter; locking MUST NOT affect lighting.
- **FR-012**: While drilled in, the step player and flow chip MUST stay on screen and Next / Previous MUST advance playback and update the lit tables.
- **FR-013**: Steps with no table list MUST play exactly as before; flows MUST NOT gain table-to-table steps.
- **FR-014**: Ownership MUST be an id reference, never derived from a title; renaming a card or table MUST NOT change ownership or step lists.
- **FR-015**: The deck file, JSON and Mermaid/SQL/DBML exports MUST include every table regardless of owner; round-trip from file to document to file MUST be lossless for owners and step lists.
- **FR-016**: The three samples (Shop, SaaS auth, Blog) MUST ship inside the app, load offline, pass the same validation as an imported file, and MUST NOT name other diagram or database products.
- **FR-017**: Every new control MUST be reachable by keyboard and have an accessible name; chips and markers MUST work in light and dark themes.
- **FR-018**: No deck content MUST leave the browser at any point in this feature.

### Key Entities

- **Database card**: an architecture card of kind Database; owns zero or more tables; shows a table count and the deck's dialect.
- **Table owner**: the link from a table to at most one database card, by id.
- **Outside proxy**: a dashed stand-in for a table owned elsewhere, shown when drilled into a card.
- **Table touch**: an entry on a flow step naming a table, optional columns, and whether it reads or writes.
- **Flow step**: existing step; gains an optional list of table touches.
- **Sample deck**: a bundled deck (Shop, SaaS auth, Blog) with architecture, schema and a flow.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Playing the "Checkout" step "Create order → writes orders" and drilling into Orders DB lights `orders` and its touched columns, with no extra steps beyond opening the card.
- **SC-002**: Moving a table to another database card turns each of its cross-database foreign keys into outside proxies, and moving it back restores them, in 100 % of tested cases.
- **SC-003**: A user can go from architecture view to the lit tables of the current step in one keypress or double-click, and keep stepping without leaving the drill-in.
- **SC-004**: Exporting SQL from a database card contains 100 % of that card's tables and none of any other card's tables.
- **SC-005**: Reads and writes on a highlighted column are told apart by a user who sees the deck in greyscale.
- **SC-006**: Each sample opens in under 2 seconds on a typical laptop and plays its flow end to end without errors.
- **SC-007**: A deck with no database cards or no touches behaves identically to before this feature (existing decks load and play unchanged).

## Assumptions

- Table ownership uses the `parent` field that 040 already reserves; no new file-format version is needed, but the step's table list is a new optional field that needs a decision recorded in the plan.
- "n tables inside" counts tables owned by the card, not nested sub-cards.
- The chip on a card shows only the first touch, in step order, then "+n" for the rest.
- Reads and writes use a short label ("R" / "W" or similar) with distinct marker shapes; the final look follows the design system.
- Sample decks are small (Shop about 10 tables across two databases, SaaS auth and Blog about 5 each) so they load instantly and fit a screen when drilled in.
- Drag-and-drop of a table between database cards is not part of this feature.
- Adding a touch from the canvas (for example an "Add to current step" button while drilled in) is not part of this feature.
- Playback behaviour for flows between architecture cards (007, 035) is already merged and is reused unchanged.
- Samples can be added to the gallery by 013 later; until then they are reachable the same way existing bundled samples are.
