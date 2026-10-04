# Feature Specification: Table Card

**Feature Branch**: `041-db-table-card`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "41 from docs/backlog-database.md" — Tables draw as Deck-style table cards that stay readable from one table to a dense board: header, title, note, fixed-height column rows (key marker, name, type, nullable), indexes footer, palette colour; detail levels (names / keys / all) per table and per deck with semantic zoom on top; display toggles; enum columns show their values on hover; PNG / SVG / PDF export draws table cards.

**Sources**: `docs/backlog-database.md` §041 (scope, draft acceptance criteria, risks), §040 (model this feature reads), §042 (connectors to columns, crow's foot ends, relationship display), §043 (editing, Deck settings Database section, dialect), §048 (row limit, Show all, in-table search, saved views with detail level, 150-table bench); founder decisions DB3 (Deck card system only), DB7, DB9, DB11; `specs/040-db-schema-model/` (spec with clarify 2026-10-04: `db-table` type, enums are a deck-level list shown on hover, deck-wide ids; data-model.md); DESIGN.md "Card system (Deck)" and "Database pack" (tokens, glyphs, table zoom levels, contrast); design-analysis §a frames 135, 140, 146, 149, 152, 156, 157, 161, 162, 163, 165 and §g-87 (table width 240, computed), §g-90 (type text contrast on tinted rows), §g-58 (card height computed, never measured); ADR 0016 (export rendering), ADR 0025 (card type registry); constitution v1.0.0.

**Dependency note (2026-10-04)**: 039 (design import) and 029 (Deck card look) have merged. **040 (model) is specified (PR #78) but not implemented yet**; 041 cannot start implementation until 040 is merged. 041's format additions (FR-025) extend 040's shapes.

## Scope

**In scope**

- **Table card** for every card of type Table: header (table tile, type name "Table" or "Table · schema", badge slot), one-line title, optional note (at most 2 lines), a hairline, **fixed-height column rows** (key glyph slot, name, type text, nullable marker), indexes footer ("2 indexes"); card colour from the palette; width 240 by default; height computed from content.
- **Column row glyphs**: primary key, foreign key, both, unique, nullable "?", enum type as a chip.
- **Enum values on hover**: hovering or focusing an enum column's type chip shows the enum's name and ordered values (with their notes).
- **Detail levels**: Names / Keys / All, per table and for the whole deck, with semantic zoom (Landscape, System, Container, Component) deciding how much draws when nothing is pinned.
- **Table display toggles** for the deck: data types, nullable marker, notes, index footer.
- **States** that already exist for cards: hover (card and row), selected, dimmed (focus), dragged, collapsed to keys. (Locking a table is 043's; no lock state exists yet.)
- **Export**: PNG and SVG draw table cards as on the canvas. (PDF export does not exist yet; it draws tables when it is added.)
- **Format additions** (additive, on top of 040): an optional enum colour and optional deck-level database display settings.
- **Performance**: a board of 150 tables stays as smooth as 150 ordinary cards.

**Out of scope**

- Connectors anchored to column rows, crow's foot ends, relationship notation and label toggles, highlighting a column's relationships (042).
- Editing tables or columns, row selection and editing states, the drawer, the type picker, the dialect select and the rest of the Deck settings Database section (043).
- Row problems from schema lint (047), R / W markers from flow playback (049).
- Row limit of 12, "Show all n columns" / "Show fewer", in-table column search, per-view detail levels and the 150-table bench entry (048).
- An enum card on the canvas (dropped in 040 clarify; frame 165's enum card is not built).

## Clarifications

### Session 2026-10-04

- Planning correction (2026-10-04): cards never change size with zoom in Sododeck, so a table's size follows its effective detail, not the zoom; Auto draws all rows from 90 % (frame 162's "keys at Container" is reached by pinning Keys). PDF export and table locking do not exist yet and were removed from scope.

- Q: Do columns draw in stored order or always keys first? → A: Stored order (the user's order). Import (044) and new columns (043) place keys first when they create columns; reordering by drag (043) always takes effect.
- Q: How is an enum's chip colour chosen? → A: A new optional colour on the enum (additive format field, picked in 043); without one the chip is neutral.
- Q: Where are the deck detail setting and the table display toggles stored? → A: In the deck file (exported, synced across tabs, one undo step per change), as new optional deck-level fields.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a table as a table (Priority: P1)

An engineer imports the "Shop" schema. Each table shows as a card: the header says "Table · public", the title is `orders`, its note reads "One row per checkout…", and below a hairline every column is one row: a key glyph for `id`, a link glyph for `customer_id`, a "U" square for `number`, the name, and the type on the right in monospace (`uuid`, `text`, `timestamptz`). `coupon_code` shows "text ?" because it can be empty. `status` shows `order_status` as a chip. The footer says "2 indexes".

**Why this priority**: without this, a schema is just generic cards and the Database pack has no visible value. One readable table is already useful.

**Independent Test**: import the "Shop" deck, compare the `orders` card with frame 156 (light and dark), and check every glyph and text against the column data.

**Acceptance Scenarios**:

1. **Given** a table with a primary key, a foreign key, a unique column, a nullable column and an enum column, **When** it is on the canvas at 100 %, **Then** each row shows the matching glyph (key, link, "U" square, "?" after the type, enum chip) and rows are all the same height.
2. **Given** a column that is both primary key and foreign key, **When** the table is drawn, **Then** that row shows both glyphs and the key slot widens for every row of that table so names stay aligned.
3. **Given** a deck whose tables all use one schema name (or none), **When** the tables are drawn, **Then** the header says "Table"; **Given** a deck with tables in two schemas, **Then** each header says "Table · <schema>".
4. **Given** a table with 12 columns, **When** the zoom changes from 30 % to 200 %, **Then** the card keeps the same size on the canvas; only how much it shows changes.
5. **Given** a long table name or column name, **When** it does not fit, **Then** it is cut with an ellipsis and the full text shows as a tooltip; a long type is cut before the name is.
6. **Given** a table with no columns, **When** it is drawn, **Then** it shows header and title only, with no hairline and no footer.
7. **Given** a table with a palette colour, **When** it is drawn in light and dark themes, **Then** it uses the same colour treatment as other Deck cards, and every text meets the contrast pairs listed in DESIGN.md (with the §g-90 fix on tinted rows).

---

### User Story 2 - See an enum's values without leaving the table (Priority: P1)

The engineer wonders what `status` can hold. They hover the `order_status` chip and a small popover lists `pending`, `paid`, `shipped`, `cancelled`, with any notes. Moving away closes it.

**Why this priority**: enums are not drawn on their own (040 clarify); the hover is the only way to see their values on the canvas.

**Independent Test**: hover and keyboard-focus an enum chip and check the popover content and its accessible name.

**Acceptance Scenarios**:

1. **Given** a column linked to an enum with four values, **When** the user hovers the type chip, **Then** a popover shows the enum's name and its values in order, each with its note if it has one.
2. **Given** the table is focused with the keyboard, **When** the user moves focus to the enum chip and presses Enter (or focus lands on it), **Then** the same popover opens and Escape closes it.
3. **Given** a column whose enum link names an enum that does not exist, **When** it is drawn, **Then** the chip shows the column's type text without a popover.
4. **Given** an enum with no values, **When** its chip is hovered, **Then** the popover says "No values".

---

### User Story 3 - Choose how much detail tables show (Priority: P1)

A large schema is too busy. The architect sets the deck's detail to **Keys**: every table now shows only its key columns, with a "+8 columns" pill. For `orders`, the one table they are working on, they choose **All** from its context menu. Zooming out, tables fall back to names and key dots, then to a coloured tile with the table icon.

**Why this priority**: readability from one table to a dense board is the goal of the feature; without detail levels, large schemas are unreadable.

**Independent Test**: on the "Shop" deck, switch the deck detail and one table's detail, then zoom through the four zoom levels, comparing with frames 162 and 157.

**Acceptance Scenarios**:

1. **Given** nothing is pinned (Auto), **When** the zoom is ≤ 45 %, 45–90 % and 90 % or more, **Then** a table shows the icon on its colour fill; name, key dots and column count; all rows — always at the same card size (sized for all rows).
2. **Given** the deck detail is pinned to Names, Keys or All, **When** the zoom is 90 % or more, **Then** every table shows title only, key rows (primary and foreign keys) with "+n columns", or all rows, and is sized for what it shows; below 90 % it draws the System or Landscape content inside that same size.
3. **Given** the deck is pinned to Keys, **When** one table is set to All (context menu or header toggle), **Then** that table shows all rows and the others keep Keys; the table's choice is saved in the deck and survives reload.
4. **Given** a table set to Keys, **When** it is drawn, **Then** its top-left corner does not move and only its height changes.
5. **Given** a table with no key columns at Keys, **When** it is drawn, **Then** it shows the title and "+n columns".
6. **Given** a table's own detail is set, **When** the user chooses "Use deck setting", **Then** the table's choice is removed and it follows the deck again.

---

### User Story 4 - Turn table parts on and off for the deck (Priority: P2)

The architect presents the schema to product people and turns off data types and nullable markers so only names and keys remain. Later they turn off notes to make tables shorter.

**Why this priority**: useful for presenting and for dense boards, but tables are readable without it.

**Independent Test**: toggle each switch and check every table on the canvas and in export.

**Acceptance Scenarios**:

1. **Given** "Data types" is off, **When** tables are drawn, **Then** no type text or enum chip shows and names use the freed width.
2. **Given** "Nullable marker" is off, **When** tables are drawn, **Then** no "?" shows.
3. **Given** "Notes" is off, **When** tables are drawn, **Then** table notes are hidden and the cards get shorter.
4. **Given** "Index footer" is off, **When** tables are drawn, **Then** the footer is hidden.
5. **Given** any toggle is changed, **When** the deck is exported as PNG or SVG, **Then** the export matches the canvas.

---

### User Story 5 - Export a schema as an image or document (Priority: P2)

The engineer exports the schema as SVG for a design doc and as PNG for a chat thread. Tables look the same as on the canvas.

**Why this priority**: sharing the schema outside Sododeck is a main use; the export pipeline already exists for cards.

**Independent Test**: export the "Shop" deck to PNG and SVG and compare with the canvas at the same detail.

**Acceptance Scenarios**:

1. **Given** the "Shop" deck at deck detail All, **When** it is exported as SVG, **Then** every table shows the same rows, glyphs, texts and colours as the canvas, and text stays selectable text.
2. **Given** a table set to Keys, **When** it is exported, **Then** it shows the same key rows and "+n columns" pill as on the canvas.
3. **Given** a dark theme on screen, **When** exporting, **Then** the export follows the existing export theme rule (unchanged from 012).

### Edge Cases

- **Column with an unknown or empty-looking type** (e.g. a 60-character custom type): cut with an ellipsis at 58 % of the row; tooltip shows the full type.
- **Composite primary key**: every member row shows the key glyph.
- **Foreign key detection**: a column is a foreign key when it is a column end on the referencing side of a relationship (see Assumptions); a column named `customer_id` with no relationship has no link glyph.
- **Table-only fields on a non-table card** (kept by 040): ignored; the card draws as its own type.
- **A table switched to another type and back** (type picker): its columns are kept and draw again.
- **Table inside a Database card** (drill-in, 034): draws the same inside the drill-in view; the Database card outside shows its normal card.
- **Collapsed group** containing tables: members show as today (029 group collapse); no column rows.
- **Card size**: a stored width is used; a stored height is ignored for tables (height is always computed from content), so resizing changes width only.
- **Hundreds of columns** (before 048's row limit): all rows draw at All; the card is tall but rows stay fixed height and scrolling the canvas stays smooth.
- **Reduced motion**: no animation is added; detail changes happen instantly.
- **Narrow window (900 px)**: the deck detail control appears in its compact form (frame 146).

## Requirements _(mandatory)_

### Functional Requirements

**Table card**

- **FR-001**: Every card of type Table MUST draw as a table card: header (table tile with the table icon, type name, badge slot), title on one line, note (up to 2 lines, cut with an ellipsis), hairline, column rows, indexes footer, following the Deck card frame, padding, lip, palette and states.
- **FR-002**: The type name MUST read "Table" when the deck's tables use at most one schema name, and "Table · <schema>" on every table when they use two or more.
- **FR-003**: A table's default width MUST be 240; a stored width MUST be used; its height MUST be computed from what it shows (never measured from the drawn result); a stored height MUST be ignored for tables.
- **FR-004**: Every column row MUST have the same fixed height (24) at every zoom; row hover MUST fill the row inset from the card edge without changing the row's size or position.
- **FR-005**: A row MUST show: a key slot (primary-key glyph, foreign-key glyph, both, or a "U" square for unique non-key columns), the name (bold when primary key), the type text right-aligned in monospace taking at most 58 % of the row, and a fixed slot for "?" when the column is nullable (neither not-null nor primary key). The key slot MUST widen for the whole table when any row shows two glyphs.
- **FR-006**: Columns MUST draw in their stored order (the user's order); the card never re-sorts them. Keys and All both keep that order.
- **FR-007**: A column linked to an existing enum MUST show the enum name as a chip in place of the type text, in the enum's colour when the enum has one (palette colour, same chip treatment as Deck tags) and neutral otherwise.
- **FR-008**: The indexes footer MUST show the index count ("1 index", "3 indexes") and MUST be absent when the table has no indexes.
- **FR-009**: Text that does not fit MUST be cut with an ellipsis (type before name) and show the full text as a tooltip.
- **FR-010**: Glyphs MUST be readable without colour (distinct shapes, "U" letter, "?" text), and text MUST meet WCAG AA contrast on every row fill in both themes (type text uses Secondary on tinted rows, §g-90).

**Enum values**

- **FR-011**: Hovering an enum chip, or focusing it with the keyboard, MUST open a popover with the enum name and its values in order (with notes); moving away or Escape MUST close it; an enum with no values MUST say "No values".
- **FR-012**: A column whose enum link names no enum MUST show its type text, with no chip and no popover.

**Detail levels and zoom**

- **FR-013**: A table's size MUST depend only on its effective detail (its own choice, else the deck's; Auto counts as All) and the display toggles, never on the zoom. Below 90 % zoom the table MUST draw compact content inside that size: Landscape (≤ 45 %) the table icon on the colour fill; System (45–90 %) name, primary / foreign key dots and column count. From 90 % it draws its effective detail.
- **FR-014**: The deck MUST have a detail setting (Auto, Names, Keys, All) reachable from the zoom island (a dropdown in the compact shell). Auto MUST draw all rows from 90 % zoom.
- **FR-015**: Each table MUST be able to override the deck detail (Names, Keys, All) from its context menu and a header toggle, and return to "Use deck setting"; the choice MUST be saved in the deck (040's per-table detail) and be one undo step.
- **FR-016**: Keys MUST show primary-key and foreign-key rows, then a "+n columns" pill counting the hidden rows; Names MUST show the title only (with "n columns" in the footer area); All MUST show every row.
- **FR-017**: Changing detail MUST keep the table's top-left corner fixed.
- **FR-018**: The deck detail setting and the four table display toggles MUST be stored in the deck file as optional deck-level fields (absent = Auto and all toggles on, so older decks are unchanged), synced across tabs, exported, and changed in one undo step each.

**Display toggles**

- **FR-019**: The deck MUST offer four table display toggles, all on by default: Data types, Nullable marker, Notes, Index footer. Turning one off MUST hide that part on every table and recompute card heights.
- **FR-020**: The toggles MUST be reachable from Deck settings under a "Database" heading ("Show on tables"), placed where frame 152 shows them.

**File format additions**

- **FR-025**: The file format MUST gain, all optional and additive: a colour on an enum (a palette colour reference, like card colours), and deck-level database display settings (detail: Auto / Names / Keys / All; data types, nullable marker, notes, index footer: on / off). Decks without them MUST read exactly as before and stay byte-identical on save.

**Export**

- **FR-021**: PNG and SVG export MUST draw table cards with the same rows, glyphs, text, colours, detail and toggles as the canvas; SVG text MUST stay text. A future PDF export draws them through the same scene.

**Performance and access**

- **FR-022**: A board of 150 tables × 12 columns MUST pan and zoom as smoothly as a board of 150 ordinary cards (no regression beyond the bench's noise).
- **FR-023**: Every table MUST have an accessible name ("Table orders, 7 columns") and its rows MUST be readable by assistive technology in order (name, type, key, nullable); the enum chip and the detail controls MUST be keyboard-operable.
- **FR-024**: No new network request; no change to non-table cards.

### Key Entities

- **Table card**: the drawing of a Table (040) on the canvas and in export; reads title, note, colour, schema, columns, indexes, per-table detail.
- **Column row**: one drawn column; reads name, type, size, flags, enum link; derives its key glyph from the table's keys and the deck's relationships.
- **Deck detail setting**: Auto, Names, Keys or All, stored in the deck; with the zoom level, decides what every table without its own choice shows.
- **Table display toggles**: data types, nullable marker, notes, index footer; deck-wide, stored in the deck.
- **Enum colour**: optional palette colour on an enum (040's deck-level list); neutral when absent.
- **Enum popover**: the enum's name and ordered values, opened from an enum chip.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The "Shop" tables match frames 156 and 157 (light and dark) pixel-close at 100 %: same rows, glyphs, text, spacing and colours.
- **SC-002**: At each of the four zoom levels, a 12-column table keeps exactly the same on-canvas size (0 px difference) and every row is 24 tall.
- **SC-003**: Switching deck detail or a table's detail updates every visible table within one frame on a 150-table board, and one undo restores a table's previous choice.
- **SC-004**: Panning and zooming a 150-table × 12-column board stays within 10 % of the frame time of a 150-card board on the bench machine.
- **SC-005**: SVG and PNG exports of the "Shop" deck show the same rows and text as the canvas for every detail level and toggle combination tested (at least: All, Keys, Names; types off; notes off).
- **SC-006**: Every text and glyph pair on table rows passes WCAG AA (4.5:1) in both themes, including hovered and tinted rows.
- **SC-007**: A keyboard-only user can open an enum's values and change a table's detail without a pointer.

## Assumptions

- **Foreign key glyph**: a column shows the foreign-key glyph when it is a column end on the referencing side of a relationship: the "n" side of `1-n` / `n-1`, and the `from` side for `1-1`, `n-n` or no cardinality. Name patterns never imply a foreign key (044 can auto-connect by name).
- **Row limit** (12, Show all / Show fewer, in-table search) is 048's, as the backlog splits it; until then All draws every row and `expanded` (040) is kept but unused.
- **Per-view detail** (saved views) is 048's; 041 has the deck setting and the per-table override only.
- **Relationship display** (notation, cardinality ends, labels) and the connector anchors are 042's, including those Deck settings switches.
- **Deck settings Database section**: 041 adds the heading and the four "Show on tables" switches; 043 adds the dialect select and the rest of frame 152 to the same section.
- **States**: row selected, editing, problem row, current step and R / W markers, connection target are added by 043, 047, 049 and 042.
- **Header toggle**: the per-table detail toggle sits in the existing badge slot (frame 156: "collapse toggle"), cycling Use deck setting → Keys → All.
- **Bench**: SC-004 is measured with a 150-table deck built for this feature's report; the permanent bench entry is 048's.
- **Enum card (frame 165)**: not built (040 clarify); its "used by" link is not needed because the chip carries the enum.
