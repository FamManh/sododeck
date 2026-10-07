# Data model: Apply a changed deck file to an open deck (066)

No file-format change and no new stored keys. The feature adds runtime types in `@sododeck/model` only.

## PreparedDeck (new, internal → exported for 067)

The output of the shared load pipeline (research R6). It is pure and structured-cloneable.

| Field          | Type                       | Notes                                                                                           |
| -------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `file`         | `SododeckFile`             | Validated, legacy notes freed (ADR 0041), crops trimmed (057), damaged pictures as placeholders |
| `metas`        | `Map<AssetId, AssetMeta>`  | What the document stores per picture (no bytes)                                                 |
| `bytes`        | `Map<AssetId, Uint8Array>` | Decoded bytes of sound pictures, for the caller's blob store                                    |
| `problems`     | `AssetProblem[]`           | Damaged pictures (never refuse the file)                                                        |
| `trimmedCrops` | `TrimmedCrop[]`            | Crops cut back to the picture edge                                                              |

`loadDeck(input)` is `buildDoc(prepareDeck(input))` plus the same `LoadedDeck` fields as today.

## ApplyResult (new)

```text
ApplyResult =
  | { status: 'refused'; entries: ProblemEntry[] }          // sorted, never empty; doc untouched
  | { status: 'applied';
      changed: boolean;                                      // false → nothing written, no event
      summary: ApplySummary;
      bytes: Map<AssetId, Uint8Array>;
      problems: AssetProblem[];
      trimmedCrops: TrimmedCrop[] }
```

## ApplySummary (new)

`Partial<Record<Scope, { added: number; changed: number; removed: number }>>`. Only scopes with a non-zero count are present. `Scope` is `'meta' | Collection | 'rules'` (layout.ts). A child edit (step, branch, rule column or row, table column, index, check, enum value, field option) counts its owner as `changed`.

## Matching rules

| Where                                                                          | Matched by                       | Order kept from file                     |
| ------------------------------------------------------------------------------ | -------------------------------- | ---------------------------------------- |
| `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies`, `images` | object id (per collection)       | yes                                      |
| `rules`                                                                        | rule id (object key)             | yes (rule order)                         |
| flow `steps`, `branches`                                                       | child id                         | yes                                      |
| rule `inputs`, `outputs`, `rows`                                               | child id; row cells by column id | yes                                      |
| table `columns`, `indexes`, `checks`                                           | child id                         | yes                                      |
| `meta.fields` (+ `options`), `meta.enums` (+ `values`)                         | child id                         | yes                                      |
| `meta.assets`                                                                  | picture id (SHA-256)             | n/a (sorted on read); never removed (R8) |
| meta scalars and records                                                       | key                              | n/a                                      |

## Write rules (per field, research R4–R5)

| Stored as                        | Written when different as                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| plain scalar / whole-value array | new value (`undefined` → key removed)                              |
| long text (`Y.Text`)             | a fresh `Y.Text` with the file's value, plus the blank marker rule |
| `position` / `size`              | per axis                                                           |
| nested `Y.Map` record            | key by key, recursive; missing keys removed                        |
| `meta.swatches` `Y.Array`        | contents replaced in place                                         |
| typed values `$value:<field>`    | `writeValues` rule                                                 |
| list item order `$order`         | only for items off the longest increasing run (R3)                 |

## State transitions of the open deck

```text
open deck D ──applyFile(F, origin)──▶ prepare F
   prepare fails        ──▶ refused(entries); D unchanged, no event, no undo change
   toJSON(D) ≡ F        ──▶ applied(changed: false); no transaction
   otherwise            ──▶ one transaction(origin): D := F (by id) ──▶ applied(changed: true)
                             observers: one DeckChange, origin 'remote'
                             undo stacks: unchanged; capture window not ended
```

## Invariants (tested)

1. After `applied`, `serializeDeck(doc)` equals `serializeDeck(loadDeck(F).doc)` (byte-equal; FR-014).
2. Every id present in both D and F keeps its stored map. An object that is only changed is never re-created, and objects report changes only when their plain value differs (FR-003, FR-015).
3. The undo and redo stack lengths and `canUndo` / `canRedo` are the same before and after (FR-009).
4. Refused: `toJSON(doc)` before equals after, and no `observeDeck` call (FR-010).
