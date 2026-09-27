# Feature Specification: Local Deck Library and Autosave

**Feature Branch**: `005-local-library-autosave`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "005 (local-library-autosave) from docs/backlog.md — Let guests keep a library of decks in their browser without an account. Every change is saved automatically within half a second and the editor shows "Saving…" then "Saved in this browser". The library shows decks as cards or a list, with folders, recent decks, samples and search; users can create, open, rename, move and delete decks and manage folders. Users can import a deck file, export one deck, and export a backup of all decks. The app shows how much browser storage is used, asks the browser to keep the data persistently, and reminds users to back up because data lives only on this device. Opening the same deck in two tabs must never lose edits. Why: local-first with no lock-in is a core promise, and guest data loss is a top product risk."

**Sources**: `docs/backlog.md` §005 and founder decisions §g-7, §g-11, §g-12, §g-19, `docs/spec.md` §9.1 (G-1 to G-6) and the "guest data loss" risk, `docs/design/design-analysis.md` §a (states 01, 02, 07–10, 72–85), §d (library metadata is not document data), §e (library behavior), §g-20, §g-25, §g-29, `docs/design/screens/` 01, 02, 07, 08, 09, 10, 72–85 (light and dark), `specs/002-yjs-model/spec.md` (deck export/import and validation), `specs/003-canvas-basic/spec.md` (editor shell, top bar, confirm-delete dialog, Undo toast, undo history), `specs/004-json-panel-sync/spec.md` (panel reflects the stored deck), constitution v1.0.0 (principles I, II, IV, V, VI, VII, VIII).

**Dependency note**: 000 (design foundation) and 002 (model) are merged; 003 and 004 are merged too. Today the editor opens in-memory decks only (`/deck/new` is empty, anything else is the demo) and the library page is a placeholder. This feature replaces both with real, browser-stored decks.

## Scope

**In scope**

- Automatic, per-change saving of every deck in the browser, and reopening it later exactly as left (G-1).
- Autosave status in the editor top bar: "Saving…" (held at most 300 ms), "Saved in this browser", and the error state "Couldn't save — export a backup" with Export and a details popover offering Export .sododeck.json and Retry (⌘S) (§g-7, §g-25; design 83–85).
- The library page (design 01, 07–09, 72–81): grid and list views, All decks, Recent (8 most recently opened, §g-12), Samples, folders, search by deck name, new deck, open deck, deck card thumbnails drawn from component positions, deck counts and relative "edited" times.
- Deck actions from a card or row menu (⋯, right-click or Shift+F10; design 76–77): Open, Rename (F2), Duplicate (⌘D), Move to folder (submenu with the current folder checked), Export .sododeck.json, Delete. Renaming a deck also works from the editor breadcrumb.
- Folders (design 72–75): New folder dialog with inline errors for empty and duplicate names (case-insensitive, trimmed), folder menu with Rename (inline, F2) and Delete folder; decks of a deleted folder move to Unfiled.
- Deleting a deck or a folder asks for confirmation first, then shows the 6 s Undo toast; the delete can still be undone after the toast is gone (§g-11, §g-19).
- Import of one `.sododeck.json` file at a time with validation and an error toast for invalid files; export of one deck at a time (G-3).
- Storage card: usage bar, Persistent storage On/Off shown with icon and text, "Request persistent storage", the "Browser declined…" message, and a silent fallback where the browser cannot persist (G-4; design 80–81).
- Multi-tab safety (G-6): every tab showing the same deck stays editable and is kept in sync live, so tabs never overwrite each other; the library stays consistent across tabs.
- Deck inspector STORAGE section (design 10) showing where the deck is stored and an Export .sododeck.json action.

**Out of scope**

- Sample deck content and "Open sample" behavior beyond an empty Samples section (013).
- The full export dialog (PNG, SVG, PDF, Mermaid) (012) and "Export folder" (012, §g-29): the folder menu does not show it in this version.
- Backup reminders and the Safari 7-day warning (G-5; deferred, clarified 2026-09-27); design frames 01, 09 and 80 are followed without their banners.
- Exporting or importing several decks at once: no all-decks backup file, no folder export or import, no multi-file or zip import (clarified 2026-09-27).
- Saving to a local folder or git repository (G-7, P1), share links, cloud sync, accounts.
- Onboarding tour on a new deck (013).
- Any change to the `.sododeck.json` deck format itself.
- The read-only second tab, lock banner and "Use here instead" of design frame 82 (replaced by live sync, clarified 2026-09-27).
- New end-to-end browser tests (constitution VI; the existing smoke suite must keep passing).

## Clarifications

### Session 2026-09-27

- Q: What should the "Export backup" file be, and should the app import it back? → A: Neither in this version. Export and import handle one deck file (`.sododeck.json`) at a time; there is no all-decks backup file, no folder export and no multi-file or zip import. Folders remain for organizing the library only.
- Q: With no all-decks backup, what should the backup reminder banner do? → A: Drop the backup reminder banner for now (G-5 reminder deferred).
- Q: Should the Safari-only warning (Safari may clear site data after 7 days without a visit) stay in 005? → A: No, drop it for now (as Excalidraw does); G-5 is deferred entirely.
- Q: How should two tabs showing the same deck behave? → A: Both stay editable and are live-synced: an edit in one appears in the other within one second and concurrent edits merge without loss. There is no read-only tab, lock banner or "Use here instead" (design frame 82 is not followed); undo is per tab.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Never lose work: autosave and reopen (Priority: P1)

A guest creates a new deck from the library, adds a few components and connects them. After each change the top bar briefly shows "Saving…" and then "Saved in this browser". They close the tab without doing anything else. The next day they open the app, find the deck in the library and open it: everything is exactly as they left it.

**Why this priority**: Losing work is the top guest risk; without automatic saving nothing else in the library matters.

**Independent Test**: Create a deck, make one edit, wait half a second, close and reopen the browser tab, and check the deck is in the library and shows the edit.

**Acceptance Scenarios**:

1. **Given** the user edits a deck, **When** 500 ms pass and the tab is closed, **Then** reopening the deck shows the edit.
2. **Given** an edit, **When** it is saved, **Then** the top bar shows "Saving…" for no more than 300 ms and then "Saved in this browser" with a check icon.
3. **Given** the user presses ⌘S (Ctrl+S) while everything is saved, **When** the shortcut is handled, **Then** nothing changes except that the browser's own save dialog does not open.
4. **Given** a save fails (for example the browser's storage is full), **When** the user edits, **Then** the top bar shows "Couldn't save — export a backup" with a warning icon (not color only) and an Export button; its popover explains when the last change was not saved, names the error, and offers Export .sododeck.json and Retry (⌘S).
5. **Given** the error state, **When** a later save succeeds (after Retry or a new edit), **Then** the error clears and the status returns to "Saved in this browser"; it never clears before that.
6. **Given** an open deck, **When** the user undoes or redoes, **Then** the result is saved like any other edit.

---

### User Story 2 - Find and open decks in the library (Priority: P1)

A guest with several decks opens the app and lands on the library. The sidebar shows All decks, Recent, Samples and their folders, plus a storage card. The main area shows a dashed "New deck" card followed by one card per deck with a small thumbnail, the deck name, component and flow counts, and when it was last edited. They switch to the list view, pick a folder, type part of a name in search and open the deck they want.

**Why this priority**: Once work is saved, users must be able to get back to it quickly; the library is the app's home screen.

**Independent Test**: Seed three decks in two folders, then check every sidebar filter, search, grid/list switch, and opening a deck, without using folders management, import or multi-tab.

**Acceptance Scenarios**:

1. **Given** three decks in two folders, **When** the user selects a folder, **Then** only that folder's decks show and the header shows the folder name and deck count.
2. **Given** decks in the library, **When** the user types in search, **Then** only decks whose names contain the text (ignoring case) show; **When** none match, **Then** the message `No decks match "x".` appears.
3. **Given** nine decks opened at different times, **When** the user selects Recent, **Then** the 8 most recently opened show, newest first, with relative times.
4. **Given** no deck was ever opened, **When** the user selects Recent, **Then** a dashed empty placeholder explains that recently opened decks will appear here.
5. **Given** the grid view, **When** the user switches to the list view, **Then** the same decks show as rows (name, folder, counts, edited time), and the choice is remembered in this browser.
6. **Given** the library, **When** the user activates "New deck" (button or dashed card), **Then** a new empty deck named "Untitled deck" is created in the current folder (or Unfiled) and opens in the editor.
7. **Given** a deck card or row, **When** the user activates it, **Then** the deck opens in the editor and its opened time is updated for Recent.
8. **Given** the Samples section, **When** the user selects it, **Then** it shows an empty state (sample content arrives later) and no error.

---

### User Story 3 - Organize decks: rename, duplicate, move, delete, folders (Priority: P2)

A guest tidies up: they create a folder "Payments", move two decks into it from the deck menu, rename one deck with F2 and duplicate another. They try to create a second folder called " payments " and get an inline error. Later they delete an old deck; the app asks for confirmation, removes it, and shows an Undo toast. They delete a folder; its decks move to Unfiled.

**Why this priority**: Organization matters once users have more than a handful of decks; it builds on the library of story 2.

**Independent Test**: With a few decks and no folders, perform each deck and folder action from the menus and keyboard and check the library after each one, including undoing a delete.

**Acceptance Scenarios**:

1. **Given** the New folder dialog, **When** Create is pressed with an empty name or a name that matches an existing folder ignoring case and surrounding spaces, **Then** an inline error with an icon shows under the field, focus stays in the field, and no folder is created.
2. **Given** a deck card or row, **When** the user opens its menu by ⋯, right-click or Shift+F10, **Then** it offers Open, Rename (F2), Duplicate (⌘D), Move to folder (submenu with the current folder checked), Export .sododeck.json and Delete, all operable by keyboard.
3. **Given** a deck, **When** the user renames it from the library or from the editor breadcrumb, **Then** the new name shows in both places and in the deck's exported file.
4. **Given** a deck, **When** the user duplicates it, **Then** a new deck "<name> copy" with identical content appears in the same folder, and editing one never changes the other.
5. **Given** a deck, **When** the user moves it to another folder, **Then** it disappears from the old folder's view, appears in the new one, and the submenu now checks the new folder.
6. **Given** a deck, **When** the user chooses Delete, **Then** a confirmation dialog names the deck; **When** confirmed, **Then** the deck disappears and a 6 s toast offers Undo with a ⌘Z hint; **When** Undo is used (during or after the toast), **Then** the deck returns with its content, folder and name.
7. **Given** a folder with decks, **When** the user deletes it and confirms, **Then** the folder disappears, its decks move to Unfiled, and Undo restores the folder and puts the decks back.
8. **Given** a folder, **When** the user presses F2 or chooses Rename, **Then** the folder row becomes an inline field; Enter saves, Esc cancels, and empty or duplicate names show the same inline error as the dialog.

---

### User Story 4 - Import and export one deck (Priority: P2)

A guest receives a `.sododeck.json` file from a colleague and imports it; it appears in the library with its counts. They export one of their own decks to share it.

**Why this priority**: Files are the no-lock-in promise and the only protection against browser data loss; they build on the library.

**Independent Test**: Import a valid and an invalid file, export a deck and re-import it.

**Acceptance Scenarios**:

1. **Given** a valid `.sododeck.json` file, **When** the user imports it (button or dropping one file on the library), **Then** it appears in the library as a new deck in the current folder (or Unfiled) with its component and flow counts, and a toast confirms it.
2. **Given** an invalid file (not JSON, or not a valid deck), **When** imported, **Then** a toast says the file is not a valid .sododeck.json and nothing is added.
3. **Given** a deck, **When** the user exports it from the deck menu, the editor or the deck inspector, **Then** a `<deck name>.sododeck.json` file downloads whose content equals the model's export of that deck, and importing it back gives an identical deck.
4. **Given** the user picks or drops several files at once, **When** the import runs, **Then** nothing is added and a toast says only one file can be imported at a time.

---

### User Story 5 - Keep data safe in the browser: storage card (Priority: P2)

A guest looks at the storage card in the library sidebar: it shows how much of the browser's storage the app uses and "Persistent storage · Off". They click "Request persistent storage"; the browser agrees and the card switches to "On" with a shield icon and a toast. On a browser that declines, the card says "Browser declined. Try again after installing the app."

**Why this priority**: Persistent storage lowers the risk of silent eviction; it is cheap and supports stories 1 and 4.

**Independent Test**: Simulate a browser that grants, declines, or does not support persistent storage and check the card in each case.

**Acceptance Scenarios**:

1. **Given** the library, **When** it shows, **Then** the storage card shows used space and available space as a bar and as text.
2. **Given** persistent storage is off, **When** the user requests it and the browser grants it, **Then** the card shows "On" with a shield icon and text (not color only) and a toast confirms it.
3. **Given** the browser declines, **When** the request returns, **Then** the card stays "Off" and shows "Browser declined. Try again after installing the app."
4. **Given** persistent storage is not supported, **When** the app starts, **Then** it falls back silently: no error, the card shows "not persistent" and no request button.
5. **Given** usage is above 80% of the available space, **When** the library shows, **Then** the card shows a warning with an icon and text suggesting a backup.

---

### User Story 6 - Two tabs never overwrite each other (Priority: P3)

A guest has a deck open in one tab and opens the same deck in a second tab to look at two parts side by side. Both tabs stay fully editable. They rename a component in the first tab and, a moment later, see the new name in the second. At the same time they move another component in the second tab; the first tab shows the move. When they close both tabs and reopen the deck, both changes are there.

**Why this priority**: Multi-tab conflicts are rarer than the other risks but silently lose data when they happen.

**Independent Test**: Open the same deck in two tabs, edit different and identical items in both, and check each tab shows the other's edits and the stored deck contains all of them.

**Acceptance Scenarios**:

1. **Given** a deck open in tabs A and B, **When** tab A makes an edit, **Then** tab B shows it within one second, and the reverse holds too.
2. **Given** tabs A and B edit different items at the same time, **When** both edits are saved, **Then** both tabs and the reopened deck contain both edits.
3. **Given** tabs A and B change the same field of the same item at the same time, **When** the edits merge, **Then** both tabs end up showing the same single value and no other edit is lost.
4. **Given** tab A made an edit, **When** the user presses ⌘Z in tab B, **Then** tab B undoes only its own last edit, not tab A's.
5. **Given** the library open in two tabs, **When** a deck is created, renamed, moved or deleted in one, **Then** the other tab's library shows the change without reload.

---

### Edge Cases

- **Browser storage unavailable** (private mode, storage disabled): the app still opens; editing works for the session; the status shows the error state from the first failed save, and the library explains that decks cannot be kept in this browser.
- **Save fails mid-session** (quota exceeded): later edits keep being attempted; the error state stays until one succeeds; Export still exports the current, in-memory deck so nothing typed is lost.
- **Deck deleted in another tab while open here**: the open tab shows a message that the deck was deleted and offers to keep a copy (save as a new deck) or return to the library.
- **Opening a deck that no longer exists** (old link, deleted): a "Deck not found" page with a link to the library.
- **Import a file with the same name as an existing deck**: both are kept; the imported one gets the file's name, the existing one is untouched (deck files carry no library identity, so import never overwrites).
- **Import a large file** (for example 500 components): the library stays responsive; the deck appears once processed.
- **Import a file whose format version is newer than the app supports**: rejected with a clear message, nothing added.
- **Deck names**: empty names are refused on rename (the old name stays); very long names are shortened with an ellipsis in cards and rows, and shown in full on hover and to assistive technology.
- **Duplicate folder name check** ignores case and surrounding spaces; decks may share names.
- **Rename to the same name or cancel with Esc**: no change and no toast.
- **Delete the folder currently shown**: the view switches to All decks.
- **Undo after leaving the library** (for example deleting, opening a deck, coming back): Undo of a library delete is available only in the same library session; after a reload the delete is final.
- **Clock changes or decks opened in the future**: Recent sorts by opened time and never shows more than 8 decks.
- **Thumbnail of an empty deck**: shows the plain dotted background.
- **A deck open in many tabs** (for example five): all stay in sync; no edit is lost.
- **Browser without live cross-tab messaging**: each tab still saves its own edits without overwriting the other's; a tab shows the other tab's edits when it is next focused or reopened.

## Requirements _(mandatory)_

### Functional Requirements

**Autosave and status**

- **FR-001**: The system MUST save every change to a deck in this browser automatically, without a save action, so that the change survives closing the tab once 500 ms have passed.
- **FR-002**: The system MUST store the deck content so that reopening it gives exactly the same deck as the model's export before closing (same file content).
- **FR-003**: The editor top bar MUST show the save status: "Saving…" while a save is in progress, held for at most 300 ms, then "Saved in this browser" with a check icon; the loader MUST NOT spin when the user prefers reduced motion.
- **FR-004**: When a save fails, the status MUST switch to "Couldn't save — export a backup" with a warning icon and an Export button, and MUST stay in that state until a later save succeeds.
- **FR-005**: The error state MUST offer a popover with the time of the first unsaved change, a readable error name, "Export .sododeck.json" and "Retry (⌘S)".
- **FR-006**: ⌘S / Ctrl+S in the editor MUST retry saving (a no-op when everything is saved) and MUST NOT open the browser's page-save dialog.
- **FR-007**: Loading a deck MUST NOT count as an edit (no "Saving…", no undo step, no change to the edited time).

**Library**

- **FR-008**: The library MUST list every deck stored in this browser, each with a thumbnail drawn from component positions, its name, component and flow counts, and a relative last-edited time.
- **FR-009**: The library MUST offer a grid view and a list view, with the choice remembered in this browser.
- **FR-010**: The sidebar MUST offer All decks, Recent, Samples, and each folder, plus a way to create a folder; the main area header MUST show the current section name and its deck count with "stored in this browser".
- **FR-011**: Recent MUST show the 8 most recently opened decks, newest first; opened time MUST be library information, never part of the deck file; with no opened decks it MUST show a dashed empty placeholder.
- **FR-012**: Search MUST filter decks in the current section by name, ignoring case, as the user types, and MUST show `No decks match "<text>".` when nothing matches.
- **FR-013**: Users MUST be able to create a new, empty deck named "Untitled deck" in the current folder (or Unfiled) and land in the editor.
- **FR-014**: Opening a deck MUST record its opened time.
- **FR-015**: The Samples section MUST show an empty state until sample decks exist (013).

**Deck and folder actions**

- **FR-016**: Each deck card and row MUST have a menu reachable by ⋯ button, right-click and Shift+F10, with Open, Rename (F2), Duplicate (⌘D), Move to folder (submenu, current folder checked, including Unfiled), Export .sododeck.json and Delete.
- **FR-017**: Renaming a deck MUST be possible from the library (inline, F2) and from the editor breadcrumb; the name MUST be the deck's own name in its file; empty names MUST be refused.
- **FR-018**: Duplicating a deck MUST create an independent deck with identical content, named "<name> copy", in the same folder.
- **FR-019**: Users MUST be able to create folders through a small dialog that refuses empty names and names equal to an existing folder ignoring case and surrounding spaces, with an inline error (icon and text) under the field.
- **FR-020**: Users MUST be able to rename a folder inline (F2 or menu) with the same validation, and delete a folder; a deleted folder's decks MUST move to Unfiled.
- **FR-021**: Deleting a deck or a folder MUST ask for confirmation in a dialog that names the item and uses a destructive-styled button; after confirming, a toast MUST offer Undo for 6 s with a ⌘Z hint, and ⌘Z / Ctrl+Z in the library MUST still undo the last delete of the session after the toast is gone.
- **FR-022**: Undoing a deleted deck MUST restore its content, name and folder; undoing a deleted folder MUST restore the folder and move its decks back.

**Import and export**

- **FR-023**: Users MUST be able to import one `.sododeck.json` file at a time from the library (button and drop onto the library); a valid file MUST be added as a new deck, never overwriting an existing one. Selecting or dropping several files MUST add nothing and show a toast that only one file can be imported at a time.
- **FR-024**: An invalid file (unreadable, not JSON, failing validation, or an unsupported format version) MUST add nothing and show a toast explaining the file is not a valid .sododeck.json.
- **FR-025**: Users MUST be able to export one deck as `<deck name>.sododeck.json` from the deck menu, the editor and the deck inspector; the content MUST equal the model's export of the deck, and re-importing it MUST give an identical deck.
- **FR-026**: The app MUST NOT offer exporting or importing several decks at once (no all-decks backup, no folder export, no multi-file or zip import) in this version.
- **FR-027**: The system MUST record the time of the last export of each deck, as library information outside the deck file.
- **FR-028**: The library MUST NOT show a general backup reminder banner in this version (deferred).
- **FR-029**: The library MUST NOT show a Safari-specific 7-day eviction warning in this version (deferred with G-5).

**Storage**

- **FR-030**: The library sidebar MUST show a storage card with used and available browser storage (bar and text) where the browser reports it, and hide the numbers gracefully where it does not.
- **FR-031**: The storage card MUST show persistent storage as On (shield icon + text) or Off (text), offer "Request persistent storage" while Off, and show "Browser declined. Try again after installing the app." after a refusal.
- **FR-032**: Where the browser cannot keep storage persistent, the app MUST fall back silently and show "not persistent" without an error or a request button.
- **FR-033**: When usage exceeds 80% of available storage, the storage card MUST show a warning (icon + text) suggesting a backup.
- **FR-034**: The deck inspector (nothing selected) MUST show a STORAGE section stating the deck is stored in this browser, with an "Export .sododeck.json" action.

**Multiple tabs**

- **FR-035**: Every tab showing a deck MUST stay editable; there MUST be no read-only mode, lock banner or take-over action for multiple tabs.
- **FR-036**: An edit made in one tab MUST appear in every other tab showing the same deck within one second.
- **FR-037**: Edits made at the same time in different tabs MUST merge so that no edit is lost and all tabs converge to the same deck; saving from one tab MUST never overwrite edits saved by another.
- **FR-038**: Undo and redo MUST act only on the edits made in the current tab.
- **FR-039**: Library changes (create, rename, move, duplicate, delete, import, folders) made in one tab MUST appear in other open library tabs without reload.
- **FR-040**: A tab whose open deck is deleted elsewhere MUST tell the user and offer to keep a copy or go back to the library.

**Privacy, access and robustness**

- **FR-041**: No deck content, deck names or library information MUST leave the device; import and export MUST work offline.
- **FR-042**: Browser capabilities used here (persistent storage, storage estimates, cross-tab messaging, file download) MUST be detected, with a working fallback where missing.
- **FR-043**: Every library action MUST be operable by keyboard with a visible focus indicator; menus, dialogs, banners and toasts MUST have accessible names; status changes (saved, error, deleted with Undo) MUST be announced to assistive technology; no state MUST rely on color alone.
- **FR-044**: The library screens MUST match the design screens 01, 07–09, 72–79, 81 and 83–85 (light and dark), except where DESIGN.md or founder decisions differ (confirm before delete, ≤ 300 ms saving hold, DESIGN.md success token for "On", no backup or Safari banners); frame 82 (read-only tab) is not used and frame 80 is followed for the storage card only.
- **FR-045**: Large imports and thumbnail generation for large decks MUST NOT freeze the page.

### Key Entities

- **Deck**: one diagram; its content is the `.sododeck.json` document (name, description, components, connections, flows, …) kept in the browser and changed only through the model. Has a library identity that is not written into the file.
- **Library entry (deck metadata)**: library information about a deck, never in the file: library id, folder, created, updated (last edit), opened (last open) and last exported times, cached counts (components, flows) and a thumbnail summary for fast listing.
- **Folder**: a named group of decks in the library; unique name ignoring case and surrounding spaces; deleting it moves its decks to Unfiled. "Unfiled" is the absence of a folder, not a folder.
- **Library settings**: view mode (grid/list), last known persistent-storage state.
- **Save status**: per open deck: saving, saved, or error (with first unsaved time and error name); UI only.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of edits made at least 500 ms before closing the tab are present when the deck is reopened (tested across add, move, rename, connect, delete, undo, redo).
- **SC-002**: "Saving…" is never shown for more than 300 ms after a successful save, measured on a 500-component deck.
- **SC-003**: A user can find and open a known deck among 50 decks in under 10 seconds using folders, Recent or search.
- **SC-004**: The library with 100 decks is shown and usable within 1 second of opening the app on a typical laptop, and search results update as each character is typed.
- **SC-005**: Exporting any deck and importing the file again produces an identical deck in 100% of round-trip tests, including the largest benchmark deck (500 components / 1,000 connections).
- **SC-006**: 0 edits lost in two-tab tests: every edit made in either tab, including simultaneous ones, is in the stored deck afterwards, and edits show in the other tab within one second.
- **SC-007**: 100% of invalid import files in the test set are refused with a message and add nothing.
- **SC-008**: Every library, folder, deck-menu, import/export, and storage action can be completed with the keyboard alone, and every state (saved, error, persistent on/off, storage warning) is identifiable without color.
- **SC-009**: No network request carries deck content, names or library information (the existing no-third-party-requests smoke check keeps passing).

## Assumptions

- A deck's name in the library is the deck file's `name`; renaming changes the file. Folder, times, counts and thumbnails are library information, never in the file (design-analysis §d).
- Undo of a library delete lasts for the current library session only; after reload, deletes are final. Deck undo history in the editor is per session and is not stored.
- New and imported decks go into the folder currently shown, or Unfiled when All decks, Recent or Samples is shown.
- The default view is the grid; Recent and Samples do not offer "New deck" into themselves (new decks from there go to Unfiled).
- "Open sample" in the library header is hidden until samples exist (013).
- Storage usage and quota come from the browser's estimate and may be approximate; the card shows them as such.
- Multi-tab sync applies per deck; different decks can be edited in different tabs at the same time. Selection, zoom and panel layout stay per tab (UI state is not synced).
- The demo deck currently shown by the editor is replaced by real stored decks; the design gallery and bench routes are unaffected.
- No new runtime dependency is expected beyond what the app already uses for local storage; any addition is justified in `plan.md` and approved by the founder (constitution VIII).
