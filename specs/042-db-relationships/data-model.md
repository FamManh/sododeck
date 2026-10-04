# Data Model: Table Relationships (042)

042 reads 040's relationship fields ([../040-db-schema-model/data-model.md](../040-db-schema-model/data-model.md))
and 041's table layout ([../041-db-table-card/data-model.md](../041-db-table-card/data-model.md)),
and adds one optional file field. Everything else is derived, never stored.

## Stored (file and Yjs)

### Root `relationshipDisplay` (new, after `tableDisplay`)

| Key        | Type                           | Absent means           |
| ---------- | ------------------------------ | ---------------------- |
| `hideEnds` | boolean                        | cardinality ends shown |
| `labels`   | `"hover" \| "always" \| "off"` | follow the Labels tool |
| `notation` | `"numeric"`                    | crow's foot            |

`additionalProperties: false`. The editor writes `true` or removes `hideEnds`, removes `labels`
for "follow" and `notation` for crow's foot, and removes the object when it would be empty, so an
untouched deck stays byte-identical. Yjs: `meta.relationshipDisplay` is a `Y.Map`, created on
first write, per-key writes (two tabs changing different keys both keep theirs).

### Written by 042 on an edge (040 fields, unchanged shapes)

| Action           | Fields written                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create (drag, C) | `from`, `to`, `fromColumns: [c]`, `toColumns: [t]`, `cardinality: "n-1"`, `fromOptional: true`, `toOptional: !c.notNull` (omitted when false), `style.shape` = last line shape when set |
| Reconnect end    | `from` or `to`, and `fromColumns` or `toColumns` (single column); everything else kept                                                                                                  |
| Delete           | the edge (existing delete)                                                                                                                                                              |

`toOptional` is written only when `true` (absent = mandatory), matching how 040 stores booleans.
A primary-key column counts as not null.

### Read (unchanged)

Edges' `from`, `to`, `fromColumns`, `toColumns`, `cardinality`, `fromOptional`, `toOptional`,
`onDelete`, `label`, `style.color`, `style.shape`, `route.points`; tables' columns (`name`, `type`,
`size`, `notNull`, `pk`, `enumRef`); 041's `TableLayout`.

## Derived (app)

| Value                                           | Built from                                                                                                                    | Cached by                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `connectedColumns: Map<tableId, Set<columnId>>` | every column end of every edge, both sides                                                                                    | `deck.edges` identity               |
| `isRelationship(edge)`                          | both ends are `db-table` cards and at least one end has columns, or a cardinality is set                                      | —                                   |
| `RelationshipEnds` (`data.rel`)                 | per end: `offsets: number[]` (row centre y from card top, one per visible member), `kind: 'row' \| 'pill' \| 'title'`, `mark` | edge + both tables' layout identity |
| `endOf(cardinality, side, optional)`            | `'one' \| 'zero-one' \| 'one-many' \| 'zero-many'` or none                                                                    | —                                   |
| sides                                           | `relationshipSides(fromBox, toBox)` → `left` / `right` per end, live                                                          | per render                          |
| label text                                      | `relationshipLabel(edge, tables)`                                                                                             | with the edge                       |
| `FocusSet` for a column                         | `columnFocusSet(deck, tableId, columnId)` → `edges`, `members`, `rows`                                                        | per hover                           |

### Geometry rules

- Row centre y = `layout.rowsTop + 24 i + 12`; hidden column → "+n" pill centre if shown, else
  title centre; missing column id → title centre.
- Stub length 24 on curved / elbow; composite: 6 px member stubs, joining segment, connector from
  its midpoint.
- Self-loop bulge = `max(56, |Δy| / 2)`.
- Crow's foot: toes 12 long, ±6; bar 16 at 10 (one), 8 (zero-one), 16 (one-many); ring r 4 at 17
  (zero-one) or 20 (zero-many), filled with the canvas colour.
- 1 / n notation: "1", "0..1", "1..n", "0..n" in Mono 10.5 beside the end, offset 8 along the side
  normal and 8 across.
- Below 90 % zoom: ordinary outline anchors, marks kept, may bundle.

## UI-only state (Zustand, not document data)

- `columnConnect: { source: { tableId, columnId }, mode: 'create' | 'reconnect', edgeId?, end?,
point, target?: { tableId, columnId }, mismatch?: string } | null` — the drag in progress.
- `focusedRow: { tableId, columnId } | null` — keyboard row focus inside a table.
- `hoverFocus` (034) gains `source: 'column'` with `{ tableId, columnId }`.

## Lifecycle

Created by drag or C → drawn → reconnected / deleted (042) → settings edited (043) → linted (047)
→ exported to SQL (045). Removing a column or table cleans relationships (040, unchanged).
