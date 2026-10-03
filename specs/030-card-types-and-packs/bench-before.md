# Bench before 030 (main at f30a1e4, `pnpm bench`, headless Chromium)

# Canvas benchmark — 2026-10-03T15:22:38.600Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 220         | 0                  | 52.0    | 16.8           | 183.3          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 147         | 0                  | 54.3    | 16.8           | 133.3          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 230         | 550                | 51.8    | 16.8           | 166.6          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 165         | 420                | 52.6    | 16.8           | 150.0          | 2.7%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 168         | 0                  | 52.7    | 16.8           | 150.0          | 2.1%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 176         | 0                  | 58.6    | 16.8           | 50.0           | 1.2%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 176         | 405                | 58.9    | 16.8           | 33.4           | 1.9%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 157         | 0                  | 59.6    | 16.7           | 33.4           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 139         | 0                  | 57.4    | 16.8           | 100.0          | 1.1%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 142         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.5                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 118.9                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 101.3                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 67.7                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 86.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 33.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 22.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 95.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 265.4                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 57.0                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 73.6                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 236.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 262.0                 | 5000        | yes          |

## scene.perf (unit)

> vitest run scene.perf
> Test Files 1 passed (1)
> Tests 1 passed (1)
