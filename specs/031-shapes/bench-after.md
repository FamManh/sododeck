# Bench after 031 (headless Chromium, same machine as `bench-before.md`)

Compare `pnpm bench` with the first table of `bench-before.md`. `BENCH_SHAPES=1` turns every third of the 500 nodes into a shape (the eleven geometries round-robin, 167 shapes); it has no "before" (the option is new), so compare it with the default runs.

## `pnpm bench`

### Canvas benchmark — 2026-10-03T16:47:21.619Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 211         | 0                  | 52.0    | 16.8           | 166.6          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 168         | 0                  | 53.4    | 16.8           | 166.7          | 2.8%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 197         | 504                | 51.7    | 16.8           | 150.0          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 197         | 496                | 51.0    | 16.8           | 183.3          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 185         | 0                  | 50.0    | 16.8           | 216.7          | 2.3%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 192         | 0                  | 56.0    | 33.3           | 50.0           | 2.2%        | no           |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 206         | 512                | 55.1    | 33.3           | 83.3           | 1.2%        | no           |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 286         | 0                  | 44.9    | 50.1           | 116.7          | 12.9%       | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 191         | 0                  | 59.4    | 16.8           | 33.4           | 0.3%        | yes          |
| pan-during-layout (8 pans) | 500 / 500 of 500               | 0.40     | 209         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 25.9                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 202.7                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 152.9                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 142.6                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 130.8                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 37.5                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 135.1                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 416.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 64.2                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 66.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 259.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 302.0                 | 5000        | yes          |

## `pnpm bench`, second run

The first run's drag scenarios (56.0 / 44.9 fps) were below both baseline runs; a second run on the same code is back at the baseline (58.5 / 59.4 fps). Run-to-run variation on this machine: the baseline's two runs already differed by 9 fps on drag-100-selected.

### Canvas benchmark — 2026-10-03T16:55:59.071Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 146         | 0                  | 53.3    | 16.8           | 133.3          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 150         | 0                  | 54.4    | 16.8           | 133.3          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 186         | 428                | 52.3    | 16.8           | 133.4          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 168         | 411                | 52.1    | 16.8           | 150.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 147         | 0                  | 53.1    | 16.8           | 133.4          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 137         | 0                  | 58.5    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 173         | 443                | 59.2    | 16.7           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 143         | 0                  | 59.4    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 141         | 0                  | 58.6    | 16.8           | 100.1          | 0.3%        | yes          |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 148         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.5                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 142.6                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 140.6                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 97.1                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 95.4                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 32.2                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.3                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 88.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 282.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 58.6                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 55.2                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 282.0                 | 5000        | yes          |

## `BENCH_SHAPES=1 pnpm bench`

"Nodes in DOM" counted only cards in this run (333 = the 500 minus the 167 shapes); the counter now counts shapes too.

### Canvas benchmark — 2026-10-03T16:54:13.564Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: true. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 333 / 333 of 500               | 4.00     | 243         | 0                  | 50.2    | 16.8           | 183.3          | 3.0%        | no           |
| onlyRenderVisibleElements  | 307 / 6 of 500                 | 4.00     | 244         | 0                  | 53.7    | 16.8           | 166.7          | 2.1%        | no           |
| jsonDeckOpen               | 333 / 333 of 500               | 4.00     | 213         | 458                | 50.5    | 33.3           | 166.7          | 3.8%        | no           |
| drawer-open-pan            | 333 / 333 of 500               | 4.00     | 183         | 435                | 51.3    | 16.8           | 133.4          | 3.6%        | no           |
| selection-toolbar-pan      | 333 / 333 of 500               | 4.00     | 157         | 0                  | 51.9    | 16.8           | 133.3          | 3.0%        | no           |
| drag                       | 333 / 333 of 500               | 0.30     | 143         | 0                  | 59.7    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 333 / 333 of 500               | 0.30     | 186         | 531                | 59.4    | 16.8           | 33.5           | 0.5%        | yes          |
| drag-100-selected          | 333 / 333 of 500               | 0.30     | 146         | 0                  | 59.7    | 16.8           | 33.4           | 0.0%        | yes          |
| playing at 2×              | 333 / 333 of 500               | 0.30     | 185         | 0                  | 56.8    | 16.8           | 133.4          | 0.7%        | no           |
| pan-during-layout (5 pans) | 333 / 333 of 500               | 0.40     | 154         | 0                  | 60.0    | 16.7           | 16.7           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.2                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 140.5                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 124.8                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 86.8                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 118.8                 | 100         | no           |
| inspector title edit → canvas                  | 500 / 1000    | 33.4                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 22.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 92.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 275.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 54.7                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 61.9                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 232.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 286.0                 | 5000        | yes          |

## scene.perf (unit)

`pnpm --filter @sododeck/app exec vitest run scene.perf`: 1 test passed (1).
