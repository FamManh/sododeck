# Bench baseline before 018 canvas changes

Ran on 2026-09-28 at `23ff7a9` (docs only on the branch; the editor is unchanged) via `pnpm bench`.

Headless Chromium on the development laptop; indicative only. The new 018 scenario (`drawer-open-pan`) did not exist yet. Baseline misses (`default`, `jsonDeckOpen`, `playing at 2×`, `select flow`) are pre-existing single long frames, as in earlier baselines.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 396         | 376                | 53.3    | 16.8           | 199.9          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 322         | 304                | 57.5    | 16.8           | 66.6           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 368         | 318                | 53.6    | 16.8           | 199.9          | 2.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 322         | 305                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 349         | 348                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 322         | 304                | 56.0    | 16.8           | 100.0          | 1.4%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 127         | 0                  | 59.0    | 16.8           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 105.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 82.6                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 49.8                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 67.9                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.5                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 70.8                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 234.7                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 32.1                  | 50          | yes          |
