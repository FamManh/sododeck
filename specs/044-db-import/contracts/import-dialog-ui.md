# Contract: Import dialog and report (044)

UI behaviour. Look: frames 138 (dialog) and 139 (report, toast); `packages/ui` dialog,
segmented control, select, radio group, checkbox, button (§g-86); tokens only; lucide icons.
Frame 139's dashed "suggested" lines and enum card are **not** built (spec Clarifications Q3;
040 / 041).

## Entry points

| Where                        | Label                 | Condition                                  |
| ---------------------------- | --------------------- | ------------------------------------------ |
| Empty-canvas card            | "Import SQL or DBML"  | Database pack on (030 packs)               |
| Add flyout (palette) footer  | "Import SQL or DBML…" | Database pack on                           |
| Deck ≡ menu, after "Import…" | "Import SQL or DBML…" | Always                                     |
| Deck ≡ menu                  | "Last import report"  | A report exists for this deck this session |

Opening sets `ui-store.importDialog {open, returnFocus}` (same shape as `exportDialog`); the
dialog chunk is lazy (`React.lazy`), like the export dialog.

## Dialog (frame 138)

- Title "Import SQL or DBML", subtitle "Paste statements or drop a .sql / .dbml file.", close ✕
  and Esc.
- **Paste | File** segmented control. Paste: line-numbered textarea (`aria-label="SQL or DBML
text"`). File: drop zone + "Choose file" button; accepts `.sql`, `.dbml`, `.txt`, ≤ 5 MB;
  other / bigger files show an inline error, no read. Dropping a file on Paste switches to File.
- **Format / dialect select** (SQL): "Auto · <Dialect> detected" | "Auto · not detected" |
  Postgres | MySQL | SQLite. DBML shows "DBML" (disabled select).
- **Preview line** (`role="status"`, polite): "8 tables, 9 relationships, 1 enum · 2 statements
  will be skipped" | "Reading…" | "Paste SQL or DBML, or drop a file" | "Line 12: <message>"
  (error styling + icon, not colour only).
- **Dialect notice** (when `dialectOutcome` is `convert` or `keep-generic`): "This deck is
  Postgres: 12 column types will be converted" + first 3 conversions + "A new deck keeps
  MySQL."; or "This deck is Generic: types are kept as written."
- **Target** radio cards: "Import into <card>" | "Import into this deck", and "New deck".
- **Checkbox** "Detect foreign keys by name (customer_id → customers.id)", checked.
- **Footer**: Cancel (Esc) · primary "Import n tables" (disabled when 0 tables, an error, or
  reading). While planning / placing: button shows "Importing…" and is disabled; Cancel stops it.

## After import

- Toast "Imported n tables, n relationships, n enums" with Undo (`showUndoToast`) and a "Report"
  action.
- View fits the imported tables.
- **Import report** flyout (id `import-report`, beside the rail, `Flyout` container):
  - **Mapped**: chips with counts (tables, relationships, enums, indexes; groups / stickies when
    > 0).
  - **Skipped · n**: rows "L88 · CREATE VIEW order_totals · views are not modelled"; > 20 of one
    reason collapse to "and 37 more INSERT statements".
  - **Changed · n**: rows with line when known.
  - **Foreign keys by name · n**: rows "orders.customer_id → customers.id" with Accept (✓) and
    Dismiss (✕) icon buttons (`aria-label` "Accept orders.customer_id → customers.id"); accepted
    rows show "Added". Accept all / Dismiss all. Pointer hover or keyboard focus on a row sets
    `hoverFocus` for both column rows (042 highlight); leaving clears it.
- Closing the flyout keeps the report until the deck closes.

## Accessibility

All controls reachable by Tab in reading order; the drop zone is a button; the preview line and
parse error are a polite live region; report sections are headings with lists; Accept / Dismiss
have names; focus returns to the trigger on close.
