# Implementation Plan: Database notes on hover and relationship reshaping

**Branch**: `064-db-notes-and-relationship-routing` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/064-db-notes-and-relationship-routing/spec.md`

## Summary

Make database notes readable on the canvas and let relationships be reshaped like card connectors.

1. **Popovers (US1, US2)**: rows with hidden information (note, cut name/type, default, check, increment) and table titles with a note open a popover on hover rest, keyboard focus rest, or a click/tap on a new note icon. Built on the enum chip popover pattern (052) and the row hover suspension rules (043).
2. **Table note text removed** (clarification 3): the table card no longer draws its note under the title; height and row anchors drop the note term; `hideNotes` now hides note icons.
3. **Relationship reshaping (US3)**: no schema change. Fix the model bug that makes "Curved" unsavable on relationships, render the card connector's bend/segment handles for relationships in row mode with a stub-aware segment function, show the effective line type and a Reset route control in the relationship drawer.

Details and evidence: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: `@xyflow/react` (canvas), Yjs via `@sododeck/model`, Zustand (UI state), Radix Popover via `@sododeck/ui`, `lucide-react`. No new dependency.

**Storage**: Yjs document in IndexedDB; `.sododeck` files. No format change.

**Testing**: Vitest (unit, model round-trip), Testing Library (components); existing Playwright smoke suite only.

**Target Platform**: Modern desktop and tablet browsers (Chromium, Safari, Firefox).

**Project Type**: Web SPA in a pnpm/turbo monorepo (`apps/app`, `packages/model`).

**Performance Goals**: 60 fps pan/zoom at 500 nodes / 1,000 edges unchanged (`pnpm bench` before/after); popover opens < 500 ms after rest.

**Constraints**: No network with content; hover handling delegated (no per-row listeners); layout computations stay in the cached pure layout.

**Scale/Scope**: ~12 app files, 1 model file, 1 settings label, DESIGN.md table card section; 3 user stories.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status | Notes                                                                                                                                                  |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | ✅     | Notes, shape, waypoints live in Yjs. `dbPopover` holds only ids and source (UI state). Popover reads the deck by id on render.                         |
| II. Schema-owned format, lossless round-trip | ✅     | No schema change. `setEdgeStyle` fix is in `packages/model` with a new round-trip case (relationship with `style.shape: 'curved'` + waypoints).        |
| III. Stable identity                         | ✅     | Popover targets by node/column id; rename while open updates (edge case).                                                                              |
| IV. Local-first, private                     | ✅     | No network. No new assets beyond bundled lucide icon.                                                                                                  |
| V. Performance off main thread               | ✅     | No heavy work. Canvas change → `pnpm bench` before/after (`bench-before.md`, `bench-after.md`).                                                        |
| VI. Strict types, tested behavior            | ✅     | Unit tests for layout flags, hover module, segment vertices, model op; component tests by role/label for popovers, icons, handles, drawer. No new e2e. |
| VII. Accessible by default                   | ✅     | Icon buttons with names; popover `role="dialog"` with label; focus-rest parity and announcer; Escape closes; not colour-only.                          |
| VIII. Simplicity, justified deps             | ✅     | Reuses enum popover pattern, bend engine, Radix Popover. One new geometry function.                                                                    |

**Post-design re-check**: ✅ unchanged after data-model and contracts. No violations, Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/064-db-notes-and-relationship-routing/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-contract.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/model/
├── src/ops/edge-style.ts                     # fix: store 'curved' on relationships
└── test/                                     # ops + round-trip case

apps/app/src/
├── state/ui-store.ts                         # dbPopover slice; mutual exclusion with enumPopover
├── editor/
│   ├── table-layout.ts                       # drop note height; hasNote, noted, row.hasNote, row.hidden
│   ├── deck-node.tsx                         # remove table-note block; title note icon
│   ├── canvas.tsx                            # header hover delegation; mount <DbPopover/>
│   ├── canvas-geometry.ts                    # descriptionLines → 0
│   ├── hover-focus/use-hover-focus.ts        # export suspension predicate
│   ├── table/
│   │   ├── table-body.tsx                    # row note icon; drop native title; focus-rest hook
│   │   ├── note-icon.tsx                     # new: icon button
│   │   ├── db-hover.ts                       # new: rest/grace timers, suspension, touch
│   │   ├── db-popover.tsx                    # new: column + table popover
│   │   └── table-text.ts                     # constraint lines, announce text
│   ├── deck-edge.tsx                         # RouteHandles for relationships (row mode)
│   ├── editing/segment-drag.ts               # relationshipSegmentVertices (stub-aware)
│   ├── routing/route-handles.tsx             # optional anchors/ends for relationships
│   ├── inspector/relationship/relationship-inspector.tsx  # effective line type; Reset route
│   ├── inspector/database/database-section.tsx            # "Notes" → "Note icons"
│   └── export/scene.ts, export/render-svg.ts # no note text; icons
DESIGN.md                                     # table card: note icon, popover
```

**Structure Decision**: Stays inside `apps/app` and `packages/model`; dependency direction `app → model → schema` unchanged. No `packages/ui` change (Radix Popover already exported).

## Implementation order

1. **Model fix** (`setEdgeStyle`) + tests. Unblocks US3 shape.
2. **Layout** (`table-layout.ts`): remove note height, add flags; update layout/scene/deck-node tests. Bench before this step.
3. **US1/US2**: note icon, `dbPopover` slice, `db-hover.ts`, `DbPopover`, canvas delegation for rows and title, keyboard focus rest, drawer button; settings label; export.
4. **US3**: relationship handles in `deck-edge.tsx`, stub-aware segment drag, drawer line type + Reset route.
5. DESIGN.md, package `CLAUDE.md` if APIs changed, bench after, full DoD commands, screenshots for the quickstart table.

## Risks

- **Height change on existing decks** (FR-005a): tables with notes shrink; positions kept. Covered by layout tests; noted in the report.
- **Segment drag on stubs**: new geometry; covered by unit tests on `relationshipSegmentVertices` and a component test on the handle drag.
- **Hover noise**: suspension predicate shared with row hover; tests for drag/connect suppression.

## Complexity Tracking

None.
