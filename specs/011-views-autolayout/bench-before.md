# Bench baseline before 011 canvas changes

Ran on 2026-09-28 at `dd6d319` (schema and model changes only; the canvas is unchanged) via:

```bash
pnpm bench
BENCH_GROUPS=1 pnpm bench
```

Headless Chromium on the development laptop; indicative only. The new 011 scenarios (`view-switch`, `tidy-layout-200`, `pan-during-layout`) did not exist yet.

## `pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 362         | 344                | 53.9    | 16.8           | 183.3          | 2.5%        | no           |
| onlyRenderVisibleElements | 460 / 25 of 500                | 2.00     | 304         | 286                | 57.5    | 16.7           | 83.4           | 1.3%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 337         | 294                | 53.4    | 16.8           | 183.4          | 2.8%        | no           |
| drag                      | 500 / 500 of 500               | 0.30     | 305         | 287                | 58.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 330         | 290                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 322         | 303                | 58.0    | 16.8           | 50.1           | 0.7%        | yes          |

Action scenarios (006, 007, 008, 009): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 78.7                  | 100         | yes          |
| open flow → flow mode painted | 500 / 1000    | 73.1                  | 100         | yes          |
| next step → current painted   | 500 / 1000    | 46.8                  | 100         | yes          |
| record click → badge          | 500 / 1000    | 66.4                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 31.8                  | 100         | yes          |
| ⌘K type → results             | 2000 / 4000   | 35.2                  | 50          | yes          |

## `BENCH_GROUPS=1 pnpm bench`

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 133         | 0                  | 53.4    | 16.8           | 200.1          | 2.5%        | no           |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 121         | 0                  | 57.7    | 16.8           | 83.4           | 1.2%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 145         | 379                | 52.8    | 16.8           | 216.7          | 2.5%        | no           |
| groups-collapsed          | 5 / 5 of 500                   | 2.00     | 141         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 140         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 147         | 332                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| playing at 2×             | 500 / 500 of 500               | 0.30     | 130         | 0                  | 56.5    | 16.8           | 100.0          | 2.2%        | no           |

Action scenarios (006, 007, 008, 009): median of 5. Deck flows: flow scenarios only.

| Scenario                      | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ----------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted   | 500 / 1000    | 94.8                  | 100         | yes          |
| open flow → flow mode painted | 500 / 1000    | 86.8                  | 100         | yes          |
| next step → current painted   | 500 / 1000    | 147.3                 | 100         | no           |
| record click → badge          | 500 / 1000    | 73.8                  | 100         | yes          |
| inspector title edit → canvas | 500 / 1000    | 31.5                  | 100         | yes          |
| collapse-toggle               | 500 / 1000    | 31.2                  | 100         | yes          |
| focus                         | 500 / 1000    | 103.5                 | 100         | no           |
| ⌘K type → results             | 2000 / 4000   | 34.2                  | 50          | yes          |
