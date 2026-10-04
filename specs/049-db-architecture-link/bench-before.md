# Bench before 049

Baseline taken on `b198c70` (main + 049 docs), before any 049 code change to `apps/app`.

- Machine: Apple M5, macOS 26.1, headless Chromium (Playwright), CPU throttle 1×.
- Runs: `pnpm bench` (default: 500 nodes / 1,000 edges) and
  `BENCH_TABLES=150 BENCH_REL=1 pnpm --filter @sododeck/app bench` (first 150 nodes are 12-column
  tables, table edges are relationships).
- Caveat: unit tests were running on the same machine for part of both runs, so frame numbers are
  noisier than a quiet run. The table run hit two harness timeouts ("inspector title edit →
  canvas", "export-preview"); its remaining rows are split over two reports, both below.

## Default (500 nodes / 1,000 edges)

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 223         | 0                  | 55.7    | 16.7           | 116.7          | 1.5%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 164         | 0                  | 56.3    | 16.8           | 133.4          | 1.6%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 188         | 409                | 55.2    | 16.8           | 100.0          | 1.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 188         | 440                | 54.8    | 16.8           | 100.1          | 2.1%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 55.9    | 16.8           | 100.0          | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 155         | 0                  | 58.5    | 16.8           | 50.0           | 1.2%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 159         | 395                | 57.4    | 16.8           | 50.0           | 1.9%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 153         | 0                  | 49.8    | 33.4           | 83.4           | 6.2%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 172         | 0                  | 55.0    | 16.8           | 133.4          | 2.5%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 157         | 0                  | 59.1    | 16.8           | 33.4           | 1.5%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 29.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 153.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 142.1                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 121.2                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 107.5                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 36.0                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 18.7                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 129.2                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 272.4                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 59.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 55.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 254.0                 | 5000        | yes          |

## 150 tables with relationships

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 4.00     | 251         | 0                  | 52.1    | 16.8           | 249.9          | 3.3%        | no           |
| onlyRenderVisibleElements | 368 / 8 of 500                 | 4.00     | 225         | 0                  | 51.9    | 16.8           | 216.8          | 1.6%        | no           |
| jsonDeckOpen              | 500 / 500 of 500               | 4.00     | 253         | 579                | 52.2    | 16.8           | 233.3          | 2.7%        | no           |
| drawer-open-pan           | 500 / 500 of 500               | 4.00     | 261         | 579                | 51.0    | 16.8           | 250.0          | 2.1%        | no           |
| selection-toolbar-pan     | 500 / 500 of 500               | 4.00     | 299         | 0                  | 51.0    | 33.3           | 250.0          | 2.9%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 251         | 0                  | 42.6    | 50.0           | 66.6           | 16.1%       | no           |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 233         | 604                | 38.3    | 50.1           | 133.4          | 24.2%       | no           |
| drag-100-selected         | 500 / 500 of 500               | 0.30     | 239         | 0                  | 36.9    | 66.7           | 116.7          | 20.3%       | no           |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 221         | 0                  | 58.3    | 16.7           | 116.7          | 0.7%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted    | 500 / 1000    | 29.9                  | 100         | yes          |
| select flow → marks painted   | 500 / 1000    | 178.8                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 125.5                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 190.6                 | 100         | no           |
| record click → badge          | 500 / 1000    | 101.7                 | 100         | no           |

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 222         | 0                  | 30.0    | 66.7           | 133.3          | 37.5%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| hover → focus painted                          | 500 / 1000    | 21.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 102.0                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 268.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 55.5                  | 50          | no           |
