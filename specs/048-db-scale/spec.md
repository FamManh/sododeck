# Feature Specification: Database Scale

**Feature Branch**: `048-db-scale`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "048 from docs/backlog-database.md" — A 60-column table and a 150-table schema stay usable: a row limit with "Show all n columns" / "Show fewer" saved per table, an in-table column filter, schemas as collapsible groups with merged ×n connectors, saved views filtered by schema / group / table, Jump to (⌘K) by table and column, focus a table and its one-hop neighbours, and a 150-table benchmark.

**Sources**: `docs/backlog-database.md` §048 (scope, draft acceptance criteria), §041 (table layout, "+n columns" pill, detail levels, `BENCH_TABLES`), §042 (relationship anchors, hidden-column anchoring), §043 (editing, locked tables), §047 (lint, problem rows); founder decisions DB3, DB7, DB8, DB9 (row limit 12, keys first, saved per table), DB12; `DESIGN.md` "Database pack" (row limit, Show all / Show fewer, in-table column search, table zoom levels) and design frames 158 (large tables), 162 (zoom levels), 163 (groups); `specs/041-db-table-card/` (row limit and in-table search explicitly deferred here), `specs/042-db-relationships/` (anchor on the "+n columns" pill until this feature), `specs/010-zoom-groups-focus/` (collapsible groups, focus mode, ×n merged connectors), `specs/011-views-autolayout/` (saved views, per-view collapse state), `specs/009-stickies-search/` (⌘K palette), `specs/037-scale-bench/` and `docs/performance.md` (bench harness and targets); constitution v1.0.0 (principles I–VIII).

**Dependency note**: 040–046 are merged. Until this feature, "All" detail draws every row of a table and the saved "show all columns" choice exists in the file but is unused; hidden columns anchor on the "+n columns" pill or the title row. 047 (lint) is not required: problem rows are shown if present.

## Scope

**In scope**

- **Row limit**: a table at All detail draws at most 12 rows: keys first (primary, then foreign), then the rest in stored order. Rows that carry a relationship are never cut. The cut count shows on a "Show all n columns" button at the bottom of the card; once open it reads "Show fewer". The choice is saved per table in the deck, so some tables can stay fully open. Cards never scroll inside.
- **Hidden-column anchors**: a relationship end on a column cut by the limit anchors on the "Show all" button instead of 042's pill; connectors, export and hit areas follow the same rows.
- **In-table column filter**: with a table selected, ⌘F / Ctrl+F opens a search field on that table with a match counter; matching rows are highlighted and shown even if beyond the limit; the rest fold behind the button. Closing the filter restores the saved state.
- **Grouping mode (deck-wide)**: the deck has one grouping mode, **By group** (the groups already in the deck, today's behaviour) or **By schema**; the user switches it for the whole deck, every view follows it, and it is saved with the deck. In By schema, tables that share a schema name are shown grouped under that schema; a group collapses to one stacked card ("n tables · m relationships"); connectors between a collapsed group and each outside neighbour merge into one with a "×n" count that lists the foreign keys it carries.
- **Saved views filtered by schema / group / table**: a view can show only chosen schemas, groups or tables; it keeps its own positions, collapse state and detail level. Tables outside the filter are hidden in that view, with relationships to them shown as outside proxies.
- **Jump to (⌘K) by table and column**: results list tables and columns ("orders.customer_id"), with the table and schema as context; Enter selects the table, selects the column row (expanding the table if the row is cut) and pans to it. Results hidden by the current view offer "Show in <view>" as today.
- **Focus a table and its neighbours**: the existing Focus (F) keeps the selected table and its tables one relationship away at full strength and dims the rest; the relationships between them are highlighted. No new control: 048 only teaches Focus what a table's neighbours are.
- **Benchmark**: `pnpm bench` gains a "150 tables / 1,800 columns / 250 relationships" scenario built from the shared table fixture; panning must reach the same frame-rate target as the 500-card scenario.
- Keyboard and screen-reader support for every new control; light and dark themes; English UI copy.

**Out of scope**

- Editing the schema (043), import / export (044–045), the code panel (046), lint rules (047), flow steps touching tables (049).
- New layout algorithms or changes to the auto-layout; no per-schema auto-arrangement beyond what Tidy layout already does.
- A canvas renderer rewrite (023); this feature only measures and reports.
- Sample rows, lineage, SQL views, composite types (backlog "Later").
- Scrolling inside a card, virtualised rows, or pagination of columns.
- Changing the stored file format beyond using fields that 040 already reserves; any new field needs its own decision.
- Saving viewport, zoom or drill scope per view (stay UI state, as in 010 / 011).

## Clarifications

### Session 2026-10-04

- Q: Is the row limit configurable (a deck setting)? → A: No. It is fixed at 12 (DB9); per-table "Show all" is the escape hatch.
- Q: Does a collapsed schema group drop tables from the JSON or the SQL export? → A: No. Collapse is a view of the canvas only; exports and the code panel always cover every table.
- Q: Is "Jump to" a new palette or an extension of the existing ⌘K? → A: An extension: tables and columns become result kinds of the existing palette.
- Q: Is the limit applied to Keys and Names detail? → A: No. Keys and Names already decide their own rows (041); the limit applies at All and at zoom 90 % or more.
- Q: A table created in a filtered view falls outside the filter: add it to the filter or show it temporarily? → A: Show it temporarily with a note "outside the filter" and an "Add to this view" button; the filter never changes silently (founder).
- Q: When Jump to selects a column cut by the row limit, is the table opened permanently or temporarily? → A: Permanently: it is saved as Show all for that table, as one undo step (founder).
- Q: In a filtered view, how are relationships to hidden tables drawn? → A: One outside proxy per hidden table, named after it; collapse state of groups does not merge or change proxies (founder).
- Q: Is table focus a new action or the existing Focus (F)? → A: The existing Focus (F), no new control; for tables, neighbours are the tables one relationship away in either direction (founder).
- Q: Is grouping by schema a per-view switch or a deck-wide one, and is it the only grouping? → A: A deck-wide **grouping mode** with two choices: **By group** (the existing groups, today's behaviour) and **By schema**. One mode is active for the whole deck; collapse state stays per view (011) (founder).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read a 60-column table without it taking over the canvas (Priority: P1)

An engineer opens a schema with a 60-column `events` table. At All detail the card shows its keys and the first rows up to a limit of 12 and a "Show all 60 columns" button; the card is no taller than a normal table. They click the button to read every column, and click "Show fewer" when done. The choice sticks for that table after a reload while other tables stay short.

**Why this priority**: a single long table makes the whole board unreadable today; this is the core of the feature and delivers value alone.

**Independent Test**: load a table with 60 columns and three foreign keys; check which rows draw, open and close the table, reload, and compare with frame 158.

**Acceptance Scenarios**:

1. **Given** a table with 60 columns, **When** drawn at All detail at 100 % zoom, **Then** it shows 12 rows (keys first, then others in order) and a button "Show all 60 columns".
2. **Given** that table, **When** the user clicks the button, **Then** all 60 rows draw, the button reads "Show fewer", and the choice is saved with the deck.
3. **Given** a table whose cut rows include a foreign key that has a relationship, **When** drawn, **Then** that row is still shown (the card may show more than 12 rows) and the button counts only rows that are really hidden.
4. **Given** a relationship end on a column that is cut, **When** drawn, **Then** the connector anchors on the button's vertical centre on the facing side and moves back to the row when the table is opened.
5. **Given** a table with 12 or fewer columns, **When** drawn, **Then** no button shows.
6. **Given** a locked table, **When** the user clicks Show all, **Then** it still works (a display choice, not an edit) and unlock is not required.
7. **Given** the user presses undo after Show all, **Then** the table returns to its previous display state.

---

### User Story 2 - Find a column inside a long table (Priority: P1)

With the `events` table selected, the user presses ⌘F and types "tenant". The table shows a match counter "2/3", highlights the three matching rows (even those beyond the limit) and folds the other rows behind the button. Esc closes the filter and the table returns to its saved state.

**Why this priority**: a row limit without a way to find a hidden column would only move the problem; the design's own risk note requires it.

**Independent Test**: filter a 60-column table for a name that exists only past row 12; check highlight, counter, folding and restore.

**Acceptance Scenarios**:

1. **Given** a selected table, **When** the user presses ⌘F / Ctrl+F, **Then** a search field opens on the table and takes focus; ⌘F does not open the browser's find.
2. **Given** a filter "tenant" with 3 matches, **When** typed, **Then** matching rows are highlighted and drawn, the counter reads "1/3", and Enter / Shift+Enter move between matches.
3. **Given** an active filter, **When** the user presses Esc or clears it, **Then** the table returns to its saved expanded or limited state and nothing in the deck changed.
4. **Given** a filter with no match, **Then** the counter reads "0" and the table shows its keys and the button.
5. **Given** a locked table, **When** filtered, **Then** the filter works.

---

### User Story 3 - Jump to a table or a column (Priority: P1)

In a 150-table schema the user presses ⌘K, types "invoice_id" and sees every column with that name, each labelled with its table. Enter on `payments.invoice_id` selects the table, expands it if the row was cut, selects the column row and pans the canvas to it. Typing a table name selects and pans to the table.

**Why this priority**: at 150 tables, finding things by eye is impossible; this is the main navigation tool at scale.

**Independent Test**: on the 150-table fixture, jump to a column that is beyond the row limit and to a table far from the viewport; verify selection and viewport.

**Acceptance Scenarios**:

1. **Given** the palette is open, **When** the user types a table name, **Then** matching tables appear with their schema and column count, ranked above columns with the same text.
2. **Given** the user types a column name, **Then** columns appear as "table.column" with type and key marker, plus a count when more results exist than are shown.
3. **Given** a result for a column cut by the row limit, **When** the user presses Enter, **Then** the table is opened and saved as Show all (one undo step), the row is selected and visible, and the canvas pans to centre it.
4. **Given** a result for a table in a collapsed schema group or outside the current view's filter, **When** shown, **Then** it is marked and offers "Expand schema" or "Show in <view>" instead of changing state silently.
5. **Given** "invoice_id" typed, **When** the result is chosen, **Then** the selected object is the column row and the drawer / inspector shows that column.

---

### User Story 4 - Group tables by group or by schema and collapse them (Priority: P2)

A deck has `public`, `auth` and `billing` schemas with 50 tables each. The user switches the deck's grouping mode from "By group" to "By schema", collapses `billing` and sees one stacked card "50 tables · 62 relationships". The connectors between `billing` and `public` merge into one "×14"; clicking the count lists the foreign keys (e.g. `orders.customer_id → customers.id`). Expanding the group restores the tables where they were.

**Why this priority**: lets a reader zoom out to the shape of a schema; valuable but the schema is usable without it.

**Independent Test**: on a three-schema fixture, collapse and expand each schema and check merged connectors and the lists.

**Acceptance Scenarios**:

1. **Given** tables with schema names, **When** the deck's grouping mode is By schema, **Then** each schema's tables sit inside one group labelled with the schema name; tables without a schema stay outside any group.
   1a. **Given** the grouping mode is By group, **Then** tables are grouped only by the deck's existing groups, schema names do not create groups, and the deck behaves as it did before this feature.
   1b. **Given** the user switches the mode, **Then** it applies to every view of the deck at once, is saved with the deck, is one undo step and syncs across tabs.
2. **Given** a group, **When** collapsed, **Then** it draws as one stacked card with "n tables · m relationships" and every connector to an outside table merges per neighbour with a "×n" count.
3. **Given** a merged connector, **When** the user clicks its count, **Then** a list shows each foreign key it carries (table.column → table.column, cardinality) and choosing one selects that relationship.
4. **Given** a collapsed group, **When** the user expands it, **Then** tables return to their saved positions and connectors split again.
5. **Given** a collapsed group, **When** the deck is exported as JSON, SQL or DBML, **Then** every table is still present.

---

### User Story 5 - Save a view of one part of the schema (Priority: P2)

The user creates a view "Billing" that shows only the `billing` schema plus the `customers` table. The view keeps its own table positions, collapse state and detail level (Keys). Switching to the System view shows everything again, unchanged. Relationships from `billing` tables to hidden tables appear as dashed outside proxies.

**Why this priority**: gives repeatable, shareable slices of a big schema; builds on 011 so it is a smaller step than the row limit.

**Independent Test**: create a view filtered by one schema and one table, move a table in it, switch away and back; check positions, detail level and proxies.

**Acceptance Scenarios**:

1. **Given** the view settings, **When** the user chooses schemas, groups or tables to show, **Then** only those tables draw in that view; other views are unchanged.
2. **Given** a filtered view, **When** a table in it has a relationship to a hidden table, **Then** the end shows as an outside proxy naming the hidden table, and clicking it offers to show it.
3. **Given** a view with Keys detail and a collapsed schema group, **When** the user switches views and back, **Then** positions, collapse state and detail level are the same.
4. **Given** a new table created while a filtered view is open, **When** its schema is not in the filter, **Then** it is shown in that view until the user leaves it (so it is not lost) and a note says it is outside the filter, with an "Add to this view" button.
5. **Given** the deck is exported and re-imported, **Then** every view's filter and settings round-trip.

---

### User Story 6 - Focus a table and its neighbours (Priority: P2)

The user selects `orders` and presses Focus (F). `orders` and the tables it relates to (one hop, both directions) stay at full strength; the other 140 tables dim and stop taking clicks; the relationships between kept tables are highlighted. Pressing it again or Esc restores everything.

**Why this priority**: the quickest way to answer "what touches this table" on a big board; small once focus mode exists.

**Independent Test**: focus a table on the 150-table fixture; count the full-strength tables and compare with its relationships.

**Acceptance Scenarios**:

1. **Given** a selected table with 4 related tables, **When** focus is on, **Then** exactly those 5 tables draw at full strength and all others are dimmed to the same level as existing focus mode.
2. **Given** focus is on, **When** the user selects another table, **Then** focus follows the new selection.
3. **Given** focus is on and a related table is inside a collapsed group, **Then** the group card stays at full strength.
4. **Given** focus is on, **When** the user presses Esc, **Then** all tables return to normal and the selection is kept.

---

### User Story 7 - Know the 150-table board stays smooth (Priority: P3)

The maintainer runs `pnpm bench` and sees a 150-table scenario next to the 500-card one; panning meets the same frame-rate target. The result is recorded in the performance notes so a regression is visible.

**Why this priority**: protects the other stories from regression; a team-facing check rather than a user feature.

**Independent Test**: run the bench before and after the feature; compare the two tables.

**Acceptance Scenarios**:

1. **Given** the bench, **When** it runs, **Then** it includes a deck of 150 tables, 1,800 columns and 250 relationships built from the shared table fixture.
2. **Given** that scenario, **When** panning, **Then** the median frame time meets the same target as the 500-card scenario.
3. **Given** the result, **Then** before / after numbers and the machine used are recorded in the feature folder and in the performance notes.

---

### Edge Cases

- A table with exactly 12 columns, or 13 columns where one is a connected column: the button appears only when at least one row is really hidden; never "Show all 1 column".
- A table with more than 12 connected columns: all connected rows draw; the button counts only the rest and disappears if none remain.
- A column renamed, reordered, added or deleted while the filter is open: matches and the counter update; the focused match stays valid or moves to the next one.
- Show all on a table at Names or Keys detail, or below 90 % zoom: Names / Keys / zoom rules decide the rows (041); the saved choice applies again when the table is drawn at All; a table set to Show all always wins at Keys (as 041 states).
- Two tabs: one opens a table while the other deletes the column the filter matched; nothing crashes and the counter updates.
- A schema group with one table, with none (all deleted), or with a table moved to another schema: the group updates or disappears; collapsed state is dropped for empty groups.
- A table whose schema is renamed while its group is collapsed: the table follows the new name's group; collapse state follows the schema name where possible.
- Switching modes while groups are collapsed: collapse state is kept separately for each mode and view, so returning to a mode restores what was collapsed there; nothing is lost.
- A table that belongs to an existing group and has a schema: in By group it follows its group, in By schema it follows its schema; its stored `group` and `parent` never change.
- A view filter that matches no table: the view shows an empty canvas with a note "No tables match this view" and a way to edit the filter.
- Jump to with 10,000 results (a very common column name): shows a capped list and a "n more" line; typing narrows it; the palette stays responsive.
- Jump to a column in a locked table or a table in another database card: selection works; nothing is edited.
- Export (SVG / PNG) of a table cut by the row limit: draws the same rows and button as the canvas; of a collapsed group: draws the collapsed card.
- A very large deck imported (044) opening with all tables at the limit: opening time does not grow with the number of hidden rows.
- Reduced-motion users: panning to a result and opening a table do not animate.

## Requirements _(mandatory)_

### Functional Requirements

**Row limit and Show all**

- **FR-001**: At All detail and zoom 90 % or more, a table MUST draw at most 12 rows, chosen in this order: primary-key columns, foreign-key columns, then the rest in stored order, unless the table is opened.
- **FR-002**: A column that is the end of any relationship MUST always draw, even when beyond the limit; the card then shows more than 12 rows.
- **FR-003**: When one or more rows are hidden, the card MUST show a full-width button reading "Show all n columns" (n = total columns); when the table is opened it MUST read "Show fewer". No button shows when no row is hidden.
- **FR-004**: Opening or closing a table MUST be saved per table in the deck, undoable, synced across tabs and unaffected by locking.
- **FR-005**: A card MUST NOT scroll inside; its height follows its rows, button, notes and footer, and the canvas, connectors, hit areas and exports MUST all use the same height and row list.
- **FR-006**: A relationship end on a hidden column MUST anchor at the vertical centre of the button on the facing side; when the table is opened the end MUST return to its row. This replaces 042's anchoring on the "+n columns" pill for rows cut by the limit.
- **FR-007**: The saved per-table choice MUST NOT change what Names or Keys detail shows (041), and a table set to Show all MUST keep winning at Keys.

**In-table column filter**

- **FR-008**: With one table selected, ⌘F (macOS) / Ctrl+F (others) MUST open a column filter on that table, take focus and prevent the browser's own find; Esc or clearing the field MUST close it and restore the saved display state.
- **FR-009**: While a filter has text, rows whose name contains it (case-insensitive) MUST draw highlighted, in stored order, even when beyond the limit; non-matching rows MUST fold behind the button; connected rows still draw.
- **FR-010**: The filter MUST show a counter "k/n" (or "0") and Enter / Shift+Enter MUST move between matches, scrolling the canvas to keep the match visible.
- **FR-011**: The filter MUST NOT change the document and MUST work on locked tables.

**Schemas as groups**

- **FR-012**: The deck MUST have one grouping mode, **By group** (default; today's groups) or **By schema**, switched for the whole deck (not per view), saved with the deck, undoable and synced. In By schema, tables with a schema name are shown inside one group per schema, labelled with the name. This is a display layer: table `group` and `parent` fields are not changed.
- **FR-013**: A schema group MUST collapse and expand like an architecture group (chevron, Space, saved per view); collapsed, it draws as a stacked card with "n tables · m relationships".
- **FR-014**: Connectors between a collapsed group and an outside neighbour MUST merge into one per neighbour with a "×n" count; its list MUST show each foreign key it carries (table.column → table.column and cardinality) and choosing one selects that relationship.
- **FR-015**: Collapse MUST NOT remove tables from JSON, SQL, DBML, search, lint or the inspector's lists.

**Saved views**

- **FR-016**: A view MUST be able to filter tables by schema, group or explicit table list; the filter, the view's own positions, collapse state and detail level MUST be saved with the view and round-trip through export and import.
- **FR-017**: Tables outside a view's filter MUST be hidden in that view only; relationships from visible to hidden tables MUST show as one outside proxy per hidden table, naming it, whatever the collapse state of groups; other views MUST not change.
- **FR-018**: A table created in a filtered view MUST stay visible in that view until the user leaves it, with a note that it is outside the filter and an "Add to this view" button that adds it to the filter (one undo step); the filter MUST NOT change otherwise.
- **FR-019**: A view whose filter matches no table MUST show an empty-state message with a way to edit the filter.

**Jump to and focus**

- **FR-020**: The ⌘K palette MUST also search tables (by name, with schema) and columns (by name, shown as table.column with type and key marker); table results rank above column results with the same match.
- **FR-021**: Choosing a table result MUST select the table and pan to it; choosing a column result MUST open the table if the row is cut (saved as Show all, one undo step, even on a locked table), select the row and pan to it; the target MUST be visible in the viewport afterwards.
- **FR-022**: A result in a collapsed schema group or outside the current view's filter MUST be marked and offer "Expand schema" or "Show in <view>"; it MUST NOT change state silently.
- **FR-023**: Results MUST be capped (with a "n more" line) so the palette responds without delay on any deck.
- **FR-024**: The existing Focus (F) on a selected table MUST (no new control) keep that table and every table one relationship away (either direction) at full strength and dim the others like existing focus mode; relationships among kept tables are highlighted; it follows the selection and ends with Esc or the same action.

**Performance and quality**

- **FR-025**: The bench MUST include a scenario of 150 tables, 1,800 columns and 250 relationships built from the shared table fixture; panning MUST meet the same frame-rate target as the 500-card scenario.
- **FR-026**: Opening a deck, drawing and panning MUST cost no more per table when rows are hidden than the visible rows cost; the hidden rows MUST NOT be laid out for drawing.
- **FR-027**: Every new control MUST be reachable by keyboard, have an accessible name (for example "Show all 60 columns" and the count of matches), and meet 4.5:1 contrast in light and dark; reduced-motion users get no panning animation.
- **FR-028**: The row limit, filter, grouping, view filters, Jump to and focus MUST NOT send deck content over the network and MUST not use a third-party service.

### Key Entities

- **Table display state**: for each table, whether it is opened (all columns) or limited, saved with the deck; plus, while filtering, a temporary filter text that is never saved.
- **Row selection for a table**: the set and order of rows a table draws given its detail level, zoom, display state, relationships and active filter; one source for the canvas, connectors, hit areas and exports.
- **Schema group**: a display grouping of tables that share a schema name, with a collapsed flag per view and a derived table count and relationship count.
- **Merged relationship connector**: the single line between a collapsed group and one outside neighbour, with a count and the list of foreign keys it stands for.
- **View filter**: the schemas, groups or tables a view shows, stored with the view next to its positions, collapse state and detail level.
- **Jump result**: a table or column match with its table, schema, type and key marker, and the action it triggers.
- **Neighbour set**: the selected table plus the tables one relationship away; the basis of table focus.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A 60-column table at All detail is no taller than a table with 12 columns plus the button (within one row height), and the whole board fits at least 4 times as many such tables on screen as when every row is drawn.
- **SC-002**: A user can find and select a column in a 150-table schema in under 10 seconds using ⌘K; jumping to "invoice_id" selects its row and brings it fully into view in every test case.
- **SC-003**: Opening and closing a table changes only that table's size; connector end points move by 0 px relative to the rows they are attached to, and no connector ends at a row that is not drawn, across all detail levels and zoom levels.
- **SC-004**: Filtering a 60-column table for text that exists only beyond the row limit shows every match, and closing the filter returns the table to exactly its previous state.
- **SC-005**: On the 150-table benchmark deck, panning holds the same frame-rate target as the 500-card deck, and opening the deck costs no more than 1.5 times the time of a 500-card deck of the same file size.
- **SC-006**: Collapsing a schema group with 50 tables reduces what draws to one card plus its merged connectors, and expanding it restores every table to its previous position, in both cases in under 1 second on the benchmark deck.
- **SC-007**: A saved view restricted to one schema shows only that schema's tables plus outside proxies; switching to another view and back restores positions, collapse state and detail level exactly.
- **SC-008**: Focusing a table shows exactly the table and its one-hop neighbours at full strength on the benchmark deck, with all other tables dimmed.
- **SC-009**: SVG and PNG exports show the same rows, buttons and merged connectors as the canvas for a limited table, an opened table and a collapsed schema group.
- **SC-010**: The full automated check set (lint, types, tests, build, smoke) passes and the smoke suite stays under 30 seconds.

## Assumptions

- The row limit is a fixed 12 (DB9); a per-table "Show all" is the only control. There is no deck setting for the limit.
- The per-table saved choice uses the file field that 040 already reserves; no file-format change is needed. A saved view's filter may need an additive field; if so it follows the schema decision process and round-trips (constitution II).
- The grouping mode is a deck-level setting (one new additive deck field, to be decided in `/speckit-plan`); By schema is a display layer on top of the existing group mechanism (010) and per-view collapse state (011); a table keeps its own `group` and `parent`.
- The row-limit logic lives in the single place that already decides a table's rows and height (041's table layout), so the canvas, connectors, hit areas and exports cannot disagree.
- "One hop" for focus counts a relationship in either direction between two tables; self-references add no neighbour.
- Frames 158, 162 and 163 are the visual reference; where a frame and DESIGN.md disagree, DESIGN.md wins.
- 047 (lint) is optional: if problem rows exist they are drawn; if a problem row is cut, its table shows it as a connected row.
- Show all / Show fewer, the filter and focus are display choices, not edits: they work on locked tables; only Show all / Show fewer is saved.
- The benchmark target is the existing 500-card frame-rate target in `docs/performance.md`; this feature adds the 150-table row and records before / after, it does not change the target.
- This feature adds no new runtime dependency, no network call, and no new end-to-end tests (founder deferral); the existing smoke suite must stay green.
