# Feature Specification: Database notes on hover and relationship reshaping

**Feature Branch**: `064-db-notes-and-relationship-routing`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Database feedback: (1) a relationship connector cannot be dragged to adjust its path the way a card connector can; (2) columns do not show their comment (e.g. `Table users { id int [pk, note: 'Unique user ID'] email varchar [not null, note: 'Used for sign-in'] Note: 'Stores registered users' }`). A table row has little room, so anything with a lot of information is cut off. Hovering a column should open a popover (name, type, note), and hovering a table header should open a popover (table name, note)."

## Context

Founder manual testing of the Database pack (040–052) found two gaps.

1. **Relationships can't be reshaped.** A card connector (022, 050) can be selected and its path adjusted: bends can be added and dragged, a segment can be dragged, and the route can be reset. A relationship between two tables only offers its two end handles, which move an end to another row. When relationships cross tables or each other, the user has no way to steer the line around them.
2. **Notes are invisible on the canvas.** A column note and a table note are already part of the deck: they are imported (from DBML and SQL comments), exported, and editable in the details drawer. But a column's note is never shown on the canvas, and a table's note is shown only as a few clamped lines under the title. A table row is narrow, so a long type, a default value or a note cannot be read without opening the drawer.

The reference look comes from the founder's screenshots: a small popover beside the hovered row (or header), with a header line (icon, name, type in the code colour, an "open details" icon on the right), a hairline, a "Note" label and the note text. Rows and headers that carry a note show a small note icon after the name.

## Clarifications

None yet. Decisions taken by default are listed under Assumptions.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read a column's note and full details on hover (Priority: P1)

A user looking at a schema hovers a column row. After a short delay a popover opens beside the row showing the column's name, full type, its constraints and its note, so the user understands the column without opening the drawer.

**Why this priority**: Notes are the main way a schema explains itself. Today they are captured on import and then hidden; this is the most visible gap and the founder's main request.

**Independent Test**: Import the `users` example from the input. Hover the `email` row: a popover shows `email`, `varchar`, the "not null" constraint and the note "Used for sign-in". The `email` and `id` rows show a note icon; a row without a note does not.

**Acceptance Scenarios**:

1. **Given** a column with a note, **When** the user rests the pointer on its row, **Then** a popover opens beside the row showing the column name, its full type, its constraints and the note text in full (wrapped, not cut).
2. **Given** a column with a note, **When** the table is drawn, **Then** the row shows a note icon after the column name, at every zoom level where the column name is drawn.
3. **Given** a column without a note, **When** the user hovers its row, **Then** the popover still opens and shows name, type and constraints, without a Note section.
4. **Given** an open column popover, **When** the user moves the pointer to another row, **Then** the popover moves to that row without a second delay.
5. **Given** an open column popover, **When** the pointer leaves the table and the popover, or the user presses Escape, **Then** the popover closes.
6. **Given** an open popover, **When** the user activates its "open details" button, **Then** the details drawer opens on that column.
7. **Given** a keyboard user with a row focused (043 row focus), **When** focus rests on the row, **Then** the same popover opens and its content is announced to assistive technology.

---

### User Story 2 - Read a table's note on hover (Priority: P1)

A user hovers a table's header. A popover opens beside the header showing the table name and its full note.

**Why this priority**: Same need as US1 at the table level. The note under the title is cut to a few lines today, so long table notes can't be read on the canvas.

**Independent Test**: With the `users` example, hover the `users` header: a popover shows `users` and the note "Stores registered users". The header shows a note icon after the name.

**Acceptance Scenarios**:

1. **Given** a table with a note, **When** the user rests the pointer on its header, **Then** a popover opens beside the header with the table name and the full note.
2. **Given** a table with a note, **When** the table is drawn, **Then** the header shows a note icon after the table name.
3. **Given** a table without a note, **When** the user hovers its header, **Then** no popover opens (there is nothing beyond what the header already shows).
4. **Given** the table popover is open, **When** the user activates its "open details" button, **Then** the details drawer opens on that table.

---

### User Story 3 - Reshape a relationship like a card connector (Priority: P2)

A user selects a relationship between two tables and adjusts its path the same way as a card connector: drags a segment, adds and drags bends, and resets the route. The ends stay attached to their rows.

**Why this priority**: Important for readable large schemas, but schemas stay usable without it (auto-layout and table moves already help). It also touches the shared connector editing code, so it is the riskiest slice.

**Independent Test**: Draw two tables with a relationship that crosses a third table. Select the relationship, drag its middle segment away from the third table, release: the line keeps the new path, survives reload, undo restores the old path.

**Acceptance Scenarios**:

1. **Given** a selected relationship, **When** the user drags a segment or a midpoint handle, **Then** the line follows the pointer until release and keeps the new path.
2. **Given** a selected relationship, **When** the user drags an existing bend, **Then** the bend follows the pointer until release.
3. **Given** a reshaped relationship, **When** either table is moved, **Then** the bends move with the tables the same way they do for card connectors, and the ends stay on their rows.
4. **Given** a reshaped relationship, **When** the user runs the existing reset route command, **Then** the relationship goes back to its automatic path.
5. **Given** a reshaped relationship, **When** the user drags an end handle to another row, **Then** the end moves to that row as today (042) and the bends are kept.
6. **Given** a reshaped relationship, **When** the user undoes, **Then** the previous path comes back in one step per drag.
7. **Given** a reshaped relationship, **When** the deck is exported to `.sododeck` and opened again, **Then** the path is identical.

---

### Edge Cases

- A very long note (several paragraphs): the popover has a maximum width and height; longer text scrolls inside the popover.
- A note with line breaks: kept as line breaks. A note is plain text (schema `DbNote`); it is not rendered as markdown or HTML.
- Hover during a drag (table move, connector drag, marquee selection, column drag): no popover opens; an open one closes when the drag starts.
- The column's enum chip already has its own hover popover (052). Hovering the chip shows the enum popover, not the column popover; the two never show at once.
- Zoomed far out where rows are not drawn (semantic zoom): no column popovers; the table header popover still works where the header is drawn.
- A row hidden by the table filter or collapsed detail (048): not hoverable, so no popover.
- Popover near the viewport edge: it flips to the other side of the table, or shifts, so it stays fully visible.
- Read-only states (locked table, playback, presentation): popovers still open; the "open details" button opens the drawer in its existing read-only mode.
- Touch devices: no hover; a tap on a row selects it as today, and the popover is not shown (the drawer remains the way to read notes).
- A relationship whose ends are on the same table (self-reference): it can be reshaped too.
- A composite relationship end (several columns): the ends still cannot be dragged (042 rule), but the path can be reshaped.
- A column renamed or retyped while its popover is open: the popover shows the new values.

## Requirements _(mandatory)_

### Functional Requirements

**Column and table popovers**

- **FR-001**: Resting the pointer on a visible column row for a short delay MUST open a popover beside that row.
- **FR-002**: The column popover MUST show the column name, its full type (with length/precision), its constraints (primary key, foreign key, not null, unique, default value, auto-increment, as available) and, when present, its note in full under a "Note" label.
- **FR-003**: Resting the pointer on a table header MUST open a popover beside the header when the table has a note, showing the table name and the full note.
- **FR-004**: Each popover MUST include an "open details" button that opens the details drawer on that column or table.
- **FR-005**: A row whose column has a note and a header whose table has a note MUST show a note icon after the name, wherever the name is drawn.
- **FR-006**: Moving the pointer from one row (or header) to another of the same table while a popover is open MUST switch the popover immediately, without the opening delay.
- **FR-007**: A popover MUST close when the pointer leaves both the hovered element and the popover, when Escape is pressed, or when a drag or edit starts; the pointer MUST be able to move into the popover (e.g. to scroll or press its button) without closing it.
- **FR-008**: Popovers MUST NOT open during any drag, connection or selection gesture, and MUST NOT open over a row that is not drawn.
- **FR-009**: Keyboard focus on a row (043) or a table MUST open the same popover, and its content MUST be exposed to assistive technology.
- **FR-010**: Note text MUST be shown as plain text with line breaks kept, wrapped, and scrollable past a maximum height; it MUST never be interpreted as markup.
- **FR-011**: The column popover and the existing enum chip popover MUST never be shown at the same time.
- **FR-012**: Popovers MUST stay fully inside the visible canvas area.

**Relationship reshaping**

- **FR-013**: A selected relationship MUST offer the same path controls as a card connector of the same shape: segment/midpoint drag and bend drag, with the same feel (follows the pointer until release, handles above tables).
- **FR-014**: The relationship's ends MUST stay attached to their rows while its path is reshaped; the existing end handles (move to another row) MUST keep working.
- **FR-015**: A reshaped path MUST be stored in the deck, survive reload and `.sododeck` export/import unchanged, and be undoable one drag per step.
- **FR-016**: The existing reset route command MUST return a relationship to its automatic path.
- **FR-017**: When a table moves, a reshaped relationship's bends MUST follow the same rule as card connector bends.
- **FR-018**: Reshaping MUST NOT change the relationship's columns, cardinality, label or lint state.

### Key Entities

- **Column note**: optional plain-text note on a database column. Already in the file format (schema `DbNote`); imported from DBML `note:` and SQL comments, exported, editable in the drawer. This feature only displays it.
- **Table note**: optional plain-text note on a table. Already stored and partly displayed; this feature adds the icon and the full popover.
- **Relationship path**: the bends of a relationship's line. Card connectors already store bends; this feature lets relationships store and edit them the same way.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For any column, its full type, constraints and note can be read on the canvas by hovering alone, with no drawer opened, in 100 % of cases where the row is drawn.
- **SC-002**: The popover appears within half a second of the pointer resting on a row, and switching between rows of an open table feels instant (no second delay).
- **SC-003**: Importing the `users` example from the input shows note icons on `users`, `id` and `email` and both notes are readable by hover, with no other step.
- **SC-004**: A user can route a relationship around a table that it crosses in a single drag, and the new path is still there after reload.
- **SC-005**: Canvas performance on the standard benchmark (500 nodes / 1,000 edges) shows no measurable regression from the note icons and hover handling.
- **SC-006**: Every popover passes the existing accessibility checks (focus, role, contrast) in both light and dark themes.

## Assumptions

- **Default decisions (no founder answer yet):**
  - Hover delay is about 300 ms to open and about 150 ms of grace to close, so moving the pointer into the popover does not close it.
  - The table popover only opens when the table has a note; a header with no note has nothing more to show.
  - The column popover opens for every column (with or without a note), since a narrow row also cuts long types and defaults.
  - The "open details" button in the screenshots (book icon) opens the existing details drawer; there is no new detail view.
  - The table note already drawn under the title (041) stays as it is; the popover adds the full text.
  - Notes are read-only in the popover; editing stays in the drawer (052).
  - Relationship reshaping reuses the card connector's bend model and its rule for bends when cards move; relationship ends do not gain free sliding along a side (042 FR-006 stays).
  - Touch devices get no popover in this feature.
- Visual look follows DESIGN.md tokens (panel radius, surface, border, code colour for the type) and `lucide-react` icons, matched to the founder's screenshots for layout only.
- No file format change is expected for notes. If storing relationship bends needs a format change, it goes through `packages/schema` and `packages/model` with round-trip tests.
- Out of scope: editing notes inline on the canvas, markdown in notes, notes on relationships, index and enum-value notes on the canvas, touch long-press popovers.
- Depends on 041 (table card), 042 (relationships), 043 (row focus), 048 (filters/semantic zoom), 050 (connector editing) and 052 (drawer, enum popover), all merged.
