# 033 bench after (finished feature, commit 996bfa9)

Same machine and method as bench-before.md; headless, indicative only.

## pnpm bench

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 441         | 423                | 52.6    | 16.8           | 133.3          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 476         | 457                | 53.7    | 16.8           | 166.6          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 462         | 460                | 52.7    | 16.8           | 133.4          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 497         | 447                | 52.3    | 16.8           | 150.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 163         | 0                  | 52.7    | 16.8           | 150.0          | 2.2%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 424         | 405                | 58.6    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 523         | 471                | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 405         | 388                | 48.7    | 33.5           | 83.4           | 8.3%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 428         | 414                | 58.4    | 16.8           | 83.3           | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 137         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.7                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 115.2                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 102.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 294.4                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 86.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.9                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 98.5                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 260.1                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 58.0                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 86.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 256.0                 | 5000        | yes          |

## BENCH_TAGS=1 pnpm bench (3 to 10 tags per card, pool of 24)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 460         | 440                | 35.2    | 16.8           | 866.7          | 3.9%        | no           |
| onlyRenderVisibleElements  | 460 / 11 of 500                | 4.00     | 458         | 440                | 51.6    | 16.8           | 150.1          | 3.6%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 474         | 472                | 35.4    | 33.4           | 816.7          | 4.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 515         | 503                | 33.7    | 16.8           | 966.6          | 4.0%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 169         | 0                  | 35.0    | 16.8           | 833.3          | 3.6%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 457         | 438                | 59.4    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 472         | 429                | 59.3    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 455         | 438                | 46.0    | 33.4           | 66.8           | 7.6%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 457         | 438                | 58.2    | 16.8           | 66.6           | 1.7%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 147         | 0                  | 48.7    | 66.6           | 66.8           | 8.9%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.3                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 117.1                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 112.7                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 78.0                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 89.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 32.4                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 84.7                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 246.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 58.7                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 61.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 278.7                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 56.0                  | 50          | no           |
| export: 2× PNG click → download                | 500 / 1000    | 308.0                 | 5000        | yes          |

## pnpm --filter @sododeck/app test scene.perf

1 file, 1 test passed (0.88 s).

## Comparison

Pan and drag scenarios are within run-to-run variation of bench-before.md: plain deck default 52.6 vs 53.2 fps (long frames 1.9% both); tagged deck default 35.2 vs 36.7 fps (3.9% vs 3.0% long frames; the tagged deck is already slower than the plain one before this feature, because 3 to 10 pills per card are drawn). The tagged-deck pan numbers vary by more than this between two runs of the same code. Tag pills now read the tag colour through two CSS variables per pill, no extra DOM nodes. `toFlowNodes` recomputes a card's pills only when its tags or the `tagColors` object change.
