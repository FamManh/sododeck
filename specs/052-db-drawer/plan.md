# Implementation Plan: Database Details Drawer

**Branch**: `052-db-drawer` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/052-db-drawer/spec.md`

## Summary

Every table, relationship and enum setting gets an editing surface in the details drawer, and column types follow the deck's dialect:

- The drawer dispatcher gains a table branch (tabs General, Columns, Indexes, Checks), a relationship branch and a new `enum` drawer mode. All writes use existing `DeckEditor` ops for columns, indexes, checks, enums and edges.
- Dialect type lists and index methods are app data in `apps/app/src/db/dialect-types.ts`, derived from 045's `COMMON_TYPES`. A dialect change is a pure plan (`db/dialect-change.ts`, reusing 044's `convertType` and 045's `translateType`), shown in a confirm dialog and applied as one batch with an Undo toast.
- Enum renames rewrite linked column types, and value renames rewrite matching defaults, in one batch each (`db/enum-edits.ts`).
- Deck settings' Database section adds the dialect select, the enums list and a "Block SQL export with errors" switch, the only format change (`blockSqlExport`). The export dialog disables SQL Copy and Download while the scope has database problems.

Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Node ≥ 24

**Primary Dependencies**:

- Existing only: `packages/ui` (Combobox, Select, Switch, SegmentedControl, Dialog, Popover, Toast), lucide-react, Yjs, generated Zod.
- No new dependency: tabs are a small app tablist (R2).

**Storage**: the deck's Yjs document with one optional root field, `blockSqlExport`. The `.sododeck.json` format stays at v1.

**Testing**: Vitest and Testing Library (dialect data and plan, enum edits, live-field validation, each tab and inspector, Database section, export blocking), the schema parity test, model round-trip, the existing smoke e2e (no new e2e). No canvas rendering change, so no bench run is required; the dialect plan has a perf test.

**Target Platform**: modern browsers. All work runs on the main thread; the largest job (planning a dialect change over 1,800 columns) is a single pass under 50 ms.

**Project Type**: pnpm monorepo.

- `apps/app`: most of the work.
- `packages/schema`: `blockSqlExport`.
- `packages/model`: `setBlockSqlExport`, read and load.
- `packages/ui`: unchanged.

**Performance Goals**: drawer edits show on the canvas in the same frame as other inspector writes; dialect plan and apply under 1 s on 150 tables (SC-004).

**Constraints**:

- No document state in Zustand: tab, expanded row, confirm plan and drawer mode are UI-only.
- One undo step per change (FR-003): `useLiveField` per focus, `oneStep` / `editor.batch` for discrete and cross-object writes.
- Tokens only; shared `packages/ui` controls (§g-86); confirm via `fields/confirm-dialog.tsx` (§g-84).
- No other tool is named anywhere.

**Scale/Scope**: about 25 new app files, about 12 changed; 1 schema field; 1 model op; an amendment to ADR 0029.

**Blocked by**: nothing. 040–046 are merged.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                                                   | Status |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I. Single source of truth           | Every drawer value is read from the snapshot and written through `DeckEditor`. Tabs, expanded rows, drawer mode and the dialect plan are UI-only.      | Pass   |
| II. Schema-owned format, round-trip | `v1.json` changes first, then regenerate and run the parity test. Round-trip cases for `blockSqlExport`. The change is additive.                       | Pass   |
| III. Stable identity                | Renames and type changes keep ids; enums and column pairs are referenced by id. New enums get model ids.                                               | Pass   |
| IV. Local-first and private         | No network. Type lists are bundled data.                                                                                                               | Pass   |
| V. Performance                      | The dialect plan is one pass and perf-tested; no canvas render path changes.                                                                           | Pass   |
| VI. Strict types, tested behavior   | Unit and component tests per the quickstart. No new e2e.                                                                                               | Pass   |
| VII. Accessible by default          | ARIA tablist, labelled fields, announced tab changes and conversions, keyboard reorder, messages in text not colour.                                   | Pass   |
| VIII. Simplicity                    | No dependency. Reuses `convertType`, `translateType`, `COMMON_TYPES`, `useLiveField`, `deleteColumn`, `typeMismatch`, `ConfirmDialog`, the Undo toast. | Pass   |

**Post-design re-check**: Pass. Planning corrected the spec on four points, all recorded in research: a column row's "Edit details" (new) opens the drawer while 043's "Edit" keeps the line editor (R4); text fields save while typing with one undo step per focus (R3); renaming an enum value renames matching defaults (R7, frame 165); all database problems count as errors until 047 adds severity (R9).

## Project Structure

### Documentation (this feature)

```text
specs/052-db-drawer/
├── plan.md
├── research.md            # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── dialect-data.md    # type lists, index methods, conversion plan
│   └── drawer-ui.md       # files, UI store, entry points, messages, confirms, export blocking
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/schema/v1.json, examples/full.sododeck.json, test/fixtures.ts   # blockSqlExport
packages/model/src/ops/db-enums.ts (setBlockSqlExport), read.ts, deck.ts, validate.ts, editor.ts
packages/model/test/                                                           # round-trip, op

apps/app/src/
├── db/dialect-types.ts (new)               # DIALECT_TYPES, INDEX_METHODS, DIALECT_HINTS, typeEntry
├── db/dialect-change.ts (new)              # planDialectChange, changeGroups
├── db/enum-edits.ts (new)                  # renameEnum, renameEnumValue, nextEnumName
├── state/ui-store.ts                       # drawer 'enum' mode, tableDrawer, dialectConfirm, openTableDrawer, openEnumDrawer
├── editor/
│   ├── inspector.tsx                       # table / relationship branches
│   ├── shell/detail-drawer.tsx             # enum mode
│   ├── inspector/table/* (new)             # table inspector, tabs, columns, type picker, indexes, checks
│   ├── inspector/relationship/* (new)      # pairs, cardinality, actions, name, line, colour
│   ├── inspector/enum/* (new)              # values, used by
│   ├── inspector/database/* (new)          # Database section, dialect select + confirm, enum list
│   ├── inspector/deck-inspector.tsx        # DatabaseSection replaces TableDisplaySection
│   ├── fields/use-live-field.ts            # validate option
│   ├── actions/table-actions.ts            # row.details
│   ├── actions/canvas-actions.ts           # canvas.addEnum
│   ├── table/enum-popover.tsx              # Edit enum
│   ├── palette.tsx                         # Enum tile
│   └── export/export-dialog.tsx, schema-export-panel.tsx  # sqlBlocked
packages/model/src/card-types.ts            # PackTool 'enum', Database pack tools

docs/decisions/0029-database-pack-model.md (amendment: blockSqlExport), docs/backlog-database.md (052 status),
apps/app/CLAUDE.md, packages/schema/CLAUDE.md, packages/model/CLAUDE.md
```

**Structure Decision**:

- Dialect data and the conversion plan are pure modules in `apps/app/src/db/`, next to 044's and 045's type code they reuse.
- Cross-object enum writes are app helpers over `DeckEditor` ops, like 043's `deleteColumn` (R7), so 046's DBML sync is unaffected.
- The drawer reuses 018's frame and 008's field components; only routing and the new panels are added.

## Phases (for /speckit-tasks)

1. **Format and model:** `blockSqlExport` in the schema, model read / load / op, round-trip.
2. **Pure layer:** `dialect-types.ts`, `dialect-change.ts`, `enum-edits.ts`, `useLiveField` `validate`.
3. **Drawer routing:** UI store (`enum` mode, `tableDrawer`, `openTableDrawer`, `openEnumDrawer`), dispatcher branches, tablist, table header.
4. **US1 Columns tab:** rows, expand, type picker with enums, size / scale, flags, default kind, check, note, add / delete / move, `row.details`.
5. **US2 Relationship drawer:** pairs, warning, last-pair confirm, cardinality, optional sides, on delete / update, name, line, colour.
6. **US3 Dialect:** Database section, dialect select with hints, confirm dialog, apply, toast and Undo.
7. **US4 Enums:** enum inspector, values, used by, delete confirm, Enum tile, "Add enum", popover "Edit enum", picker "New enum…".
8. **US5 General, Indexes, Checks tabs.**
9. **US6 Block SQL export:** switch and export dialog blocking.
10. **Wrap-up:** locked read-only state, accessibility pass, frames light and dark, docs, ADR amendment, backlog, definition of done.

## Complexity Tracking

There are no constitution violations to justify.
