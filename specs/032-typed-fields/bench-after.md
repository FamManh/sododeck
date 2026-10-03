# Bench after 032 (headless Chromium, same machine as bench-before.md)

`pnpm bench` and `BENCH_TYPES=1` are within run-to-run variation of bench-before.md. **`BENCH_FIELDS=1` is not:** pan at 4× zoom drops to 36 FPS (max frame 783 ms) and drawer-open pan to 33.5 FPS, and the run exited 1 (one scenario failed). Open: needs profiling (likely the per-card fields block / chip measuring at high zoom) before merge.

## `pnpm bench`

### Canvas benchmark — 2026-10-03T16:57:28.336Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 193         | 0                  | 53.0    | 16.8           | 149.9          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 145         | 0                  | 54.1    | 16.8           | 150.0          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 183         | 457                | 52.5    | 16.8           | 133.3          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 176         | 489                | 52.5    | 16.8           | 133.4          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 157         | 0                  | 51.9    | 16.8           | 200.0          | 2.1%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 164         | 0                  | 58.9    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 178         | 453                | 59.2    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 149         | 0                  | 59.4    | 16.7           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 150         | 0                  | 59.8    | 16.8           | 33.4           | 0.0%        | yes          |
| pan-during-layout (7 pans) | 500 / 500 of 500               | 0.40     | 157         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 134.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 151.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 127.3                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 100.1                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 32.4                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 24.7                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 102.9                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 332.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 54.0                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 53.0                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 238.7                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 283.0                 | 5000        | yes          |

## `BENCH_TYPES=1 pnpm bench`

### Canvas benchmark — 2026-10-03T16:58:49.113Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 168         | 0                  | 53.0    | 16.8           | 150.1          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 155         | 0                  | 54.3    | 16.8           | 133.4          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 187         | 427                | 52.2    | 16.8           | 133.4          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 175         | 433                | 52.2    | 16.8           | 150.0          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 151         | 0                  | 53.1    | 16.8           | 133.4          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 156         | 0                  | 59.2    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 155         | 461                | 58.5    | 16.7           | 33.4           | 1.9%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 150         | 0                  | 58.6    | 16.8           | 33.4           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 147         | 0                  | 57.6    | 16.8           | 100.1          | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 146         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 21.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 121.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 122.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 119.7                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 94.1                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.1                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 81.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 247.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 49.7                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 60.7                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 232.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 236.0                 | 5000        | yes          |

## `BENCH_FIELDS=1 pnpm bench`

### Canvas benchmark — 2026-10-03T17:03:20.188Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 214         | 0                  | 36.0    | 33.3           | 783.3          | 3.3%        | no           |
| onlyRenderVisibleElements | 460 / 11 of 500                | 4.00     | 212         | 0                  | 51.8    | 16.8           | 133.3          | 3.0%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 230         | 569                | 33.2    | 33.3           | 950.0          | 3.8%        | no           |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 242         | 527                | 33.5    | 16.8           | 966.6          | 3.6%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 238         | 0                  | 34.3    | 33.2           | 966.7          | 3.5%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 212         | 0                  | 59.3    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 264         | 513                | 59.3    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 280         | 0                  | 45.5    | 33.4           | 83.4           | 11.0%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 219         | 0                  | 57.6    | 16.8           | 116.6          | 0.7%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 22.0                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 119.3                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 140.3                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 48.8                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 102.4                 | 100         | no           |
| inspector title edit → canvas | 500 / 1000    | 31.6                  | 100         | yes          |
| hover → focus painted         | 500 / 1000    | 20.1                  | 16          | no           |

## scene.perf

Passed.
