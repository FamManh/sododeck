# 029 Card look (Deck): after-change benchmarks

Phase 9 (T060). `pnpm --filter @sododeck/app bench` (not the turbo cache) with
`BENCH_ROUTES=1 BENCH_COLOURS=1 BENCH_GROUPS=1` (the T002 flags) plus `BENCH_LINE_TYPES=1` on the
after side (a third of the 1,000 connectors each curved, elbow, straight). Headless Chromium,
500 nodes / 1,000 edges, 2026-10-03.

**Before** is the same bench run on commit `36d9713` (the code before 029, in a separate worktree),
**after** on the final Phase 9 code. They ran back to back on the same machine, because the machine
was loaded (load average 4 to 10) and runs from different moments are not comparable. Numbers are
indicative; the "Meets target" column of the raw reports is a 60 fps check that headless Chromium
here does not reach even before the change (pan holds about 54 fps).

## Regression found and fixed

The first after-run was far worse than the baseline: pan 54 to 45 fps, drag 60 to 29 fps, drag of
100 selected 50 to 21 fps, and the 2,000-node palette search 37 to 850 ms. Bisecting (`9a2ddb2`, then
removing the end marks, then removing only the arrows) showed the cost was the arrow's
`transform="translate() rotate()"`: 1,000 rotated paths. The arrow is now drawn as an
absolute-coordinate path (`arrowPathAt`, `perf(app): bake the connector arrow rotation into its
path`), and the numbers below are after that fix. The export SVG keeps the transform (it is static).

## Pan, zoom and drag (before / after)

| Scenario                   | FPS before | FPS after | p95 (ms) before | p95 (ms) after | max (ms) before | max (ms) after | long before | long after |
| -------------------------- | ---------- | --------- | --------------- | -------------- | --------------- | -------------- | ----------- | ---------- |
| default                    | 54.4       | 52.5      | 16.8            | 16.8           | 116.7           | 150.0          | 1.9%        | 2.1%       |
| onlyRenderVisibleElements  | 55.5       | 54.5      | 16.8            | 16.8           | 116.7           | 133.3          | 1.9%        | 1.9%       |
| jsonDeckOpen               | 54.3       | 52.5      | 16.8            | 16.8           | 116.6           | 133.3          | 1.9%        | 2.5%       |
| resized-routed             | 54.4       | 53.2      | 16.8            | 16.8           | 116.7           | 150.0          | 1.9%        | 2.1%       |
| drawer-open-pan            | 54.4       | 52.2      | 16.8            | 16.8           | 116.6           | 150.0          | 1.9%        | 2.8%       |
| selection-toolbar-pan      | 54.1       | 53.3      | 16.8            | 16.8           | 150.0           | 133.3          | 1.9%        | 1.8%       |
| groups-collapsed           | 60.0       | 60.0      | 16.7            | 16.7           | 16.8            | 16.8           | 0.0%        | 0.0%       |
| drag                       | 59.6       | 58.9      | 16.8            | 16.7           | 33.3            | 33.4           | 0.0%        | 1.3%       |
| drag+jsonDeck              | 60.0       | 59.6      | 16.8            | 16.8           | 16.8            | 33.3           | 0.0%        | 0.0%       |
| drag-100-selected          | 50.9       | 59.2      | 33.4            | 16.8           | 33.4            | 33.4           | 2.9%        | 0.3%       |
| group-drag                 | 59.8       | 59.4      | 16.8            | 16.8           | 33.3            | 33.3           | 0.0%        | 0.0%       |
| playing at 2×              | 56.2       | 59.2      | 16.8            | 16.8           | 100.0           | 66.6           | 2.1%        | 0.3%       |
| pan-during-layout (5 pans) | 60.0       | 58.9      | 16.7            | 16.8           | 16.8            | 33.3           | 0.0%        | 0.0%       |

Pan stays within about 2 fps of the baseline (52 to 54 vs 54 to 55) and the long-frame share within
about 1 point; the largest frame is 133 to 150 ms vs 117 ms, which is within the run to run spread
we saw on this machine (the baseline itself showed 116 to 150 ms). Drag, group drag and playback
are at or better than baseline. Pan is slightly slower (about 1 to 2 fps) in every pan scenario, so
this is a small, consistent cost of the richer card (lip, tile, tag dots) and two end marks per
connector, not noise alone. It needs the founder's acceptance under constitution V; it is not a
60 fps regression since the baseline does not reach 60 fps pan here either.

## Actions (median of 5)

| Scenario                                       | Before (ms) | After (ms) | Target (ms) |
| ---------------------------------------------- | ----------- | ---------- | ----------- |
| select 3 → toolbar painted                     | 18.0        | 23.6       | 100         |
| select flow → marks painted                    | 122.7       | 109.3      | 100         |
| open flow → flow mode painted                  | 140.3       | 100.0      | 100         |
| next step → current painted                    | 132.6       | 85.7       | 100         |
| record click → badge                           | 86.1        | 87.1       | 100         |
| inspector title edit → canvas                  | 30.9        | 32.5       | 100         |
| collapse-toggle                                | 29.3        | 31.9       | 100         |
| focus                                          | 101.8       | 110.1      | 100         |
| view-switch (System → Infra)                   | 82.7        | 87.6       | 200         |
| tidy-layout-200 (click → applied, median of 3) | 230.8       | 236.6      | 2000        |
| ⌘K type → results                              | 36.9        | 51.4       | 50          |
| export: click → dialog painted                 | 70.8        | 63.4       | 300         |
| export: PNG → preview painted                  | 204.8       | 226.0      | 2000        |
| export: longest task while preparing           | 0.0         | 0.0        | 50          |
| export: 2× PNG click → download                | 163.0       | 243.0      | 5000        |

Two items sit on or just over the 100 ms / 50 ms targets: `focus` 110 ms (baseline 102 ms, already
over) and `⌘K type → results` 51.4 ms (baseline 36.9 ms, target 50 ms): the search renders 2,000
cards and each card is heavier now. `select flow` and `open flow` were over 100 ms in the baseline
run too (122 and 140 ms) and are now at 109 and 100 ms; they vary 85 to 140 ms between runs here.
Open item: the palette search is the one target that was met before and is now marginally missed,
needs a re-measure on a quiet machine.

## Export scene + SVG (T059)

`pnpm --filter @sododeck/app test scene.perf`: `buildScene` + `renderSvg` on the 500 component /
1,000 connection bench deck (groups, flows and 20 notes), in jsdom, on a fresh deck copy after one
warm-up run. ADR 0016's budget is < 50 ms in the bench browser (no long task); the test's jsdom
ceiling is 250 ms.

| Run                        | Scene + SVG  | SVG size      |
| -------------------------- | ------------ | ------------- |
| Before (Phase 7, old card) | 14.0–14.8 ms | 534,438 chars |
| After (Deck card, lines)   | 16.5–18.6 ms | 816,909 chars |

Three runs each. The after number is under the 50 ms budget, so the pure modules stay on the main
thread (ADR 0016 decision 6). The SVG is about 50 % larger: every card now draws a lip, a header
tile and its wrapped title lines, and every connector two end marks.
