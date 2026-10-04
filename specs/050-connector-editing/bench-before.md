# Bench before: connector editing (050)

Taken on unchanged code (`90fe17a`) with `pnpm bench`, 2026-10-04, local machine (Apple Silicon, headless Chromium). Indicative only.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 192         | 0                  | 52.5    | 16.8           | 149.9          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 152         | 0                  | 54.7    | 16.8           | 150.0          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 187         | 484                | 52.1    | 16.8           | 150.1          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 187         | 466                | 52.5    | 16.8           | 133.3          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 156         | 0                  | 52.6    | 16.8           | 150.1          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 158         | 0                  | 58.9    | 16.7           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 179         | 407                | 59.2    | 16.7           | 50.0           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 153         | 0                  | 58.2    | 16.8           | 50.0           | 0.7%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 173         | 0                  | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 161         | 0                  | 57.4    | 16.8           | 33.4           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 126.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 149.4                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 100.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 113.0                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 31.8                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 18.0                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 103.6                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 289.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 49.0                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 85.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 236.9                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 262.0                 | 5000        | yes          |
