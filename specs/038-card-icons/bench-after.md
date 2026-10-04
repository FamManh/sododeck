# Bench after (038)

SC-005 summary (pan/zoom fps, `default` scenario, headless Chromium, 500 nodes / 1,000 edges):
before 53.9 → after 53.1 (`pnpm bench`); before 52.7 → after 53.4 (`BENCH_TYPES=1`);
`BENCH_ICONS=1` (every card a custom icon) 52.3, i.e. −3.0 % against the 53.9 baseline, within 5 %.
Drag: 59.3 → 58.9 / 59.6 / 59.3. Differences are inside run-to-run noise.

## pnpm bench

# Canvas benchmark — 2026-10-04T07:18:45.396Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 181         | 0                  | 53.1    | 16.8           | 150.0          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 151         | 0                  | 55.0    | 16.8           | 133.3          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 188         | 464                | 52.4    | 16.8           | 150.0          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 171         | 436                | 51.6    | 16.8           | 166.6          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 52.2    | 16.8           | 216.7          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 149         | 0                  | 58.9    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 159         | 466                | 59.2    | 16.8           | 33.4           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 142         | 0                  | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 145         | 0                  | 59.8    | 16.8           | 33.3           | 0.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 149         | 0                  | 59.0    | 16.7           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.7                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 105.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 117.2                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 144.0                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 95.0                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 33.8                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 26.7                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 88.1                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 267.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.9                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 78.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 232.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 258.0                 | 5000        | yes          |

## BENCH_TYPES=1 pnpm bench

# Canvas benchmark — 2026-10-04T07:20:10.138Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 150         | 0                  | 53.4    | 16.8           | 150.1          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 179         | 0                  | 53.6    | 16.8           | 183.4          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 174         | 466                | 52.3    | 16.8           | 150.1          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 168         | 470                | 52.2    | 16.8           | 150.0          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 165         | 0                  | 51.8    | 16.8           | 183.3          | 2.2%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 144         | 0                  | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 189         | 516                | 58.2    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 206         | 0                  | 46.0    | 50.1           | 116.6          | 10.1%       | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 142         | 0                  | 58.0    | 16.8           | 116.7          | 1.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 158         | 0                  | 58.3    | 16.8           | 33.4           | 1.4%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 125.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 145.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 129.8                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 95.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 23.4                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 98.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 322.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.3                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 60.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 225.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 270.0                 | 5000        | yes          |

## BENCH_ICONS=1 pnpm bench

# Canvas benchmark — 2026-10-04T07:21:33.666Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 158         | 0                  | 52.3    | 16.8           | 150.0          | 2.5%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 154         | 0                  | 54.0    | 16.8           | 149.9          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 209         | 504                | 50.5    | 16.8           | 266.7          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 196         | 494                | 52.0    | 16.8           | 150.1          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 152         | 0                  | 52.2    | 16.8           | 166.7          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.3    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 159         | 479                | 57.3    | 16.8           | 66.6           | 1.7%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 149         | 0                  | 50.5    | 33.4           | 50.1           | 5.0%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 179         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 143         | 0                  | 57.0    | 33.3           | 33.4           | 1.7%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.5                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 119.5                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 123.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 136.6                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 94.8                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.7                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 85.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 237.2                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 59.4                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 73.7                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 235.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 262.0                 | 5000        | yes          |
