# Research: Semantic Zoom, Collapsible Groups and Focus Mode (010)

Decisions taken while planning. Spec: [spec.md](spec.md) (clarified 2026-09-27, 2 answers). Code read on `main` at `324d1bd`: `editor/canvas.tsx`, `deck-to-flow.ts`, `canvas-geometry.ts`, `group-boundary-node.tsx`, `zoom-control.tsx`, `canvas-toolbar.tsx`, `top-bar.tsx`, `use-canvas-shortcuts.ts`, `use-canvas-handlers.ts`, `outline.ts`, `flows/flow-overlay.ts`, `state/ui-store.ts`, `src/bench/generate-deck.ts`, and the project skill `.agents/skills/react-flow`.

## R1 — One pure "visible graph" derivation

- **Decision**: add `editor/visible-graph.ts`, a pure function `visibleGraph(deck, scope, collapsed)` that returns what the canvas shows: the visible nodes, the group boundaries, the collapsed-group cards, the plain edges, the merged edges and the port pills (contract: [contracts/visible-graph.md](contracts/visible-graph.md)). `toFlowNodes` / `toFlowEdges` take its result instead of the whole deck. `Canvas` memoizes it on `[deck, scope, collapsed]`.
- **Algorithm**: O(nodes + edges + groups).
  1. Compute each group's effective parent. Cycles go to the root, like `outline.ts`.
  2. Compute each node's effective parent node. A missing or cyclic `parent` is dropped (spec edge case).
  3. Decide the scope members. The scope is `{ node, group }`, taken from the drill stack: `node` is the last node frame (or null), and `group` is the last group frame after it (or null). Members are the nodes whose effective parent equals `node` (none when null) and, when `group` is set, that lie in its subtree. Groups are drawn only when some member lies in their subtree.
  4. Map each member to a _representative_: the outermost collapsed group on its group chain inside the scope, or the node itself.
  5. Map each edge to `(rep(from), rep(to))`:
     - both ends are the same card: the edge is hidden but counted in that card;
     - both ends are plain nodes: it stays a plain edge;
     - otherwise: it is merged under the key `sorted(repA, repB)`.
  6. An edge with exactly one end outside the scope becomes a port pill.
- **Rationale**: the backlog `/speckit.plan` hint asks for one pure, unit-tested, memoized function. Every rule in the spec (FR-004, FR-010–FR-013, FR-021–FR-022) is then testable without React. The derivation stays on the main thread. Constitution V targets heavy work such as layout and large imports. This pass is linear and under 2 ms for 500 nodes and 1,000 edges (measured in the bench, SC-002). A worker round-trip would add latency to every collapse click.
- **Alternatives**:
  - React Flow `hidden` flags on nodes and edges: these cannot merge edges and would still ship 1,500 objects.
  - A worker: rejected for the latency reason above.
  - Storing representatives in Zustand: rejected because they are derived data.

## R2 — Level from zoom

- **Decision**:
  - `levelForZoom(zoom)` is a pure helper in `editor/levels.ts`. Thresholds compare whole percents, like the zoom control: ≤ 45 Landscape, ≤ 90 System, ≤ 150 Container, else Component.
  - `Canvas` reads it with one module-scope `useStore` selector. The value is discrete, so the canvas re-renders only when the band changes.
  - When the drill scope's top is a node, `effectiveLevel` returns `component`.
  - The level goes into each node's `data.level`, and into group boundaries for the Landscape region style.
  - To avoid flicker at a boundary, the selector applies a 2-percentage-point hysteresis around the current level. The level only changes once zoom is 2 points past the threshold. This keeps the band table exact for discrete zoom steps (10% buttons, menu) and stops a trackpad pinch hovering at 45–46% from flipping the level every frame.
- **Rationale**: this is the project skill's "zoom-dependent rendering" recipe. Rebuilding objects on a band change is rare, and SC-002 allows 100 ms for it.
- **Alternatives**:
  - Reading the zoom in every node: rejected because it re-renders 500 nodes per frame.
  - Updating the level only on `onMoveEnd`: rejected because the level would lag during continuous zoom.

## R3 — Node sizes per level

- **Decision**:
  - At Landscape, System and Container, the box stays 164 × 50 (`NODE_SIZE`). Landscape draws a centred kind tile inside the same box.
  - At Component, cards get a fixed `COMPONENT_CARD_SIZE` of 164 × 104, so title, tech, owner, tags and the rule glyph fit (design 67).
  - The box stays anchored at its stored top-left, so a drag writes the same coordinates at every level with no conversion.
  - `groupBounds` and `selectionFrame` take the level's size.
  - The collapsed card is `COLLAPSED_CARD_SIZE`, 180 × 64, centred on the group's expanded bounds (spec Assumptions).
- **Rationale**: fixed sizes keep edge anchors and hit areas predictable, and group bounds pure. Keeping the top-left anchor avoids the drag conversion the skill warns about.
- **Alternatives**:
  - Letting React Flow measure the height: rejected because group bounds would then need measured sizes.
  - Centring the box on its position: rejected because it needs a conversion on every drag.

## R4 — Drill scope, breadcrumb and viewport

- **Decision**:
  - The UI store gains `drill: readonly DrillFrame[]`, where `DrillFrame = { kind: 'group' | 'node'; id: string; viewport: CanvasViewport }`. `viewport` is where the canvas was before entering that frame.
  - `drillInto(frame)` pushes a frame. `drillUp(toDepth?)` pops frames and restores the popped frame's viewport via `setViewport` (duration 0 under reduced motion).
  - Entering a scope fits the scope's bounds with `fitBounds(rect)` in `requestAnimationFrame`, zoom clamped 0.4–1.3 (design-analysis §"On open").
  - The top bar renders crumbs from `drill`: deck name (rename, unchanged), then "System view", then one crumb per frame; the last one is `aria-current="page"`. "System view" is a constant until 011 adds views.
  - A deck observer validates `drill` after removals. It pops to the deepest frame that still exists and has members (spec edge case) and announces "Went up to <title>".
- **Rationale**: the deck-name crumb already means "Rename deck" (003 FR-017, `DeckNameCrumb`), so the "go to top" crumb is the view crumb (spec FR-011, updated during planning).
- **Alternatives**: a URL segment per drill level was rejected. Drill state is UI state (§g-22), and 011 will define view URLs.

## R5 — Children visibility

- **Decision** (clarification Q1): a node with an effective parent is shown only in that parent's node scope. A node with children shows a child-count marker (`data.childCount`, e.g. `Layers` icon + "3"). The marker is also a double-click and Enter target.
- **Derived level** (FR-004): `node.level` if set, else depth 0 → `container` and depth ≥ 1 → `component`. It is shown in the inspector's read-only "Level" row and in the level-indicator tooltip.

**Consequence for the example deck**: in `packages/schema/examples/full.sododeck.json`, Order Service and Dispatch have `parent: delivery-platform`, so "Core services" first appears after drilling into Delivery platform. The breadcrumb is then "… › System view › Delivery platform › Core services". The backlog acceptance criterion ("Deck › System view › Core services") holds for decks whose group members have no `parent`, and the tests use such a fixture. This is the direct result of clarification Q1 and is noted in the quickstart.

## R6 — Selecting and focusing groups

- **Decision**:
  - Keyboard focus on groups: the roving focus (`focusedId`) accepts group node ids (`group:<id>` on the label, `collapsed:<id>` on the card). Arrow navigation includes label and card positions.
  - Selection model: `Selection` gains `groups: readonly string[]`. It is optional in the `select()` input, defaults to `[]`, and is handled by `pruneSelection`. Clicking a group label or a collapsed card selects the group.
  - Inspector: with only a group selected, the inspector routes to a new `GroupInspector` (title, member counts, Collapsed switch, merged-connections list, Expand group). The JSON Selection tab shows the group entry through the existing `serializeEntry('groups', …)`.
  - Delete: Delete / Backspace with only groups selected does nothing and announces "Groups can't be deleted from the canvas yet". Group editing is out of scope.
- **Rationale**: a collapsed card must be selectable (US2 AS4) and focusable (FR-026, FR-040). A separate `selectedGroup` field would fork the selection logic the inspector, JSON panel and pruning already share.
- **Alternatives**: making group boundaries selectable React Flow nodes was rejected. React Flow selection is off and ours is controlled, so the store field is the single place for it anyway.

## R7 — Merged edges and their popover

- **Decision**:
  - A new edge type `merged` in `editor/merged-edge.tsx`, with id `merged:<a>|<b>` (sorted representative ids).
  - It draws a 2.25 px `text-secondary` stroke (design-analysis §tokens), a `×N` pill and a direction icon: `ArrowRight` for one way, `ArrowLeftRight` for both ways.
  - Its `data.edgeIds` feeds the popover and flow badges.
  - Hover (150 ms delay) or keyboard focus opens `MergedEdgePopover`, built on the `@sododeck/ui` `Popover`. Rows show label or "from → to" plus direction. ↑ / ↓ move and Enter expands the group(s) and selects the edge.
  - `ui.popover` gains `{ kind: 'merged'; edgeId: string }`.
  - E from a focused card cycles its merged edges, as 003 does for plain edges.
- **Direction**: computed from the underlying edges' `from` / `to`, or both ways when `direction: 'both'`, relative to the pair order.

## R8 — Focus mode

- **Decision**:
  - The UI store gains `focusMode: boolean`. The focused element is the single selected node or group. `focusSet(graph, id)` is a pure helper returning the element, its direct neighbours by visible representative, and the connecting edge ids.
  - The canvas wrapper gets `data-focus-mode` when focus mode is on and an element is focused.
  - Only when focus mode is on, `toFlowNodes` / `toFlowEdges` set `dimmed: true` in `data` for elements outside the set. They also set `domAttributes: { 'aria-hidden': true, inert: true }` on dimmed nodes and `aria-hidden` on dimmed edges, and `className: 'in-focus'` on members.
  - CSS dims `[data-focus-mode] .react-flow__node:not(.in-focus)` and the matching edges and label pills to 0.2 opacity.
  - The focused element carries a visible ring (FR-034).
  - Connecting edges get their labels forced on.
- **Rationale**: the skill says to mark few objects and dim the rest with CSS. That handles the visuals, but accessibility (FR-032) needs a per-object `aria-hidden` / `inert`, so focus mode rebuilds objects once per toggle or selection change. That is acceptable under SC-002 and measured in the bench (`focus` scenario).
- **Alternatives**: `pointer-events: none` via CSS only was rejected because screen readers would still reach dimmed nodes.
- **Interplay**: entering 007 flow mode (`ui.openFlow`) or a 006 recording (`startRecording` / `startEditing`) sets `focusMode = false`, and the toggle is disabled while `isFlowMode(state)` or a flow session is active.

## R9 — Keyboard map

| Key                              | Where                                                | Action                                            |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Enter                            | focused group label / collapsed card                 | drill into group                                  |
| Enter                            | focused node with children                           | drill into node                                   |
| Enter                            | focused node without children / focused edge         | unchanged (003: inspector title / edge popover)   |
| Space                            | focused group label / collapsed card                 | toggle collapse                                   |
| F                                | canvas, no modifier, not in a text field, no session | toggle focus mode                                 |
| Backspace                        | nothing selected, not in text field, drilled         | up one level                                      |
| Esc                              | nothing selected, no popover / dialog, drilled       | up one level                                      |
| Backspace / Esc with a selection | anywhere on the canvas screen                        | unchanged (delete confirmation / clear selection) |

- **Flow mode (007, FR-038)**: `useCanvasKeyDown` today returns early in flow mode except for ⌘ zoom. 010 adds one exception before that return: Space on a focused group label or collapsed card toggles collapse. Enter-drill, F and Backspace-up do nothing in flow mode; Esc keeps calling `exitFlow()` and never goes up a level. ← → ↑ ↓ stay with `usePlaybackShortcuts`.
- **Where**: canvas-scoped keys (Enter, Space, F) go in `useCanvasKeyDown`. Backspace and Esc "up" go in `useEditorShortcuts` after the existing delete and clear branches, so the selection rules keep priority (FR-014).
- **React Flow**: `zoomOnDoubleClick={false}` and `onNodeDoubleClick` for drill-in (skill recipe step 6).

## R10 — Level indicator and menu

- **Decision**: `LevelIndicator` sits inside `ZoomControl`. It shows 4 bars, filled up to the current level, plus the level name, on a `DropdownMenu` trigger with an accessible name like "Level: System".
- **Menu**: the items are the four levels. Choosing one calls `zoomTo(mid)`, which zooms around the viewport centre. The band middles are Landscape 0.375, System 0.68, Container 1.2 and Component 1.75. While drilled into a node, the menu shows Component checked and the other items disabled.
- **Announcements**: level changes are announced through `ui.announce`, at most one per band change.

## R11 — Flows through collapsed groups (clarifications Q2 and Q3, 007 on `main`)

- **Decision**: `flowOverlay` is unchanged. A new pure `collapseFlowMarks(overlay, graph)` folds the existing edge marks into the derived graph:
  - A merged edge gets the union of its underlying edges' badges, in step order, with `current` kept.
  - A card gets `flowInside: 'current' | 'path' | undefined` from marks on its hidden internal edges.
- **Rendering**: the card shows a ring for `path` and ring + pulsing dot for `current`. Under reduced motion the dot is static, using `useReducedMotion` in a child component rendered only when `current`.
- **Current step on a merged edge**: when the folded marks include a `current` mark, the merged edge keeps it, so `MergedEdge` renders 007's current look and `FlowToken` exactly like `DeckEdge` does. On the path, merged edges get `data-in-flow` and cards get `className: 'in-flow'`, so the existing `[data-flow-mode]` CSS in `index.css` does not dim them.
- **Player text**: `groupAtStep(deck, graph, edgeId)` returns the outermost collapsed group title hiding a step's edge. `step-player.tsx` renders "inside <title>" after the step title, and `stepAnnouncement` in `played-path.ts` gains an optional `insideGroup` argument that appends ", inside <title>". Both read the same memoized `VisibleGraph` as the canvas.
- **Clicks in flow mode**: `use-canvas-handlers.ts` maps a `collapsed:<id>` click to the first played step whose edge is hidden in that group (`stepForGroup(played, hiddenEdges)`), and a `merged:<a>|<b>` click to `stepForEdges(played, underlyingEdgeIds, current)`, a multi-edge form of 007's `stepForEdge` (next after the current step, wrapping). Both are pure and live in `collapse-flow-marks.ts` so `played-path.ts` stays 007's.
- **Collapse during playback**: collapse / expand only changes `ui.collapsed`; `activeFlow.stepId` is untouched, so the derivation moves the highlight between the edge and the card.
- **Drilled when a flow opens**: `openFlow` in the UI store also sets `drill = []` and restores the top frame's viewport, then announces "Showing the whole deck for this flow". Port pills therefore never appear in flow mode.
- **Alternatives**: extending `flowOverlay` to know about groups was rejected: it would couple 006/007 code to the collapse state and bust its per-object cache on every toggle.

## R12 — Benchmark

- **Decision**: `generateBenchDeck` gains `options.groups`: 25 groups of 20 nodes, 5 of them nested under 5 parent groups, members laid out in their existing grid. The bench adds three scenarios:
  - `groups-collapsed`: all groups collapsed, pan/zoom fps (SC-001);
  - `collapse-toggle`: time to collapse and expand one group, and to cross a level band (SC-002);
  - `focus`: time to toggle focus.
- **Env**: `BENCH_GROUPS=1` also adds groups to the default scenarios.
- **Baseline**: run `pnpm bench` before any canvas change and after, and record both in `bench-before.md` / `bench-after.md`, as 008 did.

## R13 — What resets when

- Collapse, drill, focus and the level hysteresis state live in `useUiStore`. `resetForDeck()` clears them (deck switch, reload). They are not synced between tabs (§g-35 covers document edits only).
- Undo and redo do not touch them (FR-041). A document change that removes a drilled scope or a collapsed group prunes them (R4). `collapsed` ids of deleted groups are dropped by `pruneSelection`'s sibling `pruneView`.

## R14 — No schema, model or dependency change

- `level`, `parent`, `group` and `Group.parent` already exist in schema v1. Nothing in 010 writes to the deck.
- No new runtime dependency: `Popover`, `DropdownMenu` and `Switch` are already in `@sododeck/ui`. The icons (`Layers`, `ArrowRight`, `ArrowLeftRight`, `ChevronDown`, `ChevronRight`, `Focus`, `CornerLeftUp`) come from `lucide-react`.
