# Tasks: Resize Cards and Route Connectors

**Input**: design documents in `specs/017-resize-edge-routing/`:

- [plan.md](plan.md) and [spec.md](spec.md), clarified on 2026-09-29:
  - Size and route are shared by every view.
  - The middle segment moves freely.
  - Miro-like connector styling goes to backlog 022.
  - Enlarged cards wrap their text at the same font size.
  - The plan corrected four points: the stored size wins at every zoom level, an offset needs opposite sides, the resize keys are ⌘⇧ + arrow, and an out-of-range size is a problem, not a schema error.
- [research.md](research.md) (R1–R16) and [data-model.md](data-model.md).
- [contracts/resize-routing-ui.md](contracts/resize-routing-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module, store and model op.
- Round-trip cases for every model change.
- Component tests (Testing Library) by role and name, as in the [contract](contracts/resize-routing-ui.md).

Write each test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Schema change is additive and optional only**: `Side`, `EdgeRoute`, `Node.size` and `Edge.route`.
  - No version bump (ADR 0002).
  - No `minimum` / `maximum` in the schema, and no new semantic rule (R1).
  - Regenerate with `pnpm schema:generate`, and keep Ajv/Zod parity green.
- **Every document write goes through `DeckEditor`**: `setCardSize`, `setEdgeRoute`, `moveInView`, and `update` for a reconnect. Each gesture, key burst or drawer commit is exactly one undo step. Esc uses `cancelGesture()` (016).
- **The app clamps sizes; the model does not.** `cardSize()` is the only place that turns a node into a box.
- **Automatic routes must stay pixel-identical.** `routedStepPath` with no route equals today's `getSmoothStepPath` output.
- **UI-only state** (readouts, hot side, ghost, bursts) lives in the UI store or handler refs, never in the document.
- **Out of scope**:
  - Line type, waypoints, dash, weight, colour, label position, animated lines and line jumps (022).
  - Free connector ends (§g-44).
  - Resizing groups (done in 016) and stickies.
  - Per-view sizes or routes.
  - A grid.
- **Editing is off** in flow mode, during recording, in the view-only editor, and for cards inside a collapsed group (FR-026). Stored sizes and routes are still drawn.

**Approvals**:

- No new runtime dependency. `NodeResizeControl`, `getSmoothStepPath`, `EdgeLabelRenderer`, `connectionLineComponent` and the reconnect callbacks ship in `@xyflow/react`.
- The schema change was approved by the founder (§g-37).
- **Before T001, confirm with the founder**: the ⌘⇧ + arrow resize keys (R10, which replace the backlog's ⌥⌘ + arrow).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, and no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. Read `packages/schema/CLAUDE.md` first:
  - Property order is the file key order.
  - Every property needs a `description`.
  - No `default` / `format`.
  - The `full.sododeck.json` coverage test.
- **Model**: `packages/model/src/…`, with tests in `packages/model/test/`. Read `packages/model/CLAUDE.md`. `DeckEditor` ops go through `EditContext.transact` with an undo key.
- **App**: `apps/app/src/…`, with tests next to the code.
  - Routing code goes in `apps/app/src/editor/routing/` (new), gesture code in `apps/app/src/editor/editing/`, and action modules in `apps/app/src/editor/actions/`.
  - Read `apps/app/CLAUDE.md` and `.agents/skills/react-flow/SKILL.md`.
- **Shortcuts**:
  - "⌘" is `isMod`. Match keys by `event.code`.
  - Ignore keys in text targets (`isTextTarget`).
  - Labels come from `editor/shell/shortcuts.ts`.
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `test(…): …`, `docs: …`). No AI attribution lines.
- **Parallel session warning**: another session may be working on 020 in the same working tree. Never overwrite `.specify/feature.json`. Commit only files this feature touches.

---

## Phase 1: Setup

- [x] T001 Create branch `017-resize-edge-routing` from the latest `main`, after the 017 docs PR is merged. Run `pnpm install && pnpm test` to confirm a green start.
- [ ] T002 Run `pnpm bench` on the unchanged code and save the table in `specs/017-resize-edge-routing/bench-before.md`.
- [ ] T003 Add a `resized-routed` scenario to `apps/app/bench/perf.bench.ts` (R15, FR-031), enabled with `BENCH_ROUTES=1`:
  - Give every bench node `size` 200 × 72.
  - Give 200 edges a `route`: a mix of `fromSide` / `toSide` and `offset` ±40.
  - Pan and zoom for 2 s, recording fps the same way as the existing pan scenario.
  - Until T006 lands, the scenario logs `TODO(017): not available yet` and records no number.
- [ ] T004 [P] Write ADR `docs/decisions/0019-card-size-and-connector-route.md` in the header format of 0017. It records the R16 points:
  - optional `node.size` / `edge.route`
  - sides plus one middle-segment offset instead of waypoints, and why
  - the offset is relative to the automatic middle, in px
  - the offset is only drawn for opposite sides
  - a stored size wins at every zoom level
  - out-of-range sizes are a 015 problem, not a schema error
  - forward compatibility
  - 022 as the extension point
  - the alternatives from research

---

## Phase 2: Foundational (blocks every story)

**Purpose**: sizes and routes exist in the file and the model, and the canvas draws stored sizes and routes. After this phase, a hand-edited deck with `size` / `route` renders correctly. Nothing can be edited yet.

### Schema

- [x] T005 Write failing cases in `packages/schema/test/fixtures.ts`:
  - a node `size` with `width: 0`;
  - `route.fromSide: "middle"`;
  - `route` with an extra key `points`;
  - `route.offset: "10"`.

  Extend `packages/schema/examples/full.sododeck.json` with one node `size` and one edge `route` that has all three keys (the coverage test needs them).

- [x] T006 Edit `packages/schema/schema/v1.json` (R1, data-model):
  - Add `$defs/Side` and `$defs/EdgeRoute`, with a description on every property that states the default.
  - Add `Node.size` (`$ref: Size`) right after `position`.
  - Add `Edge.route` after `links`.

  Run `pnpm schema:generate`, then `pnpm --filter @sododeck/schema test`. Confirm that T005 is green and that parity holds.

### Model

- [x] T007 [P] Write failing round-trip cases in `packages/model/test/round-trip.test.ts`:
  - a node with and without `size`;
  - an edge with a route of sides only, offset only, all three, and a hand-written `{}`;
  - the key order `…position, size` / `…links, route`;
  - identical text after `serializeDeck`;
  - absent fields stay absent after updating another field (e.g. a title).
- [x] T008 [P] Write failing tests in `packages/model/test/shape.test.ts` (new):
  - `setCardSize` sets, replaces and removes (`null`), is one undo step, joins an open gesture, and rejects `width <= 0`.
  - `setEdgeRoute` merges into an existing route, `null` clears a key, `offset: 0` is dropped, `route` is removed when empty, a `null` patch removes it, and it is one undo step.
  - Two docs synced through updates that change `fromSide` and `offset` concurrently both keep their change.
- [x] T009 Extend `writePatch` in `packages/model/src/ops/patch.ts` to write `size` and `route` per key, as `position` is written. Implement `packages/model/src/ops/shape.ts` (`setCardSize` with undo key `nodes:<id>:size`, `setEdgeRoute` with undo key `edges:<id>:route`). Wire both into `DeckEditor` in `packages/model/src/editor.ts`, and export them from `packages/model/src/index.ts`. T007 and T008 go green.
- [x] T010 [P] Write a failing test in `packages/model/test/frames.test.ts` that `fitGroupFrames(deck, { sizeOf })` sizes each member with `sizeOf`, and that the default without `sizeOf` is unchanged. Implement it in `packages/model/src/geometry.ts`.

### App geometry and rendering of stored values

- [ ] T011 Write failing tests in `apps/app/src/editor/canvas-geometry.test.ts`:
  - `CARD_SIZE_LIMITS`;
  - `cardSize(node, level)`: the stored size clamped to 120 × 44 – 800 × 600, and without it the level size (164 × 50, or 164 × 104 at the component level);
  - `cardBox`;
  - `groupBounds`, `selectionFrame` and `boundsOf` with mixed card sizes;
  - the `groupBounds` cache no longer keyed by one size.

  Implement them in `apps/app/src/editor/canvas-geometry.ts` (R2, R3). `groupBounds` / `selectionFrame` / `boundsOf` take a `level` instead of a size.

- [ ] T012 Update `apps/app/src/editor/deck-to-flow.ts` (+ `deck-to-flow.test.ts`):
  - Node `width` / `height` come from `cardSize`, and the node cache compares them (`:307-323`).
  - The group boxes use the new `groupBounds(deck, level)`.
  - The port pill x uses the anchor's width (`:511`).
  - Tests: a sized node renders at its size at every level, and changing only `size` gives a new node object.
- [ ] T013 [P] Write failing tests in `apps/app/src/editor/routing/route-path.test.ts` (new) for (R6):
  - `resolveSides`: the pinned side wins; otherwise sides are picked by comparing centres, which is equal to today's `facingSides` result for equal-size cards;
  - `middleSegment` for all 16 side pairs;
  - `nearestSide`;
  - `routedStepPath`:
    - with no route, the output equals `getSmoothStepPath({ …, borderRadius: 8 })` exactly;
    - `offset: 60` on a vertical pair moves the middle segment and `labelY` by 60;
    - on a horizontal pair it moves `centerX` / `labelX`;
    - on a perpendicular or same-side pair, the offset is ignored and `segment` is null.
- [ ] T014 Implement `apps/app/src/editor/routing/route-path.ts`. Make `facingSides` in `deck-to-flow.ts` compare box centres, and route every plain edge's `sourceHandle` / `targetHandle` through `resolveSides(fromBox, toBox, edge.route)`. Merged edges and port edges stay automatic (edge case). Add a `deck-to-flow` test: a pinned side sets the handle, and a changed route breaks the edge cache.
- [ ] T015 Switch `apps/app/src/editor/deck-edge.tsx` to `routedStepPath`, passing `data.route`. Add `route` to the `DeckFlowEdge` data in `deck-to-flow.ts`, and point `apps/app/src/editor/merged-edge.tsx` at the shared helper with no route. Add a test in `deck-edge.test.tsx` (new or existing): with an offset, the label pill, the edge anchor and the step badge sit at the shifted `labelX` / `labelY`. The flow token and the focus ring use the same `d` (FR-017).
- [ ] T016 [P] Update `apps/app/src/editor/export/edge-geometry.ts` (+ test): `edgePath(from, to, route?)` uses `routedStepPath`, and `extent` includes the shifted middle segment. Update `apps/app/src/editor/export/scene.ts` (+ `scene.test.ts`) so card rects use `cardSize` and plain edges pass `edge.route`. Resolve the two `TODO(017)` markers.
- [ ] T017 [P] Extend `apps/app/src/state/ui-store.ts` (+ test) with the data-model fields:
  - `canvasGesture` gains `'card-resize' | 'segment' | 'endpoint'`.
  - `resizeReadout` and `endpointHover`.
  - `resetForDeck` clears them.
- [ ] T018 [P] Add the contract ids to the "Editing" section of `apps/app/src/editor/shell/shortcuts.ts` (+ test): `resize-card`, `move-segment`, `move-segment-10`, `reset-route`, `resize-no-snap`, `resize-ratio`, `resize-centre`.
- [ ] T019 Commit, then run `pnpm lint && pnpm typecheck && pnpm test`. The demo deck must look unchanged. Import `full.sododeck.json` and check the sized card and the routed edge by eye.

**Checkpoint**: stored sizes and routes render on the canvas and in export. The stories can start.

---

## Phase 3: User Story 1 — Resize a card (P1) 🎯 MVP

**Goal**: a single selected card can be resized with 8 handles, and everything that measures cards uses the real size.

**Independent Test**: spec US1. Drag the handles with and without ⇧ / ⌥ / ⌘, check the readout, the JSON, one-step undo, Esc, the limits, and double-click reset.

### Tests

- [ ] T020 [P] [US1] Write failing tests in `apps/app/src/editor/editing/resize-limits.test.ts` for the new `resizeBox` (R4):
  - all 8 handles;
  - absolute sizes rounded to multiples of 4 (164 + 80 → 244, 50 + 30 → 80);
  - min 120 × 44 and max 800 × 600;
  - ⇧ keeps the start ratio until a limit, then both stop;
  - ⌥ from the centre;
  - resizing from the top or left moves x / y;
  - the existing group-frame cases (content minimum, `MIN_FRAME`) still pass through `resizeFrame`.
- [ ] T021 [P] [US1] Write failing tests in `apps/app/src/editor/editing/snap.test.ts` for `snapEdges(box, handle, candidates, threshold)`:
  - only the dragged edges snap, within 6 screen px;
  - the nearest line wins;
  - the guides are returned;
  - an empty candidate list means no change.
- [ ] T022 [P] [US1] Write failing tests in `apps/app/src/editor/card-text.test.ts` for `textLines(size, level)`: 44 px tall gives 1 title line; 80 px tall gives 2 title lines and 1 subtitle line; the compact and full layouts differ; there is never less than 1 line.
- [ ] T023 [P] [US1] Write failing tests in `apps/app/src/editor/editing/card-resize.test.ts` with a real `DeckEditor`:
  - start, several apply calls and end give one undo step with the final size;
  - from the top-left, the position is written through `moveInView` in the same step, and in a non-base view only that view's position changes;
  - cancel restores the size and position and leaves no undo entry;
  - the readout is set during the gesture and cleared at the end;
  - it announces "Resized API Gateway to 244 × 80" at the end.

### Implementation

- [ ] T024 [US1] Refactor `apps/app/src/editor/editing/resize-limits.ts` into `resizeBox` plus the card limits. Keep `resizeFrame` / `clampFrame` as thin wrappers, so 016's callers are unchanged. Add `snapEdges` to `apps/app/src/editor/editing/snap.ts`. T020 and T021 go green.
- [ ] T025 [US1] Implement `apps/app/src/editor/editing/card-resize.ts`, following `frame-resize.ts`:
  - `startCardResize`: `beginGesture`, `setCanvasGesture('card-resize')`, `setActiveGesture({ cancel })`, and on-screen snap candidates collected once.
  - `applyCardResize`: `resizeBox`, then `snapEdges` unless ⌘ is held, then `setCardSize` and `moveInView` when x / y change, then `resizeReadout`.
  - `endCardResize`: `endGesture` and the announcement.
- [ ] T026 [US1] Add eight `NodeResizeControl`s to `apps/app/src/editor/deck-node.tsx`, with the `.sd-resize-handle` class and pointer only. Render them only when the card is the single selected object and editing is allowed (not flow mode, recording, view-only, or inside a collapsed group). Wire them to T025. Double-click on a handle runs `node.resetSize` (T030). Mark the active handle filled through a `data-active` attribute. Styles go in `apps/app/src/index.css`, next to the 016 handle rules, using tokens only.
- [ ] T027 [US1] Render the `W × H` readout pill from `resizeReadout` in `apps/app/src/editor/editing/guides-overlay.tsx`, next to the dragged corner. Reuse the offset readout style, and show snap guides the same way as for drags.
- [ ] T028 [US1] Apply `textLines` in `apps/app/src/editor/deck-node.tsx`: `-webkit-line-clamp` on the title and subtitle, same font size, the full text kept in `title` (FR-008). Add a component test in `deck-node.test.tsx`: a sized card renders the title with the computed clamp, and the tooltip holds the full title.
- [ ] T029 [US1] Switch every fixed-size call site to `cardSize` / `cardBox` (R3, plan list). Update the listed tests to use sized fixtures where relevant. The call sites:
  - `editor/visible-graph.ts` (`scopeBounds`)
  - `editor/open-deck.ts` (`fitMissingFrames` with `sizeOf: n => node.size ?? COMPONENT_CARD_SIZE`)
  - `editor/tidy-layout.ts` (the ELK request sizes and `fitGroupFrames` `sizeOf`)
  - `editor/editing/group-from-selection.ts`, `frame-resize.ts` (`frameContent`), `use-nudge.ts`, `drag-session.ts` (candidates, moving boxes, `anchorCentre`), `guides-overlay.tsx` and `clipboard-ops.ts`
  - `editor/inspector/frame-fields.tsx`
  - `editor/actions/align-actions.ts` (`selectedRects`)
  - `editor/command-palette/open-result.ts`, `editor/problems/go-to-problem.ts` and `editor/use-canvas-shortcuts.ts` (edge centring from both cards' centres; arrow navigation)
  - `editor/canvas.tsx` (focus scroll; `tinyCardsSelector` uses the minimum width 120)
  - `editor/stickies/sticky-actions.ts` (`nodeAtPoint`)
  - `editor/flows/use-flow-viewport.ts` through `boundsOf`
- [ ] T030 [US1] Create `apps/app/src/editor/actions/shape-actions.ts` with `node.resetSize`:
  - where: component menu;
  - `disabledReason` "Default size";
  - icon `Scaling`;
  - runs `oneStep` with `setCardSize(id, null)` and announces "Size reset".

  Register it in `apps/app/src/editor/actions/index.ts`. Add tests in `shape-actions.test.ts`: availability, the disabled tooltip, and one undo step.

- [ ] T031 [P] [US1] Update `apps/app/src/storage/deck-summary.ts` so node tuples carry an optional `w, h`, and `apps/app/src/library/deck-thumbnail.tsx` so it draws per-node sizes, with the default when they are absent (R13). Update `deck-summary.test.ts` and the thumbnail test.
- [ ] T032 [US1] Add a component test in `apps/app/src/editor/canvas.test.tsx`:
  - a resized member overhangs its group frame, and the frame is unchanged (FR-010);
  - the 016 frame resize minimum uses the enlarged card;
  - the handles are absent in flow mode and in view-only.

**Checkpoint**: US1 works end to end (quickstart 1–4). Commit.

---

## Phase 4: User Story 2 — Move a connector's middle segment (P1)

**Goal**: a selected connector with opposite sides shows a handle that moves its middle segment freely.

**Independent Test**: spec US2. Drag the handle 60 px, check `route.offset`, the label and badges on the new path, one undo step, Esc, R to reset, and no handle for L / U shapes.

- [ ] T033 [P] [US2] Write failing tests in `apps/app/src/editor/editing/segment-drag.test.ts` with a real `DeckEditor`:
  - moves write `offset` = pointer − automatic middle, and pass over cards with no clamp;
  - 1-D snapping to card centre lines and edges within 6 screen px; ⌘ disables it;
  - end is one undo step;
  - cancel leaves no undo entry;
  - `resetDuringDrag` cancels, then removes `route`, as one undo step;
  - the readout shows the signed offset;
  - it announces "Moved middle segment to +60".
- [ ] T034 [US2] Implement `apps/app/src/editor/editing/segment-drag.ts` (R7): `startSegmentDrag`, `applySegmentDrag`, `endSegmentDrag`, `resetDuringDrag`, using `beginGesture` / `setEdgeRoute` / `endGesture` / `cancelGesture`, `setCanvasGesture('segment')` and `setActiveGesture({ cancel })`. Reuse `dragReadout` for the offset.
- [ ] T035 [US2] Create `apps/app/src/editor/routing/segment-handle.tsx` (+ test):
  - a 10 × 24 handle rotated to the segment axis, rendered through `EdgeLabelRenderer` at the segment midpoint;
  - `role="slider"`, name "Move middle segment", `aria-valuenow` = offset, `aria-orientation`;
  - focusable; arrows move it with the same step rules as ⌥ + arrow (T046);
  - pointer events call T034.

  Render it from `apps/app/src/editor/deck-edge.tsx` only when the edge is the single selection, editing is allowed, and `segment` is not null (FR-012).

- [ ] T036 [US2] In `apps/app/src/editor/deck-edge.tsx`, while `canvasGesture === 'segment'` for this edge, draw the automatic-route ghost: `routedStepPath` without the route, dashed, 40 % opacity, `aria-hidden`. Add a test: the ghost appears only during the gesture.
- [ ] T037 [US2] Handle **R** in `apps/app/src/editor/use-canvas-shortcuts.ts` during a segment gesture only: it calls `resetDuringDrag`. Add a test in `use-canvas-shortcuts.test.ts` that R does nothing outside the gesture.
- [ ] T038 [US2] Add a component test in `apps/app/src/editor/canvas.test.tsx`:
  - a selected connector between stacked cards shows the slider;
  - a perpendicular-sides connector shows none;
  - a flow-highlighted connector with an offset draws its highlight on the shifted path.

**Checkpoint**: US2 works (quickstart 5). Commit.

---

## Phase 5: User Story 3 — Pin a connector end to a side, reset the route (P1)

**Goal**: ends can be dropped on a side of a card to pin it, and Reset route returns the connector to automatic routing.

**Independent Test**: spec US3. Drop each end on each side of its own card, reconnect to another card, press Esc mid-drag, use Reset route from the toolbar, the menu and the drawer.

- [ ] T039 [P] [US3] Write failing tests in `apps/app/src/editor/use-canvas-handlers.test.ts` (new) for `onReconnect` (R12):
  - drop on the same card → only `fromSide` / `toSide` changes, picked by `nearestSide` of the drop point (also for the `body` target);
  - drop on another card → `from` / `to` and that side change, `offset` is cleared, one undo step;
  - a refused connection (`self`, `duplicate`) changes nothing and announces as today;
  - the announcements "Connection now leaves from the top" / "…enters from the left".
- [ ] T040 [US3] Implement it in `apps/app/src/editor/use-canvas-handlers.ts`:
  - `onReconnectStart` sets `setCanvasGesture('endpoint')` and remembers the moving end.
  - `onReconnect` applies the rules above in one `oneStep`.
  - `onReconnectEnd` clears the gesture and `endpointHover`.
  - A pointer move during the gesture updates `endpointHover` with `nearestSide`.
- [ ] T041 [US3] Show the side targets in `apps/app/src/editor/deck-node.tsx`: while `canvasGesture === 'endpoint'`, the hovered card's four handles render as 12 px rings, and the `endpointHover` side is filled and larger (not colour only). Styles go in `apps/app/src/index.css`. Add a test for the hot-side attribute.
- [ ] T042 [US3] Create `apps/app/src/editor/routing/endpoint-connection-line.tsx`, a custom `connectionLineComponent` that draws the live path dashed in primary with `routedStepPath` and the hot side. Pass it in `apps/app/src/editor/canvas.tsx`. The edge being moved gets 40 % opacity through the gesture class, as the ghost.
- [ ] T043 [US3] Add `edge.resetRoute` to `apps/app/src/editor/actions/shape-actions.ts`:
  - where: connection menu and connection toolbar;
  - icon `RotateCcw`;
  - `disabledReason` "Route is automatic";
  - `oneStep` with `setEdgeRoute(id, null)`, announcing "Route reset".

  Add tests: the toolbar button and the menu item are disabled or enabled by the route, and there is one undo step.

- [ ] T044 [US3] Update `apps/app/src/editor/inspector/edge-inspector.tsx`: when the reattach flow changes an end's card, it also clears that end's side and the offset, in the same `writeOnce`. Add a test.

**Checkpoint**: US3 works (quickstart 6). Commit.

---

## Phase 6: User Story 4 — Older decks stay unchanged (P1)

**Goal**: lossless files, and out-of-range sizes that never block opening.

**Independent Test**: spec US4. Round-trip decks with and without the fields, and import a deck with an out-of-range size.

- [ ] T045 [P] [US4] Write a failing test in `packages/model/test/problems.test.ts`: a node with `size` 900 × 40 yields `card-size-out-of-range` with the message from the contract, targeting the component, and in-range sizes yield nothing. Implement it in `packages/model/src/problems.ts` and append the kind to `PROBLEM_KINDS`. Map the kind's label and "open" target in the app's Problems panel if it needs a per-kind entry (`apps/app/src/editor/problems/`).
- [ ] T046 [P] [US4] Add an app-level test in `apps/app/src/storage/library-ops.test.ts`:
  - importing `full.sododeck.json`, editing a title and exporting keeps `size` / `route` unchanged;
  - importing a deck without them and exporting after an edit has neither field;
  - a deck with `size` 900 × 40 imports without an error.

**Checkpoint**: US4 is verified (quickstart 7). Commit.

---

## Phase 7: User Story 5 — Keyboard and drawer (P2)

**Goal**: every resize and route change is possible without a pointer.

**Independent Test**: spec US5. Keyboard only: resize, reset the size, move the segment, set the sides, reset the route. Check the undo steps and announcements.

- [ ] T047 [P] [US5] Generalise the burst in `apps/app/src/editor/editing/use-nudge.ts` into `createBurst(onFirst, onStep, onEnd)` (1 s idle, as `NUDGE_IDLE_MS`). Keep `createNudger` on top of it, and keep its tests green. Add tests for `createBurst`.
- [ ] T048 [US5] In `apps/app/src/editor/use-canvas-shortcuts.ts` (+ test):
  - ⌘⇧ + arrow with one focused or selected component resizes by 4 px (→ / ↓ grow, ← / ↑ shrink), keeping the top-left and the limits, in a burst, announcing "Resized … to W × H" at the end.
  - ⌥(⇧) + arrow with a single selected connection moves the segment by 1 / 10 px across the segment. Arrows along the segment do nothing, and connectors without a segment do nothing.
  - ⌥ + arrow with components keeps 016's nudge.
  - None of this fires in text targets or when editing is off.
- [ ] T049 [P] [US5] Create `apps/app/src/editor/inspector/size-fields.tsx` (+ test), following the `frame-fields.tsx` pattern:
  - a "Size" section with `spinbutton` "Width" / "Height";
  - a draft while typing, commit on Enter or blur, Esc cancels;
  - values clamped and rounded to whole px;
  - one `oneStep` per commit;
  - a "Reset size" button, disabled without a stored size;
  - read-only when editing is off.

  Mount it in `apps/app/src/editor/inspector/node-inspector.tsx`.

- [ ] T050 [P] [US5] Create `apps/app/src/editor/inspector/route-fields.tsx` (+ test):
  - a "Route" section with `combobox` "From side" / "To side" (Auto, Top, Right, Bottom, Left), each change one step through `setEdgeRoute`;
  - a `spinbutton` "Offset", disabled with the description "No middle segment for these sides" when `middleSegment` is null;
  - a "Reset route" button;
  - read-only when editing is off.

  Mount it in `apps/app/src/editor/inspector/edge-inspector.tsx`.

**Checkpoint**: US5 works (quickstart 8). Commit.

---

## Phase 8: User Story 6 — Gesture hints (P3)

**Goal**: the hint bar lists the modifier keys of each new gesture.

**Independent Test**: spec US6. Start each gesture and check the hint text and the one-time announcement.

- [ ] T051 [US6] Add `card-resize`, `segment` and `endpoint` to `HINTS` in `apps/app/src/editor/editing/gesture-hints.ts`, with the contract texts and ⌘ → Ctrl through the `apple` flag. Extend `gesture-hints.test.ts` and the `gesture-hint.tsx` test: each text appears during its gesture, disappears after, and is announced once.

---

## Phase 9: Polish and cross-cutting

- [ ] T052 [P] Update `packages/schema/CLAUDE.md` (`Side`, `EdgeRoute`, `Node.size`, `Edge.route`), `packages/model/CLAUDE.md` (`setCardSize`, `setEdgeRoute`, `writePatch` keys, `fitGroupFrames({ sizeOf })`, the problem kind) and `apps/app/CLAUDE.md` (`cardSize` as the only size source, `editor/routing/`, the new gestures and actions).
- [ ] T053 [P] Update `docs/backlog.md`:
  - Mark 017 as implemented, with links.
  - Replace the 017 design delta "a segment stops 12 px from any card edge" with the clarified free drag.
  - Note in 022 that `routing/route-path.ts` and `EdgeRoute` are the extension points.
- [ ] T054 Accessibility pass:
  - Keyboard-only run of every action.
  - Contrast of the handles, readouts, side targets and ghost against Canvas in both themes; add any new token pair to `packages/ui/test/contrast.test.ts`.
  - The hot side target and the active handle differ by more than colour.
  - No animation under reduced motion.
- [ ] T055 Visual check against screens 100 (Reset route), 112, 113 and 114, light and dark. Take screenshots into `specs/017-resize-edge-routing/screens/` and list the differences in `specs/017-resize-edge-routing/visual-check.md` (SC-008). The expected, allowed differences: no 12 px stop in 113, and no "⌥ Free end" in 114.
- [ ] T056 Run `pnpm bench` and `BENCH_ROUTES=1 pnpm bench` after the change. Save both in `specs/017-resize-edge-routing/bench-after.md` next to `bench-before.md`, and confirm ≥ 60 fps for `resized-routed` and no regression elsewhere (FR-031, SC-006).
- [ ] T057 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and fix anything red. The smoke suite (including the no-third-party-requests check) must pass unchanged.
- [ ] T058 Run the quickstart scenarios 1–10 by hand and record the results in the PR description.

---

## Dependencies and execution order

- **Setup (T001–T004)** comes first. T004 can run in parallel.
- **Foundational (T005–T019)** blocks every story:
  - Schema: T005 → T006.
  - Model: T007–T010, after T006 (T009 after T007 and T008).
  - App: T011 → T012; T013 → T014 → T015; T016 after T011 and T014.
  - T017 and T018 can run in parallel at any time.
- **US1 (T020–T032)** depends on Foundational. It is the MVP. T029 is the largest task; do it right after T025 so that the resize is measured correctly everywhere.
- **US2 (T033–T038)** depends on Foundational (T014, T015, T017). It is independent of US1.
- **US3 (T039–T044)** depends on Foundational. T043 extends `shape-actions.ts` from T030 (US1). If US3 runs first, T043 creates that file.
- **US4 (T045–T046)** depends on Foundational only. It can run any time after T009.
- **US5 (T047–T050)** depends on T025 (US1) for the size keys, and T034 (US2) for the segment keys. T049 and T050 depend only on Foundational and the actions.
- **US6 (T051)** depends on T017.
- **Polish (T052–T058)** comes last.

Story order is US1 → US2 → US3 → US4 → US5 → US6. US2 and US4 can run in parallel with US1.

## Parallel examples

- **Foundational**: T007, T008 and T010 (separate model test files), together with T013, T017 and T018.
- **US1**: T020, T021, T022 and T023 (separate test files), then T031 alongside T025–T028.
- **US2 + US4**: T033 and T045 in parallel with US1's implementation.
- **US5**: T049 and T050 (separate inspector files).

## Implementation strategy

1. **MVP**: Setup, then Foundational, then US1 and US4. Cards can be resized, sizes are respected everywhere, and files stay lossless. Stored routes already render. This is a shippable PR if the scope has to be split.
2. **Increment 2**: US2 + US3. Connectors can be adjusted and reset.
3. **Increment 3**: US5 + US6. Keyboard, drawer and hints.
4. **Polish**: docs, accessibility, the visual check, the bench, and the full definition of done.

Each increment ends with a green `pnpm lint && pnpm typecheck && pnpm test`, and the last one with the full definition-of-done set and the bench numbers.
