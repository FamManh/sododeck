# Quickstart results: 040 Database Schema Model

## Baseline (T001, 2026-10-04)

Branch: `FamManh/feat-database-schema-model` (the worktree's branch; the plan names
`040-db-schema-model`). After `pnpm install`:

- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: one pre-existing, load-sensitive failure in `@sododeck/ui`
  (`test/icon-sets/search.test.ts` "answers 1,000 queries in under 100 ms": 135.8 ms while every
  package ran in parallel). It passes when the package runs alone (45 files, 654 tests). Not
  related to 040.

## Bench before (T002)

`pnpm bench`, headless Chromium, 500 nodes / 1,000 edges, indicative only.

| Scenario                   | Nodes in DOM (fit / zoomed in) | Max zoom | Render (ms) | Ready in page (ms) | Avg FPS | p95 frame (ms) | Max frame (ms) | Long frames | Meets target |
| -------------------------- | ------------------------------ | -------- | ----------- | ------------------ | ------- | -------------- | -------------- | ----------- | ------------ |
| default                    | 500 / 500 of 500               | 4.00     | 175         | 0                  | 53.1    | 16.8           | 133.3          | 1.9%        | no           |
| onlyRenderVisibleElements  | 460 / 6 of 500                 | 4.00     | 155         | 0                  | 54.8    | 16.8           | 133.3          | 1.9%        | no           |
| jsonDeckOpen               | 500 / 500 of 500               | 4.00     | 181         | 470                | 52.7    | 16.8           | 150.0          | 2.5%        | no           |
| drawer-open-pan            | 500 / 500 of 500               | 4.00     | 173         | 434                | 52.9    | 16.8           | 133.4          | 2.5%        | no           |
| selection-toolbar-pan      | 500 / 500 of 500               | 4.00     | 146         | 0                  | 52.7    | 16.8           | 150.0          | 1.9%        | no           |
| drag                       | 500 / 500 of 500               | 0.30     | 144         | 0                  | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag+jsonDeck              | 500 / 500 of 500               | 0.30     | 179         | 469                | 59.6    | 16.7           | 33.3           | 0.0%        | yes          |
| drag-100-selected          | 500 / 500 of 500               | 0.30     | 142         | 0                  | 59.4    | 16.8           | 33.4           | 0.0%        | yes          |
| playing at 2×              | 500 / 500 of 500               | 0.30     | 151         | 0                  | 59.8    | 16.7           | 33.3           | 0.0%        | yes          |
| pan-during-layout (5 pans) | 500 / 500 of 500               | 0.40     | 153         | 0                  | 57.7    | 16.8           | 33.4           | 0.0%        | yes          |

| Scenario                                       | Nodes / edges | Action → painted (ms) | Target (ms) | Meets target |
| ---------------------------------------------- | ------------- | --------------------- | ----------- | ------------ |
| select 3 → toolbar painted                     | 500 / 1000    | 24.3                  | 100         | yes          |
| select flow → marks painted                    | 500 / 1000    | 117.1                 | 100         | no           |
| open flow → flow mode painted                  | 500 / 1000    | 110.8                 | 100         | no           |
| next step → current painted                    | 500 / 1000    | 87.0                  | 100         | yes          |
| record click → badge                           | 500 / 1000    | 95.1                  | 100         | yes          |
| inspector title edit → canvas                  | 500 / 1000    | 33.1                  | 100         | yes          |
| hover → focus painted                          | 500 / 1000    | 16.0                  | 16          | no           |
| view-switch (System → Infra)                   | 500 / 1000    | 89.1                  | 200         | yes          |
| tidy-layout-200 (click → applied, median of 3) | 200 / 400     | 289.0                 | 2000        | yes          |
| ⌘K type → results                              | 2000 / 4000   | 59.1                  | 50          | no           |
| export: click → dialog painted                 | 500 / 1000    | 62.3                  | 300         | yes          |
| export: PNG → preview painted                  | 500 / 1000    | 253.6                 | 2000        | yes          |
| export: longest task while preparing           | 500 / 1000    | 50.0                  | 50          | no           |
| export: 2× PNG click → download                | 500 / 1000    | 268.0                 | 5000        | yes          |
