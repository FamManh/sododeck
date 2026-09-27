# Tasks: Flow Authoring

**Input**: design documents in `specs/006-flow-authoring/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27 (six
  answers).
- [research.md](research.md) (R1–R16) and [data-model.md](data-model.md).
- [contracts/model-additions.md](contracts/model-additions.md) and
  [contracts/flow-authoring-ui.md](contracts/flow-authoring-ui.md).
- [quickstart.md](quickstart.md).

**Tests**: required. Constitution VI requires:

- unit tests (Vitest) for every pure module and store
- component tests (Testing Library, by role and label) for user-visible behavior
- a round-trip case for every model change

Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay
green unchanged.

**Approvals needed before starting**: the Complexity Tracking item in plan.md (edit-mode Cancel
checkpoint). No new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. **Model**: `packages/model/src/…`, tests in
  `packages/model/test/`.
- **UI package**: `packages/ui/src/components/…`, tests in `packages/ui/test/`.
- **App**: `apps/app/src/…`, tests next to code (`*.test.ts(x)`). New flow code goes in
  `apps/app/src/editor/flows/`.
- **Commits**: after each task or logical group. Use Conventional Commits (`feat(model): …`,
  `feat(app): …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Gate check:
  - Confirm the branch `006-flow-authoring` is based on the latest `main`.
  - Re-check the names listed in the research.md header (`toFlowEdges`, `useCanvasHandlers`,
    `useEditorShortcuts`, `isTextTarget` (now in `lib/is-text-target.ts`), `SaveStatus`,
    `DropdownMenu`, `ConfirmDeleteDialog`, `describeRemoval`,
    `previewRemoval`, `FieldEdit`, `InlineEdit`, `useUiStore`).
  - If any moved, update research.md before continuing.
- [x] T002 [P] Record the performance baseline on `main`: run `pnpm bench` and save the numbers
      (pan, zoom and drag at 500 nodes / 1,000 edges) in
      `specs/006-flow-authoring/bench-before.md`.
- [x] T003 [P] Write the ADR `docs/decisions/0008-flow-branches.md` in the 0006 header format:
  - Branch shape: `Flow.branches` plus `Step.branch`.
  - The derived branch point: the last main-path step, so one branch point per flow and one
    level.
  - The flat steps array and its normal order.
  - Empty label and condition are allowed in the file; Done enforces them.
  - The edit-mode checkpoint (`captureFlowStructure` / `restoreFlowStructure`).
  - Alternatives: nested steps, a marker on the first branch step, `Branch.from` (research R1,
    R4, R5).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the file format, the model derivation, and the UI state and components that every
story uses. No story work starts before this phase is done.

### Schema

- [x] T004 Add to `packages/schema/schema/v1.json`:
  - `$defs.Branch`:
    - Required: `id` (`Id`), `label` (`string`, may be empty), `condition` (`string`, may be
      empty).
    - Optional: `errorPath` (`boolean`), `description` (`string`).
    - `additionalProperties: false`, and a `description` on every property.
  - `Flow.properties.branches`: an optional array of `Branch`, after `links` and before `steps`.
  - `Step.properties.branch`: an optional `Id`, after `edge`, described as "Id of the branch of
    this flow the step belongs to. Absent: main path."

  Then run `pnpm schema:generate` and commit `src/generated/`.

- [x] T005 Extend `packages/schema/examples/full.sododeck.json` with one flow that has two branches
      (one with `errorPath: true`) and branch steps. Add invalid cases to
      `packages/schema/test/fixtures.ts`: a branch without `condition`, `errorPath: "yes"`, an
      unknown key in a branch, and a non-Id `step.branch`. Run
      `pnpm --filter @sododeck/schema test` green (Ajv/Zod parity).

### Model: derivation and appending (used by every story)

- [x] T006 [P] Write the failing `packages/model/test/flow-paths.test.ts` for
      `analyzeFlow(flow, edges)`, per data-model §2:
  - main numbering `1..n`
  - branch numbers `4a`, `5a`, `4b`
  - `from` and `to` from `step.edge`
  - `broken` when the edge is missing
  - `chainBreak`, with broken steps skipped in both directions
  - a branch's first step compared with the branch step's `to`
  - `nextStart` for the main path and for each branch; `null` for an empty main path
  - `branchStepId`
  - `canFinish`: false with 0 steps, with a chain break, or with an empty branch label or
    condition; true with only broken steps
  - `problems` listing
  - imported steps out of normal order still analyzed by relative order
- [x] T007 Implement `analyzeFlow` and the types `FlowAnalysis`, `BranchPath`, `PathStep` and
      `FlowProblem` in `packages/model/src/flow-paths.ts`. Make it pure (no Yjs), accepting
      `ReadonlyMap<Id, Edge> | readonly Edge[]`, and export it from
      `packages/model/src/index.ts`. T006 must pass.
- [x] T008 [P] Write failing cases in `packages/model/test/edit.test.ts` and
      `packages/model/test/undo.test.ts` for `appendStep(flowId, branchId | null, data)`:
  - It appends at the end of the main path, before any branch steps, keeping normal order.
  - It appends at the end of a given branch.
  - It refuses (`missing-reference`) an unknown branch or edge.
  - Each call is one undo step.

  Also cover `addStep` / `updateStep` validating `step.branch` against the flow's branches.

- [x] T009 Implement:
  - `appendStep` in the new `packages/model/src/ops/branches.ts`, wired into `DeckEditor` in
    `packages/model/src/editor.ts`
  - `step.branch` reference checks in `packages/model/src/ops/refs.ts` and
    `packages/model/src/ops/steps.ts`
  - a `missing-reference` (`field: 'branch'`, `targetType: 'branch'`) case in
    `packages/model/src/integrity.ts` with a test in `packages/model/test/integrity.test.ts`

  T008 must pass.

- [x] T010 [P] Add round-trip cases to `packages/model/test/round-trip.test.ts`: a flow with two
      branches (one error path, one empty label), steps with `branch`, and a broken step
      (missing edge). JSON → Yjs → JSON must be byte-identical. Add rename-safety cases: changing
      a branch label or a flow or feature title keeps every id and `step.branch`.
- [x] T011 Add `child.kind: 'branch'` to `packages/model/src/observe.ts` (the `branches` array of a
      flow reports add, update and remove like `steps`), with cases in
      `packages/model/test/observe.test.ts` (or the existing observe suite). Update
      `packages/model/CLAUDE.md` (new reads, ops and child kind) and
      `packages/schema/CLAUDE.md` (the branch field is no longer deferred).

### UI package

- [ ] T012 [P] Check the menu building blocks 005 added and note how flow menus use them:
      `DropdownMenu` (`packages/ui/src/components/dropdown-menu.tsx`) and the `MenuKit` pattern in
      `apps/app/src/library/menu-kit.ts`. If `MenuKit` is needed by both the library and the flow
      list, move it to `apps/app/src/lib/menu-kit.ts` (update its imports and tests). No new
      `packages/ui` component.

### App: UI state and plumbing

- [ ] T013 Write failing tests in `apps/app/src/state/ui-store.test.ts`, then extend
      `apps/app/src/state/ui-store.ts` per data-model §3:
  - `activeFlow`: `setActiveFlow`, `setActiveStep`, `setActiveBranch`. Selecting one clears the
    node and edge selection, and `select` clears `activeFlow`.
  - `flowSession` and its actions: `startRecording(title, featureId)`,
    `startEditing(flowId, checkpoint)`, `setSessionFlow`, `pushRecorded`, `popRecorded`, `setTarget`,
    `setAddingBranch`, `setInvalid`, `setCandidate`, `endSession`.
  - `hoverEdgeId` / `setHoverEdge`, and `flowFilter` / `setFlowFilter`.
  - Widen `pendingDelete` to `{ targets: RemovalTarget[] } | null`, and keep
    `requestDelete(selection)` working by mapping it through `removalTargets`.
  - `resetForDeck` clears all of the above.
- [ ] T014 Update `apps/app/src/editor/confirm-delete-dialog.tsx` and
      `apps/app/src/editor/describe-removal.ts` (with their tests) to take
      `pendingDelete.targets` (`RemovalTarget[]`), keeping the existing node and edge wording.
      Add wording for `features` ("Its n flows will move to No feature.") and `flows` ("Its n
      steps will be deleted."). No behavior change for canvas deletes; the existing tests stay
      green.
- [ ] T015 [P] Create `apps/app/src/editor/flows/use-flow-sync.ts` (+ test):
  - Subscribe with `observeDeck`.
  - On a `removed` change for the active flow, step or branch, or the session's flow (any origin,
    including `remote`), clear `activeFlow` or end the session and announce "Flow '<title>' was
    deleted".
  - Mount it in `EditorLayout` in `apps/app/src/routes/editor-page.tsx`.
- [ ] T016 [P] Create `apps/app/src/editor/flows/flow-overlay.ts` (+ `flow-overlay.test.ts`),
      pure:
      `flowOverlay(deck, analysis, session, hoverEdgeId)`, returning
      `{ edges: Map<Id, EdgeFlowMark>, nodes: Map<Id, NodeFlowMark> }`.
  - `EdgeFlowMark`:
    - `badges: {label, errorPath, current}[]` (one per step using the edge)
    - `style: 'path' | 'error' | 'candidate' | 'preview' | 'invalid'`
    - `errorIcon: boolean`
  - `NodeFlowMark`: `{ startsHere: string }` ("Step n starts here").
  - Test these cases:
    - a selected flow
    - recording with candidates
    - hover preview on the next step
    - the invalid edge
    - an error branch
    - an edge used twice (two badges)
    - broken steps produce no mark
- [ ] T017 Extend `apps/app/src/editor/deck-to-flow.ts`:
  - `toFlowEdges(…, overlay?)` and `toFlowNodes(…, overlay?)`.
  - Add `DeckEdgeData.flow?: EdgeFlowMark` and node data `flowStart?: string`.
  - Include the object's overlay entry in the per-object cache check, so unchanged edges keep
    their identity.
  - Add cases to `deck-to-flow.test.ts` (overlay applied; identity kept for untouched edges when
    the overlay changes elsewhere).

  Then wire the overlay in `apps/app/src/editor/canvas.tsx`: compute `analyzeFlow` for
  `activeFlow` or `flowSession.flowId`, and memoize `flowOverlay`. Update
  `.agents/skills/react-flow/SKILL.md` for the new argument.

- [ ] T018 Draw the marks in `apps/app/src/editor/deck-edge.tsx` and
      `apps/app/src/editor/deck-node.tsx` (+ tests by role, label and text, not class names):
  - Edges:
    - numbered badges (`aria-label` "Step 4b"), plus `CircleAlert` for error-path steps
    - a solid primary stroke for `path`
    - dashed clay plus an alert icon on the label for `error`
    - dotted for `candidate` and `preview`
    - dashed plus a `Ban` icon for `invalid`: a 1.2 s flash, static under reduced motion via
      `useReducedMotion`
  - Nodes: a ring plus the tag text from `flowStart`.
  - Tokens only (DESIGN.md clay for error and invalid).

**Checkpoint**: the format, derivation, state and overlay are ready. Stories can start.

---

## Phase 3: User Story 1 — Record a flow by clicking connections (Priority: P1) 🎯 MVP

**Goal**: "+ New flow" → click contiguous connections → Done, and the flow is saved under its
feature with its steps, badges and list rows.

**Independent test**: on a deck with connections and one feature, record a three-step flow with the
mouse. Check the flow list ("3 steps"), the step list, the canvas badges and the flow in the JSON
panel (spec US1 scenarios 1–7).

### Tests for User Story 1 (write first, must fail)

- [ ] T019 [P] [US1] `apps/app/src/editor/flows/record-edge.test.ts`: `recordEdge(deck, session, edgeId)`
      returns one of:
  - `{ kind: 'create', title, featureId, edge }` for the first click of a new flow
  - `{ kind: 'append', branchId | null, edge }` when `edge.from` equals the next start (self-loops
    allowed; an edge already used earlier is allowed)
  - `{ kind: 'invalid', stepNumber, branchFromStep: null }` otherwise
- [ ] T020 [P] [US1] `apps/app/src/editor/flows/flow-session.test.ts`, with `flow-session.ts`
      actions run against a real `createEditor` on a test deck:
  - `recordClick` creates the flow and step 1 in one batch (one undo step), then appends steps.
  - `undoLastStep` removes the last recorded step.
  - `finish` refuses unless `canFinish`, and otherwise ends the session, sets `activeFlow` and
    returns the toast text.
  - `cancel` on a new flow removes the created flow (nothing left); with nothing recorded it ends
    without a confirmation flag.
- [ ] T021 [P] [US1] `apps/app/src/editor/flows/flow-list.test.tsx` (read-only listing):
  - features as groups with flows and "n steps"
  - the "No feature" group only when needed
  - "+ New flow" opens the dialog; an empty name shows "Enter a flow name" and does not start
    recording
- [ ] T022 [P] [US1] `apps/app/src/editor/flows/session-chip.test.tsx`:
  - the chip reads "Recording 'Place order' · 0 steps"
  - Done is disabled with a described reason
  - "Undo last step" and ⌘Z remove the last step
  - Esc with steps opens a confirmation, and without steps ends at once
- [ ] T023 [P] [US1] `apps/app/src/editor/flows/step-list.test.tsx` (US1 part):
  - "No steps yet"
  - rows "<from> → <to>" with the connection label as the second line
  - number badges
  - the hint "Next: click an edge leaving <node>"
  - the count in the header

### Implementation for User Story 1

- [ ] T024 [US1] Implement `apps/app/src/editor/flows/record-edge.ts` using `analyzeFlow` (T019
      green).
- [ ] T025 [US1] Implement `apps/app/src/editor/flows/flow-session.ts`:
  - `startNewFlow`, `recordClick` (create uses `editor.batch` with `add('flows', …)` plus
    `appendStep`), `undoLastStep`, `finish`, `cancel`
  - announcements: "Step n added: …", "Recording cancelled", "Saved flow '…'"

  T020 must pass.

- [ ] T026 [US1] Implement `apps/app/src/editor/flows/new-flow-dialog.tsx` (the `Dialog` "New flow
      in <feature>" with Name and "Start recording") and `apps/app/src/editor/flows/flow-list.tsx`
      (features and flows, read-only rows, "+ New flow", "No feature" group). Replace the
      placeholder in `apps/app/src/editor/left-sidebar.tsx` with `<FlowList/>` (T021 green).
- [ ] T027 [US1] Implement `apps/app/src/editor/flows/step-list.tsx`,
      `apps/app/src/editor/flows/step-row.tsx` and
      `apps/app/src/editor/flows/recording-hint.tsx`. While a session is active, the left sidebar
      shows "NEW FLOW · <feature>", the name and the step list instead of the flow list (T023
      green).
- [ ] T028 [US1] Implement `apps/app/src/editor/flows/session-chip.tsx` and render it in
      `apps/app/src/editor/top-bar.tsx` (in the spacer between the breadcrumb and `SaveStatus`) when
      `flowSession` is set: Undo last step, Done with its
      reason, Cancel. Use the existing `Dialog` for the discard confirmation (T022 green).
- [ ] T029 [US1] Route canvas input in session mode:
  - In `apps/app/src/editor/use-canvas-handlers.ts`:
    - `onEdgeClick` → `recordClick`
    - `onEdgeMouseEnter` / `onEdgeMouseLeave` → `setHoverEdge`
    - node clicks do not add steps
  - In `apps/app/src/editor/canvas.tsx`: `nodesDraggable={!session}`, and the palette drop and
    connecting are disabled.
  - In `apps/app/src/editor/use-canvas-shortcuts.ts`: in session mode ⌘Z → `undoLastStep`,
    Esc → cancel, and Delete, C and connect are ignored (FR-017).
  - Add cases to `use-canvas-shortcuts.test.tsx` and `canvas.test.tsx`.
- [ ] T030 [US1] Show the active flow:
  - Clicking a flow row sets `activeFlow`, the left panel shows its step list, and the canvas
    shows its marks (through T017).
  - `apps/app/src/editor/json-panel-view.ts` makes the Selection tab show
    `serializeEntry('flows', flow)`, labelled "Flow" (or "Step" when a step is active).
  - Tests in `json-panel-view.test.ts` and `flow-list.test.tsx`.
- [ ] T031 [US1] Bench: add a flows mode to `apps/app/src/bench/generate-deck.ts`
      (`BENCH_FLOWS=1`: 5 features × 4 flows × 10 contiguous steps, plus one flow with a
      2-branch fork written directly as JSON, since the schema supports it after T004). Add the scenarios "select flow → marks painted" and
      "record click → badge" to `apps/app/bench/perf.bench.ts`. The target is < 100 ms each.

**Checkpoint**: US1 is demonstrable end to end (quickstart §2 steps 2 and 5).

---

## Phase 4: User Story 2 — Blocked clicks and keyboard recording (Priority: P1)

**Goal**: a non-contiguous click adds nothing and explains why; a keyboard-only user can record a
flow.

**Independent test**: record, click a non-contiguous connection, and check that nothing is added
and the popover, step-list message and live region appear. Then record a flow with Tab, Shift+Tab
and Enter only (spec US2 scenarios 1, 3, 4; scenario 2's "Add as branch" is wired in US4).

### Tests for User Story 2 (write first, must fail)

- [ ] T032 [P] [US2] `apps/app/src/editor/flows/candidate-edges.test.ts`: `candidateEdges(deck, analysis, target)`
      returns:
  - all edges in reading order (source node y, then x) for step 1
  - the next start node's outgoing edges afterwards
  - an empty list when the node has no outgoing edges
- [ ] T033 [P] [US2] `apps/app/src/editor/flows/invalid-edge-popover.test.tsx`:
  - An invalid click sets `invalid`, and the popover (role `dialog`, non-modal) titled "Can't add
    this edge as step n" shows the text "It doesn't start at <node>." and "Got it".
  - The step list shows the same message.
  - `announce` gets the text.
  - The step count does not change.
- [ ] T034 [P] [US2] Keyboard cases in `apps/app/src/editor/use-canvas-shortcuts.test.tsx`:
  - In session mode, Tab / Shift+Tab cycle `candidateEdgeId` (the focus ring via `focusEdge`), and
    the name is announced through `edgeName`.
  - Enter records the focused candidate.
  - With no candidates, Tab leaves the canvas.
  - The dead-end hint "This flow can't continue from <node>…" shows.

### Implementation for User Story 2

- [ ] T035 [US2] Implement `apps/app/src/editor/flows/candidate-edges.ts` (T032 green) and the
      Tab / Shift+Tab / Enter handling in `apps/app/src/editor/use-canvas-shortcuts.ts`,
      panning the focused edge into view with the React Flow `setCenter` on the edge midpoint
      (T034 green). Add the dead-end hint to `recording-hint.tsx`.
- [ ] T036 [US2] Implement `apps/app/src/editor/flows/invalid-edge-popover.tsx`:
  - `Popover` anchored on the edge's `data-edge-anchor`, with "Got it" clearing `invalid`.
  - Wire the invalid result of `recordClick` to `setInvalid`, the flash (T018) and `announce`.
  - Add the step-list message in `step-list.tsx`.

  T033 must pass.

**Checkpoint**: the P1 slice (MVP) is complete. Run the quickstart §2 steps 2–5 and the bench
(quickstart §3).

---

## Phase 5: User Story 3 — Organize features and flows, and edit steps (Priority: P2)

**Goal**: create, rename, reorder and delete features and flows; edit step and flow text; edit mode
with reorder and remove; Cancel restores the structure but keeps text (clarifications Q1, Q3, Q4,
Q5).

**Independent test**: perform every action from the left panel, the inspector and the keyboard,
and check the list, canvas and JSON after each one, including Undo (spec US3 scenarios 1–8).

### Tests for User Story 3 (write first, must fail)

- [x] T037 [P] [US3] Model: failing cases in `packages/model/test/edit.test.ts`,
      `undo.test.ts` and `cascade.test.ts` for:
  - `captureFlowStructure(file, flowId)` and `restoreFlowStructure(flowId, checkpoint)`:
    - added steps are removed and removed steps come back
    - order and `branch` membership are restored
    - current text of surviving steps and branches is kept
    - a step removed by a remote origin after capture comes back
    - it is one undo step
  - `moveStep` refusing (`invalid`) a move that changes the step's path, or that places a main
    step after the branch step while branches exist
- [ ] T038 [P] [US3] `apps/app/src/editor/flows/flow-order.test.ts`:
  - `indexForMoveWithinFeature(deck, flowId, featureId | null, position)` gives the global
    `flows` index
  - `moveToFeature` patches `feature` and moves the flow to the end (FR-001a)
  - `stepIndexForMoveWithinPath(flow, stepId, position)` gives the index in `flow.steps`
- [ ] T039 [P] [US3] `apps/app/src/editor/flows/use-sortable-list.test.tsx`:
  - ⌥↑ / ⌥↓ call `onMove(id, newPosition)`, stop at the group bounds, and announce "Moved to
    position n of m".
  - A pointer drag on the grip reorders within the group, is refused outside it, and Esc cancels.
  - Locked items (the branch step) can't move and nothing moves after them.
- [ ] T040 [P] [US3] Component tests in `apps/app/src/editor/flows/flow-list.test.tsx`:
  - New feature.
  - Rename a feature or flow inline (F2, the menu): an empty name keeps the old one.
  - The menus "Feature actions: …" and "Flow actions: …" (Open, Edit steps, Rename, Move to
    feature ▸, Delete…).
  - Delete opens the confirm dialog, whose body states the flow count for a feature; then the
    Undo toast appears and ⌘Z restores.
  - Reorder with ⌥↑ keeps the new order after an export round trip (`serializeDeck` →
    `fromJSON`).
- [ ] T041 [P] [US3] `apps/app/src/editor/flows/inspector-flow.test.tsx` and
      `inspector-step.test.tsx`:
  - Flow: Title, Description, Owner (suggestions from the owners in the deck, via `datalist`),
    Feature select incl. "No feature", and "Edit steps".
  - Step: the header "Step n · <from> → <to>"; Title, Description, Condition and SLA commit on
    Enter or blur, each one undo step, and are editable outside a session.
  - The row main line switches to the title (FR-019a).
- [ ] T042 [P] [US3] Edit-mode cases in `apps/app/src/editor/flows/session-chip.test.tsx` and
      `step-list.test.tsx`:
  - "Editing '<flow>'" appears.
  - ⌥↓ breaking the chain shows the dashed dot, the alert icon and "Doesn't start where step n
    ended", and Done becomes disabled.
  - ⌫ removes the focused step with no dialog.
  - Cancel asks, restores the order and keeps a title edited in the session.

### Implementation for User Story 3

- [x] T043 [US3] Implement `captureFlowStructure` / `restoreFlowStructure` and `FlowCheckpoint` in
      `packages/model/src/ops/branches.ts`, and the `moveStep` refusals in
      `packages/model/src/ops/steps.ts`. Export them from `packages/model/src/index.ts` (T037
      green).
- [ ] T044 [P] [US3] Implement `apps/app/src/editor/flows/flow-order.ts` (T038 green).
- [ ] T045 [P] [US3] Implement `apps/app/src/editor/flows/use-sortable-list.ts`: pointer events on
      the grip, a placeholder, panel auto-scroll, Esc to cancel, ⌥↑ / ⌥↓, and `group` and
      `locked` options. No dependency (T039 green).
- [ ] T046 [US3] Complete `apps/app/src/editor/flows/flow-list.tsx`:
  - "New feature"
  - inline rename via `InlineEdit` + F2
  - `DropdownMenu` feature and flow menus
  - grips plus `use-sortable-list` for features (`reorder('features')`) and flows (`flow-order`)
  - Delete via `requestDelete({ targets })`

  T040 must pass.

- [ ] T047 [US3] Implement `apps/app/src/editor/flows/inspector-flow.tsx` and
      `apps/app/src/editor/flows/inspector-step.tsx` using `FieldEdit`, `Textarea`, `Select` and
      an `Input` with a `datalist`. Route `activeFlow` in `apps/app/src/editor/inspector.tsx`
      (T041 green).
- [ ] T048 [US3] Implement edit mode:
  - `startEditing` in `flow-session.ts` captures a checkpoint; `cancel` in edit mode confirms when
    the structure changed, then calls `restoreFlowStructure`; `finish` requires `canFinish`.
  - Recording in edit mode appends to the session's target path.
  - Step-row grips plus ⌥↑ / ⌥↓ (`moveStep` via `flow-order`) with the branch step locked.
  - ⌫ and "Remove step n" call `removeStep` with no dialog; ⌫ on the branch step is refused with
    "Delete its branches first".
  - Chain-break rows are drawn in `step-row.tsx`.
  - Shortcuts live in `apps/app/src/editor/flows/use-flow-shortcuts.ts`.

  T042 must pass.

**Checkpoint**: US3 works on its own on top of the MVP (quickstart §2 steps 1, 6 and 8).

---

## Phase 6: User Story 4 — Branches and error paths (Priority: P2)

**Goal**: B adds a branch after a main-path step. The first branch splits the continuation into
alternative "a". Label and condition are required. Error paths are dashed with an icon and text.
One branch point per flow, one level.

**Independent test**: on a recorded 5-step flow, add a normal branch and an error-path branch.
Check the numbering, the canvas styles in grayscale, the branch step's inspector and the empty-field
validation (spec US4 scenarios 1–10, SC-006).

### Tests for User Story 4 (write first, must fail)

- [x] T049 [P] [US4] Model: failing cases in `packages/model/test/edit.test.ts`,
      `undo.test.ts`, `cascade.test.ts` and the preview tests:
  - `addBranch`:
    - it splits the following main steps into "a" (empty label and condition) and appends "b" with
      its first edge, in one undo step
    - with no following steps it creates "a"
    - with existing branches it only works after the branch step
    - it is refused from a branch step or an earlier main step
  - `updateBranch`: each commit is its own undo step.
  - `removeBranch`: removes the branch and its steps; the others stay.
  - `removeStep` on the branch step: the branch point moves to the new last main step.
  - `previewRemoval` with `{ scope: 'branches', flowId, id }` counts the branch's steps.
- [ ] T050 [P] [US4] `apps/app/src/editor/flows/inspector-branch.test.tsx`:
  - NEW BRANCH label, condition and the `switch` "Error path".
  - Done with empty fields shows an inline error with an icon under each, focus moves to the
    first, and nothing is saved.
  - Editing label, condition or error path updates the step list and JSON.
  - "Delete branch…" opens the confirm dialog, then the Undo toast.
- [ ] T051 [P] [US4] Branch cases in `apps/app/src/editor/flows/step-list.test.tsx` and
      `record-edge.test.ts`:
  - "◇ <label>" headers.
  - An error-path header has the alert icon plus the text "error path".
  - `4a` / `5a` / `4b` numbering, and the header count "3 + 2 branches".
  - B on a branch step announces "Branches can only start from the main path."
  - B on an earlier main step while branches exist announces "This flow already branches after
    step n."
  - `recordEdge` sets `branchFromStep` per research R9.
  - The popover shows "Add as branch from step k" only when allowed.
  - The branch step's inspector lists "BRANCHES AFTER THIS STEP".

### Implementation for User Story 4

- [ ] T052 [US4] Implement `addBranch`, `updateBranch` and `removeBranch` in
      `packages/model/src/ops/branches.ts`; the branch cascade in
      `packages/model/src/ops/cascade.ts`; and `RemovalTarget` `'branches'` in
      `packages/model/src/preview.ts`. Export them (T049 green). Add a `branches` wording to
      `apps/app/src/editor/describe-removal.ts` ("Its n steps will be deleted.").
- [ ] T053 [US4] Implement `apps/app/src/editor/flows/branch-header.tsx`, the branch rendering in
      `step-list.tsx` and `step-row.tsx`, B in `use-flow-shortcuts.ts` (plus an "Add branch"
      button on the focused step row), the session `addingBranch` chip text, and
      `apps/app/src/editor/flows/inspector-branch.tsx`, including the branch step's "BRANCHES
      AFTER THIS STEP" in `inspector-step.tsx` (T050, T051 green).
- [ ] T054 [US4] Wire "Add as branch from step k" in `invalid-edge-popover.tsx` (calls `addBranch`
      with `firstEdge`, sets the target to the new branch and `addingBranch`), and the
      `branchFromStep` rule in `record-edge.ts`. Check that error-path marks come through
      `flow-overlay.ts` and `deck-edge.tsx` (T018).

**Checkpoint**: US4 works on top of US1–US3 (quickstart §2 step 7).

---

## Phase 7: User Story 5 — Find a flow and spot broken steps (Priority: P3)

**Goal**: filter flows by name, step text and condition; show broken steps and "Has problems"
without blocking Done (clarification Q2).

**Independent test**: with ten flows, filter by name, step title, connection label and condition,
and check the empty state. Delete a connection used by a step and check the broken row and the flow
marker, then Undo (spec US5 scenarios 1–5).

### Tests for User Story 5 (write first, must fail)

- [ ] T055 [P] [US5] `apps/app/src/editor/flows/filter-flows.test.ts`: `filterFlows(deck, query)`
  - is case-insensitive over flow title, step titles, connection labels, and step and branch
    conditions
  - returns match ranges per field, and `count` / `total`
  - an empty query matches all
- [ ] T056 [P] [US5] `apps/app/src/editor/flows/flow-filter.test.tsx`:
  - / focuses the `searchbox` "Filter flows" (not when typing in a field); Esc clears it.
  - The "n of m" status shows.
  - Matches render bold and underlined (`mark`), and feature headers stay.
  - The empty state shows `No flows match "zzz"` with "Clear filter" and "New flow 'zzz'" (opens
    recording with that name).
  - The filter is hidden during a session.
- [ ] T057 [P] [US5] Broken-step cases in `apps/app/src/editor/flows/step-list.test.tsx` and
      `flow-list.test.tsx`:
  - After `remove('edges', …)`, the row shows its title or "Unknown connection" plus the alert
    icon and "Connection deleted".
  - The flow row shows "Has problems".
  - Done in edit mode stays enabled.
  - Neighbors of a broken step are not flagged as chain breaks.
  - ⌘Z clears it.
  - Removing the broken step keeps the others.

### Implementation for User Story 5

- [ ] T058 [US5] Implement `apps/app/src/editor/flows/filter-flows.ts` and
      `apps/app/src/editor/flows/flow-filter.tsx` (`SearchField`, the status, the empty state), and
      register / in `use-flow-shortcuts.ts` guarded by `isTextTarget` (T055, T056 green).
- [ ] T059 [US5] Implement broken rendering in `step-row.tsx` and the "Has problems" marker in
      `flow-list.tsx` from `analyzeFlow(...).problems` (T057 green).

**Checkpoint**: all stories are done (quickstart §2 steps 9–10).

---

## Phase 8: Polish and cross-cutting concerns

- [ ] T060 [P] Accessibility pass over `apps/app/src/editor/flows/*` with tests in
      `apps/app/src/editor/flows/a11y.test.tsx`:
  - Every button, menu, dialog, popover, switch and list has an accessible name.
  - Every announcement from contracts/flow-authoring-ui.md fires.
  - No state is color-only: a snapshot of the role and text for error path, invalid, broken,
    chain break and match.
- [ ] T061 [P] Performance: run `pnpm bench` with and without `BENCH_FLOWS=1`. Save the results in
      `specs/006-flow-authoring/bench-after.md` next to `bench-before.md`:
  - pan, zoom and drag within 5 % of `main`
  - both flow scenarios under 100 ms

  If a target is missed, fix it before merge (constitution V).

- [ ] T062 [P] Update the docs: `apps/app/CLAUDE.md` (the `editor/flows/` boundary, session rules,
      overlay argument), `packages/model/CLAUDE.md`, `packages/schema/CLAUDE.md`, the `DeckEdge`
      and `toFlowEdges` notes in `.agents/skills/react-flow/SKILL.md`, and a status line for 006
      in `docs/backlog.md`.
- [ ] T063 Visual check: take screenshots at 1440×900, light and dark, of states 41–48 and the left
      panel of 02 and 03. Put them next to `docs/design/screens/*` in the PR description, and
      list the remaining differences (allowed: DESIGN.md tokens, lucide icons, confirm before
      delete, no player or dimming).
- [ ] T064 Definition of done:
  - `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass.
  - No `.only` or skipped tests.
  - `pnpm schema:generate` leaves no diff.
  - Run the whole quickstart §2 walkthrough, including step 12 (autosave, reload, two tabs).
  - Write the final report: what changed, what was skipped, what is uncertain.

---

## Dependencies and execution order

### Phase dependencies

- **Setup (Phase 1)**: T001 first; then T002 and T003 in parallel.
- **Foundational (Phase 2)**: T004 → T005, then the model tasks (T006 → T007; T008 → T009; T010
  and T011 after T004). The UI package task (T012) is independent. The app tasks follow: T013 →
  T014, T015; T016 needs T007; T017 needs T016; T018 needs T017. The phase blocks all stories.
- **US1 (Phase 3)**: needs Foundational. MVP part 1.
- **US2 (Phase 4)**: needs US1 (`flow-session.ts`, `recording-hint.tsx`, shortcuts). MVP part 2.
- **US3 (Phase 5)**: needs US1. It can run in parallel with US2 if `use-canvas-shortcuts.ts` edits
  are coordinated (US2 changes Tab/Enter; US3 adds nothing there, since its shortcuts are in
  `use-flow-shortcuts.ts`).
- **US4 (Phase 6)**: needs US3 (edit mode, `use-sortable-list` locking, `inspector-step.tsx`) and
  US2 (popover).
- **US5 (Phase 7)**: needs US1. The broken rows need `step-row.tsx` (US1), and "Done not blocked"
  needs edit mode (US3).
- **Polish (Phase 8)**: after the stories being shipped.

### Within each story

Tests first (they must fail) → implementation → tests green → commit.

## Parallel examples

```text
Phase 2:  Agent A (schema/model): T004 → T005 → T006 → T007 → T008 → T009 → T010, T011
          Agent B (ui/app):       T012, T013 → T014, T015 → (after T007) T016 → T017 → T018
US1:      T019 ∥ T020 ∥ T021 ∥ T022 ∥ T023  →  T024 → T025 → T026 ∥ T027 ∥ T028 → T029 → T030 → T031
US2:      T032 ∥ T033 ∥ T034  →  T035 ∥ T036
US3:      T037 ∥ T038 ∥ T039 ∥ T040 ∥ T041 ∥ T042  →  T043, T044 ∥ T045  →  T046 ∥ T047  →  T048
US4:      T049 ∥ T050 ∥ T051  →  T052  →  T053  →  T054
US5:      T055 ∥ T056 ∥ T057  →  T058 ∥ T059
Polish:   T060 ∥ T061 ∥ T062  →  T063  →  T064
```

## Implementation strategy

1. **MVP (US1 + US2)**: Phases 1–4. Flows can be recorded by mouse and keyboard, and non-contiguous
   clicks are refused with an explanation. Demo it, then run the bench.
2. **Increment 2 (US3)**: organize features and flows, edit steps, and edit mode with a safe Cancel.
3. **Increment 3 (US4)**: branches and error paths (F-4).
4. **Increment 4 (US5)**: the filter and broken-step visibility.
5. **Polish**: accessibility, bench after, docs, visual check, definition of done.

Each increment keeps `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green.
