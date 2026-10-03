# Tasks: Collaboration-Ready Deck Document

**Input**: design documents in `specs/036-collab-ready-document/`:

- [plan.md](plan.md) and [spec.md](spec.md). Founder decisions of 2026-10-03: no format revision, no read-only mode, no migration of stored decks (§g-81, §g-82); collapsed groups stay shared.
- [research.md](research.md) (R1–R12) and [data-model.md](data-model.md) (stored layout 2).
- [contracts/model-contract.md](contracts/model-contract.md) (what callers rely on) and [contracts/schema-roadmap.md](contracts/schema-roadmap.md) (draft of ADR 0022).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change.
- Component tests (Testing Library) by role and name for app behaviour.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **`packages/schema` is not edited.** The `.sododeck.json` format does not change; `serializeDeck(toJSON(fromJSON(f)))` stays byte-identical for every valid file (FR-001, FR-002).
- **The public API of `@sododeck/model` does not change** (signatures, errors, undo grouping, `DeckChange`, snapshot contract; [contract](contracts/model-contract.md)). The only additions are `isLegacyLayout` and `EditorOptions.repair`.
- **Do not rewrite existing tests that use the public API.** They are the proof of "nothing changed" (SC-002). Only the tests that reach into the Yjs layout (`doc.getArray(…)`) are updated: `observe`, `snapshot`, `stickies`, `editor-core`, `undo` in `packages/model/test`, and `use-deck-snapshot.test.tsx`, `flyouts.test.tsx` in `apps/app/src`.
- **`Y.Text`, order keys and `$…` keys never leave `packages/model`.**
- **No migration, no stored version marker** (R10). Old stored decks are refused with a message, never opened empty.
- **Repair writes only view entries that name nothing** (R9). Nothing a person wrote is deleted or renamed automatically (FR-020).
- **Out of scope**: a server, presence, sharing; the schema fields of the roadmap (each belongs to its own feature); `Y.Text` for short fields; the known last-write-wins spots listed in R11.

**Approvals**: no new runtime dependency (the fractional-index generator is our own, R3). The missing migration is a recorded deviation from constitution II, waived by the founder (plan, Complexity Tracking).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, and no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Model**: `packages/model/src/…`, tests in `packages/model/test/`. Read `packages/model/CLAUDE.md` first: validate before writing, ops live in `src/ops/`, no React / DOM / storage imports, must run in Node and Web Workers.
- **App**: `apps/app/src/…`, tests next to the code. Read `apps/app/CLAUDE.md`.
- **Docs**: `docs/decisions/`, `docs/backlog.md`, `docs/design/design-analysis.md`, `docs/diagram-handbook.md`.
- **Commits**: small Conventional Commits (`feat(model): …`, `refactor(model): …`, `test(model): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [ ] T001 Create the implementation branch from the latest `main` (after the docs PR for this spec is merged). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` to confirm a green start.
- [ ] T002 Run `pnpm bench` on the unchanged code and save the tables in `specs/036-collab-ready-document/bench-before.md`. Also record the timings printed by `pnpm --filter @sododeck/model test perf` and `pnpm --filter @sododeck/app test deck-persistence.perf`.
- [ ] T003 Founder step, noted in `specs/036-collab-ready-document/quickstart.md` "Before upgrading": export every stored deck worth keeping to `.sododeck.json` on the current build. Do not start Phase 3 on the founder's machine before this is confirmed.

---

## Phase 2: Foundational (pure building blocks)

**Purpose**: modules with no dependency on the layout switch. Each is written test-first and leaves the whole suite green.

- [ ] T004 [P] Write `packages/model/test/order-key.test.ts`: `keyBetween(null, null)` is a valid key; `a < keyBetween(a, b) < b` by code-unit comparison for 1,000 random pairs; `keyBetween(a, null)` and `keyBetween(null, b)` extend the ends; `keysBetween(a, b, n)` returns `n` strictly increasing keys inside `(a, b)`; 10,000 successive appends keep keys ≤ 6 characters; `keysBetween(null, null, 500)` keys are ≤ 3 characters; equal or reversed bounds throw.
- [ ] T005 Implement `packages/model/src/order-key.ts` (research R3): base-62 alphabet `0-9A-Za-z`, variable-length integer head plus fractional part, `keyBetween(a: string | null, b: string | null): string`, `keysBetween(a, b, n): string[]`, `compareKeys(a, b)` (plain code-unit comparison, never `localeCompare`). Make T004 pass.
- [ ] T006 [P] Write `packages/model/test/text.test.ts`: `writeText(ytext, next)` leaves the text equal to `next`; it deletes and inserts only the differing middle (assert on the `Y.Text` delta: common prefix and suffix are retained); no-op when equal; never splits a surrogate pair (two different emoji sharing a high surrogate); `''` empties the text and keeps the `Y.Text` attached.
- [ ] T007 Implement `packages/model/src/text.ts`: `writeText(ytext: Y.Text, next: string): void` (common prefix / suffix splice, surrogate-safe) and the read rule `readText(map, field, required)` with the `$blank:<field>` marker from data-model "Long text" (`BLANK_PREFIX = '$blank:'`). Make T006 pass.
- [ ] T008 [P] Create `packages/model/src/text-fields.ts`: `TEXT_FIELDS` by kind (`meta`, `nodes`, `groups`, `edges`, `features`, `flows`, `stickies`, `views`, `step`, `branch`, `rule`) per data-model "Long text", and `isTextField(kind, key)`. Add `packages/model/test/text-fields.test.ts`: walking `jsonSchema` from `@sododeck/schema`, every string property whose `description` contains "(markdown)" is in the table, plus `Step.payload`; no table entry names a property the schema does not have.

**Checkpoint**: `pnpm --filter @sododeck/model test` green; nothing else changed yet.

---

## Phase 3: User Story 1 - Everything works as before, on the new foundation (Priority: P1) 🎯 MVP

**Goal**: the stored document uses layout 2 ([data-model.md](data-model.md)); every existing behaviour, the public API and the exported file are unchanged.

**Independent Test**: the existing model and app suites pass with no public-API test rewritten; the new round-trip cases pass; exports of the example files and the generated decks are byte-identical.

> The layout cannot switch one collection at a time (R1): T010–T024 land together and the model suite is red until T025. Commit per task anyway; keep `pnpm --filter @sododeck/model typecheck` green from T014 on.

### Tests first

- [ ] T009 [P] [US1] Extend `packages/model/test/round-trip.test.ts` with the cases in data-model "Round-trip cases to add": `description: ""` on the deck, a node and a step; `notes: ""`, `payload: ""`; a sticky with `text: ""`; a flow whose steps are not in normal order (a branch step before a main step); a rule whose rows contain `''` cells; and, for `minimal`, `flow-and-rule`, `full` and `largeDeck()` at 500 and 2,000 nodes, `serializeDeck(toJSON(fromJSON(f))) === serializeDeck(f)`. They pass on the old layout too: run them before T010 and keep the output as the baseline.

### Implementation

- [ ] T010 [US1] Rewrite `packages/model/src/layout.ts` for map roots: `collectionMap(doc, c): Y.Map<YObject>` (replaces `collectionArray`), `rulesMap`, `metaMap`, `swatchesArray`, `rootTypes` (maps), constants `ORDER_KEY = '$order'` and `isInternalKey(key)`; list helpers used by every op: `orderedEntries(list): [Id, YObject][]` (sorted by `($order, id)`), `orderedIds(list)`, `lastKey(list)`, `insertAt(list, id, object, index?)` (key after the last, or between the neighbours at `index`; when the neighbours' keys are equal, re-key the tied run after the insertion point in the same transaction, R3; on a key error re-key the whole list), `moveTo(list, id, toIndex)` (one `set('$order', …)`, clamped index, no-op when the position is unchanged). Remove `indexOfId`.
- [ ] T011 [US1] Create `packages/model/src/write.ts` (R8): `createObject(kind, plain, order): YObject` (no `id` key; long text fields from `TEXT_FIELDS` become `Y.Text`, always created, with `$blank:<field>` when the plain value is `''`; flows get `steps` and `branches` maps always, children created recursively with `keysBetween` in array order, `$blank:branches` when the file has `branches: []`); `createRule(plain, order)` (`inputs`, `outputs`, `rows` maps; each row `{ $order, cells: Y.Map<columnId, string> }` built from `when` / `then` by column position); `writeField(map, kind, key, value)` (long text → `writeText` and marker rules of data-model "Long text"; `position` / `size` keep their nested map as `ops/patch.ts` does today; otherwise `toY`).
- [ ] T012 [US1] Create `packages/model/src/read.ts` (R8): `readObject(kind, id, map)` (adds `id`; skips `$…` keys; `Y.Text` via `readText`; flows: `steps` and `branches` as ordered arrays, `branches` omitted when empty unless `$blank:branches`; an empty `style` map omitted, R9), `readRule(map)` (`when = inputs.map(c => cells.get(c.id) ?? '')`, `then` likewise), `readMeta(doc)`, `readCollection(doc, c)` (ordered). Results go through `canonicalizeEntry` at the call sites as today.
- [ ] T013 [US1] Update `packages/model/src/deck.ts`: `fromJSON` builds layout 2 with `createObject` / `createRule` and `keysBetween(null, null, n)` per list (rules included, in the file's key order); `meta.description` is a `Y.Text`; `toJSON` reads through `read.ts` (rules written in `$order` order); `getObject` / `getRule` are `map.get(id)` + reader. Replace the layout comment at the top of the file with the layout-2 table.
- [ ] T014 [US1] Update `packages/model/src/ids.ts` (`forEachDeckId`, `deckHasId`, `anchorableIds` iterate map keys and child maps), `packages/model/src/validate.ts` (`exists` uses `collectionMap(doc, target).has(id)`), and `packages/model/src/ops/context.ts` (replace `findIndexById` / `getMapById` with `requireEntry(list, id, what): YObject` throwing the same `not-found` messages).
- [ ] T015 [US1] Rewrite `packages/model/src/observe.ts` for map roots (R6): ids from the event path and `changes.keys`; root-level key add / delete / update → `added` / `removed` / `updated`; child maps (`steps`, `branches`, `inputs`, `outputs`, `rows`) → `child` changes with the same kinds as today; `keys` exclude internal keys, so a `$order` change alone is `updated` with `[]`; a `Y.Text` change reports its field name; a row `cells` change reports the row as `updated` with the keys the old `when` / `then` edit reported. The `DeckChange` shape, ordering by scope and the merge rules stay exactly as documented in `specs/002-yjs-model/contracts/model-api.md`.
- [ ] T016 [US1] Update `packages/model/src/snapshot.ts`: rebuild touched objects with `readObject` / `readRule`; keep the previous order of a collection when every change in it is `updated` with non-empty `keys`, and re-sort (via `orderedEntries`) only when a change is `added`, `removed` or `updated` with no keys; `rules` is rebuilt in rule order.
- [ ] T017 [US1] Update `packages/model/src/ops/patch.ts`, `ops/collections.ts` and `ops/meta.ts`: `updateObject` reads the current object with `readObject`, validates the candidate as today, writes changed keys with `writeField`; `addObject` uses `createObject` + `insertAt` (append); `reorderObject` uses `moveTo`; delete `moveInArray`; `updateMeta` writes `description` through `writeText`.
- [ ] T018 [US1] Update `packages/model/src/ops/steps.ts`: `stepsOf` returns the flow's step map; `addStep(index?)` uses `insertAt` on the flat ordered list; `updateStep` uses the reader / `writeField`; `moveStep` keeps its two refusals (computed on `orderedEntries`) and then calls `moveTo`; `branchIdsOf` reads the ordered branch map.
- [ ] T019 [US1] Update `packages/model/src/ops/branches.ts`: `appendStep` / `appendIndex` on the ordered list; `addBranch` inserts into the always-present `branches` map (no create-on-first-use), sets `branch` on the following main steps, inserts the first step by key; `updateBranch` through the reader / `writeField`; `restoreFlowStructure` as a diff (data-model "Operations"): delete steps and branches not in the checkpoint, re-create removed ones, restore `edge`, `branch` and the checkpoint order with fresh keys, keep the current text of objects that still exist; clear `$blank:branches` semantics so the result reads as before.
- [ ] T020 [US1] Update `packages/model/src/ops/rules.ts` and the rule part of `ops/cascade.ts` (R5): `addRule` via `createRule` + rule `$order`; `addRuleColumn(index?)` is one `insertAt` (no per-row writes); `renameRuleColumn`; `moveRuleColumn` is one `moveTo`; `addRuleRow(index?)` builds `cells` from the given `when` / `then`; `setRuleCell` is `cells.set(columnId, value)` after validating the candidate row as today; `moveRuleRow`, `removeRuleRow`; `removeRuleColumn` deletes the column and that key from every row's `cells`, and the sample inputs as today.
- [ ] T021 [US1] Update `packages/model/src/ops/cascade.ts`: iterate with `orderedEntries` so `RemovalResult` lists objects in the same order as before; delete by key (`deleteById` becomes `list.delete(id)`); `removeBranch` keeps the `branches` map and deletes the branch and its steps; flows list their owned steps and branches from the child maps. Behaviour and results unchanged.
- [ ] T022 [P] [US1] Update `packages/model/src/ops/views.ts` and `ops/frames.ts`: lookups by key; "the base view" is the first of `orderedIds(views)`; `materialize` writes the three presets with their fixed ids and `keysBetween(null, null, 3)` (untracked); `addView` appends with `insertAt`; `currentViews` reads ordered.
- [ ] T023 [P] [US1] Update `packages/model/src/ops/paste.ts`, `ops/group-selection.ts`, `ops/rule-links.ts`, `ops/stickies.ts`, `ops/style.ts` and `ops/shape.ts`: lookups by key, appends with `insertAt` in the same order as today's pushes (groups, then nodes, then edges for a paste), reads through `readObject`; `deleteStickyIfPresent` deletes by key. No behaviour change.
- [ ] T024 [US1] Update `packages/model/src/editor.ts` (only what the new helpers require), `packages/model/src/preview.ts` if needed, and `packages/model/src/index.ts`. Check with `grep -rn "collectionArray\|indexOfId\|getArray" packages/model/src` that no array access to a collection remains.
- [ ] T025 [US1] Update the model tests that reach into the layout to layout 2 or to the public API: `packages/model/test/observe.test.ts`, `snapshot.test.ts`, `stickies.test.ts`, `editor-core.test.ts`, `undo.test.ts` (remote edits simulated on a second document and applied as an update where possible). Then run `pnpm --filter @sododeck/model test`: every other test file passes **without edits**; T009's cases produce the baseline output.
- [ ] T026 [US1] Update the two app tests that used `doc.getArray('nodes')`: `apps/app/src/model/use-deck-snapshot.test.tsx` and `apps/app/src/editor/shell/flyouts.test.tsx` (use `toJSON(doc)` or an editor). Run `pnpm --filter @sododeck/app test`: green with no other test edited.

### Old stored decks (FR-027)

- [ ] T027 [P] [US1] Write `packages/model/test/legacy-layout.test.ts`: a helper in `packages/model/test/helpers.ts` builds a document in the old layout by hand (`doc.getArray('nodes').push([map])`, a rule with `inputs` as `Y.Array`, `meta.description` as a string); `isLegacyLayout` is true for each of the three signs and for a document loaded from that one's update bytes; false for `fromJSON(full)`, `createDeck()`, and a new deck loaded from its own update bytes.
- [ ] T028 [US1] Implement `isLegacyLayout(doc)` in `packages/model/src/layout.ts` (R10: a collection root holding list items, a rule whose `inputs` is a `Y.Array`, a string `meta.description`) and export it from `packages/model/src/index.ts`. Make T027 pass.
- [ ] T029 [US1] App, test first: in `apps/app/src/routes/` add a loader test (a stored legacy update → `{ kind: 'unsupported' }`) and an editor-page test (the not-found page shows "This deck was saved by an earlier development build and can't be opened. Import its exported .sododeck.json file again."); in `apps/app/src/storage/library-ops.test.ts`, `exportDeck`, `rename` and `duplicate` of legacy bytes throw `LibraryOpError` with code `'unsupported-deck'`. Then implement: `routes/deck-loader.ts` (build the document from the log and check `isLegacyLayout` before returning `stored`), `routes/editor-page.tsx` + `routes/deck-not-found-page.tsx` (the sentence, tokens only), `storage/library-ops.ts` `load()` (throw `'unsupported-deck'`), and the library's error text where `LibraryOpError` codes are mapped to messages. Nothing stored is modified.

### Performance

- [ ] T030 [US1] Extend `packages/model/test/perf.test.ts` (same `median` / `SLACK` pattern): at 10,000 nodes / 20,000 edges, one `update('nodes', id, { title })` takes ≤ 2× the 500-node median (and < 1 ms × SLACK), and one `reorder('nodes', id, 0)` takes < 10 ms × SLACK (SC-005). Confirm the existing load, edit, snapshot, search and check budgets still hold; if one fails, profile before changing any number.

**Checkpoint**: US1 is shippable on its own: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.

---

## Phase 4: User Story 2 - Reordering in one tab never loses or duplicates work from another (Priority: P2)

**Goal**: guarantees 1–6 and 8–9 of the [contract](contracts/model-contract.md) hold for two documents exchanging updates in any order.

**Independent Test**: `packages/model/test/concurrency.test.ts`, list scenarios, both delivery orders.

- [ ] T031 [US2] Add to `packages/model/test/helpers.ts`: `twoDocs(file)` → `{ a, b }`, each `{ doc, editor }`, `b` loaded from `a`'s state as an update; `sync(a, b, order: 'ab' | 'ba')` exchanging state-vector diffs in the given order; `bothOrders(file, editA, editB, check)` running a scenario twice (once per delivery order) and asserting `toJSON(a.doc)` deep-equals `toJSON(b.doc)` with every list in the same order before calling `check`.
- [ ] T032 [US2] Write `packages/model/test/concurrency.test.ts` (lists), each with `bothOrders`: move a step vs edit its title (both survive, AS1); the same step, node and rule row moved to different places on both sides (exists once, same place, AS2); both sides append a node, and both insert a step at the same index (all kept, same order, AS3), then a later local insert between the two tied items lands between them and both documents agree; delete vs move and delete vs field edit (gone, no partial item, AS4); undo of a move on one side keeps the other side's edit (AS6); add column vs add row, move column vs set cell, remove column vs add row (every row reads one cell per column; `fromJSON(toJSON(doc))` does not throw); set two different cells of one row (both kept); add branch (splitting the tail) vs append a main step (no step lost or duplicated, each path in order, R4); both sides make their first view edit (three presets, not six); a title set on both sides (one wins on both, other fields untouched, guarantee 8).
- [ ] T033 [US2] Fix whatever T032 exposes in `packages/model/src/layout.ts` (`insertAt` tie re-keying, deterministic tie-break), `ops/steps.ts`, `ops/branches.ts`, `ops/rules.ts` and `ops/views.ts`. No public API change.

**Checkpoint**: lists are collaboration-safe; full suite green.

---

## Phase 5: User Story 3 - Two people typing in the same text keep both texts (Priority: P3)

**Goal**: long text merges character by character in the model, and a focused field in the app keeps the user's typing and caret when an outside change arrives.

**Independent Test**: the text scenarios of `concurrency.test.ts`; `rebase-draft.test.ts`; the `useLiveField` component test.

- [ ] T034 [US3] Add text scenarios to `packages/model/test/concurrency.test.ts` with `bothOrders`: a sentence at the start on one side and at the end on the other (AS1); both type at the same offset (both present, neither interleaved inside the other's word, AS2); clear on one side vs type on the other (typed text survives); both sides type the first text of an empty description, of a step's `notes`, and of a sticky's `text` (both survive); whole-field replace on one side vs a small edit elsewhere on the other (non-overlapping parts kept, FR-015); a title changed on both sides stays last-write-wins (AS5); after typing on both sides, `toJSON` holds a plain string and `serializeDeck` round-trips (AS6); undo on one side removes only that side's characters (AS4, FR-017).
- [ ] T035 [US3] Fix whatever T034 exposes in `packages/model/src/text.ts`, `write.ts` and `ops/patch.ts`.
- [ ] T036 [P] [US3] Write `apps/app/src/editor/fields/rebase-draft.test.ts`, then implement `apps/app/src/editor/fields/rebase-draft.ts` (pure, R7): `rebaseDraft(base, theirs, draft): string` applies the outside change (the single splice between `base` and `theirs`) to `draft`, where `draft` differs from `base` by the local splice (leading / trailing whitespace the field trims included); `rebaseCaret(base, theirs, caret): number` shifts a caret after the outside splice and keeps one before it. Cases: outside insert before, after and inside the local edit; outside delete; identical texts; a draft with trailing spaces the document does not have.
- [ ] T037 [US3] Extend `apps/app/src/editor/fields/use-live-field.test.tsx` (by role and label): while a multiline field has focus and holds unsaved typing, the `value` prop changes because of an outside edit → the field shows both texts, the next write contains both, the caret is still after the user's last typed character, and the single-undo-step behaviour is unchanged. Then implement in `apps/app/src/editor/fields/use-live-field.ts`: remember the document value the draft was based on; on a `value` change while focused that is not the hook's own last write, replace the draft with `rebaseDraft(…)` and restore the selection with `rebaseCaret(…)` in a layout effect. Callers (`field-edit.tsx`, `textarea-edit.tsx`, `combo-field.tsx`, `stickies/sticky-node.tsx`) need no change; confirm their tests pass untouched.

**Checkpoint**: full suite green; quickstart scenarios 4 and 5 work in two tabs.

---

## Phase 6: User Story 4 - A change from elsewhere never leaves a silently broken deck (Priority: P4)

**Goal**: outside changes are checked like local ones; content is kept and reported; view entries that name nothing are removed, untracked, once.

**Independent Test**: `repair.test.ts` and the US4 scenarios of `concurrency.test.ts`.

- [ ] T038 [US4] Write `packages/model/test/repair.test.ts`: `repairViewRefs` removes ids naming nothing from `includes`, `pinned`, `collapsed`, `excludeGroups` and keys from `positions` and `groupFrames`, in every stored view, and drops a list or map it empties (as the local cascade does); it changes nothing in a clean deck (no transaction emitted); with two editors (`twoDocs`): after "A deletes a node, B pins it" and a sync, neither view lists the node, neither editor gained an undo step (`canUndo` unchanged apart from each side's own edit), and a second sync round carries no further change (settles, FR-022); a file loaded with a dangling `pinned` id keeps it until a non-local change arrives (opening never repairs); `createEditor(doc, { repair: false })` never repairs.
- [ ] T039 [US4] Implement `packages/model/src/repair.ts` (`repairViewRefs(doc): boolean`, pure Yjs writes, no transaction of its own) and the hook in `packages/model/src/editor.ts` (R9): after a transaction whose origin is not one of this editor's and whose `DeckChange` removed a node or group, or added or updated a view, run `repairViewRefs` inside `transactUntracked`; option `repair?: boolean` (default `true`) on `EditorOptions`; pass `repair: false` in `packages/model/src/preview.ts`. Detach the listener in `destroy()`. Make T038 pass.
- [ ] T040 [US4] Add US4 scenarios to `packages/model/test/concurrency.test.ts` with `bothOrders`: delete a node vs connect to it → the edge is kept, `checkDeck(toJSON(doc))` lists a broken reference for it on both sides, and undo of the delete on the deleting side clears the problem (AS1, AS2); delete vs pin / position / include (AS3, through T039); clear fill on one side and stroke on the other → no `style` in `toJSON`, and `fromJSON(toJSON(doc))` does not throw (AS4); each side makes one group the parent of the other → both groups kept and the cycle is in `checkIntegrity` (AS5); remove a branch on one side vs append a step to it on the other → the step is kept and `analyzeFlow` reports `unknown-branch`.
- [ ] T041 [P] [US4] App, test first: in `apps/app/src/editor/problems/` (next to `problems-store`), a test that a change applied to the document with a non-editor origin (an update from a second document) updates the problems count with no user action and no extra delay beyond the store's existing throttle (FR-019, SC-007); in `apps/app/src/editor/visible-graph.test.ts` (or `deck-to-flow.test.ts`), a connection whose end names no component is not drawn. Fix only if a test fails.

**Checkpoint**: full suite green; quickstart scenarios 6 and 7.

---

## Phase 7: User Story 5 - The format's next steps are written down in one place (Priority: P5)

**Goal**: two ADRs and updated docs, so the documented layout matches the stored one and 029–032 start from one design.

**Independent Test**: each schema change of backlog 029, 033, 022, 030 and 032 is found in ADR 0022 (SC-008).

- [ ] T042 [P] [US5] Write `docs/decisions/0021-collab-ready-document-layout.md` in the header format of ADR 0019 (Status: Accepted, Amends 0005 §1, §2 and Consequences): context (the three limits), decision (layout-2 table from data-model.md, order keys and ties, flat step order, rule cells, long text list and the `$blank` marker, reader / writer, the one repair and why content is kept, the legacy probe and the waived migration with §g-81 / §g-82), alternatives rejected (from research R2, R3, R7, R9, R10), consequences and the known last-write-wins spots (R11).
- [ ] T043 [P] [US5] Write `docs/decisions/0022-schema-roadmap.md` from `specs/036-collab-ready-document/contracts/schema-roadmap.md` (Status: Accepted as a roadmap; each row is confirmed by its own feature): the four tables, the rules for every row, and the standing decisions (deck identity, shared collapse, new lists and markdown fields use layout 2). Cross-check every schema change named in `docs/backlog.md` §029, §033, §022, §030, §032 and fix the backlog where it disagrees (033: `tagColors` at the root, not "`deck.tags` gains definitions").
- [ ] T044 [US5] Update `docs/decisions/0005-yjs-document-layout.md` ("Amended by: ADR 0021" in the header, a one-line pointer in §1, §2 and Consequences; keep the original text), `packages/model/CLAUDE.md` (an "Added by 036" entry: layout 2, `isLegacyLayout`, `EditorOptions.repair`, the reader / writer rule "never `fromY` / `toY` a deck object", the long text table, the new files in "Layout of `src/`"; replace the rule "changing it needs an ADR and a migration" with a pointer to ADR 0021), `apps/app/CLAUDE.md` (the live-field rebase, the `unsupported` loader outcome), and `docs/diagram-handbook.md` §6 (the "three points to fix before collaboration" paragraph now says they are done in 036).

---

## Phase 8: Polish & Cross-Cutting

- [ ] T045 Run `pnpm bench` and save the tables in `specs/036-collab-ready-document/bench-after.md` next to the "before" numbers, with the model perf and storage-load timings (SC-005, SC-006). A scenario worse than before beyond run-to-run noise blocks the merge unless the founder accepts it.
- [ ] T046 Walk the manual scenarios of `specs/036-collab-ready-document/quickstart.md` in two tabs and record the result of each in `specs/036-collab-ready-document/quickstart-results.md`.
- [ ] T047 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; confirm no skipped or `.only` tests; `grep -rn "getArray(" packages/model/src apps/app/src` finds no access to a collection.
- [ ] T048 Update `docs/backlog.md` §036 (Status: implemented, links to the spec, tasks and ADRs 0021 / 0022) and add the outcome to `docs/design/design-analysis.md` §g if a decision changed during implementation. Final report: what changed, what was skipped, what is uncertain.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** first. **Phase 2** needs nothing else and blocks Phase 3.
- **Phase 3 (US1)** blocks every later phase: they all test behaviour of the new layout.
- **Phases 4, 5, 6** (US2, US3, US4) each depend only on Phase 3 and can be done in any order; T031's helpers (Phase 4) are reused by T034, T038 and T040, so do T031 before them.
- **Phase 7 (US5)** can be written any time after Phase 3; T044 last.
- **Phase 8** after everything.

### Within Phase 3

T009 (baseline) → T010 → T011, T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022, T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030.

### Parallel opportunities

- T004, T006, T008 (three pure modules, three files).
- T022 and T023 (different op modules) once T017 is in.
- T027 with T026; T036 with T034; T041 with T038; T042 with T043.

## Parallel Example: Phase 2

```text
Task: "Write packages/model/test/order-key.test.ts"       (T004)
Task: "Write packages/model/test/text.test.ts"            (T006)
Task: "Create packages/model/src/text-fields.ts + test"   (T008)
```

## Implementation Strategy

### MVP first (User Story 1 only)

Phases 1–3. The app behaves as before on the new stored layout, old stored decks are refused with a message, and the 10,000-item budgets hold. This alone unblocks 037 (scale bench) and the schema work of 029.

### Incremental delivery

1. Phases 1–3 → merge (the layout switch, proven by the unchanged suites).
2. Phase 4 (lists under concurrency) → merge.
3. Phase 5 (long text) → merge.
4. Phase 6 (repair) → merge.
5. Phases 7–8 (ADRs, bench, report) → merge. ADR 0021 can also ship with step 1 so the stored layout is documented from the first merge.

One PR for all phases is also fine; keep the commits per task.

## Notes

- If an existing public-API test fails after the switch, the code is wrong, not the test. Fix the code.
- Never call `fromY(map)` / `toY(object)` on a deck object after T012; use `read.ts` / `write.ts`.
- A new runtime dependency needs the founder's approval (none is planned).
- Stop after T048. 037 and 029 are separate features.
