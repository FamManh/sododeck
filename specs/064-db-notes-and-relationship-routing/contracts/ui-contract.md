# UI contract: 064

Accessible names and roles that component tests rely on.

## Note icon

| Where       | Element                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Row         | `<button aria-label="Show note for {column}" aria-haspopup="dialog" aria-expanded>` after the name, `NotebookText` 12 px |
| Table title | `<button aria-label="Show note for {table}" aria-haspopup="dialog" aria-expanded>` after the title, `NotebookText` 14 px |

- Rendered only when the column/table has a note and `tableDisplay.hideNotes` is not set.
- Pointer down stops propagation (no select, no drag). Click toggles the popover (`source: 'click'`).

## Column popover

`role="dialog"`, `aria-label="Column {name}"`, anchored right of the row (flips left).

1. Header: column icon, **name**, type in code font/colour (full, with size and enum name), right-aligned icon button `aria-label="Open details"`.
2. Constraints line (only those set): `Primary key`, `Foreign key → {table}.{column}`, `Not null`, `Unique`, `Auto increment`, `Default {value}`, `Check {expr}`.
3. Hairline, then `Note` label and the note as plain text (`white-space: pre-wrap`, max-height 200 px, scrolls). Absent when there is no note.

"Open details" → `openTableDrawer(tableId, { columnId })`, then close.

## Table popover

`role="dialog"`, `aria-label="Table {name}"`, anchored right of the title.

1. Header: table icon, **name**, `Open details` icon button → `openTableDrawer(tableId)`.
2. `Note` label and the full note (same text rules).

Opens only when the table has a note.

## Timing and suspension

- Hover open after 300 ms rest; switch between targets of the same table at once; close 150 ms after the pointer leaves both the target and the popover.
- Never opens while: a canvas gesture, row drag, column connect, connection, flow session, hand tool, another popover, context menu or toolbar field is active; on `pointerType === 'touch'` hover.
- At most one of {column/table popover, enum popover} is open.

## Relationship editing

- Selected relationship, rows drawn (row zoom), shape curved or elbow: bend handles (`data-kind="bend"`), midpoint/segment handles, same as card connectors; the two end handles stay `relationship-end-from` / `relationship-end-to`.
- Shape straight or self-reference: no bend handles.
- Relationship drawer: "Line type" shows the effective shape (elbow when unset) and writes via `applyLineType`; a "Reset route" control clears `route` (one undo step).
- Keyboard: existing bend shortcuts (`R` reset during bend drag, nudge) apply unchanged.

## Export

- SVG/PNG: table note text no longer drawn; table height matches the canvas. Note icons drawn when not hidden. Relationship shape and bends as on the canvas (already supported).
