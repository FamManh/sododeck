# Bench baseline before canvas changes

Ran on 2026-09-28 via:

```bash
pnpm bench
BENCH_GROUPS=1 pnpm bench
```

## `pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 274         | 255                | 59.3    | 16.7           | 83.2           | 0.3%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 272         | 255                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 288         | 242                | 59.3    | 16.7           | 83.3           | 0.3%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 271         | 254                | 58.6    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 286         | 241                | 58.9    | 16.8           | 33.4           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 257         | 238                | 57.4    | 16.7           | 233.4          | 0.4%        | yes          |

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 108.4                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 97.6                  | 100         | yes          |
| next step → current painted   | 500 / 1000    | 96.4                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 75.6                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 30.3                  | 100         | yes          |
| ⌘K type → results             | 2000 / 4000   | 37.1                  | 50          | yes          |

## `BENCH_GROUPS=1 pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 315         | 295                | 59.1    | 16.8           | 83.4           | 0.3%        | yes          |
| onlyRenderVisibleElements | 460 / 16 of 500                | 2.00     | 255         | 238                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 297         | 295                | 59.3    | 16.8           | 83.3           | 0.3%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 273         | 255                | 59.7    | 16.8           | 33.4           | 0.6%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 295         | 290                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 289         | 272                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 100.3                 | 100         | no           |
| open flow → flow mode painted | 500 / 1000    | 191.3                 | 100         | no           |
| next step → current painted   | 500 / 1000    | 299.2                 | 100         | no           |
| record click → badge          | 500 / 1000    | 76.9                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 31.3                  | 100         | yes          |
| ⌘K type → results             | 2000 / 4000   | 35.0                  | 50          | yes          |

Notes:

- The new 010-specific `groups-collapsed`, `collapse-toggle`, and `focus` scenarios are scaffolded
  but intentionally log `TODO(010)` until the feature lands.
