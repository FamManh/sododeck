# Bench after (016)

This branch (all 016 tasks), same machine and settings as [bench-before.md](bench-before.md): headless Chromium, CPU throttle 1×; indicative only. Run on 2026-09-29.

## Summary

- **Pan / zoom and single drag:** unchanged within noise (`drag` 59.6 fps before and after; `default` 53.1 → 52.7–53.0).
- **`group-drag` (new):** 59.6–59.8 fps over three runs: meets the target (FR-038).
- **`drag-100-selected`:** below 60 fps both **before and after** 016. Three runs each on the same machine: unchanged code 50.2 / 55.1 / 54.9 fps (median 54.9), this branch 54.7 / 53.7 / 55.2 (median 54.7); one full `BENCH_GROUPS=1` run reached 59.8. So 016 adds no measurable cost (snapping, drop targets and guides included; turning the per-frame guide updates off gave 53.6, the same), but SC-006's 60 fps for 100 selected cards is **not met**: the cost is writing 100 positions to the document every frame, which predates 016. Reducing the snap candidates (T058) would not help, since snapping is not the cost.

## `pnpm bench`

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 360         | 340                | 52.7    | 16.8           | 216.7          | 3.1%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 340         | 322                | 56.9    | 16.8           | 83.3           | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 365         | 322                | 52.9    | 16.8           | 200.0          | 3.1%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 392         | 348                | 52.7    | 16.8           | 216.8          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 127         | 0                  | 52.6    | 16.8           | 200.0          | 2.7%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 339         | 320                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 360         | 359                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 356         | 339                | 53.6    | 33.4           | 33.4           | 3.2%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 322         | 303                | 56.2    | 16.8           | 116.6          | 2.5%        | no           |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 122         | 0                  | 59.0    | 16.8           | 33.5           | 1.7%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 20.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 144.0                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 143.4                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 125.6                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 78.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.7                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 72.5                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 232.9                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 48.9                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 55.2                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 217.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 156.0                 | 5000        | yes          |

## `BENCH_GROUPS=1 pnpm bench`

`group-drag` logged `TODO(016)` in this run: the bench looked for `[role="button"]` on the label, which is a plain `<button>`. Fixed to `button.sd-group-handle`; its numbers are in the next table.

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: true. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 130         | 0                  | 53.0    | 16.8           | 216.6          | 2.7%        | no           |
| onlyRenderVisibleElements  | 460 / 20 of 500                | 2.00     | 143         | 0                  | 57.2    | 16.8           | 83.4           | 1.6%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 145         | 377                | 52.2    | 16.8           | 216.6          | 2.7%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 155         | 363                | 52.9    | 16.8           | 216.7          | 2.7%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 131         | 0                  | 53.2    | 16.8           | 233.3          | 2.4%        | no           |
| groups-collapsed           | 5 / 5 of 500                   | 2.00     | 127         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag                       | 500 / 500 of 500               | 0.30     | 138         | 0                  | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 146         | 378                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 128         | 0                  | 59.8    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 140         | 0                  | 57.4    | 16.8           | 83.3           | 1.7%        | yes          |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 123         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 19.1                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 91.4                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 83.7                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 159.3                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 89.3                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.2                  | 100         | yes          |
| collapse-toggle                                | 500 / 1000    | 28.0                  | 100         | yes          |
| focus                                          | 500 / 1000    | 95.0                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 76.2                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 275.5                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 38.5                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 49.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 214.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 151.0                 | 5000        | yes          |

## Drag scenarios after the bench fix (`BENCH_GROUPS=1`, `-g drag`, two runs)

| Scenario          | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ----------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| drag              | 500 / 500 of 500               | 0.30     | 161         | 0                  | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck     | 500 / 500 of 500               | 0.30     | 146         | 344                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected | 500 / 500 of 500               | 0.30     | 124         | 0                  | 52.4    | 33.4           | 33.4           | 3.2%        | no           |
| group-drag        | 500 / 500 of 500               | 0.30     | 129         | 0                  | 59.8    | 16.7           | 33.3           | 0.0%        | yes          |
| drag              | 500 / 500 of 500               | 0.30     | 135         | 0                  | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck     | 500 / 500 of 500               | 0.30     | 141         | 338                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected | 500 / 500 of 500               | 0.30     | 138         | 0                  | 51.6    | 33.4           | 33.4           | 2.9%        | no           |
| group-drag        | 500 / 500 of 500               | 0.30     | 132         | 0                  | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
