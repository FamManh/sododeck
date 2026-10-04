# Implementation Plan: Schema Code Panel (DBML)

**Branch**: `046-db-code-panel` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/046-db-code-panel/spec.md`

## Summary

The code overlay gets **JSON | DBML | SQL** tabs. JSON is unchanged (read-only). DBML is an
editable Monaco model: 500 ms after typing stops, the text is read in the existing import worker
(`@dbml/parse`, ADR 0033), validated and matched to the deck by a new pure planner
(`db/sync/`), and applied through `DeckEditor` ops so matched tables, columns, enums and
relationships keep their ids. Consecutive applies merge into one undo step through a new merge
key on `editor.batch` (the only model change). Errors become Monaco markers and the canvas keeps
the last valid schema. The panel text comes from 045's DBML writer and follows deck changes
made elsewhere without overwriting what the user is typing. SQL is a read-only preview from
045's SQL writer. Decisions in [research.md](research.md); new ADR 0034.

## Technical Context

**Language/Version**: TypeScript 5 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: existing only: Monaco (`@monaco-editor/react`, bundled), Yjs via
`@sododeck/model`, `@dbml/parse` 10.2.0 (044, worker, lazy), 045 writers, Zustand, `packages/ui`.
No new runtime dependency (SQL tokenizer is Monaco's bundled basic language; DBML tokenizer is
ours).

**Storage**: Yjs deck in IndexedDB (unchanged); UI prefs in localStorage.

**Testing**: Vitest (pure planner, model merge key, prefs), Testing Library (panel, tabs, states;
Monaco mocked as in `json-viewer.test.tsx`), perf test for 150 tables; existing Playwright smoke
suite only (no new e2e, constitution VI).

**Target Platform**: evergreen desktop browsers (Chromium, Firefox, Safari).

**Project Type**: web app in a pnpm monorepo (`apps/app`, `packages/model`).

**Performance Goals**: edit visible ≤ 1 s after the pause on 150 tables (SC-005); planner ≤ 30 ms
for 150 tables; typing latency < 50 ms (parsing in the worker); no extra bytes in the editor's
first load (SC-006).

**Constraints**: no network with content (constitution IV); writes only through `DeckEditor`;
one undo step per typing burst; DBML panel never writes invalid data.

**Scale/Scope**: up to 150 tables / 1,800 columns / 250 relationships in Whole schema.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Status | How                                                                                                                                                                               |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth         | ✅     | Text is a view of the Yjs deck; unapplied text lives only in the Monaco buffer and is discarded, never stored. Applies go through `DeckEditor`.                                   |
| II. Schema-owned format, lossless | ✅     | No format change. Model gains only a `batch` option (unit-tested). SC-004: writer → read → plan is empty for the corpus.                                                          |
| III. Stable identity              | ✅     | Matching keeps ids for tables, columns, indexes, checks, enums, values, relationships; ids never derived from names; memory restores reuse old ids. Rename tests per object kind. |
| IV. Local-first, private          | ✅     | Parser bundled, worker-local; no requests; smoke no-third-party check stays green.                                                                                                |
| V. Off the main thread            | ✅     | DBML read in the worker; planner pure and measured (≤ 30 ms / 150 tables); writer within ADR 0031 budget.                                                                         |
| VI. Strict types, tested          | ✅     | Unit + component tests listed in quickstart; no new e2e.                                                                                                                          |
| VII. Accessible                   | ✅     | Tabs as `tablist`; status icon + text + live region; markers reachable with F8; read-only message announced.                                                                      |
| VIII. Simplicity, justified deps  | ✅     | No new dependency; reuses 044 reader / worker and 045 writers; one small model option.                                                                                            |

Re-check after design: no violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/046-db-code-panel/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R15
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── schema-sync.md
│   └── code-panel-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
packages/model/
├── src/editor.ts                 # batch(fn, { merge }) + merge rule (R2)
├── src/ops/context.ts            # transact merge handling
└── test/batch-merge.test.ts

apps/app/src/
├── db/import/
│   ├── read-dbml.ts              # all diagnostics with ranges; lines of non-input blocks
│   ├── import.worker.ts          # + 'read-dbml' request
│   └── import-client.ts          # + readDbml(text) with latest-wins sequence
├── db/sync/                      # NEW, pure (no React/DOM/Yjs/editor imports)
│   ├── types.ts                  # TextProblem, SyncContext, SchemaPlan, SessionMemory
│   ├── normalise.ts              # shared with round-trip tests
│   ├── validate.ts               # FR-008 rules
│   ├── match.ts                  # R5
│   ├── plan-schema-sync.ts       # validate → match → plan
│   ├── place-new-tables.ts       # R12
│   ├── suggest-setting.ts        # edit-distance suggestions (R9)
│   ├── session-memory.ts         # R7
│   └── apply-schema-plan.ts      # DeckEditor ops in one merged batch
├── editor/code/                  # NEW
│   ├── code-format-tabs.tsx      # JSON | DBML | SQL
│   ├── dbml-tab.tsx              # editable editor + footer
│   ├── dbml-editor.tsx           # lazy Monaco wrapper (editable, markers)
│   ├── use-dbml-session.ts       # state machine R8, pause, burst, apply
│   ├── sql-tab.tsx               # read-only preview + dialect select + notes
│   ├── use-schema-text.ts        # throttled writer output for a scope
│   └── dbml-language.ts          # Monarch tokenizer
├── editor/json-panel.tsx         # hosts format tabs; JSON path unchanged
├── editor/json-panel-header.tsx  # format tabs + scope switch per format
├── editor/monaco-setup.ts        # DBML + SQL languages, model paths
├── editor/monaco-theme.ts        # token rules for DBML/SQL
└── state/json-panel-prefs.ts     # format, schemaScope, sqlPreviewDialect

docs/decisions/0034-editable-dbml-tab.md
```

**Structure Decision**: pure pipeline next to `db/import` and `db/export` (same boundary,
`apps/app/CLAUDE.md`); React and Monaco in a new `editor/code/` folder; the model only gains the
batch merge option (`packages/model/CLAUDE.md` "Added by 046"). Docs to update:
`apps/app/CLAUDE.md` (`db/sync`, `editor/code`), `packages/model/CLAUDE.md` (merge key),
`docs/backlog-database.md` (046 status).

## Phases (for /speckit.tasks)

1. **Foundation**: model merge key; prefs fields; `readDbml` diagnostics + worker request.
2. **US1 + US2 (P1)**: planner (validate, match, plan, placement, normalise), apply, DBML tab
   with pause, markers, status, burst undo, removal toast, memory restore, confirm-all.
3. **US3 (P2)**: Selection scope (baseline, removals bounded, new tables join selection, hint).
4. **US4 (P2)**: text follows the deck (state machine, blur rewrite, remote updates, stale-plan
   re-read).
5. **US5 (P3)**: SQL tab.
6. **Polish**: languages + theme, perf test, ADR 0034, docs, quickstart results, bundle size.

## Risks

- **Normalisation gaps** make the writer's own text produce a non-empty plan (spurious writes).
  Mitigation: SC-004 corpus test from day one; the planner drops no-op patches.
- **Rename guesses**: kept one-to-one and conservative; warning + Undo when unclear.
- **Merge key and Yjs `UndoManager` internals**: merging past `captureTimeout` relies on
  adjusting it per transaction; covered by model tests (merge, split on other write, redo).
- **Monaco bundle**: SQL basic language + editable editor features may add bytes to the lazy
  Monaco chunk; measured and reported.

## Complexity Tracking

None.
