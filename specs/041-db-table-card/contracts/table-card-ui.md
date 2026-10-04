# Contract: table card UI (041)

Roles, names and keys that component tests assert (Testing Library, by role and name).

## Table card (`DeckNode` with a `db-table` node)

| Element              | Role / name                                                                                                 | Notes                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Card root            | `group`, `aria-roledescription="table"`, name "Table orders, 7 columns" + existing state suffixes           | roving `tabIndex` as today               |
| Column list          | `list`, name "Columns"                                                                                      | absent with no rows                      |
| Column row           | `listitem`, text "id, uuid, primary key" / "coupon_code, text, nullable" / "customer_id, uuid, foreign key" | full text even when cut visually         |
| Key glyphs           | `img`, names "Primary key", "Foreign key", "Unique"                                                         | shapes differ (FR-010)                   |
| Enum chip            | `button`, name "order_status values"                                                                        | `tabIndex` follows the card; Enter opens |
| Enum popover         | `dialog`, name "order_status"; `list` of values, each "pending" or "pending — note"                         | Escape closes, focus returns to the chip |
| Hidden count         | `img`, name "+8 columns hidden" / "7 columns"                                                               |                                          |
| Indexes footer       | `img`, name "2 indexes"                                                                                     |                                          |
| Header detail toggle | `button`, name "Detail: Use deck setting" (cycles Keys → All → deck)                                        | in the badge slot                        |

## Context menu and toolbar

- Submenu "Detail" (radio): "Use deck setting", "Names", "Keys", "All" on `db-table` targets;
  multi-selection sets every selected table in one undo step.

## Zoom island

- `radiogroup` name "Table detail" with radios "Auto", "Names", "Keys", "All"; present only when
  the deck has a table; compact shell: `button` "Table detail: Auto" opening a menu of radios.

## Deck settings

- `region` / section heading "Database"; subheading "Show on tables"; four `switch`es named
  "Data types", "Nullable marker", "Notes", "Index footer", all checked by default.

## Export

- SVG: each table is a `<g>` with the card frame, `<text>` for title, names and types, and glyph
  paths; no `<foreignObject>`.
