# Feature Specification: Database Schema Model

**Feature Branch**: `040-db-schema-model`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "040 from docs/backlog-database.md" — Add the Database pack data model to Sododeck: tables (as cards of a table type) with columns, indexes, check constraints and an optional schema name; enums; relationships as connectors that attach to columns, with cardinality (1-1, 1-n, n-1, n-n), optional sides, composite keys and on delete / on update actions. Every column, index, check, enum and enum value has a stable id and all references use ids, so renames never break anything. All new fields are optional; older decks stay valid and unchanged. Out of scope: rendering, SQL import/export, views, custom types, sample data.

**Sources**: `docs/backlog-database.md` §040 (scope, draft acceptance criteria, risks), founder decisions DB1 (a pack inside a normal deck), DB7 (a table is a node with columns), DB8 (connectors attach to the exact column row), DB9 (per-table "show all" choice saved in the deck), DB10 (real n–n), DB11 (one dialect per deck, Generic by default); §041–§043 (what the next features read from this model); `packages/schema/schema/v1.json` (today's node, edge and pack shapes; `TypeId` / `PackId` rule); ADR 0020 (file format compatibility; deferred, §g-81: no format revision during development), ADR 0021 (collab-ready document layout), ADR 0025 (card type registry and packs); design-analysis §a ("040 is model-only and has no frame"), §g-87 (table default width is computed, not stored); constitution v1.0.0 (principles I, II, III, IV, V, VI, VIII).

**Dependency note (2026-10-04)**: both dependencies have merged: 030 (card type registry and packs, #68) and 036 (collab-ready model writes, #47). 039 (design import, #76) has merged too. Nothing blocks this feature.

## Scope

**In scope**

- A **Database pack** in the card type registry with one new card type: **Table**. Today's **Database** card type stays where it is and is the card that holds tables (drill-in through the existing parent link).
- A deck-level **dialect** (Generic, Postgres, MySQL, SQLite; absent means Generic).
- On a table: an optional schema (namespace) name, an ordered list of **columns**, **indexes**, named **check constraints**, the saved "show all columns" choice and a saved detail level.
- On a column: name, type text, optional size or precision, primary key, not null, unique, a default value **or** a default expression, auto-increment, a column check, a note, and an optional link to an enum.
- A deck-level list of **enums** (not cards, not drawn on the canvas): each with a stable id, a name, an optional schema name and ordered values, each value with an optional note.
- On a connector: the column (or ordered columns, for composite keys) at each end, cardinality, optional / mandatory on each side, and on delete / on update actions.
- Stable ids for every column, index, check, enum value; every reference is by id.
- Model operations that the next features (041–043) call: add, change, reorder and remove columns, indexes, checks and enum values; set the dialect; set a relationship's ends and settings. Removing something cleans up every reference to it in the same undo step.
- Lossless round-trip (file → model → file), validation parity, compatibility with older decks and older app builds.

**Out of scope**

- Drawing tables, column rows or crow's foot ends (041, 042); showing an enum's values when hovering an enum column (041); any visible change on the canvas.
- Editing UI: inline column editing, drawer sections, type picker, Deck settings dialect control (043).
- Type lists per dialect and type conversion when the dialect changes (043).
- SQL / DBML import and export, the code panel (044–046); lint rules on the schema (047); search, saved-view filters, long-table limits and the 150-table benchmark (048); flow steps that name tables or columns (049).
- SQL views, custom / composite types, sample rows, reusable column sets, lineage (later).

## Clarifications

### Session 2026-10-04

- Q: Which ids do the new card types use in the file? → A: `db-table` (and `db-enum`, later dropped: enums are not cards, see below), in a pack with id `database`; the existing card-type id rule (no dots) is kept unchanged.
- Q: Should the Database pack be hidden from Packs / Add until tables are drawn (041)? → A: No. The product is in development and the whole Database pack (040–049) is released together, so the pack is registered normally with no hide or preview flag.
- Q: Should an enum be a card on the canvas or a deck-level list? → A: A deck-level list, not drawn on the canvas. Users only care which column uses an enum and see its values by hovering that column (041); a standalone enum box has no value.
- Q: When a column that is a relationship end is removed, is the relationship removed or kept on the table? → A: Removed in the same undo step; for a composite key only the matching pair is dropped, and the relationship is removed when no pair is left.
- Q: Must column, index and check ids be unique only within their table, or across the whole deck? → A: Across the whole deck, like card and connector ids; pasting or duplicating a table gives its columns, indexes and checks new ids.

## User Scenarios & Testing _(mandatory)_

This feature has no new screen. Its users are (a) people who hand-write or AI-generate `.sododeck.json` files and read the JSON panel, and (b) the features 041–049 built on top of it. Stories are written from those two points of view.

### User Story 1 - Describe a database schema in a deck file (Priority: P1)

An engineer asks their own AI assistant to write the "Shop" schema as a `.sododeck.json`: a "Orders DB" database card holding `customers`, `orders`, `order_items` and `products` tables, an `order_status` enum, a composite primary key on `order_items`, an expression index on `lower(email)`, and foreign keys between the tables. They import the file. It loads without errors, the JSON panel shows every table, column, index, check, enum and relationship exactly as written, and exporting the deck gives back the same JSON.

**Why this priority**: without a place to store a schema, none of the Database pack (041–049) can exist. A file that holds the whole schema losslessly is already useful: it travels with the architecture and can be read by people and tools.

**Independent Test**: import a hand-written "Shop" deck covering every new field, export it, and compare the two files.

**Acceptance Scenarios**:

1. **Given** a deck file with the "Shop" schema (tables with columns, a composite primary key, a self-referencing `categories.parent_id`, an enum column, an expression index, a named check, an n–n relationship), **When** it is imported and exported again, **Then** the exported JSON is identical to the imported one.
2. **Given** that deck is open, **When** the user opens the JSON panel, **Then** every table shows its schema name, columns, indexes and checks, every relationship shows its column ends, cardinality, optional sides and actions, and the deck shows its dialect.
3. **Given** a deck file where a column has an unknown field (e.g. a typo `notnull` instead of `notNull`), **When** it is imported, **Then** the import is refused with a validation message that names the field and its location, as for any other unknown field today.
4. **Given** a table whose columns are listed in a custom order, **When** the deck is saved and reopened, **Then** the column order is unchanged.

---

### User Story 2 - Renames never break references (Priority: P1)

A developer renames the column `customer_id` to `buyer_id` in `orders` (by editing the file or, later, in the editor). The foreign key to `customers.id`, the index on that column and its place in the composite key all still point at the same column.

**Why this priority**: the constitution requires stable identity; a schema tool whose relationships break on rename is unusable, and every later feature (relationships, lint, export) relies on this.

**Independent Test**: rename a column, an enum and an index through the model, then check every reference by id.

**Acceptance Scenarios**:

1. **Given** `orders.customer_id` is used by a foreign key, an index and a check, **When** the column is renamed to `buyer_id`, **Then** the foreign key end, the index column and the column's own check still point at the same column id and nothing else in the deck changes.
2. **Given** a column `status` linked to the enum `order_status`, **When** the enum is renamed to `order_state`, **Then** the column still links to the same enum.
3. **Given** a table `orders` with relationships, **When** the table is renamed or moved into another schema name, **Then** every relationship still connects the same tables and columns.
4. **Given** an enum value `pending`, **When** it is renamed to `awaiting_payment`, **Then** its id is unchanged.

---

### User Story 3 - Older decks stay unchanged (Priority: P1)

A user opens a deck saved before the Database pack existed and saves it. Nothing new appears in it. Table-only fields on cards and connectors that are not tables are kept as written.

**Why this priority**: local-first files live for a long time; a silent change to old decks or a broken file from an older tab would lose trust immediately.

**Independent Test**: open and save every existing sample and fixture deck and compare bytes.

**Acceptance Scenarios**:

1. **Given** a deck saved before 040, **When** it is opened, edited elsewhere (e.g. a card moved) and saved, **Then** no table, column, dialect, port, cardinality or other new field appears in it.
2. **Given** a deck saved before 040, **When** it is opened, **Then** its dialect reads as Generic and its packs are unchanged (the Database pack is not switched on).
3. **Given** a card of another type (e.g. a Service) that carries table-only fields such as columns, **When** the deck is loaded and saved, **Then** those fields are kept unchanged and have no effect on that card.
4. **Given** a connector between two non-table cards that carries column ends, **When** the deck is loaded and saved, **Then** the ends are kept unchanged and have no effect.

---

### User Story 4 - Two tabs editing one schema merge cleanly (Priority: P2)

An engineer has the same deck open in two tabs. In one they change the type of `orders.total`; in the other they add a `discount` column to `orders`. Both changes survive, in both tabs, with no conflict and no lost column.

**Why this priority**: multi-tab sync already works for cards (036); tables must not be the one object where edits clobber each other. It is P2 because the editing UI comes in 043, but the model shape must be right now.

**Independent Test**: apply two concurrent model edits to different columns of one table in two documents, exchange updates, and compare.

**Acceptance Scenarios**:

1. **Given** two copies of a deck, **When** one changes column A's type and the other changes column B's name in the same table, **Then** after syncing both copies hold both changes.
2. **Given** two copies of a deck, **When** one adds a column and the other reorders two existing columns of the same table, **Then** after syncing both copies hold the new column and the new order, and no column is duplicated or lost.
3. **Given** two copies of a deck, **When** one removes a column and the other renames it, **Then** after syncing the column is removed in both copies and no reference to it remains.

---

### User Story 5 - Removing things cleans up references in one step (Priority: P2)

A user removes the `customer_id` column from `orders`. The index that covered only that column goes away, a composite index loses just that column, the foreign key from that column is removed, and one undo brings it all back.

**Why this priority**: dangling references are the main way a schema file goes bad; cleaning up in the model means every later editor, importer and exporter gets it for free.

**Independent Test**: remove a column, an enum and an enum value through the model and check that no reference to them is left, then undo once.

**Acceptance Scenarios**:

1. **Given** `orders.customer_id` is the only column of an index and one of two columns of another index, **When** the column is removed, **Then** the first index is removed, the second keeps only its other column, and one undo restores the column and both indexes exactly.
2. **Given** a relationship whose `orders` end is `customer_id`, **When** that column is removed, **Then** the relationship is removed too, and one undo restores both the column and the relationship.
3. **Given** a composite relationship with ends `(order_id, line_no)`, **When** `line_no` is removed, **Then** the matching pair is dropped from both ends and the relationship keeps `order_id`; when its last pair is removed, the relationship is removed.
4. **Given** an enum used by two columns, **When** the enum is removed, **Then** both columns lose the enum link and keep their type text, in one undo step.
5. **Given** a table is removed, **When** the removal is applied, **Then** its relationships are removed as connectors to a removed card are today, in the same undo step.

---

### User Story 6 - The deck knows its dialect (Priority: P3)

A user's deck is a Postgres schema. The deck records "Postgres" once, and every table and database card in it is read in that dialect by later features (type picker, SQL export).

**Why this priority**: the dialect is one small field, but 043–045 depend on it existing and having a clear default.

**Independent Test**: set and clear the dialect through the model and check the file.

**Acceptance Scenarios**:

1. **Given** a new or existing deck, **When** it is opened, **Then** its dialect reads as Generic and the file has no dialect field.
2. **Given** a deck, **When** the dialect is set to Postgres, **Then** the file shows it at the deck level, one undo clears it, and setting it back to Generic removes the field.
3. **Given** a file with a dialect the app does not know (e.g. `oracle`), **When** it is imported, **Then** the import is refused with a validation message naming the allowed values.

### Edge Cases

- **Duplicate ids** among the deck's columns, indexes, checks, enums and enum values (e.g. two columns in different tables sharing one id): the file is refused at import with a message naming every location, as for duplicate card ids today (a duplicated id makes references ambiguous, so it is never auto-fixed).
- **Pasting or duplicating a table**: every column, index and check of the copy gets a new id, and the copy's index parts point at the copy's columns; the original keeps its ids.
- **Dangling references in a file** (an index, port or enum link to an id that does not exist): the file loads, the reference is kept unchanged on save, and the deck reports a problem; nothing is silently dropped.
- **Composite ends of different lengths** (two columns at one end, one at the other): kept as written and reported as a problem.
- **A column with both a default value and a default expression**: refused at validation (at most one).
- **Column ends on a connector whose end is not a table** (e.g. a Service card): kept and ignored. Side anchors already exist on connector routes (022), so column ends are only ever columns.
- **A column linked to an enum in another schema**: allowed; the link is by id.
- **A table with no columns**: valid (a sketch); the "show all" and detail fields are still kept.
- **An index with no columns and no expressions**: refused at validation (an index needs at least one part).
- **Self-reference** (`categories.parent_id → categories.id`): a connector whose two ends are the same table, with different columns, is valid.
- **Two relationships between the same two tables** (e.g. `billing_address_id` and `shipping_address_id` → `addresses.id`): both are kept as separate connectors with their own ids.
- **Very large schemas** (150 tables × 12 columns): open, save and round-trip without noticeable delay (see SC-005); the full benchmark is 048's.
- **Table-only fields on a card switched to another type**: kept and ignored, and they show again if switched back.
- **Unknown pack or type ids** from a newer build keep working as today (kept on save, drawn as a generic card).

## Requirements _(mandatory)_

### Functional Requirements

**Pack, types and dialect**

- **FR-001**: The card type registry MUST include a **Database** pack containing one new card type, **Table**, with id `db-table`, in a pack with id `database`; the existing card-type and pack id rule (lowercase letters, digits, hyphens) stays unchanged.
- **FR-002**: Today's **Database** card type MUST keep its id and pack; it is the card that holds tables through the existing parent link. No existing deck changes.
- **FR-003**: The Database pack MUST be registered like every other pack (no hiding or preview flag). Until 041 its types draw as generic cards; this is acceptable because the Database pack is released to users only as a whole, after 040–049 are done.
- **FR-004**: A deck MUST be able to store one **dialect**: Generic, Postgres, MySQL or SQLite. Absent means Generic; setting Generic MUST remove the field; any other value MUST be refused at validation.

**Tables**

- **FR-005**: A table card MUST be able to store, all optional: a schema (namespace) name, an ordered list of columns, a list of indexes, a list of named check constraints, the "show all columns" choice (DB9) and a detail level (names, keys or all). The table's name, note, colour, owner, tags, links, group and parent MUST use the fields every card already has.
- **FR-006**: Table-only fields on a card of another type MUST be kept on save and have no effect.

**Columns**

- **FR-007**: A column MUST have a stable id, a name and a type text, and MAY have: a size or precision (e.g. `255`, `10,2`), primary key, not null, unique, a default value, a default expression, auto-increment, a column check expression, a note, and a link to an enum by id.
- **FR-008**: A column MUST NOT have both a default value and a default expression (validation error).
- **FR-009**: A composite primary key MUST be expressed by marking several columns of one table as primary key; their order is the column order.
- **FR-010**: Column order MUST be kept exactly through save, load, sync and round-trip.

**Indexes and checks**

- **FR-011**: An index MUST have a stable id and an ordered, non-empty list of parts, each part being either a column (by id) or an expression text; it MAY have a name, unique, a method (free text such as `btree`, `hash`) and a note.
- **FR-012**: A check constraint MUST have a stable id and an expression text, and MAY have a name.

**Enums**

- **FR-013**: Enums MUST live in one deck-level list, not as cards and not on the canvas. An enum MUST have a stable id, a name and an ordered list of values, and MAY have a schema name and a note; each value MUST have a stable id and a name and MAY have a note. Showing an enum's values is the job of the column that uses it (hover, 041).
- **FR-014**: A column MUST link to an enum by the enum's id; renaming the enum or its values MUST NOT change the link.

**Relationships**

- **FR-015**: A connector MUST be able to store, all optional: the column at each end (one column id, or an ordered list of column ids for composite keys), a cardinality (1–1, 1–n, n–1, n–n), whether each side is optional, and on-delete and on-update actions (cascade, restrict, set null, set default, no action).
- **FR-016**: Relationship name and colour MUST use the connector's existing label and colour fields.
- **FR-017**: A connector whose two ends are the same table MUST be valid (self-reference); several connectors between the same two tables MUST be valid.
- **FR-018**: Column ends on connectors whose end card is not a table MUST be kept on save and have no effect.

**Identity and references**

- **FR-019**: Every column, index, check, enum and enum value MUST have an id that stays the same through rename, reorder, move, save, load and sync. Ids MUST be unique across the whole deck, like card, connector and step ids, so one id alone names one object; ids are never derived from names.
- **FR-020**: Every reference (index part, port, enum link) MUST be by id; renaming any table, column, enum, enum value, index or check MUST NOT change any other object.
- **FR-021**: References to ids that do not exist and composite ends of unequal length MUST be kept unchanged on save and reported in the deck's existing Problems list. Duplicate ids MUST make the file refused at import, naming every location (the existing duplicate-id rule).

**Model operations**

- **FR-022**: The model MUST offer operations to add, change, reorder and remove columns, indexes, checks and enum values; to set and clear table fields, the dialect and a connector's relationship fields. Each user action MUST be one undo step.
- **FR-022a**: Pasting or duplicating a table through the model MUST give every column, index and check of the copy a new deck-unique id and remap the copy's index parts to the new column ids, in the same undo step as the paste.
- **FR-023**: Removing a column MUST, in the same undo step: remove it from every index of its table (removing an index left with no parts); remove every relationship whose single-column end is that column; for a composite end, drop that column and the column at the same position on the other end, removing the relationship when no pair is left; and leave everything else unchanged.
- **FR-024**: Removing an enum MUST clear the enum link on every column that uses it, keeping the columns' type text, in the same undo step. Removing an enum value MUST change nothing else.
- **FR-025**: Removing a table MUST remove its relationships the same way connectors to a removed card are removed today.
- **FR-026**: Changes to different columns, indexes, checks or enum values of the same table or enum made concurrently in two tabs MUST both survive after sync; concurrent add and reorder MUST neither lose nor duplicate a column.
- **FR-027**: Edits through model operations MUST keep fields the operation does not know about (ADR 0020 §6).

**File format and compatibility**

- **FR-028**: Every new field MUST be optional and additive; a deck saved before this feature, opened and saved again without touching the new features, MUST NOT gain any new field.
- **FR-029**: No format version or revision change: the new fields are additive like 017–038's. The format revision guard (ADR 0020, backlog 025) is deferred by the founder (§g-81) and is not part of this feature.
- **FR-030**: The file schema MUST stay strict: unknown or misspelled fields on columns, indexes, checks, enum values and relationship fields MUST be refused at validation with a message naming the location, and both validators MUST agree on every fixture (parity).
- **FR-031**: Import → export of a deck using every new field MUST produce identical JSON (round-trip), including a composite key, a self-reference, an enum column, an expression index, an n–n relationship and two relationships between the same tables.
- **FR-032**: The JSON panel MUST show the new fields as they are stored (it is a view of the document; no new panel work).
- **FR-033**: No schema content MUST leave the browser; nothing in this feature makes a network request.

**Documentation**

- **FR-034**: The file format reference (schema field descriptions) MUST describe every new field, with the "Shop" fixture as a worked example, and a decision record MUST capture the model choices (type and pack ids, enums as a deck-level list, port shape, id scope). The AI deck skill (027) is not built yet; it picks these up when it is.

### Key Entities

- **Database pack**: a set of card types (today only Table) in the type registry; can be on or off per deck like other packs.
- **Dialect**: one per deck; Generic, Postgres, MySQL or SQLite; read by later features for types and SQL.
- **Table**: a card of the Table type; has a schema name, columns, indexes, checks, "show all" and detail level; may sit inside a Database card.
- **Column**: belongs to one table; id, name, type text, size, flags (primary key, not null, unique, auto-increment), default value or expression, check, note, optional enum link.
- **Index**: belongs to one table; id, optional name, ordered parts (column or expression), unique, method, note.
- **Check constraint**: belongs to one table; id, optional name, expression.
- **Enum**: an entry of the deck's enum list (not a card); id, name, schema name, note, ordered values (id, name, note). Columns link to it by id.
- **Relationship**: a connector between two cards with optional column ends (single or composite), cardinality, optional sides and referential actions; label and colour as for any connector.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100 % of the round-trip fixtures (at least: the full "Shop" schema, composite key, self-reference, enum column, expression index, n–n, two relationships between the same tables, unknown pack and type ids) export byte-identical to what was imported.
- **SC-002**: Every existing sample and test deck, opened and saved, is byte-identical to before (0 new fields).
- **SC-003**: After renaming any column, enum, enum value, index, check or table in the "Shop" fixture, 100 % of references still resolve to the same objects.
- **SC-004**: In concurrent-edit tests on two copies of a deck, 100 % of edits to different columns of one table survive after sync, with 0 lost or duplicated columns.
- **SC-005**: A deck with 150 tables of 12 columns each (1,800 columns, about 200 relationships) loads, saves and round-trips in under 1 second on a typical laptop, without blocking typing on the canvas for more than one frame during save.
- **SC-006**: Both validators agree on 100 % of valid and invalid fixtures, and every invalid fixture's message names the field and its location.
- **SC-007**: A person who knows the existing file format can hand-write a valid three-table schema with one foreign key from the reference docs alone, on the first try.

## Assumptions

- **Type ids.** The backlog writes `db.table` / `db.enum`, but card-type ids allow only lowercase letters, digits and hyphens. Widening that rule changes a shared format rule for one pack, so the new ids follow the rule: `db-table` and pack `database` (clarified 2026-10-04).
- **The Database card type is not moved.** The backlog's "`db.database` = today's database kind" is read as: the existing `database` type is the container for tables and stays in the Architecture pack, so no existing deck changes.
- **Enums are a deck-level list** (clarified 2026-10-04): people care about which column uses an enum and read its values by hovering that column; a separate enum object on the canvas adds no value. This also maps one-to-one to DBML and SQL enum declarations. 041 drops the backlog's "Enum card" and shows values on hover instead.
- **No interim gating** (FR-003, clarified 2026-10-04): the app is in development and the Database pack ships to users only when 040–049 are all done, so 040 adds no hide or preview flag for the pack.
- **Id scope** (clarified 2026-10-04): column, index, check, enum and enum value ids are unique across the deck, like every other id, so flows (049), lint (047) and search (048) can point at a column by its id alone.
- **Size / precision** is stored as short text (`255`, `10,2`) and defaults, checks and expressions as plain text; the app does not parse SQL in this feature.
- **Index method** is free text; dialect-specific lists come with 043.
- **Problems** for dangling references, duplicate ids and unequal composite ends reuse the existing derived Problems list (015); the full schema lint is 047.
- **Removing a column used by a relationship** removes the relationship (or, for a composite key, the matching pair; clarified 2026-10-04). A relationship without columns at its ends is still valid when drawn by hand between tables.
- **SC-005's** "typical laptop" means the same machine class as the existing bench; the formal 150-table benchmark is 048.
