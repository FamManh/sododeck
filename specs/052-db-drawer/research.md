# Research: Database Details Drawer (052)

Phase 0 of [plan.md](plan.md). The clarify answers (2026-10-04) are settled:

- A dialect change shows a confirm dialog with the conversions, then an Undo toast; no dialog when nothing converts.
- Renaming an enum rewrites the type text of its linked columns in the same step.
- The type picker accepts types outside the dialect's list; they are marked in the drawer only.
- "Block SQL export with errors" counts errors on tables in the export scope only.
- Deleting a used enum unlinks the columns and keeps their type text.

The code facts come from a survey of `main` on 2026-10-04 (040–046 and 050–051 merged).

## R1. Drawer routing: table and relationship branches, a new `enum` mode

- **Decision:**
  - `inspector.tsx` `CanvasInspector` gains two branches before the generic ones: a single selected `db-table` node → `TableInspector`; a single selected edge for which `isRelationship(edge, deck)` holds → `RelationshipInspector`.
  - `DrawerState.mode` (`state/ui-store.ts`) gains `'enum'` with `enumId`. `detail-drawer.tsx` renders `EnumInspector` for it. The auto-close (`hasDetailsTarget`) treats `enum` like `deck`: it stays open while the enum exists, and closes when it is removed (FR-005).
  - A new UI-only field `ui.tableDrawer = { tab: 'general' | 'columns' | 'indexes' | 'checks', expandedColumnId: Id | null, focusColumnId: Id | null }` holds the tab and the expanded row. It resets on selection change, is never saved and is never in Yjs.
  - `openTableDrawer(tableId, { tab, columnId })` selects the table, sets `tableDrawer` and calls `openDrawer()`. Every entry point (Open details, row "Edit details", "used by", type picker links) uses it.
- **Rationale:** today a table opens the generic `NodeInspector` and a relationship the generic `EdgeInspector` (survey §1). Branching in the one dispatcher keeps 018's drawer frame, width, grip and Esc. Enums have no canvas object, so they cannot be a selection; a drawer mode is the same pattern Deck settings already uses.
- **Alternatives:** a selection kind for enums (rejected: enums are not drawn, and selection drives the toolbar and canvas highlight); a separate panel (rejected: §g-85 and frame 164 put everything in the one drawer).

## R2. Tabs: a small app tablist, no new dependency

- **Decision:** `editor/inspector/table/drawer-tabs.tsx`: an ARIA `tablist` with roving focus (← → Home End), styled as frame 164's segmented tab bar with the shared tokens. The panel is `role="tabpanel"` and `aria-labelledby` its tab.
- **Rationale:** `packages/ui` has no Tabs component, and three app tablists are already hand-rolled (`palette.tsx`, `code/code-format-tabs.tsx`, `views/view-switcher.tsx`). Adding `@radix-ui/react-tabs` is a new runtime dependency (AGENTS.md: ask first) for about 60 lines.
- **Alternatives:** `SegmentedControl` (rejected: it is a radio group, the wrong role for tabs); Radix Tabs (rejected: dependency).

## R3. Text fields: `useLiveField`, with a `validate` option for names

- **Decision:**
  - Notes, defaults, check expressions, index expressions and enum notes use `useLiveField` as every inspector field does: saved while typing, one undo step per focus session, Esc writes back the value from before focus.
  - Names (table, column, index, check, enum, enum value, relationship) need uniqueness checks (FR-007, FR-011, FR-018). `useLiveField` gains an optional `validate(text) → string | undefined`. While it returns a message, nothing is written and the message shows under the field; on blur an invalid draft reverts. This extends the existing `required` rule.
- **Rationale:** the spec's "one undo step per committed change" is exactly `useLiveField`'s gesture-per-focus, which the whole drawer already uses (FR-003). Live writes keep the canvas in step while typing. Without `validate`, typing a name that briefly equals another (`order` → `orders`) would write a duplicate.
- **Spec correction:** the edge case "a text field writes one undo step when committed" is reworded to "saves while typing; one focus session is one undo step".

## R4. Column row "Edit" stays the line editor; a new "Edit details" opens the drawer

- **Decision:** the row menu keeps 043's `row.edit` (in-row line editor). A new `row.details` item "Edit details" opens the drawer on Columns with that column expanded and its name focused. ⏎ on a focused row stays 043's edit.
- **Rationale:** the spec (US1 scenario 8) said "Edit" opens the drawer, but 043 shipped `row.edit` → line editor (`table-actions.ts:252`). Changing it would break 043's tests and keyboard model.
- **Spec correction:** US1 scenario 8 and FR-001 now say "Edit details" on a column row.

## R5. Dialect type catalog: app data built on 045's common types

- **Decision:** `apps/app/src/db/dialect-types.ts` exports:
  - `DIALECT_TYPES: Record<Dialect, readonly TypeEntry[]>` with `TypeEntry = { name, kind: 'number' | 'text' | 'datetime' | 'boolean' | 'binary' | 'json' | 'id' | 'other', size: 'none' | 'length' | 'precision' }`.
  - The SQL dialect lists start from each `COMMON_TYPES` spelling (`postgres` / `mysql` / `sqlite`), plus a few dialect-only entries (Postgres `serial`, `bigserial`, `smallserial`, `interval`, `inet`, `cidr`, `macaddr`, `money`, `tsvector`, `xml`, `json`; MySQL `tinyint`, `mediumint`, `year`, `tinytext`, `mediumtext`, `longtext`, `binary`, `varbinary`, `longblob`; SQLite only its five affinities `integer`, `real`, `text`, `blob`, `numeric`).
  - Generic is the 17 canonical names.
  - `typeEntry(dialect, typeText)`: case-insensitive lookup with the aliases, giving `inList` for the "not in the <dialect> list" mark (FR-009).
  - `INDEX_METHODS: Record<Dialect, readonly string[]>`: Postgres `btree hash gist gin spgist brin`; MySQL `btree hash`; SQLite none; Generic `btree hash` (FR-012).
- **Rationale:** no type list exists today (survey §3). `COMMON_TYPES` already holds each type's spelling per dialect and which dialects keep a size, so the catalog derives from it and cannot drift from export and import. The picker shows the deck's enums first, then the groups (frame 164 note). `size: 'precision'` shows two fields (size, scale), written to the one `size` string as `'10,2'` (040 has no separate precision field, 043 R1).
- **Alternatives:** a full per-dialect type reference (rejected: large, and 047 lint is where strict checks belong); free text only (rejected: FR-009).

## R6. Dialect conversion: one pure plan, one batch

- **Decision:** `apps/app/src/db/dialect-change.ts`:
  - `planDialectChange(deck, to) → { from, to, changes: ColumnChange[], kept: KeptColumn[] }`. `ColumnChange = { tableId, columnId, label: 'orders.id', before: { type, size }, after: { type, size, increment? } }`.
  - SQL → SQL uses 044's `convertType` (`db/import/convert-types.ts`). Generic → SQL uses 045's `translateType`. SQL → Generic maps to the common type's `canonical`.
  - One extra rule beyond the common list: Postgres `serial` / `bigserial` / `smallserial` become the target's `int` / `bigint` / `smallint` (via the common list) plus `increment: true` (the spec's story). The reverse is not done: an `integer` with `increment` stays `integer` with `increment` on Postgres, and SQL export writes it as it does today.
  - Columns with `enumRef` are skipped (FR-025). Columns whose type has no mapping go to `kept`. A size that the target type does not keep is dropped and the change lists it.
  - `applyDialectChange(editor, plan)`: one `editor.batch` holding `setDialect(to)` and one `updateColumn` per change. The toast is "Converted n columns to MySQL · Undo", or "Dialect set to MySQL · Undo" when `changes` is empty (FR-024).
  - The confirm dialog (`ConfirmDialog`, §g-84) shows the first 5 changes as rows (`label · before → after`), then "+ n more" grouped by conversion with counts (frame 153), and the kept types in a second list.
- **Rationale:** both conversion functions already exist and are tested (survey §3). A plan object is pure, testable and drives both the dialog and the write. One batch makes the dialect and every type one undo step (SC-003).
- **Perf:** the plan is a single pass over columns. A 150-table, 12-column deck (1,800 columns) plans in well under 50 ms on the main thread, so no worker is needed (SC-004; constitution V is about heavy work, measured in the quickstart).
- **Design note:** frame 153 lists `orders.status order_status → ENUM(…)` and says types without an equivalent "show in Problems". Per the clarify answers, enum columns are not converted (SQL export already writes MySQL's per-column `ENUM`, 045) and unmapped types are only listed as kept. No problem is raised.

## R7. Enum edits that touch columns: app helpers in one batch

- **Decision:** `apps/app/src/db/enum-edits.ts`:
  - `renameEnum(editor, deck, enumId, name)`: one `editor.batch` with `updateEnum({ name })` and `updateColumn({ type: name })` for each column whose `enumRef` is the enum (clarify Q2, FR-018a).
  - `renameEnumValue(editor, deck, enumId, valueId, name)`: one batch with `updateEnumValue` and, for each linked column whose `default` equals the old value, `updateColumn({ default: name })` (frame 165: "Renaming a value updates defaults that use it").
  - `deleteEnum(editor, deck, enumId)`: the model's `removeEnum` already clears `enumRef` and keeps `type` (survey §2), which is clarify Q5. The confirm counts the linked columns.
  - `addEnum` from the tile, the menu or the picker: `enum_n` (first free), empty values, then `openDrawer('enum', id)` with the name selected.
- **Rationale:** `updateEnum` does not touch columns (survey §2). The rule belongs where the drawer writes, like 043's `deleteColumn`. Changing `updateEnum` itself would also change what 046's DBML sync writes, which plans column types on its own.
- **Spec correction:** the edge case "renaming the value updates nothing else" now follows frame 165: defaults equal to the old value are renamed in the same step.

## R8. Relationship drawer: existing edge fields

- **Decision:** the drawer writes `fromColumns`, `toColumns`, `cardinality`, `fromOptional`, `toOptional`, `onDelete`, `onUpdate` with `editor.update('edges', id, patch)` (as `relationship-actions.ts` does), the name as `edge.label` (what SQL export uses for the constraint name, `schema-slice.ts:385`), the colour with `setEdgeStyle`, and the line type with 029's `applyLineType`.
  - Column pairs: each row is a from select and a to select (columns of each table). Add pair, remove pair and reorder write both lists in one `update`.
  - Removing the last pair asks, then deletes the relationship (`requestDelete`), FR-015.
  - A length mismatch shows the warning; 040 already reports `db-composite-mismatch`.
  - The (!) per pair reuses `typeMismatch` (`relationships/type-mismatch.ts`).
  - On update is new to the UI: the same option list as 043's `ON_DELETE`, plus "Not set" (absent).
- **Rationale:** every field exists in the model (040, 042); no model change is needed.

## R9. Block SQL export: a deck flag and a disabled button

- **Decision:**
  - Schema: root `blockSqlExport: true` (optional; absent = off; `false` is invalid, so turning it off removes the key), next to `dialect`. Model: stored in the meta map like `dialect`, read in `read.ts`, loaded in `deck.ts`, op `setBlockSqlExport(on)` beside `setDialect`. Round-trip test.
  - Export dialog: `sqlBlocked = deck.blockSqlExport && schemaFormat === 'sql' && schemaProblems(...).length > 0`. Copy and Download get `disabled` with the reason as their description; the banner text becomes "n errors in <scope> · fix them to export SQL" (FR-028).
  - "Errors": `Problem` has no severity field today (survey §5), and both database kinds (`db-dangling-reference`, `db-composite-mismatch`) are errors. So every `db-*` problem counts. When 047 adds severity, `schemaProblems` filters to errors in one place.
- **Rationale:** `schemaProblems` already filters problems to the scope's tables, which is clarify Q4.
- **Spec note:** "error severity" in FR-028 reads as "every database problem until 047 adds severity"; recorded in the spec's assumptions.

## R10. Entry points and the Enum tool

- **Decision:**
  - Add flyout Database tab: an **Enum** tile. `PackTool` (`card-types.ts`) gains `'enum'`; `palette.tsx` runs `addEnumAndOpen`. No canvas drop (an enum has no position); dragging the tile does nothing.
  - Canvas menu: `canvas.addEnum` "Add enum" in `actions/canvas-actions.ts`, shown when the Database pack is on.
  - Enum popover (`table/enum-popover.tsx`): an "Edit enum" button.
  - Type picker: "New enum…" (creates and links the enum to the column in one batch, then opens the enum editor) and "Edit enum" for the linked enum.
  - Deck settings Database section: dialect select, block switch, enums list ("Add enum", each row opens the editor). `TableDisplaySection` becomes `DatabaseSection` holding these plus the existing switches (§g-85: only this section is new).
- **Rationale:** FR-017, FR-021, FR-026.

## R11. Columns tab details

- **Decision:**
  - Rows as frame 164: grip, key / link glyph, name, type (mono), NN badge, chevron. Filter field and "+ Column" at the top. Reorder by drag (`use-sortable-list.ts`, as flows use) and ⌥↑ / ⌥↓, each one `moveColumn`.
  - Expanded row fields: name, type picker (combobox, `mode: 'free'`, groups), size / scale by `TypeEntry.size`, enum picker (inside the type picker: "Enums in this deck" first), switches for primary key, not null, unique, auto-increment, default with a Value / Expression segmented control (writes `default` or `defaultExpr` and clears the other), check, note.
  - Delete uses 043's `deleteColumn` (toast, cascade).
  - Picking a type from the list writes `type` and clears `enumRef`; picking an enum writes `enumRef` and `type: enum.name`; "No enum" clears `enumRef` only (spec US1 scenario 5).
  - General tab also shows the per-table Detail select (frame 164), reusing 041's detail action.
- **Rationale:** reuse 043's ops and helpers; all writes are `updateColumn` patches.

## R12. Out of scope from the frames

Frame 164 shows an index part "created_at DESC" and frame 165 shows a colour per enum value and an enum card. The model has no index sort direction and no value colour, and the enum card was dropped in 040. None are built here.
