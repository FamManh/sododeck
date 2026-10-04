# Tasks: Schema Editing on the Canvas (043)

**Inputs**:

- [plan.md](plan.md) and [spec.md](spec.md). Clarify answers (2026-10-04):
  - 043 is the canvas half of the backlog item.
  - `locked` is for any card.
  - The line never creates relationships.
  - Row editing shows All for the session only.
  - A type change never changes other columns; the (!) icon shows the mismatch.
  - A locked card is never deleted.
  - A new `pk` column stays where it was typed.
- Planning corrections: ⏎ on a table still opens details, and ↓ enters rows. On a table, C adds a column and R connects. On a row, R starts a relationship instead of 042's C.
- [research.md](research.md) (R1–R17), [data-model.md](data-model.md).
- [contracts/column-line.md](contracts/column-line.md) and [contracts/editing-ui.md](contracts/editing-ui.md).
- [quickstart.md](quickstart.md). Design frames in `docs/design/screens/`: 160 (authoring), 149 (context menus), 136 (relationship selected), 168 (Add flyout), 161 (states: editing, locked), 134 (empty schema deck).

**Tests**: required (constitution VI). Write each story's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Organization**: one phase per user story, in spec priority order. US1 and US2 share the line editor, so US2 builds on US1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- App: `apps/app/src/` (editor in `apps/app/src/editor/`, UI store `apps/app/src/state/ui-store.ts`)
- Model: `packages/model/src/`, tests in `packages/model/test/`
- Schema: `packages/schema/schema/v1.json`, tests in `packages/schema/test/`

---

## Phase 1: Setup

- [x] T001 Create branch `043-db-editing` from `main`. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green baseline.
- [x] T002 Run `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` before any change. Save the summary as `specs/043-db-editing/bench-before.md`.

---

## Phase 2: Foundational (format, model, pure helpers)

**Purpose**: `Node.locked`, the paste changes, the column-line module and the shared pure helpers. Every story depends on this phase.

### Format and model

- [x] T003 [P] Add parity fixtures to `packages/schema/test/fixtures.ts`:
  - valid: `locked: true` on a card, a shape and a `db-table`
  - invalid: `locked: false` and `locked: "yes"`

  Watch the invalid ones fail to be refused.

- [x] T004 Add `locked` (`const: true`, with a description) to Node in `packages/schema/schema/v1.json`, after `detail`. Run `pnpm schema:generate`. Add `"locked": true` to one node in `packages/schema/examples/full.sododeck.json`. `pnpm --filter @sododeck/schema test` is green.
- [x] T005 [P] Write model tests:
  - `packages/model/test/round-trip.test.ts`: a locked card, shape and table round-trip; a deck without `locked` stays byte-identical after an unrelated edit.
  - `packages/model/test/node-lock.test.ts`: `setLocked(ids, true)` writes `true`; `false` removes the key; unknown ids are ignored; it is one undo step.
- [x] T006 Implement `setLocked` in the new `packages/model/src/ops/node-lock.ts`. Wire it into `packages/model/src/editor.ts` (interface, with a doc comment) and `index.ts`. T005 is green.
- [x] T007 [P] Write paste tests in `packages/model/test/paste.test.ts`, per research R10:
  - `toFragment(…, { keepOutgoing: true })` puts relationships from a copied table to an outside table in `external`, and the enums the copied columns reference in `enums`.
  - Paste into the same deck keeps the external edges, remapped on the from side.
  - Paste into a deck without the target drops them and returns `droppedRelationships`.
  - Incoming relationships are never copied.
  - A self-reference is remapped to the copy.
  - Two copied tables are linked to each other.
  - An enum is linked by name (case-insensitive, same schema), or copied with new enum and value ids.
  - Taken `db-table` names become `_copy`, then `_copy_2`; non-table titles are unchanged.
  - 20 tables share 0 ids with the originals.
  - An old fragment without `external` / `enums` pastes as before.
  - The whole paste is one undo step.
- [x] T008 Implement the paste changes in `packages/model/src/fragment.ts` (`keepOutgoing`, `external`, `enums`, parse and validation of the new optional keys) and `packages/model/src/ops/paste.ts` (keep or drop external edges, link or copy enums, `copyName`, `droppedRelationships` in the result). Update the header comments. T007 is green.

### Pure layer (apps/app)

- [x] T009 [P] Write `apps/app/src/db/column-line.test.ts`:
  - every row of the examples table in contracts/column-line.md
  - quoted names; `numeric(10,2)` → size `'10,2'`; an invalid size goes to ignored
  - last-wins for `null` / `not null`; `default` alone gives a hint
  - `default` value kinds (string, number, boolean) vs expression (`now()`, `current_timestamp`)
  - schema-qualified enum match; `ref …` ignored
  - `parse(format(c))` holds for every column of `apps/app/src/db/fixtures/shop.ts` and `export-edge-cases.ts`
  - `columnLinePatch` writes `null` for removed parts and switches between `default` and `defaultExpr`, and never touches `note`, `check` or `id`
  - `lineError` returns `empty` / `taken` (case-insensitive, edited column excluded)
  - a 200-character line parses in < 1 ms
- [x] T010 Implement `apps/app/src/db/column-line.ts` (`parseColumnLine`, `formatColumnLine`, `columnLinePatch`, `lineError`, token ranges) per contracts/column-line.md. Reuse the `type(size)` split from `db/export/common-types.ts`. T009 is green.
- [x] T011 [P] Add tests:
  - `apps/app/src/editor/table-keys.test.ts`: `mismatchedColumns(deck)` gives both rows of a mismatched pair the message "int → uuid · orders.customer_id"; composite pairs are compared by position; matching types and enum-to-same-enum give no entry; the result is cached by `edges` and `nodes` identity.
  - `apps/app/src/editor/canvas-actions.test.ts`: `nextTableName` (first free `table_n`).
- [x] T012 Implement `mismatchedColumns` in `apps/app/src/editor/table-keys.ts` using 042's `typeMismatch` (`relationships/type-mismatch.ts`), and `nextTableName` in `apps/app/src/editor/canvas-actions.ts`. T011 is green.
- [x] T013 Extend `apps/app/src/state/ui-store.ts` per contracts/editing-ui.md:
  - `columnEdit` with `startColumnEdit` / `endColumnEdit`
  - `rowDrag`
  - the `rowEditTableId` selector
  - `MenuTarget` `{ kind: 'row', row }`
  - the `openExport(returnFocus, seed?)` seed
  - reset of the new fields alongside `titleEdit`

  Add store tests in `apps/app/src/state/ui-store.test.ts`.

- [x] T014 [P] Add a case to `apps/app/src/views/view-state.test.ts`: with `rowEditTableId` set, the projected table's `detail` is `'all'`; the document's `detail` and the other tables are unchanged; clearing the id restores the projection.
- [x] T015 Apply the override in `apps/app/src/views/view-state.ts` `projectNodes` (patch `detail: 'all'` on that one node, no write). T014 is green.

**Checkpoint**: format, model and pure helpers are ready, and all package tests are green.

---

## Phase 3: User Story 1 - Add columns by typing a line (Priority: P1) 🎯 MVP

**Goal**: C, or the toolbar's add button, opens a new row. The user types a line, the chips show the parsed parts, ⏎ saves and opens the next row, Esc cancels.

**Independent Test**: on an empty table, type three lines with ⏎ between them. Three columns appear with the parsed fields, in order, and each is one undo step.

### Tests for User Story 1 (write first)

- [x] T016 [P] [US1] Write `apps/app/src/editor/table/column-line-editor.test.tsx` (new-row mode):
  - an input named "New column" renders at the row's position
  - chips named "name · email", "type · text", "unique", "not null" update while typing
  - an enum type shows the enum chip
  - an "ignored · sparkly" chip appears
  - ⏎ calls `addColumn` with the parsed data at the right index and reopens an empty row
  - Esc closes without writing
  - Tab moves the caret to the type token
  - an empty name and a taken name show inline messages and write nothing
  - each save is undone by one ⌘Z
- [x] T017 [P] [US1] Add `apps/app/src/editor/table-layout.test.ts` cases: with a new-row edit open, the table is one row taller, and the rows below the insertion index (and their relationship anchors) shift by 24.

### Implementation for User Story 1

- [x] T018 [US1] Create `apps/app/src/editor/table/column-line-editor.tsx`:
  - a 24 px input that matches the row's font and slots, with the chips overlay under the card (tokens, `pointer-events: none`, Deck chip styles)
  - save via `oneStep` + `editor.addColumn(tableId, data, index)` (index = after the focused row, else the end; FR-006a)
  - error text, ⏎ / Esc / Tab handling, and an announce on save

  T016 is green.

- [x] T019 [US1] Render the editor row from `apps/app/src/editor/table/table-body.tsx` when `columnEdit` targets this table with `columnId: null`. Add `extraRow` to `tableLayout` in `apps/app/src/editor/table-layout.ts`, fed from the projected deck / table context so anchors follow. T017 is green.
- [x] T020 [US1] Add a `table.addColumn` action (menu "Add column", toolbar plus button, key C on a focused or selected `db-table`) in the new `apps/app/src/editor/actions/table-actions.ts`, and register it in `actions/index.ts`. In `apps/app/src/editor/use-canvas-shortcuts.ts`, make C on a `db-table` open the new-row editor and R open the connect popover (moved from C). Update `shell/shortcuts.ts`. Add cases to `use-canvas-shortcuts.test.ts`.

**Checkpoint**: columns can be added by typing (SC-002).

---

## Phase 4: User Story 2 - Change a column in place (Priority: P1)

**Goal**: F2, double-click or ⏎ on a row turns it into the line editor, pre-filled, with the name selected. Saving rewrites name, type and flags as one step and keeps the id. Rows at mismatched relationship ends show (!).

**Independent Test**: rename a column that has a relationship and an index. The connector stays on the row and the index count is unchanged.

### Tests for User Story 2 (write first)

- [x] T021 [P] [US2] Extend `apps/app/src/editor/table/column-line-editor.test.tsx` (edit mode):
  - pre-fills `formatColumnLine(column)` with the name selected
  - ⏎ calls `updateColumn` with `columnLinePatch`; removing `not null` writes `notNull: null`; removing `pk` removes the key; the id is unchanged
  - Esc restores the row
  - one ⌘Z undoes name, type and flags together
  - the relationship and index still reference the column id
- [x] T022 [P] [US2] Add cases to `apps/app/src/editor/table/table-body.test.tsx`:
  - double-click on a row name starts the edit
  - a mismatched row shows an image named "Type differs: int → uuid (orders.customer_id)"
  - the icon disappears once the types match

### Implementation for User Story 2

- [x] T023 [US2] Add edit mode to `apps/app/src/editor/table/column-line-editor.tsx` (`columnId` set): pre-fill, select the name (`select: 'name'`), save through `updateColumn` + `columnLinePatch` in `oneStep`, close on ⏎. T021 is green.
- [x] T024 [US2] In `apps/app/src/editor/table/table-body.tsx`, swap the row for the editor while it is edited, add double-click to edit, and draw the `TriangleAlert` 12 px icon (clay ink, accessible name, tooltip) from `mismatchedColumns` via the table context in `table-keys.ts`. T022 is green.

**Checkpoint**: renames keep every reference (SC-003); type mismatches are visible.

---

## Phase 5: User Story 3 - Keyboard rows and reorder (Priority: P1)

**Goal**: rows are driven fully from the keyboard (R5), can be reordered by grip drag, and deleting a column shows an Undo toast. The table shows All while row editing is on.

**Independent Test**: keyboard-only on a 5-column table, reorder two rows, delete one and undo. The order matches and the deleted column returns with its relationships.

### Tests for User Story 3 (write first)

- [x] T025 [P] [US3] Add cases to `apps/app/src/editor/use-canvas-shortcuts.test.ts` for a focused row:
  - ⏎ / F2 open the editor
  - ⌫ and Delete remove the column
  - ⌥↑ / ⌥↓ call `moveColumn` ±1 (clamped)
  - C opens a new row below
  - R starts the column connect (was C; update 042's tests)
  - Esc returns to the table
  - ⏎ on the table still opens details and ↓ enters the rows
  - keys are ignored in text fields
- [x] T026 [P] [US3] Write `apps/app/src/editor/table/row-grip.test.tsx`:
  - the grip button is named "Reorder {column}"
  - the pointer drag drop index is computed from `rowsTop` and 24 px rows
  - the drop line shows at the target index
  - release calls `moveColumn` once
  - Esc cancels
  - no grip on a locked table or below 90 % zoom
- [x] T027 [P] [US3] Add a case to `apps/app/src/editor/table/table-body.test.tsx` (or a new `row-delete.test.ts`):
  - deleting `tracking` with one relationship shows the toast "Deleted column tracking · 1 relationship removed" with Undo
  - Undo restores the column, its position, its relationship and its index parts
  - focus moves to the next row
- [x] T028 [P] [US3] Add a case to `apps/app/src/editor/table/table-body.test.tsx`: a table at Keys with row focus renders All rows. Esc returns it to Keys. The deck JSON is unchanged.

### Implementation for User Story 3

- [x] T029 [US3] Extend `apps/app/src/editor/use-canvas-shortcuts.ts` and `apps/app/src/editor/table/row-focus.ts` with the row key map (R5). Delete runs through a `deleteColumn(editor, row)` helper in `apps/app/src/editor/actions/table-actions.ts` (`removeColumn` in `oneStep`, then `showUndoToast` from `editor/undo-toast.ts` with the edge count from `RemovalResult.removed`, then refocus). Update `shell/shortcuts.ts` and the keyboard help. Make row focus and the editor announce name, type and position (FR-011). T025 and T027 are green.
- [x] T030 [US3] Create `apps/app/src/editor/table/row-grip.tsx` (a `GripVertical` button with `nodrag`, a pointer session in `rowDrag`, a 2 px drop line with a ring) and mount it from `table-body.tsx`. T026 is green.
- [x] T031 [US3] Feed `rowEditTableId` (from `focusedRow`, `columnEdit`, `rowDrag`) into the view projection, so the All override applies and clears on Esc or deselect. T028 is green.

**Checkpoint**: P1 complete. A schema can be built and edited with the keyboard (SC-001, SC-004).

---

## Phase 6: User Story 4 - Context menus and relationship quick settings (Priority: P2)

**Goal**: frame 149's table, row, relationship and canvas menus, plus the relationship toolbar (frame 136).

**Independent Test**: every menu item does its action in one undo step, and toggles show their state.

### Tests for User Story 4 (write first)

- [x] T032 [P] [US4] Write `apps/app/src/editor/actions/table-actions.test.ts`:
  - `row.pk`, `row.notNull` and `row.unique` toggle with check state
  - `row.pk` on a second column makes a composite key
  - `row.addIndex` adds `{ columns: [id] }`
  - `row.moveUp` / `row.moveDown` clamp
  - `row.addRelationship` starts the column connect
  - `table.exportSql` selects the table and calls `openExport` with `{ format: 'sql', scope: 'selection' }`
  - every item is one undo step
- [x] T033 [P] [US4] Write `apps/app/src/editor/actions/relationship-actions.test.ts`:
  - cardinality radio (1–1, 1–n, n–1, n–n) writes `cardinality`
  - the optional checks write `true` / `null`, never `false`
  - on delete writes the action, and "None" clears it
  - the actions apply only to edges with column ends
  - they show on the `connection` toolbar and menu
- [x] T034 [P] [US4] Add a case to `apps/app/src/editor/quick-edit/canvas-menu.test.tsx`: right-click on a row opens the row menu with "Edit", "Set as primary key", "Not null", "Unique", "Add index", "Add relationship…", "Move up", "Move down", "Delete column". The canvas menu lists "Add table" and "Add note".

### Implementation for User Story 4

- [x] T035 [US4] Implement the row and table actions in `apps/app/src/editor/actions/table-actions.ts` (ids per contracts/editing-ui.md, `where`, `applies`, `checked`, shortcuts), and register them. T032 is green.
- [x] T036 [US4] Create `apps/app/src/editor/actions/relationship-actions.ts` (cardinality with crow glyph icons reused from `edge-end-marks.ts`, optional sides, on delete) and register them. T033 is green.
- [x] T037 [US4] Support the `row` `MenuTarget` in `apps/app/src/editor/quick-edit/canvas-menu.tsx` and the right-click handler on rows in `table/table-body.tsx` (`onContextMenu` → `ui.openContextMenu({ kind: 'row', row }, point)`). T034 is green.
- [x] T038 [US4] Seed the export dialog: accept `{ format, scope }` in `exportDialog` and pass it to `initialExportState` in `apps/app/src/editor/export/export-dialog.tsx` / `export-dialog-state.ts`. Add a test in `export-dialog-state.test.ts`.

**Checkpoint**: every action is reachable by menu.

---

## Phase 7: User Story 5 - Add, duplicate, copy and paste tables (Priority: P2)

**Goal**: T adds a table with `id integer pk`. ⌘D and cross-deck paste use the model changes from T008, show the drop toast, and select the title for renaming.

**Independent Test**: duplicate a table with 2 outgoing foreign keys and 1 incoming one. The copy has 2 outgoing and 0 incoming relationships, and every id is new.

### Tests for User Story 5 (write first)

- [ ] T039 [P] [US5] Add `addTable` cases to `apps/app/src/editor/canvas-actions.test.ts`: it writes a `db-table` named `table_n` at the given point with one column `{ name: 'id', type: 'integer', pk: true, notNull: true }`, starts the title edit, and is one undo step. Add a case to `use-canvas-shortcuts.test.ts` for T, and one to `empty-canvas-card.test.tsx` for "Add table" (shown only when the Database pack is on).
- [ ] T040 [P] [US5] Add cases to `apps/app/src/editor/editing/clipboard-ops.test.ts`:
  - duplicate and copy pass `keepOutgoing`
  - a paste with `droppedRelationships > 0` shows the toast "Pasted orders · 3 relationships dropped" with Undo
  - a single pasted or duplicated table starts the title edit with all text selected
  - one ⌘Z removes the whole paste

### Implementation for User Story 5

- [ ] T041 [US5] Implement `addTable(editor, point)` in `apps/app/src/editor/canvas-actions.ts`. Wire it to T in `use-canvas-shortcuts.ts`, the canvas menu "Add table", the palette Table tile (`palette.tsx` calls `addTable` for `db-table`), and an "Add table" action in `apps/app/src/editor/empty-canvas-card.tsx`. T039 is green.
- [ ] T042 [US5] Update `apps/app/src/editor/editing/clipboard-ops.ts` (`keepOutgoing`, the drop toast via `showUndoToast`, the rename after a single-table paste or duplicate). T040 is green.

**Checkpoint**: tables can be started and reused (SC-006).

---

## Phase 8: User Story 6 - Lock a card (Priority: P3)

**Goal**: ⇧⌘L, or the menu or toolbar, locks any card. A locked card cannot be moved, resized, edited or deleted. Its rows still highlight and accept relationships.

**Independent Test**: lock a table, then try to move, resize, rename, add a column and delete it. Nothing changes, and hovering and connecting still work.

### Tests for User Story 6 (write first)

- [ ] T043 [P] [US6] Write `apps/app/src/editor/actions/lock.test.ts`:
  - `node.lock` toggles via `setLocked` with the label Lock / Unlock
  - ⇧⌘L locks and unlocks the selection
  - `toFlowNode` sets `draggable: false` for locked nodes (cache invalidated on change)
  - nudge, resize keys, align and tidy skip locked nodes
  - multi-drag moves only unlocked nodes
- [ ] T044 [P] [US6] Add cases to `apps/app/src/editor/confirm-delete-dialog.test.tsx` and `deck-node.test.tsx`:
  - deleting a selection with one locked card removes the others and announces "Skipped 1 locked"
  - a locked card alone is not deleted
  - a locked card shows a button named "Unlock {title}" and no resize controls
  - title edit, the line editor and the row actions are refused with the tooltip "Locked · unlock to move or edit"
  - a relationship dragged onto a locked table's row is created

### Implementation for User Story 6

- [ ] T045 [US6] Add the `node.lock` action (menu, toolbar, ⇧⌘L) in `apps/app/src/editor/actions/table-actions.ts`, available for any card type. Bind ⇧⌘L in `use-canvas-shortcuts.ts` and add it to `shell/shortcuts.ts`.
- [ ] T046 [US6] Block gestures for locked nodes:
  - `apps/app/src/editor/deck-to-flow.ts` (`draggable`, cache compare)
  - `editing/drag-session.ts` (filter multi-drag)
  - `editing/use-nudge.ts`, `use-resize-key.ts`, align / tidy actions
  - `deck-node.tsx` / `shapes/shape-node.tsx` / `component-node-parts.tsx` (hide `ResizeControls`, lock badge replacing the detail toggle)
  - title edit (`quick-edit/title-edit.ts`), the line editor, row actions and the grip (an `isLocked` guard plus a tooltip)

  T043 is green.

- [ ] T047 [US6] Filter locked nodes in `selectionTargets` / `useRunDelete` (`apps/app/src/state/ui-store.ts`, `apps/app/src/editor/confirm-delete-dialog.tsx`) and add "Skipped n locked" to the announcement. T044 is green.

**Checkpoint**: lock works for every card type (SC-007).

---

## Phase 9: User Story 7 - Multi-select and the Add flyout Database tab (Priority: P3)

**Goal**: bulk toolbar edits are one undo step. The Add flyout's Database tab lists Table T, Note S and Table group G, and Packs describes Database.

**Independent Test**: select 3 tables and change the colour. One ⌘Z restores all three. The Database tab shows the three tiles.

### Tests for User Story 7 (write first)

- [ ] T048 [P] [US7] Add cases to `apps/app/src/editor/palette.test.tsx` and `packs-panel.test.tsx`:
  - the Database tab lists "Table", "Note" and "Table group" with the T / S / G badges
  - Table calls `addTable`
  - Table group groups the selected tables, or places a frame at the centre when nothing is selected
  - Packs shows "Table, note, table group" for Database
  - turning Database off hides the tab, and tables on the board still render
- [ ] T049 [P] [US7] Add cases to `apps/app/src/editor/quick-edit/selection-toolbar.test.tsx`: with 3 tables selected, colour, detail, group and align each apply to all and are undone by one ⌘Z; align skips a locked table.

### Implementation for User Story 7

- [ ] T050 [US7] In `packages/model/src/card-types.ts`, give the Database pack `tools: ['sticky', 'frame']` and `description: 'Table, note, table group'`. In `apps/app/src/editor/palette.tsx`, label the frame tile "Table group" inside the Database section and show the letter badges. Bind G in `use-shell-shortcuts.ts` (group the selection, or `placeFrameAtCentre`). Show `description` in `apps/app/src/editor/packs-panel.tsx`. T048 is green.
- [ ] T051 [US7] Fix any bulk action that is not a single `oneStep`, as found by T049. T049 is green.

**Checkpoint**: all stories are done.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T052 [P] Compare the screens against frames 160, 149, 136, 168 and 161 (editing and locked states) in light and dark at 100 %. Save screenshots for the report. Fix any token or spacing drift.
- [ ] T053 Run `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` and save `specs/043-db-editing/bench-after.md`. The result must stay within 5 % of bench-before.
- [ ] T054 [P] Docs:
  - Amend `docs/decisions/0029-database-pack-model.md` with a "Lock" section (a generic node flag, `true` only).
  - Update `packages/schema/CLAUDE.md`, `packages/model/CLAUDE.md` (`setLocked`, the paste result) and `apps/app/CLAUDE.md` (the column line module, row editing state).
  - Update `DESIGN.md` "Database pack" if the grip or the (!) icon values changed.
- [ ] T055 [P] Update `docs/backlog-database.md`: mark 043 as split. Its status is "canvas editing built (spec `specs/043-db-editing`)". Add a new drawer feature entry (table tabs, relationship drawer, enum editor with the Enum tile and "Add enum", dialect type lists and conversion, Deck settings Database section) with dependencies and a `/speckit.specify` prompt. Update the dependency graph.
- [ ] T056 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Walk through quickstart.md steps 1–12. Commit in small conventional commits (`feat(schema)`, `feat(model)`, `feat(app)`, `docs`). Open the PR with the report (what changed, what was skipped, uncertainties, bench numbers).

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T015)** → the user stories.
- **US1 (T016–T020)** comes first. **US2 (T021–T024)** needs US1's editor. **US3 (T025–T031)** needs US1 and US2 (⏎ and F2 open the editor; C opens a new row).
- **US4 (T032–T038)** needs US3's `deleteColumn` and row focus. It can start after US1 if `row.delete` is wired last.
- **US5 (T039–T042)** needs only Foundational (T008). It can run in parallel with US1–US4.
- **US6 (T043–T047)** needs only Foundational (T006). It can run in parallel. T046's guards for the line editor and the grip land after US1 and US3.
- **US7 (T048–T051)** needs US5's `addTable`.
- **Polish (T052–T056)** comes after all stories.

## Parallel Opportunities

- Foundational: T003, T005, T007, T009, T011 and T014 are all test files in different packages, so they can be written together. T006, T008, T010 and T012 can also run in parallel after their tests.
- Inside each story, the [P] test tasks run together, for example T025–T028 for US3.
- Across stories: US5 (clipboard / add table) and US6 (lock) can run alongside US1–US3 because they touch different files. Watch for shared edits to `use-canvas-shortcuts.ts` and `table-actions.ts`, and merge those in order.

## Implementation Strategy

1. **MVP = Phases 1–3 (US1)**: columns can be added by typing a line. Demo it on an empty table.
2. Add US2 and US3, which complete the P1 authoring loop (SC-001–SC-004).
3. Add US4 and US5 (menus, quick settings, reuse of tables).
4. Add US6 and US7 (lock, flyout, bulk edits).
5. Polish, bench, docs and the backlog split, then the PR.
