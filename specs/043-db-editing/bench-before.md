# Bench before (043 T002)

Run 2026-10-04 on an Apple M5 (macOS 26.1), headless Chromium, CPU throttle 1×, 500 nodes / 1000
edges, the first 150 nodes 12-column tables with relationships (`BENCH_TABLES=150 BENCH_REL=1`).
Taken on `main` at `a63f632`, from a clean checkout, before any 043 change. Indicative only: the
machine was running other work (unit tests, two agents) during the run, so frame numbers move by
several fps run to run.

```bash
BENCH_TABLES=150 BENCH_REL=1 pnpm bench
```

## Pan / zoom / drag

| Scenario                   | Render (ms) | FPS  | p95 (ms) | Long frames |
| -------------------------- | ----------- | ---- | -------- | ----------- |
| default                    | 311         | 50.0 | 33.3     | 3.8 %       |
| onlyRenderVisibleElements  | 237         | 49.3 | 16.8     | 2.4 %       |
| jsonDeckOpen               | 276         | 46.9 | 33.4     | 4.8 %       |
| drawer-open-pan            | 301         | 49.3 | 33.3     | 2.8 %       |
| selection-toolbar-pan      | 349         | 48.8 | 33.3     | 3.6 %       |
| drag                       | 302         | 34.3 | 66.8     | 23.0 %      |
| drag+jsonDeck              | 295         | 34.4 | 83.3     | 22.7 %      |
| drag-100-selected          | 319         | 31.5 | 100.1    | 18.2 %      |
| playing at 2×              | 312         | 53.8 | 16.8     | 2.2 %       |
| pan-during-layout (2 pans) | 264         | 23.5 | 133.4    | 32.5 %      |

## Actions (action → painted, median)

| Scenario                      | Target (ms) | Result (ms) |
| ----------------------------- | ----------- | ----------- |
| select 3 → toolbar painted    | 100         | 85.6        |
| select flow → marks painted   | 100         | 304.3       |
| open flow → flow mode painted | 100         | 284.8       |
| next step → current painted   | 100         | 323.3       |
| record click → badge          | 100         | 199.9       |
| hover → focus painted         | 16          | 15.4        |
| view-switch (System → Infra)  | 200         | 133.8       |
| tidy-layout-200 (median of 3) | 2000        | 374.2       |
| ⌘K type → results (2000/4000) | 50          | 59.6        |

## Scenarios that did not finish

- `inspector title edit → canvas` and `export-preview` failed as in 042's runs (known, not caused
  by this feature).
