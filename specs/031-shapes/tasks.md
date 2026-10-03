# Tasks: Shapes

**Input**: design documents in `specs/031-shapes/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the founder decisions (Sticky reuses today's sticky; Frame = Group, "Frame" only on the Add tile; Basic shapes on in new decks).
- [research.md](research.md) (R1–R8: shape table with sizes and lip, geometry module, shape node, `node.display`, Frame tool, export) and [data-model.md](data-model.md).
- [contracts/shape-api.md](contracts/shape-api.md) (geometry guarantees, model API, tile icons) and [contracts/shape-ui.md](contracts/shape-ui.md) (roles, names, keys).
- [quickstart.md](quickstart.md). Visual reference: `docs/design/screens/120-…`, `122-…`, `123-…`, `127-…` (light and dark); `DESIGN.md` wins where they differ.

**Prerequisite**: **030 is built and merged** (registry `card-types.ts`, `TYPE_STYLE`, palette flyout with tabs, packs panel, `NEW_DECK_PACKS`, `type-registry.test.ts`). Do not start before.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for the schema change.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Older decks unchanged**: `display` is written only when it differs from the type's family; packs of existing decks never change.
- **Frame = Group**: the Frame tool creates a group with the existing `groupSelection`; no new object, no capture-on-cover, no "Group" renaming outside the Add tile.
- **Sticky tile = today's sticky** (`addNoteAt`); no new sticky shape.
- **Tilt and lift are paint-only** (§g-74): snapping, hit tests, outline points and export use the untilted box.
- **Out of scope**: free drawing, custom shapes, rotation, colour on the text shape, a decorative frame object, new e2e tests.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy).

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for every canvas change (shape node, handles, frame tool, `deck-to-flow.ts`).
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [ ] T001 Work on branch (or worktree) `031-shapes` from the latest `main` (030 merged). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start. Confirm lucide `StickyNote` and `Frame` exist.
- [ ] T002 Take the bench baseline on unchanged code: `pnpm bench`, `BENCH_TYPES=1 pnpm bench`, `pnpm --filter @sododeck/app test scene.perf`; save in `specs/031-shapes/bench-before.md`.

---

## Phase 2: Foundational (schema, registry, geometry)

**Purpose**: `node.display`, the shapes pack in the registry and the pure geometry every story draws with. Test-first; nothing visible changes yet.

- [ ] T003 [P] Write failing schema tests in `packages/schema/test/fixtures.ts` / `schema.test.ts`: `display: "card"` and `"shape"` valid on any node; `display: "icon"` invalid; a node of each shape type id valid.
- [ ] T004 Add `Node.display` (`enum: ["card", "shape"]`, after `type`, description "absent = the type's own family") to `packages/schema/schema/v1.json`; `pnpm schema:generate`; add a shape node and a `display: "shape"` database to `examples/full.sododeck.json`. Make T003 pass.
- [ ] T005 [P] Write failing tests in `packages/model/test/card-types.test.ts`: pack `shapes` ("Basic shapes", category `shapes`) holds the 11 shape types of research R1 with their geometry, default and minimum sizes; `decision`, `database`, `document` have `shapeForm` `diamond`, `cylinder`, `document-shape`; `effectiveFamily`, `shapeGeometryOf`, `hasTwoForms`; `NEW_DECK_PACKS` includes `shapes`; a deck saved before 031 keeps its packs (`deckPacks` unchanged).
- [ ] T006 [P] Write failing tests `packages/model/test/node-display.test.ts`: `setNodeDisplay` sets and clears in one undo step for several nodes, removes the key when equal to the type's family or `null`, keeps every other key, rejects invalid values and unknown ids; round-trip of both forms in `round-trip.test.ts`.
- [ ] T007 Extend `packages/model/src/card-types.ts` with the shapes pack, `geometry`, `shapeForm`, sizes, helpers and `NEW_DECK_PACKS`. Make T005 pass. Update 030's `apps/app/src/editor/type-registry.test.ts`: card-family types need a `TYPE_STYLE` entry; shape-family types need a geometry instead.
- [ ] T008 Add `packages/model/src/ops/node-display.ts` (`setNodeDisplay`), wire it in `src/editor.ts` and `src/index.ts`. Make T006 pass.
- [ ] T009 [P] Write failing unit tests `apps/app/src/editor/shapes/shape-geometry.test.ts` for every guarantee in [contracts/shape-api.md](contracts/shape-api.md): outline points on the outline within 0.5 px for each geometry and side (sample the path), `at` 0 / 1 at the ends of a side, title box inside the outline at default and minimum size, scaling keeps a diamond's vertices at side midpoints, `lip` null for actor and none, parallelogram left / right points inset by half the skew, document bottom point on the wave, actor points at head / hands / feet.
- [ ] T010 Implement `apps/app/src/editor/shapes/shape-geometry.ts` (`shapePath`, `outlinePoint`, `titleBox`, `minSize`, `defaultSize`, memoised per geometry and size). Make T009 pass.

**Checkpoint**: format, registry and geometry are done; the app still draws only cards.

---

## Phase 3: User Story 1 - Draw a process with real shapes (Priority: P1) 🎯 MVP

**Goal**: the eleven shapes in Add's Shapes tab, drawn with true geometry, connectors on the outline, resize, colour, states, zoom levels and export.

**Independent Test**: quickstart steps 1–3 and 8.

### Tests for User Story 1 (write first)

- [ ] T011 [P] [US1] `apps/app/src/editor/shapes/shape-node.test.tsx`: a node of each shape type renders its outline path, the lip where research R1 says yes, and the centred title (3-line clamp, title-only tooltip when cut); accessible name "<title>, <shape name>"; ⏎ edits the title; fill and stroke colours apply (none on `text`); Landscape shows geometry only; selected / problem / current-step / dimmed / connection-target / "n inside" states per `DESIGN.md`'s shape column, each with a non-colour cue.
- [ ] T012 [P] [US1] Extend `apps/app/src/editor/deck-to-flow.test.ts`: shape-family nodes get node type `shape` with geometry, box and handle positions from `outlinePoint`; card nodes unchanged; cache refreshes on type, display, size or colour change.
- [ ] T013 [P] [US1] Extend `apps/app/src/editor/palette.test.tsx` (030): new deck shows a Shapes tab and a Basic shapes section with the eleven shape tiles (mini-outline icons) plus Sticky and Frame; adding a shape tile creates a node of that type at its default size with the title in edit.
- [ ] T014 [P] [US1] Extend resize tests (`editing/card-resize.test.ts`): shapes resize with 017's handles to at least their minimum size, one undo step; the geometry scales.
- [ ] T015 [P] [US1] Extend `apps/app/src/editor/export/scene.test.ts`, `render-svg.test.ts`, `edge-geometry.test.ts`: shapes export with geometry, lip, colours and title; connectors end on outline points; no tilt; a card-only deck's SVG is unchanged (snapshot).

### Implementation for User Story 1

- [ ] T016 [US1] Create `apps/app/src/editor/shapes/shape-tile.tsx` (20 px mini outline from `shapePath`) and use it wherever a type tile is drawn for shape-family types (030's type-tile component, palette, type picker, view settings, search results). Make T013's icon expectations pass.
- [ ] T017 [US1] Create `apps/app/src/editor/shapes/shape-node.tsx` (SVG lip, fill, outline; title box with `card-text.ts` measuring; handles at `outlinePoint`; resize handles from 017 with `minSize`; states; −3° drag tilt paint-only) and register the `shape` node type in `apps/app/src/editor/canvas.tsx`. Make T011 pass.
- [ ] T018 [US1] In `apps/app/src/editor/deck-to-flow.ts` choose node type by `effectiveFamily`, pass geometry, size (default per shape when `node.size` is absent) and handle positions; update cache keys. Make T012 pass.
- [ ] T019 [US1] Apply per-shape minimum sizes in `apps/app/src/editor/editing/resize-limits.ts` / `card-resize.ts`. Make T014 pass.
- [ ] T020 [US1] Export: `export/scene.ts` (shape entries), `export/render-svg.ts` (paths and title), `export/edge-geometry.ts` (outline points for shape ends). Make T015 pass.
- [ ] T021 [US1] Add the Shapes tab tiles to 030's palette (11 types from the registry; Sticky and Frame tiles wired in US4 and US2) in `apps/app/src/editor/palette.tsx`; packs panel shows "Basic shapes · 13 types". Make T013 pass.
- [ ] T022 [US1] Screenshot the eleven shapes, the states and zoom levels light and dark into `specs/031-shapes/screens/`; compare with frames 120, 122, 123 and fix spacing.

---

## Phase 4: User Story 2 - Draw a frame first, then fill it (Priority: P1)

**Goal**: the Frame tile draws an empty group frame (drag, click or ⏎), adds items fully inside once, opens the rename; empty groups work everywhere.

**Independent Test**: quickstart step 4.

### Tests for User Story 2 (write first)

- [ ] T023 [P] [US2] `apps/app/src/editor/frame-tool/frame-draw.test.ts` (pure): `framePlan(deck, view, rect, scope)` returns the clamped frame (≥ 160 × 96), the parent (innermost visible frame fully containing the rect, else the drilled-in scope, else none) and the items fully inside at that parent level (cards, shapes, groups; not partly inside; not stickies); click → 320 × 200 centred on the point.
- [ ] T024 [P] [US2] `apps/app/src/editor/frame-tool/frame-draw-layer.test.tsx`: with the frame tool active, a pointer drag shows the dashed preview and "W × H" readout; release calls `groupSelection` once with the plan, opens the group rename with "New group", announces "Frame added, n items" and returns to the select tool; Esc cancels; ⏎ on the Frame tile places a default frame at the view centre.
- [ ] T025 [P] [US2] `packages/model/test/groups-empty.test.ts` and app tests: a group with a frame and no members survives `groupBounds`, collapse (count 0), drill-in, view frames, delete of a former member, `fitGroupFrames`, round-trip and export; nothing deletes it.
- [ ] T026 [P] [US2] Extend drop tests (`editing/membership-changes.test.ts`): dropping into an empty frame joins it; dragging out leaves; moving a frame over cards changes no membership.

### Implementation for User Story 2

- [ ] T027 [US2] Add the `frame` tool to `apps/app/src/state/ui-store.ts` (beside select / hand / sticky / connector) and wire the Frame tile in `palette.tsx` (tooltip "Draw a group frame"). The ⌘G "≥ 2 items" guard stays as is.
- [ ] T028 [US2] Create `apps/app/src/editor/frame-tool/frame-draw.ts` and `frame-draw-layer.tsx` (pane pointer handling via the `react-flow` patterns; calls `editor.groupSelection`, then the existing rename flow from `editing/group-from-selection.ts` / `group-rename`). Make T023 and T024 pass.
- [ ] T029 [US2] Fix any empty-group path T025 / T026 expose (expected none in the model; collapsed-group card and export may need a count-0 case). Make T025 and T026 pass.

**Checkpoint**: US1 + US2 are the P1 scope.

---

## Phase 5: User Story 3 - Switch decision, database and document between card and shape (Priority: P2)

**Goal**: "Show as" card / shape in toolbar, menu and drawer; one undo step; nothing else changes.

**Independent Test**: quickstart step 5.

### Tests for User Story 3 (write first)

- [ ] T030 [P] [US3] `apps/app/src/editor/actions/shape-form-actions.test.ts`: "Show as: Card / Shape / Mixed" only for selections of decision, database, document; picking calls `setNodeDisplay` once; announces "Shown as shape / card".
- [ ] T031 [P] [US3] Extend `inspector/node-inspector.test.tsx`: `radiogroup` "Show as"; in shape form the drawer still edits description, tags (and fields once 032 exists).
- [ ] T032 [P] [US3] Extend `deck-to-flow.test.ts` / `shape-node.test.tsx`: a database with `display: "shape"` draws a cylinder; switching back restores the card; a user `node.size` is kept; without one each form uses its default size; connections, group, flow steps unchanged (field-by-field comparison, SC-003).

### Implementation for User Story 3

- [ ] T033 [US3] Create `apps/app/src/editor/actions/shape-form-actions.ts` (register in `ACTIONS`, toolbar + menu), add the "Show as" radio group to `apps/app/src/editor/inspector/node-inspector.tsx`. Make T030–T032 pass.

---

## Phase 6: User Story 5 - Older decks and every other place keep working (Priority: P2)

**Goal**: older decks unchanged; shapes in flows, search, views, JSON and export.

**Independent Test**: quickstart steps 7 and 8.

- [ ] T034 [P] [US5] `packages/model/test/round-trip.test.ts`: a deck saved before 031 (030 packs) round-trips byte-identical; a deck with every shape type and both forms round-trips unchanged.
- [ ] T035 [P] [US5] Flow playback test (extend 035's tests): a flow through a pill, a diamond and a cylinder shows the current-step shape look (orange stroke, halo, sticker) and played / upcoming looks.
- [ ] T036 [P] [US5] Search and views tests: a shape title is found; view settings hide / dim each shape type; the JSON panel shows `type` and `display` in sync.
- [ ] T037 [US5] Fix anything T034–T036 expose in `shape-node.tsx`, `deck-to-flow.ts` or the flow / search / view code.

---

## Phase 7: User Story 4 - Sticky and text from the Shapes tab (Priority: P3)

**Goal**: the Sticky tile makes today's sticky; the Text shape has no outline.

**Independent Test**: quickstart step 6.

- [ ] T038 [P] [US4] Extend `palette.test.tsx`: the Sticky tile calls `addNoteAt` (same result as the rail tool, including drag to place); the Text tile creates a `text` node with no outline, fill or lip whose connectors meet its box.
- [ ] T039 [US4] Wire the Sticky tile in `apps/app/src/editor/palette.tsx` to `addNoteAt` from `apps/app/src/editor/stickies/sticky-actions.ts`. Make T038 pass.

---

## Phase 8: Polish and cross-cutting

- [ ] T040 [P] Docs: new `docs/decisions/0026-shapes-and-frame-tool.md` (shapes as registry types, `document-shape` id, `node.display`, geometry module and outline points, mini-outline tiles, Frame = Group via `groupSelection`, empty groups valid); `docs/decisions/0022-schema-roadmap.md` (`node.display` built); `DESIGN.md` (Shape entry details per shape, Frame tool, Shapes tab; close the "Card ↔ shape switch" open item); `packages/model/CLAUDE.md`, `apps/app/CLAUDE.md` (`shapes/`, `frame-tool/`, shape node), `.claude/skills/react-flow/SKILL.md` (shape node row); `docs/backlog.md` §031 status. Do not name other diagram or database tools anywhere.
- [ ] T041 Accessibility pass: keyboard-only quickstart step 9, visible focus on shapes, Show as and the Frame tile, names per [contracts/shape-ui.md](contracts/shape-ui.md), shape title contrast ≥ 4.5:1 on every named fill in both themes (extend the contrast test), states readable in greyscale.
- [ ] T042 Run the quickstart walk 1–9 light and dark; screenshots in `specs/031-shapes/screens/`, results in `quickstart-results.md`.
- [ ] T043 Performance: add `BENCH_SHAPES=1` to `apps/app/bench/perf.bench.ts` and `apps/app/src/bench/generate-deck.ts` (a third of nodes as mixed shapes); run it and `pnpm bench` → `bench-after.md` vs `bench-before.md`; re-run `scene.perf`.
- [ ] T044 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, no skipped or `.only` tests, smoke suite green. Final report: what changed, what was skipped, what is uncertain, bench numbers, next step (032 re-clarify). Stop; do not start the next feature.

---

## Dependencies and order

- **030 merged → Phase 1 → Phase 2 → stories → Phase 8.**
- **Inside Phase 2**: T003 → T004; T005 → T007; T006 → T008 (after T004); T009 → T010 (independent of the model work).
- **US1** first (shape node, tiles, export). **US2** needs only Phase 2 and 030's palette (can run beside US1 in another worktree; the palette file is shared, so merge US1's tile list first). **US3** needs US1's shape node. **US5** needs US1–US3. **US4** needs US1's palette tiles.
- **Priorities**: P1 = US1, US2; P2 = US3, US5; P3 = US4.

## Parallel examples

- Phase 2: T003, T005, T006, T009 start together.
- US1: T011–T015 in parallel; then T016–T021 (T017 and T020 in parallel once T010 exists).
- US2 alongside US1: T023–T026 in parallel, then T027 → T028 → T029.

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US1.** Users draw processes with real shapes, connectors meet the outlines, export matches. Check frames 120 / 122 / 123 (T022).
2. Add **US2** (Frame tool) to complete the P1 scope; it answers the founder's "draw the frame first" request.
3. Add **US3** (two forms) and **US5** (checks), then **US4** and Phase 8.
4. Keep commits small: one per task or tight group. Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
