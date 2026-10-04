# Bench after (041 T036, SC-004)

Run 2026-10-04 on the same machine as [bench-before.md](bench-before.md): headless Chromium,
CPU throttle 1×, scenario `default` (fit, pan and zoom from fit to 400 %), 150 nodes / 300 edges.
Tables now draw their full table card (12 column rows each, 1,800 rows in all). Two runs each.

```bash
BENCH_NODES=150 BENCH_EDGES=300 BENCH_TABLES=150 pnpm bench -g "default:"   # 150 tables × 12 columns
BENCH_NODES=150 BENCH_EDGES=300 pnpm bench -g "default:"                    # 150 cards
```

| Deck       | Run | Render (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames |
| ---------- | --- | ----------- | ------- | -------------- | -------------- | ----------- |
| 150 tables | 1   | 257         | 56.5    | 16.8           | 149.9          | 1.8 %       |
| 150 tables | 2   | 215         | 56.3    | 16.8           | 133.3          | 1.8 %       |
| 150 cards  | 1   | 188         | 58.6    | 16.8           | 50.0           | 0.9 %       |
| 150 cards  | 2   | 211         | 58.5    | 16.8           | 50.0           | 0.6 %       |

**SC-004 (frame time within 10 % of cards): met.** Mean frame time 17.7 ms for tables vs 17.1 ms
for cards (+3.8 %); p95 is the same 16.8 ms. The bench's own 60 fps target (≥ 57 fps average)
is missed by tables by under 1 fps.

**Watch item:** tables show more long frames (1.8 % vs 0.6–0.9 %, worst 133–150 ms). Not
profiled yet; the likely cause is the zoom crossing into Container, where every table swaps its
compact content for its 12 rows in one frame (1,800 row elements). 048's row limit and a cheaper
level swap are the levers if a larger deck shows it.
