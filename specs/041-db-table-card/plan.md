# Implementation Plan: Table Card

**Branch**: `041-db-table-card` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/041-db-table-card/spec.md`

## Summary

Draw every `db-table` node (040) as a Deck table card on the canvas and in PNG / SVG export.
One pure layout (`table-layout.ts`) computes rows, cuts and height for both; `DeckNode` keeps the
card frame, header, states and accessibility and swaps its body for `TableBody`. A table's size
follows its effective detail (own choice, else the deck's; Auto = All) and the display toggles,
never the zoom; below 90 % zoom it draws System or Landscape content in the same box. Two optional
file additions: root `tableDisplay` (deck detail and four hide flags) and `DbEnum.color`. Enum
chips open one shared popover on hover or Enter. Controls: a Table detail control in the zoom
island, a Detail submenu and header toggle per table, and a Database section with four switches
in Deck settings. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Node ≥ 24

**Primary Dependencies**: existing only: React Flow (`@xyflow/react`), Radix via `packages/ui`
(Popover, Switch, SegmentedControl, DropdownMenu), lucide-react, Yjs, generated Zod

**Storage**: deck Yjs document (two optional fields), `.sododeck.json`

**Testing**: Vitest + Testing Library (layout, keys, body, popover, actions, inspector, export
scene / SVG); schema parity; model round-trip and concurrency; existing smoke e2e; `pnpm bench`

**Target Platform**: modern browsers (canvas on the main thread; problems / layout workers
unchanged)

**Project Type**: pnpm monorepo: `apps/app` (most work), `packages/schema`, `packages/model`,
`packages/ui` (no new components expected)

**Performance Goals**: 150 tables × 12 columns pan / zoom within 10 % of 150 cards (SC-004);
detail switch updates within one frame; export scene within its existing < 50 ms budget

**Constraints**: height computed, never measured (§g-58); export never reads the DOM (ADR 0016);
size independent of zoom; no Radix tooltip per row; tokens only; Deck card look only (DB3)

**Scale/Scope**: ~8 new app files, ~10 changed; 2 schema additions; 1 model op; 1 ADR amendment
note

**Blocked by**: 040 implementation (PR #78 is docs only). Tasks start after 040 merges.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                       | Status |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth           | Display settings and enum colour live in the Yjs doc; layout and FK map are derived per snapshot; popover state is UI-only | Pass   |
| II. Schema-owned format, round-trip | `v1.json` first, regenerate, parity; model round-trip cases; additive only                                                 | Pass   |
| III. Stable identity                | Rows keyed by column id; popover state by node and column id                                                               | Pass   |
| IV. Local-first and private         | No network; icons bundled                                                                                                  | Pass   |
| V. Performance                      | Rows plain, no per-row tooltip, cached derivations; bench before / after with 150 tables                                   | Pass   |
| VI. Strict types, tested behavior   | Unit + component tests listed in quickstart; no new e2e                                                                    | Pass   |
| VII. Accessible by default          | Card and row names, glyphs not colour-only, keyboard popover and detail controls, AA contrast (§g-90)                      | Pass   |
| VIII. Simplicity                    | No dependency; reuses DeckNode, card geometry routing, export scene, actions, inspector sections                           | Pass   |

**Post-design re-check**: Pass. Planning corrected the spec (size never follows zoom; no PDF
export or lock state exists yet) instead of adding behaviour the codebase does not have.

## Project Structure

### Documentation (this feature)

```text
specs/041-db-table-card/
├── plan.md
├── research.md            # R1–R15
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── format-and-model.md
│   └── table-card-ui.md
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/schema/v1.json, examples/, test/fixtures.ts   # TableDisplay, DbEnum.color
packages/model/src/ops/db-enums.ts (040) + ops/table-display.ts (new), read.ts/write.ts, editor.ts
packages/model/test/                                            # round-trip, ops, concurrency

apps/app/src/editor/
├── table-layout.ts (new)            # TABLE_CARD, tableLayout()
├── table-keys.ts (new)              # fkColumns, schemaCount, enumById (cached)
├── canvas-geometry.ts               # route db-table to tableLayout
├── deck-to-flow.ts                  # data.table, cache check
├── deck-node.tsx                    # TableBody, compact System/Landscape, header toggle, a11y name
├── table/table-body.tsx (new)       # rows, glyphs, pill, footer
├── table/enum-chip.tsx (new), table/enum-popover.tsx (new)
├── actions/table-detail-actions.ts (new), actions/index.ts
├── shell/table-detail-control.tsx (new), shell/zoom-island.tsx
├── inspector/deck-inspector.tsx     # Database section
├── export/scene.ts, export/render-svg.ts, export/export-palette.ts
(apps/app/src/state/ui-store.ts: enumPopover)

apps/app/src/bench/generate-deck.ts, routes/bench-page.tsx, bench/perf.bench.ts   # tables option
docs/decisions/0029-database-pack-model.md (amend: tableDisplay, enum colour) or a short ADR 0030
DESIGN.md (Database pack: zoom-size rule note), docs/design/design-analysis.md §g (frame 162 note)
```

**Structure Decision**: the table is a body variant of the existing Deck card, not a new node
type; layout is a pure module shared with export.

## Phases (for /speckit-tasks)

1. Format and model: `TableDisplay`, enum colour, `setTableDisplay`.
2. Pure layer: `table-layout.ts`, `table-keys.ts`, geometry routing (US1 foundation).
3. Canvas body and glyphs (US1), compact levels (US3 part).
4. Enum chip and popover (US2).
5. Detail controls: zoom island, menu, header toggle (US3).
6. Display toggles and Deck settings section (US4).
7. Export scene and SVG (US5).
8. Bench, docs, §g note, DoD.

## Complexity Tracking

No constitution violations to justify.
