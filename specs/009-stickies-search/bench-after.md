# Benchmark after 009

Run on this branch with `BENCH_STICKIES=100 pnpm bench`.

- Report: `apps/app/bench/results/report-2026-09-27T18-51-22-393Z.{json,md}`
- Before baseline: unavailable (`T002` was skipped on `main`, per the task note), so this file records the after-only numbers.

## Canvas scenarios

| Scenario                  | Result                             |
| ------------------------- | ---------------------------------- |
| default                   | 59.6 fps, p95 16.7 ms, max 49.9 ms |
| onlyRenderVisibleElements | 60.0 fps, p95 16.8 ms, max 16.8 ms |
| jsonDeckOpen              | 59.6 fps, p95 16.7 ms, max 50.0 ms |
| drag                      | 59.7 fps, p95 16.7 ms, max 33.3 ms |
| drag+jsonDeck             | 59.7 fps, p95 16.8 ms, max 33.3 ms |
| playing at 2×             | 59.8 fps, p95 16.8 ms, max 33.3 ms |

## Action scenarios

| Scenario                      | Nodes / edges | Result   | Target   |
| ----------------------------- | ------------- | -------- | -------- |
| select flow → marks painted   | 500 / 1000    | 153.9 ms | < 100 ms |
| open flow → flow mode painted | 500 / 1000    | 157.2 ms | < 100 ms |
| next step → current painted   | 500 / 1000    | 124.8 ms | < 100 ms |
| record click → badge          | 500 / 1000    | 92.4 ms  | < 100 ms |
| inspector title edit → canvas | 500 / 1000    | 32.4 ms  | < 100 ms |
| ⌘K type → results             | 2000 / 4000   | 40.0 ms  | < 50 ms  |

## Notes

- The new palette scenario meets its 50 ms target at 2,000 nodes / 4,000 edges.
- Pan, zoom, drag, and 2× playback stayed effectively at the 60 fps target with 100 notes on the canvas.
- Three pre-existing flow-paint scenarios were over the 100 ms target in this run; recorded here for follow-up rather than blocked in this feature pass.
