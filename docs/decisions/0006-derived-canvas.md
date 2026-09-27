# 0006. The canvas is derived from the document

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/003-canvas-basic` (spec, research R1–R13, contracts)

## Context

Feature 003 turns the read-only canvas into an editor: add, connect, reconnect, select, drag,
delete and undo, all from the keyboard too, at 500 components and 1,000 connections. React Flow
normally keeps its own copy of nodes and edges and applies changes to it. Constitution I forbids
that: the Yjs document is the only store of document data, and the canvas, the JSON panel and the
inspector are views of it. React Flow also ships its own keyboard model (every node a Tab stop,
arrows move nodes) and its own delete key (no confirmation), which contradict FR-017 and FR-027.

## Decision

1. **Controlled, derived React Flow.** `nodes` and `edges` are computed on every render from the
   deck snapshot and UI state (`toFlowNodes` / `toFlowEdges`, pure). React Flow only reports
   gestures; handlers write through the `DeckEditor` (`useEditor()`), and selection goes to the UI
   store. React Flow's own change events are ignored except positions (drag) and the marquee
   selection.

2. **An incremental snapshot in the model.** `createDeckSnapshot(doc)` in `@sododeck/model` keeps
   one plain `SododeckFile` and rebuilds only the objects a transaction touched (structural
   sharing). It equals `toJSON(doc)`, key order included, after every transaction (tested after
   every 002 operation). `useDeckSnapshot` reads it through `useSyncExternalStore`. View models
   cache per source object, so an edit to one node returns the same React Flow objects for all
   the others, and the edge list keeps its identity while only nodes move.

3. **Drag writes to the document every frame, inside a gesture.** `onNodeDragStart` opens an
   editor gesture, each position change is one `batch` of `update('nodes', id, { position })`
   (rounded to whole pixels), and `onNodeDragStop` closes it. The whole drag is one undo step and
   the document is the only source of positions at every frame. The rAF-coalescing fallback of
   research R2 was measured and gave no gain (the cost is React Flow's per-element store work and
   browser paint, not our writes), so it was not kept.

4. **Our keyboard model and delete, not React Flow's.** `disableKeyboardA11y`,
   `nodesFocusable={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}`. The canvas is one
   Tab stop with a roving tabindex (the focused component carries it); arrows move focus and
   selection to the nearest component in that direction; C, E, Enter, Esc, Delete, ⌘A, ⌘Z live in
   `use-canvas-shortcuts.ts`. Delete opens a confirmation, then removes the selection in one batch
   and shows a 6 s Undo toast.

5. **The confirmation's counts come from the real cascade.** `previewRemoval(file, targets)` in
   `@sododeck/model` loads the deck into a throwaway document, runs the editor's `remove` for every
   target in one batch there, and merges the results. There is no second copy of the cascade
   rules, so the dialog can never promise something the delete does not do.

## Alternatives considered

- **Uncontrolled React Flow, synced to the document on drop.** Smooth by default, but React Flow
  would hold the positions during a drag (constitution I), other views would lag, and undo would
  have to reconcile two states.
- **Full `toJSON` per update.** Simple, but rebuilds 500 nodes and 1,000 edges on every drag frame
  and gives React Flow new objects for everything, so every node re-renders.
- **React Flow's `onBeforeDelete` for the confirmation.** Tied to its own delete key and its own
  arrays; it cannot see the flow steps and notes the cascade flags.
- **Computing the cascade in the app.** A second copy of ADR 0005's delete policy that would drift.

## Consequences

- Every surface sees the same state at every frame; undo, the JSON panel and (later) multi-tab sync
  need no reconciliation.
- Benchmarks (`pnpm bench`, 500 / 1,000): pan/zoom and drag hold 60 fps at 1× CPU. At 4× CPU
  throttling pan/zoom stays within target (≈ 58 fps, p95 16.8 ms) and drag is ≈ 45 fps; the
  profile shows React Flow's per-node/per-edge selectors and browser paint, not model work.
  Revisit with `onlyRenderVisibleElements` or semantic zoom (010) if large decks feel slow.
- Pointer drags that start on a component now move it (they panned in M0); panning starts on
  empty canvas.
- New canvas interactions must follow the same pattern: derive from the snapshot, write through
  the editor, keep UI-only state in the store, and add keys to `use-canvas-shortcuts.ts`.
