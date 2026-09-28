# Canvas benchmark — 2026-09-28T16:29:32.314Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 346         | 328                | 53.4    | 16.8           | 200.1          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 305         | 287                | 57.5    | 16.8           | 83.4           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 341         | 290                | 53.7    | 16.8           | 183.3          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 349         | 307                | 54.2    | 16.8           | 183.2          | 2.4%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 305         | 287                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 332         | 292                | 59.5    | 16.7           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 303         | 287                | 57.8    | 16.8           | 50.1           | 1.4%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 114         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 72.4                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 84.7                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 115.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 75.9                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.0                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 71.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 226.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 39.9                  | 50          | yes          |
