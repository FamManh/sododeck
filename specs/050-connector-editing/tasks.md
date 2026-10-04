# Tasks: Connector editing

**Input**: design documents in `specs/050-connector-editing/`:

- [plan.md](plan.md) and [spec.md](spec.md), with 4 clarifications (centre zone 40 % with a 24 px margin, keep weight stops, groups as ends in scope, midpoint-only snap and spread ends for many-ended cards).
- [research.md](research.md), with the root-cause table and R1–R12, and [data-model.md](data-model.md).
- [contracts/connector-editing-api.md](contracts/connector-editing-api.md) and [contracts/connector-editing-ui.md](contracts/connector-editing-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Vitest for every pure module and model change, with a round-trip case for each model change.
- Testing Library for components, by role and name.
- **Bug fixes start with a failing test.** Write each test first and watch it fail.
- No new Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Previews are UI-only; one write per gesture.** No Yjs write during a drag. A click below 4 screen px writes nothing.
- **One route model.** Segment drag, spread ends and nudge write only 022 data (`fromSide/fromAt/toSide/toAt/waypoints`). There is no new route field.
- **Weight stops stay 1 / 1.5 / 2 / 3 / 4** and stored values don't change.
- **Files without group edges round-trip byte-identically.** No version bump (ADR 0030).
- **Out of scope:** connector type changes, a text-diagram export (none exists), obstacle-avoiding routing, new e2e tests.
- Do not name other diagram or whiteboard tools anywhere: docs, code, comments, UI copy.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. Read `packages/schema/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`. Read `packages/model/CLAUDE.md` first.
- **App**: `apps/app/src/…`, tests next to the code. Read `apps/app/CLAUDE.md` first, and use the `react-flow` skill for every canvas change (`deck-edge.tsx`, `deck-to-flow.ts`, `routing/`, `editing/`, `canvas.tsx`, `use-canvas-handlers.ts`).
- **Commits**: small Conventional Commits (`fix(app): …`, `feat(model): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 On branch `050-connector-editing`, rebase on the latest `main`. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start.
- [x] T002 Take the bench baseline on unchanged code with `pnpm bench`. Save the summary table in `specs/050-connector-editing/bench-before.md`.

---

## Phase 2: Foundational (drag helper, handle layer, gesture registry)

**Purpose**: the shared pieces that US1, US2, US3, US5 and US6 all rely on. Nothing visible changes yet.

- [x] T003 [P] Write failing tests in `apps/app/src/editor/editing/pointer-drag.test.ts` per the API contract:
  - no `onStart` / `onMove` below 4 screen px;
  - `onEnd(…, false)` for a click;
  - `onMove` keeps firing after the pressed element is removed from the DOM;
  - `onCancel` exactly once on `pointercancel`, window `blur` and `cancel()`;
  - every listener is removed on each exit;
  - moves are rAF-throttled (use fake timers / a mocked `requestAnimationFrame`).
- [x] T004 Implement `apps/app/src/editor/editing/pointer-drag.ts`:
  - `DRAG_THRESHOLD = 4`;
  - `startPointerDrag(event, handlers)` with window `pointermove/pointerup/pointercancel/blur` listeners, best-effort `setPointerCapture`, the threshold measured in screen px, rAF-throttled moves, and a single `finish()`.
  - Make T003 pass.
- [x] T005 [P] Write a failing test in `apps/app/src/editor/editing/drag-session.test.ts`: `hasActiveGesture()` is true between `setActiveGesture(x)` and `setActiveGesture(null)`, and false after `DragController` ends. Then add the export `hasActiveGesture()` to `apps/app/src/editor/editing/drag-session.ts`.
- [x] T006 Add a CSS rule in `apps/app/src/index.css` that gives `.react-flow__viewport-portal` a z-index above `.react-flow__nodes`, with `pointer-events: none` on the portal and `pointer-events: auto` on `.sd-route-handle`. Check that `selection-frame.tsx` and `guides-overlay.tsx`, which already use the portal, look unchanged.

**Checkpoint**: the suite is green, and no behaviour has changed.

---

## Phase 3: User Story 1 - Grab and drag any handle of the selected connector (P1) 🎯 MVP

**Goal**: every handle of the selected connector can be grabbed, even under or inside a card, and keeps following the pointer until release.

**Independent Test**: quickstart 1–3.

- [x] T007 [P] [US1] Write failing tests in `apps/app/src/editor/routing/route-handles.test.tsx`:
  - a midpoint drag across 3 re-renders keeps updating `bendPreview` (this reproduces the unmount bug);
  - press and release under 4 px on a midpoint writes nothing and leaves no undo step;
  - midpoint handles are absent on runs shorter than 24 screen px (FR-004);
  - handles render inside `.react-flow__viewport-portal`;
  - Esc mid-drag restores the shape without a write;
  - `pointercancel` clears `bendPreview`, guides and `canvasGesture`.
- [x] T008 [US1] Rewrite pointer handling in `apps/app/src/editor/routing/route-handles.tsx`:
  - portal through `ViewportPortal` instead of `EdgeLabelRenderer`;
  - drive midpoint and bend drags through `startPointerDrag`, calling `startBendDrag` only in `onStart`, so a click adds nothing;
  - keep the other midpoint buttons mounted during a drag, but `aria-hidden` and inert;
  - hide midpoint handles on runs under 24 screen px (use `getZoom()`).
- [x] T009 [US1] Update `apps/app/src/editor/editing/bend-drag.ts` so that `clearGesture()` runs from every exit: `endBendDrag`, `cancelBendDrag`, and the pointer-drag `onCancel`. Make T007 pass.
- [x] T010 [P] [US1] Move `apps/app/src/editor/routing/label-handle.tsx` to `ViewportPortal` and `startPointerDrag`. Update `label-handle.test.tsx` so the label drag keeps working over a card and a click doesn't move it.

**Checkpoint**: quickstart 1–3 pass. Bends and midpoints are reliable.

---

## Phase 4: User Story 2 - Slide a connector end smoothly along a card (P1)

**Goal**: connector ends glide along the outline with a midpoint-only snap, never jump, and reconnect to other targets. This replaces React Flow's reconnect.

**Independent Test**: quickstart 4–8.

- [x] T011 [P] [US2] Write failing tests in `apps/app/src/editor/routing/outline-attach.test.ts`:
  - nearest point on each side of a rectangle;
  - continuity round all four corners: a pointer step of d moves the point by ≤ d + snap;
  - `at` snaps only to 0.5, within 6 screen px, scaled by zoom;
  - `mod` turns snapping off;
  - sides shorter than 18 px don't snap;
  - centre zone: `automatic` only with `allowAutomatic`, inside the middle 40 %, and only when the zone keeps a 24 px margin (true on 240×100, never on 60×40);
  - shapes (diamond, ellipse from `shapes/shape-geometry.ts`) put the point on the outline;
  - `nudgeAnchor` moves ±0.01 and carries round corners.
- [x] T012 [US2] Implement `apps/app/src/editor/routing/outline-attach.ts`:
  - `MIDPOINT_SNAP`, `CENTRE_ZONE`, `CENTRE_MARGIN`;
  - `attachToOutline`: exact rectangle projection; for shapes, 48 samples per side through `outlinePoint`, then refine;
  - `nudgeAnchor`.
  - Make T011 pass.
- [x] T013 [P] [US2] Write failing tests in `apps/app/src/editor/routing/endpoint-target.test.ts`:
  - the topmost card in paint order wins;
  - 16 screen px reach, scaled by zoom;
  - a card over a group wins;
  - the innermost of nested groups wins;
  - inside a group frame but not on a card returns the group;
  - near the frame edge from outside returns the group;
  - hidden and out-of-scope objects are never returned;
  - collapsed-group cards return `kind: 'group'` with the collapsed box.
- [x] T014 [US2] Implement `apps/app/src/editor/routing/endpoint-target.ts`:
  - `TargetScene` built from the drawn flow nodes (card boxes, `group:` frame rects, `collapsed:` cards, plus shape geometry);
  - `hitTarget(point, scene, zoom)`.
  - Make T013 pass. Group targets stay disabled for writing until US4 (T030), but are already returned here.
- [x] T015 [P] [US2] Write failing tests in `apps/app/src/editor/editing/endpoint-drag.test.ts` with a real `DeckEditor`:
  - press without move writes nothing (FR-007);
  - the pointer offset is kept, so a drag by (dx, dy) moves the attachment from the original end, not from the pointer;
  - sliding on the same card writes `toSide/toAt` once (one undo step);
  - dropping in the centre zone clears `toSide` ("End back to automatic");
  - releasing off every target writes nothing and announces "Not connected: drop on a card or group";
  - dropping on another card writes `to` plus `toSide/toAt` in one undo step;
  - `self` / `duplicate` refusals write nothing and announce the refusal;
  - Esc and blur clear `endpointPreview`.
- [x] T016 [US2] Implement `apps/app/src/editor/editing/endpoint-drag.ts`: `startEndpointDrag`, `moveEndpoint`, `endEndpointDrag`, `cancelEndpointDrag`, writing `endpointPreview` and `connectorReadout`. The readout reads "right side · 37 %", "… · snapped", "automatic" or "→ {title}". Register with `setActiveGesture`. Make T015 pass.
- [x] T017 [US2] In `apps/app/src/state/ui-store.ts`:
  - add `endpointPreview` with its setter and reset;
  - remove `endpointHover`, `endpointAnchor` and `reconnectingEdgeId`;
  - update every reader. Grep for them in `routing/endpoint-connection-line.tsx`, `component-node-parts.tsx` (hot side), `deck-edge.tsx` and tests.
- [x] T018 [US2] Make the end buttons in `apps/app/src/editor/routing/route-handles.tsx` real handles:
  - draw them at `context.start` / `context.end`;
  - set `pointerEvents: auto`;
  - drag via `startPointerDrag` into `startEndpointDrag`.
  - Add Shift + arrow (`nudgeAnchor`, one undo step per press) to `endKeys`, keeping plain arrows on `stepAnchor`.
  - Extend `route-handles.test.tsx`: the end drags while it sits under a card; Shift + → moves 1 %.
- [x] T019 [US2] In `apps/app/src/editor/deck-edge.tsx`:
  - read `endpointPreview` with a per-edge selector;
  - when it is set, draw the connector with that end overridden (side/at, or a new target box) in its own `shape`, and draw the pre-drag route as the 022 ghost;
  - remove the `reconnecting` class and logic.
- [x] T020 [US2] Remove React Flow reconnect:
  - in `apps/app/src/editor/canvas.tsx`: `edgesReconnectable={false}`;
  - in `apps/app/src/editor/use-canvas-handlers.ts`: delete `onReconnectStart`, `onReconnectEnd`, `onReconnect`, `reconnectEnd`, `endpointMoveHandler`;
  - in `apps/app/src/index.css`: delete the `.react-flow__edgeupdater` and `.sd-edge-reconnecting` rules;
  - in `apps/app/src/editor/editing/anchor-drag.ts`: delete `anchorFromPoint`, `BODY_DEPTH` and `ANCHOR_SNAP` (keep `ANCHOR_STOPS`, `stepAnchor` and `anchorReadout`), and update `anchor-drag.test.ts`.
- [x] T021 [US2] Make `apps/app/src/editor/routing/endpoint-connection-line.tsx` (new connections only) use `hitTarget` + `attachToOutline` through the existing connect gesture. Add `onConnectEnd` in `use-canvas-handlers.ts` so dropping on a target that isn't a handle creates the edge through `connectComponents`, with the drop side and `at` pinned. Keep `onConnect` for handle drops. Update `endpoint-connection-line.test.tsx`.

**Checkpoint**: quickstart 4–8 pass. The founder's jumping issue is gone.

---

## Phase 5: User Story 4 - Connect cards and groups (P1)

**Goal**: card→group, group→card and group→group connectors work everywhere edges do.

**Independent Test**: quickstart 10–14.

### Schema and model

- [x] T022 [P] [US4] In `packages/schema/schema/v1.json`, change the descriptions of root `edges`, `Edge`, `Edge.from` and `Edge.to` to "node or group". The S9–S11 wording in `packages/schema/src/semantic-rules.ts` becomes "card or group". Run `pnpm schema:generate`. Add a valid group-edge deck to `packages/schema/test/fixtures.ts` and an edge `"from": "<group id>"` to `packages/schema/examples/full.sododeck.json`. Parity test green.
- [x] T023 [P] [US4] Write failing model tests:
  - `packages/model/test/integrity.test.ts`: group ends are accepted; an unknown id is still broken; a node/group id collision gives `duplicate-id`.
  - `cascade.test.ts`: `removeGroup` removes its edges in one undo step, and `previewRemoval` lists them.
  - `fragment.test.ts` and `paste.test.ts`: group-ended edges are kept and remapped.
  - `problems.test.ts` and `search.test.ts`: titles come from the group.
  - `round-trip.test.ts`: card→group, group→card and group→group with route and style, plus an old file byte-identical.
  - A rename of a group keeps its edges (Principle III).
- [x] T024 [US4] Add `packages/model/src/endpoint.ts` (`endpointOf`, exported from the package index). Then:
  - `src/ops/refs.ts` and `src/validate.ts`: add the `'nodes|groups'` ref target.
  - `src/integrity.ts`: check ends against both, plus the id-collision check (in `src/load-checks.ts` too).
  - `src/problems.ts` and `src/search/index.ts`: use `endpointOf`.
  - Make the integrity, problems and search tests pass.
- [x] T025 [US4] Delete group edges in `packages/model/src/ops/cascade.ts` (`removeGroup`, `previewRemoval`), and keep and remap them in `packages/model/src/fragment.ts` and `src/ops/paste.ts`. Make the remaining T023 tests pass. Update `packages/model/CLAUDE.md` (edge ends, cascade).

### App

- [x] T026 [P] [US4] Write failing tests in `apps/app/src/editor/connection-rules.test.ts`:
  - `'contains'` for a group ↔ a member card, a nested group, or a card two levels down, in either direction;
  - duplicate and self rules for groups;
  - `connectTargets` lists groups with kind `group`.
- [x] T027 [US4] Implement this in `apps/app/src/editor/connection-rules.ts`, add the refusal text "Can't connect a group to something inside it" to the existing refusal map, and make T026 pass.
- [x] T028 [P] [US4] Write failing tests in `apps/app/src/editor/visible-graph.test.ts` and `deck-to-flow.test.ts`:
  - an edge to a shown group maps to `group:<id>` with the frame box;
  - to a collapsed group, it maps to `collapsed:<id>`;
  - out of the drill scope, it maps to the ancestor's representative or a port;
  - an edge between a group and its own member is drawn (file-level allowed).
- [x] T029 [US4] Implement group representatives in `apps/app/src/editor/visible-graph.ts`, `group:` boxes and geometry in `deck-to-flow.ts` (`boxFor`, `endGeometry`, `toFlowEdges`), and the follow-ups in `bundles.ts`, `focus-set.ts` and `proxy-layout.ts`. Make T028 pass.
- [x] T030 [US4] In `apps/app/src/editor/group-boundary-node.tsx`:
  - add four hidden `<Handle>`s, which React Flow needs to draw edges;
  - add a label connect handle: `button` "Connect from {title}", which starts a new connection on drag and opens `connect-popover.tsx` on ⏎.
  - Enable group targets in `endpoint-drag.ts` and `onConnectEnd`.
  - Extend `group-boundary-node.test.tsx` and `endpoint-drag.test.ts`: reconnect to a group, `'contains'` refused.
- [ ] T031 [P] [US4] List groups (with the group icon and "(group)") in `apps/app/src/editor/connect-popover.tsx` and in `inspector/edge-inspector.tsx` (`nodeOptions` → endpoint options). Count group connectors in `describe-removal.ts`. Use `endpointOf` for labels in `json-panel-view.ts`, `edge-popover.tsx`, `quick-edit/selection-toolbar.tsx`, `command-palette/palette-results.ts`, `command-palette/open-result.ts` and the `use-canvas-shortcuts.ts` `f`/`e` paths. Update their tests.
- [ ] T032 [P] [US4] Flows:
  - `flows/candidate-edges.ts`, `flows/use-flow-viewport.ts` and `canvas-geometry.ts` `boundsOf` accept group ends and frame boxes;
  - `view-filter.ts` stops treating `edge.from/to` as node-only.
  - Add tests: record a step through a group edge and play it; into G then out of a member of G is reported as a break.
- [ ] T033 [P] [US4] Export and layout:
  - `apps/app/src/editor/export/scene.ts`: add group frame rects to `rects` so `sceneEdges` draws group edges;
  - `layout/tidy-layout.ts` and `layout/elk-layout.ts`: include group ids in the endpoint set.
  - Add a test for each.
- [ ] T034 [US4] Write `docs/decisions/0030-groups-as-connector-ends.md`. It covers the widening, why there is no version bump, older builds showing a broken reference, the cascade, the `'contains'` rule and the flow continuity limit. Update the "edges" wording in `docs/spec.md`.

**Checkpoint**: quickstart 10–14 pass.

---

## Phase 6: User Story 3 - See and set the weight (P2)

**Goal**: a selected connector shows its real weight, and the weight control is a draggable slider.

**Independent Test**: quickstart 9.

- [ ] T035 [P] [US3] Write failing tests:
  - `apps/app/src/editor/deck-edge.test.tsx`: a selected edge with `style.width: 4` has stroke width 4 and an `edge-selection-halo`.
  - `apps/app/src/editor/line-style/line-style-popover.test.tsx`: a pointer drag on the slider track from the 1 to the 4 position sets `lineStylePreview` at each stop, writes once on release (one undo step), and Esc mid-drag writes nothing. A click on the track picks the nearest stop. Keys are unchanged. Several selected connectors take the value in one undo step.
- [ ] T036 [US3] In `apps/app/src/editor/deck-edge.tsx`:
  - replace `selected ? 2.5` with the connector's own width;
  - add the halo path under the line (`var(--color-primary-soft)`, width + 6, `pointerEvents="none"`, `data-testid="edge-selection-halo"`);
  - read `lineStylePreview` with a per-edge selector before the stored width.
  - Add `lineStylePreview` to `apps/app/src/state/ui-store.ts`.
- [ ] T037 [US3] Make `WeightSlider` in `apps/app/src/editor/line-style/line-style-controls.tsx` pointer-draggable via `startPointerDrag` (track x maps to the nearest of `WIDTHS`). Preview on move, `applyLineStyle` once on release, Esc cancels. Make T035 pass.

**Checkpoint**: quickstart 9 passes.

---

## Phase 7: User Story 6 - Guides always disappear (P2)

**Goal**: no alignment guide stays on screen after any gesture.

**Independent Test**: quickstart 16.

- [x] T038 [P] [US6] Write failing tests:
  - `apps/app/src/editor/editing/guides-overlay.test.tsx`: guide lines carry `data-testid="snap-guide"`, and none render when no gesture is registered even if `guides` is non-empty.
  - `apps/app/src/editor/canvas.test.tsx` (or a new `use-guide-safety-net.test.ts`): window `pointerup` / `pointercancel` / `blur` / `visibilitychange` with no active gesture clear `guides`, `bendPreview`, `endpointPreview`, `connectorReadout`, `resizeReadout` and a stale `canvasGesture`, and do nothing while a gesture is active.
  - `apps/app/src/editor/editing/drag-session.test.ts`: `DragController` clears guides on window blur, and when `apply()` throws.
  - `apps/app/src/editor/component-node-parts.test.tsx`: unmounting mid-resize cancels it and clears guides.
- [x] T039 [US6] Implement:
  - the render guard and testid in `apps/app/src/editor/editing/guides-overlay.tsx`;
  - a `use-guide-safety-net.ts` hook used by `canvas.tsx` (microtask check of `hasActiveGesture()`);
  - blur handling and try/finally in `editing/drag-session.ts`;
  - an unmount cleanup calling the card-resize cancel in `component-node-parts.tsx`.
  - Make T038 pass.

**Checkpoint**: quickstart 16 passes.

---

## Phase 8: User Story 5 - Drag a whole elbow segment (P3)

**Goal**: elbow runs move as a whole, perpendicular to their direction.

**Independent Test**: quickstart 15.

- [x] T040 [P] [US5] Write failing tests in `apps/app/src/editor/routing/elbow-runs.test.ts`:
  - runs from `elbowVertices` output, with the exact axis;
  - `kind` is start / inner / end;
  - runs under 24 screen px are omitted at zooms 0.5, 1 and 2.
- [x] T041 [US5] Implement `apps/app/src/editor/routing/elbow-runs.ts` (`elbowRuns`). Make T040 pass.
- [x] T042 [P] [US5] Write failing tests in `apps/app/src/editor/editing/segment-drag.test.ts`:
  - an inner run moves both bends on one axis only;
  - a start or end run changes only `fromAt` / `toAt` (side pinned, clamped to 0–1);
  - an automatic elbow is materialised into bends on drag start (022 rule: `offset` removed, `elbow` pinned);
  - snapping to neighbour lines and the 22 px grid, with ⌘ off;
  - release simplifies and writes once;
  - `resetSegment` drops that run's bends, or clears `at`;
  - Esc writes nothing.
- [x] T043 [US5] Implement `apps/app/src/editor/editing/segment-drag.ts`, reusing `snapBend`, `simplifyWaypoints` and `encodeWaypoint` from `routing/connector-geometry.ts`. Add `canvasGesture: 'segment'` to `state/ui-store.ts`. Make T042 pass.
- [ ] T044 [US5] In `apps/app/src/editor/routing/route-handles.tsx`, render segment handles instead of midpoints on elbow connectors: `button` "Move segment N", drag via `startPointerDrag`, double-click resets, arrows move 22 px on its axis (Shift 1 px), ⌫ resets. Extend `route-handles.test.tsx`. Add the segment handle look to `index.css` (a short pill on the run, tokens only).

**Checkpoint**: quickstart 15 passes.

---

## Phase 9: User Story 7 - Spread ends evenly on a card (P3)

**Goal**: one action spaces out the connector ends on each side of the selected cards.

**Independent Test**: quickstart 17.

- [x] T045 [P] [US7] Write failing tests in `apps/app/src/editor/editing/spread-ends.test.ts`:
  - 10 ends on one side give `at = (i+1)/11`, ordered by the other end's y;
  - ties are broken by edge id;
  - automatic ends are included at their resolved side;
  - sides with < 2 ends are skipped;
  - self-loops count both ends;
  - hidden connectors are skipped;
  - group ends work (US4);
  - same input gives the same output.
- [x] T046 [US7] Implement `apps/app/src/editor/editing/spread-ends.ts` (`spreadEnds`). Make T045 pass.
- [ ] T047 [US7] Add the action `node.spreadEnds` to `apps/app/src/editor/actions/connection-actions.ts` (`where: { menu: ['node'], toolbar: ['node'] }`, label "Spread ends evenly", `disabledReason` "No side has two or more connector ends"). `run` writes every patch in one `oneStep` and announces "Spread N ends on M sides". Add a palette command "Spread connector ends evenly" (alias "distribute ends") in `apps/app/src/editor/command-palette/commands.ts`. Extend `connection-actions.test.ts` and the palette tests.

**Checkpoint**: quickstart 17 passes.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T048 [P] In `DESIGN.md` Connectors, document the selection halo, handles above cards, the segment handle, the midpoint-only snap and the centre zone. Update `apps/app/CLAUDE.md` (pointer-drag helper, no React Flow reconnect) and `packages/model/CLAUDE.md` if T025 hasn't already.
- [ ] T049 Run `pnpm bench` and save the result in `specs/050-connector-editing/bench-after.md` with the before/after table. It must be within 5 % (SC-008).
- [ ] T050 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix anything red, and update the smoke test only if a change broke it.
- [ ] T051 Walk through [quickstart.md](quickstart.md) scenarios 1–17 in `pnpm dev`. Record the results and screenshots (1, 5, 9, 10, 15, 17) in `specs/050-connector-editing/quickstart-results.md`.
- [ ] T052 Open the PR to `main`. In the report, list what changed, what was skipped and what is uncertain, including the flow continuity limit and older builds versus group edges.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** comes first. The bench baseline must be taken before any code change.
- **Foundational (T003–T006)** blocks US1, US2, US3, US5 and US6.
- **US1 (T007–T010)**: after Foundational.
- **US2 (T011–T021)**: after US1 (it shares `route-handles.tsx`).
- **US4 (T022–T034)**:
  - schema and model (T022–T025) can start right after Setup, in parallel with US1 and US2;
  - app tasks T026–T029 and T031–T033 are independent;
  - T030 needs US2 (T014–T016, T021).
- **US3 (T035–T037)**: after Foundational, independent of the others.
- **US6 (T038–T039)**: after Foundational (T005), independent.
- **US5 (T040–T044)**: after US1. T044 touches `route-handles.tsx`, so do it after US2.
- **US7 (T045–T047)**: independent of the others. The group-end test case needs US4 (T029).
- **Polish (T048–T052)**: last.

### Parallel opportunities

- After T006: T007 (US1), T035 (US3), T038 (US6) and T022/T023 (US4 schema and model) can all run in parallel.
- Within US2: T011, T013 and T015 (test files) in parallel; then T012 and T014 in parallel.
- Within US4: T026, T028, T031, T032 and T033 in parallel (different files).
- Within US5 and US7: T040, T042 and T045 in parallel.

### Parallel example (US2)

```text
Task: "T011 outline-attach tests in apps/app/src/editor/routing/outline-attach.test.ts"
Task: "T013 endpoint-target tests in apps/app/src/editor/routing/endpoint-target.test.ts"
Task: "T015 endpoint-drag tests in apps/app/src/editor/editing/endpoint-drag.test.ts"
```

## Implementation Strategy

1. **MVP = US1 + US6** (T001–T010, T038–T039). These are the reported bugs: handles reachable and drags reliable, and no stuck guides. Ship and test by hand.
2. **+ US2**: ends glide without jumping (the founder's top complaint).
3. **+ US4**: group connectors (high use).
4. **+ US3**: weight.
5. **+ US5, US7**: segment drag and spread ends.
6. Each story is a mergeable increment with its own quickstart rows; commit per task or per test + implementation pair.
