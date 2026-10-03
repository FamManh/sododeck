# Feature Specification: Design Sync, Card System "Deck" (board B)

**Feature Branch**: `028-design-sync-card-system`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "028 from docs/backlog.md" (028-design-sync-card-system: bring the card system design into the repo as the reference for 029–035, like 021 did for the canvas-first frames).

**Sources**: `docs/backlog.md` §"Card system, direction B 'Deck' (028–035)" and §028 (scope, acceptance criteria), §029 (the tokens 029 needs); `docs/design/claude-design-prompt-card-system.md` (requirements D1–D13 and the brief); `docs/design/design-analysis.md` §g-58–§g-65 (founder decisions); `docs/design/README.md` (how prototypes are imported and captured); `DESIGN.md` ("Card Colours" table with 13 fill / stroke pairs).

**Dependency note**: The card system design exists only in the Claude Design project "Sododeck" (`Sododeck Cards.dc.html`, `sododeck-cards.js`). The founder picked direction **B · Deck** on 2026-10-03 (§g-63). This is a **documentation-only** feature: no app or package code, no file-format change. It follows the 021 pattern.

## Scope

**In scope**

- **Design files**: copy `Sododeck Cards.dc.html` and `sododeck-cards.js`, byte-for-byte and read-only, into `docs/design/claude-design/`; list them in `docs/design/README.md` with the import date and how to re-capture the board B rows. The whole file is copied (boards A and C stay in it as history), but only board B is captured and documented.
- **Screenshots**: every row of board B in light and dark, in `docs/design/screens/`, numbered from **117** upward in board order and named `<id>-<slug>-{light,dark}.png` (slugs from the row titles in the design, e.g. `117-deck-card-anatomy`).
- **design-analysis.md**:
  - §a inventory rows for the new frames (same table shape as 86–116: state, light/dark links, what it shows) and, for each, the backlog feature it belongs to (029–035);
  - the new or changed components with sizes, spacing, tokens and states: card frame and lip, card header (type tile, type name, badge slot), tag pill, handle (rest and active), connector (line, arrow, start knob), collapsed group (fanned hand), flow playback marks (✓ sticker, current card, upcoming dashed number), and the zoom-level variants (no lip below 60 %, dot chips at System, Landscape `land` plate);
  - §g entries for every mismatch between board B and DESIGN.md or a founder decision (e.g. card width 184 vs 164 in §g-58 / D9, connector shape vs 017's elbow routing, tag case vs §g-64), each with a decision or a stated default.
- **DESIGN.md**:
  - a new **"Card system (Deck)"** section with B's tokens: radius 14 card / 20 frame / pill chips; 1.5px border in Border-strong (`#cfcfc7` light / `#45453f` dark) or the colour stroke; lip `0 3px 0` in the stroke colour, 5px on hover and on the current flow step, 6px while dragging, no blur; type scale title 14/600 line-height 1.28, type name 11.5/500, body 12, chips 11.5/500; card 184 wide, 12 padding, 8 gap; solid-tint chips at L .915 (light) / .39 (dark) with same-hue ink at L .42 / .90; 12px round handles, 16px orange with a 4px halo when active; 2px curved connectors with a rounded filled arrow and a 3.5px start knob; the zoom rules (lip off below 60 %, chips as dots at System);
  - the **extended palette**: each of the 13 colours gains `chip`, `ink` and `dot` next to `fill` and `stroke`, light and dark, with hex and OKLCH for all five variants, taken from the design's OKLCH values;
  - Known Gaps updated for anything board B closes or opens.
- **docs/backlog.md**: 028 marked done once merged (status only).

**Out of scope**

- Any code in `apps/*` or `packages/*`, including tokens in `packages/ui/src/styles/tokens.css` (added by 029) and contrast tests (029).
- Capturing or documenting boards A and C beyond keeping them in the copied file.
- ADRs (029 writes the line-type ADR; 030 and 032 write theirs).
- Changing earlier frames (02–116), their screenshots or inventory rows.
- Changing the prototype files, or copying prototype code into the app.
- New founder decisions beyond recording defaults for mismatches found while importing (anything that changes scope goes back to the founder).

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are the founder and the agents who will specify and build 029–035.

### User Story 1 - See every Deck row in the repo (Priority: P1)

An agent starting 029 opens `docs/design/screens/` and finds each board B row in light and dark, numbered after 116, so it can match the Deck look pixel-close without access to the Claude Design project.

**Why this priority**: The screenshots are the visual reference 029–035 are checked against; the rest of this feature points at them.

**Independent Test**: List `docs/design/screens/` and check that every board B row has a light and a dark image numbered 117 or higher; open a sample to confirm it shows the named row.

**Acceptance Scenarios**:

1. **Given** `docs/design/screens/`, **When** listed, **Then** every board B row exists as `<id>-<slug>-light.png` and `<id>-<slug>-dark.png`, with ids starting at 117 in board order.
2. **Given** any Deck screenshot, **When** opened, **Then** it shows the row named by its slug, in the theme named by its suffix, with no empty icon placeholders.
3. **Given** screenshots 02–116, **When** compared with `main`, **Then** none changed.

---

### User Story 2 - Build the Deck look from DESIGN.md alone (Priority: P1)

An agent writing the 029 plan reads DESIGN.md's "Card system (Deck)" section and finds every value it needs (radii, borders, lip offsets, type scale, card metrics, chip tints, handle sizes, connector line, zoom rules) without opening the design file.

**Why this priority**: 029 is the largest card feature (6 d); missing tokens would force guesses or a round trip to Claude Design.

**Independent Test**: Take the token list in backlog §028 and §029 and find each one, with its value, in DESIGN.md.

**Acceptance Scenarios**:

1. **Given** DESIGN.md, **When** read, **Then** it has a "Card system (Deck)" section naming every token listed in backlog §028 with its light and dark value where they differ.
2. **Given** the 029 in-scope list (card frame, states, handles, collapsed group, connectors, zoom rules, palette), **When** each item is looked up in DESIGN.md, **Then** each has its values there.
3. **Given** the existing "Card Colours" section, **When** read, **Then** it still describes 020's fill / stroke tokens as shipped, and points to the extended palette.

---

### User Story 3 - Use one extended palette (Priority: P2)

An agent building 029 (chips) and later 033 (tag colours) and 032 (select options, statuses) reads one palette table that lists, for each of the 13 colours, all five variants in light and dark with hex and OKLCH.

**Why this priority**: D8 makes one shared palette the source for fills, strokes, tags, options and statuses; it must exist before 029 adds the tokens.

**Independent Test**: Count the palette table: 13 colours × 5 variants × 2 themes, each with hex and OKLCH.

**Acceptance Scenarios**:

1. **Given** the palette table, **When** read, **Then** each of the 13 colours has `fill`, `stroke`, `chip`, `ink` and `dot` in light and dark, each with a hex and an OKLCH value.
2. **Given** a `fill` or `stroke` value already shipped by 020, **When** compared with the table, **Then** they are equal, or the difference is listed as a §g entry with a default.
3. **Given** a `chip` / `ink` pair, **When** its contrast is computed from the table, **Then** the ratio is recorded next to it, and any pair below 4.5:1 is flagged as a §g entry.

---

### User Story 4 - Know where the design and the rules disagree (Priority: P2)

The founder reads design-analysis.md and sees every place board B contradicts DESIGN.md or an earlier decision, each with a proposed default, before 029 is specified.

**Why this priority**: Unflagged conflicts (e.g. card width, connector shape) would surface mid-build; listing them now keeps 029's spec stable.

**Independent Test**: Compare board B values against DESIGN.md and §g-58–§g-65; each difference has a numbered §g entry.

**Acceptance Scenarios**:

1. **Given** design-analysis.md, **When** read, **Then** it has §a inventory rows for every new frame with working light and dark links and the owning backlog feature.
2. **Given** a value in board B that differs from DESIGN.md or a founder decision, **When** looked up in §g, **Then** a numbered entry (from §g-66) states the conflict and a decision or default.
3. **Given** the new components listed in scope, **When** looked up, **Then** each has sizes, tokens and states documented.

### Edge Cases

- Board B has no title for a row: the slug follows the row's subject in the brief (e.g. `playback`, `collapsed-group`), and the choice is noted in the README.
- A row is taller than the standard viewport: it is captured at its natural height at the same width and scale, and the size is noted in the README.
- The design gives a token only in OKLCH and browsers round it to different hex values: the hex is the one Chromium renders, the same rule as 020's table.
- The design has a different number of colours than 13, or a colour without one of the five variants: the actual set is documented and flagged to the founder, not padded or trimmed.
- The design includes animation (dealing the deck, lifting the current card): screenshots show the end state; timing and easing are written in the component notes.
- The Claude Design project is unreachable: the feature stops and reports, rather than documenting from the brief alone.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Sododeck Cards.dc.html` and `sododeck-cards.js` MUST be added to `docs/design/claude-design/` unchanged from the originals (injected preview markup stripped as documented), and no existing file there may change.
- **FR-002**: `docs/design/README.md` MUST list the new files with their import date and describe how to re-capture board B rows (props, sizes, wait conditions).
- **FR-003**: `docs/design/screens/` MUST contain a light and a dark image for every board B row, numbered from 117 in board order and named `<id>-<slug>-{light,dark}.png`.
- **FR-004**: Images MUST be captured at the same width and device scale as states 86–115, unless a row needs a different size, which is then recorded in the README.
- **FR-005**: Existing screenshots (02–116) MUST NOT be changed or removed.
- **FR-006**: design-analysis.md §a MUST have one inventory row per new frame with working light/dark links, a short description and the owning backlog feature (029–035).
- **FR-007**: design-analysis.md MUST describe each new component listed in scope with sizes, spacing, tokens and states.
- **FR-008**: Every mismatch between board B and DESIGN.md or a founder decision MUST be a numbered §g entry (from §g-66) with a decision or default, and be reported to the founder.
- **FR-009**: DESIGN.md MUST have a "Card system (Deck)" section naming every token listed in backlog §028 with its value, and the zoom rules (lip below 60 %, dot chips at System, Landscape plate).
- **FR-010**: DESIGN.md MUST have a palette table listing, for each of the 13 colours, `fill`, `stroke`, `chip`, `ink` and `dot` in light and dark, each as hex and OKLCH.
- **FR-011**: The palette table MUST record the contrast of each `chip` / `ink` pair; pairs below 4.5:1 MUST be flagged as §g entries.
- **FR-012**: DESIGN.md's existing "Card Colours" section MUST stay accurate for what ships today and link to the extended palette.
- **FR-013**: No file under `apps/` or `packages/` may change.
- **FR-014**: All changed Markdown MUST pass the repo's formatting check.

### Key Entities

- **Board B row**: one section of the Deck board (e.g. card anatomy, states, handles, connectors, collapsed group, playback, zoom levels, palette), identified by a number (117+), a slug and a title; rendered in light and dark; belongs to one backlog feature.
- **Screenshot**: an image of one row in one theme at a fixed width.
- **Component spec**: a named element of the Deck look with sizes, spacing, tokens and states.
- **Palette colour**: one of 13 named colours with five variants (`fill`, `stroke`, `chip`, `ink`, `dot`), each with a light and a dark value in hex and OKLCH.
- **Design decision (§g entry)**: a numbered conflict between board B and DESIGN.md or an earlier decision, with the founder's decision or an accepted default.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100 % of board B rows have a light and a dark screenshot; 0 existing screenshots changed.
- **SC-002**: 100 % of the new frames have an inventory row whose light and dark links resolve.
- **SC-003**: 100 % of the tokens listed in backlog §028 appear in DESIGN.md with values.
- **SC-004**: The palette table has 130 colour values (13 colours × 5 variants × 2 themes), each with hex and OKLCH, and 13 × 2 recorded chip / ink contrast ratios.
- **SC-005**: Every mismatch found while importing has a numbered §g entry with a default.
- **SC-006**: An agent writing the 029 spec can answer every look question in backlog §029 from DESIGN.md and design-analysis.md alone, without opening Claude Design.
- **SC-007**: 0 files changed under `apps/` or `packages/`; the formatting check passes.
- **SC-008**: The feature takes about 1 working day, per the backlog estimate.

## Assumptions

- The Claude Design project "Sododeck" is reachable and `Sododeck Cards.dc.html` / `sododeck-cards.js` are final for 029–035 (founder pick, 2026-10-03).
- Board B's rows and their titles come from the design file itself; screenshot ids are assigned 117 upward in the order the rows appear.
- Captures use the same method as 86–116 (Playwright, 2× scale, wait for fonts and icons), documented in `docs/design/README.md`; network access during capture is acceptable because it never applies to the real app.
- The 13 colours are the same names as 020's palette; B adds `chip`, `ink` and `dot`. Where B's `fill` / `stroke` differ from what 020 ships, 020's values stay in "Card Colours" and the difference is a §g entry, not a silent change.
- Values in backlog §028 (e.g. 184 wide, lip 3 / 5 / 6 px) are the reference; where the design file says otherwise, the design file wins and the backlog is corrected in the same change, with a §g note.
- Card width 184 conflicts with D9 / §g-58's 164; this feature records the conflict and 029 applies the decision.
- Constitution checks for code (single source of truth, network, performance, tests) do not apply beyond "no app or package code changes"; the definition-of-done commands still pass because nothing they cover changes.
