# Contract: Lint UI (047)

Frames 144, 161 (problem state), 167; light and dark. Decisions: research R4–R9.

## Files

```text
apps/app/src/editor/problems/
├── problems-panel.tsx          # severity filter, severity icons, fix buttons
├── severity-icon.tsx (new)     # CircleX (error, clay) / TriangleAlert (warning, amber), labelled
├── apply-fix.ts (new)          # applyFix(ctx, problem, fix): one step, announce, refuse locked
├── problem-fix-popover.tsx (new)
├── problem-marks.ts            # severity, rows, short
└── go-to-problem.ts            # row focus, reveal, popover
apps/app/src/db/junction-table.ts (new)       # planJunction, applyJunction
apps/app/src/editor/table/table-body.tsx      # row glyph replaces key glyph
apps/app/src/editor/deck-edge.tsx             # dashed severity line + short pill
apps/app/src/editor/shell/rail.tsx            # badge colour
apps/app/src/editor/export/schema-problems.ts # { errors, warnings }
```

## UI store (never saved)

```ts
problemFilter: 'all' | 'error' | 'warning';        // reset on deck switch
problemPopover: { key: string } | null;             // closes when the problem is gone
problemReveal: { tableId: Id } | null;              // table drawn at All; cleared when the selection leaves it
```

## Problems list

- Header "Problems", segmented control `All n · Errors n · Warnings n`.
- Row: severity icon, title (the detail line as today), object chip, fix buttons on the right (`Add id uuid PK →`, `Change type →`, `Pick column →`, `Rename →`, `Create →`, `Add values →`, `Remove default`, `Allow null`, `Delete duplicate`). A disabled fix on a locked table shows `Locked · unlock to fix`.
- Clicking the row goes to the problem; clicking a fix applies it without moving the list.

## Fix labels

| Fix               | Label                 | Announcement                                    |
| ----------------- | --------------------- | ----------------------------------------------- |
| `make-pk`         | Make id the PK        | `id is now the primary key of audit_log`        |
| `add-id-pk`       | Add id uuid PK        | `Added id uuid as the primary key of audit_log` |
| `match-type`      | Change type           | `customer_ref is now uuid`                      |
| `create-junction` | Create junction table | `Created products_categories`                   |
| `remove-default`  | Remove default        | `Removed the default of orders.status`          |
| `allow-null`      | Allow null            | `orders.status now allows null`                 |
| `delete-edge`     | Delete duplicate      | 043's Undo toast                                |
| `rename`          | Rename                | —                                               |
| `pick-column`     | Pick column           | —                                               |
| `add-values`      | Add values            | —                                               |
| `pick-type`       | Change type           | —                                               |

## Fix popover

Anchored to the faulty row, else the table header, else the edge midpoint; 8 px gap; popover tokens. Content: severity icon + title, detail, fixes (primary as the filled button). Esc or outside click closes it and returns focus to the canvas row. Opening another problem replaces it.

## Canvas

- Table header badge: severity icon + count, clay for any error, amber for warnings only; dashed outline in the same colour (today's `has-problem` style, coloured by severity).
- Row glyph: replaces the key / link glyph; tooltip and accessible name = problem title + detail; colour by severity; the key glyph returns when the problem is gone.
- Relationship: dashed line in the severity colour while it has a problem; `short` pill at the label point (`int → uuid`, `n–n`, `not key`, `loop`), mono 11, severity colours.
- Rail badge: clay with errors, amber with warnings only.

## Export dialog

Banner: `n errors · n warnings in <scope>` (parts omitted when 0), errors listed first, then warnings, first 2 details, "Show problems". `sqlBlocked` = block switch on, SQL chosen, `errors > 0`.
