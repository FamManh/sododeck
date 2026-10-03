# Bench after (035, T042)

`pnpm bench`, 5 runs, 500 nodes / 1,000 edges, 2026-10-03, same machine as [bench-before.md](bench-before.md).
**Not a quiet machine**: load average 5–18 during the runs (busier than before), so absolute numbers are noisy.

| Run        | next step → current painted (ms)     | playing at 2× (avg FPS) | load avg (start) |
| ---------- | ------------------------------------ | ----------------------- | ---------------- |
| 1          | 79.3                                 | 58.8                    | 5.33             |
| 2          | 64.3                                 | 59.8                    | 9.31             |
| 3          | 46.3                                 | 58.6                    | 14.68            |
| 4          | 145.0                                | 57.8                    | 18.22            |
| 5          | 57.2                                 | 57.0                    | 8.72             |
| **Median** | **64.3** (target ≤ 100, before 71.1) | **58.6** (before 58.4)  |                  |

Both medians are at or better than the baseline: "next step" stays under 100 ms and "playing at 2×" is not lower. Run 4 (145 ms) coincides with load 18 and is an outlier.
