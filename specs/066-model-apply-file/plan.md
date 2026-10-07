# Implementation Plan: Apply a changed deck file to an open deck

**Branch**: `066-model-apply-file` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/066-model-apply-file/spec.md`

## Summary

Add `applyFile(doc, input, origin)` and `applyDeckText(doc, text, origin)` to `@sododeck/model`. They validate an incoming deck file through the same pipeline as `loadDeck` (now split into a pure `prepareDeck` and `buildDoc`). If the file is equal to the open deck they return at once. Otherwise they write only the differences into the open document, in one transaction with the caller's untracked origin, matched by id at every level: collections, rules, child lists, nested records and meta.

Ordered lists move only the items off the longest increasing run. Changed long text gets a fresh `Y.Text`, so a later user undo cannot partly revert the file's value. Invalid files are refused with the 062 import problem entries and the document is not touched. Picture bytes come back to the caller. Details and evidence: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), Node ≥ 24

**Primary Dependencies**: `yjs` (existing), `@sododeck/schema` (Zod validators, existing). No new dependency.

**Storage**: Yjs document (in the app, persisted to IndexedDB by existing storage, which saves the applied change like any non-storage update). No format change.

**Testing**: Vitest in `packages/model/test` (unit, pairwise round trip over the fixture corpus, generated random edits, undo sequences, perf). No component or e2e tests (model only; constitution VI `TODO(e2e)`).

**Target Platform**: Any JS runtime that runs the model (browser main thread, worker for `prepareDeck`, Node in tests).

**Project Type**: Library package in the pnpm/turbo monorepo (`packages/model`).

**Performance Goals**: On the 500-node / 1,000-edge deck, one changed field < 50 ms and every object changed < 1 s, validation included (SC-003). Equal file: one serialization + compare.

**Constraints**: Only `read.ts` / `write.ts` touch layout-2 internals. No editor ops (locks, cascades, undo). One transaction. Never throws for user input.

**Scale/Scope**: About 3 new source files (`apply-file.ts`, `apply-lists.ts` for order reconciliation, `apply-records.ts` for nested maps), small refactors of `deck.ts` and `import-check.ts`, exports in `index.ts`, about 5 test files, `packages/model/CLAUDE.md`, and one ADR.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status | Notes                                                                                                                                                                                                             |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | The file is merged into the Yjs document in place. No second copy of the deck is kept: the diff reads the doc and the file transiently.                                                                           |
| II. Schema-owned format, lossless round-trip | ✅     | Conversion stays in `packages/model` (through `read.ts` / `write.ts`). Pairwise A→B round trip over the corpus is the core test. No schema change.                                                                |
| III. Stable identity                         | ✅     | Matching is by id at every level. A changed object keeps its stored map. Ids are never generated or derived here.                                                                                                 |
| IV. Local-first, private                     | ✅     | No network, no telemetry. Pure model code.                                                                                                                                                                        |
| V. Performance off main thread               | ✅     | `prepareDeck` (validation, the heavy part) is pure and exported, so 067 can run it in a worker and pass the prepared file. The write runs where the doc lives, like all editor ops. Budgets in SC-003 are tested. |
| VI. Strict types, tested behavior            | ✅     | Unit, round-trip, undo-sequence and perf tests. No `any`, no `!`. No new e2e.                                                                                                                                     |
| VII. Accessible by default                   | ✅ n/a | No UI.                                                                                                                                                                                                            |
| VIII. Simplicity, justified deps             | ✅     | No dependency. Reuses readers, writers, order keys and the 062 problem entries. An ADR records the merge semantics (file wins, fresh `Y.Text`, untracked origin, asset metas kept).                               |

**Post-design re-check**: ✅ unchanged after data-model and contracts. No violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/066-model-apply-file/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/model-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/model/
├── src/
│   ├── deck.ts               # split loadDeck → prepareDeck (pure, exported) + buildDoc
│   ├── import-check.ts       # extract parseDeckText (BOM, JSON, newer version) shared with applyDeckText
│   ├── apply-file.ts         # new: applyFile, applyDeckText, origin guard, fast path, collections/rules/meta diff, summary
│   ├── apply-lists.ts        # new: reconcileList (remove, LIS, keyBetween placement, rekey fallback)
│   ├── apply-records.ts      # new: merge plain record into Y.Map (recursive), swatches array, fresh Y.Text rule
│   └── index.ts              # exports: applyFile, applyDeckText, prepareDeck, types
├── test/
│   ├── apply-file.test.ts            # US1, US3, US4, FR-017, origin guard, summary
│   ├── apply-file-roundtrip.test.ts  # pairwise corpus + generated random edits (SC-001)
│   ├── apply-file-undo.test.ts       # US2, gesture edge case, text undo (FR-018)
│   ├── apply-lists.test.ts           # LIS minimal moves, tied / malformed keys
│   └── perf.test.ts                  # + SC-003 cases
└── CLAUDE.md                 # "Added by 066" API notes

docs/decisions/00NN-apply-file-merge.md   # ADR: merge semantics (next free number at merge time)
```

**Structure Decision**: The feature lives entirely in `packages/model`, the only package allowed to convert JSON ↔ Yjs. Diff logic is split by concern (top-level diff, ordered lists, nested records), so each part has focused unit tests. No app code changes. 067 is the first consumer.

## Risks

- **Per-collection rules drift** when a future feature adds a stored list or nested map. Mitigation: the pairwise round trip and the generated edits run on `full.sododeck.json`, which uses every field of the format, so a missed list fails a test.
- **Validation time on large files** might dominate the 50 ms budget. Mitigation: measured in perf. If needed, 067 validates in a worker through `prepareDeck`.
- **Fresh `Y.Text` loses letter-level merging** for a field that two tabs edit while a file lands. This is accepted and documented in the ADR.

## Complexity Tracking

No violations.
