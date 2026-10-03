# Tasks: Scale Bench

**Input**: `specs/037-scale-bench/` (plan.md, spec.md, research.md R1–R11, data-model.md, contracts/, quickstart.md)

**Tests**: Vitest for every pure helper (AGENTS.md: every pure function is tested). The Playwright bench files are the measurement itself, committed in `apps/app/bench/` so the founder can run them by hand. No new e2e tests.

**Organization**: by user story. Paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from `spec.md`

---

## Phase 1: Setup

- [ ] T001 Add script `"bench:scale": "BENCH_SCALE=1 playwright test -c playwright.bench.config.ts scale.bench.ts"` to `apps/app/package.json`, and a root passthrough only if `pnpm bench` already has one (contracts/bench-cli.md); keep `pnpm bench` unchanged.
- [ ] T002 [P] Create folder `apps/app/bench/lib/` and make `apps/app/vitest.config.ts` pick up `bench/lib/*.test.ts` (check the current `include`; tests sit next to the code).

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: the shared row / report shape and the size ladder.

- [ ] T003 [P] `apps/app/bench/lib/stats.ts` + `stats.test.ts`: `median`, `summarize(values) → { median, min, max }`, spread helper `withinPct(values, pct)`. Empty input and NaN handling tested.
- [ ] T004 [P] `apps/app/bench/lib/rows.ts` + `rows.test.ts`: `MeasurementRow` type (data-model.md), `makeRow(...)` applying the status rules (`report-only` when no target; `did-not-finish` ⇒ `value: null` + `reason`; `met` / `missed` by `direction`), `didNotFinish(area, metric, size, culling, reason)`.
- [ ] T005 [P] `apps/app/bench/lib/targets.ts` + `targets.test.ts`: the proposed targets table of research R9 as data keyed by `(area, metric, size)`; a lookup that returns `null` (report-only) for unlisted cells.
- [ ] T006 `apps/app/bench/lib/report.ts` + `report.test.ts`: `BenchReport` type, `renderMarkdown(report)` (one table per area, rows = metric, columns = sizes, culling sub-columns, `value (min–max)` + ✓ / ✗ / `DNF: reason`, target column), `writeReport(dir, report)` writing `report-<stamp>.{json,md}` (contracts/report-format.md). Depends on T003–T005.
- [ ] T007 [P] `apps/app/bench/lib/meta.ts`: `collectMeta()` (date, git commit, CPU model / cores / RAM via `node:os`, Chromium version, throttle, sizes, run counts, seed, `fast`). Small test for the pure parts (size list parsing from `BENCH_SIZES`, defaults).
- [ ] T008 [P] Extend `apps/app/src/bench/generate-deck.test.ts`: for 500 / 2,000 / 5,000 / 10,000 the deck has exactly `n` components and `2n` connections, no self-loops or duplicate edges, `checkIntegrity` reports no problems, and two calls with the same seed are deep-equal (FR-003). Fix the generator only if a size fails.
- [ ] T009 Per-cell runner `apps/app/bench/lib/cell.ts` + `cell.test.ts`: `runCell(fn, { timeoutMs, onFail }) → value | DidNotFinish`, with `BENCH_CELL_TIMEOUT_MS` (default 120000); a timeout or thrown error becomes a `did-not-finish` row with the reason (FR-006, R11).

**Checkpoint**: `pnpm --filter @sododeck/app test bench` green; rows and reports can be built and rendered without a browser.

---

## Phase 3: User Story 1 — a flow-highlight number you can trust (P1) 🎯 MVP

**Goal**: stable flow-highlight median and an FPS table that is never empty.
**Independent test**: run `pnpm bench` five times; flow-highlight medians within 25 %; FPS table has a row per scenario that ran.

- [ ] T010 [US1] In `apps/app/bench/perf.bench.ts`, change the flow scenarios (the `for` loop around "record click → badge" and its siblings, plus `inspector title edit`, `collapse-toggle` / `focus`) to: 3 discarded warm-up runs, 11 measured runs, an idle frame (`requestAnimationFrame` ×2) between runs, report median with min / max (R3). Use `summarize` from `bench/lib/stats.ts`.
- [ ] T011 [US1] Extend `ActionResult` in `apps/app/bench/perf.bench.ts` with `runs`, `min`, `max` and print them in the action-scenarios table (`| Scenario | Nodes / edges | Median (ms) | Min–max | Runs | Target | Meets |`).
- [ ] T012 [US1] Fix the empty FPS table: in `perf.bench.ts`, when the run ends with action results but no canvas result, run one `default` canvas scenario so `results` always has a row (R3). Add a note under the table saying which scenarios ran.
- [ ] T013 [US1] Manual check (record in `quickstart-results.md` in this folder): five consecutive `pnpm bench` runs; paste the five flow-highlight medians and the spread; confirm ≤ 25 % (SC-001). If still unstable, note the cause and open a backlog item instead of fixing the cost (out of scope).

**Checkpoint**: US1 delivers value alone: a trustworthy baseline for 029.

---

## Phase 4: User Story 2 — numbers at four deck sizes (P2)

**Goal**: all ten areas at 500 / 2,000 / 5,000 / 10,000, culling on and off where it applies.
**Independent test**: `BENCH_SCALE=1 BENCH_SIZES=500 BENCH_FAST=1 pnpm --filter @sododeck/app bench:scale` produces a report with no empty cell for 500; then the full ladder.

- [ ] T014 [US2] `apps/app/src/bench/scale-hooks.ts`: typed `window.__sododeckScaleBench` (`declare global`, like the other hooks) with the in-page measurements. Pure timing helpers (`timeSync`, `timeAfterPaint`) in the same file; no `any`, no `!`.
- [ ] T015 [US2] Wire `&scale=1` in `apps/app/src/routes/bench-page.tsx` to mount the hooks (unlinked route only; nothing changes in the shipped editor). Also pass through `visibleOnly` for the culling switch (already exists).
- [ ] T016 [P] [US2] Snapshot + derivation hooks in `scale-hooks.ts`: `snapshotUpdate(kind: 'drag-frame' | 'paste-200')` calling the real model snapshot path, and `derive()` calling `visibleGraph` + `toFlowNodes` / `toFlowEdges` (R2). Medians over 11 runs after 3 warm-ups.
- [ ] T017 [P] [US2] Storage hooks in `scale-hooks.ts`: `seedStoredDeck(size)` (real `LibraryDb` with a throwaway name via `insertDeck`), `autosaveFlush(kind)`, `compactOnOpen()`, `compactAtLimit()` (force rows past `compactAbove` = 200), `logBytes()` before / after compaction after a scripted 1,000-edit session (R7). Uses `attachDeckPersistence`.
- [ ] T018 [US2] `&stored=<id>` mode in `bench-page.tsx`: load the deck through `attachDeckPersistence` and expose marks (log read, Yjs applied, first paint) for the load row, plus `attachDeckChannel` so a second tab converges (R6). Depends on T017.
- [ ] T019 [P] [US2] JSON panel and export hooks: `jsonPanelOpen()` (open the Deck tab, resolve when Monaco shows the last line) and `serializeDeckMs()`; export reuses `&export=1`, add a heap sample during the PNG step via `performance.memory` (R8).
- [ ] T020 [P] [US2] Layout + memory hooks: wrap the existing tidy hooks (`startTidy`, `layoutRunning`, `layoutFrames`) as `layoutRun()` returning worker time and longest frame; `heapMb()` after load, and `editLoop(durationMs)` for the memory-after-editing row (`BENCH_FAST` = 30 s, else 5 min).
- [ ] T021 [US2] `apps/app/bench/scale.bench.ts`: registers tests only when `BENCH_SCALE=1`; for each size in `BENCH_SIZES` and each culling mode in `BENCH_CULLING` open `/bench?...&scale=1`, call the hooks, and push `MeasurementRow`s built with `makeRow` / `runCell`. Areas: `canvas-fps` (reuse `startRecording` / `panAndZoom` / `summarize` by moving them into `bench/lib/` or importing them), `load`, `snapshot`, `derivation`, `autosave`, `compaction`, `update-log`, `json-panel`, `export`, `layout`, `memory`. Renderer-independent rows get `culling: 'n/a'` once per size.
- [ ] T022 [US2] Multi-tab row in `scale.bench.ts`: seed a stored deck, open it in two pages of one browser context, paste N components in tab A through the editor hook, time until tab B's snapshot has them (poll in-page, no fixed sleep) (R6).
- [ ] T023 [US2] Report in `scale.bench.ts` `test.afterAll`: `collectMeta()` + all rows → `writeReport` to `apps/app/bench/results/`; print the markdown to the console. Rows for a crashed page or timeout are `did-not-finish` and the next size still runs (recreate the page) (R11).
- [ ] T024 [US2] Playwright config `apps/app/playwright.bench.config.ts`: keep one project; when `BENCH_SCALE=1` raise the per-test timeout (e.g. 10 min) and pass `--enable-precise-memory-info` to Chromium for heap numbers; default values unchanged.
- [ ] T025 [US2] Manual check: run size 500 with `BENCH_FAST=1`, open the report, confirm every area has a value or a reason; then run the full ladder and record the machine, commit and wall time in `quickstart-results.md` (SC-002).

**Checkpoint**: a full report exists. US2 is the main deliverable.

---

## Phase 5: User Story 3 — a target per row and a clear verdict (P3)

**Goal**: baseline, targets and met / missed marks in `docs/performance.md`, one backlog item per miss.

- [ ] T026 [US3] Run the full ladder once on the founder's machine (or reuse T025) and copy the baseline into `docs/performance.md` §2: one table per area, rows = metric, columns = sizes (culling on / off), each cell the median, and the report file name + commit + machine line above the tables.
- [ ] T027 [US3] Add the target column and ✓ / ✗ / `DNF` marks from `targets.ts`; mark the targets "proposed" until the founder confirms (spec Assumptions). Update §1 (known misses) with the new stable flow-highlight number from US1.
- [ ] T028 [US3] For each missed row add one entry to `docs/backlog.md` (title, size where it breaks, measured vs target, link to the row; no fix). Add a short "Verdict for 023" paragraph in `docs/performance.md`: per area, does the current renderer with culling meet the targets at up to 2,000 components (SC-005).
- [ ] T029 [US3] Ask the founder to confirm or edit the targets; apply the edits to `targets.ts` and the doc, re-render the marks.

---

## Phase 6: User Story 4 — anyone can repeat it (P4)

- [ ] T030 [P] [US4] Document the commands and env vars from `contracts/bench-cli.md` in `apps/app/CLAUDE.md` (the `src/bench/`, `bench/` row and the commands line) and add a "How to run" box at the top of `docs/performance.md`.
- [ ] T031 [P] [US4] Check the report header lists machine, Chromium, throttle, sizes, run counts, seed and date (`meta.ts`), and that decks come from the fixed seed with no user content (T008 covers the generator).
- [ ] T032 [US4] Verify SC-004: time `pnpm bench` on `main` and on the branch, record both in `quickstart-results.md`; the difference is ≤ 20 %. Re-run size 500 from a clean `git clone` or worktree and confirm the report has the same shape.

---

## Phase 7: Polish

- [ ] T033 Update `docs/backlog.md` §037 (status, link to spec / plan / tasks / quickstart-results) and `docs/performance.md` header status ("plan, not scheduled" → baseline recorded). If a decision about the `/bench` hooks or the report contract is worth keeping, add a short ADR in `docs/decisions/`.
- [ ] T034 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass; no skipped or `.only` tests; smoke suite still under 30 s and no third-party requests (SC-006).
- [ ] T035 Final report: what changed, what was skipped (fixes, CI budget, the 023 decision), what is uncertain (targets, headless noise, `did-not-finish` cells). Small Conventional Commits, no AI attribution lines.

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. T003–T005, T007, T008 run in parallel; T006 needs T003–T005; T009 needs T004.
- **US1 (T010–T013)** needs only T003; it can ship alone as the MVP.
- **US2** needs Phase 2. Inside it: T014 → T015 → {T016, T017, T019, T020} in parallel → T018 (needs T017) → T021 → {T022, T023, T024} → T025.
- **US3** needs a full report (T025). **US4** can start after T023.
- Polish last.

## Parallel example (US2 hooks)

```text
T016 snapshot + derivation hooks   ┐
T017 storage hooks                 │ different sections of scale-hooks.ts, merge by section
T019 JSON panel + export hooks     │
T020 layout + memory hooks         ┘
```

## Implementation strategy

1. **MVP = US1**: stable flow-highlight and a never-empty FPS table (about half a day). Commit and use as the "before" for 029.
2. **Then US2** in this order: generator test (T008), rows / report helpers, hooks for 500 only, the first report, then 2,000 / 5,000 / 10,000.
3. **US3 / US4** are mostly documentation once a full report exists.
4. Each phase ends with a small commit (`feat(app): …`, `docs: …`); the bench files are committed so they can be run by hand with the commands in `quickstart.md`.

## Manual check commands (for the founder)

```bash
pnpm bench                                                                   # US1: stable flow highlight, quick canvas bench
BENCH_SCALE=1 BENCH_SIZES=500 BENCH_FAST=1 pnpm --filter @sododeck/app bench:scale   # one size, quick
pnpm --filter @sododeck/app bench:scale                                      # full ladder
pnpm --filter @sododeck/app test bench                                       # helper unit tests
```
