# Bench after 032 (headless Chromium, same machine as bench-before.md)

All three runs pass (24/24). Pan and drag are within run-to-run variation of bench-before.md with and without typed fields:

| Scenario                             | before (`pnpm bench`) | after (`pnpm bench`) | after (`BENCH_FIELDS=1`) |
| ------------------------------------ | --------------------- | -------------------- | ------------------------ |
| default pan, avg FPS / max frame     | 53.2 / 150 ms         | 53.3 / 150 ms        | 52.3 / 167 ms            |
| drawer-open-pan, avg FPS / max frame | 50.5 / 233 ms         | 52.3 / 150 ms        | 52.5 / 150 ms            |
| drag, avg FPS                        | 58.5                  | 59.3                 | 59.3                     |

Notes:

- Initial render is about 30–60 ms slower on the fields deck (more DOM per card); export preparation has one 58 ms task on it (target 50, plain deck 0).
- The first `BENCH_FIELDS=1` runs showed 1-second frames and a hung view-switch. Both were the harness, not the app: the fields deck now has a Client every 10th card (the Infra view dims clients), a 200 × 150 grid (taller cards no longer pile up, and the deck still fits one PNG canvas), and `emptyCanvasPoint` now pauses frame recording during its search and avoids connectors (a drag starting on a connector re-routes it instead of panning).
- `fieldBlock` is memoised per field view and width (hit tests size every card per pointer move). Search indexes built-in values directly for cards without typed values: the cold 2,000-card index is 54–55 ms (57 ms before 032, budget 100).

## `pnpm bench`

### Canvas benchmark — 2026-10-03T17:28:00.638Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 179         | 0                  | 53.3    | 16.8           | 150.0          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 140         | 0                  | 55.2    | 16.8           | 133.4          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 183         | 412                | 52.3    | 16.8           | 133.4          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 173         | 420                | 52.3    | 16.8           | 150.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 147         | 0                  | 53.4    | 16.8           | 133.4          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 146         | 0                  | 59.3    | 16.7           | 33.4           | 1.3%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 172         | 433                | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 140         | 0                  | 58.6    | 16.8           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 154         | 0                  | 58.4    | 16.7           | 116.6          | 1.0%        | yes          |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 141         | 0                  | 57.9    | 16.8           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 113.1                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 106.1                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 94.5                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 85.6                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 29.8                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 19.5                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 84.8                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 224.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 49.5                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 77.0                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 233.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 236.0                 | 5000        | yes          |

## `BENCH_TYPES=1 pnpm bench`

### Canvas benchmark — 2026-10-03T17:29:20.213Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 145         | 0                  | 52.9    | 16.8           | 149.9          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 149         | 0                  | 54.4    | 16.8           | 133.2          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 153         | 394                | 52.5    | 16.8           | 150.0          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 168         | 412                | 51.0    | 16.8           | 183.3          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 148         | 0                  | 53.1    | 16.8           | 133.3          | 1.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 141         | 0                  | 59.3    | 16.8           | 49.9           | 0.6%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 176         | 391                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 148         | 0                  | 58.2    | 16.8           | 33.4           | 0.7%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 139         | 0                  | 57.4    | 16.8           | 100.0          | 0.7%        | yes          |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 136         | 0                  | 57.7    | 16.8           | 33.3           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 23.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 102.4                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 106.5                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 46.0                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 94.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.4                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 24.6                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 79.9                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 237.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 48.2                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 77.8                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 230.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 236.0                 | 5000        | yes          |

## `BENCH_FIELDS=1 pnpm bench`

### Canvas benchmark — 2026-10-03T17:30:53.512Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 201         | 0                  | 52.3    | 16.8           | 166.6          | 2.1%        | no           |
| onlyRenderVisibleElements  | 500 / 6 of 500                 | 4.00     | 198         | 0                  | 53.6    | 16.8           | 116.7          | 2.5%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 214         | 477                | 52.2    | 16.8           | 183.3          | 2.4%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 230         | 513                | 52.5    | 16.8           | 150.0          | 2.4%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 208         | 0                  | 51.5    | 16.8           | 183.4          | 2.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 198         | 0                  | 59.3    | 16.7           | 33.2           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 206         | 473                | 59.3    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 195         | 0                  | 47.0    | 33.4           | 50.1           | 6.6%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 200         | 0                  | 59.6    | 16.8           | 33.4           | 0.0%        | yes          |
| pan-during-layout (3 pans) | 500 / 500 of 500               | 0.40     | 198         | 0                  | 55.7    | 33.2           | 50.0           | 1.9%        | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.6                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 119.2                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 117.7                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 79.5                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 98.9                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.7                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 22.9                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 92.3                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 234.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 52.9                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 84.0                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 281.3                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 58.0                  | 50          | no           |
| export: 2× PNG click → download                | 500 / 1000    | 296.0                 | 5000        | yes          |

## scene.perf

Passed.
