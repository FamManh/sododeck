# Bench after 047

Same command and machine as `bench-before.md`: `BENCH_TABLES=150 BENCH_REL=1 pnpm bench`. Same two harness timeouts as the baseline ("inspector title edit → canvas", "export-preview"). Frame and action numbers match the baseline within run-to-run noise (e.g. default 52.2 vs 51.9 fps, drag 43.2 vs 41.5 fps, select 3 → toolbar 26.8 vs 27.8 ms, view-switch 97.9 vs 99.8 ms); no scenario regressed beyond 5 % outside that noise.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 150. Relationships: true. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 264         | 0                  | 52.2    | 33.3           | 233.4          | 2.9%        | no           |
| onlyRenderVisibleElements | 368 / 8 of 500                 | 4.00     | 222         | 0                  | 52.5    | 16.8           | 216.7          | 1.6%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 247         | 625                | 52.3    | 16.8           | 233.3          | 2.1%        | no           |
| tables-150-wide           | 150 / 150 of 150               | 4.00     | 201         | 0                  | 57.2    | 16.8           | 150.0          | 1.2%        | yes          |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 252         | 697                | 51.8    | 16.8           | 250.0          | 2.1%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 227         | 0                  | 51.3    | 33.3           | 233.3          | 2.6%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 226         | 0                  | 43.2    | 50.0           | 66.6           | 15.2%       | no           |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 236         | 627                | 38.3    | 50.1           | 83.3           | 25.3%       | no           |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 243         | 0                  | 45.4    | 50.0           | 66.7           | 13.6%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 234         | 0                  | 56.8    | 16.8           | 150.0          | 0.7%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 26.8                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 127.5                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 123.8                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 96.1                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 99.7                  | 100         | yes          |

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 150. Relationships: true. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 242         | 0                  | 24.6    | 383.3          | 383.3          | 6.3%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| hover → focus painted                          | 500 / 1000    | 19.1                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 97.9                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 262.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.2                  | 50          | no           |
