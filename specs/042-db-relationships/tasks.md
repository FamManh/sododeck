# Tasks: Table Relationships

**Input**: design documents in `specs/042-db-relationships/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: 042 owns the relationship display settings; Keys keeps connected rows; drag creates n–1 with the dragged side optional and the target side optional only when the dragged column is nullable; single-column ends can be reconnected by drag; a drop on a table but not a row targets its single-column primary key) and one planning correction (FR-008: on straight lines the marks follow the line angle).
- [research.md](research.md) (R1–R20) and [data-model.md](data-model.md).
- [contracts/format-and-model.md](contracts/format-and-model.md) (`RelationshipDisplay`, `setRelationshipDisplay`, pure helpers) and [contracts/relationships-ui.md](contracts/relationships-ui.md) (roles, names, keys).
- [quickstart.md](quickstart.md). Design frames: 159 (relationships), 158 (long table anchors), 162 (zoom levels), 152 (Deck settings), 136 / 149 (relationship selected, context menu) in `docs/design/screens/`; values in DESIGN.md "Database pack" > "Crow's foot and ports".

**Blocked by 041.** Do not start before `specs/041-db-table-card` is implemented and merged (`TableLayout`, `tableLayout`, `TableBody`, `table-keys.ts`, `tableDisplay`, the Deck settings Database section, the bench `tables` option). **Coordinate with 050** (connector editing): if 050 is merged first, US7 plugs into its end handles; if not, into today's `routing/route-handles.tsx`, and the PR notes the follow-up.

**Tests are required.** Constitution VI: unit tests for every pure module and model op; component tests (Testing Library) by role and name from contracts/relationships-ui.md; round-trip and concurrency cases for the format addition. Write each test first and watch it fail. No new Playwright tests; the smoke suite must pass.

**Scope guards**:

- **No React Flow handle per row** (R1). Row anchors come from `rowAnchorY` on 041's `TableLayout`; never measure the DOM (§g-58, ADR 0016).
- **One geometry**: canvas, the drag hit test and export call the same pure helpers in `apps/app/src/editor/relationships/` and `routing/relationship-path.ts`.
- **Hover changes no React Flow object**: column highlight goes through 034's hover-focus stylesheet.
- **Ordinary connectors unchanged**: card-to-card connectors keep their knob, arrow, anchors, bundling and connection rules.
- **Deck card look only** (DB3); tokens only; marks in the line colour; states never by colour alone.
- **Out of scope**: relationship drawer / toolbar / context-menu settings, composite creation (043); lint (047); SQL export (045); row limit and Show all (048); enum links; R / W markers (049).
- Do not name other diagram or database tools anywhere.

**Approvals**: no new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for `deck-edge.tsx`, `deck-to-flow.ts`, `canvas.tsx`, handles and drags.
- **Schema / model**: `packages/schema/…`, `packages/model/…`; read their `CLAUDE.md`.
- **Commits**: `feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`. No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Confirm 041 is merged into `main` (and check whether 050 is); rebase `042-db-relationships` on `main`; run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green baseline
- [x] T002 Add a `rel` option to `apps/app/src/bench/generate-deck.ts` on top of 041's `tables` option (every table-to-table edge gets `fromColumns` / `toColumns` on real FK / PK column ids, `cardinality: "n-1"`, `fromOptional: true`; about 200 edges for 150 tables; include 5 self-references and 5 pairs with two FKs), with a test in `apps/app/src/bench/generate-deck.test.ts`; wire `rel` in `apps/app/src/routes/bench-page.tsx` and `BENCH_REL` in `apps/app/bench/perf.bench.ts`
- [x] T003 Run `BENCH_TABLES=150 pnpm bench` and `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` before any drawing change; save both summaries as `specs/042-db-relationships/bench-before.md` (relationships draw as plain connectors at this point)

---

## Phase 2: Foundational (format, model op, pure geometry)

**Purpose**: the file addition, the model op, and the pure layer every story uses. Blocks all stories.

### Format and model

- [x] T004 [P] Add parity fixtures to `packages/schema/test/fixtures.ts`: valid (`relationshipDisplay: {}`, every key) and invalid (`labels: "sometimes"`, `notation: "crow"`, `hideEnds: "yes"`, unknown key `showLabels`); watch the invalid ones fail to be refused
- [x] T005 Add `$defs/RelationshipDisplay` and root `relationshipDisplay` (after `tableDisplay`) to `packages/schema/schema/v1.json` with descriptions, per contracts/format-and-model.md; run `pnpm schema:generate`; extend `packages/schema/examples/full.sododeck.json` with `relationshipDisplay: { "labels": "always" }`; `pnpm --filter @sododeck/schema test` green
- [x] T006 [P] Add model tests: round-trip in `packages/model/test/round-trip.test.ts` (every key; a deck without it stays byte-identical after an unrelated edit); ops in `packages/model/test/db-schema.test.ts` (`setRelationshipDisplay` set / change / clear with `null`, `false` and defaults; empty → removed; invalid value refused with nothing written; one undo step); concurrency in `packages/model/test/concurrency.test.ts` (two docs set `labels` and `notation`, both kept)
- [x] T007 Implement `meta.relationshipDisplay` (lazy `Y.Map`, per-key writes) in `packages/model/src/read.ts` / `write.ts` / `deck.ts`, `setRelationshipDisplay` next to `setTableDisplay` in `packages/model/src/ops/table-display.ts`, a `relationshipDisplayOf(file)` reader; wire into `packages/model/src/editor.ts` and `index.ts`; T006 green

### Pure layer (apps/app)

- [x] T008 [P] Extend `apps/app/src/editor/table-layout.test.ts` and `table-keys.test.ts`: `connectedColumns` (both sides, composite, self, non-table ends ignored, cached by `edges` identity); at Keys a referenced non-key column (e.g. a unique column on the `to` side) is drawn and excluded from `hidden.count`; `rowAnchorY` returns the row centre (`rowsTop + 24 i + 12`) at All and Keys, the "+n" pill centre for a hidden column, the title centre at Names and for a missing column id
- [x] T009 Implement `connectedColumns(deck)` in `apps/app/src/editor/table-keys.ts`; in `apps/app/src/editor/table-layout.ts` keep connected rows at Keys, expose `rowsTop`, `pillTop`, `titleCenter` on `TableLayout`, add `rowAnchorY(layout, columnId)`; T008 green; existing 041 tests still green (update the Keys expectations only where a row is now connected)
- [x] T010 [P] Write `apps/app/src/editor/relationships/relationship-ends.test.ts`: `relationshipSides` (facing sides both ways; horizontal overlap → shorter side, right on tie; self → right / right); `endOf` for `1-1`, `1-n`, `n-1`, `n-n` × `fromOptional` / `toOptional` and no cardinality; `relationshipEnds(edge, layouts)` offsets for single, composite (visible members only; ≤ 1 visible → single end), mismatched composite lengths, hidden and missing columns; `isRelationship` (column ends or a cardinality between two tables; card-to-card edges false)
- [x] T011 Implement `apps/app/src/editor/relationships/relationship-ends.ts` (`isRelationship`, `relationshipSides`, `endOf`, `relationshipEnds`) per data-model.md; T010 green
- [x] T012 [P] Write `apps/app/src/editor/routing/relationship-path.test.ts`: curved and elbow paths start and end with a 24 straight stub along the side normal and pass `route.points`; straight path is the direct line with tangents along the line; composite end draws 6 px member stubs, the joining segment and starts the stub from its midpoint; `selfLoopPath` bulge `max(56, Δy / 2)` on the right side and never enters the card box; `labelAt` on the path
- [x] T013 Implement `apps/app/src/editor/routing/relationship-path.ts` (`relationshipPath`, `selfLoopPath`) on top of `connectorPath` / `pointsToPath` in `routing/connector-geometry.ts`; T012 green
- [x] T014 [P] Write tests in `apps/app/src/editor/edge-end-marks.test.ts` for crow and text marks: `crowPath(at, u, kind)` toes at p ± 6v → p + 12u, bar 16 at 10 / 8 / 16, ring r 4 at 17 (zero-one) and 20 (zero-many); rotation for left, right and an angled straight line; text marks "1", "0..1", "1..n", "0..n" positions; `endMarks` returns no knob / arrow for a relationship
- [x] T015 Implement crow and text marks in `apps/app/src/editor/edge-end-marks.ts` (`EndMark` kinds `crow` and `card-text`, `crowPath`) with constants in `edge-constants.ts` (`CROW_LEN 12`, `CROW_SPREAD 6`, `CROW_BAR 16`, `CROW_RING 4`, bar and ring offsets); T014 green
- [x] T016 [P] Write `apps/app/src/editor/relationships/relationship-label.test.ts`: `relationshipLabel` (name only; "ON DELETE RESTRICT"; `no-action` and absent omitted; composite "(order_id, product_id)"; "n–n"; joined with " · "); `relationshipName` ("Relationship orders.customer_id to customers.id, many to one, on delete restrict"; composite; n–n "many to many"; missing column names fall back to the table)
- [x] T017 Implement `apps/app/src/editor/relationships/relationship-label.ts`; T016 green

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` green; nothing visible has changed yet.

---

## Phase 3: User Story 1 - See relationships between columns (Priority: P1) 🎯 MVP

**Goal**: relationships leave and reach the exact column rows, facing each other, with crow's foot ends in the line colour, on all three line types.

**Independent Test**: load the "Shop" deck; compare `orders.customer_id` → `customers.id` and frame 159 rows A and F in light and dark; drag `customers` across `orders` and watch the sides switch.

### Tests for User Story 1 (write first)

- [x] T018 [P] [US1] Add cases to `apps/app/src/editor/deck-to-flow.test.ts`: a relationship edge gets `data.rel` (offsets, kinds, marks) and `left` / `right` handles; card-to-card edges are unchanged; the edge cache returns the same object until an end table's layout or the edge changes; a connector between tables without columns but with a cardinality gets marks and outline anchors (US1 scenario 8)
- [x] T019 [P] [US1] Write `apps/app/src/editor/deck-edge.relationship.test.tsx`: the relationship edge renders a path from the row anchors, mark images named "zero or many" / "exactly one", no knob and no arrow, the palette colour on line and marks, plain ends without a cardinality, and the accessible name from `relationshipName`

### Implementation for User Story 1

- [x] T020 [US1] In `apps/app/src/editor/deck-to-flow.ts` `toFlowEdges`: detect `isRelationship`, build `data.rel` from both tables' `cachedTableLayout` (041) and `relationshipEnds`, set `sourceHandle` / `targetHandle` to the `left` / `right` side handles from `relationshipSides` on the stored boxes, `reconnectable: false`, and add the layout identities to the per-edge cache check; T018 green
- [x] T021 [US1] Add the relationship branch to `apps/app/src/editor/deck-edge.tsx`: resolve absolute end points from the live boxes (`boxAt`) and `data.rel` offsets, choose sides live with `relationshipSides`, build the path with `relationshipPath`, draw marks through `edge-ends.tsx`, set `aria-label`; keep selected / flow / highlight stroke rules; T019 green
- [x] T022 [US1] Draw crow marks in `apps/app/src/editor/edge-ends.tsx` (one `<path>` per end plus a `<circle>` ring filled with the canvas token, round joins and caps, `<title>` with the mark name); verify against frame 159 A at 100 % and 200 %

**Checkpoint**: US1 works: Shop's single-column relationships read correctly on curved, elbow and straight lines.

---

## Phase 4: User Story 2 - Create a relationship by dragging from a column (Priority: P1)

**Goal**: drag from a row port onto a row (or a table's single-column PK) creates an n–1 relationship in one undo step; a keyboard path does the same.

**Independent Test**: on two unconnected tables drag `orders.customer_id` onto `customers.id`, check the JSON panel, undo; repeat with the keyboard (row focus, C).

### Tests for User Story 2 (write first)

- [x] T023 [P] [US2] Write `apps/app/src/editor/relationships/type-mismatch.test.ts` (type case-insensitive, size, enum vs same / other enum, equal → undefined) and `apps/app/src/editor/relationships/column-target.test.ts` (`columnTargetAt`: row hit on another table and on the same table; header / title over a table with a single-column PK → that PK; composite PK or no PK → none; empty canvas → none; uses `rowAnchorY` geometry at the current layout)
- [x] T024 [P] [US2] Add `columnConnectionCheck` cases to `apps/app/src/editor/connection-rules.test.ts` (self-reference allowed; second FK between the same tables allowed; same column pair same direction → `{ ok: false, existing }`; source row itself refused; card-to-card `connectionCheck` unchanged)
- [x] T025 [P] [US2] Add `connectColumns` cases to `apps/app/src/editor/canvas-actions.test.ts`: writes `from`, `to`, `fromColumns`, `toColumns`, `cardinality: "n-1"`, `fromOptional: true`, `toOptional` only when the source is nullable (not `notNull`, not `pk`), `style.shape` from the last line shape; one undo removes it and redo restores the same id; duplicate selects the existing edge and writes nothing
- [x] T026 [P] [US2] Write `apps/app/src/editor/table/table-ports.test.tsx` and extend `apps/app/src/editor/connect-popover.test.tsx`: ports are buttons named "Connect customer_id"; ↓ / ↑ move row focus inside a focused table and Esc returns to the card; C on a focused row opens the popover in column mode (`listbox` "Connect customer_id to", PK options first, typing filters) and Enter calls `connectColumns`

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement `apps/app/src/editor/relationships/type-mismatch.ts` and `apps/app/src/editor/relationships/column-target.ts`; T023 green
- [x] T028 [P] [US2] Add `columnConnectionCheck` to `apps/app/src/editor/connection-rules.ts`; T024 green
- [x] T029 [US2] Add `connectColumns(source, target)` to `apps/app/src/editor/canvas-actions.ts` (one `oneStep`, select, announce "Relationship created" like `connectComponents`); T025 green
- [x] T030 [US2] Add `columnConnect` and `focusedRow` UI state to `apps/app/src/state/ui-store.ts` (UI only, never in the deck or undo)
- [x] T031 [US2] Add ports and row roving focus to 041's `apps/app/src/editor/table/table-body.tsx` (`data-row="tableId:columnId"`, two port buttons per row with 24 px hit area and `nodrag nopan`, CSS visibility on row hover / connecting / selected relationship, `data-connect-target` on the target row), styles with tokens only
- [x] T032 [US2] Implement `apps/app/src/editor/editing/column-connect-drag.ts` (pointer down on a port, 4 px threshold, flow-coordinate pointer tracking, `columnTargetAt`, `typeMismatch`, Esc cancels, release commits through `connectColumns`) and `apps/app/src/editor/editing/column-connect-line.tsx` (ghost line in a `ViewportPortal` and the `status` chip "Types differ: int → uuid" next to the target row); mount in `apps/app/src/editor/canvas.tsx`
- [x] T033 [US2] Add the column mode to `apps/app/src/editor/connect-popover.tsx` and the C key on a focused row in `apps/app/src/editor/use-canvas-shortcuts.ts`; T026 green

**Checkpoint**: US1 + US2: a schema can be drawn and connected by pointer and keyboard.

---

## Phase 5: User Story 3 - Follow a column's relationships (Priority: P1)

**Goal**: hovering or focusing a column lights its relationships, the rows at their other ends and those tables; the rest dims.

**Independent Test**: hover and keyboard-focus `orders.customer_id`, a PK referenced three times, and an unrelated column; compare with frame 159 E.

### Tests for User Story 3 (write first)

- [x] T034 [P] [US3] Add `columnFocusSet` cases to `apps/app/src/editor/focus-set.test.ts` (edges, members, `rows` at both ends; three relationships on one PK; undefined for an unrelated column) and row selector cases to `apps/app/src/editor/hover-focus/hover-focus-css.test.ts` (lit rows, dimmed others; relationship hover / selection lights its end rows)
- [x] T035 [P] [US3] Add a component test in `apps/app/src/editor/hover-focus/use-hover-focus.test.tsx`: a row with relationships sets `hoverFocus` with `source: 'column'` after the rest delay; focus does the same; a row without relationships does not; pinned focus mode or a playing flow keeps its look and only the row highlight is added

### Implementation for User Story 3

- [x] T036 [US3] Implement `columnFocusSet` in `apps/app/src/editor/focus-set.ts` and the `column` source in `apps/app/src/editor/hover-focus/use-hover-focus.ts` (rows via `data-row`, same 150 ms rest and 100 ms grace)
- [x] T037 [US3] Extend `apps/app/src/editor/hover-focus/hover-focus-css.ts` with lit-row selectors (Orange Soft fill and name weight 600, tokens only) and edge-hover / selection row lighting; respect `CanvasView.focus` and flows (FR-024); T034–T035 green

**Checkpoint**: all P1 stories done (MVP for review).

---

## Phase 6: User Story 4 - Read special shapes (Priority: P2)

**Goal**: self-reference loops, composite brackets, parallel FKs and n–n draw as frame 159 B, C, D and G.

**Independent Test**: load a deck with `categories.parent_id`, `shipment_items (order_id, product_id)`, the two `addresses` keys and `products` ↔ `categories` n–n; compare with frame 159.

- [x] T038 [P] [US4] Add cases to `apps/app/src/editor/deck-edge.relationship.test.tsx` and `apps/app/src/editor/bundles.test.ts`: self-reference draws the loop path; composite draws member stubs and one connector; two relationships between the same tables at ≥ 90 % are two edges (no bundle); n–n has many marks at both ends and its label includes "n–n"; mismatched composite lengths render without errors
- [x] T039 [US4] Wire `selfLoopPath` and composite ends into the relationship branch of `apps/app/src/editor/deck-edge.tsx` (and `data.rel` in `deck-to-flow.ts` for self edges)
- [x] T040 [US4] Make `foldable()` in `apps/app/src/editor/bundles.ts` take the level: relationship edges with a visible column end never fold at Container / Component; T038 green

---

## Phase 7: User Story 5 - Keep relationships readable at every detail level and zoom (Priority: P2)

**Goal**: rows that stay visible keep their lines; hidden columns anchor on the pill or title; below 90 % lines run table to table and bundle "×n".

**Independent Test**: on "Shop", switch deck detail All → Keys → Names, set one table to Names, zoom through the four levels, collapse a group; compare with frames 158 and 162.

- [x] T041 [P] [US5] Add cases to `apps/app/src/editor/deck-to-flow.test.ts` and `apps/app/src/editor/bundles.test.ts`: Keys keeps connected rows and their offsets; Names anchors on the title; a hidden column anchors on the "+n" pill; System / Landscape use outline anchors with marks kept and two relationships between one pair fold into a bundle with "×2"; edges into a collapsed group become merged connectors as today; switching detail never leaves an end on a row that is not drawn
- [x] T042 [US5] In `apps/app/src/editor/deck-to-flow.ts` and `apps/app/src/editor/deck-edge.tsx`, use outline anchors (`connectorPath` with automatic sides) for relationships below 90 % and pass the level to `bundleEdges` / `foldable`; T041 green

---

## Phase 8: User Story 6 - Choose what relationships show (Priority: P3)

**Goal**: Deck settings control cardinality ends, label visibility and notation, stored in the deck.

**Independent Test**: change each setting, reload, open a second tab, export; check the canvas follows.

- [x] T043 [P] [US6] Add cases to `apps/app/src/editor/deck-to-flow.test.ts` (label visibility for follow / hover / always / off × Labels tool × focus; `hideEnds` → plain ends; `numeric` → text marks) and `apps/app/src/editor/inspector/deck-inspector.test.tsx` ("Show on relationships": switch "Cardinality ends", combobox "Labels", radiogroup "Notation"; each change one undo step)
- [x] T044 [US6] Apply `relationshipDisplayOf(deck)` in `apps/app/src/editor/deck-to-flow.ts` (label mode, `hideEnds`, `notation` into `data.rel.marks`) and draw text marks in `apps/app/src/editor/edge-ends.tsx` (Mono 10.5, line colour)
- [x] T045 [US6] Add the "Show on relationships" controls under 041's Database section in `apps/app/src/editor/inspector/deck-inspector.tsx` using `packages/ui` `switch`, `select` and `segmented-control`, writing through `editor.setRelationshipDisplay` in `oneStep`; T043 green

---

## Phase 9: User Story 7 - Move or remove a relationship end (Priority: P3)

**Goal**: a selected relationship's single-column end can be dragged to another row; composite ends snap back with a hint; delete and undo work.

**Independent Test**: retarget the `customers` end onto `accounts.id` and onto another `customers` row; try a composite end; delete and undo.

- [x] T046 [P] [US7] Add `reconnectColumnEnd` cases to `apps/app/src/editor/canvas-actions.test.ts` (other table: `from|to` and `fromColumns|toColumns` change, every other field kept, one undo step; same table: only the column changes; composite end refused with nothing written) and a component case for the end handles in `apps/app/src/editor/routing/route-handles.test.tsx` (handles sit at the row anchors; composite end announces "Edit composite column ends in the details drawer"; ⌫ deletes and ⌘Z restores the same id)
- [x] T047 [US7] Add `reconnectColumnEnd(edgeId, end, target)` to `apps/app/src/editor/canvas-actions.ts`
- [x] T048 [US7] Draw relationship end handles at the row anchors in `apps/app/src/editor/routing/route-handles.tsx` (or 050's end-handle component if merged) and run `column-connect-drag.ts` in `reconnect` mode with the other end fixed; no side sliding for column ends; T046 green

---

## Phase 10: Export (FR-027, serves US1, US4, US6)

- [x] T049 [P] Add cases to `apps/app/src/editor/export/scene.test.ts` and `apps/app/src/editor/export/render-svg.test.ts`: `SceneEdge.rel` built with the same helpers as the canvas (anchors, sides, path, marks, loop, composite); labels exported for `always` and for `follow` with the Labels tool on, not for `hover` / `off`; `numeric` text marks; no `<foreignObject>`; keep `scene.perf.test.ts` within budget with 150 tables / 200 relationships
- [x] T050 Build relationship geometry in `apps/app/src/editor/export/scene.ts` / `export/edge-geometry.ts` and draw marks, rings and text marks in `apps/app/src/editor/export/render-svg.ts`; T049 green; export the Shop deck to SVG and PNG and compare with the canvas (SC-007)

---

## Phase 11: Polish and cross-cutting

- [x] T051 Run `BENCH_TABLES=150 pnpm bench` and `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` again; save `specs/042-db-relationships/bench-after.md`; pan / zoom / drag within 10 % of the plain-connector board (SC-006) and column hover within one frame (SC-005); if not, profile and fix before continuing
- [x] T052 [P] Docs: amend `docs/decisions/0029-database-pack-model.md` with `relationshipDisplay` and "row anchors are computed, not handles"; DESIGN.md "Crow's foot and ports" (stub length 24, straight-line marks follow the line angle, 1 / n text marks); `apps/app/CLAUDE.md` map (`relationships/`, `routing/relationship-path.ts`, `editing/column-connect-drag.ts`); `.agents/skills/react-flow/SKILL.md` (relationship edges draw from computed row anchors, `reconnectable: false`); `packages/schema/CLAUDE.md` and `packages/model/CLAUDE.md` (042 entries)
- [x] T053 [P] Update `docs/backlog-database.md`: 042 status (built, spec path); 043 no longer owns the relationship display switches (clarify 2026-10-04); 048 note that hidden-column anchors move from the "+n" pill to "Show all"
- [x] T054 [P] Accessibility pass: keyboard-only walkthrough (quickstart step 5), mark names, warning chip as text, lit rows distinguishable without colour (name weight); record in `specs/042-db-relationships/quickstart-results.md`
- [x] T055 Run the definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; no `.only` / `.skip`; grep the diff for other tool names
- [x] T056 Final report in `quickstart-results.md` and the PR description: what changed, screenshots (light / dark) against frame 159, bench before / after, what was skipped or uncertain (050 coordination), next step (043)

---

## Dependencies and order

- **041 merged → Phase 1 → Phase 2 → stories → Export → Polish.**
- Phase 2: T004 → T005; T006 → T007 (needs T005); T008 → T009; T010 → T011 (needs T009); T012 → T013 (needs T011); T014 → T015; T016 → T017.
- **US1** needs Phase 2. **US2** needs US1 (T020–T021: something to see after creating) and T009 (`rowAnchorY` for the hit test). **US3** needs US1 and T031's `data-row` (from US2), or adds `data-row` itself if done first. **US4** needs US1. **US5** needs US1 and T040. **US6** needs US1 and T007. **US7** needs US2 (drag) and US1. **Export** needs Phase 2 and is best after US4 / US6 (same marks and labels).
- **Priorities**: P1 = US1, US2, US3; P2 = US4, US5; P3 = US6, US7.

## Parallel examples

- Phase 2: T004, T006, T008, T010, T012, T014, T016 together (tests); then T005 → T007, T009 → T011 → T013, T015, T017.
- US2: T023, T024, T025, T026 together; then T027 and T028 together; T029 → T032 → T033.
- After US2: US3 (T034–T037), US4 (T038–T040), US6 (T043–T045) and Export (T049–T050) touch mostly different files; `deck-edge.tsx` is shared by US4 and US5 and `deck-to-flow.ts` by US5 and US6, so run those in sequence.
- Polish: T052, T053, T054 together.

## Implementation strategy

1. **MVP = Phases 1–3 (US1)**: relationships read correctly. Commits: `feat(schema): relationship display (042)`, `feat(model): relationship display op (042)`, `feat(app): relationship geometry and crow's foot ends (042)`.
2. **+ US2, US3**: create by drag / keyboard and follow a column: all P1 done.
3. **+ US4, US5**: special shapes and every detail level / zoom.
4. **+ US6, US7, Export**: settings, reconnect, images.
5. **Polish**: bench, docs, ADR amendment, accessibility, DoD, report. One PR, small commits.
