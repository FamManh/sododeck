# Bench after 011 (saved views and auto-layout)

Ran on 2026-09-28 at `5d3f8f0` on the same laptop as [bench-before.md](bench-before.md), via `pnpm bench` and `BENCH_GROUPS=1 pnpm bench`. Headless Chromium; indicative only.

## Summary

| Target                                                    | Result                                                                                                        | Met                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| SC-001 Tidy layout, 200 components, 5 pinned, < 2 s       | 224 ms click → applied (median of 3); pins exact (unit test)                                                  | yes                                             |
| SC-002 panning ≥ 60 fps while a 500-component layout runs | 59.0 avg fps, p95 16.8 ms, 0 long frames (frames only while running)                                          | yes (within the 95% bar used by every scenario) |
| SC-003 view switch ≤ 200 ms                               | 72–75 ms (System → Infra, 500 nodes, 250 overridden positions)                                                | yes                                             |
| 010 scenarios, no regression                              | `groups-collapsed` 60.0 fps, `collapse-toggle` 31.2 → 28.9 ms (now a document write), `focus` 103.5 → 93.1 ms | yes                                             |

Pan / zoom and drag scenarios are within run-to-run noise of the baseline (default 53.9 → 53.9 fps; drag 58.2 → 57.6; drag+jsonDeck 60.0 → 59.1). The flow action scenarios (select flow, open flow, next step) swing ±50 ms between consecutive runs on this machine, before and after: in the two runs below they are 77 / 129 / 48 ms and 139 / 76 / 112 ms; the baseline run had 79 / 73 / 47 ms. None of their code paths changed except the canvas deck now coming from the view state, which returns the snapshot itself for the System preset.

`default` and `jsonDeckOpen` miss the 60 fps target by the same margin as before 011 (one long frame when the zoom crosses a level); that is pre-existing.

## `pnpm bench`

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 363         | 350                | 53.9    | 16.8           | 183.3          | 2.5%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 305         | 287                | 57.8    | 16.8           | 66.7           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 349         | 347                | 53.3    | 16.8           | 199.9          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 321         | 304                | 57.6    | 16.8           | 33.4           | 2.5%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 342         | 341                | 59.1    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 322         | 303                | 55.8    | 16.8           | 100.0          | 2.2%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 125         | 0                  | 59.0    | 16.8           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 77.2                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 128.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 48.1                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 67.4                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.6                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 71.6                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 38.0                  | 50          | yes          |

## `BENCH_GROUPS=1 pnpm bench`

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 132         | 0                  | 53.2    | 16.8           | 199.9          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 20 of 500                | 2.00     | 126         | 0                  | 57.7    | 16.8           | 83.3           | 1.2%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 133         | 308                | 53.6    | 16.8           | 183.3          | 2.8%        | no           |
| groups-collapsed           | 5 / 5 of 500                   | 2.00     | 131         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag                       | 500 / 500 of 500               | 0.30     | 137         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 132         | 304                | 59.7    | 16.8           | 33.4           | 0.6%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 128         | 0                  | 56.0    | 16.8           | 100.0          | 2.2%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 125         | 0                  | 59.0    | 16.8           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 138.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 76.1                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 111.7                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 67.1                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| collapse-toggle                                | 500 / 1000    | 28.9                  | 100         | yes          |
| focus                                          | 500 / 1000    | 93.1                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 75.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 223.1                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 34.1                  | 50          | yes          |
