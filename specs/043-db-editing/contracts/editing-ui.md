# Contract: Editing UI, Keys, Menus and Model Ops (043)

## Model (`@sododeck/model`)

| API                                                           | Change                                                                                                                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Node.locked?: true` (schema v1)                              | New. Only `true` is valid; the key is absent when unlocked.                                                                                                                                                           |
| `editor.setLocked(ids: readonly Id[], locked: boolean): void` | New. One undo step. `false` removes the key.                                                                                                                                                                          |
| `toFragment(deck, selection, { keepOutgoing?: boolean })`     | Adds `external` relationship edges (from inside to outside) and the referenced `enums`.                                                                                                                               |
| `paste(…)` result                                             | Adds `droppedRelationships: number`. External edges are kept when their target node and its columns exist; enums are linked by name or copied; `db-table` names are de-duplicated with `_copy`, `_copy_2`, and so on. |

## UI store (`apps/app/src/state/ui-store.ts`)

| Field / action                                                                                | Purpose                                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `columnEdit: { tableId, columnId: Id \| null, at?: number, select: 'name' \| 'all' } \| null` | The open line editor. `columnId: null` is a new row at `at`. |
| `startColumnEdit(…)` / `endColumnEdit()`                                                      | Open and close it. Cleared with the other edit resets.       |
| `rowDrag: { tableId, columnId, overIndex } \| null`                                           | Reorder session.                                             |
| `rowEditTableId` (derived)                                                                    | The table shown at All while row editing is on (R4).         |
| `openExport(returnFocus, seed?: { format, scope })`                                           | Lets the table menu open the SQL export.                     |
| `MenuTarget` `{ kind: 'row', row: ColumnRef }`                                                | Row context menu.                                            |

## Keys

| Context                     | Key                   | Action                                                     |
| --------------------------- | --------------------- | ---------------------------------------------------------- |
| Canvas                      | T                     | Add table at view centre (R12)                             |
| Canvas                      | G                     | Table group: group the selection, or a frame at the centre |
| Canvas / selection          | ⇧⌘L                   | Lock / unlock the selected cards                           |
| Table (focused or selected) | ↓                     | Enter rows                                                 |
| Table                       | ⏎                     | Open details (unchanged)                                   |
| Table                       | C                     | New-row editor at the end (was: connect popover)           |
| Table                       | R                     | Connect popover (moved from C)                             |
| Row                         | ↑ ↓                   | Move row focus                                             |
| Row                         | ⏎ / F2 / double-click | Edit row (name selected)                                   |
| Row                         | ⌫ / Delete            | Delete column + Undo toast                                 |
| Row                         | ⌥↑ / ⌥↓               | Move column                                                |
| Row                         | C                     | New-row editor below                                       |
| Row                         | R                     | Start relationship (was C in 042)                          |
| Row                         | Esc                   | Back to the table                                          |
| Line editor                 | ⏎ / Esc / Tab         | Save (+ next new row) / cancel / caret to type             |

All keys are ignored while focus is in a text field, a dialog or an overlay. These keys do nothing on a locked table, except ↓ ↑ Esc and R.

## Menus (Action ids)

- **Table:**
  - `node.openDetails` (Edit details ⏎)
  - `table.addColumn` (C)
  - `table.detail` (041)
  - colour (020)
  - duplicate (⌘D), copy (⌘C)
  - `node.lock` (⇧⌘L; label Lock / Unlock)
  - group (⌘G)
  - `table.exportSql`
  - delete (⌫, disabled when locked)
- **Row:**
  - `row.edit` (⏎)
  - `row.pk`, `row.notNull`, `row.unique` (check marks)
  - `row.addIndex`
  - `row.addRelationship` (R)
  - `row.moveUp` (⌥↑), `row.moveDown` (⌥↓)
  - `row.delete` (⌫)
- **Relationship:**
  - `relationship.cardinality` (radio: 1–1, 1–n, n–1, n–n, with end glyphs)
  - `relationship.optional` (checks: "From side optional", "To side optional")
  - `relationship.onDelete` (radio: None, Cascade, Restrict, Set null, Set default, No action)
  - line type and colour (existing)
  - delete
- **Canvas:**
  - Add table (T)
  - Add note (S)
  - Paste (⌘V)

**Toolbar:**

- Relationship: cardinality and on delete are added to the `connection` toolbar when the edge has column ends.
- Table: the add-column button (frame 135) runs `table.addColumn`.

## Feedback text

| Event              | Text                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| Column deleted     | Toast "Deleted column {name}" (+ " · n relationships removed"), Undo, 6 s |
| Paste with drops   | Toast "Pasted {name or n tables} · n relationships dropped", Undo         |
| Locked gesture     | Tooltip "Locked · unlock to move or edit"                                 |
| Delete with locked | Announce "Deleted n … · Skipped n locked"                                 |
| Name taken         | Inline "A column named {name} already exists"                             |
| Empty name         | Inline "Type a column name"                                               |
| Type mismatch row  | Icon (!) with the label "Type differs: int → uuid (orders.customer_id)"   |
