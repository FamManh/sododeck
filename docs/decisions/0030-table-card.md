# 0030. Table card: one shared layout, size follows detail, deck display in the file

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/041-db-table-card` (research R1–R15)
- **Builds on:** 0016 (export rendering), 0029 (database pack model), §g-58 (card height computed,
  never measured)

## Context

041 draws every `db-table` node as a Deck table card on the canvas and in PNG / SVG export. A
table's body is a list of fixed 24 px column rows, so its height depends on its columns, the
table's detail (Names, Keys, All), the deck's detail and four display toggles. Frame 162's
caption asks for the height to follow the zoom level as well.

## Decision

1. **One pure layout** (`apps/app/src/editor/table-layout.ts`, `tableLayout`) gives a table's
   rows (glyphs, cut name and type, nullable, enum chip), the "+n columns" / "n columns" count,
   the footer, the note lines and the height. `canvas-geometry.ts` `cardLayoutOf` routes
   `db-table` nodes to it (as it routes shapes), so card boxes, connectors, group frames, fit,
   the canvas card and the export scene all read the same numbers. Deck inputs (foreign-key
   columns, schema count, enums, display) come from `table-keys.ts`, cached by list identity and
   set per deck by `viewStateOf` (`setTableDeck`), like 032's field definitions.
2. **Size follows the effective detail, never the zoom.** Effective detail = the table's own
   `detail`, else the deck's (`tableDisplay.detail`), with Auto meaning All. Below 90 % the card
   draws System (title, key dots, column count) or Landscape (icon plate) content inside the same
   box. Frame 162's height-per-level caption is not followed (§g-93): boxes that grew on zoom
   would overlap and move connectors while zooming; pinning Keys gives the compact box.
3. **Deck display lives in the file**: root `tableDisplay` `{ detail?, hideTypes?, hideNullable?,
hideNotes?, hideIndexes? }` (absent = Auto, all shown; hide flags written `true` or removed).
   In Yjs it is `meta.tableDisplay`, a map **always present** (like `tagColors`) and written out
   only with entries, so two tabs that each set their first flag keep both; a hand-written
   empty `tableDisplay: {}` is therefore not kept on save. `setTableDisplay` writes per key, one
   undo step.
4. **Enum colour** `DbEnum.color?: ColorRef`; the chip uses the tag chip colours, neutral without
   one. One enum popover per canvas (`ui.enumPopover`), never one per chip.
5. **Stored column order**; keys are never re-sorted on the card. Foreign-key glyphs come from
   relationship column ends on the referencing side (the `n` side of `1-n` / `n-1`, else
   `from`), never from names.

## Alternatives rejected

- Measuring rows in the DOM: breaks the export (0016) and every geometry helper.
- A separate React Flow node type for tables: duplicates selection, focus, states and handles.
- Show-flags (`showTypes: true`) instead of hide flags: absent would have to mean true.
- Detail and toggles in UI state: they must export, sync across tabs and undo (041 clarify Q3).

## Consequences

- 042 anchors connectors to row centres from `tableLayout` rows; 048's row limit plugs into the
  same function (rows kept, cut count, Show all).
- A 150-table board pans within 4 % of the frame time of 150 cards (`bench-after.md`); crossing
  into Container builds every row at once, the first lever if large schemas stutter.
