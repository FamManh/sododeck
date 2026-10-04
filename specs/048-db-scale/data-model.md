# Data Model: Database Scale

Stored additions are optional keys; a deck without them is byte-identical after a round trip.

## Stored in the deck (packages/schema v1, additive)

| Object     | Field            | Type                         | Meaning                                                                                   | Default (key removed)     |
| ---------- | ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| table node | `expanded` (040) | boolean                      | Show all columns; lifts the 12-row limit at All. **Already exists, first reader is 048.** | absent = limited          |
| deck       | `groupingMode`   | `'schema'`                   | Group tables by schema for the whole deck. Absent = By group.                             | absent                    |
| view       | `schemas`        | string[] (non-empty)         | Show only tables of these schemas (union with `includes`).                                | absent = no schema filter |
| view       | `detail`         | `'names' \| 'keys' \| 'all'` | The view's table detail level.                                                            | absent = deck / table     |

Existing view fields reused: `includes` (explicit tables), `excludeGroups`, `collapsed`,
`positions`, `pinned`.

## Derived (never stored)

- **RowSelection** (inside `TableLayout`): `rows` (shown, stored order), `hidden { count, kind: 'more' | 'all' | 'limit' }`,
  `hiddenIds`, `buttonTop` (the Show all slot, replaces `pillTop` at All), `matchIds` while filtering.
  Rule at All: PK → FK → rest, up to 12, plus every relationship-end column.
- **SchemaGroup**: `{ id: 'schema:<name>', title: <name>, tableIds }`, built by
  `schemaGroupedDeck`; tables without a schema are not grouped.
- **MergedRelationship**: `MergedEdge` whose list items are `{ edgeId, fromTable.column, toTable.column, cardinality }`.
- **NeighbourSet**: selected table + tables one relationship away (either direction) + edges among them.
- **JumpResult**: `{ kind: 'table' | 'column', tableId, columnId?, schema?, type?, key?, hidden: 'view' | 'group' | null }`.

## UI-only state (Zustand)

| State           | Shape                                   | Lifetime                                  |
| --------------- | --------------------------------------- | ----------------------------------------- |
| `tableFilter`   | `{ tableId, text, index } \| null`      | until Esc, selection change or deck close |
| `focusedRow`    | existing `ColumnRef`                    | existing                                  |
| revealed tables | existing `revealed` set of `viewFilter` | until the user leaves the view            |

## Validation

- `groupingMode`: only `'schema'` is stored; any other value fails validation.
- `schemas`: strings; empty array is removed on write; unknown schema names are kept (a schema may
  be re-created) and show no table.
- `detail`: one of three values.
- Stored group ids never start with `schema:` (checked on read; a collision renames nothing but
  makes the virtual id skip) — a test guards it.

## State transitions

- Show all: `expanded` absent ↔ `true`; each is one undo step; filter changes none.
- Switching `groupingMode`: one undo step; collapse lists are untouched (ids differ by prefix).
- Jump to a cut column: `expanded = true` (one step) then selection (UI).
