---
description: 'Task list for 003-canvas-basic (Basic Canvas Editing)'
---

# Tasks: Basic Canvas Editing

**Input**: Design documents from `specs/003-canvas-basic/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (incl. Clarifications 2026-09-27: cloud/partner kinds deferred), [research.md](research.md) (R1–R13), [data-model.md](data-model.md), [contracts/model-additions.md](contracts/model-additions.md), [contracts/canvas-ui.md](contracts/canvas-ui.md), [quickstart.md](quickstart.md). 002 is merged (`d3974cc`).

**Tests**: Required (constitution VI). Write each task's tests first, see them fail, then implement.

- **Unit (Vitest)**: pure functions and stores, in `*.test.ts` next to the code in `apps/app`, and in `test/` in packages.
- **Component (Testing Library)**: query by role and label from [contracts/canvas-ui.md](contracts/canvas-ui.md), never by class names.
- **E2E**: **no new Playwright e2e tests** (constitution VI, TODO(e2e)). The smoke suite (`apps/app/tests/e2e/smoke.spec.ts`) must stay green without edits; its hooks are listed at the end of canvas-ui.md.

**Read first**:

- `AGENTS.md`, `apps/app/CLAUDE.md`, `packages/model/CLAUDE.md`, `packages/ui/CLAUDE.md`, `DESIGN.md`.
- ADR 0005 (document layout and delete policy).

**Hard rules for every task**:

- Document data is read only through `useDeckSnapshot` and written only through the `DeckEditor` (`useEditor()`). Never copy it into Zustand, React state or React Flow state.
- UI uses tokens only, `lucide-react` icons, and `focusRing` from `@sododeck/ui/lib/focus` on every interactive element.
- No new dependency.

**Commits**: Conventional Commits, small (`feat(app): …`, `feat(model): …`, `feat(ui): …`, `test(app): …`, `docs: …`). **No `Co-Authored-By:` or any AI attribution line** (AGENTS.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6 from spec.md

## Path Conventions

pnpm monorepo, repo-relative paths:

- `apps/app/src/…` (tests next to code)
- `packages/model/src|test/…`
- `packages/ui/src|test/…`

Run one package with `pnpm --filter @sododeck/<name> <script>`.

---

## Phase 1: Setup

**Purpose**: Baseline and clean start. No behavior change.

- [x] T001 Clean start:
  - Check `git status`. `apps/app/src/editor/canvas.tsx` has an uncommitted `proOptions={{ hideAttribution: true }}` that is not Prettier-formatted: ask the founder whether to keep it (then `pnpm format`) or drop it.
  - Run `pnpm lint && pnpm typecheck && pnpm test` on `main` and confirm they are green before any change.
- [x] T002 Record the performance baseline:
  - Run `pnpm bench` (and `BENCH_CPU_THROTTLE=4 pnpm bench`).
  - Note both report paths in `apps/app/bench/results/`; they are the "before" numbers for the final report (constitution V).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Model additions, UI primitives, editor context, UI store, and a canvas that renders from `node.position` with controlled React Flow. **⚠️ No user story work starts before this phase is done.**

### Model additions ([contracts/model-additions.md](contracts/model-additions.md))

- [x] T003 [P] Write `packages/model/test/snapshot.test.ts` (failing first):
  - Parity: after every operation used in `test/edit.test.ts`, `cascade.test.ts`, `rules.test.ts` and after undo/redo, `snapshot.get()` deep-equals `toJSON(doc)`.
  - Structural sharing: after `update('nodes', id, { title })`, every other element of `get().nodes` and the `get().edges` array are the same references (`toBe`) as before.
  - `subscribe` fires exactly once per transaction, after `get()` is updated; unsubscribe and `destroy()` stop it.
  - Remote change (a plain `doc.transact` with no editor origin) is also reflected.
- [x] T004 Implement `createDeckSnapshot(doc)` in `packages/model/src/snapshot.ts` (research R1):
  - Start from `toJSON(doc)`.
  - Subscribe with `observeDeck`. For each `ObjectChange`, rebuild only that object with the same per-object conversion and canonical key order `toJSON` uses (reuse helpers from `deck.ts`/`convert.ts`/`key-order.ts`; export internal helpers if needed, but not from `index.ts`).
  - For `meta`, rebuild the top-level fields. For a child change (step, column, row), rebuild the owning flow or rule.
  - Replace or insert the object in a new copy of its collection array, in document order. For a removal, filter it out.
  - Build a new top-level object and notify listeners.
  - Export it and `type DeckSnapshot` from `packages/model/src/index.ts`. Make T003 pass.
- [x] T005 [P] Add a snapshot budget to `packages/model/test/perf.test.ts`: on `largeDeck()`, one `update('nodes', id, { position })` plus the snapshot update must take < 2 ms median (× `SLACK` on CI), measured like the existing budgets.
- [x] T006 [P] Write `packages/model/test/preview.test.ts` (failing first). For each row of the cascade table in `specs/002-yjs-model/data-model.md` that applies to nodes, edges, groups, flows, features, views and stickies:
  - `previewRemoval(toJSON(doc), targets)` equals the merged `RemovalResult` of `editor.batch(() => targets.map(t => editor.remove(t.scope, t.id)))` on a copy.
  - The original doc is unchanged, and no undo step was added.
  - Multi-target: two nodes sharing an edge list that edge once in `removed`.
  - A target that no longer exists is skipped, not thrown.
- [x] T007 Implement `previewRemoval(file, targets)` in `packages/model/src/preview.ts` (research R5):
  - Build a throwaway doc with `fromJSON(file)` and a throwaway editor.
  - Remove all targets inside one `batch`, skipping targets already removed by an earlier cascade.
  - Merge the results, de-duplicating `removed`/`updated` by scope+id(+child) and `broken` by object+field+target, keeping the first-seen order.
  - Destroy the editor. Export it and `type RemovalTarget` from `packages/model/src/index.ts`. Make T006 pass.
- [x] T008 Update `packages/model/CLAUDE.md`: add `createDeckSnapshot` and `previewRemoval` to the API list and to the "Layout of `src/`" line.

### UI primitives (`packages/ui`)

- [x] T009 [P] Add the undo-toast duration:
  - `--sd-toast-undo: 6000ms` in `packages/ui/src/styles/tokens.css`. It is not shortened under reduced motion, like `--sd-toast`.
  - `toastUndoMs: 6000` in `packages/ui/src/lib/motion.ts`.
  - Extend the existing CSS/TS motion parity test in `packages/ui/test/` to cover it.
  - Document the token in `packages/ui/CLAUDE.md` ("Tokens added by …").
- [x] T010 [P] Write `packages/ui/test/popover.test.tsx` (failing first):
  - Opens and closes, controlled via `open` / `onOpenChange`.
  - Esc and outside click close it.
  - Focus moves into the content and returns to the anchor or trigger.
  - Content gets an accessible name from `aria-label`.
  - Passes the `tokens-only` test.
- [x] T011 Create `packages/ui/src/components/popover.tsx`:
  - Export `Popover`, `PopoverTrigger`, `PopoverAnchor` and `PopoverContent`, wrapping Radix Popover from the existing `radix-ui` package (shadcn conventions: `data-slot`, `cn`).
  - Style: surface, border, `rounded-panel`/DESIGN.md popover radius, `shadow-hover`, 12 px padding, tokens only.
  - Add it to the `/design` gallery in `apps/app/src/design-gallery/overlays-section.tsx` and to the components table in `packages/ui/CLAUDE.md`. Make T010 pass.

### Editor context and UI state (`apps/app`)

- [x] T012 [P] Write `apps/app/src/model/editor-context.test.tsx` (failing first):
  - `useEditor()` throws outside `EditorProvider`.
  - `useHistory()` returns `{ canUndo, canRedo }` and re-renders after an edit, an undo and a redo.
  - The provider calls `editor.destroy()` on unmount.
- [x] T013 Implement `apps/app/src/model/editor-context.tsx` (research R6):
  - `EditorProvider({ doc, children })` creates one `createEditor(doc)` per doc (stable across renders) and destroys it on unmount.
  - `useEditor()` returns the `DeckEditor`.
  - `useHistory()` uses `useSyncExternalStore` over `editor.onHistoryChange` and returns a cached `{ canUndo, canRedo }` object that changes only when a value changes.
- [x] T014 Rewrite `apps/app/src/model/use-deck-snapshot.ts` on top of `createDeckSnapshot`:
  - One snapshot store per doc, in a `WeakMap`.
  - `useSyncExternalStore(store.subscribe, store.get)`. Same exported signature.
  - Update `apps/app/src/model/use-deck-snapshot.test.tsx`: it re-renders once per edit, and an unchanged node object keeps its identity across an edit to another node.
- [x] T015 [P] Extend `apps/app/src/state/ui-store.test.ts` (failing first) for the new UI state from data-model.md, covering each action:
  - `selection {nodes, edges}` with `select(ids)`, `toggle(id, type)`, `clearSelection()` and `pruneSelection(existingIds)`.
  - `focusedId` with `focus(id)`.
  - `leftTab` with `setLeftTab`.
  - `outlineCollapsed` with `toggleOutlineGroup`.
  - `labelsOn` with `setLabelsOn`, remembered in `localStorage` key `sododeck.labels` inside try/catch, working when `localStorage` throws.
  - `popover` with `openEdgePopover(edgeId)`, `openConnectPopover(fromId)` and `closePopover()`.
  - `pendingDelete` with `requestDelete(sel)` and `cancelDelete()`.
  - `announcement` with `announce(text)`.
  - `jsonPanelOpen` unchanged.
- [x] T016 Implement the store in `apps/app/src/state/ui-store.ts`:
  - Replace `selectedId`/`select` by the selection API from T015.
  - Update the callers (`left-sidebar.tsx`, `inspector.tsx`, `canvas.tsx`) so they still compile and behave as before: a single click selects one node.

### Deck data for the app

- [x] T017 [P] Move positions into the document:
  - `apps/app/src/editor/demo-deck.ts`: put each position into `node.position` and delete `demoPositions`.
  - `apps/app/src/bench/generate-deck.ts`: put positions into `node.position` and return only `{ deck }`.
  - Update `apps/app/src/bench/generate-deck.test.ts` so every node has an integer `position` and the deck passes `parseSododeckFile`.
- [x] T018 Wire `apps/app/src/routes/editor-page.tsx` (research R12):
  - `/deck/demo` → `fromJSON(demoDeck)`. `/deck/new` → `createDeck()` with `name: 'Untitled deck'` set through a one-time editor `updateMeta` before the history starts, or through `fromJSON` of a minimal file, so it is not undoable. Any other id → the demo, until 005.
  - Wrap in `EditorProvider` and `ToastProvider` with `<Toaster />`.
  - `TopBar` gets the deck name from the snapshot (`deck.name ?? 'Untitled deck'`).
  - Remove the `positions` prop plumbing.
- [x] T019 Update `apps/app/src/routes/bench-page.tsx`:
  - Use `fromJSON(generated.deck)`, `EditorProvider` and `useDeckSnapshot`, so the bench measures the real read path.
  - Keep `window.__sododeckBench` and the `visibleOnly` param.

### Render path (controlled canvas)

- [x] T020 [P] Write `apps/app/src/editor/canvas-geometry.test.ts` (failing first):
  - `displayPosition(node, index)`: the document position, or the grid fallback (10 columns, dx 220, dy 110) when it is missing.
  - `groupBounds(deck)`: the members' boxes (164×50) plus 24 px padding; nested groups contain child-group bounds; an empty group has no bounds.
  - `nearestInDirection(points, fromId, dir)`: ±45° cone, nearest by distance, ties broken by smaller id, `null` when there is none.
  - `freeSpot(deck, center)`: returns `center`, or steps +24/+24 until no node sits exactly there.
- [x] T021 Implement those functions in `apps/app/src/editor/canvas-geometry.ts` (pure, no React). Make T020 pass.
- [x] T022 [P] Rewrite `apps/app/src/editor/deck-to-flow.test.ts` (failing first) for:
  - `toFlowNodes(deck, selection, focusedId)`: component nodes with `type: 'deck'`, 164×50, data `{ title, kind, subtitle: tech, hasRules }`, `selected` from `selection`, and `position` from `displayPosition`.
  - Group-boundary nodes with `type: 'group-boundary'`, bounds from `groupBounds`, `selectable/draggable/focusable: false`, `zIndex: -1`.
  - `toFlowEdges(deck, selection, labelsOn)`: `type: 'deck'`, data `{ label, protocol, direction, showLabel }`; edges with a missing endpoint are skipped.
  - Memoisation: calling it twice with a snapshot where only node A changed returns the same object for node B (keep a per-id cache keyed by the source object reference).
- [x] T023 Implement `apps/app/src/editor/deck-to-flow.ts` per T022 (research R10). Make T022 pass.
- [x] T024 [P] Write `apps/app/src/editor/deck-node.test.tsx` (failing first). Render inside `ReactFlowProvider` and assert:
  - Accessible name "Service: Order Service".
  - `data-testid="deck-node"`.
  - Subtitle text when `tech` is set, none otherwise.
  - A rule marker labelled "Has rules" when `hasRules`.
  - Four handles named "Connect from Order Service".
  - `aria-selected` when selected.
  - `tabIndex` 0 only when focused.
- [x] T025 Rewrite `apps/app/src/editor/deck-node.tsx` (design 02, DESIGN.md "node"):
  - Use `KindTile` from `@sododeck/ui/components/kind-tile` for the six kinds, and `ICON_STROKE_WIDTH`.
  - Title (truncate, full title in `title` attribute), mono subtitle, and a rule glyph from `packages/ui/src/lib/icons.ts`.
  - Four `Handle`s (Top/Right/Bottom/Left) with `aria-label`, visible only on node hover or `:focus-within` (CSS).
  - Roving `tabIndex`; selected style is `border-primary shadow-selection` plus a ring (not colour only).
  - Keep `memo`. Make T024 pass.
- [x] T026 [P] Create `apps/app/src/editor/group-boundary-node.tsx` with a test: dashed `border-hairline` boundary, `rounded-node`, micro uppercase label "<TITLE> <count>" in the top-left (design 02), `pointer-events: none` except the label. The test covers the label and count by text.
- [x] T027 [P] Create `apps/app/src/editor/deck-edge.tsx` with a test:
  - `getSmoothStepPath` with `borderRadius: 8`.
  - End dot marker(s) per `direction` (forward: at target; both: both ends; none: no marker).
  - `interactionWidth` 12.
  - Selected edge gets a thicker, primary stroke plus a dash-free highlight.
  - The label pill via `EdgeLabelRenderer` (Mono, `text-code-sm`, surface pill) only when `showLabel && label`.
  - Accessible name "<from title> to <to title>[: label]".
  - The test covers pill visibility and the name.
- [x] T028 Make `apps/app/src/editor/canvas.tsx` controlled and derived. Keep all current smoke hooks (`aria-label="Diagram canvas"`, 3 demo nodes).
  - `Canvas({ onlyRenderVisibleElements?, onReady? })` reads `useDeckSnapshot`, `useEditor` and the UI store itself; no `deck`/`positions` props.
  - `nodeTypes = { deck, 'group-boundary' }`, `edgeTypes = { deck }`, `nodes`/`edges` from T023.
  - `disableKeyboardA11y`, `nodesFocusable={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}`, `connectionMode={ConnectionMode.Loose}`, `minZoom={0.3}`, `maxZoom={2}`, `fitView` once on open.
  - `onNodeClick`/`onEdgeClick` select one item; `onPaneClick` clears.
  - After every snapshot change, call `pruneSelection` with the ids that still exist.
  - Remove `Controls` (replaced in US5) and keep `Background` and `MiniMap`.

**Checkpoint**:

- `/deck/demo` renders from `node.position` with groups and edges.
- `pnpm test` and the smoke suite are green.
- `pnpm bench` shows no regression vs T002 on pan/zoom.

---

## Phase 3: User Story 1 - Draw a first system from an empty deck (Priority: P1) 🎯 MVP

**Goal**: From `/deck/new`, add components from the palette (drag or click/Enter), connect two components by dragging, and label the connection in the inline popover. Pressing C gives a basic keyboard connect.

**Independent Test**: On an empty deck, create two components and a labelled connection with the mouse, then with the keyboard only. `toJSON(doc)` contains them (component tests on `EditorPage` with `/deck/new`).

- [x] T029 [P] [US1] Write `apps/app/src/editor/palette.test.tsx` (failing first):
  - Six `button`s "Add Client" … "Add External" (no cloud/partner, §g-28 → B).
  - Click or Enter adds `New <kind>` at `freeSpot` of the viewport centre; the new node becomes the only selection and is announced "Added New service".
  - Cards are `draggable` and set `application/x-sododeck-kind` on drag start.
- [x] T030 [US1] Implement `apps/app/src/editor/palette.tsx` (design 14):
  - A "Components" section of kind cards (KindTile 28 px, label, short description).
  - Click/Enter → `editor.add('nodes', { type, title: \`New ${kind}\`, position: rounded(freeSpot(deck, screenToFlowPosition(centre))) })`, then `select`, `focus`and`announce`.
- [x] T031 [US1] Rewrite `apps/app/src/editor/left-sidebar.tsx`:
  - Keep `aria-label="Outline"` on the `complementary`.
  - `Outline`/`Palette` tabs (`SegmentedControl` or Radix Tabs from `radix-ui`, `tablist` semantics) bound to `leftTab`.
  - The Outline tab keeps the current flat list for now (the tree comes in US5). The Palette tab shows `Palette`.
- [x] T032 [US1] Add a palette drop to `apps/app/src/editor/canvas.tsx`:
  - `onDragOver` accepts `application/x-sododeck-kind`.
  - `onDrop` adds `New <kind>` at `screenToFlowPosition(event)` (rounded, top-left = drop point minus half the node size), then selects and announces.
  - A drop without that type does nothing.
  - Test in `apps/app/src/editor/canvas.test.tsx` by firing `dragOver`/`drop` with a mocked `dataTransfer`.
- [x] T033 [P] [US1] Create `apps/app/src/editor/empty-canvas-card.tsx` with a test (design 37):
  - Shown in the canvas when `deck.nodes.length === 0`; heading "Start your diagram", short help text.
  - `button` "Open palette" sets `leftTab = 'palette'` and focuses the first palette card.
  - Hidden once a node exists (design 38).
  - Render it from `canvas.tsx`.
- [x] T034 [P] [US1] Write `apps/app/src/editor/edge-popover.test.tsx` (failing first):
  - A `dialog` "Connection" with focus in "Label".
  - Label commits on Enter/blur as one `update('edges', id, { label })` (an empty value clears with `null`).
  - "Protocol" select offers the schema enum (`http, grpc, event, sql, websocket, other`).
  - "Direction" segmented control offers forward/both/none.
  - Esc closes; after a label commit one undo reverts only the label.
- [x] T035 [US1] Implement `apps/app/src/editor/edge-popover.tsx`:
  - `Popover` anchored at the edge label midpoint (store the midpoint from `deck-edge.tsx` via a `PopoverAnchor` rendered in `EdgeLabelRenderer`).
  - Fields use `Input`, `Select` and `SegmentedControl` from `@sododeck/ui`.
  - Opened when `popover.kind === 'edge'`; closes when the edge disappears.
- [x] T036 [US1] Handle `onConnect` in `apps/app/src/editor/canvas.tsx`:
  - `const id = editor.add('edges', { from: source, to: target })`, then `select` it, `openEdgePopover(id)` and announce "Connected A to B".
  - Double-click on an edge (`onEdgeDoubleClick`) opens the popover.
  - Add a test in `canvas.test.tsx` by calling the handler through a small exported `useCanvasHandlers()` hook if React Flow events are impractical in jsdom.
- [x] T037 [P] [US1] Write `apps/app/src/editor/connection-rules.test.ts` (failing first):
  - `connectionCheck(deck, from, to, ignoreEdgeId?)` returns `self`, `duplicate` (either direction) or `ok`; `ignoreEdgeId` excludes that edge.
  - `connectTargets(deck, fromId, query)`: every other node, case-insensitive title filter, `disabled: true, reason: 'already connected'` for duplicates, sorted by title.
- [x] T038 [US1] Implement `apps/app/src/editor/connection-rules.ts` per T037.
- [x] T039 [US1] Write `apps/app/src/editor/connect-popover.test.tsx` (failing first), then implement `apps/app/src/editor/connect-popover.tsx` (design 56):
  - `Popover` anchored at the focused node: `dialog` "Connect <title> to…", text input "Find component", `listbox` of `connectTargets`.
  - ↑/↓ move the active option (skipping disabled), Enter creates the edge (same path as T036, popover switches to the edge popover), Esc closes.
  - Disabled options show "already connected" and cannot be chosen.
- [x] T040 [US1] Create `apps/app/src/editor/use-canvas-shortcuts.ts` with its first binding:
  - C on a focused or selected single node → `openConnectPopover(id)`.
  - Ignore all shortcuts when the event target is an `input`, `textarea`, `select` or `[contenteditable]`.
  - Attach it to the canvas wrapper in `canvas.tsx`. Test it in `use-canvas-shortcuts.test.tsx`.

**Checkpoint**: US1 is fully usable. Two components and a labelled connection can be made by mouse and by keyboard (Tab to the palette, Enter, C).

---

## Phase 4: User Story 2 - Only valid connections can be drawn (Priority: P1)

**Goal**: Show valid and invalid drop targets while drawing, refuse self and duplicate connections, cancel on empty canvas, and reconnect endpoints.

**Independent Test**: Three components, two already connected. Every invalid drop and one reconnect leave the deck exactly as expected (component tests plus `connection-rules` unit tests).

- [x] T041 [US2] Pass `isValidConnection={(c) => connectionCheck(deck, c.source, c.target) === 'ok'}` to `apps/app/src/editor/canvas.tsx`. Test that `onConnect` is never reached for self or duplicate pairs: exercise `isValidConnection` directly.
- [x] T042 [US2] Add target states to `apps/app/src/editor/deck-node.tsx` (designs 53–55). Use `useConnection()` to know the in-progress source and the hovered target (`toNode`):
  - The valid target gets a dashed primary ring plus a "+" badge.
  - The invalid target gets a dashed clay ring, a lucide `Ban` icon and the text "Already connected" / "Can't connect to itself".
  - Announce the invalid reason once per hover.
  - The source node keeps its selected style; a dashed ghost line is React Flow's `connectionLineStyle` with a dash.
  - Tests in `deck-node.test.tsx` with a mocked `useConnection`.
- [x] T043 [US2] Handle reconnect in `apps/app/src/editor/canvas.tsx`:
  - `edgesReconnectable`, `onReconnect(oldEdge, conn)`: when `connectionCheck(deck, conn.source, conn.target, oldEdge.id) === 'ok'`, call `editor.update('edges', oldEdge.id, { from, to })`; otherwise do nothing and announce the reason.
  - The edge keeps its id, label, protocol and direction.
  - Tests: success, self, duplicate, and dropped on empty pane (unchanged).
- [x] T044 [US2] Extend `apps/app/src/editor/connect-popover.test.tsx`: the source itself is not listed; disabled options are skipped by the arrow keys and ignored on Enter; clicking a disabled option does nothing.

**Checkpoint**: No self or duplicate edge can be created by drag, keyboard connect or reconnect (SC-005).

---

## Phase 5: User Story 3 - Select, move and delete safely (Priority: P1)

**Goal**: Multi-select, drag several components as one undo step, delete behind a confirmation, and show a 6 s Undo toast. ⌘Z works after the toast is gone.

**Independent Test**: Four components and three connections: move, multi-select, delete, cancel, confirm and undo, checking `toJSON(doc)` after each step (component tests).

- [x] T045 [US3] Add multi-select to `apps/app/src/editor/canvas.tsx`:
  - `multiSelectionKeyCode={['Shift', 'Meta', 'Control']}`, `selectionKeyCode="Shift"` (marquee on shift-drag), `selectionOnDrag={false}`, `panOnDrag`.
  - `onSelectionChange` → `select({ nodes, edges })`, ignoring group-boundary nodes.
  - ⌘/Ctrl-A in `use-canvas-shortcuts.ts` selects every component.
  - Tests for ⌘A and shift-click toggling via the store.
- [x] T046 [P] [US3] Create `apps/app/src/editor/canvas-toolbar.tsx` with a test:
  - "<n> selected" text when two or more items are selected (design 58).
  - The Labels toggle `button` with `aria-pressed` bound to `labelsOn` (behaviour verified in US5).
  - Rendered as a React Flow `Panel` at the top-right of the canvas.
- [x] T047 [US3] Draw a selection frame in `apps/app/src/editor/canvas.tsx` (design 58): when ≥ 2 nodes are selected, draw a dashed primary rectangle around their union box (+8 px) using `ViewportPortal`. Test: the frame appears for two selected nodes and not for one.
- [x] T048 [US3] Add drag as a gesture in `apps/app/src/editor/canvas.tsx` (research R2):
  - `onNodeDragStart` → `editor.beginGesture()`.
  - `onNodesChange`: for `position` changes with `dragging: true`, `editor.batch(() => …update('nodes', id, { position: round(p) }))` over all changed component nodes. Other change types are ignored, because selection comes from `onSelectionChange`.
  - `onNodeDragStop` → final write plus `editor.endGesture()`, even if the drag is cancelled (use try/finally and also end on `onNodeDragStop` for every dragged node).
  - Test with the handlers from `useCanvasHandlers()`: many intermediate positions followed by one `editor.undo()` restore the start positions of all dragged nodes.
- [x] T049 [P] [US3] Write `apps/app/src/editor/describe-removal.test.ts` (failing first), then implement `apps/app/src/editor/describe-removal.ts`:
  - `describeRemoval(deck, targets, result)` → `{ title, body }`.
  - Examples: title "Delete Order Service?" / "Delete 3 components?"; body "Also removes 2 connections. 1 flow step and 1 note will be flagged broken." (counts from `RemovalResult`, singular/plural, zero parts omitted).
  - Toast message: "Deleted Order Service and 2 connections · ⌘Z to undo" ("Ctrl+Z" on non-Mac, via `navigator.platform` through `apps/app/src/lib/features.ts`).
- [x] T050 [US3] Write `apps/app/src/editor/confirm-delete-dialog.test.tsx` (failing first), then implement `apps/app/src/editor/confirm-delete-dialog.tsx` (§g-11/§g-19, small dialog like design 72):
  - `alertdialog` titled from `describeRemoval` over `previewRemoval(deck, pendingDelete)`, with buttons "Cancel" (initial focus) and "Delete" (clay destructive style).
  - Esc or Cancel → `cancelDelete()`, deck unchanged.
  - Delete → `editor.batch(() => targets.forEach(t => editor.remove(t.scope, t.id)))`, skipping targets already removed by an earlier cascade. Then `clearSelection()`, `toast({ message, action: { label: 'Undo', onAction: () => editor.undo() }, duration: MOTION.toastUndoMs })` and announce.
  - Test: confirm, then one `editor.undo()` restores all objects with the same ids.
- [x] T051 [US3] Wire the delete entry points:
  - Delete/Backspace in `use-canvas-shortcuts.ts` → `requestDelete(selection)` when the selection is not empty and focus is not in a text field; otherwise nothing.
  - Group-boundary ids are never part of `pendingDelete`.
  - Tests: Delete with an empty selection opens nothing; Delete while typing in the inspector title does not open the dialog.
- [x] T052 [US3] Rewrite `apps/app/src/editor/inspector.tsx` as the minimal inspector (FR-026, research R9, design 02/10/11/58). Keep `complementary` "Inspector" and a heading equal to the node title (smoke test).
  - **One node**: kind tile, heading, `InlineEdit` "Title" → `update('nodes', id, { title })` on commit (an empty title is refused: show the `Input` invalid state and keep the old value).
  - **One edge**: heading "<from> → <to>", `InlineEdit` "Label".
  - **Nothing selected**: heading = deck name, `InlineEdit` "Deck name" → `updateMeta({ name })`, plus the counts summary.
  - **Several selected**: heading "<n> items selected".
  - Every non-empty selection has a `button` "Delete" (trash icon) → `requestDelete`.
  - Tests for each state.
- [x] T053 [US3] Update the header in `apps/app/src/editor/top-bar.tsx`: the deck name comes from props (the snapshot), the "Demo · not saved" label stays (005 replaces it), and there is no other change here (undo/redo buttons in US4).

**Checkpoint**: US3 works. The confirmation counts match the cascade and undo restores everything (SC-004).

---

## Phase 6: User Story 4 - Undo and redo every canvas edit (Priority: P1)

**Goal**: ⌘Z / ⇧⌘Z and the top-bar buttons undo and redo every canvas action, one user action at a time, with availability shown.

**Independent Test**: Perform add, connect, reconnect, move, popover edit, rename and delete, then undo all and redo all; `toJSON(doc)` matches every intermediate state (component test on `EditorPage`).

- [x] T054 [US4] Add undo/redo shortcuts to `apps/app/src/editor/use-canvas-shortcuts.ts`. Register them on the editor root (`document`-level listener installed by `EditorPage`), not only on the canvas:
  - ⌘/Ctrl-Z → `editor.undo()`; ⇧⌘Z and Ctrl-Y → `editor.redo()`.
  - Skipped when the target is a text field (native text undo, spec assumption).
  - Announce "Undone" / "Redone".
- [x] T055 [US4] Add undo/redo buttons to `apps/app/src/editor/top-bar.tsx`: `button`s "Undo" and "Redo" (lucide `Undo2`/`Redo2`, ghost icon size, tooltip with the shortcut), disabled from `useHistory()`. Test enablement after an edit, an undo and a redo.
- [x] T056 [US4] Select restored objects in `apps/app/src/editor/canvas.tsx`:
  - Subscribe with `observeDeck(doc, …)`. When `origin` is `undo` or `redo` and there are `added` changes in `nodes`/`edges`, `select` those ids.
  - Close the edge or connect popover when its object is removed (spec edge case).
  - Tests: undo of a delete selects the restored node; undo of an add closes an open popover on that edge.
- [x] T057 [US4] Write the undo round-trip test in `apps/app/src/routes/editor-page.test.tsx`:
  - Render `/deck/new` (MemoryRouter).
  - Through UI actions, perform add ×2, connect, set label, rename, move (handlers), delete + confirm.
  - Record `toJSON` after each step, then undo step by step and redo step by step; assert deep equality with the recorded states (SC-004).

**Checkpoint**: All P1 stories are complete, which is a shippable MVP of the canvas.

---

## Phase 7: User Story 5 - Navigate large diagrams (Priority: P2)

**Goal**: Fit on open, a 30–200 % zoom control, minimap click-to-pan, the Labels toggle and the outline tree.

**Independent Test**: On `/bench?nodes=500&edges=1000`, zoom, fit, click the minimap, toggle Labels and pick a node in the outline. The bench stays ≥ 60 fps.

- [x] T058 [P] [US5] Create `apps/app/src/editor/zoom-control.tsx` with a test (design 02):
  - `button`s "Zoom out", "Zoom in" and "Fit diagram", with the zoom % text in between (`useViewport`, `useReactFlow().zoomIn/zoomOut/fitView({ padding: 0.2 })`).
  - "Zoom out" is disabled at 30 % and "Zoom in" at 200 %.
  - ⌘/Ctrl + / − / 0 in `use-canvas-shortcuts.ts` do the same.
  - Render it bottom-left as a `Panel` in `canvas.tsx`.
- [x] T059 [US5] Configure the minimap in `apps/app/src/editor/canvas.tsx` (design 02): `MiniMap` with `ariaLabel="Minimap"`, `pannable`, `onClick={(_, pos) => setCenter(pos.x, pos.y, { zoom })}`, node colour from a CSS token variable (no hex), bottom-right. Test the `aria-label`.
- [x] T060 [US5] Wire the Labels toggle end to end:
  - `canvas-toolbar.tsx` toggles `labelsOn`; `toFlowEdges` passes `showLabel`.
  - Test: with Labels on, every edge with a label shows a pill with its text; with Labels off, none do; edges without a label never show one (design 12).
- [x] T061 [P] [US5] Write `apps/app/src/editor/outline.test.ts` (failing first), then implement `apps/app/src/editor/outline.ts`:
  - `buildOutline(deck)` → tree nodes `{ type: 'group' | 'node', id, title, kind?, count?, children }`.
  - Groups nest by `parent`; nodes sit under their `group`; ungrouped nodes come last at the root; document order is kept.
  - A group with a missing or cyclic parent goes to the root.
  - `count` = the number of nodes in the group, recursively.
- [x] T062 [US5] Create `apps/app/src/editor/outline-tree.tsx` with a test (design 02/58):
  - `tree` "Components"; `treeitem`s with kind icon, title and group counts; `aria-expanded` on groups, toggled by click, ←/→, or Enter on the chevron; `outlineCollapsed` in the store.
  - ↑/↓ move between visible items.
  - Enter or click on a node item → `select`, `focus`, `fitView({ nodes: [{ id }], duration: 0, maxZoom: current zoom or 1 })`.
  - Selected items are highlighted (`bg-primary-soft` plus weight, not colour only).
  - Replace the flat list in `left-sidebar.tsx` with it.

**Checkpoint**: US5 works on the demo and on the 500-component bench deck.

---

## Phase 8: User Story 6 - Everything works from the keyboard (Priority: P2)

**Goal**: The canvas is one Tab stop with roving focus, arrow navigation, E through edges, Enter/Esc, a visible focus ring and live announcements.

**Independent Test**: Complete US1 and US3 with no pointer (component tests with `userEvent.keyboard` only).

- [x] T063 [US6] Add roving focus in `apps/app/src/editor/canvas.tsx` and `deck-node.tsx`:
  - The canvas wrapper has `tabIndex={0}` only when no node has `tabIndex 0` (i.e. the deck is empty); otherwise the focused node carries the single Tab stop.
  - When focus enters the canvas, focus the selected node, else the first node in document order, and set `focusedId`.
  - When `focusedId` changes, call `element.focus()` on that node and pan it into view if it is outside the viewport (`setCenter` keeping zoom).
  - The focus ring comes from `focusRing`.
  - Tests: Tab from the palette lands on a node; ⇧Tab leaves the canvas.
- [x] T064 [US6] Add arrow navigation in `use-canvas-shortcuts.ts`:
  - ←↑→↓ → `nearestInDirection` from the focused node → `focus` and `select([id])`.
  - Shift+arrow adds the next node to the selection.
  - No move when the result is `null`.
  - Tests with a 3×3 grid deck.
- [x] T065 [US6] Add Enter, E and Esc in `use-canvas-shortcuts.ts`:
  - Enter on a focused node focuses the inspector "Title" field.
  - E cycles `focusedEdgeId` (add to the UI store) through the focused node's edges and selects the edge (visible focus ring on the edge path); Enter on a focused edge opens the edge popover.
  - Esc closes the popover or dialog first, otherwise clears the selection.
  - Tests for each key.
- [x] T066 [P] [US6] Create `apps/app/src/editor/announcer.tsx` with a test:
  - A visually hidden `role="status"` `aria-live="polite"` element that renders `announcement`.
  - Repeated identical messages are re-announced (toggle a zero-width suffix).
  - Render it once in `editor-page.tsx`.
  - Check that every `announce` call site from US1–US4 produces text (test on `EditorPage`).
- [x] T067 [US6] Run a keyboard-only journey test in `apps/app/src/routes/editor-page.test.tsx`, without any pointer event:
  1. Tab to the palette, Enter "Add Service" and "Add Database".
  2. Tab into the canvas, then use the arrows.
  3. C to connect, type "dat", Enter, type a label, Enter.
  4. Delete, then Enter on "Delete".
  5. ⌘Z.

  Assert the document after each step (SC-002).

**Checkpoint**: All six stories are complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T068 [P] Handle the spec edge cases in the places they belong, one test each:
  - Very long titles truncate but keep the full accessible name and tooltip (`deck-node.test.tsx`).
  - An edge with an empty label shows no pill even when Labels is on (`deck-edge` test).
  - An edge with a missing endpoint is not drawn and does not crash (`deck-to-flow.test.ts`).
  - Nodes without a position appear on the grid and nothing is written on open (`canvas.test.tsx`: `canUndo()` is false after mount).
  - A second delete while a toast is visible replaces the toast, and ⌘Z undoes in reverse order (`confirm-delete-dialog.test.tsx`).
  - A drop outside the canvas creates nothing (`canvas.test.tsx`).
- [x] T069 Add a drag scenario to `apps/app/bench/perf.bench.ts` (research R13):
  - Drag one node on the 500 / 1,000 deck for ~1 s with `page.mouse` in small steps.
  - Record avg fps, p95 and max frame like the pan/zoom scenario, and add it to the JSON/MD report.
  - If drag misses 60 fps, apply the rAF-coalescing fallback from research R2 in `canvas.tsx` and re-measure.
- [x] T070 Run `pnpm bench` and `BENCH_CPU_THROTTLE=4 pnpm bench` after the change. Compare with T002 and put both reports in the PR description; any regression below 60 fps blocks merge (constitution V).
- [x] T071 [P] Write ADR `docs/decisions/0006-derived-canvas.md`:
  - The controlled canvas derived from an incremental snapshot.
  - Drag writes to the document every frame inside a gesture.
  - React Flow built-in keyboard and delete turned off in favour of roving focus and a confirmation.
  - `previewRemoval` via a throwaway copy.
  - Alternatives: uncontrolled React Flow with sync on drop, full `toJSON` per frame.
- [x] T072 [P] Update `apps/app/CLAUDE.md`:
  - The map gets `model/editor-context.tsx`, the editor files, and the `/deck/new` route.
  - Rules: the canvas reads only through `useDeckSnapshot` and writes only through `useEditor()`; no React Flow built-in delete or keyboard handling; the shortcuts live in `use-canvas-shortcuts.ts`.
- [x] T073 Visual check at 1440×900, light and dark (`pnpm dev`):
  - Screenshots of 02, 10, 11, 12, 14, 37, 38, 52, 53, 54, 55, 56, 57, 58, 59 states, next to `docs/design/screens/*`.
  - Fix differences or list them (allowed: DESIGN.md tokens, lucide icons, the confirmation dialog before delete).
- [x] T074 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Confirm the smoke suite passes unchanged and `grep -r design-gallery apps/app/dist` finds nothing.
- [x] T075 Walk through the manual scenarios 1–12 in [quickstart.md](quickstart.md). Write the final report: what changed, bench before/after, what was skipped (cloud/partner kinds, §g-28 → B) and what is uncertain.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)** comes first; T002 must run before any canvas change.
- **Foundational (T003–T028)** blocks all stories:
  - Model: T003 → T004 → T005; T006 → T007; then T008.
  - UI: T009; T010 → T011.
  - App: T012 → T013. T004 → T014. T015 → T016. T017 → T018/T019 (T018 also needs T013 and T016). T020 → T021. T022 → T023 (T023 needs T021). T024 → T025. T026, T027. T028 needs T014, T016, T023, T025–T027.
- **US1 (T029–T040)** needs Foundational and T011 for the popovers.
- **US2 (T041–T044)** needs T038 (connection rules) and T039 (connect popover) from US1.
- **US3 (T045–T053)** needs Foundational. T050 needs T007, T009 and T049. It is independent of US1/US2 on the demo deck.
- **US4 (T054–T057)** needs Foundational. T057 exercises US1 and US3 actions, so it runs after them.
- **US5 (T058–T062)** needs Foundational only. T060 needs T046.
- **US6 (T063–T067)** needs Foundational; T065 and T067 need US1 (popovers) and US3 (delete).
- **Polish (T068–T075)** comes after all stories.

### Story completion order

Foundational → US1 → US2 → US3 → US4 (MVP) → US5 → US6 → Polish. US3 and US5 can also run in parallel with US1 and US2 once Foundational is done.

### Within each story

Tests first, and they must fail. Then pure functions, then components, then wiring in `canvas.tsx`, `left-sidebar.tsx` or `editor-page.tsx`. Commit after each task or small group of tasks.

## Parallel Opportunities

- **Foundational**:
  - The model track (T003–T008), the UI track (T009–T011) and the app pure-function tests (T012, T015, T020, T022, T024) are independent.
  - T026 and T027 are separate files.
- **US1**: T029, T033, T034 and T037 are separate files.
- **US3**: T046 and T049 in parallel with T045.
- **US5**: T058 and T061 in parallel.
- **US6**: T066 in parallel with T063.
- **Polish**: T068, T071 and T072.

### Parallel example: Foundational

```text
Agent A: T003 → T004 → T005, T006 → T007 → T008   (packages/model)
Agent B: T009, T010 → T011                         (packages/ui)
Agent C: T020 → T021, T022 → T023                  (apps/app pure functions)
```

### Parallel example: User Story 1

```text
Task: T029 palette.test.tsx
Task: T033 empty-canvas-card.tsx (+ test)
Task: T034 edge-popover.test.tsx
Task: T037 connection-rules.test.ts
```

## Implementation Strategy

### MVP first

1. Phase 1 and Phase 2, then check that the demo renders from the document and the smoke suite and bench are green.
2. US1: drawing from an empty deck. **Stop and validate** (quickstart scenarios 1–3).
3. US2 and US3, then US4: all P1 stories, which is the canvas MVP. Validate scenarios 4–9.

### Incremental delivery

4. US5 (navigation at scale) → scenario 10 plus bench.
5. US6 (keyboard) → scenario 11.
6. Polish: bench after, ADR, docs, visual check, full DoD, report.

### Notes

- **Constitution I is the most likely to break.** If a component needs deck data, take it from `useDeckSnapshot`. Never mirror it into `useState` or Zustand, and never let React Flow's internal node state become authoritative.
- If a 002 API behaves differently from its contract (for example gesture merging), stop and report with a failing test in `packages/model/test`. Do not work around it in the app.
- Out of scope, do not build: full inspector fields, bulk edit, group editing, flows, stickies, ⌘K, focus mode, semantic zoom, views, auto-layout, export, autosave/library, cloud/partner kinds.
