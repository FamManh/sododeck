# Tasks: Connector Style

**Input**: design documents in `specs/022-connector-style/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the four clarify answers (relative bends, new connectors use the default style, 22 px grid, 034 highlight keeps own colour) and the plan refinement (default weight 2 px).
- [research.md](research.md) (R1–R14), [data-model.md](data-model.md) (new `EdgeStyle` / `EdgeRoute` keys, `RouteWaypoint`, `labelAt`, S9–S11), [planning-input.md](planning-input.md) (founder notes).
- [contracts/connector-api.md](contracts/connector-api.md) (model ops, pure helpers and their guarantees) and [contracts/connector-ui.md](contracts/connector-ui.md) (roles, names, keys, announcements, precedence).
- [quickstart.md](quickstart.md). Visual reference: `docs/design/screens/128-…133-connector-*` and `118-*` (c), light and dark; `DESIGN.md` wins where they differ.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for the schema change.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Absent = today's look.** A connector without 022 data draws a byte-identical path (`routedPath`) and its JSON gains no key. Values equal to a default are never stored (`dash: solid`, `width: 2`, `animated: false`, `labelAt: 0.5`).
- **Store intent, never geometry** (founder): no path, no absolute bend coordinates, no label coordinates in the document. Drag previews live in the UI store until release; one op per gesture.
- **One route model**: bends replace 017's segment drag; `segment-handle.tsx` and `segment-drag.ts` are removed, not kept beside the new handles. A stored route never holds both `offset` and `waypoints`.
- **Default weight is 2 px** (plan refinement); the slider steps are 1, 1.5, 2, 3, 4.
- **Colour is never the only cue** (constitution VII): selection, flow, error and current-step looks win over a connector's colour, dash and animation.
- **Out of scope**: relationship types and the legend (Database pack), line jumps, arrowhead shapes, sticky leader styles, obstacle-avoiding routing (011), per-view styles, a darker default grey, column ports (DB8), new e2e tests.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy).

**Approvals**: no new runtime dependency (`bezier-js` / `d3-shape` were considered and are not needed; ask before adding either).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` ("Editing v1.json") first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`: validate before writing, ops in `src/ops/`, no React / DOM imports.
- **UI**: `packages/ui/src/…`, tests in `packages/ui/test/`; read `packages/ui/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`, and use the `react-flow` skill for every canvas change (`deck-edge.tsx`, `deck-to-flow.ts`, `routing/`, `editing/`).
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Work on branch (or worktree) `022-connector-style` from the latest `main`. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start. Check the lucide names used below exist in the installed version (`Spline`, `Minus`, `Ellipsis`, `RotateCcw`, `Activity` or another "running line" icon for the switch).
- [ ] T002 Take the bench baseline on unchanged code: `pnpm bench`, `BENCH_LINE_TYPES=1 pnpm bench`, `BENCH_ROUTES=1 pnpm bench`, plus `pnpm --filter @sododeck/app test scene.perf`. Save the tables in `specs/022-connector-style/bench-before.md`. (The 022 bench options are added in T038 and T053, once the schema accepts the data.)

---

## Phase 2: Foundational (format, model ops and the geometry module)

**Purpose**: the file format, the ops every story calls, and the pure geometry every drawing path uses. Each is test-first and leaves the suite green; nothing visible changes yet.

### Schema

- [x] T003 [P] Write failing schema tests: in `packages/schema/test/fixtures.ts` add valid decks (each new `style` key, `fromAt` with `fromSide`, `toAt` with `toSide`, `waypoints` mixing `x`/`dx` and `y`/`dy`, `labelAt` 0 / 0.2 / 1) and invalid ones (`dash: "wavy"`, `width: 2.5`, `width: 0`, `animated: "yes"`, `color: "teal-ish"`, `fromAt: 1.2`, `fromAt` without `fromSide` (S9), `offset` and `waypoints` together (S10), a waypoint with both `x` and `dx` or with neither `y` nor `dy` (S11), `waypoints: []`, `labelAt: -0.1`). Extend `packages/schema/test/schema.test.ts` (Ajv / Zod parity), `semantic-rules.test.ts` (S9–S11 messages and paths), `coverage.test.ts` and `key-order.test.ts`.
- [x] T004 Edit `packages/schema/schema/v1.json` per [data-model.md](data-model.md): `EdgeStyle` + `dash`, `width` (enum 1, 1.5, 2, 3, 4), `color` (`ColorRef`), `animated`; `EdgeRoute` + `fromAt`, `toAt` (0–1), `waypoints` (`minItems: 1`, items `RouteWaypoint`); new `$defs/RouteWaypoint` (`x`, `dx`, `y`, `dy` numbers, `additionalProperties: false`, `oneOf` per axis); `Edge.labelAt` (0–1). Write descriptions that say what absent means. Run `pnpm schema:generate`, commit `src/generated/*`, add every new key to `packages/schema/examples/full.sododeck.json`.
- [x] T005 Add semantic rules **S9** (`fromAt` needs `fromSide`, `toAt` needs `toSide`), **S10** (`offset` xor `waypoints`), **S11** (one key per axis in each waypoint) to `packages/schema/src/semantic-rules.ts`; update the header comment (why each is not in Zod). Make T003 pass.

### Model ops

- [x] T006 [P] Write failing model tests in `packages/model/test/edge-style.test.ts`: `setEdgeStyle` writes only the patched keys to every listed edge in one undo step; `null` and default values (`solid`, `2`, `false`) remove the key and an empty `style` is removed; `shape: 'curved'` on an edge with `offset` is stored (029 rule kept); invalid values throw and write nothing; `setEdgeShape` still behaves as today (existing tests unchanged); two docs setting `dash` and `color` concurrently both survive (key by key).
- [x] T007 [P] Write failing model tests in `packages/model/test/edge-route.test.ts`: `setEdgeRoute` with `fromAt` / `toAt` / `waypoints` merges and removes keys (`null`), validates S9–S11 before writing, `null` patch clears side, position, offset and waypoints in one step; setting `waypoints` on a route with `offset` removes `offset` and writes `style.shape: 'elbow'` when no shape is stored, in the same transaction (R3); `fromAt: 0.5` is stored only when a side is pinned and removed when the side is cleared. `setEdgeLabelAt` stores 0–1, removes on `null` or 0.5, rejects outside 0–1. Add round-trip cases to `packages/model/test/round-trip.test.ts` (every new key; a 017 file with `offset` unchanged on load and save; a pre-022 file byte-identical after an unrelated edit) and undo cases to `undo.test.ts`.
- [x] T008 Implement in `packages/model/src/ops/edge-style.ts`: `EdgeStylePatch`, `setEdgeStyle` (validate all, write key by key in the nested `Y.Map`, remove defaults, drop empty `style`), `setEdgeShape` as a wrapper. Add `edgeLineStyle(edge)` (effective values) to `packages/model/src/edge-shape.ts`. Wire both through `src/editor.ts` and export from `src/index.ts`. Make T006 pass.
- [x] T009 Extend `EdgeRoutePatch`, `mergeRoute` and `setEdgeRoute` in `packages/model/src/ops/shape.ts` (`waypoints` written as one JSON value; the offset → waypoints conversion and elbow pinning from R3); add `packages/model/src/ops/edge-label.ts` with `setEdgeLabelAt`; wire through `editor.ts` / `index.ts`. Make T007 pass.

### Pure geometry and colour (app)

- [x] T010 [P] Write failing unit tests `apps/app/src/editor/routing/connector-geometry.test.ts` for every guarantee in [contracts/connector-api.md](contracts/connector-api.md): no-bend output equals `routedPath` for each shape × direction × self-loop (snapshot the current outputs first); `anchorPoint` at 0 / 0.25 / 0.5 / 1 on each side; `encodeWaypoint` / `decodeWaypoints` round-trip within 1e-9, fraction vs. `dx`/`dy` choice at the 22 px threshold, translation of both centres moves bends exactly, a zero span decodes without NaN or Infinity; `offsetBends` returns the two corners of a 017 segment for both axes; `autoSides` faces the first / last bend and keeps pinned sides; elbow paths have only H/V runs with ≤ 10 px corners; curved paths pass through every bend (sample the path) and leave / enter along the side normals; straight ignores bends; `simplifyWaypoints` drops near-collinear and duplicate points only; `snapBend` prefers neighbour alignment over the grid; `samplePath` / `projectOnPath` / `labelPoint` stay on the path and respect the clamp.
- [x] T011 Implement `apps/app/src/editor/routing/connector-geometry.ts` (R1–R4, R10): pure, no DOM, no React. Keep `routedPath` in `route-path.ts` as the no-bend path and call it from `pointsToPath` when there are no bends and no anchor positions. Add a 20-bend timing case (< 0.1 ms) to the test. Make T010 pass.
- [x] T012 [P] Write failing tests `apps/app/src/editor/style/line-colour.test.ts` and extend `packages/ui/test/contrast.test.ts`: `lineColour` returns the `--sd-card-<name>-stroke` token for named colours and the default edge token for `null`; custom hex too light on the canvas is mixed toward black (light) / white (dark) in 1/24 steps until ≥ 3:1, the input is never changed; all 13 named stroke tokens reach ≥ 3:1 against the canvas in both themes (fail loudly if one does not, then pick the next darker token in R12 and note it); `lineDash` gives `4w 3.5w` dashed and `0 3w` dotted with round caps, `undefined` for solid.
- [x] T013 Implement `apps/app/src/editor/style/line-colour.ts`; add `--sd-deck-edge-track` (32 % of the line colour) to `packages/ui/src/styles/tokens.css` if a token is needed for the animation track. Make T012 pass.

**Checkpoint**: format, ops and geometry are done and tested; the app draws exactly as before.

---

## Phase 3: User Story 1 - Style a connector from the toolbar (Priority: P1) 🎯 MVP

**Goal**: Line style popover (type, dash, weight, colour, animate switch writes the value), "Mixed" for multi-selection, menu items, drawer section; lines draw the chosen dash, weight and colour on canvas and in export.

**Independent Test**: quickstart steps 1–4: style one connector, then three at once, keyboard only, undo each in one step, new connector stays default, JSON panel in sync.

### Tests for User Story 1 (write first, watch them fail)

- [ ] T014 [P] [US1] `apps/app/src/editor/line-style/line-style-view.test.ts`: `lineStyleView(edges)` gives the shared value or `mixed` per key (shape, dash, width, colour, animated) with the set of values in use; defaults count as values.
- [ ] T015 [P] [US1] `apps/app/src/editor/line-style/line-style-popover.test.tsx`: roles and names from [contracts/connector-ui.md](contracts/connector-ui.md) (`dialog` "Line style", `radiogroup` Type / Dash / Colour, `slider` "Weight" with "2 px, default", `switch` "Animate direction"); each pick calls the editor once with only that key; "Mixed" on differing sections and the "3 connectors · one change applies to all" subtitle; keyboard: arrows in radio groups, Home / End on the slider, Space on the switch, Tab order, Esc closes and returns focus to the opener.
- [ ] T016 [P] [US1] Extend `apps/app/src/editor/actions/actions-for.test.ts` and `connection-actions.test.ts`: the toolbar for `connection` / `connections` shows "Line style" and no longer "Line type"; the menu has Line type ▸, Dash ▸, Weight ▸ (radio, checked = shared value), "Animate direction" (checked), "Colour…"; every run is one undo step.
- [ ] T017 [P] [US1] Extend `apps/app/src/editor/inspector/edge-inspector.test.tsx` and `bulk-inspector.test.tsx`: a "Line" section with the same controls and names; bulk shows "Mixed".
- [ ] T018 [P] [US1] `apps/app/src/editor/deck-edge.test.tsx` (create if missing) and `deck-to-flow.test.ts`: a connector with `dash` / `width` / `color` draws that `stroke-dasharray`, width and `lineColour`; selected stays orange 2.5 px; a flow stroke replaces dash and colour; no style draws exactly today's attributes; edge data carries the style and the cache refreshes when it changes. Arrow and knob scale with width (frame 133 "arrow scale"): extend `edge-end-marks.test.ts`.
- [ ] T019 [P] [US1] Extend `apps/app/src/editor/export/scene.test.ts` and `render-svg.test.ts`: scene edges carry dash, width and the light-theme resolved colour; the SVG draws them; a style-less deck's SVG is unchanged (snapshot).
- [ ] T020 [P] [US1] Extend `packages/model/test/paste.test.ts` (or the clipboard test that covers edges): a copied / duplicated connector keeps its `style`; a newly created connector has no `style` (FR-005a).

### Implementation for User Story 1

- [ ] T021 [US1] Add `'lineStyle'` to `ToolbarFieldId` in `apps/app/src/state/ui-store.ts`. Create `apps/app/src/editor/line-style/line-style-view.ts` (pattern of `inspector/derive.ts` `styleView`). Make T014 pass.
- [ ] T022 [US1] Create `apps/app/src/editor/line-style/line-style-popover.tsx` (288 wide, sections per frame 128 B / C / D; reuse `SwatchGrid` for colours incl. deck colours and "No colour"; a 5-stop slider built on the existing slider pattern if `packages/ui` has no generic one; announcements via `announce`). Calls `editor.setEdgeStyle(selectedIds, { key: value })`. Make T015 pass.
- [ ] T023 [US1] In `apps/app/src/editor/actions/connection-actions.ts` add `connection.lineStyle` (`field: 'lineStyle'`, toolbar `connection` / `connections`, label "Line style"), move `connection.lineType` to the menu only, add Dash ▸ / Weight ▸ / Animate direction / Colour… menu actions; fold `apps/app/src/editor/fields/line-type.ts`'s `applyLineType` into `setEdgeStyle`. Host the popover in `apps/app/src/editor/quick-edit/field-popover.tsx` (`'lineStyle'` case). Make T016 pass.
- [ ] T024 [US1] Add the "Line" section to `apps/app/src/editor/inspector/edge-inspector.tsx` and the style rows to `bulk-inspector.tsx`, reusing the popover's section components. Make T017 pass.
- [ ] T025 [US1] Draw the style: `apps/app/src/editor/deck-to-flow.ts` passes `style` in `DeckEdgeData` (cache key); `apps/app/src/editor/deck-edge.tsx` applies `lineDash`, width and `lineColour` with the precedence in the UI contract (selected > flow strokes > own style > default); `apps/app/src/editor/edge-ends.tsx` scales arrow and knob with width. Make T018 pass.
- [ ] T026 [US1] Export: `apps/app/src/editor/export/scene.ts` (`SceneEdge.style`), `export/render-svg.ts` (dasharray, width, colour, round caps). Make T019 pass; confirm T020 passes (fix the paste / create path if needed).
- [ ] T027 [US1] Screenshot frame-128 states (closed, open, three connectors Mixed, keyboard focus) light and dark into `specs/022-connector-style/screens/`; compare with `128-connector-style-*.png` and fix spacing / sizes.

**Checkpoint**: US1 is usable on its own; merge-ready after the full definition-of-done run.

---

## Phase 4: User Story 2 - Bend a connector freely (Priority: P1)

**Goal**: light round handles; drag a midpoint to add a bend, move bends freely with neighbour and 22 px grid snapping, auto-simplify, remove by double-click or ⌫; bends follow cards (relative storage); 017 offsets convert on first edit; Reset route clears all.

**Independent Test**: quickstart steps 5–7.

### Tests for User Story 2 (write first)

- [ ] T028 [P] [US2] `apps/app/src/editor/editing/bend-drag.test.ts`: session start from a midpoint inserts at the right index; move snaps to a neighbour's line within 6 screen px, else to the 22 px grid, ⌘ disables; release auto-simplifies and calls `setEdgeRoute` once with encoded waypoints; a release that changes nothing writes nothing; arrow-key moves of 22 / 1 px are one step each; a session on a 017 offset edge starts from `offsetBends` and its first write removes `offset`; Esc cancels with no write.
- [ ] T029 [P] [US2] `apps/app/src/editor/routing/route-handles.test.tsx`: handles render only on hover or for the single selected connector, never in flow mode or recording; names "Source end", "Target end", "Add bend between points 1 and 2", "Bend 2 of 3"; Tab order ends → midpoints → bends; ⏎ on a midpoint adds a bend; ⌫ / Delete / double-click on a bend removes only the bend (the connector stays); Esc returns focus to the connector; straight lines show no bend handles; announcements "Bend added / removed / moved".
- [ ] T030 [P] [US2] Extend `deck-edge.test.tsx` and `deck-to-flow.test.ts`: bends decoded from both card centres in the current view (a view with other positions draws them between the cards there); moving both cards by the same delta translates the path exactly; curved / elbow / straight with the same bends; the 40 % ghost during a bend gesture; `segment-handle` is gone.
- [ ] T031 [P] [US2] Extend `apps/app/src/editor/actions/shape-actions.test.ts` (create if missing): "Reset route" applies to every shape once a connector has bends, anchors or an offset, and clears them in one step with "Route reset" announced.
- [ ] T032 [P] [US2] Extend `export/scene.test.ts` / `export/edge-geometry.test.ts`: bends drawn in the export for each shape, extents include them.

### Implementation for User Story 2

- [ ] T033 [US2] Create `apps/app/src/editor/editing/bend-drag.ts` (pattern of `segment-drag.ts`; live point and guides in the UI store under `canvasGesture: 'bend'`, readout "x · y" and "n bends"). Make T028 pass. Delete `editing/segment-drag.ts` and its test once nothing imports it.
- [ ] T034 [US2] Create `apps/app/src/editor/routing/route-handles.tsx` (sizes and hit areas per frame 129; `nodrag nopan`; focusable buttons in `EdgeLabelRenderer`; uses the bend session; reuses `editing/guides-overlay.tsx` for guides). Replace `SegmentHandle` and the 017 end grips in `deck-edge.tsx`; delete `routing/segment-handle.tsx` and its test. Make T029 pass.
- [ ] T035 [US2] `deck-to-flow.ts`: pass `waypoints` and both card boxes (centres and sizes) for the current view in edge data, choose handles with `autoSides` when bends exist, cache keys updated. `deck-edge.tsx`: build points with `decodeWaypoints` (or `offsetBends` for a 017 offset) and draw with `pointsToPath`; ghost of the previous route while a bend gesture is active. Make T030 pass.
- [ ] T036 [US2] `apps/app/src/editor/actions/shape-actions.ts`: widen `edge.resetRoute` to every shape with bends, anchors or offset. Add "Bends: n" with Reset route to `inspector/route-fields.tsx`. Make T031 pass.
- [ ] T037 [US2] Export: `export/edge-geometry.ts` `edgePath` takes the edge's route and decodes bends from the export's card rects, calling `connector-geometry`; extents include bends. Make T032 pass.
- [ ] T038 [US2] Add `BENCH_BENDS=1` to `apps/app/bench/perf.bench.ts` (200 edges get 3 `route.waypoints` each, mixed shapes; document it in the header next to `BENCH_LINE_TYPES`), run it and note the numbers; screenshot frame-129 states (handles rest / hover, add, move with guides, remove) light and dark into `screens/` and compare with `129-connector-bend-points-*.png`.

**Checkpoint**: US1 + US2 are the P1 scope.

---

## Phase 5: User Story 3 - Attach an end anywhere along a side (Priority: P2)

**Goal**: drag an end along a card side with snapping at 0 / 25 / 50 / 75 / 100 %, readout, ghost and Esc; drop on the body returns to automatic; keyboard moves along sides.

**Independent Test**: quickstart step 8.

### Tests for User Story 3 (write first)

- [ ] T039 [P] [US3] `apps/app/src/editor/editing/anchor-drag.test.ts`: the pointer projects to the nearest side; snaps within 4 % to the five stops, ⌘ disables; readout text "left side · 78 %"; a drop more than 12 px inside every side clears side and position; a drop on another card reconnects as today (017) and anchors when near a side; Esc cancels; one `setEdgeRoute` per gesture; keyboard steps move one stop and wrap to the next side at a corner.
- [ ] T040 [P] [US3] Extend `deck-edge.test.tsx`: the end sits at `fromAt` along its side, follows card moves and resizes; `endpoint-connection-line.test.tsx`: the preview line uses the anchor while sliding.

### Implementation for User Story 3

- [ ] T041 [US3] Create `apps/app/src/editor/editing/anchor-drag.ts` (`canvasGesture: 'anchor'`, readout in the UI store); hook it into the end handles in `routing/route-handles.tsx` (slide along the own card vs. reconnect to another card, per R4). Make T039 pass.
- [ ] T042 [US3] `deck-edge.tsx` and `routing/endpoint-connection-line.tsx`: compute ends with `anchorPoint` from React Flow's side midpoint plus the card size from edge data. `export/edge-geometry.ts`: same for the export. Make T040 pass.

---

## Phase 6: User Story 6 - Existing decks, other views and exports keep working (Priority: P2)

**Goal**: older decks unchanged; precedence over flow / selection / error; 034 rules; full export parity.

**Independent Test**: quickstart steps 6, 7, 10 (flow part) and 11.

- [ ] T043 [P] [US6] `packages/model/test/round-trip.test.ts` / `apps/app/src/editor/export/json-export.test.ts`: a 017 deck, a 029 deck with shapes and a deck with no edge extras export without any 022 key after unrelated edits (SC-004); a deck using every 022 key survives export → import → save → reopen unchanged (SC-005).
- [ ] T044 [P] [US6] `deck-edge.test.tsx`: precedence per the UI contract: a coloured, dashed, animated connector that is selected, on an error path, a candidate or the current flow step shows that state's look; colour and dash return when the state ends.
- [ ] T045 [US6] 034 interplay (R14): if 034 is merged, make its bundling skip edges with `waypoints`, `fromAt` / `toAt` or any `style` key other than `shape`, and make its highlight keep `lineColour(style.color)` at 2.75 px (uncoloured → Ink), with tests next to 034's code; if 034 is not merged, add a short note to `specs/034-connection-focus-and-drill/plan.md` pointing at 022 FR-024 so 034 implements it.
- [ ] T046 [US6] Fix anything T043 / T044 expose in `deck-edge.tsx`, `deck-to-flow.ts`, `export/*` or the model ops.

---

## Phase 7: User Story 4 - Place the label where it reads best (Priority: P3)

**Goal**: drag the label along the line with 25 / 50 / 75 % ticks and snapping, clamp near the ends, keyboard moves, drawer field; position kept as cards and bends change.

**Independent Test**: quickstart step 9.

### Tests for User Story 4 (write first)

- [ ] T047 [P] [US4] `apps/app/src/editor/editing/label-drag.test.ts`: pointer projection to a fraction on straight, elbow-with-bends and curved paths; snapping within 4 % of a tick ("snapped" readout), ⌘ disables; clamp keeps the pill 8 px plus half its width from each end; one `setEdgeLabelAt` per gesture; keys ← → 5 %, Shift jumps ticks, Home / End clamp ends.
- [ ] T048 [P] [US4] Extend `deck-edge.test.tsx`: the label sits at `labelAt` along the path, never rotated, and stays at that fraction after a card move or a bend change; the pill is a `button` named "Label <text>, 20 % along" and ⏎ starts text editing. Extend `edge-inspector.test.tsx`: `spinbutton` "Label position". Extend `export/scene.test.ts`: label point matches the canvas within 0.5 px.

### Implementation for User Story 4

- [ ] T049 [US4] Create `apps/app/src/editor/editing/label-drag.ts` (`canvasGesture: 'label'`, ticks and readout in the UI store). Make T047 pass.
- [ ] T050 [US4] `deck-to-flow.ts` passes `labelAt`; `deck-edge.tsx` places the label with `labelPoint` (DOM `getPointAtLength` fast path allowed only with the parity test from T010) and makes it draggable and focusable; ticks drawn while dragging. Drawer "Label position" field in `inspector/edge-inspector.tsx`. Export label point in `export/scene.ts`. Make T048 pass. Screenshot against `130-connector-label-position-*.png`.

---

## Phase 8: User Story 5 - Show the direction of a flow with moving dashes (Priority: P3)

**Goal**: Animate direction runs dashes toward the arrow (both ways for two-way), static under reduced motion, in flows and in export, cheap on large decks.

**Independent Test**: quickstart step 10 and the animated bench.

### Tests for User Story 5 (write first)

- [ ] T051 [P] [US5] Extend `deck-edge.test.tsx`: `animated` adds the `sd-edge-run` class and a 32 % track on solid lines; a two-way connector draws two runs in opposite directions; no class when reduced motion is on (mock `useReducedMotion`), when a flow is shown or recorded, or when the connector is selected; the export scene never animates.

### Implementation for User Story 5

- [ ] T052 [US5] Add `sd-edge-run` keyframes (`stroke-dashoffset`, period `8w`, 24 px/s, linear infinite; reverse variant) and a `prefers-reduced-motion` guard to `apps/app/src/index.css`; apply them in `deck-edge.tsx` per R11. Make T051 pass.
- [ ] T053 [US5] Add `BENCH_ANIMATED=1` to `apps/app/bench/perf.bench.ts` (200 edges get `style.animated: true`, half of them dashed; document it in the header) and run it. If panning is below 60 fps, pause off-screen animations with `animation-play-state` from a viewport-derived edge set (R11) and re-measure; record both runs. Screenshot against `131-connector-animated-direction-*.png` (still frames).

---

## Phase 9: Polish and cross-cutting

- [ ] T054 [P] Docs: new `docs/decisions/0024-connector-route-model.md` (0023 is reserved by 034's T042; take the next free number if either changes; store intent only; one point list for every shape; relative waypoints R1 with the 22 px fallback; anchors R4; 017 offset conversion R3; S9–S11; precedence; default 2 px); `docs/decisions/0022-schema-roadmap.md` rows for the new keys marked built by 022; a pointer from `0019-card-size-and-connector-route.md` to 0023; `DESIGN.md` Connectors (style values, handles, label drag, animation, line colours); `packages/schema/CLAUDE.md` (S9–S11), `packages/model/CLAUDE.md` (`setEdgeStyle`, route patch, `setEdgeLabelAt`), `apps/app/CLAUDE.md` (`routing/connector-geometry.ts`, `route-handles.tsx`, `line-style/`, `editing/{bend,anchor,label}-drag.ts`; segment handle removed); `docs/backlog.md` §022 status and the relationship types moved to the Database pack (`docs/backlog-database.md`). Do not name other diagram or database tools anywhere.
- [ ] T055 Accessibility pass: keyboard-only run of quickstart steps 1–10, visible focus on every control and handle, roles and names per [contracts/connector-ui.md](contracts/connector-ui.md), reduced motion respected, a greyscale screenshot of the styled board (frame 132) still shows selection and flow state without colour.
- [ ] T056 Run the quickstart manual walk 1–12 in light and dark; save screenshots in `specs/022-connector-style/screens/` and results in `quickstart-results.md` (compare with frames 128–132).
- [ ] T057 Performance: `pnpm bench`, `BENCH_LINE_TYPES=1`, `BENCH_ROUTES=1`, `BENCH_ANIMATED=1`, `BENCH_BENDS=1` on the finished code → `specs/022-connector-style/bench-after.md`, compared with `bench-before.md` (no regression without 022 data; ≥ 60 fps with 200 animated; bent connectors within targets). Re-run `pnpm --filter @sododeck/app test scene.perf`.
- [ ] T058 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, no skipped or `.only` tests, the smoke suite (incl. no third-party requests) unchanged. Final report: what changed, what was skipped, what is uncertain, bench numbers, next step. Stop; do not start the next feature.

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phase 9.** Phase 2 blocks everything.
- **Inside Phase 2**: T003 → T004 → T005 (schema); T006 / T007 → T008 / T009 (model, need T004's generated types); T010 → T011 and T012 → T013 (app pure modules) can start beside the model work once T004 has landed.
- **US1** needs only Phase 2. **US2** needs Phase 2 (geometry, route ops); it touches `deck-edge.tsx` and `deck-to-flow.ts` after US1, so run it after US1 or rebase. **US3** needs US2's `route-handles.tsx`. **US6** needs US1–US3 (and checks US4 / US5 again in Phase 9). **US4** needs US2's path building. **US5** needs US1's style drawing.
- **Priorities**: P1 = US1, US2; P2 = US3, US6; P3 = US4, US5.

## Parallel examples

- Phase 2: T003, T006, T007, T010 and T012 are test-writing in different packages and can start together.
- US1: T014–T020 touch different files and can be written in parallel; T021 / T022 (popover) and T026 (export) can be built in parallel; T023–T025 follow the popover.
- US2: T028, T029, T031, T032 in parallel; T033 → T034 → T035 in order; T036 and T037 beside them.
- With two agents: one takes schema, model, geometry, export (T003–T013, T019, T026, T032, T037, T043); the other the UI (T014–T018, T021–T025, T028–T031, T033–T036) after T004 and T011 land.

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US1.** A user can style connectors from the toolbar, menu and drawer, with Mixed, undo, export and JSON in sync. Check the frame-128 visual match (T027) before continuing.
2. Add **US2** (bends, lighter handles, 017 conversion). Together with US1 this is the P1 scope and replaces 017's segment drag.
3. Add **US3** (anchors) and **US6** (compatibility, precedence, 034 rules).
4. Add **US4** (label) and **US5** (animation), then Phase 9.
5. Each phase is a mergeable slice (plan "Delivery slices"). Keep commits small: one per task or tight group. Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
