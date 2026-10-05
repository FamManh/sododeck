# Feature Specification: Editor chrome polish

**Feature Branch**: `054-editor-chrome-polish`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "054 from docs/backlog.md: editor chrome polish. Founder manual-testing feedback (2026-10-05): Deck settings (board settings) are buried in the hamburger menu; Views should be only Overview and Flows (founder first wrote General and Feature); Focus should move into the toolbar, below Select; the Auto / Names / Keys / All control is unclear and takes too much space; "Spread ends evenly" is not explained; Lock only works one card at a time (select all then lock, or lock a whole group); the DBML editor should be its own drawer on the right, separate from the JSON panel."

**Sources**: `docs/backlog.md` §054; `specs/011-views-autolayout/` (built-in views System / Feature / Infra); `specs/010-zoom-groups-focus/` (Focus mode); `specs/041-*` (table detail Auto / Names / Keys / All); `specs/043-*` (locked cards); `specs/046-db-code-panel/` (JSON | DBML | SQL tabs); `specs/050-connector-editing/` (Spread ends evenly); `specs/052-db-drawer/`; DESIGN.md (islands, rail, drawers); constitution v1.0.0.

## Scope

**In scope**

- **Deck settings visible**: the settings now reached only through the hamburger menu get a visible entry point on the canvas chrome. The menu entry may stay as a second route.
- **Two built-in views**: a new deck offers exactly two views, **Overview** and **Flows**. Names fit any kind of deck, not only software architecture.
- **Focus in the toolbar**: the Focus tool sits in the left toolbar directly below Select, with the same behaviour and shortcut as today. It no longer appears in its old place.
- **Table detail control**: the Auto / Names / Keys / All control takes much less room and says what each choice does.
- **Spread ends evenly explained**: the action says, in the UI, what it does and why it is unavailable when it is.
- **Lock several at once**: select several cards, or select all, and lock or unlock them in one step. Locking a group locks the group and everything in it.
- **Whole schema only (temporary)**: the Selection / Whole schema switch is hidden in the DBML and SQL views; they always show the whole schema. Selection mode is parked, not removed, so it can return later.
- **DBML drawer**: the DBML editor opens in its own drawer on the right, separate from the JSON panel, which goes back to showing only the JSON of the deck.

**Out of scope**

- New settings, new tools, redesigning the toolbar or the menu.
- Migrating or deleting views already saved in existing decks.
- New lock rules (what a locked card refuses stays as in 043).
- Changing DBML syntax, its parsing, the SQL export or lint behaviour.
- Image support (055) and file format / Mermaid import (056).

## Clarifications

### Session 2026-10-05

- Q: Decks that already have System / Infra views? → A: Left untouched. Only the built-in defaults offered to a deck with no saved views change (Overview + Flows). No data rewrite on open (the "opening a deck never changes it" rule from 011 stays).
- Q: Does a new deck still get Infra as a preset? → A: No (option A). Only the two built-in views; a custom view can reproduce Infra's settings.
- Q: What are the two built-in views called? → A: **Overview** and **Flows** (option A). They replace System and Feature for new decks; saved views keep their own names.
- Q: What happens to the Selection / Whole schema switch of DBML and SQL? → A: Hidden for now; Whole schema is always used, because Selection alone has no clear meaning. Parked, not deleted.
- Q: Where does the read-only SQL view go when DBML leaves the JSON panel? → A: Option A. The right drawer has two tabs, DBML (editable) and SQL (read-only); the JSON panel shows JSON only.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open deck settings without hunting (Priority: P1)

A user wants to change a deck-level setting (for example the table detail or the deck name rules) and finds the entry on the canvas chrome without opening the hamburger menu.

**Why this priority**: The founder could not find these settings; it is the most reported discoverability gap and the smallest fix.

**Independent Test**: Open any deck. A visible control opens the deck settings; the settings are the same as the ones the menu opens.

**Acceptance Scenarios**:

1. **Given** an open deck, **When** the user looks at the tools island (top-right), **Then** a labelled deck-settings button is visible without opening any menu, and the top-left deck island gains nothing new.
2. **Given** that control, **When** the user activates it with mouse or keyboard, **Then** the deck settings open, and activating it again (or Esc) closes them.
3. **Given** the hamburger menu, **When** it is opened, **Then** deck settings are still reachable there and open the same panel.
4. **Given** a narrow window (compact shell), **When** the user looks for deck settings, **Then** they are still reachable in one or two steps.

---

### User Story 2 - Focus sits with the tools (Priority: P1)

A user turns Focus on and off from the left toolbar, right under Select, like any other canvas tool.

**Why this priority**: Focus is a canvas mode; it is used often and is hard to find where it is now.

**Independent Test**: With a card selected, activate Focus under Select: everything except the card and its neighbours dims; activate again: back to normal.

**Acceptance Scenarios**:

1. **Given** the left toolbar, **When** it is shown, **Then** Focus appears immediately below Select with an icon and a tooltip naming its shortcut.
2. **Given** Focus is on, **When** the user hovers or selects another card, **Then** the dimming follows it exactly as before this change.
3. **Given** a flow is being shown (Focus unavailable), **When** the user looks at the Focus tool, **Then** it is disabled and says why.
4. **Given** the old location of Focus, **When** the editor is shown, **Then** Focus is not duplicated there.
5. **Given** the keyboard shortcut for Focus, **When** pressed, **Then** it toggles Focus and the toolbar state follows.

---

### User Story 3 - Two views that fit any deck (Priority: P2)

A user opening a new deck sees two views, **Overview** and **Flows**, instead of System / Feature / Infra.

**Why this priority**: The current names assume an architecture deck; the product serves other kinds of deck.

**Independent Test**: Create a new deck: the view switcher lists Overview and Flows only. Open an older deck with System / Infra: they are still there and work.

**Acceptance Scenarios**:

1. **Given** a new deck, **When** the view switcher is shown, **Then** it lists Overview and Flows, with Overview selected.
2. **Given** the Overview view, **When** it is shown, **Then** it shows everything with the default card subtitle of the former System view.
3. **Given** the Flows view, **When** it is shown, **Then** it behaves as the former Feature view does (subtitle "n flows · owner").
4. **Given** a deck saved earlier with System / Feature / Infra, **When** it is opened, **Then** its views, positions and settings are exactly as saved and nothing is rewritten.
5. **Given** a deck with no saved views, **When** the first view change is made, **Then** Overview and Flows are written with their defaults, and ⌘Z undoes only the change.
6. **Given** the user adds a custom view, **When** it is created, **Then** it still works as before.

---

### User Story 4 - Understand and shrink the table detail control (Priority: P2)

A user working on a database deck sees a small table-detail control; hovering or opening it explains what Auto, Names, Keys and All mean.

**Why this priority**: The four-way control takes too much of the zoom island and its words are unexplained.

**Independent Test**: In a deck with a table, the control takes no more room than one compact button; choosing a detail changes all tables in one undo step; each choice carries a one-line explanation.

**Acceptance Scenarios**:

1. **Given** a deck with a table, **When** the zoom island is shown, **Then** the table-detail control occupies one compact button (roughly a single tool slot wide) showing the current choice.
2. **Given** that control, **When** it is opened, **Then** each of Auto, Names, Keys and All is listed with a one-line explanation (for example, Auto: "detail follows the zoom level").
3. **Given** a choice, **When** it is picked, **Then** all tables update and one ⌘Z restores the previous choice.
4. **Given** a deck with no table, **When** the island is shown, **Then** the control is absent.
5. **Given** a screen reader, **When** the control is reached, **Then** its name, current value and each option's explanation are announced.

---

### User Story 5 - Lock many cards or a whole group (Priority: P2)

A user selects several cards, or selects all, and locks them in one step; the user can also lock a group so its contents stay put.

**Why this priority**: Locking one card at a time makes "freeze this layout" tedious.

**Independent Test**: Select all, choose Lock: every card and group refuses move, resize and edit; choose Unlock: all accept them again; one ⌘Z undoes either step.

**Acceptance Scenarios**:

1. **Given** several selected cards, **When** the user chooses Lock, **Then** all are locked in one undo step, and the action then reads Unlock.
2. **Given** select-all (including groups and connectors), **When** the user chooses Lock, **Then** every card and group is locked and the confirmation says how many.
3. **Given** a group (collapsed or expanded) is selected, **When** the user chooses Lock, **Then** the group and every card inside it are locked, and moving the group or any card inside is refused with the usual locked hint.
4. **Given** a locked group, **When** the user chooses Unlock, **Then** the group and its cards are unlocked.
5. **Given** a selection where some items are already locked, **When** the user chooses the action, **Then** it reads Lock and locks the rest; it reads Unlock only when every selected item is locked.
6. **Given** a card added to an already locked group, **When** it is added, **Then** it is not locked until the user locks it (a lock is a state of existing items, not a rule for new ones).

---

### User Story 6 - Know what "Spread ends evenly" does (Priority: P3)

A user sees what Spread ends evenly will do before using it, and why it is unavailable when it is.

**Why this priority**: The label is meaningful only after trying it; a short explanation removes the guess.

**Independent Test**: Hover or focus the action: a one-sentence explanation shows. With a selection that cannot be spread, the action is disabled and the explanation says what is needed.

**Acceptance Scenarios**:

1. **Given** a selection of cards, **When** the user hovers or focuses Spread ends evenly (menu or toolbar), **Then** a sentence explains it (for example: "Space the connector ends evenly along each side of the selected cards").
2. **Given** a selection where nothing would change, **When** the action is shown, **Then** it is disabled and says why.
3. **Given** the action is used, **When** it finishes, **Then** one ⌘Z undoes it.

---

### User Story 7 - DBML in its own drawer (Priority: P3)

A user working on a database deck opens the DBML editor in a drawer on the right and keeps the JSON panel for the deck JSON.

**Why this priority**: JSON and DBML are different jobs; sharing one panel makes both cramped and mixes their tabs.

**Independent Test**: Open the DBML drawer: the schema DBML is editable there and edits apply to the canvas as today. Open the JSON panel: it shows only JSON.

**Acceptance Scenarios**:

1. **Given** a deck with tables, **When** the user opens the DBML drawer from the toolbar or menu, **Then** a drawer opens on the right with the schema as editable DBML and a read-only SQL tab next to it.
2. **Given** the DBML drawer, **When** DBML is edited and valid, **Then** the canvas updates exactly as it did from the JSON panel's DBML tab, and ⌘Z behaves the same.
3. **Given** the JSON panel, **When** it is opened, **Then** it shows only JSON, with no DBML or SQL tabs.
4. **Given** the DBML drawer, **When** the user drags its left edge or uses ←/→ on it, **Then** it resizes live between 320 px and 70% of the window, and the width is remembered for next time (a user used to a DBML editor can make it as wide as a code editor).
5. **Given** both are open, **When** the user works, **Then** each has its own width and open / close state, and neither hides the other's content.
6. **Given** a deck without tables, **When** the user opens the DBML drawer, **Then** it shows the same empty state the DBML tab showed.
7. **Given** the DBML or SQL tab, **When** it is shown, **Then** there is no Selection / Whole schema switch and the whole schema is displayed, whatever is selected on the canvas.
8. **Given** a browser that remembered the Selection scope earlier, **When** the drawer opens, **Then** the whole schema is shown and the old preference is ignored (not erased).
9. **Given** a deck with tables but nothing selected, **When** the DBML tab opens, **Then** it shows the whole schema, never a "select tables" message.
10. **Given** the user closes the drawer with Esc or its close control, **When** it closes, **Then** focus returns to the control that opened it, and unsaved invalid DBML text is not lost silently (the same rule as the former tab).

---

### Edge Cases

- A deck that has only one of Overview / Flows saved, or a custom view named "Overview": nothing is merged or renamed; presets are added only when the deck has no saved views.
- Compact shell: Focus and deck settings stay reachable (toolbar overflow or menu) and keep their labels.
- Select-all while a flow is shown or a drill-in is active: only items in the current scope are locked; the confirmation says how many.
- Locking a group whose cards are partly outside the current view: all its cards are locked, not only the visible ones.
- Locked items inside a group that is then unlocked: they are unlocked too (see US5-4); no per-item memory is kept.
- Spread ends evenly with locked cards selected: the action explains that locked cards are skipped (existing 043 rule).
- Opening the DBML drawer and the details drawer together: they must not overlap; both keep their own resize grip. The DBML drawer is the one that gives way: its maximum width shrinks so a usable canvas strip stays, and when even its 320 px minimum does not fit, opening one closes the other.
- A very wide DBML drawer must leave a usable strip of canvas and keep the left rail and deck island reachable.
- Narrow window: the drawer and JSON panel never leave the canvas unusable; the shell's existing minimum canvas width rule applies.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The tools island (top-right) MUST show a visible, labelled entry to deck settings; the hamburger menu MAY keep its entry; both open the same settings.
- **FR-002**: Deck settings MUST be reachable by keyboard and in the compact shell.
- **FR-003**: A deck with no saved views MUST offer exactly two built-in views, Overview and Flows; Overview is the default selection.
- **FR-004**: Overview MUST carry the default settings of the former System view; Flows MUST keep the former Feature view's its current settings.
- **FR-005**: Opening a deck MUST NOT change its saved views; decks that contain System or Infra MUST keep and display them as saved.
- **FR-006**: The Focus tool MUST be in the left toolbar directly below Select, MUST NOT remain in its former place, and MUST keep its behaviour, shortcut, disabled state and tooltip.
- **FR-007**: The table-detail control MUST be a single compact control that shows its current choice and lists Auto, Names, Keys and All, each with a one-line explanation.
- **FR-008**: Choosing a table detail MUST apply to all tables and be one undo step; the control MUST be absent in a deck with no table.
- **FR-009**: "Spread ends evenly" MUST show an explanation of its effect on hover and focus, and MUST say why it is disabled when it is.
- **FR-010**: Lock MUST apply to every selected card and group in one undo step, including after select-all.
- **FR-011**: Locking a group MUST lock the group and every card inside it; unlocking a group MUST unlock the group and every card inside it.
- **FR-012**: The lock action label MUST read Unlock only when every selected item is locked, otherwise Lock; the result MUST be announced with the count of items changed.
- **FR-013**: The DBML editor MUST open in its own right-side drawer, with the same editing, validation, undo and apply-to-canvas behaviour it had in the JSON panel.
- **FR-014**: The right drawer MUST offer two tabs, DBML (editable) and SQL (read-only); the JSON panel MUST show only the deck JSON, with no DBML or SQL tabs.
- **FR-015**: The DBML drawer MUST have its own open / close state and width, remembered the same way the JSON panel's are, resizable by dragging its left edge and from the keyboard like the details drawer, from 320 px up to at least 70% of the window (a DBML editor needs far more room than the 560 px of the details drawer), and MUST be reachable from the toolbar or menu in a deck with tables and from the command palette.
- **FR-016**: All new or moved controls MUST have accessible names, keyboard operation, visible focus and tooltips following DESIGN.md.
- **FR-017**: None of these changes MUST alter the deck file format, send any deck content over the network, or regress canvas performance.
- **FR-018**: The DBML and SQL views MUST always show the whole schema and MUST NOT show a Selection / Whole schema switch or any text that refers to it (empty-state and hint messages included). The Selection code path MUST stay in place, hidden, so restoring it later is a small change.

### Key Entities

- **View**: a saved arrangement of a deck (name, subtitle, filters, positions). The built-in presets offered to a deck without views change from System / Feature / Infra to Overview / Flows.
- **Lock state**: a flag on a card or group; locking a group sets it on the group and each card in it.
- **Table detail**: the deck-wide level of detail shown on tables (Auto, Names, Keys, All).
- **Editor drawers**: the right-side surfaces (inspector, JSON panel, DBML drawer); only their open / width state is user preference, not deck content.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time user finds and opens deck settings in under 10 seconds without opening the hamburger menu (founder walk-through, 3 of 3 tries).
- **SC-002**: Focus can be turned on from the left toolbar in one click, and its position is the same in every editor layout.
- **SC-003**: A user can lock every card and group in a deck of 200 cards with 2 actions (select all, Lock) and unlock them with the same 2, each undone with one ⌘Z.
- **SC-004**: The table-detail control takes no more than one tool slot of width in the zoom island, and every choice shows its explanation without leaving the editor.
- **SC-005**: Every one of the six moved or changed controls (deck settings, Focus, table detail, Spread ends evenly, Lock, DBML drawer) is operable by keyboard and has an accessible name and description.
- **SC-006**: Opening any existing deck saved before this change leaves its file byte-for-byte unchanged until the user edits it.
- **SC-007**: The DBML drawer and the JSON panel can be open at the same time at a 1440 px window without hiding each other, and the canvas stays usable.

## Assumptions

- "Board settings" in the founder's note is the current **Deck settings** entry of the hamburger menu.
- Overview is the former System view renamed, and Flows the former Feature view renamed with the same defaults; Infra (host subtitle, dimmed clients) is dropped from the built-in presets. Decks that already hold Infra keep it; a user can still make a custom view with the same settings.
- The visible deck-settings entry is an icon button in the tools island, top-right (with Jump to and Labels), not the crowded top-left deck island. Its exact order inside the island is decided in planning.
- Locking a group also locks its cards (one flag per item, set together); no new "group lock" data is introduced and the file format does not change.
- The explanations in US4 and US6 are short tooltips or option descriptions, not a tutorial or onboarding (onboarding is feature 013).
- The existing shortcuts stay as they are; no new shortcut is required, except that the DBML drawer gets a command-palette entry.
- The Selection / Whole schema switch is hidden only in the DBML and SQL views; the JSON view's own Selection / Deck switch is not part of this change.
- A remembered "selection" scope preference is ignored while the switch is hidden and is not rewritten, so it works again if the switch returns.
- Reference screenshots, if any, stay local and git-ignored as in 053.
