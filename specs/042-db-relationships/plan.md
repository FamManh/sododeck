# Implementation Plan: Table Relationships

**Branch**: `042-db-relationships` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/042-db-relationships/spec.md`

## Summary

Draw relationship connectors (040 edges with column ends) from the exact column row of one table
card (041) to the other, with crow's foot or 1 / n end marks, composite brackets, self-reference
loops and labels; create them by dragging from a row port (or C on a focused row), reconnect a
single-column end by dragging, and light a column's relationships on hover. Row anchors are
computed from 041's pure `TableLayout`, not React Flow handles, so canvas, drag hit tests and
export share one geometry. Below 90 % zoom relationships fall back to table-to-table connectors and
may bundle (034). One optional file addition: root `relationshipDisplay` (ends, label mode,
notation). Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Node ≥ 24

**Primary Dependencies**: existing only: React Flow (`@xyflow/react`, `ViewportPortal`), Radix via
`packages/ui` (Switch, Select, SegmentedControl, Popover for the connect popover), lucide-react,
Yjs, generated Zod

**Storage**: deck Yjs document (one optional root field), `.sododeck.json`

**Testing**: Vitest + Testing Library (anchor geometry, sides, paths, marks, loop, labels, type
check, target hit test, focus set, connect / reconnect actions, ports and keyboard path, Deck
settings section, export scene / SVG); schema parity; model round-trip and concurrency; existing
smoke e2e; `pnpm bench`

**Target Platform**: modern browsers (canvas on the main thread; workers unchanged)

**Project Type**: pnpm monorepo: `apps/app` (most work), `packages/schema`, `packages/model`;
`packages/ui` unchanged

**Performance Goals**: 150 tables / ~200 relationships pan, zoom and table drag within 10 % of the
same board with plain connectors (SC-006); column hover within one frame (SC-005, CSS only);
export scene within its < 50 ms budget

**Constraints**: anchors computed, never measured (§g-58); export never reads the DOM nor calls
`toFlowEdges` (ADR 0016); no React Flow handle per row; hover changes no React Flow object (034);
Deck look only (DB3); tokens only

**Scale/Scope**: ~7 new app files, ~14 changed; 1 schema addition; 1 model op; ADR 0029 amendment

**Blocked by**: **041 implementation** (branch `FamManh/feat-db-table-card`, in progress): 042
builds on `TableLayout`, `TableBody`, `table-keys.ts`, the Deck settings Database section and the
bench `tables` option. Tasks start after 041 merges. **050** (connector editing, in progress)
rewrites end handles and reconnect; 042's reconnect (US7, P3) plugs into whatever is on `main` then.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                                          | Status |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth           | Relationships and `relationshipDisplay` live in Yjs; anchors, sides, paths and focus sets are derived; drag, ghost line and hover are UI-only | Pass   |
| II. Schema-owned format, round-trip | `v1.json` first, regenerate, parity; round-trip and concurrency cases for `relationshipDisplay`; additive only                                | Pass   |
| III. Stable identity                | Ends reference column ids; rows keyed `tableId:columnId`; reconnect keeps the edge id; undo restores the same id                              | Pass   |
| IV. Local-first and private         | No network; nothing new loaded                                                                                                                | Pass   |
| V. Performance                      | No per-row handles; CSS-only hover; cached anchor offsets; bench before / after with 150 tables and ~200 relationships                        | Pass   |
| VI. Strict types, tested behavior   | Unit + component tests listed in quickstart; no new e2e                                                                                       | Pass   |
| VII. Accessible by default          | Keyboard row focus and C to connect; relationship names; ends differ by shape; 1 / n text notation; warning as text                           | Pass   |
| VIII. Simplicity                    | No dependency; reuses DeckEdge, connectorPath, endMarks, bundles, hover focus, connect popover, export scene                                  | Pass   |

**Post-design re-check**: Pass. Planning corrected the spec on one point (FR-008: marks follow the
line angle on straight lines, per DESIGN.md) and added a keyboard creation path (R9) that the spec
implied through FR-028 / constitution VII.

## Project Structure

### Documentation (this feature)

```text
specs/042-db-relationships/
├── plan.md
├── research.md            # R1–R20
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── format-and-model.md
│   └── relationships-ui.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/schema/v1.json, examples/, test/fixtures.ts     # RelationshipDisplay
packages/model/src/ops/table-display.ts (041) + setRelationshipDisplay, read.ts/write.ts, editor.ts
packages/model/test/                                             # round-trip, ops, concurrency

apps/app/src/editor/
├── table-layout.ts (041)             # rowsTop / pillTop / titleCenter, rowAnchorY, Keys keeps connected rows
├── table-keys.ts (041)               # connectedColumns
├── relationships/ (new)
│   ├── relationship-ends.ts          # relationshipSides, end anchors, composite brackets, endOf
│   ├── relationship-label.ts         # relationshipLabel, relationshipName
│   ├── type-mismatch.ts              # typeMismatch
│   └── column-target.ts              # columnTargetAt (drag hit test)
├── routing/relationship-path.ts (new)# stubs + connectorPath, selfLoopPath
├── edge-end-marks.ts, edge-ends.tsx  # crow and 1 / n marks
├── deck-to-flow.ts                   # data.rel, label visibility, cache check
├── deck-edge.tsx                     # relationship branch (points, path, marks, aria-label)
├── bundles.ts                        # foldable(level) for relationships
├── connection-rules.ts               # columnConnectionCheck
├── canvas-actions.ts                 # connectColumns, reconnectColumnEnd
├── editing/column-connect-drag.ts (new) + column-connect-line.tsx (new)
├── table/table-body.tsx (041)        # ports, data-row, row roving focus
├── connect-popover.tsx               # column mode
├── use-canvas-shortcuts.ts           # C on a focused row
├── routing/route-handles.tsx         # column end handles → column drag
├── focus-set.ts, hover-focus/*       # columnFocusSet, row selectors
├── inspector/deck-inspector.tsx      # "Show on relationships"
├── export/scene.ts, export/render-svg.ts, export/edge-geometry.ts
(apps/app/src/state/ui-store.ts: columnConnect drag state, focusedRow)

apps/app/src/bench/generate-deck.ts, routes/bench-page.tsx, bench/perf.bench.ts   # rel option
docs/decisions/0029-database-pack-model.md (amendment), DESIGN.md (Database pack: straight-line
marks and stub length note), apps/app/CLAUDE.md + .agents/skills/react-flow/SKILL.md (row anchors
are computed, not handles)
```

**Structure Decision**: a relationship is a branch of the existing `DeckEdge` with computed end
points; geometry is pure (`relationships/`, `routing/relationship-path.ts`) and shared with export
and the drag hit test.

## Phases (for /speckit-tasks)

1. Format and model: `RelationshipDisplay`, `setRelationshipDisplay`.
2. Pure layer: `rowAnchorY`, connected columns (Keys rule), sides, paths, loop, marks, labels,
   type check, target hit test (foundation for US1–US5).
3. Canvas drawing (US1) and special shapes (US4).
4. Create by drag + keyboard (US2).
5. Column hover highlight (US3).
6. Detail levels, zoom fallback, bundles (US5).
7. Deck settings and notation (US6).
8. Reconnect and delete (US7).
9. Export scene and SVG.
10. Bench, docs, ADR amendment, DoD.

## Complexity Tracking

No constitution violations to justify.
