# Bench before 008 (baseline on `main` @ 3a3c2d3)

`pnpm bench`, 2026-09-27, headless Chromium, CPU throttle 1×, same machine as `bench-after.md`.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 363         | 342                | 59.8    | 16.7           | 33.3           | 0.0%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 273         | 255                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 645         | 633                | 59.3    | 16.8           | 33.3           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 254         | 237                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 276         | 271                | 59.5    | 16.7           | 33.3           | 0.0%        | yes          |

Flow scenarios (006): median of 5, target < 100 ms. Deck flows: flow scenarios only.

| Scenario                    | Action → painted (ms) | Meets target |
| --------------------------- | --------------------- | ------------ |
| select flow → marks painted | 13.0                  | yes          |
| record click → badge        | 69.3                  | yes          |
