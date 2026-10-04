# Tasks: Database Schema Model

**Input**: design documents in `specs/040-db-schema-model/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the clarify answers (2026-10-04): type id `db-table` in pack `database`; no hiding of the pack; enums are a deck-level list, not cards; removing a column removes its relationships (composite: the matching pair); ids of columns, indexes, checks, enums and enum values unique across the deck. Planning corrections: no format revision (ADR 0020 deferred), duplicate ids refuse the file, column ends name columns only.
- [research.md](research.md) (R1–R16) and [data-model.md](data-model.md).
- [contracts/file-format.md](contracts/file-format.md) (v1.json additions, S14/S15, examples, invalid fixtures) and [contracts/model-additions.md](contracts/model-additions.md) (editor methods, cascades, paste, problems).
- [quickstart.md](quickstart.md). There is **no design frame**: 040 is model-only (design-analysis §a).

**Tests are required.** Constitution VI and II: unit tests (Vitest) for every model op and pure function; a round-trip case for every model change; Ajv / Zod parity stays green. Write each new test first and watch it fail. Do not add Playwright tests; the smoke suite must keep passing.

**Scope guards**:

- **Additive only**: every new key optional; decks saved before 040 are byte-identical after open → save. No `version` bump, no `revision`.
- **Key order**: new root keys after `fieldDefaults` (`dialect`, then `enums`); new node and edge keys after `style`. Declaration order in `v1.json` is the file's write order.
- **One id scope** for columns, indexes, checks, enums and enum values across the deck; duplicates refuse the file (`load-checks.ts`), never auto-fixed.
- **References by id only**: index parts, `fromColumns` / `toColumns`, `enumRef`. Renames never touch another object.
- **Child lists, not arrays**, in Yjs for `columns`, `indexes`, `checks`, `enums`, enum `values` (ADR 0021 layout 2). `read.ts` / `write.ts` stay the only reader and writer.
- **No rendering**: tables draw as generic cards until 041. The only app changes are registry-driven map entries (type style, thumbnail fill, problem kinds).
- **Out of scope**: table card, column rows, crow's foot ends, drawers, type lists, dialect conversion, SQL / DBML, lint, search, flows on tables (041–049); SQL views, custom types, sample rows.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy, test names).

**Approvals**: no new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` first ("Editing `v1.json`").
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md` and ADR 0021 first.
- **UI / app**: `packages/ui/src/lib/icons.ts`, `apps/app/src/…`; read their `CLAUDE.md`.
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Confirm the branch is `040-db-schema-model`, run `pnpm install`, then `pnpm lint && pnpm typecheck && pnpm test` to record a green baseline; note any pre-existing failure in `specs/040-db-schema-model/quickstart-results.md`
- [x] T002 [P] Run `pnpm bench` and save the summary as the "before" numbers in `specs/040-db-schema-model/quickstart-results.md`

---

## Phase 2: Foundational (file format and generated types)

**Purpose**: the schema defines every new shape; generated types are what the model imports. Blocks every story.

- [x] T003 Add invalid fixtures from contracts/file-format.md "Examples and fixtures" (15 cases: column without `type`, `notnull` typo, `size: "10.2"`, `default` + `defaultExpr`, empty index `columns`, `{ "expr": "" }`, `{ "column": "x" }`, `cardinality: "many"`, `onDelete: "set null"`, `dialect: "oracle"`, empty `fromColumns`, duplicate in `toColumns`, enum without `values`, `detail: "full"`, method `"BTREE"`) to `packages/schema/test/fixtures.ts`; run `pnpm --filter @sododeck/schema test` and watch them fail (accepted today)
- [x] T004 Add the `$defs` `Dialect`, `DbName`, `DbExpr`, `DbNote`, `DbAction`, `Cardinality`, `DbDetail`, `ColumnIdList`, `DbColumn`, `DbIndexPart`, `DbIndex`, `DbCheck`, `DbEnumValue`, `DbEnum` to `packages/schema/schema/v1.json` exactly as in contracts/file-format.md, each property with a `description` (state "absent means …" defaults in text; no `default` keyword)
- [x] T005 In `packages/schema/schema/v1.json` add root `dialect` and `enums` right after `fieldDefaults`; `Node.properties` `schema`, `columns`, `indexes`, `checks`, `expanded`, `detail` after `style`; `Edge.properties` `fromColumns`, `toColumns`, `cardinality`, `fromOptional`, `toOptional`, `onDelete`, `onUpdate` after `style`; add `db-table` to the `TypeId` description and `database` to the `PackId` description
- [x] T006 Run `pnpm schema:generate`; check `packages/schema/src/generated/` exports `DbColumn`, `DbIndex`, `DbCheck`, `DbEnum`, `DbEnumValue`, `Dialect`, `Cardinality`, `DbAction` without `…1` / `…2` aliases; re-export them from `packages/schema/src/index.ts` if the index lists types explicitly
- [x] T007 Add **S14** (a column holds at most one of `default` / `defaultExpr`, path `nodes.<i>.columns.<j>.defaultExpr`) to `packages/schema/src/semantic-rules.ts` with its header comment entry and tests in `packages/schema/test/semantic-rules.test.ts`; if the parity test shows the Zod output accepts an empty `index.columns`, `fromColumns` or `toColumns`, add **S15** for them the same way
- [x] T008 Extend `packages/schema/examples/full.sododeck.json` with the "Shop" fragment (contracts/file-format.md): a `database` card; `customers`, `orders`, `order_items` (composite PK), `categories` (self-reference) as `db-table` nodes with `parent`; `dialect: "postgres"`; one enum with value notes; an expression index; a named check; every `Cardinality`, `DbAction` and `DbDetail` value and `expanded` used at least once; keys in declared order; `packs` includes `database`
- [x] T009 Run `pnpm --filter @sododeck/schema test` until parity, coverage, key-order and generated-file tests are green and every T003 fixture is refused with a path naming the field

**Checkpoint**: schema package green; `pnpm typecheck` green (model compiles against new types; nothing uses them yet).

---

## Phase 3: User Story 1 - Describe a database schema in a deck file (Priority: P1) 🎯 MVP

**Goal**: a hand-written "Shop" deck imports, shows in the JSON panel as written, and exports byte-identical.

**Independent Test**: `round-trip.test.ts` "Shop" case; quickstart §3 steps 1, 2, 4.

### Tests for User Story 1 (write first)

- [x] T010 [P] [US1] Add round-trip cases to `packages/model/test/round-trip.test.ts`: the "Shop" deck from T008; a table with `columns: []`; a deck with `enums: []`; `dialect: "generic"` kept; a column with `pk: false` kept; an index mixing a column id and `{ expr }`; two edges between the same tables; an n–n edge; a self-reference; table keys on a `service` node and column keys on an edge between services (kept, FR-006 / FR-018). Assert `toJSON(fromJSON(x))` deep-equals `x` and key order matches
- [x] T011 [P] [US1] Add to `packages/model/test/load.test.ts`: duplicate column ids in two tables, a column id equal to an enum value id, and a duplicate index id inside one table each make `fromJSON` throw `DeckValidationError` naming every path; a column id equal to a node id is accepted
- [x] T012 [P] [US1] Add to `packages/model/test/text-fields.test.ts` (or its schema-walk table test) the expectation that `DbColumn`, `DbIndex`, `DbEnum`, `DbEnumValue` notes are not markdown and have no `Y.Text`

### Implementation for User Story 1

- [x] T013 [US1] In `packages/model/src/text-fields.ts` add `TextKind`s `dbColumn`, `dbIndex`, `dbCheck`, `enum`, `enumValue` with `[]` text fields
- [x] T014 [US1] In `packages/model/src/layout.ts` add `enumsList(doc)` (lazy `meta.enums` list, like `fieldsList`) and constants for the table child-list keys (`TABLE_LISTS = ['columns', 'indexes', 'checks']`); document them in the `deck.ts` layout comment (data-model.md "Yjs layout")
- [x] T015 [US1] In `packages/model/src/write.ts` `createObject('nodes', …)` build `columns` / `indexes` / `checks` child lists (items via `fillList` with kinds `dbColumn` / `dbIndex` / `dbCheck`) when the plain node has them, even empty; add `createEnum(plain, order)` building the enum map with a `values` child list
- [x] T016 [US1] In `packages/model/src/read.ts` read the three node child lists in order (skip them in `readStoredFields`, emit when stored, even empty) and add `readEnums(doc)`; in `readMeta` emit `dialect` when stored and `enums` when stored (even empty)
- [x] T017 [US1] In `packages/model/src/deck.ts` `fromJSON` write `meta.dialect` and build `meta.enums` when the file has them; confirm `toJSON` canonical key order (`key-order.ts`) covers the new nested `$defs` including the `DbIndexPart` `anyOf`; fix `key-order.ts` if the object branch is not ordered
- [x] T018 [US1] In `packages/model/src/load-checks.ts` add the database-parts scope (all tables' columns, indexes and checks, plus enums and their values) to `checkDuplicateIds`, paths like `nodes.3.columns.1.id` and `enums.0.values.2.id`; update the header comment
- [x] T019 [US1] Run `pnpm --filter @sododeck/model test`; T010–T012 green, every existing test green

**Checkpoint**: "Shop" imports and exports identically; JSON panel shows the schema (quickstart §3 steps 1, 2, 4).

---

## Phase 4: User Story 3 - Older decks stay unchanged (Priority: P1)

**Goal**: decks saved before 040 gain no field; the Database pack and `db-table` type exist in the registry and draw without fallbacks.

**Independent Test**: byte-identity test over every sample and fixture; `card-types.test.ts`.

### Tests for User Story 3 (write first)

- [x] T020 [P] [US3] Add a test to `packages/model/test/round-trip.test.ts` that loads every `apps/app/src/samples/*.sododeck.json` and `packages/schema/examples/{minimal,flow-and-rule}.sododeck.json`, moves one card through the editor, and asserts the output has no `dialect`, `enums`, table keys or edge relationship keys and is otherwise unchanged
- [x] T021 [P] [US3] Add to `packages/model/test/card-types.test.ts` and `packages/model/test/packs.test.ts`: pack `database` ("Database") exists after `data` and before `shapes`; type `db-table` ("Table", pack `database`, family `card`); `NEW_DECK_PACKS` includes `database`; a deck without `packs` still reads `["architecture"]`; a deck with `packs: ["architecture", "data"]` is unchanged; `isDbTable` true only for `db-table`

### Implementation for User Story 3

- [x] T022 [US3] In `packages/model/src/card-types.ts` add the pack `{ id: 'database', name: 'Database' }`, category `database` ("Database") and type `['db-table', 'Table', 'database', 'database']`; export `isDbTable(node: Pick<Node, 'type'>)`; update the file header comment
- [x] T023 [P] [US3] In `packages/ui/src/lib/icons.ts` add the `db-table` type style (lucide `Table2`, a neutral tone already in the palette, following the `database` entry) and update any test in `packages/ui/test/` that enumerates type styles
- [x] T024 [P] [US3] In `apps/app/src/library/deck-thumbnail.tsx` add a `db-table` fill (same token family as `database`); update its test if it enumerates types
- [x] T025 [US3] Run `pnpm test` (all packages); fix any exhaustive registry map in `apps/app/src` that the new pack or type breaks (search for `'truck-route'` and `'data'` pack keys), keeping UI copy "Database" / "Table"

**Checkpoint**: Packs panel lists "Database", Add shows "Table" (quickstart §3 step 3); old decks byte-identical.

---

## Phase 5: User Story 2 - Renames never break references (Priority: P1)

**Goal**: editor ops for every part; renaming anything changes nothing else.

**Independent Test**: `db-schema.test.ts` rename cases.

### Tests for User Story 2 (write first)

- [x] T026 [P] [US2] Create `packages/model/test/db-schema.test.ts` covering contracts/model-additions.md "Tables": `addColumn` (generated `dbcol-…` id, given id, `duplicate-id` against another table's column, `invalid` on a non-table node, index position), `updateColumn` (rename, type, flags `true` written / `false` and `null` remove, `enumRef` unknown → `missing-reference`, S14 both set → `invalid`, switching `default` → `defaultExpr` with `null` in one patch), `moveColumn` (order key only), `addIndex` with an unknown column → `missing-reference`, `updateIndex`, `moveIndex`, `addCheck` / `updateCheck` / `moveCheck`; each op one undo step; `update('nodes', id, { columns })` → `invalid`; `update('nodes', id, { schema, expanded: true, detail: 'keys' })` works and `expanded: false` removes it
- [x] T027 [P] [US2] In `packages/model/test/db-schema.test.ts` add rename cases (spec US2 1–4): rename `orders.customer_id` used by an edge end, an index and a check → every reference still the same id and `toJSON` differs only in that name; rename an enum used by a column; rename a table and change its `schema`; rename an enum value (id unchanged)
- [x] T028 [P] [US2] Add to `packages/model/test/edit.test.ts` (or `db-schema.test.ts`): `update('edges', id, { fromColumns: ['missing'] })` on a `db-table` end → `missing-reference`; the same on a `service` end is accepted (shape only); `cardinality`, `fromOptional`, `onDelete` set and cleared with `null`

### Implementation for User Story 2

- [x] T029 [US2] In `packages/model/src/ids.ts` add prefixes `dbcol`, `dbidx`, `dbchk`, `enum`, `enumval` and include the new lists' ids in the deck-wide collision set; add `dbPartIds(doc)` returning the database-parts scope for `duplicate-id` checks
- [x] T030 [US2] Create `packages/model/src/ops/db-tables.ts` with `addColumn`, `updateColumn`, `moveColumn`, `addIndex`, `updateIndex`, `moveIndex`, `addCheck`, `updateCheck`, `moveCheck` following `ops/steps.ts` and `ops/fields.ts` (resolve the table, refuse non-`db-table`, build the candidate node plain object, validate it with the generated Zod via `validate.ts`, check references, then write through `write.ts` inside `ctx.transact`); flags write `true` or delete the key
- [x] T031 [US2] In `packages/model/src/ops/collections.ts` make `update('nodes', …)` refuse `columns`, `indexes`, `checks` (`invalid`, message pointing to the column / index / check ops) and write `expanded: false` as a removal; in the edge path (or `ops/refs.ts`) check `fromColumns` / `toColumns` against the end table's column ids when that end is a `db-table`
- [x] T032 [US2] Wire the new methods into `DeckEditor` in `packages/model/src/editor.ts` with doc comments, and export `isDbTable`, `deckDialect` and new types from `packages/model/src/index.ts`
- [x] T033 [US2] Run `pnpm --filter @sododeck/model test`; T026–T028 green

**Checkpoint**: every table part can be added, changed and moved through the editor; renames leave references intact.

---

## Phase 6: User Story 5 - Removing things cleans up references in one step (Priority: P2)

**Goal**: removing a column, enum or table leaves no reference behind; pasting a table gives new part ids.

**Independent Test**: `db-cascade.test.ts`, `paste.test.ts` additions.

### Tests for User Story 5 (write first)

- [x] T034 [P] [US5] Create `packages/model/test/db-cascade.test.ts` (spec US5 1–5): remove a column that is the only part of one index and one of two parts of another (first removed, second keeps the other part); remove a column that is a simple edge end (edge removed); remove one column of a composite end `(order_id, line_no)` (pair dropped on both ends, edge kept); remove the last pair (edge removed); self-reference (both ends checked); remove an enum used by two columns (`enumRef` cleared, `type` kept); remove an enum value (nothing else changes); remove a table (its edges removed by the existing node cascade); `RemovalResult` lists removed and updated indexes and edges; one `undo()` restores the exact prior `toJSON` in every case
- [x] T035 [P] [US5] Add to `packages/model/test/paste.test.ts` and `fragment.test.ts`: copying a table with columns, indexes and checks and one edge with `fromColumns` / `toColumns` between two copied tables; after paste every column, index and check has a new id, index parts and the pasted edge's ends point at the new column ids, `enumRef` is unchanged, the originals keep their ids; one undo removes the paste

### Implementation for User Story 5

- [x] T036 [US5] In `packages/model/src/ops/cascade.ts` add `removeColumn` (indexes, then edges per research R9, composite pairs by position, self-reference) and `removeIndex`, `removeCheck`, exported for `ops/db-tables.ts`; keep the delete policy in this file and extend its header comment
- [x] T037 [US5] Add `removeColumn`, `removeIndex`, `removeCheck` to `DeckEditor` in `packages/model/src/editor.ts` returning `RemovalResult`
- [x] T038 [US5] In `packages/model/src/fragment.ts` keep table lists in `toFragment`; in `packages/model/src/ops/paste.ts` re-id columns, indexes and checks of pasted tables with the `dbcol` / `dbidx` / `dbchk` prefixes and remap index parts and pasted edges' `fromColumns` / `toColumns` through the same map
- [x] T039 [US5] Run `pnpm --filter @sododeck/model test`; T034–T035 green (enum cascade cases go green after T045)

**Checkpoint**: removing and pasting tables never leaves a dangling reference made by the editor.

---

## Phase 7: User Story 4 - Two tabs editing one schema merge cleanly (Priority: P2)

**Goal**: concurrent edits to different parts of one table or enum all survive.

**Independent Test**: `concurrency.test.ts` additions.

- [x] T040 [P] [US4] Add to `packages/model/test/concurrency.test.ts` (two `Y.Doc`s, exchange updates, compare `toJSON`): edit column A's `type` and column B's `name`; add a column and reorder two others; remove a column and rename it concurrently (removed in both, no reference left after the remover's cascade); edit two values of one enum; set `cardinality` and `onDelete` on one edge from two docs (last write per key)
- [x] T041 [US4] Fix any failing case in `packages/model/src/write.ts` / `ops/db-tables.ts` (items must be written field by field with `writeField`, never replaced as a whole map); add a note to `packages/model/CLAUDE.md` rules if a new rule emerges

**Checkpoint**: SC-004 holds: no lost or duplicated column in any concurrent case.

---

## Phase 8: User Story 6 - The deck knows its dialect (Priority: P3)

**Goal**: `setDialect`, enum ops and their cascade.

**Independent Test**: dialect and enum cases in `db-schema.test.ts`.

- [x] T042 [P] [US6] Add to `packages/model/test/db-schema.test.ts`: `deckDialect` is `'generic'` when absent; `setDialect('postgres')` writes the key, one undo clears it; `setDialect('generic')` and `setDialect(null)` remove it; `addEnum` (lazy `meta.enums` created on first add, `enum-…` id), `updateEnum`, `moveEnum`, `addEnumValue` / `updateEnumValue` / `moveEnumValue` / `removeEnumValue`, `duplicate-id` for an id used by a column
- [x] T043 [US6] Create `packages/model/src/ops/db-enums.ts` with `setDialect`, `addEnum`, `updateEnum`, `moveEnum`, `addEnumValue`, `updateEnumValue`, `moveEnumValue`, `removeEnumValue` (patterns of `ops/fields.ts` options), and `deckDialect(file | doc)` in `packages/model/src/read.ts` or a small `dialect.ts`
- [x] T044 [US6] Add `removeEnum` (clear `enumRef` on every column of every table, one transaction) to `packages/model/src/ops/cascade.ts`
- [x] T045 [US6] Wire `setDialect` and the enum methods into `packages/model/src/editor.ts` and exports; run `pnpm --filter @sododeck/model test` (T034 enum cases and T042 green)

**Checkpoint**: every op in contracts/model-additions.md exists and is tested.

---

## Phase 9: Problems (FR-021, cross-story)

- [x] T046 [P] Add to `packages/model/test/problems.test.ts`: `db-dangling-reference` for an index part, a `fromColumns` item and an `enumRef` naming nothing (target and `byObject` ids as in the contract); `db-composite-mismatch` for ends of length 2 and 1; no problem for column ends on a `service` card; problems keys stable across recomputation
- [x] T047 Implement both kinds in `packages/model/src/problems.ts` (add to `ProblemKind`, sort order, titles "Missing column" / "Key columns don't match" with details naming table and column ids or names), keeping the computation linear in columns
- [x] T048 [P] Add both kinds to `apps/app/src/editor/problems/problem-kinds.ts` (title, lucide icon) and update `go-to-problem.test.ts` or the kinds test if it enumerates kinds

---

## Phase 10: Polish and cross-cutting

- [x] T049 [P] Add the 150-table case to `packages/model/test/perf.test.ts` with a `largeSchemaDeck(tables, columns, relationships)` builder in `packages/model/test/helpers.ts`: `fromJSON` and `toJSON` under 1000 ms × `SLACK`, `updateColumn` under `BIG_EDIT_BUDGET_MS`, `checkDeck` under `CHECK_DECK_BUDGET_MS`; record measured numbers in `specs/040-db-schema-model/quickstart-results.md`
- [x] T050 [P] Write `docs/decisions/0029-database-pack-model.md` (context, decisions R1–R14 condensed: type and pack ids, table keys on the node, column / index / check shapes, notes as plain text, `fromColumns` / `toColumns`, enums as a root list, dialect, Yjs child lists, one id scope, cascades, paste, problems, no revision; alternatives rejected; consequences for 041–049)
- [x] T051 [P] Update `packages/schema/CLAUDE.md` (040 status paragraph: new `$defs`, root keys, node and edge keys, S14/S15, examples, fixtures) and `packages/model/CLAUDE.md` ("Added by 040": ops, cascades, id scope, problem kinds, layout additions; `ops/` list gains `db-tables`, `db-enums`)
- [x] T052 [P] Update `docs/backlog-database.md`: 040 status (built, spec path, ADR 0029); in 040 scope replace `fromPort` / `toPort` with `fromColumns` / `toColumns` and `enumRef`-to-root-list wording; in 041 and 042 note column ends are `fromColumns` / `toColumns`; check `docs/spec.md` and `docs/design/design-analysis.md` §a for wording that names `db.table` and align it
- [x] T053 Run `pnpm bench` and save the "after" numbers next to T002's in `specs/040-db-schema-model/quickstart-results.md` (expected unchanged)
- [x] T054 Run quickstart §3 in the app (`pnpm dev`): import `full.sododeck.json`, screenshot the JSON panel showing `dialect`, `enums`, a table's `columns` and an edge's `fromColumns`; confirm Packs and Add; export and diff; note results in `quickstart-results.md`
- [x] T055 Run the definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; fix anything red; confirm no `.only` / `.skip` and no tool names added (grep the diff)
- [x] T056 Final report in `quickstart-results.md` and the PR description: what changed, what was skipped, what is uncertain (e.g. S15 needed or not, key-order handling of `DbIndexPart`), and the proposed next step (041)

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phases 9–10.** Phase 2 blocks everything (generated types).
- **US1 (Phase 3)** is the base for every other story: read/write of the new lists. **US3 (Phase 4)** needs only Phase 2 and can run alongside US1 (registry and UI files do not overlap with read/write).
- **US2 (Phase 5)** needs US1 (lists exist in Yjs) and US3's `isDbTable` (T022).
- **US5 (Phase 6)** needs US2's ops and id prefixes (T029, T030). Its enum cases finish after T044 / T045.
- **US4 (Phase 7)** needs US2 (ops) and is best after US5 (remove + rename case).
- **US6 (Phase 8)** needs US1 (meta lists) and T029; independent of US5 except the `removeEnum` cascade it adds.
- **Phase 9** needs US1 (reads) and US6 (enums); **Phase 10** last.
- **Priorities**: P1 = US1, US3, US2; P2 = US5, US4; P3 = US6.

## Parallel examples

- Phase 2: T003 alongside T004; T007 and T008 in parallel after T006.
- US1: T010, T011, T012 (tests) together; then T013 → T014 → T015 / T016 → T017 → T018.
- US3 alongside US1: T020, T021 together; T023 and T024 in parallel after T022.
- US2: T026, T027, T028 together; T029 → T030 → T031 → T032.
- US5 and US6 by two agents once US2 lands: one takes T034–T039, the other T042–T045 (coordinate on `ops/cascade.ts`: T036 and T044 touch it; land T036 first).
- Polish: T049, T050, T051, T052 in parallel.

## Implementation strategy

1. **MVP = Phases 1–3 (US1)**: a schema file round-trips losslessly and shows in the JSON panel. Commit: `feat(schema): database pack format (040)` then `feat(model): read and write database schema (040)`.
2. **+ US3**: registry and byte-identity of old decks. `feat(model): database pack and table type (040)`.
3. **+ US2, US5**: editor ops and cascades, the API 043 builds on. `feat(model): table, column, index and check ops (040)`, `feat(model): column and enum cascades, table paste (040)`.
4. **+ US4, US6, problems**: concurrency proof, dialect and enums, derived problems.
5. **Polish**: perf, ADR, docs, DoD, report. One PR for the feature, small commits inside.
