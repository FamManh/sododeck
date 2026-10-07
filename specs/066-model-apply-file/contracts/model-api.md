# Contract: `@sododeck/model` additions (066)

All additions are exported from `packages/model/src/index.ts`. They are pure TypeScript: no DOM, no network, safe in a worker except where a `DeckDoc` must be on the caller's thread.

## `applyFile(doc, input, origin): ApplyResult`

```ts
export function applyFile(doc: DeckDoc, input: unknown, origin: object): ApplyResult;
```

- `input`: a parsed deck file (any JSON value), or a `PreparedDeck` from `prepareDeck` (recognised by a private brand, never by shape), which skips re-validation (`TODO(067)`: lets a host validate in a worker).
- `origin`: the Yjs transaction origin for the write. It must not be an editor origin (`createEditor`'s tracked or untracked origin).
  - **Throws** `TypeError` when `origin` is an editor origin. This is a programming error, not user input.
- **Never throws for user input.** An invalid file returns `{ status: 'refused', entries }`, with the same `ProblemEntry` list (codes, paths, messages, fixes) a file import shows (062). The document is not written.
- **Applied**: one transaction with `origin`. Afterwards `toJSON(doc)` equals `toJSON(loadDeck(input).doc)`. `changed: false` means no transaction ran.
- **Undo**: the change is never in any editor's undo history and does not end its current undo step.
- **Observers**: `observeDeck` fires once with `origin: 'remote'` and only the objects and keys whose plain value changed.
- **Locks** are ignored (FR-017).
- **Pictures**: `bytes` must be put in the caller's blob store before the images render. `problems` lists damaged pictures, which are applied as missing.

## `applyDeckText(doc, text, origin): ApplyResult`

```ts
export function applyDeckText(doc: DeckDoc, text: string, origin: object): ApplyResult;
```

The same as `applyFile`, from file text. It strips a BOM, refuses non-JSON with one `invalid-json` entry (line and column when the engine gives them) and a newer `version` with one `unsupported-version` entry, exactly as `inspectDeckText`.

## `prepareDeck(input): PreparedDeck`

```ts
export function prepareDeck(input: unknown): PreparedDeck;
```

The load pipeline shared by `loadDeck` and `applyFile`: picture repair → crop trim → validation → legacy-note upgrade. **Throws** `DeckValidationError` like `loadDeck`. Pure and worker-safe.

## Types

```ts
export interface PreparedDeck {
  readonly file: SododeckFile;
  readonly metas: ReadonlyMap<AssetId, AssetMeta>;
  readonly bytes: Map<AssetId, Uint8Array>;
  readonly problems: AssetProblem[];
  readonly trimmedCrops: TrimmedCrop[];
}

export type ApplyCounts = { added: number; changed: number; removed: number };
export type ApplySummary = Partial<Record<Scope, ApplyCounts>>;

export type ApplyResult =
  | { status: 'refused'; entries: ProblemEntry[] }
  | {
      status: 'applied';
      changed: boolean;
      summary: ApplySummary;
      bytes: Map<AssetId, Uint8Array>;
      problems: AssetProblem[];
      trimmedCrops: TrimmedCrop[];
    };
```

## Unchanged behaviour (regression contract)

- `loadDeck`, `fromJSON`, `inspectDeckText`, `toJSON`, `serializeDeck`: same outputs for every existing test. `inspectDeckText` shares `parseDeckText` (internal) with `applyDeckText`.
- No new `DeckChange.origin` value. No schema change, no new stored key.

## Example (from the 067 side, illustrative)

```ts
const hostOrigin = Object.freeze({ provider: 'sododeck-host' });
const result = applyDeckText(doc, fileText, hostOrigin);
if (result.status === 'refused') showProblems(result.entries);
else if (result.changed) await putPictures(result.bytes);
```
