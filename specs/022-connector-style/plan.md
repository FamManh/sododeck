# Implementation Plan: Connector Style

**Branch**: `022-connector-style` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-connector-style/spec.md` (4 clarify answers, 2026-10-03), founder notes in [planning-input.md](planning-input.md), frames 128–133 and 118 c.

**Dependency**: 017, 020, 029, 033, 035 and 036 are merged on `main`. 034 is specified, not built (R14). I checked these names on `main`:

- **Schema**: `v1.json` `$defs/Edge`, `EdgeRoute` (`fromSide`, `toSide`, `offset`), `EdgeStyle` (`shape`, `minProperties: 1`), `EdgeShape`, `ColorRef`, `Side`, `Direction`; `semantic-rules.ts` S1–S8; `test/fixtures.ts`, `schema.test.ts`, `coverage.test.ts`; `examples/full.sododeck.json`.
- **Model**: `ops/edge-style.ts` (`writeEdgeShape`, `setEdgeShape`), `ops/shape.ts` (`EdgeRoutePatch`, `mergeRoute`, `writeRoute`, `setEdgeRoute` with 029 reset-route pinning), `edge-shape.ts` (`edgeShape`), `editor.ts`, `geometry.ts` (`viewNodePosition`), `ops/paste.ts`.
- **Canvas**: `deck-edge.tsx` (`DeckEdge`, `routedPath`, stroke / width / flow strokes, `interactionWidth ?? 12`, `EdgeLabelRenderer` label), `routing/route-path.ts` (`resolveSides`, `middleSegment`, `nearestSide`, `routedStepPath`, `routedPath`), `routing/segment-handle.tsx`, `routing/endpoint-connection-line.tsx`, `editing/segment-drag.ts`, `edge-ends.tsx`, `edge-constants.ts`, `deck-to-flow.ts` (`DeckEdgeData`, cache checks, `boxFor`), `canvas.tsx` (dot grid `gap={22}`, `onlyRenderVisibleElements`), `flow-strokes.ts`.
- **Actions and drawer**: `actions/connection-actions.ts` (`connection.lineType`, `applyLineType`, `sharedLineShape`), `actions/shape-actions.ts` (`edge.resetRoute`, elbow only), `actions/style-actions.ts` (`field` pattern), `actions/types.ts` (`field?: ToolbarFieldId`), `fields/line-type.ts`, `quick-edit/selection-toolbar.tsx`, `quick-edit/field-popover.tsx`, `inspector/edge-inspector.tsx`, `inspector/route-fields.tsx`, `inspector/bulk-inspector.tsx`, `inspector/derive.ts` (`styleView`), `state/ui-store.ts` (`ToolbarFieldId`, `canvasGesture`, `announce`).
- **Export**: `export/scene.ts` (`SceneEdge`, `sceneEdges`), `export/edge-geometry.ts` (`edgePath`), `export/render-svg.ts`, `export/export-palette.ts`.
- **UI / tokens**: `packages/ui/src/styles/tokens.css` (`--sd-deck-edge` 2px `#b4b4ab` / `#5a5a53`, `--sd-card-<name>-stroke`), `hooks/use-reduced-motion`, `components/swatch-grid.tsx`, `components/popover.tsx`, `test/contrast.test.ts`.

## Summary

Connectors get a Line style popover (type, dash, weight, colour, animated direction), free bend points that follow the cards, ends that attach anywhere along a side, and a draggable label.

- **File format** (R5): `EdgeStyle` + `dash`, `width`, `color`, `animated`; `EdgeRoute` + `fromAt`, `toAt`, `waypoints` (new `RouteWaypoint`); `Edge` + `labelAt`. Rules S9–S11. Defaults are never stored. ADR **0024** (connector route model) extends ADR 0019; ADR 0022 rows added. No version bump.
- **Bend storage** (R1, clarify Q1): per axis, a fraction of the source-centre → target-centre span, or a px offset from the midpoint when that span was under 22 px. Decoded per view, so bends follow drags, group moves, views and auto-layout.
- **Geometry** (R2): one pure `connector-geometry.ts`: anchors, waypoint encode / decode, `pointsToPath` for straight / elbow (axis legs, 10 px corners) / curved (centripetal Catmull-Rom → Bézier), simplify, snap, path sampling for labels. No bends → today's `routedPath`, byte-identical.
- **017 offset** (R3): read as two implicit bends; the first bend edit converts it and pins `elbow`. The segment pill and one-axis drag are removed.
- **Anchors** (R4): `fromAt` / `toAt` along a pinned side, computed from React Flow's live side midpoint plus the card size; snapping, readout, ghost, Esc (frame 118 c). Automatic sides face the first / last bend.
- **Model ops** (R7): `setEdgeStyle` (generalises `setEdgeShape`), extended `setEdgeRoute`, new `setEdgeLabelAt`. One call = one undo step.
- **UI** (R8, R9, R10): `connection.lineStyle` toolbar field → `LineStylePopover` (also in the drawer); menu radio submenus; new `route-handles.tsx` (light round handles, 24 px hit areas, keyboard); bend drag session with neighbour + 22 px grid snapping and auto-simplify; label drag along the path.
- **Animation** (R11): CSS `stroke-dashoffset` animation, off under reduced motion, in flows and in export.
- **Colour** (R12): named colours use their `stroke` token; custom hex adjusted to 3:1 on the canvas; precedence selected > flow > 034 highlight > own style.
- **Export** (R13): scene and SVG draw bends, anchors, dash, weight, colour and label position.

**Spec refinement made while planning**: the default weight is **2 px**, not 1.5. The canvas draws connectors at 2 px since 029 (`DESIGN.md` `--sd-deck-edge`, `deck-edge.tsx`); the backlog's "today's 1.5 px" was written before 029. The spec (scope, clarification, US1 #1, FR-003, Q2 answer, assumptions) is corrected so "absent = today's look" stays true.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `@xyflow/react` (`BaseEdge`, `EdgeLabelRenderer`, `useReactFlow`), `yjs`, `zustand` 5, Radix via `packages/ui` (`Popover`, `Slider` if present, else a `role="slider"` built on the existing slider pattern), `lucide-react`. Catmull-Rom, path sampling and projection are hand-written (R2, R10); `bezier-js` and `d3-shape` were considered and not needed.

**Storage**:

- Schema v1, additive (R5). `pnpm schema:generate` for types and Zod.
- Yjs (ADR 0021): nested `style` and `route` maps written key by key; `waypoints` one JSON value; `labelAt` scalar (R6). No layout change, no migration.
- UI store: `ToolbarFieldId` gains `'lineStyle'`; `canvasGesture` gains `'bend' | 'anchor' | 'label'`; the drag readout and guides are UI-only state.

**Testing**: Vitest (schema parity and S9–S11, model ops / undo / round-trip / 017 conversion / concurrency, `connector-geometry`, `line-colour`, `bend-drag`, `label-drag`, export scene), Testing Library (popover, menu, drawer, handles, label by role and name per [contracts/connector-ui.md](contracts/connector-ui.md)). No new e2e (constitution VI `TODO(e2e)`); the smoke suite must stay green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA (`apps/app`) plus internal packages (`schema`, `model`, `ui`).

**Performance Goals**: no regression against `bench-before.md` at 500 nodes / 1,000 edges without 022 data; 200 animated connectors pan ≥ 60 fps; 200 connectors with 3 bends within the existing canvas targets; `pointsToPath` for 20 bends under 0.1 ms; a bend drag frame does no Yjs write until release (session keeps the live point in UI state).

**Constraints**: absent data = byte-identical path and JSON (FR-021); single source of truth (bends, anchors, label position read only from the document; drag previews are UI-only until release); colour never the only cue (VII); tokens only, the only literal colours are the user's own hex; no network (IV).

**Scale/Scope**: ~4 schema files, ~5 model files, ~20 app files (routing, editing, actions, inspector, quick-edit, export, style), ui tokens / contrast test, docs (DESIGN.md Connectors, ADR 0024, ADR 0022, ADR 0019 note, package `CLAUDE.md`s, backlog). Estimate **8 d** (backlog 5 d before free anchors, lighter handles and relative bends were added).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Style, bends, anchors and label position live only on the edge in the Yjs document. The drawn path, anchor points, bend positions and label point are derived on every render (founder: "store only intent"). Drag previews (live bend, anchor readout, label ghost) are UI-store state until release, then one op writes the document. |
| II. Schema-owned format, lossless round-trip | ✅     | New keys and `RouteWaypoint` in `v1.json`, regenerated types / Zod, S9–S11 with invalid fixtures for Ajv / Zod parity. Round-trip cases: every key, defaults not stored, a 017 offset file unchanged, conversion on first bend edit. Only `packages/model` converts Yjs ↔ JSON.                                                         |
| III. Stable identity                         | ✅     | No new ids; bends are positions in a list owned by one edge; anchors reference sides, not cards' titles.                                                                                                                                                                                                                                |
| IV. Local-first, private                     | ✅     | No network, no new asset; `SVGPathElement` and CSS animations are standard and need no feature detection.                                                                                                                                                                                                                               |
| V. Performance off the main thread           | ✅     | Per-edge geometry is a few hundred arithmetic operations, memoised on inputs; animation is CSS with no JS per frame; bench before / after with animated and bent variants is a gate (R14). Nothing heavy enough for a worker.                                                                                                           |
| VI. Strict types, tested behaviour           | ✅     | Pure modules (`connector-geometry`, `line-colour`, `bend-drag`, `label-drag`) carry the logic with the guarantees in [contracts/connector-api.md](contracts/connector-api.md); components tested by role and name; no new e2e.                                                                                                          |
| VII. Accessible by default                   | ✅     | Popover controls are radio groups, a slider and a switch with names; handles and label are focusable buttons with keyboard moves and announcements; reduced motion stops animation; direction readable from arrowheads; selection / flow / error cues win over user colour; line colours tested ≥ 3:1.                                  |
| VIII. Simplicity, justified deps             | ✅     | No new dependency; one popover for toolbar and drawer; one geometry module; 017's segment handle is replaced, not kept beside the new handles; `setEdgeShape` becomes a wrapper of `setEdgeStyle`.                                                                                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/022-connector-style/
├── spec.md
├── planning-input.md        # founder notes (model, boundaries)
├── plan.md                  # this file
├── research.md              # R1–R14
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── connector-ui.md      # roles, names, keys, announcements, precedence
│   └── connector-api.md     # DeckEditor methods and pure helpers
├── checklists/requirements.md
├── tasks.md                 # /speckit-tasks
└── bench-before.md, bench-after.md, quickstart-results.md, screens/   # during implementation
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                       # EdgeStyle dash/width/color/animated; EdgeRoute fromAt/toAt/waypoints; RouteWaypoint; Edge.labelAt
├── src/semantic-rules.ts                # S9 anchor needs side, S10 offset xor waypoints, S11 one key per axis
├── src/generated/{types,zod}.ts         # regenerated
├── examples/full.sododeck.json          # coverage of every new key
└── test/{fixtures,schema,semantic-rules}.test.ts

packages/model/
├── src/ops/edge-style.ts                # setEdgeStyle (key by key, defaults removed); setEdgeShape wraps it
├── src/ops/shape.ts                     # EdgeRoutePatch + fromAt/toAt/waypoints; offset → waypoints conversion
├── src/ops/edge-label.ts                # setEdgeLabelAt
├── src/edge-shape.ts                    # edgeLineStyle (effective values)
├── src/editor.ts, src/index.ts
└── test/{edge-style,edge-route,round-trip,undo,concurrency}.test.ts

packages/ui/
├── src/styles/tokens.css                # --sd-deck-edge-track (32 %), no new colours
└── test/contrast.test.ts                # 13 stroke tokens ≥ 3:1 on canvas, both themes

apps/app/src/editor/
├── routing/
│   ├── connector-geometry.ts (+ test)   # new: anchors, waypoint encode/decode, pointsToPath, simplify, snap, sampling
│   ├── route-path.ts                    # routedPath kept for the no-bend path; autoSides with bends
│   ├── route-handles.tsx (+ test)       # new: ends, midpoints, bends; replaces segment-handle.tsx
│   ├── segment-handle.tsx (+ test)      # removed
│   └── endpoint-connection-line.tsx     # anchor preview while sliding an end
├── editing/
│   ├── bend-drag.ts (+ test)            # new: add / move / end, snapping, auto-simplify; replaces segment-drag.ts
│   ├── anchor-drag.ts (+ test)          # new: project on side, snap, readout, cancel
│   └── label-drag.ts (+ test)           # new: project on path, ticks, clamp
├── style/line-colour.ts (+ test)        # new: lineColour, lineDash
├── deck-edge.tsx                        # style, bends, anchors, label position, animation, precedence
├── deck-to-flow.ts                      # data: style, labelAt, card sizes, waypoints; cache keys
├── edge-ends.tsx                        # arrow / knob scale with width (frame 133 "arrow scale")
├── line-style/
│   ├── line-style-popover.tsx (+ test)  # new: Type, Dash, Weight, Colour, Animate; Mixed
│   └── line-style-view.ts (+ test)      # new: lineStyleView (shared / mixed per key)
├── actions/connection-actions.ts        # connection.lineStyle (toolbar field), Dash ▸, Weight ▸, Animate
├── actions/shape-actions.ts             # Reset route for every shape with bends / anchors / offset
├── fields/line-type.ts                  # folded into setEdgeStyle
├── quick-edit/field-popover.tsx         # 'lineStyle' case
├── inspector/{edge-inspector,route-fields,bulk-inspector}.tsx   # Line section, label position, bends count
├── export/{scene,edge-geometry,render-svg}.ts                    # style, bends, anchors, label position
├── state/ui-store.ts                    # 'lineStyle' field id; bend / anchor / label gestures and readouts
└── index.css                            # sd-edge-run keyframes; reduced-motion guard

apps/app/bench/perf.bench.ts             # 200 animated, 200 bent variants

docs/  DESIGN.md (Connectors: style, handles, animation) · decisions/0024-connector-route-model.md (new) · decisions/0022-schema-roadmap.md · decisions/0019-… (pointer to 0023) · backlog.md (022 status, relationship types → Database pack)
packages/schema/CLAUDE.md, packages/model/CLAUDE.md, apps/app/CLAUDE.md
```

**Structure Decision**: existing monorepo layout; all new code inside the current package boundaries (`app → model → schema`, `app → ui`).

## Delivery slices

Each slice ends green on the full definition-of-done command set and can merge alone.

1. **Format and model** (R5–R7): schema, rules, ops, round-trip, ADR 0024. No UI change.
2. **US1 style** (R8, R11, R12): popover, menu, drawer, line colour, dash, width, animation, export of style. Bench before / after.
3. **US2 bends** (R1–R3, R9): geometry, handles, bend drag, 017 conversion, Reset route for every shape, export of bends.
4. **US3 anchors** (R4): anchor drag and keys, export of anchors.
5. **US4 label** (R10): label drag and keys, drawer field, export of label position.
6. **US6 checks**: precedence, 034 rules (if 034 has landed), full quickstart walk, final bench.

## Complexity Tracking

No constitution violations to justify.
