# Bench before (064, T002)

Run on `main` at `adfd9fb5` before any 064 change, `pnpm bench`, headless Chromium, CPU throttle 1×. Indicative only; the same machine runs the after bench.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Images: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 193         | 0                  | 56.6    | 16.8           | 133.3          | 1.1%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 153         | 0                  | 57.0    | 16.8           | 100.0          | 1.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 189         | 398                | 54.7    | 33.3           | 116.7          | 1.5%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 184         | 0                  | 58.2    | 16.8           | 50.1           | 0.6%        | yes          |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 182         | 421                | 56.0    | 16.8           | 100.0          | 2.1%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 152         | 0                  | 56.5    | 16.8           | 83.4           | 1.1%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 153         | 0                  | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 183         | 389                | 58.9    | 16.8           | 50.0           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 161         | 0                  | 49.9    | 33.4           | 83.3           | 6.5%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 173         | 0                  | 59.6    | 16.7           | 33.4           | 0.3%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 158         | 0                  | 38.5    | 50.0           | 133.3          | 11.6%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 122.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 125.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 55.7                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 103.6                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 35.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.0                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 93.7                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 234.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 50.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 48.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 233.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 251.0                 | 5000        | yes          |
