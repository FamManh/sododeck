# Data Model: Schema Import (044)

044 adds **no** field to `.sododeck.json` and no Yjs path: an import writes the objects 040
defines (dialect, enums, `db-table` nodes with columns / indexes / checks, relationship edges,
groups, stickies). Everything below is transient: worker messages and UI-store state. Decisions:
[research.md](research.md).

## ImportSource (dialog → worker)

| Field      | Type                                          | Rule                                      |
| ---------- | --------------------------------------------- | ----------------------------------------- |
| `text`     | string                                        | ≤ 5 MB (UTF-8 bytes); empty → no request. |
| `fileName` | string?                                       | Drives format and the new-deck name.      |
| `format`   | `'auto' \| 'sql' \| 'dbml'`                   | `auto` → R4.                              |
| `dialect`  | `'auto' \| 'postgres' \| 'mysql' \| 'sqlite'` | SQL only; `auto` → R4.                    |
| `detectFk` | boolean                                       | Default `true` (FR-005).                  |

## ImportTarget (dialog → worker)

| Field           | Type                                                 | Rule                                                         |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `kind`          | `'card' \| 'deck' \| 'new-deck'`                     | First offered is the default (FR-004).                       |
| `cardId`        | Id?                                                  | `kind = 'card'`: the database card selected or drilled into. |
| `deckDialect`   | `Dialect` (`generic \| postgres \| mysql \| sqlite`) | Of the target deck; `generic` for a new deck.                |
| `deckHasTables` | boolean                                              | FR-007 / FR-009.                                             |
| `tableNames`    | `{schema?, name}[]`                                  | Existing tables, for the "already exists" note (FR-015).     |
| `enumNames`     | string[]                                             | Existing enums, same purpose.                                |

## ImportPreview (worker → dialog)

`{ format, detectedDialect: SqlDialect | null, counts: {tables, relationships, enums},
skippedCount, conversions: TypeConversion[], dialectOutcome, error?: ParseError }`

- `dialectOutcome`: `'set'` (deck takes the import's dialect, FR-007), `'convert'` (FR-008),
  `'keep-generic'` (FR-009), `'same'`.
- `ParseError`: `{ line, column?, message }`, 1-based line in the source text. Any error disables
  Import (FR-003).

## ImportPlan (worker → main thread)

| Field         | Type                          | Notes                                                                                               |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `fragment`    | `Fragment` (`model/fragment`) | Tables (`type: 'db-table'`), relationship edges, groups. Plan-local ids; `enumRef` = plan enum ids. |
| `enums`       | `NewDbEnum & {planId}`[]      | Added first; plan ids → real ids rewrite `enumRef` (research R6).                                   |
| `stickies`    | `{text, color?}`[]            | DBML notes; placed under the cluster after layout.                                                  |
| `setDialect`  | `Dialect \| null`             | `null` = leave the deck's dialect.                                                                  |
| `report`      | `ImportReport`                | See below.                                                                                          |
| `suggestions` | `FkSuggestion[]`              | Empty when `detectFk` is off.                                                                       |

Fragment content per object (all 040 fields):

- **Table node**: `id`, `type: 'db-table'`, `title` (name), `schema?`, `description?` (table
  note / comment), `columns[]`, `indexes[]?`, `checks[]?`, `group?` (plan group id),
  `style?` (DBML `headercolor` as hex `ColorRef`). No `position` (set after layout).
- **Column**: `id`, `name`, `type`, `size?`, `pk?`, `notNull?`, `unique?`, `increment?`,
  `default?` xor `defaultExpr?`, `check?`, `enumRef?`, `note?`. Flags written only when `true`.
- **Relationship edge**: `from` (referencing table), `to` (referenced), `fromColumns`,
  `toColumns` (same length, key order), `cardinality` (FR-013), `fromOptional?`, `onDelete?`,
  `onUpdate?` (lower-case, `set-null` form), `label?` (constraint / ref name).
- **Group**: `id`, `title`, `style?`.

## ImportReport (UI store, per deck, not persisted)

| Field         | Type                                                                |
| ------------- | ------------------------------------------------------------------- |
| `source`      | `{fileName?, format, dialect}`                                      |
| `mapped`      | `{tables, relationships, enums, indexes, checks, groups, stickies}` |
| `skipped`     | `{line, excerpt, reason: SkipReason}`[]                             |
| `changed`     | `{line?, target: string, kind: ChangeKind, detail: string}`[]       |
| `suggestions` | `(FkSuggestion & {state: 'open' \| 'accepted' \| 'dismissed'})`[]   |

- `SkipReason`: `view`, `function`, `procedure`, `trigger`, `grant`, `policy`, `partition`,
  `sequence`, `extension`, `data` (INSERT / COPY), `session` (SET / PRAGMA / transaction),
  `drop-or-rename`, `dangling-fk` (target not in import), `parse-error`, `unknown`. Reason text
  per kind lives in `report-text.ts`.
- `ChangeKind`: `type-converted`, `type-kept`, `option-dropped`, `renamed-duplicate`,
  `name-exists`, `enum-name-exists`, `schema-dropped`.

## FkSuggestion

`{ fromTable, fromColumn, toTable, toColumn }` as **real ids after apply** (the plan's ids are
remapped through the paste result), `label` ("orders.customer_id → customers.id"), `cardinality`
and `fromOptional` precomputed (FR-013). State transitions: `open → accepted` (Accept: edge added,
one undo step; Undo returns it to `open`) · `open → dismissed` (Dismiss) · Accept all / Dismiss
all act on every `open` one.

## TypeConversion

`{ from: string, to: string, count: number }`, grouped by source type text; from R10's map.

## Lifecycle

`idle → reading (preview pending) → ready | error → planning → placing (layout) → applied`.
Cancel / close at any state before `applied` terminates the request (`cancel()`), nothing written
(FR-006). `applied` writes once (one batch), shows the toast, opens the report.
