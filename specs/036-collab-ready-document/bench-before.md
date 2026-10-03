# Bench before 036 (layout 1)

Measured on `main` code (`6e00ce2`), 2026-10-03, same machine as `bench-after.md`. Headless Chromium; indicative only.

## Model perf (`pnpm --filter @sododeck/model test perf`, median ms, 500 nodes / 1,000 edges)

```text
perf (median ms): {
  fromJSON: 4.87,
  toJSON: 3.82,
  'serializeDeck(toJSON)': 2.99,
  checkIntegrity: 0.5,
  rename: 0.58,
  move: 0.3,
  'rename last edge': 0.13,
  'move + snapshot': 0.44
}
```

## Storage (`pnpm --filter @sododeck/app test deck-persistence.perf`)

```text
✓ src/storage/deck-persistence.perf.test.ts > deck persistence performance > flushes an edit of the 500-node bench deck in under 75 ms 60ms
```

## Canvas (`pnpm bench`)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 469         | 450                | 53.6    | 16.8           | 150.1          | 2.2%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 356         | 338                | 54.6    | 16.8           | 150.0          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 387         | 344                | 54.3    | 16.8           | 116.7          | 1.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 429         | 383                | 53.7    | 16.8           | 150.0          | 1.9%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 128         | 0                  | 54.7    | 16.8           | 100.1          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 355         | 338                | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 381         | 340                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 354         | 338                | 51.9    | 33.3           | 50.1           | 2.3%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 338         | 320                | 55.4    | 16.8           | 100.0          | 2.5%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 130         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 19.5                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 165.9                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 97.1                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 137.5                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 76.3                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.7                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 80.6                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 241.3                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 42.9                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 72.5                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 207.8                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 160.0                 | 5000        | yes          |
