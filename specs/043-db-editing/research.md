# Research: Schema Editing on the Canvas (043)

Phase 0 of [plan.md](plan.md). The clarify answers (2026-10-04) are already settled:

- 043 is the canvas half of the backlog item.
- `locked` applies to any card.
- The column line never creates relationships.
- Row editing shows All for the session only.
- A type change on a column never changes other columns; mismatched relationship ends show (!).
- A locked card is never deleted.
- A new `pk` column stays where it was typed.

The code facts below come from a survey of `main` on 2026-10-04, after 040, 041, 042, 045 and 050 were merged.

## R1. Column line: a pure parser and formatter in `apps/app/src/db/`

- **Decision:** add `apps/app/src/db/column-line.ts` with two functions:
  - `parseColumnLine(text, { enums }) → ParsedColumnLine`. The result holds `name`, `type`, `size`, `pk`, `notNull`, `unique`, `increment`, `default` | `defaultExpr`, `enumRef` and `ignored[]`, plus the tokens with their character ranges for the chips.
  - `formatColumnLine(column, enums) → string`. It is the inverse, used to pre-fill the editor when an existing row is edited.

  The property test is: `parse(format(c))` equals `c` for every column in the "Shop" fixture and the export edge-case fixture. A hand-written tokenizer covers words, quoted names, quoted strings, parentheses, numbers and `(n,m)` sizes. The grammar is in [contracts/column-line.md](contracts/column-line.md).

- **Rationale:**
  - This is FR-001–FR-006.
  - Nothing parses SQL or DBML today; the `db/` code only writes.
  - A full SQL parser is 044's job, behind a lazy worker (DB6), and it is far too heavy for keystroke parsing.
  - A tokenizer of about 150 lines runs in well under a millisecond per keystroke (SC-005) and needs no dependency (constitution VIII).
- **Reuse:**
  - The `type(size)` split follows the regex in `db/export/common-types.ts` `translateType`.
  - The model has no `precision` field: `size` is one string matching `^\d{1,6}(,\d{1,6})?$`. So `numeric(10,2)` is stored as `type: 'numeric', size: '10,2'`. The spec's "size and precision" are both carried by `size`.
- **Alternatives:**
  - Reusing `@dbml/core`: rejected because it is lazy and in a worker (DB6), is async, and parses a whole schema.
  - A regex-only parser: rejected because it cannot give chip ranges or handle quoted defaults.

## R2. Saving a parsed line: one patch, one undo step

- **Decision:** add `columnLinePatch(previous: DbColumn | undefined, parsed) → Patch<DbColumn>` in `db/column-line.ts`.
  - It writes every field of the line and `null` for every field the line no longer has. For example, removing `not null` writes `notNull: null`, and switching from `default` to `defaultExpr` sends `null` for the old one (model rule S14).
  - Fields the line cannot express are left untouched: `note`, `check`, and `enumRef` when the type still names the same enum.
- **How it is written:**
  - An existing row goes through `editor.updateColumn` inside `oneStep`.
  - A new row goes through `editor.addColumn(tableId, data, index)`, where the index is "after the focused row", else the end (FR-006a, clarified: no key reordering).
- **Duplicate names:** `nameTaken(table, name, exceptId)` compares names case-insensitively and blocks the save (FR-005).
- **Rationale:** FR-007 and SC-004. Name, type and flags change in one undo step and the id never changes (constitution III).

## R3. Line editor UI state lives in the UI store; the text is local

- **Decision:**
  - `ui-store.ts` gains `columnEdit: { tableId, columnId: Id | null, at?: number, select: 'name' | 'all' } | null`, where `columnId: null` means a new row. It also gains `startColumnEdit`, `endColumnEdit` and the resets alongside `titleEdit`.
  - The editor's text is React state in the new `table/column-line-editor.tsx`, rendered by `TableBody` in place of that row. The new row is drawn as an extra 24 px row at its index.
  - The chips are a small overlay under the card (absolutely positioned, `pointer-events: none`), so the card's computed height only grows by the one new row. The editor stays computed, never measured (§g-58).
- **Keys:**
  - ⏎ saves, then opens the next new row (new rows) or leaves editing (existing rows).
  - Esc cancels.
  - Tab puts the caret at the start of the type token (FR-006).
  - The input is a text target, so the canvas shortcuts ignore it (`isTextTarget`).
- **Height:** `tableLayout` takes `extraRow: boolean` from the UI store through the projected deck (R4), so connectors under the new row move with it.
- **Rationale:** UI-only state belongs in Zustand (constitution I). Typed text is not document data until it is saved.

## R4. Session-only "All" while editing rows

- **Decision:**
  - `ui-store.ts` gains a derived `rowEditTableId`. It is set while `focusedRow`, `columnEdit` or the drag-to-reorder session points at a table.
  - `views/view-state.ts` `projectNodes` patches `detail: 'all'` onto that one node of the projected deck, with no write.
  - Leaving row editing (Esc, deselect, focus leaving the rows) clears it, and the table returns to its stored detail (FR-010a, clarified).
- **Rationale:** every geometry consumer (React Flow, relationship anchors, hit tests) reads the projected deck. Patching once there keeps them all in agreement, and the Yjs document never changes.
- **Alternatives:**
  - Threading an override through `setTableDeck`: rejected because it misses the React Flow node size.
  - Writing `detail: 'all'` and undoing it later: rejected because it is a hidden document write and an extra undo step.

## R5. Keyboard map: C adds a column on tables, R connects

- **Decision:**
  - **Focused or selected `db-table`:**
    - ↓ enters the rows (unchanged).
    - ⏎ still opens details. This matches "Edit details ⏎" in frame 149, so the spec's "⏎ or ↓ enters rows" was corrected to ↓ during planning.
    - **C opens the new-row editor at the end.** Today C opens the connect popover.
    - **R opens the connect popover** that C used to open, so tables keep a keyboard connect path (constitution VII).
  - **Focused row:**
    - ⏎ / F2: edit the row.
    - ⌫ / Delete: delete it.
    - ⌥↑ / ⌥↓: move it.
    - **C**: add a new row below.
    - **R**: start a relationship. This replaces 042's C, which called `openColumnConnectPopover`.
    - Esc: back to the table.
  - **Canvas:** T adds a table and G adds a table group. Both letters are free today. S is already the sticky tool, which matches frame 168's "Note S".
  - **⇧⌘L** toggles lock. It is unused today; plain L is the connector tool and the shell handler returns early on Shift.
  - R still resets an active gesture first, because that branch runs before the focus branches.
- **Changes:**
  - `use-canvas-shortcuts.ts`.
  - The `SHORTCUTS` display table.
  - The keyboard help shows the new keys.
  - 042's tests for C on a row move to R.
- **Rationale:** these are the keys in frames 149 and 160. Moving 042's binding is the only behaviour change to existing keys.

## R6. Row reorder by drag

- **Decision:**
  - A grip appears on row hover. It is a `GripVertical` button in the row's key slot area, shown only while not at System or Landscape zoom and not locked.
  - Pointer down on the grip starts a reorder session in the UI store (`rowDrag: { tableId, columnId, overIndex }`). React Flow node drag is suppressed with the `nodrag` class.
  - The drop index comes from the pointer's y relative to the computed `rowsTop` and the 24 px rows, so there is no DOM measuring.
  - A 2 px drop line with a ring is drawn at the target index. On release, `moveColumn` runs as one step. Esc cancels.
- **Rationale:** FR-009. The same geometry as 042's `columnTargetAt`, so no measuring.
- **Alternatives:** HTML5 drag and drop was rejected because its ghost image does not respect canvas zoom.

## R7. Delete a column with an Undo toast

- **Decision:**
  - ⌫ on a focused row, or "Delete column" in the row menu, runs `editor.removeColumn` in `oneStep`.
  - It then shows `showUndoToast` with "Deleted column {name}", plus " · n relationships removed" when the `RemovalResult.removed` list holds edges. The count comes from the edge refs.
  - Row focus moves to the next row, or the previous one, or back to the table.
  - There is no confirm dialog. A column is a part of a card, not a canvas object, so it does not go through `pendingDelete`.
- **Rationale:** FR-010, frame 160 D. The 6 s toast is `MOTION.toastUndoMs`.

## R8. Context menus for a row, and the relationship and table items

- **Decision:**
  - `MenuTarget` gains `{ kind: 'row', row: ColumnRef }`. Right-click on a row (`data-row`) opens the canvas menu with that target. The same `Action` registry renders it.
  - A new `actions/table-actions.ts` holds:
    - **Table:** `table.addColumn`, `table.exportSql`, `node.lock` (any card).
    - **Row:** `row.edit`, `row.pk`, `row.notNull`, `row.unique`, `row.addIndex`, `row.addRelationship`, `row.moveUp`, `row.moveDown`, `row.delete`.
  - `actions/relationship-actions.ts` holds `relationship.cardinality` (radio submenu with end glyphs), `relationship.optional` (From optional / To optional checks), `relationship.onDelete` (radio including "None") and the existing line type and colour.
  - Every `run` is one `oneStep` (FR-013).
  - "Set as primary key" toggles `pk` on that column. Several pk columns make a composite key, as the model already allows.
- **Rationale:**
  - This reuses the 019 action registry, so menu, toolbar and keys stay consistent.
  - There is no row menu today, and no cardinality action anywhere. Cardinality is only set when a relationship is created, in `canvas-actions.ts:131`.

## R9. Relationship quick settings on the toolbar

- **Decision:**
  - `relationship.cardinality` and `relationship.onDelete` declare `where.toolbar: ['connection']`, with `applies` set to "the edge has column ends" (`hasColumnEnds`). The `connection` toolbar variant then shows them for relationships only.
  - Cardinality writes through `editor.update('edges', id, { cardinality })`.
  - The optional flags write `true` or `null`, never `false` (agent finding: `false` is not turned into a removal).
  - `onDelete: null` clears.
- **Rationale:** FR-014, frame 136. No new toolbar variant is needed.

## R10. Duplicate and paste: enums and outgoing foreign keys

- **Facts:**
  - `model/ops/paste.ts` already remaps nodes, groups, edges, columns, indexes, checks, index parts and edge column ends, in one transaction.
  - `toFragment` keeps an edge only when both ends are in the fragment.
  - Enums are never copied, and `enumRef` is kept as is, which dangles across decks.
- **Decisions:**
  1. **Outgoing foreign keys on duplicate (FR-018):**
     - `toFragment` gains `{ keepOutgoing: true }`, used by duplicate and by copy. It keeps relationship edges whose `from` node is in the fragment and whose `to` is outside, and marks them in an `external` list of the fragment.
     - On paste, `paste.ts` keeps an external edge only when its `to` node and its column ids exist in the target deck. The edge is remapped on the from side only. The other external edges are dropped and counted in the result as `droppedRelationships`.
     - So the same deck keeps them (edge case), and another deck that lacks the target drops them (FR-019).
     - Incoming relationships are never in the fragment.
  2. **Enums (FR-021):**
     - The fragment carries `enums` that are referenced by the copied columns.
     - On paste, each one is matched by name (case-insensitive, same schema) to an enum in the target deck and linked to it. If there is no match, it is added with new enum and value ids.
     - This happens inside the same transaction.
  3. **Names (FR-020):** table names that are taken in the target deck (same schema, case-insensitive) get `_copy`, then `_copy_2` and so on. This applies to `db-table` nodes only; other cards keep their titles as today.
  4. **Self-reference** stays inside the fragment, so it is remapped to the copy (US5 scenario 4).
- **App:** `clipboard-ops.ts` shows `showUndoToast("Pasted {name} · n relationships dropped")` when the count is above 0, and otherwise announces as today. After a duplicate or paste of a single table, the app calls `startTitleEdit({ isNew: false, select: 'all' })` (frame 160 H).
- **Rationale:** the fix belongs in the model's paste op (constitution II: the model is the only Yjs ↔ JSON path). A unit test proves "0 shared ids" (SC-006).
- **Format:** the fragment is a clipboard format, not the file format. It gains optional `external` and `enums`, and `sododeckFragment` stays `1`. An old fragment without them still pastes.

## R11. `locked` on nodes

- **Schema and model:**
  - Add `locked?: true` to Node in `v1.json`, after `detail`, following 031's `display` addition.
  - Regenerate, then update `examples/full.sododeck.json`, the invalid fixtures (`locked: false`, `locked: "yes"`), the parity test and the round-trip case.
  - `read.ts`, `write.ts` and `validate.ts` pass plain node keys through, so they need no change.
  - New model op `setLocked(ids, locked)`: one transaction, writing `true` or removing the key.
  - Only `true` is valid, so a deck never carries `locked: false` (FR-022: older decks unchanged).
- **App:**
  - `toFlowNode` sets `draggable: !locked`, and the node cache comparison includes it.
  - `drag-session.ts` filters locked nodes out of multi-drag.
  - `use-nudge.ts`, `use-resize-key.ts`, align and tidy skip locked nodes.
  - `ResizeControls` is hidden.
  - Title edit, field edits, the line editor and every row write action check `isLocked` and show the tooltip "Locked · unlock to move or edit".
  - Delete is filtered in `selectionTargets` / `useRunDelete`, the single choke point. Locked nodes are removed from the targets and the announcement adds "Skipped n locked" (FR-024).
  - Relationship creation to and from a locked table is allowed (FR-023), because it only writes an edge.
- **Lock badge:** a `Lock` icon in the card header (frame 160 J, 161) replaces the detail toggle while locked. It is also an unlock button.
- **ADR:** amend ADR 0029 with a "Lock" section. The flag is generic and node-level, which is a format decision.

## R12. Add table defaults

- **Decision:**
  - `addTable(editor, point)` in `canvas-actions.ts` runs in `oneStep`. It adds a `db-table` titled with the first free `table_n`, adds one column `{ name: 'id', type: 'integer', pk: true, notNull: true }` and starts the title edit.
  - It is used by T, the flyout tile, the canvas menu "Add table" and the empty-canvas card's new "Add table" action. That action only shows when the Database pack is on and the deck is empty or a schema deck.
  - It is not added to the general "Add component" path, so other card types are unchanged.
- **Rationale:** FR-012. Today a `db-table` added from the flyout has no columns.

## R13. Add flyout Database tab and pack description

- **Facts:** the tabs already come from `CATEGORIES`, so the Database tab and its Table tile appear when the pack is on.
- **Decisions:**
  - The Database section adds two tool tiles after Table: **Note** (sticky) and **Table group** (frame). This uses the existing pack `tools` mechanism: Database gets `tools: ['sticky', 'frame']`, with the frame tile labelled "Table group" inside the Database section.
  - The tiles show their letter shortcut badge (T, S, G) as in frame 168.
  - `packs-panel.tsx` shows a pack `description` when present. The Database pack gets "Table, note, table group".
  - Table group (G or tile) groups the selection when tables are selected (⌘G behaviour). Otherwise it places a frame at the view centre (`placeFrameAtCentre`).
- **Rationale:** FR-026.
- **Not added:** the Enum tile. It is out of scope until the enum editor exists.

## R14. Type-mismatch (!) on rows

- **Decision:**
  - `table-keys.ts` gains `mismatchedColumns(deck) → Map<rowKey, string>`. For every relationship with column ends, it compares each position pair with 042's `typeMismatch` and stores the message (e.g. `int → uuid · orders.customer_id`) for both rows.
  - The map is computed in the table context alongside `connectedColumns`, and memoised per deck revision.
  - `TableBody` draws a 12 px `triangle-alert` in the row's right slot (clay ink, with the text as its accessible name and tooltip). It is never colour alone (constitution VII).
  - Export does not draw it. It is an editing hint, and the lint list in 047 is the persistent report.
- **Rationale:** FR-010b, clarified. This reuses the one comparison function, so drop warning and row icon never disagree.

## R15. "Export this table as SQL"

- **Decision:** `ui.openExport(returnFocus, { format: 'sql', scope: 'selection' })` extends `exportDialog` with an optional seed. `initialExportState` takes it. The action first selects the table, so the existing `selection` scope applies.
- **Rationale:** FR-016, with a minimal change to 045.

## R16. Multi-select toolbar

- **Facts:** colour, detail (`table.detail` applies to several tables), group and align already exist in the `components` variant, and each runs in one batch.
- **Decision:** no new code beyond verifying that each one is a single `oneStep` (tests), and that locked tables are skipped for align (R11).
- **Rationale:** FR-025.

## R17. Performance

- The parser runs on each keystroke on the main thread and is under 1 ms (unit-timed in a test for a 200-character line).
- Row hover grips and the (!) icon are static elements, with no React Flow updates.
- The mismatch map is O(relationships) per deck revision.
- Bench before and after with 150 tables, because `TableBody` and `toFlowNode` change (constitution V). The target is within 5 % of the before numbers.
