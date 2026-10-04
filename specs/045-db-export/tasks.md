# Tasks: Schema Export

**Input**: design documents in `specs/045-db-export/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: Generic decks translate a common type list to the picked dialect and note every unmapped type; golden files for all formats plus Postgres and SQLite scripts executed in tests on in-process engines, MySQL by golden file; a foreign key to a table outside the scope is left out, the column kept, and it is noted).
- [research.md](research.md) (R1–R18), [data-model.md](data-model.md) (SchemaSlice, ExportNote kinds, request / result, dialog state, file names).
- [contracts/schema-writers.md](contracts/schema-writers.md) (writer API, statement order, golden examples) and [contracts/export-dialog-ui.md](contracts/export-dialog-ui.md) (roles, names, texts).
- [quickstart.md](quickstart.md). Design frame: 145 (export dialog, light / dark) in `docs/design/screens/`; §g-88 (DBML subtitle names no tool), §g-91 (dialog from 145, not 166).

**Depends on 040 only** (merged). 041 is merged (table nodes exist). 043, 044 and 047 are **not** built: 045 must not import from them; the problems banner reads today's `db-*` problem kinds and picks up 047's later.

**Tests are required.** Constitution VI: unit tests for every pure module (slice, scope, identifiers, type map, each writer) with golden files; execution tests for Postgres and SQLite; reducer and component tests (Testing Library, by role and name from contracts/export-dialog-ui.md). Write each test first and watch it fail. No new Playwright tests; the smoke suite (incl. no-third-party-requests) must pass.

**Scope guards**:

- **Writers are pure** (FR-021): `apps/app/src/db/export/*` imports no React, no DOM, no Yjs, no `editor/`; input is the `SododeckFile` snapshot and a request.
- **One slice**: scope, reference resolution, FK placement, junction tables and notes live in `schema-slice.ts`; writers never re-resolve ids.
- **Never throw, never drop silently**: every skip or change is an `ExportNote` (data-model §3).
- **Deterministic**: no `Date`, no random, no `Map` iteration over unsorted input in output paths.
- **No deck writes** from the dialog (FR-006); no network (FR-005).
- **JSON / PNG / SVG behaviour unchanged.**
- Tokens only; lucide icons; English copy exactly as in contracts/export-dialog-ui.md.
- Do not name other diagram or database tools anywhere (code, comments, copy, ADR, golden files).

**Approvals**: one **dev** dependency, `@electric-sql/pglite` (founder approved 2026-10-04, spec Clarifications). No runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to code (`*.test.ts(x)`); read `apps/app/CLAUDE.md` first.
- **Commits**: `feat(app): …`, `test(app): …`, `docs: …`, `chore(app): …`. No AI attribution lines.

---

## Phase 1: Setup

**Purpose**: dependency, folders, fixtures.

- [x] T001 Add `@electric-sql/pglite` as a devDependency of `apps/app/package.json` (`pnpm --filter @sododeck/app add -D @electric-sql/pglite`), record its reason in the PR body (plan Constitution Check VIII), and confirm `pnpm build` output size is unchanged.
- [x] T002 Create `apps/app/src/db/export/` and `apps/app/src/db/fixtures/` with a short header comment in each new file stating the boundary (pure, snapshot in, text out); add a "db/" bullet to `apps/app/CLAUDE.md` describing the boundary (no React / Yjs / `editor/` imports).
- [x] T003 Create the "Shop" fixture deck in `apps/app/src/db/fixtures/shop.ts` (exported `shopDeck(dialect)` returning a schema-valid `SododeckFile`). Column types are stored as **Generic common types** (`uuid`, `varchar(255)`, `int`, `decimal(10,2)`, `timestamp`, `boolean`, `text`, `json`) and, for a real dialect, replaced by that dialect's native form through `translateType` (T009) when the fixture is built, so every dialect's deck holds types its engine accepts (`char(36)` on MySQL, `text` on SQLite). Contents: an "Orders DB" database card holding `customers`, `addresses`, `orders`, `order_items`, `products`, `categories`, `payments`, `shipments`, `shipment_items`, `reviews`, `audit_log`; enum `order_status` (pending, paid, shipped, cancelled); composite PK `order_items (order_id, product_id)` and composite FK from `shipment_items`; self-reference `categories.parent_id`; two FKs `orders.shipping_address_id` / `billing_address_id` → `addresses.id`; n–n `products` ↔ `categories`; on delete cascade on `orders.customer_id`; defaults (value and `now()`), a unique column, an expression index, a table check, notes; one "Users DB" card with `users`, `sessions`; plus one non-table architecture card. Validate it with `@sododeck/model` in `apps/app/src/db/fixtures/shop.test.ts`.
- [x] T004 [P] Create the edge-case fixture in `apps/app/src/db/fixtures/export-edge-cases.ts` (with its validity test in `export-edge-cases.test.ts`) hitting every `ExportNote` kind in data-model §3: stale index part, stale `enumRef`, length-mismatched composite relationship, relationship with no columns, relationship with no cardinality, mutual FK cycle (`a` ↔ `b`), reserved / mixed-case / spaced names (`order`, `UserId`, `order items`), tables in schema `billing` and `public`, two `invoices` in different schemas (kept in a separate `nameClashDeck` export so execution tests can leave it out), empty column type, unnamed table, empty enum, `increment` on a non-key text column, index with method `gin`, a Generic-only `money` type, a varchar without size, junction-name clash (`products_categories` already a table), self n–n (`tags` ↔ `tags`, `self-junction` note). Export a `expectedNotes` list per format / dialect for SC-006.

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: shared types, identifiers, type map, scope and the schema slice. Writers and the dialog build on these.

- [x] T005 [P] Define the export types in `apps/app/src/db/export/types.ts`: `SchemaSlice`, `SliceTable`, `SliceColumn`, `SliceType`, `DefaultValue`, `SliceForeignKey`, `SliceRelationship`, `SliceEnum`, `SchemaExportRequest`, `SchemaExportResult`, `SqlDialect` (`'postgres' | 'mysql' | 'sqlite'`), `SqlOptions` (defaults `enumsAndIndexes: true, junctionTables: true, ifNotExists: false`), `WriterOutput` — exactly as data-model §1–§2.
- [x] T006 [P] Implement `ExportNote`, `ExportNoteKind` (the 20 kinds of data-model §3, in that order) and message builders in `apps/app/src/db/export/notes.ts`, plus `mergeNotes` (dedupe identical, sort by table order then kind order); tests in `notes.test.ts`.
- [x] T007 [P] Add the reserved word list (union of commonly reserved words of Postgres, MySQL and SQLite, ≈150, lower case, sorted) in `apps/app/src/db/export/reserved-words.ts`; test that `order`, `user`, `group`, `select`, `table`, `key`, `index`, `check`, `default`, `references` are in it and the list is sorted and unique.
- [x] T008 [P] Implement identifiers in `apps/app/src/db/export/identifiers.ts` (research R10): `sqlIdent(name, dialect)` (plain `^[a-z_][a-z0-9_]*$` and not reserved → bare; else `"…"` with `"` doubled for postgres / sqlite, `` `…` `` with `` ` `` doubled for mysql), `qualified(schema, name, dialect)`, `dbmlIdent(name)`, `mermaidName(name) → { safe, changed }`, `mermaidType(type) → { safe, changed }`, `sqlString(text)` (`'` doubled), `dbmlString(text)` (`'` → `\'`, multi-line `'''…'''`); tests in `identifiers.test.ts` covering each rule and every edge-case name from T004.
- [x] T009 [P] Implement the Generic common type map in `apps/app/src/db/export/common-types.ts` (research R3 table, data-model §4): `translateType(stored, size, dialect) → { written, mapped }` normalising case and inner whitespace, keeping size only where `keepsSize` allows, MySQL varchar without size → `varchar(255)` flag; tests in `common-types.test.ts` for every canonical type, every alias and each dialect, plus `money` unmapped.
- [x] T010 Implement scope in `apps/app/src/db/export/scope.ts` (data-model §5): `availableSchemaScopes(deck, { selection, drill })` → `{ selection: Id[], database: { cardId, title } | null, deckHasTables }`, `tablesInScope(deck, scope)`, `defaultSchemaScope(scopes)`; tables of a card = `db-table` nodes with `parent === cardId`; drilled card = top drill frame of kind `node` whose node type is `database`, else a single selected `database` node; tests in `scope.test.ts` (selection with mixed cards, no tables selected, drilled vs selected card, card with no tables, deck without tables).
- [x] T011 Implement `buildSchemaSlice(deck, request)` in `apps/app/src/db/export/schema-slice.ts` (data-model §1, research R4–R6): resolve tables in scope (names, `schema` null for absent / `public`, columns in stored order, PK, indexes with stale parts dropped, checks), enums used in scope, relationships with both ends in scope, FK mapping per cardinality (R5 table), relationships with an out-of-scope end → `fk-out-of-scope` note (column kept), `no-columns`, `length-mismatch`, `stale-reference`, `empty-type`, `unnamed-table` notes; `tables` in stable order (schema, name, id) and `sqlOrder` in dependency order (Kahn; ties schema, name, id; self-references ignored), plus `deferredFks` for cycle members; type translation through T009 only when request is SQL on a Generic deck. Tests in `schema-slice.test.ts`: stable `tables` order and dependency `sqlOrder` of the Shop tables, cycle → deferred FKs, each note kind it owns, out-of-scope FK with Selection and database scopes (US2 scenario 6), unused enum excluded (US2 scenario 7), determinism (two builds deep-equal).
- [x] T012 Implement the entry `schemaExport(deck, request)` and `schemaFileName(...)` in `apps/app/src/db/export/schema-export.ts` (contracts/schema-writers.md, data-model §7): build slice, dispatch to the writer for `request.format` (writers not built yet return empty text with no notes, so the never-throw guarantee holds on every commit), merge notes, `tableCount`, empty scope → `text ''`; file names `<deck>[-<scope>][-dictionary].<sql|dbml|mmd|md>` reusing the `slug` of `apps/app/src/editor/export/export-file-name.ts` (export it from there); tests in `schema-export.test.ts` for the empty scope and the file names.

**Checkpoint**: slice and helpers green; writers can be built in parallel.

---

## Phase 3: User Story 1 — Export runnable SQL in the deck's dialect (P1) 🎯 MVP

**Goal**: SQL in the Schema section, in the deck dialect (or a picked one on Generic), with options, preview, Copy and Download; the script runs.

**Independent test**: export Shop as Postgres and SQLite and execute both in tests; MySQL matches its golden file; in the dialog, pick SQL, see the script, Copy and Download a `.sql`.

### Tests first

- [x] T013 [P] [US1] Golden tests in `apps/app/src/db/export/sql-writer.test.ts` for Shop × {postgres, mysql, sqlite} (whole deck, default options) and edge-cases × the three dialects, against `apps/app/src/db/export/__golden__/sql/<fixture>.<dialect>.sql` (write the goldens by hand from contracts/schema-writers.md, then review them line by line); targeted cases for US1 scenarios 2–8: FK after referenced table, cycle via `ALTER TABLE` (postgres / mysql) and inline for sqlite, composite PK / FK order, enum per dialect, value vs expression default (MySQL / SQLite parentheses), `billing` schema per dialect, reserved / mixed-case quoting; each option toggled; junction table naming, `_2` suffix and option off.
- [x] T014 [P] [US1] Execution tests in `apps/app/src/db/export/sql-writer.engine.test.ts` (`// @vitest-environment node`): run the Postgres export of Shop on PGlite and assert via `information_schema` / `pg_catalog` every table, column type, NOT NULL, PK (incl. composite), FK with ON DELETE, UNIQUE, index (incl. expression) and enum exists; run the SQLite export with `node:sqlite` (`DatabaseSync`, `PRAGMA foreign_keys = ON`) and assert via `sqlite_schema` and `pragma_table_info` / `pragma_foreign_key_list` / `pragma_index_list`; also run the Postgres and SQLite exports of the edge-case deck (Generic → each dialect, **without** `nameClashDeck`, whose duplicate tables cannot run on SQLite by design and are covered by golden files and the `name-clash` note only) and assert they execute without error. If Vitest cannot resolve `node:sqlite`, load it with `createRequire(import.meta.url)` (research R16).

### Implementation

- [x] T015 [US1] Implement `writeSql(slice, dialect, options)` in `apps/app/src/db/export/sql-writer.ts` following contracts/schema-writers.md statement order and research R4 (FK placement per dialect: postgres inline single / table-level composite, mysql always table-level, sqlite always inline), R6 (junction tables), R7 (enums), R8 (increment), R9 (defaults), R10 (quoting), R11 (schemas / databases), R12 (indexes, generated names, methods, IF NOT EXISTS), R13 (comments); notes `default-size`, `schema-dropped`, `name-clash`, `junction-skipped`, `junction-renamed`, `no-key`, `increment-dropped`, `method-dropped`, `enum-not-created`, `empty-enum`, `unmapped-type`; each note also as a `-- ` comment at its place; header comment with deck, scope, dialect. Keep per-dialect differences in small helper functions in the same file (split into `sql-dialects.ts` only if the file passes ~400 lines). Make T013 and T014 pass.
- [x] T016 [US1] Extend export types in `apps/app/src/editor/export/types.ts` (`ExportFormat` + `'sql' | 'dbml' | 'mermaid-er' | 'dictionary'`, `SchemaScope`) and split `apps/app/src/editor/export/formats.ts` into `SCHEMA_FORMATS` (SQL only for now; icon `Database`; subtitle built from the dialect) and `IMAGE_AND_DATA_FORMATS` (JSON, PNG, SVG unchanged).
- [x] T017 [US1] Extend the reducer in `apps/app/src/editor/export/export-dialog-state.ts` (data-model §6): `schemaScope`, `sqlDialect`, `options.sql`, actions `schemaScope`, `sqlDialect`, `option.sql`; `ExportResult.notes`; tests in `export-dialog-state.test.ts` (initial values, option merges touch only `sql`, dialect pick kept across format switches).
- [x] T018 [US1] Add the schema branch to `apps/app/src/editor/export/use-export-result.ts`: `exportRequestKey` includes schema scope ids, dialect and `options.sql` for schema formats; `generate()` calls `schemaExport` (Generic SQL without a picked dialect settles to a new `needs-dialect` status instead of generating); size via `formatBytes`; tests in `use-export-result.test.ts` (key changes with scope / dialect / options, Generic without dialect does not generate, JSON / PNG / SVG keys unchanged).
- [x] T019 [US1] Build `apps/app/src/editor/export/schema-export-panel.tsx` (right column for schema formats) and wire it into `apps/app/src/editor/export/export-dialog.tsx` per contracts/export-dialog-ui.md: format list in two labelled groups ("Schema" only when the deck has a table; "Image and data"), dialect chip "Postgres · deck dialect" or the "Dialect" select on Generic with "Choose a dialect to write SQL", line-numbered preview (first 400 lines + "… n more lines", numbers `aria-hidden`), SQL option switches with the helper text, Copy / Download as `text/plain` with the `.sql` file name; whole-deck scope only in this story. Component tests in `apps/app/src/editor/export/export-dialog.test.tsx`: Schema group hidden without tables; SQL preview shows the header line; Generic asks for a dialect and disables Copy / Download until chosen; toggling "IF NOT EXISTS" changes the preview; Download file name and content equal the preview text; opening the dialog, previewing each schema format, Copy and Download leave the deck untouched (no Yjs update on the document, undo stack unchanged; FR-006); JSON / PNG / SVG tests still pass.

**Checkpoint**: US1 demonstrable — screenshot the dialog with SQL (light and dark) for the PR.

---

## Phase 4: User Story 2 — Choose what to export (P1)

**Goal**: Selection / database card / Whole deck scopes for schema formats.

**Independent test**: with two database cards and a selection, switch scopes and check which tables each output holds.

- [x] T020 [P] [US2] Add scope cases to `apps/app/src/db/export/schema-export.test.ts`: selection of three tables writes only those; selection with a non-table card ignores it without a note; database scope writes only the card's tables; whole deck writes both cards' tables; FK to an unselected table → no constraint, column kept, `-- ` comment and one `fk-out-of-scope` note; file names `shop-selection.sql`, `shop-orders-db.sql`, `shop.sql`.
- [x] T021 [US2] Add the schema scope control to `apps/app/src/editor/export/schema-export-panel.tsx`: segmented control "Scope" with Selection (disabled with reason "Select one or more tables" via the dialog's `DisabledReason`), the database card title (rendered only when `availableSchemaScopes` returns a card), Whole deck; initial value from `defaultSchemaScope` computed from the UI store's selection and drill when the dialog opens (reducer init in `export-dialog-state.ts` gains a `schemaScope` argument); image formats keep their own scope control.
- [x] T022 [US2] Component tests in `apps/app/src/editor/export/export-dialog.test.tsx`: with tables selected the scope opens on Selection; drilled into Orders DB it opens on "Orders DB"; nothing selected opens on Whole deck with Selection disabled and its reason as description; changing scope changes the preview and the footer file name; the image scope control is unaffected.

**Checkpoint**: US1 + US2 = the MVP (runnable SQL for the part of the deck you want).

---

## Phase 5: User Story 3 — Export DBML (P2)

**Goal**: DBML with every table, setting, index, check, enum and relationship (optional sides with `?`).

**Independent test**: DBML of Shop equals its golden file.

- [x] T023 [P] [US3] Golden tests in `apps/app/src/db/export/dbml-writer.test.ts` for Shop and the edge-case deck against `apps/app/src/db/export/__golden__/dbml/<fixture>.dbml`, plus targeted cases: composite ref `a.(x, y) > b.(x, y)`, n–n `<>`, `?` markers per side, referential actions, composite PK as `indexes { (a, b) [pk] }`, expression index in backticks, checks block (table and column checks), `Project` block only on a real dialect, notes escaped (quote, multi-line), schema-qualified names, type with spaces quoted, `length-mismatch` / `no-columns` / `fk-out-of-scope` as `// ` comments.
- [x] T024 [US3] Implement `writeDbml(slice)` in `apps/app/src/db/export/dbml-writer.ts` per research R14 and contracts/schema-writers.md; register it in `schema-export.ts`.
- [x] T025 [US3] Add DBML to `SCHEMA_FORMATS` in `apps/app/src/editor/export/formats.ts` (icon `Braces`, subtitle "Database markup", §g-88) and a component test in `export-dialog.test.tsx`: choosing DBML shows `Table` blocks, hides the dialect chip and SQL options, downloads `.dbml`.

---

## Phase 6: User Story 4 — Export a data dictionary (P2)

**Goal**: Markdown dictionary with tables, enums and relationships.

**Independent test**: dictionary of Shop equals its golden file and renders as Markdown.

- [x] T026 [P] [US4] Golden tests in `apps/app/src/db/export/dictionary-writer.test.ts` for Shop and edge cases against `apps/app/src/db/export/__golden__/dictionary/<fixture>.md`, plus targeted cases: title with deck, scope and dialect (dialect omitted on Generic), stable table order, column table columns and key texts (`PK`, `FK → customers.id`, `UQ`), indexes and checks lines, Enums section, Relationships section wording ("many to one · on delete cascade"), "References outside this export", `|` escaped and line breaks as `<br>`.
- [x] T027 [US4] Implement `writeDictionary(slice)` in `apps/app/src/db/export/dictionary-writer.ts` per research R15; register it in `schema-export.ts`.
- [x] T028 [US4] Add Data dictionary to `SCHEMA_FORMATS` (icon `FileText`, subtitle "Markdown, one section per table") and a component test: choosing it downloads `<deck>-dictionary.md` (or `<deck>-<scope>-dictionary.md`).

---

## Phase 7: User Story 5 — Export a Mermaid ER diagram (P3)

**Goal**: `erDiagram` text with entities, key markers and relationships.

**Independent test**: Mermaid ER of Shop equals its golden file and obeys the syntax rules.

- [x] T029 [P] [US5] Golden tests in `apps/app/src/db/export/mermaid-writer.test.ts` for Shop and edge cases against `apps/app/src/db/export/__golden__/mermaid/<fixture>.mmd`, plus: every cardinality × optional combination maps to the right symbol pair (contracts/schema-writers.md table), label = relationship label or column list, PK / FK / UK markers, unsafe names → alias `x["original"]` and `name-changed` note, `decimal(10,2)` → `decimal(10-2)` with the original in the comment, no-cardinality → `}o--||` and `no-cardinality` note, plain table-to-table connectors written, out-of-scope relationships left out; a syntax-rule check that every entity, attribute name and type token matches research R10's character rules.
- [x] T030 [US5] Implement `writeMermaidEr(slice)` in `apps/app/src/db/export/mermaid-writer.ts`; register it in `schema-export.ts`.
- [x] T031 [US5] Add Mermaid ER to `SCHEMA_FORMATS` (icon `Network`, subtitle "erDiagram for docs") and a component test: downloads `.mmd`, no SQL options.

---

## Phase 8: User Story 6 — See problems and notes before exporting (P3)

**Goal**: export notes strip and the problems banner.

**Independent test**: the edge-case deck shows its notes; a deck with a stale reference shows the banner and "Show problems" opens the Problems flyout.

- [x] T032 [P] [US6] Implement `schemaProblems(problems, tableIds)` in `apps/app/src/editor/export/schema-problems.ts` (research R17): keep problems whose kind starts with `db-` and whose target (`node`, `nodes`, `edges` resolved to their tables, or `object`) touches a table in scope; tests in `schema-problems.test.ts` (in scope, out of scope, non-db kinds ignored, `null` problems → none).
- [x] T033 [P] [US6] Golden-independent note test in `apps/app/src/db/export/schema-export.test.ts`: for each format and dialect, the edge-case deck yields exactly its `expectedNotes` (SC-006: zero silent drops).
- [x] T034 [US6] Add the export notes strip (role `status`, "n export notes", first three, "Show all" toggle) and the problems banner (role `alert`, Clay soft tokens, `CircleX`, "n errors in <scope>", two details joined by " · ", "Show problems" → `closeExport()` then `openFlyout('problems')`) to `apps/app/src/editor/export/schema-export-panel.tsx` per contracts/export-dialog-ui.md; component tests in `export-dialog.test.tsx`: notes shown / hidden, Show all, banner shown for a stale `enumRef`, hidden with no problems or outside a `ProblemsProvider`, Show problems closes the dialog and opens the flyout; banner never disables Download.

---

## Phase 9: Polish & cross-cutting

- [x] T035 [P] Perf test `apps/app/src/db/export/schema-export.perf.test.ts`: build a 150-table / 1,800-column / 250-relationship deck (reuse `apps/app/src/bench/generate-deck.ts` `tables` option from 041) and assert each format × dialect finishes in < 50 ms (median of 5) (FR-022, SC-004, research R2); if it fails, move `schemaExport` behind a worker client in `use-export-result.ts` before continuing.
- [x] T036 [P] Write ADR `docs/decisions/0031-schema-export.md`: writers in `apps/app/src/db/export` over one slice; main thread with perf budget; Generic common type map; FK placement per dialect (MySQL ignores column-level REFERENCES); junction tables; notes instead of silent drops; test engines (PGlite dev dependency, `node:sqlite`); DBML optional markers and the parser version 044 must pin. No other tool named.
- [x] T037 [P] Update `docs/backlog-database.md` §045 with a Status line (built, spec path, ADR 0031) and §044 with "pin a DBML parser that reads `?` markers and `checks`; add the DBML round-trip test using 045's writer"; update `DESIGN.md` `export-dialog` component line to mention the Schema group (format list now "Schema: SQL, DBML, Mermaid ER, Data dictionary · Image and data: JSON, PNG, SVG").
- [x] T038 Accessibility pass on the dialog: keyboard path (format arrows → scope → dialect → options → banner action → footer), names and descriptions per contracts/export-dialog-ui.md, notes and banner readable without colour; fix anything found in `schema-export-panel.tsx`.
- [x] T039 Run quickstart.md manual steps 1–9 (step 7, the MySQL 8 run of the Shop export, is **required** for SC-001) (light and dark, compare with frame 145), save screenshots for the PR, and note any deviation in `specs/045-db-export/quickstart-results.md`.
- [x] T040 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all green; no `.only` / skipped tests; app bundle size of the main chunk unchanged (export dialog chunk growth reported in the PR); final report lists what changed, what was skipped (MySQL execution, DBML round-trip → 044) and what is uncertain.

---

## Dependencies & execution order

- **Setup (T001–T004)** → **Foundational (T005–T012)** → stories.
- T003 needs `translateType` (T009) for its real-dialect variants: write its Generic deck first, add the dialect variants once T009 is done (T003 is the only Setup task that waits on Foundational).
- Within Foundational: T005–T009 in parallel; T010 then T011 (slice uses scope and type map); T012 after T011.
- **US1 (T013–T019)** first: it adds the Schema section, reducer and result branch that every other story's format entry plugs into (T016–T019).
- **US2 (T020–T022)** after US1 (scope control lives in the panel US1 creates).
- **US3, US4, US5** writers (T023–T024, T026–T027, T029–T030) depend only on Foundational and can be built in parallel with US1; their format entries (T025, T028, T031) need T016–T019.
- **US6** T032–T033 parallel any time after Foundational; T034 after T019.
- **Polish** after the stories it covers; T035 can run as soon as T015 exists.

```text
T001─┬─T003─┐
     └─T004─┤
T002────────┼─T005..T009 ─ T010 ─ T011 ─ T012 ─┬─ US1 (T013..T019) ─ US2 (T020..T022)
            │                                  ├─ T023 T024 ─(after T019)─ T025   [US3]
            │                                  ├─ T026 T027 ─(after T019)─ T028   [US4]
            │                                  ├─ T029 T030 ─(after T019)─ T031   [US5]
            │                                  └─ T032 T033 ─(after T019)─ T034   [US6]
            └──────────────────────────────────────────────── Polish T035..T040
```

## Parallel examples

- **Foundational**: T005, T006, T007, T008, T009 together (separate files).
- **US1**: T013 and T014 (tests) together, then T015; T016 and T017 can start while T015 is in progress.
- **After Foundational**: one agent on US1, others on the DBML (T023–T024), dictionary (T026–T027) and Mermaid (T029–T030) writers; format entries merge after T019.
- **US6**: T032 and T033 together.

## Implementation strategy

1. **MVP = US1 + US2**: runnable SQL for the selection, a database card or the whole deck, verified on Postgres and SQLite engines. Stop and demo.
2. **Text formats**: US3 (DBML, needed by 044 / 046), then US4 (dictionary), then US5 (Mermaid).
3. **Trust**: US6 (notes strip, problems banner).
4. **Polish**: perf, ADR, docs, accessibility, quickstart, DoD.

Small conventional commits per task group, e.g. `feat(app): schema slice for export (045)`, `feat(app): SQL export writer (045)`, `test(app): run exported SQL on Postgres and SQLite (045)`, `feat(app): schema formats in the export dialog (045)`, `docs: ADR 0031 schema export`.
