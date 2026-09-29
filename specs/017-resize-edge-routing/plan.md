# Implementation Plan: Resize Cards and Route Connectors

**Branch**: `017-resize-edge-routing` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/017-resize-edge-routing/spec.md`, clarified on 2026-09-29:

- Size and route are shared by every view.
- The middle segment moves freely (no 12 px stop).
- Miro-like connector styling moved to backlog **022-connector-style**.
- Enlarged cards wrap the title and subtitle at the same font size.

The plan research corrected three spec points, and the spec was updated to match:

- A stored size applies at every zoom level, and the default stays level-dependent (R2).
- An offset exists only for opposite sides (R6).
- The resize keys are ⌘⇧ + arrow, because ⌥⌘ + arrow switches tabs in Chrome on macOS (R10).
- Out-of-range sizes are reported as a problem, not a schema error (R11).

**Dependency**: 016 is merged on `main` (`60cfc46`). These names were checked on `main`:

- **Geometry**: `NODE_SIZE`, `COMPONENT_CARD_SIZE`, `nodeSize(level)`, `groupBounds`, `selectionFrame`, `boundsOf`, `displayPosition`, `GROUP_PADDING`.
- **Editing (016)**: `resizeFrame`, `clampFrame`, `MIN_FRAME`, `startResize` / `applyResize` / `endResize`, `snapCandidates`, `snap`, `setActiveGesture`, `cancelActiveGesture`, `createNudger`, `HINTS`, `GestureHint`, `HintBar`, `guides-overlay.tsx`, `FrameFields`.
- **Model**: `DeckEditor.{update, batch, beginGesture, endGesture, cancelGesture, moveInView}`, `writePatch`, `fitGroupFrames`, `setGroupFrames`, `problems.ts` / `PROBLEM_KINDS`.
- **Canvas**: `facingSides`, `HandleSide`, `toFlowEdges`, `DeckEdge`, `MergedEdge`, `onReconnect`, `connectionCheck`, `edgesReconnectable`.
- **Actions (019)**: `ACTIONS`, `Action`, `oneStep`, `CONNECTION_ACTIONS`, `SHORTCUTS`.
- **Export (012)**: `edgePath`, `sceneEdges`, the `TODO(017)` markers.

## Summary

Users can shape the diagram:

- **File format (R1)**: optional `Node.size` (reusing 016's `Size`), plus `Edge.route` = `{ fromSide?, toSide?, offset? }` with a new `Side` enum. There is no version bump, no new semantic rule, and ranges are not in the schema. ADR 0019.
- **Model (R8, R11)**:
  - `setCardSize` and `setEdgeRoute` ops. `setEdgeRoute` normalises: it drops `offset: 0` and removes an empty route.
  - `writePatch` writes `size` and `route` per key.
  - `fitGroupFrames` gains `sizeOf`.
  - New problem kind `card-size-out-of-range`.
  - Round-trip cases for every combination.
- **Real sizes everywhere (R2, R3, R13)**:
  - `cardSize(node, level)` and `cardBox` replace about 30 fixed-size call sites: geometry, group fitting, ⌘G, frame resize minimum, snapping, align, navigation, stickies, tidy/ELK, export and thumbnails.
  - The `deck-to-flow` cache compares sizes.
  - A stored size wins at every level.
- **Resize gesture (R4, R5)**:
  - `NodeResizeControl` handles on a single selected card.
  - `card-resize.ts` mirrors 016's frame resize: one gesture, Esc cancels, moves from the top or left through `moveInView`.
  - A shared pure `resizeBox` handles min, max, the 4 px step, ⇧ and ⌥.
  - `snapEdges` does edge snapping.
  - A `W × H` readout, double-click to reset, and a text line clamp from `textLines`.
- **Routing (R6, R7, R12)**:
  - A pure `route-path.ts` wraps `getSmoothStepPath` with `centerX` / `centerY` = automatic middle + offset. Unrouted output is byte-identical.
  - `resolveSides` compares card centres, and a pinned side wins.
  - The segment handle (a `slider`) and a free drag with 1-D guide snapping, a ghost and a readout; R resets.
  - End drags show four side targets with the nearest one hot, draw a custom connection line, and pin the side in `onReconnect`. A reconnect to another card clears the offset.
- **Surfaces (R9, R14)**:
  - `shape-actions.ts` holds Reset size and Reset route (toolbar 100 and menus).
  - Keys: ⌘⇧ + arrow resizes; ⌥(⇧) + arrow moves the segment, in bursts through a shared `createBurst`.
  - Drawer Size and Route sections.
  - Hint bar texts for three new gestures.
- **Tests and bench (R15)**: pure, model, schema and component tests, plus the bench `resized-routed` scenario before and after. No new e2e.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; no new dependency.

- `@xyflow/react` ^12.12 (`@xyflow/system` 0.0.83): `NodeResizeControl`, `getSmoothStepPath` (`centerX` / `centerY`), `EdgeLabelRenderer`, `onReconnectStart` / `onReconnect` / `onReconnectEnd`, `connectionLineComponent`, `useConnection`, `screenToFlowPosition`.
- `yjs`, `zustand` 5, `radix-ui` through `packages/ui`, `lucide-react` (icons `Scaling`, `RotateCcw`, `Route`).

**Storage**:

- **Schema v1, additive**: `Side`, `EdgeRoute`, `Node.size`, `Edge.route`. Run `pnpm schema:generate`.
- **UI store**: `resizeReadout`, `endpointHover`, and `canvasGesture` extended with `'card-resize' | 'segment' | 'endpoint'`.
- **Library summary** (IndexedDB metadata): an optional per-node `w, h` in the thumbnail tuples. Old summaries render with the default size.

**Testing**:

- **Schema**:
  - `full.sododeck.json` gains a sized node and a routed edge (coverage test).
  - Invalid fixtures: size `width: 0`, `route.fromSide: "middle"`, an extra `route` key.
  - Ajv/Zod parity stays green.
- **Model** (`packages/model/test`):
  - Round trip: node with and without `size`; edge with sides only, offset only, both, and a hand-written `{}`.
  - Absent fields stay absent after edits to other fields.
  - `setCardSize` (set, replace, remove, one step, joins a gesture).
  - `setEdgeRoute` (merge, `offset: 0` dropped, empty route removed, `null` clears).
  - Two-tab merge of different route keys.
  - `fitGroupFrames` with `sizeOf`.
  - The `card-size-out-of-range` problem.
- **Vitest, pure (app)**:
  - `cardSize` / `cardBox` (clamp, level default).
  - `resizeBox`: 8 handles, the 4 px step, min / max, ⇧ ratio, ⌥ centre, the group content minimum unchanged.
  - `snapEdges`, `textLines`.
  - `resolveSides`, `middleSegment`, `nearestSide`.
  - `routedStepPath` is identical to `getSmoothStepPath` when unrouted, and offsets move the label.
  - `groupBounds` / `selectionFrame` / `boundsOf` with mixed sizes.
  - `edgePath` extent with an offset.
  - `deck-summary` sizes.
- **Testing Library, by role and name** (the [contract](contracts/resize-routing-ui.md)):
  - Reset size and Reset route availability and tooltips in the menus and the connection toolbar.
  - Drawer Size and Route sections (commit, Esc, clamp, disabled Offset).
  - Segment handle `slider` and its arrows.
  - ⌘⇧ + arrow and ⌥ + arrow on an edge in `use-canvas-shortcuts`.
  - Hint texts and announcements.
  - `onReconnect` pins a side, and clears the offset when the card changes.
- **Existing tests updated**: `canvas-geometry`, `deck-to-flow` (sizes, sides from centres), `tidy-layout`, `export/scene`, `deck-summary`, `open-result`, `sticky-actions`, `actions-run`, `visible-graph`, `frames` (model), and `shortcuts`.
- **E2E**: no new tests (constitution VI). The smoke suite stays green.
- **Bench**: before and after, plus `resized-routed` (every node sized, 200 routed edges, pan and zoom).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. `-webkit-line-clamp` is Baseline. The ⌘⇧ + arrow keys are not bound by any of these browsers outside text fields (R10).

**Project Type**: web app (monorepo). Changes span `packages/schema`, `packages/model` and `apps/app`. `packages/ui` is unchanged (it reuses `HintBar`).

**Performance Goals**:

- ≥ 60 fps pan and zoom on the bench deck with every node resized and 200 routed edges (FR-031, SC-006). No regression elsewhere.
- Flow highlight < 100 ms.
- Resize and segment drags write one small Yjs patch per pointer move, as 016's frame resize does.

**Constraints**:

- One undo step per gesture, key burst or drawer commit.
- The app clamps sizes; the model stays format-level.
- Automatic routes stay pixel-identical.
- No network.
- Merged and port edges ignore routes.

**Scale/Scope**:

- About 10 new files:
  - `route-path.ts`, `card-resize.ts`, `segment-drag.ts`, `card-text.ts`, `shape-actions.ts`, `size-fields.tsx`, `route-fields.tsx`, `segment-handle.tsx` and `endpoint-connection-line.tsx` (with tests)
  - `packages/model/src/ops/shape.ts`
- About 35 changed files, mostly the size call sites.
- 1 ADR (0019), and updates to 3 package `CLAUDE.md` files.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no deviations._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Size and route live only on the Yjs node and edge, written through `DeckEditor.setCardSize` / `setEdgeRoute` / `moveInView`. The readouts, hot side, ghost and burst are UI-only store fields or handler refs. React Flow `width` / `height` and handles are derived in `deck-to-flow`, never written back.                        |
| II. Schema-owned format          | ✅     | `Side`, `EdgeRoute`, `Node.size` and `Edge.route` are optional additions to v1.json. Types and Zod are regenerated, and parity stays green. Round-trip cases cover absent, partial and full values, including a hand-written empty route. No version bump (ADR 0002). ADR 0019 records the format decision.                        |
| III. Stable identity             | ✅     | No ids change. A route references nothing (sides are enums). Reconnect keeps the edge id and updates `from` / `to` by id, as today.                                                                                                                                                                                                |
| IV. Local-first, private         | ✅     | No network and no new browser API. The thumbnail metadata stays local.                                                                                                                                                                                                                                                             |
| V. Performance off main thread   | ✅     | The per-card size and path work is O(1) per object. The caches compare the resolved values. Tidy stays in its worker, now with real sizes. Bench runs before and after with a new scenario.                                                                                                                                        |
| VI. Strict types, tested         | ✅     | Pure modules have unit tests. Model ops have round-trip and behaviour tests. UI is tested by role and name. No new e2e.                                                                                                                                                                                                            |
| VII. Accessible                  | ✅     | Every gesture has a keyboard path: ⌘⇧ + arrow, the segment `slider` and ⌥ + arrow, and the drawer W / H / sides / offset. Reset works from the menu and toolbar. Announcements cover each result. The hot side target and the active handle differ by fill and size, not colour alone. There is no animation under reduced motion. |
| VIII. Simplicity, justified deps | ✅     | No new dependency. The path reuses `getSmoothStepPath` rather than a custom router, and one geometry choke point (`cardSize`) is used. Waypoints and styles are deferred to 022.                                                                                                                                                   |

## Project Structure

### Documentation (this feature)

```text
specs/017-resize-edge-routing/
├── plan.md                           # This file
├── research.md                       # Phase 0: R1–R16
├── data-model.md                     # Phase 1: schema, model API, geometry, UI state, transitions
├── quickstart.md                     # Phase 1: validation guide
├── contracts/resize-routing-ui.md    # user-visible contract
├── checklists/requirements.md
└── tasks.md                          # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                          # + Side, EdgeRoute, Node.size, Edge.route
├── src/generated/{types,zod}.ts            # regenerated
├── examples/full.sododeck.json             # + a sized node, a routed edge
└── test/fixtures.ts                        # + invalid size / route cases
packages/model/src/
├── ops/patch.ts                            # writePatch: size, route per key
├── ops/shape.ts                            # NEW setCardSize, setEdgeRoute
├── geometry.ts                             # fitGroupFrames({ sizeOf })
├── problems.ts                             # + card-size-out-of-range
├── editor.ts, index.ts                     # wire and export
packages/model/test/                        # round-trip, shape, frames, problems cases
apps/app/src/
├── editor/canvas-geometry.ts (+test)       # CARD_SIZE_LIMITS, cardSize, cardBox; groupBounds/selectionFrame/boundsOf per node
├── editor/card-text.ts (+test)             # NEW textLines
├── editor/deck-node.tsx (+test)            # NodeResizeControl ×8, line clamp, side-target rings
├── editor/deck-to-flow.ts (+test)          # size from cardSize, cache compare, resolveSides, port x
├── editor/routing/route-path.ts (+test)    # NEW resolveSides, middleSegment, routedStepPath, nearestSide
├── editor/routing/segment-handle.tsx (+test)       # NEW slider handle via EdgeLabelRenderer
├── editor/routing/endpoint-connection-line.tsx     # NEW dashed live path
├── editor/deck-edge.tsx (+test)            # routedStepPath, ghost, handle
├── editor/merged-edge.tsx                  # shared helper, automatic only
├── editor/editing/resize-limits.ts (+test) # resizeBox (cards + frames)
├── editor/editing/card-resize.ts (+test)   # NEW start/apply/end/cancel
├── editor/editing/segment-drag.ts (+test)  # NEW segment gesture
├── editor/editing/snap.ts (+test)          # + snapEdges
├── editor/editing/gesture-hints.ts (+test) # + card-resize, segment, endpoint
├── editor/editing/guides-overlay.tsx       # W × H readout
├── editor/editing/use-nudge.ts (+test)     # createBurst shared with segment keys
├── editor/editing/{frame-resize,group-from-selection,drag-session,clipboard-ops}.ts  # per-node sizes
├── editor/actions/shape-actions.ts (+test) # NEW node.resetSize, edge.resetRoute
├── editor/actions/{index,align-actions}.ts # register; per-node sizes
├── editor/inspector/size-fields.tsx (+test)   # NEW
├── editor/inspector/route-fields.tsx (+test)  # NEW
├── editor/inspector/{node-inspector,edge-inspector,frame-fields}.tsx
├── editor/use-canvas-handlers.ts (+test)   # onReconnectStart/End, side pinning
├── editor/use-canvas-shortcuts.ts (+test)  # ⌘⇧ arrows, ⌥ arrows on edge, R in segment drag
├── editor/canvas.tsx                       # connectionLineComponent, tinyCards, focus scroll
├── editor/{visible-graph,tidy-layout,open-deck}.ts   # per-node sizes
├── editor/{command-palette/open-result,problems/go-to-problem,stickies/sticky-actions}.ts
├── editor/export/{scene,edge-geometry}.ts (+tests)   # sizes, routes, extent
├── editor/shell/shortcuts.ts (+test)       # Editing section additions
├── storage/deck-summary.ts, library/deck-thumbnail.tsx (+tests)
├── state/ui-store.ts (+test)
└── bench/                                  # + resized-routed scenario
docs/decisions/0019-card-size-and-connector-route.md   # NEW ADR
packages/schema/CLAUDE.md, packages/model/CLAUDE.md, apps/app/CLAUDE.md   # updated
```

**Structure Decision**: the monorepo layout is unchanged. Connector routing gets its own folder, `apps/app/src/editor/routing/`, because 022 will extend it. Card resize and segment gestures sit next to 016's gestures in `editor/editing/`. Every document write goes through `packages/model`.

## Complexity Tracking

No constitution violations to justify.

The spec deviations found during planning (default size by level, the offset only for opposite sides, ⌘⇧ + arrow keys, and out-of-range sizes as a problem) are recorded in research R2, R6, R10 and R11, and the spec was updated to match.
