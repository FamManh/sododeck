# Canvas benchmark — 2026-10-05T06:54:52.195Z

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. Shapes: false. Tables: 0. Relationships: false. Wide: false. Schemas: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 189         | 0                  | 56.6    | 16.8           | 100.0          | 1.2%        | no           |
| onlyRenderVisibleElements  | 460 / 10 of 500                | 4.00     | 158         | 0                  | 56.6    | 16.8           | 116.7          | 1.3%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 190         | 403                | 56.1    | 16.8           | 83.4           | 1.8%        | no           |
| tables-150-wide            | 150 / 150 of 150               | 4.00     | 197         | 0                  | 57.0    | 16.8           | 150.0          | 1.5%        | yes          |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 183         | 430                | 55.8    | 16.8           | 100.0          | 1.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 56.5    | 16.8           | 100.0          | 1.5%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 155         | 0                  | 59.2    | 16.8           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 165         | 400                | 58.5    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 162         | 0                  | 58.4    | 16.8           | 33.4           | 0.7%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 159         | 0                  | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
| pan-during-layout (2 pans) | 500 / 500 of 500               | 0.40     | 163         | 0                  | 39.2    | 50.0           | 149.9          | 10.2%       | no           |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 27.9                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 148.9                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 121.7                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 130.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 95.2                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 34.9                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 20.2                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 100.9                 | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 244.8                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 64.7                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 61.3                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 228.0                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 256.0                 | 5000        | yes          |

## 055 comparison

Machine: same laptop, headless Chromium, indicative only; run-to-run noise is about ±3 FPS on pan scenarios.

- **Before** (`bench-before.md`, code at the 055 spec commit) and **after** (this file, final code) match for a deck without images: `drag` 58.5 → 59.2 FPS, `drag+jsonDeck` 59.3 → 58.5, `drag-100-selected` 50.5 → 58.4, `default` 56.3 → 56.6, `playing at 2×` 59.8 → 59.6. The action table is within noise (for example `select 3 → toolbar` 28.6 → 27.9 ms, `export: 2× PNG` 260 → 253 ms).
- **A regression was found and fixed during this run.** The first after-run showed `drag` at 47.6 to 49 FPS with 5 to 10 % long frames (before: 57.5 to 59 FPS). A bisect (`drag` only, two runs per commit) put it at `f8d17788`: `useAddImages()` was a dependency of the canvas handlers' `useMemo`, so the handlers were rebuilt whenever a toast or viewport helper changed. The handlers now read it through a ref updated in an effect (`fix(app): keep canvas handlers stable while dragging…`). Result above.
- **50 images** (`BENCH_IMAGES=50 BENCH_GROUPS=1`, 500 cards / 1,000 connectors, a third of the images in groups, a quarter connected): `default` pan / zoom 56.3 FPS (p95 16.7 ms), `jsonDeckOpen` 55.8 FPS, `drag` 58.5 FPS, `group-drag` 60.0 FPS. The same deck with `BENCH_IMAGES=0`: `default` 43.3 (a noisy first run; 56.6 on rerun), `drag` 57.8, `group-drag` 55.2. No regression from 50 pictures. Pictures are served from memory (`memoryPictureStore`) and are 1 × 1 PNGs, so decode cost is minimal; a deck of large photos is not measured.
