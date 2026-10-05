# 062 Fixable import errors: implementation handoff

Everything needed to implement 062 without the planning conversation. Start here, then follow
`tasks.md` top to bottom.

## What we are building (one paragraph)

When a deck import fails or is partial, the user can copy the problems as JSON and paste them to
their own AI to fix the file (pairs with the AI deck skill, 027). Every problem gets a stable
`code`, a JSON Pointer `path`, the `subject` id, a `message`, `evidence` and a `fix` hint.
Three surfaces: (US1) a dialog for refused deck files, (US2) a toast + dialog for decks that open
with problems, plus **Copy problems** in the problems panel, (US3) Mermaid and SQL / DBML import
reports regrouped into merged / collapsed / left out / not supported, with **Copy report**.

## Read in this order

1. `spec.md`: scope, stories, FR-001…FR-020, **Clarifications** (4 founder decisions, below).
2. `research.md`: R1–R12, the technical decisions and why.
3. `data-model.md`: shapes (`Issue`, `Problem`, `ProblemEntry`, reports, catalogue) and the
   **initial code list**.
4. `contracts/problem-report.md`: the public JSON (exact keys and order). Shared with 027; treat it as
   frozen once released.
5. `contracts/model-api.md`: function signatures per package.
6. `contracts/ui.md`: dialog, toast, panel, report UI and English copy.
7. `tasks.md`: T001–T041, dependencies, parallel lanes.
8. `quickstart.md`: how to verify (automated + 12 manual steps).

## Founder decisions (2026-10-05), do not re-open

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Broken references still load unchanged** (the file format allows them since 002; see `packages/model/test/load.test.ts` "loads a file with dangling references"). They show up as problems-list entries behind the "Opened with N problems" notice. Only files that cannot load at all are refused: not JSON, newer version, schema violation, duplicate / ambiguous ids. _(The first answer was "refuse", then revised after reading the code.)_ |
| Q2  | The notice fires for damaged pictures and problems of severity `error` / `warning`; `info` never notifies (today no problems-list kind is `info`).                                                                                                                                                                                                                                                                                                  |
| Q3  | Schema violations use **generic codes per violation type** (`schema-required`, `schema-type`, `schema-enum`, …) plus an exact `path`; fix hints are composed from the Zod issue. Semantic problems keep one specific code each.                                                                                                                                                                                                                     |
| Q4  | Copy puts **plain, valid JSON only** on the clipboard. No instruction text.                                                                                                                                                                                                                                                                                                                                                                         |

## Where the code is today (verified 2026-10-05)

| Concern                    | Location                                                                                                                                          | Today                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Structural validation      | `packages/schema/src/index.ts` `parseSododeckFile`                                                                                                | Zod `safeParse` → `Issue { path: 'a.0.b', message }`, no code                                  |
| Format rules S1–S15, I1–I6 | `packages/schema/src/semantic-rules.ts`                                                                                                           | ~60 `issues.push`, dot paths; run only after Zod passes                                        |
| Duplicate / ambiguous ids  | `packages/model/src/load-checks.ts`                                                                                                               | `Issue[]`; run only after semantic rules pass                                                  |
| Refusal                    | `packages/model/src/deck.ts` `buildDoc`                                                                                                           | throws `DeckValidationError(issues)` (`errors.ts`)                                             |
| Damaged pictures           | `packages/model/src/assets.ts` `AssetProblem`                                                                                                     | file still loads; `loadDeck` returns `problems`                                                |
| Worker import              | `apps/app/src/storage/library-ops.ts` `importFile`                                                                                                | **throws the details away**: `LibraryOpError('invalid-deck', 'The file is not a valid deck.')` |
| Import toast               | `apps/app/src/library/use-import-files.ts` `importMessage`; `library-actions.ts` `importedMessage`                                                | one generic toast; pictures only as a count                                                    |
| Editor import              | `apps/app/src/editor/shell/deck-menu.tsx`                                                                                                         | same toast                                                                                     |
| Problems list              | `packages/model/src/problems.ts` `checkDeck`, `ProblemKind` (30 kinds), `SEVERITY`                                                                | stable kinds, no path; panel `apps/app/src/editor/problems/problems-panel.tsx`, no copy        |
| Mermaid report             | `apps/app/src/import-mermaid/import-report.ts`, view `apps/app/src/library/import-report-view.tsx`                                                | 6 skip reasons + notes; no copy                                                                |
| SQL / DBML report          | `apps/app/src/db/import/types.ts` (18 skip reasons, 7 change kinds), `report-text.ts`, panel `apps/app/src/editor/import/import-report-panel.tsx` | no copy, no groups                                                                             |
| Clipboard                  | `apps/app/src/lib/clipboard.ts` `copyText`, `couldNotCopyText`                                                                                    | feature-detected; reuse                                                                        |

## Things that will bite

- **Path format change** (dot → JSON Pointer) touches many test expectations in schema and model,
  plus `DeckEditError` message text. Do it in one mechanical commit in Phase 2 (T008, T009, T011).
- **One pass has a limit:** semantic rules and id checks need a structurally valid file, so a file
  with Zod errors reports only those. After a structurally valid parse, semantic and id checks run
  **together** (today id checks wait for semantic rules; T010 changes that).
- **Zod `invalid_union`** (`ColorRef`, `FieldValue`, `DbIndexPart`): pick the branch with the fewest
  issues for the hint; give each union a fixture.
- **Catalogue doc** `docs/file-format/problem-codes.md` is generated by a Vitest file snapshot; CI
  fails when it is stale. Regenerate with `pnpm --filter @sododeck/model test -u`.
- **Bench:** `checkDeck` gains index maps for `path`; measure before (T001) and after (T030),
  budget +10 % on the 2,000-node deck.
- **Mermaid audit (T032):** node declared twice is silently "first wins" today; report it as
  `merged`, do not change what is imported.
- **Spec Kit pointer:** `.specify/feature.json` may point at another feature (057 was active when
  this was written). Set it to `{"feature_directory": "specs/062-fixable-import-errors"}` before
  running `/speckit-implement`, and only if no other session is using it. Better: work in a
  separate git worktree.
- Do not name other diagram tools anywhere (AGENTS.md). No new runtime dependency is needed; ask
  before adding one.

## Out of scope (don't build)

- The AI deck skill and its scripts (027); the sododeck.com docs page for codes (027).
- Auto-fix of import errors in the app; editing from JSON (004).
- Invalid paste of a fragment (stays silent; 026).
- New lint rules.

## How to start

```sh
git worktree add ../sododeck-062 -b 062-fixable-import-errors main
cd ../sododeck-062 && pnpm install
# copy specs/062-fixable-import-errors/ into the worktree if it is not committed yet
pnpm bench   # T001 baseline → specs/062-fixable-import-errors/bench-before.md
```

Then T002 onward. MVP = Phases 1–3 (US1). US3 can run in a parallel lane after Phase 2 + T019.

## Definition of done

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; smoke
  no-third-party check passes; no new e2e tests; no `.skip` / `.only`.
- ADR `docs/decisions/0039-problem-codes.md` Accepted; `docs/backlog.md` 062 marked implemented;
  package `CLAUDE.md` files updated (schema, model, app).
- `quickstart-results.md`, screenshots (both dialog modes, panel copy, both grouped reports,
  light + dark), bench before/after in the report.
- Conventional commits, no AI attribution lines.

## Assumptions to confirm or change while implementing

- Limits: evidence 200 chars, 500 rows shown, 5,000 entries copied.
- Code names in `data-model.md` §Codes are proposals until the first release; then frozen.
- `app` in the report = `apps/app/package.json` version via a Vite `define` (`0.0.0` today).
- Damaged pictures are `warning`.
