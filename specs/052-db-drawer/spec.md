# Feature Specification: Database Details Drawer

**Feature Branch**: `052-db-drawer`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "52 from docs/backlog-database.md". The details drawer for the Database pack: table tabs (General, Columns with the dialect type picker and enum picker, Indexes, Checks), the relationship drawer (composite column ends, cardinality, optional sides, on delete / on update, name, colour), the enum editor with the Enum tile and "Add enum", dialect type lists and conversion with an Undo toast, and the Deck settings Database section (dialect, block SQL export with errors). Builds on 043's canvas editing (`specs/043-db-editing`); every edit is one undo step.

**Sources**: `docs/backlog-database.md` §052 (scope, draft acceptance criteria), founder decisions DB7, DB8, DB10, DB11; `specs/043-db-editing/` (the canvas half of the old 043: line editor, context menus, "Edit details" opening today's inspector, relationship quick settings, lock, Add flyout Database tab; its Out of scope list is this feature); `specs/040-db-schema-model/` (columns, indexes, checks, enums and enum values, relationship fields, deck dialect, cascades, stable ids, database problems); `specs/041-db-table-card/` (enum chip and its values popover, enum colour, deck display settings); `specs/042-db-relationships/` (cardinality ends, type-mismatch comparison); `specs/045-db-export/` (problems banner, "blocking is honoured when present"); `specs/018-canvas-first-layout/` (details drawer frame, deck mode); `specs/020-card-style/`, `specs/033-deck-tag-colours/` (colour, owner, tags, links fields); DESIGN.md "Database pack"; design-analysis §a frames 135, 136, 150–154, 164, 165 and §g-84 (dialect confirm uses the shared confirm dialog), §g-85 (only the Database section of Deck settings is new), §g-86 (shared switch, checkbox, segmented control, dialog); constitution v1.0.0.

**Dependency note (2026-10-04)**: 040, 041, 042, 043, 044, 045 and 046 are merged; 018, 020 and 033 are merged. 047 (lint) is not merged: "errors" below means the database problems the Problems list already reports (040's kinds), plus 047's rules once they land.

## Scope

**In scope**

- **Table drawer** (frames 164, 135) with four tabs:
  - **General**: name, schema, colour, note, owner, tags, links.
  - **Columns**: every column as a row that expands to all its settings: name, type from the deck dialect's type picker with size / precision, enum picker, primary key, not null, unique, auto-increment, default (value or expression), check, note. Add, delete and reorder columns.
  - **Indexes**: each index with its parts as chips (a column or an expression; add, remove, reorder), unique, method from the dialect's list, name and note. Add and delete indexes.
  - **Checks**: each table check with its name and expression. Add and delete checks.
- **Relationship drawer** (frames 136, 164): from and to columns as ordered lists (composite ends), cardinality as a choice drawn with its ends (1–1, 1–n, n–1, n–n), optional side at each end, on delete and on update actions, name and colour.
- **Enum editor** (frame 165): name, schema, colour, note, values (add, rename, note, reorder, delete), and a "used by" list of the columns that use the enum. Entry points: the Add flyout's **Enum** tile, the canvas menu's **Add enum**, the enum picker's "New enum…" and "Edit enum", and "Edit enum" on the enum chip's values popover.
- **Dialect type lists**: the types offered for Generic, Postgres, MySQL and SQLite, and the index methods per dialect, kept as data in the app.
- **Dialect conversion**: changing the deck's dialect converts column types through a conversion table. A confirm dialog lists the conversions first (frame 153); after confirming, every table updates and a toast offers Undo (frame 154).
- **Deck settings Database section** (frames 151, 152): dialect select with a hint per option, a "Block SQL export with errors" switch, the list of the deck's enums (each opens the enum editor), next to the table and relationship display settings already built by 041 / 042.
- **Format addition** (additive): one optional deck-level flag for blocking SQL export with errors.

**Out of scope**

- SQL / DBML text import, export and the code panel (044–046); this feature only honours the block flag in the existing export dialog.
- Lint rules and new problem kinds (047).
- Custom or composite types, SQL views, sample rows.
- An enum card on the canvas (dropped in 040's clarify).
- The database card's dialect chip and drill-in (049).
- Changing the type of the other end of a relationship automatically (043 decided: show the mismatch, never fix it).

## Clarifications

### Session 2026-10-04

- Q: When the deck's dialect changes and some columns need a new type, what is the flow? → A: A confirm dialog lists the conversions; confirming applies them and shows a toast with Undo. With nothing to convert there is no dialog.
- Q: When an enum is renamed, does the type text of the columns linked to it follow? → A: Yes. Renaming an enum also sets the type text of every linked column to the new name, in the same undo step.
- Q: Can the type picker take a type that is not in the deck dialect's list? → A: Yes. It is kept as written and marked "not in the <dialect> list"; no warning on the card and no problem (type checking is 047's lint).
- Q: With "Block SQL export with errors" on, which problems block SQL export? → A: Only database problems at error severity on tables inside the export scope. Warnings, and errors on tables outside the scope, never block.
- Q: When an enum that columns use is deleted, what type do those columns keep? → A: The link is removed and the type text (the old enum name) is kept as written; the confirm dialog says so. Undo restores the enum and the links.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit every column setting in the Columns tab (Priority: P1)

A user selects `orders`, picks "Edit details" from its menu and switches to Columns. They expand `total`, open the type picker, see Postgres types grouped (numbers, text, date and time, other), pick `numeric`, set size 10 and precision 2, mark it not null, set the default to `0` and add a note "Gross, in cents". For `status` they open the enum picker and choose `order_status`. Each change shows on the canvas at once and each is undone by one ⌘Z.

**Why this priority**: The line editor (043) covers name, type and flags; check, note, size / precision with a picker, and enum links have no complete editing surface until this tab exists. It is the core of the drawer.

**Independent Test**: On the "Shop" deck, change one column's type, size, precision, default, check and note from the Columns tab. The table card and the JSON panel show every change, and six ⌘Z restore the original column.

**Acceptance Scenarios**:

1. **Given** a selected table, **When** the user picks "Edit details" (or presses ⏎), **Then** the drawer opens on the table's **General** tab.
2. **Given** the Columns tab, **When** the user changes a column's type in the type picker, **Then** the column's type changes on the card, and one ⌘Z restores the previous type.
3. **Given** a Postgres deck, **When** the type picker opens, **Then** it lists the Postgres types grouped by kind, filters as the user types, and shows size / precision fields only for types that take them.
4. **Given** a column whose type is not in the dialect's list (e.g. imported `citext`), **When** the tab shows it, **Then** the type is kept as written and marked "not in the Postgres list"; the user can still keep it.
5. **Given** the enum picker, **When** the user picks an enum, **Then** the column links to that enum and the card shows the enum chip; picking "No enum" removes the link and keeps the type text.
6. **Given** a default field, **When** the user switches it between Value and Expression, **Then** the default is stored as that kind, and the card and exports treat it accordingly.
7. **Given** the Columns tab, **When** the user adds, deletes or drags a column to a new place, **Then** the card matches, deletion shows 043's Undo toast with the removed relationship count, and each action is one undo step.
8. **Given** a column row's context menu on the canvas, **When** the user picks "Edit details", **Then** the drawer opens on Columns with that column expanded and its name field focused. ("Edit" keeps opening 043's in-row line editor.)

---

### User Story 2 - Edit a relationship, including composite ends (Priority: P1)

A user selects the relationship from `order_items` to `products` and opens its details. The drawer shows From `order_items` (`product_id`) and To `products` (`id`), the cardinality n–1 drawn with its ends, optional sides, on delete "restrict", on update "no action", no name and the default colour. They name it `fk_items_product`, set on delete to "cascade", and add a second column pair to make a composite end. The connector redraws on both rows.

**Why this priority**: Composite ends and relationship names have no other editing surface; the canvas only builds single-column relationships (043).

**Independent Test**: Turn a single-column relationship into a composite one with two column pairs and name it. The JSON panel shows both column lists in order and the name, and one ⌘Z per change undoes it.

**Acceptance Scenarios**:

1. **Given** a selected relationship, **When** the user opens its details, **Then** the drawer shows its from table and columns, to table and columns, cardinality, optional sides, on delete, on update, name and colour.
2. **Given** the from / to column lists, **When** the user adds a column pair, removes one or reorders them, **Then** the relationship's ends change to match, and the connector still attaches to the first column row at each end.
3. **Given** from and to lists of different lengths, **When** the drawer shows them, **Then** a warning reads "From has 2 columns, To has 1" and the Problems list reports the mismatch (040).
4. **Given** the cardinality choice, **When** the user picks n–n, **Then** both ends draw the many mark and a hint says SQL export writes a junction table (DB10).
5. **Given** the on delete or on update select, **When** the user picks an action (no action, restrict, cascade, set null, set default), **Then** the relationship stores it; "Not set" removes the stored value.
6. **Given** an end column of another type than its partner, **When** the drawer shows the pair, **Then** the pair shows 043's (!) type mismatch with both types.

---

### User Story 3 - Change the deck's dialect with conversion and Undo (Priority: P1)

A user opens Deck settings from the ≡ menu and scrolls to Database. The deck is Postgres. They open the dialect select, read the hint "MySQL: types like int, varchar(n), datetime", and pick MySQL. A dialog lists what will change, "serial → int auto_increment (orders.id) · timestamptz → timestamp (4 columns) · jsonb → json (1 column) · uuid → char(36) (3 columns)", and what is kept as written. They confirm. Every table shows the new types and a toast reads "Converted 9 columns to MySQL · Undo".

**Why this priority**: DB11 makes the dialect a deck-wide choice; without conversion a dialect change leaves types the target database rejects.

**Independent Test**: Switch the "Shop" deck from Postgres to MySQL. The dialog lists every changed column, the cards show converted types, and one Undo (toast or ⌘Z) brings back the Postgres types and the Postgres dialect.

**Acceptance Scenarios**:

1. **Given** Deck settings, **When** the user opens the Database section, **Then** it shows the dialect select (Generic, Postgres, MySQL, SQLite, each with a one-line hint), the "Block SQL export with errors" switch, the deck's enums, and the display settings from 041 / 042.
2. **Given** a deck with columns whose types differ in the target dialect, **When** the user picks another dialect, **Then** a confirm dialog lists each conversion with the columns it affects, and lists the types kept as written.
3. **Given** the confirm dialog, **When** the user cancels, **Then** the dialect and every type stay unchanged.
4. **Given** the confirm dialog, **When** the user confirms, **Then** the dialect and all converted types change together, and a toast names the number of converted columns with Undo.
5. **Given** that toast, **When** the user clicks Undo or presses ⌘Z once, **Then** the dialect and every converted type return to their previous values.
6. **Given** a deck with no column needing conversion (or no tables), **When** the user picks another dialect, **Then** it changes without a dialog, and the toast reads "Dialect set to MySQL · Undo".

---

### User Story 4 - Create and edit enums (Priority: P2)

A user presses the Enum tile in the Add flyout's Database tab. The drawer opens on a new enum `enum_1` with its name selected. They name it `payment_status`, add values `pending`, `paid`, `failed` and `refunded`, give `failed` the note "card declined or timeout", and drag `refunded` above `failed`. In `payments`, they pick `payment_status` for the `status` column. Hovering the column's enum chip shows the four values in the new order with the note.

**Why this priority**: Without an enum editor users can only get enums from a file, and the line editor can only link existing ones.

**Independent Test**: Create an enum from the canvas menu's "Add enum", add three values, link it to a column and reorder its values. The chip's popover matches the editor, and the "used by" list names the column.

**Acceptance Scenarios**:

1. **Given** the Add flyout Database tab or the canvas menu, **When** the user picks Enum or "Add enum", **Then** a new enum `enum_1` (or the next free number) is created and the drawer opens on it with the name selected.
2. **Given** the enum editor, **When** the user adds a value, **Then** the value shows on the popover of every enum chip that uses the enum.
3. **Given** the enum editor, **When** the user renames, notes, reorders or deletes a value, **Then** the change is one undo step and every chip popover follows.
4. **Given** an enum used by columns, **When** the editor shows it, **Then** the "used by" list names each `table.column`, and clicking one selects that table and opens its Columns tab on the column.
5. **Given** an enum used by columns, **When** the user deletes the enum, **Then** a confirm names how many columns use it; confirming removes the enum and unlinks those columns, which keep their type text, and Undo restores the links.
6. **Given** an enum `order_status` used by `orders.status`, **When** the user renames it to `order_state`, **Then** the column's type reads `order_state`, and one ⌘Z restores both names.
7. **Given** an enum chip's popover or the Columns tab's enum picker, **When** the user picks "Edit enum", **Then** the drawer opens on that enum.

---

### User Story 5 - Edit a table's general settings, indexes and checks (Priority: P2)

A user opens `orders` details. In General they move it to the `sales` schema, set its colour to Teal, write a note, set the owner to "Checkout team" and add the tag "pii". In Indexes they add a unique index on `customer_id` and `created_at`, name it `orders_customer_created_uq` and set the method to btree. In Checks they add `total_non_negative` with `total >= 0`.

**Why this priority**: These settings exist in the model and in exports, but only General's name and colour can be changed elsewhere.

**Independent Test**: Add a composite unique index with a method and a named check from the drawer, then open the SQL export: both appear in the DDL.

**Acceptance Scenarios**:

1. **Given** the General tab, **When** the user changes name, schema, colour, note, owner, tags or links, **Then** the card and exports show it, and each change is one undo step.
2. **Given** a name or schema that another table in the deck already uses together (same name in the same schema, ignoring case), **When** the user commits it, **Then** the field shows "A table named orders already exists in sales" and keeps the previous value.
3. **Given** the Indexes tab, **When** the user adds an index and picks columns, **Then** the columns show as chips in order and can be removed or reordered; the index footer count on the card follows.
4. **Given** an index, **When** the user adds an expression part (e.g. `lower(email)`), **Then** it shows as an expression chip among the column chips, in order.
5. **Given** a SQLite deck, **When** the Indexes tab shows, **Then** the method field is hidden, because SQLite has no index methods; a method stored from another dialect stays stored.
6. **Given** the Checks tab, **When** the user adds, renames, edits or deletes a check, **Then** the table's checks change and each action is one undo step.

---

### User Story 6 - Block SQL export while the schema has errors (Priority: P3)

A team lead turns on "Block SQL export with errors" for the deck. A teammate later opens Export, picks SQL and sees "2 errors in this deck · fix them to export SQL" with "Show problems". Copy and Download are disabled for SQL. DBML, Mermaid and the data dictionary still export.

**Why this priority**: A safety setting for decks that feed real databases; useful, but not needed to author a schema.

**Independent Test**: Make a dangling reference, turn the switch on, open SQL export: Copy and Download are disabled. Fix the reference: they are enabled.

**Acceptance Scenarios**:

1. **Given** the switch is on and the export scope has database errors, **When** SQL is chosen in the export dialog, **Then** Copy and Download are disabled and the banner says export is blocked and offers "Show problems".
2. **Given** the switch is on and the scope has no database errors, **When** SQL is chosen, **Then** export works as before.
3. **Given** the switch is off, **When** the scope has errors, **Then** the banner shows (045) and export still works.
4. **Given** the switch is on, **When** a non-SQL format is chosen, **Then** export is not blocked.
5. **Given** the switch is on and only a table outside the scope (or only a warning) has a problem, **When** SQL export of one clean table is chosen, **Then** export works.

---

### Edge Cases

- **Text fields and undo**: a text field (note, default, check expression) saves while the user types, and one focus session is one undo step. Esc in a field writes back the value from before focus. Name fields write nothing while the name is invalid (empty or taken) and revert on blur.
- **Two tabs editing**: if another browser tab changes the object while its drawer is open, the drawer shows the new values; a field being typed in keeps the user's text until committed.
- **Object removed while open**: if the table, relationship or enum is deleted (here, by Undo, or in another tab), the drawer closes and focus returns to the canvas.
- **Locked table** (043): the drawer shows its settings read-only with "Locked · unlock to edit" and an Unlock button.
- **Duplicate column name** in the Columns tab: refused with an inline message, as in 043's line editor.
- **Duplicate enum name** in the same schema: refused with an inline message. **Duplicate enum value** in one enum: refused.
- **Enum value used as a default**: renaming the value also renames the default of every linked column whose default is the old value, in the same undo step (frame 165); deleting the value leaves the default as written, and the Problems list shows it if 040 / 047 report it.
- **Primary key in the Columns tab**: turning on primary key for a second column makes a composite key (key order is column order, 040); turning it off on the last key column leaves the table without one.
- **Relationship to a removed column**: removing an end column in the drawer that is the last column of that end deletes the relationship after a confirm, because a relationship needs at least one column pair.
- **Self-reference**: the from and to tables are the same; both lists pick from that table.
- **Conversion with no equivalent**: a type with no mapping in the target dialect (e.g. Postgres `tsvector` to SQLite) is kept as written and listed under "Kept as written" in the dialog.
- **Conversion to Generic**: maps types to the Generic list where a mapping exists and keeps the rest.
- **Size and precision on conversion**: sizes and precisions carry over when the target type takes them, and are dropped (and listed) when it does not.
- **Enum columns on conversion**: columns linked to an enum keep their enum link and are not converted.
- **Many conversions**: the dialog shows a scrollable list grouped by conversion, with a total count, for any number of columns.
- **Hidden rows on the card**: expanding a column in the Columns tab does not change the card's detail level.

## Requirements _(mandatory)_

### Functional Requirements

**Drawer**

- **FR-001**: "Edit details" (table menu, ⏎ on a selected table, toolbar) MUST open the table drawer on the General tab. "Edit details" on a column row (a new row menu item; 043's "Edit" keeps the line editor) MUST open it on Columns with that column expanded. A selected relationship's "Edit details" MUST open the relationship drawer.
- **FR-002**: The table drawer MUST have the tabs General, Columns, Indexes and Checks. The tab choice is UI-only and MUST NOT be stored in the deck.
- **FR-003**: Every committed change in the drawer MUST go through the document model, show on the canvas and the JSON panel at once, sync to other open tabs, and be exactly one undo step. A text field MUST save while typing with one undo step per focus session, and Esc MUST restore the value from before focus.
- **FR-004**: A locked table's drawer MUST be read-only and offer Unlock.
- **FR-005**: If the object shown is removed, the drawer MUST close and return focus to the canvas.

**General tab**

- **FR-006**: The General tab MUST edit name, schema, colour, note, owner, tags and links, reusing the card fields from 020 and 033.
- **FR-007**: A table name already used by another table in the same schema (case-insensitive) MUST be refused with an inline message.

**Columns tab**

- **FR-008**: Each column MUST expand to edit name, type, size, precision, enum link, primary key, not null, unique, auto-increment, default (with a Value / Expression choice), check and note. Columns MUST be addable, deletable (with 043's Undo toast and cascade) and reorderable by drag and by keyboard.
- **FR-009**: The type picker MUST list the deck dialect's types grouped by kind, filter as the user types, accept a type that is not in the list (marked as such in the drawer only, with no card warning and no problem), and show size / precision fields only for types that take them.
- **FR-010**: The enum picker MUST list the deck's enums, offer "No enum", "New enum…" and "Edit enum", and setting an enum MUST link the column to it by id.
- **FR-011**: Column names MUST stay unique within the table (case-insensitive), as in 043.

**Indexes and Checks tabs**

- **FR-012**: The Indexes tab MUST add and delete indexes, and edit for each: parts (column or expression chips: add, remove, reorder), unique, method (from the dialect's list; hidden for SQLite), name and note.
- **FR-013**: The Checks tab MUST add and delete table checks, and edit each check's name and expression.

**Relationship drawer**

- **FR-014**: The relationship drawer MUST edit from columns and to columns as ordered lists (add, remove, reorder pairs), cardinality (1–1, 1–n, n–1, n–n, each drawn with its ends), optional side at each end, on delete, on update, name and colour.
- **FR-015**: When from and to lists differ in length, the drawer MUST show a warning; removing the last column of an end MUST confirm, then delete the relationship.
- **FR-016**: Choosing n–n MUST show a hint that SQL export writes a junction table.

**Enums**

- **FR-017**: The Add flyout's Database tab MUST gain an **Enum** tile, and the canvas menu MUST gain **Add enum**. Both MUST create an enum with a unique default name and open the enum editor with the name selected.
- **FR-018**: The enum editor MUST edit name, schema, colour and note, and add, rename, note, reorder and delete values. Enum names MUST be unique per schema and value names unique per enum (case-insensitive).
- **FR-018a**: Renaming an enum MUST set the type text of every column linked to it to the enum's new name, in the same undo step as the rename.
- **FR-018b**: Renaming an enum value MUST also rename the default of every linked column whose default is the old value, in the same undo step.
- **FR-019**: The enum editor MUST list the columns that use the enum; selecting one MUST open that table's Columns tab on the column.
- **FR-020**: Deleting an enum that columns use MUST confirm with the count and say the columns keep the enum's name as plain type text, unlink those columns (keeping their type text unchanged) and be undone by one Undo.
- **FR-021**: The enum chip's values popover (041) MUST offer "Edit enum", which opens the enum editor.

**Dialects**

- **FR-022**: The app MUST hold, as data, a type list per dialect (Generic, Postgres, MySQL, SQLite) with each type's kind and whether it takes a size or a precision, and an index method list per dialect.
- **FR-023**: The app MUST hold a conversion table between every pair of dialects. A type without a mapping MUST be kept as written.
- **FR-024**: Changing the dialect MUST show a confirm dialog listing each conversion and the affected columns, and the types kept as written, unless nothing converts. Confirming MUST change the dialect and every converted type as one undo step, and show a toast with the count and Undo.
- **FR-025**: Conversion MUST NOT change columns linked to an enum, column ids, relationships or indexes.

**Deck settings**

- **FR-026**: Deck settings MUST show a Database section with the dialect select (each option with a one-line hint), the "Block SQL export with errors" switch, the deck's enums (each opening the enum editor, plus "Add enum"), and the existing table and relationship display settings.
- **FR-027**: The deck format MUST gain one optional flag for blocking SQL export with errors. Absent means off. Older decks MUST stay valid and unchanged, and the flag MUST round-trip.
- **FR-028**: When the flag is on and the Problems list has database problems at error severity on tables inside the export scope (warnings and out-of-scope errors never count), the export dialog MUST disable SQL Copy and Download and say why, with "Show problems". Other formats MUST NOT be blocked.

**General**

- **FR-029**: All new UI MUST use the existing drawer, field, switch, select, segmented control and dialog components and tokens, and match frames 135, 136, 151–154, 164 and 165 in light and dark (§g-84–§g-86 decisions apply).
- **FR-030**: Every control in the drawer MUST be reachable and usable by keyboard and labelled for screen readers; tab changes and conversions MUST be announced.

### Key Entities

- **Table** (040): a `db-table` node with name, schema, colour, note, owner, tags, links, columns, indexes and checks; edited in the table drawer.
- **Column** (040): name, type, size, precision, enum link, key and null flags, auto-increment, default (value or expression), check, note.
- **Index** (040): ordered parts (column or expression), unique, method, name, note.
- **Check** (040): name and expression on a table.
- **Relationship** (040, 042): connector with ordered from / to column lists, cardinality, optional sides, on delete, on update, name, colour.
- **Enum** (040, 041): deck-level list item with name, schema, colour, note and ordered values with notes; not drawn on the canvas.
- **Dialect type list**: per dialect, the types offered (kind, takes size, takes precision) and index methods. App data, not stored in decks.
- **Conversion table**: per pair of dialects, which type becomes which. App data.
- **Block SQL export flag**: new optional deck-level setting.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every field of a table, column, index, check, relationship and enum that the deck format stores can be edited without a code view (checked against the format's field list: 100 % covered, except position, size and lock, which the canvas edits).
- **SC-002**: Every committed drawer change is undone by exactly one ⌘Z (verified for each field type and each add / delete / reorder action).
- **SC-003**: Switching the "Shop" deck between each pair of the four dialects lists every changed column in the dialog, and one Undo restores 100 % of types and the dialect.
- **SC-004**: Converting a deck of 150 tables shows the confirm dialog in under 1 second and applies in under 1 second after confirming.
- **SC-005**: A user creates an enum with four values and links it to a column in under 1 minute, without a code view.
- **SC-006**: With the block flag on, SQL export is unavailable in 100 % of cases where the scope has database errors, and available in 100 % of cases where it has none.
- **SC-007**: Frames 135, 136, 151–154, 164 and 165 are matched pixel-close in light and dark at 100 %.

## Assumptions

- **Opening on General**: "Edit details" opens General, as the backlog's acceptance criterion says; other entry points (row "Edit", "used by", enum chip) open the tab they point at.
- **Dialect change flow** (clarified 2026-10-04): a confirm dialog lists the conversions first (frame 153, §g-84), then the toast offers Undo (frame 154 and the backlog). With nothing to convert, there is no dialog.
- **Types outside the list are allowed** (clarified 2026-10-04): the picker suggests, it does not enforce. Imported or hand-typed types stay; unknown ones are only marked. Checking types against the dialect as a lint is 047's.
- **Conversion is best-effort**: only types with a mapping change; the rest are kept and listed. Enum-linked columns are skipped because the enum is the type.
- **Index method lists**: Postgres btree, hash, gist, gin, spgist, brin; MySQL btree, hash; SQLite none (field hidden); Generic btree, hash.
- **Default enum names** are `enum_1`, `enum_2`… (first free number), in the default schema.
- **Enums are listed in Deck settings** because enums are not drawn: an enum used by no column must still be reachable.
- **"Errors" for blocking** (clarified 2026-10-04), counted only for tables in the export scope, are the database problems in today's Problems list. Problems have no severity yet and both of 040's database kinds are errors, so all count; when 047 adds severity, only errors count and warnings never block.
- **Block flag default** is off, so existing decks export as before.
- **Composite ends need at least one pair**; the connector attaches to the first column at each end (042).
- **Relationship actions** offered: Not set (nothing stored, the database's default applies), no action, restrict, cascade, set null, set default, matching 040's stored values.
- **Multi-selection** keeps the existing bulk drawer (018); this feature adds no bulk column editing.
- **Drawer frame** reuses 018's details drawer (width, resize, Esc). Tab choice and expanded rows are UI state, never in the deck.
