# Contract: format and model additions (041)

On top of 040 ([../../040-db-schema-model/contracts/](../../040-db-schema-model/contracts/)).
All optional and additive; no version bump.

## `packages/schema/schema/v1.json`

```jsonc
"TableDisplay": {
  "type": "object", "additionalProperties": false,
  "description": "How tables draw in this deck. Absent keys: Auto detail and every part shown.",
  "properties": {
    "detail":       { "$ref": "#/$defs/DbDetail" },
    "hideTypes":    { "type": "boolean" },
    "hideNullable": { "type": "boolean" },
    "hideNotes":    { "type": "boolean" },
    "hideIndexes":  { "type": "boolean" }
  }
}
```

- Root: `tableDisplay` (`$ref TableDisplay`), declared after `enums`.
- `DbEnum.properties.color` (`$ref ColorRef`), declared after `note`.
- `examples/full.sododeck.json`: a `tableDisplay` with `detail` and one hide flag; one enum with
  a palette colour and one with a hex colour.
- Invalid fixtures: `tableDisplay.detail: "auto"`, `tableDisplay.showTypes`, `hideNotes: "yes"`,
  enum `color: "purple-ish"`.

## `@sododeck/model`

```ts
/** Patches the deck's table display; `null` removes a key; the object is removed when empty. One undo step. */
setTableDisplay(patch: Patch<TableDisplay>): void;
```

- `hide*: false` is written as a removal; `detail: null` means Auto.
- `updateEnum` patch (040) gains `color` (`null` clears).
- `tableDisplayOf(file): Required<…>` pure reader with defaults (`detail: 'auto'`, all shown).
- Round-trip cases: `tableDisplay` with every key; enum colours (name and hex); a deck without
  either stays byte-identical.
- Concurrency case: two docs set `hideTypes` and `hideNotes` → both kept.
