# Tasks: Schema Lint (047)

**Inputs**:

- [plan.md](plan.md) and [spec.md](spec.md). Clarify answers (2026-10-04):
  - A table without a primary key is a **warning**; it never blocks SQL export.
  - Existing kinds: errors for `broken-reference`, `step-without-connection`, `broken-chain`, `invalid-rule-cells`, `db-dangling-reference` (incl. missing enum), `db-composite-mismatch`; every other existing kind is a warning.
  - No ignore or disable.
  - "Change type" changes the referencing (foreign key) column.
  - One "type not in the list" warning per type name.
- Planning decisions (research R2, R3): type data moves into `@sododeck/model` (`db-types.ts`); relationships are excluded from `duplicate-connection`.
- [research.md](research.md) (R1–R11), [data-model.md](data-model.md).
- [contracts/lint-rules.md](contracts/lint-rules.md) (kinds, severities, messages, targets, fixes) and [contracts/lint-ui.md](contracts/lint-ui.md) (list, popover, canvas, labels, export).
- [quickstart.md](quickstart.md). Design frames in `docs/design/screens/`: 144 (Problems with fix popover), 161 (problem state), 167 (schema lint list).

**Tests**: required (constitution VI). Write each story's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Organization**: one phase per user story in spec priority order (US1, US2 P1; US3 P2). US2 needs US1's marks and fixes data; US3 needs only Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US3 from spec.md.

## Path Conventions

- Model: `packages/model/src/`, tests in `packages/model/test/`
- App: `apps/app/src/` (problems UI in `apps/app/src/editor/problems/`, UI store `apps/app/src/state/ui-store.ts`)

---

## Phase 1: Setup

- [x] T001 On branch `047-db-lint` (already rebased on `main` with 052), run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green baseline. Commit `specs/047-db-lint/` as `docs: schema lint spec, plan and tasks (047)`.
- [x] T002 Run `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` before any change; save the summary as `specs/047-db-lint/bench-before.md`.

---

## Phase 2: Foundational (type data in the model, severity, problem shape)

**Purpose**: the moved type data, `sameColumnType`, severity and the new `Problem` fields every story uses.

### Type data

- [x] T003 [P] Write `packages/model/test/db-types.test.ts`: `COMMON_TYPES`, `DIALECT_TYPES`, `INDEX_METHODS`, `DIALECT_HINTS` equal the current app values (copy the expectations from `apps/app/src/db/dialect-types.test.ts`); `commonTypeOf` resolves the dialect spelling first (`timestamp` on Postgres → `datetime` entry, `timestamptz` → `timestamp` entry), then canonical and aliases; `sameColumnType`: `int`/`integer` equal on Postgres and Generic, `timestamptz`/`timestamp` differ on Postgres, `varchar(80)`/`varchar(100)` differ, `numeric(10, 2)`/`numeric(10,2)` equal, enum columns equal only with the same `enumRef`, unknown types compare by name; `idTypeOf` gives `uuid`, `char(36)`, `text`, `uuid`.
- [x] T004 Create `packages/model/src/db-types.ts` by moving `COMMON_TYPES` / `CommonType` from `apps/app/src/db/export/common-types.ts`, `DIALECT_TYPES`, `TypeEntry`, `TypeKind`, `SizeKind`, `typeEntry`, `INDEX_METHODS`, `DIALECT_HINTS` from `apps/app/src/db/dialect-types.ts`, and `commonOf` from `apps/app/src/db/import/convert-types.ts` (exported as `commonTypeOf(type, dialect)`); add `sameColumnType(a, b, dialect)` and `idTypeOf(dialect)` per research R2. Export from `packages/model/src/index.ts`. T003 is green.
- [x] T005 Update the app to import the moved data from `@sododeck/model`: keep `translateType` in `apps/app/src/db/export/common-types.ts` and `convertType` / `writtenType` in `apps/app/src/db/import/convert-types.ts`; delete `apps/app/src/db/dialect-types.ts` (move its remaining tests into T003); update every importer (`db/dialect-change.ts`, `db/column-line.ts`, `db/export/schema-slice.ts`, `db/import/build-plan.ts`, `db/fixtures/shop.ts`, `editor/inspector/table/type-picker.tsx`, `column-fields.tsx`, `indexes-tab.tsx`, `editor/inspector/database/dialect-select.tsx`, `dialect-confirm-dialog.tsx`, and any other hit of `grep -rl "dialect-types\|common-types" apps/app/src`). `pnpm --filter @sododeck/app test` and `typecheck` stay green with no behaviour change.

### Severity and problem shape

- [x] T006 [P] Write severity tests in `packages/model/test/problems.test.ts`: every `ProblemKind` has a severity matching contracts/lint-rules.md; the missing-enum `db-dangling-reference` is an error; `DeckProblems.errors` / `warnings` counts; the list sorts errors before warnings, then by kind rank, object title, order, key; an existing `field-value-dangling` problem carries `fixes: [{ kind: 'remove-value', … }]` instead of `fix`.
- [x] T007 Implement in `packages/model/src/problems.ts`: `Severity`, `SEVERITY: Record<ProblemKind, Severity>`, `Problem.severity`, `Problem.column?`, `Problem.fixes?` (replacing `fix`; migrate the 032 `remove-value` fix), the `ProblemFix` union from research R5 (all kinds declared now), `DeckProblems.errors` / `warnings`, and the severity-first sort in `finish`. Export the new types. T006 is green.
- [x] T008 Update the app for `fixes`: `apps/app/src/editor/problems/problems-panel.tsx` reads `problem.fixes` (only `remove-value` so far, behaviour unchanged) and every other use of `problem.fix` (`grep -rn "\.fix\b" apps/app/src`). Tests stay green.

**Checkpoint**: type data lives in the model, every problem has a severity, and the app still behaves as before.

---

## Phase 3: User Story 1 - See schema mistakes in the Problems list (Priority: P1) 🎯 MVP

**Goal**: all schema rules report with their severity; the list filters by severity; the canvas marks tables, rows and relationships.

**Independent Test**: in "Shop", remove `payments.id`; the list shows "payments has no primary key" as a warning and the table shows the badge.

### Tests for User Story 1

- [x] T009 [P] [US1] Write rule tests in `packages/model/test/problems.test.ts` (one `describe` per kind, building small decks with the existing helpers): each of the 15 kinds in contracts/lint-rules.md fires once per broken object with its severity, title, detail text, key, target, `column` and `fixes`; the clean Shop deck (`apps/app/src/db/fixtures/shop.ts` shape, or `largeSchemaDeck`) has 0 `db-*` problems; a dangling or unequal-length relationship has no follow-on `db-type-mismatch`, `db-fk-not-key`, `db-duplicate-relationship` or loop problem; relationships no longer produce `duplicate-connection`; `int` vs `integer` is no mismatch; `defaultExpr: 'NULL'` on a not-null column fires `db-null-default`; a self-reference with a nullable column is no loop; three `citext` columns on MySQL give one `db-unknown-type` with "3 columns"; names schema-qualified only with several schemas.
- [x] T010 [P] [US1] Add a lint case to `packages/model/test/perf.test.ts`: `checkDeck` on `largeSchemaDeck` (150 tables, with relationships and enums from `test/helpers.ts`) within `CHECK_DECK_BUDGET_MS`.
- [x] T011 [P] [US1] Extend `apps/app/src/editor/problems/problem-marks.test.ts`: `severity` is the worst of the object's problems; `rows` maps each problem's `column.columnId` to its worst severity on that table; edges get `short`; `sameProblemMark` compares the new fields.
- [x] T012 [P] [US1] Extend `apps/app/src/editor/problems/problems-panel.test.tsx`: the All / Errors / Warnings control shows counts and filters rows; each row's icon has the accessible name "Error" or "Warning"; errors are listed first.
- [x] T013 [P] [US1] Extend `apps/app/src/editor/table/table-body.test.tsx` and `apps/app/src/editor/deck-edge.test.tsx`: a row with a problem draws the severity glyph in place of its key / link glyph with the problem title as name and tooltip, and the key glyph returns when the problem is gone; a relationship with a problem is dashed in the severity colour with the `short` pill; 043's mismatch icon is gone.

### Implementation for User Story 1

- [x] T014 [US1] Implement the 15 rules in `checkDatabase` in `packages/model/src/problems.ts` per contracts/lint-rules.md and research R3 (one indexing pass; `sameColumnType`; Tarjan for required loops; grouping for unknown types; `duplicate-connection` skips relationships; titles in `TITLES`; kinds appended to `ProblemKind` and `PROBLEM_KINDS`; drafts set `column`, `fixes` and `short`). Add the `short` field to the draft and `Problem` (optional, for edges). T009 and T010 are green.
- [x] T015 [P] [US1] Add icons for the new kinds in `apps/app/src/editor/problems/problem-kinds.ts` (`PROBLEM_ICONS`) and create `apps/app/src/editor/problems/severity-icon.tsx` (`CircleX` clay for error, `TriangleAlert` amber for warning, `aria-label`).
- [x] T016 [US1] Extend `apps/app/src/editor/problems/problem-marks.ts` (`severity`, `rows`, `short`, `sameProblemMark`). T011 is green.
- [x] T017 [US1] Add the severity filter (`ui.problemFilter`, reset on deck switch in `apps/app/src/state/ui-store.ts`), the segmented control with counts and severity icons to `apps/app/src/editor/problems/problems-panel.tsx`. T012 is green.
- [x] T018 [US1] Canvas marks: in `apps/app/src/editor/table-layout.ts` replace `TableRow.mismatch` with `problem?: { severity, title }` filled from the node's mark `rows`; remove `mismatchedColumns` and `TableContext.mismatched` from `apps/app/src/editor/table-keys.ts`; draw the glyph in place of the key glyph in `apps/app/src/editor/table/table-body.tsx`; colour the header badge and dashed outline by severity in `apps/app/src/editor/deck-node.tsx`; dash relationships with a mark and draw the `short` pill in `apps/app/src/editor/deck-edge.tsx`; pass the marks through `deck-to-flow.ts` cache checks. T013 is green.
- [x] T019 [US1] Use `sameColumnType` in `apps/app/src/editor/relationships/type-mismatch.ts` (042's drop warning) and `apps/app/src/editor/inspector/relationship/column-pairs.tsx` (052's pair (!)); update their tests.
- [x] T020 [US1] Rail badge colour in `apps/app/src/editor/shell/rail.tsx`: clay when `errors > 0`, amber otherwise; extend its test.

**Checkpoint**: lint is visible in the list and on the canvas.

---

## Phase 4: User Story 2 - Go to a problem and fix it in one click (Priority: P1)

**Goal**: going to a problem focuses the row and opens a fix popover; every fix is one undo step.

**Independent Test**: for each fix, trigger the problem, apply the fix from the list and the popover; the problem is gone and one ⌘Z restores it.

### Tests for User Story 2

- [x] T021 [P] [US2] Write `apps/app/src/db/junction-table.test.ts`: `planJunction` names `products_categories` (then `_2` when taken), one not-null pk column per key column of each side named `<table>_<column>` with the key's type and size, position at the midpoint; `applyJunction` adds the table and two `n-1` relationships with column ends, removes the n–n edge, all undone by one `undo()`.
- [x] T022 [P] [US2] Write `apps/app/src/editor/problems/apply-fix.test.ts` with a real `DeckEditor`: `make-pk`, `add-id-pk` (dialect id type, first column), `match-type` (single and composite), `remove-default`, `allow-null`, `delete-edge`, `create-junction` each fix their problem and are one `undo()`; each announces the contract's text; `rename`, `pick-column`, `add-values`, `pick-type` open title edit / `openTableDrawer` / the relationship drawer / `openEnumDrawer`; fixes on a locked table are refused with `LOCKED_HINT`.
- [x] T023 [P] [US2] Extend `apps/app/src/editor/problems/go-to-problem.test.ts` and `next-problem.test.ts`: a problem with `column` sets `focusedRow`, sets `problemReveal`, selects and centres the table, and opens `problemPopover`; the view projection shows that table at All without any document write and drops it when the selection leaves; ⌘. visits errors before warnings.
- [x] T024 [P] [US2] Write `apps/app/src/editor/problems/problem-fix-popover.test.tsx`: anchored content (severity icon, title, detail, primary fix filled), Esc and outside click close and return focus, it closes when the problem disappears, locked fixes disabled with "Locked · unlock to fix".

### Implementation for User Story 2

- [x] T025 [P] [US2] Implement `apps/app/src/db/junction-table.ts` (`planJunction`, `applyJunction`) per research R6, reusing `editor/canvas-actions.ts` table creation and `copyName`. T021 is green.
- [x] T026 [US2] Implement `apps/app/src/editor/problems/apply-fix.ts` per research R5 and contracts/lint-ui.md (one `oneStep` / `editor.batch` per write fix, announcements, `refuseLocked`), and use it for the fix buttons in `problems-panel.tsx` (labels from the contract). T022 is green.
- [x] T027 [US2] Add `problemPopover` and `problemReveal` to `apps/app/src/state/ui-store.ts` (cleared on deck switch; reveal cleared when the selection leaves the table); apply the reveal in `apps/app/src/editor/views/view-state.ts` like `withRowEdit`; extend `apps/app/src/editor/problems/go-to-problem.ts` and `use-go-to-problem.ts` for row focus (`setFocusedRow`, `focusRowSoon`), reveal and popover. T023 is green.
- [x] T028 [US2] Implement `apps/app/src/editor/problems/problem-fix-popover.tsx` (anchored to the row, header or edge midpoint) and mount it in the canvas overlay next to the other canvas popovers. T024 is green.

**Checkpoint**: every problem can be reached and the obvious ones fixed in one click.

---

## Phase 5: User Story 3 - See errors and warnings before exporting SQL (Priority: P2)

**Goal**: the export banner shows errors and warnings; the block switch counts errors only.

**Independent Test**: with one error and one warning in scope, the banner shows both counts; with the block switch on, fixing the error enables SQL export while the warning remains.

### Tests for User Story 3

- [x] T029 [P] [US3] Extend `apps/app/src/editor/export/export-dialog.test.tsx` and the schema export panel test: banner "n errors · n warnings in <scope>" with errors listed first; with the block switch on, a warning-only scope exports SQL and an in-scope error disables Copy and Download; out-of-scope problems are not counted.

### Implementation for User Story 3

- [x] T030 [US3] Make `apps/app/src/editor/export/schema-problems.ts` return `{ errors, warnings }` (remove `TODO(047)`), use `errors.length > 0` for `sqlBlocked` in `export-dialog.tsx`, and render both counts in `schema-export-panel.tsx`. T029 is green.

**Checkpoint**: all stories work.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T031 Run `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` after the change; save `specs/047-db-lint/bench-after.md`; stay within 5 % of `bench-before.md`.
- [ ] T032 [P] Compare frames 144, 161 (problem state) and 167 in light and dark at 100 %; fix spacing and tokens; capture screenshots for the report.
- [ ] T033 [P] Docs: amend `docs/decisions/0013-derived-problems.md` (severity, `column`, `fixes`, sort) and `docs/decisions/0029-database-pack-model.md` (lint kinds, type data in the model, the reveal override and 048's row limit); update `packages/model/CLAUDE.md` (`db-types.ts`, severity, fixes), `apps/app/CLAUDE.md` (problems UI, marks, apply-fix, junction table; 043's mismatch replaced); mark 047 in `docs/backlog-database.md` (drop "Block SQL export with errors" from §047, which 052 built) and fix the feature inventory rows that still name 043 for the drawer and type picker.
- [ ] T034 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass; no skipped or `.only` tests; walk through `quickstart.md`; final report (what changed, skipped, uncertain).

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → stories.** In Phase 2: T003 → T004 → T005; T006 → T007 → T008 (T007 can start after T004).
- **US1** (T009–T020) after Phase 2. T014 before T016–T018 run against real data; T015 parallel.
- **US2** (T021–T028) after US1's T014 (fixes data) and T016 (marks for anchoring). T025 parallel with T026–T028.
- **US3** (T029–T030) after T007 only.
- **Polish** after the stories.

## Parallel Examples

- Phase 2: T003 and T006 together.
- US1: T009, T010, T011, T012, T013 together; then T014 with T015.
- US2: T021, T022, T023, T024 together; then T025 alongside T026.
- US3 can run in parallel with US1 / US2 once T007 is done.

## Implementation Strategy

1. **MVP**: Phases 1–3 (type data, severity, rules, list filter, canvas marks). Validate quickstart steps 1, 3, 5, 6.
2. **P1 complete**: US2 (go to, popover, fixes, junction table). Validate steps 2, 4, 7, 9.
3. **P2**: US3 (export counts). Validate step 8.
4. Polish.

Commit after each task or logical group, Conventional Commits (`refactor(model): …` for the type data move, `feat(model): …`, `feat(app): …`, `test(…): …`, `docs: …`), no AI attribution lines.
