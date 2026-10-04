# Feature Specification: Table Relationships

**Feature Branch**: `042-db-relationships`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "42 from docs/backlog-database.md" — Relationships connect columns, show cardinality in crow's foot notation, and are created by dragging: a port on each column row, crow's foot ends on curved, elbow and straight lines, drag from a column to a column (type-mismatch warning but still connects), self-reference loop, two foreign keys between the same tables, optional label on hover / selection, relationship colour, hovering a column lights its relationships and dims the rest, hidden columns anchor on the table edge or the "+n" pill.

**Sources**: `docs/backlog-database.md` §042 (scope, draft acceptance criteria), §041 (table card this feature draws on), §043 (relationship drawer, Deck settings Database section), §047 (lint), §048 (row limit, Show all); founder decisions DB3, DB7, DB8, DB9, DB10; `specs/040-db-schema-model/` (relationship fields `fromColumns` / `toColumns` paired by position, `cardinality` read from → to, `fromOptional` / `toOptional`, `onDelete` / `onUpdate`; label and colour reuse the connector's fields); `specs/041-db-table-card/` (spec and clarify 2026-10-04: column rows 24 tall, detail levels, foreign-key glyph rule, its Assumptions handing relationship display and its Deck settings switches to 042); `specs/034-connection-focus-and-drill/` (hover focus, ×n bundles); `specs/050-connector-editing/` (end handles, reconnect, groups as endpoints); DESIGN.md "Database pack" > "Crow's foot and ports" and "Table zoom levels"; design-analysis §a frames 136, 149, 152, 158, 159, 162; constitution v1.0.0.

**Dependency note (2026-10-04)**: 017, 029 and 034 are merged. 040 (model) is merged. **041 (table card) is specified, planned and tasked but is being implemented in another worktree**, and **050 (connector editing) is specified and being implemented in parallel**. 042 can be specified and planned now; its implementation starts after 041 is merged and must build on 050's connector end handling when 050 lands first (see Assumptions).

## Scope

**In scope**

- **Column ports**: a relationship whose ends name columns attaches to the exact column row at both ends, on the left or right side of the table, at the row's centre (DB8).
- **Crow's foot ends**: exactly one, zero or one, one or many, zero or many, derived from the stored cardinality and optional sides, drawn in the connector's own stroke on curved, elbow and straight lines.
- **Composite keys**: one connector per relationship; each member row gets a short stub and the stubs join in a bracket the connector leaves from.
- **Self-reference** (a table referencing itself) as a loop on one side; **two or more relationships between the same two tables** as separate lines, never bundled while rows are drawn.
- **Create by drag** from a column row to a column row, with the target row highlighted, a type-mismatch warning that still connects, and sensible default cardinality and optional sides.
- **Reconnect by drag**: dragging a relationship end onto another column row changes that end's column.
- **Highlight**: hovering or keyboard-focusing a column row lights its relationships, the rows at their other ends and those tables; the rest dims (034's focus look). Hovering or selecting a relationship lights its end rows.
- **Labels**: a relationship's label pill (its name, the on-delete action when set, the column list for composite keys, "n–n" for many-to-many), shown on hover or selection by default.
- **Relationship colour** and **line type** through the connector's existing colour and line type.
- **Hidden columns**: when an end column is not drawn (Names, Keys, zoom below 90 %, collapsed group), the connector anchors on the title row or the "+n columns" pill; at System and Landscape zoom relationships run table to table and bundle as "×n" (034).
- **Keys detail keeps connected rows**: at Keys, a table also shows every row that is a relationship end (amends 041's Keys rule, per DESIGN.md).
- **Deck settings "Show on relationships"**: cardinality ends (on / off), relationship labels (follow the Labels tool / hover / always / off) and notation (crow's foot or 1 / n text).
- **Export**: PNG and SVG draw relationships, ends, stubs and visible labels as on the canvas.
- **Format additions** (additive, on top of 040 and 041): the three relationship display settings on the deck.

**Out of scope**

- Editing relationship settings in a drawer or toolbar (cardinality picker, optional sides, on delete / on update, name, column ends as a list) and the relationship context menu items (043). 042 only creates, reconnects and deletes relationships on the canvas.
- Creating a composite relationship by dragging (043's drawer); 042 draws composite relationships that already exist.
- Schema lint problems (type mismatch, n–n without junction, composite length mismatch) in the Problems list (047); export of SQL / junction tables (045).
- Row limit, "Show all n columns" button and its anchor hot spot (048); until 048, the "+n columns" pill plays that role.
- Enum "used by" links (frame 165; no enum card exists, 040 / 041 clarify).
- R / W markers and flows touching columns (049); data lineage.

## Clarifications

### Session 2026-10-04

- Q: Who builds the relationship display settings in Deck settings (cardinality ends, labels, notation): 042 or 043? → A: 042 builds all three (Cardinality ends; Labels Follow Labels tool / Hover / Always / Off; Notation crow's foot or 1 / n) as optional deck-level fields; 043 builds only the dialect select and the rest of frame 152's Database section.
- Q: At Keys detail, does a table also show rows that are relationship ends but neither primary nor foreign key (e.g. a referenced unique column)? → A: Yes. Keys shows primary-key, foreign-key and every connected row; 042 amends 041's Keys rule (FR-005), and the 041 worktree is told so it can fold it in if still open.
- Q: What does a relationship created by dragging default to? → A: n–1 from the dragged column's table to the target's; the dragged (many) side optional (zero or many); the target side mandatory (exactly one), or optional (zero or one) when the dragged column is nullable.
- Q: Can a relationship's end be dragged onto another column row to change it? → A: Yes (US7, P3): a single-column end moves to another row of the same or another table in one undo step; a composite end snaps back with a hint pointing to the details drawer; the end never slides freely along the side.
- Q: What happens when a new relationship is dropped on a table but not on a column row? → A: It targets the table's primary key when that key has exactly one column (the row is highlighted before release); a composite key or no primary key means no target and nothing is created.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See relationships between columns (Priority: P1)

An engineer opens the "Shop" schema. A line leaves `orders.customer_id` from the side facing `customers` and ends at `customers.id`. At `customers` it ends in a single bar ("exactly one"); at `orders` it ends in a ring and a crow's foot ("zero or many"). The engineer can read which column points at which and how many rows each side may have without opening anything.

**Why this priority**: a schema without visible relationships is a list of tables; reading foreign keys at a glance is the reason to draw a schema at all.

**Independent Test**: load a deck holding the "Shop" schema (relationships already stored, as 040 allows), compare against frame 159 rows A, C, D and F in light and dark.

**Acceptance Scenarios**:

1. **Given** an n–1 relationship from `orders.customer_id` to `customers.id` with the `orders` side optional and the `customers` side mandatory, **When** both tables are drawn at 100 % with all rows, **Then** the connector leaves the vertical centre of the `customer_id` row and arrives at the vertical centre of the `id` row, with a zero-or-many end at `orders` and an exactly-one end at `customers`.
2. **Given** `customers` is to the right of `orders`, **When** the user drags `customers` to the left of `orders`, **Then** both ends switch to the sides that face each other while the drag happens, and the ends stay on the same rows.
3. **Given** two tables that overlap horizontally, **When** they are drawn, **Then** both ends use the same side (the one giving the shorter connector; right on a tie).
4. **Given** each of the four cardinalities (1–1, 1–n, n–1, n–n) combined with each optional / mandatory side, **When** drawn, **Then** each end shows the matching mark (one, zero or one, one or many, zero or many) with the sizes in DESIGN.md "Crow's foot and ports".
5. **Given** a relationship on a curved, an elbow and a straight line, **When** drawn, **Then** on curved and elbow lines each end sits on a short straight stub perpendicular to the card side, on a straight line the marks follow the line's angle, and the marks have the same shape and size on all three.
6. **Given** a relationship with a palette colour, **When** drawn, **Then** the line and its ends use that colour; two relationships of the same colour are still told apart by their ends.
7. **Given** a relationship with no cardinality, **When** drawn, **Then** it attaches to its rows with plain ends (no crow's foot, no arrow).
8. **Given** a connector between two tables that names no columns, **When** drawn, **Then** it behaves as an ordinary connector anchored on the card outline, with crow's foot ends if it has a cardinality.

---

### User Story 2 - Create a relationship by dragging from a column (Priority: P1)

The engineer adds a foreign key: they press on the port of `orders.customer_id`, drag across to `customers`, see the `id` row highlight under the pointer, and release. A relationship appears with a crow's foot at `orders`. One undo removes it.

**Why this priority**: without drawing relationships, a hand-made schema stays disconnected until import (044); this is the core authoring gesture.

**Independent Test**: on two tables without relationships, drag from a column port to a column row and check the stored relationship in the JSON panel, then undo.

**Acceptance Scenarios**:

1. **Given** `orders.customer_id` (not null, `uuid`) and `customers.id` (`uuid`, primary key), **When** the user drags from the `customer_id` port and releases on the `id` row, **Then** one relationship is created from `orders` to `customers` with column ends `[customer_id]` → `[id]`, cardinality n–1, `orders` side optional, `customers` side mandatory, and it draws immediately.
2. **Given** the same gesture but `customer_id` is nullable, **When** released, **Then** the `customers` side is stored as optional (zero or one).
3. **Given** a drag in progress, **When** the pointer is over a column row of any table (including the same table), **Then** that row is highlighted as the target; over a table but not over a row, the table's single-column primary key row is the target if it has one; anywhere else there is no target.
4. **Given** the source column type differs from the target column type (e.g. `int` onto `uuid`), **When** the pointer is over the target, **Then** a warning chip near the target row reads "Types differ: int → uuid"; **When** released, **Then** the relationship is still created.
5. **Given** a drag is released over no target, or Esc is pressed during the drag, **When** the drag ends, **Then** nothing is written and no undo step is added.
6. **Given** a relationship was created, **When** the user presses ⌘Z once, **Then** it is gone; ⌘⇧Z brings it back with the same id.
7. **Given** the source column is released on its own row, **When** the drag ends, **Then** nothing is created.
8. **Given** a relationship already joins exactly these two columns in the same direction, **When** the user drags the same pair again, **Then** no duplicate is created and the existing relationship is selected.

---

### User Story 3 - Follow a column's relationships (Priority: P1)

The engineer hovers `orders.customer_id`. Its connector, the `customers.id` row and the `customers` table stay lit; every other table and connector dims. Moving away restores the board.

**Why this priority**: on a dense schema, tracing a foreign key by eye is slow; this is the main reading aid the backlog names.

**Independent Test**: hover and keyboard-focus a column row with two relationships and one without, and check which tables, rows and lines stay lit (frame 159 row E).

**Acceptance Scenarios**:

1. **Given** `orders.customer_id` has one relationship, **When** the user hovers that row, **Then** the connector is drawn highlighted, the `customers.id` row is highlighted, `orders` and `customers` stay at full opacity and every other card and connector dims as in 034's focus.
2. **Given** a primary key referenced by three relationships, **When** its row is hovered, **Then** all three relationships, their rows and tables stay lit.
3. **Given** a column with no relationship, **When** its row is hovered, **Then** nothing dims (row hover only).
4. **Given** a relationship, **When** the user hovers or selects it, **Then** its end rows at both ends are highlighted.
5. **Given** keyboard focus moves onto a column row, **When** it lands, **Then** the same highlight applies as for hover.
6. **Given** focus mode (F) or a playing flow is active, **When** a row is hovered, **Then** the existing focus or flow look wins and the row hover only adds the row highlight.

---

### User Story 4 - Read special shapes: self-reference, composite keys, parallel keys, many-to-many (Priority: P2)

`categories.parent_id` points to `categories.id` and draws as a loop on the right side. `shipment_items (order_id, product_id)` references `order_items` with one connector leaving a bracket that joins both rows. `orders` has `shipping_address_id` and `billing_address_id`, both to `addresses.id`: two separate lines meeting at `addresses.id`. `products` ↔ `categories` is many-to-many: crow's feet at both ends and an "n–n" pill.

**Why this priority**: real schemas contain all of these; drawn wrongly they mislead, but the common single-column case (US1) is already useful.

**Independent Test**: compare a deck holding these four cases with frame 159 rows B, C, D and G.

**Acceptance Scenarios**:

1. **Given** a relationship from a table to itself, **When** drawn, **Then** it leaves the referencing row and re-enters the referenced row on the same side as a loop that bulges outward at least 56 and never crosses the card.
2. **Given** a composite relationship with two pairs of columns, **When** drawn with all rows visible, **Then** each member row at each end has a 6 px stub, the stubs join in one segment, one connector leaves its midpoint, and the label (when shown) lists the columns in order, e.g. "(order_id, product_id)".
3. **Given** two relationships between the same two tables on different columns, **When** rows are drawn, **Then** they draw as two lines with their own ends and labels and are never bundled.
4. **Given** an n–n relationship, **When** drawn, **Then** both ends show a many mark and its label pill reads "n–n" (plus its name when it has one).
5. **Given** a composite relationship whose column lists differ in length (allowed by 040, flagged later by 047), **When** drawn, **Then** it draws stubs for the rows that exist at each end and nothing breaks.

---

### User Story 5 - Keep relationships readable at every detail level and zoom (Priority: P2)

The architect sets the deck to Keys. `orders` still shows `customer_id`, because a relationship uses it, and its line stays on that row. They set `addresses` to Names: its relationships now arrive at the title row. Zoomed out to System, the three lines between `orders` and `addresses` merge into one with "×3".

**Why this priority**: detail levels (041) exist to make large schemas readable; relationships must not break or jump when rows are hidden.

**Independent Test**: switch detail levels and zoom through Landscape, System, Container and Component on the "Shop" deck, compare with frames 158 and 162.

**Acceptance Scenarios**:

1. **Given** a table at Keys, **When** drawn, **Then** it shows primary-key rows, foreign-key rows and every other row that is a relationship end (e.g. a referenced unique column), in stored order, and each relationship keeps its row.
2. **Given** a table at Names, **When** drawn, **Then** its relationships anchor on the left or right side at the title's vertical centre.
3. **Given** a relationship end column that is hidden behind a "+n columns" pill, **When** drawn, **Then** the connector anchors at the pill's vertical centre on the facing side.
4. **Given** zoom below 90 % (System or Landscape), **When** drawn, **Then** relationships run table to table, and two or more relationships between the same pair of tables bundle into one line with a "×n" pill (034's bundle look and behaviour).
5. **Given** a table inside a collapsed group, **When** drawn, **Then** its relationships join the group's merged connectors exactly as other connectors do (029 / 034).
6. **Given** the user switches `orders` from All to Keys, **When** the table resizes, **Then** connectors on rows that stay visible keep their rows and none attach to a row that is no longer drawn.

---

### User Story 6 - Choose what relationships show (Priority: P3)

Before a review, the architect sets relationship labels to "Always" so every on-delete rule is visible, then switches the notation to "1 / n" for an audience that does not read crow's feet. For a quick sketch they turn cardinality ends off.

**Why this priority**: presentation polish; relationships are readable with the defaults.

**Independent Test**: change each setting in Deck settings and check the canvas and the exports.

**Acceptance Scenarios**:

1. **Given** labels are "Follow Labels tool" (default), **When** the Labels tool is off, **Then** labels show on hover or selection only; **When** the Labels tool is on, **Then** they show always.
2. **Given** labels are "Hover", "Always" or "Off", **When** drawn, **Then** labels show on hover or selection, always, or never, whatever the Labels tool says.
3. **Given** notation "1 / n", **When** drawn, **Then** each end shows a small text mark instead of the crow's foot: "1", "0..1", "1..n" or "0..n".
4. **Given** cardinality ends off, **When** drawn, **Then** ends are plain (as US1 scenario 7).
5. **Given** any setting is changed, **When** the deck is reloaded, exported as PNG / SVG or opened in another tab, **Then** the same setting applies; each change is one undo step.

---

### User Story 7 - Move or remove a relationship end (Priority: P3)

The engineer realises `orders.customer_id` should point to `accounts.id`. They select the relationship, drag its `customers` end onto the `accounts.id` row and release. Later they select another relationship and press ⌫ to delete it.

**Why this priority**: fixing a mistake without the drawer (043) is convenient but not essential; deleting already works for connectors.

**Independent Test**: reconnect one end to another table's row and to another row of the same table, then delete a relationship and undo.

**Acceptance Scenarios**:

1. **Given** a selected relationship, **When** the user drags one end onto a column row of another table and releases, **Then** that end's table and column change, the other end and all settings stay, and it is one undo step.
2. **Given** a selected relationship, **When** the user drags one end onto another row of the same table, **Then** only that end's column changes.
3. **Given** a composite relationship, **When** the user drags one of its ends, **Then** the end cannot be moved to a single row (it snaps back) and a hint says column ends are edited in the details drawer.
4. **Given** a selected relationship, **When** the user presses ⌫, **Then** it is removed and one ⌘Z restores it with the same id and settings.
5. **Given** a column-anchored end, **When** it is dragged, **Then** it moves between rows only; it does not slide freely along the card side.

### Edge Cases

- **Relationship to a column that no longer exists** (stale id in a hand-edited file): the end anchors as a hidden column would (title row) and the deck still opens.
- **Relationship to a non-table card** (e.g. from a table column to a Service card): the column end attaches to its row; the other end attaches to the card's outline as any connector.
- **Both ends on rows of tables stacked on top of each other**: same-side rule applies; the line routes around per the line type.
- **Self-reference on a table at Names or System zoom**: the loop leaves and re-enters at the title row.
- **Many relationships on one row** (a primary key referenced by 20 tables): all ends meet at the same row point; marks overlap exactly rather than fanning out.
- **Table resized wider** (041 allows width changes): ports follow the new side position.
- **Dimmed by playback** (035): relationships dim like any connector.
- **Drag start on a row of a locked or read-only context**: no lock state exists yet (043); drills and views (011) allow creating as they do for cards today.
- **Reduced motion**: highlight and dim apply instantly; no animation is added.
- **Touch / pen**: the port is reachable with a 24 px touch target even though it draws smaller.

## Requirements _(mandatory)_

### Functional Requirements

**Ports and anchoring**

- **FR-001**: Every visible column row of a table MUST offer a port on its left and right side at the row's vertical centre. Ports MUST be visible on row hover, while a connection drag is in progress, and on the rows of a selected relationship; otherwise they are hidden.
- **FR-002**: A relationship end that names a column MUST attach at the port of that column's row on the side facing the other end's table; when the tables overlap horizontally, both ends MUST use the same side, the one giving the shorter connector (right on a tie). The side MUST update live while a table moves.
- **FR-003**: When an end column is not drawn, the end MUST anchor on the facing side at, in order of preference: the "+n columns" pill if the table shows one; otherwise the title's vertical centre.
- **FR-004**: Below 90 % zoom (System, Landscape) relationship ends MUST attach table to table on the card outline, and relationships between the same pair of tables MUST bundle into one line with a "×n" pill using 034's bundle rules. At 90 % and above, relationships with at least one visible column end MUST NOT bundle.
- **FR-005**: At Keys detail, a table MUST also show every row that is an end of any relationship, in stored order, and its "+n columns" count MUST exclude them (amends 041 FR-016).
- **FR-006**: A column-anchored end MUST NOT be placed with the free side-sliding of connector ends (022 / 050); stored side anchors on such an end MUST be ignored for drawing and kept unchanged in the file.

**Ends and shapes**

- **FR-007**: Each end of a relationship with a cardinality MUST draw one of four marks, derived from that end's side of the cardinality (1 or n) and that side's optional flag: exactly one, zero or one, one or many, zero or many. Sizes MUST follow DESIGN.md "Crow's foot and ports" (toes 12 long, ±6 wide, bar 16, ring radius 4 filled with the canvas colour, bar at 10 / 8 / 16 from the edge).
- **FR-008**: Marks MUST be drawn in the connector's own stroke colour and width, with round joins and caps: on curved and elbow lines on a straight stub perpendicular to the card side, on straight lines along the line's angle (DESIGN.md "Crow's foot and ports"; corrected in planning 2026-10-04). A relationship MUST NOT draw the ordinary start knob or end arrow.
- **FR-009**: A relationship with no cardinality, or with cardinality ends turned off, MUST draw plain ends.
- **FR-010**: A composite end MUST draw a 6 px stub on each member row that is visible, one segment joining the stubs, and the connector leaving that segment's midpoint; one connector per relationship.
- **FR-011**: A self-referencing relationship MUST draw as a loop on one side between its two rows, bulging outward by at least 56 or half the distance between the rows, whichever is larger, without crossing the card.
- **FR-012**: Two or more relationships between the same two tables MUST draw as separate lines while their rows are drawn (FR-004).

**Labels and colour**

- **FR-013**: A relationship's label pill (Deck connector label look, Mono) MUST read, in order and when present: its name (the connector label), "ON DELETE <ACTION>" when an on-delete action other than none is set, the column list "(a, b)" for composite ends, and "n–n" for many-to-many.
- **FR-014**: Label visibility MUST follow the deck's relationship label setting: Follow Labels tool (default; hover / selection when the tool is off, always when on), Hover, Always, Off. Hover and selection MUST show the label in every mode except Off.
- **FR-015**: Relationship colour and line type MUST use the connector's existing colour (palette) and line type, with their existing controls.

**Creating, reconnecting, deleting**

- **FR-016**: Dragging from a column port MUST start a new relationship; the target MUST be the column row under the pointer (same or other table), else the single-column primary key of the table under the pointer, else none. The target row MUST be highlighted during the drag.
- **FR-017**: On release over a target, exactly one relationship MUST be created in one undo step: from the dragged column's table to the target's table, column ends `[source]` → `[target]`, cardinality n–1, source side optional, target side optional exactly when the source column is nullable. Released over no target, on the source row itself, or cancelled with Esc, nothing MUST be written.
- **FR-018**: When the source and target column types differ (compared on type name and size; an enum column matches only the same enum), a warning chip "Types differ: <source> → <target>" MUST show next to the target during the drag; the relationship MUST still be created on release. No lasting problem is recorded by this feature (047).
- **FR-019**: Dragging a pair that is already related in the same direction MUST NOT create a duplicate; it MUST select the existing relationship.
- **FR-020**: Dragging a selected relationship's single-column end onto a column row MUST change that end's table and/or column in one undo step, keeping every other field. A composite end MUST NOT be changed by dragging and MUST show a hint pointing to the details drawer.
- **FR-021**: Deleting a selected relationship MUST work as deleting any connector (⌫, context menu), one undo step restoring the same id and fields.

**Highlight**

- **FR-022**: Hovering or keyboard-focusing a column row that is an end of at least one relationship MUST highlight those relationships, the rows at their other ends and both tables, and dim every other card and connector with 034's focus look; hovering a row without relationships MUST only show the row hover.
- **FR-023**: Hovering or selecting a relationship MUST highlight the rows at both of its ends.
- **FR-024**: An active focus mode or flow (034 / 035) MUST keep its look; row hover then only adds the row highlight.

**Deck display settings**

- **FR-025**: Deck settings, Database section, MUST gain "Show on relationships": Cardinality ends (on by default), Labels (Follow Labels tool by default, Hover, Always, Off) and Notation (Crow's foot by default, 1 / n). In 1 / n notation each end MUST show "1", "0..1", "1..n" or "0..n" as small Mono text beside the end instead of the mark.
- **FR-026**: These settings MUST be stored in the deck file as optional deck-level fields next to 041's table display settings (absent = defaults, so older decks read and save unchanged), synced across tabs, exported, and changed in one undo step each.

**Export, access, performance**

- **FR-027**: PNG and SVG export MUST draw relationships with the same anchors, ends, stubs, loops, colours and visible labels as the canvas (labels follow the setting: hover-only labels are not exported; Always labels are).
- **FR-028**: Every relationship MUST have an accessible name such as "Relationship orders.customer_id to customers.id, many to one, on delete restrict"; column ports MUST have a 24 px pointer / touch target.
- **FR-029**: A board of 150 tables with about 200 relationships MUST pan, zoom and drag a table with no regression beyond the bench noise compared with the same board without relationship ends (same connectors drawn as plain lines).
- **FR-030**: No new network request; connectors that are not between column ends MUST look and behave exactly as before.

### Key Entities

- **Relationship**: a connector (040) whose ends may name columns (single or composite, paired by position), with cardinality, optional sides, referential actions, label and colour. 042 draws it, creates it, reconnects its single-column ends and deletes it.
- **Column port**: the attach point on the left or right side of a column row, at its vertical centre; also the start of a connection drag.
- **End mark**: one of exactly one, zero or one, one or many, zero or many (or its 1 / n text), derived per end from cardinality and optional side.
- **Relationship display settings**: deck-level cardinality ends on / off, label mode, notation; stored in the deck.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The "Shop" relationships match frame 159 rows A–G (light and dark) pixel-close at 100 %: anchors on the right rows, the right marks at the right sizes on all three line types.
- **SC-002**: Dragging `orders.customer_id` onto `customers.id` creates an n–1 relationship with a crow's foot at `orders` in one gesture, and one ⌘Z removes it (the backlog's acceptance criterion).
- **SC-003**: Collapsing `orders` to Keys keeps the `customer_id` line on the same row: its end point moves by 0 px relative to the row and no connector ends at a row that is not drawn, at every detail level and all four zoom levels.
- **SC-004**: In usability checks, a user identifies which column of table A references which column of table B, and how many rows each side may have, for 5 of 5 relationships on the "Shop" deck without opening a panel.
- **SC-005**: Hovering a column updates the highlight within one frame on a 150-table, 200-relationship board.
- **SC-006**: Panning, zooming and dragging a table on a 150-table, 200-relationship board stays within 10 % of the frame time of the same board drawn with plain connectors.
- **SC-007**: SVG and PNG exports of the "Shop" deck show the same relationships, ends and labels as the canvas for crow's foot and 1 / n notation, with labels Always and Off.

## Assumptions

- **Default cardinality on create** (clarified 2026-10-04): dragging from a column means "this column references that one", so the dragged side is the many side (n–1). The many side is optional (zero or many); the one side is optional when the referencing column is nullable. Users change these in 043's drawer.
- **Target fallback** (clarified 2026-10-04): over a table but not a row, the table's single-column primary key is the target, because that is what a foreign key points at in almost every case; a composite primary key gives no fallback target.
- **Type comparison** for the warning is on the stored type name and size only (case-insensitive); dialect-aware compatibility (e.g. `int` vs `integer`) is 047's lint.
- **Same-side rule** when tables overlap horizontally picks the side giving the shorter connector, right on a tie (frame 159 F says "both ends use the same side" without naming it).
- **Self-reference loop size** reads frame 159 B's "bulges 56 px or half the row distance" as the larger of the two.
- **Relationship display settings** are 042's (clarified 2026-10-04, matching 041's Assumptions; the backlog's §043 list is superseded for these three); 043 still adds the dialect select and the rest of frame 152's Database section, and the relationship drawer and toolbar (frame 136).
- **Keys keeps connected rows** follows DESIGN.md ("Keys draws PK, FK and connected rows", clarified 2026-10-04); 041 is specified with PK and FK rows only, so 042 amends it unless 041's implementation already includes it.
- **Row limit anchor**: 048 later moves hidden-column anchors to the "Show all" button; 042 uses the "+n columns" pill and the title row.
- **050 coordination**: relationship ends with column ends ignore 050's free sliding and centre zone; 050's handle stacking (handles above cards), drag robustness and reconnect gesture are reused for the end handles of US7. If 050 is not merged when 042 is implemented, 042 uses the current reconnect behaviour and the plan records the follow-up.
- **No new schema fields for relationships**: 040's `fromColumns`, `toColumns`, `cardinality`, `fromOptional`, `toOptional`, `onDelete`, `onUpdate`, the connector label and colour are enough; only the deck display settings are new.
- **Enum links** (frame 165) are not drawn; enums are a deck-level list shown on hover (041).
