# Bench after: connector editing (050)

`pnpm bench` at 500 nodes / 1,000 edges, 2026-10-04, same machine as [bench-before.md](bench-before.md) (Apple Silicon, headless Chromium). Indicative only.

## Frame scenarios (SC-008: within 5 %)

| Scenario                   | Avg FPS before | Avg FPS after | p95 before (ms) | p95 after (ms) | Within 5 % |
| -------------------------- | -------------- | ------------- | --------------- | -------------- | ---------- |
| default                    | 52.5           | 53.7          | 16.8            | 16.8           | yes        |
| onlyRenderVisibleElements  | 54.7           | 55.3          | 16.8            | 16.8           | yes        |
| jsonDeckOpen               | 52.1           | 54.1          | 16.8            | 16.8           | yes        |
| drawer-open-pan            | 52.5           | 54.0          | 16.8            | 16.8           | yes        |
| selection-toolbar-pan      | 52.6           | 54.2          | 16.8            | 16.8           | yes        |
| drag                       | 58.9           | 59.2          | 16.7            | 16.8           | yes        |
| drag+jsonDeck              | 59.2           | 57.6          | 16.7            | 16.8           | yes        |
| drag-100-selected          | 58.2           | 59.4          | 16.8            | 16.7           | yes        |
| playing at 2×              | 59.6           | 59.6          | 16.7            | 16.8           | yes        |
| pan-during-layout (5 pans) | 57.4           | 59.2          | 16.8            | 16.8           | yes        |

## Action scenarios (median of 5, ms)

| Scenario                         | Before | After | After (2nd run) | `main` re-run |
| -------------------------------- | ------ | ----- | --------------- | ------------- |
| select 3 → toolbar painted       | 23.2   | 22.5  |                 |               |
| select flow → marks painted      | 126.6  | 116.9 | 163.3           |               |
| open flow → flow mode painted    | 149.4  | 116.2 | 157.4           |               |
| next step → current painted      | 100.1  | 84.0  |                 |               |
| record click → badge             | 113.0  | 91.0  |                 |               |
| inspector title edit → canvas    | 31.8   | 35.7  | 32.2            | 36.2          |
| hover → focus painted            | 18.0   | 19.6  | 24.8            | 21.5          |
| view-switch (System → Infra)     | 103.6  | 89.3  |                 |               |
| tidy-layout-200                  | 289.3  | 285.2 |                 |               |
| ⌘K type → results (2000 / 4000)  | 49.0   | 56.3  | 56.4            | 58.2          |
| export: click → dialog painted   | 85.5   | 76.9  |                 |               |
| export: PNG → preview painted    | 236.9  | 232.9 |                 |               |
| export: longest task (preparing) | 0.0    | 0.0   |                 |               |
| export: 2× PNG click → download  | 262.0  | 270.0 |                 |               |

## Reading

- Every frame scenario is within 5 % of the baseline (most are slightly better), so SC-008 holds.
- Action timings vary by ±30 % from run to run on this machine (for example "select flow" gave 117 then 163 ms after the change). The three that looked worse (⌘K, inspector edit, hover) were re-measured on unchanged `main` (`90fe17a`) and gave the same or higher numbers (58.2, 36.2, 21.5 ms), so they are noise, not a regression.
