# Implementation Plan: Scale Bench

**Branch**: `037-scale-bench` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/037-scale-bench/spec.md`

## Summary

Extend the existing Playwright bench (`apps/app/bench/`) so it answers "where does Sododeck slow
down as decks grow" with numbers: (1) make the flow-highlight scenario stable and the FPS table
never empty; (2) add an opt-in **scale bench** that generates 500 / 2,000 / 5,000 / 10,000-component
decks (connections ×2, fixed seed) and measures the ten areas of `docs/performance.md` §2 with
culling on and off; (3) write the baseline, a target per row and a met / missed mark into
`docs/performance.md` §2. No product behaviour changes and no fixes: bench-only hooks live on the
unlinked `/bench` route, which already exists for this purpose.

Approach: measure the **real code paths** (model snapshot, `visibleGraph` + `toFlowNodes/Edges`,
`attachDeckPersistence`, `attachDeckChannel`, export scene / SVG / PNG, ELK worker, JSON panel) in
a real Chromium page, through small `window.__sododeck*Bench` hooks, the same way today's
scenarios work. Each area is one scenario file that returns rows of one shared shape; one reporter
merges them into `report-<stamp>.{json,md}`. Large sizes run only with `BENCH_SCALE=1`
(`pnpm bench:scale`), so the default `pnpm bench` stays as quick as today.

## Technical Context

**Language/Version**: TypeScript strict, Node ≥ 24, pnpm monorepo (turbo)

**Primary Dependencies**: existing only: Playwright (Chromium), Vite preview, React Flow, Yjs, Dexie, ELK worker. **No new runtime dependency.**

**Storage**: real IndexedDB in the bench browser (a throwaway database name per run); no files written except `apps/app/bench/results/` (gitignored) and `docs/performance.md`.

**Testing**: Vitest for pure helpers (deck generator at four sizes, median / spread, row and report formatting, target evaluation); Playwright bench is the measurement itself, not a gating test. Existing smoke e2e stays green; no new e2e tests (AGENTS.md).

**Target Platform**: headless Chromium on the founder's machine; numbers are indicative and compared on one machine only.

**Project Type**: web application monorepo (`apps/app` only is touched, plus docs).

**Performance Goals**: this feature _measures_; targets per row are proposed in `research.md` R9 and confirmed by the founder after the first run.

**Constraints**: default `pnpm bench` no more than 20 % slower than today (SC-004); a 10,000-component run may not finish on a small machine, so every cell can say "did not finish: reason" (FR-006); bench decks are generated, contain no user content, and no network call carries content (constitution IV).

**Scale/Scope**: 4 sizes × 10 areas × culling on/off ≈ 80 cells; ~1 new bench file, 1 shared helper module, hooks on `/bench`, 1 doc section.

## Constitution Check

_GATE: passes before research; re-checked after design._

- **I. Single source of truth**: bench hooks read the Yjs document and the real derivation code; no document state is copied into the app. ✅
- **II. Schema / round-trip**: no schema or model change. The generator only emits valid `SododeckFile`s (validated in a unit test at each size). ✅
- **III. Stable identity**: generated ids stay `n<i>` / `e<i>`, deterministic by seed. ✅
- **IV. Local-first / private**: no network, no content leaves the browser; the bench never touches a user's deck. ✅
- **V. Heavy work off main thread**: unchanged. The bench _observes_ it (long tasks, responsiveness during layout) and reports misses instead of fixing them. ✅
- **VI. Strict types, tested behaviour**: helpers are pure and unit-tested; hooks are typed (`declare global` like the existing ones); no `any`, no `!`. No new e2e tests. ✅
- **VII. Accessible**: no UI change. ✅ (n/a)
- **VIII. Simplicity / dependencies**: no new dependency; reuse `perf.bench.ts` conventions and `generateBenchDeck`. ✅

No violations; Complexity Tracking not needed. Re-check after Phase 1: still passing (hooks are test-only, the report contract is plain JSON).

## Project Structure

### Documentation (this feature)

```text
specs/037-scale-bench/
├── plan.md
├── research.md          # Phase 0: decisions R1–R10
├── data-model.md        # Phase 1: row / report / size-ladder shapes
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── bench-cli.md         # env options and commands
│   └── report-format.md     # report.json / report.md shape
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
apps/app/
├── bench/
│   ├── perf.bench.ts              # existing canvas bench: flow-highlight made stable (warm-up, more runs), FPS table never empty
│   ├── scale.bench.ts             # NEW: size ladder × areas, opt-in (BENCH_SCALE=1)
│   ├── lib/                       # NEW: pure helpers shared by both benches (unit-tested)
│   │   ├── stats.ts               #   median / min / max / spread
│   │   ├── rows.ts                #   MeasurementRow, targets, met / missed, "did not finish"
│   │   └── report.ts              #   merge rows → report.json + report.md
│   └── results/                   # gitignored output
├── playwright.bench.config.ts     # + project / grep split so scale runs only on request
├── package.json                   # + "bench:scale"
└── src/
    ├── bench/
    │   ├── generate-deck.ts       # sizes 500…10,000 stay valid and deterministic (test)
    │   └── scale-hooks.ts         # NEW: window.__sododeckScaleBench (typed); calls real code paths
    └── routes/bench-page.tsx      # mounts the scale hooks behind `&scale=1`; `&stored=<id>` mode for load / multi-tab

docs/performance.md                # §1 updated, §2 baseline + targets + verdicts
docs/backlog.md                    # one new entry per missed row (links only; no fixes)
apps/app/CLAUDE.md                 # bench commands / options
```

**Structure Decision**: all code stays inside `apps/app` (bench harness + the unlinked `/bench`
route). Nothing in `packages/*` changes, so dependency direction and the model boundary are
untouched. The pure helpers go in `apps/app/bench/lib/` so Vitest can test them without a browser.

## Complexity Tracking

_No constitution violations._
