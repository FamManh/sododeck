# Bench after 030 (`pnpm bench` and `BENCH_TYPES=1 pnpm bench`, headless Chromium, same machine)

**Summary:** every scenario is within run-to-run variation of `bench-before.md` (average fps within ±1.5, action scenarios within ±15 ms, no scenario changed its meets-target result); `BENCH_TYPES=1` matches the plain run.

## pnpm bench

# Canvas benchmark — 2026-10-03T15:47:39.969Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 192         | 0                  | 52.6    | 16.8           | 133.3          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 149         | 0                  | 54.8    | 16.8           | 133.3          | 1.8%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 189         | 453                | 52.8    | 16.8           | 133.4          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 165         | 418                | 52.4    | 16.8           | 133.4          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 148         | 0                  | 53.1    | 16.8           | 133.3          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 140         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 175         | 391                | 58.9    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 147         | 0                  | 59.6    | 16.8           | 33.4           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 139         | 0                  | 58.8    | 16.8           | 100.0          | 0.3%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 138         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.4                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 106.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 102.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 71.5                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 85.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 36.5                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 90.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 250.4                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 49.7                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 77.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 229.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 244.0                 | 5000        | yes          |

## BENCH_TYPES=1 pnpm bench (13 card types round-robin, every pack on)

# Canvas benchmark — 2026-10-03T15:48:57.027Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 155         | 0                  | 52.1    | 16.8           | 166.8          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 167         | 0                  | 54.7    | 16.8           | 133.3          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 149         | 431                | 52.7    | 16.8           | 133.4          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 172         | 472                | 52.1    | 16.8           | 133.3          | 3.2%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 141         | 0                  | 53.4    | 16.7           | 133.4          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 139         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 171         | 431                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 137         | 0                  | 59.4    | 16.7           | 33.4           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 141         | 0                  | 57.8    | 16.8           | 100.0          | 0.7%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 137         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 19.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 102.8                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 98.2                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 61.3                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 83.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 26.3                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 78.1                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 231.4                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 53.1                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 84.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 229.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 262.0                 | 5000        | yes          |

## scene.perf (unit)

Test Files 1 passed (1)
Tests 1 passed (1)
