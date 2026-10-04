# Feature Specification: Schema Code Panel (DBML)

**Feature Branch**: `046-db-code-panel`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "046-db-code-panel — see docs/backlog-database.md section 046, with the 026 dependency removed: 046 builds its own editable DBML tab; JSON panel stays read-only." — Developers write the schema as DBML and see the diagram follow, or edit the diagram and see the text follow: a **DBML** tab in the code overlay (selection / whole schema); edits apply after a short pause through a parse → match → plan → apply pipeline; parsed tables and columns are matched to existing ones by id-preserving rules (same name, then case-insensitive name, then a likely rename); the plan is applied as one undo step; positions and colours are kept; parse errors show inline and never touch the document. SQL is a read-only preview tab.

**Sources**: `docs/backlog-database.md` §046 (scope, draft acceptance criteria), §044 (DBML reader, "re-import matches by name" deferred to 046), §045 (DBML and SQL writers, "Shop" fixture), §043 (paste naming, lock, dialect type lists); founder decisions DB2 (DBML is the code-panel format), DB5 (no code, assets or copy from other tools), DB6 / ADR 0033 (DBML parser lazy-loaded off the main thread), DB7 (a table is a node), DB8 (relationship ends are column rows), DB11 (one dialect per deck); `specs/004-json-panel-sync/` and `specs/018-canvas-first-layout/` (the code overlay, its Selection / Deck tabs, read-only behaviour, undo keys); ADR 0031 (schema export) and ADR 0033 (schema import parsers); design-analysis §a frames 137 (DBML tab with an inline error) and 166 (code panel: JSON / DBML / SQL tabs, Selection / Whole schema, "Applied" / "Can't apply: fix 1 error"), the component row "Code panel tabs"; constitution v1.0.0 (principles I–VIII).

**Dependency note (2026-10-04, founder)**: the backlog listed 026 (editable JSON panel) as a dependency. The founder removed it: the JSON tab **stays read-only** (nobody edits deck JSON by hand; it becomes editable later only if users ask). 046 builds the editing it needs for the DBML tab on its own. 040–045 are merged.

## Clarifications

### Session 2026-10-04

- Q: Does 046 wait for 026 (editable JSON)? → A: No. The JSON tab stays read-only; 046 makes only the DBML tab editable (founder).

## Scope

**In scope**

- The code overlay gains format tabs **JSON | DBML | SQL**. JSON keeps today's behaviour (read-only, Selection / Deck).
- **DBML tab, editable**: shows the schema as DBML (the same text 045's DBML export writes) for the **Selection** or the **Whole schema**. Edits apply to the deck after a short pause in typing.
- **Apply pipeline**: read the text; if it has errors, show them inline and change nothing; otherwise match parsed tables, columns, enums and relationships to existing ones, work out the additions, updates and removals, and apply them as **one undo step**.
- **Matching that keeps identity**: same name, then same name ignoring case, then a likely rename. A matched object keeps its id, so its position, colour, size, group, relationships, flow references, notes and stickies stay attached.
- What DBML can express is edited from the text: tables (name, schema, note), columns (name, type, primary key, unique, not null, default, increment, note), composite keys, indexes, checks, enums and their values, relationships (columns at both ends, cardinality, optional ends, on delete / on update, name). Everything else on a table (position, colour, size, tags, owner, links, lock, group, fields) is kept as is.
- **Status line**: "Applied" / "Applying…" / "Can't apply: fix n errors" with "Canvas keeps the last valid schema", and **Copy**.
- **Inline errors and warnings**: line and column, message, a suggestion where one is clear ("did you mean not null?"); warnings never block apply.
- **Canvas → text**: changes made on the canvas, the inspector, another browser tab or undo show in the DBML text without losing the user's cursor or unapplied typing.
- **SQL tab, read-only**: the schema as SQL DDL in the deck's dialect, with Copy; same scope switch.
- The parser loads only when the DBML tab is first opened (ADR 0033); the editor's first load does not grow.

**Out of scope**

- Editing the JSON tab (026, later if users ask) and pasting a whole deck.
- Editing the SQL tab, SQL as an input format in the panel (import remains 044's dialog).
- Table groups, sticky notes, header colours and the `Project` block as **inputs**: they are not written by the DBML export (045) and typing them in the tab changes nothing (a warning says where to edit them).
- Changing the deck's dialect from the text.
- Selecting canvas objects from the text cursor, and text folding by table on the canvas.
- Lint rules (047); the panel shows only errors that stop the text from being read or applied.
- Live sync with a file on disk.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit the schema as text and see the canvas follow (Priority: P1)

A developer opens the code overlay on a schema deck, picks **DBML** and **Whole schema**, and types. After a short pause the canvas shows the change: a new column, a renamed table, a new relationship. Tables they renamed keep their place and colour, and one ⌘Z undoes each applied change.

**Why this priority**: this is the feature. Without two-way text editing the tab is only another export preview.

**Independent Test**: open "Shop", switch to DBML / Whole schema, add `discount_cents int` to `orders`, rename `customers` to `clients`, add `Ref: orders.coupon_id > coupons.id` with a new `coupons` table; check the canvas after each pause and undo each step.

**Acceptance Scenarios**:

1. **Given** the DBML tab on "Shop", **When** the user adds the line `discount_cents int [not null]` inside `Table orders` and stops typing, **Then** within a second the `orders` card shows a not-null `discount_cents int` column and the status reads "Applied".
2. **Given** the DBML tab, **When** the user renames `Table customers` to `Table clients`, **Then** the same card (same id) is renamed in place, keeps its position, colour and size, and every relationship and flow step that pointed at it still does.
3. **Given** the DBML tab, **When** the user renames the column `email` to `email_address` in one edit, **Then** the column keeps its id, its unique index and the relationships that use it.
4. **Given** the DBML tab, **When** the user adds a new `Table coupons { id int [pk] }` and a ref to it, **Then** a new table card appears near the other tables without overlapping any card, and the relationship is drawn between the exact column rows.
5. **Given** an applied change, **When** the user presses ⌘Z (in the panel or on the canvas), **Then** the whole applied change is undone in one step and the DBML text shows the restored schema.
6. **Given** the user deletes a whole `Table shipments { … }` block, **When** it applies, **Then** the table and its relationships are removed in one undo step.

---

### User Story 2 - Errors never break the canvas (Priority: P1)

While typing, the text is often invalid. The panel shows each error on its line, the canvas keeps the last valid schema, and nothing is applied until the text is valid again.

**Why this priority**: text editing that can corrupt or wipe the diagram is unusable; this is the safety promise in the design (frame 137).

**Independent Test**: type `total_cents int [not nul]`; check the inline error, the status pill and that the document is unchanged; fix it and check it applies.

**Acceptance Scenarios**:

1. **Given** the DBML tab, **When** the user types `total_cents int [not nul]`, **Then** the line is marked, an inline message gives the line, column and "unknown setting "not nul" · did you mean not null?", the status reads "Can't apply: fix 1 error" with "Canvas keeps the last valid schema", and the deck is not changed.
2. **Given** text with a ref to a table or column that does not exist (in the text or, for Selection, in the deck), **When** it is read, **Then** it is an error on that ref's line and nothing is applied.
3. **Given** text with two tables of the same name, two columns of the same name in one table, or an enum value used as a default that the enum does not have, **When** it is read, **Then** each is an error on its line and nothing is applied.
4. **Given** errors are shown, **When** the user fixes the last one, **Then** the text applies after the pause and the status returns to "Applied".
5. **Given** errors are shown, **When** the user closes the panel or switches tab, **Then** the unapplied text is discarded, the deck keeps the last valid schema, and reopening the tab shows the schema as the deck holds it.

---

### User Story 3 - Edit only the selected tables (Priority: P2)

On a large schema, the user selects two tables on the canvas and edits only them. The text holds just those tables (and the enums they use); tables that are not selected are never touched.

**Why this priority**: whole-schema text for 100+ tables is hard to work in; the design defaults to Selection.

**Independent Test**: select `orders` and `order_items`, switch to DBML / Selection, edit a column and delete the `order_items` block; check only those tables changed.

**Acceptance Scenarios**:

1. **Given** `orders` and `order_items` selected, **When** the DBML tab is in Selection, **Then** the text holds those two tables, the enums they use and the relationships between them or to other tables, written as 045 writes a selection.
2. **Given** Selection, **When** the user deletes a table block that was in the text, **Then** that table is removed; tables outside the selection are never removed, renamed or changed.
3. **Given** Selection, **When** a ref in the text points at a table outside the selection that exists in the deck, **Then** it is valid and the relationship is created or kept.
4. **Given** Selection, **When** the user adds a new table in the text, **Then** it is created and joins the selection.
5. **Given** Selection with no table selected, **When** the tab opens, **Then** it shows an empty text with a hint ("Select tables, or switch to Whole schema; you can also type a new table here").
6. **Given** Selection, **When** the canvas selection changes while the editor has no unapplied edits, **Then** the text switches to the new selection; with unapplied edits it waits until they apply or are discarded.

---

### User Story 4 - The text follows changes made elsewhere (Priority: P2)

The user drags a column on the canvas, edits a table in the drawer, undoes, or works in a second browser tab. The DBML text updates to match without jumping the cursor or eating what they are typing.

**Why this priority**: two-way means two-way; a stale text panel would overwrite canvas work on the next apply.

**Independent Test**: with the DBML tab open, rename a column on the canvas, then type in the panel; open the same deck in two browser tabs and edit the DBML in one.

**Acceptance Scenarios**:

1. **Given** the DBML tab open with no unapplied edits, **When** a column is renamed on the canvas, **Then** the text shows the new name within a second, and the cursor and scroll stay where they were (relative to unchanged lines).
2. **Given** the user is typing (unapplied edits), **When** the deck changes elsewhere, **Then** the user's text is not replaced; the next apply matches against the deck as it is now, so the outside change is kept unless the user's text changed the same thing.
3. **Given** the same deck open in two browser tabs, **When** the user edits DBML in one, **Then** the canvas in the other updates once it applies.
4. **Given** the editor has focus and an apply just succeeded, **When** the deck's own text form differs from what the user typed only in spacing, order of settings or quoting, **Then** the text is not reformatted while the editor has focus; it takes the deck's form when the editor loses focus.

---

### User Story 5 - Read the schema as SQL (Priority: P3)

The user switches to the **SQL** tab to see the DDL for the selection or the whole schema in the deck's dialect and copies it.

**Why this priority**: useful and cheap (045's writer), but read-only and not the reason for the feature.

**Independent Test**: open the SQL tab on "Shop" (Postgres) and on a Generic deck; copy the text.

**Acceptance Scenarios**:

1. **Given** a Postgres deck, **When** the SQL tab opens, **Then** it shows the same SQL as the SQL export for that scope, with Copy, and typing in it is refused with a short "SQL is read-only here; edit DBML or the canvas" message.
2. **Given** a Generic deck, **When** the SQL tab opens, **Then** it shows Postgres SQL with a small dialect switch (Postgres / MySQL / SQLite) remembered for this browser; the deck's dialect does not change.
3. **Given** export notes from the writer (e.g. a foreign key to a table outside the selection), **When** the SQL tab shows, **Then** the notes are listed under the text, as in the export dialog.

### Edge Cases

- **Cut and paste a table block**: removing a table and adding it back with the same name within the same panel session (until the panel closes) restores the same table (id, position, colour, links), not a new one.
- **Typing a name letter by letter**: each pause may apply a partial name; matching by likely rename keeps the same table or column through every step, so no new object is created and none is lost.
- **Likely rename is unclear**: when two tables (or columns) disappear and two appear in one apply and the match is not clear, nothing is guessed: the old ones are removed and new ones added, and a warning under the status says so with the names ("orders_a, orders_b were replaced; Undo to restore").
- **Locked table** (043): changes to a locked table in the text are an error on its line ("orders is locked; unlock it on the canvas") and nothing is applied.
- **Table groups, sticky notes, `Project`, header colour** typed in the text: a warning on the line ("Table groups are edited on the canvas"); the rest applies.
- **A type not in the deck's dialect list**: kept as written (as 044 does); no conversion.
- **Enum renamed** in the text: columns using it follow by matching, as for tables.
- **Removing an enum still used by a column**: error on the column's line; nothing applied.
- **Large schema** (150 tables in Whole schema): reading and applying stay off the main thread; typing never stutters; apply finishes within the target below.
- **Empty text in Whole schema**: deleting everything is allowed only as an explicit action: an empty text is treated as an error-free text that would remove every table; it shows "This removes all n tables" with an **Apply** button instead of applying on pause.
- **Deck with no tables**: DBML tab shows an empty text and the hint; typing a table creates it (a schema can be written from nothing).
- **Undo inside the editor**: ⌘Z / ⇧⌘Z act on the deck history (as the JSON tab does today), not on the text buffer; unapplied text is discarded by undo.
- **Panel closed**: nothing is parsed and no parser is loaded until the DBML tab is opened.

## Requirements _(mandatory)_

### Functional Requirements

**Panel and tabs**

- **FR-001**: The code overlay MUST offer format tabs **JSON**, **DBML** and **SQL**. The JSON tab MUST keep its current read-only behaviour and its Selection / Deck switch.
- **FR-002**: DBML and SQL tabs MUST have a **Selection / Whole schema** switch. The chosen format tab and scope MUST be remembered per browser (UI preference, never in the deck).
- **FR-003**: The DBML and SQL tabs MUST be available in every deck (a schema can be typed from nothing); with no tables they show an empty text and a hint.

**DBML text**

- **FR-004**: The DBML tab MUST show the text 045's DBML writer produces for the chosen scope.
- **FR-005**: Edits in the DBML tab MUST be applied after the user stops typing for a short pause (about half a second), with no Apply button, except the "remove every table" case (Edge Cases).
- **FR-006**: The text MUST be read off the main thread, and the parser MUST be loaded only when the DBML tab is first opened in a session.
- **FR-007**: Invalid text MUST NOT change the deck. Each error MUST be shown on its line with line, column and message, and a suggestion when an unknown keyword is close to a known one. The status MUST read "Can't apply: fix n errors" with "Canvas keeps the last valid schema".
- **FR-008**: Errors MUST include, besides syntax: duplicate table, column, enum or index names; refs to missing tables or columns; defaults not among an enum's values; removing an enum still in use; changes to a locked table.
- **FR-009**: Warnings (table groups, sticky notes, `Project`, header colour in the text; an unclear rename) MUST be shown on their line or under the status and MUST NOT block apply.

**Matching and applying**

- **FR-010**: Parsed tables MUST be matched to existing tables in this order: same schema and name; same name ignoring case; a likely rename (one table gone and one new table in the same apply whose columns mostly match); a table removed earlier in the same panel session with the same name. Unmatched parsed tables are new; unmatched existing tables in scope are removed.
- **FR-011**: Columns, indexes, checks and enum values MUST be matched within their table or enum by the same rules (name, name ignoring case, likely rename by position and type). Enums MUST be matched like tables. Relationships MUST be matched by their two ends (tables and columns), then by name.
- **FR-012**: A matched object MUST keep its id. Everything the text does not express (position, size, colour, tags, owner, links, lock, group, fields, flow references, stickies, notes on the canvas) MUST be kept.
- **FR-013**: Each successful apply MUST be one undo step, covering all its additions, updates and removals.
- **FR-014**: New tables MUST be placed near the existing tables of the scope without overlapping any card; new tables in Selection join the selection.
- **FR-015**: In Selection, an apply MUST only add, change or remove tables that were in the text or are new in it, plus relationships whose ends are in those tables. Tables outside the selection MUST NOT be changed.
- **FR-016**: When an apply would remove every table of a non-empty Whole schema, the panel MUST ask for an explicit Apply instead of applying on pause.

**Text following the deck**

- **FR-017**: When the deck changes from anywhere else (canvas, drawer, undo, another browser tab) and the editor has no unapplied edits, the text MUST update within a second, keeping cursor and scroll for unchanged lines.
- **FR-018**: While the editor has unapplied edits, outside changes MUST NOT replace the user's text; the next apply MUST be matched against the current deck.
- **FR-019**: After an apply, the text MUST NOT be rewritten into the writer's form while the editor has focus; it MUST take the writer's form when focus leaves or when the deck changes from elsewhere.
- **FR-020**: Closing the panel or leaving the tab with unapplied edits MUST discard them; the deck keeps the last valid schema.
- **FR-021**: ⌘Z / ⇧⌘Z in the DBML editor MUST act on the deck history, as in the JSON tab.

**SQL tab**

- **FR-022**: The SQL tab MUST show, read-only, the SQL DDL of 045 for the scope in the deck's dialect; for a Generic deck, a per-browser dialect switch (default Postgres) chooses the preview dialect without changing the deck. Writer notes MUST be listed under the text.

**Shared**

- **FR-023**: Each tab MUST have **Copy**, copying the text of the current tab and scope.
- **FR-024**: Status, errors and warnings MUST be readable without colour (icon and text) and announced to screen readers; errors MUST be reachable by keyboard from the editor.
- **FR-025**: No text, schema or error MUST be sent over the network; the existing no-third-party-requests check MUST stay green.

### Key Entities

- **Code tab state** (UI only): format (JSON / DBML / SQL), scope (Selection / Whole schema), SQL preview dialect for Generic decks; remembered per browser.
- **Edit session** (UI only, until the panel closes): the user's unapplied text, its errors and warnings, and the tables removed by earlier applies (to restore them on cut and paste).
- **Schema plan**: the additions, updates and removals one apply makes, keyed by existing ids; applied as one undo step.
- **Problem in text**: line, column, severity (error / warning), message, optional suggestion.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On "Shop", renaming a table in DBML keeps its position, colour and every relationship (draft acceptance criterion); verified by test for tables, columns and enums.
- **SC-002**: An invalid line shows an inline error and the deck is byte-for-byte unchanged (draft acceptance criterion); verified for every error kind in FR-008.
- **SC-003**: Typing in the DBML tab in one browser tab updates the canvas in another (draft acceptance criterion).
- **SC-004**: For every fixture in the import corpus that the DBML writer can express, writing the deck to DBML and applying that text back to the same deck makes no change (no added, removed or modified object).
- **SC-005**: On a 150-table schema in Whole schema, an edit is visible on the canvas within 1 second after the user stops typing, and typing latency in the editor stays under 50 ms.
- **SC-006**: Opening the editor without the DBML tab downloads nothing more than today; the parser is fetched only on first opening of the DBML tab.
- **SC-007**: Each applied edit is undone by exactly one ⌘Z.

## Assumptions

- **Apply on pause** (not an Apply button), as the design says ("Edits apply as you type"); the pause is about half a second and is a constant, not a setting. This settles the "cursor fight" risk the backlog gave to 026's ADR: 046 records it in its own ADR.
- **The JSON tab is untouched** apart from sitting next to the new tabs; making it editable stays with 026.
- **The DBML text is the 045 writer's output.** What the writer does not write (table groups, sticky notes, header colours, positions) is not an input in the panel; 044's import dialog still reads them from files.
- **Re-import by name** (044 left it to 046) is delivered through the panel: pasting a DBML schema into Whole schema matches existing tables by name. The import dialog keeps its "always add" rule.
- **Likely rename** is conservative: one-to-one only, and only when most columns (tables) or the position and type (columns) agree; anything unclear becomes remove + add with a warning and Undo.
- **Removed-in-session memory** lasts until the panel closes; it is not stored in the deck.
- **Generic deck SQL preview** defaults to Postgres, matching the export dialog's first choice.
- **Selection** includes only table cards; other selected cards are ignored by the DBML and SQL tabs.
- **Dialect**: types are kept as typed; changing dialect stays in Deck settings (043).
- The parser and readers from 044 (ADR 0033) and the writers from 045 (ADR 0031) are reused; no new runtime dependency is expected.
