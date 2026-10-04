# Bench after 049

Same machine as `bench-before.md` (Apple M5, macOS 26.1, headless Chromium, throttle 1×). To keep
the comparison fair, the base commit (`b198c70`) was benched again from a clean worktree right
before the branch, nothing else running. Full reports below; summary first.

## Summary (Avg FPS, base → 049)

| Scenario             | 500 cards   | 150 tables + relationships |
| -------------------- | ----------- | -------------------------- |
| default (pan / zoom) | 55.4 → 56.3 | 52.0 → 51.8                |
| drag                 | 58.6 → 58.9 | 44.2 → 37.6                |
| drag + JSON deck     | 56.7 → 58.9 | 43.3 → 37.3                |
| drag 100 selected    | 49.6 → 58.0 | 46.8 → 36.2                |
| playing at 2×        | 57.4 → 59.6 | 57.0 → 55.4                |

- The 500-card target holds: no scenario is slower.
- The 150-table drag scenarios read about 7 FPS lower. Nothing on the drag path changed beyond
  constant work per frame (`tableCounts`, the forced-row set in `tableLayout`), and the earlier
  run in `bench-before.md` swung by a similar amount on the same scenario, so this is **not
  confirmed**; it should be re-measured on a quiet machine before 048 / 049 tuning.
- The table run times out on "inspector title edit → canvas" and "export-preview" on both base
  and branch (harness, not 049).

## Base `b198c70`, 500 cards

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 163         | 0                  | 55.4    | 16.8           | 133.3          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 187         | 0                  | 56.1    | 16.8           | 133.4          | 1.6%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 195         | 476                | 55.5    | 16.8           | 100.0          | 1.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 196         | 495                | 55.3    | 16.8           | 133.3          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 166         | 0                  | 56.0    | 16.8           | 99.9           | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 160         | 0                  | 58.6    | 16.7           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 205         | 439                | 56.7    | 33.3           | 33.4           | 1.2%        | no           |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 166         | 0                  | 49.6    | 49.9           | 50.1           | 7.4%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 168         | 0                  | 57.4    | 16.8           | 116.6          | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 173         | 0                  | 58.1    | 16.8           | 50.0           | 2.1%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 30.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 144.9                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 148.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 127.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 111.1                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 35.5                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 23.5                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 104.7                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 364.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 64.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 52.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 232.5                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 281.0                 | 5000        | yes          |

## 049, 500 cards

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 164         | 0                  | 56.3    | 16.8           | 100.0          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 170         | 0                  | 56.6    | 16.8           | 116.7          | 1.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 159         | 393                | 55.6    | 16.7           | 100.0          | 2.4%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 174         | 424                | 55.8    | 16.8           | 100.0          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 149         | 0                  | 56.3    | 16.8           | 99.9           | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 152         | 0                  | 58.9    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 156         | 402                | 58.9    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 149         | 0                  | 58.0    | 16.8           | 33.4           | 1.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 148         | 0                  | 59.6    | 16.8           | 33.4           | 0.3%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 174         | 0                  | 39.7    | 50.0           | 150.0          | 8.5%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 27.6                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 131.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 147.8                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 120.8                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 98.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.6                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 21.1                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 101.2                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 220.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 55.9                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 77.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 227.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 235.0                 | 5000        | yes          |

## Base `b198c70`, 150 tables

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 252         | 0                  | 52.0    | 33.2           | 233.4          | 2.7%        | no           |
| onlyRenderVisibleElements | 368 / 8 of 500                 | 4.00     | 231         | 0                  | 52.5    | 16.8           | 216.7          | 1.6%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 241         | 556                | 52.9    | 16.8           | 216.6          | 2.3%        | no           |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 248         | 628                | 51.7    | 16.8           | 233.3          | 2.1%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 220         | 0                  | 51.2    | 33.3           | 233.3          | 3.2%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 217         | 0                  | 44.2    | 50.0           | 50.1           | 14.9%       | no           |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 228         | 587                | 43.3    | 50.0           | 66.7           | 13.3%       | no           |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 210         | 0                  | 46.8    | 50.0           | 83.3           | 10.8%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 208         | 0                  | 57.0    | 16.7           | 133.3          | 1.1%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 28.7                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 117.2                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 163.1                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 63.5                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 93.3                  | 100         | yes          |

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 273         | 0                  | 29.1    | 83.3           | 166.7          | 38.7%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| hover → focus painted                          | 500 / 1000    | 24.5                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 93.9                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 378.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 58.9                  | 50          | no           |

## 049, 150 tables

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 267         | 0                  | 51.8    | 33.3           | 283.4          | 2.6%        | no           |
| onlyRenderVisibleElements | 368 / 8 of 500                 | 4.00     | 275         | 0                  | 51.5    | 16.8           | 250.0          | 1.5%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 276         | 739                | 50.8    | 33.2           | 266.6          | 2.2%        | no           |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 268         | 610                | 50.7    | 33.2           | 283.3          | 2.5%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 303         | 0                  | 50.7    | 33.3           | 266.7          | 4.0%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 275         | 0                  | 37.6    | 66.6           | 83.4           | 25.6%       | no           |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 275         | 658                | 37.3    | 66.7           | 100.1          | 22.1%       | no           |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 380         | 0                  | 36.2    | 66.7           | 133.4          | 19.2%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 271         | 0                  | 55.4    | 16.8           | 216.6          | 1.8%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 35.2                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 145.8                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 142.7                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 320.0                 | 100         | no           |
| record click → badge          | 500 / 1000    | 121.8                 | 100         | no           |

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| pan-during-layout (3 pans) | 500 / 500 of 500               | 0.40     | 225         | 0                  | 28.0    | 333.3          | 350.0          | 5.7%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| hover → focus painted                          | 500 / 1000    | 20.4                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 103.3                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 263.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 60.6                  | 50          | no           |
