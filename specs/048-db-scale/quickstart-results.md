# Quickstart results (T050)

Date: 2026-10-04, branch `FamManh/feat-db-schema`.

**Manual run: not done.** The app needs a deck with 60-column tables, schemas and views to follow
steps 1-8; the only place that builds one on demand is the bench page (`/bench?tables=150&wide=1&schemas=3`),
which mounts the canvas without Deck settings, the view switcher or the palette. The machine was also
under a load average of 35-45 during this pass, so a hand-driven session would not have been reliable.
No screenshots were taken, and nothing was compared pixel by pixel with frames 158, 162 and 163.
Every step below is therefore verified by automated tests only. A founder pass in `pnpm dev` is still
open and is the main uncertainty of this feature.

## Automated gate (T051)

| Command          | Result                                                    |
| ---------------- | --------------------------------------------------------- |
| `pnpm lint`      | pass                                                      |
| `pnpm typecheck` | pass                                                      |
| `pnpm test`      | pass when the time-budget tests run alone, see below      |
| `pnpm build`     | pass                                                      |
| `pnpm e2e`       | 4 passed (2.2 s), incl. the no-third-party-requests check |

Under load, `pnpm test` had time-budget failures that all pass when rerun on their own: the app's
`elk-layout` (200 components under 2 s), `plan-schema-sync.perf`, `scene.perf` (150 tables, 041 and
042), `editor-page` undo / redo (SC-004), and the ui package's `icon-sets/search` (1,000 queries under
100 ms) and `lucide.generated` check. Machine load, not the feature (ui is untouched by 048 apart from
one line).

## Steps and the tests that cover them

| #   | Step             | Covered by                                                                                                                                                                 |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Row limit        | `table-layout.test.ts`, `table-body.test.tsx` (button, `aria-expanded`), `table-compact.test.tsx`, `render-svg.test.ts`; `expanded` round-trip and undo in the model tests |
| 2   | Connector anchor | `table-layout.test.ts` (`rowAnchorY` at the button), connector-end test in the app (2f2c8ea9)                                                                              |
| 3   | Column filter    | `table-filter.test.tsx` (counter, Enter / Shift+Enter, Esc, locked tables, live edits), `use-canvas-shortcuts.test.tsx` (⌘F), `reveal-row.test.tsx`                        |
| 4   | Jump to          | `palette-results.test.ts`, `open-result.test.ts`, `command-palette.test.tsx` (cut table opens, row selected and centred, focus)                                            |
| 5   | Grouping         | `schema-groups.test.ts`, `group-actions-schema.test.ts`, `merged-edge-popover.test.tsx`, `deck-inspector.test.tsx`, `schema-collapse.perf.test.ts`                         |
| 6   | View             | `view-filter.test.ts`, `view-outside.test.ts`, `view-settings-tables.test.tsx`, `proxy-layout.test.ts`, `outside-proxy-node.test.tsx`, `views-roundtrip.test.ts`           |
| 7   | Focus            | `focus-set.test.ts` (150-table fixture, 5 strong tables, edges among kept), `use-canvas-shortcuts.test.tsx` (Esc keeps selection)                                          |
| 8   | Export           | `render-svg.test.ts` (row limit, Show all button, collapsed schema group), `scene.perf.test.ts`                                                                            |

The 150-table bench deck rendered all 150 tables in about 200 ms on the bench page (see `bench-after.md`).

## Accessibility pass (T048)

Checked by tests: button names and `aria-expanded` on Show all / Show fewer (`table-body.test.tsx`)
and on the collapsed group card; the filter counter as `role="status"` (`table-filter.test.tsx`);
palette result text for table and column rows (`palette-results.test.ts`); reduced-motion pan
(`reveal-row.test.tsx`, added in this pass). 4.5:1 contrast was not measured: 048 adds no token and
uses existing DESIGN.md ones. A screen reader pass was not done.
