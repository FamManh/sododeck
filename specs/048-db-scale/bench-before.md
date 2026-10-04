# Bench baseline before 048 (T004)

Taken on branch `FamManh/feat-db-schema` after T001-T003 (bench fixtures only) and before any
feature code (no row limit, grouping mode, view filters or search kinds yet).

- **Machine**: Apple M5, macOS 26.1, Node v26.8.1, pnpm 10.34.5, headless Chromium (Playwright), CPU
  throttle 1x. Headless numbers are indicative only; compare runs on this machine.
- **Date**: 2026-10-04.
- Raw reports are in `apps/app/bench/results/` (git-ignored). The first run's reports are merged
  below because the bench writes a report per worker, and three scenarios timed out (see Notes).

## Run A: `pnpm bench` (500 nodes / 1,000 edges, default deck)

All 25 tests passed (1.5 min). The new `tables-150-wide` scenario (150 tables, 250
relationships, every 10th table 60 columns, 3 schemas) is part of this run.

| Scenario                         | Nodes in DOM (fit / zoomed in) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets 60 fps target |
| -------------------------------- | ------------------------------ | ------- | -------------- | -------------- | ----------- | ------------------- |
| default (500 cards)              | 500 / 500 of 500               | 55.8    | 16.8           | 116.6          | 1.8%        | no                  |
| onlyRenderVisibleElements        | 460 / 6 of 500                 | 56.5    | 16.8           | 116.7          | 1.6%        | no                  |
| jsonDeckOpen                     | 500 / 500 of 500               | 55.6    | 16.8           | 100.0          | 1.8%        | no                  |
| **tables-150-wide** (150 tables) | 150 / 150 of 150               | 55.8    | 16.8           | 183.3          | 1.5%        | no                  |
| drawer-open-pan                  | 500 / 500 of 500               | 55.2    | 16.8           | 100.0          | 1.9%        | no                  |
| selection-toolbar-pan            | 500 / 500 of 500               | 55.9    | 16.8           | 100.0          | 1.8%        | no                  |
| drag                             | 500 / 500 of 500               | 58.9    | 16.8           | 50.1           | 0.6%        | yes                 |
| drag+jsonDeck                    | 500 / 500 of 500               | 58.6    | 16.8           | 33.4           | 1.2%        | yes                 |
| drag-100-selected                | 500 / 500 of 500               | 58.2    | 16.8           | 49.9           | 0.3%        | yes                 |
| playing at 2x                    | 500 / 500 of 500               | 60.0    | 16.7           | 16.8           | 0.0%        | yes                 |
| pan-during-layout (5 pans)       | 500 / 500 of 500               | 57.1    | 16.8           | 50.0           | 2.6%        | yes                 |

Render (ms, page load to bench ready): default 191, tables-150-wide 224.

| Action scenario                      | Nodes / edges | ms    | Target (ms) | Meets |
| ------------------------------------ | ------------- | ----- | ----------- | ----- |
| select 3 to toolbar painted          | 500 / 1000    | 29.3  | 100         | yes   |
| select flow to marks painted         | 500 / 1000    | 154.0 | 100         | no    |
| open flow to flow mode painted       | 500 / 1000    | 127.2 | 100         | no    |
| next step to current painted         | 500 / 1000    | 128.7 | 100         | no    |
| record click to badge                | 500 / 1000    | 99.7  | 100         | yes   |
| inspector title edit to canvas       | 500 / 1000    | 34.2  | 100         | yes   |
| hover to focus painted               | 500 / 1000    | 18.0  | 16          | no    |
| view-switch (System to Infra)        | 500 / 1000    | 113.0 | 200         | yes   |
| tidy-layout-200 (median of 3)        | 200 / 400     | 308.7 | 2000        | yes   |
| **Cmd+K type to results**            | 2000 / 4000   | 62.2  | 50          | no    |
| export: click to dialog painted      | 500 / 1000    | 74.8  | 300         | yes   |
| export: PNG to preview painted       | 500 / 1000    | 230.7 | 2000        | yes   |
| export: longest task while preparing | 500 / 1000    | 0.0   | 50          | yes   |
| export: 2x PNG click to download     | 500 / 1000    | 265.0 | 5000        | yes   |

## Run B: 150 tables, wide and in 3 schemas

Command: `BENCH_NODES=150 BENCH_EDGES=250 BENCH_TABLES=150 BENCH_REL=1 BENCH_WIDE=1 BENCH_SCHEMAS=3 pnpm bench`
(every scenario uses the 150-table deck; 22 passed, 3 failed, 8 min, see Notes).

| Scenario                  | Nodes in DOM (fit / zoomed in) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets 60 fps target |
| ------------------------- | ------------------------------ | ------- | -------------- | -------------- | ----------- | ------------------- |
| default                   | 150 / 150 of 150               | 54.3    | 33.3           | 216.7          | 1.8%        | no                  |
| onlyRenderVisibleElements | 113 / 4 of 150                 | 54.2    | 16.8           | 200.0          | 1.3%        | no                  |
| jsonDeckOpen              | 150 / 150 of 150               | 54.1    | 16.8           | 283.3          | 1.8%        | no                  |
| tables-150-wide           | 150 / 150 of 150               | 54.5    | 33.3           | 200.0          | 1.5%        | no                  |
| drawer-open-pan           | 150 / 150 of 150               | 54.5    | 16.8           | 200.0          | 1.8%        | no                  |
| selection-toolbar-pan     | 150 / 150 of 150               | 53.1    | 33.3           | 216.7          | 3.5%        | no                  |
| drag                      | 150 / 150 of 150               | 56.4    | 33.3           | 50.1           | 1.7%        | no                  |
| drag+jsonDeck             | 150 / 150 of 150               | 57.7    | 16.8           | 33.4           | 1.1%        | yes                 |
| drag-100-selected         | 150 / 150 of 150               | 57.0    | 16.8           | 50.0           | 0.6%        | yes                 |
| playing at 2x             | 150 / 150 of 150               | 59.8    | 16.8           | 33.3           | 0.0%        | yes                 |
| pan-during-layout         | 150 / 150 of 150               | 60.0    | 16.7           | 16.7           | 0.0%        | yes                 |

| Action scenario (150 tables)                          | ms    | Target (ms) | Meets |
| ----------------------------------------------------- | ----- | ----------- | ----- |
| select 3 to toolbar painted                           | 21.1  | 100         | yes   |
| select flow to marks painted                          | 91.5  | 100         | yes   |
| open flow to flow mode painted                        | 92.9  | 100         | yes   |
| next step to current painted                          | 45.0  | 100         | yes   |
| record click to badge                                 | 47.7  | 100         | yes   |
| hover to focus painted                                | 28.7  | 16          | no    |
| tidy-layout-200 (median of 3)                         | 290.5 | 2000        | yes   |
| Cmd+K type to results (2000 / 4000, not a table deck) | 56.1  | 50          | no    |

## Notes

- Three Run B scenarios failed with Playwright's 180 s test timeout (inspector title edit, view-switch)
  and a 30 s download timeout (export-preview). They rely on cards `n0..n4` and the System / Infra
  views of the 500-card deck and never finish on a 150-table deck. This is a property of those
  scenarios with `BENCH_TABLES=150`, not of this change; no numbers are given for them. They pass in Run A.
- FPS numbers vary by about 1-3 fps between runs in headless Chromium; the 60 fps target is
  missed by the default 500-card deck too (55.8), so compare after against these numbers, not
  against 60.
- The "1,800 columns" of the spec is a typical count; the `wide` deck has 15 tables of 60 columns and
  135 of 12, so 2,520 columns, which is a heavier baseline.
- The Cmd+K scenario builds its own 2,000-node deck (no tables); it is the only search timing and
  is already over its 50 ms target before 048 (56-62 ms).
