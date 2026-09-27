# Bench after 006 (flow authoring)

Run: `pnpm bench` and `BENCH_FLOWS=1 pnpm bench` on 2026-09-27, 1× CPU, headless Chromium, the same
machine as [bench-before.md](bench-before.md). Indicative only.

## Pan, zoom and drag (target: within 5 % of `main`)

| Scenario                  | Avg FPS `main` | Avg FPS 006 | Avg FPS 006 + 21 flows | p95 frame `main` / 006 / + flows (ms) |
| ------------------------- | -------------- | ----------- | ---------------------- | ------------------------------------- |
| default                   | 59.6           | 59.8        | 59.8                   | 16.8 / 16.7 / 16.8                    |
| onlyRenderVisibleElements | 60.0           | 60.0        | 60.0                   | 16.7 / 16.7 / 16.7                    |
| jsonDeckOpen              | 59.8           | 59.8        | 59.8                   | 16.7 / 16.7 / 16.7                    |
| drag                      | 60.0           | 60.0        | 59.1                   | 16.8 / 16.8 / 16.8                    |
| drag+jsonDeck             | 60.0           | 58.1        | 60.0                   | 16.8 / 16.8 / 16.7                    |

All within 5 % of `main` (the largest gap, drag+jsonDeck at 58.1 fps, is −3.2 % in one run and
60.0 fps in the next; single long frames move these numbers run to run).

## Flow scenarios (target: < 100 ms, SC-002)

Deck: 500 nodes, 1,000 edges, 5 features × 4 flows × 10 steps and one 2-branch fork. From the
action to the first painted frame with the step badge; median of 5.

| Scenario                    | Deck flows only in flow scenarios | `BENCH_FLOWS=1` |
| --------------------------- | --------------------------------- | --------------- |
| select flow → marks painted | 16.4 ms                           | 16.3 ms         |
| record click → badge        | 71.1 ms                           | 71.2 ms         |

Both meet the target. "Record click" includes creating the flow and its first step in one batch
(model validation, the id allocator's first scan of the deck, the snapshot rebuild) and the
canvas re-render; it is the path to watch if later features add work per click.
