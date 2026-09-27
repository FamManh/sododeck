---
description: 'Task list for 002-yjs-model (Deck Document Model)'
---

# Tasks: Deck Document Model

**Input**: Design documents from `specs/002-yjs-model/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (incl. Clarifications 2026-09-27), [research.md](research.md), [data-model.md](data-model.md), [contracts/model-api.md](contracts/model-api.md), [quickstart.md](quickstart.md)

**Tests**: Required (constitution VI and II, spec SC-001–SC-008). Write each story's tests first, see them fail, then implement. Tests run in Vitest's `node` environment. **No new Playwright e2e tests** (constitution VI, TODO(e2e)); the smoke suite must stay green.

**Organization**: Tasks are grouped by user story. The shared editor core (conversion, errors, ids, validation, transactions, basic undo) is foundational because every story uses it.

**Read first**: `AGENTS.md`, `packages/model/CLAUDE.md`, `packages/schema/CLAUDE.md`, ADR 0004. Stay inside `packages/model`, plus `docs/decisions/0005-*.md`. Do **not** modify `packages/schema` or `apps/app` (if an app fixture fails the new duplicate-id check, stop and report it).

**Commits**: Conventional Commits, small (`feat(model): …`, `test(model): …`, `refactor(model): …`, `docs: …`). **No `Co-Authored-By:` or any AI attribution line** (AGENTS.md).

**Key decisions to respect** (spec Clarifications):

- On delete, steps and stickies are **kept and reported broken**.
- Text is stored as plain strings, so the last write wins per field. No `Y.Text`.
- Deleting a group **re-parents** its contents.
- A file with **duplicate ids is refused** on load; it is never auto-fixed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 from spec.md

## Path Conventions

pnpm monorepo, repo-relative paths. Source in `packages/model/src/`, tests in `packages/model/test/`. Run a single package with `pnpm --filter @sododeck/model <script>`.

---

## Phase 1: Setup

**Purpose**: Guard rails and test helpers; no behavior change.

- [x] T001 Add browser-free guards to `packages/model/eslint.config.js` for files in `src/**`:
  - `no-restricted-imports` forbidding `node:*`, `react`, `react-dom`, `y-indexeddb`;
  - `no-restricted-globals` for `window`, `document`, `localStorage`, `indexedDB`, `navigator`.

  Run `pnpm --filter @sododeck/model lint` and confirm it is clean (research R9).

- [x] T002 [P] Create `packages/model/test/helpers.ts` with:
  - `readExample(name)`, moved from `test/deck.test.ts`;
  - `seqIds()`, a deterministic id generator: `(prefix) => \`${prefix}-${n++}\``;
  - `largeDeck({ nodes: 500, edges: 1000, flows: 20, stepsPerFlow: 10, rules: 10 })`, returning a valid `SododeckFile` with fixed ids;
  - `expectValid(doc)`, asserting `parseSododeckFile(toJSON(doc)).success`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The core every story builds on. **⚠️ No user story work starts before this phase is done.**

- [x] T003 Refactor, with no behavior change:
  - Move `toY`/`fromY`/`YValue` from `packages/model/src/deck.ts` into `packages/model/src/convert.ts`.
  - Move `DeckValidationError` into `packages/model/src/errors.ts`, and add `DeckEditError` with `code: 'invalid' | 'not-found' | 'missing-reference' | 'duplicate-id'` and `issues: Issue[]` (contract).
  - Re-export both from `packages/model/src/index.ts`.

  The existing `test/deck.test.ts` must stay green.

- [x] T004 [P] Create `packages/model/src/ids.ts` (research R3):
  - `defaultNewId(prefix)` returns `<prefix>-<10 base-36 chars>` from `globalThis.crypto.getRandomValues`.
  - `makeIdAllocator(doc, newId)` collects every existing id in the deck and retries on collision. Ids must be unique across all collections, steps, rule columns and rows.
  - The prefixes are `node`, `group`, `edge`, `view`, `feature`, `flow`, `step`, `rule`, `col`, `row`, `sticky`.
- [x] T005 [P] Create `packages/model/src/validate.ts` (research R4). It validates **before any write** and never writes.
  - Element validators come from the generated Zod, e.g. `sododeckFileSchema.shape.nodes.element` (same for groups, edges, views, features, flows and stickies). Steps use `flows.element.shape.steps.element`, and rules use the `rules` record value schema.
  - `validateObject(kind, candidate): Issue[]`.
  - `validateRule(id, rule)`, which also runs `checkSemanticRules` on a one-rule file built from `emptySododeckFile()`.
  - `assertRefsExist(doc, refs)`, which throws `DeckEditError('missing-reference')`.
- [x] T006 Create `packages/model/src/editor.ts` with `createEditor(doc, options)` (contract):
  - Create a unique `origin` object and a `transact(fn)` helper that runs `doc.transact(fn, origin)`.
  - `batch(fn)` flattens nesting into one transaction and returns `fn`'s result.
  - Create a `Y.UndoManager` over `meta`, `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `rules` and `stickies`, with `trackedOrigins: new Set([origin])` and `captureTimeout` from the options (default 500).
  - Provide `undo()`/`redo()` returning booleans, `canUndo()`/`canRedo()` and `destroy()`.
  - Provide internal lookup helpers `findIndexById(array, id)` and `getMapById`, which throw `DeckEditError('not-found')`.
- [x] T007 Export `createEditor`, `DeckEditor` and `EditorOptions` from `packages/model/src/index.ts`. Add `packages/model/test/editor-core.test.ts`, checking that:
  - `batch` gives one undo step;
  - an edit made in the doc outside the editor (`doc.transact(fn)` with no origin, or another origin) is not undone;
  - a freshly loaded deck has `canUndo() === false`.

**Checkpoint**: core ready. `pnpm --filter @sododeck/model test lint typecheck` is green.

---

## Phase 3: User Story 1 - Every surface shows the same deck (Priority: P1) 🎯 MVP

**Goal**: Typed, validated edit operations for every object, applied atomically and observable.

**Independent Test**: Using only the editor API, add two nodes, an edge, a flow with a step and an attached rule; export the deck and check every reference. An observer gets one event per edit naming the objects and keys.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [x] T008 [P] [US1] Write `packages/model/test/edit.test.ts`.
  - **Every collection**: `add` / `update` / `reorder` for nodes, groups, edges, views, features, flows and stickies.
  - **Patches**: `null` clears an optional field. Moving a node is `update(position)` and regrouping is `update(group)`.
  - **Metadata**: `updateMeta` sets and clears `name`, `description` and `tags`.
  - **Steps**: `addStep` / `updateStep` / `moveStep` / `removeStep` (removal of a single step only).
  - **Rename** (US1 AS2): renaming a node referenced by 2 edges and a step keeps its id and every reference.
  - **Rejected edits** (FR-007), each asserting `DeckEditError` and an unchanged deck (`toJSON` before === after):
    - an empty title;
    - an unknown node `type`;
    - an edge to a missing node;
    - a step on a missing edge;
    - adding with an explicit duplicate id;
    - an update that tries to change `id`, as a type test via `// @ts-expect-error`.
  - **Batch**: a `batch` moving 5 nodes gives one change event.
  - **Valid export** (SC-007): `expectValid(doc)` after every operation.
- [x] T009 [P] [US1] Write `packages/model/test/observe.test.ts`:
  - one `DeckChange` per transaction;
  - `added` / `updated` (with `keys`) / `removed` entries for top-level objects;
  - `child` entries for steps, rule columns and rule rows;
  - `origin` values `local` / `undo` / `redo` / `remote` (remote = an update applied from another `Y.Doc` via `Y.applyUpdate`);
  - the unsubscribe function stops events.

### Implementation for User Story 1

- [x] T010 [US1] Implement `packages/model/src/ops/collections.ts` (data-model "Edit input and patch"):
  - `add(c, data)` validates the candidate with the id and checks references, then pushes `toY(object)` in canonical key order.
  - `update(c, id, patch)`: the candidate is the current value plus the patch, with `null` deleting the key. Validate it, then set only the changed keys. For `position`, set `x`/`y` on the existing nested map.
  - `reorder(c, id, toIndex)` deletes and re-inserts inside one transaction.
  - Reject patches of owned children (`steps`).
  - Reference fields checked on add/update:
    - edges: `from` and `to`;
    - nodes: `group`, `parent` and `rules`;
    - groups: `parent`;
    - views: `feature` and `includes`/`positions` keys;
    - flows: `feature`;
    - stickies: `anchor`, which may be any object id.
- [x] T011 [P] [US1] Implement `packages/model/src/ops/meta.ts`: `updateMeta(patch)` validates `name`/`description`/`tags` against the file schema and writes them to the `meta` map. `null` removes the key.
- [x] T012 [US1] Implement `packages/model/src/ops/steps.ts`:
  - `addStep(flowId, data, index?)` checks that `edge` and `rules` exist, and that `ruleInputs` keys are among its rules and their input columns.
  - `updateStep`, `moveStep` and `removeStep`.

  Every operation is validated with the step element schema.

- [x] T013 [US1] Wire `add`, `update`, `reorder`, `updateMeta` and the step ops into the `DeckEditor` object in `packages/model/src/editor.ts`. Every op runs inside the editor transaction. Export the `NewObject`, `NewStep`, `Patch` and `Collection` types from `packages/model/src/index.ts`.
- [x] T014 [US1] Implement `packages/model/src/observe.ts`: `observeDeck(doc, listener)`.
  - Register `observeDeep` on every root type and map each event path to an `ObjectChange` (research R6).
  - Buffer the changes per transaction and flush once on `doc.on('afterTransaction')`.
  - Classify the origin: the editor origin gives `local`; `transaction.origin instanceof Y.UndoManager` gives `undo` or `redo`, using its `undoing`/`redoing` flags; anything else gives `remote`.

  Also add `getObject(doc, c, id)` and `getRule(doc, id)` in `packages/model/src/deck.ts`, and export all of them.

- [x] T015 [US1] Make T008 and T009 pass. Commit: `feat(model): typed edit operations and change events`.

**Checkpoint**: US1 is independently demonstrable (quickstart §1 `edit`/`observe`).

---

## Phase 4: User Story 2 - Save and load never lose or change data (Priority: P1)

**Goal**: A lossless round-trip in canonical per-object key order, and load-time id checks.

**Independent Test**: Every example and every per-type case deep-equals itself after load + write, and serializes identically, including via an encoded-update replica. Duplicate ids are refused with both paths. Dangling references load.

### Tests for User Story 2 ⚠️

- [x] T016 [P] [US2] Write `packages/model/test/round-trip.test.ts`:
  - Move the cases from `test/deck.test.ts` here, then delete `deck.test.ts`.
  - Add one case per object type with **every optional field**: node, group, edge, view (with `positions` and `includes`), feature, flow, step (with `ruleInputs`), rule (columns/rows), sticky (anchor only / position only / both), and deck metadata.
  - Assert that `serializeDeck(toJSON(fromJSON(x))) === serializeDeck(x)`, and the same for an encoded-update replica.
  - Assert that the output keys of every nested object follow schema `properties` order even when the input has shuffled key order, and that deep-equality still holds.
  - Rename a node in the flow-and-rule example and check that only that node's `title` differs (US2 AS2).
- [x] T017 [P] [US2] Write `packages/model/test/load.test.ts`:
  - An invalid file throws `DeckValidationError` with paths (US2 AS3).
  - Duplicate ids throw with an issue naming the id and **both** paths (e.g. `nodes.0.id` and `nodes.3.id`) for each of these cases: nodes, groups, edges, views, features, flows, stickies, steps within one flow, rule columns across inputs+outputs, rule rows. No auto-rename (FR-020).
  - The same id used in two _different_ collections loads.
  - A file with dangling references (step → missing edge, edge → missing node) loads (US2 AS5).
  - All three schema examples load.

### Implementation for User Story 2

- [x] T018 [P] [US2] Implement `packages/model/src/key-order.ts` (research R2):
  - Walk `jsonSchema` from `@sododeck/schema`, resolving `$ref` into `$defs`, and use `properties` declaration order, `items` and `additionalProperties`.
  - Build a cached `canonicalize(value)` that rebuilds objects in schema order.
  - Map-like objects (`rules`, `positions`, `ruleInputs` and its inner maps) keep their own key order.
- [x] T019 [P] [US2] Implement `packages/model/src/load-checks.ts`: `checkDuplicateIds(file): Issue[]` (research R7). The message format is `Id "x" is used more than once (nodes.0.id, nodes.3.id).`, with one issue per duplicated id per scope.
- [x] T020 [US2] Update `packages/model/src/deck.ts`:
  - `fromJSON` runs `parseSododeckFile`, then `checkDuplicateIds`; any issues throw `DeckValidationError`.
  - `toJSON` returns `canonicalize(...)`.
  - `serializeDeck` canonicalizes before stringifying. Remove its `TODO(M1)`.
  - Rewrite the header comment as the full documented layout from data-model.md, including that text is plain strings and last write wins (ADR 0005).
- [x] T021 [US2] Make T016 and T017 pass. Run `pnpm --filter @sododeck/app test` to confirm the app's decks still load. Commit: `feat(model): canonical key order and duplicate-id checks on load`.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Deleting keeps the deck consistent (Priority: P1)

**Goal**: The delete cascade from data-model.md, rule tables that keep valid shape, and a typed integrity report.

**Independent Test**: A deck where one node is used by 2 edges, a step, a view and a sticky. Delete the node and check the exact cascade plus `checkIntegrity`. One undo restores the deck exactly.

### Tests for User Story 3 ⚠️

- [x] T022 [P] [US3] Write `packages/model/test/cascade.test.ts`, with one test per data-model cascade row. Each asserts the `RemovalResult`, `checkIntegrity` output, `expectValid(doc)`, and that **one `undo()` restores `toJSON` exactly** (SC-002).
  - **Node**: edges removed; steps kept with full content and reported `missing-reference` on `edge`; removed from `includes`/`positions`; `parent` cleared on children; anchored sticky kept and reported.
  - **Edge**: steps kept and reported.
  - **Group**: members' `group` and child groups' `parent` set to the deleted group's parent, or cleared; nothing else deleted.
  - **Feature**: `flow.feature` and `view.feature` cleared.
  - **Flow**: steps deleted; stickies anchored to the flow or a step kept and reported.
  - **Rule**: removed from node and step `rules` (an empty list is removed), `ruleInputs[ruleId]` removed; no problems reported.
  - **Sticky**: removed.
- [x] T023 [P] [US3] Write `packages/model/test/rules.test.ts`:
  - `addRule` gets defaults (`hitPolicy: 'first'`, empty columns and rows).
  - `addRuleColumn` inserts `''` at the index in every row's `when`/`then`.
  - `moveRuleColumn` moves the cells.
  - `removeRuleColumn` removes the cells and `ruleInputs[ruleId][colId]` on steps.
  - `addRuleRow` fills missing cells with `''` and rejects too many cells.
  - `setRuleCell`, `moveRuleRow`, `removeRuleRow`.
  - `updateRule` rejects `inputs`/`outputs`/`rows`.
  - Every op leaves `checkSemanticRules` clean.
- [x] T024 [P] [US3] Write `packages/model/test/integrity.test.ts`, with one fixture per check in the data-model table (SC-008). Each asserts `kind`, `object`, `field`, `target` and `targetType`. Include:
  - `detached-rule-input`;
  - `ambiguous-anchor` (a sticky anchor id that matches a node and an edge);
  - a group `parent` cycle and a node `parent` cycle, each reported once;
  - a clean example returns `[]`.

### Implementation for User Story 3

- [x] T025 [P] [US3] Implement `packages/model/src/integrity.ts`: `checkIntegrity(file)` is pure and builds its id sets once (research R8). Export `IntegrityProblem` and `ObjectRef`.
- [x] T026 [US3] Implement `packages/model/src/ops/cascade.ts`, with one function per collection following the data-model cascade table. Each returns `RemovalResult { removed, updated, broken }`, where `broken` comes from `checkIntegrity` limited to the affected objects.
  - Steps and stickies are **never** deleted by a cascade (clarification Q1).
  - Groups re-parent their contents (clarification Q3).
  - The whole cascade runs inside one `batch`.
- [x] T027 [US3] Implement `packages/model/src/ops/rules.ts`:
  - `addRule`, `updateRule`, `removeRule` (with the cascade);
  - column add/rename/move/remove, which keep row cell counts, and column removal also cleans `ruleInputs`;
  - row add/move/remove and `setRuleCell`.
- [x] T028 [US3] Wire `remove(c, id)`, `removeStep` (now returning `RemovalResult`), and all rule ops into `DeckEditor` in `packages/model/src/editor.ts`. Export `checkIntegrity`, `RemovalResult` and `NewRule` from `packages/model/src/index.ts`.
- [x] T029 [US3] Make T022–T024 pass. Commit: `feat(model): delete cascade, rule table ops and integrity report`.

**Checkpoint**: US1–US3 (all P1) work. This is the minimum 003 and 005 need.

---

## Phase 6: User Story 4 - Undo and redo feel natural (Priority: P2)

**Goal**: Typing bursts, gestures and batches each become one undo step; history state is observable.

**Independent Test**: Edit sequences through the editor API, with undo/redo boundaries asserted without UI.

### Tests for User Story 4 ⚠️

- [x] T030 [P] [US4] Write `packages/model/test/undo.test.ts`. `lib0` reads `Date.now` at import, so do not use fake timers (research R5).
  - **Bursts**: 10 title updates in a row with `captureTimeout: 10_000` undo in one step (US4 AS1). Updates to two different nodes within the window are **two** steps. A real boundary: `captureTimeout: 20`, two edits separated by `await sleep(40)`, give two steps.
  - **Gestures**: `beginGesture` + 50 position updates + `sleep(40)` in the middle (with `captureTimeout: 20`) + `endGesture` is one step (AS2). Nested begin/end are counted.
  - **Batch**: a multi-node batch and a cascade delete are each one step (AS3).
  - **Redo**: a new edit after undo clears redo (AS4).
  - **Load**: undo after `fromJSON` does nothing (AS5).
  - **Remote**: a change applied from another doc via `Y.applyUpdate` is not undone (FR-025).
  - **History events**: `onHistoryChange` fires on add, undo and redo; `canUndo`/`canRedo` are correct.

### Implementation for User Story 4

- [x] T031 [US4] Extend `packages/model/src/editor.ts`:
  - Track the last edited object key (scope + id + child id). When a field update targets a different object, call `undoManager.stopCapturing()` first.
  - `beginGesture()` increments a depth counter. At depth 0 → 1 it calls `stopCapturing()`, saves `captureTimeout` and sets it to `Infinity`.
  - `endGesture()` decrements, and at 0 restores the timeout and calls `stopCapturing()`. It throws on underflow.
  - `onHistoryChange(listener)` subscribes to `stack-item-added`, `stack-item-popped` and `stack-cleared`, and returns an unsubscribe function.
- [x] T032 [US4] Make T030 pass. Commit: `feat(model): undo grouping, gestures and history events`.

---

## Phase 7: User Story 5 - New objects get safe ids (Priority: P2)

**Goal**: Prove the id guarantees (the generator was built in T004).

**Independent Test**: Ids are format-valid, not derived from titles, stable across edits, and 10,000 of them are unique.

- [x] T033 [P] [US5] Write `packages/model/test/ids.test.ts`:
  - Default ids match `ID_PATTERN` (from `@sododeck/schema`) and the `<prefix>-` form.
  - A node titled "Orders API" has an id that does not contain `orders`/`api` (case-insensitive).
  - The id is unchanged after rename, move, regroup and reorder.
  - 10,000 `add` calls produce unique ids.
  - An injected generator that returns an existing id on its first call is retried.
  - `add` with an explicit id that exists anywhere in the deck throws `duplicate-id`.
- [x] T034 [US5] Fix whatever T033 exposes in `packages/model/src/ids.ts` or `packages/model/src/ops/collections.ts`. Commit: `test(model): id generation guarantees`.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T035 [P] Write `packages/model/test/perf.test.ts` (SC-003/004). Using `largeDeck()`, assert each of these is under 200 ms: `fromJSON`, `toJSON`, `serializeDeck(toJSON)`, and `checkIntegrity`. A single `update` (rename, then move) plus the `observeDeck` callback must be under 16 ms. Take the median of 5 runs after 1 warm-up, and multiply the budget by `process.env.CI ? 3 : 1`, documented in a comment. If a budget fails, profile first and do not raise the numbers without reporting it.
- [x] T036 [P] Write ADR `docs/decisions/0005-yjs-document-layout.md`, covering:
  - the persisted layout (data-model table);
  - plain strings with last write wins per field, and why `Y.Text` is deferred, with its upgrade path (ADR + migration, clarification Q2);
  - the id format;
  - the cascade policy: keep and report knowledge objects, re-parent groups, refuse duplicate ids on load (clarifications Q1, Q3, Q4);
  - canonical key order from the schema;
  - undo scope, which covers only the editor's own origin.
- [x] T037 [P] Update `packages/model/CLAUDE.md`: API summary (per the contract), a pointer to the layout comment in `src/deck.ts` and ADR 0005, the browser-free lint guard, and Status (remove the M1 TODO list, list what exists).
- [x] T038 Run the quickstart §2 manual smoke from `specs/002-yjs-model/quickstart.md` and check the expected output.
- [x] T039 Run the full definition of done at the repo root: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix any failures inside `packages/model`. Confirm there are no `.only`/`.skip` and no `any`/`!`.
- [x] T040 Final report, per the AGENTS.md "How to work" step 5: what changed, perf numbers from T035, what was skipped, and what is uncertain. Uncertain points include the Y.Map key order on replicas and the concurrent-move limitation of `Y.Array`. End with the proposed next step (003-canvas-basic or 005).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)**: none.
- **Foundational (2)**: after Setup. **Blocks all stories.** T003 → T006 → T007; T004 and T005 run in parallel after T003.
- **US1 (3)**: after Foundational.
- **US2 (4)**: after Foundational. Independent of US1 (touches `deck.ts`, `key-order.ts` and `load-checks.ts`). T010 uses canonical order when inserting, so if US2 lands second, re-run the US1 tests.
- **US3 (5)**: after US1, which provides the collection and step ops it extends.
- **US4 (6)**: after Foundational. Its tests use US1 ops, so in practice it runs after US1.
- **US5 (7)**: after US1.
- **Polish (8)**: after all stories.

### Story completion order

`Foundational → US1 → (US2 ∥ US3) → US4 → US5 → Polish`

### Within each story

Tests first (they must fail), then pure modules, then editor wiring, then green tests, then commit.

---

## Parallel Example: User Story 1

```text
T008 edit.test.ts        ∥  T009 observe.test.ts
T011 ops/meta.ts         ∥  T010 ops/collections.ts   (different files)
```

## Parallel Example: User Story 3

```text
T022 cascade.test.ts  ∥  T023 rules.test.ts  ∥  T024 integrity.test.ts
T025 integrity.ts     (pure, parallel with the tests)
```

## Parallel Example: Polish

```text
T035 perf.test.ts  ∥  T036 ADR 0005  ∥  T037 CLAUDE.md
```

---

## Implementation Strategy

### MVP first

1. Setup and Foundational (T001–T007).
2. US1 (T008–T015): the surfaces can edit through the model. **Stop and validate.**
3. US2 (T016–T021): files load and save losslessly. The app keeps working.
4. US3 (T022–T029): safe deletes and the integrity report. After this, 003 and 005 are unblocked.

### Incremental delivery

5. US4 (undo polish), then US5 (id proofs), then Polish (perf, ADR, docs, full DoD).

Each phase ends with green `pnpm --filter @sododeck/model test lint typecheck` and one small commit.

## Notes

- `[P]` means different files with no dependency on incomplete tasks.
- Never write `id` after creation; never derive an id from a title.
- Validate before writing, because Yjs cannot roll back. A failed op must leave `toJSON(doc)` unchanged.
- Do not start 003 or 005 (AGENTS.md step 6).
