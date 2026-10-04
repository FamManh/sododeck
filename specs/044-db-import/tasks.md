# Tasks: Schema Import

**Input**: design documents in `specs/044-db-import/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: a table name already in the deck adds a new table renamed `<name>_copy` (043's paste rule, founder decision) and is reported, matching by name stays with 046; on a dialect mismatch, common types are converted to the deck's dialect and every other type is kept and reported; foreign-key-by-name suggestions live only in the report and highlight their two column rows on hover / focus, no line drawn; one group per schema only when the import holds two or more schemas, ordinary groups the user can Ungroup).
- **Parser decision (founder, 2026-10-04, plan session, option D)**: `@dbml/parse` for DBML and `node-sql-parser` per-dialect builds for SQL, behind our own statement splitter, revising DB6 (research R1).
- [research.md](research.md) (R1–R16), [data-model.md](data-model.md) (source, target, preview, plan, report, suggestions), [contracts/import-pipeline.md](contracts/import-pipeline.md), [contracts/import-dialog-ui.md](contracts/import-dialog-ui.md), [quickstart.md](quickstart.md). Design frames 134, 138, 139 in `docs/design/screens/`; §g-86 (`packages/ui` controls), §g-91 (dialog from 138 / 139, not 166).

**Depends on** 040, 041, 042, 045 (merged). 043 and 047 are **not** built: 044 sets the deck dialect itself (`setDialect`) only for a deck without tables, converts only imported types, and must not import from 043 / 047. 043 is built in parallel: see [integration-043.md](integration-043.md) for what to fix after it merges.

**Tests are required.** Constitution VI: unit tests for every pure stage (splitter, detector, R3 rewrites, readers, plan, conversion, suggestions) against the fixture corpus and expected JSON; a DBML round-trip test with 045's writer; a perf test; an undo test for apply; component tests (Testing Library, by role and name from contracts/import-dialog-ui.md). Write each test first and watch it fail; the R13 bug fix starts with a failing test. No new Playwright tests; the smoke suite (incl. no-third-party-requests) must pass.

**Scope guards**:

- **Pure stages** (`apps/app/src/db/import/*` except `import-client.ts`, `place-import.ts`, `apply-import.ts`) import no React, no DOM, no Yjs, no `editor/`; input is text + `ImportTarget`, output is plain data.
- **Parsers only in the worker**: `@dbml/parse` and `node-sql-parser` are reached only through dynamic `import()` from `import.worker.ts` (and the inline client), never from a module the editor imports statically.
- **Never drop silently**: every statement or clause is mapped or becomes a report entry (FR-017, SC-005).
- **Nothing written before Import**: preview never touches the deck; apply is one `editor.batch` (one undo step).
- **Model untouched**: no change in `packages/model` or `packages/schema`; use `pasteFragment`, `addEnum`, `setDialect`, `update`, `add`.
- **Deterministic plans**: same input → deep-equal plan (ids from a seeded local allocator in tests).
- Tokens only; lucide icons; English copy exactly as in contracts/import-dialog-ui.md.
- Do not name other diagram or database tools anywhere (code, comments, copy, ADR, fixtures).

**Approvals**: two **runtime** dependencies, `@dbml/parse` 10.2.0 and `node-sql-parser` 5.4.0, exact versions (founder approved 2026-10-04, option D; ADR 0033).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to code (`*.test.ts(x)`); read `apps/app/CLAUDE.md` first.
- **Commits**: `feat(app): …`, `test(app): …`, `fix(app): …`, `docs: …`, `chore(app): …`. No AI attribution lines.

---

## Phase 1: Setup

**Purpose**: dependencies, ADR, folders, fixture corpus.

- [x] T001 Add `@dbml/parse@10.2.0` and `node-sql-parser@5.4.0` as exact runtime dependencies of `apps/app/package.json` (`pnpm --filter @sododeck/app add -E …`); run `pnpm build` and record the entry-chunk size before and after (must be unchanged until T020 wires the worker) in `specs/044-db-import/quickstart-results.md`.
- [x] T002 [P] Write `docs/decisions/0033-schema-import-parsers.md` (context: DB6 and the 2.68 MB gzip / 15.8 MB bundle, precache limit, missing SQLite; decision: research R1–R3; consequences: our splitter, R3 rewrites with corpus tests, per-dialect lazy chunks; sizes 108 / 72 / 67 / 54 KB gzip; no tool named) and add "→ revised by ADR 0033 (044)" to row DB6 in `docs/backlog-database.md`.
- [x] T003 [P] Create `apps/app/src/db/import/` with a boundary header comment in each new file, and add a `db/import` bullet to `apps/app/CLAUDE.md` (pure stages, parsers only in the worker, apply through `@sododeck/model` ops).
- [x] T004 [P] Create the corpus in `apps/app/src/db/fixtures/import/` (research R12): `pg-30-tables.sql` (30 tables in `public`, composite PK and FK, inline / table / `ALTER TABLE ONLY … ADD CONSTRAINT` FKs with actions, two `CREATE TYPE … AS ENUM` used by columns with `DEFAULT 'x'::type`, `GENERATED ALWAYS AS IDENTITY`, `bigserial`, `COMMENT ON TABLE / COLUMN`, a unique index on an expression, a `CREATE VIEW` on a known line, a `$$` function, a trigger, `GRANT`s, a `COPY … FROM stdin` block, `SET` / `SELECT pg_catalog.set_config` preamble, `OWNER TO`), `pg-schemas.sql` (tables in `public` and `billing`, cross-schema FK), `mysql-dump.sql` (backticks, `ENGINE=… COMMENT='…'`, `AUTO_INCREMENT`, `UNSIGNED`, inline `ENUM` twice with the same values, `KEY` / `UNIQUE KEY`, column `COMMENT`, `/*!40101 … */`, `DELIMITER ;;` procedure, `LOCK TABLES` / `INSERT`), `sqlite.sql` (`PRAGMA`, `BEGIN TRANSACTION`, `AUTOINCREMENT`, untyped column, `WITHOUT ROWID`, inline `REFERENCES`, `CREATE INDEX IF NOT EXISTS`, `COMMIT`), `no-fk.sql` (MySQL, no constraints: `customer_id`, `order_id`, `category_id` → `categories`, `companyId` → `company`, a `text` `user_id` vs an `int` key that must not match, a `status_id` with no target), `edge-cases.sql` (Postgres: quoted mixed-case and spaced names, mutual FK cycle, self-reference, two FKs between one pair, duplicate table name, FK to a missing table, `ALTER TABLE … ADD COLUMN`, `ALTER TABLE … DROP COLUMN`, `ALTER TABLE … RENAME`, collation, generated column), `syntax-error.sql` (error on line 12), `shop.dbml` and `extras.dbml` (`TableGroup` with color and note, `headercolor`, sticky `Note`, `Project` with `database_type` and note, all ref forms incl. `<>` and `?`, enum value notes, `checks` block, composite `pk` index).
- [x] T005 [P] Create the 300-table generator in `apps/app/src/db/fixtures/import/large.ts` (`largeSql(tables = 300, columns = 12)`, `largeDbml(…)`) with FKs to earlier tables, used by the perf test.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: types, splitter, detector, readers' neutral shape, plan core, worker client, apply core, UI-store slots.

- [x] T006 [P] Define the import types in `apps/app/src/db/import/types.ts` exactly as data-model.md: `ImportSource`, `ImportTarget`, `ImportPreview`, `ParseError`, `ImportPlan`, `ImportReport`, `SkipReason`, `ChangeKind`, `FkSuggestion`, `TypeConversion`, plus `RawSchema` (`RawTable`, `RawColumn`, `RawIndex`, `RawCheck`, `RawRef`, `RawEnum`, `RawGroup`, `RawNote`, each with `line`) and `Statement` (`text`, `line`, `endLine`, `kind`).
- [x] T007 [P] Implement report texts in `apps/app/src/db/import/report-text.ts`: one reason string per `SkipReason` ("views are not modelled", "functions are not modelled", "data rows are not imported", "session setting", …) and one detail builder per `ChangeKind`; `excerpt(text)` (first line, ≤ 60 chars, ellipsis); `collapseSkipped(entries)` (> 20 of one reason → first 20 + "and n more …"); tests in `report-text.test.ts`.
- [x] T008 Implement `splitSql(text)` in `apps/app/src/db/import/split-sql.ts` (research R2): quote / `$tag$` / comment / `DELIMITER` / `COPY … \.` aware; classifies `kind`; tests in `split-sql.test.ts`: every corpus file splits so that the concatenation of statement texts covers every non-comment character exactly once, `line` of the `CREATE VIEW` in `pg-30-tables.sql` is its real line, `;` inside strings / `$$` / comments does not split, `DELIMITER ;;` procedure is one statement, `COPY` data is one `data` statement.
- [x] T009 [P] Implement `detectFormat` and `detectDialect` in `apps/app/src/db/import/detect.ts` (research R4); tests in `detect.test.ts`: each corpus file detects its dialect, `.dbml` / DBML text detects DBML, plain ANSI `CREATE TABLE t (id int)` → `null`.
- [x] T010 Implement `prepareStatement(st, dialect, knownTypes)` in `apps/app/src/db/import/prepare-statement.ts` (research R3): user-type columns → `text` with a restore map by column index, `GENERATED ALWAYS` → `BY DEFAULT`, qualified casts stripped from defaults; tests in `prepare-statement.test.ts` with one case per R3 row (input, rewritten text, restore map).
- [x] T011 Implement `buildPlan(raw, source, target)` core in `apps/app/src/db/import/build-plan.ts`: name resolution (schema-qualified, quotes removed, case kept), plan ids from an injectable allocator (`dbcol`, `node`, `edge`, `group`, `enum` prefixes, never from names), tables → `db-table` nodes with columns in order, column flags only when true, `size` split (R9), defaults value / expression (FR-012), increment forms, composite PK order, indexes (column parts as ids, expressions as `{expr}`), checks, refs → edges with `fromColumns` / `toColumns` and lower-case `on-delete` forms, cardinality and optional (FR-013), enums with `enumRef`; FK to a missing table → `skipped: dangling-fk` (FR-016); duplicate name in import → `copyName` (`name_copy`, `name_copy_2`…, local helper in `names.ts` mirroring 043) + `renamed-duplicate`; name already in `target.tableNames` (same schema, case-insensitive) → `copyName` + `name-exists` (FR-015, Clarifications Q1 revised); dropped options → `option-dropped`; tests in `build-plan.test.ts` per rule (hand-built `RawSchema` inputs, deterministic ids).
- [x] T012 Implement the worker in `apps/app/src/db/import/import.worker.ts` (`preview`, `plan`; lazy `import()` of `@dbml/parse` or `node-sql-parser/build/{postgresql,mysql,sqlite}` by format / dialect, cached) and the clients in `apps/app/src/db/import/import-client.ts` (`createImportClient`, `createInlineImportClient`, `ImportCancelled`; `{id, request}` protocol as `apps/app/src/layout/layout-client.ts`; inline when `supportsWorkers()` is false); tests in `import-client.test.ts` with a fake worker (request / response pairing, cancel rejects pending, late results ignored).
- [x] T013 Implement `applyImport(editor, plan, positions, target)` in `apps/app/src/db/import/apply-import.ts` (research R6): one `editor.batch` — `setDialect` when `plan.setDialect`, `addEnum` per enum and rewrite `enumRef`s, `pasteFragment(fragment, {offset: {x: 0, y: 0}, viewId})` with positions already in the fragment, `update('nodes', id, {parent: cardId})` for a card target, `add('stickies', …)`; returns `AppliedImport` with the id map; tests in `apply-import.test.ts` on a model editor: objects written match the plan by name, one `undo()` restores `toJSON` equal to before (SC-009), enum refs resolve, card target sets `parent`, nothing written when validation fails before the batch.
- [x] T014 [P] Add UI-store state in `apps/app/src/state/ui-store.ts`: `importDialog {open, returnFocus}` with `openImport` / `closeImport` (shape of `exportDialog`), `importReports: Record<deckId, ImportReport>` with `setImportReport`, `updateSuggestion(deckId, index, state)`, cleared on deck close; add `'import-report'` to `FLYOUT_IDS` in `apps/app/src/editor/shell/shell-prefs.ts`; tests in the store's existing test file.

**Checkpoint**: text → `RawSchema` shape, plan core, worker and apply exist and are tested; no UI yet.

---

## Phase 3: User Story 1 - Turn a SQL dump into a diagram (P1) 🎯 MVP

**Goal**: drop or paste a Postgres / MySQL / SQLite dump, Import, get every table and FK laid out without overlaps, one undo step.

**Independent test**: import `pg-30-tables.sql` into an empty deck → counts match expected JSON, no overlapping rectangles, deck dialect Postgres, one undo restores the empty deck.

- [x] T015 [US1] Implement `readSql(statements, dialect)` in `apps/app/src/db/import/read-sql.ts`: per modelled statement, `prepareStatement` → parser `astify` → `RawSchema` parts (create table: columns, inline PK / unique / not null / default / check / references / comment / auto_increment, table constraints PK / unique / FK / check; create type enum; create index; alter table add constraint / add column; comment on), restoring user types; a throwing statement → `skipped: parse-error` with absolute line; unmodelled kinds → `skipped` with their reason; tests in `read-sql.test.ts` per construct listed in research R3 "parsed correctly" for each dialect.
- [x] T016 [US1] Add the corpus tests in `apps/app/src/db/import/import.corpus.test.ts`: for each SQL corpus file run split → detect → read → `buildPlan` with a seeded allocator and compare with `apps/app/src/db/fixtures/import/__expected__/<file>.json` (write the expected files by hand-checking the first run); `pg-30-tables.sql` has 30 tables and every FK as an edge with the right column ids (SC-001).
- [x] T017 [US1] Implement `placeImport(plan, layoutClient, existing)` in `apps/app/src/db/import/place-import.ts` (research R7): build a `LayoutRequest` for plan tables / groups / edges with `cardSize` from `apps/app/src/editor/canvas-geometry.ts`, run the existing layout client, translate the result to `(maxX + 160, minY)` of `existing` (or origin); tests in `place-import.test.ts` with `computeLayout` on real elkjs in Node: no two imported rectangles overlap, none overlaps an `existing` rect, existing rects unchanged (SC-001, FR-019).
- [x] T018 [US1] Build the dialog in `apps/app/src/editor/import/import-dialog.tsx` with `import-dialog-loader.ts` and `import-dialog-mount.tsx` (lazy, mounted in `apps/app/src/editor/shell/shell-chrome.tsx`), per contracts/import-dialog-ui.md: title, Paste | File, line-numbered textarea, drop zone / Choose file (≤ 5 MB, `.sql` / `.dbml` / `.txt`, else inline error), format / dialect select, preview line (live region), target radios (this deck / new deck; card in US4), FK checkbox (wired in US6), Cancel / "Import n tables" with Importing… state.
- [x] T019 [US1] Implement `use-import-preview.ts` in `apps/app/src/editor/import/`: 300 ms debounce, calls `client.preview(source, target)` built from the current deck (`deckDialect`, tables, enums), cancels on change / close, exposes `{state, preview, error}`; tests in `use-import-preview.test.ts` with a fake client.
- [x] T020 [US1] Wire Import: `client.plan` → `placeImport` → `applyImport` in the dialog's submit handler; close dialog, `showUndoToast(api, editor, "Imported n tables, n relationships, n enums")`, fit view on imported ids, store the report (`setImportReport`); FR-007 dialect set via the plan; then rebuild and record the entry-chunk delta (≤ 5 KB, SC-007) and the lazy chunk sizes in `quickstart-results.md`.
- [x] T021 [P] [US1] Add entry points: empty-canvas card action "Import SQL or DBML" in `apps/app/src/editor/empty-canvas-card.tsx` (Database pack on), Add flyout footer item in `apps/app/src/editor/palette.tsx` (Database pack on), deck ≡ menu item "Import SQL or DBML…" after "Import…" in `apps/app/src/editor/shell/deck-menu.tsx`; tests in the existing test files of each by role and name.
- [x] T022 [US1] Component tests in `apps/app/src/editor/import/import-dialog.test.tsx`: empty text → Import disabled with "Paste SQL or DBML, or drop a file"; pasted SQL → preview line counts; syntax error → "Line 12: …" and Import disabled; too-large file → inline error; Esc / Cancel closes and writes nothing (FR-006); Import → toast with Undo and the tables in the deck (fake client).

**Checkpoint**: US1 works end to end from all three entry points.

---

## Phase 4: User Story 2 - See what was skipped and why (P1)

**Goal**: every skipped or changed statement is visible with its line and reason.

**Independent test**: import a file with one of each unsupported statement; the report lists each with line and reason; the corpus "no silent drop" test passes.

- [x] T023 [US2] Add the "no silent drop" test in `apps/app/src/db/import/import.corpus.test.ts` (SC-005): for every corpus file, every statement from `splitSql` is either consumed by a mapped object or present in `report.skipped` / `report.changed`; and `pg-30-tables.sql` lists `CREATE VIEW` at its line (SC-002).
- [x] T024 [US2] Build the report flyout in `apps/app/src/editor/import/import-report-panel.tsx` (frame 139, `Flyout` container, registered in `apps/app/src/editor/shell/flyouts.tsx` with title "Import report"): Mapped chips, Skipped · n rows "L88 · CREATE VIEW order_totals · views are not modelled" (collapsed per T007), Changed · n rows; opens after import; "Report" action on the toast and "Last import report" in the ≡ menu reopen it while the deck is open.
- [x] T025 [US2] Component tests in `apps/app/src/editor/import/import-report-panel.test.tsx`: sections are headings with lists, counts and rows render from a report fixture, collapse text appears for 25 `INSERT`s, close and reopen from the menu keeps the report, report disappears after the deck closes.

**Checkpoint**: US1 + US2 = the minimum shippable import.

---

## Phase 5: User Story 3 - Import DBML (P1)

**Goal**: DBML (incl. 045's export) imports with refs, enums, groups, colours and stickies; round-trip holds.

**Independent test**: `shopDeck()` → 045 DBML → import → same schema by name → export again → byte-identical DBML.

- [x] T026 [US3] Write failing tests for the R13 writer bugs in `apps/app/src/db/export/dbml-writer.test.ts`: the edge-case deck's DBML parses with `@dbml/parse` (no "An Enum must have at least one element", no "Two endpoints are the same"); then fix `apps/app/src/db/export/dbml-writer.ts` (empty enum skipped with an export note; same-column n–n written as a comment with a note), add the note kinds in `apps/app/src/db/export/notes.ts`, and update `__golden__/dbml/edge-cases.dbml`.
- [x] T027 [US3] Implement `readDbml(text)` in `apps/app/src/db/import/read-dbml.ts` over `@dbml/parse` (`MemoryProjectLayout`, `Compiler`, `parse.errors`, `parse.rawDb`): tables, fields and settings, indexes (incl. `pk`), checks, refs (`relation` `1` / `*` / `0..1` / `0..*` → cardinality + optional), actions, enums with value notes, table groups (color), notes, `headerColor`, sticky notes, `project.databaseType` (→ dialect), each with `line` from `token`; first compile diagnostic → `ParseError`; tests in `read-dbml.test.ts` on `extras.dbml` and `shop.dbml`.
- [x] T028 [US3] Extend `buildPlan` in `apps/app/src/db/import/build-plan.ts` for DBML: written cardinality kept (FR-013 exception), `TableGroup` → group with style (R8), `headercolor` → node `style` hex `ColorRef`, sticky notes → `plan.stickies`, project note → deck description if empty else sticky, `database_type` → dialect; expected JSON for `extras.dbml` in the corpus test.
- [x] T029 [US3] Add `apps/app/src/db/import/dbml-round-trip.test.ts` (FR-029, SC-003, 045 SC-002): for `shopDeck('postgres')` and the edge-case deck, `schemaExport` DBML → `readDbml` → `buildPlan` → `applyImport` on an empty editor → compare tables, columns and settings, indexes, checks, enums and relationships by name with the source deck → export DBML again → equal text.
- [x] T030 [US3] Place DBML stickies under the imported cluster in `place-import.ts` and add them in `applyImport`; test in `place-import.test.ts` (sticky below the cluster's bottom edge, no overlap).

**Checkpoint**: all P1 stories done.

---

## Phase 6: User Story 4 - Choose where the tables go (P2)

**Goal**: import into the database card in context, or into a new deck.

**Independent test**: with a database card drilled into, imported tables have that card as parent; with "New deck" a new deck opens with the import and the current deck is unchanged.

- [x] T031 [US4] Add the card target in `apps/app/src/editor/import/import-dialog.tsx`: resolve the database card in context (drilled frame of a `database` node, else a single selected `database` node — reuse 045's `availableSchemaScopes` logic in `apps/app/src/db/export/scope.ts`), offer "Import into <card name>" first and default; `existing` rects for placement = the card's children (FR-019).
- [x] T032 [US4] Implement `importIntoNewDeck(ctx, plan, positions, name)` in `apps/app/src/db/import/apply-import.ts`: in-memory deck with the import's dialect, `applyImport`, `toJSON`, library `addDeck`, navigate to `/deck/<id>`; name = file name without extension or "Imported schema"; tests in `apply-import.test.ts` (new deck JSON valid, current deck untouched).
- [x] T033 [US4] Component tests in `import-dialog.test.tsx`: card target offered and default when drilled in / selected; "Import into this deck" otherwise; "New deck" calls the new-deck path and leaves the open deck's document unchanged.

---

## Phase 7: User Story 5 - Dialect mismatch (P2)

**Goal**: explicit notice and conversion when the file's dialect differs from the deck's.

**Independent test**: MySQL file into a Postgres deck → notice lists conversions; after import types are converted and reported; Generic deck with tables keeps types.

- [x] T034 [US5] Implement `importTypeMap(from, to)` and `convertType(type, size, from, to)` in `apps/app/src/db/import/convert-types.ts` from `COMMON_TYPES` in `apps/app/src/db/export/common-types.ts` (research R10; no change to `translateType`); tests in `convert-types.test.ts`: every common type across all six dialect pairs, aliases, size kept, unmapped kept.
- [x] T035 [US5] Apply dialect outcomes in `buildPlan` (`set` / `convert` / `keep-generic` / `same`, FR-007…FR-009) and expose `dialectOutcome` and `conversions` in the preview; report `type-converted` / `type-kept`; tests in `build-plan.test.ts` for each outcome, incl. "Auto · not detected" using the deck's dialect.
- [x] T036 [US5] Show the dialect notice in `import-dialog.tsx` per contract ("This deck is Postgres: n column types will be converted", first 3 conversions, "A new deck keeps MySQL."; Generic-with-tables text); component tests in `import-dialog.test.tsx`.

---

## Phase 8: User Story 6 - Detect foreign keys by name (P3)

**Goal**: suggestions for legacy schemas, reviewed in the report with row highlight.

**Independent test**: `no-fk.sql` → exactly the expected suggestions; Accept adds an edge (one undo step), Dismiss removes; hover highlights both rows; nothing written until accepted.

- [x] T037 [US6] Implement `suggestForeignKeys(plan)` in `apps/app/src/db/import/suggest-fks.ts` (research R11) and call it from the worker when `detectFk`; tests in `suggest-fks.test.ts` against `no-fk.sql` (expected list; no match for the `text` vs `int` case, the missing target, a column with an FK, a table's own PK) (SC-010).
- [x] T038 [US6] Remap suggestions through the `AppliedImport` id map and store them in the report; add the "Foreign keys by name · n" section to `import-report-panel.tsx`: Accept (`oneStep` → `add('edges', …)` with FR-013 cardinality / optional) and Dismiss icon buttons with names, "Added" state, Accept all / Dismiss all (one step each), pointer hover and keyboard focus → `setHoverFocus` for both column rows, leave → `clearHoverFocus`; wire the dialog's checkbox to `source.detectFk`.
- [x] T039 [US6] Component tests in `import-report-panel.test.tsx`: Accept writes one edge and Undo returns the row to open; Dismiss removes the row; Accept all writes all open ones in one step; focus on a row sets `hoverFocus` with both columns; with the option off there is no section; reloading the deck shows no suggestion edges (not stored).

---

## Phase 9: Polish & Cross-Cutting

- [x] T040 [P] Add `apps/app/src/db/import/import.perf.test.ts` (SC-006): `largeSql(300, 12)` and `largeDbml(300, 12)` through split → read → plan in Node under 3 s each; record timings in `quickstart-results.md`.
- [x] T041 [P] Accessibility pass on dialog and report (FR-030): Tab order, names, live region, focus return; fix findings; assert with Testing Library in the existing component tests.
- [x] T042 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; confirm the smoke suite's no-third-party-requests check passes and the parsers load as same-origin chunks (each < 5 MB, precached); record bundle numbers (R16) in `quickstart-results.md`.
- [x] T043 Run quickstart.md manual steps 1–7 on `pnpm dev`; save light and dark screenshots of the dialog, the report and an imported deck in `specs/044-db-import/screenshots/`; note results in `quickstart-results.md`.
- [x] T044 [P] Update docs: `apps/app/CLAUDE.md` (db/import boundary, worker, entry points), `docs/backlog-database.md` §044 status line ("built, `specs/044-db-import`, ADR 0033"), and the 045 round-trip status (SC-002 now covered).

---

## Dependencies & Execution Order

- **Setup (T001–T005)** → **Foundational (T006–T014)** → stories.
- **US1 (T015–T022)** first: it creates the dialog, placement and apply wiring all later stories use.
- **US2 (T023–T025)** after US1 (needs a report from a real import). **US3 (T026–T030)** after Foundational and T017 / T020 (placement and wiring); T026 can start right after Setup.
- **US4, US5, US6** each after US1; independent of each other except shared files (`import-dialog.tsx`, `build-plan.ts`, `import-report-panel.tsx`), so run them one after another or merge carefully. US6 needs US2's report panel.
- **Polish** last.

Within the foundational phase: T006 → T008, T010, T011; T009 needs T008; T012 needs T006; T013 needs T006.

## Parallel Examples

- Setup: T002, T003, T004, T005 together after T001.
- Foundational: T006, T007, T009 (after T008), T014 together; T012 and T013 in parallel once T006 is done.
- US1: T021 (entry points) alongside T015–T017.
- US3: T026 (writer fix) alongside T027 (reader).
- Polish: T040, T041, T044 together.

## Implementation Strategy

1. **MVP = US1 + US2**: a SQL dump becomes a laid-out diagram with a trustworthy report. Ship-ready on its own (demo with `pg-30-tables.sql`).
2. **+ US3**: DBML import and the 045 round-trip (closes 045 SC-002).
3. **+ US4, US5**: targets and dialect handling for decks that already have content.
4. **+ US6**: suggestions for legacy schemas.
5. Each step: small conventional commits, full DoD command set green, report what was skipped.

## Implementation notes (2026-10-04)

Deviations from the task text, all recorded in the PR:

- **T004**: the pg_dump preamble (`SET`, `set_config`, `OWNER TO`) lives in `pg-30-tables.sql`
  rather than a separate `pg-dump-header.sql`.
- **T010**: `prepareStatement(text, line, dialect)` replaces **every** column type by `text` (not
  only user types) and restores all of them, and strips every `::type` cast; bare column names
  are quoted so keyword names (`at`, `key`) parse. Simpler and sturdier than a per-type list.
- **T015**: an unreadable `CREATE TABLE` / `CREATE TYPE` blocks the import (a table would be
  lost, US2-5); an unreadable index, comment or `ALTER` is a skipped `parse-error` line.
- **T019**: the preview hook is covered through the dialog's component tests, not its own file.
- **T024**: the toast has one action (Undo; `packages/ui` toast takes one), so there is no
  "Report" button on it; the report opens by itself after import and from ≡ "Last import report".
- **T029**: Shop round-trips byte-identically. The edge-case export is lossy by design (it
  comments out what DBML cannot hold), so its test checks that the second export is stable.
  Byte-identical order needed 045's relationships in deck order instead of by random id.
- **T033**: the "New deck" path is tested in `apply-import.test.ts` (`importAsNewDeck`) and by
  hand; the component test checks the option is offered.
- **T038**: a suggestion's hover / focus lights the referencing column row only: 042's
  `hoverFocus` holds one column.
- After 043 merged: see `integration-043.md` § Status (model `copyName`, locked cards, ADR 0033).
