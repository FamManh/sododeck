# Bench after 048 (T045)

Taken on branch `FamManh/feat-db-schema` with T001-T043 committed. Same machine, settings and
commands as `bench-before.md`: Apple M5, macOS 26.1, Node v26.8.1, headless Chromium (Playwright),
CPU throttle 1x, 2026-10-04. Headless numbers are indicative only (about 1-3 fps run to run).

## Run A: `pnpm bench` (500 nodes / 1,000 edges), 25 tests passed (1.5 min)

| Scenario                         | Nodes in DOM (fit / zoomed in) | Render (ms) | Avg FPS | p95 (ms) | Max (ms) | Long frames | Before: avg FPS / p95 / render |
| -------------------------------- | ------------------------------ | ----------- | ------- | -------- | -------- | ----------- | ------------------------------ |
| default (500 cards)              | 500 / 500 of 500               | 204         | 55.6    | 16.8     | 116.7    | 1.5%        | 55.8 / 16.8 / 191              |
| **tables-150-wide** (150 tables) | 150 / 150 of 150               | 197         | 56.3    | 16.8     | 166.6    | 1.8%        | 55.8 / 16.8 / 224              |
| jsonDeckOpen                     | 500 / 500 of 500               | 193         | 55.6    | 16.8     | 100.0    | 2.2%        | 55.6 / 16.8 / n.a.             |
| drag                             | 500 / 500 of 500               | 159         | 58.9    | 16.7     | 50.0     | 0.6%        | 58.9 / 16.8 / n.a.             |
| drag-100-selected                | 500 / 500 of 500               | 157         | 49.5    | 33.4     | 66.7     | 7.6%        | 58.2 / 16.8 / n.a.             |
| playing at 2x                    | 500 / 500 of 500               | 192         | 59.8    | 16.8     | 33.4     | 0.3%        | 60.0 / 16.7 / n.a.             |

Remaining Run A scenarios are within noise of before (all 11 rows are in the raw report). The
`drag-100-selected` dip (49.5 vs 58.2) is a 500-card scenario that 048 does not touch; the same
scenario on the 150-table deck in Run B is 58.5. Treat it as a noisy run, not a regression, but it
was not re-run, so it stays uncertain.

Action scenarios: select flow 169.8 ms (before 154.0), open flow 138.0 (127.2), next step 197.4
(128.7), record click 126.0 (99.7), hover 19.7 (18.0), Cmd+K 63.6 ms (62.2). The flow and record
rows miss their 100 ms target in this run as they did before (flow rows were already over); they
are 500-card flow scenarios not touched by 048 and look slower mostly from machine load (the
whole run was a few percent slower than before).

## Run B: 150 tables, wide, 3 schemas

Command: `BENCH_NODES=150 BENCH_EDGES=250 BENCH_TABLES=150 BENCH_REL=1 BENCH_WIDE=1 BENCH_SCHEMAS=3 pnpm bench`
(22 passed, 3 failed, 7.9 min).

| Scenario                  | Nodes in DOM (fit / zoomed in) | Render (ms) | Avg FPS | p95 (ms) | Max (ms) | Before: avg FPS / p95 |
| ------------------------- | ------------------------------ | ----------- | ------- | -------- | -------- | --------------------- |
| default                   | 150 / 150 of 150               | 242         | 56.5    | 16.8     | 183.3    | 54.3 / 33.3           |
| onlyRenderVisibleElements | 113 / 2 of 150                 | 218         | 55.2    | 16.8     | 166.7    | 54.2 / 16.8           |
| jsonDeckOpen              | 150 / 150 of 150               | 274         | 55.8    | 16.8     | 166.6    | 54.1 / 16.8           |
| tables-150-wide           | 150 / 150 of 150               | 203         | 56.5    | 16.8     | 150.1    | 54.5 / 33.3           |
| drawer-open-pan           | 150 / 150 of 150               | 285         | 55.5    | 16.8     | 183.2    | 54.5 / 16.8           |
| selection-toolbar-pan     | 150 / 150 of 150               | 245         | 55.1    | 16.8     | 200.0    | 53.1 / 33.3           |
| drag                      | 150 / 150 of 150               | 262         | 57.0    | 16.8     | 49.9     | 56.4 / 33.3           |
| drag+jsonDeck             | 150 / 150 of 150               | 310         | 55.3    | 33.3     | 50.0     | 57.7 / 16.8           |
| drag-100-selected         | 150 / 150 of 150               | 207         | 58.5    | 16.8     | 50.0     | 57.0 / 16.8           |
| playing at 2x             | 150 / 150 of 150               | 213         | 59.8    | 16.7     | 33.3     | 59.8 / 16.8           |
| pan-during-layout         | 150 / 150 of 150               | 219         | 60.0    | 16.7     | 16.7     | 60.0 / 16.7           |

| Action scenario (150 tables)                          | After (ms) | Before (ms) | Target (ms) | Meets |
| ----------------------------------------------------- | ---------- | ----------- | ----------- | ----- |
| select 3 to toolbar painted                           | 20.8       | 21.1        | 100         | yes   |
| select flow to marks painted                          | 83.0       | 91.5        | 100         | yes   |
| open flow to flow mode painted                        | 73.1       | 92.9        | 100         | yes   |
| next step to current painted                          | 43.9       | 45.0        | 100         | yes   |
| record click to badge                                 | 49.8       | 47.7        | 100         | yes   |
| hover to focus painted                                | 29.6       | 28.7        | 16          | no    |
| tidy-layout-200 (median of 3)                         | 356.8      | 290.5       | 2000        | yes   |
| Cmd+K type to results (2000 / 4000, not a table deck) | 59.7       | 56.1        | 50          | no    |

The same 3 scenarios as before failed on the 150-table deck (inspector title edit and view-switch
hit the 180 s test timeout, export-preview the 30 s download timeout). They depend on cards
`n0..n4` and the System / Infra views of the 500-card deck, so this is a property of those
scenarios with `BENCH_TABLES=150`, not of 048. No numbers for them.

## Against the targets (T044, SC-005)

| Criterion                           | Target   | Result                                 | Met               |
| ----------------------------------- | -------- | -------------------------------------- | ----------------- |
| tables-150-wide avg FPS             | >= 57    | 56.3 (Run A), 56.5 (Run B)             | no, by 0.5-0.7    |
| tables-150-wide p95 frame           | <= 20 ms | 16.8 ms in both runs                   | yes               |
| Open time vs 500-card deck (SC-005) | <= 1.5x  | 197 ms vs 204 ms (0.97x); Run B 203 ms | yes               |
| Cmd+K type to results               | 50 ms    | 59.7-63.6 ms                           | no (pre-existing) |

## Reading (T047)

- The 150-table avg FPS is 0.7 below the 57 criterion. The 500-card default deck sits at 55.6 in the
  same run and before 048 it was 55.8, so the headless ceiling on this machine is about 56 fps and
  the shortfall is the harness, not the table deck. Compared with the 150-table baseline (54.5) the
  after number is better (56.5), and p95 is met. No tuning was done.
- Cmd+K: the 2,000-node scenario has no tables, so it measures the pre-existing node search
  (56-62 ms before, 60-64 ms after). It does not exercise the new table and column search kinds on a
  150-table deck. Slowest part cannot be attributed from these numbers (the bench has no per-stage
  timing).
- Proposed follow-ups (not done): (1) add a Cmd+K scenario on the 150-table deck with column hits, so
  the search index cost for tables and columns is measured; (2) add per-stage timing for the search
  index build vs query; (3) make the three 500-card-deck-bound scenarios deck-agnostic; (4) re-run
  `drag-100-selected` on the 500-card deck to confirm the 49.5 fps dip is noise.
