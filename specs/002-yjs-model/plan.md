# Implementation Plan: Deck Document Model

**Branch**: `002-yjs-model` (git: not created yet; work is currently on `main`) | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-yjs-model/spec.md`

## Summary

Turn the `packages/model` skeleton into the single deck model every surface edits. Keep and
document the current Yjs layout (one `Y.Map` per object, `Y.Array` for ordered lists, `rules` as a
map) as the persisted layout (ADR 0005). Add:

- a `DeckEditor` with typed, validate-before-write operations for every v1 object (top-level
  collections, flow steps, rule columns/rows, metadata);
- the delete cascade from [data-model.md](data-model.md);
- crypto-random, type-prefixed ids;
- `Y.UndoManager`-based undo/redo with typing-burst grouping, gestures and batches, tracking only
  the editor's own origin;
- `observeDeck` change events;
- load-time duplicate-id refusal;
- a canonical per-object key order derived from the schema;
- a pure `checkIntegrity` report for 015.

No UI, no storage, no schema change, no new dependency ([research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), Node ≥ 24, ES2023 target

**Primary Dependencies**: existing only: `yjs` 13.6 (runtime), `@sododeck/schema` (types, `jsonSchema`, generated Zod, `parseSododeckFile`, `checkSemanticRules`). No new dependency.

**Storage**: N/A (in-memory `Y.Doc`; IndexedDB provider is 005). The layout is what 005 will persist.

**Testing**: Vitest (node environment) in `packages/model/test`: round-trip, load checks, ids, edits, cascade, rules, undo, observe, integrity, perf

**Target Platform**: Isomorphic TS: browser main thread, Web Workers, Node (tests, future CLI). No DOM, no `node:*` in `src/`.

**Project Type**: Internal library in the pnpm/Turborepo monorepo (`packages/model`)

**Performance Goals**: 500 nodes / 1,000 edges: load, write-out and integrity report < 200 ms each; single edit + observation < 16 ms (SC-003/004)

**Constraints**:

- Yjs transactions cannot roll back, so every operation validates before it writes.
- `toJSON(fromJSON(x))` deep-equals `x`.
- Output follows the schema's `properties` order.
- Undo tracks only this editor's origin.

**Scale/Scope**:

- 9 root types.
- About 30 editor operations.
- 1 integrity checker with about 15 checks.
- About 10 test files.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                                    | Check                                                                                                                                                                                        | Result |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth                    | The Y.Doc stays the only document store; the editor holds only session state (origin, UndoManager, gesture depth); `observeDeck` lets views update from it without copies.                   | ✅     |
| II. Schema-owned format, lossless round-trip | Model stays the only Yjs ↔ JSON converter; validity comes from the generated Zod + `checkSemanticRules` (no second definition); round-trip case per object type and field; no format change. | ✅     |
| III. Stable identity                         | Generated ids are type-prefixed random, never from titles; no operation writes `id`; rename/move/regroup/reorder tests assert ids and references unchanged; load refuses duplicate ids.      | ✅     |
| IV. Local-first, private                     | No network; `globalThis.crypto` only. No browser API needing feature detection (the model is not in `apps/app`).                                                                             | ✅     |
| V. Performance off the main thread           | All code is pure/worker-safe; `checkIntegrity` works on plain JSON so 015 can run it in a worker; perf test enforces budgets. No canvas change → no `pnpm bench`.                            | ✅     |
| VI. Strict types, tested                     | Strict TS, no `any`/`!`; typed patches and errors; every FR has tests; no new e2e; smoke suite must pass.                                                                                    | ✅     |
| VII. Accessible by default                   | No UI.                                                                                                                                                                                       | ✅ N/A |
| VIII. Simplicity, dependencies               | No new dependency; reuses Yjs UndoManager instead of a custom command stack; linear lookup instead of extra indexes; ADR 0005 records the persisted layout and cascade policy.               | ✅     |

**Post-design re-check (after Phase 1)**: unchanged, all ✅. One contract change affects existing
consumers: `fromJSON` now refuses duplicate ids (spec FR-020). `apps/app` call sites are unchanged,
and a test checks that the app's bundled decks still load.

## Project Structure

### Documentation (this feature)

```text
specs/002-yjs-model/
├── plan.md              # this file
├── research.md          # Phase 0: R1–R10
├── data-model.md        # Phase 1: layout, identity, cascade, model types
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── model-api.md     # Phase 1: public API of @sododeck/model
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/model/
├── CLAUDE.md                 # update: API, layout pointer, status
├── eslint.config.js          # add no-restricted-imports/globals for src/ (research R9)
├── src/
│   ├── index.ts              # public exports (contract)
│   ├── deck.ts               # layout doc comment (ADR 0005), createDeck/fromJSON/toJSON/serializeDeck
│   ├── convert.ts            # toY/fromY (moved from deck.ts)
│   ├── key-order.ts          # canonical order walker over jsonSchema (R2)
│   ├── ids.ts                # newId + collision retry (R3)
│   ├── load-checks.ts        # duplicate ids on load (R7)
│   ├── validate.ts           # per-object Zod element schemas + reference checks (R4)
│   ├── errors.ts             # DeckValidationError, DeckEditError
│   ├── editor.ts             # createEditor: origin, UndoManager, batch, gestures, history (R5)
│   ├── ops/
│   │   ├── collections.ts    # add/update/remove/reorder for top-level collections
│   │   ├── cascade.ts        # delete cascade per data-model table
│   │   ├── steps.ts          # flow step operations
│   │   ├── rules.ts          # rule, column, row, cell operations
│   │   └── meta.ts           # deck metadata
│   ├── observe.ts            # observeDeck → DeckChange (R6)
│   └── integrity.ts          # checkIntegrity (R8)
└── test/
    ├── helpers.ts            # generated large deck, deterministic id generator
    ├── round-trip.test.ts    # replaces deck.test.ts cases + per-type/field cases
    ├── load.test.ts
    ├── ids.test.ts
    ├── edit.test.ts
    ├── cascade.test.ts
    ├── rules.test.ts
    ├── undo.test.ts
    ├── observe.test.ts
    ├── integrity.test.ts
    └── perf.test.ts

docs/decisions/0005-yjs-document-layout.md   # new ADR: layout, plain strings vs Y.Text, cascade policy, id format
```

**Structure Decision**: All changes stay in `packages/model` (plus ADR 0005 and the package
`CLAUDE.md`), as the backlog hint says. `apps/app` and `packages/schema` are not modified. If
`fromJSON`'s duplicate-id check breaks an app fixture, the fixture is fixed; the check stays.

## Implementation order (for /speckit-tasks)

1. Refactor `deck.ts` into `convert.ts`, `key-order.ts` and `errors.ts`, with the existing tests
   still green. Then add the canonical per-object order and the round-trip cases.
2. `load-checks.ts`, then `ids.ts`.
3. `validate.ts`, then `editor.ts` (origin, batch) and `ops/collections.ts` + `ops/meta.ts` (US1).
4. `ops/cascade.ts`, then `ops/steps.ts` and `ops/rules.ts` (US3, FR-018).
5. Undo/gesture/history in `editor.ts` (US4).
6. `observe.ts`, then `integrity.ts`, then `perf.test.ts`.
7. ESLint guards, ADR 0005, `packages/model/CLAUDE.md`, and the full DoD command set.

## Complexity Tracking

No constitution violations; nothing to justify.
