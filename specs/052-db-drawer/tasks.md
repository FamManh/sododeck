# Tasks: Database Details Drawer (052)

**Inputs**:

- [plan.md](plan.md) and [spec.md](spec.md). Clarify answers (2026-10-04):
  - A dialect change shows a confirm dialog with the conversions, then an Undo toast; no dialog when nothing converts.
  - Renaming an enum rewrites the type text of linked columns in the same step.
  - Types outside the dialect's list are allowed and only marked in the drawer.
  - "Block SQL export with errors" counts only errors on tables in the export scope.
  - Deleting a used enum unlinks the columns and keeps their type text.
- Planning corrections (research R3, R4, R7, R9): a column row's new "Edit details" opens the drawer and 043's "Edit" keeps the line editor; text fields save while typing (one undo step per focus) and name fields use `validate`; renaming an enum value renames matching defaults; every `db-*` problem counts as an error until 047 adds severity.
- [research.md](research.md) (R1–R12), [data-model.md](data-model.md).
- [contracts/dialect-data.md](contracts/dialect-data.md) and [contracts/drawer-ui.md](contracts/drawer-ui.md).
- [quickstart.md](quickstart.md). Design frames in `docs/design/screens/`: 164 (table tabs, relationship drawer), 165 (enum editor), 135 (working screen with type picker), 136 (relationship selected), 151–154 (Deck settings, Database section, dialect confirm, after conversion).

**Tests**: required (constitution VI). Write each story's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Organization**: one phase per user story, in spec priority order (US1–US3 are P1, US4–US5 P2, US6 P3). All stories build on Phase 2 (routing, data, helpers) and are otherwise independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- App: `apps/app/src/` (editor in `apps/app/src/editor/`, inspectors in `apps/app/src/editor/inspector/`, UI store `apps/app/src/state/ui-store.ts`, pure DB code in `apps/app/src/db/`)
- Model: `packages/model/src/`, tests in `packages/model/test/`
- Schema: `packages/schema/schema/v1.json`, tests in `packages/schema/test/`

---

## Phase 1: Setup

- [ ] T001 Create branch `052-db-drawer` from `main`. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green baseline. Commit the spec folder `specs/052-db-drawer/` as `docs: database drawer spec, plan and tasks (052)`.

---

## Phase 2: Foundational (format, model, pure layer, drawer routing)

**Purpose**: the `blockSqlExport` field, dialect data and conversion, enum edit helpers, `useLiveField` validation, and the drawer routing every story opens through.

### Format and model

- [x] T002 [P] Add parity fixtures to `packages/schema/test/fixtures.ts`: valid deck with `blockSqlExport: true`; invalid `blockSqlExport: false` and `blockSqlExport: "yes"`. Watch the invalid ones fail to be refused.
- [x] T003 Add root `blockSqlExport` (`const: true`, description "Database pack (052): SQL export is refused while the export scope has database errors. Absent means off.") after `dialect` in `packages/schema/schema/v1.json`. Run `pnpm schema:generate`. Add `"blockSqlExport": true` to `packages/schema/examples/full.sododeck.json`. `pnpm --filter @sododeck/schema test` is green.
- [x] T004 [P] Write model tests: `packages/model/test/round-trip.test.ts` (a deck with `blockSqlExport` round-trips; a deck without it is unchanged after an unrelated edit) and a new `packages/model/test/block-sql-export.test.ts` (`setBlockSqlExport(true)` writes `true`, `false` removes the key, each one undo step, `readDeck` returns it).
- [x] T005 Implement `setBlockSqlExport(ctx, on)` next to `setDialect` in `packages/model/src/ops/db-enums.ts` (meta map, `true` or delete), read it in `packages/model/src/read.ts` (next to `dialect`), load it in `packages/model/src/deck.ts`, accept it in `validateObject('meta')` in `packages/model/src/validate.ts`, expose `DeckEditor.setBlockSqlExport` in `packages/model/src/editor.ts` with a doc comment, export from `index.ts`. T004 is green.

### Pure layer

- [x] T006 [P] Write `apps/app/src/db/dialect-types.test.ts` per contracts/dialect-data.md: every `COMMON_TYPES` spelling (base without fixed size) is in its dialect's `DIALECT_TYPES`; Generic has the 17 canonical names; `typeEntry('postgres', 'TIMESTAMPTZ')` and alias `int4` resolve; `typeEntry('mysql', 'citext')` is `undefined`; `size` kinds (`varchar` length, `numeric` precision, `int` none); `INDEX_METHODS.sqlite` is empty; every dialect has a hint.
- [x] T007 [P] Implement `apps/app/src/db/dialect-types.ts` (`TypeKind`, `SizeKind`, `TypeEntry`, `DIALECT_TYPES`, `INDEX_METHODS`, `DIALECT_HINTS`, `typeEntry`) per research R5, deriving the SQL lists from `db/export/common-types.ts` `COMMON_TYPES` plus the dialect-only extras. T006 is green.
- [x] T008 [P] Write `apps/app/src/db/dialect-change.test.ts`: the contract's Shop example table (Postgres → MySQL); enum-linked columns skipped; `tsvector` in `kept`; `serial` → `int` with `increment: true`; `varchar(80)` keeps its size where `keepsSize` allows and `sizeDropped` is set to SQLite; `from === to` gives an empty plan; Generic ↔ each SQL dialect; `changeGroups` counts; labels schema-qualified only when the deck has several schemas; a generated 150-table × 12-column deck plans in < 50 ms.
- [x] T009 Implement `apps/app/src/db/dialect-change.ts` (`ColumnChange`, `KeptColumn`, `DialectPlan`, `planDialectChange`, `changeGroups`) reusing `db/import/convert-types.ts` `convertType` and `db/export/common-types.ts` `translateType` per research R6. T008 is green.
- [x] T010 [P] Write `apps/app/src/db/enum-edits.test.ts` with a real `DeckEditor` on the Shop fixture: `renameEnum` sets every linked column's `type` (and only those), one `undo()` restores both; `renameEnumValue` renames defaults equal to the old value on linked columns only, one undo; `nextEnumName` gives `enum_1`, then the first free number; `createEnum` returns the new id.
- [x] T011 Implement `apps/app/src/db/enum-edits.ts` (`renameEnum`, `renameEnumValue`, `nextEnumName`, `createEnum(editor, deck, { linkColumn? })`) as `editor.batch` helpers per research R7 (editor and snapshot in, no React). T010 is green.
- [x] T012 [P] Extend `apps/app/src/editor/fields/use-live-field.test.tsx` (create it if missing): with `validate`, an invalid draft writes nothing, `error` is the message, blur reverts to the value from before focus, a valid draft writes as before; without `validate` nothing changes.
- [x] T013 Add the optional `validate?: (text: string) => string | undefined` to `LiveFieldOptions` in `apps/app/src/editor/fields/use-live-field.ts` (research R3), keeping `required`. T012 is green.

### Drawer routing

- [ ] T014 [P] Write `apps/app/src/state/ui-store.test.ts` cases: `openTableDrawer(id, { tab, columnId })` selects the table, sets `tableDrawer` and opens the drawer; `openEnumDrawer(id)` sets `drawer.mode = 'enum'`; changing the selection resets `tableDrawer` to General; the enum drawer closes when `hasDetailsTarget` finds the enum gone; `dialectConfirm` set / clear.
- [ ] T015 Implement in `apps/app/src/state/ui-store.ts`: `DrawerState` `'enum'` mode with `enumId`, `tableDrawer`, `dialectConfirm`, `openTableDrawer`, `openEnumDrawer`, `setTableDrawerTab`, `expandColumn`, and the `hasDetailsTarget` rule for `enum` (contracts/drawer-ui.md). T014 is green.
- [ ] T016 [P] Write `apps/app/src/editor/inspector/table/drawer-tabs.test.tsx`: `tablist` with four tabs, ← → Home End move and select, the panel is labelled by its tab, a tab change is announced.
- [ ] T017 [P] Implement `apps/app/src/editor/inspector/table/drawer-tabs.tsx` (ARIA tablist, frame 164 segmented look, tokens only). T016 is green.
- [ ] T018 Route the drawer: in `apps/app/src/editor/inspector.tsx` add a single `db-table` node branch → `TableInspector` and a single relationship edge branch (`isRelationship` from `editor/relationships/relationship-ends.ts`) → `RelationshipInspector`, before the generic node / edge branches; in `apps/app/src/editor/shell/detail-drawer.tsx` render `EnumInspector` for `mode === 'enum'`. Create placeholder components `table/table-inspector.tsx` (header: kind tile, title, "Table · n columns · n indexes", More, Close; tabs; empty panels), `relationship/relationship-inspector.tsx` and `enum/enum-inspector.tsx` (headers only) so later stories fill them. Update `apps/app/src/editor/inspector.test.tsx` (or the closest existing test) for the routing.

**Checkpoint**: format, data, helpers and routing are in place; a table opens a tabbed drawer.

---

## Phase 3: User Story 1 - Edit every column setting in the Columns tab (Priority: P1) 🎯 MVP

**Goal**: every column field is editable from the drawer, with the dialect type picker and enum picker.

**Independent Test**: on Shop, change one column's type, size, precision, default, check and note from the Columns tab; the card and JSON panel show each change and six ⌘Z restore the column.

### Tests for User Story 1

- [ ] T019 [P] [US1] Write `apps/app/src/editor/inspector/table/type-picker.test.tsx`: enums listed first under "Enums in this deck", then the dialect's groups; typing filters; a free type (`citext`) is accepted and shown with "Not in the Postgres list"; picking a list type writes `type` and clears `enumRef`; picking an enum writes `enumRef` and `type: enum.name`; "No enum" clears `enumRef` only; "New enum…" calls `createEnum` with `linkColumn` and opens the enum drawer; "Edit enum" opens it.
- [ ] T020 [P] [US1] Write `apps/app/src/editor/inspector/table/columns-tab.test.tsx`: rows show grip, key / link glyph, name, type, NN badge; filter narrows rows; "+ Column" adds `column_n` (043's `newColumnData`) expanded with its name focused; expand shows name, type, size fields by `TypeEntry.size` (one for length, two for precision writing `'10,2'`), primary key, not null, unique, auto-increment switches (`true` / removed), default Value / Expression (writes `default` or `defaultExpr`, clears the other), check, note; a duplicate name shows "${name} is already a column of ${table}" and writes nothing; ⌥↑ / ⌥↓ and drag move with one `moveColumn`; delete uses 043's toast; each change is one `undo()`.
- [ ] T021 [P] [US1] Extend `apps/app/src/editor/actions/table-actions.test.ts`: the row menu has "Edit details" (`row.details`) that calls `openTableDrawer(tableId, { tab: 'columns', columnId })`; `row.edit` still opens the line editor; ⏎ on a selected table opens General.

### Implementation for User Story 1

- [ ] T022 [US1] Implement `apps/app/src/editor/inspector/table/type-picker.tsx` on `packages/ui` `Combobox` (`mode: 'free'`, group headings) using `DIALECT_TYPES`, `typeEntry` and `db/enum-edits.ts` `createEnum`. T019 is green.
- [ ] T023 [US1] Implement `apps/app/src/editor/inspector/table/column-fields.tsx` (expanded fields; names through `useLiveField` with `validate`, switches via `oneStep` + `editor.updateColumn`, size / scale fields, default kind `SegmentedControl`).
- [ ] T024 [US1] Implement `apps/app/src/editor/inspector/table/column-row.tsx` and `columns-tab.tsx` (filter, "+ Column", rows with expand on ⏎ / Space, reorder with `use-sortable-list.ts` and ⌥↑ / ⌥↓, ⌫ on the row via 043's `deleteColumn`, `tableDrawer.expandedColumnId` / `focusColumnId`), and mount the tab in `table-inspector.tsx`. T020 is green.
- [ ] T025 [US1] Add `row.details` "Edit details" to the row menu in `apps/app/src/editor/actions/table-actions.ts` and make "Open details" (`details.open`, `actions/title-actions.ts`) and ⏎ on a table call `openTableDrawer(id, { tab: 'general' })` for `db-table` nodes. T021 is green.

**Checkpoint**: the Columns tab edits every column field; US1 is demoable.

---

## Phase 4: User Story 2 - Edit a relationship, including composite ends (Priority: P1)

**Goal**: all relationship settings, including composite column pairs, are editable in the drawer.

**Independent Test**: turn a single-column relationship into a composite one with two pairs and name it; the JSON panel shows both lists and the label, one ⌘Z per change.

### Tests for User Story 2

- [ ] T026 [P] [US2] Write `apps/app/src/editor/inspector/relationship/relationship-inspector.test.tsx`: header "from.col → to.col" and cardinality subline; From / To pair selects list each table's columns; add, remove and reorder pairs write both lists in one `update('edges', …)`; unequal lengths show "From has 2 columns, To has 1"; removing the last pair opens the confirm and Confirm deletes via `requestDelete`; cardinality choice writes `cardinality` and shows the n–n hint "SQL export writes a junction table"; optional switches write `true` / remove; On delete and On update selects include "Not set" (removes the key) and the five `DbAction`s; name writes `label`; line type uses `applyLineType`; colour uses `setEdgeStyle`; a pair with differing types shows the (!) from `typeMismatch`; a self-reference lists one table on both sides.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Implement `apps/app/src/editor/inspector/relationship/column-pairs.tsx` (pair rows, add / remove / reorder, mismatch icon, length warning, last-pair confirm via `fields/confirm-dialog.tsx`).
- [ ] T028 [P] [US2] Implement `apps/app/src/editor/inspector/relationship/cardinality-choice.tsx` (four buttons drawn with 042's crow marks from `edge-end-marks.ts`, `role="radiogroup"`, n–n hint).
- [ ] T029 [US2] Fill `apps/app/src/editor/inspector/relationship/relationship-inspector.tsx`: From / To, cardinality, optional sides, Referential actions (reuse `ON_DELETE` from `actions/relationship-actions.ts`, add `onUpdate`), Name · Line · Colour (frame 164 bottom). T026 is green.

**Checkpoint**: relationships are fully editable.

---

## Phase 5: User Story 3 - Change the deck's dialect with conversion and Undo (Priority: P1)

**Goal**: Deck settings › Database changes the dialect with a confirm listing conversions and an Undo toast.

**Independent Test**: switch Shop from Postgres to MySQL; the dialog lists every changed column, cards show the new types, one Undo restores types and dialect.

### Tests for User Story 3

- [ ] T030 [P] [US3] Write `apps/app/src/editor/inspector/database/apply-dialect-change.test.ts`: `applyDialectChange` writes `setDialect` and every change in one batch, one `undo()` restores dialect and types; returns "Converted n columns to MySQL · Undo" or "Dialect set to MySQL · Undo".
- [ ] T031 [P] [US3] Write `apps/app/src/editor/inspector/database/database-section.test.tsx`: the section shows the dialect select with the four hints, the existing table and relationship switches (from 041 / 042), the block switch and the enums list; picking a dialect with changes opens the confirm with the first 5 rows, "+ n more" groups and "Kept as written"; Cancel changes nothing; Confirm applies and shows the toast; picking a dialect with no changes applies at once; the section shows when the deck has a table or the Database pack is on (as today).

### Implementation for User Story 3

- [ ] T032 [P] [US3] Implement `apps/app/src/editor/inspector/database/apply-dialect-change.ts` (one `editor.batch`, toast text). T030 is green.
- [ ] T033 [P] [US3] Implement `apps/app/src/editor/inspector/database/dialect-confirm-dialog.tsx` on `fields/confirm-dialog.tsx` (title "Convert n columns from Postgres to MySQL?", rows, "+ n more" from `changeGroups`, kept list, confirm label "Convert n columns"), driven by `ui.dialectConfirm`.
- [ ] T034 [US3] Implement `apps/app/src/editor/inspector/database/dialect-select.tsx` (`packages/ui` `Select` with hint per option; plans with `planDialectChange`, opens the confirm or applies) and `database-section.tsx` (label "Database", dialect select, help line "One dialect for every table and database card in this deck.", the switches moved from `table-display-section.tsx`, a placeholder for the enums list and the block switch). Replace `TableDisplaySection` with `DatabaseSection` in `apps/app/src/editor/inspector/deck-inspector.tsx`; delete `table-display-section.tsx` and move its tests. Show the toast with `useUndoToast` and announce the conversion. T031 is green.

**Checkpoint**: all P1 stories work.

---

## Phase 6: User Story 4 - Create and edit enums (Priority: P2)

**Goal**: enums are created from the Add flyout, the canvas menu, the type picker and Deck settings, and edited in the enum drawer.

**Independent Test**: "Add enum", add three values, link to a column, reorder; the chip popover matches and "used by" names the column.

### Tests for User Story 4

- [ ] T035 [P] [US4] Write `apps/app/src/editor/inspector/enum/enum-inspector.test.tsx`: header "Enum · n values"; name (validated unique per schema, rename goes through `renameEnum`), schema, colour, note; values add ("+ Value" → `value_n` focused), rename through `renameEnumValue` (duplicate refused), note, drag / ⌥↑ ⌥↓ reorder (`moveEnumValue`), delete (`removeEnumValue`); "Used by" lists `table.column` chips and a click calls `openTableDrawer(tableId, { tab: 'columns', columnId })`; Delete enum with users confirms "Delete x? n columns use it and keep x as plain type text." and removes it with the Undo toast; without users it deletes with the toast only.
- [ ] T036 [P] [US4] Write tests for the entry points: `apps/app/src/editor/palette.test.tsx` (Database tab shows an Enum tile; click creates `enum_1` and opens the enum drawer with the name selected; dragging does nothing), `apps/app/src/editor/actions/canvas-actions.test.ts` (`canvas.addEnum` "Add enum" shown only with the Database pack on), `apps/app/src/editor/table/enum-popover.test.tsx` ("Edit enum" opens the drawer), `database/enum-list.test.tsx` (rows open the editor, "Add enum" creates one).

### Implementation for User Story 4

- [ ] T037 [P] [US4] Implement `apps/app/src/editor/inspector/enum/enum-values.tsx` (frame 165 rows: grip, value chip, note, ⋯ menu; "+ Value") and `enum-used-by.tsx`.
- [ ] T038 [US4] Fill `apps/app/src/editor/inspector/enum/enum-inspector.tsx` (fields, values, used by, More › Delete enum with confirm). T035 is green.
- [ ] T039 [US4] Add the `'enum'` tool to `PackTool` and the Database pack tools in `packages/model/src/card-types.ts`; add the Enum tile to `apps/app/src/editor/palette.tsx` (`DATABASE_TOOL_NAMES`, no drag payload); add `canvas.addEnum` to `apps/app/src/editor/actions/canvas-actions.ts`; add "Edit enum" to `apps/app/src/editor/table/enum-popover.tsx`; implement `apps/app/src/editor/inspector/database/enum-list.tsx` and mount it in `database-section.tsx`. Update the Packs description in `packages/model/src/card-types.ts` to "Table, enum, note, table group" and its test. T036 is green.

**Checkpoint**: enums can be created and edited without a file.

---

## Phase 7: User Story 5 - Edit a table's general settings, indexes and checks (Priority: P2)

**Goal**: General, Indexes and Checks tabs edit every remaining table field.

**Independent Test**: add a composite unique index with a method and a named check from the drawer; SQL export shows both.

### Tests for User Story 5

- [ ] T040 [P] [US5] Write `apps/app/src/editor/inspector/table/general-tab.test.tsx`: name (`title`) and schema with the "A table named x already exists in y" check (same name in another schema is fine); Detail select; colour swatches; note (`description`); owner, tags, links fields; each one undo step.
- [ ] T041 [P] [US5] Write `apps/app/src/editor/inspector/table/indexes-tab.test.tsx`: "+ Index" adds an unnamed index; column chips add ("+ Column" menu of the table's columns), remove and reorder; "+ Expression" adds an `{ expr }` chip; unique switch; method select from `INDEX_METHODS[dialect]` and hidden on SQLite while a stored method stays; name and note; delete from ⋯; each one undo step.
- [ ] T042 [P] [US5] Write `apps/app/src/editor/inspector/table/checks-tab.test.tsx`: "+ Check" adds one; name and expression fields; delete; each one undo step.

### Implementation for User Story 5

- [ ] T043 [P] [US5] Implement `apps/app/src/editor/inspector/table/general-tab.tsx` reusing `fields/` owner, tags (`tags/card-tags-field.tsx`), links, the 020 swatch grid and 041's detail action. T040 is green.
- [ ] T044 [P] [US5] Implement `apps/app/src/editor/inspector/table/index-parts.tsx` and `indexes-tab.tsx` (frame 164 right). T041 is green.
- [ ] T045 [P] [US5] Implement `apps/app/src/editor/inspector/table/checks-tab.tsx` (frame 164 bottom left). T042 is green.
- [ ] T046 [US5] Mount General, Indexes and Checks in `apps/app/src/editor/inspector/table/table-inspector.tsx`.

**Checkpoint**: every table field is editable in the drawer.

---

## Phase 8: User Story 6 - Block SQL export while the schema has errors (Priority: P3)

**Goal**: the deck switch blocks SQL Copy and Download while the export scope has database errors.

**Independent Test**: make a dangling reference, turn the switch on, open SQL export: Copy and Download are disabled; fix it and they are enabled.

### Tests for User Story 6

- [ ] T047 [P] [US6] Extend `apps/app/src/editor/export/export-dialog.test.tsx`: with `blockSqlExport` and an in-scope `db-*` problem, SQL Copy and Download are disabled and the banner reads "n errors in <scope> · fix them to export SQL"; with only an out-of-scope problem, or with DBML / Mermaid / dictionary chosen, or with the flag off, they are enabled.
- [ ] T048 [P] [US6] Extend `apps/app/src/editor/inspector/database/database-section.test.tsx`: the switch "Block SQL export with errors" with help "DBML, Mermaid and JSON still export" calls `setBlockSqlExport` and is one undo step.

### Implementation for User Story 6

- [ ] T049 [US6] Add `sqlBlocked` in `apps/app/src/editor/export/export-dialog.tsx` (disable Copy and Download with `aria-describedby` on the banner) and the blocked banner text in `apps/app/src/editor/export/schema-export-panel.tsx`; note in `schema-problems.ts` that all `db-*` kinds count as errors until 047 (`TODO(047): filter by severity`). T047 is green.
- [ ] T050 [US6] Add the block switch to `apps/app/src/editor/inspector/database/database-section.tsx`. T048 is green.

**Checkpoint**: all stories work.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T051 [P] Locked tables: in `table-inspector.tsx` disable every control when `isNodeLocked` (`editor/lock.ts`), show "Locked · unlock to edit" with an Unlock button (`toggleLock`); add a case to `table-inspector.test.tsx`.
- [ ] T052 [P] Removed objects: the drawer closes and returns focus to the canvas when its table, relationship or enum is removed (undo, another tab); add cases to `inspector.test.tsx` and `enum-inspector.test.tsx`.
- [ ] T053 [P] Accessibility pass: every field labelled, tab and conversion announcements through `announcer.tsx`, keyboard reorder announced; run the axe check used by existing component tests where present.
- [ ] T054 Compare against frames 135, 136, 151–154, 164, 165 in light and dark at 100 %; fix spacing and tokens; capture screenshots for the report.
- [ ] T055 [P] Docs: amend `docs/decisions/0029-database-pack-model.md` ("Block SQL export" and "Enum rename rules"); update `apps/app/CLAUDE.md` (052 paragraph: drawer routing, `tableDrawer`, `enum` mode, `db/dialect-types.ts`, `db/dialect-change.ts`, `db/enum-edits.ts`, `useLiveField` `validate`), `packages/schema/CLAUDE.md` and `packages/model/CLAUDE.md` (`blockSqlExport`, `setBlockSqlExport`); mark 052 in `docs/backlog-database.md`.
- [ ] T056 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass; no skipped or `.only` tests; walk through `quickstart.md`; final report (what changed, skipped, uncertain).

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → stories.** Within Phase 2: T002 → T003; T004 → T005 (after T003); T006 → T007; T008 → T009 (after T007); T010 → T011; T012 → T013; T014 → T015; T016 → T017; T018 after T015 and T017.
- **Stories** (after Phase 2), each independent of the others:
  - US1 (T019–T025) needs T007, T011, T013.
  - US2 (T026–T029) needs T013.
  - US3 (T030–T034) needs T009.
  - US4 (T035–T039) needs T011, T013. Its Deck settings enum list (T039) needs US3's `database-section.tsx` (T034); if US3 is not done, mount `enum-list.tsx` in `deck-inspector.tsx` instead.
  - US5 (T040–T046) needs T007, T013.
  - US6 (T047–T050) needs T005; T050 needs T034.
- **Polish** after the stories it touches.

## Parallel Examples

- Phase 2: T002, T004, T006, T008, T010, T012, T014, T016 (all tests in different files) together; then T007, T011, T013, T017 together.
- US1: T019, T020, T021 together; then T022 and T023.
- US2: T027 and T028 together, then T029.
- US3: T032 and T033 together, then T034.
- US5: T043, T044, T045 together.

## Implementation Strategy

1. **MVP**: Phases 1–3 (format, data, routing, Columns tab). Stop and validate US1 with the quickstart steps 1–5.
2. **P1 complete**: add US2 (relationships) and US3 (dialect). Validate steps 8 and 11.
3. **P2**: US4 (enums) and US5 (General, Indexes, Checks).
4. **P3**: US6 (block SQL export), then Polish.

Commit after each task or logical group, Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `test(app): …`, `docs: …`), no AI attribution lines.
