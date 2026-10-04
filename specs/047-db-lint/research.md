# Research: Schema Lint (047)

Phase 0 of [plan.md](plan.md). The clarify answers (2026-10-04) are settled:

- A table without a primary key is a **warning**; it never blocks SQL export.
- Existing kinds: errors for broken references, a step without a connection, a broken chain, invalid rule cells and a missing enum; every other existing kind is a warning.
- No way to ignore a problem or turn a rule off.
- "Change type" changes the referencing (foreign key) column.
- One "type not in the list" warning per type name.

The code facts come from a survey of `main` on 2026-10-04 after 052 (#101) and 048 (#102) merged.

## R1. Severity lives on the problem, fixed per kind, in the model

- **Decision:** `packages/model/src/problems.ts`:
  - `Problem.severity: 'error' | 'warning'`, set in `finish` from a `SEVERITY: Record<ProblemKind, Severity>` table. A draft may override it (the missing-enum check reuses `db-dangling-reference` and stays an error).
  - `DeckProblems` gains `errors` and `warnings` counts.
  - Sort: severity first (errors before warnings), then today's kind rank, object title, order, key. ⌘. follows the list order, so errors are visited first (FR-002, US2 scenario 7).
- **Rationale:** problems are derived in the worker from the deck (ADR 0013); severity is a property of the kind, so it belongs in the same place. One table keeps it reviewable.
- **Alternatives:** severity computed in the app (rejected: two sources of truth for list order, export and badge).

## R2. Type data moves into the model

- **Decision:** move the pure type data into `packages/model/src/db-types.ts`:
  - `COMMON_TYPES` (from `apps/app/src/db/export/common-types.ts`), `DIALECT_TYPES`, `INDEX_METHODS`, `DIALECT_HINTS`, `typeEntry` (from `apps/app/src/db/dialect-types.ts`), and `commonOf` (from `apps/app/src/db/import/convert-types.ts`, now exported as `commonTypeOf(type, dialect)`).
  - The app modules keep their functions (`translateType`, `convertType`, the picker) and import the data from `@sododeck/model`. The old files re-export nothing; their importers (about 12 files) are updated.
  - New `sameColumnType(a, b, dialect)`: equal when the normalised names and sizes are equal, or when both resolve through `commonTypeOf` (dialect spelling first, then canonical and aliases) to the same common type with equal sizes. Enum-linked columns compare by `enumRef`.
- **Rationale:** `checkDeck` runs in `@sododeck/model` (worker), and two rules need the data: type mismatch with common names (FR-006) and "type not in the dialect's list" (052 clarify). Dependency direction stays `app → model`. The data is a few hundred lines of constants with no imports.
- **Why dialect-first:** plain aliases would make `timestamptz` equal `timestamp` (both are names of the common `timestamp` entry), which is wrong on Postgres. Resolving through the dialect's own spelling first (`timestamp` on Postgres is the `datetime` entry) keeps them apart, while `int` and `integer` still match.
- **Alternatives:** pass a type catalogue into `checkDeck` from the app worker (rejected: model tests and other callers would need it too, and the rules would be split across packages); keep the 042 exact comparison (rejected: `int` vs `integer` would be an error, a false positive on imported decks).
- **043's `typeMismatch`** (`editor/relationships/type-mismatch.ts`) and 052's drawer pair check call `sameColumnType`, so the canvas, drawer and lint agree.

## R3. Rules: one pass in `checkDatabase`, new kinds

- **Decision:** extend `checkDatabase` with these kinds (contracts/lint-rules.md has messages, targets and fixes):

  | Kind                        | Severity                              |
  | --------------------------- | ------------------------------------- |
  | `db-no-primary-key`         | warning                               |
  | `db-duplicate-table`        | error                                 |
  | `db-duplicate-column`       | error                                 |
  | `db-duplicate-index`        | error                                 |
  | `db-duplicate-enum`         | error (also equal values in one enum) |
  | `db-empty-column`           | error (no name or no type)            |
  | `db-type-mismatch`          | error                                 |
  | `db-null-default`           | error                                 |
  | `db-fk-not-key`             | warning                               |
  | `db-many-to-many`           | warning                               |
  | `db-empty-enum`             | warning                               |
  | `db-default-type`           | warning                               |
  | `db-required-loop`          | warning                               |
  | `db-duplicate-relationship` | warning                               |
  | `db-unknown-type`           | warning                               |

  `db-dangling-reference` and `db-composite-mismatch` stay errors.

- **Pass structure:** one walk builds per-deck indexes (tables by schema-qualified lower-case name, columns by id, primary key sets, unique sets, enum by id); each rule reads them. A relationship with a dangling or mismatched-length end is skipped by the type, key and duplicate rules (FR-007).
- **Null default:** the schema cannot store `null` as `default` (string, number or boolean only) and the line editor drops `default null`. A null default can only arrive as `defaultExpr` `NULL` from import or DBML, so the rule is `notNull && /^\s*null\s*$/i.test(defaultExpr)`.
- **Default fit:** checked only when the type resolves to a common type of kind number (value must be a number or a numeric string) or boolean (boolean, or `'true'` / `'false'` / `0` / `1`), or when the column links an enum (the value must be one of its values). Expressions and unknown types are skipped.
- **Required loop:** a directed graph from the referencing table to the referenced table over relationships whose referencing columns are all not-null; strongly connected components (iterative Tarjan) with more than one table, or a self-edge, give one problem each, listing the tables. Linear in tables plus relationships.
- **Duplicate relationship:** same table pair, same direction and same ordered column lists, the label ignored. Relationships (edges with column ends) are excluded from `duplicate-connection`, so one cause gives one problem.
- **Unknown type:** grouped by lower-case type name; columns with an enum link, an empty type (reported as `db-empty-column`), or a type found by `typeEntry(dialect, …)` are skipped. Generic checks the Generic list.
- **Fk not key:** the referenced columns, as a set, must equal the table's primary key set, a single unique column, or the column set of a unique index.

## R4. Row targets and canvas marks

- **Decision:**
  - `Problem.column?: { tableId, columnId }` names the faulty row (the referencing column for mismatches and null defaults; the second duplicate column; the first column of an unknown type; the `id` candidate for no primary key when it exists). Drafts list it; `byObject` is unchanged.
  - `ProblemMark` gains `severity` (worst), `rows: ReadonlyMap<Id, Severity>` (column id → worst) and, for edges, `short?: string` (`int → uuid`, `n–n`). `problemMarks` builds them from `column` and an optional draft `short`. `sameProblemMark` compares the new fields.
  - Table card: `TableRow` replaces 043's `mismatch` with `problem?: Severity`; `table-body.tsx` draws the alert glyph (error `CircleX` clay, warning `TriangleAlert` amber) **in place of the key glyph** (frame 167) with the problem title as its accessible name and tooltip. `mismatchedColumns` and `TableContext.mismatched` are removed: the lint is the one source (spec assumption).
  - Header badge and dashed outline stay as today (`deck-node.tsx`), coloured by the mark's severity.
  - Relationship: `deck-edge.tsx` draws a relationship with a mark dashed in the severity colour, with a small pill carrying `short` near the middle (frame 144); other edges keep today's label glyph.
- **Rationale:** marks already flow from `useProblems()` through `problemMarks` into node and edge data with cache checks (survey §3). Adding rows there reuses that path and keeps one signal per problem.

## R5. Fixes as data in the model, applied in the app

- **Decision:** replace `Problem.fix?` with `fixes?: readonly ProblemFix[]` (the first is primary). `ProblemFix` becomes a union of plain data:

  | `kind`            | Data                                   | Applied by (app)                                                             |
  | ----------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
  | `remove-value`    | nodeId, fieldId (032, kept)            | `setValues(…, null)`                                                         |
  | `make-pk`         | tableId, columnId                      | `updateColumn({ pk: true })`                                                 |
  | `add-id-pk`       | tableId, type                          | `addColumn(tableId, { name: 'id', type, pk: true, notNull: true }, 0)`       |
  | `match-type`      | tableId, columnId, type, size?         | `updateColumn({ type, size })` (one per pair for composite ends, one batch)  |
  | `create-junction` | edgeId                                 | `db/junction-table.ts` (R6)                                                  |
  | `remove-default`  | tableId, columnId                      | `updateColumn({ defaultExpr: null })`                                        |
  | `allow-null`      | tableId, columnId                      | `updateColumn({ notNull: null })`                                            |
  | `delete-edge`     | edgeId                                 | `editor.remove('edges', …)` with 043's Undo toast                            |
  | `rename`          | target (table / column / index / enum) | opens title edit, 052's drawer field, or the enum editor                     |
  | `pick-column`     | edgeId                                 | opens the relationship drawer                                                |
  | `add-values`      | enumId                                 | `openEnumDrawer`                                                             |
  | `pick-type`       | tableId, columnId                      | `openTableDrawer(…, { tab: 'columns', columnId })` with the type picker open |

  The id type for `add-id-pk` is chosen in the model by dialect (Postgres `uuid`, MySQL `char(36)`, SQLite `text`, Generic `uuid`). `make-pk` is offered when a column named `id` (any case) exists, else `add-id-pk`.

- **App:** `editor/problems/apply-fix.ts` (`applyFix(ctx, problem, fix)`), one `oneStep` / `editor.batch` per write fix, an announcement per fix, and `refuseLocked` for fixes on a locked table (FR-015: the button is disabled with `LOCKED_HINT`).
- **Rationale:** problems cross the worker boundary as JSON; fixes as data keep `checkDeck` pure and let the list and the popover share one apply path. 032's only fix moves into the union unchanged.

## R6. Create junction table

- **Decision:** `apps/app/src/db/junction-table.ts`:
  - `planJunction(deck, edgeId) → { name, columns, position, links }`: name `<from>_<to>` (first free with `_2`… via the model's `copyName` rule, same schema as `from`), one column per key column of each side named `<table>_<column>` with that column's type and size, `notNull: true`, `pk: true`; position at the midpoint of the two tables (snapped like `addTable`).
  - `applyJunction(editor, plan, edgeId)`: one `editor.batch`: add the table node (`addNode` as `addTable` does), add its columns, add two relationships junction → each side (`cardinality: 'n-1'`, column ends), remove the n–n edge. Selects the new table and announces it.
- **Rationale:** FR-013; reuses 043's table creation and 042's relationship shape. SQL export already writes a junction for n–n (045); this makes it explicit on the board.

## R7. Go to a problem: row focus, temporary All, fix popover

- **Decision:**
  - `goToProblem` (node / edges branches) also, when `problem.column` is set: `setFocusedRow({ tableId, columnId })`, and sets a new UI-only `ui.problemReveal = { tableId }` that `editor/views/view-state.ts` applies like `withRowEdit` (the table shows detail All, expanded). It clears when the selection leaves the table. Nothing is written.
  - Then it opens `ui.problemPopover = { key }`. `editor/problems/problem-fix-popover.tsx` is anchored to the row (or the table header, or the edge midpoint), shows the severity icon, title, detail and the fix buttons (primary first), and closes on Esc, outside click or when the problem disappears.
  - 048's row limit (merged, #102) hides rows past 12 unless the table is expanded. The reveal projects the table like 048's `withRowEdit` (`editor/views/view-state.ts`): `detail: 'all'` and `expanded: true` in the projected deck only, so a cut row shows.
- **Rationale:** FR-011; 043 and 042 already provide row focus and the All override pattern.

## R8. Problems list: filter, icons, fixes, badge

- **Decision:**
  - `problems-panel.tsx`: an All / Errors / Warnings `SegmentedControl` with counts (frame 167), UI-only `ui.problemFilter` (reset per deck); each row's icon is its severity icon; a row lists its fix buttons ("Add id uuid PK →") and runs `applyFix`. Row cap (`PROBLEM_ROW_CAP`) and keys unchanged.
  - Rail badge (`shell/rail.tsx`): clay when `errors > 0`, amber otherwise; count unchanged.
- **Rationale:** FR-002, FR-003; frames 144, 167.

## R9. Export: errors block, warnings show

- **Decision:** `schema-problems.ts` returns `{ errors, warnings }` for the scope (resolves 052's `TODO(047)`). The banner shows "n errors · n warnings in <scope>", errors listed first; `sqlBlocked` uses `errors.length > 0` only. Tests in `export-dialog.test.tsx` and `schema-export-panel` follow.
- **Rationale:** FR-016 and 052 clarify Q4.

## R10. Performance

- **Decision:** add a lint case to `packages/model/test/perf.test.ts` on the 150-table `largeSchemaDeck` (helpers :341) with relationships and enums: `checkDeck` within the existing `CHECK_DECK_BUDGET_MS` (30 ms × slack). The worker throttle (150 ms) is unchanged, so a problem shows well within SC-002's 1 s.
- **Rationale:** every rule is linear except the loop check, which is linear in the graph; indexes are built once per run.

## R11. Not built

- Ignoring problems or turning rules off (clarify Q3).
- Frame 167's per-value colours and enum card (as 052 R12).
- Naming-style and missing-index rules (spec out of scope).
