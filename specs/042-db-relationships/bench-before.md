# Bench before (042 T003)

Run 2026-10-04 on an Apple M5 (32 GB, macOS 26.1), headless Chromium, CPU throttle 1×, 500 nodes /
1000 edges, the first 150 nodes 12-column tables (041). Taken before any drawing change:
**relationships draw as plain connectors at this point**. With `rel`, the 207 table-to-table edges
all carry FK → PK column ends, `n-1`, from side optional; 5 are self-references and 5 a second FK
between the same pair of tables. Indicative only: the machine was shared with other work and
frame numbers move by several fps run to run.

```bash
BENCH_TABLES=150 pnpm bench               # tables
BENCH_TABLES=150 BENCH_REL=1 pnpm bench   # tables + relationships with column ends
```

## Pan / zoom / drag

| Scenario                   | Tables: render (ms) | FPS  | p95 (ms) | Long frames | + rel: render (ms) | FPS  | p95 (ms) | Long frames |
| -------------------------- | ------------------- | ---- | -------- | ----------- | ------------------ | ---- | -------- | ----------- |
| default                    | 249                 | 49.9 | 33.3     | 3.2 %       | 215                | 42.2 | 66.6     | 14.1 %      |
| onlyRenderVisibleElements  | 187                 | 52.2 | 16.8     | 2.2 %       | 198                | 52.4 | 16.8     | 1.9 %       |
| jsonDeckOpen               | 249                 | 51.6 | 16.8     | 3.1 %       | 244                | 51.9 | 16.8     | 2.3 %       |
| drawer-open-pan            | 248                 | 51.2 | 16.8     | 2.5 %       | 220                | 43.8 | 50.1     | 12.6 %      |
| selection-toolbar-pan      | 213                 | 42.6 | 50.1     | 12.3 %      | 188                | 50.8 | 33.3     | 3.3 %       |
| drag                       | 198                 | 41.0 | 50.0     | 17.6 %      | 182                | 45.0 | 50.0     | 11.3 %      |
| drag+jsonDeck              | 192                 | 41.3 | 50.0     | 19.1 %      | 201                | 45.5 | 50.0     | 9.8 %       |
| drag-100-selected          | 186                 | 47.6 | 49.9     | 8.0 %       | 186                | 40.9 | 50.1     | 21.5 %      |
| playing at 2×              | 204                 | 58.4 | 16.8     | 0.7 %       | 230                | 57.6 | 16.8     | 1.1 %       |
| pan-during-layout (3 pans) | 185                 | 26.4 | 233.3    | 9.1 %       | 231                | 31.8 | 266.7    | 5.7 %       |

## Actions (action → painted, median)

| Scenario                      | Target (ms) | Tables (ms) | + rel (ms) |
| ----------------------------- | ----------- | ----------- | ---------- |
| select 3 → toolbar painted    | 100         | 54.7        | 47.8       |
| select flow → marks painted   | 100         | 165.8       | 167.8      |
| open flow → flow mode painted | 100         | 177.1       | 184.7      |
| next step → current painted   | 100         | 264.5       | 185.4      |
| record click → badge          | 100         | 112.1       | timed out  |
| hover → focus painted         | 16          | 25.8        | 19.3       |
| view-switch (System → Infra)  | 200         | 99.5        | 97.3       |
| tidy-layout-200 (median of 3) | 2000        | 294.5       | 275.5      |
| ⌘K type → results (2000/4000) | 50          | 63.0        | 53.5       |

## Scenarios that did not finish

- `inspector title edit → canvas` timed out (180 s) in both runs, and `export-preview` timed out
  waiting for the download (30 s) in both runs. Both fail with tables on, with or without `rel`,
  so they are not caused by relationships.
- `record click → badge` timed out (180 s) in the `rel` run only; it finished in the tables run.
  Unclear whether this is a self-reference / second-FK effect or a flaky run; re-check in
  `bench-after.md`.
