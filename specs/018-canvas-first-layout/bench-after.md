# Bench after 018 (canvas-first shell)

Ran on 2026-09-28 at `da7c00a` via `pnpm bench`, same machine as [bench-before.md](bench-before.md). Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 308         | 289                | 54.0    | 16.8           | 183.3          | 2.5%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 290         | 272                | 57.8    | 16.8           | 66.6           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 319         | 275                | 53.8    | 16.8           | 200.0          | 2.4%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 341         | 337                | 53.6    | 16.8           | 183.4          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 289         | 271                | 57.8    | 16.8           | 33.4           | 1.5%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 319         | 279                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 288         | 271                | 55.2    | 16.8           | 100.0          | 2.5%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 110         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 135.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 85.8                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 46.3                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 69.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.6                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 67.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 217.2                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 34.9                  | 50          | yes          |

## Before → after

| Scenario                           | Before                 | After                  | Note                                                                 |
| ---------------------------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| default (avg FPS / p95)            | 53.3 / 16.8            | 54.0 / 16.8            | same pattern: one long first frame, p95 at 60 fps                    |
| jsonDeckOpen                       | 53.6 / 16.8            | 53.8 / 16.8            |                                                                      |
| **drawer-open-pan** (new, SC-006)  | —                      | 53.6 / 16.8            | drawer + JSON overlay open: same as default, no cost from the chrome |
| drag / drag+jsonDeck               | 59.6 / 59.6            | 57.8 / 59.6            |                                                                      |
| playing at 2×                      | 56.0                   | 55.2                   |                                                                      |
| pan-during-layout                  | 59.0                   | 60.0                   |                                                                      |
| inspector title edit → canvas      | 31.5 ms                | 31.6 ms                | now in the details drawer                                            |
| view-switch / tidy-layout-200 / ⌘K | 70.8 / 234.7 / 32.1 ms | 67.3 / 217.2 / 34.9 ms | Tidy now runs from the views menu hook                               |
| select flow → marks painted        | 105.7 ms               | 135.7 ms               | see below                                                            |

**select flow.** Both runs miss the 100 ms target, as the baseline did (it also missed at 105.7 ms). Because the gap looked larger after, both builds were served side by side and measured interleaved (8 pairs, median of 5 each, same browser): after `87 119 188 206 464 306 144 282` vs before `118 104 224 215 490 474 351 350` ms. The canvas-first build is equal or faster in 7 of 8 pairs; the machine was heavily loaded during that run, so the absolute numbers are high. The scenario does not render any shell chrome, and the differences between single `pnpm bench` runs are machine noise, not a regression.

The frame-rate "no" rows are the pre-existing single long first frame after the fit (see earlier baselines); p95 stays at 16.8 ms (60 fps) in every scenario.
