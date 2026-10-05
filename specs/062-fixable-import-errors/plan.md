# Implementation Plan: Fixable import errors

**Branch**: `062-fixable-import-errors` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/062-fixable-import-errors/spec.md`

## Summary

Make every problem the app finds when importing, or on an open deck, fixable by the user's AI.
The file checks that already exist (Zod structure, format rules S1–S15 / I1–I6, duplicate and
ambiguous ids, picture repair) and the problems list (ADR 0013) all produce one public **problem
entry**: `code`, `severity`, JSON Pointer `path`, `subject` id, `message`, `evidence`, `fix`.
A new pure `inspectDeckText()` in `@sododeck/model` replaces the scattered parsing in the library
worker and returns either the sorted refusal entries or the loaded deck plus open-time entries
(damaged pictures, problems of severity error/warning). The library shows a dialog for refused
files and a toast + dialog for decks that opened with problems; the problems panel, both dialogs
and the Mermaid / SQL / DBML import reports gain **Copy** (plain JSON, clarification Q4). Import
reports from other formats are regrouped into **merged / collapsed / left out / not supported**.
One code catalogue in `@sododeck/model` (with fix hints) generates
`docs/file-format/problem-codes.md`, the contract the AI deck skill (027) will reuse.

No file-format change: broken references still load unchanged (clarification Q1, revised).

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only (Zod 4 in `@sododeck/schema`, React 19, `@sododeck/ui`
Dialog/Button/toast, lucide-react). No new dependency.

**Storage**: none new. Problem entries and reports are derived, never stored (ADR 0013 holds).

**Testing**: Vitest (schema, model, app units), Testing Library (dialog, toast, panel, report
views), existing Playwright smoke suite unchanged (constitution VI, no new e2e).

**Target Platform**: evergreen browsers; clipboard via existing feature-detected `copyText`.

**Project Type**: web app (Vite SPA) + internal TS packages.

**Performance Goals**: dialog with 10,000 entries opens < 1 s (SC-004); `checkDeck` with paths
within +10 % of today on the 2,000-node bench deck (R8); import of a valid deck not measurably
slower (one extra `checkDeck` in the library worker, ~8 ms).

**Constraints**: no network with content (FR-020); deterministic output (SC-003); JSON-only copy
(FR-018); release-stable codes (FR-002).

**Scale/Scope**: ~45 file-check codes, 30 problems-list codes (+1 retired), ~35 fidelity codes;
3 packages touched (schema, model, app); 1 new dialog, 4 copy surfaces.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                    | Status | Notes                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Nothing stored; entries derived from the file or the snapshot the problems worker already has. Dialog state is component state.                                                                                                                                  |
| II. Schema-owned format, lossless round-trip | ✅     | No schema change, no version bump. `Issue` shape grows (code, pointer path); round-trip untouched. Parity test unaffected (Ajv/Zod validity unchanged). Text → JSON parsing moves into `@sododeck/model` (`inspectDeckText`), which is where conversion belongs. |
| III. Stable identity                         | ✅     | `subject` is always an id, never a title.                                                                                                                                                                                                                        |
| IV. Local-first, private                     | ✅     | Copy goes to the clipboard on a user action only; nothing logged or sent. Clipboard is feature-detected (`features.ts` via `copyText`). Smoke no-third-party check stays.                                                                                        |
| V. Off the main thread                       | ✅     | Validation and `checkDeck` at import run in the library worker; panel problems already in the problems worker. Main thread only builds the JSON on copy.                                                                                                         |
| VI. Strict types, tested                     | ✅     | Codes are literal unions with `satisfies` catalogue; unit tests per mapping; component tests by role/label. No new e2e.                                                                                                                                          |
| VII. Accessible                              | ✅     | Severity by icon + text; dialog/list roles; copy announced; fallback text area focusable.                                                                                                                                                                        |
| VIII. Simplicity                             | ✅     | No dependency; catalogue doc via Vitest file snapshot, no new script. ADR for the public code contract (below).                                                                                                                                                  |

Post-design re-check (after Phase 1): unchanged, all ✅.

## Project Structure

### Documentation (this feature)

```text
specs/062-fixable-import-errors/
├── plan.md
├── research.md          # R1–R12
├── data-model.md        # Issue/Problem extensions, ProblemEntry, reports, catalogue, codes
├── quickstart.md
├── contracts/
│   ├── problem-report.md   # copied JSON (public, shared with 027)
│   ├── model-api.md        # package APIs
│   └── ui.md               # dialog, toast, panel, fidelity report UI
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── src/issue-codes.ts            # NEW: SchemaIssueCode, FormatRuleCode, load literals
├── src/pointer.ts                # NEW: toPointer / compare
├── src/zod-issues.ts             # NEW: Zod 4 issue → Issue (code, pointer, fix)
├── src/semantic-rules.ts         # each push gets its code; pointer paths
├── src/index.ts                  # Issue extended; parseSododeckFile uses zod-issues
└── test/                         # pointer + code assertions; path expectations updated

packages/model/
├── src/problem-codes.ts          # NEW: catalogue + renderCatalogueMarkdown
├── src/problem-entry.ts          # NEW: entries, sort, report, stringify
├── src/import-check.ts           # NEW: inspectDeckText (JSON, version, one pass, open entries)
├── src/load-checks.ts            # codes + pointers; run with semantic rules
├── src/problems.ts               # Problem.path / subject
├── src/errors.ts                 # message from pointer paths
├── test/problem-codes.test.ts    # every code catalogued, has fix; file snapshot of the doc
├── test/import-check.test.ts     # one test per broken fixture, ordering, determinism, 10k
└── test/fixtures/broken/*.sododeck

apps/app/src/
├── storage/library-ops.ts        # importFile → inspectDeckText; LibraryOpError.problems
├── storage/library-client*.ts    # carry problems across the worker boundary
├── library/import-problems-dialog.tsx (+ .test.tsx)   # NEW
├── library/use-import-files.ts   # dialog / toast wiring
├── library/library-actions.ts    # importedMessage with problem count
├── editor/shell/deck-menu.tsx    # same wiring for editor import
├── editor/problems/problems-panel.tsx (+ test)        # Copy problems
├── lib/copy-report.ts (+ test)   # NEW: copy with fallback state, used by all 4 surfaces
├── import-mermaid/fidelity.ts (+ test)                # NEW adapter; merged-declaration audit
├── library/import-report-view.tsx (+ test)            # groups + Copy report
├── db/import/fidelity.ts (+ test)                     # NEW adapter
└── editor/import/import-report-panel.tsx (+ test)     # groups + Copy report

docs/
├── file-format/problem-codes.md  # NEW, generated by the model snapshot test
└── decisions/0039-problem-codes.md  # NEW ADR: public problem codes and report shape
```

**Structure Decision**: existing monorepo layout; dependency direction `app → model → schema`
holds (the catalogue sits in model and re-exports schema's codes; fidelity codes are plain data
in the model catalogue, their adapters live in the app next to the importers).

## Phases (for /speckit-tasks)

1. **Foundation (schema):** pointer helper, issue codes, Zod mapping, S/I codes; update tests.
2. **Catalogue + entries (model):** catalogue, entry builders, sort, report, doc snapshot, ADR.
3. **Story 1:** `inspectDeckText`, worker wiring, refused dialog, copy helper, broken fixtures.
4. **Story 2:** open-time entries, toast + opened dialog, `Problem.path/subject`, panel copy,
   bench before/after.
5. **Story 3:** fidelity adapters, Mermaid merged-declaration audit, grouped report views, copy.
6. **Polish:** package `CLAUDE.md` updates (schema, model, app), backlog status, full DoD run,
   screenshots of the dialog (both modes), panel and grouped reports, light and dark.

## Risks

- **Path format change** touches many test expectations; mechanical, done in phase 1 in one
  commit.
- **Zod `invalid_union`** messages can be noisy for `anyOf` fields (`ColorRef`, `FieldValue`);
  R3 picks the closest branch; covered by fixtures for each union in the schema.
- **Mermaid audit** may find more silent folds than expected; each becomes an item, scope stays
  "report, don't change mapping".

## Complexity Tracking

No constitution violations; nothing to justify.
