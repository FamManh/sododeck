# Feature Specification: Format Compatibility (Format Revision and Read-Only Guard)

**Feature Branch**: `025-format-compatibility`

**Created**: 2026-10-03

**Status**: Deferred (founder, 2026-10-03, §g-81): no users yet; picked up before the first public release, when ADR 0020 is re-confirmed.

**Input**: User description: "025 from docs/backlog.md. A deck written by a newer Sododeck never breaks an older one: an older tab, a rolled-back deploy or an older import opens it read-only with a clear "Reload to edit" banner, instead of rejecting edits with no explanation."

**Sources**: `docs/backlog.md` §025 (goal, scope, draft acceptance criteria, risks) and the 2026-10-03 order (§g-64, §g-65: 025 lands before 036 and the schema changes of 029–032), ADR 0020 "File format compatibility" (status **Proposed**), ADR 0002 §6 (versioning), ADR 0007 (library record as a cache, live multi-tab sync), `docs/design/design-analysis.md` frame 82 (amber read-only banner, not used so far) and §g-35 (no read-only tab between two tabs of the same build), constitution v1.0.0 (principles I, II, IV, VI, VIII).

**Dependency note**: 005 (local library, autosave, deck channel between tabs) is merged on `main`. 017 and 020 already added optional fields to the file format, so builds from before 017 / 020 already cannot edit decks touched by newer builds; this feature makes that case explicit and safe.

## Scope

**In scope**

- A **format revision**: a whole number that identifies which additive version of the file format a build writes. It goes up with every change to the file format and is checked automatically, so a format change without a revision bump fails the build checks.
- An optional root **`revision`** in `.sododeck.json` (absent = 0). Export writes it; it is writer metadata and never appears in the deck's JSON panel.
- The library **remembers the highest revision** that wrote each stored deck, without creating an edit to the deck.
- **Tabs announce their revision** to other tabs open on the same deck.
- A **read-only mode** for the editor, entered when a deck's revision is higher than the build's: the deck can be viewed, selected, searched, played and exported, but not changed or saved; a banner explains why and offers Reload.
- **Import of a newer-revision file** (same major version): accepted, stored unchanged, opened read-only.
- A guarantee, backed by a test, that **edits keep fields this build does not know** on the object being edited.

**Out of scope**

- A tolerant format (accepting unknown fields everywhere); the format stays strict so typos in hand- and AI-written files are still caught (ADR 0020 §5).
- Per-field feature flags, partial editing of a newer deck, or "edit anyway".
- Migrations and major-version changes (ADR 0002 §6; storage layout migration is 036).
- Changing how files with a **different major version** are handled on import.
- Any network check for a newer build (no backend; Reload simply loads whatever build is served).

## Clarifications

_None yet._

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A stale tab meets a newer tab (Priority: P1)

A user left a Sododeck tab open yesterday. Today a new release with a format change is deployed. They open the same deck in a new tab, which runs the new build and adds a connector style the old build does not know. The old tab immediately shows an amber banner: "This deck was saved by a newer version of Sododeck. Reload to edit it." with a Reload button. The old tab still shows the deck live (including the new change), and they can still select, pan, play flows and export, but every edit control is disabled and nothing is saved from it. They press Reload; the tab loads the new build and the deck is editable again.

**Why this priority**: this is the most likely failure in daily use (every deploy with a format change creates stale tabs), and today it produces silently rejected edits.

**Independent Test**: open the same deck in two tabs where one reports a higher revision; check the older tab goes read-only with the banner, keeps receiving changes, rejects no edits silently (edit controls are disabled), and Reload loads the current build.

**Acceptance Scenarios**:

1. **Given** two tabs on the same deck and one runs a build with a higher revision, **When** the older tab receives that tab's announcement, **Then** it switches to read-only and shows the banner within one second, without losing what is on screen.
2. **Given** the older tab is read-only, **When** the newer tab makes changes, **Then** the older tab keeps showing them live.
3. **Given** the older tab is read-only, **When** the user tries any edit (drag, connect, rename on the card, drawer field, paste, delete, undo/redo, keyboard shortcut, auto-layout, colour, new flow), **Then** nothing changes and no error is shown other than the banner already on screen.
4. **Given** the banner, **When** the user presses Reload, **Then** the page reloads and, if the served build is at least as new as the deck, the deck opens editable.
5. **Given** two tabs on the same deck running the same build, **When** they exchange announcements, **Then** neither becomes read-only (§g-35 still holds).
6. **Given** the newer tab, **When** it receives the older tab's announcement, **Then** it stays editable and shows nothing.

---

### User Story 2 - Opening a newer deck from the library (Priority: P1)

After a rollback, the deployed build is older than the one that last saved some decks in the browser. A user opens one of those decks from the library. Instead of a broken editor, the deck opens read-only with the same banner. Decks that were last saved by this build or an older one open normally.

**Why this priority**: a rollback affects every user with recently edited decks at once; without this, all of them hit rejected edits.

**Independent Test**: store a deck whose library record says it was written by a higher revision, open it, and check it is read-only with the banner; open a deck with an equal or lower revision and check it is editable.

**Acceptance Scenarios**:

1. **Given** a stored deck last written by a higher revision, **When** it is opened, **Then** it opens read-only with the banner and nothing about it is saved back.
2. **Given** a stored deck last written by the same or a lower revision, or by a build from before this feature (no revision recorded), **When** it is opened, **Then** it opens editable as today.
3. **Given** a deck is opened and only viewed in an up-to-date build, **When** the tab is closed, **Then** the deck has no new edit and its "last edited" time in the library is unchanged.
4. **Given** a deck is edited in an up-to-date build, **When** the change is saved, **Then** the library records the build's revision for that deck (never lowering a higher one already recorded).

---

### User Story 3 - Importing a file from a newer build (Priority: P2)

A colleague on a newer build shares a `.sododeck.json`. The user's build is older. Today the import fails with "The file is not a valid deck". With this feature, the import succeeds: the deck is added to the library unchanged and opens read-only with the banner. Exporting it gives back the same content.

**Why this priority**: sharing files is the only way to pass decks between people in the MVP; a confusing rejection is worse than a clear read-only view, but it is less frequent than stale tabs and rollbacks.

**Independent Test**: import a file whose `revision` is higher than the build's and which contains a field this build does not know; check it is stored, opens read-only, and exports to an equivalent file.

**Acceptance Scenarios**:

1. **Given** a file with the same major version and a `revision` higher than the build's, **When** it is imported, **Then** it is stored, opens read-only with the banner, and exporting it gives the same deck content with the same `revision`.
2. **Given** such a file contains fields this build does not know, **When** it is imported and exported, **Then** those fields are kept exactly.
3. **Given** a file with the build's revision or lower (or no `revision`) that contains an unknown or misspelled field, **When** it is imported, **Then** it is rejected as today (the format stays strict).
4. **Given** a file with a different major version, **When** it is imported, **Then** the behaviour is unchanged from today.

---

### User Story 4 - Revision written on export, invisible while editing (Priority: P2)

A user opens an older deck that has no `revision`, edits it and exports it. While editing, the JSON panel never shows `revision`. The exported file carries the build's revision, so any older build that later opens it knows it is newer.

**Why this priority**: this is what makes the other stories work for files that leave the browser; it must not add noise to what users see.

**Independent Test**: open a deck without `revision`, check the JSON panel (Deck tab), edit, export, and inspect the file.

**Acceptance Scenarios**:

1. **Given** a deck without `revision`, **When** it is opened, edited and exported, **Then** the JSON panel never shows `revision` and the exported file carries the build's revision.
2. **Given** a read-only deck with a higher revision, **When** it is exported, **Then** the file keeps that higher revision (the exported revision is the higher of the deck's and the build's).
3. **Given** any deck, **When** it is exported and re-imported in the same build, **Then** the round-trip is lossless apart from `revision`.

---

### User Story 5 - Format changes cannot ship without a revision bump (Priority: P3)

A contributor (human or agent) adds an optional field to the file format and forgets to raise the revision. The build checks fail with a message that says the format changed and the revision must be raised.

**Why this priority**: it protects every later feature (022, 029–032) from silently shipping an unannounced format change; it has no user-visible behaviour of its own.

**Independent Test**: change the file format definition without raising the revision and run the test suite.

**Acceptance Scenarios**:

1. **Given** a change to the file format definition without a revision bump, **When** the checks run, **Then** a test fails and names the fix (raise the revision and record the new fingerprint).
2. **Given** a change to the file format with a revision bump and an updated fingerprint, **When** the checks run, **Then** they pass.

---

### Edge Cases

- **Reload still serves an older build** (e.g. the rollback is still live): the deck opens read-only again with the same banner; the user can keep viewing and exporting.
- **The newer tab closes first**: the older tab stays read-only until reloaded; the deck may already hold changes it cannot edit safely.
- **Read-only entered mid-gesture** (dragging a card, typing in a field, quick edit open): the gesture is cancelled and its uncommitted change is discarded; nothing half-done is saved.
- **Undo history in the older tab**: undo and redo are disabled while read-only; the history is not replayed onto the newer deck.
- **Pending autosave when read-only starts**: changes made before the announcement arrived are still saved (they were valid for this build); nothing after it is saved.
- **Library actions on a newer deck**: delete is allowed; rename is blocked with the same explanation (it changes the deck); duplicate is allowed and the copy keeps the higher revision, so it also opens read-only.
- **A file with a higher `revision` but otherwise fully known content**: still opens read-only; the build cannot know the newer build gave no new meaning to existing fields.
- **A negative, non-integer or non-numeric `revision`**: the file is rejected as invalid, like any other malformed field.
- **A peer that does not announce a revision** (build from before this feature): treated as revision 0, never triggers read-only.
- **Empty deck opened read-only**: the empty-canvas prompts that start editing are hidden or disabled.
- **Flow playback while read-only**: works fully (playing is not editing).

## Requirements _(mandatory)_

### Functional Requirements

**Format revision**

- **FR-001**: Each build MUST have a single format revision (a whole number ≥ 1 for builds with this feature) that identifies the file format it writes.
- **FR-002**: The project's checks MUST fail when the file format definition changes without the format revision being raised and the recorded fingerprint of the definition being updated in the same change.
- **FR-003**: The file format MUST accept an optional root `revision` (whole number ≥ 0); a file without it MUST be treated as revision 0.
- **FR-004**: `revision` MUST NOT bump the major `version`, and every other part of the format MUST stay strict (unknown fields are still rejected for files at or below the build's revision).

**Writing and storing the revision**

- **FR-005**: Export MUST write `revision` as the higher of the deck's revision and the build's revision.
- **FR-006**: `revision` MUST NOT be part of the editable deck content: the JSON panel MUST NOT show it, and opening or viewing a deck MUST NOT create an edit.
- **FR-007**: The library MUST record, per stored deck, the highest revision that has written it; saving a change MUST raise it to the build's revision and MUST NOT lower it.
- **FR-008**: A deck stored before this feature (no recorded revision) MUST be treated as revision 0.

**Detecting a newer deck**

- **FR-009**: When a deck is opened from the library, its recorded revision MUST be compared with the build's; a higher one MUST open it read-only.
- **FR-010**: Each tab MUST announce its build's revision to other tabs on the same deck when it joins and when it answers another tab's announcement.
- **FR-011**: A tab that receives an announcement with a higher revision than its own MUST switch to read-only without reloading and without losing what is on screen.
- **FR-012**: Two tabs with the same revision MUST NOT put each other into read-only (§g-35 stays for same-build tabs).
- **FR-013**: Import of a file with the same major version and a `revision` higher than the build's MUST store it unchanged (including fields the build does not know) and open it read-only.
- **FR-014**: Once a tab is read-only for a deck it MUST stay read-only for that deck until the page is reloaded.

**Read-only mode**

- **FR-015**: Read-only mode MUST block every change to the deck from every entry point: canvas gestures, on-card quick edit, selection toolbar, context menu, detail drawer, keyboard shortcuts, paste, delete, undo/redo, auto-layout, colour and style pickers, flow creation and editing, rules, stickies, views, and deck rename.
- **FR-016**: Read-only mode MUST be decided in one place for the open deck, so every current and future editing surface respects it without its own check.
- **FR-017**: In read-only mode the user MUST still be able to pan, zoom, select, search, open the inspector/drawer to read, use the JSON panel, play flows, and export.
- **FR-018**: In read-only mode nothing MUST be saved from that tab; changes from a newer tab MUST keep showing live.
- **FR-019**: Edit controls MUST look and be announced as unavailable (disabled, with an explanation reachable by pointer and keyboard), not appear active and do nothing.
- **FR-020**: A read-only banner MUST show while the deck is read-only, with the text "This deck was saved by a newer version of Sododeck. Reload to edit it." and a "Reload" button that reloads the page. The banner MUST be announced to screen readers when it appears and MUST NOT be dismissible.
- **FR-021**: The autosave status MUST read "Read-only" while the deck is read-only.

**Keeping unknown data**

- **FR-022**: Editing any object MUST keep every field on it that the build does not know; no edit may rebuild an object from known fields only. This MUST be covered by automated tests for each kind of edit.

### Key Entities

- **Format revision**: a whole number per build; raised with every additive file format change. Paired with a recorded fingerprint of the format definition so changes cannot slip through.
- **Deck file `revision`**: optional root field of `.sododeck.json`; the revision of the newest build that wrote the file. Writer metadata, not deck content.
- **Library deck record**: gains the highest revision that has written the stored deck; a cache field like the name and counts, not part of the deck.
- **Tab announcement**: the message a tab sends when it joins a deck; now carries the sender's revision.
- **Read-only state**: per open deck in a tab; set by a newer recorded revision, a newer file, or a newer peer; cleared only by reloading.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of the tested cases (stale tab, newer stored deck, newer imported file), an older build shows the read-only banner and no edit is ever rejected silently.
- **SC-002**: An older tab becomes read-only within 1 second of a newer tab joining the same deck.
- **SC-003**: Zero data loss: fields written by a newer build survive viewing, export and re-import in an older build, and survive every kind of edit in a current build (verified by automated round-trip and edit tests).
- **SC-004**: Every editing entry point listed in FR-015 is covered by an automated check that it changes nothing in read-only mode.
- **SC-005**: A file format change without a revision bump fails the checks 100% of the time.
- **SC-006**: Decks without `revision` look and behave exactly as before: the JSON panel shows no new field, and opening a deck never changes its "last edited" time.
- **SC-007**: Users understand what to do from the banner alone: the banner text names the cause (a newer version) and the action (Reload) in one sentence, and Reload is the only button.

## Assumptions

- **ADR 0020 is accepted as written** (status is still Proposed; the backlog flags it as a founder decision before this feature is built). If the founder changes it, this spec changes with it.
- **Banner look**: the 44 px amber banner of frame 82, with the ADR 0020 text and a single "Reload" button instead of "Use here instead"; the autosave status pill reads "Read-only" and locked fields show the lock of frame 82. No new design frame is needed.
- Builds with this feature start at revision 1. Decks and files from earlier builds (including those with 017 / 020 fields) count as revision 0 and open editable in every build with this feature.
- Builds released before this feature reject a file that carries a root `revision`; that window is one release and the app is always served at its latest version (ADR 0020 consequences).
- Import already distinguishes major versions; that path is unchanged.
- No network is involved: revisions are exchanged only between tabs of the same browser and stored only locally (constitution principle IV).
- The model already patches objects in place on edit; the new tests make that a guarantee rather than adding new behaviour.
