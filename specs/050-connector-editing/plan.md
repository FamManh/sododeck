# Implementation Plan: Connector editing

**Branch**: `050-connector-editing` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/050-connector-editing/spec.md` (founder manual test, 4 clarifications on 2026-10-04).

**Dependency**: 017, 022, 031, 034 and 036 are merged on `main`. The names below were checked on `main` at `615fd85`:

- **Schema**: `v1.json` `$defs/Edge` (`from`, `to`: "Id of the source/target node"), `EdgeRoute`, `RouteWaypoint`; `semantic-rules.ts` S9–S11; `src/generated/{types,zod}.ts`; `test/fixtures.ts`; `examples/*.json`.
- **Model**:
  - References and checks: `ops/refs.ts` (`refsOf`), `validate.ts` (`RefTarget`, `exists`), `integrity.ts` (`checkIntegrity`), `load-checks.ts`, `problems.ts` (`nodeTitle`, `checkDuplicates`).
  - Cascades and clipboard: `ops/cascade.ts` (`removeNode`, `removeGroup`, `previewRemoval`), `fragment.ts` (`toFragment`), `ops/paste.ts` (`pasteFragment`, `groupIds`).
  - Other: `flow-paths.ts` (`analyzeFlow`), `search/index.ts` (`titleOfNode`), `editor.ts` (`setEdgeRoute`, `setEdgeStyle`).
- **Canvas**:
  - Edge drawing: `deck-edge.tsx` (`selected ? 2.5`, `EdgeLabelRenderer`), `routing/route-handles.tsx` (unmount-on-drag bug), `routing/label-handle.tsx`, `routing/connector-geometry.ts` (`connectorPath`, `elbowVertices`, `offsetBends`, `snapBend`, `simplifyWaypoints`), `routing/route-path.ts` (`nearestSide`), `routing/endpoint-connection-line.tsx`.
  - Gestures: `editing/anchor-drag.ts` (`BODY_DEPTH`, `ANCHOR_STOPS`, `stepAnchor`), `editing/bend-drag.ts`, `editing/drag-session.ts` (`setActiveGesture`, `DragController`), `editing/card-resize.ts`, `editing/guides-overlay.tsx`.
  - Canvas wiring: `use-canvas-handlers.ts` (`onReconnect*`, `onConnect`, `isValidConnection`), `canvas.tsx` (`edgesReconnectable`, `ConnectionMode.Loose`), `connection-rules.ts`.
  - Graph and nodes: `deck-to-flow.ts` (`groupNodes`, `collapsedNodes`, `portNodes`, `toFlowEdges`, `boxFor`, `endGeometry`), `visible-graph.ts`, `bundles.ts`, `focus-set.ts`, `proxy-layout.ts`, `group-boundary-node.tsx`, `collapsed-group-node.tsx`, `shapes/shape-geometry.ts` (`outlinePoint`).
- **UI**: `line-style/line-style-controls.tsx` (`WeightSlider`), `line-style/line-style-options.ts` (`WIDTHS`), `state/ui-store.ts` (`guides`, `bendPreview`, `endpointHover`, `endpointAnchor`, `reconnectingEdgeId`, `connectorReadout`, `canvasGesture`), `actions/{types,index}.ts`, `command-palette/commands.ts`, `inspector/edge-inspector.tsx`, `connect-popover.tsx`, `describe-removal.ts`.
- **Export and layout**: `export/scene.ts` (`rects`, `sceneEdges`, `flowMembers`), `layout/tidy-layout.ts`, `layout/elk-layout.ts`. There is no Mermaid export (012 deferred it).
- **Flows**: `flows/candidate-edges.ts`, `flows/use-flow-viewport.ts`, `canvas-geometry.ts` (`boundsOf`), `view-filter.ts`.

## Summary

Make connector editing reliable and flexible, and let groups be connector ends. Root causes and decisions are in [research.md](research.md).

- **Handles above cards (R1)**: the selected connector's handles move from React Flow's edge label layer (which sits under nodes) to `ViewportPortal`, above everything.
- **One drag helper (R2)**: window-level pointer listeners, a 4 px threshold, and one cleanup path for every exit. This fixes "moves a bit then stops", which was caused by the capturing midpoint button unmounting.
- **Own end handles (R3–R5)**:
  - React Flow reconnect is replaced by our end drag. A pointer offset on press means no jump.
  - Hit-testing finds cards first, then the innermost group.
  - The end attaches to the nearest point of the outline, continuously, with a midpoint-only snap of 6 px (⌘ off).
  - The 022 automatic zone is kept as the middle 40 % with a 24 px margin.
  - Shift + arrow nudges the end by 1 %.
- **Groups as endpoints (R6)**: `Edge.from/to` may name a group, with the same JSON shape and no version bump; ADR 0029 records the widening.
  - **Model**: refs, integrity, duplicate-id check, the delete cascade, clipboard, titles.
  - **App**: connection rules (new `'contains'` refusal), group frame handles, edge mapping through collapse and drill, inspector, export scene, ELK.
- **Segment drag (R7)**: elbow runs move perpendicular. Inner runs move two bends; end runs slide the anchor. No new stored data.
- **Weight (R8)**: a selected connector is drawn at its own width with an Orange Soft halo. The weight slider drags on its whole track with a live preview and one write. Stops stay 1 / 1.5 / 2 / 3 / 4.
- **Guides (R9)**:
  - Each gesture clears its guides on every exit.
  - A window safety net clears leftovers when no gesture is active.
  - The overlay only draws guides while a gesture runs.
- **Spread ends (R10)**: a pure `spreadEnds` plus a `node.spreadEnds` action (menu, toolbar) and a palette command, in one undo step.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `@xyflow/react` ^12.12 (`ViewportPortal`, `Handle`), `yjs`, `zustand` 5, `lucide-react`. Outline projection, hit-testing and the drag helper are hand-written.

**Storage**:

- Schema v1. The descriptions of `Edge.from/to` change; the structure doesn't. Run `pnpm schema:generate` to regenerate the descriptions in types and Zod.
- Yjs: no layout change. Edges keep `from` / `to` scalars.
- UI store: adds `endpointPreview`, `lineStylePreview` and `canvasGesture: 'segment'`; removes `endpointHover`, `endpointAnchor` and `reconnectingEdgeId`. See [data-model.md](data-model.md).

**Testing**:

- Vitest: model integrity, cascade, fragment/paste, problems and search with group ends, plus round-trip with group edges; app pure modules per [contracts/connector-editing-api.md](contracts/connector-editing-api.md).
- Testing Library: handles, slider, group connect handle, spread action and guides, per [contracts/connector-editing-ui.md](contracts/connector-editing-ui.md).
- Each root cause gets a failing test first (Principle VI: a bug fix starts with a failing test). Examples: a midpoint drag that keeps moving after 3 re-renders; a selected edge's stroke width equal to its weight; guides cleared after `pointercancel` or blur.
- No new e2e (`TODO(e2e)`); the smoke suite stays green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e). Touch and pen get `pointercancel` handling for free.

**Project Type**: pnpm / turbo monorepo: Vite SPA (`apps/app`) plus internal packages (`schema`, `model`, `ui`).

**Performance Goals**: no regression beyond 5 % against `bench-before.md` at 500 nodes / 1,000 edges (SC-008). A drag frame does no Yjs write. Only the selected connector computes handles. Hit-testing is rAF-throttled and runs only during end drags and new connections.

**Constraints**:

- Previews are UI-only until release (Principle I). One undo step per gesture.
- Distances are in screen px divided by zoom.
- Tokens only (the halo uses `--color-primary-soft`). No network.
- Files without group edges stay byte-identical on round-trip.

**Scale/Scope**:

- Schema: ~3 files. Model: ~9 files.
- App: ~30 files, in `routing/`, `editing/`, connection rules, `deck-to-flow`, `visible-graph`, inspector, export scene, layout, actions and palette.
- Docs: ADR 0029, DESIGN.md Connectors, package `CLAUDE.md` files, spec.md "edges".
- Estimate **7–8 d**: US1+US2 3 d, US4 3 d, US3/US5/US6/US7 2 d.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Ends, bends, anchors and weight are read only from the edge in Yjs. Live drag state (`endpointPreview`, `bendPreview`, `lineStylePreview`) is UI-store state cleared on finish, and each gesture writes once on release.                                                                                                                                  |
| II. Schema-owned format, lossless round-trip | ✅     | The widening of `Edge.from/to` is documented in `v1.json` and generated code, and only `packages/model` reads and writes edges. Round-trip cases cover card→group, group→card and group→group with route and style. Old files are unchanged. No version bump: the change is additive in meaning (no valid file changes meaning), and ADR 0029 records it. |
| III. Stable identity                         | ✅     | Group ends reference group ids, never titles. A new check catches a node and a group sharing an id. Renaming a group keeps its connectors; a test covers it.                                                                                                                                                                                              |
| IV. Local-first, private                     | ✅     | No network and no new asset. Pointer events, `blur` and `visibilitychange` are standard and need no feature detection.                                                                                                                                                                                                                                    |
| V. Performance                               | ✅     | Work happens per selected connector or per active drag, is rAF-throttled, and never writes per frame. Bench runs before and after (SC-008). Nothing is heavy enough for a worker.                                                                                                                                                                         |
| VI. Strict types, tested behaviour           | ✅     | Logic lives in pure modules with the guarantees listed in the API contract. Each of the seven reported bugs starts with a failing test. Components are tested by role and name. No new e2e.                                                                                                                                                               |
| VII. Accessible by default                   | ✅     | Every handle is a named, focusable button with keyboard moves (Shift + arrow added; segment handles get arrows). The group connect handle opens the existing connect popover. Selection isn't shown by colour alone (halo plus handles). Announcements on every change.                                                                                   |
| VIII. Simplicity, justified deps             | ✅     | No new dependency. One drag helper replaces three ad-hoc ones. React Flow reconnect and its `mousemove` side channel are removed rather than kept alongside. Segment drag reuses 022 waypoints and anchors instead of a new route field.                                                                                                                  |

## Project Structure

### Documentation (this feature)

```text
specs/050-connector-editing/
├── spec.md
├── plan.md                      # this file
├── research.md                  # root causes + R1–R12
├── data-model.md                # Edge ends, cascade, UI state, transitions
├── quickstart.md                # automated + manual validation
├── contracts/
│   ├── connector-editing-api.md # model + pure helper contracts
│   └── connector-editing-ui.md  # roles, names, behaviour for component tests
├── checklists/requirements.md
└── tasks.md                     # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                       # Edge.from/to descriptions: node or group
├── src/generated/{types,zod}.ts         # regenerated
└── test/fixtures.ts                     # valid group-edge fixture

packages/model/
├── src/endpoint.ts                      # NEW endpointOf (node | group, title)
├── src/ops/refs.ts, src/validate.ts     # 'nodes|groups' ref target
├── src/integrity.ts, src/load-checks.ts # group ends; node/group id collision
├── src/problems.ts, src/search/index.ts # titles via endpointOf
├── src/ops/cascade.ts                   # removeGroup deletes its edges; previewRemoval
├── src/fragment.ts, src/ops/paste.ts    # keep + remap group-ended edges
└── test/                                # integrity, cascade, paste, fragment, problems, search, round-trip

apps/app/src/
├── editor/editing/pointer-drag.ts       # NEW threshold + window listeners + single cleanup
├── editor/editing/endpoint-drag.ts      # NEW end drag session (replaces reconnect)
├── editor/editing/segment-drag.ts       # NEW elbow run drag
├── editor/editing/spread-ends.ts        # NEW spread plan
├── editor/editing/anchor-drag.ts        # stepAnchor kept; nudgeAnchor added; BODY_DEPTH/stops removed from drag
├── editor/editing/bend-drag.ts          # uses pointer-drag; cleanup on every exit
├── editor/editing/drag-session.ts       # hasActiveGesture(); blur + try/finally in DragController
├── editor/editing/guides-overlay.tsx    # draw only during a gesture; data-testid="snap-guide"
├── editor/editing/card-resize.ts        # cancel on unmount (via component-node-parts.tsx)
├── editor/routing/endpoint-target.ts    # NEW hitTarget (cards, then innermost group)
├── editor/routing/outline-attach.ts     # NEW nearest outline point, midpoint snap, centre zone
├── editor/routing/elbow-runs.ts         # NEW runs of an elbow path
├── editor/routing/route-handles.tsx     # ViewportPortal; real end handles; segment handles
├── editor/routing/label-handle.tsx      # ViewportPortal; pointer-drag
├── editor/routing/endpoint-connection-line.tsx # new connections use hitTarget/attach (groups)
├── editor/deck-edge.tsx                 # own width when selected + halo; endpoint/lineStyle previews
├── editor/line-style/line-style-controls.tsx   # draggable WeightSlider
├── editor/connection-rules.ts           # groups; 'contains'
├── editor/use-canvas-handlers.ts        # reconnect removed; onConnectEnd drop on groups
├── editor/canvas.tsx                    # edgesReconnectable off; guide safety net
├── editor/group-boundary-node.tsx       # hidden handles + label connect handle
├── editor/deck-to-flow.ts, visible-graph.ts, bundles.ts, focus-set.ts, proxy-layout.ts
├── editor/inspector/edge-inspector.tsx, connect-popover.tsx, describe-removal.ts
├── editor/actions/node-actions.ts (or layout-actions.ts) + command-palette/commands.ts  # spread ends
├── editor/export/scene.ts               # group frame rects
├── editor/layout/{tidy-layout,elk-layout}.ts   # group endpoints
├── state/ui-store.ts                    # endpointPreview, lineStylePreview; removed reconnect state
└── index.css                            # viewport-portal z-index; edgeupdater rules removed; halo

docs/decisions/0029-groups-as-connector-ends.md  # NEW
DESIGN.md (Connectors: halo, handles, segment handle) · packages/model/CLAUDE.md · docs/spec.md
```

**Structure Decision**: existing monorepo layout. New logic goes into pure modules under `apps/app/src/editor/{editing,routing}` next to their 022 siblings. The only model addition is `endpoint.ts`; everything else extends existing model files.

## Delivery order

1. **US6 guides** and **US1 drag helper and handles layer** (bugs first, each with a failing test).
2. **US2 end drag** (removes React Flow reconnect).
3. **US3 weight**.
4. **US4 groups**: model, then rules, canvas and export.
5. **US5 segment drag**.
6. **US7 spread ends**.
7. Bench after, docs, quickstart results.

Each story is mergeable on its own.

## Complexity Tracking

No constitution violations. Two choices to note for review:

| Choice                                             | Why                                                                                                                                    | Simpler alternative rejected because                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Replace React Flow reconnect with our own end drag | Continuous attachment, a pointer offset, handles above cards and group targets are all impossible through React Flow's handle snapping | Tuning radii keeps the midpoint anchor, the under-card handles and the jumping                   |
| Widen `Edge.from/to` without a version bump        | No existing file changes meaning; one deployed app reads the format                                                                    | A version bump plus migration would rewrite nothing and force every file to change its `version` |
