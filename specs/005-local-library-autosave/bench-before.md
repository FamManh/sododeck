# Bench before (main @ 91d2ef3)

Recorded 2026-09-27 on the development machine, before any 005 change (`pnpm bench`, CPU throttle 1×).

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 309         | 285                | 59.8    | 16.8           | 33.3           | 0.0%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 239         | 222                | 59.8    | 16.7           | 33.3           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 250         | 208                | 59.8    | 16.7           | 33.4           | 0.3%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 239         | 222                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 244         | 242                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
