# Implementation Plan: Schema Lint

**Branch**: `047-db-lint` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/047-db-lint/spec.md`

## Summary

Schema mistakes show up in the Problems list, on the canvas and in the export dialog, with one-click fixes:

- Every problem gets a fixed **severity** (error or warning) in `@sododeck/model`'s `checkDeck`; the list sorts errors first and counts both.
- 15 new `db-*` rules run in the same worker pass (`checkDatabase`). Type data (`COMMON_TYPES`, dialect type lists) moves from the app into `packages/model/src/db-types.ts`, so type comparison treats common names as equal (`int` = `integer`) and "type not in the dialect's list" can be checked.
- Problems carry an optional faulty row and a list of fixes as plain data. The app applies fixes in one undo step, marks rows (replacing 043's (!) icon), dashes relationships with a short label, colours badges by severity, and opens a fix popover on go-to.
- The export dialog shows errors and warnings; 052's block switch counts errors only (resolves `TODO(047)`).

Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Node ≥ 24

**Primary Dependencies**: existing only (`packages/ui` SegmentedControl, Popover, Button; lucide-react `CircleX`, `TriangleAlert`; Yjs). No new dependency.

**Storage**: none. Problems are derived (ADR 0013); no file format change.

**Testing**: Vitest (model rules, severity, sort, type comparison, perf), Testing Library (panel, popover, marks, fixes, export), the existing smoke e2e (no new e2e), `pnpm bench` before and after (canvas marks change).

**Target Platform**: modern browsers; lint runs in the existing problems worker (150 ms throttle).

**Project Type**: pnpm monorepo.

- `packages/model`: severity, rules, fixes as data, `db-types.ts`.
- `apps/app`: marks, panel, popover, apply-fix, junction table, export, imports of the moved type data.
- `packages/schema`, `packages/ui`: unchanged.

**Performance Goals**: `checkDeck` on 150 tables within the existing 30 ms (× slack) budget; problems visible < 1 s after an edit (SC-002); bench with 150 tables stays within 5 %.

**Constraints**: problems never written to the deck or Zustand (only filter, popover and reveal UI state); one undo step per fix; severity told apart by icon, not colour alone; tokens only; no other tool named.

**Scale/Scope**: about 6 new files, about 25 changed (12 of them import updates for the moved type data); ADR 0013 and 0029 amendments.

**Blocked by**: nothing. 048 (row limit) merged on 2026-10-04 (#102); the reveal override projects the table at All and expanded, as 048's row-edit override does.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                       | Status |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth           | Problems are derived from the Yjs snapshot; fixes write through `DeckEditor`. Filter, popover and reveal are UI-only.      | Pass   |
| II. Schema-owned format, round-trip | No format change. Moving type data into `@sododeck/model` keeps Yjs ↔ JSON untouched.                                      | Pass   |
| III. Stable identity                | Problem keys are built from ids; fixes reference ids; the junction table gets model ids.                                   | Pass   |
| IV. Local-first and private         | No network.                                                                                                                | Pass   |
| V. Performance                      | Lint stays in the worker; one indexed pass, linear loop detection; perf test and bench before / after.                     | Pass   |
| VI. Strict types, tested behavior   | Unit and component tests per the quickstart; no new e2e.                                                                   | Pass   |
| VII. Accessible by default          | Severity icons with text labels, announced fixes, keyboard list and popover, focus returns to the row.                     | Pass   |
| VIII. Simplicity                    | No dependency; reuses the problems pipeline, marks, go-to, row focus, the All override, 052's drawers and 043's table ops. | Pass   |

**Post-design re-check**: Pass. Two planning decisions beyond the spec, both in research: type data moves into the model (R2), and relationships are excluded from `duplicate-connection` so a duplicate relationship is reported once (R3).

## Project Structure

### Documentation (this feature)

```text
specs/047-db-lint/
├── plan.md
├── research.md            # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── lint-rules.md      # kinds, severities, messages, targets, fixes, comparisons
│   └── lint-ui.md         # list, popover, canvas marks, fix labels, export banner
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
packages/model/src/
├── db-types.ts (new)          # moved type data + sameColumnType, idTypeOf
├── problems.ts                # Severity, SEVERITY, column, fixes, counts, sort, 15 rules
└── index.ts
packages/model/test/problems.test.ts, db-types.test.ts (new), perf.test.ts

apps/app/src/
├── db/export/common-types.ts, db/import/convert-types.ts   # import data from the model
├── db/dialect-types.ts (removed; importers use @sododeck/model)
├── db/junction-table.ts (new)
├── state/ui-store.ts                                     # problemFilter, problemPopover, problemReveal
├── views/view-state.ts                                   # reveal override (All)
├── editor/
│   ├── problems/problems-panel.tsx, severity-icon.tsx (new), apply-fix.ts (new),
│   │   problem-fix-popover.tsx (new), problem-marks.ts, go-to-problem.ts, use-go-to-problem.ts
│   ├── table-keys.ts, table-layout.ts, table/table-body.tsx   # row problem glyph; mismatch removed
│   ├── relationships/type-mismatch.ts                         # sameColumnType
│   ├── inspector/relationship/column-pairs.tsx                # sameColumnType
│   ├── deck-node.tsx, deck-edge.tsx                           # severity colour, dashed relationship, short pill
│   ├── shell/rail.tsx                                         # badge colour
│   └── export/schema-problems.ts, export-dialog.tsx, schema-export-panel.tsx
docs/decisions/0013-derived-problems.md (amendment: severity, fixes), 0029-database-pack-model.md (amendment: lint),
docs/backlog-database.md (047 status, inventory), apps/app/CLAUDE.md, packages/model/CLAUDE.md
```

**Structure Decision**: rules and severity live with the existing checks in the model (worker); everything that writes or draws is in the app, reusing existing paths.

## Phases (for /speckit-tasks)

1. **Model foundation:** `db-types.ts` move and `sameColumnType`; app imports updated; severity, counts, sort, `column`, `fixes` (032 fix migrated).
2. **Rules (US1):** the 15 kinds with keys, messages, rows and fixes; `duplicate-connection` skips relationships; perf test.
3. **US1 UI:** marks (severity, rows, short), table row glyph replacing 043's mismatch, dashed relationships, badge colours, list filter and severity icons.
4. **US2:** apply-fix for every fix, junction table, go-to with row focus, reveal and popover, locked fixes.
5. **US3:** export banner counts and error-only blocking.
6. **Wrap-up:** bench before / after, docs and ADR amendments, backlog, definition of done.

## Complexity Tracking

There are no constitution violations to justify.
