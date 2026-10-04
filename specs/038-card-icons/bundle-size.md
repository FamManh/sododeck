# Bundle size (038), gzip KB

Budget: editor chunks + ≤ 25 KB gzip. Before = main at aa15cfc, after = this branch.

| Chunk                             | Before | After  | Change |
| --------------------------------- | ------ | ------ | ------ |
| flow-mode (now holds the catalog) | 19.06  | 43.22  | +24.16 |
| editor-context                    | 189.27 | 192.35 | +3.08  |
| export-dialog                     | 101.33 | 99.62  | −1.71  |
| editor-page                       | 34.04  | 33.84  | −0.20  |
| canvas-geometry                   | 106.68 | 106.82 | +0.14  |
| index (entry)                     | 153.62 | 153.60 | −0.02  |
| **All JS chunks except workers**  | 1822.4 | 1848.0 | +25.6  |

The catalog and generated geometry (about 294 icons) land in the shared `flow-mode` chunk, which
the editor loads; the entry chunk is unchanged. Net growth is +25.6 KB gzip, 0.6 KB over the
25 KB budget in R10. Deleting `export/icon-paths.ts` and the per-type lucide imports recovered
about 2 KB. If the budget must hold exactly, trim keywords or the lowest-value catalog entries
(data only, no code change).
