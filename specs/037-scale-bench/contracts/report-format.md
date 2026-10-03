# Contract: report files

`apps/app/bench/results/report-<ISO stamp>.json` (gitignored; quote in docs and PRs):

```json
{
  "meta": {
    "date": "…",
    "commit": "…",
    "machine": { "cpu": "…", "cores": 10, "ramGb": 32 },
    "chromium": "…",
    "cpuThrottle": 1,
    "sizes": [500, 2000, 5000, 10000],
    "warmupRuns": 3,
    "measuredRuns": 11,
    "seed": 42,
    "fast": false
  },
  "rows": [
    {
      "area": "load",
      "metric": "first paint",
      "size": 2000,
      "culling": "on",
      "unit": "ms",
      "value": 640,
      "runs": 11,
      "min": 590,
      "max": 720,
      "target": 1000,
      "direction": "lower-is-better",
      "status": "met"
    }
  ]
}
```

`report-<stamp>.md` renders one table per area: rows = metric, columns = sizes (with culling on / off sub-columns where it applies), each cell `value (min–max)` plus a ✓ / ✗ / `DNF: reason`, then the target column. Existing canvas and action tables from `perf.bench.ts` keep their current layout.

Stability: field names and the `status` values above are the contract; later features (029 …) re-run the bench and compare two JSON files by `(area, metric, size, culling)`.
