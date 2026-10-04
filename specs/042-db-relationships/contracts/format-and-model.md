# Contract: format and model (042)

## Schema (`packages/schema/schema/v1.json`)

Root property `relationshipDisplay` (declared after `tableDisplay`), `$ref` to:

```json
"RelationshipDisplay": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "hideEnds": { "type": "boolean", "description": "Relationships (042): draw plain ends instead of cardinality marks." },
    "labels": { "enum": ["hover", "always", "off"], "description": "Relationships (042): label visibility; absent follows the Labels tool." },
    "notation": { "enum": ["numeric"], "description": "Relationships (042): 1 / n text instead of crow's foot; absent is crow's foot." }
  }
}
```

- No `default` keyword (schema rule). Generated TS type `RelationshipDisplay`, Zod schema, Ajv /
  Zod parity fixtures: empty object, every key, an unknown key (refused with its path), a wrong
  enum value (refused).
- Example deck in `examples/` gains `relationshipDisplay: { labels: "always" }`.

## Model (`packages/model`)

| API                                             | Behaviour                                                                                                                                                                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read` / `write`                                | `meta.relationshipDisplay` ↔ root `relationshipDisplay`; absent when the map is empty                                                                                                                                                          |
| `editor.setRelationshipDisplay(patch)`          | `patch: { hideEnds?: boolean \| null; labels?: 'hover' \| 'always' \| 'off' \| null; notation?: 'numeric' \| null }`; `null` / `false` / default removes the key; removes the map when empty; validated with Zod before writing; one undo step |
| `editor.add('edges', …)` / `update('edges', …)` | unchanged (040); 042 calls them with column ends; `assertColumnEnds` still validates                                                                                                                                                           |

Tests (`packages/model/test`):

- Round-trip: a deck with every `relationshipDisplay` key; a deck without it stays byte-identical
  after an unrelated edit.
- Ops: set, change, clear each key; empty → object removed; invalid value refused with nothing
  written; undo restores.
- Concurrency: two docs set different keys, merge keeps both.

## App derived helpers (pure, `apps/app/src/editor`)

| Function                                                  | Contract                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `rowAnchorY(layout, columnId)`                            | `{ y, kind }`; row centre, else pill, else title (R2)                                     |
| `connectedColumns(deck)`                                  | `Map<tableId, Set<columnId>>`, both sides, cached by `edges`                              |
| `relationshipSides(fromBox, toBox)`                       | `{ from: 'left' \| 'right', to: … }` (R3); self → right / right                           |
| `endOf(cardinality, side, optional)`                      | mark kind or `undefined` (no cardinality)                                                 |
| `relationshipPath(ends, shape, points?)`                  | `{ d, fromTangent, toTangent, labelAt }`; stubs on curved / elbow, line angle on straight |
| `selfLoopPath(fromY, toY, side, x, shape)`                | loop path, bulge `max(56, Δy / 2)`                                                        |
| `crowPath(at, u, kind)`                                   | `{ d, ring?: { cx, cy } }`                                                                |
| `relationshipLabel(edge, tables)` / `relationshipName(…)` | label text (R10) / accessible name (R18)                                                  |
| `typeMismatch(a, b)`                                      | `"int → uuid"` or `undefined`                                                             |
| `columnTargetAt(point, tables)`                           | `{ tableId, columnId } \| undefined` (row, else single-column PK, else none)              |
| `columnConnectionCheck(deck, from, to)`                   | `{ ok: true } \| { ok: false, existing?: edgeId }`                                        |
| `columnFocusSet(deck, tableId, columnId)`                 | `FocusSet` with `rows`, or `undefined` when the column has no relationship                |
