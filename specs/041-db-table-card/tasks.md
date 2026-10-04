# Tasks: Table Card

**Input**: design documents in `specs/041-db-table-card/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: stored column order; optional enum colour; deck detail and display toggles stored in the file) and planning corrections (a table's size follows its effective detail, never the zoom; Auto draws all rows from 90 %; no PDF export and no lock state yet).
- [research.md](research.md) (R1–R15) and [data-model.md](data-model.md).
- [contracts/format-and-model.md](contracts/format-and-model.md) (`TableDisplay`, `DbEnum.color`, `setTableDisplay`) and [contracts/table-card-ui.md](contracts/table-card-ui.md) (roles and names).
- [quickstart.md](quickstart.md). Design frames: 156 (anatomy), 157 (sample set), 161 (states), 162 (zoom levels), 152 (Deck settings), 146 (narrow window) in `docs/design/screens/`; values in DESIGN.md "Database pack".

**Blocked by 040.** Do not start before `specs/040-db-schema-model` is implemented and merged (`db-table`, `isDbTable`, `DbColumn`, `enums`, `fromColumns` / `toColumns`, `updateEnum`).

**Tests are required.** Constitution VI: unit tests for every pure module and model op; component tests (Testing Library) by role and name from contracts/table-card-ui.md; round-trip cases for the format additions. Write each test first and watch it fail. No new Playwright tests; the smoke suite must pass.

**Scope guards**:

- **One layout**: `table-layout.ts` is the only place that computes table rows, cuts and height; canvas geometry, `DeckNode` and export all call it. Never measure the DOM (§g-58, ADR 0016).
- **Size never follows zoom**: box = f(effective detail, toggles, width). Below 90 % draw compact content inside the same box.
- **Stored column order**; no re-sorting.
- **Rows stay cheap**: plain elements, CSS hover, no Radix tooltip per row, one shared enum popover.
- **Deck card look only** (DB3): frame, lip, palette, states from `DeckNode`; tokens only, no hard-coded colours; Secondary for type text on tinted rows (§g-90).
- **Out of scope**: column anchors, crow's foot, relationship toggles (042); editing, drawer, dialect, lock (043); lint row problems (047); row limit, Show all, in-table search, per-view detail (048); R / W markers (049); enum card; PDF.
- Do not name other diagram or database tools anywhere.

**Approvals**: no new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for `deck-node.tsx`, `deck-to-flow.ts`, `canvas-geometry.ts`.
- **Schema / model**: `packages/schema/…`, `packages/model/…`; read their `CLAUDE.md`.
- **Commits**: `feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`. No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Confirm 040 is merged into `main` and rebase `041-db-table-card` on it; run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green baseline
- [x] T002 Add a `tables` option to `apps/app/src/bench/generate-deck.ts` (turn the first n nodes into `db-table` with 12 columns: 1 PK, 2 FK with edges carrying `fromColumns` / `toColumns` / `cardinality: "n-1"`, 1 enum column; one deck enum), with a test in `apps/app/src/bench/generate-deck.test.ts`; wire `tables` in `apps/app/src/routes/bench-page.tsx` and `BENCH_TABLES` in `apps/app/bench/perf.bench.ts`
- [x] T003 Run `BENCH_TABLES=150 pnpm bench` and a 150-card run with the same node and edge counts; save both summaries as `specs/041-db-table-card/bench-before.md` (tables draw as generic cards at this point)

---

## Phase 2: Foundational (format, model op, pure layout)

**Purpose**: the two file additions, the model op, and the pure layer every story uses. Blocks all stories.

### Format and model

- [x] T004 [P] Add invalid fixtures (`tableDisplay.detail: "auto"`, `tableDisplay.showTypes`, `hideNotes: "yes"`, enum `color: "purple-ish"`) to `packages/schema/test/fixtures.ts`; watch them fail
- [x] T005 Add `$defs/TableDisplay`, root `tableDisplay` (after `enums`) and `DbEnum.properties.color` (`$ref ColorRef`, after `note`) to `packages/schema/schema/v1.json` with descriptions; run `pnpm schema:generate`; extend `packages/schema/examples/full.sododeck.json` (a `tableDisplay` with `detail` and one hide flag; enums with a palette and a hex colour); `pnpm --filter @sododeck/schema test` green
- [x] T006 [P] Add model tests: round-trip cases in `packages/model/test/round-trip.test.ts` (every `tableDisplay` key; enum colours; decks without them byte-identical); `setTableDisplay` cases in `packages/model/test/db-schema.test.ts` (write, `false` removes a hide flag, `detail: null` removes it, empty object removed, one undo step; `updateEnum` with `color` and `null`); concurrency case in `packages/model/test/concurrency.test.ts` (two docs set `hideTypes` and `hideNotes`, both kept)
- [x] T007 Implement `meta.tableDisplay` (lazy `Y.Map`, per-key writes) in `packages/model/src/read.ts` / `write.ts` / `deck.ts`, `setTableDisplay` in `packages/model/src/ops/table-display.ts`, `tableDisplayOf(file)` reader, `color` in `updateEnum` (`packages/model/src/ops/db-enums.ts`); wire into `packages/model/src/editor.ts` and `index.ts`; T006 green

### Pure layer (apps/app)

- [x] T008 [P] Write `apps/app/src/editor/table-keys.test.ts`: FK set per table for `n-1`, `1-n`, `1-1`, `n-n` and no cardinality; composite ends; self-reference; ends on non-table cards ignored; `schemaCount` 0 / 1 / 2; cache returns the same object for the same `edges` / `nodes` identity
- [x] T009 [P] Write `apps/app/src/editor/table-layout.test.ts` with a fixed `measure`: heights for All / Keys / Names; Auto = All; `hideTypes` / `hideNullable` / `hideNotes` / `hideIndexes`; empty table (no hairline, rows, footer); note cut at 2 lines; key slot 16 vs 30; name and type cuts (type ≤ 58 %, cut before name); nullable rule (`!notNull && !pk`); enum chip with colour, neutral, and missing enum (type text); "+n columns" and "n columns"; footer "1 index" / "n indexes"; stored width used, stored height ignored; `compact` counts
- [x] T010 Implement `apps/app/src/editor/table-keys.ts` (`fkColumns(deck)`, `schemaCount(deck)`, `enumById(deck)`, cached by input identity) per data-model.md
- [x] T011 Implement `apps/app/src/editor/table-layout.ts` (`TABLE_CARD` constants from DESIGN.md "Database tokens", `tableLayout(input, width, measure)`, `effectiveDetail`), reusing `wrapText` and fonts from `card-layout.ts`; T008–T009 green
- [x] T012 Route `db-table` nodes in `apps/app/src/editor/canvas-geometry.ts` `cardLayoutOf` / `cardSize` / `sizeLimitsOf` to `tableLayout` (default width 240; height computed; stored height ignored); add cases to `apps/app/src/editor/canvas-geometry.test.ts` (same size at every level; changes with detail and toggles)

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` green; tables already get the right box size (drawn as generic cards).

---

## Phase 3: User Story 1 - See a table as a table (Priority: P1) 🎯 MVP

**Goal**: the "Shop" tables match frames 156 / 157 at 100 % in light and dark.

**Independent Test**: quickstart §2 step 1; `table-body.test.tsx`.

### Tests for User Story 1 (write first)

- [x] T013 [P] [US1] Write `apps/app/src/editor/table/table-body.test.tsx` from contracts/table-card-ui.md: list "Columns", rows by text ("id, uuid, primary key"…), glyph images "Primary key" / "Foreign key" / "Unique", PK + FK row with both, nullable "?", enum chip button "order_status values", "+n columns" image, footer "2 indexes", no list for an empty table
- [x] T014 [P] [US1] Add to `apps/app/src/editor/deck-node.test.tsx` (or its existing test file): a `db-table` card has `aria-roledescription="table"` and name "Table orders, 7 columns"; header text "Table" with one schema and "Table · public" with two; long title cut with the tooltip; non-table cards unchanged

### Implementation for User Story 1

- [x] T015 [US1] Build `data.table` (the `TableLayout`) for `db-table` nodes in `apps/app/src/editor/deck-to-flow.ts` `toFlowNode` from `table-keys` and `tableDisplayOf`, and add it to the node cache equality check
- [x] T016 [US1] Create `apps/app/src/editor/table/table-body.tsx`: hairline, rows (key slot with lucide `KeyRound` / `Link2` and the "U" square, name 500 / 600 for PK, Mono 11 type right-aligned, 7 px "?" slot), enum chip placeholder (static span until US2), "+n columns" pill, indexes footer with lucide `ListOrdered` (or the design's list icon); CSS row hover inset 4, radius 8, Surface 2; type text Secondary on tinted rows (§g-90); native `title` on cut rows
- [x] T017 [US1] In `apps/app/src/editor/deck-node.tsx` render `TableBody` instead of description / fields / tags when `isDbTable(node)`, use the table note (`description`, ≤ 2 lines), header type name from the layout, accessible name "Table <title>, <n> columns" and `aria-roledescription="table"`
- [x] T018 [US1] Run the app with `full.sododeck.json`, compare with frames 156 and 157 in both themes, fix spacing against DESIGN.md "Database tokens"; save screenshots under `specs/041-db-table-card/screens/` (light, dark)

**Checkpoint**: US1 complete; SC-001 checked by screenshot.

---

## Phase 4: User Story 3 - Choose how much detail tables show (Priority: P1)

**Goal**: deck detail (zoom island), per-table detail (menu, header toggle), compact System / Landscape content, one size at every zoom.

**Independent Test**: quickstart §2 steps 3–4; tests below.

### Tests for User Story 3 (write first)

- [x] T019 [P] [US3] Write `apps/app/src/editor/actions/table-detail-actions.test.ts`: submenu "Detail" with radios Use deck setting / Names / Keys / All on `db-table` targets only; selecting Keys on three selected tables is one undo step; Use deck setting removes `detail`
- [x] T020 [P] [US3] Write `apps/app/src/editor/shell/table-detail-control.test.tsx`: `radiogroup` "Table detail" with Auto / Names / Keys / All writes `tableDisplay.detail` (Auto removes it); hidden when the deck has no table; compact shell shows a button "Table detail: Auto" with a radio menu
- [x] T021 [P] [US3] Add to `apps/app/src/editor/deck-node.test.tsx`: at System level a table shows title, key dots (PK filled, FK hollow) and column count; at Landscape the icon plate; header toggle button "Detail: Use deck setting" cycles Keys → All → deck

### Implementation for User Story 3

- [x] T022 [US3] Create `apps/app/src/editor/actions/table-detail-actions.ts` (radio submenu, model: `shape-form-actions.ts`) and register it in `apps/app/src/editor/actions/index.ts`; writes `editor.update('nodes', id, { detail })` for each selected table inside one step
- [x] T023 [US3] Create `apps/app/src/editor/shell/table-detail-control.tsx` (`SegmentedControl`; compact: `DropdownMenu` like `level-indicator.tsx`) and place it in `apps/app/src/editor/shell/zoom-island.tsx` next to `LevelIndicator`, passing `compact` from `useCompactShell`
- [x] T024 [US3] In `apps/app/src/editor/deck-node.tsx` draw System (title, key dots, count) and Landscape (icon plate) content for tables inside the same box, and add the header detail toggle button in the badge slot (roving `tabIndex`, `nodrag nopan`, stop propagation like `card-fields-block.tsx`)
- [x] T025 [US3] Verify quickstart §2 steps 3–4 (size constant from 30 % to 200 %, top-left fixed on detail change, reload keeps the table's choice, ⌘Z restores)

**Checkpoint**: US1 + US3: readable at every zoom and density.

---

## Phase 5: User Story 2 - See an enum's values without leaving the table (Priority: P1)

**Goal**: hover or Enter on an enum chip shows the enum's values.

**Independent Test**: quickstart §2 step 2; `enum-popover.test.tsx`.

- [x] T026 [P] [US2] Write `apps/app/src/editor/table/enum-popover.test.tsx`: hovering the chip (after the rest delay) opens `dialog` "order_status" with values in order and notes ("pending — awaiting payment"); focus + Enter opens it; Escape closes and returns focus to the chip; "No values" for an empty enum; a missing enum draws type text and no button; only one popover open at a time
- [x] T027 [P] [US2] Add `enumPopover: { nodeId, columnId } | null` with open / close actions to `apps/app/src/state/ui-store.ts` and a test in `apps/app/src/state/ui-store.test.ts`
- [x] T028 [US2] Create `apps/app/src/editor/table/enum-chip.tsx` (button "<enum> values", enum colour via the tag chip look, neutral when no colour; hover timing from `editor/hover-focus/use-hover-focus.ts`) and replace the placeholder in `table-body.tsx`
- [x] T029 [US2] Create `apps/app/src/editor/table/enum-popover.tsx` (one `Popover` from `packages/ui` anchored to the open chip, mounted lazily once in the canvas layer) and mount it in `apps/app/src/editor/canvas.tsx`; T026 green

**Checkpoint**: US2 complete; SC-007 (keyboard) checked.

---

## Phase 6: User Story 4 - Turn table parts on and off for the deck (Priority: P2)

**Goal**: four switches in Deck settings › Database.

**Independent Test**: quickstart §2 step 5; inspector test.

- [x] T030 [P] [US4] Add to `apps/app/src/editor/inspector/deck-inspector.test.tsx`: a "Database" section with "Show on tables" and switches "Data types", "Nullable marker", "Notes", "Index footer", all checked by default; turning one off writes the matching `hide*` flag in one undo step; the section is absent in a deck with no table and the Database pack off
- [x] T031 [US4] Add the `PanelSection label="Database"` with four `Switch`es to `apps/app/src/editor/inspector/deck-inspector.tsx` (after Summary, before Storage), writing `editor.setTableDisplay` inside `oneStep`
- [x] T032 [US4] Verify toggles re-layout every table (T009 covers heights) and the JSON panel shows `tableDisplay` (quickstart §2 step 5)

---

## Phase 7: User Story 5 - Export a schema as an image (Priority: P2)

**Goal**: PNG and SVG draw table cards as on the canvas.

**Independent Test**: quickstart §2 step 6; scene and SVG tests.

- [x] T033 [P] [US5] Add to `apps/app/src/editor/export/scene.test.ts`: a `db-table` `SceneCard` carries `table` equal to `tableLayout` for the same deck display and per-table detail; toggles and detail apply; and to `apps/app/src/editor/export/render-svg.test.ts`: rows are `<text>` with names and types, glyph paths present, enum chip rect + text, "+n columns" pill, footer, no `<foreignObject>`; keep `scene.perf.test.ts` within budget with 150 tables
- [x] T034 [US5] Add `table?: TableLayout` to `SceneCard` in `apps/app/src/editor/export/scene.ts` (built with `table-keys` and `tableDisplayOf`)
- [x] T035 [US5] Add `tableBody()` to `apps/app/src/editor/export/render-svg.ts` (hairline, rows, lucide glyph paths, Mono 11 font in `FONTS`, enum chip colours from `export-palette.ts`, pill, footer) and call it from `card()` for table cards; T033 green; compare an exported SVG and PNG with the canvas

---

## Phase 8: Polish and cross-cutting

- [x] T036 Run `BENCH_TABLES=150 pnpm bench` and the 150-card run again; save `specs/041-db-table-card/bench-after.md`; table frame time within 10 % of cards (SC-004); if not, profile and fix before continuing
- [x] T037 [P] Contrast check (SC-006): verify every row text / fill pair in both themes against DESIGN.md "Contrast" with the §g-90 fix; record in `specs/041-db-table-card/quickstart-results.md`
- [x] T038 [P] Docs: amend `docs/decisions/0029-database-pack-model.md` (or add ADR 0030 "Table card") with `tableDisplay`, enum colour, size-follows-detail rule and the shared layout; update DESIGN.md "Table zoom levels" with the size rule; add a §g note in `docs/design/design-analysis.md` for frame 162's height-per-level caption (decision: size follows detail, not zoom); update `apps/app/CLAUDE.md` map (table-layout, table-keys, table/), `packages/schema/CLAUDE.md` and `packages/model/CLAUDE.md` (041 entries)
- [x] T039 [P] Update `docs/backlog-database.md` 041 status (built, spec path) and note in 048 that the row limit plugs into `tableLayout`
- [x] T040 Run the definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; no `.only` / `.skip`; grep the diff for other tool names
- [x] T041 Final report in `quickstart-results.md` and the PR description: what changed, screenshots (light / dark), bench before / after, what was skipped or uncertain, next step (042)

---

## Dependencies and order

- **040 merged → Phase 1 → Phase 2 → stories → Phase 8.**
- Phase 2: T004 → T005; T006 → T007 (needs T005); T008 / T009 → T010 → T011 → T012 (T011 needs T007's `tableDisplayOf`).
- **US1** needs Phase 2. **US3** needs US1's `TableBody` and `deck-node.tsx` changes (T016, T017). **US2** needs T016 (chip placeholder). **US4** needs Phase 2 only (layout reacts to toggles) but is checked on US1's cards. **US5** needs Phase 2 (layout) and is best after US1 (visual comparison).
- **Priorities**: P1 = US1, US3, US2; P2 = US4, US5.

## Parallel examples

- Phase 2: T004, T006, T008, T009 together; then T005 → T007 and T010 → T011 by two agents.
- After US1: US3 (T019–T025), US2 (T026–T029), US4 (T030–T032) and US5 (T033–T035) touch different files except `deck-node.tsx` (US3 only) and `table-body.tsx` (US2 only); four agents can run them in parallel.
- Polish: T037, T038, T039 together.

## Implementation strategy

1. **MVP = Phases 1–3 (US1)**: tables read as tables at 100 %. Commits: `feat(schema): table display and enum colour (041)`, `feat(model): table display op (041)`, `feat(app): table layout and table card body (041)`.
2. **+ US3** (detail and zoom), **+ US2** (enum popover): the readable-at-any-density goal.
3. **+ US4, US5**: toggles and export.
4. **Polish**: bench, contrast, ADR and docs, DoD, report. One PR, small commits.
