# Feature Specification: Design Sync, Database Pack

**Feature Branch**: `039-db-design-sync`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "first task from docs/backlog-database.md" (039-db-design-sync: bring the Database pack design into the repo as the reference for 040–049, like 028 did for the card system).

**Sources**: `docs/backlog-database.md` §"Founder decisions" (DB1–DB11), §039 (scope, known design deviations, acceptance criteria) and §040–§049 (what each later feature needs from the design); `docs/design/claude-design-prompt-database-pack.md` (Part 1 requirements, Part 2 screen and row list, Part 3 and Part 4 corrections); `docs/design/design-analysis.md` (§a inventory, §g up to 82); `docs/design/README.md` (how prototypes are imported and captured); `DESIGN.md` ("Card system (Deck)"); `specs/028-design-sync-card-system/spec.md` (the pattern this feature follows).

**Dependency note**: The Database pack design exists only in the Claude Design project "Sododeck" (`Sododeck Database.dc.html`, `sododeck-db.js`, built on `sododeck-cards.js` and `sododeck-canvas.js`), after the Part 3 update and Part 4 fix prompts. This is a **documentation-only** feature: no app or package code, no file-format change. It follows the 021 and 028 pattern.

## Scope

**In scope**

- **Design files**: copy `Sododeck Database.dc.html` and `sododeck-db.js`, byte-for-byte and read-only, into `docs/design/claude-design/`; list them in `docs/design/README.md` with the import date and how to re-capture each Part A screen and Part B row. If the board needs an updated copy of a file already in the folder (`sododeck-cards.js`, `sododeck-canvas.js`, `sododeck-states.js`) to render, that is recorded and flagged, not copied silently.
- **Screenshots**: every Part A screen and Part B row in light and dark, in `docs/design/screens/`, numbered from **134** upward (after the connector-style frames 128–133), Part A first in the board's order, then Part B rows 1–14, named `<id>-<slug>-{light,dark}.png` (slugs from the titles in the design, prefixed `db-`, e.g. `134-db-empty-schema-deck`). Part A covers the editor screens A1–A11, the context menus, the Names · Keys · All control, the ≡ menu and Deck settings drawer with its Database section, the dialect convert confirm and the locked table, as far as the board draws them.
- **design-analysis.md**:
  - §a inventory rows for the new frames (same table shape as 117–133: state, light/dark links, what it shows) and, for each, the backlog feature it belongs to (040–049);
  - the new components with sizes, spacing, tokens and states: table card (header, schema name, badges, title, note, column rows, key glyphs, nullable marker, type in mono, indexes footer, row hairline), "Show all n columns" / "Show fewer" button, in-table column search, enum card and value chips, crow's foot ends (one, zero-or-one, one-or-many, zero-or-many) and their geometry on curved, elbow and straight lines, column-row ports, relationship label, type-mismatch chip, Names · Keys · All control, dialect chip on database cards, Database section of Deck settings, flow "reads / writes" marks on rows and the "writes orders" chip, outside proxies for foreign keys to another database, and the zoom-level variants (Landscape, System, Container, Component);
  - a list of what the board reuses unchanged from the canvas-first editor (islands, rail, menus, flyouts, drawer, tooltips, toasts, controls), so 041–049 know not to restyle them;
  - §g entries for every mismatch between the board and DESIGN.md, the app, or a founder decision (DB1–DB11, §g-58–§g-82), numbered from **§g-83**, each with a decision or a stated default. These include the four known deviations from backlog §039: the ≡ menu (the app's shortcuts and icons from `deck-menu.tsx` win), the dialect convert confirm (the existing confirm dialog with one standard overlay), the existing Deck drawer sections (Problems, Summary and Storage as `DeckInspector` draws them; only Database is new), and toggle / checkbox / segmented controls (the app's `packages/ui` components and tokens).
- **DESIGN.md**: a new **"Database pack"** section with the tokens 041–043 use: table width (default and limits), column row height, header height, row padding, row hairline, key glyphs (PK, FK, unique, nullable) and their sizes, type text style, indexes footer, enum value chips, "Show all / Show fewer" button, crow's foot geometry (length, spread, circle and bar sizes, stroke), port position, relationship label, dialect chip, and the zoom rules for tables; plus a **proposed row limit** (DB9, about 12) taken from the design. Every value states its light and dark form where they differ, and maps to an existing token where one exists.
- **docs/backlog-database.md**: 039 marked done once merged, and any value in §040–§049 the design changes (e.g. the row limit) corrected in the same change with a §g note.

**Out of scope**

- Any code in `apps/*` or `packages/*`, including CSS tokens in `packages/ui` (added by 041) and schema or model changes (040).
- ADRs (040 writes "Database pack model"; 044 records the parser dependency approval).
- Changing earlier frames (02–133), their screenshots or inventory rows.
- Changing the prototype files, or copying prototype code into the app.
- Fixing the board in Claude Design. Deviations are recorded as §g notes; the app wins when implementing (founder, 2026-10-03).
- New founder decisions beyond recording defaults for mismatches found while importing (anything that changes scope goes back to the founder).

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are the founder and the agents who will specify and build 040–049.

### User Story 1 - See every Database screen and row in the repo (Priority: P1)

An agent starting 041 opens `docs/design/screens/` and finds each Database pack screen and component row in light and dark, numbered after 133, so it can match the table card, relationships and editor screens pixel-close without access to the Claude Design project.

**Why this priority**: The screenshots are the visual reference 041–049 are checked against; the rest of this feature points at them.

**Independent Test**: List `docs/design/screens/` and check that every Part A screen and Part B row has a light and a dark image numbered 134 or higher; open a sample to confirm it shows the named screen.

**Acceptance Scenarios**:

1. **Given** `docs/design/screens/`, **When** listed, **Then** every Part A screen and Part B row exists as `<id>-db-<slug>-light.png` and `<id>-db-<slug>-dark.png`, with ids starting at 134, Part A before Part B, in board order.
2. **Given** any Database pack screenshot, **When** opened, **Then** it shows the screen or row named by its slug, in the theme named by its suffix, with no empty icon placeholders.
3. **Given** screenshots 02–133, **When** compared with `main`, **Then** none changed.

---

### User Story 2 - Build the table card from DESIGN.md alone (Priority: P1)

An agent writing the 041 and 042 plans reads DESIGN.md's "Database pack" section and finds every value it needs (table width, column row height, key glyphs, row hairline, crow's foot geometry, port position, row limit, zoom rules) without opening the design file.

**Why this priority**: 041 needs fixed, computed row heights (heights are never measured, §g-58) and 042 needs exact crow's foot geometry; missing tokens would force guesses or a round trip to Claude Design.

**Independent Test**: Take the token list in backlog §039 and the look items in §041–§043 and find each one, with its value, in DESIGN.md.

**Acceptance Scenarios**:

1. **Given** DESIGN.md, **When** read, **Then** it has a "Database pack" section naming table width, column row height, row limit, key glyphs, crow's foot geometry and row separator, each with a value (light and dark where they differ).
2. **Given** the 041, 042 and 043 in-scope lists, **When** each look item is looked up in DESIGN.md or design-analysis.md, **Then** each has its sizes, tokens and states there.
3. **Given** DESIGN.md's "Card system (Deck)" section, **When** compared with the new section, **Then** the table card reuses the Deck frame, lip, palette and states by reference, and only database-specific values are new.

---

### User Story 3 - Know where the design and the app disagree (Priority: P1)

The founder reads design-analysis.md and sees every place the Database board contradicts DESIGN.md, the shipped editor chrome or a founder decision, each with a proposed default, before 040 and 041 are specified.

**Why this priority**: The founder has already said four deviations will not be fixed in the design and the app wins; unrecorded ones would surface mid-build and the board would be copied as if it were right.

**Independent Test**: Check that the four deviations in backlog §039 each have a §g entry, and compare the board's values against DESIGN.md, DB1–DB11 and §g-58–§g-82; each difference has a numbered entry.

**Acceptance Scenarios**:

1. **Given** design-analysis.md, **When** read, **Then** the ≡ menu, dialect convert confirm, Deck drawer sections and local control copies each have a §g entry stating that the app wins and what to use instead.
2. **Given** a value in the board that differs from DESIGN.md, the app or a founder decision, **When** looked up in §g, **Then** a numbered entry (from §g-83) states the conflict and a decision or default.
3. **Given** the editor chrome in the board, **When** design-analysis.md is read, **Then** it lists which parts are reused unchanged from the canvas-first editor and which parts are new to the Database pack.

---

### User Story 4 - Trace each frame to the feature that builds it (Priority: P2)

An agent specifying any of 040–049 finds, in the §a inventory, the frames that belong to its feature, and can link them from its spec.

**Why this priority**: The Database pack is split across eleven features; without the mapping each spec would re-survey the whole board.

**Independent Test**: For each of 041–049, filter the inventory by owning feature and check at least one frame is listed (040 is model-only and may have none).

**Acceptance Scenarios**:

1. **Given** the §a inventory, **When** filtered by owning feature, **Then** each frame names exactly one primary feature from 040–049, and shared frames name the others as secondary.
2. **Given** the import, code panel, lint, scale and architecture-link features (044–049), **When** looked up, **Then** each has the frames that show its screens (import dialog and report, DBML tab, problems, large schema, drill-in and flow playback).

### Edge Cases

- The board has no title for a screen or row: the slug follows the item's subject in the prompt (e.g. `db-relationships`, `db-large-tables`), and the choice is noted in the README.
- A screen is drawn at a different size than 1440 × 900, or a row is taller than the standard viewport: it is captured at its natural size at the same scale, and the size is noted in the README.
- A Part A item is missing from the board (e.g. the dialect convert confirm or the narrow window): no screenshot is invented; the gap is listed in design-analysis.md and reported to the founder.
- The board still contains something Part 3 or Part 4 asked to remove (a settings modal, a "Schema settings" popover, a new tools-island button): it is captured as drawn and a §g entry says it is superseded.
- The board's row limit differs from about 12, or the board gives none: DESIGN.md records the board's number, or proposes 12 with a §g note, and backlog DB9 is updated to point at it.
- A token is given only in OKLCH and browsers round it to different hex values: the hex is the one Chromium renders, the same rule as 020 and 028.
- The board includes animation (relationship highlight, row drop line, Show all expanding): screenshots show the end state; timing and easing are written in the component notes.
- The board names another diagram or database tool anywhere in its copy: the repo docs describe the feature on its own terms and the name is not repeated (naming rule); the prototype file is still copied unchanged and the occurrence is noted.
- The Claude Design project is unreachable or the board is not final: the feature stops and reports, rather than documenting from the prompt alone.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Sododeck Database.dc.html` and `sododeck-db.js` MUST be added to `docs/design/claude-design/` unchanged from the originals (injected preview markup stripped as documented), and no existing file there may change without a recorded reason.
- **FR-002**: `docs/design/README.md` MUST list the new files with their import date and describe how to re-capture each Part A screen and Part B row (props, sizes, wait conditions).
- **FR-003**: `docs/design/screens/` MUST contain a light and a dark image for every Part A screen and Part B row the board draws, numbered from 134, Part A then Part B, in board order, named `<id>-db-<slug>-{light,dark}.png`.
- **FR-004**: Images MUST be captured at the same device scale as frames 86–133: Part A screens at their window size (1440 × 900, 900 wide for the narrow window), Part B rows at the plate width (1180) and natural height; any other size is recorded in the README.
- **FR-005**: Existing screenshots (02–133) MUST NOT be changed or removed.
- **FR-006**: design-analysis.md §a MUST have one inventory row per new frame with working light/dark links, a short description and the owning backlog feature (040–049).
- **FR-007**: design-analysis.md MUST describe each new component listed in scope with sizes, spacing, tokens and states.
- **FR-008**: design-analysis.md MUST list the editor chrome the board reuses unchanged from the canvas-first editor, separately from the new database parts.
- **FR-009**: Every mismatch between the board and DESIGN.md, the app or a founder decision MUST be a numbered §g entry (from §g-83) with a decision or default, and be reported to the founder; the four deviations in backlog §039 MUST each have one.
- **FR-010**: DESIGN.md MUST have a "Database pack" section naming every token listed in backlog §039 (table width, column row height, row limit, key glyphs, crow's foot geometry, row separator) and every look value 041–043 need, with light and dark values where they differ.
- **FR-011**: The "Database pack" section MUST reference the existing "Card system (Deck)" tokens for anything the table card shares with cards (frame, lip, palette, states) instead of repeating new values for them.
- **FR-012**: DESIGN.md MUST give a proposed row limit (DB9) with its source (board value or default), and backlog DB9 MUST point at it.
- **FR-013**: Every text colour pair the new components introduce (type text, key glyphs, chips, labels) MUST have its contrast recorded; pairs below 4.5:1 for text MUST be flagged as §g entries.
- **FR-014**: No file under `apps/` or `packages/` may change.
- **FR-015**: No changed doc may name another diagram or database tool.
- **FR-016**: All changed Markdown MUST pass the repo's formatting check.

### Key Entities

- **Part A screen**: a full-window editor screen of the Database pack (e.g. empty schema deck, working schema deck, import, large schema, architecture + schema), identified by a number (134+), a slug and a title; rendered in light and dark; belongs to one or more backlog features.
- **Part B row**: one component plate of the board (signature moment, table anatomy, sample set, large tables, relationships, authoring, states, zoom levels, groups, drawer, enums and notes, code panel and import / export, problems, type palette), with the same identity and themes.
- **Screenshot**: an image of one screen or row in one theme at a fixed size.
- **Component spec**: a named element of the Database pack look with sizes, spacing, tokens and states.
- **Database token**: a named design value (e.g. column row height, crow's foot length) with light and dark values and, where it exists, the existing token it maps to.
- **Design decision (§g entry)**: a numbered conflict between the board and DESIGN.md, the app or an earlier decision, with the founder's decision or an accepted default.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100 % of the Part A screens and Part B rows the board draws have a light and a dark screenshot; 0 existing screenshots changed.
- **SC-002**: 100 % of the new frames have an inventory row whose light and dark links resolve and that names its owning feature.
- **SC-003**: 100 % of the tokens listed in backlog §039 appear in DESIGN.md with values, and the row limit has a proposed number.
- **SC-004**: The four known deviations from backlog §039, and every other mismatch found while importing, have a numbered §g entry with a default.
- **SC-005**: An agent writing the 041 or 042 spec can answer every look question in backlog §041 and §042 from DESIGN.md and design-analysis.md alone, without opening Claude Design.
- **SC-006**: Every one of 041–049 has at least one frame mapped to it in the inventory.
- **SC-007**: 0 files changed under `apps/` or `packages/`; the formatting check passes; 0 other tool names in changed docs.
- **SC-008**: The feature takes about 1 working day, per the backlog estimate.

## Assumptions

- The Claude Design project "Sododeck" is reachable and the Database board is final after the Part 4 fix prompt; the founder said remaining deviations are not fixed in the design (2026-10-03).
- Screens and rows, and their titles, come from the design file itself; ids are assigned 134 upward, Part A first, in the order they appear on the board.
- Captures use the same method as 117–133 (2× scale, wait for fonts and icons), documented in `docs/design/README.md`; network access during capture is acceptable because it never applies to the real app.
- The table card is board B's card (DB3): frame, lip, palette, states and zoom thresholds come from DESIGN.md "Card system (Deck)"; only database-specific values are new.
- Values in backlog §039–§049 and DB1–DB11 are the reference; where the board says otherwise, the founder decisions win for behaviour and the board wins for look values, and either way the difference is a §g entry.
- Context menus, the Names · Keys · All control, the ≡ menu and the Deck settings Database section are captured as Part A frames because the prompt lists them with Part A.
- The definition-of-done commands still pass because nothing they cover changes; constitution checks for code (single source of truth, network, performance) do not apply beyond "no app or package code changes".
