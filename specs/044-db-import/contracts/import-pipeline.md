# Contract: Import pipeline (044)

Module boundaries and function contracts under `apps/app/src/db/import/`. Types: see
[data-model.md](../data-model.md). Pure functions run in Node tests without a browser.

## Worker client

```ts
createImportClient(makeWorker?): {
  preview(source: ImportSource, target: ImportTarget): Promise<ImportPreview>;
  plan(source: ImportSource, target: ImportTarget): Promise<ImportPlan>;
  cancel(): void;      // rejects pending calls with ImportCancelled
  terminate(): void;
}
createInlineImportClient(): same interface, main thread (no Worker support, features.ts)
```

- Messages `{id, request}` → `{id, ok: true, result} | {id, ok: false, error}` (as
  `layout-client.ts`). The worker is created on first call.
- Parsers are `import()`ed inside the worker by format / dialect and cached; nothing from
  `@dbml/parse` or `node-sql-parser` is reachable from the main bundle (checked by the build
  report, R16).

## Pure stages (worker side)

| Function                                          | Contract                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `detectFormat(text, fileName?) → 'sql' \| 'dbml'` | Extension first; else DBML markers (R4).                                                                                                  |
| `detectDialect(statements) → {dialect, scores}`   | `dialect: SqlDialect \| null`; `null` when no lead ≥ 2 (R4).                                                                              |
| `splitSql(text) → Statement[]`                    | Every non-blank, non-comment character of the input belongs to exactly one statement; `line` is the 1-based line of its first token (R2). |
| `prepareStatement(st, dialect, knownTypes)`       | Applies R3 rewrites; returns `{text, restore}` where `restore` maps column positions back to original type text.                          |
| `readSql(statements, dialect) → RawSchema`        | Parses modelled kinds one by one; a statement that throws becomes `skipped: parse-error` with the parser's line offset added to its own.  |
| `readDbml(text) → RawSchema`                      | `@dbml/parse` `rawDb`; compile errors → `ParseError` with the first diagnostic's line (whole import blocked, DBML is one document).       |
| `buildPlan(raw, source, target) → ImportPlan`     | Resolves names → plan ids, applies FR-010…FR-016, R8–R10, collects report entries; deterministic for the same input.                      |
| `suggestForeignKeys(plan) → FkSuggestion[]`       | R11; never suggests where an FK already exists or the target is missing.                                                                  |

`RawSchema` is our own neutral shape (tables, columns, indexes, checks, refs, enums, groups,
notes, comments, each with `line`), so both readers feed one `buildPlan`.

## Apply (main thread)

```ts
placeImport(plan, layoutClient, existing: Rect[]): Promise<Record<PlanId, Point>>  // R7
applyImport(editor, plan, positions, target): AppliedImport  // R6, one editor.batch
// AppliedImport: { nodes: Id[], edges: Id[], groups: Id[], enums: Id[], stickies: Id[], idMap }
importIntoNewDeck(ctx, plan, positions, name): Promise<DeckId>  // builds the deck in memory, adds to library
```

- `applyImport` MUST write nothing when it throws before the batch (validation first) and MUST
  produce exactly one undo step on success (test: one `undo()` restores `toJSON` equal to before).
- `importIntoNewDeck` creates the deck document in memory with the import's dialect, runs
  `applyImport` on it, serialises with `toJSON` and adds it through the library's `addDeck`
  (worker), then navigates to `/deck/<id>`. The current deck is not touched (FR-022).
- Suggestions are remapped through `idMap` before they reach the UI store.

## Error and cancel

- Parser load failure (chunk fetch fails offline before first cache) → dialog error "The import
  reader could not load. Try again when the app has finished installing." Nothing written.
- `cancel()` on dialog close; late results are ignored by request id.
