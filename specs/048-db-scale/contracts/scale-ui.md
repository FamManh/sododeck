# Contract: scale UI

Reference: DESIGN.md "Database pack", frames 158, 162, 163. Tokens only; no hard-coded colours.

## Show all / Show fewer

- Dashed 1.5 px Border-strong button, card width − 24, 24 tall, radius 8, Geist 11.5 / 500 Secondary,
  6 px above it. Text "Show all {n} columns" / "Show fewer"; accessible name the same text;
  `aria-expanded` reflects `expanded`.
- Shown only when at least one row is hidden at All (or when opened, if the table has > 12 columns).
- Click toggles `expanded` (one undo step). Works on locked tables.
- Hidden-column connector ends anchor at the button's vertical centre on the facing side.

## Column filter

- ⌘F / Ctrl+F with one table selected: the type tile becomes an input (label "Find a column in
  {table}") and a counter "{k}/{n}" (live region). Enter / Shift+Enter next / previous match
  (scrolls the match into view). Esc or clearing closes it. Matches: Orange Soft fill, name 600
  Orange Ink. Non-matches fold behind the button.

## Grouping mode (Deck settings → Database)

- Segmented control "By group | By schema". Group label for a schema: the schema name. Collapsed
  card: "{n} tables · {m} relationships". Merged connector: "×n" pill; popover lists
  "table.column → table.column · cardinality".

## Views

- View settings: Schemas (checkbox list), Tables (picker over `includes`), Detail (Names · Keys ·
  All · Deck default). Empty result: "No tables match this view" + "Edit filter".
- Outside proxy per hidden table (dashed, table name); click → "Show in {view}".
- Table created outside the filter: shown with note "Outside this view's filter" and button
  "Add to this view".

## Jump to (⌘K)

- Rows: table (schema, "{n} columns") and column ("table.column", type, key marker). Table
  results first. Cap with "n more". Hidden results: "Hidden in this view · Show in {view}" or
  "In collapsed schema · Expand schema". Enter on a column: expand if cut, select row, centre.

## Focus (F)

- Unchanged control. Kept set: selected table + one-hop neighbours; relationships among kept
  tables highlighted; collapsed group of a neighbour stays at full strength.
