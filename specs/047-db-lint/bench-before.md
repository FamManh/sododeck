# Bench before 047

Baseline on `b80c198` (main + 047 docs), before any 047 code change. Command: `BENCH_TABLES=150 BENCH_REL=1 pnpm bench` (Apple M5, headless Chromium, CPU throttle 1×). Same two harness timeouts as the 049 baseline ("inspector title edit → canvas", "export-preview"); remaining rows are in two reports.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 150. Relationships: true. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 268         | 0                  | 51.9    | 33.3           | 233.4          | 2.7%        | no           |
| onlyRenderVisibleElements | 368 / 8 of 500                 | 4.00     | 235         | 0                  | 52.7    | 16.8           | 216.7          | 1.3%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 237         | 560                | 52.0    | 16.8           | 216.7          | 2.5%        | no           |
| tables-150-wide           | 150 / 150 of 150               | 4.00     | 197         | 0                  | 56.4    | 16.8           | 166.6          | 1.2%        | no           |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 260         | 725                | 51.1    | 16.8           | 233.2          | 2.7%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 238         | 0                  | 51.4    | 33.3           | 233.3          | 3.5%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 220         | 0                  | 41.5    | 50.0           | 66.7           | 19.4%       | no           |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 237         | 562                | 40.6    | 50.0           | 66.7           | 21.5%       | no           |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 228         | 0                  | 40.5    | 66.6           | 66.8           | 20.1%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 225         | 0                  | 57.2    | 16.8           | 116.7          | 0.7%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 27.8                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 140.4                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 135.9                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 121.1                 | 100         | no           |
| record click → badge          | 500 / 1000    | 101.7                 | 100         | no           |

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 150. Relationships: true. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 226         | 0                  | 16.9    | 400.0          | 400.0          | 11.1%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| hover → focus painted                          | 500 / 1000    | 19.9                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 99.8                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 271.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 56.3                  | 50          | no           |
