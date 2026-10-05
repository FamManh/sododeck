# Canvas benchmark — 2026-10-05T05:11:39.529Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 191         | 0                  | 56.3    | 16.8           | 100.1          | 1.5%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 155         | 0                  | 56.8    | 16.7           | 133.3          | 1.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 187         | 401                | 56.1    | 16.8           | 83.4           | 1.8%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 193         | 0                  | 57.2    | 16.7           | 149.9          | 0.9%        | yes          |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 184         | 438                | 55.5    | 16.8           | 100.1          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 153         | 0                  | 56.3    | 16.8           | 100.0          | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 153         | 0                  | 58.5    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 165         | 419                | 59.3    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 162         | 0                  | 50.5    | 33.4           | 50.1           | 5.4%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 170         | 0                  | 59.8    | 16.7           | 33.4           | 0.3%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 160         | 0                  | 36.9    | 150.0          | 150.0          | 10.0%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 28.6                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 143.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 144.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 123.3                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 105.2                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 34.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.0                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 99.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 249.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 60.2                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 66.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 238.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 260.0                 | 5000        | yes          |
