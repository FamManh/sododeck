# Research: Database Scale

Findings come from reading the code on `main` (2026-10-04). `A` = `apps/app/src/editor`.

## R1. Where the row limit lives

- **Decision**: inside `tableLayout()` (`A/table-layout.ts`), in the step that chooses shown rows
  and `hidden` / `hiddenIds`. Add `ROW_LIMIT = 12` (`colMax`) to `TABLE_CARD`. At All: shown rows
  = PK columns, FK columns, then the rest in stored order, up to 12, **plus** every column that
  is a relationship end (`context.connected`); re-sorted to stored order for drawing. A button
  slot (24 tall, like the pill) is added when any row is hidden.
- **Rationale**: every consumer (card, connectors, hit areas, scene / SVG export, drag ends)
  already reads `TableLayout`; one change keeps them equal (FR-005, SC-009).
- **Alternatives**: limit in `table-body.tsx` (rejected: heights and anchors would diverge).

## R2. Saved Show all

- **Decision**: reuse `node.expanded` (040, already in the schema, `tablePatch` removes it when
  false, nothing reads it). Toggle with `editor.update('nodes', id, { expanded })` wrapped in
  `oneStep`. Not blocked by lock (the model does not enforce lock; the app checks it elsewhere).
- **Rationale**: no format change; one undo step; works on locked tables (FR-004).
- **Note**: `expanded` is distinct from `node.detail` (FR-007): `detail: all` already wins at Keys;
  `expanded` only lifts the 12-row limit at All.

## R3. Button versus the "+n columns" pill

- **Decision**: the pill stays for Keys and Names (041 / 042). At All, a cut table draws the
  Show all button instead of the pill. `hidden.kind` gains `'limit'`; `rowAnchorY` already falls
  back to the pill centre for hidden ids, so it now returns the button centre for `'limit'`
  (same slot, so the change is a rename of the slot, not new geometry).
- **Rationale**: matches DESIGN.md (frame 158) and spec FR-006; small diff in `rowAnchorY`.

## R4. In-table filter

- **Decision**: UI-only Zustand state `{ tableId, text, index } | null`. Passed to `tableLayout`
  as a projection (like `withNewRow`), not stored in the deck. Matching rows (case-insensitive
  substring on name) are shown even beyond the limit and highlighted; others fold behind the
  button. Because the layout cache is a WeakMap on node + context, the projection must be part of
  the cache key (only for the one filtered table, so other tables keep their cache).
- **⌘F**: no ⌘F handler exists. Add one beside ⌘K / ⌘S in `use-canvas-shortcuts.ts`, active when
  exactly one table is selected and the target is not a text field; call `preventDefault`. Add a
  `table-find` entry to `SHORTCUTS` (section Tables).
- **Alternatives**: store filter text in the deck (rejected: violates "UI-only state").

## R5. Grouping mode

- **Decision**: deck-level scalar `groupingMode: 'schema'` stored in `meta` next to `dialect`
  (default "group" = key removed). New op `setGroupingMode`, `DeckEditor.setGroupingMode`,
  validation whitelist, reader. UI: a segmented control "By group | By schema" in the Database
  section of Deck settings (`table-display-section.tsx`), one undo step.
- **By schema** is a display layer: `schemaGroupedDeck(deck)` returns a deck-shaped value whose
  `groups` are virtual groups `schema:<name>` and whose tables carry that group; real `group`
  and `parent` fields are never written. `visibleGraph` already reads `deck.groups` and
  `node.group`, so collapse, `MergedEdge` (×n), cards and counts are reused.
- **Collapse per mode and view**: `view.collapsed` is a flat id list. Virtual ids start with
  `schema:`, stored group ids never do (checked in a test), so the two modes keep separate state
  in the same list without a format change.
- **Tables without a schema** stay outside any group; non-table nodes keep their real group.
- **Alternatives**: store a per-view mode (rejected by the founder); write real groups (rejected:
  would change user data).

## R6. Merged connector list for relationships

- **Decision**: `merged-edge-popover.tsx` lists edges; for relationship edges it renders
  "orders.customer_id → customers.id · 1..n" using the column names, and selecting an item
  selects that relationship. Count pill "×n" is unchanged.

## R7. View filters

- **Decision**: two additive optional keys on `View`: `schemas: string[]` (show only tables whose
  schema is listed, plus non-table nodes unaffected) and `detail: 'names' | 'keys' | 'all'`
  (the view's table detail; absent = deck / table setting). Groups and explicit tables reuse
  the existing `excludeGroups` and `includes`; a table shows if it is in a listed schema **or**
  in `includes`. `viewFilter()` gets the schema rule and the "revealed" set already used for
  "created here while hidden", extended with the "Add to this view" button (adds the table id
  to `includes`, one undo step). `SETTINGS_KEYS` gets both keys so `setViewSettings` accepts them.
- **Per-view detail** flows through `setTableDeck` in `view-state.ts` as a `display.detail`
  override, so `tableLayout` needs no new input.
- **Rationale**: the view schema has no detail field today, but the spec requires the view to
  keep it (FR-016). Defaults are removed on write.

## R8. Outside proxies for hidden tables

- **Decision**: reuse 034's `PortPill` / `port:` nodes (`visible-graph.ts`, `deck-to-flow.ts`).
  A filtered view treats each hidden neighbour as an outside node, producing one pill per hidden
  table (not merged), titled with the table name; clicking offers "Show in <view>" via the
  `firstViewShowing` helper. Collapse state does not change them (founder, 2026-10-04).

## R9. Jump to (⌘K)

- **Decision**: add `table` and `column` to `SearchKind`; `nodeEntries` indexes table names
  (with schema) and `columnEntries` indexes `table.column` with type and key marker. `ORDER`
  puts table before column before other kinds when the match quality is equal. The palette
  currently builds `searchIndex` on every deck change; table and column entries are cached by the
  `nodes` array identity so typing does not rebuild them. `buildPaletteResults` slices after
  sorting; the sort is bounded by passing a real limit to `searchDeck` (top-k with a count of the
  rest for "n more", FR-023).
- **Open handler** (`open-result.ts`, `column` case): (1) if the row is cut, `expanded = true`
  through `oneStep` (permanent, locked tables included, clarified); (2) select the table and set
  `ui.focusedRow`; (3) after one frame, `setCenter` on `box.y + rowAnchorY(...)` with
  `duration: 0` when reduced motion. Hidden-in-view and collapsed-schema results keep the toast
  pattern ("Show in <view>" / "Expand schema") and never change state silently (FR-022).
- **Budget**: index of 1,800 columns is built once per `nodes` change (measured in the perf test,
  target ≤ 10 ms); type-to-results stays ≤ 50 ms.

## R10. Focus

- **Finding**: `focusSet` already includes a table and its one-hop neighbours through plain edges,
  resolves collapsed groups to their card, and ignores self-references. Gap: relationships
  _between_ two kept neighbours are not highlighted (only edges touching the focus table).
- **Decision**: second pass over edges where both ends are in the kept set. No new control.

## R11. Bench

- **Decision**: extend `generateBenchDeck` with `tables`, `rel`, plus `wide` (every 10th table has
  60 columns) and `schemas` (3 names); add query params in `bench-page.tsx`; a per-scenario
  override of node / edge count in `perf.bench.ts` (today they are global constants). Scenario
  "150 tables": 150 nodes, 250 relationships, 1,800 columns. Compare against the 500-card
  default and against the 041 / 042 numbers; write `bench-before.md` and `bench-after.md`.
  Add the row to `docs/performance.md`.
- **Note**: the 12-column bench tables never exceed the limit, so `wide` is required to
  exercise it.

## R12. Docs and decisions

- **Decision**: ADR 0034 "Database scale" (row limit placement, `groupingMode`, view `schemas` /
  `detail`, palette kinds). Update `apps/app/CLAUDE.md` (table layout, palette, groups, views),
  `packages/model/CLAUDE.md` (grouping op, views keys, search kinds), `packages/schema/CLAUDE.md`
  (three additive keys), `docs/performance.md`, backlog 048 status.

## Risks

1. **Layout cache staleness**: new inputs (`expanded`, filter) must be in the cache key or heights
   go stale. Mitigated by a test that changes each input and asserts the height.
2. **Column selection**: `Selection` has no column kind; reuse `ui.focusedRow` and wait a frame
   after expanding so the DOM row exists (`row-focus.ts` queries `[data-row]`).
3. **Connector flicker**: opening a table moves anchors from the button to rows; covered by SC-003
   test (0 px relative to row).
4. **Palette cost**: measured in the perf test; fall back to a worker only if the budget is missed.
