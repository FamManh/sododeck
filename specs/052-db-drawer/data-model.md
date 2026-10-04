# Data Model: Database Details Drawer (052)

052 adds one field to the file format. Everything else edits fields that 040, 041, 042 and 043 already define. Decisions are in [research.md](research.md).

## File format (schema v1, additive)

### SododeckFile.blockSqlExport (new)

| Field            | Type              | Rule                                                                                           |
| ---------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `blockSqlExport` | `true` (optional) | Deck root, after `dialect`. Absent means off. `false` is invalid: turning off removes the key. |

- **Model:** stored in the meta map like `dialect`; `read.ts` reads it, `deck.ts` loads it, `validateObject('meta')` accepts it. New op `setBlockSqlExport(ctx, on: boolean)` beside `setDialect`, exposed as `DeckEditor.setBlockSqlExport`.
- **Round-trip:** a deck with the flag and one without survive JSON → Yjs → JSON unchanged.
- **Older decks:** have no key and are saved unchanged.
- **Export:** the SQL writer ignores it; only the export dialog reads it (R9).

## Edited fields (existing)

### Table (`db-table` node, 040)

| Drawer field         | Field                           | Write                                               |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| Name                 | `title`                         | `update('nodes', …)`, `validate`: unique per schema |
| Schema               | `schema`                        | same, re-checks name uniqueness                     |
| Detail               | `detail`                        | 041's detail action                                 |
| Colour               | `style` (020)                   | `applyStyle`                                        |
| Note                 | `description` (table note, 040) | live field                                          |
| Owner · tags · links | `owner`, `tags`, `links`        | existing fields (008, 033)                          |

### Column (040)

| Drawer field                       | Field                            | Notes                                             |
| ---------------------------------- | -------------------------------- | ------------------------------------------------- |
| Name                               | `name`                           | unique in the table, case-insensitive             |
| Type                               | `type`                           | free text; list pick clears `enumRef`             |
| Size / scale                       | `size` (`'255'`, `'10,2'`)       | fields shown by `TypeEntry.size`; empty clears    |
| Enum                               | `enumRef` + `type`               | pick writes both; "No enum" clears `enumRef` only |
| Primary key                        | `pk`                             | `true` or removed; key order is column order      |
| Not null · unique · auto-increment | `notNull`, `unique`, `increment` | `true` or removed                                 |
| Default                            | `default` or `defaultExpr`       | Value / Expression; writing one clears the other  |
| Check                              | `check`                          | live field                                        |
| Note                               | `note`                           | live field                                        |

Add, delete (043 cascade and toast) and move: `addColumn`, `removeColumn`, `moveColumn`.

### Index (040)

`name`, `columns: (Id | { expr })[]` (chips, in order), `unique`, `method` (from `INDEX_METHODS[dialect]`; hidden for SQLite, kept when stored), `note`. Ops: `addIndex`, `updateIndex`, `moveIndex`, `removeIndex`.

### Check (040)

`name`, `expr`. Ops: `addCheck`, `updateCheck`, `removeCheck`.

### Relationship (edge, 040 / 042)

| Drawer field       | Field                         | Write                                         |
| ------------------ | ----------------------------- | --------------------------------------------- |
| From / To pairs    | `fromColumns`, `toColumns`    | one `update('edges', …)` for both lists       |
| Cardinality        | `cardinality` (`1-1` … `n-n`) | `update`                                      |
| Optional sides     | `fromOptional`, `toOptional`  | `true` or removed                             |
| On delete / update | `onDelete`, `onUpdate`        | `DbAction` or removed ("Not set")             |
| Name               | `label`                       | live field; the constraint name in SQL export |
| Line type          | `style.shape` (029)           | `applyLineType`                               |
| Colour             | `style.color` (022)           | `setEdgeStyle`                                |

Removing the last pair deletes the edge through `requestDelete` after a confirm.

### Enum and enum value (040, 041)

`name`, `schema`, `color`, `note`, `values[]` (`name`, `note`). Ops: `addEnum`, `updateEnum`, `moveEnum`, `removeEnum`, `addEnumValue`, `updateEnumValue`, `moveEnumValue`, `removeEnumValue`.

Cross-object writes (one `editor.batch` each, R7):

| Action               | Writes                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Rename enum          | `updateEnum({ name })` + `updateColumn({ type: name })` for every linked column                                      |
| Rename enum value    | `updateEnumValue({ name })` + `updateColumn({ default: name })` where the linked column's `default` was the old name |
| Delete enum          | `removeEnum` (clears `enumRef`, keeps `type`)                                                                        |
| New enum from picker | `addEnum` + `updateColumn({ enumRef, type })`                                                                        |

### Deck dialect (040)

`dialect` via `setDialect`. A change is one batch: `setDialect(to)` + `updateColumn({ type, size, increment? })` per planned change (R6).

## App data (not in decks)

| Name            | Shape                                                                                                 | File                   |
| --------------- | ----------------------------------------------------------------------------------------------------- | ---------------------- |
| `DIALECT_TYPES` | `Record<Dialect, TypeEntry[]>`, `TypeEntry = { name, kind, size: 'none' \| 'length' \| 'precision' }` | `db/dialect-types.ts`  |
| `INDEX_METHODS` | `Record<Dialect, string[]>`                                                                           | `db/dialect-types.ts`  |
| `DIALECT_HINTS` | one line per dialect (frame 152)                                                                      | `db/dialect-types.ts`  |
| `DialectPlan`   | `{ from, to, changes: ColumnChange[], kept: KeptColumn[] }`                                           | `db/dialect-change.ts` |

## UI state (Zustand, never saved)

| Field            | Shape                                      | Lifecycle                                       |
| ---------------- | ------------------------------------------ | ----------------------------------------------- |
| `drawer.mode`    | adds `'enum'` with `enumId`                | closes when the enum is removed                 |
| `tableDrawer`    | `{ tab, expandedColumnId, focusColumnId }` | reset on selection change                       |
| `dialectConfirm` | `DialectPlan \| null`                      | set by the select, cleared on confirm or cancel |
