# Bench after 036 (layout 2)

Measured on this branch, 2026-10-03, same machine and session as [bench-before.md](bench-before.md).
Headless Chromium; indicative only. Run-to-run noise on the action scenarios is large (±50% on
single scenarios between two runs of the same build).

## Verdict

| Check                                                                  | Before                   | After                    | Budget            | Result          |
| ---------------------------------------------------------------------- | ------------------------ | ------------------------ | ----------------- | --------------- |
| Field edit at 10,000 components (SC-005)                               | n/a                      | 0.01–0.02 ms             | ≤ 2× 500 (0.3 ms) | ✅              |
| Move at 10,000 components (SC-005)                                     | n/a                      | 4.4–5.1 ms               | < 10 ms           | ✅              |
| `perf.test.ts` budgets (load 200, edit 16, snapshot 2)                 | all met                  | all met                  | unchanged         | ✅              |
| Storage flush of an edit, 500-node bench deck                          | 60 ms                    | 60 ms                    | < 75 ms           | ✅              |
| Canvas bench (fps, frame times)                                        | see tables               | see tables               | no regression     | ✅ within noise |
| **Storage load** (apply stored bytes + snapshot + `toJSON`), 500 nodes | **~8.5 ms** (7.9–9.4)    | **~11.5 ms** (11.3–11.8) | ≤ +10% (SC-006)   | ❌ **+35%**     |
| **Storage load**, 2,000 nodes                                          | **~33.5 ms** (31.7–34.6) | **~44 ms** (42.7–46.6)   | ≤ +10% (SC-006)   | ❌ **+31%**     |

**SC-006 is not met.** Stored update bytes grow by 23% (500 nodes, 266 → 327 kB) and 17% (2,000
nodes, 1.03 → 1.20 MB), and decoding them (`Y.applyUpdate`) is most of the extra time (2,000 nodes:
20.7 → 33.8 ms). The cause is structural: each list item is a keyed map entry with an `$order`
key, and every non-empty long text is a `Y.Text` type instead of a string. Not creating the empty
`Y.Text`s (an experiment, reverted) changed nothing measurable, so the "always present" rule (R7)
is not the cost. In absolute terms a 500-component deck opens about 3 ms later. Per T045 this
blocks the merge unless the founder accepts it.

How it was measured: a throwaway Vitest file (not committed) on this branch and on a worktree of
`main` (`6e00ce2`), same generated deck (`largeDeck`, 500 or 2,000 nodes, 2× edges, 20 flows × 10
steps, 10 rules, 50 notes): `Y.applyUpdate` of `encodeStateAsUpdate(fromJSON(deck))` into a new
document, then `createDeckSnapshot(doc).get()` and `toJSON(doc)`; median of 9 after 3 warm-ups;
three runs per build.

## Model perf (`pnpm --filter @sododeck/model test perf`, median ms, 500 nodes / 1,000 edges)

| Measure                 | Before | After | Budget |
| ----------------------- | ------ | ----- | ------ |
| `fromJSON`              | 4.87   | 19.55 | 200    |
| `toJSON`                | 3.82   | 8.50  | 200    |
| `serializeDeck(toJSON)` | 2.99   | 3.58  | 200    |
| `checkIntegrity`        | 0.50   | 0.29  | 200    |
| rename                  | 0.58   | 0.30  | 16     |
| move                    | 0.30   | 0.28  | 16     |
| rename last edge        | 0.13   | 0.15  | 16     |
| move + snapshot         | 0.44   | 0.14  | 2      |
| rename at 10k (new)     | —      | 0.02  | 1      |
| reorder at 10k (new)    | —      | 5.13  | 10     |

`fromJSON` (file import) builds one `Y.Text` per long field and keyed child maps, so it is about 4×
slower, still at a tenth of its budget.

## Storage (`pnpm --filter @sododeck/app test deck-persistence.perf`)

```text
✓ flushes an edit of the 500-node bench deck in under 75 ms 60ms   (before: 60ms)
```

## Canvas (`pnpm bench`)

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. Groups: false. Stickies: 0. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 430         | 410                | 53.5    | 16.8           | 150.0          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 373         | 355                | 54.5    | 16.8           | 166.6          | 2.2%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 417         | 415                | 52.1    | 16.8           | 233.3          | 1.9%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 471         | 424                | 53.0    | 16.8           | 166.6          | 1.9%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 154         | 0                  | 53.5    | 16.8           | 150.0          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 372         | 355                | 59.3    | 16.7           | 33.4           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 422         | 376                | 59.6    | 16.8           | 33.4           | 0.6%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 355         | 337                | 51.1    | 33.4           | 66.7           | 4.8%        | no           |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 439         | 421                | 56.4    | 16.8           | 99.9           | 1.8%        | no           |
| pan-during-layout (6 pans) | 500 / 500 of 500               | 0.40     | 135         | 0                  | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |

Action scenarios (006, 007, 008, 009, 011): median of 5. Deck flows: flow scenarios only.

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 22.7                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 86.0                  | 100         | yes          |
| open flow → flow mode painted                  | 500 / 1000    | 104.1                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 62.1                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 95.9                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 30.8                  | 100         | yes          |
| view-switch (System → Infra)                   | 500 / 1000    | 82.2                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 267.4                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 52.3                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 73.4                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 214.5                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 0.0                   | 50          | yes          |
| export: 2× PNG click → download                | 500 / 1000    | 170.0                 | 5000        | yes          |
