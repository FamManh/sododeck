# Tasks: Flow Playback

**Input**: design documents in `specs/007-flow-playback/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27 (five
  answers).
- [research.md](research.md) (R1–R13) and [data-model.md](data-model.md).
- [contracts/flow-playback-ui.md](contracts/flow-playback-ui.md) and
  [contracts/model-additions.md](contracts/model-additions.md).
- [quickstart.md](quickstart.md).

**Tests**: required. Constitution VI requires:

- unit tests (Vitest) for every pure module and store
- component tests (Testing Library, by role and label) for user-visible behavior
- model changes tested in `packages/model/test`

Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay
green unchanged.

**Approvals needed before starting**: none (no new runtime dependency, no Complexity Tracking item).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Model**: `packages/model/src/…`, tests in `packages/model/test/`.
- **App**: `apps/app/src/…`, tests next to code (`*.test.ts(x)`). New flow code goes in
  `apps/app/src/editor/flows/`; test helpers in `apps/app/src/test/` (`flow-fixtures.ts`,
  `render-flows.tsx`, `flow-harness.tsx`, `render-canvas.tsx`).
- **Commits**: after each task or logical group. Conventional Commits (`feat(model): …`,
  `feat(app): …`, `test(app): …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Gate check: create branch `007-flow-playback` from the latest `main`; re-check the names
      in the research.md header (`activeFlow`, `setActiveFlow`, `flowOverlay`, `sameMark`,
      `toFlowNodes`/`toFlowEdges`, `DeckEdge`, `DeckNode`, `useCanvasHandlers`,
      `useCanvasKeyDown`, `useEditorShortcuts`, `useFlowSync`, `InspectorStep`, `FlowInspector`,
      `SessionChip`, `selectionView`, `serializeEntry`, `canonicalizeEntry`, `resolveMotion`,
      `useReducedMotion`, `SegmentedControl`, `__sododeckFlowBench`); if 008 merged meanwhile,
      note its `inspector-step.tsx` changes in research.md R10 before continuing.
- [x] T002 [P] Record the performance baseline on `main`: `pnpm bench` (pan, zoom, drag and the 006
      flow scenarios at 500 nodes / 1,000 edges) into `specs/007-flow-playback/bench-before.md`.
- [x] T003 [P] Add flow-mode fixtures to `apps/app/src/test/flow-fixtures.ts`: an 8-step linear
      flow ("Place order": Customer App → API Gateway → … with titles matching the spec
      announcement "Order Service → Payment Service" at step 5), a flow forking after step 3 into
      "payment ok" (2 steps) and "payment failed" (error path, 2 steps), a one-step flow, an empty
      flow, and a flow with a broken step (edge id not in the deck).

---

## Phase 2: Foundational (blocking all stories)

**Purpose**: the model serialization, the UI state, the pure derivation and the action layer every
story uses.

### Model: step JSON entry (contracts/model-additions.md)

- [x] T004 [P] Write failing tests in `packages/model/test/serialize-entry.test.ts`: for every step
      of every flow in `packages/schema/examples/full.sododeck.json`, `serializeEntry('steps', step)`
      re-indented equals the slice of `serializeDeck(file)`; a step with only `id` and `edge`
      yields those two keys in order; `serializeEntries` with a `steps` entry.
- [x] T005 Implement: add `'steps'` to `EntryCollection` in `packages/model/src/serialize-entry.ts`
      and make `canonicalizeEntry` in `packages/model/src/key-order.ts` resolve `steps` to the
      item shape of `flows[].steps` (from the schema shape, no hand-kept keys). Export unchanged
      from `packages/model/src/index.ts`. T004 passes.

### UI store: flow mode (data-model §1, research R1)

- [x] T006 [P] Write failing tests in `apps/app/src/state/ui-store.test.ts` for: `openFlow(flowId)`
      (paused, speed 1, `alternativeId: null`, clears selection/focused edge/popover and
      `lastPlayedFlowId`), `openFlow(flowId, stepId)` keeps the given step, `exitFlow()` (sets
      `lastPlayedFlowId`, `activeFlow: null`, empty selection), `setCurrentStep` pauses and clears
      `branchId`, `setSpeed` pauses, `setAlternative(id, stepId)` pauses, `advance` keeps
      `playing`, `setActiveFlow(id|null)` aliases open/exit, `resetForDeck` clears
      `lastPlayedFlowId`, and `startEditing` keeps `activeFlow` with `playing: false`.
- [x] T007 Implement the `ActiveFlow` fields (`alternativeId`, `playing`, `speed`),
      `lastPlayedFlowId` and the actions `openFlow`, `exitFlow`, `setCurrentStep`, `setPlaying`,
      `setSpeed`, `setAlternative`, `advance` in `apps/app/src/state/ui-store.ts`; keep
      `setActiveFlow` / `setActiveStep` / `setActiveBranch` working for 006 callers (`setActiveFlow`
      → `openFlow` / `exitFlow`); export a selector `isFlowMode(state)` (`activeFlow !== null &&
flowSession === null`). `openFlow` without `stepId` stores `stepId: null`; the first step is
      resolved by `flow-mode.ts` (T010). T006 passes.

### Pure derivation: played path (data-model §2, research R2)

- [ ] T008 [P] Write failing tests in `apps/app/src/editor/flows/played-path.test.ts` using the T003
      fixtures: `playedPath` (main + alternative "a" by default, chosen alternative, unknown id →
      "a", no branches → main only), `playerView` (label "Step 4 of 8" and "Step 4b of 5",
      previous/next null at ends, `showPicker` only from the fork step on, `forkNumber` "3",
      segments filled up to current, error and broken flags), `stepForNode` (first touching step,
      null for a node not on the path), `stepForEdge` (next after current, wrapping, null off path),
      `rehome` (main unchanged, same position in new alternative, shorter alternative → its last
      step), `stepAnnouncement` ("Step 5 of 8: Order Service → Payment Service", ", branch payment
      failed", "Step 3 of 8: connection deleted"), and unknown step ids never throw.
- [ ] T009 Implement `apps/app/src/editor/flows/played-path.ts` (pure, over `FlowAnalysis`; titles
      via `nodeTitle` from `session-path.ts`). T008 passes.

### Action layer (research R1, R2, R12)

- [ ] T010 Write failing tests then implement `apps/app/src/editor/flows/flow-mode.ts` (+
      `flow-mode.test.ts`) with actions over the store and the deck (read with `readDeck`):
      `openFlow(editor, flowId, stepId?)` (resolves step 1 of the played path, announces it),
      `exitFlow()`, `goToStep(editor, stepId)` (pauses, announces), `nextStep` / `previousStep`
      (no-op at ends), `switchAlternative(editor, direction | branchId)` (re-home + announce),
      `currentPlayback(deck)` (flow, analysis, played path, player view or `null`). Every action
      announces exactly once via `ui.announce(stepAnnouncement(...))`.
- [ ] T011 Route every 006 opener through `openFlow`: flow row click in
      `apps/app/src/editor/flows/flow-row.tsx`, sibling list in `flow-panel.tsx`, Done / Cancel of
      edit mode and Done of recording in `flow-session.ts` (open on step 1, design 44), and the
      flow menu's "Open" in `flow-menu.tsx`; update their existing tests (`flow-list.test.tsx`,
      `flow-session.test.ts`) to expect flow mode on step 1.

**Checkpoint**: `pnpm --filter @sododeck/model test && pnpm --filter @sododeck/app test` green;
nothing visible changed yet except the current step being set on open.

---

## Phase 3: User Story 1 — Open a flow and step through it (P1) 🎯 MVP

**Goal**: flow mode with dimming, current step highlight + token, player with previous/next and
segments, ← / →, step inspector, JSON step entry, announcements, view-only canvas, viewport, exit.

**Independent test**: open an 8-step flow, press → seven times checking canvas marks, player,
row, inspector and live region; try to drag / delete (nothing); Esc exits to the deck inspector
with "Last played" on the row.

### Tests for US1 (write first, must fail)

- [ ] T012 [P] [US1] `apps/app/src/editor/flows/flow-overlay.test.ts`: with a `playback` input,
      played edges get `inPath: true`, the current edge `current: { speed }`, its from/to nodes
      `currentStep: true`, other-alternative edges keep badges with `inPath: false`, broken steps
      mark nothing; `playback: null` gives exactly the 006 marks.
- [ ] T013 [P] [US1] `apps/app/src/editor/deck-to-flow.test.ts`: `className: 'in-flow'` on member
      nodes and edges only; changing the current step returns new objects only for the old and new
      current edges and their nodes (cache identity for all others); `NodeFlowMark.inPath` /
      `currentStep` are part of the node cache check.
- [ ] T014 [P] [US1] `apps/app/src/editor/canvas-geometry.test.ts`: `boundsOf(deck, nodeIds)`
      (display positions + `NODE_SIZE`, empty → null) and `rectInView(rect, viewport, size)`.
- [ ] T015 [P] [US1] `apps/app/src/editor/deck-edge.test.tsx`: current mark → stroke width 3 and a
      filled label pill; `data-testid="flow-token"` with an `animateMotion` whose `dur` is
      `1400ms` at 1× and `700ms` at 2×; no token on a non-current edge.
- [ ] T016 [P] [US1] `apps/app/src/editor/deck-node.test.tsx`: `currentStep` → ring class and
      `aria-current="step"`; not otherwise.
- [ ] T017 [P] [US1] `apps/app/src/editor/flows/step-player.test.tsx` (render with
      `render-flows.tsx`): region "Step player"; "Previous step" disabled on step 1, "Next step"
      disabled on the last; position text "Place order · Step 1 of 8" and the step title (or
      "<from> → <to>"); list "Progress" with buttons "Go to step n of 8", current
      `aria-current="step"`, clicking segment 6 makes step 6 current; empty flow → "No steps" and
      disabled controls; broken segment name ends with ", connection deleted".
- [ ] T018 [P] [US1] `apps/app/src/editor/flows/use-playback-shortcuts.test.tsx`: in flow mode →
      / ← move the current step and announce; ignored in a text field (US1-6), in a dialog, in a
      `radiogroup` and outside flow mode; Esc calls exit; Delete/Backspace do nothing in flow mode.
- [ ] T019 [P] [US1] `apps/app/src/editor/flows/inspector-step.test.tsx`: in flow mode the
      heading reads "Step 4 of 8 · Place order", from/to tiles named "From: Order Service" / "To:
      Pricing Service", protocol text; broken step → "Connection deleted"; section "Rules" lists
      rule titles, "Missing rule r9" for an unknown id, "No rules attached" when empty; SLA field
      placeholder "No SLA target", no meter; Title/Condition still editable (one `updateStep`).
- [ ] T020 [P] [US1] `apps/app/src/editor/json-panel-view.test.ts`: flow mode with current step 4
      → label "Step 4", full label "Step 4: Place order", one `steps` entry equal to the step;
      edit session or open branch → 006 flow entry unchanged.
- [ ] T021 [P] [US1] `apps/app/src/editor/flows/flow-panel.test.tsx` (new or extend
      `step-list.test.tsx`): current step row `aria-current="step"`; "Back to canvas" exits; after
      exit the Features row shows "Last played" (sr text) until another flow opens.
- [ ] T022 [P] [US1] `apps/app/src/editor/canvas.test.tsx`: in flow mode the wrapper has
      `data-flow-mode`; drag, drop, connect and double-click popovers are refused (handlers via
      `useCanvasHandlers`); canvas arrow / C / E / Enter keys do nothing; exiting removes the
      attribute.
- [ ] T023 [P] [US1] `apps/app/src/editor/flows/use-flow-sync.test.tsx`: in flow mode, removing
      the current step makes the step at the same index current (or the last), removing the flow
      exits with toast/announcement "This flow was deleted" and no last-played mark, emptying the
      flow sets `stepId: null`; origins `local` and `remote`.
- [ ] T024 [P] [US1] `apps/app/src/editor/flows/session-chip.test.tsx`: flow mode shows "Flow mode
      · Place order" with button "Exit flow mode"; recording/editing chips unchanged.

### Implementation for US1

- [ ] T025 [US1] Extend `apps/app/src/editor/flows/flow-overlay.ts` with the `playback` input and
      the `inPath` / `current` / `currentStep` fields (make `NodeFlowMark.startsHere` optional).
      T012 passes.
- [ ] T026 [US1] In `apps/app/src/editor/deck-to-flow.ts` set `className: 'in-flow'` from
      `inPath`, carry `currentStep` / `inPath` into `DeckNodeData`, and add all new fields to
      `sameMark` and the node cache check. T013 passes.
- [ ] T027 [P] [US1] Add `boundsOf` and `rectInView` to `apps/app/src/editor/canvas-geometry.ts`.
      T014 passes.
- [ ] T028 [US1] Create `apps/app/src/editor/flow-token.tsx` (5 px primary circle, 2 px surface
      stroke, 10 px halo at 20 %, `<animateMotion path dur={tokenLoopMs / speed} repeatCount=
"indefinite">`; `useReducedMotion` + `resolveMotion`; static at `labelX, labelY` when
      `tokenLoopMs === 0`) and render it from `apps/app/src/editor/deck-edge.tsx` only when
      `data.flow.current` is set; current edge width 3 and filled label pill (keep the dash for
      error paths). T015 passes.
- [ ] T029 [P] [US1] In `apps/app/src/editor/deck-node.tsx` draw the in-current-step ring (same as
      selection ring + halo) and `aria-current="step"` from `data.currentStep`. T016 passes.
- [ ] T030 [US1] Add the dimming rules to `apps/app/src/index.css`: under `[data-flow-mode]`,
      `.react-flow__node:not(.in-flow)`, `.react-flow__edge:not(.in-flow)` and
      `[data-testid="edge-label"]:not([data-in-flow])` at opacity 0.2 with `transition: opacity
var(--sd-dur-dim)`; set `data-in-flow` on the label span in `deck-edge.tsx` when
      `flow.inPath`.
- [ ] T031 [US1] Wire flow mode into `apps/app/src/editor/canvas.tsx`: `isFlowMode` →
      `data-flow-mode` on the wrapper, pass `playback` (played step ids, current step, speed from
      `currentPlayback`) to `flowOverlay`, set `nodesDraggable` / `nodesConnectable` /
      `edgesReconnectable` false in flow mode, and render `<StepPlayer />` in a bottom-centre
      `Panel`. Add `useFlowViewport()` (in `apps/app/src/editor/flows/use-flow-viewport.ts`):
      `fitBounds(boundsOf(played nodes), { padding: 0.2, duration: dimMs })` when the open flow id
      changes; on current-step change `setCenter(midpoint, { zoom: getZoom(), duration: dimMs })`
      only if `!rectInView`; run in `requestAnimationFrame`. T022 (wrapper part) passes.
- [ ] T032 [US1] In `apps/app/src/editor/use-canvas-handlers.ts` treat flow mode as view-only:
      block `onDrop`, `onDragOver`, `onConnect`, `onReconnect`, `onEdgeDoubleClick` and drags;
      `onNodeClick` / `onEdgeClick` / `onPaneClick` do nothing yet in flow mode (US3 adds jumps).
      T022 (handlers part) passes.
- [ ] T033 [US1] In `apps/app/src/editor/use-canvas-shortcuts.ts`: `useCanvasKeyDown` returns early
      for arrows, C, E, Enter in flow mode; `useEditorShortcuts` in flow mode maps Esc (no popover,
      dialog or pending delete) to `exitFlow()` and ignores Delete/Backspace.
- [ ] T034 [US1] Add `usePlaybackShortcuts()` to `apps/app/src/editor/flows/use-flow-shortcuts.ts`
      (document listener; ← / → → `previousStep` / `nextStep`; skip text fields via `isTextTarget`,
      dialogs, `[role="radiogroup"]`, `[role="menu"]`, `defaultPrevented`) and install it next to
      `useFlowShortcuts` in `apps/app/src/routes/editor-page.tsx` and in the test harness `apps/app/src/test/flow-harness.tsx`. T018 passes.
- [ ] T035 [US1] Create `apps/app/src/editor/flows/step-player.tsx`: region "Step player",
      Previous / Next buttons (lucide `SkipBack` / `SkipForward`), position text, title, progress
      list of segment buttons (dashed pattern for error, hatched + icon for broken; min width and
      horizontal scroll keeping the current in view for 50+ steps), "No steps" state; a Play button
      and speed button rendered disabled until US2. Sizes from design-analysis §b (420–560 px,
      18 px radius, `shadow-float`). T017 passes.
- [ ] T036 [US1] Update `apps/app/src/editor/flows/inspector-step.tsx` and `flow-inspector.tsx`: in
      flow mode render the playback header (heading "Step n of m · <flow>", `KindTile` from/to with
      names, protocol text, branch label + error icon on alternatives, "Connection deleted" when
      broken), the read-only "Rules" list (titles from `deck.rules`, "Missing rule <id>" with
      `CircleAlert`, "No rules attached"), SLA placeholder "No SLA target"; keep 006 fields
      editable. T019 passes.
- [ ] T037 [P] [US1] Update `apps/app/src/editor/json-panel-view.ts` (`selectionView` gets a
      `flowMode` flag; step entry via `collection: 'steps'`) and its caller in
      `apps/app/src/editor/json-panel.tsx`. T020 passes.
- [ ] T038 [US1] Update the left panel: `apps/app/src/editor/flows/flow-panel.tsx` ("Back to
      canvas" → `exitFlow`; "Edit steps" keeps calling `startEditing`, whose session turns flow
      mode off), `step-row.tsx` (current row `aria-current="step"`, filled number badge; click →
      `goToStep`), `flow-row.tsx` ("Last played" icon `History` + sr text + tooltip when
      `lastPlayedFlowId` matches). T021 passes.
- [ ] T039 [P] [US1] Flow-mode chip in `apps/app/src/editor/flows/session-chip.tsx` ("Flow mode ·
      <title>", button "Exit flow mode" with `X`), shown by `top-bar.tsx`'s existing slot. T024
      passes.
- [ ] T040 [US1] Extend `apps/app/src/editor/flows/use-flow-sync.ts` for flow mode (current step
      re-homed by index, flow removed → reset without last-played mark + toast "This flow was
      deleted", empty flow → `stepId: null`, removed alternative → `alternativeId: null` + re-home).
      T023 passes.

**Checkpoint**: US1 acceptance scenarios 1–7 pass in component tests; quickstart manual scenario 1
works in `pnpm dev`.

---

## Phase 4: User Story 2 — Play a flow like a presentation (P1)

**Goal**: Play / Pause, 1× / 2×, autoplay timing, stop on last, restart, pause rules.

**Independent test**: open a flow, play with fake timers, check step changes at 1700 / 850 ms, stop
on the last step, restart, pause on speed change and hidden tab.

- [ ] T041 [P] [US2] Write failing tests `apps/app/src/editor/flows/use-playback.test.tsx` (Vitest
      fake timers): advances every 1700 ms at 1×, 850 ms at 2×; stops on the last step with
      `playing: false`; Play on the last step restarts at step 1; `document.hidden` +
      `visibilitychange` pauses; unmount / exit leaves `vi.getTimerCount() === 0` (SC-007, loop 100
      times); only one pending timeout at any moment.
- [ ] T042 [P] [US2] Extend `apps/app/src/editor/flows/step-player.test.tsx`: button "Play" ↔
      "Pause" with `aria-pressed`; "Speed 1×" ↔ "Speed 2×" pauses; ←/→, segment and row clicks
      pause; all controls reachable by Tab with visible focus class and activated by Enter/Space
      (US2-6).
- [ ] T043 [US2] Implement `apps/app/src/editor/flows/use-playback.ts` (one `setTimeout(stepMs /
speed)` keyed on flow id, step id, speed, playing; `advance` or stop; visibility listener
      guarded by `typeof document !== 'undefined'`), mount it in `step-player.tsx`, and enable the
      Play / Pause (`Play` / `Pause` icons) and speed buttons (`setPlaying`, `setSpeed`; play on
      last → `goToStep(first)` then `setPlaying(true)`). T041, T042 pass.

**Checkpoint**: quickstart manual scenario 2.

---

## Phase 5: User Story 3 — Jump to a step from the diagram or the lists (P2)

**Goal**: click a flow node or edge to jump; dimmed elements do nothing.

**Independent test**: open a flow, click a member node, a member edge used twice, a dimmed node,
the pane, a segment and a row; check the current step each time.

- [ ] T044 [P] [US3] Write failing tests in `apps/app/src/editor/canvas.test.tsx` (handlers via
      `render-canvas.tsx`): member node → first step touching it; member edge used by steps 2 and
      6 → 6 when current is 3, then 2 (wrap); dimmed node / edge / pane → no change, nothing
      selected, still in flow mode; every jump pauses playback and announces once.
- [ ] T045 [US3] Implement jumps in `apps/app/src/editor/use-canvas-handlers.ts`: in flow mode
      `onNodeClick` → `stepForNode`, `onEdgeClick` → `stepForEdge` over the current played path
      (from `currentPlayback`), then `goToStep`; `onPaneClick` keeps flow mode. T044 passes.

**Checkpoint**: quickstart manual scenario 3.

---

## Phase 6: User Story 4 — Play a flow with branches (P2)

**Goal**: played path = main + chosen alternative; "AT STEP n" picker; ↑ / ↓; re-home.

**Independent test**: with the fork fixture, play alternative "a" end to end, switch to "payment
failed" at step 4a, play it end to end.

- [ ] T046 [P] [US4] Write failing tests `apps/app/src/editor/flows/branch-picker.test.tsx`:
      radiogroup "At step 3" appears only when the current step is 3 or on an alternative; radios
      "payment ok" / "payment failed" (the latter with sr "error path"); choosing "payment failed"
      at 4a makes 4b current, player "Step 4b of 5", segments rebuilt, announcement "Step 4b of 5:
      Payment Service → Notification Service, branch payment failed"; before the fork no picker.
- [ ] T047 [P] [US4] Extend `apps/app/src/editor/flows/use-playback-shortcuts.test.tsx`: ↓ / ↑
      switch alternative only while the picker shows; nothing before the fork; autoplay from the
      fork continues into the chosen alternative (fake timers, in `use-playback.test.tsx`).
- [ ] T048 [US4] Create `apps/app/src/editor/flows/branch-picker.tsx` (`SegmentedControl` +
      `SegmentedControlItem`, label "AT STEP n", `GitBranch` / `CircleAlert` icons) rendered by
      `step-player.tsx` when `playerView.showPicker`; wire ↑ / ↓ in `usePlaybackShortcuts` to
      `switchAlternative`. T046, T047 pass.
- [ ] T049 [US4] Check `flowOverlay` / canvas marks for the unplayed alternative (dimmed but
      numbered, error style kept) against the fork fixture in `flow-overlay.test.ts` and fix any
      gap; add a `step-list` assertion that rows of the unplayed alternative are not marked
      current or in-path.

**Checkpoint**: quickstart manual scenario 4.

---

## Phase 7: User Story 5 — Play without motion or color (P3)

**Goal**: reduced motion and non-color cues verified end to end.

**Independent test**: reduced motion on (matchMedia stub) and a review of cues without color.

- [ ] T050 [P] [US5] Tests with `prefers-reduced-motion: reduce` stubbed (`test-setup.ts` matchMedia):
      `deck-edge.test.tsx` → token rendered at the label point with no `animateMotion`;
      `use-flow-viewport` → `fitBounds` / `setCenter` called with `duration: 0`; dimming CSS relies
      on `--sd-dur-dim` being 0 (assert the rule uses the variable, not a literal).
- [ ] T051 [P] [US5] Extend `apps/app/src/editor/flows/a11y.test.tsx`: every current-step change
      (key, click, segment, autoplay tick, branch switch) produces exactly one live-region update;
      current step identifiable without color (row `aria-current="step"`, filled badge text, edge
      `aria-current` or badge name, node `aria-current="step"`); error segments and badges carry
      "error path" text.
- [ ] T052 [US5] Fix whatever T050–T051 reveal in `flow-token.tsx`, `use-flow-viewport.ts`,
      `step-player.tsx`, `step-row.tsx` or `index.css`.

**Checkpoint**: quickstart manual scenario 5.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T053 [P] Bench hooks: add `openFlow(id)` and `nextStep()` (resolve on the first painted frame
      with the current mark) to `window.__sododeckFlowBench` in
      `apps/app/src/routes/bench-page.tsx`; add scenarios "open flow → flow mode painted", "next
      step → current painted" (median of 5, < 100 ms) and a 5 s "playing at 2×" fps sample to
      `apps/app/bench/perf.bench.ts`.
- [ ] T054 Run `pnpm bench`; write `specs/007-flow-playback/bench-after.md` with before/after
      tables; any regression below targets blocks merge (constitution V).
- [ ] T055 [P] Docs: flow-mode rules in `apps/app/CLAUDE.md` (derived flow mode, `openFlow` /
      `exitFlow`, view-only canvas, playback keys, `played-path.ts`, `FlowToken`);
      `serializeEntry('steps')` in `packages/model/CLAUDE.md` ("Added by 007"); playback marks,
      `in-flow`, `data-flow-mode` and `flow-token.tsx` in `.agents/skills/react-flow/SKILL.md`.
- [ ] T056 [P] Visual check: 1440×900 screenshots, light and dark, of flow mode on step 1, step 4
      playing at 2×, the fork with "payment failed" chosen, and a step with no rule; save under
      `specs/007-flow-playback/screens/` and list differences against `docs/design/screens/03-*`,
      `24-*`, `26-*`, `27-*`, `44-*`, `46-*` (allowed: target-only SLA, rule titles instead of the
      008 table, DESIGN.md tokens, lucide icons).
- [ ] T057 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build
&& pnpm e2e` (smoke suite unchanged, incl. no third-party requests); no `.only` / `.skip`.
- [ ] T058 Run the quickstart manual scenarios 1–7 and record results in the PR description; update
      the 007 status line in `docs/backlog.md` after merge.

---

## Dependencies & Execution Order

- **Setup (T001–T003)** → **Foundational (T004–T011)** → user stories.
- **US1 (T012–T040)** is the MVP and blocks the others (player, overlay, canvas wiring).
- **US2 (T041–T043)**, **US3 (T044–T045)** and **US4 (T046–T049)** depend only on US1 and can run in
  parallel with each other; US4's autoplay-into-branch test (T047) also needs US2's
  `use-playback.ts`.
- **US5 (T050–T052)** after US1–US4 (it verifies all cues together).
- **Polish (T053–T058)** last; T054 needs T053.

Within a phase: tests before implementation; `flow-overlay` → `deck-to-flow` → `deck-edge` /
`deck-node` → `canvas`; `played-path` → `flow-mode` → everything that navigates.

## Parallel Examples

- **Foundational**: T004 (model test), T006 (store test) and T008 (played-path test) together;
  then T005, T007, T009.
- **US1 tests**: T012–T024 are all different files — run as one batch, then implement T025 → T026
  → (T027, T028, T029 in parallel) → T030 → T031 …
- **After US1**: one agent on US2 (T041–T043), one on US3 (T044–T045), one on US4 (T046, T048,
  T049; T047 after T043).

## Implementation Strategy

1. **MVP = Phase 1 + 2 + US1**: opening a flow gives the full visual flow mode with manual
   stepping, the inspector, JSON, announcements and exit. Demo-able and mergeable on its own.
2. **Add US2** (autoplay: the "play" in "flows played"), then **US3** and **US4** in either order.
3. **US5** hardens accessibility across everything, then polish (bench, docs, screens, DoD).
4. Commit after each task or logical group; keep each commit green (`pnpm test` for the touched
   package).
