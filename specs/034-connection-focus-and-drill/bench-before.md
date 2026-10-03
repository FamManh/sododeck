<!-- Baseline before any 034 code change. Machine: Apple M5 (arm64), headless Chromium, one `pnpm bench` run (plan asked for 5; run-to-run variation is not measured here), nothing else running. Branch head 707e2b3. -->

# Canvas benchmark — 2026-10-03T13:50:03.523Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 445         | 426                | 53.6    | 16.8           | 150.1          | 1.7%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 488         | 470                | 53.9    | 16.8           | 216.7          | 1.8%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 432         | 390                | 52.5    | 16.8           | 133.3          | 3.1%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 453         | 445                | 53.1    | 16.8           | 116.8          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 138         | 0                  | 53.2    | 16.8           | 133.3          | 2.2%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 405         | 388                | 59.2    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 430         | 388                | 58.9    | 16.8           | 50.0           | 1.3%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 387         | 370                | 50.3    | 33.4           | 50.1           | 6.7%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 405         | 387                | 58.8    | 16.8           | 99.9           | 0.3%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 139         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.7                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 91.8                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 104.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 154.4                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 83.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.9                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 89.1                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 260.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 52.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 74.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 252.0                 | 5000        | yes          |
