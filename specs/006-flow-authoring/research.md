# Research: Flow Authoring (006)

Decisions for [plan.md](plan.md), resolving the technical unknowns in the spec. Names were checked
against `main` on 2026-09-27: `useDeckSnapshot`, `useEditor`, `useUiStore` (`state/ui-store.ts`),
`toFlowEdges` / `toFlowNodes` (`editor/deck-to-flow.ts`, per-object `WeakMap` caches), `DeckEdge`,
`useCanvasHandlers`, `useEditorShortcuts` / `useCanvasKeyDown` / `isTextTarget`
(`editor/use-canvas-shortcuts.ts`), `ConfirmDeleteDialog`, `describeRemoval`, `previewRemoval`,
`FieldEdit`, `InlineEdit`, `Announcer`, `DeckEditor.addStep/updateStep/moveStep/removeStep/reorder`,
`checkIntegrity`, `observeDeck` (`child.kind: 'step' | 'column' | 'row'`).

## R1. Branch shape in the file format

- **Decision**: two additive optional fields, no version bump.
  - `Flow.branches?: Branch[]`, where `Branch = { id, label, condition, errorPath?, description? }`.
    `label` and `condition` are required keys but may be empty strings.
  - `Step.branch?: Id`: the id of the branch (in the same flow) this step belongs to. A step
    without `branch` is on the main path.
  - **The branch point is derived**: it is the last main-path step (clarification: a fork ends
    the main path). There is no `from` field.
  - `flow.steps` stays one flat, ordered array. The order within each path is the relative order
    of its steps in that array. The model keeps a normal form: main-path steps first, then each
    branch's steps grouped in `branches` order.
- **Rationale**:
  - Flat steps keep every existing piece working unchanged: step ops, step refs
    (`flows/<id>/steps/<id>`), cascade, `observeDeck` children, JSON panel entries, and 007's
    player.
  - Branches get a stable id (constitution III), so renaming a label never breaks anything.
  - Deriving the branch point makes a dangling `from` impossible and encodes "one branch point
    per flow" in the shape itself.
  - Allowing empty `label` and `condition` is needed because branches are written to the deck as
    they are recorded (R3). "Required" is enforced by Done (FR-023) and later by 015's Problems
    panel, not by schema validation, so a half-made branch never makes the deck unsaveable or
    unexportable.
- **Alternatives considered**:
  - Nested `step.branches[].steps[]`: breaks every flat step op, step refs and change tracking,
    and needs a Yjs layout migration.
  - `step.branch = {label, condition, errorPath}` on the first step of each branch: membership
    would depend on array position, so a reorder silently changes which path a step is on.
  - Adding `Branch.from`: redundant under the "fork ends the main path" rule and can dangle.
- Recorded in **ADR 0008** (0007 is reserved by 005's plan for deck persistence).

## R2. Deriving paths, numbers, chain breaks and broken steps

- **Decision**: a pure function in `packages/model/src/flow-paths.ts`:
  `analyzeFlow(flow, edgesById) → FlowAnalysis` (see [data-model.md](data-model.md)).
  - It returns:
    - the main path and each branch path, with display numbers (`1…n`, then `n+1` + letter, e.g.
      `4a`, `5a`, `4b`)
    - each step's `from` and `to` (read through `step.edge`)
    - a `broken` flag (the step's edge is missing)
    - a `chainBreak` flag (the step does not start where the previous non-broken step on its path
      ended)
    - the branch step, and the next start node of each path
  - It is exported from `@sododeck/model` and never stored (FR-038).
- **Rationale**:
  - 006 (list, canvas badges, Done gating, filter), 007 (player) and 015 (Problems) all need the
    same derivation.
  - It works on plain JSON, so it runs in a worker or in tests without Yjs.
  - The chain check skips broken steps (clarification Q2). A step after a broken one is compared
    with the last non-broken step before it. When that pair doesn't connect, the skip rule marks
    the _broken_ step as the gap instead of flagging a chain break.
- **Alternatives considered**: computing it in `apps/app`. Rejected because 007 and 015 would
  duplicate it.

## R3. When recording writes to the deck

- **Decision**: steps are written to the deck as they are recorded.
  - For a **new** flow, `+ New flow` only stores the pending name (and feature) in the UI session.
    The first valid click creates the flow and its first step in one `batch`.
  - Each later step is one `addStep`, and therefore one undo step (`addStep` transacts without a
    capture key, so `stopCapturing` separates them).
  - Cancel (confirmed) on a new flow removes the flow.
- **Rationale**:
  - Constitution I: an in-progress flow is document data (the JSON panel shows it, design 42).
  - Once 005 ships, it is autosaved and synced with no extra code.
  - Creating the flow only on the first step means Esc with nothing recorded leaves no empty
    flow behind, and needs no confirmation (FR-013).
- **Alternatives considered**: keeping the draft in Zustand and writing it on Done. That
  duplicates document data (violates I), makes the JSON panel lie, and loses work on reload.

## R4. Edit mode Cancel: restoring the structure

- **Decision**:
  - Entering edit mode captures a checkpoint with `captureFlowStructure(file, flowId)`, a new
    model read that returns an immutable JSON copy of the flow's `steps` and `branches`.
  - Cancel (confirmed) calls a new editor op, `restoreFlowStructure(flowId, checkpoint)`, in one
    transaction. It:
    - removes steps and branches added in the session
    - re-inserts removed ones from the checkpoint
    - restores order and `branch` membership
    - for objects that still exist, keeps their **current** text fields (title, description,
      condition, SLA, label, errorPath and so on, per clarification Q1)
  - The restore is one undo step.
  - The checkpoint lives in the edit session (UI store) for the session's lifetime only. It is
    never rendered or read as current data.
- **Rationale**:
  - The Yjs `UndoManager` cannot undo only the structural changes when text edits (and remote
    tab edits) are interleaved.
  - `Y.snapshot` needs `gc: false` on every deck.
  - The model stays the only Yjs ↔ JSON converter (constitution II): the app holds an opaque value
    and hands it back.
- **Alternatives considered**: repeated `undo()` back to a marker (also reverts text edits and
  can't skip remote edits); `Y.snapshot` (needs GC off).
- **Constitution note**: the checkpoint is a copy of document data held in UI state. It is
  justified in Complexity Tracking. It is a restore point, not a second source of truth.

## R5. Branch operations and cascade

- **Decision**: new `DeckEditor` ops, `addBranch`, `updateBranch`, `removeBranch` and
  `setStepBranch` (details in [contracts/model-additions.md](contracts/model-additions.md)).
  - Adding the first branch while main-path steps follow the chosen step moves those steps into a
    new alternative "a" (empty label and condition), then adds the new alternative "b". This is
    one transaction and one undo step (clarification from specify).
  - `removeBranch` removes the branch and its steps. The other branches stay.
  - Removing the branch step (the last main-path step) while branches exist:
    - The model cascades: it removes the step and moves the branch point to the new last
      main-path step.
    - The UI refuses ⌫ on the branch step and says "Delete its branches first" (it would
      otherwise silently re-home every branch).
  - `observeDeck` gains `child.kind: 'branch'`. `RemovalTarget` gains `{ scope: 'branches',
flowId, id }` so the confirm dialog and Undo toast work for branches.
- **Rationale**: keeps every structural rule (normal form, one branch point, membership) in the
  model, where it is tested with round-trip and cascade cases. The app just calls intent-level
  ops.

## R6. Canvas overlay: badges, candidates, invalid and error-path styles

- **Decision**:
  - A pure `flowOverlay(deck, analysis | null, session, hoverEdgeId) → { edges: Map<edgeId,
EdgeFlowMark>, nodes: Map<nodeId, NodeFlowMark> }` in `apps/app/src/editor/flows/`.
  - `toFlowEdges` / `toFlowNodes` get an optional overlay argument. The per-object cache also
    compares the object's overlay entry, so only edges whose mark changed get a new object.
  - `DeckEdgeData` gains an optional `flow?: EdgeFlowMark`. `DeckEdge` draws from it:
    - step badges (numbers; error-path steps get the `CircleAlert` icon)
    - a solid primary stroke for path edges
    - dashed clay plus the alert icon on the label for error paths
    - dotted for candidates
    - dashed plus the `Ban` icon for invalid clicks (a 1.2 s flash, static under reduced motion)
    - a dotted preview on hover
  - Nodes gain an optional `flowStart?: string` ("Step 4 starts here") that draws a ring and a
    tag.
- **Rationale**:
  - The canvas stays derived (ADR 0006).
  - Marks for one flow touch at most a few dozen edges, so the cached rebuild only allocates
    those. That keeps the flow highlight and step-add latency far below 100 ms at 1,000 edges.
  - No state is shown by color alone (constitution VII).
- **Alternatives considered**: a separate SVG overlay layer. Rejected: it duplicates the edge
  geometry and breaks label anchoring.

## R7. Session and UI state (Zustand)

- **Decision**: `ui-store.ts` gains:
  - `activeFlow: { flowId, stepId: Id | null, branchId: Id | null } | null`. Selecting a flow,
    step or branch clears the node and edge selection, and the reverse also holds.
  - `flowSession` (see data-model): mode `record | edit | branch`, the flow id or pending name
    and feature, recorded step ids (for ⌘Z), the edit checkpoint, the branch being added, the
    `invalid` notice, and the candidate focus.
  - `hoverEdgeId`, `flowFilter`, and `pendingDelete` widened to a `RemovalTarget[]`-based request.
  - `useFlowSync` prunes `activeFlow` and `flowSession` on `removed` changes (for example another
    tab deleting the flow), in the same way `useSelectionSync` does for nodes.
- **JSON panel**: the Selection tab shows the active flow, step or branch through
  `serializeEntry('flows', …)` (the tab label reads Flow or Step, as in design 42 and 45). No new
  `JsonTab` value, so saved panel preferences keep working.

## R8. Clicks, hover and keyboard during a session

- **Decision**:
  - While `flowSession` is set, `onEdgeClick` routes to `recordEdge(edgeId)` instead of
    selecting. `onEdgeMouseEnter` / `onEdgeMouseLeave` set `hoverEdgeId`.
  - Nodes are not draggable, and connecting, the palette drop, Delete and C are ignored, which
    pauses structure editing (FR-017).
  - **Keyboard**: in `useCanvasKeyDown`, Tab / Shift+Tab cycle the candidates:
    - For step 1, all edges in reading order (source node y, then x).
    - Afterwards, the next start node's outgoing edges.
    - Focus sets `focusedEdgeId` (the existing dashed focus ring), pans the edge into view and
      announces `edgeName(...)`.
    - Enter records the focused edge.
  - Tab leaves the canvas when there are no candidates, so keyboard users can always reach Done.
- **Rationale**: reuses the existing focus-ring, announcement and `edgeName` pieces.
  `edgesFocusable={false}` stays, and the roving logic is ours, as for nodes.

## R9. Contiguity, "Add as branch" and invalid clicks

- **Decision**: `recordEdge` asks `analyzeFlow` for the current path's next start node.
  - The edge is valid when there is no start node yet (first step) or when `edge.from` equals
    the start node. Otherwise:
    - nothing is written
    - `flowSession.invalid = { edgeId, stepNumber, branchFrom }` drives the flash, the popover
      anchored on `data-edge-anchor`, the step-list message, and `announce(...)` in the polite
      region
  - `branchFrom` is the main-path step k whose `to` equals `edge.from`, allowed only when:
    - the flow has no branches, and k is any earlier main-path step, or
    - the flow has branches, and k is the branch step itself
  - Otherwise the popover only shows "Got it" (edge case "A second branch point").

## R10. Reordering by drag and keyboard without a new dependency

- **Decision**:
  - A small `use-sortable-list.ts` hook in `apps/app/src/editor/flows/`. It handles pointer drag
    on the grip, with a placeholder, auto-scroll of the panel and Esc to cancel.
  - The same hook handles ⌥↑ / ⌥↓ on the focused row, with an announcement "Moved to position n
    of m".
  - The hook is bounded by a `group` key: a path for steps, a feature for flows, the list for
    features. A drop outside its group is refused (clarification Q4).
  - It is used for steps (`moveStep`), flows (`reorder('flows')` with a computed global index)
    and features (`reorder('features')`).
  - The branch step can't move, and no step can be dropped after it (it must stay the last
    main-path step).
- **Rationale**: the three lists are short (≤ ~30 rows) and vertical. A ~120-line hook avoids a
  runtime dependency (constitution VIII).
- **Alternatives considered**: `@dnd-kit/sortable` (≈ 30 kB, needs founder approval, and is more
  than three short vertical lists need).

## R11. Menus, rename, owner suggestions, markdown

- **Decision**:
  - Feature and flow menus use a `DropdownMenu` wrapper added to `packages/ui` via shadcn over the
    existing `radix-ui` package (no new dependency). 005 plans the same wrapper, and whichever
    feature lands first adds it.
  - Inline rename uses the existing `InlineEdit` with F2.
  - The owner field uses `Input` plus a native `<datalist>` of the owners already in the deck.
  - Descriptions use the existing `Textarea` (markdown text; no rendering in 006).
  - Text fields use `FieldEdit` (commit on Enter or blur, one undo step per commit).
- **Rationale**: the platform plus existing components.

## R12. Flow filter

- **Decision**: a pure `filterFlows(deck, query) → { matches: Map<flowId, MatchRanges>, count,
total }` in `apps/app/src/editor/flows/`.
  - It matches case-insensitively over flow title, step titles, connection labels of steps, and
    step and branch conditions.
  - Matching text renders in `<mark>`-like bold plus underline (not color alone).
  - `/` focuses the filter through `useEditorShortcuts` when `!isTextTarget`. Esc clears it.
  - The filter input is hidden during a session.
- **Rationale**: 20 flows × ~10 steps is trivial on the main thread (well under 1 ms). A worker
  isn't warranted (constitution V is about heavy work).

## R13. Ordering features and flows

- **Decision**:
  - The `features` array order is the feature order.
  - The flow order within a feature is the relative order of that feature's flows in the `flows`
    array.
  - Moving flow X to position i of feature F computes the global index before or after the
    neighbor at i and calls `reorder('flows', X, index)`.
  - Changing a flow's feature (inspector or menu) patches `feature` and moves the flow to the end
    of the `flows` array, so it is last in its new feature (FR-001a).
  - The "No feature" section follows the same rule.
- **Rationale**: no new field; order is already document data and survives export → import.

## R14. Deletes: confirm, Undo toast, ⌫ in sessions

- **Decision**:
  - `pendingDelete` becomes `{ targets: RemovalTarget[] }`. `removalTargets(selection)` still
    builds it for canvas selections, and the flow list builds it for a feature, flow or branch.
  - `describeRemoval` gains wording for these (for a feature, "3 flows will move to No feature").
  - Confirm, Undo toast and ⌘Z work unchanged.
  - Inside a session, ⌫ or the row button on a step calls `removeStep` directly, with no dialog
    (FR-004), because ⌘Z restores it.

## R15. Performance and bench

- **Decision**:
  - `generateBenchDeck` gains an optional flows mode: 5 features × 4 flows × 10 steps, plus one
    flow with a 2-branch fork.
  - `perf.bench.ts` gains two scenarios:
    - "select flow → marks painted": target < 100 ms, measured from click to the next frame that
      has the badges
    - "record click → badge": target < 100 ms
  - Existing pan, zoom and drag numbers must stay within 5 % of `main`.
  - `pnpm bench` runs before and after, and both results go in the report.

## R16. Scope guard

- 005 isn't implemented. 006 needs nothing from it. Autosave, reload and multi-tab behavior come
  for free once 005 attaches its providers, because every change goes through the model.
- Playback (dimming, token, player, branch picker) belongs to 007. Rules, step owner, tags and
  links belong to 008. The Problems panel belongs to 015.
- No new e2e tests (constitution VI). The smoke suite may need a selector update only if the left
  panel placeholder text is asserted.
