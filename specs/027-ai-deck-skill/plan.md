# Implementation Plan: AI deck skill

**Branch**: `027-ai-deck-skill` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-ai-deck-skill/spec.md`

## Summary

Ship a skill (`sododeck-deck`) that the user's own AI agent reads to write or update a valid
`.sododeck` deck, with bundled offline scripts (`validate`, `lint`, `summary`, `diff`, `deliver`)
that print 062's fixable problem report. The skill is built from a new package `packages/skill`:
Markdown sources with generated facts (card types, problem codes, schema fingerprint), TypeScript
script sources bundled with esbuild into one self-contained module that runs the app's own load
and problem logic from `@sododeck/model`, three example decks, and a deterministic zip that the
marketing site offers for download next to a docs page. App side: importing a deck whose cards
have no positions places them with the existing layout worker (placed cards pinned). Phase 2
(codebase / text-format instructions, fidelity report, `connector-without-source`) is mostly prose
and ships with phase 1; phase 3 (render self-check) is planned and deferred (research R12).

## Technical Context

**Language/Version**: TypeScript 6 (strict), Node ≥ 24 in the repo; shipped scripts target Node ≥ 20.

**Primary Dependencies**: `@sododeck/model`, `@sododeck/schema` (bundled into the scripts); esbuild
(new devDependency of `@sododeck/skill` only, research R2); tsx (existing) for the build script.

**Storage**: none (files on the user's disk; the app's IndexedDB is untouched except FR-024).

**Testing**: Vitest in `packages/skill/test` (scripts in process, build/drift test, examples),
`packages/model/test` (authoring catalogue family, catalogue doc snapshot), app unit tests for
placement (`apps/app/src/layout/place-unplaced.test.ts`, `library-actions.test.ts`).

**Target Platform**: any agent environment with Node ≥ 20; the app in the latest two browsers.

**Project Type**: monorepo package (build tool + shipped skill) + small app change + site page.

**Performance Goals**: each script < 1 s on a 200-card deck; placement on import within the
existing auto-layout target (200 nodes < 2 s).

**Constraints**: offline, no network modules in the bundle; deterministic output (same input →
same bytes); `SKILL.md` < 500 lines.

**Scale/Scope**: 5 scripts, 8 references, 3 examples, 7 authoring codes, 1 docs page.

## Constitution Check

| Principle                      | Status                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth      | ✅ No editor state touched; import placement writes the file before it becomes a Yjs document.                                      |
| II. Schema-owned format        | ✅ No schema change; the skill bundles the schema byte-for-byte and loads decks only through `@sododeck/model` (`inspectDeckText`). |
| III. Stable identity           | ✅ Update mode keeps ids, `diff` matches by id only; `id-style` discourages title-shaped ids.                                       |
| IV. Local-first, private       | ✅ Scripts offline, bundle checked for network modules; the app sends nothing; the site download is a static file.                  |
| V. Off the main thread         | ✅ Placement uses the existing ELK worker; loading stays in the library worker.                                                     |
| VI. Strict types, tested       | ✅ Unit tests for every check, diff, summary, CLI, build drift; no new e2e.                                                         |
| VII. Accessible                | ✅ Only a docs page (semantic headings, links); no new app UI.                                                                      |
| VIII. Simplicity, dependencies | ✅ One devDependency (esbuild, already in the lockfile, R2); zip writer hand-rolled (R8). ADR 0040 records the packaging decision.  |

Re-check after design: unchanged, all pass. Dependency direction gains `skill → model → schema`
and a build-time artifact copy `site ← skill` (the site imports no skill code).

## Project Structure

### Documentation (this feature)

```text
specs/027-ai-deck-skill/
├── spec.md  plan.md  research.md  data-model.md  quickstart.md
├── contracts/ scripts-cli.md  skill-package.md  app-import-placement.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/skill/
├── CLAUDE.md  package.json  tsconfig.json  eslint.config.js
├── content/SKILL.md  content/references/*.md      Markdown with {{placeholders}}
├── examples/*.sododeck                              hand-written, tested
├── evals/evals.json                                 acceptance prompts (not shipped)
├── src/
│   ├── authoring.ts       authoring checks (pure)
│   ├── lint.ts            validate + lint reports (pure, over inspectDeckText / checkDeck)
│   ├── diff.ts  summary.ts  text.ts (plain-text renderers)
│   ├── cli/main.ts        argument parsing, exit codes, file IO, deliver
│   └── generate.ts        placeholder filling (card types, codes, version)
├── scripts/build.ts  scripts/zip.ts
└── test/*.test.ts

packages/model/src/problem-codes.ts   + 'authoring' family and 7 codes
docs/file-format/problem-codes.md     regenerated
apps/app/src/layout/place-unplaced.ts (+ test)   moved from import-mermaid/layout-input.ts
apps/app/src/storage/library-ops.ts   ImportedDeck.unplaced
apps/app/src/library/library-actions.ts  importDeckFile places unplaced cards
apps/site/src/pages/docs/ai-skill.mdx  apps/site/scripts/copy-skill.mjs
docs/decisions/0040-ai-deck-skill-packaging.md
```

**Structure Decision**: a new workspace package under `packages/` (picked up by
`pnpm-workspace.yaml`) with `build` producing `dist/` (turbo output), `test` running Vitest. The
site lists `@sododeck/skill` as a devDependency so turbo builds it first, then copies the zip.

## Complexity Tracking

| Violation                                                    | Why Needed                                        | Simpler Alternative Rejected Because                       |
| ------------------------------------------------------------ | ------------------------------------------------- | ---------------------------------------------------------- |
| Site depends on a package outside `ui` (build artifact only) | The download must be the exact build of the skill | Committing the zip to the site would drift from the schema |
