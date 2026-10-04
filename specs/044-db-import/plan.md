# Implementation Plan: Schema Import

**Branch**: `044-db-import` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/044-db-import/spec.md`

## Summary

Add an **Import SQL or DBML** dialog (frame 138) that turns pasted text or a `.sql` / `.dbml`
file into tables, relationships, enums, groups and stickies in the current deck, a database card
or a new deck, followed by an **Import report** flyout (frame 139) and an Undo toast. Parsing
and mapping run in a lazy module worker: a statement splitter of our own (line numbers, skipped
statements, dialect detection) feeds **`node-sql-parser`** per dialect build for SQL and
**`@dbml/parse`** for DBML (founder decision 2026-10-04, revising DB6: the full `@dbml/core` is
2.7 MB gzip and cannot be precached). Both readers produce one neutral `RawSchema`; a pure
`buildPlan` maps it to a model `Fragment`, which the main thread lays out with the existing ELK
client and applies through `pasteFragment` in one batch (one undo step). Foreign keys by name are
offered as report suggestions highlighted on hover. Decisions: [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 6 strict, React 19, Node ≥ 24

**Primary Dependencies**: **new runtime** (lazy, worker-only): `@dbml/parse` 10.2.0 (Apache-2.0,
108 KB gzip) and `node-sql-parser` 5.4.0 (Apache-2.0; per-dialect builds 54–72 KB gzip), approved
by the founder 2026-10-04 (ADR 0032). Existing: `@sododeck/model` (`pasteFragment`, `addEnum`,
`setDialect`, `batch`), layout client (elkjs), `packages/ui` (Dialog, SegmentedControl, Select,
RadioGroup, Checkbox, Button, toast), lucide-react, Zustand UI store, 045's `common-types.ts`
and `schemaExport` (round-trip tests).

**Storage**: no schema change; writes 040 objects through the model. Report and suggestions are
UI-store state per deck (not persisted). New deck via the library's `addDeck`.

**Testing**: Vitest — splitter, detector, R3 rewrites, readers per dialect, `buildPlan` against
expected JSON for the fixture corpus, suggestions, type conversion, "no silent drop" over the
corpus, DBML round-trip with 045's writer, perf (300 tables), `applyImport` undo; component tests
for dialog and report by role / label. Existing e2e smoke unchanged (no new e2e).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari; module workers (inline
fallback via `features.ts`)

**Project Type**: web SPA (`apps/app`) in the pnpm monorepo

**Performance Goals**: preview ≤ 3 s, import + layout ≤ 10 s for 300 tables / 3,600 columns
(SC-006); measured parse 213 ms (SQL, per statement) / ~150 ms (DBML) for 300 tables in Node;
editor entry chunk +≤ 5 KB (SC-007)

**Constraints**: no network with content (IV); parsers bundled, same-origin, precachable (each
chunk < 5 MB); main thread only applies; deterministic plan; English UI; tokens only; no other
tool named in code or copy (DB5)

**Scale/Scope**: inputs ≤ 5 MB; tested up to 300 tables, 3,600 columns, 400 relationships

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Status | Notes                                                                                                                                                                                                                                                                     |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth | ✅     | Imported objects go only into Yjs through `DeckEditor`; the plan is a transient message; report and suggestions are UI-only state (not document data), and suggested links are never drawn from a second store (highlight via existing `hoverFocus`).                     |
| II. Schema-owned format   | ✅     | No schema change; the plan is a model `Fragment` (`@sododeck/model` type) applied by `pasteFragment`; the model stays the only Yjs ↔ JSON path. Load checks run on apply (FR-028).                                                                                        |
| III. Stable identity      | ✅     | Plan ids are opaque and local; paste allocates the real ids; names never become ids; suggestions are remapped through the paste id map.                                                                                                                                   |
| IV. Local-first, private  | ✅     | Text read with `File.text()`; parsers are bundled chunks served from the app origin and precached; no request carries content; smoke e2e no-third-party check stays green.                                                                                                |
| V. Off the main thread    | ✅     | Split, detect, parse, map and suggest in the import worker; layout in the ELK worker; the main thread applies one batch. Inline fallback only without worker support.                                                                                                     |
| VI. Strict types, tested  | ✅     | Pure stages with corpus tests and expected JSON; round-trip; perf; undo; component tests. Bug fix R13 starts with failing tests. No new e2e (TODO(e2e)).                                                                                                                  |
| VII. Accessible           | ✅     | Dialog controls labelled and in Tab order, live region for preview and errors, report as headed lists, Accept / Dismiss named; hover highlight also on keyboard focus.                                                                                                    |
| VIII. Simplicity, deps    | ✅     | Two runtime deps, each solving one format no platform API parses; chosen over a 2.7 MB alternative and over writing our own grammar; lazy, worker-only; founder-approved 2026-10-04; ADR 0032. Reuses paste, layout client, toast, flyout, 045 type data; no new package. |

**Post-design re-check (after Phase 1)**: still ✅. New app folders `apps/app/src/db/import/` and
`apps/app/src/editor/import/`; one new flyout id; no model or schema change.

## Project Structure

### Documentation (this feature)

```text
specs/044-db-import/
├── plan.md              # This file
├── research.md          # Phase 0: decisions R1–R16
├── data-model.md        # Phase 1: source, target, preview, plan, report, suggestions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── import-pipeline.md   # worker client, pure stages, apply
│   └── import-dialog-ui.md  # entry points, dialog, report flyout
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/app/src/db/
├── fixtures/import/                 # corpus (R12) + __expected__/*.json
├── export/
│   ├── dbml-writer.ts               # R13: empty enum, same-column n–n
│   └── common-types.ts              # read by import's convert-types (unchanged API)
└── import/
    ├── types.ts                     # ImportSource, ImportTarget, ImportPreview, ImportPlan, RawSchema, report types
    ├── split-sql.ts                 # R2 statement splitter + kinds
    ├── detect.ts                    # R4 format and dialect detection
    ├── prepare-statement.ts         # R3 rewrites + restore map
    ├── read-sql.ts                  # node-sql-parser AST → RawSchema (per dialect helpers inside)
    ├── read-dbml.ts                 # @dbml/parse rawDb → RawSchema
    ├── build-plan.ts                # RawSchema → ImportPlan (FR-010…016, R8–R10)
    ├── convert-types.ts             # R10 dialect → dialect via COMMON_TYPES
    ├── suggest-fks.ts               # R11
    ├── report-text.ts               # reason / change texts
    ├── import.worker.ts             # lazy parser loading, preview / plan
    ├── import-client.ts             # worker + inline clients (layout-client pattern)
    ├── place-import.ts              # R7 layout request + offset beside existing content
    ├── apply-import.ts              # R6 one batch; new-deck path
    ├── *.test.ts                    # next to each file
    ├── import.corpus.test.ts        # expected JSON + no-silent-drop
    ├── dbml-round-trip.test.ts      # shopDeck → schemaExport DBML → import → compare → export
    └── import.perf.test.ts

apps/app/src/editor/import/
├── import-dialog.tsx               # frame 138
├── import-dialog-loader.ts         # lazy chunk, like export-dialog-loader
├── import-dialog-mount.tsx
├── use-import-preview.ts           # debounced preview via the client
├── import-report-panel.tsx         # frame 139 report flyout
└── *.test.tsx

apps/app/src/state/ui-store.ts            # importDialog, importReports[deckId], open/close actions
apps/app/src/editor/shell/{deck-menu,flyouts,shell-prefs,shell-chrome}.tsx/ts   # entries + flyout
apps/app/src/editor/{empty-canvas-card,palette}.tsx                            # entries
apps/app/package.json                     # @dbml/parse, node-sql-parser (exact versions)
docs/decisions/0032-schema-import-parsers.md
docs/backlog-database.md                  # DB6 → see ADR 0032
apps/app/CLAUDE.md                        # db/import boundary note
```

**Structure Decision**: import logic lives in `apps/app/src/db/import/`, next to 045's
`db/export/` and the shared fixtures, not in `@sododeck/model`: it converts external text into a
model `Fragment` and applies it through the model's public ops, so the model package stays the
only Yjs ↔ JSON layer. 046 (DBML code panel) reuses `readDbml` / `buildPlan` from here.

## Complexity Tracking

No violations. Two runtime dependencies justified in the Constitution Check (VIII) and ADR 0032.
