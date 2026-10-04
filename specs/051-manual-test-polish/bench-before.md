# Bench before 051 (baseline, unchanged code)

`pnpm bench` on `dcff41c` (main with 045 and 050). Headless Chromium, indicative only.

# Canvas benchmark — 2026-10-04T11:32:13.966Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 201         | 0                  | 54.4    | 16.8           | 100.0          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 160         | 0                  | 54.2    | 16.8           | 133.3          | 2.5%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 213         | 521                | 53.2    | 16.8           | 183.2          | 2.6%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 184         | 425                | 54.2    | 16.8           | 100.1          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 155         | 0                  | 54.3    | 16.8           | 116.6          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 159         | 0                  | 59.2    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 185         | 489                | 58.0    | 16.8           | 50.0           | 1.2%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 185         | 0                  | 59.2    | 16.7           | 50.0           | 0.4%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 154         | 0                  | 59.6    | 16.7           | 33.4           | 0.3%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 153         | 0                  | 57.1    | 33.3           | 33.4           | 0.0%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.7                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 121.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 121.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 143.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 83.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 33.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 17.9                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 88.2                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 260.1                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 51.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 81.2                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 227.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 257.0                 | 5000        | yes          |
