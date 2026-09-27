# Research: Basic Canvas Editing (003)

Decisions for the plan. 002 (`@sododeck/model` editor) is specified but not merged; everything here
is written against its contract (`specs/002-yjs-model/contracts/model-api.md`). React Flow facts were
checked against the current docs (reactflow.dev, v12).

## R1. Reading the deck fast enough to drag

- **Decision**: Replace the full `toJSON` per Yjs update in `useDeckSnapshot` with an
  **incremental snapshot store** in `@sododeck/model`: `createDeckSnapshot(doc)` keeps one
  `SododeckFile` and, on each `observeDeck` change, rebuilds only the touched objects and the arrays
  that contain them (structural sharing: untouched nodes/edges keep their object identity).
  `useDeckSnapshot` subscribes to it through `useSyncExternalStore`; its public signature stays.
- **Rationale**: 002 budgets a full write-out at < 200 ms for 500 nodes / 1,000 edges; a drag emits
  one update per pointer frame, so a full `toJSON` per frame cannot hold 60 fps. Structural sharing
  also lets `toFlowNodes` reuse React Flow node objects, so `memo` on `DeckNode` skips unchanged
  nodes. Yjs → JSON conversion must stay in the model (constitution II), so the store lives there.
- **Alternatives considered**: keep full `toJSON` and throttle (still > 16 ms per frame at scale);
  let React Flow own positions during a drag and commit on drop (duplicates document state,
  constitution I); per-collection hooks in the app reading Yjs directly (leaks the layout).

## R2. Dragging components

- **Decision**: Controlled React Flow (`nodes`/`edges` derived from the snapshot every render).
  `onNodeDragStart` → `editor.beginGesture()`; `onNodesChange` position changes (dragging) →
  `editor.batch(() => update('nodes', id, { position }))` for every moving node, written straight
  to the document; `onNodeDragStop` → final write + `editor.endGesture()`. Positions are rounded to
  whole pixels before writing. The drag stays one undo step (002 gesture).
- **Rationale**: The document stays the only source of positions at every frame; with R1 one write
  touches only the moved nodes' snapshots. Multi-node drag writes all moved nodes in one batch.
- **Fallback (only if `pnpm bench` shows < 60 fps while dragging)**: coalesce writes to one per
  animation frame. Positions still go through the model; the pointer is merely sampled less often.
- **Alternatives considered**: uncontrolled React Flow + sync on drop (constitution I violation).

## R3. Selection, focus and keyboard

- **Decision**:
  - Selection and keyboard focus are UI state in the Zustand UI store (`selection: {nodes, edges}`,
    `focusedId`). React Flow's `selected` flags are derived from it; `onSelectionChange` writes it.
  - Shift-click and ⌘/Ctrl-click add or remove items (`multiSelectionKeyCode={['Shift', 'Meta', 'Control']}`). Shift-drag on the pane draws the marquee (React Flow `selectionKeyCode`
    default). Plain pane drag pans, as today and as in screen 58. ⌘A selects all nodes (own handler).
  - React Flow built-in keyboard handling is turned off: `disableKeyboardA11y`,
    `nodesFocusable={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}`. The built-ins give
    every node a Tab stop (500 stops) and make arrows _move_ nodes, both contrary to FR-027.
  - Instead a **roving tabindex**: the canvas has one Tab stop; `DeckNode` renders `tabIndex={0}`
    only for `focusedId` (else `-1`) and receives focus programmatically. Arrow keys call the pure
    `nearestInDirection(nodes, fromId, dir)` (cone of ±45° around the direction, then smallest
    distance) and move focus + selection.
- **Rationale**: One Tab stop keeps the page navigable; arrow navigation is the design's and the
  backlog's behavior (§g-30); `focusRing` from `packages/ui` gives the visible ring.

## R4. Drawing and validating connections

- **Decision**:
  - Four `Handle`s per node (top/right/bottom/left), `connectionMode={ConnectionMode.Loose}` so any
    handle can start or end; handles hidden until node hover/focus (CSS on the node, not state).
  - One pure function `connectionCheck(deck, from, to): 'ok' | 'self' | 'duplicate'`. Duplicate =
    an edge exists between the pair in either direction. Used by React Flow's `isValidConnection`,
    by the target-state styling during a drag (`useConnection()` gives the in-progress connection),
    by keyboard connect (disable options) and by reconnect.
  - `onConnect` → `editor.add('edges', { from, to })`, then select the edge and open the popover.
    Release on empty pane: React Flow creates nothing by default; nothing to do.
  - Reconnect: `edgesReconnectable` + `onReconnect(old, conn)` → `editor.update('edges', id, { from, to })` (same id, fields kept); for reconnect the check excludes the edge itself.
- **Invalid-target cue**: dashed clay ring + ban icon + short text ("Already connected" /
  "Can't connect to itself") on the hovered target node, and the text announced (R8). Non-colour
  cues per constitution VII.
- **Alternatives considered**: blocking duplicates in the model (002 deliberately allows them; 015
  reports them).

## R5. Deleting with confirmation and Undo toast

- **Decision**:
  - Delete/Backspace (ignored when focus is in a text field) and the inspector trash open one
    `ConfirmDeleteDialog` (existing `Dialog` from `packages/ui`, clay destructive button, §g-19).
  - Its text comes from a **pure preview** of the cascade: `previewRemoval(file, targets)` returns
    the same `RemovalResult` shape `remove` returns, without writing. It is added to
    `@sododeck/model`: it copies the document state into a throwaway `Y.Doc`
    (`encodeStateAsUpdate` → `applyUpdate`), runs the real `remove` calls in one `batch` there and
    merges the results. No second copy of the cascade rules, so the counts cannot drift.
  - Confirm → `editor.batch(() => targets.forEach(remove))` (one undo step) → toast
    `{ message: 'Deleted …', action: { label: 'Undo', onAction: editor.undo }, duration: 6000 }`
    with the "⌘Z" hint in the message. A new token `--sd-toast-undo: 6000ms` (+ `MOTION.toastUndoMs`)
    keeps the duration out of component code.
- **Rationale**: FR-017–FR-019; one batch = one undo step; ⌘Z works independently of the toast.
- **Alternatives considered**: React Flow `onBeforeDelete` (tied to its own delete key and its own
  node/edge arrays; we disable its delete key anyway); computing the cascade in the app (duplicate
  logic).

## R6. Undo/redo wiring

- **Decision**: One `DeckEditor` per open deck, created in the editor page and provided via React
  context (`EditorProvider`). `useHistory(editor)` = `useSyncExternalStore(editor.onHistoryChange,
() => [canUndo, canRedo])` for the top-bar undo/redo buttons. Global shortcuts ⌘Z / ⇧⌘Z / Ctrl+Y
  at the editor root; when focus is in an `input`/`textarea`/contenteditable they are left to the
  browser (text undo first, per spec assumption). After an undo/redo whose `DeckChange` has
  `added` nodes/edges, those become the selection (edge case "restored off-screen").
- **Rationale**: Uses 002 history as the only history (FR-021).

## R7. Palette, adding and the empty state

- **Decision**: Palette cards are buttons (Enter/click → add at the viewport centre via
  `screenToFlowPosition`, offset by 24 px until the spot is free) and HTML5 drag sources
  (`dataTransfer` type `application/x-sododeck-kind`); the canvas `onDrop` adds at the drop point.
  Default title `New <kind>`. No new dependency.
- Empty-canvas card: shown when `deck.nodes.length === 0`, with a button that switches the left
  panel to Palette and focuses its first card.

## R8. Announcements

- **Decision**: One polite `aria-live` region in the editor (`Announcer` + a tiny UI store action
  `announce(text)`), used for: added, connected, deleted (with counts), refused drop, undo/redo.
  Toasts already announce themselves (Radix).

## R9. Minimal inspector and popover

- **Decision**: Inspector title uses the existing `InlineEdit` (Enter/blur commit, Esc revert) and
  writes once on commit (`update('nodes', id, { title })`), so a title edit is one undo step. The
  heading still shows the title (the smoke test looks for it). Deck name: `updateMeta({ name })`.
- Edge popover: a new `Popover` wrapper in `packages/ui` over Radix Popover (already in the
  `radix-ui` package; no new dependency) anchored at the edge midpoint. Fields: label
  (`InlineEdit`/`Input`), protocol (`Select`, schema enum), direction (`SegmentedControl`:
  forward/both/none). Each commit is one `update('edges', …)`.
- Keyboard connect (C): the same `Popover` with a filtered `listbox` (own small component, arrow
  keys + Enter, disabled options with "already connected"). No combobox library.

## R10. Groups, outline and edges rendering

- **Decision**:
  - Groups render as non-interactive React Flow nodes of type `group-boundary` with bounds from the
    pure `groupBounds(deck, positions)` (members' boxes + 24 px padding, nested groups included),
    `zIndex` below components, `selectable/draggable=false`, label in the top-left (design 02).
  - Outline: pure `buildOutline(deck)` → tree (groups by `parent`, nodes by `group`, ungrouped at
    root). Collapse state is UI-only. Choosing an entry selects and `fitView({ nodes: [id] })`.
  - Edges: `smoothstep` with `pathOptions.borderRadius = 8`, end dot marker per `direction`,
    `interactionWidth = 12`, label pill as an `EdgeLabelRenderer` element shown when Labels is on.
  - Subtitle: `tech` when present (spec assumption; per-view subtitle field is 011).
  - Positions: `node.position` from the document; nodes without one get a display-only grid
    position (not written until the user moves them), so opening a deck never creates an edit.

## R11. Viewport, zoom, minimap, Labels

- **Decision**: `minZoom 0.3`, `maxZoom 2`, `fitView` on open. Custom `ZoomControl` (−, %, +, fit;
  buttons disabled at the limits) matching screen 02 instead of React Flow `Controls`. `MiniMap`
  with `pannable` and `onClick` → `setCenter`. Labels toggle in the canvas header, stored in the UI
  store and remembered in `localStorage` (via the existing theme-store pattern, try/catch).

## R12. Routes for this milestone

- **Decision**: Until 005 loads decks from IndexedDB, `/deck/demo` keeps the demo deck (smoke test)
  and `/deck/new` opens an empty in-memory deck (for the empty state). The demo deck moves its
  positions into `node.position` (the separate `demoPositions` map goes away). The bench page and
  `generateBenchDeck` do the same.

## R13. Dependencies and performance verification

- **Decision**: No new runtime dependency (React Flow, Radix, lucide, Zustand already present).
  `pnpm bench` before and after; the bench adds a **drag scenario** (drag one node for 1 s at 500 /
  1,000) next to pan/zoom, since dragging is new work on the main thread.
- The current baseline (2026-09-27, 4× throttle): default scenario 59.8 fps avg, p95 16.7 ms.

## Coordination with 002

002 is merged (d3974cc); its API matches the contract. The two additive exports
`createDeckSnapshot` (R1) and `previewRemoval` (R5) are the first 003 tasks, each with model tests
(snapshot equals `toJSON` after every operation; preview equals the actual `RemovalResult`).
