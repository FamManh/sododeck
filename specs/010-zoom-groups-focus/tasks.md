# Tasks: Semantic Zoom, Collapsible Groups and Focus Mode

**Input**: design documents in `specs/010-zoom-groups-focus/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27 (two answers).
- [research.md](research.md) (R1–R14) and [data-model.md](data-model.md).
- [contracts/visible-graph.md](contracts/visible-graph.md) and [contracts/zoom-groups-focus-ui.md](contracts/zoom-groups-focus-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI requires:

- unit tests (Vitest) for every pure module and store
- component tests (Testing Library, by role and label, following the UI contract) for user-visible behavior

Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay green unchanged.

**Scope guards**:

- No change to `packages/schema`, `packages/model` or `packages/ui`.
- Nothing in this feature writes to the deck or adds an undo step (FR-041).
- 007 (on `main`) is extended, not changed: `flowOverlay`, `playedPath` and the flow-mode CSS keep their contracts; 010 adds the "inside <group>" text and the flow-mode rules (FR-035–FR-039, clarification Q3).

**Approvals**: no new runtime dependency and no Complexity Tracking exception.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **App**: source in `apps/app/src/…`, with tests next to the code (`*.test.ts(x)`). The test harness is `apps/app/src/test/render-canvas.tsx` (`editorWrapper`, `deckOf`).
- **Canvas recipes**: `.agents/skills/react-flow/SKILL.md`. Follow them: synthetic ids get a prefix, caches check every outside input, there are no React Flow state hooks, and `zoomOnDoubleClick={false}`.
- **Commits**: after each task or logical group, using Conventional Commits (`feat(app): …`, `test(app): …`, `docs: …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `010-zoom-groups-focus` from the latest `main`. Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 Add `options.groups` to `generateBenchDeck` in `apps/app/src/bench/generate-deck.ts`:
  - 25 groups (`g0`…`g24`) of 20 consecutive nodes each;
  - 5 parent groups (`p0`…`p4`), each holding 5 of those groups through `Group.parent`;
  - nodes keep their grid positions.

  Add cases to `apps/app/src/bench/generate-deck.test.ts`: group count, members per group, parents, and determinism for a given seed.

- [x] T003 Extend `apps/app/bench/perf.bench.ts` (R12):
  - `BENCH_GROUPS=1` passes `groups: true` to every scenario.
  - Add a `groups-collapsed` scenario (all groups collapsed through the UI store before measuring pan/zoom fps). Until T027 lands, this scenario may be registered but skipped with a clear `TODO(010)` log line, not a skipped test.
  - Add `collapse-toggle` (ms from Space on a group label to the next painted frame, and ms to cross 90% → 91%) and `focus` (ms from F to the next painted frame).
- [x] T004 Run `pnpm bench` and `BENCH_GROUPS=1 pnpm bench` on the branch before any canvas change. Save both tables in `specs/010-zoom-groups-focus/bench-before.md`.
- [x] T005 [P] Write the ADR `docs/decisions/0010-visible-graph.md` in the 0006 header format. It covers:
  - one pure `visibleGraph` derivation (scope, representatives, merged edges, ports) memoized in `Canvas`
  - drill, collapse and focus as per-tab UI state (§g-22), with no document writes
  - children hidden until their parent is drilled into (clarification Q1)
  - the level from a discrete zoom selector with hysteresis
  - alternatives considered (R1, R2, R8): React Flow `hidden` flags, a worker, storing `collapsed` on the group, CSS-only dimming

---

## Phase 2: Foundational (blocks every user story)

### Pure modules (`apps/app/src/editor/`)

- [ ] T006 [P] Write `apps/app/src/editor/levels.test.ts` first, then implement `apps/app/src/editor/levels.ts` per [contracts/visible-graph.md](contracts/visible-graph.md) §levels:
  - `Level`, `LEVELS`, `LEVEL_NAMES`, `LEVEL_MID_ZOOM` (0.375 / 0.68 / 1.2 / 1.75);
  - `levelForZoom`: whole percents, 45 → landscape, 46 → system, 90 → system, 91 → container, 150 → container, 151 → component, and 30 / 200 at the limits;
  - `levelWithHysteresis`: holds `current` until the zoom is ≥ 2 points past a threshold (landscape at 46–47%, then system at 48%); discrete jumps land exactly on their band;
  - `effectiveLevel`: `component` when `scope.node !== null`;
  - `nodeLevel`: returns `node.level` if set, else parent depth 0 → container and ≥ 1 → component; cycles are treated as depth 0.
- [ ] T007 [P] Write `apps/app/src/editor/visible-graph.test.ts` first, with fixtures built by `deckOf`. It covers every guarantee in [contracts/visible-graph.md](contracts/visible-graph.md):
  1. The deck scope with nothing collapsed returns all nodes, groups and edges unchanged, with no merged edges or ports.
  2. Two groups joined by 12 edges, one collapsed, give one merged edge with `edgeIds.length === 12`; with both collapsed, one card-to-card merged edge.
  3. Edges inside a collapsed group are hidden and counted in `edgeCount`.
  4. `direction` is `a-to-b`, `b-to-a` or `both`, including `direction: 'both'` on an underlying edge.
  5. A nested outer group collapsed hides the inner card; expanding it restores the inner group's collapsed state (the `collapsed` set is untouched).
  6. Group scope: only subtree members, and ports for edges leaving the scope (one pill per outside node, with all its edge ids).
  7. Children (Q1): a node with `parent: P` is absent at the top level and in group scopes without `node === P`, and present in `{ node: P, group: null }`. `childCount.get(P)` is correct.
  8. Group boundaries are drawn only when a member of their subtree is visible (the `full.sododeck.json` case, research R5).
  9. Missing `group` / `parent` references and parent cycles (nodes and groups) never throw and are treated as absent.
  10. Same `deck`, `scope` and `collapsed` references return the identical object.
  11. `scopeOf(drill)` maps frames to `{ node, group }`.
  12. `scopeBounds` returns the union of what is shown, or null when empty.
  13. `validDrillDepth` stops at the first frame whose object is gone or has no members.
  14. A 500-node / 1,000-edge bench deck with groups derives in < 2 ms (median of 20 runs; a soft assertion logged, with a hard limit of 10 ms).
- [ ] T008 Implement `apps/app/src/editor/visible-graph.ts` to make T007 pass: `Scope`, `CollapsedCard`, `MergedEdge`, `PortPill`, `VisibleGraph`, `scopeOf`, `visibleGraph`, `scopeBounds`, `validDrillDepth`.
  - Use the algorithm of research R1 steps 1–6.
  - Reuse `groupBounds` for card rects.
  - Cache with a `WeakMap` keyed by the deck arrays and a key built from scope + sorted collapsed ids.
  - The file stays React-free.
- [ ] T009 [P] Write `apps/app/src/editor/focus-set.test.ts` first, then implement `apps/app/src/editor/focus-set.ts` (`focusSet`):
  - members are the element plus direct neighbours, by representative;
  - a collapsed card focuses with its merged neighbours;
  - a node not visible in the graph returns null;
  - `edges` holds both plain and merged edge ids between them.
- [ ] T010 [P] Write `apps/app/src/editor/collapse-flow-marks.test.ts` first, then implement `apps/app/src/editor/collapse-flow-marks.ts` (`collapseFlowMarks`, `groupAtStep`, `stepForGroup`, `stepForEdges`), research R11:
  - a merged edge's badges are the union of its underlying edges' `EdgeFlowMark.badges`, in step order, with `current` kept;
  - a card is `current` when the active step's edge is hidden inside it, `path` when any other shown-flow edge is, and absent otherwise;
  - a merged edge with any `inPath` underlying mark is `inPath`, and keeps a `current` mark (speed included) when one underlying edge is current;
  - `groupAtStep` returns the outermost collapsed group title, or null;
  - `stepForGroup` returns the first played step whose edge is in the card's `hiddenEdges`, or null;
  - `stepForEdges` returns the next played step on any of the edges after the current one, wrapping, and null off the path;
  - `EMPTY_OVERLAY` gives empty maps.
- [ ] T011 [P] Add `COMPONENT_CARD_SIZE` (164 × 104), `COLLAPSED_CARD_SIZE` (180 × 64) and `nodeSize(level)` to `apps/app/src/editor/canvas-geometry.ts`, with an optional `size` parameter on `groupBounds` and `selectionFrame`. Extend `apps/app/src/editor/canvas-geometry.test.ts`: component-level bounds are taller, and the default stays `NODE_SIZE`.

### UI store (`apps/app/src/state/ui-store.ts`)

- [x] T012 Write the new cases in `apps/app/src/state/ui-store.test.ts` first, then add to `apps/app/src/state/ui-store.ts` per [data-model.md](data-model.md) §2:
  - `Selection.groups` (default `[]` in `select`, `toggle`, `clearSelection` and `pruneSelection`, which gains a `groups` set);
  - `drill`, `drillInto` (clears selection and focus mode), `drillUp(depth)` (returns the popped frames);
  - `collapsed`, `setCollapsed`, `toggleCollapsed`, `expandAll`;
  - `focusMode`, `setFocusMode`;
  - the `{ kind: 'merged'; edgeId }` popover kind;
  - `pruneView(existing)`;
  - `resetForDeck()` resets all of them;
  - `startRecording`, `startEditing` and `openFlow` also set `focusMode = false` (research R8); `openFlow` also sets `drill = []` (T055 wires the viewport and announcement).
- [x] T013 Update every `Selection` consumer to compile and behave with `groups`. Existing tests must stay green:
  - `apps/app/src/editor/canvas.tsx` (`useSelectionSync` passes existing group ids to `pruneSelection`);
  - `apps/app/src/editor/json-panel-view.ts` (the Selection tab lists selected groups through `serializeEntry('groups', …)`);
  - `apps/app/src/editor/inspector.tsx` (a group-only selection routes to a placeholder until T033);
  - `apps/app/src/editor/use-canvas-shortcuts.ts` (Delete / Backspace with only groups selected does nothing and announces "Groups can't be deleted from the canvas yet").

  Add a case to `apps/app/src/editor/json-panel-view.test.ts` for a selected group.

### Canvas wiring with no visible change

- [x] T014 Change `toFlowNodes` / `toFlowEdges` in `apps/app/src/editor/deck-to-flow.ts` to take `(deck, graph, view, overlay)` per [contracts/visible-graph.md](contracts/visible-graph.md) §Changes:
  - render only `graph.nodes`, `graph.groups` and `graph.edges`;
  - add `level`, `childCount` and `dimmed` to `DeckNodeData`, and `level` to `GroupBoundaryData`, and include them in the cache checks;
  - declare the types `CollapsedFlowNode` (`collapsed-group`), `PortFlowNode` (`port`) and `MergedFlowEdge` (`merged`), and export `COLLAPSED_NODE_PREFIX`, `PORT_NODE_PREFIX` and `MERGED_EDGE_PREFIX`.

  Update `apps/app/src/editor/deck-to-flow.test.ts`: existing cases pass through a deck-scope graph, and new cases cover the cache identity when the level is unchanged and a rebuild when the level or `dimmed` changes.

- [x] T015 Wire `Canvas` in `apps/app/src/editor/canvas.tsx`:
  - read `drill`, `collapsed` and `focusMode`, and memoize `scopeOf` → `visibleGraph`;
  - add a module-scope `levelSelector` via `useStore`, using `levelWithHysteresis` with a ref to the last level, then apply `effectiveLevel`;
  - pass `view` to `toFlowNodes` / `toFlowEdges`;
  - set `zoomOnDoubleClick={false}`;
  - pass `graph.groups` sizes to `SelectionFrame` via the level.

  Canvas tests in `apps/app/src/editor/canvas.test.tsx` stay green, with the default state rendering exactly as before.

- [x] T016 Add `useViewSync` in `apps/app/src/editor/canvas.tsx`, next to `useSelectionSync`. After removals it calls `pruneView`, then, if `validDrillDepth` is below `drill.length`, `drillUp(depth)` and announces "Went up to <title>". Test in `apps/app/src/editor/canvas.test.tsx`: removing the drilled group (and undoing a group creation from another origin) goes up and announces it.
- [x] T017 Extend the roving focus (R6) in `apps/app/src/editor/canvas.tsx` and `apps/app/src/editor/use-canvas-shortcuts.ts`:
  - `focusedId` may be `group:<id>` (label), `collapsed:<id>` (card) or a node id;
  - arrow navigation includes label and card positions (label at the boundary's top-left, card at its rect);
  - `nodeElement` resolves the prefixed ids.

  Add cases to `apps/app/src/editor/use-canvas-shortcuts.test.tsx`: arrows reach a group label and a card.

**Checkpoint**: `pnpm --filter @sododeck/app test` is green, the canvas looks and behaves exactly as on `main`, and the pure modules are complete.

---

## Phase 3: User Story 1: Drill into a group and back out (P1) 🎯 MVP

**Goal**: double-click, or press Enter on, a group or a component with children to see only its members, fitted into view. The breadcrumb, port pills, Esc / Backspace and the outline "Up" row go back up.

**Independent Test**: on a deck with nested groups and one component with children, drill in by double-click, by label and by Enter. Go up by crumb, Esc and Backspace. Check visibility, the breadcrumb and the viewport at each step (spec US1, AS 1–6).

### Tests first

- [x] T018 [P] [US1] Write `apps/app/src/editor/drill-crumbs.test.tsx`:
  - with `drill = []` the nav "Breadcrumb" shows `Local / <deck> / System view`, with "System view" as `aria-current="page"`;
  - with two frames the last crumb is current;
  - clicking "System view" calls `drillUp(0)`;
  - the deck-name crumb still opens rename.
- [ ] T019 [P] [US1] Write the drill cases in `apps/app/src/editor/canvas.test.tsx`:
  - double-click on a group label, and Enter on the focused label, show only the members, and the breadcrumb reads "… / System view / Core services" (fixture without `parent`);
  - double-click on a node with children shows the children at Component level;
  - double-click on a node without children changes nothing;
  - port pills are named "Go to <title>", and activating one goes up and selects that node;
  - `serializeDeck` is unchanged and `canUndo` is false after drilling in and out (SC-005).
- [ ] T020 [P] [US1] Write the key-priority cases in `apps/app/src/editor/use-canvas-shortcuts.test.tsx` (FR-014):
  - Esc and Backspace with nothing selected go up one level;
  - Backspace with a selected node opens the delete confirmation and keeps the level;
  - Esc with a selection clears it and keeps the level;
  - Esc with a popover open closes the popover only;
  - at the top level, Esc and Backspace with nothing selected do nothing.
- [x] T021 [P] [US1] Write the scoped cases in `apps/app/src/editor/outline.test.ts`: `buildOutline(deck, scope)` lists only the scope members and prepends `{ type: 'up', title }` when drilled.

### Implementation

- [ ] T022 [US1] Implement drill-in in `apps/app/src/editor/use-canvas-handlers.ts`:
  - `onNodeDoubleClick`: a `group:` node or `collapsed:` card → `drillInto({ kind: 'group', … })`; a node with `childCount > 0` → `drillInto({ kind: 'node', … })`; otherwise nothing;
  - the current viewport is captured via `getViewport()` into the frame;
  - announce "Opened <title>".

  Then in `apps/app/src/editor/canvas.tsx`, after `drill` grows, call `fitBounds(scopeBounds(...))` in `requestAnimationFrame`, with zoom clamped 0.4–1.3 and duration 0 under reduced motion. After it shrinks, `setViewport(popped.viewport)`.

- [ ] T023 [US1] Make the group label a button in `apps/app/src/editor/group-boundary-node.tsx`:
  - `button` "<Title> group, <n> nodes", with `aria-expanded` and the tooltip "Double-click or ↵ to open";
  - a click selects the group (`select({ groups: [id] })`);
  - the boundary stays `pointer-events-none` except for the label.

  Extend `apps/app/src/editor/group-boundary-node.test.tsx`.

- [ ] T024 [US1] Add Enter drill-in to `useCanvasKeyDown` in `apps/app/src/editor/use-canvas-shortcuts.ts`: a focused `group:` / `collapsed:` id or a node with children drills in; other nodes and edges keep 003's behavior. Add Esc / Backspace "up" to `useEditorShortcuts` after the existing delete and clear branches: nothing selected, `drill.length > 0`, not in a text field or dialog, no popover open → `drillUp`, and announce "Back to <title>".
- [ ] T025 [P] [US1] Create `apps/app/src/editor/port-pill-node.tsx` (with `port-pill-node.test.tsx`):
  - a dashed pill `button` "Go to <outside title>", placed at the scope edge on the side facing the inside node(s);
  - click or Enter → `drillUp(length - 1)`, then select and focus `outsideNodeId` (or its representative);
  - register it as `port` in the `nodeTypes` of `apps/app/src/editor/canvas.tsx`;
  - derive port nodes and their edges (plain edges ending at the pill) in `apps/app/src/editor/deck-to-flow.ts`.
- [x] T026 [P] [US1] Create `apps/app/src/editor/drill-crumbs.tsx` (T018) and render it in `apps/app/src/editor/top-bar.tsx` on the canvas screen after `DeckNameCrumb`: "System view" (a constant with a `TODO(M4): view name from 011`) plus one button per frame. Extend `apps/app/src/editor/top-bar.test.tsx`.
- [x] T027 [US1] Scope the outline: `buildOutline(deck, scope)` in `apps/app/src/editor/outline.ts` (T021), and the "Up to <crumb>" `treeitem` in `apps/app/src/editor/outline-tree.tsx`, which calls `drillUp`. Extend `apps/app/src/editor/outline-tree.test.tsx`.
- [ ] T028 [US1] Show the child-count marker on components with children in `apps/app/src/editor/deck-node.tsx`: a `Layers` icon + n, named "<n> components inside, press Enter to open". Add the "No components in this group" empty state for an empty drilled scope in `apps/app/src/editor/canvas.tsx`, reusing the `EmptyCanvasCard` layout. Extend `apps/app/src/editor/deck-node.test.tsx`.

**Checkpoint**: US1 acceptance scenarios 1–6 pass. The deck is unchanged.

---

## Phase 4: User Story 2: Collapse a group into one box (P1)

**Goal**: collapse and expand groups. A collapsed group is one card with counts, its connections merge into ×N edges, a popover lists them, and the group inspector has a Collapsed switch.

**Independent Test**: two groups joined by 12 connections. Collapse and expand with the chevron, Space and the inspector switch. Check the ×12, the popover and the restore (spec US2, AS 1–5).

### Tests first

- [ ] T029 [P] [US2] Write `apps/app/src/editor/collapsed-group-node.test.tsx`:
  - the card is a `button` "<Title>, collapsed group, <n> nodes, <m> edges" with `aria-expanded="false"`;
  - the text "n nodes · m edges" is shown;
  - Space expands the group, and screen readers hear "<Title> expanded" via the announcer.
- [ ] T030 [P] [US2] Write `apps/app/src/editor/merged-edge.test.tsx` and `apps/app/src/editor/merged-edge-popover.test.tsx`:
  - the edge `aria-label` is "12 connections between <A> and <B>", with a "×12" pill and a direction icon (`ArrowRight` / `ArrowLeftRight` by `direction`);
  - the popover is a `dialog` "Connections between <A> and <B>" with a `listbox` of 12 `option`s named "<label or from → to>, <direction>";
  - ↑ / ↓ move, Enter expands the needed group(s) and selects that edge, Esc closes.
- [ ] T031 [P] [US2] Write `apps/app/src/editor/inspector/group-inspector.test.tsx`: heading "<Title>", a `switch` "Collapsed" that toggles, a "Merged connections" list (one row per merged edge with its count), and a `button` "Expand group". Nothing is written to the deck.
- [ ] T032 [P] [US2] Write the collapse cases in `apps/app/src/editor/canvas.test.tsx`:
  - Space on a focused group label collapses it, and focus moves to the card;
  - the chevron `button` "Collapse <Title>" is shown on hover and focus;
  - with 12 edges to another group, one merged edge is rendered, and expanding returns 12;
  - the JSON panel Deck text and `serializeDeck` do not change (US2 AS5, SC-005);
  - a node added to a collapsed group from another origin updates the counts without expanding.

### Implementation

- [ ] T033 [US2] Create `apps/app/src/editor/inspector/group-inspector.tsx` (T031) in `InspectorFrame`, and route a group-only selection to it in `apps/app/src/editor/inspector.tsx`, replacing the T013 placeholder. It uses `Switch`, `PanelSection` and `Button` from `@sododeck/ui`, and gets merged rows from the canvas's `visibleGraph` (called with the same memo inputs).
- [ ] T034 [US2] Add the chevron to `apps/app/src/editor/group-boundary-node.tsx`: a `button` "Collapse <Title>" with `ChevronDown`, visible on hover and `:focus-within`, calling `toggleCollapsed`. Space on a focused label toggles in `useCanvasKeyDown` (`apps/app/src/editor/use-canvas-shortcuts.ts`), and focus moves to `collapsed:<id>` / `group:<id>` after the toggle. Announce "<Title> collapsed" or "<Title> expanded".
- [ ] T035 [P] [US2] Create `apps/app/src/editor/collapsed-group-node.tsx` (T029): a node-sized stacked card (two offset layers behind, tokens only), the title and "n nodes · m edges", four handles like `DeckNode`, and an `aria-expanded="false"` label. Register it as `collapsed-group` in `apps/app/src/editor/canvas.tsx`. Derive cards in `apps/app/src/editor/deck-to-flow.ts` from `graph.cards`, with a per-group cache keyed by title, counts and rect, not draggable. Add the card stack CSS to `apps/app/src/index.css` if needed.
- [ ] T036 [P] [US2] Create `apps/app/src/editor/merged-edge.tsx` (T030): a `BaseEdge` with a 2.25 px `text-secondary` stroke passed through `data`, and an `EdgeLabelRenderer` pill "×N" with a direction icon and its own class for the focus-mode CSS. Register it as `merged` in `edgeTypes`, and derive merged edges in `apps/app/src/editor/deck-to-flow.ts` with facing handles and a cache keyed by the id, `edgeIds` and direction.
- [ ] T037 [US2] Create `apps/app/src/editor/merged-edge-popover.tsx` (T030) on the `@sododeck/ui` `Popover`, anchored at the pill, and render it in `apps/app/src/editor/canvas.tsx` next to `EdgePopover`. It opens on hover with a 150 ms delay and closes on leave, both through `ui.popover = { kind: 'merged', … }`. Row Enter or click → `expandAll(ends)`, then `select({ edges: [id] })`.
- [ ] T038 [US2] Route clicks and keys for the new prefixes in `apps/app/src/editor/use-canvas-handlers.ts` and `apps/app/src/editor/use-canvas-shortcuts.ts`:
  - clicking a `collapsed:` card selects the group;
  - `collapsed:` / `port:` nodes are skipped in drag, marquee and `onNodesChange`;
  - `merged:` edges are skipped in reconnect and in flow recording clicks (006 session: a merged edge click announces "Expand the group to record this step");
  - E from a focused card cycles its merged edges, and Enter on a focused merged edge opens the popover.

  Add cases to `apps/app/src/editor/use-canvas-shortcuts.test.tsx`.

- [ ] T039 [US2] Handle selection of hidden objects (spec edge case) in `apps/app/src/editor/canvas.tsx`: when collapsing hides selected nodes or edges, replace them with the group selection. When a drill hides them, clear them. Test in `apps/app/src/editor/canvas.test.tsx`.

**Checkpoint**: US2 acceptance scenarios 1–5 pass. The earlier US1 tests stay green.

---

## Phase 5: User Story 3: Focus on one component (P2)

**Goal**: the Focus toggle or F keeps the selected element and its direct neighbours bright, and dims the rest, which also becomes non-interactive and hidden from screen readers.

**Independent Test**: select a component and toggle Focus with F and the toolbar button. Change the selection, then check opacity, `aria-hidden` / `inert` and the ring (spec US3, AS 1–4).

### Tests first

- [ ] T040 [P] [US3] Write the Focus toggle cases in `apps/app/src/editor/canvas-toolbar.test.tsx`:
  - a `button` "Focus" with `aria-pressed` and the tooltip "Focus · F";
  - disabled with the tooltip "Not available while a flow is shown" while `flowSession` is set or `isFlowMode(state)` is true.
- [ ] T041 [P] [US3] Write the focus cases in `apps/app/src/editor/canvas.test.tsx`:
  - with a node selected and focus on, the non-neighbour node wrappers have `aria-hidden="true"` and `inert`, the neighbours don't, and the connecting edges show labels even with Labels off;
  - selecting a neighbour moves the focus;
  - F again or clearing the selection ends it;
  - F with no selection announces "Select a component to focus" and dims nothing;
  - entering flow recording turns focus off;
  - the deck is unchanged.

### Implementation

- [ ] T042 [US3] Add the Focus toggle to `apps/app/src/editor/canvas-toolbar.tsx`, next to Labels, using the lucide `Focus` icon and `setFocusMode`. Add the F key to `useCanvasKeyDown` in `apps/app/src/editor/use-canvas-shortcuts.ts`: no modifier, not in a text field, no session.
- [ ] T043 [US3] Apply focus in `apps/app/src/editor/canvas.tsx` and `apps/app/src/editor/deck-to-flow.ts`:
  - memoize `focusSet(deck, graph, focusId)` when `focusMode` is on and exactly one node or group is selected;
  - set `data-focus-mode` on the canvas wrapper;
  - members get `className: 'in-focus'`;
  - non-members get `data.dimmed = true` and `domAttributes: { 'aria-hidden': true, inert: true }` (nodes) or `aria-hidden` (edges, merged edges, ports);
  - connecting edges get `showLabel: true`;
  - end focus mode when the selection empties.
- [ ] T044 [P] [US3] Add the dimming CSS to `apps/app/src/index.css`: `[data-focus-mode] .react-flow__node:not(.in-focus)`, the edges without `in-focus`, and their label pill classes at 0.2 opacity with a `--sd-dur-*` transition, instant under `prefers-reduced-motion`. Add the focused element's visible ring (FR-034) in `apps/app/src/editor/deck-node.tsx` and `apps/app/src/editor/collapsed-group-node.tsx`, using the `focused` / `in-focus` data.

**Checkpoint**: US3 acceptance scenarios 1–4 pass.

---

## Phase 6: User Story 4: Level of detail follows zoom (P2)

**Goal**: the canvas changes its detail by zoom band, the level indicator in the zoom control names the level, and its menu jumps between levels.

**Independent Test**: step the zoom from 200% down to 30% and back. Check the level name and what each component shows per band, then use the menu (spec US4, AS 1–5).

### Tests first

- [ ] T045 [P] [US4] Write `apps/app/src/editor/level-indicator.test.tsx`:
  - a `button` "Level: System" with `aria-haspopup="menu"` and 4 bars (2 filled at System);
  - the `menu` has 4 `menuitemradio` items, with the current one checked;
  - choosing "Landscape" calls `zoomTo(0.375)`;
  - while drilled into a node, "Component" is checked and the other items are disabled.
- [ ] T046 [P] [US4] Write the per-level cases in `apps/app/src/editor/deck-node.test.tsx`:
  - Landscape renders only the kind tile;
  - System renders the title only;
  - Container renders title + tech;
  - Component renders title, tech, owner, tags and the rule glyph;
  - every level keeps the accessible name "<title>, <kind>".

  Add a case to `apps/app/src/editor/group-boundary-node.test.tsx` for the solid Landscape region with a large label.

- [ ] T047 [P] [US4] Write the zoom-to-level case in `apps/app/src/editor/zoom-control.test.tsx`: the level indicator is rendered inside the zoom control, and after `zoomTo(0.42)` it reads "Landscape" and the announcer says "Landscape level" once.

### Implementation

- [ ] T048 [US4] Create `apps/app/src/editor/level-indicator.tsx` (T045) on the `@sododeck/ui` `DropdownMenu`, with the 4-bar glyph built from tokens, and mount it in `apps/app/src/editor/zoom-control.tsx`. `Canvas` passes the effective level down; do not read the zoom per node. Announce level changes once per band change from `apps/app/src/editor/canvas.tsx` via `ui.announce`.
- [ ] T049 [US4] Render per level in `apps/app/src/editor/deck-node.tsx` (T046) from `data.level`:
  - at Landscape, the box keeps `NODE_SIZE` with a centred `KindTile`;
  - at Component, the size is `COMPONENT_CARD_SIZE`, the flow node's `width` / `height` come from `nodeSize(level)` in `apps/app/src/editor/deck-to-flow.ts`, and the owner comes from `node.owner` and tags from `TagChip`.

  Pass the level size into `groupBounds` / `selectionFrame` in `apps/app/src/editor/canvas.tsx`. Keep drags writing the top-left position unchanged (research R3).

- [ ] T050 [US4] Add the Landscape look to `apps/app/src/editor/group-boundary-node.tsx` and `apps/app/src/index.css`: a solid group fill, a large label, and faint edges via a `data-level="landscape"` attribute on the canvas wrapper plus CSS (not a flag on every edge).
- [ ] T051 [US4] Show the level in the component inspector: a read-only "Level" row with `nodeLevel(deck, id)` in `apps/app/src/editor/inspector/node-inspector.tsx`, marked "(derived)" when `node.level` is absent. Extend `apps/app/src/editor/inspector/node-inspector.test.tsx`.

**Checkpoint**: US4 acceptance scenarios 1–5 pass.

---

## Phase 7: User Story 5: Play a flow through a collapsed group (P3)

**Goal**: in 007 flow mode, a collapsed group lights up (ring, plus a pulsing dot for the current step), merged connections carry step badges and the token, the step player and announcement say "inside <group>", and only collapse / expand works among 010's controls (FR-035–FR-039, clarification Q3).

**Independent Test**: collapse a group that contains steps of a flow, open the flow, step with → through the steps inside and across the group, collapse / expand during playback, click the card and a merged connection (spec US5, AS 1–6).

### Tests first

- [ ] T052 [P] [US5] Write the flow render cases in `apps/app/src/editor/collapsed-group-node.test.tsx` and `apps/app/src/editor/merged-edge.test.tsx`:
  - a card with `flowInside: 'path'` shows a ring, and its name gains ", flow step inside";
  - `'current'` adds the dot, which has an animation class unless reduced motion is on (mock `useReducedMotion`);
  - a merged edge renders the folded step badges in order, with the current badge marked;
  - a merged edge with a `current` mark renders the thicker line and `FlowToken`; with `inPath` it has `data-in-flow`.
- [ ] T053 [P] [US5] Write the player text cases in `apps/app/src/editor/flows/step-player.test.tsx` and `apps/app/src/editor/flows/played-path.test.ts`:
  - with the current step's edge hidden in a collapsed "Core services", the player shows "inside Core services" after the title; expanding removes it;
  - `stepAnnouncement(deck, played, step, 'Core services')` ends with ", inside Core services"; without the argument the text is unchanged (existing cases stay green).
- [ ] T054 [P] [US5] Write the flow-mode interaction cases in `apps/app/src/editor/use-canvas-shortcuts.test.tsx` and `apps/app/src/editor/canvas.test.tsx`:
  - in flow mode, Space on a focused group label or card toggles collapse and `activeFlow.stepId` is unchanged;
  - in flow mode, Enter, double-click, F and Backspace do nothing; Esc exits flow mode and `drill` is unchanged;
  - clicking a collapsed card sets the current step to the first played step inside it; clicking a merged connection sets the next played step among its edges;
  - cards and merged edges on the path are not dimmed (`in-flow` / `data-in-flow`);
  - opening a flow while drilled empties `drill`, restores the top viewport and announces "Showing the whole deck for this flow" (`apps/app/src/editor/ui-store.test.ts` covers the store half).

### Implementation

- [ ] T055 [US5] In `apps/app/src/editor/ui-store.ts` and `apps/app/src/editor/flows/flow-mode.ts`, make `openFlow` go up to the whole deck when drilled: set `drill = []`, restore the bottom frame's viewport through the existing `canvasViewport` handle, and announce "Showing the whole deck for this flow". Collapse state is kept.
- [ ] T056 [US5] Fold the flow marks in `apps/app/src/editor/canvas.tsx`: memoize `collapseFlowMarks(overlay, graph)`, pass `marks` in `view`, and in `apps/app/src/editor/deck-to-flow.ts` set `data.flowInside` and `className: 'in-flow'` on cards and `data.flow` (with `inPath` / `current`) on merged edges; include both in the cache checks.
- [ ] T057 [US5] Render the ring and the dot in `apps/app/src/editor/collapsed-group-node.tsx`: the dot is a child component that is only mounted for `current` and uses `useReducedMotion` (static when reduced). Render the badges, current look and `FlowToken` in `apps/app/src/editor/merged-edge.tsx`, reusing the badge component, styles and `data-in-flow` from `apps/app/src/editor/deck-edge.tsx` (extract a shared `flow-badges.tsx` if needed).
- [ ] T058 [US5] Add the player text: `stepAnnouncement` in `apps/app/src/editor/flows/played-path.ts` gains an optional `insideGroup?: string` argument; `apps/app/src/editor/flows/step-player.tsx` reads `groupAtStep(deck, graph, step.step.edge)` from the canvas's memoized `VisibleGraph` (expose it through a small `useVisibleGraph` hook in `apps/app/src/editor/use-visible-graph.ts` if the player can't get it from props) and renders "inside <title>" as muted text; its announcement passes the title.
- [ ] T059 [US5] Flow-mode keys in `apps/app/src/editor/use-canvas-shortcuts.ts`: before the flow-mode early return, handle Space on a focused group label or card (toggle collapse). Guard Enter-drill and F with `!isFlowMode(state)`, and in `useEditorShortcuts` skip Backspace-up in flow mode; Esc keeps calling `exitFlow()` first.
- [ ] T060 [US5] Flow-mode clicks in `apps/app/src/editor/use-canvas-handlers.ts`: next to `stepForNode` / `stepForEdge`, map `collapsed:<id>` clicks to `stepForGroup` and `merged:` clicks to `stepForEdges`; `onNodeDoubleClick` does nothing in flow mode. Port pills can't appear (T055).
- [ ] T061 [US5] Make `LevelIndicator` in `apps/app/src/editor/level-indicator.tsx` keep working in flow mode (zoom only), and check that the Focus toggle from US3 is disabled via `isFlowMode(state)` (T040); add a `level-indicator.test.tsx` case for the menu in flow mode.
- [ ] T062 [US5] Update `specs/007-flow-playback/spec.md` Assumptions: collapsed groups are handled by 010 (FR-035–FR-039), replacing the "deferred to 010" notes.

**Checkpoint**: US5 acceptance scenarios 1–6 pass; 007's existing tests stay green.

---

## Phase 8: Polish and cross-cutting concerns

- [ ] T063 [P] Accessibility pass on every new surface:
  - keyboard only, following quickstart §3 steps 2–8;
  - visible focus on labels, chevrons, cards, pills, the level trigger, the popover rows and the Focus toggle;
  - a grayscale check: collapsed vs expanded, focused vs dimmed, current vs path ring;
  - every announcement from the UI contract;
  - `axe` via the existing a11y test helpers on the drilled, collapsed and focus states, in light and dark (SC-006).

  Fix gaps with tests.

- [ ] T064 [P] Update the docs:
  - `apps/app/CLAUDE.md`: the map rows for `visible-graph.ts`, `levels.ts`, `focus-set.ts`, `collapse-flow-marks.ts` and the new node, edge and popover files; a rule that drill, collapse and focus are UI state and never written, and that canvas objects come from `visibleGraph`;
  - `.agents/skills/react-flow/SKILL.md`: the map (visible graph, levels), the new prefixes `collapsed:`, `port:`, `merged:`, and the focus-mode `inert` / `aria-hidden` pattern.
- [ ] T065 Run `pnpm bench` and `BENCH_GROUPS=1 pnpm bench` again, and write `specs/010-zoom-groups-focus/bench-after.md` with the before and after numbers. The targets are:
  - `groups-collapsed` ≥ 60 fps average and p95 ≤ 16.7 ms (SC-001);
  - `collapse-toggle` and `focus` ≤ 100 ms (SC-002);
  - the default scenario regresses no more than 5%.

  A miss blocks the merge (constitution V).

- [ ] T066 Visual check: take screenshots at 1440×900, light and dark, of frames 13, 19 and 64–71 next to `docs/design/screens/`. Save them in `specs/010-zoom-groups-focus/screens/`, and list the differences in `specs/010-zoom-groups-focus/visual-check.md` (allowed: DESIGN.md tokens, lucide icons, the "System view" crumb constant).
- [ ] T067 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Confirm there are no skipped or `.only` tests, and walk through quickstart.md §2–§4.

---

## Dependencies and execution order

- **Phase 1**: T001 → T002 → T003 → T004. T005 can run in parallel with T002–T004.
- **Phase 2** blocks every story:
  - T006, T007, T009, T010 and T011 can run in parallel; T008 needs T006, T007 and T011;
  - T012 → T013;
  - T014 needs T008 and T012; then T015 → T016 → T017.
- **Stories**:
  - **US1** (T018–T028) needs only Phase 2.
  - **US2** (T029–T039) needs Phase 2. T034 builds on T023's label button, so do US1's T023 first, or pair them.
  - **US3** (T040–T044) needs only Phase 2. T044's ring in `collapsed-group-node.tsx` needs T035.
  - **US4** (T045–T051) needs only Phase 2.
  - **US5** (T052–T062) needs US2 (cards and merged edges) and T010's flow helpers; T061 also needs US3's toggle and US4's indicator. T058 and T059 touch 007 files (`flows/`, `use-canvas-shortcuts.ts`), so run 007's tests with them.
- **Polish** (T063–T067) comes after the stories that ship. T065 needs T003's scenarios to be active, and `groups-collapsed` needs T035.

```text
Setup ─ Phase 2 ─┬─ US1 (MVP) ─┐
                 ├─ US2 ─ US5 ─┤
                 ├─ US3 ───────┼─ Polish
                 └─ US4 ───────┘
```

## Parallel examples

- **Phase 2**: T006, T007, T009, T010 and T011 are different files, so they can run together. Then T008, and in parallel T012 → T013.
- **US1**: T018, T019, T020 and T021 (tests) together, then T025 and T026 in parallel with T022 → T024.
- **US2**: T029, T030, T031 and T032 together, then T035 and T036 in parallel, then T037 and T038.
- **US3 and US4** can go to separate agents after Phase 2. They share `deck-node.tsx` (T044 ring vs T049 levels), so merge carefully.

## Implementation strategy

1. **MVP**: Phases 1–3 (T001–T028), which delivers drill-in with the breadcrumb, port pills and keys (V-1 drill part). Demo it on a deck without `parent` and on `full.sododeck.json`.
2. **V-2**: add US2 (collapse and merged edges), then re-run the bench (`groups-collapsed`).
3. **V-3**: add US3 (focus mode).
4. **V-1 complete**: add US4 (semantic levels and the indicator).
5. **Flows**: add US5 (card ring, merged badges and token, player text, flow-mode rules).
6. Finish with Polish (T063–T067). The feature ships in one PR with small commits per task group. The final report lists what changed, what was skipped, what is uncertain, and the bench numbers.
