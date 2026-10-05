# 0029. Database pack model: tables as nodes, relationships as edges, one id scope

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/040-db-schema-model` (research R1–R16)
- **Builds on:** 0004 (format field decisions), 0005 / 0021 (Yjs layout 2), 0020 (file format
  compatibility, deferred), 0025 (card type registry and packs), 0027 (typed fields: the
  deck-level list pattern)

## Context

The Database pack (040–049) draws database schemas inside a normal deck: tables with columns,
indexes and checks, enums, and relationships between columns. Every later feature (table cards,
crow's foot ends, drawers, SQL / DBML import and export, lint, search, flows on tables) reads one
model, so the model comes first, with no visible canvas change. It must round-trip losslessly,
keep older decks byte-identical, merge per item across tabs, and never break a reference on
rename.

## Decision

1. **A table is a node** (R1) of the new type `db-table` ("Table") in the new pack `database`
   ("Database", after `data`, before `shapes`; on for new decks). Six optional node keys follow
   `style`: `schema`, `columns`, `indexes`, `checks`, `expanded`, `detail`. Name, note, colour,
   owner, tags, links, group, parent and size are the node's own keys, so groups, views, search,
   export and drill-in work as for any card. On other types the keys are kept and ignored.
2. **Part shapes** (R2). `DbColumn { id, name, type, size?, pk?, notNull?, unique?, increment?,
default?, defaultExpr?, check?, enumRef?, note? }`; `size` is text (`255`, `10,2`); `default`
   is a typed value and `defaultExpr` SQL text, never both (**S14**); flags are written `true` or
   removed. `DbIndex { id, name?, columns, unique?, method?, note? }` with parts "column id or
   `{ expr }`". `DbCheck { id, name?, expr }`.
3. **Notes are plain text** (R3), last write wins; only the table's `description` is markdown
   (`Y.Text`).
4. **Relationships are edges** (R4) with `fromColumns` / `toColumns` (non-empty, unique, paired by
   position: one shape for simple and composite keys), `cardinality` (`1-1`, `1-n`, `n-1`, `n-n`,
   read from → to), `fromOptional`, `toOptional`, `onDelete`, `onUpdate`. Name and colour are the
   edge's `label` and `style.color`. Ends name columns only; side anchors stay in `route`.
5. **Enums are a deck-level list** (R5), root `enums` after `dialect`, not cards and not drawn;
   columns point at one with `enumRef`.
6. **One dialect per deck** (R6), root `dialect` after `fieldDefaults`; absent means `generic`.
7. **Yjs layout** (R7): `columns`, `indexes`, `checks`, `meta.enums` and each enum's `values` are
   layout-2 child lists (`Y.Map<id, Y.Map>` with `$order`), present only when stored and written
   whenever present (even empty). Index parts and column ends are whole values.
8. **One id scope** (R8) for columns, indexes, checks, enums and enum values across the deck. A
   duplicate refuses the file on load (never auto-fixed); ops refuse a taken explicit id
   (`duplicate-id`). A part id equal to a node id is allowed.
9. **Cascades** (R9), one undo step each: removing a column drops it from its table's index parts
   (an emptied index goes) and from relationships (an end of one column removes the edge; a
   composite end loses the pair at that position; a self-reference checks both ends). Removing an
   enum clears `enumRef` (the column keeps its `type`). Removing a table uses the node cascade.
10. **Paste** (R10) gives every column, index and check a new id and remaps index parts and the
    pasted edges' column ends; `enumRef` is kept.
11. **Problems** (R11): `db-dangling-reference` (an index part, a column end or an `enumRef`
    naming nothing, tables only) and `db-composite-mismatch` (ends of different lengths between
    two tables). Kept data, listed in Problems.
12. **No format revision** (R14): all keys optional and additive, no `version` bump (0020
    deferred).

## Alternatives rejected

- A root `tables[]` collection, or a nested `table: { … }` object on the node: every node feature
  would need a second path, or every reader one more level.
- `fromPort` / `toPort` as "id or id[]": a union every reader branches on, and a name that
  suggested side anchors, which `route` already holds.
- Enum cards, or enums inside the database card: an enum would be drawn, or vanish with its card
  and not be shareable by two database cards.
- `Y.Array` of plain column objects, or a whole-value `columns`: concurrent edits would replace
  whole columns, and add + reorder would duplicate or lose items (the defect 036 removed).
- Per-table id scopes: lint, search and flows (047–049) could not name a column by id alone.
- Markdown notes as `Y.Text`: ~1,800 extra shared types per 150-table deck for one-line notes.

## Consequences

- Decks saved before 040 are written back byte-identical; tables draw as generic cards until 041.
- 041–043 read and edit through the editor API (`addColumn`, `updateColumn`, …, `setDialect`,
  `deckDialect`) and draw column ends from `fromColumns` / `toColumns`.
- Two tabs adding the first enum of a deck at the same moment create two lists and one wins (the
  same limit as 032's first field definition); edits to existing enums merge per value.
- 044–046 (SQL / DBML) map `default` vs `defaultExpr`, `size` and the dialect; 047 adds schema
  lint on top of the two problem kinds.

## Amendment (042, 2026-10-04): relationship display and row anchors

- **`relationshipDisplay`** (root, after `tableDisplay`): `{ hideEnds?: boolean, labels?:
"hover" | "always" | "off", notation?: "numeric" }`, `additionalProperties: false`. Absent keys
  are the defaults (ends shown, labels follow the Labels tool, crow's foot), so untouched decks
  stay byte-identical. Yjs `meta.relationshipDisplay`, a plain map written per key, like
  `tableDisplay`; the editor op is `setRelationshipDisplay`, read through `relationshipDisplayOf`.
- **Row anchors are computed, not handles.** A relationship's ends sit on the column rows at
  `rowAnchorY(tableLayout, columnId)` (row, else the "+n columns" pill, else the title); there is
  no React Flow handle per row. Canvas, the drag hit test and the export share the pure helpers
  in `apps/app/src/editor/relationships/` and `routing/relationship-path.ts`.
- **Duplicates:** the `duplicate-connection` problem now compares column ends too, so two
  relationships between the same tables on different columns are not reported.

## Amendment (043, 2026-10-04): lock

- **`Node.locked`** (after `detail`): `const: true`, optional, on **any** node type, not only
  tables. Absent means unlocked; `false` is invalid, so unlocking removes the key and decks that
  never lock anything stay byte-identical. Yjs: a plain node key; the editor op is
  `setLocked(ids, locked)`, one undo step.
- **What it means is the app's rule, not the model's:** a locked node is not moved (drag, nudge,
  align, tidy), resized, renamed, edited (rows, line editor) or deleted from the canvas; it stays
  selectable, highlightable and a valid connector or relationship end. Undo is not an edit
  gesture, so undoing changes made before the lock still works.
- **Why generic:** the founder chose a lock for any card (clarify 2026-10-04). One flag on the
  node keeps the format small and lets later card features reuse it.
- **Paste** (same feature): the clipboard fragment, which is not the file format, gains optional
  `external` (outgoing relationships of copied tables, kept on paste only when the target table
  and columns exist) and `enums` (linked by name in the target deck, else copied with new ids).

## Amendment (052, 2026-10-04): block SQL export, enum rename rules

- **`blockSqlExport`** (root, after `dialect`): `const: true`, optional. Absent means off; `false`
  is invalid, so turning it off removes the key and decks that never use it stay byte-identical.
  Yjs `meta.blockSqlExport`; the editor op is `setBlockSqlExport`. Only the export dialog reads it:
  SQL Copy and Download are disabled while the export scope has database problems. DBML, Mermaid,
  the data dictionary and JSON still export. The SQL writer ignores it.
- **What counts as an error:** only problems with severity `error` (047 added severities).
  `schemaProblems` returns `{ errors, warnings }` for the export scope; the switch looks at
  `errors` only.
- **Enum rename rules** are app helpers over editor ops (`db/enum-edits.ts`), each one undo step:
  renaming an enum rewrites the `type` text of its linked columns; renaming a value renames
  defaults that equal the old value on linked columns. Deleting a used enum unlinks the columns
  (`enumRef` cleared) and keeps their `type` text. The model ops (`updateEnum`, `removeEnum`)
  are unchanged, so DBML sync (046) is unaffected.
- **Dialect change** converts column types in the same batch as `setDialect` (one undo step);
  enum-linked columns are not converted.

## Amendment (047, 2026-10-05): lint kinds, type data in the model, reveal override

- **Lint kinds.** `checkDeck` reports `db-no-primary-key`, `db-duplicate-table`,
  `db-duplicate-column`, `db-duplicate-index`, `db-duplicate-enum`, `db-empty-column`,
  `db-type-mismatch`, `db-null-default`, `db-fk-not-key`, `db-many-to-many`, `db-empty-enum`,
  `db-default-type`, `db-required-loop`, `db-duplicate-relationship` and `db-unknown-type`, on top
  of 040's `db-dangling-reference` and `db-composite-mismatch`. Errors: duplicates, empty column,
  type mismatch, null default on a not-null column, dangling reference, composite mismatch.
  Warnings: the rest. The rules live in `packages/model/src/db-lint.ts`.
- **Foreign key side.** A relationship's referencing end is `from`, except `1-n`, where `to` holds
  the key (the n side). Type, key and loop rules read it that way.
- **Type data moved to the model.** The per-dialect type lists, aliases, size kinds, index methods
  and `idTypeOf` (the PK type of a dialect) are in `packages/model/src/db-types.ts`, with
  `sameColumnType(a, b, dialect)`: `int` and `integer` match, `timestamptz` and `timestamp` do not
  on Postgres, sizes compare without spaces, an enum column matches only the same enum. The app's
  type picker, SQL export, type conversion and the relationship drag warning all read it
  (043's string comparison and its (!) mismatch icon on rows are replaced by the lint's
  `db-type-mismatch` row glyph and relationship pill). The app's `dialect-types.ts` and the type half of
  `table-keys.ts` are gone.
- **Row problems and the reveal override.** A table row with a problem shows its glyph in the
  key column: `TableBody` takes a `problems` prop (the table's `ProblemMark`, carried on the node's
  data so a problem change never re-measures tables). Rows are drawn only at detail levels that
  show them, so visiting a problem sets `problemReveal` (`ui-store`, `{ tableId, edges? }`), read
  through `rowEditTableId` like a focused row: the table is drawn at All until the selection
  leaves it (or its problem's relationships). Nothing is written to the deck.
- **048's row limit.** The reveal projects the table like 048's row-edit override
  (`views/view-state.ts` `withRowEdit`): detail All and expanded in the projected deck only, so a
  faulty row past the 12-row limit is drawn and can take focus.
- **Fix popover.** `problemPopover` (`ui-store`, `{ key }`) anchors the fix popover to the faulty
  row, the table header, or a relationship's midpoint; it closes when its problem is gone.
- **Junction table.** The `create-junction` fix plans (`db/junction-table.ts`) and applies one
  undo step: a new table with one column per key column of each side and two `n-1` relationships
  to the sides. The original n–n edge is removed.
