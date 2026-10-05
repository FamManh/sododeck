# Bench after (057)

Run on 2026-10-05 after crop and flip, same machine and command as bench-before.md.

# Canvas benchmark — 2026-10-05T11:30:09.811Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Images: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 189         | 0                  | 56.4    | 16.8           | 100.0          | 1.2%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 157         | 0                  | 56.5    | 16.8           | 116.7          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 169         | 406                | 55.8    | 16.8           | 100.0          | 2.2%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 191         | 0                  | 57.0    | 16.8           | 149.9          | 1.8%        | yes          |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 181         | 434                | 55.8    | 16.8           | 100.0          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 153         | 0                  | 56.3    | 16.8           | 83.4           | 1.2%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 161         | 0                  | 59.2    | 16.8           | 50.0           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 163         | 402                | 58.5    | 16.8           | 50.0           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 152         | 0                  | 59.4    | 16.8           | 50.0           | 0.3%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 157         | 0                  | 37.2    | 50.1           | 150.0          | 13.6%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 31.3                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 125.2                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 125.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 133.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 103.6                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 33.6                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 95.7                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 230.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 48.7                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 55.3                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 226.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 242.0                 | 5000        | yes          |
