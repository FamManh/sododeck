# Tasks: Database Scale

**Input**: design documents in `specs/048-db-scale/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: deck-wide grouping mode By group / By schema; table focus reuses Focus (F); one outside proxy per hidden table; Jump to opens a cut table permanently as Show all, one undo step; a table created outside a view's filter shows temporarily with "Add to this view").
- [research.md](research.md) (R1–R12), [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/scale-ui.md](contracts/scale-ui.md), [quickstart.md](quickstart.md). Design frames 158, 162, 163 in `docs/design/screens/`.

**Depends on** 040–046 (merged), 011 (views), 010 (groups, focus), 034 (ports), 009 (palette), 037 (bench). 047 (lint) is not needed.

**Tests are required.** Constitution VI and AGENTS.md: every pure function gets a unit test, every model change a round-trip case, a bug starts with a failing test, component tests use roles and names. **No new e2e tests** (founder deferral); the smoke suite must stay green and under 30 s.

**Scope guards**:

- The row selection (limit, order, connected rows, filter, button slot) lives **only** in `apps/app/src/editor/table-layout.ts`; no other file may decide which rows draw or how tall a table is.
- Writes only through `DeckEditor`; Show all, grouping mode and view edits are `oneStep` undo steps.
- Filter text, focus and temporary reveal are UI state; they never enter the deck.
- Virtual schema groups (`schema:<name>`) are derived; stored `group` / `parent` are never written.
- Collapsing a group, filtering a view or limiting rows never removes anything from JSON, SQL, DBML, search or lint.
- Tokens only (no hard-coded colours), lucide icons, English copy exactly as in contracts/scale-ui.md.
- Do not name other diagram or database tools anywhere (code, comments, copy, ADR, fixtures).
- Do not start 047 or 049 work.

**Approvals**: none needed (no new runtime dependency). Ask before adding any.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…` (`A` = `apps/app/src/editor`), tests next to code (`*.test.ts(x)`); read `apps/app/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md` first.
- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` first.
- **Commits**: `feat(app): …`, `feat(model): …`, `feat(schema): …`, `test(app): …`, `docs: …`. No AI attribution lines (project rule overrides the default trailer).

---

## Phase 1: Setup

**Purpose**: ADR, bench fixtures and the "before" numbers (taken before any code change).

- [x] T001 Write ADR `docs/decisions/0034-db-scale.md` (Status, Date, Feature, Builds on 0029 / 0030 / 0033): row limit inside `tableLayout`, `expanded` as the saved choice, `groupingMode` as a deck-level scalar with virtual `schema:` groups, view `schemas` and `detail`, `table` / `column` search kinds, per-mode collapse by id prefix, unknown-key policy for older builds
- [x] T002 [P] Extend `apps/app/src/bench/generate-deck.ts` (+ `generate-deck.test.ts`): options `wide` (every 10th table has 60 columns) and `schemas` (n schema names assigned round-robin), keeping `tables` and `rel`; 150 nodes / 1,800 columns / 250 relationships reachable; deterministic by seed; read `wide` and `schemas` from the query string in `apps/app/src/routes/bench-page.tsx`
- [x] T003 Per-scenario node / edge count override in `apps/app/bench/perf.bench.ts` (today global constants) and env flags `BENCH_WIDE`, `BENCH_SCHEMAS`; keep every existing scenario unchanged
- [x] T004 Run the baseline **before any feature change** and save to `specs/048-db-scale/bench-before.md` (machine, settings, 500-card default, 150 tables with `wide` and `schemas`, ⌘K type-to-results): `BENCH_NODES=150 BENCH_EDGES=250 BENCH_TABLES=150 BENCH_REL=1 BENCH_WIDE=1 BENCH_SCHEMAS=3 pnpm bench` and `pnpm bench`

---

## Phase 2: Foundational (blocks the stories that store data)

**Purpose**: the three additive format keys and their model ops, done once so one `pnpm schema:generate` covers them. `expanded` already exists (040).

- [x] T005 Write failing tests then edit `packages/schema/schema/v1.json`: deck `groupingMode` (enum `["schema"]`), view `schemas` (string array, minItems 1) and view `detail` (`names` | `keys` | `all`); run `pnpm schema:generate`; add cases to `packages/schema/test/fixtures.ts` and `packages/schema/examples/full.sododeck.json`; Ajv / Zod parity stays green
- [x] T006 [P] Write failing tests `packages/model/test/db-grouping.test.ts` then implement `packages/model/src/ops/deck-grouping.ts` (`setGroupingMode`: writes `meta.groupingMode` for `'schema'`, deletes the key for the default), `groupingModeOf` reader in `packages/model/src/read.ts`, whitelist in `packages/model/src/validate.ts`, `DeckEditor.setGroupingMode` in `packages/model/src/editor.ts`; round-trip, undo and two-replica convergence cases
- [x] T007 [P] Write failing tests then edit `packages/model/src/ops/views.ts`: add `schemas` and `detail` to `SETTINGS_KEYS` and `ViewSettingsPatch` (empty list removes the key, default removes the key); cases in `packages/model/test/views.test.ts` and `round-trip.test.ts`
- [x] T008 [P] Guard test in `packages/model/test/db-grouping.test.ts`: a stored group id never starts with `schema:` (reader skips such a stored group and reports it), so virtual ids cannot collide
- [x] T009 [P] `expanded` model test in `packages/model/test/db-schema.test.ts`: set true → round-trips; set false removes the key; undo restores; applying it on a locked node through the model succeeds (lock is an app rule)

**Checkpoint**: the file format and model carry every saved choice; no UI yet.

---

## Phase 3: User Story 1 - Read a 60-column table without it taking over the canvas (Priority: P1) 🎯 MVP

**Goal**: 12-row limit, "Show all n columns" / "Show fewer", saved per table, anchors on the button, same rows everywhere.

**Independent Test**: load a 60-column table with three FKs; check the rows, open and close it, reload, undo, and compare with frame 158 (quickstart 1–2, 8).

- [x] T010 [US1] Write failing tests `apps/app/src/editor/table-layout.test.ts`: at All a 60-column table shows PK → FK → rest up to 12 in stored order; a column that is a relationship end is always shown (more than 12 rows possible); `hidden.count` counts only really hidden rows; exactly 12 or 13-with-one-connected shows no button; Names and Keys unchanged; `detail: all` still wins at Keys; opened table shows every row; height = rows + button + footer
- [x] T011 [US1] Implement the limit in `apps/app/src/editor/table-layout.ts`: `ROW_LIMIT = 12` in `TABLE_CARD`, `hidden.kind: 'limit'`, button slot (24 tall, 6 above) in place of the pill at All, `buttonTop`; thread `expanded` from the node into `tableLayout` / `cachedTableLayout` and into the cache key (`apps/app/src/editor/table-keys.ts`)
- [x] T012 [US1] Failing test then update `rowAnchorY` in `apps/app/src/editor/table-layout.ts`: a hidden column at All anchors at the button centre, at Keys / Names at the pill or title as before; anchors for the same column before and after opening differ only by the row position (SC-003: 0 px relative to the row)
- [x] T013 [P] [US1] Component tests then draw the button in `apps/app/src/editor/table/table-body.tsx`: dashed Border-strong button "Show all 60 columns" / "Show fewer" (`aria-expanded`), `type="button"`, tokens only; click toggles `expanded` through `oneStep(editor, …)`; works on a locked table; no inner scrolling
- [x] T014 [P] [US1] Update compact and zoom paths in `apps/app/src/editor/table/table-compact.tsx` so System / Landscape draw inside the same box and never show the button (041 size rule); test in `table-compact.test.tsx`
- [x] T015 [US1] Make every consumer follow the one layout: confirm `apps/app/src/editor/canvas-geometry.ts`, `deck-to-flow.ts`, `relationships/relationship-ends.ts`, `relationships/column-target.ts`, `editing/column-connect-drag.ts` read the new `TableLayout` (no private row logic); add a test in `apps/app/src/editor/deck-to-flow.test.ts` that connector ends for a cut FK sit on the button and move to the row after Show all
- [x] T016 [US1] Export: `apps/app/src/editor/export/scene.ts` and `export/render-svg.ts` draw the limited rows and the button from the same layout (replace the pill code for `kind: 'limit'`); golden / unit test comparing a limited and an opened table in `export/render-svg.test.ts`
- [x] T017 [P] [US1] Undo / sync tests in `apps/app/src/editor/table/table-body.test.tsx`: Show all then undo returns the previous state; two tabs converge; reload keeps it

**Checkpoint**: US1 works alone and is the MVP; SC-001 and SC-003 hold.

---

## Phase 4: User Story 2 - Find a column inside a long table (Priority: P1)

**Goal**: ⌘F filter on the selected table with counter, highlight and restore.

**Independent Test**: filter a 60-column table for a name that exists only past row 12 (quickstart 3).

- [x] T018 [US2] Failing tests then add `tableFilter` state (`{ tableId, text, index } | null`, `openTableFilter`, `setTableFilterText`, `stepTableFilter`, `closeTableFilter`) in `apps/app/src/state/ui-store.ts`; closed on selection change and deck close; never persisted
- [x] T019 [US2] Failing tests in `apps/app/src/editor/table-layout.test.ts` then project the filter into `tableLayout` (like `withNewRow`): matching rows (case-insensitive) shown beyond the limit, `matchIds`, non-matches folded behind the button, connected rows still shown; only the filtered table's cache key changes; closing restores the exact saved layout
- [x] T020 [P] [US2] Component tests then implement `apps/app/src/editor/table/table-filter.tsx`: labelled input "Find a column in {table}", counter "k/n" or "0" in a live region, Enter / Shift+Enter step matches and scroll them into view, Esc / clear closes; match rows styled (Orange Soft fill, name 600 Orange Ink); wire into `table-body.tsx` header slot
- [x] T021 [US2] ⌘F in `apps/app/src/editor/use-canvas-shortcuts.ts` beside ⌘K / ⌘S: exactly one table selected and the target not a text field → `preventDefault`, open the filter; test that browser find is not triggered and that ⌘F does nothing with no or several tables selected; add `table-find` to `apps/app/src/editor/shell/shortcuts.ts` (section Tables) and its test
- [x] T022 [P] [US2] Tests: filter works on a locked table, changes nothing in the deck (document snapshot equal), updates the counter when a column is added, renamed or deleted while open

**Checkpoint**: US1 + US2 usable on any long table; SC-004 holds.

---

## Phase 5: User Story 3 - Jump to a table or a column (Priority: P1)

**Goal**: ⌘K finds tables and columns; Enter selects, opens a cut table and pans to the row.

**Independent Test**: on the 150-table deck, jump to a cut column and to a far table (quickstart 4). Depends on US1 (`expanded`).

- [x] T023 [US3] Failing tests in `packages/model/test/search.test.ts` then add `table` and `column` to `SearchKind` in `packages/model/src/search/`: table entries (name + schema + column count), column entries (`table.column`, type, key marker); table ranks above column on equal match; cached by `nodes` identity so typing does not rebuild; deck without tables unaffected
- [x] T024 [US3] Bound the work: `searchDeck` in `packages/model/src/search/search.ts` takes a real limit (top-k plus the count of the rest) instead of `Number.MAX_SAFE_INTEGER`; test with 10,000 matching columns that results are capped and "n more" is correct; perf test: 1,800 columns indexed ≤ 10 ms, type-to-results ≤ 50 ms
- [x] T025 [US3] Failing tests then `apps/app/src/editor/command-palette/palette-results.ts`: kinds `table` / `column`, meta text (schema, columns, type, key), hidden marks "Hidden in this view" and "In collapsed schema" (the latter only when grouping mode is By schema; wired fully in US4)
- [x] T026 [US3] Failing tests then add the `table` and `column` cases to `apps/app/src/editor/command-palette/open-result.ts`: column cut by the limit → `expanded = true` through `oneStep` (permanent, works on locked tables), select the table and set `ui.focusedRow`, after one frame `setCenter` on `box.y + rowAnchorY(...)` (`duration: 0` for reduced motion); the target row is inside the viewport; hidden-in-view results use the existing "Show in {view}" toast and never change state silently
- [x] T027 [P] [US3] Component tests in `apps/app/src/editor/command-palette/command-palette.test.tsx`: type "invoice_id" → columns labelled with their table, Enter on `payments.invoice_id` selects the row (drawer / inspector shows that column, US3.5), "n more" line, Esc returns focus
- [x] T028 [P] [US3] Check the drawer / inspector reads `ui.focusedRow` for a jumped column (`apps/app/src/editor/inspector/node-inspector.tsx`, `table-actions.ts`); fix and test if the column does not show

**Checkpoint**: P1 stories done; SC-002 holds.

---

## Phase 6: User Story 4 - Group tables by group or by schema and collapse them (Priority: P2)

**Goal**: deck-wide grouping mode, schema groups, collapse, merged ×n connectors with FK lists.

**Independent Test**: three-schema deck; switch mode, collapse and expand each schema, read the lists (quickstart 5). Needs T005–T008.

- [x] T029 [US4] Failing tests then implement `apps/app/src/editor/schema-groups.ts` (`schemaGroupedDeck(deck)`): one virtual group `schema:<name>` per schema with titles and member ids, tables without schema left out, real `group` / `parent` unchanged, identity-stable output for the same inputs; a table with a real group follows its schema in this mode
- [x] T030 [US4] Wire the mode into `apps/app/src/editor/visible-graph.ts` and `deck-to-flow.ts`: By schema feeds the derived groups to `visibleGraph`; By group is byte-for-byte today's behaviour (regression tests on the existing fixtures); collapsed card shows "n tables · m relationships"; collapse ids with the `schema:` prefix go through the existing per-view `collapsed` list (`views/use-current-view.ts`: `setGroupCollapsed`, `collapsedOf`)
- [x] T031 [P] [US4] Failing tests then update `apps/app/src/editor/merged-edge-popover.tsx` (and `merged-edge.tsx` if needed): for relationship edges list "table.column → table.column · cardinality" and select that relationship on choose; count pill unchanged
- [x] T032 [P] [US4] Grouping control in `apps/app/src/editor/inspector/table-display-section.tsx`: segmented "By group | By schema" wired to `editor.setGroupingMode` in `oneStep`; shows in the Database section only; component test
- [x] T033 [US4] Collapse / expand actions for virtual groups in `apps/app/src/editor/actions/group-actions.ts` (chevron, Space) and `group-boundary-node.tsx` / `collapsed-group-node.tsx` labels; test that switching modes keeps each mode's collapse state, and that collapsed tables stay in JSON, SQL, DBML, search (FR-015)
- [x] T034 [P] [US4] Palette: result in a collapsed schema group is marked and offers "Expand schema" (`command-palette/open-result.ts`, `palette-results.ts`); test
- [x] T035 [US4] Perf check: collapse and expand a 50-table schema ≤ 1 s on the bench deck; record in `specs/048-db-scale/quickstart-results.md`

**Checkpoint**: SC-006 holds; By group unchanged.

---

## Phase 7: User Story 5 - Save a view of one part of the schema (Priority: P2)

**Goal**: view filters by schema / group / table with own detail, outside proxies, "Add to this view".

**Independent Test**: view "Billing" = schema `billing` + `customers`, detail Keys; switch away and back (quickstart 6). Needs T005, T007.

- [x] T036 [US5] Failing tests then extend `apps/app/src/editor/view-filter.ts`: a table shows if its schema is in `view.schemas` or its id is in `includes`; non-table nodes follow existing rules; `excludeGroups` still applies; a filter matching nothing returns an empty visible set; stable identity of the returned sets
- [x] T037 [US5] Per-view detail in `apps/app/src/editor/views/view-state.ts`: `view.detail` overrides `display.detail` via `setTableDeck`; test that a table set to `expanded` or `detail: all` still wins, and other views are unchanged
- [x] T038 [US5] Failing tests then outside proxies for hidden tables: reuse `PortPill` / `port:` in `apps/app/src/editor/visible-graph.ts` and `deck-to-flow.ts` so every relationship from a visible table to a hidden table draws one dashed proxy per hidden table (not merged, group collapse does not change it); click offers "Show in {view}" via `firstViewShowing`
- [x] T039 [P] [US5] View settings UI in `apps/app/src/editor/views/view-settings-popover.tsx`: Schemas (checkbox list from the deck's schema names), Tables (picker writing `includes`), Detail (Names · Keys · All · Deck default); component tests by role and name; empty state "No tables match this view" with "Edit filter"
- [x] T040 [US5] "Add to this view" for a table created outside the filter: reuse `revealed` in `view-filter.ts`, note "Outside this view's filter" and a button that adds the id to `includes` in one undo step; the filter changes in no other way; test
- [x] T041 [P] [US5] Round-trip test: export and re-import a deck with views using `schemas`, `detail`, `includes`, `collapsed: ["schema:billing"]`; positions, collapse and detail identical (SC-007) in `apps/app/src/editor/views/views-roundtrip.test.ts`

**Checkpoint**: SC-007 holds.

---

## Phase 8: User Story 6 - Focus a table and its neighbours (Priority: P2)

**Goal**: Focus (F) on a table keeps it and its one-hop neighbours strong and highlights relationships among them. No new control.

**Independent Test**: focus a table on the 150-table deck and count strong tables (quickstart 7).

- [ ] T042 [US6] Failing tests in `apps/app/src/editor/focus-set.test.ts`: a table with 4 related tables gives 5 strong tables on the 150-table fixture; either direction counts; self-reference adds none; a neighbour inside a collapsed group keeps the group card strong; edges among kept tables are in the highlighted set
- [ ] T043 [US6] Implement the second pass in `apps/app/src/editor/focus-set.ts` (edges where both ends are in the kept set); verify `hover-focus/hover-focus-style.tsx` and `canvas.tsx` style them; Esc ends focus and keeps the selection; focus follows a new selection; test

**Checkpoint**: SC-008 holds.

---

## Phase 9: User Story 7 - Know the 150-table board stays smooth (Priority: P3)

**Goal**: the 150-table scenario in `pnpm bench` meets the 500-card target and is recorded.

**Independent Test**: run `pnpm bench` before and after (quickstart bench commands).

- [ ] T044 [US7] Add the scenario "150 tables" to `apps/app/bench/perf.bench.ts` reports (`report-*.md` table row) with pass criteria avg ≥ 57 fps and p95 ≤ 20 ms; include open time and ⌘K type-to-results
- [ ] T045 [US7] Run after the feature: `specs/048-db-scale/bench-after.md` (same flags as T004) and compare with before and with the 500-card deck; note SC-005 (open ≤ 1.5× the 500-card deck)
- [ ] T046 [US7] Update `docs/performance.md` (new 150-table row, baseline and target, machine and settings)
- [ ] T047 [US7] If the 150-table scenario misses the target, stop and report the numbers with the slowest part (layout cache, derived groups, search index) instead of tuning silently; propose the fix as a follow-up

**Checkpoint**: SC-005 recorded.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T048 [P] Accessibility pass: button names, `aria-expanded`, filter live region, palette result labels, 4.5:1 contrast in light and dark with DESIGN.md tokens, reduced-motion pan; checks in the component tests above
- [ ] T049 [P] Docs: update `apps/app/CLAUDE.md` (table layout / row limit, schema-groups, palette kinds, views filter, focus), `packages/model/CLAUDE.md` (grouping op, view keys, search kinds), `packages/schema/CLAUDE.md` (three additive keys), `DESIGN.md` only if a token changed; mark 048 built in `docs/backlog-database.md`
- [ ] T050 Write `specs/048-db-scale/quickstart-results.md` with the manual run of quickstart 1–8 and screenshots against frames 158, 162, 163
- [ ] T051 Full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` (smoke < 30 s, no-third-party check green); fix anything the new code broke
- [ ] T052 Final report: what changed, what was skipped, what is uncertain (including bench numbers); then stop (do not start 049 or 047)

---

## Dependencies & Execution Order

- **Phase 1** first; **T004 (baseline) before any feature change** (T010 onwards).
- **Phase 2** (T005–T009) before US4 and US5; US1–US3 only need `expanded` (already in the format) and T009.
- **US1 (P1)** is the MVP. **US2** depends on T011 (layout) and T018. **US3** depends on US1 (`expanded`, anchors).
- **US4** depends on Phase 2 (T005, T006, T008). **US5** depends on T005, T007 and shares proxies with 034; T034 depends on US3 palette.
- **US6** is independent of US1–US5 but benefits from US4 for the collapsed-group case (T042 scenario can use a stored group first).
- **US7** after all behaviour tasks (T045 after US1–US6).
- **Polish** last.

```text
T001..T004 ─► T005..T009 ─┬─► US1 (T010–T017) ─┬─► US2 (T018–T022)
                          │                     └─► US3 (T023–T028)
                          ├─► US4 (T029–T035) ─► T034
                          ├─► US5 (T036–T041)
                          └─► US6 (T042–T043)
                          US1..US6 ─► US7 (T044–T047) ─► Polish (T048–T052)
```

## Parallel Opportunities

- Phase 1: T002 with T001; T003 after T002; T004 after T003.
- Phase 2: T006, T007, T008, T009 in parallel after T005.
- US1: T013, T014, T017 in parallel after T011; T012 and T015 after T011; T016 after T015.
- US2: T020 and T022 in parallel after T019.
- US3: T023 and T024 (model) in parallel with T025 (app) once the kinds exist; T027, T028 in parallel after T026.
- US4: T031, T032, T034 in parallel after T030.
- US5: T039 and T041 in parallel after T036.
- US1, US4, US5 and US6 can be built by different people once Phase 2 is done.

## Implementation Strategy

1. **MVP**: Phases 1–3 (baseline, format keys, row limit and Show all). Stop and check SC-001 and SC-003 against frame 158.
2. Add US2 and US3 (P1) for filtering and navigation; check SC-002 and SC-004.
3. Add US4, US5, US6 (P2) in any order; each ships alone behind its own control.
4. Finish with US7 (bench after, `docs/performance.md`) and Polish; run the full gate.

Small conventional commits per task or pair of tasks; stop after T052.
