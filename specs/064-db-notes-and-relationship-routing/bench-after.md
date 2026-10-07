# Bench after (064, T043)

`pnpm bench` on the 064 branch (US1, US2 and US3 in), same machine and settings as [bench-before.md](bench-before.md): headless Chromium, CPU throttle 1×, 500 nodes / 1,000 edges. Indicative only.

## Comparison (SC-005)

| Scenario                  | Before avg FPS / p95 | After avg FPS / p95 |
| ------------------------- | -------------------- | ------------------- |
| default                   | 56.6 / 16.8          | 56.9 / 16.8         |
| onlyRenderVisibleElements | 57.0 / 16.8          | 57.2 / 16.8         |
| jsonDeckOpen              | 54.7 / 33.3          | 55.7 / 16.8         |
| tables-150-wide           | 58.2 / 16.8          | 58.2 / 16.8         |
| drag                      | 59.6 / 16.7          | 59.2 / 16.8         |
| drag-100-selected         | 49.9 / 33.4          | 59.2 / 16.8         |
| pan-during-layout         | 38.5 / 50.0          | 39.7 / 50.0         |

No measurable regression in pan, zoom or drag. The action scenarios are within run-to-run noise, with one apparent outlier: "next step → current painted" read 55.7 ms before and 152.4 ms after. Rerunning only that scenario (`playwright test -c playwright.bench.config.ts -g "next step"`) on `main` (`adfd9fb5`) gave 47.4, 55.6, 138.4, 137.2 and 53.2 ms, and on the branch 114.7 and 124.4 ms: the scenario is bimodal on this machine with or without 064, so it is noise, not a regression. The 064 code paths (note popover hover, relationship handles) do not run in that scenario: the bench deck has no tables with notes and no relationships.

## Full report

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Images: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 165         | 0                  | 56.9    | 16.8           | 100.0          | 1.4%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 151         | 0                  | 57.2    | 16.8           | 100.0          | 1.2%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 184         | 391                | 55.7    | 16.8           | 83.4           | 2.6%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 185         | 0                  | 58.2    | 16.8           | 50.1           | 0.6%        | yes          |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 179         | 414                | 56.5    | 16.8           | 83.4           | 1.6%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 151         | 0                  | 56.2    | 16.8           | 100.0          | 2.0%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 151         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 184         | 391                | 59.2    | 16.7           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 151         | 0                  | 59.2    | 16.8           | 33.4           | 0.4%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 152         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 157         | 0                  | 39.7    | 50.0           | 133.4          | 7.0%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 108.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 108.6                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 152.4                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 100.0                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 34.7                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 93.5                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 44.6                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 83.7                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 233.0                 | 5000        | yes          |
