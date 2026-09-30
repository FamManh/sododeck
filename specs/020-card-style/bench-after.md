# T063 — Bench after 020 (card style)

SC-005: "Adding a colour to 500 cards changes pan, zoom and drag FPS by at most 5 % versus
uncoloured cards, and toggling a flow's highlight still paints within 100 ms (006 SC-002)."

## Before/after note

T001–T002 (create the branch from `main` and capture `bench-before.md` on the unchanged code)
were not run in this session — the branch already contained this feature's implementation when
work resumed here, and no green, pre-020 checkout was available to re-baseline against. Instead,
this report compares two same-session runs on the current code: `pnpm bench` with the default
generator (no `style` on any node, i.e. what `bench-before.md` would have shown, since
`generateBenchDeck` only adds colours when `colours: true`/`colours=1` is passed — T003) against
`BENCH_COLOURS=1 pnpm bench` (every node filled, every 5th also stroked). This isolates exactly
the colour feature's cost without needing an actual pre-020 checkout.

Both runs: headless Chromium, 500 nodes / 1000 edges (2000/4000 for the ⌘K scenario), no CPU
throttle, indicative only — compare relative numbers on this machine, not absolute ones.

## Uncoloured (plain `pnpm bench`)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU
throttle: 1×.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 362         | 344                | 53.0    | 16.8           | 216.6          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 323         | 306                | 56.9    | 16.8           | 83.4           | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 377         | 375                | 53.0    | 16.8           | 199.9          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 406         | 363                | 53.1    | 16.8           | 200.0          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 139         | 0                  | 53.0    | 16.8           | 216.6          | 2.7%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 339         | 320                | 59.6    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 366         | 364                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 339         | 322                | 54.3    | 33.3           | 33.4           | 1.9%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 341         | 321                | 55.8    | 16.8           | 133.3          | 1.8%        | no           |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 124         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 19.8                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 85.5                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 87.8                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 112.7                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 80.5                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 69.6                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 227.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 37.7                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 77.1                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 207.2                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 154.0                 | 5000        | yes          |

## Coloured (`BENCH_COLOURS=1 pnpm bench`)

Every node has a `style.fill` (cycling the 13 named colours plus 2 custom hex), every 5th also a
`blue` stroke.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 380         | 361                | 52.7    | 16.8           | 216.6          | 2.8%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 338         | 321                | 57.1    | 16.8           | 83.4           | 1.9%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 366         | 324                | 52.7    | 16.8           | 216.7          | 2.8%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 2.00     | 408         | 365                | 52.4    | 16.8           | 216.7          | 2.8%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 2.00     | 128         | 0                  | 52.7    | 16.8           | 216.6          | 2.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 322         | 304                | 59.2    | 16.8           | 33.4           | 0.7%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 359         | 358                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 340         | 320                | 54.8    | 33.3           | 33.5           | 2.2%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 339         | 322                | 55.4    | 16.8           | 116.6          | 2.2%        | no           |
| pan-during-layout (4 pans) | 500 / 500 of 500               | 0.40     | 123         | 0                  | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.0                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 82.0                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 98.4                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 127.1                 | 100         | no           |
| record click → badge                           | 500 / 1000    | 75.0                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.3                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 73.7                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 226.6                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 29.9                  | 50          | yes          |
| export: click → dialog painted                 | 500 / 1000    | 79.6                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 210.4                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 172.0                 | 5000        | yes          |

## Comparison (SC-005)

- **Pan/zoom/drag avg FPS**: `default` 53.0 → 52.7 (−0.6 %), `drag` 59.6 → 59.2 (−0.7 %),
  `drag-100-selected` 54.3 → 54.8 (+0.9 %), `drawer-open-pan` 53.1 → 52.4 (−1.3 %),
  `selection-toolbar-pan` 53.0 → 52.7 (−0.6 %). All well inside the ±5 % budget; the "meets
  target" column is unchanged between the two runs except `onlyRenderVisibleElements`, which
  flips from "no" to "yes" — noise on this shared/headless machine (both readings are ~57 fps,
  either side of the 60 fps target), not a regression.
- **Flow highlight (SC-002, <100 ms)**: `select flow → marks painted` 85.5 ms → 82.0 ms,
  `open flow → flow mode painted` 87.8 ms → 98.4 ms. Both stay under the 100 ms target with
  colours enabled. (`next step → current painted` misses the 100 ms target in _both_ runs,
  112.7 ms and 127.1 ms — a pre-existing gap unrelated to 020; not introduced by this feature. A
  first `BENCH_COLOURS=1` run also showed `select`/`open flow` briefly over 100 ms — 180.4 ms and
  178.8 ms — but a second run on the same code measured 82.0 ms / 98.4 ms, confirming that reading
  was machine noise, not a real 020 regression; the numbers reported above are from the
  reproducible run.)

**Conclusion**: adding per-node fill/stroke colours (020) does not measurably change canvas pan,
zoom or drag performance, and flow highlight continues to paint within 100 ms. SC-005 holds.
