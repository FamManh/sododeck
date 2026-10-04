# 0034. Database scale

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/048-db-scale` (research R1–R12)
- **Builds on:** 0029 (database pack model), 0030 (table display), 0033 (schema import parsers)

## Context

A table with 60 columns takes over the canvas, a deck with 150 tables is hard to read, and a
column is not reachable from search. 048 makes long tables and big schemas usable without
changing what is stored in the deck: nothing is ever removed from the JSON, the SQL and DBML
exports, search or lint by a limit, a collapse or a filter.

## Decision

- **The row limit lives inside `tableLayout`.** `apps/app/src/editor/table-layout.ts` is the only
  place that decides which rows draw and how tall a table is, so the canvas, connector ends, hit
  areas and the exports cannot disagree. At the All detail level a table shows at most 12 rows:
  primary keys, then foreign keys, then the rest in stored order, plus every column that is the
  end of a relationship. A "Show all n columns" / "Show fewer" button replaces the old "+n more"
  pill at All; a connector to a cut column anchors on that button.
- **`expanded` is the saved choice.** `node.expanded` already exists (040) and had no reader.
  `true` lifts the limit; the key is removed at its default. It is an ordinary `oneStep` write, so
  it undoes, syncs between tabs, and works on a locked table (the lock stops moving and resizing,
  not reading).
- **`groupingMode` is a deck-level scalar.** The deck is grouped either By group (today, the key
  is absent) or By schema (`groupingMode: "schema"`), for every view. It is stored in `meta` next to
  `dialect`; only the non-default value is stored.
- **By schema is a display layer with virtual groups.** `schemaGroupedDeck` derives groups with the
  id `schema:<name>`; tables without a schema stay outside any group. Stored `group` and `parent`
  are never written, so switching modes loses nothing. Collapse, the stacked card and the merged
  "×n" connector reuse the existing group machinery.
- **Collapse is per mode through an id prefix.** `view.collapsed` stays one flat list: virtual ids
  start with `schema:`, stored group ids never do (the model skips and reports a stored group whose
  id would collide), so the two modes keep separate state without a format change.
- **Views gain `schemas` and `detail`.** `view.schemas` (non-empty list) shows tables of those
  schemas in addition to `view.includes`; `view.detail` (`names`, `keys`, `all`) is the view's
  table detail. Both are optional and removed at their default.
- **Search gains `table` and `column` kinds.** ⌘K jumps to a table by name (with schema) or to a
  column as `table.column`. The index is cached by the `nodes` identity and `searchDeck` takes a
  real limit, so the work is bounded with thousands of columns.
- **Filter, focus and temporary reveal are UI state.** The column filter text, table focus and the
  "shown only because you created it" reveal never enter the deck.
- **Unknown-key policy for older builds.** Schema v1 objects are `additionalProperties: false`, so
  a build from before 048 rejects a file holding `groupingMode`, `view.schemas` or `view.detail`
  through its normal "unknown key" validation error, and does not drop them silently. Files from
  before 048 load unchanged here, and a deck that does not use the new features is byte-identical
  after a round trip. No version bump: the keys are additive and optional.

## Alternatives considered

- **Limit rows in the table component:** the connectors and exports would need their own copy of
  the rule and would drift.
- **A per-view grouping mode:** rejected by the founder; one mode for the deck keeps views simple.
- **Writing real groups for schemas:** would change the user's data when switching modes.
- **A separate collapse list per mode:** a format change for no gain; the id prefix is enough.

## Consequences

- Three additive keys, one `pnpm schema:generate`, round-trip cases in the model tests.
- Every consumer of table geometry must read `TableLayout`; a private row rule is a bug.
- The grouping mode, view edits and Show all are one undo step each.
