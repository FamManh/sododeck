# Bench before 006 (baseline on `main`, 713b86b)

Run: `pnpm bench` on 2026-09-27, 1× CPU, headless Chromium, same machine as bench-after.md. Indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 329         | 312                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 255         | 238                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 262         | 260                | 59.8    | 16.7           | 33.3           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 239         | 220                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 265         | 257                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
