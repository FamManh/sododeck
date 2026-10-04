# Bench before (041 T003)

Run 2026-10-04, headless Chromium, CPU throttle 1×, scenario `default` (fit, pan and zoom),
150 nodes / 300 edges. Tables already have their computed size (T012) but still draw as generic
cards.

```bash
BENCH_NODES=150 BENCH_EDGES=300 BENCH_TABLES=150 pnpm bench -g "default:"   # 150 tables × 12 columns
BENCH_NODES=150 BENCH_EDGES=300 pnpm bench -g "default:"                    # 150 cards
```

| Deck                        | Render (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames |
| --------------------------- | ----------- | ------- | -------------- | -------------- | ----------- |
| 150 tables (drawn as cards) | 223         | 58.5    | 16.8           | 50.0           | 0.6 %       |
| 150 cards                   | 120         | 58.9    | 16.8           | 33.4           | 0.6 %       |
