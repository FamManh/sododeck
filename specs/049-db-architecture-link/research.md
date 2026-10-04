# Research: Database Architecture Link

All items resolved; no `NEEDS CLARIFICATION` remains.

## R1. Where do a step's touches live, and what shape?

- **Decision**: an optional `touches` array on `Step`. Each entry is `{ table, column?, access }`,
  where `table` is a node id, `column` an optional column id of that table, and `access` is
  `"read"` or `"write"`. One entry per picker row. Order is the author's order.
- **Rationale**: steps already reference an edge and rule ids; a flat list matches the Touches UI
  (one row per table or column, one toggle per row) and is easy to validate. A column entry implies
  its table, so the chip and lighting derive tables from either form. Column ids are unique across
  the deck (existing rule), so `column` alone identifies the row.
- **Alternatives**: (a) nested `{ table, access, columns: [...] }`: two levels of toggles, harder
  to edit and to cascade. (b) A separate top-level `touches` collection keyed by step: needs a new
  id space and breaks "a step carries its own knowledge". (c) Flows between tables: rejected by the
  founder (2026-10-03).
- **Format impact**: additive, optional, so no `version` bump (constitution II). ADR 0035 records
  it.

## R2. Ownership rules

- **Decision**: owner = `node.parent` of a table node. At most one (a field holds one id). The UI
  offers only `database` cards. `removeNode` already deletes `parent` on children, so deleting a
  card un-parents its tables; the delete dialog (via `previewRemoval`) shows the count. Moving or
  removing sets or clears `parent` in one transaction (`setTableOwner`).
- **Rationale**: drill-in (`visibleGraph`) already treats `parent === scope.node` as inside and
  already produces one outside proxy per outside table, so cross-database proxies need no new
  code. Foreign keys between tables with different owners become proxies "for free" when the owner
  changes.
- **Gap**: nothing sets `parent` when a table is created while drilled in; add it to the
  add-table path (drill scope → `parent`).
- **Alternatives**: a new `owner` field (duplicate of `parent`, rejected); membership through
  `group` (groups are visual frames, not ownership).

## R3. Touched columns must never be hidden (FR-011), without 048

- **Decision**: add a `forcedColumnIds` input to the row-selection part of `table-layout.ts`. The
  layout keeps those rows even when Auto detail or a limit would fold them, and the "+n" count
  reflects only truly hidden rows. 049 passes the touched column ids for the current step.
- **Rationale**: `table-layout.ts` is the single owner of which rows draw (connectors, export
  and hit areas follow it). 048's row limit uses the same idea ("rows that carry a relationship
  are never cut"), so both features share one keep-set. 048 is not merged, so 049 builds on the
  041 behaviour and adds the input; 048 later merges its rules into the same set.
- **Alternatives**: highlight only if visible (violates FR-011); a separate overlay row (breaks the
  "one owner of rows" rule).

## R4. Lighting at both levels

- **Decision**: derive, per render, from `playbackOf` (current step) plus the deck:
  - At architecture level, for each database card owning a touched table, a **card chip**: text
    from the first touch in step order ("writes orders"), plus "+n" for the other touched tables
    of that card. A card inside a collapsed group merges its chip onto the group's stacked card.
  - Drilled in, every touched table in scope gets a `current` mark (same visual as a flow step
    mark), touched column rows get an **R** or **W** marker (shape plus letter), and the step
    player and flow chip stay (they do not depend on `drill`, confirmed in `canvas.tsx`).
  - Things that cannot be lit are **named in the step player**: tables with no owner, tables of
    another card ("also touches Customers DB"), and tables hidden by the view's filter ("hidden in
    this view").
- **Rationale**: reuses `step-marks.ts` / `flow-overlay.ts`; no stored state; works for Next and
  Previous because marks are a pure function of (deck, step).
- **Alternatives**: auto-drill into the card on step change (surprising, loses the user's place).

## R5. Samples

- **Decision**: three `.sododeck.json` files in `apps/app/src/samples/`, authored from the existing
  Shop fixture (`apps/app/src/db/fixtures/shop.ts`) for Shop and written by hand for SaaS auth and
  Blog. The existing `samples.test.ts` globs the folder and checks parse, integrity, problems and
  lossless round-trip, so the new files are validated automatically.
- **Rationale**: no loader needed; the gallery (013) is held and will list them later.
- **Alternatives**: generate samples at runtime (extra code path, no benefit).

## R6. SQL export from a database card

- **Decision**: reuse the 045 `database` scope (`tablesInScope` picks tables with
  `parent === cardId`) and the existing note for foreign keys to tables not in the export. Add a
  `database.exportSql` action for database cards that opens the export dialog seeded with
  `{ format: 'sql', scope: 'database' }`. A Generic deck already makes the dialog ask for a
  dialect (`sqlDialectOf` returns `null`).
- **Rationale**: FR-007 is almost entirely built; the missing piece is the entry point.

## R7. Delete cleanup

- **Decision**: `removeNode` (table) and `removeColumn` also remove matching touches from every
  step. Deleting a table also removes its column touches (they imply the table). Steps keep
  working, and the step is not reported as `broken` because a touch is optional extra knowledge.
- **Rationale**: matches how `removeColumn` already cascades to indexes and edge column lists.

## R8. Performance

- **Decision**: compute touched sets once per (deck version, step id) in a small cache keyed like
  `visibleGraph`'s cache. Run `pnpm bench` before and after (the card face and table body change).
- **Rationale**: a step has few touches; cost is dominated by the existing render path.
