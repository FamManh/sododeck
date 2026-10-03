<!-- After 034, same machine and method as bench-before.md (Apple M5, headless Chromium, one run each). -->

# 034 bench: before and after

| Measure                             | Before             | After              | Note                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hover → focus painted (500 / 1,000) | n/a (new)          | 17.3 ms            | Target 16 ms (SC-001): one frame at 60 Hz. `HoverFocusStyle` writes its stylesheet from a store subscription with no React render and no fade. The first attempt, with React state and a `--sd-dur-dim` fade, measured 102 ms (style recalculation of 1,500 starting transitions). Misses the target by 1.3 ms, less than one frame of granularity |
| pan, default                        | 53.6 fps, p95 16.8 | 52.8 fps, p95 16.8 | Within run-to-run variation                                                                                                                                                                                                                                                                                                                        |
| pan, drawer open                    | 53.1 fps           | 51.9 fps           | Within variation                                                                                                                                                                                                                                                                                                                                   |
| drag                                | 59.2 fps           | 58.9 fps           | Within variation                                                                                                                                                                                                                                                                                                                                   |
| drag, 100 selected                  | 50.3 fps           | 50.1 fps           | Within variation                                                                                                                                                                                                                                                                                                                                   |
| playing at 2×                       | 58.8 fps           | 57.4 fps           | Within variation                                                                                                                                                                                                                                                                                                                                   |
| select 3 → toolbar painted          | 24.7 ms            | 24.0 ms            |                                                                                                                                                                                                                                                                                                                                                    |
| view-switch                         | 89.1 ms            | 95.3 ms            | Target 200                                                                                                                                                                                                                                                                                                                                         |
| tidy-layout-200                     | 260.5 ms           | 265.6 ms           |                                                                                                                                                                                                                                                                                                                                                    |

A first "after" run of the full bench (before the hover work was moved off React) showed pan at 46 fps with p95 66.7 ms; a second run with identical pan code returned to 52.8 fps, so that was machine noise, not a regression. Pan has no 034 code on its path; the only per-frame change is the inline `stroke` / `stroke-width` reading a CSS variable.

The pinned-focus ("focus") bench scenario only runs with `GROUPS=1` and was not part of the baseline either.

## Full report (after)

# Canvas benchmark — 2026-10-03T14:25:57.519Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 170         | 0                  | 52.8    | 16.8           | 150.1          | 1.8%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 147         | 0                  | 53.9    | 16.8           | 133.3          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 159         | 394                | 52.4    | 16.8           | 150.1          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 170         | 469                | 51.9    | 16.8           | 183.2          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 148         | 0                  | 52.3    | 16.8           | 150.0          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 145         | 0                  | 58.9    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 162         | 414                | 58.5    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 150         | 0                  | 50.1    | 33.4           | 50.1           | 5.0%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 152         | 0                  | 57.4    | 16.8           | 133.3          | 0.7%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 147         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 95.3                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 97.6                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 93.3                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 86.8                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 17.3                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 95.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 265.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 51.5                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 82.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 235.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 264.0                 | 5000        | yes          |
