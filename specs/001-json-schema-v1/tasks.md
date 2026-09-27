---
description: 'Task list for 001-json-schema-v1 (Deck File Format v1)'
---

# Tasks: Deck File Format v1 (`.sododeck.json`)

**Input**: Design documents from `specs/001-json-schema-v1/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/schema-package-api.md](contracts/schema-package-api.md), [quickstart.md](quickstart.md)

**Tests**: Required. The spec (FR-025–FR-029, SC-002/003/005/006) and constitution VI/II demand fixtures, parity, round-trip and staleness tests. Write tests first and see them fail before implementing where the task says so. **No new Playwright e2e tests** (constitution VI, TODO(e2e)); the smoke suite must stay green.

**Organization**: Tasks are grouped by user story. The schema rewrite is foundational (every story needs it).

**Read first**: `AGENTS.md`, `packages/schema/CLAUDE.md`, `packages/model/CLAUDE.md`. Stay inside the files listed in plan.md → Project Structure. A parallel session is implementing `000-design-foundation` in another worktree (`packages/ui`, app gallery); do not touch those files.

**Commits**: Conventional Commits, small. **No `Co-Authored-By:` or any AI attribution line** (AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US4 from spec.md

## Path Conventions

pnpm monorepo. Paths are repo-relative: `packages/schema/…`, `packages/model/…`, `apps/app/…`, `docs/…`.

---

## Phase 1: Setup

**Purpose**: Know the starting state so regressions are attributable.

- [x] T001 Run `pnpm install` and the baseline gates `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` from the repo root; note any pre-existing failure (for the final report) without fixing unrelated issues
- [x] T002 Read `packages/schema/scripts/generate.ts`, `packages/schema/src/index.ts`, `packages/schema/test/schema.test.ts`, `packages/model/src/deck.ts`, `packages/model/test/deck.test.ts` and the consumers listed in plan.md (`apps/app/src/editor/{deck-to-flow.ts,deck-to-flow.test.ts,left-sidebar.tsx,inspector.tsx,demo-deck.ts}`, `apps/app/src/model/use-deck-snapshot.test.tsx`, `apps/app/src/bench/generate-deck.ts`) so the impact of stricter types is known

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The full v1 schema, regenerated code, and consumers compiling against it. Every user story depends on this.

**⚠️ CRITICAL**: No user story work before this phase is green.

- [x] T003 In `packages/schema/schema/v1.json`, replace the skeleton `$defs` with the shared types from data-model.md → "Conventions" and "Shared types": `Id` (pattern `^[A-Za-z0-9_.:-]{1,64}$`), `Text` (minLength 1), `Tags` (array of Text), `Position` (`x`, `y` numbers, both required), `Link` (`label`, `url` required Text), and enums `NodeKind`, `Level`, `Protocol`, `Direction`, `ViewType`, `SubtitleField`, `HitPolicy`, `StickyColor` with the exact values in data-model.md. Every `$def` gets a `title` (becomes the TS type name) and a `description`. No `default`, no `format` keywords (research R4, data-model Link)
- [x] T004 In `packages/schema/schema/v1.json`, update the envelope: keep `$schema`/`version` consts and required collections; add optional `name` (Text), `description`, `tags` between `version` and `nodes` (canonical order per data-model.md "Deck file"); `rules` keeps `propertyNames: {$ref Id}`; update the root `description` (remove the TODO(schema-v1) skeleton note) and state in it that ids are unique per collection and references must resolve, enforced by `@sododeck/model` (FR-007)
- [x] T005 In `packages/schema/schema/v1.json`, define `Node`, `Group`, `Edge`, `View`, `Feature` exactly per data-model.md: property declaration order = table order (research R5), `required` per the Req column, `additionalProperties: false`, a `description` on every property (FR-024) stating defaults in words (e.g. edge `direction`: "Absent means forward"); `View.positions` is an object with `propertyNames: {$ref Id}` and `additionalProperties: {$ref Position}`; group/node nesting by id only (no recursive `$ref`)
- [x] T006 In `packages/schema/schema/v1.json`, define `Flow`, `Step`, `Rule`, `RuleColumn`, `RuleRow`, `Sticky` per data-model.md: `Step` has no `branch` (FR-022); `Step.ruleInputs` is a map (propertyNames Id) of maps (propertyNames Id) of strings; `Rule` has no `id` (key in `rules`); `RuleRow.when`/`then` are string arrays and their descriptions state rule S1; `Sticky` carries `anyOf: [{ "properties": { "anchor": true }, "required": ["anchor"] }, { "properties": { "position": true }, "required": ["position"] }]` (research R3) and its description states rule S2
- [x] T007 Update `packages/schema/scripts/generate.ts`: before calling `compile` and `jsonSchemaToZod`, remove object-level `anyOf` presence rules (branches containing only `properties`/`required`) from a deep copy of the schema, with a comment citing research R2 (both generators mishandle them; `checkSemanticRules` enforces S2 instead). Leave `v1.json` itself and the `--check` behavior unchanged
- [x] T008 Run `pnpm schema:generate`; inspect `packages/schema/src/generated/types.ts` (named types `Node`, `Edge`, `Flow`, `Step`, `Rule`, `Sticky`, …, no `[k: string]: unknown`) and `packages/schema/src/generated/zod.ts` (`.strict()` objects, `z.enum`, regex on ids, no `.default(`, no `z.any()`); fix `v1.json` and regenerate until clean
- [x] T009 Validate the existing `packages/schema/examples/minimal.sododeck.json` still passes (`pnpm --filter @sododeck/schema test`); it must not change (the app demo imports it). Update the existing skeleton-era test cases in `packages/schema/test/schema.test.ts` whose fixtures are no longer valid v1 (rename the `describe` from "schema v1 skeleton")
- [x] T010 Fix lossless envelope round-trip in `packages/model/src/deck.ts`: `fromJSON` stores optional `name`/`description`/`tags` in the `meta` map (tags as `Y.Array`), `toJSON` emits them only when present, in canonical order after `version`; update the top-of-file Yjs layout comment. Add the failing round-trip case first in `packages/model/test/deck.test.ts` (a file with `name`, `description`, `tags`)
- [x] T011 Rewrite the `rich` fixture in `packages/model/test/deck.test.ts` as a valid v1 deck that still exercises nested objects, nested arrays, numbers incl. negative/fractional, strings and every collection (e.g. `view.positions`, `step.ruleInputs`, a rule with columns and rows, an anchored sticky); update the rename test's expected node if needed
- [x] T012 [P] Remove the now-redundant `typeof node.title === 'string'` / `typeof node.type === 'string'` guards in `apps/app/src/editor/deck-to-flow.ts`, `apps/app/src/editor/left-sidebar.tsx`, `apps/app/src/editor/inspector.tsx` (lint `no-unnecessary-condition`), keeping rendered output identical for valid decks; keep the "skip edges whose endpoints are missing" behavior (referential integrity is not schema-enforced)
- [x] T013 [P] Make app fixtures valid v1 with the same assertions' intent: `apps/app/src/editor/deck-to-flow.test.ts` (give every node `type`+`title`, every edge `from`/`to`; drop the "missing title/type fallback" expectations that are now impossible, keep the missing-endpoint edge case), `apps/app/src/model/use-deck-snapshot.test.tsx` (nodes need `type`), and check `apps/app/src/bench/generate-deck.ts` typechecks
- [x] T014 Checkpoint: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green. Commit: `feat(schema): define full v1 deck file format` (schema + generator + generated), `fix(model): keep deck metadata on round-trip`, `refactor(app): align editor with strict v1 types`

**Checkpoint**: Strict v1 schema in place; repo green.

---

## Phase 3: User Story 1 - Export a deck without losing anything (Priority: P1) 🎯 MVP

**Goal**: The format can hold every field the design and P0 spec show, proven by examples that exercise every field and round-trip through the model.

**Independent Test**: `full.sododeck.json` uses every property of every `$def`, is accepted by both validators, parses to data deep-equal to itself, and round-trips through `@sododeck/model` unchanged.

### Tests for User Story 1 (write first, expect failure)

- [x] T015 [P] [US1] Create `packages/schema/test/coverage.test.ts`: walk `jsonSchema.$defs`; for every object `$def`, collect its property names and assert each is used at least once in `examples/full.sododeck.json` (FR-025, SC-001). Fails until T017 exists
- [x] T016 [P] [US1] In `packages/schema/test/schema.test.ts`, replace the single-example test with `it.each` over every file in `packages/schema/examples/` (read the directory): accepted by Ajv 2020 strict and by `parseSododeckFile`; `parseSododeckFile(x).data` deep-equals `x` (lossless, research R4); plus a case: a node with only `id`, `type`, `title` (no `tech`, `host`, `icon`, `links`, `rules`, `position`) is valid (spec US1 scenario 2)

### Implementation for User Story 1

- [x] T017 [P] [US1] Create `packages/schema/examples/full.sododeck.json`: every object type and every optional field (deck `name`/`description`/`tags`; all 6 node kinds; nested group via `parent`; node `parent`/`level`; edges with each protocol and direction; all 4 view types with `subtitleField`, `includes`, `positions`; a feature; a flow with `trigger`/`outcome`/links and several steps incl. the same edge twice, `rules`, `ruleInputs`; a rule with `hitPolicy`, inputs, outputs, rows (adapt "Delivery tier" from `docs/design/claude-design/sododeck-data.js`); stickies: free, anchored, anchored with offset, each color). Keys in canonical order (data-model.md). Ids follow the id pattern; references resolve
- [x] T018 [P] [US1] Create `packages/schema/examples/flow-and-rule.sododeck.json`: small deck (≈4 nodes, 3 edges), one feature, one flow with 3 steps, one decision table attached to a step with `ruleInputs` sample values (FR-025). Canonical key order
- [x] T019 [US1] In `packages/model/test/deck.test.ts`, add `full.sododeck.json` and `flow-and-rule.sododeck.json` (via `import.meta.resolve('@sododeck/schema/examples/…')`) to the lossless round-trip `it.each` and to the Yjs update-encoding test (constitution II)
- [x] T020 [US1] Manually review data-model.md → "Design-data coverage" against `examples/full.sododeck.json` and `docs/design/design-analysis.md` §d; any design field without a home is a spec gap → stop and ask (SC-007). Record the result in the final report
- [x] T021 [US1] Checkpoint: `pnpm --filter @sododeck/schema test && pnpm --filter @sododeck/model test` green. Commit `test(schema): add full and flow-and-rule examples with coverage test`

**Checkpoint**: US1 independently demonstrable (MVP).

---

## Phase 4: User Story 2 - Trust a file written by someone else (Priority: P1)

**Goal**: Invalid files are rejected with a message that says what and where; the published schema (Ajv) and the app validator agree on every input.

**Independent Test**: Every invalid fixture is rejected by `Ajv + checkSemanticRules` and by `parseSododeckFile`, with the expected issue path; every example is accepted by both.

### Tests for User Story 2 (write first, expect failure)

- [ ] T022 [P] [US2] Create `packages/schema/test/semantic-rules.test.ts` for `checkSemanticRules` (contracts/schema-package-api.md): S1 row with too few / too many `when` cells and `then` cells → issue path `rules.<ruleId>.rows.<i>.when|then`, message names rule id and row id and both counts (research R6); zero rows / zero inputs valid; S2 sticky with neither anchor nor position → path `stickies.<i>`; S3 bad key in `rules`, `views[i].positions`, `flows[i].steps[j].ruleInputs` (outer and inner) → path to the map; valid full example → `[]`
- [ ] T023 [P] [US2] Create `packages/schema/test/fixtures.ts` exporting `invalidFixtures: { name, input, path }[]`, each a single mutation of a deep clone of `examples/full.sododeck.json`, covering FR-026: for each object type (node, group, edge, view, feature, flow, step, rule, rule column, rule row, sticky, link, position) one missing-required-field and one unknown-key case; bad enum for node `type`, `level`, edge `protocol`, `direction`, view `type`, `subtitleField`, rule `hitPolicy`, sticky `color`; step without `id`; step with `branch` (FR-022); row cell-count mismatch (`when` and `then`); sticky with neither anchor nor position; bad id format (space, 65 chars, empty); bad map key; `version: 2`; wrong `$schema`; `rules` as array
- [ ] T024 [P] [US2] Create `packages/schema/test/generated.test.ts`: read `src/generated/zod.ts` and `src/generated/types.ts` as text; assert no `z.any()`, no `.default(`, and no `[k: string]: unknown` (research R2/R4 guard)

### Implementation for User Story 2

- [ ] T025 [US2] Create `packages/schema/src/semantic-rules.ts`: export `Issue` type `{ path: string; message: string }` and pure `checkSemanticRules(file: SododeckFile): Issue[]` implementing S1–S3 from data-model.md (reuse the `Id` regex from one constant; no referential checks). Strict TS, no `any`, no `!`
- [ ] T026 [US2] Update `packages/schema/src/index.ts`: `parseSododeckFile` runs `checkSemanticRules` after a successful Zod parse and returns `{ success: false, issues }` if any; export `checkSemanticRules` and `Issue`; `ParseResult` uses `Issue`
- [ ] T027 [US2] In `packages/schema/test/schema.test.ts`, change the parity helper to compare `ajvValidate(x) && checkSemanticRules(x).length === 0` with `parseSododeckFile(x).success` (contracts "Parity"), and add `it.each(invalidFixtures)`: both reject; `parseSododeckFile` issues include one whose `path` equals the fixture's `path` (SC-003)
- [ ] T028 [US2] In `packages/schema/test/schema.test.ts`, add message tests: enum issue message lists the allowed values; unknown-key issue names the key; step without id reports `flows.0.steps.N.id`; row mismatch names rule and row ids (spec US2 scenarios 1–4)
- [ ] T029 [P] [US2] In `packages/schema/test/schema.test.ts`, add a sanity performance test: a generated valid deck with 500 nodes / 1,000 edges / 50 flows parses in < 100 ms (plan Performance Goals); keep it deterministic and not flaky (measure the median of 3)
- [ ] T030 [US2] Checkpoint: `pnpm --filter @sododeck/schema test && pnpm --filter @sododeck/schema lint && pnpm --filter @sododeck/schema typecheck` green. Commit `feat(schema): enforce semantic rules and parity` and `test(schema): add invalid fixtures and message tests`

**Checkpoint**: US1 + US2 green.

---

## Phase 5: User Story 3 - Read and review a deck in git (Priority: P2)

**Goal**: Files have a fixed, documented key order; a rename changes one line.

**Independent Test**: Every example's keys follow the schema's `properties` order; renaming a node title in the serialized full example changes exactly one line.

- [ ] T031 [P] [US3] Create `packages/schema/test/key-order.test.ts`: recursively walk each example together with `jsonSchema` (resolve local `$ref`, follow `items`, `additionalProperties` maps and `rules`), and assert each object's keys appear in the same relative order as the matching `properties` declaration (FR-023, research R5)
- [ ] T032 [P] [US3] In `packages/schema/test/key-order.test.ts`, add the rename check: `JSON.stringify(full, null, 2)` before and after changing one node's `title` differ in exactly one line and ids/references are untouched (SC-005, US3 scenario 2)
- [ ] T033 [US3] Fix key order in `packages/schema/examples/*.json` (and `v1.json` property order if data-model.md was not followed) until T031 passes. Commit `test(schema): enforce canonical key order`

**Checkpoint**: US3 green.

---

## Phase 6: User Story 4 - Keep the format and derived validators in step (Priority: P2)

**Goal**: Editing `v1.json` without regenerating fails the test run.

**Independent Test**: quickstart.md §1 staleness demo.

- [ ] T034 [US4] Verify the existing staleness check (research R8): make a temporary description edit in `packages/schema/schema/v1.json`, run `pnpm --filter @sododeck/schema test`, confirm it fails with "Out of date … Run `pnpm schema:generate`", then revert and confirm green. Also confirm root `pnpm test` (turbo) runs the schema package `test` script. No code change unless the check does not trigger; record the result in the final report

**Checkpoint**: All stories green.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T035 [P] Write `docs/decisions/0004-schema-v1-shape.md` (ADR format like 0002): node kinds (closed 6, spec names), protocol families (specifics in label), positions on node + per-view overrides, group geometry derived, structured decision tables with column/row ids, `rules[]` lists, step `ruleInputs`, id pattern, branches deferred to 006, semantic rules S1–S3 and why (generator gaps, no custom keywords), no `default`, enum-widening trade-off (older builds reject newer values)
- [ ] T036 [P] Update `docs/spec.md` §6: schema URL → `https://sododeck.com/schema/v1.json`; rewrite the JSON example to valid v1 (node with `type`+`title`, edge `protocol: "event"`, step with `id`, rule as structured table with `hitPolicy`/`inputs`/`outputs`/`rows`, sticky with `id`); validate it with quickstart.md §3 by pasting into a temp file under the scratchpad (not committed)
- [ ] T037 [P] Update `packages/schema/CLAUDE.md`: remove the skeleton TODO in "Status" (v1 complete; branches come in 006), document `checkSemanticRules`/`Issue` in the public API line, and add the generator notes (no `default`/`format`, `anyOf` presence rules stripped for generators, `propertyNames` not enforced by Zod → S3)
- [ ] T038 [P] Update `packages/model/CLAUDE.md` only where text changed (envelope `name`/`description`/`tags` stored in `meta`); leave its M1 TODOs for 002
- [ ] T039 Run quickstart.md §2–§4 (incl. Monaco hover/autocomplete check in `pnpm dev`: hovering `hitPolicy` shows its description; `"protocol": "` suggests the six values). Screenshot the hover for the report
- [ ] T040 Run the full gates `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` (smoke suite incl. no third-party requests must pass; no new e2e). Run `pnpm format` first. Commit `docs: add ADR 0004 and align spec §6 with schema v1`
- [ ] T041 Final report (AGENTS.md "How to work" §5): what changed, decisions, baseline vs final gate results, SC-007 review outcome, what was skipped (branches → 006; referential integrity → 002/015), what is uncertain; propose next step `002-yjs-model`. Stop — do not start 002

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** blocks everything.
- **US1 (Phase 3)** after Phase 2. **US2 (Phase 4)** after Phase 2; its fixtures (T023) mutate `full.sododeck.json`, so T023/T027 need T017 (US1).
- **US3 (Phase 5)** after T017/T018 (it checks the examples).
- **US4 (Phase 6)** after Phase 2 only.
- **Polish (Phase 7)** after all stories.

### Within phases

- T003 → T004 → T005 → T006 (same file, sequential) → T007 → T008 → T009.
- T010 → T011 (same file). T012 ∥ T013 after T008.
- US1: T015, T016 (tests) ∥ T017, T018 → T019 → T020 → T021.
- US2: T022, T023, T024 (tests) → T025 → T026 → T027 → T028; T029 anytime after T026.
- US3: T031, T032 (same new file; write together) → T033.

### Parallel Opportunities

- Phase 2: T012 and T013 (app files) in parallel with T010/T011 (model files).
- US1: T015, T016, T017, T018 are four different files.
- US2: T022, T023, T024 are three different new files.
- US4 (T034) can run alongside US1–US3.
- Polish: T035–T038 are four different docs.

## Parallel Example: User Story 1

```text
Task: "T015 coverage test in packages/schema/test/coverage.test.ts"
Task: "T016 examples it.each + lossless in packages/schema/test/schema.test.ts"
Task: "T017 packages/schema/examples/full.sododeck.json"
Task: "T018 packages/schema/examples/flow-and-rule.sododeck.json"
```

## Parallel Example: User Story 2

```text
Task: "T022 packages/schema/test/semantic-rules.test.ts"
Task: "T023 packages/schema/test/fixtures.ts"
Task: "T024 packages/schema/test/generated.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2 → strict schema, repo green.
2. Phase 3 (US1) → every design field has a home, proven by `full.sododeck.json` + coverage + round-trip.
3. Stop and validate.

### Incremental Delivery

1. - US2 → trustworthy validation with parity and readable errors (completes both P1 stories; minimum to merge).
2. - US3 → key order enforced.
3. - US4 → staleness verified.
4. Polish → ADR, docs, full gates, report.

## Notes

- Tests before implementation where marked; confirm they fail first.
- Never edit `src/generated/*` by hand; always `pnpm schema:generate`.
- Do not add dependencies (research R10). Do not add e2e tests.
- Out of scope reminders: branches (006), referential integrity (002/015), Yjs layout redesign (002), publishing the schema URL, the Logistics Delivery sample (013).
