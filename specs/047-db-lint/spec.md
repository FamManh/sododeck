# Feature Specification: Schema Lint

**Feature Branch**: `047-db-lint`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "47" — `docs/backlog-database.md` §047: schema mistakes show up in the Problems list before they reach SQL. Rules for tables, columns, keys, relationships, enums and defaults; clicking a problem selects the table and the row; one-click fixes where the fix is obvious.

**Sources**: `docs/backlog-database.md` §047 (rules, draft acceptance criterion) and §052 (the "Block SQL export with errors" switch moved there); `specs/015-model-validation/` (Problems list, canvas marks, go to problem, ⌘.); `specs/040-db-schema-model/` (today's database problems: missing column, mismatched composite keys, missing enum); `specs/042-db-relationships/` (type comparison, n–n); `specs/043-db-editing/` (the (!) type-mismatch icon on rows, duplicate names refused by the line editor); `specs/045-db-export/` (problems banner in the export dialog); `specs/046-db-code-panel/` (DBML text can bring in duplicates the canvas refuses); `specs/048-db-scale/` (hidden rows, "Show all"); `specs/052-db-drawer/` (block switch, dialect type lists, "types outside the list are only marked, lint checks them", fix targets such as the Columns tab and the enum editor); design-analysis §a frames 144, 145, 161, 167; DESIGN.md "Database pack"; constitution v1.0.0.

**Dependency note (2026-10-04)**: 015, 040–046 are merged. 048, 049 and 052 are being implemented. This feature gives every problem a severity, which 052's block switch reads (052 counts every database problem as an error until this lands).

## Scope

**In scope**

- **Severity**: every problem in the Problems list, of any kind, is an **error** or a **warning**. The list gets All / Errors / Warnings filters with counts (frames 144, 167), and each row shows its severity icon.
- **Schema rules** (each a problem kind with a fixed severity):

  | Rule                                                                          | Severity |
  | ----------------------------------------------------------------------------- | -------- |
  | Table without a primary key                                                   | Warning  |
  | Two tables with the same name in the same schema                              | Error    |
  | Two columns with the same name in one table                                   | Error    |
  | Two indexes with the same name in one table                                   | Error    |
  | Two enums with the same name in the same schema; two equal values in one enum | Error    |
  | Column with an empty name or no type                                          | Error    |
  | Relationship whose two ends have different types                              | Error    |
  | Relationship to a column that does not exist (040, kept)                      | Error    |
  | Relationship whose two ends have different column counts (040, kept)          | Error    |
  | Not-null column whose default is `null`                                       | Error    |
  | Relationship that does not point at the primary key or a unique column        | Warning  |
  | n–n relationship (no junction table)                                          | Warning  |
  | Enum without values                                                           | Warning  |
  | Default that does not fit the column type (number, boolean, enum value)       | Warning  |
  | Required relationships that form a loop                                       | Warning  |
  | Two relationships between the same columns                                    | Warning  |
  | Column type not in the deck dialect's list (052)                              | Warning  |

- **Canvas marks** (frames 144, 161, 167): a table with problems shows a count badge in its header and a dashed outline in the problem colour; the faulty row shows an alert glyph in place of its key glyph; a relationship with a problem draws dashed in the problem colour with a short label (`int → uuid`, `n–n`). The 043 (!) icon becomes this row mark.
- **Go to a problem**: clicking a row in the list, or ⌘. / ⇧⌘., selects the table, focuses the faulty row (expanding a cut table if the row is hidden), pans it into view, and opens a small fix popover next to it.
- **One-click fixes** (frame 167), each one undo step:

  | Problem                                      | Fixes offered                                                               |
  | -------------------------------------------- | --------------------------------------------------------------------------- |
  | No primary key                               | "Make id the PK" (when a column named `id` exists) · "Add id <type> PK"     |
  | Type mismatch                                | "Change type" (sets the referencing column to the referenced column's type) |
  | Missing column                               | "Pick column" (opens the relationship drawer on that end)                   |
  | Duplicate column / table / index / enum name | "Rename" (opens the name in place, or the drawer field)                     |
  | n–n relationship                             | "Create junction table"                                                     |
  | Enum without values                          | "Add values" (opens the enum editor)                                        |
  | Not-null with null default                   | "Remove default" · "Allow null"                                             |
  | Duplicate relationship                       | "Delete duplicate"                                                          |
  | Type not in the dialect's list               | "Change type" (opens the type picker)                                       |

  Other rules only take the user to the object.

- **Export**: the export dialog's banner (045) shows errors and warnings separately; 052's block switch counts errors only.

**Out of scope**

- The "Block SQL export with errors" switch itself and the export blocking (052).
- Turning rules off, or ignoring a single problem.
- Rules on naming style (snake_case, plural table names) or on missing indexes.
- Checks that need a live database or sample data.
- Changing how non-database problems are found; they only get a severity.

## Clarifications

### Session 2026-10-04

- Q: Is a table without a primary key an error or a warning? → A: A warning. It never blocks SQL export.
- Q: What severity do the existing non-database problem kinds get? → A: Errors for broken references, a flow step without a connection, a broken flow chain, invalid rule cells and a missing enum; every other existing kind is a warning.
- Q: Can users turn a rule off or ignore a single problem? → A: No, not in this feature. Warnings only show and never block; ignoring is a later idea.
- Q: Which column does "Change type" change on a type mismatch? → A: The referencing (foreign key) column takes the referenced column's type and size; the referenced key is never changed by the fix.
- Q: When many columns use the same type that is not in the dialect's list, how is it listed? → A: One warning per type name ("citext is not a MySQL type · 12 columns"); going to it opens the first column and the popover lists the others.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See schema mistakes in the Problems list (Priority: P1)

A user removes `payments.id`. Within a moment the rail's Problems badge goes up by one, the `payments` card shows a "1" badge and a dashed outline, and the Problems list reads "payments has no primary key" with a warning icon. They also see a warning "Enum shipment_status has no values". They switch the list to Warnings and see both.

**Why this priority**: Finding mistakes before export is the whole point of lint; the list and marks are needed by every other story.

**Independent Test**: In "Shop", remove `payments.id`. The list shows "payments has no primary key" as a warning and the table shows the badge (the backlog's acceptance criterion).

**Acceptance Scenarios**:

1. **Given** the "Shop" deck with `payments.id` removed, **When** the Problems list updates, **Then** it shows "payments has no primary key" with the warning icon, and `payments` shows a problem badge with the count 1.
2. **Given** each rule in the Scope table, **When** a deck breaks it, **Then** exactly one problem of that kind appears per broken object, with the listed severity, and it disappears as soon as the cause is fixed.
3. **Given** a list with errors and warnings, **When** the user picks Errors or Warnings, **Then** only that severity shows, and each filter shows its count.
4. **Given** a column whose type differs from the column it references (`loyalty_points.customer_ref int` → `customers.id uuid`), **Then** the list reads "loyalty_points.customer_ref is int, customers.id is uuid", the faulty row shows the alert glyph, and the relationship draws dashed with the label `int → uuid`.
5. **Given** a deck with no database tables, **Then** no schema rule produces a problem, and the existing problems keep working with their severity.
6. **Given** a problem on a row hidden by the row limit or a Names / Keys detail, **Then** the table badge still counts it.

---

### User Story 2 - Go to a problem and fix it in one click (Priority: P1)

The user clicks "audit_log has no primary key". The canvas pans to `audit_log`, selects it, focuses the `id` row and opens a popover: "No primary key · Make id the PK · Add id uuid". They pick "Make id the PK". The problem disappears, and ⌘Z brings it back.

**Why this priority**: A list without a way to the object and a fix leaves users hunting on a large board.

**Independent Test**: For each fix in the Scope table, trigger the problem, apply the fix from the list and from the popover; the problem is gone and one ⌘Z restores it.

**Acceptance Scenarios**:

1. **Given** a schema problem in the list, **When** the user clicks it, **Then** the table is selected, the faulty row is focused, the table is panned into view, and the fix popover opens beside it.
2. **Given** a problem on a row hidden by the row limit, **When** the user goes to it, **Then** the table shows the row (as "Show all" would, for this visit only) and focuses it.
3. **Given** "No primary key" on a table with a column named `id`, **When** the user picks "Make id the PK", **Then** `id` becomes the primary key; with no `id` column, "Add id <type> PK" adds a first column `id` of the dialect's id type (uuid on Postgres, char(36) on MySQL, text on SQLite, uuid on Generic) as the primary key.
4. **Given** a type mismatch, **When** the user picks "Change type", **Then** the referencing column takes the referenced column's type and size, and both row glyphs and the dashed line clear.
5. **Given** an n–n relationship between `products` and `categories`, **When** the user picks "Create junction table", **Then** a table `products_categories` is added between them with two not-null key columns referencing each side's primary key, its primary key made of both, the n–n relationship replaced by two 1–n relationships, all as one undo step.
6. **Given** any fix, **When** it is applied, **Then** it is one undo step, and the announcement names what changed.
7. **Given** ⌘. / ⇧⌘., **When** pressed, **Then** the next or previous problem is visited the same way, errors before warnings.

---

### User Story 3 - See errors and warnings before exporting SQL (Priority: P2)

A user opens Export and picks SQL. The banner reads "2 errors · 1 warning in this deck" and lists them; "Show problems" opens the list. With 052's block switch on, Copy and Download stay disabled until the two errors are fixed; the warning does not block.

**Why this priority**: Export is where mistakes become costly; the dialog must say how serious they are.

**Independent Test**: With one error and one warning in scope, the banner shows both counts; with the block switch on, fixing the error enables SQL export while the warning remains.

**Acceptance Scenarios**:

1. **Given** errors and warnings on tables in the export scope, **When** a schema format is chosen, **Then** the banner shows the error and warning counts and lists errors first.
2. **Given** only warnings in scope and the block switch on, **When** SQL is chosen, **Then** export is not blocked.
3. **Given** problems only on tables outside the scope, **Then** the banner does not count them.

---

### Edge Cases

- **Duplicates from DBML text or import**: the canvas refuses duplicate names (043, 052), but the DBML tab or an import can bring them in; the duplicate rules report them. Names compare ignoring case.
- **Composite primary key**: counts as a primary key. A relationship pointing at all columns of a composite primary key, or at the columns of a unique index, counts as pointing at a key.
- **Type comparison**: the same comparison as 042 and 043 (type name and size, ignoring case), plus the common type names, so `int` and `integer`, or `timestamptz` and `timestamp with time zone`, match. Enum-linked columns compare by enum.
- **Default fit**: only checked when the type is clearly a number, a boolean or an enum; expressions (`now()`) and unknown types are never flagged.
- **Required loop**: a loop counts only when every relationship in it is not-null on the referencing side; a self-reference with a nullable column is fine. One problem per loop, naming its tables.
- **Duplicate relationship**: two relationships with the same column ends in the same direction; the second one (in deck order) is the duplicate.
- **Many columns with one unlisted type**: one warning per type name with the column count; go to opens the first column, and the popover lists the rest with links.
- **Generic dialect**: "type not in the list" checks the Generic common type list.
- **Name-only column** (043 stores no type): reported as "no type".
- **Large decks**: problems update after edits without slowing the canvas; the list shows the first problems at once and the rest as the user scrolls.
- **One cause, several rules**: a missing referenced column reports only "column does not exist", not also a type mismatch.
- **Locked table**: fixes that would change a locked table are disabled with "Locked · unlock to fix"; going to the problem still works.
- **Problem severity of older kinds**: every existing kind gets a severity (Assumptions); nothing else about them changes.

## Requirements _(mandatory)_

### Functional Requirements

**Severity and list**

- **FR-001**: Every problem MUST have a severity, error or warning, fixed by its kind.
- **FR-002**: The Problems list MUST offer All, Errors and Warnings filters with counts, MUST show the severity icon on each row, and MUST list errors before warnings within the current order.
- **FR-003**: The rail's Problems badge MUST count all problems, and its colour MUST follow the most severe one.

**Rules**

- **FR-004**: The system MUST report each rule in the Scope table, with its severity, once per broken object (table, column pair, index, enum, relationship or loop), except the unlisted-type rule, which is once per type name (FR-007a).
- **FR-005**: Problems MUST update after every edit, import, DBML apply, undo and redo, as the existing list does, and MUST disappear when their cause is gone.
- **FR-006**: Names MUST be compared ignoring case; types MUST be compared as in 042 with common type names treated as equal.
- **FR-007**: A broken reference MUST NOT also produce follow-on problems on the same relationship.
- **FR-007a**: "Type not in the dialect's list" MUST be one warning per type name (ignoring case), counting and listing its columns.
- **FR-008**: Each problem's text MUST name the objects involved as `table.column` (schema-qualified when the deck has several schemas).

**Canvas**

- **FR-009**: A table with problems MUST show a count badge and the problem outline; a faulty row MUST show the alert glyph in place of its key glyph; a relationship with a problem MUST draw dashed in the problem colour with a short label. Errors and warnings MUST be told apart by icon, not colour alone.
- **FR-010**: Hidden rows (row limit, detail level, zoom) MUST still count in the table badge.

**Go to and fix**

- **FR-011**: Going to a problem (click, ⌘., ⇧⌘.) MUST select the table, focus the faulty row (showing it if hidden, for that visit only, nothing saved), pan it into view and open the fix popover.
- **FR-012**: The fixes in the Scope table MUST be offered in the list row and the popover. Each fix MUST be one undo step and MUST be announced.
- **FR-013**: "Create junction table" MUST add a table named `<from>_<to>` (first free name), with one not-null column per key column of each side named `<table singular or name>_<column>`, a composite primary key of those columns, two 1–n relationships replacing the n–n one, placed between the two tables.
- **FR-014**: "Add id <type> PK" MUST use the deck dialect's id type: Postgres `uuid`, MySQL `char(36)`, SQLite `text`, Generic `uuid`, and insert the column first.
- **FR-015**: Fixes that would change a locked table MUST be disabled with an explanation.

**Export**

- **FR-016**: The export dialog banner (045) MUST show error and warning counts for tables in scope, errors first; 052's block switch MUST count errors only.

**General**

- **FR-017**: Finding problems MUST stay off the main thread as it does today, and MUST never write to the deck.
- **FR-018**: All new UI MUST use the existing Problems list, popover and token components, and match frames 144, 161 and 167 in light and dark.

### Key Entities

- **Problem**: an existing derived item (kind, target, title, detail) that gains a **severity** and, for schema rules, an optional row target and fix list. Never stored in the deck.
- **Rule**: a check over the deck's tables, relationships and enums that yields problems of one kind and severity.
- **Fix**: a named one-step change offered for a problem (make PK, add id PK, change type, create junction table, remove default, allow null, delete duplicate) or a navigation to an editor (rename, pick column, add values, change type in the picker).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every rule in the Scope table is reported for a deck built to break it, and none is reported for the clean "Shop" deck (0 false problems).
- **SC-002**: A problem appears or disappears within 1 second of the edit that causes or fixes it, on a 150-table deck, with no visible pause in panning or typing.
- **SC-003**: From the Problems list, a user reaches the faulty row and fixes a "no primary key", a type mismatch and an n–n problem in under 1 minute in total.
- **SC-004**: Every one-click fix is undone by exactly one ⌘Z.
- **SC-005**: With the block switch on, SQL export is blocked in 100 % of cases with an in-scope error and in 0 % of cases with only warnings.
- **SC-006**: Frames 144, 161 (problem state) and 167 are matched pixel-close in light and dark at 100 %.

## Assumptions

- **Severity per kind is fixed**, not configurable. Errors are what produce invalid or failing SQL; warnings are design smells. The table in Scope follows frames 144 and 167 (type mismatch is an error; n–n and empty enum are warnings), except that a missing primary key is a warning (clarified 2026-10-04) so sketch decks are never blocked from SQL export for it.
- **Existing kinds' severity** (clarified 2026-10-04): errors for `broken-reference`, `db-dangling-reference`, `db-composite-mismatch`, `step-without-connection`, `broken-chain`, `invalid-rule-cells`, and the existing missing-enum check; warnings for every other existing kind.
- **No ignore or disable** (clarified 2026-10-04): warnings only show and never block; a sketch deck without keys shows warnings until keys are added. Ignoring is a later idea.
- **"Change type" on a mismatch** (clarified 2026-10-04) changes the referencing (foreign key) side, because the referenced key is usually right; the user can still edit either side by hand.
- **Junction table naming**: `<from>_<to>` from the table names as written (`products_categories`), columns `<table>_<column>` (`products_id`, `categories_id`); placed at the midpoint of the two tables.
- **The 043 (!) icon** is replaced by the lint row glyph for type mismatches, so there is one signal for one problem.
- **Problem colour** is the existing problem token (Clay), as frames 144 and 167 draw it.
- **Row focus** on go-to uses 042's row focus; showing a hidden row is temporary like 043's row editing.
