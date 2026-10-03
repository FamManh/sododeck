# 029 Card look (Deck): after-change benchmarks

Phase 9 (T060) adds the full canvas bench tables here (`pnpm bench` with the T002 flags plus
`BENCH_LINE_TYPES=1`, before and after). This file starts with the export measurement of T059.

## Export scene + SVG (T059)

`pnpm --filter @sododeck/app test scene.perf`: `buildScene` + `renderSvg` on the 500 component /
1,000 connection bench deck (groups, flows and 20 notes), in jsdom, on a fresh deck copy after one
warm-up run. ADR 0016's budget is < 50 ms in the bench browser (no long task); the test's jsdom
ceiling is 250 ms.

| Run                        | Scene + SVG  | SVG size      |
| -------------------------- | ------------ | ------------- |
| Before (Phase 7, old card) | 14.0–14.8 ms | 534,438 chars |
| After (Deck card, lines)   | 16.5–18.6 ms | 816,909 chars |

Three runs each. The after number is under the 50 ms budget, so the pure modules stay on the main
thread (ADR 0016 decision 6). The SVG is about 50 % larger: every card now draws a lip, a header
tile and its wrapped title lines, and every connector two end marks.
