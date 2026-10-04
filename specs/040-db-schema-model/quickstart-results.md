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

## Bench after (T053)

`pnpm bench` again on this branch, then once on the base commit (`615fd85`) straight after, to
separate the change from machine noise. 040 changes no canvas code and the bench generator makes
no tables (its opt-in `types` scenario now also cycles `db-table` as a generic card).

Action scenarios, ms (target in brackets):

| Scenario                             | Before | After (1st, right after e2e) | After (2nd) | Base, same session |
| ------------------------------------ | ------ | ---------------------------- | ----------- | ------------------ |
| select 3 → toolbar painted (100)     | 24.3   | 23.4                         | 22.0        | 18.9               |
| select flow → marks painted (100)    | 117.1  | 147.0                        | 145.5       | 150.3              |
| open flow → flow mode painted (100)  | 110.8  | 117.9                        | 123.5       | 115.4              |
| next step → current painted (100)    | 87.0   | 248.9                        | 121.6       | 142.4              |
| record click → badge (100)           | 95.1   | 103.5                        | 95.0        | 94.8               |
| inspector title edit → canvas (100)  | 33.1   | 31.8                         | 32.5        | 30.9               |
| hover → focus painted (16)           | 16.0   | 21.7                         | 19.3        | 20.0               |
| view-switch System → Infra (200)     | 89.1   | 95.1                         | 93.6        | 90.5               |
| tidy-layout-200 (2000)               | 289.0  | 256.4                        | 265.5       | 281.9              |
| ⌘K type → results, 2,000 nodes (50)  | 59.1   | 51.3                         | 57.5        | 46.6               |
| export: PNG → preview painted (2000) | 253.6  | 229.3                        | 231.3       | 229.8              |

Reading: the base commit lands in the same range as the branch in the same session, so the
spread is noise of headless Chromium on this machine (the report says "indicative only"). Pan /
zoom / drag FPS rows were 52–60 fps in every run, as before.

## 150-table schema (T049, SC-005)

`packages/model/test/perf.test.ts`, 150 tables × 12 columns, 200 relationships, one enum,
median of 5 (CPU time, local):

| Measure            | Measured | Budget  |
| ------------------ | -------- | ------- |
| `fromJSON`         | 12.1 ms  | 1000 ms |
| `toJSON`           | 9.1 ms   | 1000 ms |
| one `updateColumn` | 0.25 ms  | 1 ms    |
| cold `checkDeck`   | 1.1 ms   | 30 ms   |

## In the app (T054, quickstart §3)

Production build (`vite preview`), headless Chromium driven by a scratch Playwright script (no new
e2e test), screenshots in `screens/`:

1. Imported `packages/schema/examples/full.sododeck.json`: the library shows "16 components"
   (the 11 earlier cards, the Shop DB card and 4 tables).
2. JSON panel (⌘J) shows `dialect` and `enums` after `fieldDefaults`
   (`screens/json-dialect-enums.png`), a table's `columns` (`screens/json-columns.png`) and a
   relationship's `fromColumns` … `onUpdate` (`screens/json-relationship.png`). The Problems badge
   shows the example's 4 earlier problems; none come from the schema.
3. Add lists "Table" (`screens/add-flyout.png`); Packs lists "Database · 1 type", on
   (`screens/packs-panel.png`).
4. Export (Deck menu → Export… → JSON) and diff: `dialect`, `enums`, `nodes` and `edges` are
   identical to the imported file, keys in the same order. Two differences, both from before 040:
   the export is `JSON.stringify(…, 2)` while the example is Prettier-formatted (whitespace only),
   and the app fits a frame on open for the example's groups that store none (016,
   `fillGroupFrames`), which adds `position` / `size` to those groups and their view frames.

## Definition of done (T055)

- `pnpm lint`: pass. `pnpm typecheck`: pass. `pnpm build`: pass. `pnpm e2e`: 4 passed (1.8 s).
- `pnpm test`: every test passes when each package runs alone (schema 308, model 906, ui 657,
  app 2,837, site). In the all-packages parallel run, one timing test fails from CPU contention:
  `model › perf › builds a cold search index in < 100 ms` measured 102–109 ms (it passes alone;
  the earlier run also had `tags › rename on 500 cards < 100 ms` at 226 ms, which passes alone
  too). Measured alone, search-index building is 61–62 ms on this branch and 62–64 ms on the base
  commit, so it is not a regression; the baseline run had the same kind of flake in `ui`.
- No `.only` / `.skip` added; no other tool names added (diff grepped).

## Report (T056)

**What changed**

- `@sododeck/schema`: `$defs` for the database schema; root `dialect`, `enums`; node keys
  `schema`, `columns`, `indexes`, `checks`, `expanded`, `detail`; edge keys `fromColumns`,
  `toColumns`, `cardinality`, `fromOptional`, `toOptional`, `onDelete`, `onUpdate`; S14; the Shop
  fragment in `full.sododeck.json`; 15 invalid fixtures.
- `@sododeck/model`: layout-2 child lists for table parts and enums, read / write, one id scope
  refused on load, registry pack `database` and type `db-table`, editor ops for every part,
  `setDialect` / `deckDialect`, cascades, paste re-ids, two problem kinds, perf case.
- `@sododeck/ui` / app: `db-table` icon (`Table2`) and tone, thumbnail fill, two problem icons,
  registry-count test updates.
- Docs: ADR 0029, both package `CLAUDE.md`s, `docs/backlog-database.md` (040 status, column-end
  naming), design-analysis §g-87 id spelling.

**Decisions made while implementing**

- No S15: json-schema-to-zod keeps `minItems` on the three lists (`.min(1)`).
- `key-order.ts` needed no change: its union branch already orders `{ expr }` index parts.
- `Dialect` is excluded from "every enum value in full.sododeck.json" (a file holds one dialect);
  the coverage test expects one value and `schema.test.ts` accepts all four.
- `removeEnumValue` lives in `ops/cascade.ts` with the other removals (it returns a
  `RemovalResult`), not in `ops/db-enums.ts` as T043 listed.
- `ObjectRef.child.kind` gains `index`, `check`, `enum`, `enum-value` (exported as `ChildKind`);
  a table column reuses `column` on scope `nodes`.
- The `enumRef` problem row is titled "Missing enum" (the kind's title is "Missing column").
- `db-composite-mismatch` is reported only when both ends are tables (keys on other cards are
  ignored, FR-018).
- `apps/app/src/samples` does not exist yet (013 is held), so the byte-identity test (T020) uses
  the pre-040 schema examples, the 008 logistics deck and the generated 500-node deck.

**Skipped / uncertain**

- Two tabs adding a deck's **first** enum at the same moment: one wins (verified), as with 032's
  first field definition. Edits to existing enums merge per value. Noted in ADR 0029.
- `previewRemoval` / `RemovalTarget` have no database targets yet (043 will need them for delete
  previews).
- Branch name is the worktree's `FamManh/feat-database-schema-model`, not `040-db-schema-model`.

**Next step:** 041 (table card) reads `columns` / `indexes` / `checks` and `expanded` / `detail`
from the node and draws relationship ends from `fromColumns` / `toColumns`.
