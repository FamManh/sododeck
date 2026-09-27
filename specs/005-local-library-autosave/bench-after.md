# Bench after (branch, 005)

Same machine and settings as [bench-before.md](bench-before.md) (`pnpm bench`, CPU throttle 1×).

Target: 60 fps pan/zoom and drag at 500 nodes / 1000 edges. CPU throttle: 1×. Headless Chromium; indicative only.

| Scenario                  | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| ------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                   | 500 / 500 of 500               | 2.00     | 279         | 260                | 59.6    | 16.8           | 33.3           | 0.0%        | yes          |
| onlyRenderVisibleElements | 460 / 20 of 500                | 2.00     | 256         | 238                | 60.0    | 16.7           | 16.8           | 0.0%        | yes          |
| jsonDeckOpen              | 500 / 500 of 500               | 2.00     | 267         | 224                | 59.8    | 16.8           | 33.3           | 0.0%        | yes          |
| drag                      | 500 / 500 of 500               | 0.30     | 255         | 238                | 60.0    | 16.8           | 16.8           | 0.0%        | yes          |
| drag+jsonDeck             | 500 / 500 of 500               | 0.30     | 259         | 258                | 59.5    | 16.7           | 33.3           | 0.0%        | yes          |

## Comparison (drag scenario, 500 nodes / 1,000 edges)

|        | Avg FPS | p95 frame (ms) | Max frame (ms) |
| ------ | ------- | -------------- | -------------- |
| before | 60.0    | 16.8           | 16.8           |
| after  | 60.0    | 16.8           | 16.8           |

No regression (limit: 5 %). Render times are within run-to-run noise of the baseline.

Notes:

- A first run on the branch showed render times of ~500 ms: the whole router waited for
  IndexedDB to open. Fixed before this run: only the library page waits for the database, and
  the editor's loader awaits it itself.
- The `/bench` page renders an in-memory deck, so it does not include the autosave provider.
  Its cost is covered by `src/storage/deck-persistence.perf.test.ts`: one flush of a drag batch on
  the 500-node deck (merge, summary with thumbnail, one Dexie transaction) takes < 50 ms in
  fake-indexeddb.
