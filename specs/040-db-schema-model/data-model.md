# Data Model: Database Schema Model (040)

Entities of [spec.md](spec.md) as stored in `.sododeck.json` (schema v1, additive) and in the
deck's Yjs document (layout 2, ADR 0021). Decisions and alternatives: [research.md](research.md).
Exact JSON Schema text: [contracts/file-format.md](contracts/file-format.md).

## File (root) additions

Declared in this order after `fieldDefaults`, before `nodes`:

| Key       | Type                                             | Absent means | Notes                                                     |
| --------- | ------------------------------------------------ | ------------ | --------------------------------------------------------- |
| `dialect` | `"generic" \| "postgres" \| "mysql" \| "sqlite"` | `generic`    | One per deck (DB11). The editor removes it for Generic.   |
| `enums`   | `DbEnum[]`                                       | no enums     | Written whenever stored, even `[]` (round-trip as given). |

## Table (a node with `type: "db-table"`)

Existing node fields keep their meaning: `title` = table name, `description` = note (markdown),
`style`, `owner`, `tags`, `links`, `group`, `parent` (the Database card it sits in), `position`,
`size`. New optional keys, declared after `style`:

| Key        | Type                         | Rule                                                          |
| ---------- | ---------------------------- | ------------------------------------------------------------- |
| `schema`   | text, 1–64 chars, no newline | Namespace (`public`, `billing`).                              |
| `columns`  | `DbColumn[]`                 | Ordered. Empty list valid (a sketch).                         |
| `indexes`  | `DbIndex[]`                  |                                                               |
| `checks`   | `DbCheck[]`                  | Table-level check constraints.                                |
| `expanded` | boolean                      | DB9 "Show all n columns" choice; absent = collapsed to limit. |
| `detail`   | `"names" \| "keys" \| "all"` | Per-table detail level; absent = the deck / zoom default.     |

On a node whose type is not `db-table` these keys are valid, kept on save and ignored (FR-006).

## DbColumn

| Key           | Type                         | Rule                                                             |
| ------------- | ---------------------------- | ---------------------------------------------------------------- |
| `id`          | `Id`                         | Required. Unique in the database-parts scope.                    |
| `name`        | text, non-empty              | Required. Free text (quoting is the exporter's job).             |
| `type`        | text, non-empty              | Required. As written (`varchar`, `timestamptz`, an enum's name). |
| `size`        | `^[0-9]{1,6}(,[0-9]{1,6})?$` | Length or precision[,scale].                                     |
| `pk`          | boolean                      | Composite PK = several columns with `pk`. Order = column order.  |
| `notNull`     | boolean                      |                                                                  |
| `unique`      | boolean                      |                                                                  |
| `increment`   | boolean                      | Auto-increment / identity.                                       |
| `default`     | string \| number \| boolean  | A value. **S14:** never with `defaultExpr`.                      |
| `defaultExpr` | text, non-empty              | An SQL expression (`now()`).                                     |
| `check`       | text, non-empty              | Column check expression.                                         |
| `enumRef`     | `Id`                         | An id in `enums`. Dangling → problem, kept.                      |
| `note`        | text                         | Plain text.                                                      |

The editor writes flags as `true` or removes them; a file's `false` is valid and kept.

## DbIndex

| Key       | Type                                 | Rule                                                    |
| --------- | ------------------------------------ | ------------------------------------------------------- |
| `id`      | `Id`                                 | Required, database-parts scope.                         |
| `name`    | text, non-empty                      |                                                         |
| `columns` | `(Id \| { expr: text })[]`, ≥ 1 item | Required. Column ids of the same table, or expressions. |
| `unique`  | boolean                              |                                                         |
| `method`  | `^[a-z][a-z0-9_]{0,31}$`             | `btree`, `hash`, `gin`… (lists per dialect: 043).       |
| `note`    | text                                 | Plain text.                                             |

## DbCheck

| Key    | Type            | Rule                            |
| ------ | --------------- | ------------------------------- |
| `id`   | `Id`            | Required, database-parts scope. |
| `name` | text, non-empty |                                 |
| `expr` | text, non-empty | Required.                       |

## DbEnum and DbEnumValue

| Key      | Type            | Rule                              |
| -------- | --------------- | --------------------------------- |
| `id`     | `Id`            | Required, database-parts scope.   |
| `name`   | text, non-empty | Required.                         |
| `schema` | text            | Namespace, as on tables.          |
| `note`   | text            | Plain text.                       |
| `values` | `DbEnumValue[]` | Required (may be empty). Ordered. |

`DbEnumValue { id (database-parts scope), name (non-empty), note? }`.

## Relationship (edge) additions

Appended after `style`:

| Key            | Type                                                                    | Rule                                                              |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `fromColumns`  | `Id[]`, ≥ 1, unique                                                     | Columns of the `from` table, in key order.                        |
| `toColumns`    | `Id[]`, ≥ 1, unique                                                     | Columns of the `to` table, paired by position with `fromColumns`. |
| `cardinality`  | `"1-1" \| "1-n" \| "n-1" \| "n-n"`                                      | Read from → to.                                                   |
| `fromOptional` | boolean                                                                 | The `from` side may be absent (zero-or-…).                        |
| `toOptional`   | boolean                                                                 |                                                                   |
| `onDelete`     | `"cascade" \| "restrict" \| "set-null" \| "set-default" \| "no-action"` |                                                                   |
| `onUpdate`     | same                                                                    |                                                                   |

Name = `label`; colour = `style.color`. Self-reference (`from === to`) and several edges between
one pair of tables are valid. Column keys on an end whose card is not a `db-table` are kept and
ignored.

## Validation rules

| Where                       | Rule                                                                                         | Outcome                              |
| --------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ |
| Schema (Zod + Ajv)          | Shapes, enums, patterns, `additionalProperties: false` on every new object                   | File refused with path + message     |
| Schema, `semantic-rules.ts` | **S14** a column has at most one of `default` / `defaultExpr`                                | File refused                         |
| Schema, `semantic-rules.ts` | **S15** non-empty `index.columns`, `fromColumns`, `toColumns` (only if Zod drops `minItems`) | File refused                         |
| Model, `load-checks.ts`     | Duplicate id in the database-parts scope                                                     | File refused, every location named   |
| Model, `problems.ts`        | `db-dangling-reference`: index part / column end / `enumRef` naming nothing                  | Kept, listed in Problems             |
| Model, `problems.ts`        | `db-composite-mismatch`: `fromColumns.length ≠ toColumns.length`                             | Kept, listed in Problems             |
| Model ops                   | Unknown ids in a patch (end columns, index parts, `enumRef`)                                 | `missing-reference`, nothing written |

## Yjs layout (additions to `deck.ts` documentation)

| Path                                        | Type               | Notes                                                        |
| ------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `nodes.<id>.columns`                        | `Y.Map<id, Y.Map>` | Items: plain values + `$order`. Present only when stored.    |
| `nodes.<id>.indexes`                        | `Y.Map<id, Y.Map>` | `columns` is a whole value (array) inside each item.         |
| `nodes.<id>.checks`                         | `Y.Map<id, Y.Map>` |                                                              |
| `nodes.<id>.schema` / `expanded` / `detail` | plain              | Last write wins.                                             |
| `edges.<id>.fromColumns` … `onUpdate`       | plain              | Whole values; last write wins.                               |
| `meta.dialect`                              | plain              |                                                              |
| `meta.enums`                                | `Y.Map<id, Y.Map>` | Lazy, like `meta.fields`; each enum's `values` a child list. |

`TextKind` gains `dbColumn`, `dbIndex`, `dbCheck`, `enum`, `enumValue` with no text fields
(`rule`'s `column` kind is unrelated and unchanged).

## Lifecycle

- **Create:** from a file (`fromJSON`), `add('nodes', { type: 'db-table', … })`, `addColumn`,
  `addIndex`, `addCheck`, `addEnum`, `addEnumValue`, paste (new ids, R10).
- **Change:** field ops; renames never touch other objects (ids only).
- **Move:** `moveColumn` / `moveIndex` / `moveCheck` / `moveEnum` / `moveEnumValue` write one
  order key.
- **Remove:** cascades of research R9; one undo step each; table removal uses the node cascade.
