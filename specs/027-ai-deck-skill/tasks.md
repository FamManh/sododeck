---
description: 'Task list for 027 AI deck skill'
---

# Tasks: AI deck skill

**Input**: `specs/027-ai-deck-skill/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: required by the constitution (VI): every pure function and the CLI get Vitest tests; no new e2e.

**Organization**: by user story (spec priorities). Phase 3 of the backlog (render self-check, US6) is planned here and deferred (research R12).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create package `packages/skill` (`@sododeck/skill`, private, ESM): `package.json` (scripts `build`, `lint`, `typecheck`, `test`; deps `@sododeck/model`, `@sododeck/schema`; devDeps `@sododeck/config`, `@types/node`, `esbuild`, `eslint`, `tsx`, `typescript`, `vitest`), `tsconfig.json`, `eslint.config.js` (copy model's), `.gitignore`-covered `dist/`
- [x] T002 [P] Write `packages/skill/CLAUDE.md` (responsibility, boundaries, build, generated facts)
- [x] T003 [P] Add `packages/skill/dist` to `.prettierignore` / eslint ignores; check turbo `build` output `dist/**` covers it

## Phase 2: Foundational

- [x] T004 Add catalogue family `authoring` with codes `id-style`, `positions-mixed`, `orphan-card`, `duplicate-title`, `label-too-long`, `level-over-budget`, `connector-without-source` (severity warning, fix hints) in `packages/model/src/problem-codes.ts`; heading "Authoring checks (AI deck skill)"
- [x] T005 Regenerate `docs/file-format/problem-codes.md` and update `packages/model/test/problem-codes.test.ts` expectations
- [x] T006 [P] Plain-text renderer for problem entries/reports in `packages/skill/src/text.ts` (+ `test/text.test.ts`)
- [x] T007 Version stamp: schema fingerprint (sha-256, 12 hex) and skill version in `packages/skill/src/version.ts` (+ test)

## Phase 3: User Story 1 + 2 — Generate a deck, fix it from machine-readable errors (P1) 🎯 MVP

**Goal**: an agent writes a deck from a description, loops on validate/lint, delivers atomically; the app imports it laid out.

**Independent test**: quickstart §2, §3, §5.

- [x] T008 [P] [US2] Authoring checks (pure) in `packages/skill/src/authoring.ts` per research R5 (+ `test/authoring.test.ts`, one case per code and per mode/detail option)
- [x] T009 [US2] `validateText` / `lintText` building 062 reports over `inspectDeckText`, `checkDeck`, `problemEntries`, `sortEntries`, `problemReport` in `packages/skill/src/lint.ts` (+ `test/lint.test.ts`: clean deck, refused file, dangling step entry has code/path/subject/evidence/fix, codes equal app's)
- [x] T010 [US2] CLI in `packages/skill/src/cli/main.ts`: commands validate, lint, summary, diff, deliver; options `--format`, `--detail`, `--mode`, `--help`; exit codes 0/1/2; `deliver` writes temp file in target folder then renames (+ `test/cli.test.ts` with a temp dir)
- [x] T011 [P] [US1] Example decks `packages/skill/examples/checkout.sododeck`, `refund-policy.sododeck`, `platform.sododeck` (no positions; checkout flow; rule on a step; groups + two levels)
- [x] T012 [P] [US1] `test/examples.test.ts`: each example passes validate + lint with zero entries and every flow analyses without broken steps (FR-025)
- [x] T013 [US1] Skill content: `packages/skill/content/SKILL.md` (frontmatter + router, contract skill-package.md) and references `modeling.md`, `flows.md`, `rules.md`, `database.md`, `taste.md`, `scripts.md` in `packages/skill/content/references/`
- [x] T014 [US1] Placeholder filling in `packages/skill/src/generate.ts` (`{{cardTypes}}`, `{{deckCodes}}`, `{{authoringCodes}}`, `{{formatVersion}}`, `{{fingerprint}}`, `{{skillVersion}}`; unknown placeholder throws) (+ test)
- [x] T015 [US1] Build `packages/skill/scripts/build.ts`: fill content, copy schema and examples, write `VERSION.json`, bundle `src/cli/main.ts` with esbuild to `scripts/sododeck.mjs` (node20, esm, metafile), write entry files; deterministic zip via `packages/skill/scripts/zip.ts`
- [x] T016 [US1] Drift/build test `packages/skill/test/build.test.ts` (research R9): schema equal, fingerprint, codes tables match catalogue, no network modules or `fetch` in bundle, SKILL.md < 500 lines and named references exist, built `validate.mjs` runs on an example (exit 0) and on a broken deck (exit 1), zip byte-identical across two builds
- [x] T017 [P] [US1] App: move layout request to `apps/app/src/layout/place-unplaced.ts` (`hasUnplacedCards`, `placementRequest` with pins and card/group-only edges, `applyPlacement` keeping placed cards and frames) (+ `place-unplaced.test.ts`); Mermaid import uses it
- [x] T018 [US1] App: `ImportedDeck.unplaced` in `apps/app/src/storage/library-ops.ts`; `importDeckFile` places unplaced cards via the layout worker and re-imports, keeping the first open report, in `apps/app/src/library/library-actions.ts` (+ `library-actions.test.ts` with a fake layout: unplaced deck gets positions, placed deck unchanged, pinned cards keep positions)

**Checkpoint**: MVP — build the skill, run the scripts, import an example laid out.

## Phase 4: User Story 3 — Update an existing deck (P2)

- [x] T019 [US3] `diffDecks(old, new)` in `packages/skill/src/diff.ts` per data-model (+ `test/diff.test.ts`: additions only, rename = one changed field, removals, step changes, stable order, key order ignored)
- [x] T020 [US3] Text form of the diff in `packages/skill/src/text.ts`; wire `diff` command; update-mode section in `content/SKILL.md`

## Phase 5: User Story 4 — Read a deck quickly (P2)

- [x] T021 [US4] `summarizeDeck` + text outline in `packages/skill/src/summary.ts` (+ `test/summary.test.ts`), wire `summary` command (problem count line)

## Phase 6: User Story 5 — Codebase and text formats (P3, backlog phase 2)

- [x] T022 [P] [US5] References `from-codebase.md` (scan order, source links `file#Lstart-Lend` at a commit, only traced calls, fidelity report) and `from-text-formats.md` (Mermaid, C4 text, OpenAPI mapping, fidelity report) in `packages/skill/content/references/`
- [x] T023 [US5] `connector-without-source` in `--mode codebase` covered in `test/authoring.test.ts` (implemented in T008)

## Phase 7: User Story 6 — Render self-check (P4, backlog phase 3) — DEFERRED (not built in this pass; needs its ADR first)

- [ ] T024 [US6] ADR on packaging the app's layout + export as a headless render entry (FR-029)
- [ ] T025 [US6] `render` script with PNG + geometry report, "skipped" without a headless browser

## Phase 8: Polish & cross-cutting

- [x] T026 [P] Eval prompts `packages/skill/evals/evals.json` (checkout from description, add refund flow, fix broken deck) — not shipped
- [x] T027 [P] Site: `apps/site/scripts/copy-skill.mjs` copies the zip to `public/downloads/` before `astro build`; `@sododeck/skill` devDependency; docs page `apps/site/src/pages/docs/ai-skill.mdx` (install, prompts per mode, import, paste problems back); link from `docs/index.mdx`
- [x] T028 [P] ADR `docs/decisions/0040-ai-deck-skill-packaging.md`; update `apps/app/CLAUDE.md` (import placement), `packages/model/CLAUDE.md` (authoring family), `AGENTS.md` repo map (`packages/skill`)
- [x] T029 Agent acceptance run: one subagent with only the built skill and the checkout prompt; import result checked by validate/lint (SC-001 sample)
- [x] T030 Full gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`

## Dependencies

- Setup → Foundational → US1/US2 (MVP). T008 → T009 → T010; T013–T014 → T015 → T016; T017 → T018.
- US3 (T019–T020) and US4 (T021) need T010 only. US5 needs T008, T013. US6 deferred.
- Polish after the stories it documents.

## Parallel examples

- T006, T007, T008, T011 in parallel after T004.
- T017 (app) in parallel with all skill-package work.
- T022, T026, T027, T028 in parallel at the end.

## Implementation strategy

MVP = Phases 1–3 (generate + fix + deliver + import placement). Then US3 diff and US4 summary (small), US5 prose, polish. US6 stays parked until its ADR is agreed.
