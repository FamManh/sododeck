# Bench baseline before 015

Ran on 2026-09-28 at `a8f66d0` (before any 015 code) via `pnpm bench`. Headless Chromium on the development laptop; indicative only.

## Frame scenarios

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 363         | 344                | 53.6    | 16.8           | 183.4          | 2.5%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 322         | 304                | 57.5    | 16.8           | 66.7           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 361         | 311                | 53.5    | 16.8           | 183.3          | 2.7%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 325         | 308                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 347         | 345                | 59.7    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 338         | 321                | 57.2    | 16.8           | 66.7           | 1.8%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 127         | 0                  | 59.0    | 16.8           | 33.4           | 1.7%        | yes          |

## Action scenarios

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 85.8                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 74.3                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 109.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 66.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 72.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 223.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 34.8                  | 50          | yes          |
