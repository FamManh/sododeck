<!-- 054 T046: one `pnpm bench` run after (this branch). `drag-100-selected` swings between 49 and 59 fps on this machine in both builds (three reruns each: 58.0 / 49.9 / 49.8 before, 58.8 / 58.4 / 50.3 after), so the one 9.2 % long-frame reading in the after report is noise, not a regression. -->

# Canvas benchmark — 2026-10-05T03:32:46.259Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 206         | 0                  | 56.1    | 16.8           | 100.1          | 2.1%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 170         | 0                  | 56.0    | 16.8           | 150.0          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 168         | 433                | 54.9    | 16.8           | 116.7          | 1.8%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 205         | 0                  | 56.0    | 16.8           | 166.6          | 1.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 282         | 669                | 55.2    | 16.8           | 116.7          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 159         | 0                  | 55.3    | 16.8           | 116.7          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 167         | 0                  | 58.5    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 208         | 435                | 58.5    | 16.8           | 50.0           | 1.2%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 175         | 0                  | 48.6    | 49.9           | 50.1           | 9.2%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 175         | 0                  | 59.6    | 16.8           | 33.4           | 0.0%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 158         | 0                  | 36.1    | 50.1           | 149.9          | 17.0%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 27.9                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 158.2                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 132.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 158.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 106.1                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 32.3                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.5                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 108.2                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 298.7                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 62.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 68.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 238.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 273.0                 | 5000        | yes          |
