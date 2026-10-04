# Data Model: Schema Code Panel (DBML)

**Feature**: `046-db-code-panel` · **Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md)

**No change to the file format.** `packages/schema` is untouched; the deck stores tables,
columns, indexes, checks, enums and relationships exactly as 040–043 defined them. Everything
new below is UI-only state or in-memory pipeline data.

## Model API addition (`packages/model`)

| Addition              | Shape                                                               | Rule                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `batch(fn, options?)` | `options?: { merge?: string }`                                      | Without `merge`: unchanged (new undo step). With `merge`: if the previous tracked transaction had the same key, merge into its undo item whatever the time gap; otherwise start a new item. |
| End of a merge run    | any tracked write with another key, `undo`, `redo`, `stopCapturing` | The next `batch(…, { merge: sameKey })` after one of these starts a new undo item.                                                                                                          |

Round-trip is unaffected (no format change); unit tests cover merging, splitting and redo.

## UI preferences (`state/json-panel-prefs.ts`, localStorage, per browser)

| Field               | Type                                | Default       | Notes                                     |
| ------------------- | ----------------------------------- | ------------- | ----------------------------------------- |
| `open`, `height`    | unchanged                           |               |                                           |
| `tab`               | `'selection' \| 'deck'`             | `'deck'`      | JSON scope, unchanged                     |
| `format`            | `'json' \| 'dbml' \| 'sql'`         | `'json'`      | new (FR-002)                              |
| `schemaScope`       | `'selection' \| 'schema'`           | `'selection'` | new; DBML and SQL share it                |
| `sqlPreviewDialect` | `'postgres' \| 'mysql' \| 'sqlite'` | `'postgres'`  | new; used only for Generic decks (FR-022) |

Invalid or missing stored fields fall back one by one.

## DBML edit session (UI only, `editor/code/use-dbml-session.ts`, lives while the panel is open)

| Field      | Type                                                         | Notes                                                                                    |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `id`       | string                                                       | new per panel open; part of the merge key                                                |
| `state`    | `'synced' \| 'dirty' \| 'invalid' \| 'applied' \| 'confirm'` | research R8                                                                              |
| `baseline` | `{ text: string; tableIds: Id[] }`                           | writer output and the tables it contained (bounds removals in Selection, FR-015)         |
| `problems` | `TextProblem[]`                                              | from the last read + plan                                                                |
| `burst`    | number                                                       | merge key = `dbml:<id>:<burst>`; +1 after 2 s idle, blur, undo / redo, other local write |
| `removed`  | `SessionMemory`                                              | research R7                                                                              |
| `readSeq`  | number                                                       | latest worker request; older replies are dropped                                         |

### State transitions

```text
synced  --type-->            dirty
dirty   --pause, errors-->   invalid
dirty   --pause, clean-->    applied (focus) | synced (no focus)
dirty   --pause, removes all tables--> confirm
invalid --type-->            dirty
confirm --Apply-->           applied ; --type--> dirty
applied --type-->            dirty ; --blur--> synced (text rewritten)
any     --blur/tab switch/close with dirty|invalid|confirm--> synced (text discarded)
```

## Pipeline data (pure, `db/sync/`)

### `TextProblem`

| Field                  | Type                   |
| ---------------------- | ---------------------- |
| `line`, `column`       | number (1-based)       |
| `endLine`, `endColumn` | number                 |
| `severity`             | `'error' \| 'warning'` |
| `message`              | string                 |
| `suggestion?`          | string                 |
| `code`                 | `ProblemCode` (below)  |

`ProblemCode`: `syntax`, `unknown-setting`, `duplicate-table`, `duplicate-column`,
`duplicate-enum`, `duplicate-index`, `missing-ref-table`, `missing-ref-column`,
`enum-default`, `enum-in-use`, `locked`, `not-an-input` (warning), `replaced` (warning).

### `SyncContext`

| Field      | Type                                                          | Notes                            |
| ---------- | ------------------------------------------------------------- | -------------------------------- |
| `scope`    | `{ kind: 'schema' } \| { kind: 'selection'; baseline: Id[] }` |                                  |
| `memory`   | `SessionMemory`                                               |                                  |
| `newId`    | `(prefix) => Id`                                              | injected, deterministic in tests |
| `viewport` | rect                                                          | placement in an empty deck       |

### `SchemaPlan`

| Field             | Type                                                           | Notes                                            |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `addTables`       | `{ node: NewTableNode; restoredFrom?: 'memory' }[]`            | node with columns, indexes, checks and position  |
| `updateTables`    | `{ id; patch: TablePatch }[]`                                  | name, schema, note only                          |
| `columnOps`       | `{ tableId; adds; updates; removes; order: Id[] }[]`           | same for indexes and checks                      |
| `enumOps`         | `{ adds; updates; removes; valueOps }`                         |                                                  |
| `relationshipOps` | `{ adds: NewEdge[]; updates: { id; patch }[]; removes: Id[] }` |                                                  |
| `removeTables`    | `{ id; name }[]`                                               | named in the toast (FR-016a)                     |
| `removesAll`      | boolean                                                        | Whole schema and every table removed → `confirm` |
| `isEmpty`         | boolean                                                        | no operation → nothing written                   |

Apply order inside one merged batch: enums added → tables added / restored → table patches →
parts (adds, updates, moves, removes) → relationships → enum removals → table removals.
Removals last so cascades never hit something the plan still patches.

### `SessionMemory`

Map from lower-cased `schema.name` → `{ node: Node (JSON); edges: Edge[] }` captured from the
snapshot before removal. Cleared on panel close.

## Validation rules (from FR-008)

| Rule                                                                         | Code                                 | Severity |
| ---------------------------------------------------------------------------- | ------------------------------------ | -------- |
| Two tables with the same `schema.name` (case-insensitive)                    | `duplicate-table`                    | error    |
| Two columns with the same name in a table                                    | `duplicate-column`                   | error    |
| Two enums / two named indexes with the same name                             | `duplicate-enum` / `duplicate-index` | error    |
| Ref end table not in text and (Selection) not in the deck                    | `missing-ref-table`                  | error    |
| Ref end column not in its table                                              | `missing-ref-column`                 | error    |
| Default not among the column's enum values                                   | `enum-default`                       | error    |
| Enum removed while a column (in or out of scope) uses it                     | `enum-in-use`                        | error    |
| Plan changes or removes a locked table                                       | `locked`                             | error    |
| `TableGroup`, sticky `Note`, `headercolor`, `Project`, ref colour, `records` | `not-an-input`                       | warning  |
| Ambiguous rename turned into remove + add                                    | `replaced`                           | warning  |
