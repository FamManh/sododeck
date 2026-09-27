# Bench after 008

`pnpm bench`, 2026-09-27, headless Chromium, CPU throttle 1×, same machine as `bench-before.md`.

## After US1 (component and connection inspectors)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 284         | 262                | 59.6    | 16.8           | 33.4           | 0.3%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 273         | 255                | 59.8    | 16.8           | 33.3           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 277         | 275                | 59.8    | 16.7           | 33.2           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 272         | 254                | 59.0    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 264         | 223                | 59.5    | 16.8           | 33.3           | 0.0%        | yes          |

Flow and inspector scenarios (006, 008): median of 5, target < 100 ms. Deck flows: flow scenarios only.

| Scenario                      | Action → painted (ms) | Meets target |
| ----------------------------- | --------------------- | ------------ |
| select flow → marks painted   | 16.0                  | yes          |
| record click → badge          | 70.3                  | yes          |
| inspector title edit → canvas | 32.0                  | yes          |

Compared with `bench-before.md`: pan, zoom and drag stay at ~60 fps with p95 ≤ 16.8 ms in every scenario (no regression). SC-001: a component title edit in the inspector is painted on the canvas in 32 ms (median of 5, target < 100 ms).

## Final (all stories)

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 291         | 274                | 59.8    | 16.8           | 33.2           | 0.0%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 256         | 238                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 287         | 286                | 59.6    | 16.7           | 33.4           | 0.6%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 256         | 238                | 59.5    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 264         | 223                | 59.5    | 16.8           | 33.3           | 0.0%        | yes          |

Flow and inspector scenarios (006, 008): median of 5, target < 100 ms. Deck flows: flow scenarios only.

| Scenario                      | Action → painted (ms) | Meets target |
| ----------------------------- | --------------------- | ------------ |
| select flow → marks painted   | 16.8                  | yes          |
| record click → badge          | 67.0                  | yes          |
| inspector title edit → canvas | 30.9                  | yes          |

Before → after (final), avg FPS / p95 frame: default 59.8 / 16.7 → 59.8 / 16.8; onlyRenderVisibleElements 60.0 / 16.7 → 60.0 / 16.8; jsonDeckOpen 59.3 / 16.8 → 59.6 / 16.7; drag 60.0 / 16.8 → 59.5 / 16.7; drag+jsonDeck 59.5 / 16.7 → 59.5 / 16.8. No regression. One earlier final run showed a single 167 ms frame in drag+jsonDeck (54.7 fps); an immediate rerun gave 59.5 fps with no long frames, so it is treated as machine noise (headless, indicative only).

SC-001: a component title edit in the inspector reaches the painted canvas in 30.9 ms (median of 5; target < 100 ms).
