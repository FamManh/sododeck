# Bench after 051

`pnpm bench` on the branch with every story in (US1–US8), machine otherwise idle. Headless Chromium, indicative only.

## Comparison with `bench-before.md` (5 % budget on pan / zoom fps)

| Scenario                                    | Before (avg fps) | Before, re-run | After (avg fps)            |
| ------------------------------------------- | ---------------- | -------------- | -------------------------- |
| default                                     | 54.4             | 54.2           | 56.1                       |
| onlyRenderVisibleElements                   | 54.2             | 55.1           | 56.7                       |
| jsonDeckOpen                                | 53.2             | 54.1           | 55.0                       |
| drawer-open-pan                             | 54.2             | 53.7           | 55.5                       |
| selection-toolbar-pan                       | 54.3             | 54.2           | 56.3                       |
| drag                                        | 59.2             | 58.9           | 59.2                       |
| drag-100-selected                           | 59.2             | 50.1           | 59.2                       |
| pan-during-layout                           | 57.1             | 57.6           | 58.3                       |
| hover → focus painted (ms, lower is better) | 17.9             | 24.6           | 21.3 (18.3–18.7 run alone) |

No pan / zoom regression: the R4 fallback (hide chips at System) was not needed. The hover
scenario now turns Focus mode on with nothing selected first (051 R1); its spread between runs
of the unchanged code (17.9–24.6 ms) is wider than the difference.

## Full report

# Canvas benchmark — 2026-10-04T11:56:54.555Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 181         | 0                  | 56.1    | 16.8           | 100.1          | 1.6%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 157         | 0                  | 56.7    | 16.8           | 116.7          | 1.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 207         | 438                | 55.0    | 16.8           | 100.0          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 186         | 434                | 55.5    | 16.8           | 100.1          | 1.9%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 56.3    | 16.8           | 83.3           | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 153         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 168         | 433                | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 161         | 0                  | 59.2    | 16.8           | 33.4           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 155         | 0                  | 57.6    | 16.8           | 116.6          | 0.7%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 157         | 0                  | 58.3    | 16.8           | 33.4           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 125.8                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 150.1                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 57.9                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 84.8                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.6                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 21.3                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 95.5                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 263.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 54.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 66.6                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 233.1                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 254.0                 | 5000        | yes          |
