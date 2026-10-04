# Bench after (042 T051)

Run 2026-10-04 on the same Apple M5 (32 GB), headless Chromium, CPU throttle 1×, 500 nodes /
1000 edges, the first 150 nodes 12-column tables. With `rel`, 207 table edges are relationships
drawn from their rows (crow's feet, stubs, 5 self-loops, 5 second FKs). The machine was shared
with another worktree running its test suite (load average ≈ 27), so single numbers move by
several fps; compare columns, not runs against `bench-before.md`.

```bash
BENCH_TABLES=150 pnpm bench               # tables
BENCH_TABLES=150 BENCH_REL=1 pnpm bench   # tables + relationships drawn from rows
```

## Full runs (after all 042 drawing)

| Scenario                  | Tables: FPS | p95 (ms) | Long frames | + rel: FPS | p95 (ms) | Long frames |
| ------------------------- | ----------- | -------- | ----------- | ---------- | -------- | ----------- |
| default                   | 48.6        | 33.3     | 3.8 %       | 49.2       | 33.3     | 3.2 %       |
| onlyRenderVisibleElements | 51.5        | 16.8     | 2.5 %       | 51.0       | 16.8     | 2.5 %       |
| jsonDeckOpen              | 50.5        | 16.8     | 2.6 %       | 49.2       | 33.3     | 2.5 %       |
| drawer-open-pan           | 49.1        | 16.8     | 2.5 %       | 48.8       | 16.8     | 3.7 %       |
| selection-toolbar-pan     | 47.5        | 33.3     | 4.6 %       | 47.6       | 33.4     | 5.4 %       |
| drag                      | 38.1        | 66.7     | 24.9 %      | 37.3       | 66.6     | 25.0 %      |
| drag+jsonDeck             | 37.3        | 66.7     | 23.6 %      | 34.9       | 66.7     | 25.3 %      |
| drag-100-selected         | 40.8        | 66.7     | 18.8 %      | 29.9       | 100.0    | 20.8 %      |
| playing at 2×             | 55.8        | 16.8     | 2.1 %       | 49.9       | 33.2     | 3.2 %       |
| pan-during-layout (1 pan) | 23.5        | 100.0    | 44.4 %      | 21.2       | 116.7    | 40.0 %      |

| Action                        | Target (ms) | Tables (ms) | + rel (ms) |
| ----------------------------- | ----------- | ----------- | ---------- |
| select 3 → toolbar painted    | 100         | 69.0        | 62.7       |
| select flow → marks painted   | 100         | 239.7       | 206.9      |
| open flow → flow mode painted | 100         | 237.3       | 212.1      |
| next step → current painted   | 100         | 336.1       | 232.6      |
| record click → badge          | 100         | 142.5       | 122.4      |
| hover → focus painted         | 16          | 22.5        | 19.3       |
| view-switch (System → Infra)  | 200         | 111.2       | 124.9      |
| tidy-layout-200               | 2000        | 265.4       | 319.6      |
| ⌘K type → results             | 50          | 59.4        | 54.6       |

## drag-100-selected follow-up

The full run showed drag-100-selected at 29.9 fps with relationships against 40.8 without. Every
relationship sampled its path on every frame to place its label; commit `e60ad1e` computes the
label point directly when there are no bends. The drag scenarios were then re-run back to back,
alternating, so both sides saw the same load:

| Scenario          | Tables run 1 | Tables run 2 | + rel run 1 | + rel run 2 |
| ----------------- | ------------ | ------------ | ----------- | ----------- |
| drag              | 38.8         | 37.1         | 38.8        | 38.8        |
| drag+jsonDeck     | 37.9         | 35.1         | 37.9        | 38.2        |
| drag-100-selected | 41.1         | 42.4         | 41.7        | 42.5        |

## Reading (SC-005, SC-006)

- **SC-006 (pan / zoom / drag within 10 % of the plain-connector board):** met in the back-to-back
  drag runs and in every full-run pan scenario except "playing at 2×" (−11 %), which drew no
  relationship work beyond the default board and swung by the same amount in `bench-before.md`;
  treat it as noise until a quiet-machine run says otherwise.
- **SC-005 (column hover within one frame):** hover is CSS only (034 stylesheet); "hover → focus
  painted" is 19.3 ms with relationships and 22.5 ms without, both above the 16 ms target that
  the tables board already missed before 042.
- **Did not finish (both runs, as before 042):** "inspector title edit → canvas" (180 s timeout)
  and "export-preview" (download wait). "record click → badge", which timed out in the `rel`
  baseline, finished this time.
