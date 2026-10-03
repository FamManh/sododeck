# Bench before (035, T001)

`pnpm bench`, 5 runs, 500 nodes / 1,000 edges. Date 2026-10-03, macOS (Darwin 25.1.0), Chromium headless.

**Machine state: not quiet.** Load average 4.0–7.2 during the runs, 11–13 logged-in users, and I ran
Vitest and edited files between runs. Treat the absolute numbers as noisy; use the median.

**Tree state:** run 1 is the clean `main`-equivalent tree (HEAD `708751c`). Runs 2–5 were built after
the pure data layer of 035 (`step-marks.ts`, overlay `state` / `step` fields, `deck-to-flow` data) was
added but before any component or CSS paints it, so painting is unchanged. Only `currentStep` now marks
the target card instead of both cards.

| Run        | next step → current painted (ms) | playing at 2× (avg FPS) | load avg (start) |
| ---------- | -------------------------------- | ----------------------- | ---------------- |
| 1          | 142.3                            | 57.8                    | 4.39             |
| 2          | 124.0                            | 58.6                    | 4.06             |
| 3          | 45.7                             | 58.4                    | 7.24             |
| 4          | 71.1                             | 58.4                    | 5.84             |
| 5          | 48.1                             | 58.4                    | 6.18             |
| **Median** | **71.1** (target ≤ 100)          | **58.4**                |                  |

Reference: 029 recorded 85.7 ms and 59.2 fps on a quiet machine. Runs 1 and 2 exceed 100 ms on a loaded
machine; runs 3–5 meet it.
