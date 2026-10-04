# Feature Specification: Schema Import

**Feature Branch**: `044-db-import`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "044 from docs/backlog-database.md" — An existing schema becomes a laid-out diagram in seconds: an import dialog (canvas empty state, Add flyout footer, File menu) where the user pastes text or drops a `.sql` / `.dbml` file; dialect Postgres / MySQL / SQLite / auto (an empty Generic deck takes the detected dialect; a deck with another dialect asks to convert); preview counts; import into the current deck (inside the selected database card if any) or a new deck. Parsing and mapping off the main thread with a lazy-loaded parser; positions from auto-layout, grouped by schema. Tables, columns and all their settings, composite keys, indexes, checks, foreign keys (inline and added later), enums, schemas and comments; DBML tables, refs, enums, table groups, notes, header colours and sticky notes. An import report with mapped counts and skipped statements (line and reason). Optional "Detect foreign keys by name" shown as suggestions the user accepts. Stable ids generated once at import.

**Sources**: `docs/backlog-database.md` §044 (scope, draft acceptance criteria, risks, "From 045" note), §045 (the export partner and its round-trip criterion), §043 (dialect type lists, Deck settings Database section, not built), §046 (re-import matching by name, code panel); founder decisions DB2 (SQL DDL and DBML both ways), DB5 (no code, assets or copy from other tools), DB6 (one parser for DBML and SQL, Apache-2.0, lazy-loaded in a worker, dependency approval recorded in this feature's ADR), DB7 (a table is a node of the table type), DB8 (relationship ends are column rows), DB11 (one dialect per deck; an import sets it from the file); `specs/040-db-schema-model/` (what the deck stores: dialect, enums, tables, columns, indexes, checks, relationship fields, problems); `specs/041-db-table-card/` and `specs/042-db-relationships/` (what an imported table and relationship look like); `specs/045-db-export/` and ADR 0031 (writers, "Shop" fixture, the common type list, the DBML `?` optional markers and `checks` block the parser must read); `specs/005-local-library-autosave/` (deck import into the library, new decks); `specs/011-views-autolayout/` (auto-layout worker); design-analysis §a frames 134 (empty schema deck with Import), 138 (import dialog), 139 (after import: report, foreign keys by name, Undo toast), §g-86 (use `packages/ui` controls), §g-91 (dialog from 138 / 139, not 166); constitution v1.0.0 (principles I–VIII).

**Dependency note (2026-10-04)**: 043 is being built in parallel; integration points to resolve after it merges are in [integration-043.md](integration-043.md). 040 (model), 041 (table card), 042 (relationships) and 045 (export) are merged. **043 (editing: type picker, Deck settings Database section with the dialect switch and its conversion) and 047 (lint) are not built.** 044 sets the deck dialect directly when it imports into a deck without tables, and converts only the imported types (never the deck's existing tables) when the dialects differ; see Assumptions.

## Scope

**In scope**

- An **Import SQL or DBML** dialog (frame 138) opened from the empty-canvas card, the Add flyout footer and the deck ≡ menu: **Paste** or **File** (pick or drop one `.sql` / `.dbml` / `.txt` file).
- **Format and dialect**: DBML or SQL is recognised from the text or file extension; for SQL the dialect picker offers Auto (default, shows the detected dialect), Postgres, MySQL and SQLite.
- A **preview line**: "n tables, n relationships, n enums · n statements will be skipped", updated as the text changes, plus parse errors with their line.
- **Dialect handling**: a deck with no tables and a Generic dialect takes the import's dialect; a deck whose dialect differs from the import's shows a notice listing the type conversions before import; a Generic deck with tables keeps Generic and keeps types as written.
- **Target**: into the current deck (inside the selected or drilled-into database card when there is one, labelled with its name) or into a **new deck** in the library.
- **Mapping**: schemas, tables, columns with type, size, primary key (single and composite), not null, unique, auto-increment, default value or expression, column check, enum reference and comment; table checks; indexes (columns and expressions, unique, method); foreign keys (inline, table-level and added later by `ALTER TABLE … ADD`) with on delete / on update; enums (`CREATE TYPE … AS ENUM`, MySQL inline `ENUM(…)`); comments (`COMMENT ON`, MySQL `COMMENT '…'`) as notes. DBML: tables, columns and settings, indexes, `checks`, refs in every form (inline, short, long, composite, many-to-many, optional `?` markers), enums, table groups as groups, notes, header colour as card colour, sticky notes as stickies, schemas.
- **Layout**: imported tables placed by the deck's auto-layout, clustered by group (DBML table group, or schema when the import holds more than one schema), without overlapping each other or the deck's existing cards.
- **Import report** (frame 139): mapped counts, skipped statements with line number and reason, notes on anything changed (type conversions, renamed duplicates), and the foreign-key suggestions.
- **Detect foreign keys by name** (option, default on): `customer_id` → `customers.id` suggestions for columns with no foreign key, listed in the report; hovering or focusing a suggestion highlights its two tables and column rows on the canvas; Accept, Dismiss, Accept all, Dismiss all.
- **One undo step** for the whole import, with an "Imported … · Undo" toast.
- **DBML round-trip test** with 045's writer on the "Shop" fixture, and an import fixture corpus.

**Out of scope**

- MariaDB, SQL Server, Oracle and other dialects; a live database connection; reading views, functions, procedures, triggers, grants, partitions, sequences as objects, sample rows (all reported as skipped).
- **Re-import that matches by name** and updates existing tables (046). Importing into a deck that already holds a table of the same name adds a new table named `<name>_copy` (see FR-015).
- Changing the dialect of an existing deck and converting its tables (043's Deck settings).
- An enum card on the canvas (not built, 040 / 041); enums go to the deck's enum list.
- Lint rules on the imported schema (047); the existing Problems list shows 040's kinds as today.
- Import of the `.sododeck.json` deck file (005, unchanged).
- New end-to-end tests (constitution Principle VI); the existing smoke suite must stay green.

## Clarifications

### Session 2026-10-04

- Q: When importing into a deck that already holds a table of the same name, what happens? → A: Always add a new table and list it in the report; matching by name stays with 046. **Revised 2026-10-04 (founder)**: the new table follows 043's paste rule and is named `<name>_copy`, `<name>_copy_2`, … (see [integration-043.md](integration-043.md)).
- Q: When the import's dialect differs from the deck's, what happens? → A: Show a notice before import, convert types in the common type list (045's) to the deck's dialect keeping their size, keep other types as written, and list every conversion and kept type in the report.
- Q: Where are the foreign-key-by-name suggestions shown for review? → A: Only in the import report; hovering or focusing a suggestion highlights the two tables and the two column rows on the canvas; no line is drawn until accepted.
- Q: Should schemas in the file become groups on the canvas? → A: One group per schema only when the import holds two or more schemas; a single schema adds no group. Imported groups are ordinary groups the user can Ungroup (⇧⌘G) in one undo step; tables keep their stored schema, so nothing is lost.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Turn a SQL dump into a diagram (Priority: P1)

An engineer has a Postgres schema dump of 30 tables. They create a deck, press Import on the empty canvas, drop the `.sql` file, see "30 tables, 41 relationships, 3 enums · 4 statements will be skipped", press Import and get every table laid out, with every foreign key drawn as a relationship from column row to column row.

**Why this priority**: this is the feature's reason to exist: an existing database becomes a diagram without redrawing it.

**Independent Test**: import the 30-table Postgres fixture into an empty deck; count tables, columns, relationships and enums against the fixture's expected list; check that no two table cards overlap; check the deck dialect is Postgres.

**Acceptance Scenarios**:

1. **Given** an empty Generic deck, **When** the user drops a Postgres dump and presses Import, **Then** every `CREATE TABLE` becomes a table card with its columns in file order, the deck dialect becomes Postgres, and no two imported cards overlap.
2. **Given** a foreign key written inline (`customer_id uuid REFERENCES customers(id) ON DELETE CASCADE`), as a table constraint, or by `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`, **When** imported, **Then** each becomes one relationship whose ends are the exact column rows, with its actions and constraint name.
3. **Given** a composite primary key `PRIMARY KEY (order_id, product_id)` and a composite foreign key to it, **When** imported, **Then** both columns carry the key in that order and the relationship lists both column pairs in order.
4. **Given** `CREATE TYPE order_status AS ENUM ('pending','paid')` used by `orders.status`, **When** imported, **Then** the deck has the enum with its values in order and the column refers to it.
5. **Given** `COMMENT ON TABLE orders IS '…'` and `COMMENT ON COLUMN orders.total IS '…'`, **When** imported, **Then** they become the table note and the column note.
6. **Given** a relationship whose referencing columns are unique, **When** imported, **Then** its cardinality is one-to-one; otherwise many-to-one; a nullable referencing column marks that end optional.
7. **Given** the import finishes, **When** the deck shows, **Then** the view fits the imported tables, a toast reads "Imported n tables, n relationships, n enums" with Undo, and pressing Undo (or ⌘Z) removes everything the import added in one step.

---

### User Story 2 - See what was skipped and why (Priority: P1)

The dump also holds a view, a function, a trigger and grants. The engineer wants to know exactly what did not come in, so they can trust the diagram.

**Why this priority**: an import that silently drops statements cannot be trusted; the report is part of the minimum product.

**Independent Test**: import a fixture with one of each unsupported statement; the report lists each with its first line number and reason, and nothing is skipped without a line in the report.

**Acceptance Scenarios**:

1. **Given** a file with `CREATE VIEW order_totals …` on line 88, **When** the user previews, **Then** the preview line counts it as skipped; **When** imported, **Then** the report lists "L88 CREATE VIEW order_totals — views are not modelled".
2. **Given** functions, triggers, grants, partitions, sequences, `INSERT` rows and session settings, **When** imported, **Then** each is listed as skipped with its line and a short reason, grouped by kind when there are many of one kind.
3. **Given** a column option the deck cannot store (e.g. a collation, a generated column expression), **When** imported, **Then** the column is imported without it and the report lists it under "Changed" with its line.
4. **Given** the report is open, **When** the user closes it, **Then** it can be reopened from the toast or from the deck ≡ menu ("Last import report") until the deck is closed.
5. **Given** a file with a syntax error on line 12, **When** previewed, **Then** the dialog shows "Line 12: <message>", the Import button is disabled, and nothing in the deck changes.

---

### User Story 3 - Import DBML (Priority: P1)

A developer keeps the schema as DBML in a repository (perhaps written by 045's export). They paste it and get tables, references, enums, table groups as groups, header colours and sticky notes.

**Why this priority**: DBML is the deck's code format (DB2) and the round-trip partner of 045; the round-trip criterion of 045 (SC-002) is closed here.

**Independent Test**: export "Shop" as DBML with 045's writer, import it into a new deck, export again: the second DBML equals the first, and the two schemas are equal when compared by name.

**Acceptance Scenarios**:

1. **Given** DBML with `Table`, column settings (`pk`, `increment`, `not null`, `unique`, `default`, `note`), an `indexes` block and a `checks` block, **When** imported, **Then** each is stored on the table and column.
2. **Given** refs written inline, short (`Ref: a.x > b.y`), long (`Ref name { … }`), composite, many-to-many (`<>`) and with optional markers (`?`) and actions, **When** imported, **Then** each becomes a relationship with the matching cardinality, optional ends, actions and name.
3. **Given** a `TableGroup billing { payments invoices }` with a colour, **When** imported, **Then** a group "billing" holds those tables and is laid out as one cluster.
4. **Given** a table with `headercolor: #3498DB`, **When** imported, **Then** the card takes that colour as its header colour (stored as given; custom hex colours are already valid deck colours).
5. **Given** a DBML `Note` block outside any table (a sticky note), **When** imported, **Then** it becomes a sticky near the imported tables; a project-level note becomes the deck description if the deck has none, otherwise a sticky.
6. **Given** a DBML `Project` with `database_type: 'PostgreSQL'`, **When** imported, **Then** the dialect is Postgres; without it, the DBML import is dialect-neutral and the deck dialect is unchanged.

---

### User Story 4 - Choose where the tables go (Priority: P2)

The architect's deck has an "Orders DB" database card on the platform board. They drill into Orders DB, open Import, and the tables land inside that card. Another time they import into a new deck to keep a schema apart.

**Why this priority**: what makes Sododeck different is the database card holding its tables; importing straight into it keeps the architecture link without moving cards by hand.

**Independent Test**: with a database card selected, import a fixture; every imported table's parent is that card. With "New deck", a new deck appears in the library, opens, and the current deck is unchanged.

**Acceptance Scenarios**:

1. **Given** the user is drilled into Orders DB or has it selected, **When** the dialog opens, **Then** the target "Import into Orders DB" is offered and selected, and the imported tables (and groups) sit inside that card.
2. **Given** no database card is in context, **When** the dialog opens, **Then** the targets are "Import into this deck" and "New deck".
3. **Given** "New deck", **When** imported, **Then** a new deck named after the file (or "Imported schema" for pasted text) is added to the library with the detected dialect and opens; the current deck does not change.
4. **Given** the current deck already holds cards, **When** imported into it, **Then** the imported tables are placed in free space next to the existing content and nothing existing moves.

---

### User Story 5 - Dialect mismatch (Priority: P2)

The engineer imports a MySQL file into a Postgres deck. Before importing, the dialog says the deck is Postgres and lists the type conversions, so they decide whether to proceed or import into a new MySQL deck instead.

**Why this priority**: one dialect per deck (DB11) means mixing must be explicit; without the notice, types would silently become invalid for the deck's export.

**Independent Test**: import a MySQL fixture into a Postgres deck; the notice lists each conversion; after import the types are converted and the report lists them; with "New deck" the new deck is MySQL and no type changes.

**Acceptance Scenarios**:

1. **Given** a Postgres deck and a file detected as MySQL, **When** previewed, **Then** a notice reads "This deck is Postgres: n column types will be converted" with the first conversions (e.g. `datetime → timestamp`) and a hint that a new deck keeps MySQL.
2. **Given** the user imports anyway, **When** done, **Then** every type in the common type list is converted to the deck's dialect keeping its size, other types are kept as written, and the report lists every conversion and every kept type.
3. **Given** a Generic deck that already holds tables, **When** importing a dialect file, **Then** the deck stays Generic, types are kept as written, and the notice says so.
4. **Given** Auto detects nothing conclusive (plain ANSI SQL), **When** previewed, **Then** the picker reads "Auto · not detected" and the import uses the deck's dialect (or Generic for a new or empty deck); the user can pick a dialect to change that.

---

### User Story 6 - Detect foreign keys by name (Priority: P3)

A legacy MySQL schema has no foreign key constraints. With "Detect foreign keys by name" on, the import suggests `orders.customer_id → customers.id` and the others; the user reviews them in the report, hovering each to see the two columns highlighted on the canvas, and accepts the right ones.

**Why this priority**: valuable for real legacy schemas, but the import is complete without it.

**Independent Test**: import a fixture without constraints; the report lists the expected suggestions only (no false match where the target table or column is missing); Accept adds a relationship; Dismiss removes the suggestion; each is one undo step.

**Acceptance Scenarios**:

1. **Given** a column `customer_id` with no foreign key and a table `customers` (or `customer`) with a single-column primary key `id`, **When** imported with the option on, **Then** the report lists "orders.customer_id → customers.id" as a suggestion, and hovering or focusing it highlights `orders`, `customers` and the two column rows on the canvas; no line is drawn.
2. **Given** a suggestion, **When** the user presses Accept, **Then** a relationship is added (many-to-one; one-to-one if the column is unique; optional end if nullable), drawn like any other relationship, and the suggestion shows "Added"; **When** Dismiss, **Then** the suggestion disappears from the report. Accept all and Dismiss all act on every open suggestion.
3. **Given** a column that already has a foreign key, or whose name matches no table, or whose type differs clearly from the target key's type (e.g. text vs integer), **When** detected, **Then** no suggestion is made.
4. **Given** the option is off, **When** imported, **Then** no suggestion is made and the report has no such section.
5. **Given** suggestions not yet accepted, **When** the report closes or the deck is saved, **Then** the suggestions are not part of the deck (nothing is written to the file); reopening the report shows them again until the deck is closed.

### Edge Cases

- **Empty or whitespace-only text**: Import is disabled; the preview line reads "Paste SQL or DBML, or drop a file".
- **File too large** (over 5 MB) or of another type: refused with a message before parsing; nothing changes.
- **Statements that parse but hold no tables** (only a view or grants): the preview reads "0 tables · n statements will be skipped" and Import is disabled.
- **Quoted identifiers and case** (`"Order Items"`, `` `order` ``, `[x]` not supported): names are stored without quotes, as written; unquoted Postgres names keep their written case.
- **Schema-qualified names** (`billing.payments`): the schema is stored on the table; a foreign key to `billing.accounts` resolves within the import; Postgres `public` is stored as the schema when written, and omitted otherwise.
- **User does not want the schema groups**: selecting an imported group and pressing Ungroup removes it in one undo step; its tables stay where they are and keep their schema.
- **Foreign key to a table that is not in the file**: the relationship is skipped and listed in the report ("references accounts, not in this import"); 044 does not link to existing deck tables by name (046).
- **Self-reference and several foreign keys between the same two tables**: each becomes its own relationship.
- **Duplicate table name in the import** (same schema): the second is imported as `<name>_copy` (then `_copy_2`, …, 043's rule) and listed under "Changed".
- **Table name already in the deck** (same schema, case-insensitive): the imported table is added as a new table named `<name>_copy` (then `_copy_2`, …, 043's rule) and the report lists it under "Changed" ("a table named orders already exists, imported as orders_copy").
- **`ALTER TABLE` adding a column, a unique or a check** after the `CREATE TABLE`: applied to the table; `ALTER TABLE` that drops or renames is skipped with a reason.
- **Enum used by no column**: imported into the deck's enum list.
- **MySQL inline `ENUM(…)`**: becomes a deck enum named `<table>_<column>`; two columns with the same value list share one enum.
- **Default values**: literals (`'pending'`, `0`, `true`) stored as values; anything else (`now()`, `gen_random_uuid()`, `CURRENT_TIMESTAMP`) as an expression; never both.
- **Auto-increment forms** (`serial`, `bigserial`, `GENERATED … AS IDENTITY`, `AUTO_INCREMENT`, SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`): stored as auto-increment; `serial` keeps the base integer type with the flag on.
- **Comments in SQL** (`--`, `/* */`): ignored, except `COMMENT ON` statements and MySQL `COMMENT` clauses, which become notes.
- **Very large schema** (300 tables, 3,600 columns): the dialog and editor stay responsive while parsing and laying out; the preview line shows "Reading…".
- **The user edits the deck while an import is being prepared**: the import is applied to the deck as it is when the user presses Import; preparing never writes to the deck.
- **Dialog closed while parsing**: the work is cancelled and nothing changes.
- **Another tab has the same deck open**: the import arrives there through the normal multi-tab sync as one change.

## Requirements _(mandatory)_

### Functional Requirements

**Dialog**

- **FR-001**: An **Import SQL or DBML** dialog MUST open from the empty-canvas card, the Add flyout footer and the deck ≡ menu, with a **Paste** tab (line-numbered text area) and a **File** tab (pick or drop one `.sql`, `.dbml` or `.txt` file of at most 5 MB; dropping a file on the dialog also works from the Paste tab).
- **FR-002**: The dialog MUST recognise DBML or SQL from the file extension or, for pasted text, from its content; for SQL it MUST offer Auto (default, showing the detected dialect or "not detected"), Postgres, MySQL and SQLite.
- **FR-003**: The dialog MUST show a preview line with the counts of tables, relationships and enums that will be imported and of statements that will be skipped, updated within one second of the text or options changing; a parse error MUST show its line and message and disable Import.
- **FR-004**: The dialog MUST offer the targets: the database card in context (selected or drilled into, labelled "Import into <card name>"), "Import into this deck" (when no database card is in context) and "New deck". The default MUST be the first offered.
- **FR-005**: The dialog MUST offer "Detect foreign keys by name (customer_id → customers.id)", on by default, and the Import button MUST name the count ("Import 8 tables").
- **FR-006**: Preparing the preview MUST NOT change the deck; cancelling or closing MUST leave the deck unchanged and stop any work in progress.

**Dialect**

- **FR-007**: When the target deck has no tables and a Generic dialect, the import MUST set the deck dialect to the import's dialect (detected or picked). A new deck MUST take the import's dialect (Generic when none).
- **FR-008**: When the target deck's dialect is Postgres, MySQL or SQLite and differs from the import's, the dialog MUST show a notice naming the deck's dialect, the number of column types that will be converted and the first conversions; on import, types in the common type list (045's list, with aliases) MUST be converted to the deck's dialect keeping their size, and other types MUST be kept as written; every conversion and every kept type MUST be listed in the report. The deck's existing tables MUST NOT change.
- **FR-009**: When the target deck is Generic and already holds tables, the deck MUST stay Generic and types MUST be kept as written; the dialog MUST say so.

**Mapping**

- **FR-010**: SQL import (Postgres, MySQL, SQLite) MUST map: schemas; tables; columns in file order with type, size (length or precision, scale), primary key (single and composite, in key order), not null, unique (column or single-column table constraint), auto-increment in every dialect form, default value or default expression (FR-012), column check and comment; table checks; indexes and unique constraints over several columns (as unique indexes) with column and expression parts, unique flag and method; foreign keys written inline, as table constraints or by `ALTER TABLE … ADD [CONSTRAINT …] FOREIGN KEY`, with name, on delete and on update; enums (`CREATE TYPE … AS ENUM`, MySQL inline `ENUM(…)`); `COMMENT ON TABLE / COLUMN` and MySQL `COMMENT '…'` clauses as notes.
- **FR-011**: DBML import MUST map: tables (with schema), columns and settings (`pk`, `increment`, `not null`, `null`, `unique`, `default`, `note`), `indexes` (composite, expressions, `unique`, `type`, `name`, `note`, `pk` as a composite primary key), `checks`, refs in every form (inline, short, long, named, composite, `<`, `>`, `-`, `<>`, optional `?` markers, `delete` / `update` actions), enums with value notes, table groups as groups, table and column notes, `headercolor` and table group `color` as the card or group colour (hex kept as given), top-level notes as stickies, and `Project` `database_type` as the dialect.
- **FR-012**: A default MUST be stored as a value when it is a string, number or boolean literal, and otherwise as an expression; never both.
- **FR-013**: A relationship's cardinality MUST be one-to-one when the referencing columns are unique (column flag, unique index or primary key on exactly those columns) and many-to-one otherwise, except DBML refs, which keep their written cardinality; a nullable referencing column MUST mark that end optional.
- **FR-014**: Every imported object (table, column, index, check, enum, enum value, relationship, group, sticky) MUST get a new stable id generated once at import; ids MUST NOT be derived from names (constitution III).
- **FR-015**: Names MUST be stored without quotes and as written. A table name repeated in the import (same schema), or one that already exists in the target deck (same schema, case-insensitive), MUST be added as a new table renamed `<name>_copy`, `<name>_copy_2`, … (the paste rule of 043, founder decision 2026-10-04). Both MUST be listed in the report.
- **FR-016**: A foreign key whose referenced table or column is not in the import MUST be skipped and listed in the report; 044 MUST NOT link imported tables to tables already in the deck.

**Skipped and changed**

- **FR-017**: Every statement or clause that is not mapped MUST be listed in the report with its first line number, a short excerpt and a reason: views, materialized views, functions, procedures, triggers, grants and revokes, policies, partitions, sequences, extensions, `INSERT` / `COPY` data, session settings, `DROP` / rename statements, and any unrecognised statement. Column options that are dropped (collation, generated expression, character set, storage) MUST be listed under "Changed". Nothing may be dropped without a report line (SC-005).

**Layout and placement**

- **FR-018**: Imported tables MUST be positioned by the deck's auto-layout off the main thread, clustered by DBML table group, or by schema when the import holds two or more schemas (each such schema becomes a group), so that no two imported cards overlap. Relationships MUST be laid out so connected tables sit near each other.
- **FR-019**: When the target deck or database card already holds cards, the imported cluster MUST be placed in free space beside the existing content without moving any existing card. Into a database card, imported tables (and their groups) MUST have that card as parent.
- **FR-020**: After import, the view MUST fit the imported tables.

**Applying, undo and report**

- **FR-021**: The whole import (dialect change, enums, tables, relationships, groups, stickies) MUST be applied as **one** change and **one** undo step; a toast "Imported n tables, n relationships, n enums" MUST offer Undo.
- **FR-022**: "New deck" MUST create a deck in the local library named after the file (without extension) or "Imported schema", open it and leave the current deck unchanged.
- **FR-023**: An **Import report** panel (frame 139) MUST open after import with: Mapped counts (tables, relationships, enums, indexes, groups, stickies), Skipped (line, excerpt, reason), Changed (conversions, renamed or duplicate names, dropped options), and Foreign keys by name. It MUST be reopenable from the toast and the deck ≡ menu until the deck is closed. The report MUST NOT be stored in the deck.

**Foreign keys by name**

- **FR-024**: With the option on, the import MUST suggest a relationship for a column that has no foreign key, whose name is `<name>_id` or `<name>Id`, where a table named `<name>`, its plural (`s`, `es`, `y` → `ies`) or its singular exists in the import with a single-column primary key, and where the column's type matches that key's type family (integer, text, uuid). It MUST NOT suggest a link from a table's own primary key to itself.
- **FR-025**: Suggestions MUST be shown only in the report; hovering or keyboard-focusing a suggestion MUST highlight its two tables and two column rows on the canvas, and no line MUST be drawn for a suggestion that is not accepted. Accept MUST add a relationship (cardinality and optional end as in FR-013) as one undo step; Dismiss MUST remove the suggestion; Accept all / Dismiss all MUST act on every open suggestion as one undo step. Suggestions MUST NOT be written to the deck until accepted.

**Privacy, performance, quality**

- **FR-026**: Parsing and mapping MUST run off the main thread, and the parser MUST be loaded only when the import dialog (or 046's DBML tab) needs it; it MUST NOT be part of the editor's initial download. Its download size MUST be measured and reported in the plan.
- **FR-027**: No network request MUST be made with the imported text or the resulting schema; the parser and everything it needs MUST be bundled (constitution IV; the no-third-party-requests check stays green).
- **FR-028**: Import MUST produce a deck that passes the model's load checks (no invalid file is ever written); the imported schema MUST round-trip through save and load unchanged.
- **FR-029**: A fixture corpus (Postgres, MySQL, SQLite and DBML, including quoted identifiers, schemas, comments, composite keys, cycles, `ALTER TABLE` keys, enums and unsupported statements) MUST have tests comparing the mapped schema to expected output; a 30-table Postgres dump MUST be among them. A DBML round-trip test MUST export the "Shop" fixture with 045's writer, import it and compare the schemas by name, and export again to byte-identical DBML.
- **FR-030**: The dialog, the dialect picker, the targets, the option, the report and its Accept / Dismiss actions MUST be operable by keyboard and have accessible names; the preview line and parse errors MUST be announced to screen readers.

### Key Entities

- **Import source**: the text (pasted or read from one file), its format (SQL or DBML), the detected and the chosen dialect, and the file name if any. Lives only while the dialog is open.
- **Import plan**: the result of parsing and mapping, before anything is written: the tables, columns, indexes, checks, enums, relationships, groups and stickies to add (with new ids and positions), the dialect to set, the type conversions, and the report entries. Produced off the main thread; applied in one change.
- **Import report**: mapped counts, skipped items (line, excerpt, reason), changed items, and foreign-key suggestions with their state (open, accepted, dismissed). Kept for the editor session, never stored in the deck.
- **Foreign-key suggestion**: a referencing column, a referenced table and key column, and the reason it matched; becomes a relationship only when accepted.
- **Deck schema** (040): where the import writes: deck dialect and enums, table nodes with columns, indexes and checks, relationship edges, groups, stickies.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A 30-table Postgres dump imports with every foreign key as a relationship between the right column rows and no two tables overlapping (the backlog's acceptance criterion).
- **SC-002**: A `CREATE VIEW` in the file appears in the report as skipped with its line number (the backlog's acceptance criterion).
- **SC-003**: DBML exported from "Shop" by 045 and imported again gives the same tables, columns, settings, indexes, checks, enums and relationships, compared by name, and exporting the imported deck gives byte-identical DBML (closes 045's SC-002).
- **SC-004**: A user goes from an empty deck to a laid-out diagram of a 30-table file in under 20 seconds and 4 actions (Import, drop, Import, done).
- **SC-005**: On the fixture corpus, every statement and clause of the source is either mapped or listed in the report: 0 silent drops.
- **SC-006**: For a 300-table, 3,600-column file, the preview line appears within 3 seconds and the import with layout finishes within 10 seconds, and the editor keeps responding to input throughout.
- **SC-007**: The editor's initial download does not grow by more than 5 KB because of import; the parser arrives only when the import dialog is first used.
- **SC-008**: No network request is made while importing (the existing no-third-party-requests check stays green).
- **SC-009**: One Undo after an import returns the deck to exactly its state before the import.
- **SC-010**: On the no-constraints fixture, "Detect foreign keys by name" finds every expected link and makes no suggestion where the target table or key does not exist.

## Assumptions

- **Parsers** (revised 2026-10-04, plan session, founder option D): DB6 named one parser for DBML and SQL; its full browser bundle is about 2.7 MB gzip and cannot be precached for offline use, and it reads no SQLite. 044 instead uses the DBML compiler from the same Apache-2.0 project for DBML and an Apache-2.0 SQL parser loaded per dialect for SQL, both loaded only when importing, behind a statement splitter of our own that gives line numbers and the skipped list. Versions, sizes and gaps: research R1–R3, ADR 0032. The DBML reader must read the `?` optional markers and the `checks` block written by 045 (ADR 0031).
- **Dialog look** follows frames 138 and 139 with `packages/ui` controls (§g-86); the dialog's title "Import SQL or DBML", subtitle "Paste statements or drop a .sql / .dbml file." Frame 166's dialog is not the reference (§g-91).
- **Entry points**: the empty-canvas card gains an Import action (frame 134) next to Add table when the Database pack is enabled; the Add flyout footer and the ≡ menu ("Import SQL or DBML…") are always available. The existing ≡ menu "Import" for `.sododeck.json` files is unchanged.
- **Type conversion on mismatch** reuses 045's common type list and its per-dialect equivalents; anything outside it is kept as written and listed. This is a subset of 043's dialect switch, applied only to the imported tables. When 043 lands, both use the same conversion table.
- **Enums** go to the deck's enum list (040); there is no enum card (frame 139's enum card is not built). An enum whose name already exists in the deck is added as a new enum and listed under "Changed".
- **Schemas → groups** (clarified 2026-10-04): a group per schema only when the import holds two or more schemas, so the common single-`public` case adds no group. DBML table groups take precedence over schemas. Imported groups are ordinary groups: Ungroup (⇧⌘G) removes one in one undo step and leaves its tables in place with their stored schema.
- **Colour**: DBML `headercolor` and table group colours are stored as the card or group colour exactly as written; the deck's colour field already accepts a custom hex value next to the named colours (schema `ColorRef`), so nothing is approximated.
- **Suggestion highlight** (clarified 2026-10-04): frame 139's dashed "suggested" lines are not built; a suggestion is reviewed in the report and highlighted on the canvas on hover / focus, using the existing table and row highlight. Suggestions are editor UI state, not document data (constitution I); they disappear when the deck is closed.
- **Name matching for suggestions** uses simple English plural rules (`s`, `es`, `y`/`ies`) and is case-insensitive; no dictionary of irregular plurals.
- **Undo** follows the existing document undo manager: the import is one transaction; Accept / Accept all are separate steps.
- **New-deck naming** follows the library's existing new-deck and duplicate-name rules (005).
- **Re-import** (matching tables by name and updating them) is 046's; 044 always adds.
- **Size limit** of 5 MB covers schema dumps of several thousand tables while keeping parsing within the performance targets; the plan confirms the figure.
