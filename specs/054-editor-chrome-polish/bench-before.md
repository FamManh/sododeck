<!-- 054 T046: one `pnpm bench` run before (commit c7e91900, the spec commit). `drag-100-selected` swings between 49 and 59 fps on this machine in both builds (three reruns each: 58.0 / 49.9 / 49.8 before, 58.8 / 58.4 / 50.3 after), so the one 9.2 % long-frame reading in the after report is noise, not a regression. -->

# Canvas benchmark — 2026-10-05T03:34:37.440Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 194         | 0                  | 55.8    | 16.8           | 116.6          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 153         | 0                  | 56.3    | 16.8           | 150.0          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 203         | 495                | 55.8    | 16.8           | 100.0          | 1.8%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 189         | 0                  | 56.7    | 16.8           | 150.1          | 1.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 218         | 474                | 55.2    | 16.8           | 116.8          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 170         | 0                  | 56.6    | 16.8           | 99.9           | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 154         | 0                  | 57.6    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 165         | 398                | 58.5    | 16.8           | 33.4           | 1.3%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 162         | 0                  | 57.8    | 16.8           | 33.4           | 1.1%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.4    | 16.8           | 33.4           | 0.3%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 169         | 0                  | 36.4    | 150.0          | 150.0          | 10.8%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.4                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 157.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 140.7                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 124.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 107.2                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 33.8                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 105.6                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 268.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 64.2                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 53.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 226.3                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 264.0                 | 5000        | yes          |
