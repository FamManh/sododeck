# Feature Specification: Schema Editing on the Canvas

**Feature Branch**: `043-db-editing`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "043 from docs/backlog-database.md". The founder chose on 2026-10-04 to split 043 as the backlog asks. This spec covers **canvas editing**: users build and change a schema on the canvas without touching code. Add a column by typing a line that is parsed as you type, rename in place, reorder by drag, keyboard row editing, delete with Undo, duplicate, copy and paste across decks, lock, multi-select edits, context menus and the Add flyout's Database tab. The details drawer comes in a follow-up feature.

**Sources**: `docs/backlog-database.md` §043 (scope, draft acceptance criteria), founder decisions DB3, DB7, DB8, DB9, DB11; `specs/040-db-schema-model/` (model operations for columns, indexes, checks and enums; cascade on column removal; stable ids); `specs/041-db-table-card/` (column rows, detail levels, enum chip); `specs/042-db-relationships/` (drag to create, default cardinality, hover focus, relationship display settings); `specs/016-canvas-editing/` (copy, paste, duplicate, undo); `specs/019-card-quick-edit/` (title edit, selection toolbar, context menus); `specs/045-db-export/` (SQL export of a selection); DESIGN.md "Database pack"; design-analysis §a frames 134, 135, 136, 149, 160, 161, 168 and §g-83 onward; constitution v1.0.0.

**Dependency note (2026-10-04)**: 040, 041, 042 and 045 are merged. 016 and 019 are merged.

## Scope

**In scope**

- **Add a column by typing a line** (frame 160 A): a new row at the end of the table (or below the selected row) takes a line like `status order_status not null default 'pending'`. As the user types, the line is parsed into name, type (with size and precision), flags (primary key, not null, unique, auto-increment) and default, and the parts are shown as chips under the row. ⏎ saves and opens the next new row, Esc cancels, Tab moves the caret to the type part.
- **Edit a row in place** (frame 160 B): F2 or double-click on a row opens the same line editor in the row, in the row's font and position, pre-filled with the row's current line and the name selected. ⏎ saves and Esc reverts. Ids never change, so relationships, indexes and enum links stay intact.
- **Reorder** (frame 160 C): drag a row by its grip (shown on hover) to a new position, with a drop line; ⌥↑ / ⌥↓ moves the selected row.
- **Row keyboard** (frame 160 D): with a table selected, ↓ enters its rows (⏎ keeps opening details). ↑ ↓ move between rows, ⏎ edits the row, ⌫ deletes it, ⌥↑ ⌥↓ move it, and Esc returns to the table.
- **Delete a column** with an Undo toast that names it and counts what went with it (relationships and index parts, per 040's cascade).
- **Add a table** (frame 134, 168, 149): T, the Add flyout tile, the canvas context menu or the empty-canvas card add a table at the view centre with a starting `id` primary key column and its title ready to rename.
- **Context menus** (frame 149): table (Edit details, Add column, Detail level, Colour, Duplicate, Copy, Lock, Group selection, Export this table as SQL, Delete); column row (Edit, Set as primary key, Not null, Unique, Add index, Add relationship…, Move up, Move down, Delete column); relationship (Cardinality, Optional sides, On delete, Line type, Colour, Delete); canvas (Add table, Add note, Paste).
- **Relationship quick settings** (frame 136): the selection toolbar and context menu of a relationship change its cardinality, optional sides, on delete action, line type and colour.
- **Duplicate** (frame 160 H): ⌘D on a table makes a copy with new table and column ids, named `<name>_copy` with the title selected for renaming. The copy keeps its outgoing foreign keys.
- **Copy and paste across decks** (frame 160 I): pasted tables get new ids. Relationships whose other end is not in the paste are dropped, a toast counts them and offers Undo, and the columns themselves stay.
- **Lock** (frame 160 J, 161): any card can be locked (⇧⌘L, context menu, toolbar). A locked card shows a lock badge and cannot be moved, resized, edited or deleted. Its rows still highlight and connectors still attach. The lock is saved in the deck.
- **Multi-select** (frame 160 G): ⇧-click or marquee selects several tables. The toolbar offers Colour, Detail, Group and Align, and every change applies to all of them as one undo step.
- **Add flyout Database tab** (frame 168): Table (T), Note (S) and Table group (G) tiles under a Database tab. The Packs list shows Database with "Table, note, table group".
- **Format addition** (additive): an optional `locked` flag on nodes.

**Out of scope (follow-up "drawer" feature, then 044–048)**

- The details drawer tabs for a table (General, Columns with all settings, Indexes, Checks), the relationship drawer (column ends as lists, composite ends, name), and the enum editor (values, notes, reorder, used-by). "Edit details" opens today's inspector for the table until then.
- Adding an enum (the Enum tile and the canvas menu's "Add enum"), because an enum has no canvas object and needs the enum editor.
- Type lists per dialect, the type picker, dialect conversion and the Deck settings Database section (dialect select, block SQL export with errors).
- SQL / DBML text import and the code panel (044, 046), lint problems (047), row limit and in-table search (048), custom types and views.

## Clarifications

### Session 2026-10-04

- Q: The backlog says to split 043 at specify (canvas editing, then drawer). What does this spec cover? → A: Canvas editing only: frame 160, context menus (149), relationship quick settings (136), Add flyout Database tab (168). The drawer tabs, relationship and enum editors, dialect type lists and conversion, and the Deck settings Database section become a follow-up feature.
- Q: "Lock a table" needs a new saved flag. Is it for tables only or any card? → A: Any card. One optional `locked` flag on every node, and tables are its first users.
- Q: Should the column line accept a foreign key reference (`customer_id uuid ref customers.id`) that also creates the relationship? → A: No. Users create foreign keys themselves by dragging, with "Add relationship…" or with R; the line holds column fields only.
- Q: When a table hides rows (Names, Keys, small zoom) and the user adds a column or enters its rows, how does it display? → A: It shows All temporarily while row editing lasts, then returns to its previous detail on Esc or deselect. Nothing is saved to the deck.
- Q: When a column's type changes and other columns reference it (e.g. `customers.id` int → uuid), do the referencing columns change too? → A: No. Nothing is changed for the user; each column row at either end of a relationship whose types differ shows a warning icon (!) with a tooltip naming both types.
- Q: Can a locked card be deleted, including inside a multi-selection deleted with ⌫? → A: No. Locked cards are never deleted; in a multi-selection only unlocked cards go and the announcement says how many locked ones were skipped ("Skipped 1 locked"). Unlock first to delete.
- Q: Where does a new column typed with `pk` go? → A: Where the user typed it (end of the table, or below the selected row). Keys are not moved up automatically; the user moves them with ⌥↑ or drag. The card draws the stored order (041).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Add columns by typing a line (Priority: P1)

A user designing `orders` selects the table, presses C (or the toolbar's add column button), and types `status order_status not null default 'pending'`. While they type, chips under the row show `name · status`, `type · order_status` (an enum chip, because an enum with that name exists), `not null` and `default · 'pending'`. ⏎ saves the column and opens a new empty row below it, so they can type the next one right away. Esc on an empty row closes the editor.

**Why this priority**: Adding columns is most of schema authoring. Without it a schema can only be built from a file.

**Independent Test**: On an empty table, type three lines with ⏎ between them. Three columns with the parsed name, type, flags and default appear in order, each one undo step.

**Acceptance Scenarios**:

1. **Given** a selected table, **When** the user types `email text unique not null` and presses ⏎, **Then** the table gains a column `email` of type `text`, unique and not null, and an empty new row is open below it.
2. **Given** the deck has an enum `order_status`, **When** the user types `status order_status`, **Then** the type chip shows the enum, and the saved column is linked to the enum.
3. **Given** a line `price numeric(10,2) not null default 0`, **When** saved, **Then** the column has type `numeric`, size 10, precision 2, not null, and default `0`.
4. **Given** a line `created_at timestamptz default now()`, **When** saved, **Then** the default is stored as an expression, not a quoted value.
5. **Given** a line `id int pk increment`, **When** saved, **Then** the column is the primary key and auto-increments.
6. **Given** a line with a word the parser does not know (`email text sparkly`), **When** typing, **Then** the word shows as an "ignored" chip, and ⏎ saves the column without it.
7. **Given** a line whose name is already used by a column of the same table, ignoring case, **When** the user presses ⏎, **Then** nothing is saved and the row says the name is taken.
8. **Given** the open new row, **When** the user presses Esc, **Then** the row closes and nothing is added.
9. **Given** a column was added, **When** the user presses ⌘Z once, **Then** that column is gone and the others stay.

---

### User Story 2 - Change a column in place (Priority: P1)

A user renames `email` to `email_address` by pressing F2 on the row. The row turns into the line editor in the same font and position, with the name selected. They type the new name and press ⏎. The relationship from `reviews.customer_id` and the unique index on the column still point at it. Later they change the type and drop "not null" by editing the whole line.

**Why this priority**: Renames and type fixes happen constantly. Because references use ids, renaming in place must never break relationships or indexes.

**Independent Test**: Rename a column that has a relationship and an index. The connector stays on the same row and the index footer count is unchanged.

**Acceptance Scenarios**:

1. **Given** a column row, **When** the user presses F2 or double-clicks it, **Then** the row shows the line editor at the same position with the row's current line (e.g. `email text unique not null`) and the name selected.
2. **Given** a renamed column with a relationship and an index, **When** saved, **Then** both still reference that column, and the connector ends on the same row.
3. **Given** the line editor on an existing row, **When** the user removes `not null` and presses ⏎, **Then** the column becomes nullable and the "?" marker appears.
4. **Given** the editor on an existing row, **When** the user presses Esc, **Then** the row shows its previous values unchanged.
5. **Given** a row that is a primary key, **When** the line no longer contains `pk`, **Then** saving removes it from the primary key.
6. **Given** a saved edit, **When** the user presses ⌘Z once, **Then** the whole edit (name, type and flags together) is undone.

---

### User Story 3 - Move around and edit rows with the keyboard, and reorder (Priority: P1)

A user selects `shipments`, presses ↓ to enter its rows, moves with ↑ ↓ to `carrier`, moves it up with ⌥↑, presses ⌫ on `tracking` to delete it, sees "Deleted column tracking · Undo", and presses Esc to go back to the table. With the mouse, they drag `city` by its grip above `customer_id`.

**Why this priority**: Fast, keyboard-first editing and ordering are what make canvas editing faster than writing SQL.

**Independent Test**: Use only the keyboard on a 5-column table to reorder two rows, delete one and undo it. The final order matches and the deleted column comes back with its relationships.

**Acceptance Scenarios**:

1. **Given** a selected table, **When** the user presses ↓, **Then** the first visible row gets the row focus ring. ↑ ↓ move it, and Esc returns the selection to the table.
2. **Given** a focused row, **When** the user presses ⌥↑ or ⌥↓, **Then** the column moves one place in the stored order, which is the order the card draws (041).
3. **Given** a row being dragged by its grip, **When** it is over the list, **Then** a drop line shows where it will land, and releasing moves the column there in one undo step.
4. **Given** a focused row with one relationship, **When** the user presses ⌫, **Then** the column and its relationship are removed, and a toast reads "Deleted column tracking · 1 relationship removed" with Undo.
5. **Given** that toast, **When** the user clicks Undo or presses ⌘Z, **Then** the column, its position, its relationship and its index parts come back.
6. **Given** a focused row, **When** the user presses C or uses "Add column", **Then** the new-row editor opens below it.

---

### User Story 4 - Use context menus and quick settings for tables, rows and relationships (Priority: P2)

A user right-clicks a column row and picks "Set as primary key", then "Unique". They right-click a relationship and set its cardinality to 1–n and on delete to cascade. They select a relationship and change its colour from the toolbar.

**Why this priority**: Menus make every action discoverable and reachable without the keyboard. Relationship settings had no editing surface before this feature.

**Independent Test**: Every item in frame 149's table, row, relationship and canvas menus does its action, and each change is one undo step.

**Acceptance Scenarios**:

1. **Given** a column row's context menu, **When** the user picks "Not null", "Unique" or "Set as primary key", **Then** the flag toggles, a check shows the current state, and the row's markers update.
2. **Given** a column row's context menu, **When** the user picks "Add index", **Then** a single-column index on that column is added and the indexes footer count goes up by one.
3. **Given** a column row's context menu, **When** the user picks "Add relationship…" (or presses R on a focused row), **Then** a connection starts from that row exactly as if dragged from its port (042). Clicking a target row completes it, and Esc cancels.
4. **Given** a relationship's context menu or toolbar, **When** the user picks a cardinality (1–1, 1–n, n–1, n–n, each drawn with its ends), optional sides, an on delete action, a line type or a colour, **Then** the relationship changes and its ends redraw.
5. **Given** a table's context menu, **When** the user picks "Export this table as SQL", **Then** the schema export opens with only that table in scope.
6. **Given** a table's context menu, **When** the user picks "Edit details", **Then** the details panel opens on that table.

---

### User Story 5 - Add tables, and duplicate, copy and paste them (Priority: P2)

A user presses T on an empty canvas. A table appears at the view centre with an `id` primary key column, and its title is selected to type `invoices`. They press ⌘D on `customers` and get `customers_copy`, title selected, with its own ids. They copy `orders` and paste it into the "Ops" deck. "Ops" has no `customers` or `addresses` table, so a toast reads "Pasted orders · 3 relationships dropped · Undo".

**Why this priority**: Starting tables and reusing tables are the next most common actions after editing columns.

**Independent Test**: Duplicate a table that has two outgoing foreign keys and one incoming. The copy has two outgoing relationships and none incoming, and every id in the copy is new.

**Acceptance Scenarios**:

1. **Given** any canvas state, **When** the user presses T or clicks the Table tile, **Then** a table named `table_1` (or the next free number) is added at the view centre with an `id` primary key column of type `integer`, and its title is in edit mode.
2. **Given** a selected table, **When** the user presses ⌘D, **Then** a copy named `<name>_copy` (`_copy_2`… when taken) appears 24 px down-right with new table, column, index, check and relationship ids. Its title is selected for renaming.
3. **Given** a duplicated table with relationships to other tables, **Then** the copy has the same outgoing relationships, pointing at the same target columns, and no incoming relationships.
4. **Given** a table that references itself, **When** duplicated, **Then** the copy's self-reference points at the copy.
5. **Given** two tables with a relationship between them, **When** both are duplicated or pasted together, **Then** the copies are linked to each other, not to the originals.
6. **Given** tables pasted into another deck, **When** a relationship's other end is not in the paste, **Then** that relationship is dropped, the columns stay, and a toast names the count with Undo.
7. **Given** a pasted column that names an enum, **When** the target deck has an enum with the same name, **Then** the column links to it. Otherwise the enum is copied into the target deck with new ids.
8. **Given** a paste, **When** the user presses ⌘Z once, **Then** the whole paste is removed.

---

### User Story 6 - Lock a table (Priority: P3)

A user locks `payments` with ⇧⌘L so a teammate presenting the deck cannot nudge it. The header shows a lock badge. Dragging it does nothing, and a tooltip says "Locked · unlock to move or edit". Hovering its rows still lights their relationships, and new relationships can still be drawn to its rows.

**Why this priority**: Lock protects finished parts of a board. It is useful but not needed to author a schema.

**Independent Test**: Lock a table, then try to move, resize, rename, add a column and delete it. None of these change anything, and hovering and connecting still work.

**Acceptance Scenarios**:

1. **Given** a selected card of any type, **When** the user presses ⇧⌘L or picks Lock, **Then** the card is locked, shows the lock badge, and the lock is saved in the deck.
2. **Given** a locked card, **When** the user tries to drag, resize, edit its title or rows, add or delete a column, or delete the card, **Then** nothing changes and the tooltip explains why.
3. **Given** a locked table, **When** the user drags a relationship from another table onto one of its rows, **Then** the relationship is created.
4. **Given** a selection with locked and unlocked cards, **When** it is moved or deleted, **Then** only the unlocked cards change, and the announcement says how many were skipped (e.g. "Skipped 1 locked").
5. **Given** a locked card, **When** the user picks Unlock (or ⇧⌘L again), **Then** it can be edited again, and the `locked` flag is removed from the deck.

---

### User Story 7 - Edit many tables at once and find Database in the Add flyout (Priority: P3)

A user marquee-selects `products` and `categories`, sets their colour to Teal and their detail to Keys from the toolbar, and undoes both with two ⌘Z. In the Add flyout they open the Database tab and see Table, Note and Table group.

**Why this priority**: Bulk edits and discoverability round off the authoring experience.

**Independent Test**: Select 3 tables, change their colour. One ⌘Z restores all three.

**Acceptance Scenarios**:

1. **Given** several selected tables, **When** the user changes colour, detail, group or align from the toolbar, **Then** all of them change, and one ⌘Z undoes the change for all.
2. **Given** the Add flyout, **When** the user opens the Database tab, **Then** it lists Table (T), Note (S) and Table group (G). Clicking adds at the view centre, and dragging places a tile on the canvas.
3. **Given** the Packs list, **Then** Database reads "Table, note, table group". Turning it off hides the tab and tiles, and tables already on the board keep rendering.

---

### Edge Cases

- **Empty name**: a line with no name (only spaces) cannot be saved, and ⏎ does nothing.
- **Name only** (`notes`): saved with no type, drawn with an empty type slot (lint in 047).
- **Quoted names** (`"order date" date`): quotes keep spaces in the name and are not stored.
- **Defaults**: a quoted value (`'pending'`, `"pending"`) is stored as a value. A number, `true`, `false` or `null` is stored as a value. A word with parentheses (`now()`) or a bare keyword like `current_timestamp` is stored as an expression. A default needs something after it. `default` alone shows a hint and is ignored.
- **Reference in the line** (`customer_id uuid ref customers.id`): `ref` and what follows show as "ignored" chips; the column is saved without a relationship, which the user then drags (042) or makes with R.
- **Type change on a referenced column** (`customers.id` int → uuid): referencing columns keep their type; both end rows show the (!) warning until the user fixes one side.
- **Conflicting words** (`null` and `not null` in one line): the last one wins and the chip shows it.
- **Unknown type words**: any word in the type position is kept as the type text. Checking types against the dialect comes in the follow-up feature.
- **Primary key on a second column**: setting `pk` on a column of a table that already has a primary key adds it to the key, making a composite key, as the menu does.
- **Editing while another tab edits the same table**: changes merge per column; the open line editor keeps the user's text until they save or cancel.
- **Hidden rows** (Names or Keys detail, zoom below 90 %): while the user adds a column, edits a row or has row focus, that table shows All detail. Esc out of the rows or deselecting the table returns it to its previous detail. Nothing is saved, and the stored detail is unchanged.
- **Locked table and undo**: undoing a change made before the lock still works. Undo is not an edit gesture.
- **Paste into the same deck**: works like duplicate (new ids, `_copy` names). Relationships to tables that are not in the paste stay, because their targets exist.
- **Paste a deck with another dialect**: column types are kept as written. Conversion comes in the follow-up feature.
- **Delete the last column**: allowed. The table shows its empty state.

## Requirements _(mandatory)_

### Functional Requirements

**Line editor**

- **FR-001**: The system MUST parse a column line into name, type, size, precision, primary key, not null (or nullable), unique, auto-increment, default value or default expression, and show each part as a chip while the user types.
- **FR-002**: The line grammar MUST accept, in any order after the name and type: `pk` / `primary key`; `not null` / `null`; `unique`; `increment` / `auto_increment` / `autoincrement`; `default <value or expression>`. Keywords MUST be case-insensitive. The line MUST NOT create relationships: reference words (`ref`, `>`, `references`) are treated as unknown words (FR-004).
- **FR-003**: When the type word matches an enum of the deck by name (case-insensitive, schema-qualified names allowed), the column MUST be linked to that enum.
- **FR-004**: Words the parser does not understand MUST be shown as an "ignored" chip and MUST NOT be saved.
- **FR-005**: The editor MUST refuse to save an empty name, or a name already used in the same table (case-insensitive, the edited column excluded), with an inline message.
- **FR-006**: ⏎ MUST save and, for a new row, open the next new row below. Esc MUST cancel. Tab MUST move the caret to the start of the type part.
- **FR-006a**: A new column MUST be inserted where it was typed (end of the table, or below the focused row), whatever its flags. Primary key columns MUST NOT be moved automatically.
- **FR-007**: Editing an existing row MUST pre-fill the editor with the row's current line, select the name, and replace the column's name, type and flags as one undo step without changing its id.

**Rows and keyboard**

- **FR-008**: With a table selected, ↓ MUST enter row focus (⏎ stays "Open details", as in the table menu). ↑ ↓ MUST move it, ⏎ or F2 MUST edit, ⌫ MUST delete, ⌥↑ / ⌥↓ MUST move the column, C MUST add a column below, R MUST start a relationship, and Esc MUST return to the table.
- **FR-009**: A row MUST show a drag grip on hover. Dragging it MUST show a drop line, and releasing MUST move the column in one undo step.
- **FR-010**: Deleting a column MUST remove what 040's cascade removes, and MUST show an Undo toast naming the column and counting removed relationships. Undo MUST restore everything.
- **FR-010a**: While a table is in row editing (row focus, an open line editor or a new row), it MUST show All detail. When row editing ends, it MUST return to its previous detail without writing anything to the deck.
- **FR-010b**: Changing a column's type MUST NOT change any other column. A column row at either end of a relationship whose end types differ (same comparison as 042's drop warning: type name and size, case-insensitive) MUST show a warning icon (!) with a tooltip like "Type differs: int → uuid (orders.customer_id)". The icon MUST disappear as soon as the types match again.
- **FR-011**: Keyboard row focus and the open editor MUST be announced to screen readers (row name, type and position).

**Tables, menus and quick settings**

- **FR-012**: Adding a table (T, Add flyout, canvas menu, empty-canvas card) MUST create it at the view centre with a unique default name and an `id integer` primary key column, and put its title in edit mode.
- **FR-013**: The table, column row, relationship and canvas context menus MUST offer the items listed in Scope. Each item MUST be one undo step, and toggles MUST show their current state.
- **FR-014**: A selected relationship's toolbar and menu MUST set cardinality (1–1, 1–n, n–1, n–n), optional sides, on delete action, line type and colour.
- **FR-015**: "Add index" on a row MUST add a single-column, non-unique index on it.
- **FR-016**: "Export this table as SQL" MUST open the schema export (045) scoped to that table.

**Duplicate, copy, paste**

- **FR-017**: Duplicate and paste MUST give every pasted table, column, index, check and relationship a new id, and MUST remap references inside the pasted set.
- **FR-018**: Duplicate MUST keep the copied tables' outgoing relationships to tables outside the set, and MUST NOT copy incoming ones.
- **FR-019**: Paste into another deck MUST drop relationships whose other end is outside the paste, keep the columns, and show a toast with the dropped count and Undo.
- **FR-020**: A table name that is taken in the target deck (same schema) MUST get `_copy`, then `_copy_2` and so on.
- **FR-021**: Pasted enum links MUST attach to a same-named enum of the target deck, or copy the enum with new ids.

**Lock**

- **FR-022**: Any node MUST support an optional saved `locked` flag. Older decks MUST stay valid and unchanged, and the flag MUST round-trip.
- **FR-023**: A locked node MUST NOT be moved, resized, edited (title, fields, rows) or deleted from the canvas. It MUST still be selectable, highlightable and a valid relationship or connector target, and it MUST show a lock badge and an explaining tooltip.
- **FR-024**: Operations on a selection MUST skip locked nodes and announce how many were skipped.

**Multi-select and Add flyout**

- **FR-025**: Toolbar changes on a multi-selection (colour, detail, group, align) MUST apply to every selected table as one undo step.
- **FR-026**: The Add flyout MUST show a Database tab with Table (T), Note (S) and Table group (G). The Packs list MUST describe Database as "Table, note, table group".

**General**

- **FR-027**: Every edit MUST go through the document model (single source of truth), MUST sync to other open tabs, and MUST be one undo step per user action.
- **FR-028**: All new UI MUST use the existing editor components and tokens (DESIGN.md, §g-83–§g-86) and MUST match frames 160, 149, 136 and 168 (light and dark).

### Key Entities

- **Column line**: the text form of one column (`name type[(size[,precision])] [flags] [default …]`) used to add and edit rows; parsed into a column's fields.
- **Column**: 040's column (stable id, name, type, size, precision, flags, default, enum link); edited here.
- **Relationship**: 040's connector with column ends; its cardinality, optional sides, on delete, line type and colour are edited here.
- **Locked flag**: a new optional flag on any node that blocks moving, resizing, editing and deleting.
- **Pasted set**: the tables, columns, indexes, checks, relationships and enums copied together, remapped to new ids on paste.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user builds the "Shop" `orders` table (7 columns, 3 relationships) on the canvas in under 2 minutes, without opening a panel or a code view.
- **SC-002**: Typing `email text unique not null` and ⏎ adds a unique, not-null `email` column (the backlog's acceptance criterion), and 20 of 20 sample lines from the "Shop" schema parse to the expected fields.
- **SC-003**: Renaming any column of the "Shop" deck keeps 100 % of its relationships, index parts and enum links pointing at it.
- **SC-004**: Every editing action in this feature is undone by exactly one ⌘Z (verified for each action in the menus and keyboard list).
- **SC-005**: Chips update within one frame of each keystroke, and saving a column on a 150-table board takes under 100 ms to show on the canvas.
- **SC-006**: Duplicating or pasting 20 tables gives 0 shared ids with the originals and 0 relationships pointing outside the pasted set (after drops).
- **SC-007**: A locked card cannot be changed by any canvas gesture or shortcut, in 100 % of the cases listed in User Story 6.
- **SC-008**: Frames 160, 149, 136 and 168 are matched pixel-close in light and dark at 100 %.

## Assumptions

- **Split** (clarified 2026-10-04): this spec is the canvas half of 043. The drawer half (table tabs, relationship drawer, enum editor, dialect type lists and conversion, Deck settings Database section) is a separate follow-up feature to add to `docs/backlog-database.md`.
- **Lock is generic** (clarified 2026-10-04): one optional `locked` flag on all nodes. It is the only format change in this feature.
- **Default new column** for a new table is `id integer pk`, because `integer` exists in every supported dialect.
- **Default table names** are `table_1`, `table_2`… (first free number).
- **"Edit details"** opens today's inspector on the table until the follow-up drawer exists.
- **No enum creation** here: the Enum tile and "Add enum" come with the enum editor. Existing enums (from files) are linked by typing their name.
- **Type text is free** here: the dialect type picker and type validation come in the follow-up feature. Tab only moves the caret to the type.
- **Unparsed words are dropped** rather than blocking the save, so a typo never loses the rest of the line. The chip makes the drop visible.
- **Duplicate names are refused** in the line editor, because SQL cannot express them and 047 should not have to report the editor's own output.
- **Duplicate keeps outgoing foreign keys only** (frame 160 H): a copy referencing the same parents is useful, but a second table that is referenced by the same children is not.
- **Enum handling on paste** (link by name, else copy) avoids broken enum links without asking.
- **Composite relationship ends** cannot be built on the canvas here. "Add relationship…" makes a single-column relationship, and composite ends come with the relationship drawer.
- **Type mismatch is shown, not fixed**: the (!) icon is the only signal in 043; listing mismatches in Problems is 047's lint.
- **Keyboard shortcuts** T, S, G, C, R, F2, ⌥↑ / ⌥↓ and ⇧⌘L are added to the shortcuts list. They only act when focus is on the canvas, never inside a text field.
