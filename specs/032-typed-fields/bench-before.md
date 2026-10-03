# Bench before 032 (main at 37b68c5, headless Chromium)

Taken on unchanged app code (the schema edit that had started does not reach the canvas). Run-to-run variation on this machine is roughly ±20 % on render and max-frame numbers.

## `pnpm bench`

### Canvas benchmark — 2026-10-03T16:18:55.105Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 184         | 0                  | 53.2    | 16.8           | 150.0          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 158         | 0                  | 53.6    | 16.8           | 150.1          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 166         | 475                | 52.0    | 16.8           | 166.7          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 178         | 468                | 50.5    | 16.8           | 233.3          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 52.1    | 16.8           | 183.3          | 2.1%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 146         | 0                  | 58.5    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 164         | 485                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 145         | 0                  | 49.7    | 33.4           | 66.6           | 5.3%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 147         | 0                  | 58.6    | 16.8           | 116.7          | 0.3%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 146         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 31.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 154.9                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 119.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 127.6                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 101.0                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 35.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 23.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 99.9                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 302.2                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 54.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 77.2                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 233.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 279.0                 | 5000        | yes          |

## `BENCH_TYPES=1 pnpm bench`

### Canvas benchmark — 2026-10-03T16:20:20.494Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 166         | 0                  | 52.5    | 16.8           | 166.6          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 155         | 0                  | 54.0    | 16.8           | 150.0          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 190         | 427                | 52.4    | 16.8           | 133.4          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 173         | 429                | 51.6    | 16.8           | 166.7          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 159         | 0                  | 52.6    | 16.8           | 133.4          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 156         | 0                  | 58.5    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 178         | 462                | 59.0    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 167         | 0                  | 49.8    | 33.4           | 50.0           | 7.5%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 141         | 0                  | 57.6    | 16.8           | 199.9          | 0.3%        | yes          |
| pan-during-layout (7 pans) | 500 / 500 of 500               | 0.40     | 243         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.3                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 163.1                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 122.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 129.0                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 100.1                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 33.6                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 126.1                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 371.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.3                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 52.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 240.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 298.0                 | 5000        | yes          |

## `pnpm --filter @sododeck/app test scene.perf`

Passed (1 test).
