# Canvas benchmark — 2026-09-28T17:11:44.683Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 289         | 272                | 54.1    | 16.8           | 183.3          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 305         | 288                | 57.8    | 16.8           | 66.7           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 330         | 288                | 54.0    | 16.8           | 183.4          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 353         | 310                | 53.9    | 16.8           | 183.3          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 289         | 271                | 58.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 322         | 320                | 59.6    | 16.8           | 33.4           | 0.7%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 288         | 271                | 57.8    | 16.8           | 50.1           | 1.4%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 112         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 85.8                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 92.4                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 47.4                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 68.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.6                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 67.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 215.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 33.5                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 61.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 206.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 145.0                 | 5000        | yes          |

## Comparison with `bench-before.md` (012)

Canvas scenarios (1× CPU): no regression. Changes are within run-to-run noise.

| Scenario                      | Before avg FPS / p95 | After avg FPS / p95 | Before → after (ms) |
| ----------------------------- | -------------------- | ------------------- | ------------------- |
| default                       | 53.4 / 16.8          | 54.1 / 16.8         |                     |
| onlyRenderVisibleElements     | 57.5 / 16.8          | 57.8 / 16.8         |                     |
| jsonDeckOpen                  | 53.7 / 16.8          | 54.0 / 16.8         |                     |
| drawer-open-pan               | 54.2 / 16.8          | 53.9 / 16.8         |                     |
| drag                          | 60.0 / 16.7          | 58.6 / 16.8         |                     |
| select flow → marks painted   |                      |                     | 72.4 → 85.8         |
| open flow → flow mode painted |                      |                     | 84.7 → 92.4         |
| next step → current painted   |                      |                     | 115.2 → 47.4        |
| view-switch                   |                      |                     | 71.0 → 67.4         |
| ⌘K type → results             |                      |                     | 39.9 → 33.5         |

The default / jsonDeckOpen / drawer-open-pan "no" rows were already "no" before (one 183 ms
frame while zooming, unrelated to export). The flow-step miss in `bench-before.md` (115.2 ms) did
not reproduce.

Export (SC-003, new `export-preview` scenario; deck with flows, groups and 20 stickies):

| Measure                                       | 1× CPU   | 4× CPU (`BENCH_CPU_THROTTLE=4`) | Target   |
| --------------------------------------------- | -------- | ------------------------------- | -------- |
| click → dialog painted                        | 61.5 ms  | 146.0 ms                        | < 300 ms |
| PNG → preview painted (incl. 150 ms debounce) | 206.4 ms | 340.6 ms                        | < 2 s    |
| longest task while preparing                  | none     | 92 ms (one task)                | < 50 ms  |
| 2× PNG click → download                       | 145 ms   | 426 ms                          | < 5 s    |

The < 50 ms budget holds at 1× (the bench reference). At 4× throttle one 92 ms task remains
(the scene + SVG task, under 50 ms at 1×, slowed four times); per T040 generation stays on the main thread and this
is reported rather than moved to a worker.
