# Contract: Schema sync pipeline (`apps/app/src/db/sync`)

Pure TypeScript, same boundary as `db/export` and `db/import`: a `SododeckFile` snapshot and a
request in, data out; no React, DOM, Yjs or `editor/` imports. Types in
[data-model.md](../data-model.md).

## Worker request (extends `db/import/import-client.ts`)

```ts
type ImportRequest =
  | { kind: 'preview' | 'plan'; source; target } // unchanged (044)
  | { kind: 'read-dbml'; text: string }; // new

interface ReadDbmlResult {
  schema: RawSchema; // empty when there are syntax errors
  problems: TextProblem[]; // every compiler diagnostic, with ranges
}
```

- Loads only `@dbml/parse` (never the SQL parsers).
- Text over the 044 limit (5 MB) → one `syntax` problem at 1:1, no parse.

## `readDbml` change (`db/import/read-dbml.ts`)

- Returns all diagnostics (today: first only) as `TextProblem`s with start and end positions.
- Records the line of every `TableGroup`, sticky `Note`, `headercolor`, `Project`, ref colour and
  `records` block so `planSchemaSync` can warn on them (`not-an-input`).
- 044 import behaviour is unchanged: the dialog still shows the first error.

## `planSchemaSync`

```ts
function planSchemaSync(
  deck: SododeckFile,
  raw: RawSchema,
  context: SyncContext,
): { plan: SchemaPlan; problems: TextProblem[] };
```

- Problems with `severity: 'error'` ⇒ `plan.isEmpty === true` (nothing to apply).
- Deterministic for a given input and `newId`.
- `planSchemaSync(deck, read(writeDbml(deck, scope)), ctx).plan.isEmpty === true` for every
  fixture the writer can express (SC-004).
- Never puts position, size, colour, tags, owner, links, lock, group, fields, `expanded`,
  `detail` or enum colour in a patch.
- In `selection` scope, never removes or patches a table outside `baseline` unless it is new in
  the text.

## `applySchemaPlan`

```ts
function applySchemaPlan(
  editor: DeckEditor,
  plan: SchemaPlan,
  options: { merge: string },
): { addedTableIds: Id[]; removedTables: { id: Id; name: string }[] };
```

- One `editor.batch(fn, { merge })`; writes only through `DeckEditor` ops.
- Kept ids: matched objects and memory restores keep theirs; new objects use ids from the plan.
- Throws nothing for a plan from `planSchemaSync` on the same snapshot; if the deck changed
  between plan and apply (remote update), the panel re-reads and re-plans instead of applying a
  stale plan (snapshot version check).

## `normaliseRawTable` / `normaliseDeckTable`

Shared by the planner and the round-trip tests: column checks beyond the first become table
checks, quoted default vs expression, `increment` only with `pk`, notes trimmed.

## Model (`packages/model`)

```ts
interface DeckEditor {
  batch(fn: () => void, options?: { merge?: string }): void; // `options` new in 046
}
```

See data-model "Model API addition" for the merge rule.
