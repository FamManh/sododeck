# Bench after 015

Ran on 2026-09-28 at `80265f9` plus the uncommitted polish (the 015 canvas changes: problems worker, glyph marks in `CanvasView`, toolbar button) via `pnpm bench`. Same laptop and headless Chromium as [bench-before.md](bench-before.md); indicative only. The bench decks contain problems (random flows break chains), so glyphs and the worker are active during these runs.

## Frame scenarios

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 2.00     | 382         | 363                | 53.1    | 16.8           | 200.1          | 2.4%        | no           |
| onlyRenderVisibleElements  | 460 / 25 of 500                | 2.00     | 332         | 309                | 57.2    | 16.8           | 83.3           | 1.2%        | yes          |
| jsonDeckOpen               | 500 / 500 of 500               | 2.00     | 381         | 323                | 53.4    | 16.8           | 200.0          | 2.8%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 321         | 303                | 58.8    | 16.8           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 390         | 338                | 59.7    | 16.7           | 33.3           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 322         | 303                | 56.0    | 16.8           | 100.0          | 1.8%        | no           |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 133         | 0                  | 59.0    | 16.8           | 33.3           | 0.0%        | yes          |

## Action scenarios

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select flow → marks painted                    | 500 / 1000    | 101.5                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 85.9                  | 100         | yes          |
| next step → current painted                    | 500 / 1000    | 50.7                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 79.9                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 31.4                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 71.4                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 220.7                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 34.3                  | 50          | yes          |

## Noise check on the flow scenarios

The full run above missed two targets ("select flow → marks painted" 101.5 ms, "playing at 2×"
max frame 100 ms), so the three flow scenarios were re-run three times on this build and three
times on the pre-015 build (`a8f66d0`, separate worktree), same machine:

| Scenario                               | Before 015 (3 runs)      | After 015 (3 runs)          |
| -------------------------------------- | ------------------------ | --------------------------- |
| select flow → marks painted (ms)       | 90.6 · 86.9 · 88.1       | 130.9 · 81.3 · 80.1         |
| open flow → flow mode painted (ms)     | 131.5 · 83.9 · 85.9      | 99.8 · 86.4 · 77.6          |
| playing at 2× avg FPS / max frame (ms) | 55.4/100 · 58/50 · 58/50 | 58/50 · 55.4/133 · 56.4/100 |

Both builds show the same one-off outliers (~130 ms actions, 100–133 ms max frames while
playing); medians are unchanged or better. No regression attributable to 015 is visible above
run-to-run noise. The problems check itself runs in its worker; the main thread only receives the
result and re-renders objects whose marks changed.
