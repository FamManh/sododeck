# Quickstart: validating 040 (Database Schema Model)

Model-only feature: validation is tests plus a JSON-panel check. Shapes:
[data-model.md](data-model.md); API: [contracts/model-additions.md](contracts/model-additions.md);
file: [contracts/file-format.md](contracts/file-format.md).

## Prerequisites

```bash
pnpm install
pnpm schema:generate   # after editing v1.json; generated files are committed
```

## 1. Format and parity (US1, US6, FR-030)

```bash
pnpm --filter @sododeck/schema test
```

Expected: Ajv and Zod agree on `examples/*.sododeck.json` (valid) and every new invalid fixture
(refused, message names the path); the coverage test sees every new key and enum value used in
`full.sododeck.json`; S14 (and S15 if needed) have their fixtures.

## 2. Round-trip, renames, cascades, sync (US1–US5, SC-001–SC-004)

```bash
pnpm --filter @sododeck/model test
```

Expected, by test file:

| File (packages/model/test) | Proves                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `round-trip.test.ts`       | "Shop" fixture and each listed case export byte-identical; `columns: []`, `enums: []`, `"generic"` kept |
| `db-schema.test.ts` (new)  | Column / index / check / enum ops, renames keep every reference, flags write `true` or remove           |
| `db-cascade.test.ts` (new) | Remove column (simple, composite, self-reference), enum, table; one undo restores all                   |
| `concurrency.test.ts`      | Two docs: edit two columns, add + reorder, remove + rename, enum value edits → converge, nothing lost   |
| `load.test.ts`             | Duplicate column / enum value ids across tables refuse the file, naming both paths                      |
| `problems.test.ts`         | `db-dangling-reference`, `db-composite-mismatch`; ends on non-table cards not reported                  |
| `paste.test.ts`            | Pasted table gets new part ids; index parts and pasted edges' column ends remapped; `enumRef` kept      |
| `card-types.test.ts`       | `database` pack and `db-table` type; new decks have the pack; legacy decks unchanged                    |
| `round-trip.test.ts`       | Every sample in `apps/app/src/samples` and every model fixture: open → save is byte-identical (SC-002)  |

## 3. In the app (FR-032, demonstration)

```bash
pnpm dev   # app on :5173
```

1. Import `packages/schema/examples/full.sododeck.json`.
2. Open the JSON panel (⌘J): `dialect`, `enums` and the tables' `columns`, `indexes`, `checks`
   and the edges' `fromColumns` … `onUpdate` show as written. Tables draw as generic cards (041
   draws them properly).
3. Open the Packs panel: "Database" is listed; Add shows "Table".
4. Export the deck and diff against the imported file: identical.

Screenshot the JSON panel for the report.

## 4. Size check (SC-005)

`packages/model/test/perf.test.ts` gains a case: a deck of 150 `db-table` nodes × 12 columns with
~200 relationships (built by a `largeSchemaDeck` helper in `test/helpers.ts`); `fromJSON` and
`toJSON` each under 1 s (× 3 on CI, the file's `SLACK`), a column edit under the existing
`BIG_EDIT_BUDGET_MS`, `checkDeck` under `CHECK_DECK_BUDGET_MS`. Record the measured numbers in
`quickstart-results.md`. Then:

```bash
pnpm bench   # before and after; canvas numbers unchanged (no tables in the generator)
```

## 5. Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```
