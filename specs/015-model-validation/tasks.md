# Tasks: Model Validation (Problems)

**Input**: design documents in `specs/015-model-validation/`:

- [plan.md](plan.md) and [spec.md](spec.md).
- [research.md](research.md) (R1–R11) and [data-model.md](data-model.md).
- [contracts/model-problems.md](contracts/model-problems.md) and [contracts/problems-ui.md](contracts/problems-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for unit tests (Vitest) for every pure module, store and client, and component tests (Testing Library, by role and label). Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay green and unchanged.

**Scope guards**:

- No schema change. Problems are never written into the deck, the JSON panel, exports or undo history (FR-010, §g-23).
- The deck-wide check runs in the problems worker; the only main-thread call is the one per confirmed delete (plan Complexity Tracking).
- Canvas marks reach React Flow only through the `overlay` argument of `toFlowNodes` / `toFlowEdges`.
- Out of scope: custom checks, auto-fix, dismissing problems, the 018 rail flyout.

**Approvals**: no new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US4 from spec.md.

## Path Conventions

- **Model**: `packages/model/src/…`, tests in `packages/model/test/…`. Read `packages/model/CLAUDE.md` first.
- **App**: `apps/app/src/…`, tests next to the code. Harness: `apps/app/src/test/render-canvas.tsx` (`editorWrapper`, `deckOf`). Canvas recipes: `.agents/skills/react-flow/SKILL.md`. Read `apps/app/CLAUDE.md` first.
- **Commits**: after each task or logical group, Conventional Commits (`feat(model): …`, `feat(app): …`, `test(…)`, `docs: …`), no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Confirm a green start on branch `015-model-validation`: `pnpm install && pnpm test`.
- [x] T002 Run `pnpm bench` before any change and save the table in `specs/015-model-validation/bench-before.md`.
- [x] T003 [P] Write `docs/decisions/0013-derived-problems.md` in the header format of 0012: problems are derived by `checkDeck` in `@sododeck/model`, computed in a module worker behind a per-deck store (150 ms trailing, latest wins), never stored (§g-23); the one synchronous check per confirmed delete; alternatives from research R1 and R4.

---

## Phase 2: Foundational (blocks every story)

### Model

- [x] T004 [P] Write `packages/model/test/problems.test.ts` (failing) per [contracts/model-problems.md](contracts/model-problems.md): one positive and one negative case per kind (orphan incl. `parent` exception and one-node deck; duplicates incl. A→B vs B→A, label normalisation, three copies = one problem, self-loop ignored; step without connection; broken chain; incomplete flow: empty flow, empty branch label, empty branch condition, unknown branch; overlapping conditions incl. empty conditions not overlapping; missing rule on a node and on a step; rule without catch-all; invalid rule cells; broken reference on a sticky anchor, a group parent, a parent cycle), dedup (R2), ordering and stable keys (R3), `byObject` indexing, `total === list.length`, and clean fixtures (`packages/schema/examples/*.sododeck.json`, `specs/008-inspector-rules/screens/logistics.sododeck.json`) returning `total === 0`.
- [x] T005 Implement `packages/model/src/problems.ts` (`checkDeck`, `DeckProblems`, `Problem`, `ProblemKind`, `ProblemTarget`) per [data-model.md](data-model.md) and research R1–R3, reusing `analyzeFlow`, `ruleChecks` and `checkIntegrity`; export from `packages/model/src/index.ts`. Make T004 pass.
- [x] T006 [P] Add a `checkDeck` budget to `packages/model/test/perf.test.ts`: 30 ms (× 3 on CI) for 2,000 nodes / 4,000 edges / 40 flows, extending `largeDeck()` in `packages/model/test/helpers.ts` with a size parameter if needed.
- [x] T007 [P] Document the API in `packages/model/CLAUDE.md` under "Added by 015".

### Computation in the app

- [x] T008 [P] Write `apps/app/src/editor/problems/problems-client.test.ts` (FakeWorker injected as in `apps/app/src/layout/layout-client.test.ts`): lazy start, request/response pairing, `onerror` rejects pending calls, `terminate`.
- [x] T009 Implement `apps/app/src/editor/problems/problems-client.ts` (`createProblemsClient(makeWorker?)`, `createInlineProblemsClient()` for tests) and `apps/app/src/editor/problems/problems.worker.ts` calling `checkDeck`. Make T008 pass.
- [x] T010 [P] Write `apps/app/src/editor/problems/problems-store.test.ts` with the inline client and fake timers: first result published; edits within 150 ms coalesce into one check; a result for a superseded snapshot is dropped; undo/redo and remote updates trigger a check; `dispose` stops listening.
- [x] T011 Implement `apps/app/src/editor/problems/problems-store.ts` (`createProblemsStore(doc, client)`) and `apps/app/src/editor/problems/problems-provider.tsx` (`ProblemsProvider`, `useProblems()` via `useSyncExternalStore`). Make T010 pass.
- [x] T012 Mount `ProblemsProvider` in `EditorChrome` in `apps/app/src/routes/editor-page.tsx` (worker client, one per deck), and in the test wrappers in `apps/app/src/test/render-canvas.tsx` (and other wrappers under `apps/app/src/test/` that render editor chrome) with the inline client.
- [x] T013 [P] Add `problemCursor: string | null` and `setProblemCursor` to `apps/app/src/state/ui-store.ts`, reset in `resetForDeck`; cover in `apps/app/src/state/ui-store.test.ts`.

**Checkpoint**: `useProblems()` returns the deck's problems in any editor test; nothing is visible yet.

---

## Phase 3: User Story 1 - See every problem in one list (P1) 🎯 MVP

**Goal**: with nothing selected, the deck inspector lists all problems or "No problems".

**Independent test**: plant one problem of each kind; read the list; fix each; see "No problems".

- [x] T014 [P] [US1] Write `apps/app/src/editor/problems/problems-panel.test.tsx`: section named "Problems" with the count; one row per problem with its title and detail as accessible name; order per R3; help line; "No problems" row with a check when empty; nothing rendered while `useProblems()` is `null`; 201 problems → 200 rows + "Show all 201", which then shows all; fixing a problem removes its row.
- [x] T015 [P] [US1] Implement `apps/app/src/editor/problems/problem-glyph.tsx` (`ProblemGlyph`: amber `TriangleAlert`, `role="img"`, accessible name "n problem(s)", optional tooltip text) and per-kind row icons.
- [x] T016 [US1] Implement `apps/app/src/editor/problems/problems-panel.tsx` (self-contained, no inspector imports; accepts `onActivate(problem)` and an optional `autoFocus`) per [contracts/problems-ui.md](contracts/problems-ui.md), tokens only, design 60. Make T014 pass (activation is wired in US2).
- [x] T017 [US1] Render `ProblemsPanel` after the Summary section in `apps/app/src/editor/inspector/deck-inspector.tsx`; extend `apps/app/src/editor/inspector/deck-inspector.test.tsx` (list shows with no selection; JSON panel shows no `problems` field for a selected orphan, FR-010).

**Checkpoint**: US1 acceptance scenarios 1–7 pass in component tests.

---

## Phase 4: User Story 2 - Go straight to a problem (P1)

**Goal**: activating a row or pressing ⌘. selects the object, brings it into view and opens where it is fixed.

**Independent test**: activate each row by click and ↵; walk with ⌘. / ⇧⌘. from canvas, inspector and rules screen.

- [x] T018 [P] [US2] Write `apps/app/src/editor/problems/go-to-problem.test.ts`: node → select + focus + fit; duplicate → all edges selected; step problems → `openFlow` at the step (including a broken step id); branch problems → `openFlow` at the fork step; rule problems → `openRules(ruleId)`; broken reference → holder selected (sticky, group, node, edge), view holder → view switched; node inside a collapsed group → outermost collapsed ancestor expanded (not an undo step); node outside the drill scope → `drillUp` to a level containing it; node hidden in the current view → toast "… is hidden in this view" with "Show in <view>" (via `openResult`); deleted target → "This item no longer exists" and `false`; `problemCursor` set.
- [x] T019 [US2] Implement `apps/app/src/editor/problems/go-to-problem.ts` (`goToProblem(problem, ctx)`, `ProblemNavContext` extending `OpenResultContext` with `drillUp`, `expandGroup`, `selectEdges`) reusing `openResult` from `apps/app/src/editor/command-palette/open-result.ts` and research R6. Make T018 pass.
- [x] T020 [US2] Add a `useGoToProblem()` hook in `apps/app/src/editor/problems/use-go-to-problem.ts` that builds the context the way `apps/app/src/editor/command-palette/command-palette.tsx` does (view state, `firstViewShowing`, toast with focused action, `openRules`, `navigateToCanvas`) so it works on the canvas and rules screens; wire it as `onActivate` of the panel in `deck-inspector.tsx`.
- [x] T021 [US2] Keyboard in the panel (`problems-panel.tsx`): ↑/↓, Home/End move focus between rows without activating; ↵/Space activate. Extend `problems-panel.test.tsx`.
- [x] T022 [US2] Add ⌘. / Ctrl+. (next) and ⇧⌘. / ⇧Ctrl+. (previous) to `useEditorShortcuts` in `apps/app/src/editor/use-canvas-shortcuts.ts`, after the text/dialog guard, matching `event.code === 'Period'`: next/previous key relative to `problemCursor` (or its sort position if gone), wrap, `goToProblem`; announce "No problems" when empty. Extend `apps/app/src/editor/use-canvas-shortcuts.test.tsx` (order, wrap, backwards, ignored in text fields and dialogs, works on the rules screen).

**Checkpoint**: US2 acceptance scenarios 1–8 pass.

---

## Phase 5: User Story 3 - Spot problems on the canvas (P2)

**Goal**: glyphs on affected components, connections, flow rows and rule rows; an amber "n problems" button.

**Independent test**: planted deck → glyphs where expected, button count, button opens list; fix → glyph gone.

- [x] T023 [P] [US3] Write `apps/app/src/editor/problems/problem-marks.test.ts` and implement `apps/app/src/editor/problems/problem-marks.ts` (`problemMarks(problems) → Map<Id, { count; titles }>` for node and edge ids, stable identity when unchanged via a per-result WeakMap).
- [x] T024 [US3] Extend the canvas overlay in `apps/app/src/editor/deck-to-flow.ts` with `problems?: ProblemMarks`: add `problemCount` / `problemTitles` to `DeckNodeData` and `DeckEdgeData`, include them in the node and edge cache comparisons; extend `apps/app/src/editor/deck-to-flow.test.ts` (marks change → new object, unchanged → cached object). Pass the marks from `useProblems()` in `apps/app/src/editor/canvas.tsx`.
- [x] T025 [P] [US3] `apps/app/src/editor/deck-node.tsx`: amber glyph at the top-right corner with a tooltip of titles, hidden while the connect-target "+" is shown; accessible name gets ", n problem(s)". Extend `apps/app/src/editor/deck-node.test.tsx`.
- [x] T026 [P] [US3] `apps/app/src/editor/deck-edge.tsx`: glyph inside the label pill; render the pill for edges with problems even when labels are off; keep step badges first. Extend `apps/app/src/editor/deck-edge.test.tsx` (name includes the count; glyph with labels off).
- [x] T027 [P] [US3] `apps/app/src/editor/flows/flow-row.tsx`: remove the local `analyzeFlow` call and clay "Has problems" marker, show `ProblemGlyph` from `useProblems().byObject`; update its tests (flow-list / feature-group tests).
- [x] T028 [P] [US3] `apps/app/src/editor/rules/rule-list.tsx`: `ProblemGlyph` on rules with problems; extend its test.
- [x] T029 [US3] Implement `apps/app/src/editor/problems/problems-button.tsx` and add it to `apps/app/src/editor/canvas-toolbar.tsx` next to Labels: amber "n problems" / "1 problem", absent at 0; click → `exitFlow()` when a flow is active, clear selection, focus the panel's first row. Extend `apps/app/src/editor/canvas-toolbar.test.tsx` (count, absent at 0, opens the list from flow mode).
- [x] T030 [US3] Check glyph placement during flow playback and recording (step badges visible, glyph not covering them) in `deck-node.test.tsx` / `deck-edge.test.tsx`.

**Checkpoint**: US3 acceptance scenarios 1–6 pass.

---

## Phase 6: User Story 4 - Know when an edit breaks something (P3)

**Goal**: the Undo toast after a delete says how many new problems it created.

**Independent test**: delete objects that break a flow step and orphan a component; toast count; Undo restores.

- [x] T031 [US4] In `apps/app/src/editor/confirm-delete-dialog.tsx`, compute `checkDeck(readDeck(doc)).total` before and after the batch and append " · n new problem(s)" to the toast message and the announcement when it grew (helper in `apps/app/src/editor/describe-removal.ts`). Extend `apps/app/src/editor/confirm-delete-dialog.test.tsx` (count shown; unchanged toast when nothing new; Undo restores the count in `useProblems()`).

**Checkpoint**: US4 acceptance scenarios 1–3 pass.

---

## Phase 7: Polish & cross-cutting

- [ ] T032 [P] Accessibility pass: axe check in `problems-panel.test.tsx` and `canvas-toolbar.test.tsx` in light and dark; glyphs never colour-only (FR-025, FR-027, FR-028). **Partly done:** the repo has no axe dependency (adding one needs founder approval), so there is no axe run; roles, names, keyboard paths and non-colour cues are covered by the component tests.
- [x] T033 [P] Update `apps/app/CLAUDE.md` (problems folder, `useProblems`, marks through `overlay`, ⌘. key, one sync check per delete).
- [x] T034 Run `pnpm bench` after the change, save `specs/015-model-validation/bench-after.md`, compare with T002 (no regression below targets).
- [x] T035 Screenshots of the deck inspector with problems, the "No problems" row and canvas glyphs at 1440×900 in light and dark into `specs/015-model-validation/screens/`, compared with `docs/design/screens/60-problems-*` in `specs/015-model-validation/visual-check.md` (allowed differences: no `problems` field in JSON, §g-23).
- [ ] T036 Run the quickstart scenarios 1–7 and record results in the PR description. **Not done by hand:** scenarios 1–4 are covered by component tests and the screenshots; 5 (JSON/export) by tests; 6 (2,000-node deck in the browser) and a full manual pass are left for the PR review.
- [x] T037 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.

---

## Dependencies & execution order

- Phase 1 → Phase 2 (T004–T013) → stories.
- US1 (T014–T017) needs Phase 2. US2 (T018–T022) needs US1's panel (T016) for T020–T021; T018–T019 and T022 only need Phase 2. US3 (T023–T030) needs Phase 2 only (T029's focus target needs T016). US4 (T031) needs T005 only.
- Polish after the stories it covers.

## Parallel examples

- Phase 2: T004, T006, T007, T008, T010, T013 in parallel; then T005, T009, T011.
- US3: T025, T026, T027, T028 in parallel after T024.
- US2 and US3 can run in parallel once US1's panel exists.

## Implementation strategy

1. MVP = Phase 1 + 2 + US1: the deck-wide list, correct and off the main thread.
2. Add US2 (navigation and ⌘.) — the list becomes a tool.
3. Add US3 (glyphs, button) — problems visible while drawing.
4. Add US4 (toast), then polish, bench, screenshots.
