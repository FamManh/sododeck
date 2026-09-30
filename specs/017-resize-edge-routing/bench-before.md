# Canvas benchmark — 2026-09-30T19:36:02.491Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 364         | 343                | 53.0    | 16.8           | 216.6          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 322         | 304                | 57.3    | 16.8           | 83.3           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 358         | 356                | 53.1    | 16.8           | 216.6          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 385         | 342                | 53.1    | 16.8           | 200.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 125         | 0                  | 52.9    | 16.8           | 200.0          | 2.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 322         | 304                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 355         | 353                | 59.6    | 16.7           | 33.2           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 322         | 305                | 56.0    | 33.3           | 33.4           | 0.9%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 339         | 322                | 55.4    | 16.8           | 100.0          | 2.9%        | no           |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 123         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 20.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 88.4                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 79.5                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 201.3                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 76.6                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.4                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 71.0                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.1                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 39.8                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 46.4                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 209.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 163.0                 | 5000        | yes          |

> (This is the unmodified perf.bench.ts run at commit 17bb4ce, the base of the 017 feature branch, before card resize / connector routing changes. T003's `resized-routed` scenario does not exist yet at this commit.)
