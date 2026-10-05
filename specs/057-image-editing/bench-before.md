# Bench before (057)

Run on 2026-10-05 before any canvas change (model and schema already edited; the canvas was untouched). `pnpm bench`, Chromium, production build.

# Canvas benchmark — 2026-10-05T11:10:34.761Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Images: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 232         | 0                  | 56.3    | 16.8           | 99.9           | 1.5%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 182         | 0                  | 55.9    | 16.8           | 166.6          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 191         | 452                | 55.2    | 16.8           | 116.7          | 2.1%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 222         | 0                  | 55.9    | 16.8           | 166.7          | 2.1%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 215         | 511                | 54.8    | 16.8           | 133.3          | 2.1%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 188         | 0                  | 55.5    | 16.8           | 116.6          | 2.3%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 172         | 0                  | 57.8    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 211         | 449                | 56.7    | 33.3           | 50.0           | 0.6%        | no           |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 186         | 0                  | 59.0    | 16.7           | 50.0           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 162         | 0                  | 55.2    | 16.8           | 266.6          | 1.1%        | no           |
| pan-during-layout (3 pans) | 500 / 500 of 500               | 0.40     | 193         | 0                  | 35.8    | 50.1           | 183.4          | 16.2%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 32.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 146.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 139.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 262.9                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 94.0                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 42.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 24.0                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 131.7                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 370.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 79.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 80.4                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 235.7                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 370.0                 | 5000        | yes          |
