# Feature Specification: Collaboration-Ready Deck Document

**Feature Branch**: `036-collab-ready-document`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "036-collab-ready-document — Make the stored deck document ready for real-time collaboration and a later sync server, without changing what users see. Collections stored by id with an order instead of by position, so a reorder is one small change, concurrent edits of a moved object survive and two clients moving the same item cannot duplicate it; long text merges character by character when two people type at once; after every change that arrives from elsewhere the deck is checked, breakage is reported as problems and what is safe is repaired; one schema roadmap ADR for features 029, 033, 022, 030 and 032; deck ids are the global identity. The `.sododeck.json` file format is unchanged. Founder decisions of 2026-10-03: ADR 0020 / backlog 025 are deferred, so there is no format revision, no read-only mode and no migration of decks stored before this feature; collapsed-group state stays shared."

**Sources**: `docs/backlog.md` §036 (scope, acceptance criteria, risks), ADR 0005 (document layout and editing policy; its "Consequences" list the limits this feature removes), ADR 0007 (local storage and live multi-tab sync), ADR 0013 (derived problems), `docs/diagram-handbook.md` §6 (how the deck's update log maps to a sync server), `docs/design/design-analysis.md` §g-35 (multi-tab = live sync), §g-65 (format, scale and collaboration review), §g-81 (ADR 0020 deferred: the stored deck and the file format may change freely during development), constitution v1.0.0 (principles I, II, III, V, VI, VIII).

**Dependency note**: none. Backlog 025 (format compatibility) is deferred and is **not** a prerequisite (§g-81). 037 (scale bench) and 029 (card look, the first of five schema changes) come after this feature.

## Why

Sododeck already keeps the same deck in sync between browser tabs, and the plan is to add a sync server and real-time collaboration later. The way a deck is stored today has three known limits (written down in ADR 0005 when it was accepted) that turn into lost work as soon as two people edit at once:

1. **Lists are stored by position.** Moving an item is "remove here, insert there". If someone else is editing that item at the same moment, their edit is lost; if two people move the same item, it can appear twice.
2. **Text is one value per field.** If two people type in the same description, the later write replaces the earlier one.
3. **Only the writer checks its own edit.** A change that arrives from another tab or person is never checked, so two edits that are each valid can combine into a broken deck that nobody is told about.

There are no real users yet (§g-81), so the stored form of a deck can change now without a migration. After launch the same change needs a migration for every user. The file users export, share and commit to git must not change.

## Scope

**In scope**

- **Lists stored by identity and order**, not by position: components, groups, connections, notes, views, features, flows, the steps and branches of a flow, and the columns and rows of a rule. Reordering becomes one small change to the moved item.
- **Long text merges as typed**: every description (deck, component, group, connection, feature, flow, step, branch, rule), step notes, step payload and note text. Short text (titles, labels, names, conditions, cells) keeps "the later write wins".
- **Check and repair on receive**: every change that arrives from another tab is checked; breakage shows up in Problems; a small, fixed set of safe repairs is applied automatically.
- **A schema roadmap ADR** that names every field and object the next five format changes (029, 033, 022, 030, 032) add, and records two standing decisions: a deck's id is its global identity, and collapsed-group state is shared document data.
- Updated package docs and ADR 0005 (amended or superseded) so the documented layout matches the stored one.

**Out of scope**

- A sync server, accounts, sharing, permissions, presence (other people's cursors and selections).
- Any change to the `.sododeck.json` file format, including the fields listed in the roadmap ADR (each is added by its own feature).
- A format revision number, a read-only mode, and **any handling of decks, files or tabs from builds before this feature** (deferred with ADR 0020, §g-81). Decks stored in the browser before this feature are not migrated.
- Character-level merging of short text (titles, labels) and rich-text editing.
- Per-person view state (each person's own collapsed groups, viewport or current view on a shared deck).
- New user interface. The only visible differences are that concurrent edits stop being lost.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Everything works as before, on the new foundation (Priority: P1)

A user opens the app after this feature ships and notices nothing: creating, editing, reordering, deleting, undoing, playing flows, editing rules, saving, reopening, importing and exporting all behave as before, and a deck exported after the change is byte-for-byte the file it was before.

**Why this priority**: The new stored form sits under every feature built so far. If it changes behaviour or the exported file, everything else in this feature is worthless. It is also the part that 037 and 029–032 build on.

**Independent Test**: Import a set of reference decks (the sample decks, the test fixtures, the 500-component benchmark deck), export each one, and compare with the export from the previous build; run the whole existing test suite and the smoke tests.

**Acceptance Scenarios**:

1. **Given** any valid `.sododeck.json` file, **When** it is imported and exported without edits, **Then** the exported text is identical to the export produced before this feature, byte for byte.
2. **Given** a deck, **When** the user reorders components in the outline, moves a flow step, or moves a rule row or column, **Then** the new order shows everywhere it showed before (outline, step list, rule table, exported file) and one undo restores the old order.
3. **Given** a deck with flows that have branches, **When** it is exported, **Then** each flow's steps are in the same order as before (main path first, then each branch's steps in branch order).
4. **Given** a deck edited and closed, **When** it is reopened from the library, **Then** it shows the same content, order and view state as when it was closed.
5. **Given** an edit that was refused before (invalid value, missing reference, duplicate id), **When** it is attempted, **Then** it is still refused with the same error and the deck is unchanged.
6. **Given** the 500-component / 1,000-connection benchmark deck, **When** the benchmark runs before and after, **Then** no measured scenario gets worse beyond run-to-run noise.

---

### User Story 2 - Reordering in one tab never loses or duplicates work from another (Priority: P2)

Lan has the same deck open in two tabs (later: Lan and a teammate on two computers). In one tab she drags a flow step to a new place; in the other, at the same moment, the step's title is being edited. When the tabs catch up with each other, the step is in its new place **and** has its new title. If both tabs move the same step, it ends up in one place in both tabs, never twice.

**Why this priority**: This is the limit ADR 0005 flagged as "acceptable until collaboration is designed". It is the most common way two people working on one diagram would silently lose work.

**Independent Test**: With two copies of one deck that exchange changes only after both have been edited, reorder an item in one and edit or move the same item in the other, then let them sync in either order and compare.

**Acceptance Scenarios**:

1. **Given** two tabs on the same deck, **When** one moves a flow step and the other edits that step's title before they sync, **Then** after syncing both tabs show the step in its new position with the new title.
2. **Given** two tabs, **When** both move the same item (a step, a component in the outline, a rule row) to different positions before they sync, **Then** after syncing both tabs show the item exactly once, at the same position in both.
3. **Given** two tabs, **When** each adds a new item at the same position of the same list before they sync, **Then** after syncing both items exist, in the same order in both tabs.
4. **Given** two tabs, **When** one deletes an item while the other moves it, **Then** after syncing the item is gone in both tabs and no empty or half-filled item is left behind.
5. **Given** any of the cases above, **When** the changes reach the tabs in a different order, **Then** the result is the same.
6. **Given** a tab that reordered an item, **When** the user presses undo, **Then** only that tab's own move is undone; the other tab's edits stay.

---

### User Story 3 - Two people typing in the same text keep both texts (Priority: P3)

Two tabs have the same component open and both type into its description. Neither loses a sentence: after syncing, the description contains what both typed, and each sees the other's text appear while still typing, without their own half-typed words or cursor being thrown away.

**Why this priority**: Descriptions, notes and step text hold the knowledge the diagram exists for, and long text is where two people are most likely to work at the same time. It matters less than Story 2 today because one person rarely types in two tabs at once.

**Independent Test**: With two copies of one deck, type different text at different places of the same description (and at the same place), sync in either order, and check that all typed text is present in both.

**Acceptance Scenarios**:

1. **Given** two tabs with the same description open, **When** one adds a sentence at the start and the other adds one at the end before they sync, **Then** after syncing both tabs show both sentences and the original text.
2. **Given** two tabs, **When** both type at the same place of the same text, **Then** after syncing both texts are present in both tabs, in the same order in both, with neither one's characters interleaved inside the other's words.
3. **Given** a user typing in a long text field, **When** a change to the same field arrives from another tab, **Then** the field shows the merged text, the characters the user has typed are kept, and the cursor stays next to what they were typing.
4. **Given** a user who typed in a description, **When** they press undo after leaving the field, **Then** only their own typing is undone; text typed in the other tab stays.
5. **Given** a short text field (a title, a label), **When** two tabs change it before they sync, **Then** the later change wins as it does today, and no other field of the object is affected.
6. **Given** a deck whose long text was edited in two tabs, **When** it is exported, **Then** the file holds the merged text as an ordinary text value, exactly as the format always has.

---

### User Story 4 - A change from elsewhere never leaves a silently broken deck (Priority: P4)

Two edits that are each fine on their own can clash: one tab deletes a component while the other draws a connection to it. After syncing, the user is not left with an invisible inconsistency: the deck is checked the moment the change arrives, anything broken is listed in Problems like any other problem, and small structural leftovers that carry no user content are cleaned up automatically, the same way in every tab.

**Why this priority**: Today a writer checks its own edits, and nothing checks what arrives. It becomes necessary with collaboration; between one person's tabs it is rare.

**Independent Test**: With two copies of one deck, make a pair of edits that are valid separately and inconsistent together, sync, and check the Problems list and the stored deck in both.

**Acceptance Scenarios**:

1. **Given** two tabs, **When** one deletes a component and the other connects something to it before they sync, **Then** after syncing the connection is kept, is not drawn as if it were valid, and is listed in Problems in both tabs with the next change notification.
2. **Given** the case above, **When** the tab that deleted the component undoes the delete, **Then** the component returns and the other tab's connection is attached to it again.
3. **Given** two tabs, **When** one deletes a component and the other pins it, positions it or includes it in a view before they sync, **Then** after syncing no view lists the deleted component, in both tabs, without either user doing anything.
4. **Given** two tabs, **When** each clears a different half of a paired setting on the same object (for example one clears a card's fill and the other its stroke), **Then** after syncing the object is valid and exports without an empty setting.
5. **Given** two tabs, **When** each makes one group the parent of the other before they sync, **Then** the cycle is reported in Problems and neither group nor its members disappear.
6. **Given** an automatic repair, **When** either user presses undo, **Then** the repair is not an undo step, and it produces no "unsaved changes" loop between the tabs (each repair settles after one round).

---

### User Story 5 - The format's next steps are written down in one place (Priority: P5)

The founder, or an agent starting 029, 033, 022, 030 or 032, opens one decision record and sees every field and object those five features add to the deck file, what each is called, where it lives, and that existing files stay valid. Two standing decisions are recorded with it: a deck's id is its identity everywhere, and collapsing a group is shared by everyone looking at the deck.

**Why this priority**: It is documentation, not behaviour, but it prevents five separate, uncoordinated patches to a public file format.

**Independent Test**: Read the ADR and check each of the five backlog entries against it.

**Acceptance Scenarios**:

1. **Given** the backlog entries for 029, 033, 022, 030 and 032, **When** each schema change they describe is looked up in the roadmap ADR, **Then** it is there with a name, a location in the file, whether it is optional, and what its absence means.
2. **Given** the roadmap ADR, **When** two features touch the same object (029 and 022 both add to a connection's style and route), **Then** the ADR shows how their fields fit together without renaming or moving anything shipped earlier.
3. **Given** the ADR, **When** someone asks "is collapse shared?" or "what identifies a deck on a server?", **Then** the answer is stated: collapsed groups are shared document data per view; the deck's library id is its global identity and is never reused.

---

### Edge Cases

- **A deck stored in the browser before this feature.** Not supported and not migrated (§g-81). Opening it must fail with the app's existing "can't open this deck" outcome rather than a blank screen, and must not alter or delete what is stored. The founder exports decks worth keeping to `.sododeck.json` before upgrading and imports them afterwards (the file format is unchanged).
- **A tab still running the previous build while a new tab edits the same deck.** Not handled (§g-81); the user reloads the old tab.
- **Two items given the same place in a list by two tabs.** They get a stable order that is the same in every tab (ties are never broken by arrival time).
- **An item moved by one tab and deleted by the other.** The delete wins; no partial item remains.
- **A flow whose branch structure is changed in two tabs at once** (one adds a branch, the other reorders the steps it splits). Steps are never lost or duplicated; the exported order stays "main path first, then each branch's steps"; anything the flow analysis finds inconsistent (a broken chain, a step naming a missing branch) is reported in Problems.
- **The same new id appearing in two lists.** Ids are random, so this is not expected; if it happens it is reported in Problems and nothing is renamed automatically unless every reference to it can be followed without ambiguity.
- **Long text set to empty by one tab while the other types in it.** The typed text survives; an empty optional text is absent from the exported file as today.
- **Long text replaced in one go** (paste over everything, import, "Esc reverts the field"). Only the characters that differ are changed, so text typed elsewhere at the same time is kept where it does not overlap.
- **A very large list** (10,000 components). Finding, editing or moving one item does not slow down with the size of the list.
- **Undo after a remote reorder.** A user's undo of their own earlier edit to an item still applies after someone else moved that item.
- **Repairs running in several tabs at once.** Every tab makes the same repair, the repairs agree, and nothing is repaired twice in a way that adds or removes content.

## Requirements _(mandatory)_

### Functional Requirements

**Unchanged behaviour and file format**

- **FR-001**: The `.sododeck.json` file format MUST NOT change. For any deck content, the exported text MUST be byte-identical to the export of the same content before this feature (same structure, same order of items, same key order, same absent optional fields).
- **FR-002**: Importing a file and exporting it without edits MUST return the same content, for every valid file (lossless round-trip), including the order of every list.
- **FR-003**: Every editing operation available before this feature MUST behave the same for a single user: the same edits are accepted and refused with the same errors, one user action is one undo step as before, deletes cascade as before (ADR 0005 §4, ADR 0010), and view-state changes that were never undo steps (collapse, first-use view presets, frame fitting on open) stay that way.
- **FR-004**: Every surface (canvas, outline, inspector, flows and step player, rule editor, JSON panel, search, problems, export, library cards and thumbnails) MUST show the same content in the same order as before for the same deck.
- **FR-005**: Autosave, reopening a deck, live sync between tabs of the same build, and per-tab undo MUST keep working as specified in ADR 0007 and §g-35.

**Lists by identity and order**

- **FR-006**: Each item of these lists MUST be stored under its own identity with an explicit order, not by its position among its neighbours: components, groups, connections, notes, views, features, flows, a flow's steps, a flow's branches, a rule's input columns, output columns and rows.
- **FR-007**: Moving an item within its list MUST change only that item's order; it MUST NOT remove and re-create the item. Changes made to the item elsewhere at the same time MUST survive the move.
- **FR-008**: When two clients move the same item before syncing, the item MUST exist exactly once afterwards, at the same position on every client.
- **FR-009**: When two clients insert items at the same position before syncing, all inserted items MUST be kept, in an order that is the same on every client and does not depend on the order in which changes arrive.
- **FR-010**: When one client deletes an item and another edits or moves it before syncing, the item MUST be deleted on every client, with no partial item left in the document.
- **FR-011**: The order of a flow's steps in every view and in the exported file MUST remain "main path first, then each branch's steps, in branch order", whatever combination of concurrent step and branch edits produced it.
- **FR-012**: Looking up, editing, moving or deleting one item MUST NOT take longer as its list grows (no scan of the whole list per operation).

**Long text**

- **FR-013**: These fields MUST merge concurrent edits character by character: the deck description; the description of a component, group, connection, feature, flow, step, branch and rule; a step's notes and payload; a note's text.
- **FR-014**: All other text (titles, names, labels, conditions, owners, tags, rule cells and the rest) MUST keep field-level "the later write wins", with other fields of the same object unaffected.
- **FR-015**: Writing a long text field MUST change only the characters that differ from the current text, so text typed concurrently elsewhere is preserved wherever the two edits do not overlap, including when the field is written whole (paste, revert on Esc, bulk edit, import of a fragment).
- **FR-016**: While a user types in a long text field, a concurrent change to that field from another tab MUST be merged into what the field shows without discarding the user's typed characters, and the cursor MUST stay with the text the user was typing.
- **FR-017**: One editing session in a text field MUST remain one undo step, and undo MUST remove only the local user's own typing.
- **FR-018**: Readers of the deck (every surface, the exported file, the JSON panel, search, problems) MUST keep receiving long text as ordinary text values. An empty optional long text MUST be absent from the exported file, as today.

**Check and repair on receive**

- **FR-019**: After every change that arrives from outside the local editor (another tab today, another client later), the deck MUST be checked, and any broken reference, parent cycle or flow inconsistency MUST appear in Problems (ADR 0013) with the next change notification, with no user action.
- **FR-020**: Objects that carry user-authored content (components, connections, steps, notes, groups, flows, rules and their text) MUST NOT be deleted or rewritten by an automatic repair. A reference left dangling by concurrent edits MUST be kept and reported, so that undoing the delete on the other side makes it whole again.
- **FR-021**: The automatic repairs MUST be limited to structural leftovers that carry no user content: entries in a view's own lists and maps (members, positions, pinned, collapsed, excluded groups, group frames) that name an object that no longer exists; settings left empty by concurrent clears (a style with neither fill nor stroke, a route with no values); and equal order values, which MUST resolve to one stable order.
- **FR-022**: Every automatic repair MUST give the same result on every client, MUST be safe to apply more than once, MUST NOT be an undo step, and MUST settle: after one repair round a document needs no further repair unless a new outside change arrives.
- **FR-023**: Local edits MUST still be validated before they are written, as today; a refused edit leaves the deck untouched.

**Decision records**

- **FR-024**: An ADR MUST list every addition to the file format planned by 029, 033, 022, 030 and 032: connector line type; connector waypoints and free anchor points; connector dash, width, colour and label position; deck-level tag definitions with colours; the card type registry and packs; typed field definitions and values. For each: its name, where it lives in the file, whether it is optional, and what its absence means. It MUST show that files valid today stay valid.
- **FR-025**: The same ADR MUST record that a deck's library id is its global identity (the name a future server knows it by) and is never reused, and that a view's collapsed groups are shared document data (founder decision, 2026-10-03).
- **FR-026**: The documented stored layout (ADR 0005, the model package's documentation) MUST be updated to describe the new stored form, including the list of long text fields and the repair rules.

**Not supported (by decision)**

- **FR-027**: A deck stored by a build before this feature is not migrated. Opening one MUST end in the app's existing "deck can't be opened" outcome without changing or deleting the stored data, and MUST NOT crash the app or the library.

### Key Entities

- **Deck document**: the live, stored form of one deck that every surface reads and writes and that tabs (later: clients) keep in sync. Distinct from the exported file, which is produced from it.
- **Ordered list item**: any object in one of the lists of FR-006. It has a stable id, its fields, and an order within its list that can change without touching the rest of the item.
- **Long text**: a text field that merges concurrent typing (FR-013). Seen as ordinary text by every reader.
- **Outside change**: a change to the deck document made by anyone other than the local editor: another tab today, a collaborator through a server later.
- **Repair**: an automatic, content-free, repeatable correction applied after an outside change (FR-021, FR-022).
- **Problem**: an entry in the existing Problems list (ADR 0013), derived from the deck, never stored.
- **Schema roadmap**: the decision record that names the next additions to the file format.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100 % of the reference decks (sample decks, every model test fixture, the 500-component and 2,000-component benchmark decks with flows, views and notes) export to byte-identical files before and after this feature.
- **SC-002**: The existing automated tests of the model, the app and the smoke suite pass with no test removed or weakened; tests that asserted the old stored form are replaced by tests of the new one.
- **SC-003**: In every scripted two-client scenario of User Stories 2–4 (each run with the changes delivered in both orders), both clients end with identical decks, and 0 items are lost, duplicated or left half-filled.
- **SC-004**: In the concurrent-typing scenarios, 100 % of the characters typed on both sides are present after syncing.
- **SC-005**: Editing or moving one item in a 10,000-component deck takes no more than twice as long as in a 500-component deck.
- **SC-006**: The canvas benchmark (500 components / 1,000 connections) shows no scenario worse than before beyond run-to-run noise, and opening that deck from storage is no more than 10 % slower.
- **SC-007**: A problem caused by an outside change is listed in Problems within the same time as a problem caused by a local edit (no extra delay, no user action).
- **SC-008**: Every schema change named in backlog 029, 033, 022, 030 and 032 can be found in the roadmap ADR.

## Assumptions

- **No users, no migration** (§g-81): the founder is the only person with stored decks. Decks worth keeping are exported before upgrading and imported afterwards. A one-off migration can be reconsidered with 025 before the first public release.
- **Same build in every tab**: mixed old and new tabs on one deck are not handled; a reload fixes it.
- **"Two tabs" stands for any two clients**: the behaviours are specified and tested on two copies of a deck exchanging changes, which is the same mechanism a later server relays (handbook §6).
- **Long text list** (FR-013) is "every field the file format describes as markdown, plus step payload". Titles and other short fields stay last-write-wins because merging a title letter by letter gives nonsense more often than it helps.
- **Conservative repair** (FR-020, FR-021): anything a person wrote is kept and reported rather than deleted. This differs on purpose from the local delete cascade (which removes a deleted component's connections), because the person who drew the concurrent connection has not agreed to lose it, and undoing the delete should make it whole.
- **Duplicate ids** cannot occur inside one list once items are stored by id, and ids are random, so the backlog's example "a duplicate id from a concurrent paste gets a fresh id" is covered by construction for the common case; the rare cross-list case is reported, not auto-renamed.
- **Collapsed groups stay shared** (founder, 2026-10-03), stored per view as today and never an undo step. Per-person collapse is a later decision if collaboration shows the need.
- **Presence is separate**: other people's cursors and selections are not document data and are designed with the server feature.
- **No new dependency** is expected; the ordering scheme and text merging use what the project already has. If one turns out to be needed it follows constitution VIII (reason in the plan, founder approval).
- **Constitution II** says a layout change needs a migration; the founder's decision (§g-81) waives the migration of stored decks for this pre-launch change. The file format itself has no breaking change, so no `version` bump.
