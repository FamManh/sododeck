# 0046. Table rows to 31 %, elbow relationships, row-aware table layout

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** DESIGN.md "Table zoom levels", 046 research R12 (where pasted tables go), 011 Tidy
- **Feature:** founder feedback (2026-10-06) on large schemas

## Context

A schema of seven tables pasted into the DBML tab landed in one tall column. Every relationship
then left and entered on the same side and curved around the column, so the lines crossed each
other and read poorly. Zooming out to see the whole schema hid the columns from 50 %, the zoom a
schema of this size needs.

## Decision

1. **Rows to System.** Tables draw their rows at every level but Landscape (≤ 30 %). The System
   compact body (key dots and the column count) is gone; `rowsDrawn` in `levels.ts` is the one rule.
2. **Elbow by default for relationships.** `edgeShape` returns `elbow` for an edge with a
   cardinality or column ends when no line type is stored. Plain connectors stay curved. Nothing is
   written: decks keep whatever line type they stored.
3. **Row ports in the layout.** A layout edge may carry `sourceY` / `targetY`. `computeLayout` then
   gives the source a fixed port on its right side and the target one on its left side at those
   rows (`FIXED_POS`), so ELK orders tables by the rows they link. `layoutEdgeOf` builds every
   layout edge for a relationship, from the referenced table to the table holding the key. Tidy,
   the import, the DBML tab and Arrange tables all use it.
4. **Pasted tables are laid out.** The plan still places new tables synchronously, now in layers
   by relationship instead of one column. When an apply adds two or more tables, the session runs
   ELK on them in the worker and writes the positions under the apply's merge key, so the paste and
   its layout are one undo step. A table moved or removed in the meantime keeps its place.
5. **Arrange tables.** The context menu of a selection with two or more tables offers Arrange
   tables: the same layout on the selected unlocked tables, anchored at their top-left, moved right
   past other cards at their level, one undo step.

## Consequences

- One layout engine for every table arrangement; the synchronous layered placement is only the
  first position of a paste and the fallback when the worker is unavailable.
- An arrangement does not yet route lines around tables; the elbow paths are drawn as before.
