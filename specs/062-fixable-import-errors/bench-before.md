# Bench before 062 (baseline, R8)

Measured 2026-10-05 on the founder's laptop (Apple Silicon, Node 24), branch base `e67f901f`.
CPU time, median of 15 cold runs (fresh `structuredClone` each run, one warm-up), three
invocations shown.

| Measure                                                  | Run 1   | Run 2   | Run 3   |
| -------------------------------------------------------- | ------- | ------- | ------- |
| `checkDeck`, 2,000 nodes / 4,000 edges / 80 flows        | 7.20 ms | 7.38 ms | 6.33 ms |
| `checkDeck`, 150 tables × 12 columns / 200 relationships | 1.13 ms | 1.26 ms | 1.07 ms |
| `fromJSON`, 2,000-node deck                              | 46.4 ms | 48.6 ms | 48.9 ms |

`pnpm bench` (the Playwright canvas benchmark) was not run: 062 does not touch the canvas render
path. The numbers that 062 can move are `checkDeck` (path/subject per problem, runs in the
problems worker on every edit) and the import path (`fromJSON`), measured above with a one-off
Vitest timing file kept out of the repo.
