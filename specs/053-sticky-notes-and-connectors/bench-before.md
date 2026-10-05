# Canvas benchmark — 2026-10-05T01:35:21.794Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 191         | 0                  | 55.5    | 16.8           | 133.4          | 2.3%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 168         | 0                  | 56.5    | 16.8           | 133.3          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 188         | 413                | 54.6    | 16.8           | 150.0          | 2.1%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 207         | 0                  | 56.7    | 16.8           | 166.7          | 0.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 181         | 433                | 55.7    | 16.8           | 100.1          | 2.4%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 162         | 0                  | 56.2    | 16.8           | 100.0          | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 164         | 0                  | 59.3    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 163         | 406                | 58.9    | 16.8           | 50.0           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 157         | 0                  | 58.0    | 16.8           | 33.5           | 0.7%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 226         | 0                  | 57.2    | 16.8           | 216.7          | 0.3%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 165         | 0                  | 38.8    | 50.0           | 133.4          | 11.4%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 29.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 134.8                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 127.4                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 109.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 111.4                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 35.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 21.4                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 109.9                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 260.1                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 68.2                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 51.2                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 298.0                 | 5000        | yes          |
