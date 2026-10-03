# Bench before 031 (`884586b`, unchanged code, headless Chromium)

## `pnpm bench`

### Canvas benchmark — 2026-10-03T16:10:12.195Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 267         | 0                  | 51.8    | 16.8           | 149.9          | 2.7%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 155         | 0                  | 53.3    | 16.8           | 166.6          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 164         | 430                | 49.6    | 16.8           | 266.7          | 2.3%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 214         | 534                | 50.3    | 16.8           | 166.7          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 207         | 0                  | 51.6    | 16.8           | 216.6          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 150         | 0                  | 59.2    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 181         | 468                | 59.6    | 16.7           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 143         | 0                  | 59.6    | 16.7           | 33.4           | 0.4%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.4    | 16.8           | 33.3           | 0.0%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 146         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 30.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 156.5                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 153.4                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 224.3                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 95.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 24.7                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 89.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 249.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 48.6                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 80.3                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 229.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 233.0                 | 5000        | yes          |

## `BENCH_TYPES=1 pnpm bench`

### Canvas benchmark — 2026-10-03T16:11:33.535Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 146         | 0                  | 53.4    | 16.8           | 150.0          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 170         | 0                  | 54.6    | 16.8           | 150.0          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 186         | 460                | 51.8    | 16.8           | 166.6          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 174         | 424                | 52.3    | 16.8           | 133.3          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 146         | 0                  | 52.9    | 16.8           | 149.9          | 2.1%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 146         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 152         | 445                | 58.5    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 158         | 0                  | 50.4    | 33.4           | 50.1           | 7.7%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 141         | 0                  | 58.4    | 16.8           | 100.0          | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 145         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 27.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 156.0                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 150.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 291.7                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 101.4                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 30.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 16.3                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 94.7                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 314.7                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.3                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 83.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 233.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 259.0                 | 5000        | yes          |

## scene.perf (unit)

`pnpm --filter @sododeck/app exec vitest run scene.perf`: 1 test passed (1).
