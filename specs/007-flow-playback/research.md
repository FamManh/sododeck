# Research: Flow Playback (007)

Decisions for [plan.md](plan.md), resolving the technical unknowns in the spec (clarified
2026-09-27, 5 answers). Names were checked against `main` at `3a3c2d3`:

- UI state: `useUiStore` (`state/ui-store.ts`) with `activeFlow: { flowId, stepId, branchId } | null`,
  `flowSession`, `select()` (clears `activeFlow` on a canvas selection outside a session),
  `setActiveFlow` / `setActiveStep` / `setActiveBranch`, `announce()`, `resetForDeck()`.
- Canvas: `Canvas` (`editor/canvas.tsx`) computes `analyzeFlow` + `flowOverlay(...)` and passes the
  overlay to `toFlowNodes` / `toFlowEdges` (`editor/deck-to-flow.ts`, per-object caches, `sameMark`).
  `DeckEdge` draws `data.flow` (`FLOW_STROKES`, `StepBadge`), `DeckNode` draws `data.flowStart`.
- Flows (006): `analyzeFlow` / `PathStep` / `BranchPath` (`@sododeck/model`), `flow-overlay.ts`,
  `session-path.ts` (`findFlow`, `stepRoute`, `nodeTitle`), `flow-panel.tsx`, `step-list.tsx`,
  `flow-inspector.tsx`, `inspector-step.tsx`, `use-flow-sync.ts`, `use-flow-shortcuts.ts`,
  `flow-session.ts` (Done → `endSession(); setActiveFlow(id)`).
- Keys: `useCanvasKeyDown` (arrows move node focus) and `useEditorShortcuts` (⌘Z, Delete, Esc,
  capture phase) in `editor/use-canvas-shortcuts.ts`; `isTextTarget` (`lib/is-text-target.ts`).
- Motion: `MOTION` / `resolveMotion(reduced)` (`@sododeck/ui/lib/motion`: `dimMs` 250,
  `tokenLoopMs` 1400, `stepMs` 1700; reduced → dim 0, token 0), `useReducedMotion`
  (`@sododeck/ui/hooks/use-reduced-motion`), tokens `--sd-dur-dim`, `--sd-flow-token-loop` in
  `tokens.css` (0 ms under reduced motion).
- UI kit: `SegmentedControl` / `SegmentedControlItem` (Radix RadioGroup), `Button`, `Tooltip`,
  `KindTile`, `PanelSection`, toast, `focusRing`.
- JSON panel: `selectionView(deck, selection, activeFlow)` (`editor/json-panel-view.ts`) shows the
  whole flow entry for a shown flow; text comes from `serializeEntry` (`@sododeck/model`), whose
  `EntryCollection` is the top-level collections plus `rules`.
- Project skill `.agents/skills/react-flow/SKILL.md` already prescribes the dimming recipe (one
  attribute on the wrapper + `.in-flow` members) and the token recipe (`<animateMotion>` in a child
  of the current edge only).
- Bench: `apps/app/bench/perf.bench.ts` flow scenarios via `window.__sododeckFlowBench`
  (`showFlow`, `recordClick`), target < 100 ms.

## R1. Where flow mode lives in UI state

- **Decision**: flow mode is **derived**: `activeFlow !== null && flowSession === null`. 006's
  `activeFlow` becomes the flow mode session and gains three UI-only fields:
  `alternativeId: string | null` (the chosen alternative at the fork), `playing: boolean` and
  `speed: 1 | 2`. `stepId` is the **current step** (never `null` in flow mode when the flow has
  steps); `branchId` keeps its 006 meaning (a branch opened in the inspector). A new top-level
  `lastPlayedFlowId: string | null` holds the "last played" mark after exit.
  - `openFlow(flowId, stepId?)` replaces `setActiveFlow(id)` for opening: first step of the played
    path (or `stepId` when given, choosing that step's alternative), paused, 1×, alternative "a".
  - `exitFlow()` sets `activeFlow: null`, `lastPlayedFlowId: flowId`, clears the canvas selection.
  - `setCurrentStep(stepId)` pauses; `setPlaying`, `setSpeed` (pauses), `setAlternative(id)`
    (pauses, re-homes the current step, R4).
  - `resetForDeck()` also clears `lastPlayedFlowId`; `openFlow` clears it (spec: "until another
    flow is opened or the deck is closed").
- **Rationale**: 006 already routes the left panel, inspector, JSON panel and canvas on
  `activeFlow`; clarification Q1 says opening a flow _is_ flow mode, so there is no second
  "selected flow" state to keep. The recording/edit session keeps precedence (no dimming, no
  player) exactly as today, and Done already calls `setActiveFlow(id)` → it becomes `openFlow(id)`
  (design 44). Everything added is ids, a boolean and a number: UI state (constitution I).
- **Alternatives considered**: a separate `playback` slice next to `activeFlow` (two sources for
  "which flow is shown", both need pruning); keeping 006's plain view plus a Play toggle (rejected
  by clarification Q1).

## R2. The played path and step lookups

- **Decision**: a pure module `editor/flows/played-path.ts` over `FlowAnalysis`:
  - `playedPath(analysis, alternativeId)` → `{ steps: PathStep[], alternative: BranchPath | null }`:
    `analysis.main` then the chosen alternative's steps (the first alternative when `alternativeId`
    is `null` or unknown). `m = steps.length` ("Step 4b of 5", design 46).
  - `playerView(analysis, played, currentStepId)` → position, `n of m` label, previous / next ids,
    whether the branch picker shows (`current` is the fork step or on an alternative), the fork
    number ("AT STEP 3"), and segments `{ stepId, number, filled, current, errorPath, broken }`.
  - `stepForNode(played, nodeId)` → first step whose `from` or `to` is the node (FR-012).
  - `stepForEdge(played, edgeId, currentStepId)` → the first step on that edge after the current
    one, wrapping (clarified default in Assumptions).
  - `rehome(analysis, fromAlternative, toAlternative, currentStepId)` → same position in the new
    alternative, or its last step; unchanged when the current step is on the main path (FR-017).
  - `stepAnnouncement(deck, played, step, alternative)` → "Step 5 of 8: A → B", ", branch <label>",
    "connection deleted" (FR-023).
- **Rationale**: every rule in FR-010–FR-018 and FR-023 is a function of `analyzeFlow` output plus
  two ids, so it is unit-testable without a canvas. Numbers stay derived (006 FR-038); nothing
  recomputes paths outside `analyzeFlow` (apps/app `CLAUDE.md`).
- **Alternatives considered**: computing in components (untestable, duplicated between player,
  canvas and inspector); a model helper (playback is presentation, not document logic).

## R3. Dimming, highlight and the current step on the canvas

- **Decision**: follow the project skill's visual-mode recipe.
  - `flowOverlay` gains a `playback` input `{ played: ReadonlySet<stepId>, currentStepId, speed }`
    (or `null` outside flow mode). It then adds to `EdgeFlowMark`: `inPath: boolean` (a played
    step travels the edge) and `current: { speed } | null`; and to `NodeFlowMark` (now all fields
    optional): `inPath: boolean` and `currentStep: boolean` (from/to of the current step). Edges of
    unplayed alternatives keep their badges and styles but `inPath: false`.
  - `toFlowNodes` / `toFlowEdges` set `className: 'in-flow'` on members and add the new fields to
    their cache checks (`sameMark` and the node check).
  - The canvas wrapper gets `data-flow-mode` in flow mode; CSS in `index.css` dims
    `.react-flow__node:not(.in-flow)`, `.react-flow__edge:not(.in-flow)` and edge labels without
    `data-in-flow` to opacity 0.2 with `transition: opacity var(--sd-dur-dim)` (0 ms under reduced
    motion from the token). Group boundaries are nodes, so they dim too.
  - `DeckEdge`: `current` → stroke width 3 and a solid primary label pill (filled, not outlined);
    error-path current keeps its dash. `DeckNode`: `currentStep` → the existing selection ring
    style (ring + halo) with `aria-current="step"` on the node's accessible element.
- **Rationale**: marking only the ≤ ~60 members and dimming by one attribute keeps the < 100 ms
  highlight (constitution V; 006 measured the badge path the same way). Non-color cues: dim is
  opacity _plus_ the step numbers on members; current is width + filled label + node ring
  (constitution VII, FR-005/006).
- **Alternatives considered**: a `dimmed` flag on every node and edge (invalidates all 1,500
  cached objects per open: the skill documents this breaks the target); an SVG mask layer (does
  not dim HTML labels and nodes).

## R4. Branch choice

- **Decision**: `alternativeId` in `activeFlow`, `null` meaning "the first alternative". The player
  renders `BranchPicker` (a `SegmentedControl`, one item per `analysis.branches`, error items with
  `CircleAlert` + sr text "error path") only when `playerView.showPicker`. ↑ / ↓ call
  `setAlternative(previous/next)` under the same condition. Switching re-homes the current step
  (R2 `rehome`), rebuilds segments and announces. Leaving flow mode forgets it (clarification Q3).
- **Rationale**: matches design 46 and ADR 0008 (one fork, alternatives in `branches` order).
- **Alternatives considered**: remembering the choice per flow (rejected by Q3).

## R5. The token

- **Decision**: `FlowToken` child component inside `DeckEdge`, rendered only when
  `data.flow.current !== null` and the step is not broken: a 5 px circle (primary fill, 2 px
  surface stroke, 10 px halo at 20 %, design-analysis §b) with
  `<animateMotion path={path} dur={`${tokenLoopMs / speed}ms`} repeatCount="indefinite" />`.
  Direction follows the edge (`both`/`none` still travel source → target). Under reduced motion
  (`resolveMotion(true).tokenLoopMs === 0`) it renders a static circle at `labelX, labelY` (the
  path midpoint from `getSmoothStepPath`) and no `<animateMotion>`.
- **Rationale**: SMIL follows re-routed paths because the `path` attribute updates with the edge
  (spec edge case "moved while a token runs"); only one edge runs the hook (skill recipe). SMIL
  `dur` needs a number, not a CSS var (skill note), so the value comes from `resolveMotion`.
- **Alternatives considered**: CSS `offset-path` (weaker Safari support for animating along a
  changing path); a JS `requestAnimationFrame` loop (main-thread work every frame for no gain).

## R6. Autoplay timer and lifecycle

- **Decision**: `usePlayback()` hook, mounted once by the player. While `playing`, it sets one
  `setTimeout(stepMs / speed)` keyed on `[flowId, stepId, speed, playing]`; on fire it advances to
  `next` or, on the last step, sets `playing: false`. Play on the last step first jumps to step 1.
  Cleanup clears the timeout on every dependency change and unmount (exit, deck switch, flow
  deletion unmount the player). A `visibilitychange` listener pauses when `document.hidden`
  (Page Visibility is available in every supported browser; guarded by a `typeof document` check,
  no `features.ts` entry needed since there is no fallback path to choose).
- **Rationale**: one pending timeout at a time can never leak or double-fire; step timing is
  reading time and stays under reduced motion (`resolveMotion` keeps `stepMs`). Tests use Vitest
  fake timers (SC-003: ±100 ms is trivially met by one timeout per step).
- **Alternatives considered**: `setInterval` (drifts across speed changes and needs extra state to
  stop on the last step).

## R7. Keyboard in flow mode

- **Decision**:
  - A document-level `usePlaybackShortcuts()` (in `use-flow-shortcuts.ts`, installed by the editor
    page) handles ← / → / ↑ / ↓ in flow mode when the target is not a text field, not in a dialog,
    and not inside a `role="radiogroup"` or `role="menu"` (the branch picker and menus own their
    arrows). ↑ / ↓ only when the picker shows.
  - `useCanvasKeyDown` returns early for arrows, C, E, Enter in flow mode (no node traversal or
    connect while the canvas is view-only).
  - `useEditorShortcuts`: in flow mode Esc (no popover, dialog or pending delete) calls `exitFlow()`;
    Delete / Backspace do nothing.
  - The player's buttons and segments are ordinary buttons; the step list rows keep 006's buttons.
- **Rationale**: ← / → must work whether focus is on the canvas, the player or the step list
  (FR-011), and never while typing (US1-6). Keeping canvas arrows off avoids two meanings for one
  key.
- **Alternatives considered**: canvas-only keys (arrows would not work from the player or the
  list); capturing arrows everywhere (breaks the radio group and text carets).

## R8. View-only canvas and clicks

- **Decision**: `Canvas` treats flow mode like a session for structure: `nodesDraggable`,
  `nodesConnectable`, `edgesReconnectable` false; `useCanvasHandlers` blocks drops, connects and
  double-click popovers in flow mode. Clicks: `onNodeClick` → `stepForNode`, `onEdgeClick` →
  `stepForEdge`, both only for members (`.in-flow`); dimmed elements and the pane do nothing. The
  UI store's `select()` is not called in flow mode, so `activeFlow` is never cleared by a click.
- **Rationale**: clarification Q2; design 52 shows no handles in flow mode.

## R9. Viewport

- **Decision**: pure helpers in `canvas-geometry.ts`: `boundsOf(deck, nodeIds)` (display positions
  - `NODE_SIZE`) and `rectInView(rect, viewport, size)`. `useFlowViewport()` (in the flow-mode
    canvas code):
  * on `openFlow` (flow id change, not alternative change): `fitBounds(boundsOf(played nodes),
{ padding: 0.2, duration: dimMs })`, clamped by `minZoom` (a path too large is fitted as far as
    possible; then step 1's edge is centred, spec edge case);
  * on current-step change: if the step's two nodes are not in view, `setCenter(midpoint, { zoom:
getZoom(), duration: dimMs })`; otherwise nothing.
  * Runs in `requestAnimationFrame` after the render that applied the overlay (skill note).
- **Rationale**: clarification Q4. Duration 0 under reduced motion via `resolveMotion`.

## R10. Step view in the inspector

- **Decision**: extend 006's `InspectorStep` with a `playback` prop used by `FlowInspector` in flow
  mode: a header "STEP n OF m · <flow>" (m = played path length), from → to `KindTile`s with names,
  the connection protocol chip, then 006's editable TITLE, DESCRIPTION, CONDITION, SLA TARGET, plus
  a read-only RULES section: attached rule titles from `deck.rules[id].title` (or "Missing rule
  <id>" with an icon), "No rules attached" when empty. Broken: "Connection deleted" + icon instead
  of from → to. SLA shows the target text only or "No SLA target" as placeholder text.
- **Rationale**: one step inspector for authoring and playback; 008 replaces only the RULES section
  (its spec already extends `InspectorStep`), so the two features touch the same file at clear
  seams. Coordination: whichever lands second rebases on the other's `InspectorStep`.
- **Alternatives considered**: a separate playback inspector (duplicates the step fields that must
  stay editable per 006 FR-018a).

## R11. JSON panel: the current step

- **Decision**: add `'steps'` to the model's `EntryCollection` so `serializeEntry('steps', step)`
  formats one step object exactly as inside its flow in the file (canonical key order of
  `$defs/Step`, tested against a slice of `serializeDeck`). `selectionView` in flow mode returns
  `{ label: 'Step <n>', fullLabel: 'Step <n>: <flow>', entries: [{ collection: 'steps', value:
step }] }`; in a session or with a branch open it keeps 006's flow entry.
- **Rationale**: FR-022 asks for the step; constitution II forbids the app serializing deck data.
  The design's derived keys (`from`, `to`, `n`) are not file content, so they are not shown: the
  inspector already shows them. No format change, no round-trip change (serialization only).
- **Alternatives considered**: keep showing the whole flow (misses FR-022); build a derived object
  in the app (violates constitution II and would show non-file keys as if they were JSON of the
  deck).

## R12. Syncing with deck changes

- **Decision**: extend `useFlowSync`:
  - flow removed while in flow mode (any origin) → `exitFlow()`-like reset without a last-played
    mark + toast "This flow was deleted";
  - current step removed → the step now at the same index of the played path (or the last), paused;
  - chosen alternative removed → `alternativeId: null` and re-home;
  - flow now empty → `stepId: null`, player disabled.
    Edits from this tab's inspector already flow through the snapshot → overlay (no extra code).
- **Rationale**: FR-026 and the edge cases; the existing listener already reads the document
  itself rather than the snapshot.

## R13. Performance measurement

- **Decision**: add two bench scenarios to the existing flow block, using `__sododeckFlowBench`:
  "open flow → flow mode painted" (dimming + token frame) and "next step → current painted";
  plus a 5 s "playing at 2×" fps sample on the 500 / 1,000 deck. Run `pnpm bench` before and after
  and record both in `bench-before.md` / `bench-after.md`.
- **Rationale**: constitution V and SC-001/SC-002.
