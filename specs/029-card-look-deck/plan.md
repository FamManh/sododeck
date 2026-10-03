# Implementation Plan: Card Look "Deck"

**Branch**: `029-card-look-deck` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/029-card-look-deck/spec.md`, clarified on 2026-10-03: 029 builds on 036's layout (Q1); leaving elbow keeps `route.offset` (Q2); new connectors take the tab's last-picked line type (Q3); every line type attaches at the same side midpoints (Q4); no lip below 60 % on every board (Q5). §g-66–§g-80 defaults accepted.

**Dependency**: 028 (`f2b0140`) and 036 (`c1c8acd`, ADR 0021 layout, ADR 0022 schema roadmap) are merged on `main`. I checked these names on `main`:

- **Schema**: `v1.json` `Edge` (key order ends with `route`), `EdgeRoute`, `Style` (`minProperties: 1`), `semantic-rules.ts` (S6 for the dropped `minProperties`), `test/fixtures.ts`, `schema.test.ts` (Ajv/Zod parity), `coverage.test.ts`, `key-order.test.ts`, `examples/full.sododeck.json`.
- **Model**: `ops/shape.ts` `setEdgeRoute`, `ROUTE_KEYS`, `ops/style.ts` `setStyle` / `writeChannel`, `validate.ts` `ELEMENT_SCHEMAS`, `read.ts` `readFields` (empty `style` = none), `write.ts` `writeField`, `key-order.ts`, `editor.ts`, `round-trip.test.ts`, `concurrency.test.ts`.
- **Canvas**: `DeckNode`, `cardSize` / `NODE_SIZE` / `COMPONENT_CARD_SIZE` / `COLLAPSED_CARD_SIZE` / `CARD_SIZE_LIMITS` (`canvas-geometry.ts`), `card-tags.ts` (`TAG_CHIP`, `tagBlockHeight`), `card-text.ts` (`textLines`, `clampStyle`), `levels.ts` (`levelSelector`, `effectiveLevel`), `tinyCardsSelector` + `data-tiny-cards`, `selection-frame.tsx`, `GroupBoundaryNode`, `CollapsedGroupNode`, `deck-to-flow.ts` (`toFlowNodes`, `toFlowEdges`, `collapsedNodes`, cache checks), `index.css` (`.sd-handle`, view-dim, focus, flow-mode), `style/card-style.ts` `resolveLook`.
- **Connectors**: `deck-edge.tsx`, `merged-edge.tsx`, `edge-constants.ts` `DOT_RADIUS`, `routing/route-path.ts` (`resolveSides`, `routedStepPath`, `middleSegment`), `routing/segment-handle.tsx`, `routing/endpoint-connection-line.tsx`, `editing/segment-drag.ts`, `connection-rules.ts` (self-loop refused).
- **Actions and UI**: `actions/connection-actions.ts`, `actions/shape-actions.ts` `edge.resetRoute`, `actions/use-action-context.ts` `targetOf`, `quick-edit/toolbar-variant.ts`, `quick-edit/canvas-menu.tsx`, `fields/one-step.ts`, `inspector.tsx`, `inspector/edge-inspector.tsx`, `inspector/route-fields.tsx`, `canvas-actions.ts` `connectComponents`, `state/ui-store.ts`, `announcer.tsx`.
- **Export**: `export/scene.ts` (`SceneCard`, `SceneEdge`, `SceneCollapsed`), `render-svg.ts` (`card`, `edge`), `edge-geometry.ts`, `export-palette.ts` `LIGHT_PALETTE`, `export-fonts.ts`, `icon-paths.ts`, `text-measure.ts`, ADR 0016.
- **UI package**: `tokens.css` (`--sd-card-*-fill|stroke`), `theme.css` (`--radius-node`, shadows, `--color-card-*`), `test/contrast.test.ts`, `readable-text`, `SegmentedControl`.

## Summary

Every card, group, handle and connector takes board B's Deck look, and connectors get a per-connector line type.

- **File format** (R1, R2): new `EdgeShape` and `EdgeStyle { shape? }`, optional `Edge.style` written after `route`; semantic rule S7 for an empty edge style. `edgeShape(edge)` = stored shape, else elbow when `route.offset` exists, else curved. Matches ADR 0022; no version bump.
- **Model** (R3): `setEdgeShape(edgeIds, shape)` writes the nested `style` `Y.Map` key by key in one transaction; stores the shape explicitly except curved-without-offset; never touches `route`. Reset route pins `elbow` first when the elbow came from the offset default.
- **Geometry** (R4–R6): one pure `routedPath(shape, …)` for curved (Bézier along side normals), elbow (today's smooth step + offset) and straight, all ending at the same side midpoints; self-loops drawn as a small loop; arrows and knobs drawn as paths from the end directions (`forward`, `both`, `none`). Canvas, merged connectors and export share it.
- **Cards** (R7, R8, R10): default width 184; height from a pure, cached `cardLayout` (header 24, title ≤ 3 lines at 14 / 600, description ≤ 3 lines, B's 18px tag pills, "n inside" pill); stored 017 size still wins with a minimum. Lip, lift, tilt and states are CSS on existing classes and flags; `data-lipless` on the wrapper below 60 % zoom; System shows tag dots; Landscape the type icon on the fill.
- **Groups** (R11): collapsed group as a 184 × 112 fanned hand; expanded frame with radius 20 and a label pill on the top edge.
- **Line type control** (R9): `connection.lineType` action (toolbar, context menu, drawer) for one or several connectors (new `connections` target kind), one undo step, mixed state; `lastLineShape` in the UI store for new connectors.
- **Tokens** (R12): `chip` / `ink` / `dot` × 13 colours × 2 themes and the `--sd-deck-*` tokens; contrast tests.
- **Export** (R13): Deck frame, lip, header, tags (new), line types, fanned hand, light palette.
- **Bench** (R14): before / after, plus a `BENCH_LINE_TYPES` run.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `@xyflow/react` ^12 (nodes, edges, `ViewportPortal`, store selectors), `yjs`, `zustand` 5, Radix through `packages/ui` (`SegmentedControl`, menus), `lucide-react` (`Spline`, `CornerDownRight`, `Minus`, `Layers`, `TriangleAlert`; names to be confirmed against the installed version).

**Storage**:

- Schema v1, additive: `EdgeShape`, `EdgeStyle`, `Edge.style`. Types and Zod regenerated with `pnpm schema:generate`.
- Yjs (ADR 0021): nested `style` `Y.Map` on the edge map; no layout change, no migration.
- UI store: `lastLineShape` (memory only, per tab).

**Testing**: Vitest (schema, model, ui, app pure modules), Testing Library (actions, toolbar, drawer, card and group components by role and name). No new e2e (constitution VI `TODO(e2e)`); the smoke suite must stay green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo — Vite SPA (`apps/app`) + internal packages (`schema`, `model`, `ui`).

**Performance Goals**: no regression vs `bench-before.md` in pan FPS and long frames at 500 nodes / 1,000 edges (constitution V target 60 fps); `cardLayout` for 500 cards < 20 ms; export scene + SVG still < 50 ms at 500 / 1,000 (ADR 0016).

**Constraints**: size never depends on zoom (§g-58); tilt / lift / fan paint-only (§g-74); no colour-only state (VII); export light only (ADR 0016); no network (IV).

**Scale/Scope**: ~5 schema / model files, ~25 app files, ~3 ui files, docs (DESIGN.md, ADR 0016, ADR 0022, package `CLAUDE.md`s). Estimate 6 d (backlog).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle | Status | How |
| --- | --- | --- |
| I. Single source of truth | ✅ | The line type lives only in the Yjs edge map (`style.shape`); canvas, drawer, toolbar and JSON panel read `edgeShape(edge)`. `lastLineShape` is a UI preference for *new* connectors, not document state, and is only applied by writing to the document at creation. Card size, look and zoom painting are derived, never stored. |
| II. Schema-owned format, lossless round-trip | ✅ | `EdgeShape` / `EdgeStyle` in `v1.json`, regenerated types + Zod, S7 semantic rule for the dropped `minProperties`, invalid fixtures for parity. Round-trip cases: each shape, curved + offset, empty style rejected. Additive, `version` 1, as ADR 0022 lists. Only `packages/model` converts Yjs ↔ JSON. |
| III. Stable identity | ✅ | No new identities; `setEdgeShape` and the action target edges by id. |
| IV. Local-first, private | ✅ | No network; fonts and icons stay bundled; export unchanged in that respect; smoke no-third-party check unchanged. |
| V. Performance off the main thread | ✅ | No heavy work added: `cardLayout` is cached pure text measuring (same technique as `card-tags.ts`), the lip rule is one wrapper flag (no card re-render), Bézier paths cost like smooth steps. Bench before / after is a gate (R14). |
| VI. Strict types, tested behaviour | ✅ | Pure modules (`edgeShape`, `routedPath`, `cardLayout`, ends / arrows) unit-tested; model op + concurrency tests; action / toolbar / drawer tests by role and name per [contracts/deck-look-ui.md](contracts/deck-look-ui.md); no new e2e. |
| VII. Accessible by default | ✅ | Every state keeps a non-colour cue (solid vs dashed outline, ⚠ + count, lift, opacity); line type is a keyboard-operable `menuitemradio` / `radiogroup` with names and a mixed state; reduced motion disables transitions; ink on chip ≥ 4.5:1 tested. |
| VIII. Simplicity, justified deps | ✅ | No new dependency; one geometry module shared by canvas and export; the ADR 0022 row is confirmed and refined in place (no new ADR); ADR 0016 consequences updated. |

## Project Structure

### Documentation (this feature)

```text
specs/029-card-look-deck/
├── spec.md
├── plan.md                 # this file
├── research.md             # R1–R15
├── data-model.md
├── quickstart.md
├── contracts/
│   └── deck-look-ui.md
├── checklists/requirements.md
├── tasks.md                # /speckit-tasks
├── bench-before.md, bench-after.md, visual-check.md, screens/   # during implementation
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                      # EdgeShape, EdgeStyle, Edge.style
├── src/semantic-rules.ts               # S7 empty edge style
├── src/generated/{types,zod}.ts        # regenerated
├── examples/full.sododeck.json         # edge with style.shape (coverage)
└── test/fixtures.ts                    # invalid: bad shape, empty style

packages/model/
├── src/edge-shape.ts                   # edgeShape(edge) (pure, exported)
├── src/ops/edge-style.ts               # setEdgeShape
├── src/ops/shape.ts                    # reset-route elbow pinning
├── src/validate.ts                     # ELEMENT_SCHEMAS.edgeStyle
├── src/editor.ts, src/index.ts         # DeckEditor.setEdgeShape, exports
└── test/{edge-style,round-trip,concurrency,shape}.test.ts

packages/ui/
├── src/styles/tokens.css               # chip/ink/dot × 13 × 2, --sd-deck-*
├── src/styles/theme.css                # mappings, radius-card 14, radius-frame 20
└── test/contrast.test.ts               # ink/chip, dot/fill

apps/app/src/
├── index.css                           # lip, states, handles, data-lipless, reduced motion
├── state/ui-store.ts                   # lastLineShape
├── editor/
│   ├── canvas.tsx                      # liplessSelector → data-lipless
│   ├── canvas-geometry.ts              # 184 default, cardSize via cardLayout
│   ├── card-layout.ts (+ .test.ts)     # new: pure layout + cache
│   ├── card-tags.ts, card-text.ts      # B metrics
│   ├── deck-node.tsx                   # Deck frame, header, badges, Landscape/System painting
│   ├── collapsed-group-node.tsx        # fanned hand
│   ├── group-boundary-node.tsx         # Deck frame + label pill
│   ├── deck-to-flow.ts                 # shape in edge data + cache; look chip/ink/dot
│   ├── deck-edge.tsx, merged-edge.tsx  # routedPath, arrow / knob
│   ├── edge-ends.tsx (+ test)          # new: arrow + knob from ends
│   ├── routing/route-path.ts (+ test)  # routedPath: curved / elbow / straight / self-loop
│   ├── routing/endpoint-connection-line.tsx
│   ├── style/card-style.ts             # CardLook chip / ink / dot
│   ├── actions/connection-actions.ts   # connection.lineType
│   ├── actions/shape-actions.ts        # resetRoute only for elbow
│   ├── actions/use-action-context.ts   # 'connections' target
│   ├── quick-edit/toolbar-variant.ts   # 'connections' variant
│   ├── canvas-actions.ts               # new connector gets lastLineShape
│   ├── inspector.tsx                   # multi-connector frame with Line type
│   ├── inspector/edge-inspector.tsx    # Line section; RouteFields only for elbow
│   └── export/{scene,render-svg,edge-geometry,export-palette,export-fonts,icon-paths}.ts
└── bench/perf.bench.ts                 # BENCH_LINE_TYPES

docs/  DESIGN.md · decisions/0016-export-rendering.md · decisions/0022-schema-roadmap.md · backlog.md
```

**Structure Decision**: existing monorepo layout; schema → model → app dependency direction kept. Shared geometry stays in the app (`routing/route-path.ts`) because export lives in the app too; `edgeShape` lives in `packages/model` because it interprets stored data.

## Complexity Tracking

No constitution violations to justify.

## Notes for tasks

- **Build order**: schema (R1) → model op + `edgeShape` (R2, R3) → tokens (R12) → `routedPath` + ends (R4–R6) → card layout + `DeckNode` (R7, R8, R10) → groups (R11) → line-type action, drawer, `lastLineShape` (R9) → export (R13) → docs (R15). Bench before is the first task and bench after the last.
- The user stories map as: US1 = R7 / R10 / R12; US2 = R10; US3 = R1–R6 / R9; US4 = R8; US5 = R11; US6 = R13.
- Card width 164 → 184 changes every card without a stored size; existing tests asserting 164 / 50 must be updated, not skipped.
- `tidy-layout` cell and group fitting follow the new sizes (R7).
- Keep the smoke e2e green (selectors by role and name are unchanged by the contract).
