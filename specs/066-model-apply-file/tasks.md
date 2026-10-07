# Tasks: Apply a changed deck file to an open deck

**Input**: Design documents from `specs/066-model-apply-file/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (3 clarifications), [research.md](research.md) (R1–R11), [data-model.md](data-model.md), [contracts/model-api.md](contracts/model-api.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (Principle VI): unit tests for every pure function, round-trip cases for model changes. Tests are written first and fail before the code that makes them pass. No new e2e tests.

**Paths**: everything is in `packages/model/` unless stated. Work in the worktree `../sododeck-066` (branch `066-model-apply-file`). Read `packages/model/CLAUDE.md` first: `read.ts` / `write.ts` are the only code that knows layout 2. Never `fromY` / `toY` a deck object outside them, except through their helpers.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 outside change in place, US2 undo, US3 refusal, US4 pictures

---

## Phase 1: Setup

- [ ] T001 In `../sododeck-066`, rebase on the latest `origin/main`, run `pnpm install && pnpm --filter @sododeck/model test && pnpm --filter @sododeck/model typecheck` for a green start.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the shared load pipeline, the result types, the origin guard and the two diff building blocks (ordered lists, nested records). Each is pure and unit-tested.

- [ ] T002 Write a failing test in `test/load.test.ts` that `prepareDeck(input)` returns `{ file, metas, bytes, problems, trimmedCrops }` for `full.sododeck.json`, a deck with a legacy anchored note (file has a free note), a damaged picture (problem listed, placeholder meta) and an over-wide crop (trimmed listed); and that `prepareDeck` throws `DeckValidationError` for a dangling reference.
- [ ] T003 In `src/deck.ts`, split `loadDeck` into exported `prepareDeck(input): PreparedDeck` (`repairAssets` → `trimCrops` → `validateDeckFile` → `freeAnchoredStickies`) and `buildDoc(prepared)`. `loadDeck` returns `buildDoc(prepareDeck(input))` plus the same `LoadedDeck` fields. Brand `PreparedDeck` with a module-private `Symbol` and export `isPreparedDeck(value)` for internal use (contract: recognised by brand, never by shape). Make T002 pass, and keep `test/load.test.ts`, `test/round-trip.test.ts` and `test/import-check.test.ts` green unchanged.
- [ ] T004 [P] In `src/import-check.ts`, extract `parseDeckText(text): { ok: false; entries: ProblemEntry[] } | { ok: true; input: unknown }` (BOM strip, `JSON.parse` with `invalidJson`, `newerVersion`) and use it in `inspectDeckText`. Add `refusalEntries(error: DeckValidationError, input)` (sorted `issueEntry` list) and use it there too. Existing `test/import-check.test.ts` must stay green. Add one test per helper in the same file.
- [ ] T005 [P] Create `src/apply-types.ts` with `ApplyCounts`, `ApplySummary`, `ApplyResult` (contract "Types"), and a small `SummaryBuilder` (`added(scope)`, `changed(scope)`, `removed(scope)`, `build()` returning only non-zero scopes). Unit test it in `test/apply-types.test.ts`.
- [ ] T006 Write failing tests in `test/apply-lists.test.ts` for `reconcileOrder(list, targetIds, create, update)` (research R3), on a `ListMap` built with `createObject` / `insertAt` inside a test doc:
  - (a) same order → zero `$order` writes (count with a Yjs `observeDeep`);
  - (b) one item moved → exactly one `$order` key written, and the read order equals the target;
  - (c) reversal of 5 → read order equals the target, with 4 writes (the LIS keeps 1);
  - (d) removed ids are deleted and new ids are created at their target position;
  - (e) tied keys and a malformed key (`'!!'`) still end in the target order (rekey fallback);
  - (f) `update(id, map)` is called for every kept id, `create(item, orderKey)` for every new one.
- [ ] T007 Implement `reconcileOrder` in `src/apply-lists.ts`: delete absent ids, compute the LIS of kept items' current indexes in target order (O(n log n), patience sort), then walk the target placing off-LIS kept items and new items with `keyBetween(prevKey, nextPlacedKey)` via `setOrder` / `noteOrder` from `src/layout.ts`. On a key error, use a rekey of the whole list (reuse or export `rekeyAll` from `layout.ts`). Must be called inside a transaction. Make T006 pass.
- [ ] T008 Write failing tests in `test/apply-records.test.ts` for the field writers (research R4–R5, data-model "Write rules"):
  - `mergeRecord(ymap, plain)`: changed keys written, equal keys untouched (no event), missing keys removed, map-in-map merged recursively;
  - `applyFields(map, kind, current, next)`: scalar and whole-array fields written only when they differ (`jsonEqual`); `position` / `size` per axis; a long text field that differs replaced by a **new** `Y.Text` instance (assert `!==` old) with the blank-marker rule (`''` on an optional field sets `$blank:<field>`, a non-empty value clears it); equal text untouched; `values` through `writeValues`; `style` as a nested map merge; `views` `positions` / `groupFrames` merged per key;
  - `replaceArray(yarray, values)`: same contents → no write, different → contents replaced in the same `Y.Array` instance.
- [ ] T009 Implement `mergeRecord`, `applyFields` and `replaceArray` in `src/apply-records.ts`. Use `isTextField` / `isRequiredText` / `TEXT_FIELDS` from `src/text-fields.ts`, `blankKey` / `valueKey` from `src/text.ts`, `toY` / `fromY` / `jsonEqual` from `src/convert.ts`. Export what you need from `src/write.ts` (e.g. `writeValues`) rather than duplicating it. Skip `id`, the table child lists, a flow's `steps` / `branches` and a rule's `inputs` / `outputs` / `rows` (handled by the callers). Make T008 pass.

**Checkpoint**: `pnpm --filter @sododeck/model test` green. The building blocks exist and are not yet wired.

---

## Phase 3: User Story 1 — An outside change appears in place (P1) 🎯 MVP

**Goal**: `applyFile` makes the open deck equal to a valid file, writing only what differs, matched by id at every level, in one transaction.

**Independent test**: quickstart scenarios 1–6, 14, 16.

- [ ] T010 [US1] Write failing tests in `test/apply-file.test.ts` (load A with `loadDeck`, attach `observeDeck` and `createDeckSnapshot`, then apply a modified copy with `const origin = { test: 'host' }`):
  - (1) rename one node in `full.sododeck.json` → one `DeckChange`, one change entry naming that node and `title`; the stored `Y.Map` of every other node is the same instance; snapshot identity is kept for untouched objects (US1 AS1);
  - (2) add an edge and remove a sticky → `summary` is `{ edges: { added: 1, … }, stickies: { removed: 1, … } }` and nothing else changes (AS2);
  - (3) change a flow step's text, a rule row cell, and a `db-table` column `type` (use `shopDeck` from `test/helpers.ts`) → one change each, naming the child and key (AS3);
  - (4) move a step, a rule row, a table column and a view → the read order equals the file's; untouched siblings report no change (AS4);
  - (5) apply the same file twice → the second returns `changed: false`; no `observeDeck` call; no `doc.on('update')` event (AS5, FR-007);
  - (6) a locked node moved and unlocked by the file → applied (FR-017);
  - (7) meta changes: `name`, `description`, `packs`, `tagColors`, `swatches`, `dialect`, `groupingMode`, `canvasBackground`, `fields` (+ options), `enums` (+ values), `fieldDefaults` → each applied, `summary.meta.changed === 1`;
  - (8) an object id moving collection (a sticky removed and a node added with the same id) → applied;
  - (9) passing an editor origin (from `createEditor(doc)`, reached through a test-only export or by capturing `transaction.origin` of an editor write) → throws `TypeError`, nothing written (FR-016 contract);
  - (10) every change is reported with `origin: 'remote'`.
- [ ] T011 [US1] Create `src/apply-file.ts` with `applyFile(doc, input, origin)`:
  - origin guard: `editorOrigins.has(origin)` → `TypeError`;
  - prepare: `isPreparedDeck(input) ? input : prepareDeck(input)`, catching `DeckValidationError` into `{ status: 'refused', entries: refusalEntries(...) }`;
  - fast path: `JSON.stringify(toJSON(doc)) === JSON.stringify(canonicalize(prepared.file))` → `changed: false` with no transaction (R2);
  - else `doc.transact(() => { diffMeta; for each of COLLECTIONS diffCollection; diffRules }, origin)` using `reconcileOrder` + `applyFields`;
  - child lists: a flow's `steps` / `branches` (keep the `$blank:branches` rule), a node's `columns` / `indexes` / `checks` (create the list when the file has one and the doc does not; delete the key when the file drops it), `meta.fields` (+ `options`), `meta.enums` (+ `values`), each through `reconcileOrder` with `createObject` / `createField` / `createOption` / `createEnum`;
  - rules: `inputs` / `outputs` via `reconcileOrder`, then `rows` via `reconcileOrder` with `createRow`, and for kept rows a merge of `cells` keyed by column id (desired cells from `when` / `then` by the file's column order; cells of removed columns deleted);
  - meta: scalars, `description` text, `swatches` via `replaceArray`, map-valued keys via `mergeRecord` (attach a new map when the stored one is missing or detached, as `tagColorsMap` notes), lazy keys created or removed to match the file (`packs`, `fields`, `fieldDefaults`, `enums`, `assets`);
  - fill `summary` through `SummaryBuilder` (child edits count the owner as changed);
  - return `{ status: 'applied', changed: true, summary, bytes, problems, trimmedCrops }`.
    Make T010 pass.
- [ ] T012 [US1] Export `applyFile`, `prepareDeck`, `PreparedDeck` and the apply types from `src/index.ts`.
- [ ] T013 [US1] Write failing tests in `test/apply-file-roundtrip.test.ts` (SC-001, FR-014):
  - corpus = `minimal`, `flow-and-rule`, `full` examples (`readExample`), the `perType` cases from `test/round-trip.test.ts` (move them into `test/helpers.ts` as `perTypeDecks` and import them in both files), `shopDeck()`, an images deck from `test/image-helpers.ts`, `largeDeck` at a small size, and `emptySododeckFile()`;
  - for every ordered pair (A, B): `serializeDeck(applied doc)` is byte-equal to `serializeDeck(loadDeck(B).doc)`;
  - a seeded generated-edit loop (no new dependency; a small LCG in the test): 200 rounds on `full`, each applying 1–5 random edits (rename, move position, reorder a list, add or remove an object or child, edit a rule cell, toggle a meta key) to the last file, then applying it and checking equality, plus that ids present before and after keep their `Y.Map` instance.
- [ ] T014 [US1] Fix the gaps T013 finds in `src/apply-file.ts` / `src/apply-records.ts` until the pairwise and generated tests pass.

**Checkpoint**: US1 complete. `applyFile` is usable by 067.

---

## Phase 4: User Story 2 — Undo still means "my last edit" (P1)

**Goal**: applied changes are never undone or redone, never add an undo step, never split one, and the file wins over an undo of an overwritten field.

**Independent test**: quickstart scenarios 7–11, 15.

- [ ] T015 [P] [US2] Write tests in `test/apply-file-undo.test.ts` with `createEditor(doc, { captureTimeout: 0 })` unless stated:
  - (1) the user moves node A, the file renames node B, undo → A back, B keeps the file's title; redo → A moved again, B unchanged (AS1);
  - (2) apply on a fresh editor → `canUndo()` false and no `onHistoryChange` call (AS2);
  - (3) the user sets a title, the file sets another, `undo()` → returns without throwing; the title equals the file's (AS3);
  - (4) the user types a description in two updates, the file rewrites the description, undo → the description equals the file's (FR-018, research R4);
  - (5) the user deletes a node, the file re-adds it, undo → the file's node stays;
  - (6) `captureTimeout: 10_000`: two typing updates on one title with an apply on another node between them → one undo step (AS4);
  - (7) `beginGesture`, a move, apply a file changing another node, a move, `endGesture`, undo → both moves undone, the applied change stays (edge case "mid-gesture");
  - (8) the undo and redo stack lengths are equal before and after an apply (data-model invariant 3).
- [ ] T016 [US2] Fix any failing case in `src/apply-file.ts` / `src/apply-records.ts`. Expected to pass with the untracked origin and fresh `Y.Text`. If (4) fails, check that every text write in the apply path goes through the fresh-`Y.Text` rule and never through `writeText`.

**Checkpoint**: US1 + US2 complete.

---

## Phase 5: User Story 3 — A broken file is refused, not half-applied (P1)

**Goal**: invalid input returns the import problem list and leaves the doc, its observers and its undo history untouched. Also provides the text entry point.

**Independent test**: quickstart scenario 12.

- [ ] T017 [P] [US3] Write failing tests in `test/apply-file.test.ts` (new `describe('refusal')`):
  - a dangling edge `to`, a duplicate node id, a missing required `title`, and `version: 2` → `status: 'refused'` with `entries` deep-equal to `inspectDeckText(JSON.stringify(input))`'s entries;
  - `toJSON(doc)` unchanged, no `observeDeck` call, and the editor's `canUndo()` / stack lengths unchanged; a user edit afterwards undoes normally (AS4);
  - `applyDeckText(doc, 'not json', origin)` → one `invalid-json` entry; with a BOM-prefixed valid text → applied.
- [ ] T018 [US3] Add `applyDeckText(doc, text, origin)` to `src/apply-file.ts` (`parseDeckText`, then `applyFile`), make the `newerVersion` refusal reachable from `applyFile` too (check before `prepareDeck`), and export `applyDeckText` from `src/index.ts`. Make T017 pass.

**Checkpoint**: all P1 stories complete.

---

## Phase 6: User Story 4 — Pictures in an outside change (P2)

**Goal**: picture bytes are returned, damaged pictures never refuse the file, and empty `data` never clears what the deck has.

**Independent test**: quickstart scenario 13.

- [ ] T019 [P] [US4] Write failing tests in `test/apply-file-images.test.ts` using `test/image-helpers.ts`:
  - (1) a file adding one image with valid base64 → the image exists, `result.bytes.get(assetId)` equals the bytes, and `meta.assets` has the picture's facts;
  - (2) a file whose picture data is damaged (bad base64) → `problems` lists `bad-data`, everything else is applied, and the image reads with its placeholder meta exactly as `loadDeck` of that file;
  - (3) re-applying the same deck with `data: ''` for its pictures → `changed: false`;
  - (4) a file removing an image → the image is gone and its `meta.assets` entry stays (R8); `toJSON` has no `assets` for it.
- [ ] T020 [US4] Implement the asset meta merge in `src/apply-file.ts`: for each picture in `prepared.file.assets`, write `prepared.metas.get(id) ?? metaOf(asset)` via `mergeRecord` into `assetsMap(doc)` (create the lazy map when absent). Never delete entries. Make T019 pass, and re-run T013.

**Checkpoint**: every story complete.

---

## Phase 7: Polish & cross-cutting

- [ ] T021 Add SC-003 cases to `test/perf.test.ts` with `largeDeck()` (500 / 1,000): apply a file with one changed node title (< 50 ms) and a file where every node, edge and step changed (< 1 s), using the file's existing timing and tolerance pattern. Record the measured numbers in `specs/066-model-apply-file/perf-results.md`.
- [ ] T022 [P] Write the ADR `docs/decisions/00NN-apply-file-merge.md` (next free number after a fresh `git fetch`): file wins field by field with no common base; untracked caller origin, never undone; fresh `Y.Text` for a changed long text (with the Yjs evidence from research R4); LIS order reconciliation; asset metas never removed; locks ignored; `prepareDeck` split for worker validation.
- [ ] T023 [P] Update `packages/model/CLAUDE.md` with an "Added by 066" entry: `applyFile`, `applyDeckText`, `prepareDeck` / `PreparedDeck`, `ApplyResult` / `ApplySummary`, the editor-origin `TypeError`, the files `apply-file.ts` / `apply-lists.ts` / `apply-records.ts` / `apply-types.ts`, and the rule that a new stored list or nested map must be added to the apply diff (the round-trip corpus will fail otherwise).
- [ ] T024 [P] Mark 066 in `docs/backlog-3.md` as specified/implemented with links to `specs/066-model-apply-file/`.
- [ ] T025 Run the definition of done from the repo root: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix anything red. Confirm no `.only` / `.skip`.
- [ ] T026 Walk through `quickstart.md` scenarios 1–17 and tick each one against a test name. Note any scenario not covered.
- [ ] T027 Commit in small Conventional Commits (`feat(model): …`, `test(model): …`, `docs: …`; no AI attribution trailer per AGENTS.md), push the branch and open a PR to `main` with a summary, perf numbers, assumptions and the next step (067).

---

## Dependencies & execution order

- **Setup (T001)** → **Foundational (T002–T009)** → stories.
- In Foundational: T002 → T003; T004, T005 [P]; T006 → T007; T008 → T009. T004/T005 can run in parallel with T002–T003 and T006–T009 (different files).
- **US1 (T010–T014)** needs all of Foundational. It is the MVP and the base of the other stories.
- **US2 (T015–T016)** needs US1 (`applyFile` exists). Its tests can be written in parallel with T013.
- **US3 (T017–T018)** needs T003, T004 and T011. It can run in parallel with US2.
- **US4 (T019–T020)** needs US1. It can run in parallel with US2 and US3 (different test file; T020 touches `apply-file.ts`, so do not edit it at the same time as T016/T018).
- **Polish (T021–T027)** after all stories; T022–T024 [P].

```text
T001 → T002 → T003 ┐
       T004 [P] ───┤
       T005 [P] ───┤
       T006 → T007 ┤
       T008 → T009 ┴→ T010 → T011 → T012 → T013 → T014 ┬→ US2 (T015 → T016)
                                                        ├→ US3 (T017 → T018)
                                                        └→ US4 (T019 → T020) → Polish
```

## Parallel examples

- **Foundational**: run T004 (`import-check.ts`), T005 (`apply-types.ts`), T006/T007 (`apply-lists.ts`) and T008/T009 (`apply-records.ts`) side by side once T001 is done.
- **After US1**: write T015 (`apply-file-undo.test.ts`), T017 (refusal tests) and T019 (`apply-file-images.test.ts`) in parallel. Then apply T016, T018 and T020 one after another (they share `apply-file.ts`).
- **Polish**: T022 (ADR), T023 (`CLAUDE.md`) and T024 (backlog) in parallel.

## Implementation strategy

1. **MVP = Phases 1–3 (US1)**: `applyFile` with the pairwise round trip green is enough for 067 to start.
2. Add **US2** (undo guarantees, mostly tests) and **US3** (refusal + text entry) next. Both are P1 and must land before merge.
3. Add **US4** (pictures).
4. Polish: perf numbers, ADR, docs, full definition of done, PR.
