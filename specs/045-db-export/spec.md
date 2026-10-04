# Feature Specification: Schema Export

**Feature Branch**: `045-db-export`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "045 from docs/backlog-database.md" — The schema leaves Sododeck as runnable SQL and as text other tools read: export menu entries and a preview with Copy / Download for SQL DDL (Postgres, MySQL, SQLite; tables ordered so foreign keys resolve, or constraints added after), DBML, Mermaid `erDiagram` and a Markdown data dictionary (per table: columns, types, keys, notes; relationships list); scope is the selection, the whole schema or one database card; n–n writes a junction table; lint errors (047) warn before export.

**Sources**: `docs/backlog-database.md` §045 (scope, draft acceptance criteria), §044 (import and DB6 parser, the round-trip partner), §043 (type lists per dialect, Deck settings Database section, "Block SQL export with errors"), §047 (lint), §049 ("Export SQL" from a database card); founder decisions DB2 (SQL DDL and DBML, both ways), DB5 (no code, assets or copy from other tools), DB6 (parser lazy-loaded in a worker), DB10 (n–n exports as a junction table), DB11 (one dialect per deck; Generic asks which dialect at SQL export); `specs/040-db-schema-model/` (columns, indexes, checks, enums, relationship fields, deck dialect); `specs/041-db-table-card/` and `specs/042-db-relationships/` (what a table and a relationship look like to the user); `specs/012-export/` and ADR 0016 (the export dialog: format list, scope, preview, Copy / Download, file names, "nothing is uploaded"); design-analysis §a frame 145 (export dialog with the Schema section), §g-88 (no tool name in the DBML subtitle), §g-91 (take the export dialog from 145, not 166); DESIGN.md `export-dialog`; constitution v1.0.0 (principles I, II, IV, V, VI, VIII).

**Dependency note (2026-10-04)**: 040 (model) and 041 (table card) are merged; 042 (relationships) is specified and planned. The backlog lists 045 as depending on 040 only. **044 (import), 043 (editing, type lists, Deck settings Database section) and 047 (lint) are not built.** 045 must therefore stand on its own: it writes text from the model, it does not need the canvas gestures of 042 or 043, and it plugs into 047's problems when 047 lands (see Assumptions).

## Scope

**In scope**

- A **Schema** section in the existing export dialog (012), shown when the deck holds at least one table: **SQL** (in the deck's dialect), **DBML**, **Mermaid ER** and **Data dictionary**, above the existing image and data formats.
- **Scope** for schema formats: Selection, one database card (its tables), Whole deck.
- **SQL DDL** for Postgres, MySQL and SQLite: schemas, enums, tables, columns with every stored setting, primary keys (single and composite), unique, not null, defaults, auto-increment, column and table checks, indexes (columns and expressions, unique, method), foreign keys with on delete / on update, notes as comments; tables ordered so foreign keys resolve, and foreign keys added after the tables when a cycle makes that impossible.
- **Generic deck**: SQL export first asks for Postgres, MySQL or SQLite.
- **n–n relationships** written as a junction table in SQL (option, on by default); written as a many-to-many in DBML and Mermaid; listed as many-to-many in the data dictionary.
- **Options**: include enums and indexes; write junction tables for n–n; `IF NOT EXISTS`.
- **DBML** export of tables, columns and settings, indexes, enums, relationships (single and composite, with actions), notes and schemas.
- **Mermaid `erDiagram`** export: entities, attributes with type and key markers, relationships with cardinality.
- **Markdown data dictionary**: one section per table (columns, types, keys, nullability, defaults, notes, indexes, checks), an enums section and a relationships list.
- **Preview** with line numbers, **Copy**, **Download** with the right file extension, and an **export notes** strip listing what the writer had to skip or change (e.g. a foreign key to a table outside the scope).
- **Problems hook**: when the deck's problems list holds database problems for tables in scope (040's kinds today, 047's later), the dialog shows them above the preview with "Show problems".

**Out of scope**

- Migrations (`ALTER` scripts from a diff), other dialects (MariaDB, SQL Server, Oracle), an HTML documentation site.
- Import of SQL or DBML (044), the editable DBML code panel (046).
- The lint rules themselves and the "Block SQL export with errors" deck setting (047, 043); 045 only shows what 047 reports.
- Type conversion between dialects as an edit of the deck (043); export never changes the deck.
- "Export SQL" as a menu item on a database card (049); 045 offers the database card as a scope inside the dialog.
- PDF export and the Mermaid flowchart export of the whole deck (deferred from 012).
- Views, functions, triggers, sample rows, custom types (not in the model).

## Clarifications

### Session 2026-10-04

The founder asked to compare each answer with how an established open-source schema tool handles the same case (behaviour only; no code or copy taken, DB5). Findings are in Assumptions under "Reference review".

- Q: On a Generic deck, are column types written exactly as stored at SQL export, or translated to the chosen dialect? → A: Translate a small common type list (with common aliases) to the chosen dialect; any other type is written as stored and listed in the export notes. Never replaced silently.
- Q: How are the SQL and DBML outputs verified? → A: Golden files for all four formats, plus tests that execute the exported SQL on in-process Postgres and SQLite engines (test-only dependencies, approved by the founder; recorded in the plan). MySQL stays on golden files. The DBML round-trip test is added by 044 when the parser lands.
- Q: What happens to a foreign key whose other table is outside the export scope? → A: The constraint is left out, the column is kept, and it is listed in the export notes and as a comment in the script.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Export runnable SQL in the deck's dialect (Priority: P1)

An engineer has designed the "Shop" schema in a Postgres deck. They open Export, pick SQL, see the script in the preview, press Download and run the file against a fresh Postgres database. Every table, key, index and enum is created without errors.

**Why this priority**: runnable SQL is the reason to design a schema in a diagram tool at all; without it, the diagram is a picture.

**Independent Test**: export the "Shop" deck as Postgres, MySQL and SQLite and run each script on a clean database of that engine (Postgres and SQLite executed in tests, MySQL by golden file; FR-023); every statement succeeds and the resulting catalogue has the expected tables, columns, keys and indexes.

**Acceptance Scenarios**:

1. **Given** a Postgres deck with the "Shop" schema, **When** the user opens Export and picks SQL, **Then** the preview shows a Postgres script whose first line names the deck, scope and dialect, and the dialect chip reads "Postgres · deck dialect".
2. **Given** `orders.customer_id` references `customers.id` with on delete cascade, **When** SQL is written, **Then** `customers` is created before `orders` and the foreign key carries `ON DELETE CASCADE`.
3. **Given** two tables that reference each other, **When** SQL is written, **Then** both tables are created without those foreign keys and the foreign keys are added afterwards, so the script runs.
4. **Given** a composite primary key `(order_id, product_id)` and a composite foreign key to it, **When** written, **Then** the key and the reference list the columns in stored order.
5. **Given** a column using the enum `order_status`, **When** written for Postgres, **Then** the enum type is created before the table; for MySQL the column uses an inline enum of the same values; for SQLite the column is text with a check limiting it to those values.
6. **Given** a column with `default 'pending'` (a value) and another with `default now()` (an expression), **When** written, **Then** the value is quoted as a literal and the expression is written as is.
7. **Given** a table in schema `billing`, **When** written for Postgres, **Then** the schema is created and names are qualified; for SQLite the schema is dropped and an export note says so.
8. **Given** a table or column name that is a reserved word or needs quoting (e.g. `order`, `User Name`), **When** written, **Then** it is quoted in the dialect's way and the script still runs.
9. **Given** the user presses Download, **When** the file is saved, **Then** it is named after the deck and scope with the `.sql` extension and contains exactly the preview's text; Copy puts the same text on the clipboard.

---

### User Story 2 - Choose what to export (Priority: P1)

The architect's deck holds the whole platform: an Orders DB card with nine tables and a Users DB card with four. They want only Orders DB as SQL, then only three selected tables as a dictionary for a ticket.

**Why this priority**: real decks hold more than one database and more than tables; exporting everything at once is rarely what is wanted.

**Independent Test**: with two database cards and a selection of tables, switch scopes and check which tables each output holds.

**Acceptance Scenarios**:

1. **Given** the user has selected three tables, **When** they open Export on a schema format, **Then** the scope is Selection and only those three tables are written.
2. **Given** the user is drilled into Orders DB or has selected the Orders DB card, **When** they open Export on a schema format, **Then** a scope named after the card ("Orders DB") is offered and selected, and it writes the tables inside that card.
3. **Given** Whole deck, **When** written, **Then** every table in the deck is written, whatever card holds it.
4. **Given** a selection that mixes tables and other cards, **When** written, **Then** only the tables are written and the non-table cards are ignored without a note.
5. **Given** a selection with no tables, **When** a schema format is chosen, **Then** the Selection scope is disabled with a hint and the default falls back to the next scope.
6. **Given** a foreign key from a table in scope to a table out of scope, **When** written, **Then** the column is written without that constraint and the export notes list it (FR-019).
7. **Given** an enum used only by tables out of scope, **When** SQL is written, **Then** that enum is not written.

---

### User Story 3 - Export DBML (Priority: P2)

A developer keeps the schema in a repository as DBML. They export DBML from the deck and commit it; later 044 imports that file back into another deck with the same schema.

**Why this priority**: DBML is the deck's code format (DB2) and the round-trip partner of 044 and 046, but SQL already covers running the schema.

**Independent Test**: export "Shop" as DBML and compare with a golden file; when 044 is merged, its round-trip test imports it and compares the schema.

**Acceptance Scenarios**:

1. **Given** the "Shop" deck, **When** DBML is chosen, **Then** the preview shows one `Table` block per table with columns, settings (pk, increment, not null, unique, default, note), an `indexes` block where the table has indexes, `Enum` blocks, and `Ref` lines for every relationship with its cardinality and actions.
2. **Given** a composite relationship, **When** written, **Then** the `Ref` lists both column groups in order.
3. **Given** an n–n relationship, **When** written, **Then** it is written as a many-to-many reference, not as a junction table.
4. **Given** table, column and enum notes, **When** written, **Then** each appears as a note in the right place, with quotes and line breaks escaped.
5. **Given** a table in schema `billing`, **When** written, **Then** its name is qualified as `billing.<name>`.
6. **Given** Download, **When** pressed, **Then** the file ends in `.dbml`.

---

### User Story 4 - Export a data dictionary (Priority: P2)

A product manager needs a readable description of the Orders database for a design review. The architect exports a data dictionary and pastes it into the team's wiki.

**Why this priority**: documentation is a common need but not required to run the schema.

**Independent Test**: export the dictionary for "Shop" and render the Markdown; every table, column, key, note and relationship appears once and reads correctly.

**Acceptance Scenarios**:

1. **Given** the "Shop" deck, **When** Data dictionary is chosen, **Then** the Markdown has a title with the deck name, scope and dialect (the dialect is left out on a Generic deck), then one section per table in a stable order (schema, then name) with its note and a column table: name, type (with size), key (PK / FK / unique), nullable, default, note.
2. **Given** a table with indexes and checks, **When** written, **Then** they are listed under the table's column table.
3. **Given** the deck has enums in scope, **When** written, **Then** an Enums section lists each enum with its values and notes.
4. **Given** relationships in scope, **When** written, **Then** a Relationships section lists each as "orders.customer_id → customers.id · many to one · on delete cascade", with its name when it has one.
5. **Given** a note containing `|`, a line break or Markdown characters, **When** written, **Then** the table still renders as one row and the text is shown as typed.
6. **Given** Download, **When** pressed, **Then** the file ends in `.md`.

---

### User Story 5 - Export a Mermaid ER diagram (Priority: P3)

A developer wants the schema in a pull request description where ER diagram text renders automatically. They export Mermaid ER and paste it.

**Why this priority**: a convenient extra format; SQL, DBML and the dictionary cover the main needs.

**Independent Test**: export "Shop" as Mermaid ER and render it with a Mermaid renderer offline in a test; it parses and shows every table and relationship.

**Acceptance Scenarios**:

1. **Given** the "Shop" deck, **When** Mermaid ER is chosen, **Then** the text starts with `erDiagram`, has one entity per table with attributes "type name" plus PK / FK / UK markers, and one relationship line per relationship with the matching cardinality symbols and its name (or the column list) as the label.
2. **Given** a name with characters Mermaid does not accept in an entity or attribute (spaces, dots, quotes), **When** written, **Then** it is written in a form Mermaid accepts and the original name is kept as an alias or comment.
3. **Given** a relationship with no cardinality, **When** written, **Then** it is written as one-to-many from the referenced table (the common case) and an export note says so.
4. **Given** Download, **When** pressed, **Then** the file ends in `.mmd`.

---

### User Story 6 - See problems and notes before exporting (Priority: P3)

The engineer exports SQL from a deck where `audit_log` has no primary key and a foreign key points at a table outside the scope. The dialog shows the problems (once 047 exists) and the export notes, so they know what the script will and will not do before running it.

**Why this priority**: prevents surprises, but the export works without it.

**Independent Test**: export a deck with a foreign key out of scope, an n–n with junction tables off, and a SQLite deck with a schema; the notes list each case.

**Acceptance Scenarios**:

1. **Given** the writer skipped or changed something (foreign key out of scope, schema dropped for SQLite, relationship with column lists of different length, enum not found, empty column type), **When** the preview shows, **Then** an export notes strip lists each item in one line, and the script holds a comment at the same place.
2. **Given** the deck's problems list holds schema errors (047), **When** a schema format is chosen, **Then** a banner "n errors in <scope>" lists them and "Show problems" closes the dialog and opens the Problems list; export still works unless the deck setting blocks SQL export (047 / 043).
3. **Given** no problems and no notes, **When** the preview shows, **Then** neither the banner nor the strip is shown.

### Edge Cases

- **No tables in scope** (e.g. Whole deck of an architecture-only deck): the Schema section is hidden when the deck has no tables; when only the scope is empty, the preview shows "No tables in this scope" and Copy / Download are disabled.
- **Generic deck, SQL**: the dialect chip turns into a picker (Postgres, MySQL, SQLite) that must be set before the preview shows; the choice is remembered for the dialog session only and never changes the deck (DB11, 043 owns the deck setting). Types in the common type list are translated; other types are written as stored and listed in the notes (FR-007).
- **DBML, Mermaid and dictionary on a Generic deck** need no dialect and write types as stored.
- **Column with an empty type**: written with a placeholder type for the dialect and listed in the notes, so the script still parses.
- **Stale ids** (an index, foreign key or enum reference naming nothing, kept by 040): the part is skipped and listed in the notes; the rest is written.
- **Composite relationship with lists of different length** (allowed by 040, flagged by 047): skipped in SQL and DBML with a note; listed in the dictionary as stored.
- **Self-reference**: written as a foreign key on the same table; never forces the "add constraints after" path on its own.
- **Two foreign keys between the same tables**: both written, each with its own constraint name.
- **Duplicate table names in scope** (same schema): written as stored with a note; 047 reports it.
- **Junction table name clash**: when the default junction name is already a table in scope, a numeric suffix is added and a note says so.
- **Very large schema** (150 tables, 1,800 columns): the preview stays responsive while the text is produced; Copy and Download give the full text.
- **Notes with comment terminators or quotes**: escaped so the script, DBML and Markdown stay valid.
- **Mixed tables and non-table cards in Whole deck**: only tables are written; architecture cards, flows and stickies never appear in schema formats.
- **Non-table cards, flows and rules**: the existing JSON, PNG and SVG exports are unchanged.

## Requirements _(mandatory)_

### Functional Requirements

**Dialog and scope**

- **FR-001**: The export dialog MUST show a **Schema** section (SQL, DBML, Mermaid ER, Data dictionary) above the existing formats when the deck holds at least one table, and MUST NOT show it otherwise. Subtitles name no other tool (§g-88).
- **FR-002**: Schema formats MUST offer the scopes Selection (enabled when the selection holds at least one table), the database card in context (when one is selected or drilled into; labelled with the card's name) and Whole deck. The default MUST be the first enabled scope in that order.
- **FR-003**: A scope MUST write only tables (nodes of the table type); other nodes are ignored. "Database card" scope MUST write the tables whose parent is that card.
- **FR-004**: Each schema format MUST show a preview with line numbers, a file name built from the deck and scope with the format's extension (`.sql`, `.dbml`, `.mmd`, `.md`), its size, **Copy** and **Download**; the downloaded file and the copied text MUST equal the preview's full text.
- **FR-005**: The dialog MUST keep the "generated in your browser, nothing is uploaded" promise: no network request is made with the schema.
- **FR-006**: Producing an export MUST NOT change the deck (no undo step, no autosave).

**SQL**

- **FR-007**: SQL MUST be written in the deck's dialect; a Generic deck MUST ask for Postgres, MySQL or SQLite before writing, without changing the deck's dialect. On a Generic deck, a column whose type (case-insensitive, with common aliases such as `integer`, `int4`, `bool`, `character varying`) is in the **common type list** (int, smallint, bigint, decimal / numeric, float, double, real, char, varchar, text, boolean, uuid, date, time, timestamp, datetime, json, binary / blob) MUST be written as that type's equivalent in the chosen dialect, keeping its size; any other type MUST be written as stored and listed in the export notes. Decks with a real dialect MUST write types as stored.
- **FR-008**: SQL MUST write, per dialect: schemas (Postgres creates them; MySQL creates the matching database and qualifies names; SQLite drops them with a note), enums (Postgres enum types; MySQL inline enum; SQLite text with a check), tables, columns with type and size, primary keys (single and composite, stored column order), not null, unique, defaults (values as literals, expressions as written), auto-increment in the dialect's form, column and table checks, indexes (column and expression parts, unique, method when the dialect supports it), foreign keys with on delete / on update, and notes as comments in the dialect's form.
- **FR-009**: Tables MUST be ordered so every foreign key refers to an already-created table, with foreign keys written inside the table. For Postgres and MySQL, when cycles make that impossible, the foreign keys in the cycle MUST be added after all tables (`ALTER TABLE … ADD`). For SQLite, foreign keys MUST always be written inside the table: SQLite cannot add them later and does not require the referenced table to exist at creation, so the script runs in any order.
- **FR-010**: Identifiers MUST be quoted in the dialect's way when they are reserved words or not plain lower-case identifiers; otherwise they MUST be written unquoted.
- **FR-011**: An n–n relationship MUST be written as a junction table when "Write junction tables for n–n" is on (default on): named from the two tables, with one column per key column of each side (named `<table>_<column>`, typed like the referenced column), a composite primary key of all of them and a foreign key to each side. When off, the relationship MUST be skipped with a note.
- **FR-012**: Options "Include enums and indexes" (default on) and "IF NOT EXISTS" (default off) MUST change the output accordingly; options apply to SQL only.
- **FR-013**: The script MUST start with a header comment naming the deck, the scope and the dialect, and MUST be deterministic: the same deck, scope and options always give byte-identical text.

**DBML, Mermaid, dictionary**

- **FR-014**: DBML MUST hold every table (qualified by schema when it has one), column with its settings, index, enum and relationship in scope, including composite references, n–n references, referential actions and notes, with strings escaped. Its tables, columns and references MUST NOT depend on the deck's dialect; a deck with a real dialect MAY name it in a project header.
- **FR-015**: Mermaid ER MUST start with `erDiagram`, write one entity per table and one relationship line per relationship using the matching cardinality symbols (exactly one, zero or one, one or many, zero or many) and write names Mermaid cannot accept in a safe form.
- **FR-016**: The data dictionary MUST be Markdown with a title, one section per table (note, column table with name, type, key, nullable, default, note; then indexes and checks), an Enums section and a Relationships section, with table cell content escaped so tables render.
- **FR-017**: DBML, Mermaid ER and the data dictionary MUST list tables in a stable order (schema, then name, then id). SQL MUST list tables in dependency order (FR-009), breaking ties by schema, then name, then id. All formats MUST list columns in stored order.

**Notes and problems**

- **FR-018**: Whenever the writer skips or changes part of the schema (foreign key to a table out of scope, schema dropped, stale reference, length-mismatched composite relationship, empty type, junction name clash, relationship without cardinality in Mermaid), it MUST list the item in an export notes strip above the preview and, for SQL and DBML, as a comment at that place.
- **FR-019**: A foreign key whose other table is outside the scope MUST be left out of SQL and DBML (the column itself is kept), listed in the export notes and, in SQL and DBML, written as a comment where it would have been. Mermaid and the dictionary MUST leave the relationship out and the dictionary MUST mention it under the table ("references billing.accounts, not in this export").
- **FR-020**: When the deck's problems list holds database problems (the kinds 040 reports today, such as a dangling reference or a composite length mismatch, plus 047's rules when they land) for tables in scope, the dialog MUST show a banner with the count, the first problems and a "Show problems" action; with no such problems the banner MUST NOT show. Blocking SQL export is 047 / 043's setting and is honoured when present.

**Quality, access, performance**

- **FR-021**: Writers MUST be pure functions of the deck model (no canvas, no layout), so they can be tested without a browser and reused by 046 and 049.
- **FR-022**: Writing a 150-table, 1,800-column schema MUST NOT freeze the editor; the preview MUST show "Preparing…" while the text is produced.
- **FR-023**: Every format MUST have golden-file tests on the "Shop" deck and an edge-case deck. The Postgres and SQLite outputs MUST also be executed in tests on in-process engines of those databases (test-only dependencies, never shipped to users), checking that every table, column, key, index and enum exists afterwards. MySQL output is checked by golden files. The DBML round-trip test is 044's.
- **FR-024**: Format list, scope control, options, notes strip and banner MUST be reachable and operable by keyboard and have accessible names; the preview MUST be readable by screen readers as text.

### Key Entities

- **Schema export request**: format (SQL, DBML, Mermaid ER, Data dictionary), scope (Selection, database card, Whole deck), dialect (from the deck, or picked for a Generic deck), options (enums and indexes, junction tables, IF NOT EXISTS). Lives only while the dialog is open.
- **Export result**: the full text, file name, size and the list of export notes.
- **Export note**: one skipped or changed item, with the table / column it concerns and a short reason.
- **Schema in scope**: the tables, their columns, indexes and checks, the enums they use and the relationships between them, read from the deck model (040).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The Postgres SQL exported from "Shop" runs without errors on a clean Postgres 16 database, the SQLite export runs on SQLite (both verified by automated tests), and the MySQL export runs on a MySQL 8 database (verified by a golden file plus one manual run before release), creating every table, column, key, index and enum of the deck (the backlog's acceptance criterion).
- **SC-002**: DBML exported from "Shop" and imported again (once 044 exists) gives the same tables, columns, settings, indexes, enums and relationships, compared by name (the backlog's acceptance criterion).
- **SC-003**: A user goes from opening Export to a downloaded `.sql` file for one database card in under 15 seconds and 4 clicks.
- **SC-004**: For a 150-table, 1,800-column schema, the preview of any schema format appears within 2 seconds and the editor stays responsive while it is produced.
- **SC-005**: Exporting the same deck, scope and options twice gives byte-identical files for all four formats.
- **SC-006**: Every case where the output differs from the deck (skipped or changed part) is listed in the export notes: 0 silent drops on the edge-case fixture deck.
- **SC-007**: The Mermaid ER and data dictionary outputs of "Shop" render without errors in a standard Mermaid and Markdown renderer.
- **SC-008**: No network request is made while exporting (the existing no-third-party-requests check stays green).

## Assumptions

- **Dialog placement** follows frame 145: Schema section first, then "Image and data" (the existing JSON, PNG, SVG; PDF only when 012's follow-up ships). Format subtitles: SQL "In the deck dialect · <dialect>", DBML "Database markup" (§g-88), Mermaid ER "erDiagram for docs", Data dictionary "Markdown, one section per table".
- **Database card scope** uses the card's `parent` link (040, DB7); nested database cards are not expected. "Export SQL" from the card's own menu stays with 049.
- **Generic dialect choice** is per dialog session, not stored; changing the deck's dialect is 043's.
- **Junction table naming** uses `<from table>_<to table>` in relationship direction; key columns `<table>_<column>`; matches frame 145 (`product_categories (product_id, category_id)`) where table names are singularised only if the user already named them that way (no automatic singularising).
- **Auto-increment and identity forms**, index method support and comment syntax per dialect are decided in the plan from each engine's documentation; the spec only requires that the script runs.
- **Relationship direction** (040): `from` is the referencing table and `fromColumns` the foreign key columns, `to` the referenced table; cardinality is read from → to.
- **Problems banner** reads the problems list's database kinds: 040's today, 047's added later with no change to 045, so 045 ships without depending on 047.
- **Writers live in the app** (they are export logic, not file-format conversion); `@sododeck/model` stays the only Yjs ↔ JSON path, and writers read the plain JSON snapshot the export dialog already uses.
- **Reference review** (2026-10-04, founder request; behaviour only, nothing copied, DB5): the reviewed tool keeps a fixed generic type list (~26 types) and maps it per target when exporting, but silently falls back to a catch-all type for anything it cannot map (e.g. JSON or BLOB). Sododeck's column types are free text (040), so 045 maps only a common list and **lists** every unmapped type in the notes instead of replacing it. The tool writes all foreign keys after all tables for Postgres / MySQL (always runs, but harder to read); 045 keeps inline foreign keys in dependency order, as frame 145 shows, and uses `ALTER TABLE` only for cycles. For SQLite it writes foreign keys inline in any table order, which works because SQLite does not check the referenced table at creation; 045 does the same (FR-009). Useful per-dialect equivalents it confirms: uuid → `char(36)` on MySQL and `text` on SQLite; enum → a created type on Postgres, inline enum on MySQL, text with a check on SQLite; SQLite collapses types to integer, real, text and blob. Its exports cover the whole diagram only (no selection scope), its Mermaid output has no optional sides or key markers, and the repository has no export tests, so FR-015, FR-019 and FR-023 go further.
- **Test engines**: the in-process Postgres and SQLite engines are dev dependencies used only by tests (founder approval 2026-10-04); they are not runtime dependencies and the app bundle does not change.
- **No new runtime dependency** is needed to write any of the four formats; the DB6 parser is only needed for import (044) and for round-trip tests once 044 adds it.
