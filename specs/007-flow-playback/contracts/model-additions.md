# Contract: `@sododeck/model` additions (007)

One additive, serialization-only change. No schema change, no Yjs layout change, no editor op.

## `serializeEntry('steps', step)`

```ts
export type EntryCollection = Collection | 'rules' | 'steps';

serializeEntry('steps', step: Step): string;
serializeEntries([{ collection: 'steps', value: step }]): string;
```

- Implementation: `canonicalizeEntry` resolves `steps` to the item shape of `flows[].steps` (from the schema), so no hand-kept key list.
- Formats one flow step exactly as it appears inside `flows[i].steps` in `serializeDeck` output:
  canonical key order of `$defs/Step` (from the schema, via `key-order.ts`), 2-space indent, no
  nesting indent, no trailing comma or newline.
- `value` is a plain step object (from the snapshot). Unknown keys are kept in the canonical
  fallback order used for other entries.

## Tests (`packages/model/test/serialize-entry.test.ts`)

- For every step of every flow in `packages/schema/examples/full.sododeck.json` (including branch
  steps with `branch`, `rules`, `ruleInputs`), `serializeEntry('steps', step)` re-indented equals
  the corresponding slice of `serializeDeck(file)`.
- A step with only `id` and `edge` serializes to those two keys in order.

No round-trip test change: load and save are untouched (constitution II applies to format
changes; this is text of an existing object).
