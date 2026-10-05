# Canvas benchmark — 2026-10-05T02:36:23.200Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 210         | 0                  | 56.6    | 16.8           | 83.4           | 1.2%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 162         | 0                  | 56.4    | 16.8           | 133.3          | 1.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 193         | 407                | 55.7    | 16.8           | 100.0          | 1.8%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 188         | 0                  | 56.9    | 16.8           | 150.0          | 1.2%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 181         | 503                | 55.9    | 16.8           | 83.4           | 2.4%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 155         | 0                  | 56.6    | 16.8           | 83.4           | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 156         | 0                  | 58.9    | 16.8           | 49.9           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 158         | 395                | 58.5    | 16.8           | 50.0           | 1.3%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 152         | 0                  | 58.0    | 16.8           | 33.4           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 157         | 0                  | 59.2    | 16.8           | 33.4           | 0.0%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 156         | 0                  | 40.3    | 49.9           | 149.9          | 8.5%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 33.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 128.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 121.5                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 104.6                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 104.8                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 31.4                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 21.1                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 96.8                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 240.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 60.2                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 74.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 237.5                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 258.0                 | 5000        | yes          |
