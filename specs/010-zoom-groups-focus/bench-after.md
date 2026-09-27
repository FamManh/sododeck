# Bench results after zoom / groups / focus

Ran on 2026-09-27 via:

```bash
pnpm bench
BENCH_GROUPS=1 pnpm bench
```

The benchmark harness now builds a fresh production bundle and starts a fresh preview server for every run so grouped scenarios never measure a stale preview build.

## Investigation and optimization attempts

I made two real optimization passes before capturing the numbers below:

1. **Benchmark correctness / staleness**
   - changed `apps/app/playwright.bench.config.ts` to build before preview and to avoid reusing an old preview server
   - moved the grouped benchmark hooks onto `window.__sododeckBench` so the bench waits on a single source of truth

2. **Canvas derivation cost**
   - cached `groupBounds()` by deck arrays + node size
   - skipped `groupBounds()` entirely in `visibleGraph()` when nothing is collapsed
   - added an empty fast path to `collapseFlowMarks()`
   - cached node/edge/group lookups in `deck-to-flow.ts`
   - reused the `toFlowNodes()` array identity when every RF node object is unchanged
   - removed repeated `find()` / `findIndex()` scans in `deck-to-flow.ts`

These changes materially improved the grouped focus path (from **129.7 ms** to **104.4 ms**) and stabilized the grouped scenarios, but they did **not** fully close the remaining perf gap.

## `pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 380         | 362                | 52.9    | 16.8           | 216.7          | 2.7%        | no           |
| onlyRenderVisibleElements | 460 / 25 of 500                | 2.00     | 339         | 322                | 57.5    | 16.7           | 83.4           | 1.3%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 376         | 328                | 52.4    | 16.8           | 216.7          | 2.8%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 356         | 338                | 59.3    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 378         | 332                | 59.7    | 16.7           | 33.4           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 357         | 338                | 58.2    | 16.8           | 50.0           | 0.7%        | yes          |

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 111.0                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 92.9                  | 100         | yes          |
| next step → current painted   | 500 / 1000    | 143.7                 | 100         | no           |
| record click → badge          | 500 / 1000    | 76.5                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 31.2                  | 100         | yes          |
| ⌘K type → results             | 2000 / 4000   | 37.8                  | 50          | yes          |

## `BENCH_GROUPS=1 pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 148         | 0                  | 52.7    | 16.8           | 216.6          | 2.7%        | no           |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 138         | 0                  | 57.3    | 16.8           | 83.3           | 1.6%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 147         | 384                | 52.4    | 16.8           | 216.6          | 3.0%        | no           |
| groups-collapsed          | 5 / 5 of 500                   | 2.00     | 142         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 164         | 0                  | 59.7    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 153         | 399                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 141         | 0                  | 57.4    | 16.8           | 83.3           | 1.4%        | yes          |

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 178.4                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 88.4                  | 100         | yes          |
| next step → current painted   | 500 / 1000    | 46.1                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 75.7                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 32.4                  | 100         | yes          |
| collapse-toggle               | 500 / 1000    | 28.4                  | 100         | yes          |
| focus                         | 500 / 1000    | 104.4                 | 100         | no           |
| ⌘K type → results             | 2000 / 4000   | 45.2                  | 50          | yes          |

## Comparison summary

- `groups-collapsed` now exists and **meets** the 010 target: **60.0 fps avg / 16.7 ms p95**.
- `collapse-toggle` now exists and **meets** the 010 target: **28.4 ms**.
- `focus` improved from **129.7 ms** to **104.4 ms**, but still **misses** the ≤100 ms target.
- The grouped default scenario regressed from **59.1 fps** before to **52.7 fps** after (~10.8% slower), still worse than the allowed 5% regression.
- The ungrouped default scenario regressed from **59.3 fps** before to **52.9 fps** after (~10.8% slower).

## Current root-cause hypothesis

Two costs still dominate:

1. **Semantic zoom detail switches**: crossing the level bands rebuilds many visible React Flow node objects and swaps between the lighter System/Container markup and the heavier Component card markup. That is functionally correct, but it is the likely source of the persistent default-scenario regression.
2. **Focus mode accessibility work**: entering focus still requires a near-full-canvas update so non-neighbour nodes receive `inert` / `aria-hidden` and edges/cards/ports receive `aria-hidden`. The lookup and cache work cut the cost substantially, but the remaining mass update still paints slightly above budget.

So T065 is fully executed and documented, but its gate is still **not** green.
