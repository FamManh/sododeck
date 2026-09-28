# Bench after 019 card quick edit

Ran on 2026-09-28 on the 019 branch via `pnpm bench` (the same laptop as [bench-before.md](bench-before.md)). Headless Chromium; indicative only.

## Summary

- **SC-004:** the toolbar is painted **19.1 ms** after three components are selected (target ≤ 100 ms).
- **SC-007:** `selection-toolbar-pan` (pan and zoom with three selected components and their toolbar) runs at **52.1 fps**, p95 16.8 ms. That is level with `default` (53.1 fps). The miss comes from the same single long frames that `default`, `jsonDeckOpen` and `drawer-open-pan` had before this change (baseline 53.8 fps). The toolbar is hidden during the gesture, so pan and zoom do no toolbar work.
- **No scenario regressed** beyond run-to-run noise: default 53.8 → 53.1 fps, onlyRenderVisibleElements 57.6 → 57.3, drag 58.6 → 59.1.
- **Action scenarios:**
  - "select flow → marks painted" is 74.6 → 88.6 ms (target 100). "Record click" is 71.5 → 79.7 ms.
  - Both re-render every card; each card now also renders its details button.
  - A first run with a Radix Tooltip per card measured 125 ms and 104 ms. The button now uses a native `title` tooltip instead (see `details-button.tsx`).
  - "Open flow → flow mode painted" was already over its target before 019 (127.9 → 129.0 ms).

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 362         | 343                | 53.1    | 16.8           | 216.6          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 321         | 304                | 57.3    | 16.8           | 83.3           | 1.9%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 366         | 323                | 53.0    | 16.8           | 200.1          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 402         | 357                | 52.8    | 16.8           | 200.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 119         | 0                  | 52.1    | 16.8           | 250.0          | 2.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 321         | 303                | 59.1    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 350         | 349                | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 321         | 304                | 55.6    | 16.8           | 100.0          | 2.5%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 118         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 19.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 88.6                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 129.0                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 47.5                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 79.7                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.5                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 69.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 40.8                  | 50          | yes          |
