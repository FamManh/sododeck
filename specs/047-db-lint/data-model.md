# Data Model: Schema Lint (047)

047 changes **no file format**: problems are derived and never stored (ADR 0013). Decisions are in [research.md](research.md); the rule table is in [contracts/lint-rules.md](contracts/lint-rules.md).

## Derived (model, `problems.ts`)

| Entity         | Fields                                                                                           | Notes                                              |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `Severity`     | `'error' \| 'warning'`                                                                           | fixed per kind (`SEVERITY`)                        |
| `Problem`      | existing + `severity`, `column?: { tableId, columnId }`, `fixes?: ProblemFix[]` (replaces `fix`) | JSON, crosses the worker boundary                  |
| `ProblemFix`   | union by `kind` (research R5)                                                                    | data only; applied in the app                      |
| `DeckProblems` | existing + `errors`, `warnings`                                                                  | list sorted errors first                           |
| `ProblemKind`  | existing + 15 `db-*` kinds                                                                       | `PROBLEM_KINDS` order: existing, then new db kinds |

## Derived (app)

| Entity         | Fields                                                                                      | Where                              |
| -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| `ProblemMark`  | existing `count`, `titles`, `label` + `severity`, `rows: Map<columnId, Severity>`, `short?` | `editor/problems/problem-marks.ts` |
| `TableRow`     | `mismatch` removed; `problem?: { severity, title }`                                         | `editor/table-layout.ts`           |
| `JunctionPlan` | `name`, `schema?`, `columns[]`, `position`, `links[]` (two relationships)                   | `db/junction-table.ts`             |

## Moved data (model, `db-types.ts`)

`COMMON_TYPES`, `DIALECT_TYPES`, `INDEX_METHODS`, `DIALECT_HINTS`, `typeEntry`, `commonTypeOf`, `sameColumnType`, `idTypeOf`. No shape change; only the package moves (research R2).

## Document writes (fixes)

Each is one undo step through existing `DeckEditor` ops:

| Fix               | Writes                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `make-pk`         | `updateColumn(tableId, columnId, { pk: true })`                                           |
| `add-id-pk`       | `addColumn(tableId, { name: 'id', type: idTypeOf(dialect), pk: true, notNull: true }, 0)` |
| `match-type`      | `updateColumn` per referencing column (`type`, `size` or `null`), one batch               |
| `create-junction` | add node + columns, two edges with column ends (`n-1`), remove the n–n edge, one batch    |
| `remove-default`  | `updateColumn({ defaultExpr: null })` or `{ default: null }`                              |
| `allow-null`      | `updateColumn({ notNull: null })`                                                         |
| `delete-edge`     | remove the edge (043 Undo toast)                                                          |

## UI state (Zustand, never saved)

`problemFilter`, `problemPopover`, `problemReveal` (contracts/lint-ui.md).
