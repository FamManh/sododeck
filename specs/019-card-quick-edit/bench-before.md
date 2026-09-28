# Bench baseline before 019 card quick edit

Ran on 2026-09-28 at `92258e7` (the editor is unchanged) via `pnpm bench`.

Headless Chromium on the development laptop; indicative only. The new 019 scenario (`selection-toolbar-pan`) did not exist yet. Baseline misses (`default`, `jsonDeckOpen`, `drawer-open-pan`, `playing at 2×`, `open flow`) are pre-existing single long frames, as in earlier baselines.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 346         | 327                | 53.8    | 16.8           | 183.3          | 2.5%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 305         | 287                | 57.6    | 16.8           | 66.6           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 332         | 330                | 53.6    | 16.8           | 183.3          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 359         | 315                | 53.8    | 16.8           | 200.1          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 304         | 287                | 58.6    | 16.8           | 33.4           | 1.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 325         | 324                | 59.1    | 16.8           | 33.4           | 0.8%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 288         | 270                | 55.8    | 16.8           | 100.0          | 2.9%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 111         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 74.6                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 127.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 89.4                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 71.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.5                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 67.1                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 219.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 42.3                  | 50          | yes          |
