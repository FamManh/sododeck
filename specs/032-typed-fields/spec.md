# Feature Specification: Typed Fields

**Feature Branch**: `032-typed-fields`

**Created**: 2026-10-03

**Status**: Draft · resumed after 030 (built, PR #68)

**Input**: User description: "32 from docs/backlog.md": users add typed fields to cards (text, number, select, status, person, date, date range, link, progress) and choose which ones show on the card.

**Sources**: `docs/backlog.md` §032 (scope, schema, out of scope, acceptance criteria) and §030 (card types: today's six kinds map to the Architecture pack's type ids byte for byte); `docs/decisions/0022-schema-roadmap.md` "Typed fields (032)" (deck `fields`, `node.values`, value shapes, built-in fields keep their storage, dangling values kept and reported, layout-2 lists); `DESIGN.md` "Card system (Deck)" (card regions: fields between description and tags; chip-type fields on one shelf, row-type fields as label–value rows, "+n fields" pill; `--sd-deck-chip`; person avatar; bar field; zoom levels table) and `colour-popover`; `docs/design/design-analysis.md` frame 124 "Typed fields" (nine kinds and how each shows, a card with "+3 fields", the drawer field editor with "On card" toggles, a new select field with options, the field-type menu), §g-40 (deferred card attributes, lifted by 032), §g-58 (one card size at every zoom level), §g-61 D3, §g-70 (field visibility per level decided by 032); constitution v1.0.0.

**Dependency note**: depends on 030 (card types and packs), built and merged (`specs/030-card-types-and-packs/`, PR #68). Field definitions apply to card **types** by 030's ids: `service`, `database`, `gateway`, `client`, `queue`, `external`, `component`, `task`, `decision`, `document`, `warehouse`, `truck-route`, `issue` (031 adds shape types; shapes keep fields in the drawer only). 029 (Deck card) and 033 (tag colours) are built.

## Scope

**In scope**

- **Field definitions per deck**, each with a name, a kind and the card types it applies to: text, number (with an optional unit, e.g. "pts", "h"), select (coloured options), status (coloured options with a status icon), person (free text shown with initials), date, date range, link, progress (0–100 as a bar).
- **Values per card** for the fields of its type; editing them in the drawer.
- **Built-in fields** Tech and Host (Architecture types) and Owner (every type) appear in the same field list with the same "On card" toggle and ordering; their values stay stored where they are today (clarify Q2).
- **Default fields per type** (clarify, frame 120): Task (Status, Assignee, Due date), Document (Link), Warehouse (Capacity, SLA, Region), Truck route (Departure), Issue (Status, Assignee, Dates, Estimate); Architecture types and Decision have none beyond the built-ins. Defaults come with the type, show on the card as in frame 120, and are edited, hidden or deleted like any field.
- **"On card" per field, for every card of that type** (clarify Q1); the drawer says so.
- **Card display** (frame 124, `DESIGN.md`): select, status, person, date and date range as chips on one shelf; text, number, link and progress as label–value rows; a dashed "+N fields" pill for fields with a value that are not shown on the card; card height follows what is shown.
- **Field editor in the drawer**: add a field (name, kind menu, options for select / status, "Show on card"), rename, change options, reorder, delete with a usage count.
- Light and dark themes; keyboard operation; JSON panel in sync; export draws fields on cards.

**Out of scope**

- Formulas, computed fields, relations between cards, rollups.
- Per-view or per-card field visibility (clarify Q1: on-card is per type).
- User-defined card types and packs (030).
- Fields on connections, groups, flows or stickies.
- Filtering or sorting views by field values.
- Person fields linked to real accounts (no accounts in the MVP).
- New end-to-end tests (constitution Principle VI, `TODO(e2e)`).

## Clarifications

### Session 2026-10-03

- Defaults from backlog §032, ADR 0022 and `DESIGN.md` are taken as decided: deck-level `fields` definitions and `node.values` (field id → value); value shapes per kind (ADR 0022); a value whose field or option no longer exists is kept and reported; built-in fields keep their storage.
- Q: Does "show on card" apply to one card or to every card of that type? → A (founder): **every card of that type**, as ADR 0022 stores it on the field definition. The toggle in a card's drawer says "Applies to every <type>".
- Q: Are Tech, Host and Owner part of the new field list, with ordering and an "On card" toggle? → A (founder): **yes, like other fields**. They default to off (today cards do not show them), their values stay where they are stored today, and only the on-card choice and order are stored in addition.
- Q: How do fields show at each zoom level (§g-70)? → A (default, `DESIGN.md` zoom table and §g-58): the card keeps one size at every level; Component and Container show every on-card field; System shows field chips as 6 px dots and no rows; Landscape shows no fields.
- Q: Where does a status field show on the card? → A (default, frame 124 and `DESIGN.md` header badge slot): the **first** on-card status field sits in the card header's status slot (icon-only on narrow cards); further status fields sit on the chip shelf.
- Q: What does a new status field start with? → A (default): three options "To do" (slate), "In progress" (blue) and "Done" (green), editable like any options; a new select field starts with none.
- Q: What happens when a field or an option is deleted from the editor? → A (default, same pattern as 033's tag delete): a confirmation shows how many cards hold a value; confirming removes the definition (or option) and those values in one undo step. Values left dangling by other means (an import, a concurrent edit) are kept and reported in Problems.
- Q: Should 032 run now on today's six kinds, or wait for 030 (card types)? → A (founder, clarify): **wait for 030.** 032 is on hold; spec 030 first, then resume clarify and plan here against 030's type ids.
- Q: Can 032 be specified from 030's spec, plan and tasks before 030 is built? → A (founder, 2026-10-03): **yes.** Spec, plan and tasks use 030's planned ids and names; implementation starts after 030 is merged and re-checks those names on `main`.
- Q: Do 030's new types come with default fields? → A (founder, clarify): **yes, from frame 120**: Task: Status (status, on card, header), Assignee (person, on card), Due date (date, on card). Document: Link (link, on card). Warehouse: Capacity (progress, on card), SLA (number, unit "h", on card), Region (select, no options yet, on card). Truck route: Departure (date, on card). Issue: Status (status, on card, header), Assignee (person, on card), Dates (date range, on card), Estimate (number, unit "pts", on card). Architecture types and Decision: none beyond Tech / Host / Owner. Tech and Host are listed only for Architecture types (and for any card that already holds a value); Owner for every type. A default field costs nothing in the deck until the user gives it a value or changes its definition.
- Q: Can a field's kind change once cards hold values? → A (founder, clarify): **yes, to any kind.** Values that convert are kept; the rest are cleared after a confirmation "N values will be cleared"; the change and the clearing are one undo step. Conversions kept: text ↔ person; select ↔ status (options carried over); number ↔ progress (only values 0–100 stay progress); number, date, select / status (option label), person, link (address) → text; text → number when it reads as a number; date → date range (one-day range); date range → date (its start); text → select / status (each distinct text becomes an option). Built-in fields never change kind.
- Q: Does a Person field suggest people already in the deck, and does renaming a person update every card? → A (founder, clarify): **suggestions yes, bulk rename no.** Typing in a Person field (or Owner) suggests names already used in any Person field or Owner of the deck, matched ignoring case; picking one writes that spelling, and typing a name that matches one ignoring case writes the existing spelling (first spelling wins). Values stay free text per card; there is no people list to manage and no deck-wide rename.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Add a field and fill it in (Priority: P1)

A user opens the drawer of the "Orders DB" database card, presses "Add field", types "Region", picks Select from the kind menu, adds the options "North" and "South", and presses ⏎. Every database card now has a Region field; the user picks "South" on this one.

**Why this priority**: Without definitions and values nothing else in this feature exists. It also gives the drawer view of any field even before on-card display ships.

**Independent Test**: In a deck with three database cards, add a select field from one card's drawer, set a value on two cards, check the drawer, the JSON panel and undo.

**Acceptance Scenarios**:

1. **Given** a card's drawer, **When** the user adds a field "Region" of kind Select with options "North" and "South", **Then** the field appears in the drawer of every card of that type, the JSON panel shows the definition, and one undo step removes it.
2. **Given** a Region field, **When** the user picks "South" on one card, **Then** only that card holds the value, shown as a coloured chip in the drawer, and one undo step clears it.
3. **Given** each of the nine kinds, **When** the user enters a value, **Then** the drawer offers a fitting control: a text box (text, person), a number box with the unit (number), an option list (select, status), a date picker (date), a start and end date (date range), a URL with an optional label (link), a 0–100 slider or number (progress).
4. **Given** an invalid entry (letters in a number, a progress of 140, an end date before the start, a link that is not a web or mail address), **When** the user confirms, **Then** the value is refused with a message next to the field and nothing is stored.
5. **Given** a field definition, **When** the user clears a card's value, **Then** the value is removed from the card and the field stays defined.
6. **Given** a card of another type, **When** its drawer opens, **Then** it does not list fields that apply only to other types.
7. **Given** a new Task card, **When** its drawer opens, **Then** it lists Status, Assignee and Due date (empty) plus Owner, with "On card" on for all three; the deck file gains nothing until a value is set.

---

### User Story 2 - Show chosen fields on the card (Priority: P1)

The user turns "Show on card" on for Capacity, SLA, Region and Status on the Warehouse type. Every warehouse card now shows Status in its header, Region as a chip, Capacity as a bar row and SLA as a row; the cards grow to fit. Fields with a value that stay in the drawer show as "+3 fields".

**Why this priority**: Seeing key attributes at a glance on the board is the reason the founder asked for fields (§g-40, §g-61 D3).

**Independent Test**: With four fields on a type and values on two cards, toggle "Show on card" for each, check the cards in light and dark at each zoom level, and the "+N fields" pill.

**Acceptance Scenarios**:

1. **Given** a field with "Show on card" on, **When** a card of that type has a value, **Then** the card shows it in the fields region: select, status, person, date and date range as chips on one wrapping shelf without labels (the icon names them); text, number, link and progress as label–value rows.
2. **Given** a card with values in fields that are not shown on the card, **When** it is drawn, **Then** a dashed "+N fields" pill shows N (the count of those values); activating it opens the drawer at the fields section.
3. **Given** "Show on card" turned off for a field, **When** the cards redraw, **Then** the field leaves every card of that type, the cards shrink, and one undo step restores it.
4. **Given** a field shown on the card but empty on a card, **When** that card is drawn, **Then** nothing is drawn for it (no empty label) and it does not count in "+N fields".
5. **Given** the first on-card status field has a value, **When** the card is drawn, **Then** the status chip sits in the header's status slot (icon only when the card is narrower than 150 px); later status fields sit on the shelf.
6. **Given** zoom levels, **When** the user zooms, **Then** the card keeps one size; Component and Container show every on-card field; System shows chips as dots in the option colour and no rows; Landscape shows no fields.
7. **Given** a long text value or many chips, **When** the card is drawn, **Then** a row value is cut to one line with "…" and the full value on hover; chips wrap; the card height follows the content.
8. **Given** a card the user resized (017), **When** fields are shown on it, **Then** its stored width and height are kept, except that the height never goes below what the header, title, on-card fields and tags need (the same minimum rule 017 / 029 apply to tags).

---

### User Story 3 - Manage field definitions (Priority: P2)

The user renames "SLA" to "SLA (h)", recolours the "South" option, adds "East", drags Capacity above SLA, and deletes "Docks", which the editor says is used on 4 cards.

**Why this priority**: Definitions change as a deck grows; without editing, users would delete and recreate fields and lose values.

**Independent Test**: Rename, reorder, edit options and delete a field used on several cards; undo each in one step.

**Acceptance Scenarios**:

1. **Given** a field, **When** the user renames it, **Then** every card and drawer show the new name, values stay, and one undo step restores the name.
2. **Given** a select or status field, **When** the user adds, renames or recolours an option, **Then** cards holding that option update; **When** they delete an option used on N cards, **Then** a confirmation shows N and confirming removes the option and those values in one undo step.
3. **Given** the field list in a drawer, **When** the user drags a field (or moves it with the keyboard), **Then** the order changes for every card of that type, in the drawer and on the card.
4. **Given** a field used on N cards, **When** the user deletes it, **Then** a confirmation reads "Delete field · used on N cards"; confirming removes the definition and every value in one undo step.
5. **Given** an empty name, or a name already used by another field of the same type (ignoring case), **When** the user confirms, **Then** the edit is refused with a clear message.
6. **Given** a Text field "Estimate" holding "5", "8" and "big" on three cards, **When** the user changes its kind to Number, **Then** a confirmation says 1 value will be cleared; confirming keeps 5 and 8 as numbers, clears "big", and one undo step restores the Text field with all three values.
7. **Given** a field that applies to one type, **When** the user chooses "Also use for…" and picks another type, **Then** the field appears on cards of both types; removing a type keeps that type's values (reported as unused) until the user deletes them.

---

### User Story 4 - Built-in fields join the list (Priority: P2)

Tech, Host and Owner show in the same field list as user fields, with drag handles and "On card" toggles. The user turns Owner on for services; every service card shows its owner as a person chip.

**Why this priority**: One list is simpler than two places for the same kind of information (clarify Q2), but the cards are useful without it.

**Independent Test**: Open a deck saved before 032, check the drawer lists Tech, Host and Owner with their values, toggle Owner on, export, re-import.

**Acceptance Scenarios**:

1. **Given** a card with tech "Go" and owner "Payments team", **When** its drawer opens, **Then** Tech (text), Host (text) and Owner (person) appear in the field list with their values and "On card" off.
2. **Given** Owner turned on for the service type, **When** service cards are drawn, **Then** each shows its owner as a person chip with initials; the stored owner value is unchanged.
3. **Given** a built-in field, **When** the user tries to delete or rename it or change its kind, **Then** those actions are not offered; it can be reordered and toggled.
4. **Given** a deck saved before 032, **When** it is opened, **Then** cards look exactly as before and the file gains no field data until the user changes a field.

---

### User Story 5 - Fields everywhere else keep working (Priority: P3)

Fields show in the JSON panel, survive export and import, are drawn in PNG / SVG exports, are found by search, and work with several cards selected.

**Why this priority**: Keeps the single document model coherent; each item is small but they all matter before release.

**Independent Test**: Fill fields on several cards, select three of them, search for a value, export and re-import.

**Acceptance Scenarios**:

1. **Given** fields and values, **When** the deck is exported and imported, or saved and reopened, **Then** definitions, values, order and on-card choices are unchanged.
2. **Given** an export to PNG or SVG, **When** cards have on-card fields, **Then** they are drawn as on the canvas (light theme).
3. **Given** three selected cards of the same type, **When** the bulk drawer shows fields, **Then** shared values show, differing ones read "Mixed", and setting a value writes it to all three in one undo step.
4. **Given** a text, person, select / status option label or link label value, **When** the user searches for it, **Then** the card is found.
5. **Given** a file whose value points at a field or option that no longer exists, **When** it is opened, **Then** the value is kept, not drawn on the card, and listed in Problems with a way to remove it.

---

### Edge Cases

- A card type with no fields: the drawer shows only "Add field".
- Many on-card fields (for example 12): all show; the card grows; no field is dropped silently.
- A select with many options (for example 30): the option list scrolls and is searchable by typing.
- Two fields with the same name on different types: allowed; within one type names must differ (ignoring case).
- A date range with the same start and end: shows as one date.
- Dates are stored without time zone and shown in the short English format ("14 Oct", "6–17 Oct"; the year is shown when it is not the current year).
- Progress values are clamped to 0–100 on entry; a stored value outside 0–100 (hand-edited file) is reported and drawn clamped.
- A link without a label shows the address without the scheme; it opens in a new tab only on an explicit click, never on hover.
- Typing "lan" when "Lan" exists in the deck writes "Lan"; two cards never hold the same person in different case unless they did before this feature (older values are left as they are).
- A person value is free text; initials are the first letters of the first two words (one letter for one word).
- An option colour can be any of the 13 card colours, a deck colour, or none (slate); text on a chip stays readable in both themes.
- A field deleted while a card's drawer is open on it: the drawer updates without losing other edits.
- Two tabs editing the same deck: last write per value or per definition key wins and the document stays valid (036).
- Copy / paste and duplicate of a card keep its values; pasting into another deck without the field keeps the values and reports them (dangling), never invents a definition.
- Undo and redo of add, rename, reorder, option edits and delete are one step each, including the values they touch.
- Flow playback (035), focus (034) and selection keep their own looks on the card; field chips are content and never carry a state.

## Requirements _(mandatory)_

### Functional Requirements

**Definitions and values**

- **FR-001**: A deck MUST hold field definitions, each with a stable id, a name, a kind (text, number, select, status, person, date, date range, link, progress), the card types it applies to, an on-card choice and, for number, an optional unit; select and status MUST hold an ordered list of options with a stable id, a label and an optional colour.
- **FR-002**: A card MUST hold values only for the fields of its type, stored by field id; a value MUST match its kind (text; number; an option id; free text; a date; a start and end date with end ≥ start; a web or mail address with an optional label; 0–100).
- **FR-003**: Renaming a field or an option MUST never change its id or any stored value.
- **FR-004**: Built-in fields MUST appear in the field list (Tech and Host for Architecture types and for any card already holding a value, Owner for every type), with their values read from and written to where they are stored today; they MUST be reorderable and have an on-card choice, and MUST NOT be renamed, deleted or change kind.
- **FR-004a**: Each type MUST come with the default fields listed in the Clarifications, with their kinds, units and on-card choices; a default field MUST behave like a user field (rename, options, reorder, hide, delete) and MUST NOT be stored in the deck until the user gives it a value or changes it; deleting a default field from a deck MUST keep it deleted for that deck.
- **FR-005**: A deck saved before this feature MUST open and save unchanged until the user changes a field; a deck with no field data MUST be written exactly as before.

**Display**

- **FR-006**: "Show on card" MUST apply to every card of the type; the toggle MUST say so ("Applies to every <type>").
- **FR-007**: On a card, select, status, person, date and date range values MUST show as chips on one wrapping shelf without labels; text, number, link and progress MUST show as label–value rows; order MUST follow the field order; empty values MUST not show.
- **FR-008**: The first on-card status field with a value MUST show in the card header's status slot; others MUST show on the shelf.
- **FR-009**: A card MUST show a "+N fields" pill when N fields of its type hold a value but are not shown on the card; activating it MUST open the drawer at the fields.
- **FR-010**: Card height MUST follow the fields shown; a user-set height (017) MUST be kept but never go below the minimum that fits the header, title, on-card fields and tags; the card MUST keep one size at every zoom level, with fields shown per level as in the Clarifications.
- **FR-011**: Chip text MUST meet the same contrast as tag pills (033) in both themes for every option colour, including deck colours; a field's meaning MUST never rest on colour alone (the label or the option text is always available).

**Editing**

- **FR-012**: Users MUST be able to add a field from a card's drawer (name, kind from a menu, options for select / status, "Show on card"), defaulting to the card's type; ⏎ adds, Esc cancels.
- **FR-013**: Users MUST be able to rename, reorder (pointer and keyboard), extend to or remove from types, edit options (add, rename, recolour, reorder, delete) and delete fields; each change MUST be one undo step including the values it touches.
- **FR-014**: Deleting a field or an option that holds values MUST first show how many cards are affected.
- **FR-014a**: Changing a user or default field's kind MUST keep every value that converts (rules in the Clarifications), MUST show "N values will be cleared" before clearing the rest, and MUST apply the kind change and the clearing as one undo step.
- **FR-014b**: Person fields and Owner MUST suggest names already used in the deck's Person fields and Owner while typing, matched ignoring case; a typed name equal to an existing one ignoring case MUST be written in the existing spelling.
- **FR-015**: Invalid entries MUST be refused with a message next to the field; nothing invalid MUST be stored.
- **FR-016**: Several selected cards of one type MUST show shared values and "Mixed" for differing ones; setting a value MUST write all of them in one undo step.

**Integrity and integration**

- **FR-017**: A value whose field or option no longer exists MUST be kept, not drawn on the card, and reported in Problems with a remove action.
- **FR-018**: Definitions, values, order and on-card choices MUST survive save, reload, export and import, and MUST appear in the JSON panel in sync with the canvas.
- **FR-019**: PNG and SVG exports MUST draw on-card fields as the canvas does (light theme).
- **FR-020**: Search MUST find cards by text, person, number, select / status option label and link label values.
- **FR-021**: Copy, paste and duplicate MUST keep a card's values.
- **FR-022**: The field editor, value controls and "+N fields" pill MUST be fully operable by keyboard with visible focus, expose roles and names to assistive technology, and announce adds, removals and deletes.
- **FR-023**: No part of this feature MUST make a network call; link values MUST never be fetched or previewed.

### Key Entities

- **Field definition**: a deck-level named field with a kind, the card types it applies to, an on-card choice, an order, an optional unit (number) and options (select, status). Identified by a stable id.
- **Option**: a choice of a select or status field: stable id, label, optional colour, order.
- **Value**: what one card holds for one field, stored by field id; its shape depends on the kind.
- **Default field**: a field a type comes with (for example Task's Status); defined by the app until the user changes it in a deck, then stored there with the same id.
- **Built-in field**: Tech, Host or Owner; listed with the other fields (Tech and Host for Architecture types, Owner for every type), values stored where they are today; only order and on-card choice are added.
- **Card type**: a type from 030's registry (for example Service, Task, Warehouse), identified by a stable id.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can add a select field with three options and set it on a card in under 30 seconds from opening the drawer.
- **SC-002**: Toggling "Show on card" updates every card of the type at once; on a 500-card deck the change appears within the next frame after the click and is one undo step.
- **SC-003**: One undo step reverses any add, rename, reorder, option edit, value change or delete, in 100 % of cases tried, including the values touched.
- **SC-004**: 100 % of decks saved before this feature open unchanged and export with no field data added.
- **SC-005**: A deck using all nine kinds survives export, import, save and reopen with no data loss.
- **SC-006**: Every chip colour (13 named, slate, and a sample of deck colours) reaches at least 4.5:1 text contrast in both themes.
- **SC-007**: The whole flow (add field, pick kind, add options, set value, toggle on card, reorder, delete) can be done with the keyboard alone.
- **SC-008**: On the 500-card benchmark deck with four on-card fields per card, panning and dragging stay within the existing canvas targets (no drop beyond run-to-run variation).

## Assumptions

- Type ids are 030's registry ids (built-in, defined by the app); each type's default fields and default on-card choices are added by this feature to 030's registry (per-type `defaultFields`), not stored in the deck until the user changes them.
- The stored shape follows ADR 0022 "Typed fields (032)" with two refinements recorded there by this feature: an optional `unit` on number fields, and storage of order and on-card choice for the built-in fields (Q2). `fields` and `fields[].options` use the collaboration-ready list layout (ADR 0021, 0022), so no later storage change is needed. No version bump (§g-81).
- The nine kinds, their display (chip or row) and the editor follow frame 124 (light and dark); `DESIGN.md` wins where they differ. Progress is the "Number · as bar" row of frame 124.
- Status options carry a status icon chosen from a small fixed set (circle, half circle, check, door…) in the plan; the exact icons follow `DESIGN.md` and `lucide-react`.
- Dates are calendar dates without time or time zone; English short format.
- The cap of 10 tags per card is unrelated and unchanged; there is no cap on fields.
- Real-time collaboration is out of scope; the document stays collaboration-ready (036).
