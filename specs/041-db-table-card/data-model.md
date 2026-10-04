# Data Model: Table Card (041)

041 reads 040's model ([../040-db-schema-model/data-model.md](../040-db-schema-model/data-model.md))
and adds two optional file fields. Everything else here is derived, never stored.

## Stored (file and Yjs)

### Root `tableDisplay` (new, after `enums`)

| Key            | Type                         | Absent means |
| -------------- | ---------------------------- | ------------ |
| `detail`       | `"names" \| "keys" \| "all"` | Auto         |
| `hideTypes`    | boolean                      | types shown  |
| `hideNullable` | boolean                      | "?" shown    |
| `hideNotes`    | boolean                      | notes shown  |
| `hideIndexes`  | boolean                      | footer shown |

`additionalProperties: false`. The editor writes `true` or removes a hide flag, removes `detail`
for Auto, and removes the object when it would be empty, so an untouched deck stays
byte-identical. Yjs: `meta.tableDisplay` is a `Y.Map`, created on first write, per-key writes.

### `DbEnum.color` (new, after `note`)

`ColorRef` (palette name or `#rrggbb`), optional. Absent = neutral chip.

### Read from 040 (unchanged)

Table node `title`, `description`, `style`, `schema`, `columns`, `indexes`, `detail`, `size.width`;
edges' `from`, `to`, `fromColumns`, `toColumns`, `cardinality`; root `enums`.

## Derived (app, per deck snapshot)

| Value                                    | Built from                                                                            | Cached by             |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `fkColumns: Map<tableId, Set<columnId>>` | edges whose end is a table: referencing side (`n` side of `1-n` / `n-1`, else `from`) | `deck.edges` identity |
| `schemaCount`                            | distinct non-empty table `schema`                                                     | `deck.nodes` identity |
| `enumById`                               | `deck.enums`                                                                          | `deck.enums` identity |
| `effectiveDetail(table)`                 | `table.detail ?? deck.tableDisplay.detail ?? 'all'`                                   | —                     |

### TableLayout (pure, `table-layout.ts`)

| Field                                 | Meaning                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`                     | box; height = padding + header + gap + title + note + hairline + rows × 24 + pill + footer + bottom                              |
| `typeName`                            | "Table" or "Table · schema"                                                                                                      |
| `titleLines`, `titleCut`, `noteLines` | as card layout; note ≤ 2 lines, absent when `hideNotes`                                                                          |
| `keySlot`                             | 16 or 30                                                                                                                         |
| `rows[]`                              | `{ columnId, glyphs: ('pk'\|'fk'\|'unique')[], name, nameCut, type, typeCut, nullable, enum?: { name, color } }` in stored order |
| `hiddenCount`                         | columns not drawn (Keys: non-key columns; Names: all) → "+n columns" / "n columns"                                               |
| `footer`                              | "1 index" / "n indexes" / absent                                                                                                 |
| `compact`                             | System content: `{ pkCount, fkCount, columnCount }`                                                                              |

Rules: rows never change height; `type` is absent when `hideTypes`; `nullable` false when
`hideNullable`; Keys keeps PK and FK rows; a table with no columns has no hairline, rows or footer.

## UI-only state (Zustand, not document data)

- `enumPopover: { nodeId, columnId } | null` — one open popover per canvas.
