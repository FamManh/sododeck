# 033 bench before (rendering unchanged, commit f7fc411 plus the BENCH_TAGS option)

Machine note: headless Chromium, another agent's work may have run on the same machine; compare with the after run only.

## pnpm bench

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 446         | 427                | 53.2    | 16.8           | 133.3          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 388         | 371                | 54.3    | 16.8           | 133.4          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 461         | 459                | 52.1    | 16.8           | 166.8          | 2.7%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 538         | 479                | 51.7    | 16.8           | 150.0          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 218         | 0                  | 52.5    | 16.8           | 150.1          | 2.4%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 560         | 539                | 58.3    | 16.8           | 50.1           | 1.8%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 505         | 458                | 59.3    | 16.7           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 474         | 455                | 51.3    | 33.4           | 66.6           | 4.5%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 421         | 403                | 57.8    | 16.8           | 100.0          | 1.0%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 146         | 0                  | 60.0    | 16.7           | 16.7           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.9                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 116.3                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 113.6                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 59.3                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 86.1                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.2                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 87.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 228.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 54.3                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 75.7                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 224.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 262.0                 | 5000        | yes          |

## BENCH_TAGS=1 pnpm bench (3 to 10 tags per card, pool of 24)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 439         | 421                | 36.7    | 16.8           | 833.3          | 3.0%        | no           |
| onlyRenderVisibleElements  | 460 / 11 of 500                | 4.00     | 423         | 405                | 52.3    | 16.8           | 133.4          | 3.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 486         | 478                | 36.2    | 16.8           | 733.3          | 3.6%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 512         | 459                | 34.0    | 16.8           | 1033.3         | 3.6%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 144         | 0                  | 36.8    | 16.8           | 700.0          | 3.7%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 438         | 420                | 59.4    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 444         | 442                | 59.7    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 439         | 421                | 46.6    | 33.4           | 50.0           | 8.3%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 490         | 472                | 58.0    | 16.8           | 83.4           | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 173         | 0                  | 45.6    | 83.4           | 116.6          | 6.6%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 18.4                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 111.3                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 109.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 55.8                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 103.3                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 35.2                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 98.2                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 323.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 61.8                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 55.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 309.5                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 69.0                  | 50          | no           |
| export: 2× PNG click → download                | 500 / 1000    | 352.0                 | 5000        | yes          |

## pnpm --filter @sododeck/app test scene.perf

1 file, 1 test passed (1.91 s).
