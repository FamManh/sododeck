# Implementation Plan: Shapes

**Branch**: `031-shapes` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-shapes/spec.md` (founder decisions: Sticky reuses today's sticky; Frame = Group, "Frame" on the Add tile only; Basic shapes on in new decks).

**Dependency**: **030 must be built first** (its spec, plan and tasks are merged; code is not). This plan extends 030's planned names: `packages/model/src/card-types.ts` (`CARD_TYPES`, `PACKS`, `NEW_DECK_PACKS`, `family`), `packages/ui/src/lib/icons.ts` `TYPE_STYLE`, the palette flyout and packs panel, `type-registry.test.ts`. On `main` I checked: `packages/model/src/ops/group-selection.ts` (`groupSelection` accepts empty `nodes` / `groups`; title required), `ops/cascade.ts` (`removeGroup` re-parents members), `apps/app/src/editor/editing/group-from-selection.ts` (`groupableCount ≥ 2` guard is UI-only), `editing/resize-limits.ts` (`MIN_FRAME` 160 × 96), `editing/drop-target.ts` / `membership-changes.ts` (drop into a frame, ⌥ keeps), `stickies/sticky-actions.ts` `addNoteAt`, `deck-node.tsx` (React Flow `Handle` per side, resize handles), `canvas-geometry.ts` `groupBounds`, `export/scene.ts`, `export/render-svg.ts`, `export/edge-geometry.ts`, `shell/rail.tsx` tools; `lucide-react` has no parallelogram icon.

## Summary

Eleven shape types with real geometry join 030's registry as the Basic shapes pack; decision, database and document switch between card and shape; the Frame tile draws a group frame first.

- **Registry** (R1): pack `shapes` with 11 `family: 'shape'` types (`rectangle`, `rounded-rectangle`, `ellipse`, `diamond`, `pill`, `cylinder`, `document-shape`, `parallelogram`, `hexagon`, `actor`, `text`), each with a geometry, default and minimum size; `shapeForm` on `decision` / `database` / `document`; `NEW_DECK_PACKS` + `shapes`. `document-shape` avoids 030's `document` id.
- **Geometry** (R2): one pure `shapes/shape-geometry.ts` (`shapePath`, `outlinePoint`, `titleBox`, sizes) shared by canvas, export, connectors and 022's free anchors.
- **Canvas** (R3): new React Flow node type `shape` with SVG lip / fill / outline, centred title, handles placed on the outline (no routing change), every `DESIGN.md` state, Landscape = geometry only, 017 resize with per-shape minimum.
- **Two forms** (R4): schema `Node.display` (`card` | `shape`), `setNodeDisplay`, "Show as" action in toolbar, menu and drawer.
- **Frame tool** (R5): a `frame` canvas tool; drag / click / ⏎ creates a group with the existing `groupSelection` (items fully inside join once), then the rename opens. Empty groups verified end to end.
- **Sticky / Text** (R6), **export** (R7), **bench** (R8).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all installed; **no new dependency**. Shape tiles draw mini outlines from `shapePath` (lucide has no parallelogram); Sticky and Frame tiles use lucide `StickyNote`, `Frame`.

**Storage**: schema v1 + `Node.display` (`pnpm schema:generate`); Yjs scalar on the node; no layout change. Frames and stickies store nothing new.

**Testing**: Vitest (geometry guarantees in [contracts/shape-api.md](contracts/shape-api.md); registry; `setNodeDisplay`; empty-group behaviour across `groupBounds`, collapse, drill-in, cascade, export; frame-tool pure helpers for enclosed items and parent; export scene), Testing Library (shape node, Show as, Frame tool, Shapes tab by role and name per [contracts/shape-ui.md](contracts/shape-ui.md)). No new e2e; smoke suite green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA plus internal packages.

**Performance Goals**: `BENCH_SHAPES=1` (a third of 500 nodes as shapes) within run-to-run variation of `bench-before.md`; `shapePath` memoised per (geometry, size).

**Constraints**: older decks unchanged (no `display` written unless it differs from the type's family); tilt / lift paint-only (§g-74); colour never the only state cue; tokens only (user hex aside); no network.

**Scale/Scope**: 1 schema file, ~4 model files, ~1 ui file, ~15 app files, docs (ADR 0025 addendum or ADR 0026, DESIGN.md Shape and Frame tool, package `CLAUDE.md`s, backlog). Estimate **6 d** (backlog 5 d + Frame tool ~1 d).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                    |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Shapes are nodes; the form is `node.display`; frames are groups. Geometry, outline points and title boxes are derived. Frame-tool preview and tool state are UI-only.  |
| II. Schema-owned format, lossless round-trip | ✅     | `Node.display` in `v1.json` with parity fixtures; round-trip: shapes, both forms, empty groups, older decks byte-identical. Only `packages/model` converts Yjs ↔ JSON. |
| III. Stable identity                         | ✅     | Switching form keeps the id; shape type ids are fixed (`document-shape` chosen so no id collides or changes).                                                          |
| IV. Local-first, private                     | ✅     | No network; no new asset.                                                                                                                                              |
| V. Performance off the main thread           | ✅     | Pure memoised geometry; no per-frame work; bench gate.                                                                                                                 |
| VI. Strict types, tested behaviour           | ✅     | Pure geometry and helpers with stated guarantees; component tests by role and name; no new e2e.                                                                        |
| VII. Accessible by default                   | ✅     | Shapes named "<title>, <shape>", keyboard add / switch / frame, announcements; every state has a non-colour cue; title contrast tested.                                |
| VIII. Simplicity, justified deps             | ✅     | Shapes reuse 030's registry and packs; Frame reuses groups and `groupSelection`; Sticky reuses stickies; one geometry module.                                          |

## Project Structure

### Documentation (this feature)

```text
specs/031-shapes/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R8
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── shape-ui.md
│   └── shape-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                     # Node.display
└── test/{fixtures,schema}.test.ts

packages/model/
├── src/card-types.ts                  # (030) + shapes pack, geometry, shapeForm, effectiveFamily, NEW_DECK_PACKS
├── src/ops/node-display.ts            # new: setNodeDisplay
├── src/editor.ts, src/index.ts
└── test/{card-types,node-display,groups-empty,round-trip}.test.ts

apps/app/src/editor/
├── shapes/
│   ├── shape-geometry.ts (+ test)     # new: paths, outline points, title box, sizes
│   ├── shape-node.tsx (+ test)        # new: React Flow node type 'shape'
│   └── shape-tile.tsx (+ test)        # new: mini outline icon for shape types
├── deck-to-flow.ts                    # node type by effectiveFamily; shape data; cache keys
├── canvas.tsx                         # register 'shape' node type
├── palette.tsx, packs-panel.tsx       # (030) Shapes tab tiles incl. Sticky and Frame
├── frame-tool/
│   ├── frame-draw.ts (+ test)         # new: enclosed items, parent frame, clamp
│   └── frame-draw-layer.tsx (+ test)  # new: drag preview and readout
├── actions/shape-form-actions.ts (+ test)  # new: Show as card / shape
├── inspector/node-inspector.tsx       # "Show as" radio group
├── state/ui-store.ts                  # 'frame' tool
├── type-registry.test.ts              # (030) card-family needs TYPE_STYLE; shape-family needs geometry
├── export/{scene,render-svg,edge-geometry}.ts   # shape geometry, outline points
└── bench: apps/app/bench/perf.bench.ts, src/bench/generate-deck.ts   # BENCH_SHAPES

docs/  decisions/0026-shapes-and-frame-tool.md (new; 0025 is 030's) · decisions/0022-schema-roadmap.md (node.display built) · DESIGN.md (Shape, Frame tool) · backlog.md (§031 status)
packages/model/CLAUDE.md, apps/app/CLAUDE.md, .claude/skills/react-flow/SKILL.md (shape node row)
```

**Structure Decision**: existing layout; geometry in `apps/app/src/editor/shapes/` (used by canvas and export), registry data in `model` (030).

## Delivery slices

1. **Registry, schema, model** (R1, R4 data): shapes pack, `display`, `setNodeDisplay`, round-trip.
2. **US1 shapes on the canvas** (R2, R3, R7): geometry, shape node, handles on outlines, states, zoom, resize, export.
3. **US2 Frame tool** (R5) with empty-group checks.
4. **US3 two forms** (R4 UI).
5. **US4 Sticky / Text tiles**, **US5** checks, polish, bench.

## Complexity Tracking

No constitution violations to justify.
