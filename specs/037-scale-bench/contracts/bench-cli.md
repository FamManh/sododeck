# Contract: bench commands and options

| Command (repo root)                       | What                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm bench`                              | Today's canvas bench at 500 / 1,000. Unchanged options. Flow scenarios now warm up and report a median of 11. Always writes at least one `canvas-fps` row. |
| `pnpm --filter @sododeck/app bench:scale` | The scale bench (sets `BENCH_SCALE=1`): all areas at all sizes.                                                                                            |

| Env var                                                                                                        | Default               | Meaning                                                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| `BENCH_SCALE`                                                                                                  | unset                 | `1` runs `scale.bench.ts`; without it that file registers no tests        |
| `BENCH_SIZES`                                                                                                  | `500,2000,5000,10000` | component counts to run (edges = 2×)                                      |
| `BENCH_CULLING`                                                                                                | `both`                | `on`, `off` or `both` for renderer-bound rows                             |
| `BENCH_CELL_TIMEOUT_MS`                                                                                        | `120000`              | per-cell limit before `did-not-finish`                                    |
| `BENCH_FAST`                                                                                                   | unset                 | `1` shortens the memory edit loop (30 s instead of 5 min); report says so |
| `BENCH_CPU_THROTTLE`                                                                                           | `1`                   | existing                                                                  |
| `BENCH_NODES`, `BENCH_EDGES`, `BENCH_FLOWS`, `BENCH_GROUPS`, `BENCH_STICKIES`, `BENCH_ROUTES`, `BENCH_COLOURS` | existing              | unchanged                                                                 |

Exit code: 0 whenever the run completes, even with `missed` or `did-not-finish` rows (the bench reports, it does not gate; CI budget is out of scope).
