# Bench before (016)

Unchanged code at `f7bb4f9` (`main` + the 016 docs), in a clean worktree. Headless Chromium on the development Mac, CPU throttle 1×; indicative only. Run on 2026-09-29.

The two new scenarios (T003) were run against the same unchanged code, with only `bench/perf.bench.ts` and the bench page's `selectNodes` hook copied in. `group-drag` logs `TODO(016): not available yet` there, as expected.

## `pnpm bench`

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 362         | 343                | 53.1    | 16.8           | 216.7          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 322         | 304                | 57.1    | 16.8           | 83.4           | 1.9%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 355         | 354                | 53.1    | 16.8           | 216.6          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 396         | 352                | 53.1    | 16.8           | 199.9          | 3.1%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 134         | 0                  | 52.5    | 16.8           | 216.6          | 3.0%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 321         | 303                | 59.6    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 360         | 358                | 59.3    | 16.8           | 33.4           | 0.6%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 339         | 321                | 57.6    | 16.8           | 50.1           | 1.4%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 127         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 20.6                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 126.2                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 95.1                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 126.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 76.0                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.4                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 70.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 33.8                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 48.0                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 209.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 168.0                 | 5000        | yes          |

## `BENCH_GROUPS=1 pnpm bench`

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: true. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 125         | 0                  | 52.7    | 16.8           | 200.0          | 3.1%        | no           |
| onlyRenderVisibleElements  | 460 / 20 of 500                | 2.00     | 122         | 0                  | 57.2    | 16.8           | 83.3           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 150         | 340                | 53.0    | 16.8           | 199.9          | 2.7%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 251         | 487                | 52.8    | 16.8           | 216.6          | 2.7%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 129         | 0                  | 52.8    | 16.8           | 216.7          | 2.7%        | no           |
| groups-collapsed           | 5 / 5 of 500                   | 2.00     | 128         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag                       | 500 / 500 of 500               | 0.30     | 121         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 134         | 326                | 58.6    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 123         | 0                  | 58.6    | 16.8           | 50.0           | 1.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 125         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 29.3                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 81.5                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 83.4                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 48.3                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 82.8                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.2                  | 100         | yes          |
| collapse-toggle                                | 500 / 1000    | 26.6                  | 100         | yes          |
| focus                                          | 500 / 1000    | 96.0                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 71.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 236.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 33.5                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 53.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 210.3                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 157.0                 | 5000        | yes          |

## New scenarios (`BENCH_GROUPS=1`, `-g drag`)

| Scenario          | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ----------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| drag              | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.2    | 16.8           | 33.4           | 1.4%        | yes          |
| drag+jsonDeck     | 500 / 500 of 500               | 0.30     | 137         | 323                | 58.2    | 16.8           | 33.4           | 0.8%        | yes          |
| drag-100-selected | 500 / 500 of 500               | 0.30     | 120         | 0                  | 56.9    | 33.3           | 33.4           | 0.0%        | no           |

`drag-100-selected` is already just below the 60 fps target before any 016 change (p95 33 ms): moving 100 selected cards writes 100 positions per frame. The after run is compared against this number.
