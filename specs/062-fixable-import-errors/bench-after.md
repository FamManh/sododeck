# Bench after 062 (R8)

Same machine and method as `bench-before.md` (CPU time, median of 15 cold runs, one warm-up).
The single runs are noisy on this laptop (±15 %), so the final check ran the base commit
(`e67f901f`, in a temporary worktree) and this branch **interleaved**, four times each.

| Measure                                           | Base (mean of 4) | 062 (mean of 4) | Change |
| ------------------------------------------------- | ---------------- | --------------- | ------ |
| `checkDeck`, 2,000 nodes / 4,000 edges / 80 flows | 7.39 ms          | 7.06 ms         | noise  |
| `checkDeck`, 150 tables                           | 1.04 ms          | 1.24 ms         | noise  |
| `fromJSON`, 2,000-node deck                       | 47.9 ms          | 47.6 ms         | noise  |

Raw runs (base / 062): checkDeck 2,000 nodes 7.73 / 6.79, 8.15 / 7.18, 6.61 / 6.35, 7.07 / 7.92.

## What changed on the way

The first version added `path` and `subject` to every `Problem` inside `checkDeck` (R8 as
planned). Measured against the baseline it cost about +17 % on the 2,000-node deck (719 flow
problems, each located and turned into a pointer), over the +10 % budget. Problem locations are
now computed on demand by `problemLocator(file)` when a list is copied or an import is reported,
so `checkDeck`, which the problems worker runs on every edit, does exactly what it did before.

`pnpm bench` (the Playwright canvas benchmark) was not run: 062 does not touch the canvas.
`inspectDeckText` adds one `checkDeck` and one locator pass to an import that opens (about
8 ms on the 2,000-node deck), in the library worker. A refused file with 10,000 duplicate ids is
inspected and sorted in under 1 s (`import-check.test.ts`).
