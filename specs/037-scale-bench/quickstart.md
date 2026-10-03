# Quickstart: validate Scale Bench

Prerequisites: Node ≥ 24, `pnpm install`, Chromium for Playwright (`pnpm --filter @sododeck/app exec playwright install chromium`).

1. **Unit tests for the helpers** (no browser): `pnpm --filter @sododeck/app test bench` → generator valid / deterministic at all four sizes, stats, rows and report formatting.
2. **Stable flow highlight (US1)**: run `pnpm bench` five times; the flow-highlight medians agree within 25 % and the canvas FPS table has a row for every scenario that ran (SC-001, FR-002).
3. **Quick default run (SC-004)**: time `pnpm bench` before (`main`) and after; the difference is ≤ 20 %.
4. **One size end to end**: `BENCH_SCALE=1 BENCH_SIZES=500 BENCH_FAST=1 pnpm --filter @sododeck/app bench:scale` → a report with every area filled for 500 (a few minutes).
5. **Full ladder**: `pnpm --filter @sododeck/app bench:scale` → report with 500 / 2,000 / 5,000 / 10,000, culling on and off; no empty cell, `did-not-finish` rows carry a reason (SC-002).
6. **Docs**: copy the baseline into `docs/performance.md` §2 with machine and commit; every row has a target and a mark; every `missed` row links a new backlog entry (SC-003, FR-008, FR-009).
7. **Reproduce**: on a clean checkout run step 4 again and compare the report's shape with the recorded one (SC-004, FR-012).
8. **No behaviour change (SC-006)**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
