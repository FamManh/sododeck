# Data Model: Database Architecture Link

Only one persistent addition: `Step.touches`. Everything else uses fields that already exist.

## Persistent (in the Yjs document and `.sododeck.json`)

### Step.touches _(new, optional)_

An ordered list of **Touch** entries on a flow step.

| Field    | Type                  | Rules                                                                                   |
| -------- | --------------------- | --------------------------------------------------------------------------------------- |
| `table`  | node id               | Required. Must be a node that has `columns` (a table).                                  |
| `column` | column id             | Optional. When set, must be a column of `table`. Column ids are unique across the deck. |
| `access` | `"read"` \| `"write"` | Required.                                                                               |

Rules:

- Absent or empty list means the step touches nothing (playback exactly as before).
- No two entries share the same `(table, column)` pair (a table row and each column row appear at
  most once). A table entry and its own column entries may coexist.
- A column entry implies its table for lighting and the chip; the table need not also be listed.
- References are by id. Rename changes nothing. Deleting a table removes its table and column
  entries; deleting a column removes that entry. Steps are never deleted by this cleanup.
- Round-trip is lossless; key order follows the schema's declared order.

### Table owner _(existing field, new meaning enforced by the UI)_

`node.parent` of a node with `columns` = the id of the owning `database` card.

- At most one owner (one field).
- Created inside a drilled-in card → `parent` = that card.
- "Move to database…" sets it; "Remove from card" clears it (both in one transaction).
- Deleting the card clears `parent` on its tables (existing `removeNode` behaviour).
- Tables, relationships, indexes and enums are exported whatever the owner.
- No schema change: `parent` already exists and means "one level up".

## Derived (never stored)

| Name                             | From                                                                                          | Used by                                |
| -------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| `tablesOf(card)`                 | nodes with `parent === card.id` and `columns`                                                 | card face "n tables inside", SQL scope |
| `deckDialect`                    | root `dialect`                                                                                | dialect chip, export                   |
| `touchedTables(step)`            | `step.touches` (table or column entries) → table ids with strongest access (write beats read) | lit tables, card chip                  |
| `touchedColumns(step)`           | column entries → `{ columnId → access }`                                                      | R / W marker, forced-visible rows      |
| `cardChip(card, step)`           | tables of the card in `touchedTables(step)`, in touch order                                   | "writes orders +1"                     |
| `playerNotes(step, scope, view)` | touched tables with no owner / another card / hidden by the view filter                       | "also touches …" lines                 |

State transitions: none beyond ownership edits and touch edits (all undoable as one step each).

## Samples (data, not code)

`shop`, `saas-auth`, `blog` as `.sododeck.json` with `packs: ['architecture','database']`, one or
more `database` cards, tables whose `parent` is a card, and (Shop, SaaS auth) a flow whose steps
carry `touches`.
