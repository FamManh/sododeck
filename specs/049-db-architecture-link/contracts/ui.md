# Contract: UI behaviour

Design tokens only, `lucide-react` icons, light and dark themes, English copy. Where a visual is
undecided, the implementation follows `DESIGN.md` "Database pack" and "Card system (Deck)" and the
design frames for drill-in (118) and playback (123–124); anything not covered is settled in the
design pass of the tasks and noted in the report.

## 1. Database card face

- Body line: "12 tables inside" (singular "1 table inside"; "No tables yet" when none).
- A chip with the deck dialect ("Generic", "Postgres", "MySQL", "SQLite"). Changing the dialect
  updates every database card.
- Enter or double-click opens "Inside <card>" (existing 034 behaviour; no new shortcut).
- The card keeps its existing selection, lock and quick-edit behaviour.

## 2. Actions (context menu, inspector, command list)

| Action                 | Where                                     | Behaviour                                                                                                                                                           |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move to database…      | table context menu; table inspector field | Lists the deck's database cards; picking one calls `setTableOwner`. Disabled with a reason when the deck has no database card.                                      |
| Remove from card       | same                                      | `setTableOwner(table, null)`. Shown only when the table has an owner.                                                                                               |
| Export SQL             | database card context menu and inspector  | Opens the export dialog seeded `{ format: 'sql', scope: 'database' }`. Disabled with a reason when the card has no tables. A Generic deck asks for a dialect first. |
| Delete (database card) | existing delete flow                      | Confirmation states "N tables are kept and become unowned" using `previewRemoval`.                                                                                  |

Locked tables: Move / Remove are edits, so they follow the lock (disabled with a reason).
Playback marks never depend on the lock.

New tables created while drilled into a card get `parent` = that card. Tables created at the top
level stay unowned.

## 3. Step inspector: "Touches" section

In `inspector-step.tsx`, a new `PanelSection` "Touches":

- One row per touch: access toggle, icon, label `table` or `table · column`, remove button.
  - The access toggle is a two-state control labelled **Read** / **Write** (accessible name
    "Access for orders: write"); the visible marker is the letter plus a distinct shape, not
    colour alone.
- "Add table or column…" opens a search field (combobox). Typing filters tables by name and columns
  by "table.column"; each result shows its owner card (or "No database") as context. Choosing a
  table adds a row; choosing a column adds a column row.
- A duplicate pair is not added (the existing row is focused).
- Fully keyboard operable (arrow keys, Enter, Esc, Delete on a focused row).
- Empty state: "This step touches no tables."

## 4. Playback

At **architecture level** (not drilled in):

- A database card owning a touched table shows a chip on the current step: "writes orders +1" or
  "reads orders" (first touch in step order; "+n" is the number of other touched tables of that
  card). The chip text includes the verb, so read and write differ without colour.
- A card inside a collapsed group merges its chip onto the group's stacked card.
- A step touching a table with no owner shows no chip; the table is named in the step player.

**Drilled into** a database card:

- Every touched table in scope is lit as the current step (same treatment as a card on the current
  step).
- Touched column rows carry an **R** or **W** marker and stay visible even when the table would
  fold rows (`forcedColumnIds`, R3).
- The step player and flow chip stay on screen; Next / Previous update the lit tables.
- The step player adds a line "also touches: Customers DB · invoices" for touched tables in other
  cards and "… (hidden in this view)" for tables hidden by a filtered view. The saved filter is
  never changed.

Steps with no `touches` render and play exactly as before.

## 5. Accessibility

- Every new control has an accessible name; focus is visible; the combobox follows the existing
  palette's keyboard pattern.
- Read / Write, lit and chip states differ by text and shape, never colour only.
- Screen reader: the lit table announces "current step, writes" through its accessible name.

## 6. Component tests (Testing Library, roles and labels)

- Card face: count, singular, empty, dialect chip updates.
- Move to database: list, disabled reason, result moves count between two cards.
- Touches: add table, add column, flip access, remove, duplicate ignored, keyboard path.
- Playback: card chip text ("writes orders +1"), merged chip on a collapsed group, lit tables and
  R / W markers when drilled in, forced-visible touched row, player "also touches" lines, Next
  while drilled in keeps the player.
