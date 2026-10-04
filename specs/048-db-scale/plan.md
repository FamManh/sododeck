# Implementation Plan: Database Scale

**Branch**: `048-db-scale` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/048-db-scale/spec.md`

## Summary

Long tables and big schemas stay usable. The **row limit** (12, keys first, rows with a relationship
never cut) is added inside the one function that already decides a table's rows and height
(`table-layout.ts`), so the canvas, connectors, hit areas and exports cannot disagree; the saved
choice is the existing, still unused `node.expanded` field. A UI-only **column filter** is passed
into the same layout as a projection. A new deck-level **grouping mode** (By group / By schema)
feeds the existing group machinery with virtual `schema:<name>` groups, so collapse, merged ×n
connectors and per-view collapse state are reused. **View filters** add two additive view fields
(`schemas`, `detail`) on top of 011's filter; hidden tables get outside proxies through 034's port
machinery. **Jump to** adds `table` and `column` kinds to the ⌘K index and a column-aware open
handler. **Focus (F)** is reused; only the highlight of relationships among kept tables is added.
The **bench** gets a 150-table scenario with wide tables and schemas. Decisions in
[research.md](research.md); new ADR 0034.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: existing only: `@xyflow/react`, Yjs via `@sododeck/model`, Zustand,
`packages/ui`. No new runtime dependency.

**Storage**: Yjs deck in IndexedDB. Two additive format keys: deck `groupingMode`, view `schemas`
and `detail`. `node.expanded` already exists (040). Filter text, focus and temporary reveal are
UI-only state.

**Testing**: Vitest (pure layout / filter / grouping / search functions, model ops, round-trip,
Ajv/Zod parity), Testing Library (button, filter, palette results, view settings), `pnpm bench`
before and after; existing Playwright smoke suite only (no new e2e, constitution VI).

**Target Platform**: evergreen desktop browsers.

**Project Type**: web app in a pnpm monorepo (`apps/app`, `packages/schema`, `packages/model`).

**Performance Goals**: 150-table deck pans at the 500-card target (avg ≥ 57 fps, p95 ≤ 20 ms);
open ≤ 1.5× a 500-card deck; ⌘K type-to-results ≤ 50 ms with 1,800 columns indexed; collapse /
expand a 50-table schema ≤ 1 s.

**Constraints**: writes only through `DeckEditor`; no network with content; hidden rows are not
laid out for drawing; cache keys of the table layout include every new input.

**Scale/Scope**: 150 tables / 1,800 columns / 250 relationships; one table up to 60 columns.

## Constitution Check

_GATE: passes before Phase 0; re-checked after Phase 1._

| Principle                         | Status | How                                                                                                                                                                                                       |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth         | ✅     | Saved choices (`expanded`, `groupingMode`, view fields) live in Yjs. Filter text, focus, temporary reveal are UI state that never mirrors document data. Virtual schema groups are derived, never stored. |
| II. Schema-owned format, lossless | ✅     | Three additive optional keys in `packages/schema` (regenerated types and Zod), round-trip and parity tests; defaults are removed on write so old files stay identical.                                    |
| III. Stable identity              | ✅     | Hidden rows keep their ids; virtual group ids are `schema:<name>` and never collide with stored group ids (ids are not derived from titles for stored objects).                                           |
| IV. Local-first, private          | ✅     | No requests; palette index is local.                                                                                                                                                                      |
| V. Off the main thread            | ✅     | No new heavy work: row selection is O(columns) and cached per node; palette index is cached by nodes identity and measured against the 50 ms budget (R9). Layout stays in its worker.                     |
| VI. Strict types, tested          | ✅     | Tests listed in [quickstart.md](quickstart.md); no new e2e.                                                                                                                                               |
| VII. Accessible                   | ✅     | Show all is a button with an accessible name; filter field labelled, counter in a live region; reduced motion disables pan animation; contrast reuses DESIGN.md tokens.                                   |
| VIII. Simplicity, justified deps  | ✅     | No dependency; reuses `tableLayout`, `visibleGraph`, `viewFilter`, `focusSet`, the palette.                                                                                                               |

Re-check after design: no violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/048-db-scale/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── file-format.md
│   └── scale-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                    # + deck groupingMode, view schemas, view detail
├── src/generated/                    # regenerated (pnpm schema:generate)
└── test/fixtures.ts, examples/       # round-trip cases

packages/model/
├── src/deck.ts, read.ts, validate.ts # groupingMode in meta
├── src/ops/deck-grouping.ts          # setGroupingMode (new)
├── src/ops/views.ts                  # SETTINGS_KEYS += schemas, detail
├── src/editor.ts                     # DeckEditor.setGroupingMode
├── src/search/                       # kinds table, column; entries; ranking
└── test/                             # round-trip, concurrency, search

apps/app/src/
├── editor/table-layout.ts            # row limit, button slot, filter projection, anchors
├── editor/table-keys.ts              # context: expanded, filter
├── editor/table/table-body.tsx       # Show all / Show fewer, filter field, match highlight
├── editor/table/table-filter.tsx     # in-table filter (new)
├── editor/schema-groups.ts           # derived deck with virtual schema groups (new)
├── editor/visible-graph.ts           # consumes derived groups; merged list carries FKs
├── editor/merged-edge-popover.tsx    # lists column pairs for relationships
├── editor/view-filter.ts             # schemas filter, outside proxies for hidden tables
├── editor/views/view-settings-popover.tsx  # schemas, tables, detail
├── editor/focus-set.ts               # highlight edges among kept tables
├── editor/command-palette/           # table / column results, open-result column case
├── editor/inspector/table-display-section.tsx  # grouping mode control
├── editor/shell/shortcuts.ts, use-canvas-shortcuts.ts  # ⌘F in a table
├── bench/generate-deck.ts, routes/bench-page.tsx, bench/perf.bench.ts  # 150-table scenario
└── (tests next to code)

docs/decisions/0034-db-scale.md, docs/performance.md
apps/app/CLAUDE.md, packages/model/CLAUDE.md, packages/schema/CLAUDE.md
```

**Structure Decision**: extend the existing modules; no new package. Pure functions (row
selection, schema grouping, filter, search entries) are unit-tested without React.

## Complexity Tracking

None.
