# Bench before (029)

Unchanged code, 2026-10-03. Second run with BENCH_ROUTES=1 BENCH_COLOURS=1 BENCH_GROUPS=1 (first run was a turbo cache hit, same tables).

| Scenario                                       | Nodes in DOM (fit / zoomed in) | Max zoom              | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ---------------------------------------------- | ------------------------------ | --------------------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                                        | 500 / 500 of 500               | 4.00                  | 413         | 393                | 53.7    | 16.8           | 150.0          | 1.9%        | no           |
| onlyRenderVisibleElements                      | 460 / 6 of 500                 | 4.00                  | 356         | 338                | 55.6    | 16.8           | 116.6          | 1.9%        | no           |
| jsonDeckOpen                                   | 500 / 500 of 500               | 4.00                  | 387         | 339                | 54.0    | 16.8           | 116.7          | 1.9%        | no           |
| drawer-open-pan                                | 500 / 500 of 500               | 4.00                  | 418         | 374                | 54.0    | 16.8           | 133.3          | 1.9%        | no           |
| selection-toolbar-pan                          | 500 / 500 of 500               | 4.00                  | 138         | 0                  | 53.7    | 16.8           | 133.3          | 1.9%        | no           |
| drag                                           | 500 / 500 of 500               | 0.30                  | 378         | 353                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck                                  | 500 / 500 of 500               | 0.30                  | 381         | 341                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag-100-selected                              | 500 / 500 of 500               | 0.30                  | 355         | 337                | 51.9    | 33.4           | 50.0           | 2.6%        | no           |
| playing at 2×                                  | 500 / 500 of 500               | 0.30                  | 355         | 337                | 56.5    | 16.8           | 99.9           | 2.2%        | no           |
| pan-during-layout (5 pans)                     | 500 / 500 of 500               | 0.40                  | 131         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| Scenario                                       | Nodes / edges                  | Action → painted (ms) | Target (ms) | Meets target       |
| ---                                            | ---                            | ---                   | ---         | ---                |
| select 3 → toolbar painted                     | 500 / 1000                     | 18.5                  | 100         | yes                |
| select flow → marks painted                    | 500 / 1000                     | 90.4                  | 100         | yes                |
| open flow → flow mode painted                  | 500 / 1000                     | 87.3                  | 100         | yes                |
| next step → current painted                    | 500 / 1000                     | 49.5                  | 100         | yes                |
| record click → badge                           | 500 / 1000                     | 78.9                  | 100         | yes                |
| inspector title edit → canvas                  | 500 / 1000                     | 30.9                  | 100         | yes                |
| view-switch (System → Infra)                   | 500 / 1000                     | 76.4                  | 200         | yes                |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400                      | 228.3                 | 2000        | yes                |
| ⌘K type → results                              | 2000 / 4000                    | 48.6                  | 50          | yes                |
| export: click → dialog painted                 | 500 / 1000                     | 55.7                  | 300         | yes                |
| export: PNG → preview painted                  | 500 / 1000                     | 213.7                 | 2000        | yes                |
| export: longest task while preparing           | 500 / 1000                     | 0.0                   | 50          | yes                |
| export: 2× PNG click → download                | 500 / 1000                     | 165.0                 | 5000        | yes                |
| Scenario                                       | Nodes in DOM (fit / zoomed in) | Max zoom              | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ---                                            | ---                            | ---                   | ---         | ---                | ---     | ---            | ---            | ---         | ---          |
| default                                        | 500 / 500 of 500               | 4.00                  | 138         | 0                  | 54.1    | 16.8           | 133.3          | 1.9%        | no           |
| onlyRenderVisibleElements                      | 460 / 6 of 500                 | 4.00                  | 135         | 0                  | 55.7    | 16.8           | 116.7          | 1.9%        | no           |
| jsonDeckOpen                                   | 500 / 500 of 500               | 4.00                  | 155         | 413                | 54.3    | 16.8           | 116.6          | 1.9%        | no           |
| resized-routed                                 | 500 / 500 of 500               | 4.00                  | 141         | 0                  | 54.1    | 16.7           | 133.3          | 1.9%        | no           |
| drawer-open-pan                                | 500 / 500 of 500               | 4.00                  | 162         | 385                | 54.6    | 16.8           | 116.7          | 1.9%        | no           |
| selection-toolbar-pan                          | 500 / 500 of 500               | 4.00                  | 132         | 0                  | 54.4    | 16.8           | 116.6          | 1.9%        | no           |
| groups-collapsed                               | 5 / 5 of 500                   | 4.00                  | 134         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag                                           | 500 / 500 of 500               | 0.30                  | 145         | 0                  | 59.3    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck                                  | 500 / 500 of 500               | 0.30                  | 151         | 411                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| drag-100-selected                              | 500 / 500 of 500               | 0.30                  | 132         | 0                  | 49.7    | 33.4           | 49.9           | 5.4%        | no           |
| group-drag                                     | 500 / 500 of 500               | 0.30                  | 135         | 0                  | 59.8    | 16.7           | 33.4           | 0.0%        | yes          |
| playing at 2×                                  | 500 / 500 of 500               | 0.30                  | 154         | 0                  | 57.2    | 16.8           | 66.7           | 1.7%        | yes          |
| pan-during-layout (5 pans)                     | 500 / 500 of 500               | 0.40                  | 130         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| Scenario                                       | Nodes / edges                  | Action → painted (ms) | Target (ms) | Meets target       |
| ---                                            | ---                            | ---                   | ---         | ---                |
| select 3 → toolbar painted                     | 500 / 1000                     | 18.2                  | 100         | yes                |
| select flow → marks painted                    | 500 / 1000                     | 85.5                  | 100         | yes                |
| open flow → flow mode painted                  | 500 / 1000                     | 94.8                  | 100         | yes                |
| next step → current painted                    | 500 / 1000                     | 60.6                  | 100         | yes                |
| record click → badge                           | 500 / 1000                     | 104.1                 | 100         | no                 |
| inspector title edit → canvas                  | 500 / 1000                     | 30.6                  | 100         | yes                |
| collapse-toggle                                | 500 / 1000                     | 29.8                  | 100         | yes                |
| focus                                          | 500 / 1000                     | 111.9                 | 100         | no                 |
| view-switch (System → Infra)                   | 500 / 1000                     | 83.0                  | 200         | yes                |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400                      | 232.0                 | 2000        | yes                |
| ⌘K type → results                              | 2000 / 4000                    | 37.1                  | 50          | yes                |
| export: click → dialog painted                 | 500 / 1000                     | 56.7                  | 300         | yes                |
| export: PNG → preview painted                  | 500 / 1000                     | 210.8                 | 2000        | yes                |
| export: longest task while preparing           | 500 / 1000                     | 0.0                   | 50          | yes                |
| export: 2× PNG click → download                | 500 / 1000                     | 160.0                 | 5000        | yes                |

scene.perf: passes (1 test).
