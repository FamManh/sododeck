# Feature Specification: Manual-test polish

**Feature Branch**: `051-manual-test-polish`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: founder manual-testing feedback (originally in Vietnamese), summarised: (1) hover focus dims every other card, which gets in the way while editing; highlight should only happen in a mode the user turns on when needed. (2) Alt-drag duplicates a card, but during the drag the original disappears from its place, so people think it failed until they release. (3) Cards tilt while dragged, which makes alignment hard; drop the tilt. (4) Remove the "Persistent storage" card from the library sidebar. (5) Rename "Import .sododeck.json" to "Import". (6) In the Export dialog, options with radio buttons only react when the radio itself is clicked, not the whole option. (7) The save icon spins continuously while typing a card title; how often does autosave run? (8) At 90 % zoom the card type, subtitle and description are already hidden although there is room; keep them (scaled down like the title) until about 50 %. (9) Order the packs Basic, Process, Data cards, Architecture, Logistics; Logistics can be hidden for now.

## Context

Today's behaviour, found in the app (for the planner, not requirements):

- **Hover focus** (034): resting the pointer on a card, or selecting it, lights up its connections and dims everything else to 20 %. A separate **Focus mode** (toggle, shortcut F) pins that focus on the selected card.
- **Duplicate-drag**: holding the duplicate modifier while dragging creates the copy only on release; until then the original itself moves away.
- **Drag look**: dragged cards and shapes tilt slightly and lift.
- **Autosave**: every change is written about 100 ms after it happens, and the "Saving…" state is held at least 200 ms so it does not flicker. While typing, each keystroke starts a new save, so the indicator spins without stopping.
- **Zoom levels**: at 90 % and below the canvas switches to the "System" level, which hides a card's subtitle, description and type label; 45 % and below is "Landscape".
- **Packs**: shown in the order Architecture, Process, Logistics, Data cards, Database, Basic shapes, all on for a new deck.

## Clarifications

### Session 2026-10-04

Decisions taken as defaults (founder can override with `/speckit-clarify`):

- Q: Which "mode" turns highlighting on? → A: The existing **Focus mode** (F, and its toolbar toggle). Outside it, neither hover nor selection dims anything. Inside it, hover and selection drive the highlight as 034 describes. No new mode is added.
- Q: Which key duplicates? → A: Unchanged: Alt on Windows/Linux, Option on macOS. Only the feedback during the drag changes.
- Q: Where does the Database pack go in the new order? → A: Right after Data cards: Basic shapes, Process, Data cards, Database, Architecture, Logistics.
- Q: What does "hide Logistics" mean? → A: Logistics is **off** for new decks and sits last in the pack list, where it can be turned on. Decks that already use Logistics cards keep it on and are unchanged.
- Q: How often should autosave write? → A: Writing stays near-immediate (no data-loss window is added). Only the indicator changes: it shows "Saving…" only when a save takes noticeably long, and stays calm during continuous typing.
- Q (planning): With the detail boundary at 50 %, Landscape at 45 % would leave the System level a 46–50 % sliver. → A: Landscape moves to ≤ 30 %, System covers 31–50 %, Container 51–150 %, Component unchanged.
- Q (planning): Focus mode today needs one selected card. How does hover work inside it? → A: F (or the toggle) turns Focus mode on even with nothing selected. With one card or group selected the focus is pinned to it; with nothing selected, hover and keyboard focus drive it. Focus mode no longer turns itself off when the selection empties.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Edit without the canvas dimming (Priority: P1)

A user edits cards (renames, moves, opens the inspector). Hovering or selecting a card no longer dims the rest of the deck. When they want to see what a card connects to, they turn on Focus mode, and then hover and selection highlight connections as before.

**Why this priority**: The founder found the constant dimming the most disruptive problem while editing.

**Independent Test**: With Focus mode off, hover and select cards: nothing dims. Press F: hovering and selecting now highlight connections and dim the rest. Press F again: dimming stops.

**Acceptance Scenarios**:

1. **Given** Focus mode is off, **When** the pointer rests on a card or the user selects one, **Then** no card, group or connector is dimmed.
2. **Given** Focus mode is off, **When** a card is selected, **Then** it shows only its normal selection look.
3. **Given** Focus mode is on, **When** the pointer rests on a card, **Then** its connections and neighbours are highlighted and everything else is dimmed, as in 034.
4. **Given** Focus mode is on with a card selected, **When** the pointer moves elsewhere, **Then** the focus stays on the selected card.
5. **Given** Focus mode is on, **When** the user presses F or clicks the toggle, **Then** Focus mode turns off and the canvas returns to its resting look at once.
6. **Given** a flow is playing, **When** Focus mode is on or off, **Then** the flow look is unchanged (playback wins, as today).

---

### User Story 2 - See the copy appear while duplicate-dragging (Priority: P1)

A user holds the duplicate modifier and drags a card. The original stays where it was the whole time, and a copy follows the pointer. Releasing drops the copy.

**Why this priority**: Users currently think duplicate-drag failed; the feature is invisible until it is over.

**Independent Test**: Hold Alt/Option and drag a card: the original stays put and a copy moves with the pointer. Release: both cards are there and one undo removes the copy.

**Acceptance Scenarios**:

1. **Given** the modifier is held when the drag starts, **When** the pointer moves, **Then** the original stays at its position, fully visible, and a copy follows the pointer.
2. **Given** a duplicate-drag, **When** the user releases, **Then** the copy is placed where it was dropped and one undo step removes it.
3. **Given** a duplicate-drag, **When** the user presses Esc, **Then** the copy disappears and the document is unchanged.
4. **Given** a normal drag in progress, **When** the user presses the modifier, **Then** the drag becomes a duplicate-drag: the original snaps back to its start and the copy follows the pointer. **When** they release the modifier before dropping, **Then** it goes back to a plain move.
5. **Given** several cards selected, **When** the user duplicate-drags one of them, **Then** all originals stay and copies of all of them follow the pointer together.
6. **Given** a duplicate-drag, **When** the copy is near other cards, **Then** alignment guides and snapping work as for a normal drag.

---

### User Story 3 - Show card details at mid zoom (Priority: P1)

A user zooms out on a large diagram. Card type, subtitle and description stay visible, scaled with the card like the title, until the deck is at about 50 %. Below that, the compact look takes over.

**Why this priority**: Hiding details at 90 % makes ordinary overview zoom levels lose most of the information.

**Independent Test**: Zoom from 100 % down to 40 % on a deck with described cards. Details stay readable down to 50 %, and switch to the compact look below it.

**Acceptance Scenarios**:

1. **Given** zoom between 51 % and 100 %, **When** cards are shown, **Then** each shows its title, type label, subtitle and description as at 100 %, scaled with the canvas.
2. **Given** zoom between 31 % and 50 %, **When** cards are shown, **Then** they use the compact System look (tile and title, chips as dots), as today between 46 % and 90 %.
3. **Given** zoom moving back and forth around 50 %, **When** it crosses the threshold, **Then** the look does not flicker (small hysteresis, as today).
4. **Given** zoom at 30 % or below, **When** cards are shown, **Then** they use the Landscape look (type icon only), as today below 45 %. Levels above 150 % are unchanged.

---

### User Story 4 - Drag cards without tilt (Priority: P2)

A user drags a card or shape to line it up with others. It stays upright while dragged, so edges can be compared directly.

**Why this priority**: Small change, directly helps alignment.

**Independent Test**: Drag a card and a shape across the canvas: neither rotates at any point.

**Acceptance Scenarios**:

1. **Given** a card, shape or sticky, **When** it is dragged, **Then** it is never rotated; it may still show a lift (shadow) to signal dragging.
2. **Given** a dragged item next to another, **When** their edges line up, **Then** the edges are visibly parallel during the drag.

---

### User Story 5 - Export dialog options react to a click anywhere on the option (Priority: P2)

In the Export dialog, a user clicks an option (its label, description or anywhere on its row/button) and it becomes selected, not only when the small radio circle is hit.

**Why this priority**: The dialog feels broken today.

**Independent Test**: Open Export, click the text of each option in each option group: each becomes selected and the preview updates.

**Acceptance Scenarios**:

1. **Given** the Export dialog, **When** the user clicks anywhere on an option (label, icon, description, padding), **Then** that option is selected.
2. **Given** an option group, **When** the user uses the keyboard (Tab into the group, arrow keys), **Then** selection moves between options as for a standard radio group.
3. **Given** a screen reader, **When** it reads an option, **Then** the option's label is announced together with its selected state.

---

### User Story 6 - Calm save indicator while typing (Priority: P2)

A user types a card title. The save indicator does not spin with every keystroke; it shows "Saved" when typing pauses. Work is still saved right away.

**Why this priority**: The spinning icon is distracting and suggests something is wrong.

**Independent Test**: Type a 30-character title at normal speed: the indicator does not alternate between states per keystroke. Reload immediately after the last key: the full title is there.

**Acceptance Scenarios**:

1. **Given** the user types continuously, **When** saves happen, **Then** the indicator does not animate per keystroke; it shows "Saving…" only if a save has been pending for longer than about 1 second.
2. **Given** the user stops typing, **When** the last change is written, **Then** the indicator shows "Saved".
3. **Given** the user reloads or closes the tab within half a second of their last change, **When** the deck reopens, **Then** the last change is there.
4. **Given** a save fails (e.g. storage full), **When** it fails, **Then** the error state shows at once, as today.

---

### User Story 7 - Packs in a useful order, Logistics tucked away (Priority: P3)

A user opens Add and the packs settings. Packs appear in the order Basic shapes, Process, Data cards, Database, Architecture, Logistics. A new deck has Logistics off; it can be turned on from the pack settings.

**Why this priority**: Ordering is a quick win; Logistics is niche for now.

**Independent Test**: Create a new deck: Add lists packs in the new order without Logistics. Turn Logistics on: it appears last. Open an existing deck with a warehouse card: Logistics is on and the card is unchanged.

**Acceptance Scenarios**:

1. **Given** any place that lists packs (Add panel, pack settings), **When** it is shown, **Then** the order is Basic shapes, Process, Data cards, Database, Architecture, Logistics.
2. **Given** a new deck, **When** it is created, **Then** every pack except Logistics is on.
3. **Given** the pack settings, **When** the user turns Logistics on, **Then** its cards appear in Add, last.
4. **Given** an existing deck with Logistics on or with Logistics cards, **When** it opens, **Then** Logistics stays on and nothing changes.
5. **Given** an imported file that lists Logistics as on, **When** it is imported, **Then** Logistics is on.

---

### User Story 8 - Simpler library sidebar (Priority: P3)

The library sidebar no longer shows the "Persistent storage" card, and the import button reads "Import".

**Why this priority**: Cosmetic clean-up.

**Independent Test**: Open the library: there is no "Persistent storage" card and the import button says "Import" and still opens the file picker for `.sododeck.json`.

**Acceptance Scenarios**:

1. **Given** the library page, **When** it loads, **Then** no "Persistent storage" card or its request button is shown.
2. **Given** the library page, **When** the user looks at the import button, **Then** its visible label is "Import" and its accessible name says it imports a deck file.
3. **Given** the import button, **When** clicked, **Then** it behaves exactly as before (same accepted files, same errors).

---

### Edge Cases

- **Focus mode with nothing selected**: hover and keyboard focus drive the highlight; leaving the card clears it. Clearing the selection keeps Focus mode on.
- **Keyboard focus outside Focus mode**: focusing a card with Tab shows the focus ring only, no dimming.
- **Duplicate-drag of a group frame**: same behaviour as cards (original stays, copy follows). Stickies have no duplicate-drag today and keep none (out of scope).
- **Duplicate-drag of a card inside a collapsed or drilled-in group**: the copy lands in the scope where it is dropped, as today.
- **Duplicate-drag cancelled by losing window focus**: treated like Esc; no copy is created.
- **Zoom threshold with very long descriptions**: text is clamped as at 100 %; it does not grow the card.
- **Database table cards (041)**: follow the same zoom threshold as other cards for their detail rows.
- **Export options that are disabled**: clicking a disabled option does nothing, as with its radio.
- **Saving while offline / tab hidden**: unchanged; saves are local.
- **Older decks with no pack list** (legacy, Architecture only): unchanged.
- **Persistent storage already granted**: removing the card does not revoke it.

## Requirements _(mandatory)_

### Functional Requirements

**Focus (US1)**

- **FR-001**: Outside Focus mode, hovering, keyboard-focusing or selecting a card MUST NOT dim any object on the canvas.
- **FR-002**: Inside Focus mode, hover and selection MUST highlight connections and dim the rest exactly as 034 defines (timing, pinned selection, suspension during playback, drag and connection drawing).
- **FR-003**: Focus mode MUST keep its shortcut (F) and toolbar toggle, and its state MUST be visible on the toggle.

**Duplicate-drag (US2)**

- **FR-004**: During a duplicate-drag the original object(s) MUST stay at their original position, fully visible, and a copy MUST follow the pointer from the first movement.
- **FR-005**: Pressing or releasing the modifier mid-drag MUST switch between move and duplicate at once.
- **FR-006**: Dropping MUST create the copies as one undo step; Esc or losing window focus MUST leave the document unchanged.

**Drag look (US4)**

- **FR-007**: Dragged cards, shapes, stickies and groups MUST NOT be rotated at any point of a drag.

**Zoom detail (US3)**

- **FR-008**: Cards MUST show title, type label, subtitle and description at every zoom above 50 %, scaled with the canvas.
- **FR-009**: The switch to the compact card look MUST happen at 50 % (with the existing small hysteresis), instead of 90 %; the Landscape look starts at 30 % instead of 45 %.

**Export dialog (US5)**

- **FR-010**: Each option in the Export dialog MUST be selectable by clicking anywhere on the option, and MUST remain a keyboard-operable, labelled radio choice.

**Save indicator (US6)**

- **FR-011**: Changes MUST still be written within about half a second of being made.
- **FR-012**: The indicator MUST NOT show "Saving…" for saves that finish within about 1 second; it shows "Saved" when no write is pending.
- **FR-013**: Save errors MUST be shown immediately, unchanged.

**Packs (US7)**

- **FR-014**: Packs MUST be listed in the order Basic shapes, Process, Data cards, Database, Architecture, Logistics wherever packs are listed.
- **FR-015**: New decks MUST start with every pack on except Logistics.
- **FR-016**: Existing and imported decks MUST keep their pack choices; a deck containing Logistics cards MUST keep Logistics on.

**Library (US8)**

- **FR-017**: The library sidebar MUST NOT show the "Persistent storage" card.
- **FR-018**: The import button's visible label MUST be "Import", with an accessible name that says it imports a deck file; behaviour is unchanged.

### Key Entities

- **Deck pack list**: which packs a deck has on. Existing field; only the default for new decks and the display order change. No file format change.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With Focus mode off, a 2-minute editing session (hover, select, rename, move 10 cards) produces zero dimming of other objects.
- **SC-002**: In a duplicate-drag, the original is visible at its start position in 100 % of frames from press to release.
- **SC-003**: A test user asked to "copy this card by dragging" succeeds on the first try without asking whether it worked.
- **SC-004**: At 60 % zoom on the sample deck, every card's subtitle and description are visible.
- **SC-005**: Typing a 30-character title shows the "Saving…" state at most once (normally zero times), and reloading 0.5 s after the last key keeps all 30 characters.
- **SC-006**: Every Export dialog option is selected by a click on its label text, on the first click.
- **SC-007**: A new deck's Add panel shows five packs in the new order, with no Logistics.
- **SC-008**: No dragged object is ever drawn rotated.

## Assumptions

- Focus mode, duplicate-drag, zoom levels and packs exist today (029–038); this feature changes their behaviour and defaults only. No schema change.
- Level boundaries become Landscape ≤ 30 %, System 31–50 %, Container 51–150 %, Component > 150 % (decided in planning, see Clarifications).
- The canvas performance budget (500 cards / 1,000 connectors) still holds with details shown down to 50 %; verified with the canvas benchmark during planning.
- Persistent storage is no longer requested through the UI; no automatic request is added in this feature. This retires product requirement G-4 (`docs/spec.md`), by founder decision.
- "Basic" in the founder's list means the existing Basic shapes pack (shapes, sticky, frame).
- Logistics stays in the product (types, rendering, file support); it is only off by default.
- No new e2e tests (founder decision); the smoke suite must stay green.
