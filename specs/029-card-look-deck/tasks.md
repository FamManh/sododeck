# Tasks: Card Look "Deck"

**Input**: design documents in `specs/029-card-look-deck/`:

- [plan.md](plan.md) and [spec.md](spec.md), clarified 2026-10-03 (Q1–Q5) and the §g-66–§g-80 defaults.
- [research.md](research.md) (R1–R15) and [data-model.md](data-model.md) (`EdgeStyle`, write rules, derived `CardLayout`).
- [contracts/deck-look-ui.md](contracts/deck-look-ui.md) (action, roles and names the tests assert).
- [quickstart.md](quickstart.md). Visual reference: `DESIGN.md` "Card system (Deck)" and `docs/design/screens/117-…127-…`.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for every schema change.
- Component tests (Testing Library) by role and name, as listed in the contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **The only file-format change is `edge.style.shape`** (ADR 0022). No version bump, no layout change, no migration.
- **Size never depends on zoom** (§g-58). Level and the 60 % rule change only what is painted inside the same box.
- **Lift, tilt, lip and the fanned sheets are paint-only** (§g-74): never on the canvas library's node wrapper; hit tests, snapping, anchors, minimap and export use the plain box.
- **Every state keeps a non-colour cue** (constitution VII).
- **`fill` / `stroke` of the 13 colours stay 020's values** (§g-66).
- **Export stays light-only** (ADR 0016).
- **Out of scope**: playback look (035), shapes (031), fields (032), tag colours (033), packs (030), relationship styles / bundles / sliding ends (022, 034), connector colour, deck-wide default line type.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…` — read `packages/schema/CLAUDE.md` ("Editing v1.json") first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/` — read `packages/model/CLAUDE.md`: validate before writing, ops in `src/ops/`, no React / DOM imports.
- **UI tokens**: `packages/ui/src/styles/…`, tests in `packages/ui/test/` — read `packages/ui/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code — read `apps/app/CLAUDE.md` and use the `react-flow` skill for canvas changes.
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(ui): …`, `feat(app): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create the implementation branch from the latest `main` (at or after `c1c8acd`). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` to confirm a green start. Confirm the lucide names `Spline`, `CornerDownRight`, `Minus`, `Layers`, `TriangleAlert` exist in `apps/app/node_modules/lucide-react`; if one is missing, pick the closest icon and note it in `specs/029-card-look-deck/research.md` R9.
- [x] T002 Run `pnpm bench` on the unchanged code, then again with `BENCH_ROUTES=1`, `BENCH_COLOURS=1` and `BENCH_GROUPS=1`. Save the tables in `specs/029-card-look-deck/bench-before.md`. Also record `pnpm --filter @sododeck/app test scene.perf`.

---

## Phase 2: Foundational (tokens and pure building blocks)

**Purpose**: tokens and pure modules every story needs. Each is written test-first and leaves the suite green; nothing visible changes yet.

- [x] T003 [P] Extend `packages/ui/test/contrast.test.ts`: for each of the 13 colours, in light and dark, `--sd-card-{name}-ink` on `--sd-card-{name}-chip` ≥ 4.5:1 and `--sd-card-{name}-dot` on `--sd-card-{name}-fill` ≥ 3:1.
- [x] T004 Add the tokens to `packages/ui/src/styles/tokens.css` (light block and dark block): `--sd-card-{name}-chip|ink|dot` for the 13 colours (hex values from DESIGN.md "Extended palette"); `--sd-deck-edge` (`#b4b4ab` / `#5a5a53`), `--sd-deck-orange`, `--sd-deck-orange-soft` (`#fdeee4` / `#3a2214`), `--sd-deck-orange-ink` (`#b3480c` / `#ffb285`), `--sd-deck-text-selection` (`#fbd9c3` / `#6a3315`), `--sd-deck-dot-neutral`, `--sd-deck-dim` (0.22), `--sd-deck-lip` (3px), `--sd-deck-lip-hover` (5px), `--sd-deck-lip-drag` (6px). Make T003 pass.
- [x] T005 Map the new tokens in `packages/ui/src/styles/theme.css` (`--color-card-{name}-chip|ink|dot`, `--color-deck-*`), add `--radius-card: 14px` and `--radius-frame: 20px`. Run `apps/app/src/theme-vars.test.ts` and extend it if it lists token names explicitly.
- [x] T006 [P] Write `apps/app/src/editor/routing/route-path.test.ts` cases for a new `routedPath(shape, fromBox, toBox, sides, offset)` (research R4): for `curved`, `elbow`, `straight` the `ends.start` / `ends.end` are the same side midpoints for the same boxes and sides (Q4); `elbow` returns exactly today's `routedStepPath` path; `curved` control points lie on the side normals; `straight` is one `M … L …` segment; `ends.endDir` points into the target side for curved and elbow and along the line for straight; a self-loop (same box) returns a non-degenerate loop out of the right side into the top for every shape; when the gap is shorter than the 9px arrow, the path is empty and `ends` are still valid.
- [x] T007 Implement `routedPath` in `apps/app/src/editor/routing/route-path.ts` (keep `routedStepPath` for elbow; no canvas-library import in the new code so export can share it). Return `{ path, labelX, labelY, ends: { start, end, startDir, endDir } }`, with the line shortened by the arrow length at arrow ends. Make T006 pass.
- [x] T008 [P] Write `apps/app/src/editor/edge-ends.test.tsx`: `<EdgeEnds>` draws a 3.5px-radius knob at `start` and a filled arrow (9 long × 10 wide) at `end` for `direction` absent / `forward`; arrows at both ends for `both`; knobs at both ends for `none`; arrow rotation follows `endDir`; all marks `aria-hidden`.
- [x] T009 Implement `apps/app/src/editor/edge-ends.tsx` (pure SVG, colour via `currentColor`, 2px round-joined stroke) and replace `DOT_RADIUS` in `apps/app/src/editor/edge-constants.ts` with `KNOB_RADIUS = 3.5`, `ARROW_LENGTH = 9`, `ARROW_WIDTH = 10`. Make T008 pass.
- [x] T010 [P] Write `apps/app/src/editor/card-layout.test.ts` for `cardLayout(input, width)` (research R7): no stored size → width 184; height = 12 + 24 + 8 + titleLines × 18 + (description ? 8 + lines × 16.8 : 0) + (tags ? 8 + tag block : 0) + (children ? 8 + 24 : 0) + 12, rounded up to the 4px size step; title and description each capped at 3 lines; empty regions add nothing; a stored size keeps its width and height but never goes below the minimum (header + one title line + tag block + padding), with `titleLines` / `descriptionLines` reduced to what fits, title first; same result for every level; 500 cards computed in < 20 ms (warm cache).
- [x] T011 Implement `apps/app/src/editor/card-layout.ts`, wrapping text with canvas `measureText` and a cache keyed by `(text, width, font)` (same technique as `card-tags.ts`). Switch `apps/app/src/editor/card-tags.ts` `TAG_CHIP` to B's metrics (18 tall, padding 0 6, gap 4, Geist 10.5 / 500) and `apps/app/src/editor/card-text.ts` line heights to 18 (title) and 16.8 (description). Update their tests to the new metrics. Make T010 pass.
- [x] T012 Extend `apps/app/src/editor/style/card-style.ts` `resolveLook` / `CardLook` with `chip`, `ink`, `dot` (named colour → `var(--color-card-{name}-chip|ink|dot)`; custom hex → `chip = dot = hex`, `ink = readableText(hex)`; uncoloured → Surface 2 / Secondary / `--color-deck-dot-neutral`). Add the cases to `apps/app/src/editor/style/card-style.test.ts` first.

**Checkpoint**: tokens, geometry, ends, layout and look exist and are tested; the canvas still looks as before.

---

## Phase 3: User Story 1 - Existing decks open in the Deck look (Priority: P1) 🎯 MVP

**Goal**: every card, handle and connector renders in the Deck look; the deck file is unchanged.

**Independent Test**: open the demo deck and a pre-029 deck; compare with frames 117, 120, 121, 125 (light and dark); JSON identical before and after opening.

### Tests first

- [ ] T013 [P] [US1] Update `apps/app/src/editor/canvas-geometry.test.ts`: `cardSize` for a node without stored size returns 184 × `cardLayout` height at every level; a stored 017 size keeps its width; `COMPONENT_CARD_SIZE` is 184 × 128 and `COLLAPSED_CARD_SIZE` 184 × 112. Change the existing 164 / 50 expectations to the new values — do not skip them.
- [ ] T014 [P] [US1] Extend `apps/app/src/editor/deck-node.test.tsx` (by role and name): the header shows the type name (from `kindLabel`) next to the tile; the title is clamped to 3 lines and a tooltip with the full title appears when cut; the description shows up to 3 lines and is absent when empty; tags render as a `list` "Tags" of pills; a card with no description and no tags renders no description or tag elements; existing `role="group"` / `aria-label` / `aria-description` are unchanged.
- [ ] T015 [P] [US1] Extend `apps/app/src/editor/deck-edge.test.tsx`: the connector path comes from `routedPath` with stroke width 2 and class for `--color-deck-edge`; `EdgeEnds` is rendered with the edge's `direction`; selected and flow states keep their current widths and colours.

### Implementation

- [ ] T016 [US1] In `apps/app/src/editor/canvas-geometry.ts` set the default card width to 184 (`DECK_CARD_WIDTH`), compute heights through `cardLayout`, and update `COMPONENT_CARD_SIZE` (184 × 128) and `COLLAPSED_CARD_SIZE` (184 × 112). Keep `cardSize(node, level)` level-independent. Make T013 pass and fix any test that asserted the old sizes (`tidy-layout.test.ts`, `deck-to-flow.test.ts`, group fitting).
- [ ] T017 [US1] In `apps/app/src/editor/deck-to-flow.ts` pass the extended `CardLook` (chip / ink / dot), the type name, the description text (view subtitle field) and the `cardLayout` result in node data, and add them to the node cache check.
- [ ] T018 [US1] Rebuild the card body in `apps/app/src/editor/deck-node.tsx` per DESIGN.md "Card anatomy": radius 14 (`rounded-card`), 1.5px border in `--card-stroke` (Border-strong uncoloured), padding 12 / 13, gap 8; header row 24 tall with the type icon in a 24px tile (radius 8, `--card-chip` fill, icon 14 / stroke 2 in `--card-ink`), the type name (Geist 11.5 / 500, Muted, Secondary on a colour fill, ellipsis) and a right-aligned badge slot (pin; problem badge comes in US2); title Geist 14 / 600 / 1.28 clamped to `titleLines` with a title-only `Tooltip` when cut; description Geist 12 / 400 / 1.4 Secondary clamped to `descriptionLines`; tags as 18px pills (`--card-chip` / `--card-ink`, Geist 10.5 / 500). Weight 600 only inside the card. Make T014 pass.
- [ ] T019 [US1] Add the resting lip in `apps/app/src/index.css`: `.sd-card { box-shadow: 0 var(--lip, 3px) 0 0 var(--card-stroke); }` with no blur; replace `shadow-rest` / `hover:shadow-hover` on the card.
- [ ] T020 [US1] Restyle connection handles in `apps/app/src/index.css` `.sd-handle`: 12px round, Surface fill, 2px Secondary border; endpoint-target / hot side 16px `--color-deck-orange` with a 4px `--color-deck-orange-soft` halo. Keep `visibility: hidden` in flow mode. Update `deck-node.test.tsx` handle assertions if they check sizes.
- [ ] T021 [US1] Switch `apps/app/src/editor/deck-edge.tsx` and `apps/app/src/editor/routing/endpoint-connection-line.tsx` to `routedPath` (pass `'elbow'` for every edge for now, so lines look as today; T044 wires the stored shape) and `EdgeEnds`; stroke 2px `--color-deck-edge`, selected 2.5px Deck Orange. Make T015 pass.
- [ ] T022 [US1] Update the minimap in `apps/app/src/editor/canvas.tsx` only if its `nodeColor` / `nodeStrokeColor` need the new neutral tokens; card box sizes come from `cardSize` already. Note "no change" in the commit if none.
- [ ] T023 [US1] Add a component test to `apps/app/src/editor/canvas.test.tsx`: loading `apps/app/src/editor/demo-deck.ts` and serialising it before and after rendering gives identical JSON (SC-001).

**Checkpoint**: US1 is demonstrable on the demo deck: Deck frames, tags, handles, 2px connectors with arrows.

---

## Phase 4: User Story 2 - Card states read at a glance and without colour (Priority: P1)

**Goal**: hover, selected, problem, dimmed, dragging, connection target, children, neighbour and title editing in the Deck style, each with a non-colour cue.

**Independent Test**: put cards in each state on a test deck, compare with frame 122, and check in greyscale.

### Tests first

- [ ] T024 [P] [US2] Extend `apps/app/src/editor/deck-node.test.tsx`: a card with problems shows the ⚠ + count badge inside the header (not the corner disc), still `aria-hidden`, with problems in `aria-description`; selected + problem renders both the selection outline element/class and the problem outline element/class; the children pill reads "n inside" and keeps its `aria-label`; a connect target gets the target class and its hovered side handle the active class.
- [ ] T025 [P] [US2] Add `apps/app/src/editor/deck-states.test.ts` (pure): the CSS class list helper used by `DeckNode` returns `selected`, `has-problem`, `connect-target`, `connect-refused`, `current-step` combinations without one class replacing another (selected + problem, current step + problem).

### Implementation

- [ ] T026 [US2] In `apps/app/src/editor/deck-node.tsx` move the problem badge into the header badge slot as a 20px Clay Soft pill (`TriangleAlert` 12 + count, 11 / 600); render the problem outline as a sibling layer (1.5px dashed Clay, offset 4) so it coexists with selection; extract the class list into the T025 helper. Make T024 and T025 pass.
- [ ] T027 [US2] In `apps/app/src/index.css` add the state rules: selected `outline: 2px solid var(--color-deck-orange); outline-offset: 2px`; hover on the inner card element `transform: translateY(-2px)` and `--lip: var(--sd-deck-lip-hover)`; current flow step `--lip: 5px` with orange border and lift (playback look stays 035); `.react-flow__node.dragging .sd-card` `transform: rotate(-2.5deg)`, `--lip: 6px` and the Float shadow; connection target orange border; `.in-focus` (highlighted neighbour) border and lip in Secondary; transitions on `transform` and `box-shadow` disabled under `@media (prefers-reduced-motion: reduce)`. Transforms only on `.sd-card`, never on `.react-flow__node`.
- [ ] T028 [US2] Change the dim opacity for focus mode and saved-view dimming to `var(--sd-deck-dim)` (0.22) in `apps/app/src/index.css`; leave flow-mode dimming unchanged (035).
- [ ] T029 [US2] Restyle the "n inside" pill in `apps/app/src/editor/deck-node.tsx` as the last row (24 tall, Surface 2, `⏎` hint `aria-hidden`) and make `cardLayout` count it (already in T010 rules).
- [ ] T030 [US2] Apply the title style and `::selection { background: var(--color-deck-text-selection) }` to `apps/app/src/editor/quick-edit/card-title-input.tsx`; same wrapping as the static title. Extend its test for the max-lines rule.
- [ ] T031 [US2] Add a test to `apps/app/src/editor/editing/drag-session.test.ts` (or the existing drag test file): a drop position computed during a drag is identical with and without the `.dragging` tilt class on the card (FR-016).

**Checkpoint**: frame 122 states are reproducible; greyscale screenshot distinguishes selected and problem.

---

## Phase 5: User Story 3 - Choose a connector's line type (Priority: P1)

**Goal**: curved / elbow / straight per connector, from toolbar, context menu and drawer, for one or several connectors in one undo step; stored as `edge.style.shape`; new connectors use the tab's last pick.

**Independent Test**: select connectors, switch types through each entry point, undo, reload, export and re-import.

### Schema (tests first)

- [ ] T032 [US3] Add invalid fixtures to `packages/schema/test/fixtures.ts`: `edge.style.shape: "zigzag"`, `edge.style: {}` (expected via S7), `edge.style.fill` (unknown key). Add an edge with `"style": { "shape": "curved" }` and one with `"straight"` to `packages/schema/examples/full.sododeck.json` so `coverage.test.ts` sees the field.
- [ ] T033 [US3] In `packages/schema/schema/v1.json` add `$defs/EdgeShape` (enum) and `$defs/EdgeStyle` (`shape`, `additionalProperties: false`, `minProperties: 1`, descriptions per data-model), and `Edge.style` declared after `route`. Add semantic rule S7 "edge style has at least one key" in `packages/schema/src/semantic-rules.ts`. Run `pnpm schema:generate`; `pnpm --filter @sododeck/schema test` (parity, coverage, key order) must pass.

### Model (tests first)

- [ ] T034 [P] [US3] Write `packages/model/test/edge-style.test.ts`: `edgeShape` returns stored shape, else `elbow` with `route.offset`, else `curved`; `setEdgeShape([a, b, c], 'straight')` writes all three in one undo step; `curved` on an edge with offset stores `'curved'`; `curved` without offset deletes `shape` and the empty `style`; `route` is never changed (offset kept, then `elbow` restores it — Q2); an unknown id or invalid shape throws `DeckEditError` and writes nothing; `add('edges', { from, to, style: { shape: 'elbow' } })` stores it.
- [ ] T035 [US3] Implement `packages/model/src/edge-shape.ts` (`edgeShape`, `EdgeShape` type re-export) and `packages/model/src/ops/edge-style.ts` `setEdgeShape(ctx, edgeIds, shape)` (validate all first, one `ctx.transact`, nested `style` `Y.Map` key by key, drop when empty). Add `edgeStyle` to `packages/model/src/validate.ts` `ELEMENT_SCHEMAS`; expose `DeckEditor.setEdgeShape` in `packages/model/src/editor.ts`; export from `packages/model/src/index.ts`. Make T034 pass.
- [ ] T036 [US3] In `packages/model/src/ops/shape.ts` pin `style.shape = 'elbow'` in the same transaction before clearing `route` (or its `offset`) when `edgeShape` is elbow and `shape` is absent. Add the cases to `packages/model/test/shape.test.ts` first.
- [ ] T037 [P] [US3] Add round-trip cases to `packages/model/test/round-trip.test.ts` (each shape; curved + offset; no style stays absent) and a concurrency case to `packages/model/test/concurrency.test.ts` (tab A sets `shape` while tab B moves `route.offset`: both survive).

### App (tests first)

- [ ] T038 [P] [US3] Extend `apps/app/src/editor/actions/connection-actions.test.ts` (create if missing) per the contract: `connection.lineType` applies to one edge and to 2+ edges only (`connections` target), not to mixed selections with cards; children "Curved", "Elbow", "Straight" as radio; checked child = shared effective shape, none when mixed; running it calls `setEdgeShape` once (one undo step), sets `lastLineShape`, and announces "Line type: Elbow" / "Line type: Elbow for 3 connectors".
- [ ] T039 [US3] Add the `connections` target kind in `apps/app/src/editor/actions/use-action-context.ts` `targetOf` (two or more edges, nothing else) and the matching variant in `apps/app/src/editor/quick-edit/toolbar-variant.ts`; update their tests so existing `connection` / `mixed` cases still pass.
- [ ] T040 [US3] Add `lastLineShape: EdgeShape` (default `'curved'`, memory only, no localStorage) and its setter to `apps/app/src/state/ui-store.ts`.
- [ ] T041 [US3] Implement `connection.lineType` in `apps/app/src/editor/actions/connection-actions.ts` (lucide `Spline`, `CornerDownRight`, `Minus`; `oneStep` + `editor.setEdgeShape`; announcer) and register it in `apps/app/src/editor/actions/index.ts`. Make T038 pass.
- [ ] T042 [US3] Show `connection.lineType` in the connection toolbar (`apps/app/src/editor/quick-edit/selection-toolbar.tsx`, trigger `aria-label` "Line type: Curved" / "Line type: mixed", `menuitemradio` items) and as a "Line type ▸" submenu in `apps/app/src/editor/quick-edit/canvas-menu.tsx`. Extend `selection-toolbar.test.tsx` and `canvas-menu.test.tsx` by role and name, including keyboard open / pick / Esc.
- [ ] T043 [US3] Drawer: in `apps/app/src/editor/inspector/edge-inspector.tsx` add a "Line" section with a `SegmentedControl` (`radiogroup` "Line type"); show `RouteFields` only when the effective shape is elbow. In `apps/app/src/editor/inspector.tsx` replace the edges-only "Select one item…" frame with "n connectors" plus the same `radiogroup` (no option checked when mixed). Tests in `inspector.test.tsx` / `edge-inspector.test.tsx`.
- [ ] T044 [US3] In `apps/app/src/editor/deck-to-flow.ts` add `shape: edgeShape(edge)` to `DeckEdgeData` and the edge cache check; `apps/app/src/editor/deck-edge.tsx` passes it to `routedPath` and renders `SegmentHandle` only when `shape === 'elbow'`; `apps/app/src/editor/actions/shape-actions.ts` `edge.resetRoute` applies only to elbow. Extend `deck-edge.test.tsx` and `deck-to-flow.test.ts`.
- [ ] T045 [US3] In `apps/app/src/editor/canvas-actions.ts` `connectComponents` pass `style: { shape: lastLineShape }` to `editor.add('edges', …)` when it is not `'curved'` (covers pointer and keyboard connect via `connect-popover.tsx`). Test in `canvas-actions.test.ts`: pick Elbow, connect → elbow in one undo step; fresh store → curved; undo / paste / opening another deck do not change `lastLineShape`.

**Checkpoint**: US3 complete; the JSON panel shows `style.shape`; round-trip proven.

---

## Phase 6: User Story 4 - Zooming keeps cards the same size and quiets dense boards (Priority: P2)

**Goal**: constant size, no lip below 60 %, tag dots at System, icon plate at Landscape.

**Independent Test**: zoom the bench deck 30 % → 400 % and compare with frame 123.

- [ ] T046 [P] [US4] Add `liplessSelector` (zoom < 0.6) tests next to `tinyCardsSelector` in `apps/app/src/editor/canvas.test.tsx` (or the selector's test file): the wrapper gets `data-lipless` below 0.6 and loses it at 0.6; no card component re-renders when crossing 0.6 (render counter on a memoized card).
- [ ] T047 [US4] Implement `liplessSelector` and the `data-lipless` wrapper attribute in `apps/app/src/editor/canvas.tsx`; in `apps/app/src/index.css` `[data-lipless] { --lip: 0px }` overriding hover, drag and current-step lips on cards, group frames and the fanned hand. Make T046 pass.
- [ ] T048 [P] [US4] Extend `apps/app/src/editor/deck-node.test.tsx`: at System the tags render as 6px dots (still a `list` "Tags" with a name per tag) and the type name / description are not painted; at Landscape only the type icon on the card fill is painted (no text, no handles); the card's width and height are identical at all four levels.
- [ ] T049 [US4] Implement the per-level painting in `apps/app/src/editor/deck-node.tsx` per research R8 (Landscape plate, System tile + title + dots, Container / Component full). Make T048 pass.

**Checkpoint**: frame 123 behaviour; no size change across levels.

---

## Phase 7: User Story 5 - Groups as a fanned hand and a Deck frame (Priority: P2)

**Goal**: collapsed group as a fanned hand met by merged connectors; expanded frame with a label pill.

**Independent Test**: collapse / expand groups on a test deck and compare with frame 119.

- [ ] T050 [P] [US5] Extend `apps/app/src/editor/collapsed-group-node.test.tsx`: the front card is a `button` with the unchanged `aria-label` and `aria-expanded="false"`; it shows "Group", the member count, the name and one tile per member (extra as "+n"); the two back sheets are `aria-hidden` and not focusable; Enter / double-click still expands.
- [ ] T051 [US5] Rebuild `apps/app/src/editor/collapsed-group-node.tsx` as the fanned hand (DESIGN.md "Groups"): 184 × 112, two back sheets rotated −7° / +4° around bottom centre with the group fill, stroke and lip (paint-only, `pointer-events: none`), front card with `Layers` tile, "Group" (11.5 / 500), count in a 26px Ink disc (13 / 700), name (14 / 600), member-kind tiles 22px. Pass member kinds from `collapsedNodes` in `apps/app/src/editor/deck-to-flow.ts`. Make T050 pass.
- [ ] T052 [US5] Switch `apps/app/src/editor/merged-edge.tsx` (and port edges) to `routedPath('curved', …)` + `EdgeEnds`, attached to the front-card box; keep the count badge and popover. Extend `merged-edge.test.tsx`.
- [ ] T053 [P] [US5] Extend `apps/app/src/editor/group-boundary-node.test.tsx`: the label is a pill button with the name and count; drop-target cue unchanged.
- [ ] T054 [US5] Restyle `apps/app/src/editor/group-boundary-node.tsx`: radius 20 (`rounded-frame`), 1.5px solid border (colour stroke or Border-strong), fill colour or Surface 2, label pill on the top edge (left 16, top −14, 28 tall, Surface, 1.5px border, 2px lip, chevron + name 12.5 / 600 + count in an 18px Ink disc). Make T053 pass.

**Checkpoint**: frame 119 reproducible; merged connectors meet the hand.

---

## Phase 8: User Story 6 - Exports match the canvas (Priority: P3)

**Goal**: PNG / SVG draw the Deck frame, lip, header, tags, line types and groups; resting state; light palette.

**Independent Test**: export the demo deck to SVG and PNG and compare with the light canvas at 100 %.

- [ ] T055 [P] [US6] Extend `apps/app/src/editor/export/scene.test.ts`: `SceneCard` carries `typeName`, `description`, `tags` and the `cardLayout` box (same size as the canvas); `SceneEdge` carries `shape` (from `edgeShape`) and `direction`; `SceneCollapsed` carries member kinds.
- [ ] T056 [US6] Implement the scene changes in `apps/app/src/editor/export/scene.ts`. Make T055 pass.
- [ ] T057 [P] [US6] Extend `apps/app/src/editor/export/render-svg.test.ts` and `edge-geometry.test.ts`: cards draw radius 14, a lip rect 3px below in the stroke colour, header tile + type name, title at weight 600, description, and one pill per tag (no empty tag area); edges use `routedPath` for each shape with arrow / knob per direction; collapsed groups draw three sheets; nothing hover / drag / selection related is drawn.
- [ ] T058 [US6] Implement in `apps/app/src/editor/export/render-svg.ts` (`card`, `edge`, collapsed and frame drawing) and `apps/app/src/editor/export/edge-geometry.ts` (use `routedPath` and the shared ends). Add the new tokens to `apps/app/src/editor/export/export-palette.ts` `LIGHT_PALETTE` (kept in sync by `export-palette.test.ts`), the `Layers` path to `icon-paths.ts` (drift test), and `'600 14px "Geist Variable"'` to `export-fonts.ts`. Make T057 pass.
- [ ] T059 [US6] Run `pnpm --filter @sododeck/app test scene.perf` and confirm scene + SVG stay under ADR 0016's 50 ms at 500 / 1,000; record the number in `specs/029-card-look-deck/bench-after.md`.

**Checkpoint**: exported SVG / PNG of the demo deck match the canvas.

---

## Phase 9: Polish & Cross-Cutting

- [ ] T060 [P] Add `BENCH_LINE_TYPES=1` to `apps/app/bench/perf.bench.ts` (one third each of curved, elbow, straight). Run `pnpm bench` with the T002 flags plus `BENCH_LINE_TYPES=1`; save `specs/029-card-look-deck/bench-after.md` with before / after tables. A regression in pan FPS or long frames beyond noise blocks merge unless the founder accepts it (constitution V).
- [ ] T061 [P] Docs: `DESIGN.md` (components `node`, `edge`, handle and groups now point at "Card system (Deck)" as what ships; remove the old 3px dashed error-ring text; Typography "600 only inside Deck cards"); `docs/decisions/0022-schema-roadmap.md` (Connections row confirmed, R2 storage rule, reset-route pinning, S7); `docs/decisions/0016-export-rendering.md` Consequences (tags and three line types drawn).
- [ ] T062 [P] Package docs: `packages/model/CLAUDE.md` (`edgeShape`, `setEdgeShape`, reset-route pinning), `packages/schema/CLAUDE.md` (S7), `apps/app/CLAUDE.md` if it lists canvas modules (`card-layout.ts`, `edge-ends.tsx`, `routedPath`).
- [ ] T063 Visual check: capture the demo deck and a test deck in light and dark for rows 117–126 into `specs/029-card-look-deck/screens/`, and write `specs/029-card-look-deck/visual-check.md` listing each frame, match / deviation, and the §g note for each deviation (SC-008). Include a greyscale capture of selected + problem (SC-003).
- [ ] T064 Walk `specs/029-card-look-deck/quickstart.md` manual scenarios 1–10 and record results in `specs/029-card-look-deck/quickstart-results.md`.
- [ ] T065 Run the definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. No skipped or `.only` tests.
- [ ] T066 Update `docs/backlog.md` §029 with a status line (implemented, date, link to spec, bench summary, open items) and the feature table row.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** first (T002 bench before any code change).
- **Phase 2** blocks every story (tokens, `routedPath`, `EdgeEnds`, `cardLayout`, `CardLook`).
- **Phase 3 (US1)** blocks US2, US4 and US5 (they restyle the rebuilt card and frames).
- **Phase 5 (US3)** depends only on Phase 2 and can run in parallel with Phase 3; T044 touches `deck-edge.tsx` after T021, so finish T021 first.
- **Phase 4 (US2)**, **Phase 6 (US4)**, **Phase 7 (US5)** after Phase 3, in any order.
- **Phase 8 (US6)** after Phases 3, 5 and 7 (it draws cards, line types and hands).
- **Phase 9** last; T060 after all canvas work.

### Within phases

- Phase 2: T003 → T004 → T005; T006 → T007; T008 → T009; T010 → T011; T012 after T004.
- Phase 3: T013–T015 → T016 → T017 → T018 → T019, T020 → T021 → T022, T023.
- Phase 5: T032 → T033 → T034 → T035 → T036, T037 → T038 → T039, T040 → T041 → T042, T043 → T044 → T045.
- Phase 7: T050 → T051 → T052; T053 → T054.
- Phase 8: T055 → T056 → T057 → T058 → T059.

### Parallel opportunities

- Phase 2: T003, T006, T008, T010 (four files).
- Phase 3 tests T013, T014, T015.
- Phase 5 schema / model (T032–T037) alongside Phase 3 app work.
- T046 with T048; T050 with T053; T055 with T057; T060, T061, T062.

## Parallel Example: Phase 2

```text
Task: "Extend packages/ui/test/contrast.test.ts for chip/ink/dot"           (T003)
Task: "Write apps/app/src/editor/routing/route-path.test.ts for routedPath"  (T006)
Task: "Write apps/app/src/editor/edge-ends.test.tsx"                         (T008)
Task: "Write apps/app/src/editor/card-layout.test.ts"                        (T010)
```

## Parallel Example: US1 and US3

```text
Developer / agent A: Phase 3 (T013–T023) — card frame, handles, connector look
Developer / agent B: Phase 5 schema + model (T032–T037) — no app files touched
```

## Implementation Strategy

### MVP first (User Story 1)

Phases 1–3: every deck opens in the Deck look with unchanged JSON. Stop and compare with frames 117, 120, 121, 125.

### Incremental delivery

1. Phases 1–3 (US1) → demo.
2. Phase 4 (US2 states) and Phase 5 (US3 line types, the only format change).
3. Phase 6 (US4 zoom rules) and Phase 7 (US5 groups).
4. Phase 8 (US6 export).
5. Phase 9 (bench, docs, visual check, DoD).

One PR for all phases is fine; keep commits per task or small task group.

## Notes

- If an existing test asserts old sizes (164 × 50, 20px tags, 12px radius), update it to the Deck value; never skip it.
- Never put a transform on the canvas library's node wrapper; it owns the position.
- A level change already re-renders cards; the 60 % rule must not add another re-render (T046).
- Stop after T066. 035 (playback look) is the next feature in the order.
