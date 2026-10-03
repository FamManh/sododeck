# Implementation Plan: Collaboration-Ready Deck Document

**Branch**: `036-collab-ready-document` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/036-collab-ready-document/spec.md`. Founder decisions of 2026-10-03: ADR 0020 / backlog 025 deferred, so no format revision, no read-only mode and no migration of stored decks (§g-81, §g-82); collapsed groups stay shared.

**Dependency**: none. Checked on `main` (`f2b0140`): `packages/model/src` (every op, `deck.ts`, `layout.ts`, `convert.ts`, `observe.ts`, `snapshot.ts`, `ids.ts`, `validate.ts`, `editor.ts`), the storage providers (`deck-persistence.ts`, `deck-channel.ts`, `library-ops.ts`, `open-deck.ts`, `deck-loader.ts`), `use-live-field.ts` and its four callers, `problems-store.ts`, `use-deck-snapshot.ts`.

## Summary

The deck's stored document changes underneath an unchanged public API and an unchanged file.

- **Lists by id and order** (R2–R5): the seven collections, a flow's steps and branches, and a rule's columns and rows become `Y.Map<id, Y.Map>`; each item carries a fractional-index `$order`; lists are read sorted by (`$order`, id). A move is one key change. Rule cells are keyed by column id. A flow's steps keep one flat order, so the exported order is what it was.
- **Long text** (R7): twelve long text fields (every description, step notes and payload, note text) are `Y.Text`, always present, written as a minimal splice and read as plain strings. A `$blank:<field>` marker keeps an explicitly empty value from a file.
- **One reader, one writer** (R8): `read.ts` / `write.ts` hold the layout knowledge; ops stop using `fromY(map)` / `toY(object)` on deck objects.
- **Observation and snapshot** (R6): rewritten for map roots; `DeckChange` and the snapshot contract unchanged.
- **Check and repair on receive** (R9): problems already follow every change. One write repair (view entries that name nothing, after a non-local change, untracked); an empty `style` is dropped on read.
- **Typing while a change arrives** (R7): `useLiveField` rebases its draft and caret on an outside change.
- **Old stored decks** (R10): recognised by a structural probe and refused with a clear message in the deck loader and the library worker. No migration, no stored version.
- **Decision records**: ADR 0021 (layout 2; amends ADR 0005 §1, §2 and its consequences) and ADR 0022 (schema roadmap for 029, 033, 022, 030, 032; deck identity; shared collapse), from [contracts/schema-roadmap.md](contracts/schema-roadmap.md).
- **Tests and bench** (R12): existing suites unchanged as the proof of "nothing changed"; new order-key, concurrency, repair, legacy and rebase tests; `pnpm bench` before and after.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: `yjs` (already installed: `Y.Map`, `Y.Text`, `Y.UndoManager`). **No new dependency**: the fractional-index generator is about 120 lines of our own (R3).

**Storage**:

- **File format**: unchanged. `packages/schema` is not edited.
- **Yjs layout 2**: see [data-model.md](data-model.md). Same root names, map roots, `$order`, `$blank:<field>`, `Y.Text`, rule `cells`.
- **IndexedDB**: unchanged tables and providers (opaque update bytes). Decks stored in layout 1 are refused, not migrated.

**Testing**:

- **Model** (`packages/model/test`): `order-key.test.ts`, `text.test.ts`, `concurrency.test.ts`, `repair.test.ts`, `legacy-layout.test.ts` (new); `round-trip.test.ts` and `perf.test.ts` (extended); `observe`, `snapshot`, `stickies`, `editor-core`, `undo` tests updated where they reach into the layout. Every other test file passes untouched.
- **App**: `rebase-draft.test.ts`, `use-live-field.test.tsx` (extended), `deck-loader` and `library-ops` tests for the unsupported outcome; two tests that used `doc.getArray` updated.
- **E2E**: no new tests (constitution VI). Smoke stays green.
- **Bench**: `pnpm bench` on `main` and on the branch, and the storage load timing.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; the model also runs in Node and Web Workers (no DOM in `packages/model`).

**Project Type**: web app (monorepo). Changes are in `packages/model` and, lightly, `apps/app`.

**Performance Goals**:

- Lookup and field edit independent of list size; one field edit at 10,000 components ≤ 2× the 500-component time; a move at 10,000 items < 10 ms (SC-005).
- `perf.test.ts` budgets unchanged (load 200 ms, edit 16 ms, snapshot 2 ms at 500 / 1,000).
- Canvas bench unchanged beyond noise; storage load ≤ 10 % slower (SC-006).

**Constraints**:

- Exported text byte-identical for the same content (FR-001); round-trip lossless (FR-002).
- Public API and `DeckChange` / snapshot contracts unchanged (R1, [contract](contracts/model-contract.md)).
- Validate before write; undo per tab; repair never an undo step and settles in one round.
- `Y.Text`, order keys and `$…` keys never leave `packages/model`.
- No network, no new browser API.

**Scale/Scope**:

- `packages/model/src`: about 6 new files (`order-key.ts`, `text-fields.ts`, `text.ts`, `read.ts`, `write.ts`, `repair.ts`), `legacy` probe in `layout.ts`; about 25 changed files (every op module, `deck`, `layout`, `observe`, `snapshot`, `ids`, `validate`, `editor`, `index`).
- `apps/app/src`: 1 new pure helper (`rebase-draft.ts`), about 6 changed files (`use-live-field.ts`, `deck-loader.ts`, `editor-page.tsx`, `deck-not-found-page.tsx`, `library-ops.ts`, the library's error text).
- Docs: 2 ADRs, ADR 0005 amended, `packages/model/CLAUDE.md`, `apps/app/CLAUDE.md`, handbook §6, backlog status.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: passes with one recorded deviation (II, migration waived by the founder)._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth        | ✅     | The Yjs document stays the only store. The reader and the snapshot derive plain values; the live-field draft is the same UI-only draft as today, now rebased onto the document instead of overwriting it. Repairs are document writes through the editor.                                                                                                                                  |
| II. Schema-owned format          | ⚠️     | The file format and `packages/schema` do not change; `packages/model` stays the only Yjs ↔ JSON converter; round-trip stays lossless with new cases (`""`, `[]`, non-normal step order). **Deviation:** the stored layout changes without a migration of stored decks. Waived by the founder (§g-81, §g-82); see Complexity Tracking. No `version` bump (the file has no breaking change). |
| III. Stable identity             | ✅     | Ids become the storage keys, so identity is structural. No id is derived or rewritten; a reorder no longer re-creates an object. Deck id recorded as the global identity (ADR 0022).                                                                                                                                                                                                       |
| IV. Local-first, private         | ✅     | No network, no account. Storage providers unchanged. Export and import keep working at all times, and are the upgrade path for old stored decks. Smoke test's third-party check unaffected.                                                                                                                                                                                                |
| V. Performance off main thread   | ✅     | Lookups become O(1). Sorting happens on load, and on add / remove / move of that list only. Problems stay in their worker. `perf.test.ts` budgets kept, new 10,000-item budgets added, `pnpm bench` before and after.                                                                                                                                                                      |
| VI. Strict types, tested         | ✅     | Existing suites are the regression net; new unit tests for order keys, text splice, reader / writer, repair, legacy probe, draft rebase; two-document tests for every concurrency guarantee in both delivery orders. No new e2e.                                                                                                                                                           |
| VII. Accessible                  | ✅     | No new UI except one sentence on the existing not-found page and one library error message (text, tokens only). The caret is kept while a remote change arrives, which matters most to keyboard and screen-reader users.                                                                                                                                                                   |
| VIII. Simplicity, justified deps | ✅     | No dependency. One reader / writer pair replaces scattered conversions. Only one write repair; everything else is kept and reported or true by construction. Known last-write-wins spots are listed (R11) rather than solved. Two ADRs record the decisions.                                                                                                                               |

## Project Structure

### Documentation (this feature)

```text
specs/036-collab-ready-document/
├── plan.md                          # This file
├── research.md                      # Phase 0: R1–R12
├── data-model.md                    # Phase 1: stored layout 2, reads and writes, round-trip cases
├── quickstart.md                    # Phase 1: validation guide (automated + two tabs)
├── contracts/model-contract.md      # what callers of @sododeck/model can rely on
├── contracts/schema-roadmap.md      # draft of ADR 0022
├── checklists/requirements.md
└── tasks.md                         # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
packages/model/src/
├── order-key.ts            # NEW  keyBetween / keysBetween (base-62 fractional index)
├── text-fields.ts          # NEW  which fields are long text, per object kind
├── text.ts                 # NEW  writeText (minimal splice), text read rule, $blank marker
├── read.ts                 # NEW  readObject / readRule / readMeta / orderedEntries
├── write.ts                # NEW  createObject / createRule / writeField
├── repair.ts               # NEW  repairViewRefs
├── layout.ts               # map roots, list helpers (entry, insertAt, moveTo), isLegacyLayout
├── deck.ts                 # fromJSON / toJSON / getObject / getRule on the new layout; layout doc
├── convert.ts              # toY / fromY kept for plain nested values
├── observe.ts              # map roots; same DeckChange
├── snapshot.ts             # reader; re-sort only on add / remove / reorder
├── ids.ts, validate.ts     # id scans and reference checks on maps
├── editor.ts               # repair hook after non-local transactions; `repair` option
├── index.ts                # + isLegacyLayout
└── ops/                    # every module: lookups, inserts, moves and text through the helpers
    ├── collections.ts  steps.ts  branches.ts  rules.ts  rule-links.ts  cascade.ts
    └── views.ts  frames.ts  paste.ts  group-selection.ts  stickies.ts  style.ts  shape.ts  meta.ts  patch.ts

packages/model/test/
├── order-key.test.ts  text.test.ts  concurrency.test.ts  repair.test.ts  legacy-layout.test.ts   # NEW
├── helpers.ts              # + twoDocs() / sync() for two-document tests, legacy-layout builder
└── round-trip.test.ts  perf.test.ts  observe.test.ts  snapshot.test.ts  stickies.test.ts
    editor-core.test.ts  undo.test.ts                                                             # updated

apps/app/src/
├── editor/fields/rebase-draft.ts        # NEW  pure: rebase a draft and a caret over an outside change
├── editor/fields/use-live-field.ts      # rebase while focused
├── routes/deck-loader.ts                # { kind: 'unsupported' }
├── routes/editor-page.tsx, deck-not-found-page.tsx   # the legacy sentence
└── storage/library-ops.ts               # load() refuses a legacy document ('unsupported-deck')

docs/
├── decisions/0021-collab-ready-document-layout.md    # NEW (amends 0005)
├── decisions/0022-schema-roadmap.md                  # NEW
├── decisions/0005-yjs-document-layout.md             # "Amended by 0021"
└── diagram-handbook.md, backlog.md, design/design-analysis.md
```

**Structure Decision**: the feature stays inside `packages/model` (the only owner of the Yjs layout) plus the three app touch points named in R1. No new package, no schema change.

## Implementation order (input for `/speckit-tasks`)

The layout cannot switch one collection at a time (the reader, the observer and the snapshot see all of it), so the foundation lands as one stretch during which the model suite is red, then every later step keeps it green.

1. **Baseline**: run `pnpm bench` and the model perf test on `main`; keep the numbers.
2. **Pure building blocks, test-first**: `order-key.ts`, `text.ts` (`writeText`), `text-fields.ts` (+ the schema-coverage test).
3. **Foundation (US1)**: `layout.ts` helpers, `write.ts`, `read.ts`, `deck.ts`, `ids.ts`, `validate.ts`; then `observe.ts` and `snapshot.ts`; then the ops, module by module (`collections`, `patch`, `meta`, `steps`, `branches`, `cascade`, `rules`, `rule-links`, `views`, `frames`, `paste`, `group-selection`, `stickies`, `style`, `shape`); update the layout-reaching tests. Gate: the whole existing model and app suites green; new round-trip cases green; perf budgets hold.
4. **Lists under concurrency (US2)**: two-document helper; scenarios of contract guarantees 1–6; tie re-keying on insert.
5. **Long text under concurrency (US3)**: model scenarios (guarantee 7); `rebase-draft.ts` and the `useLiveField` change with their tests.
6. **Check and repair (US4)**: `repair.ts`, the editor hook and option, tests (runs only for non-local changes, untracked, settles, leaves loaded files alone); tests that outside changes reach Problems.
7. **Old stored decks (FR-027)**: `isLegacyLayout`, the loader outcome, the library worker error, their tests.
8. **Decision records and docs (US5)**: ADR 0021, ADR 0022, ADR 0005 note, both `CLAUDE.md` files, handbook, backlog status.
9. **Close**: full definition-of-done command set, `pnpm bench` after, quickstart scenarios, report.

## Complexity Tracking

| Violation                                                                                                                      | Why Needed                                                                                                                                                                  | Simpler Alternative Rejected Because                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| II: the stored layout changes with no migration of stored decks (the model's rule: "changing it needs an ADR and a migration") | The founder decided that, with no users yet, stored decks and the format may change freely and old ones are not handled (§g-81, §g-82). ADR 0021 records the layout change. | A one-off converter is outside the founder's decision. Stored decks are refused with a clear message instead of opening empty, and the unchanged file format gives a manual path (export before, import after). 025 revisits compatibility before launch. |
