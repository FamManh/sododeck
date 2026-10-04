# Contract: file format and model operations

## Schema addition (`packages/schema/schema/v1.json`)

On `Step` (declared after `ruleInputs`, so it is last in key order):

```jsonc
"touches": {
  "type": "array",
  "description": "Tables, and optionally columns, this step reads or writes (049). Absent means none.",
  "items": { "$ref": "#/$defs/Touch" }
}
```

New `$defs/Touch` (`additionalProperties: false`, required `table`, `access`):

```jsonc
{
  "table": { "$ref": "#/$defs/Id", "description": "Id of the table node." },
  "column": {
    "$ref": "#/$defs/Id",
    "description": "Id of one column of that table; absent means the whole table.",
  },
  "access": { "enum": ["read", "write"], "description": "Whether the step reads or writes it." },
}
```

Constraints that JSON Schema cannot express (generators drop them) go in
`packages/schema/src/semantic-rules.ts` as **S15**: no two touches in a step share the same
`(table, column)` pair.

Cross-reference checks (table exists and has columns; column belongs to that table) are
referential integrity, so they live in `packages/model/src/integrity.ts`, not in the schema.

No `version` bump (additive, optional). Not a breaking change.

## Schema tasks (per `packages/schema/CLAUDE.md`)

1. Edit `v1.json` (every property has a `description`, local non-recursive `$ref`, no `default`).
2. `pnpm schema:generate`; `generate:check` must be clean.
3. Extend `examples/full.sododeck.json` (the coverage test requires every field).
4. Add valid and invalid fixtures (duplicate pair, bad `access`, missing `table`); Ajv/Zod parity
   stays green.

## Model operations (`packages/model`)

All writes go through `DeckEditor`; each is one undoable transaction.

| Op                                             | Effect                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `addTouch(stepId, { table, column?, access })` | Appends; rejects a duplicate `(table, column)`; rejects a column not in `table`.                      |
| `setTouchAccess(stepId, index-or-key, access)` | Flips read / write.                                                                                   |
| `removeTouch(stepId, index-or-key)`            | Removes one entry.                                                                                    |
| `setTableOwner(tableId, cardId \| null)`       | Sets or clears `parent`; requires `cardId` to be a `database` node; keeps columns, edges and touches. |

Cascade (`ops/cascade.ts`):

- `removeNode(table)`: remove every touch with `table === id` (table and column entries).
- `removeColumn(col)`: remove every touch with `column === col`.
- `removeNode(card)`: unchanged (children lose `parent`); `previewRemoval` reports the tables that
  stay so the dialog can say "n tables are kept and become unowned".

Integrity (`integrity.ts`): report a touch whose `table` is missing or has no `columns`, or whose
`column` is not a column of `table`. These are errors for imported files; the editor never
creates them.

## Round-trip tests (`packages/model/test`)

- JSON → Yjs → JSON is identical for a deck with touches (table-only, column, read, write).
- Rename a table and a column: touches still resolve.
- Delete a table / a column: touches removed, step kept, undo restores them.
- Move a table between cards and clear its owner: columns, edges and touches unchanged.
