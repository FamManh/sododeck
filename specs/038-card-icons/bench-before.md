# Bench before (038), main at aa15cfc, headless Chromium

## pnpm bench

# Canvas benchmark — 2026-10-04T06:55:48.430Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 180         | 0                  | 53.9    | 16.8           | 133.3          | 1.7%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 143         | 0                  | 54.6    | 16.8           | 133.3          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 152         | 452                | 51.8    | 16.8           | 150.0          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 182         | 455                | 51.4    | 16.8           | 283.4          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 157         | 0                  | 52.7    | 16.8           | 166.7          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 157         | 0                  | 59.3    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 171         | 406                | 58.9    | 16.8           | 33.4           | 1.3%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 143         | 0                  | 49.9    | 33.4           | 66.7           | 6.7%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 159         | 0                  | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 145         | 0                  | 57.1    | 33.3           | 33.4           | 0.0%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 158.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 114.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 91.4                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 90.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 25.1                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 91.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 266.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 59.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 71.6                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 232.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 263.0                 | 5000        | yes          |

## BENCH_TYPES=1 pnpm bench

# Canvas benchmark — 2026-10-04T06:57:18.885Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 222         | 0                  | 52.7    | 16.8           | 166.6          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 185         | 0                  | 53.8    | 16.8           | 166.7          | 1.8%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 191         | 462                | 51.9    | 16.8           | 150.0          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 192         | 503                | 51.9    | 16.8           | 150.1          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 161         | 0                  | 52.0    | 16.8           | 150.0          | 2.4%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 177         | 0                  | 55.8    | 33.2           | 66.7           | 1.2%        | no           |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 189         | 489                | 59.2    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 171         | 0                  | 49.5    | 33.4           | 100.0          | 6.1%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 158         | 0                  | 58.2    | 16.8           | 83.3           | 1.4%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 191         | 0                  | 54.1    | 16.8           | 83.3           | 3.0%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 125.5                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 141.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 151.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 106.9                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 41.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 25.8                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 119.7                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 448.7                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 72.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 83.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 241.7                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 255.0                 | 5000        | yes          |
