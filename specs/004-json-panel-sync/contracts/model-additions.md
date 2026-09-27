# Contract: additions to `@sododeck/model` (004)

These additions are additive to the 002 contract (`specs/002-yjs-model/contracts/model-api.md`) and to
the 003 additions (`specs/003-canvas-basic/contracts/model-additions.md`). Nothing existing changes.
They live in the model because the model owns the deck file text (`serializeDeck`) and the
canonical key order (constitution II).

```ts
type EntryCollection = Collection | 'rules';

interface Entry {
  collection: EntryCollection;
  value: unknown; // a plain object of that collection, e.g. from createDeckSnapshot().get()
}

/** Text of one deck object exactly as it appears in the file, without the file's nesting indent. */
function serializeEntry(collection: EntryCollection, value: unknown): string;

/** Text of a JSON array of deck objects, each formatted as in the file. */
function serializeEntries(entries: readonly Entry[]): string;
```

## Guarantees (tested in `packages/model/test/serialize-entry.test.ts`)

- **Same text as the file**: for every object `o` at index `i` of collection `c` in a deck `d`,
  `serializeEntry(c, o)` equals the lines of `o` inside `serializeDeck(d)`, with the file's
  4-space nesting indent removed and without the trailing comma. The test runs this for every
  collection of the round-trip fixtures.
- **Canonical key order** even when `value` has keys in another order: the result equals
  `serializeEntry(c, canonicalizeEntry(c, value))`.
- **Array form**: `serializeEntries(es)` equals `JSON.stringify(es.map(canonical), null, 2)`. For
  an empty list it returns `"[]"`. No trailing newline (unlike `serializeDeck`, which ends with
  `\n` as a file does).
- **Pure**: no Yjs access, no DOM, safe in workers.
- **Performance**: `serializeDeck` on a 500-node / 1,000-edge deck with descriptions, tags and
  links stays under 16 ms (perf test, research R2). If it does not, move serializing to a worker.
