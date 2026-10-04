# Implementation Plan: Schema Export

**Branch**: `045-db-export` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/045-db-export/spec.md`

## Summary

Add a **Schema** section to the existing export dialog (012) with four text formats written from
the deck snapshot: **SQL DDL** (Postgres, MySQL, SQLite), **DBML**, **Mermaid ER** and a
**Markdown data dictionary**, for three scopes (Selection, the database card in context, Whole
deck). All four writers are pure functions over one shared intermediate, the **schema slice**
(tables, enums and relationships in scope, already resolved by id, with export notes collected
while resolving), so the dialect rules, the n–n junction table, foreign-key placement, quoting and
the "skipped / changed" notes live in one tested place. A Generic deck picks the SQL dialect in
the dialog and translates a common type list to it. No runtime dependency; the Postgres output is
executed in tests on an in-process Postgres (PGlite, dev only) and the SQLite output on Node's
built-in `node:sqlite`. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 strict, React 19, Node ≥ 24

**Primary Dependencies**: existing only at runtime (React, Radix via `packages/ui`: RadioGroup,
SegmentedControl, Switch, Select, Tooltip; lucide-react; `@sododeck/model` for `deckDialect`,
`isDbTable`, problems). **New dev dependency** (tests only): `@electric-sql/pglite` (Apache-2.0)
to execute the exported Postgres script. SQLite uses `node:sqlite` (built into Node ≥ 24, no
package). MySQL: golden files only.

**Storage**: none new. Reads the deck snapshot (`useDeckSnapshot`) and UI state (selection,
drill); writes nothing to the deck (FR-006).

**Testing**: Vitest. Pure writer tests with golden files (`apps/app/src/db/export/__golden__/`)
on the "Shop" fixture and an edge-case fixture for each format × dialect; execution tests
(`*.engine.test.ts`, `// @vitest-environment node`) for Postgres (PGlite) and SQLite
(`node:sqlite`); a perf test (150 tables / 1,800 columns / 250 relationships); component tests
for the dialog (format sections, scope, dialect picker, options, notes strip, problems banner,
Copy / Download) via roles and labels. Existing smoke e2e unchanged.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari

**Project Type**: web SPA (`apps/app`) in the pnpm monorepo

**Performance Goals**: each writer < 50 ms for 150 tables / 1,800 columns on the main thread
(ADR 0016's export budget), preview shown < 2 s (SC-004); dialog open time unchanged (012 SC-003)

**Constraints**: no network (constitution IV); deterministic output (FR-013); no deck writes;
English UI; tokens only; no other tool named in code or copy (§g-88, DB5)

**Scale/Scope**: up to 150 tables, 1,800 columns, 250 relationships, 30 enums per export

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth | ✅     | Writers read the `SododeckFile` snapshot that `useDeckSnapshot` already produces from Yjs; the dialog keeps only UI state (format, scope, picked dialect, options) in its reducer. Nothing is cached outside the snapshot.                                                                                           |
| II. Schema-owned format   | ✅     | No schema change. SQL / DBML / Mermaid / Markdown are export formats, not the deck file; `@sododeck/model` stays the only Yjs ↔ JSON path (writers consume its JSON output).                                                                                                                                         |
| III. Stable identity      | ✅     | Every reference (FK columns, index parts, `enumRef`, `parent`) is resolved by id; stale ids become export notes, never crashes. Generated names (index, junction) never feed back into the deck.                                                                                                                     |
| IV. Local-first, private  | ✅     | Text is built in the browser; Copy uses the clipboard, Download uses the existing `downloadText`. No request. Test engines run only in Vitest.                                                                                                                                                                       |
| V. Off the main thread    | ✅     | Text generation is linear and measured at < 50 ms for the 150-table fixture (perf test, same budget as ADR 0016's JSON / SVG export); runs after the dialog's 150 ms debounce. If the perf test fails, the writers move into a worker behind the same `generate` call (research R2).                                 |
| VI. Strict types, tested  | ✅     | Pure writers with golden + execution tests, reducer tests, component tests by role. No new e2e.                                                                                                                                                                                                                      |
| VII. Accessible           | ✅     | Format radios, scope segments, dialect select, switches and banner actions are keyboard reachable with names; the notes strip and banner are text (not colour only); preview is a labelled region with text.                                                                                                         |
| VIII. Simplicity, deps    | ✅     | One dev dependency (PGlite): solves "does the Postgres script run" (SC-001); no platform or existing package runs Postgres SQL; test-only, 0 bytes in the app bundle; founder approved 2026-10-04 (spec Clarifications). ADR 0031 records the export design. No runtime dependency (DB6 parser not needed to write). |

**Post-design re-check (after Phase 1)**: still ✅. The design adds one app folder
(`apps/app/src/db/export/`) and extends the 012 dialog; no new package, no schema change.

## Project Structure

### Documentation (this feature)

```text
specs/045-db-export/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R18
├── data-model.md        # Phase 1: schema slice, notes, options, type map, dialog state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── schema-writers.md    # writer API and per-format output rules
│   └── export-dialog-ui.md  # dialog behaviour (Schema section, scope, dialect, notes, banner)
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/app/src/db/
├── fixtures/
│   ├── shop.ts                  # "Shop" schema deck (11 tables, enums, n–n, composite, self-ref) — also used by 044 / 049 later
│   └── export-edge-cases.ts     # stale ids, cycles, reserved names, schemas, empty type, length mismatch, …
└── export/
    ├── schema-slice.ts          # deck + scope → SchemaSlice (+ notes); FK placement; junction tables
    ├── scope.ts                 # Selection / database card / deck → table ids; scope availability
    ├── identifiers.ts           # quoting per dialect, reserved words, safe names for Mermaid
    ├── reserved-words.ts        # data: reserved words (Postgres ∪ MySQL ∪ SQLite core)
    ├── common-types.ts          # data: Generic common type list, aliases, per-dialect equivalents
    ├── sql-writer.ts            # SQL for postgres | mysql | sqlite (+ per-dialect helpers inside)
    ├── dbml-writer.ts
    ├── mermaid-writer.ts
    ├── dictionary-writer.ts
    ├── notes.ts                 # ExportNote kinds and texts
    ├── schema-export.ts         # one entry: (deck, request) → { text, notes, fileName }
    ├── *.test.ts                # unit + golden tests next to each file
    ├── sql-writer.engine.test.ts    # PGlite + node:sqlite execution (node environment)
    ├── schema-export.perf.test.ts
    └── __golden__/              # expected outputs per fixture × format × dialect

apps/app/src/editor/export/
├── types.ts                     # ExportFormat + 'sql' | 'dbml' | 'mermaid-er' | 'dictionary'; SchemaScope
├── formats.ts                   # FORMATS split into SCHEMA_FORMATS and IMAGE_AND_DATA_FORMATS
├── export-dialog-state.ts       # + schemaScope, sqlDialect (Generic pick), options.sql, scope availability
├── use-export-result.ts         # + schema branch calling schema-export; result carries notes
├── export-file-name.ts          # + scope slug and .sql / .dbml / .mmd / .md
├── export-dialog.tsx            # Schema section, scope control for schema formats, dialect chip / picker, SQL options, notes strip, problems banner, line-numbered text preview
├── schema-export-panel.tsx      # (new) the schema-format part of the right column, keeps export-dialog.tsx readable
└── schema-problems.ts           # (new) DeckProblems → db problems for tables in scope

docs/decisions/0031-schema-export.md   # ADR
apps/app/CLAUDE.md                     # db/export boundary note
```

**Structure Decision**: writers live in `apps/app/src/db/export/` (a new `db/` area that 044's
import and fixtures will share, as the backlog names `apps/app/src/db/fixtures`), not in
`@sododeck/model`: they are export logic over the plain JSON snapshot, like 012's JSON / SVG
export, and the model package stays the Yjs ↔ JSON layer. 046 (DBML code panel) and 049 (Export
SQL from a database card) import `schemaExport` from the app, which is where they live too.

## Complexity Tracking

No violations. One dev dependency justified in the Constitution Check (VIII).
