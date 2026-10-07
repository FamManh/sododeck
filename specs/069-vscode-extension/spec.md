# Feature Specification: Sododeck in VS Code

**Feature Branch**: `069-vscode-extension`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "069 (dựa trên spec plan của 068 được không) 068 đang implement ở sesion worktree khác chưa xong ?" — backlog entry `docs/backlog-3.md` § 069-vscode-extension: "Ship a VS Code extension that opens .sododeck files as the Sododeck canvas. Editing marks the file as changed and the editor's normal save, save as, revert and backup work. If the file changes on disk (for example after a version-control pull) the open canvas updates in place. Pictures are embedded in the file by default, or saved as files next to the deck by a setting. The canvas follows the editor's light or dark theme and nothing is sent over the network. Out of scope: a deck library inside the editor, several canvases on one file, telemetry."

## Context

Backlog 3 (editor hosts, 066–070) puts a deck inside the programs where the work already happens. A deck that describes a system belongs next to the code it describes: in the repository, reviewed in pull requests, changed by `git pull` and by AI agents, with no download and upload step.

The pieces below this feature are built:

- **066** merges a changed file into an open deck without losing selection, viewport or undo history.
- **067** (spec merged, implementation in progress in another session) defines one message protocol and an embeddable editor with no library, no browser storage and no network.
- **068** (merged) lets a picture point at an image file next to the deck instead of embedding its bytes.

This feature is the first real host: a VS Code extension that opens `.sododeck` files as the canvas and does the host's half of the 067 contract. The file is the store. VS Code owns the bytes on disk, the unsaved-changes dot, save, save as, revert, hot-exit backup and the theme; the embedded editor owns the canvas, the open document and undo.

## Clarifications

### Session 2026-10-07

- Q: Is 069 specified before 067 is implemented? → A: Yes. 067's spec and contract are merged and this feature only relies on that contract. 069 cannot be implemented or tested end to end until 067 is merged; 068 is already merged.
- Q: Does this feature change the editor or the file format? → A: No. Anything it needs from the editor that 067 does not provide is reported as a gap to 067, not built here.
- Q: In a workspace the user has not trusted, may the user edit a deck? → A: Yes. A deck is data, not code, so it opens, edits and saves as usual and embedded pictures work; only reading and writing picture files is blocked, with a plain notice.
- Q: After an outside change wins over unsaved edits, does the tab stay marked as changed? → A: No. The canvas now equals the file, so the mark clears; any later edit marks it as usual. The replaced unsaved edits are not undoable (066 / ADR 0047: an outside change is never an undo step and undo never restores what it overwrote); the user gets a one-line notice that they were replaced. (Plan 2026-10-07: the backlog's "one undo brings the moves back" contradicted 066 and 067 and is removed.)
- Q: Where does a new picture go with "save next to the deck" on, when the deck has no file on disk yet (untitled)? → A: It stays embedded; the extension does not move it to a file later.
- Q: On "Save As", do pointed-at picture files follow the deck to the new name? → A: Yes. They are copied to `<new name>.assets/` and the new deck's paths are updated; the original files and deck are untouched.
- Q: What if a pointed-at picture file's bytes no longer match the picture's id? → A: The extension always checks; on a mismatch the picture shows as missing with the reason "the file changed", never the wrong image.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a deck from the repository and edit it (Priority: P1)

A developer has `docs/arch.sododeck` in their repository. They click it in the file explorer and the deck opens as a canvas in a normal editor tab. They move a node; the tab shows the unsaved-changes mark. They press save and the file on disk is a valid deck file.

**Why this priority**: This is the whole reason for the extension. Without it nothing else matters.

**Independent Test**: Open a repository containing one deck, open the file, move a node, save, then check the file on disk against the format.

**Acceptance Scenarios**:

1. **Given** a repository with `docs/arch.sododeck`, **When** the user opens it, **Then** the canvas shows the deck in an editor tab, without any library, home screen or "open deck" control.
2. **Given** the deck is open, **When** the user edits it, **Then** the tab shows the unsaved-changes mark within half a second, and no file on disk has changed yet.
3. **Given** unsaved edits, **When** the user saves, **Then** the file on disk is a valid, readable, stably ordered deck file and the unsaved-changes mark clears.
4. **Given** the deck is open and unedited, **When** the user closes the tab, **Then** no prompt appears and the file on disk is untouched.
5. **Given** an older `.sododeck.json` file, **When** the user opens it, **Then** it opens as the canvas the same way.
6. **Given** a new empty file named `x.sododeck`, **When** the user opens it, **Then** it opens as an empty deck and is not marked changed.

---

### User Story 2 - The editor's normal file features just work (Priority: P1)

The user expects a deck to behave like any file: save as to a new name, revert to the saved version, close with unsaved changes and get the usual question, and get their unsaved work back after the editor closes unexpectedly or restarts.

**Why this priority**: A custom editor that loses work or ignores save is worse than the raw JSON.

**Independent Test**: Make unsaved edits, then (a) save as, (b) revert, (c) close and choose "don't save", (d) restart the editor and recover.

**Acceptance Scenarios**:

1. **Given** unsaved edits, **When** the user does "Save As" to a new name, **Then** the new file holds the edited deck and the old file is unchanged.
2. **Given** unsaved edits, **When** the user reverts, **Then** the canvas shows the saved file again and the unsaved-changes mark clears.
3. **Given** unsaved edits, **When** the user closes the tab, **Then** the editor's usual save / don't save / cancel question appears and each answer does what it says.
4. **Given** unsaved edits and the editor closes or restarts with hot exit on, **When** the editor reopens, **Then** the unsaved edits come back and the tab is still marked changed.
5. **Given** the user presses save, **When** the editor asks for the latest changes first, **Then** an edit made in the last fraction of a second is part of the saved file.
6. **Given** the user chooses "Open as text", **When** the raw file opens, **Then** it is the same file, and edits in one view show in the other after save.
7. **Given** a deck whose pictures point at files in `<deck name>.assets/`, **When** the user does "Save As", **Then** the picture files are copied to `<new name>.assets/`, the new deck points at the copies, and the old deck and its files are untouched.

---

### User Story 3 - The canvas follows the file on disk (Priority: P1)

After `git pull`, a branch switch, or an AI agent writing the file, the open canvas shows the new content in place, keeping selection and viewport. If the tab had unsaved edits, the file on disk wins, and a one-line notice says the unsaved edits were replaced.

**Why this priority**: Without this the extension is a trap: the open canvas and the file drift apart, and saving overwrites a teammate's or an agent's work.

**Independent Test**: Open a deck, change the file from outside (command line, another editor tab, `git checkout`), and watch the canvas; repeat with unsaved edits and check the notice and the tab's mark.

**Acceptance Scenarios**:

1. **Given** a clean open deck, **When** the file changes on disk, **Then** the canvas shows the new content without reloading, and selection and viewport are kept where the objects still exist.
2. **Given** unsaved moves on the canvas, **When** an agent writes the file on disk, **Then** the canvas shows the file's content, the tab is no longer marked as changed, a one-line notice says the unsaved edits were replaced, and undo does not bring them back (the outside change is not an undo step).
3. **Given** the user saves from the canvas, **When** the extension sees the file change that its own save caused, **Then** the canvas does not flicker, merge or add an undo step.
4. **Given** an outside change that is not a valid deck file, **When** it arrives, **Then** the canvas keeps the last good deck, shows the problems and is read-only until a valid file arrives; the extension never writes over the invalid file by itself.
5. **Given** the file is deleted or renamed on disk while open, **When** this happens, **Then** the tab shows the editor's usual "file missing" state and the user's unsaved deck stays available to save elsewhere.
6. **Given** an outside change to a deck that is open in a background tab, **When** the user switches to that tab, **Then** it shows the current content.

---

### User Story 4 - Pictures: embedded by default, or next to the deck (Priority: P2)

By default a picture added to the canvas is embedded in the deck file. A user who keeps decks in a repository can switch a setting so that new pictures are saved as image files in a folder next to the deck (`<deck name>.assets/`), and the deck points at them. Decks that already point at files show those pictures.

**Why this priority**: It keeps decks diffable and lets pictures be shared with a README. The extension still works without it, so it ranks below the file round trip.

**Independent Test**: Add a picture with each setting value and inspect the deck file and the folder; open a deck whose pictures point at files.

**Acceptance Scenarios**:

1. **Given** the default setting, **When** the user adds a picture, **Then** its bytes are embedded in the deck file and no extra file is created.
2. **Given** the setting "save next to the deck", **When** the user adds a picture, **Then** an image file appears in `<deck name>.assets/`, the deck entry holds only the relative path and the picture facts, and the picture shows on the canvas.
3. **Given** a deck whose pictures point at existing files, **When** it is opened, **Then** each picture shows from its file.
4. **Given** a pointed-at file that does not exist, **When** the deck is opened, **Then** that picture shows as missing with a reason that names the path, and the rest of the deck works.
5. **Given** a deck with a picture path that resolves outside the workspace folder (for example `../../../etc/x.png`, or a link that leads outside), **When** the deck is opened, **Then** the file is not read, the picture shows as missing with a reason that says the path is outside the workspace, and no file outside the workspace is touched.
6. **Given** the folder `<deck name>.assets/` already holds a different file with the name the extension wants, **When** a picture is saved, **Then** the extension keeps both files and never overwrites the existing one.
7. **Given** the setting is changed while a deck is open, **When** the user adds the next picture, **Then** the new setting applies; existing pictures stay as they are.
8. **Given** "save next to the deck" is on but the deck has no file on disk yet (untitled), **When** the user adds a picture, **Then** the picture is embedded and is not moved to a file later.
9. **Given** the extension cannot write the picture file (read-only folder, no space), **When** the user adds a picture, **Then** the picture stays embedded and the user sees the reason.

---

### User Story 5 - The canvas looks like it belongs in the editor (Priority: P2)

The canvas uses the editor's light or dark theme and follows it when the user switches theme, without reloading the deck or losing the user's place.

**Why this priority**: A bright canvas in a dark editor looks broken, but it does not block the work.

**Independent Test**: Open a deck in each theme, then switch theme while it is open.

**Acceptance Scenarios**:

1. **Given** the editor uses a dark theme, **When** a deck opens, **Then** the canvas is dark; the same for light.
2. **Given** a deck is open, **When** the user switches the editor theme, **Then** the canvas follows within one second, without reload and with selection and viewport kept.
3. **Given** a high-contrast theme, **When** a deck opens, **Then** the canvas uses the dark or light scheme the editor's theme is based on.

---

### User Story 6 - Create a deck, and take it to the web app (Priority: P2)

A user runs "New Sododeck deck" from the command palette or the explorer menu, names the file, and gets an empty deck open on the canvas. "Open in Sododeck web" gives them a way to continue in the web app, without the extension sending the deck anywhere.

**Why this priority**: Makes the first minute easy and gives a way out, but opening existing files already works without it.

**Independent Test**: Run each command in a fresh folder.

**Acceptance Scenarios**:

1. **Given** an open folder, **When** the user runs "New Sododeck deck" and gives a name, **Then** a valid empty `.sododeck` file is created there and opens on the canvas; an existing file with that name is never overwritten.
2. **Given** no folder is open, **When** the user runs "New Sododeck deck", **Then** the extension asks where to save the file first.
3. **Given** a deck is open, **When** the user runs "Open in Sododeck web", **Then** the deck file is offered as a download or revealed in the file manager together with the address of the web app, and nothing is uploaded or sent.

---

### User Story 7 - Install and trust (Priority: P2)

A user finds the extension on the marketplace, reads what it does, installs it, and can rely on it making no network requests and not reading outside their workspace.

**Why this priority**: Without a published, honest package nobody gets to use it; however, publishing is a release step and not part of the code.

**Independent Test**: Build the package, install it in a clean editor profile, open a deck while watching network traffic.

**Acceptance Scenarios**:

1. **Given** the built package, **When** it is installed in a clean editor, **Then** `.sododeck` files open as the canvas with no other setup.
2. **Given** the extension is running and a deck is edited, saved and changed from outside, **When** network activity is watched, **Then** there are zero requests.
3. **Given** a workspace the user has not trusted (restricted mode), **When** a deck is opened, **Then** it opens, edits and saves normally with embedded pictures, a notice says that picture files are not read or written until the workspace is trusted, and pointed-at pictures show as missing with that reason.

---

### Edge Cases

- A deck of 500 nodes and 1,000 edges opens and edits without a noticeable delay in typing or dragging; saving it does not freeze the editor.
- Rapid edits (dragging a node) produce one save-ready state, not hundreds of file writes; nothing is written to disk until the user saves.
- A deck file that is empty, whitespace only, or not a deck: empty opens as an empty deck; anything else shows its problems, offers "Open as text", and the extension never rewrites it.
- A very large picture (tens of megabytes) passes between the canvas and the extension without freezing the editor; the format's size limits still apply and a refusal gives a plain reason.
- The same file open in two editor windows: it is not supported; the second window shows a plain message and does not fight with the first (backlog: several canvases on one file is out of scope).
- Remote workspaces (SSH, containers, WSL): the canvas works through the editor's file API, and pointed-at pictures are read through the same API.
- The editor is closed while a save is in flight: the editor's own rules apply; the file is never left half written by the extension.
- Window reload or the extension updating while a deck is open: the tab comes back with the saved file, and unsaved edits come back through hot exit.
- Line endings and key order: saving a deck that was not changed produces a file with no diff; saving a changed deck changes only what changed.
- Workspace folder with symbolic links: a picture path is judged by where it really ends up, not by how it is written.

## Requirements _(mandatory)_

### Functional Requirements

**Opening and the file**

- **FR-001**: The extension MUST register itself as the default viewer and editor for files ending in `.sododeck` and `.sododeck.json`, and MUST offer "Open as text" for the raw file.
- **FR-002**: The canvas MUST show the deck from the file as 067's start message, with the host's abilities declared truthfully, and MUST show only the open deck's screen (067 FR-020).
- **FR-003**: An empty or whitespace-only file MUST open as an empty deck without marking the tab changed. An invalid file MUST show its problems, MUST NOT be rewritten, and MUST offer "Open as text".
- **FR-004**: When the editor's protocol version and the extension's differ, the user MUST see 067's plain "update" message naming which side needs an update, and the deck MUST NOT be shown or edited.

**Editing and saving**

- **FR-005**: After each change reported by the canvas, the tab MUST show the editor's unsaved-changes state within 500 ms, and nothing MUST be written to disk until the user saves.
- **FR-006**: Save, save as, revert, backup and hot exit MUST go through the editor's own document features, so the usual commands, prompts and recovery work for a deck as for any file.
- **FR-007**: Before saving or closing, the extension MUST ask the canvas for its latest changes (067 `flush`) and MUST wait for the answer, so no edit is lost.
- **FR-008**: The saved file MUST be a valid deck file in the same canonical, pretty-printed form as an export, with a stable key order, so that opening and saving an unchanged deck produces no diff.
- **FR-009**: Revert MUST restore the saved file on the canvas and clear the unsaved-changes state.
- **FR-010**: The extension MUST NOT write a deck file except in response to the editor's save, save as, or the "New Sododeck deck" command.

**Outside changes**

- **FR-011**: The extension MUST watch the open deck's file and report a changed file to the canvas (067 `external-change`) so it is merged in place with selection, viewport and undo history kept.
- **FR-012**: The extension MUST ignore file changes that its own save caused, and MUST NOT report a file equal to the last one the canvas sent.
- **FR-013**: A file change while the tab has unsaved edits MUST be applied like any outside change: the file wins, the merge is not an undo step (066), the tab's changed mark clears because the canvas equals the file, and a one-line notice says the unsaved edits were replaced. The user MUST NOT be asked a "file changed on disk" question for a deck.
- **FR-014**: A file that becomes invalid MUST leave the last good deck on the canvas, show the problems read-only (067 FR-014), and MUST NOT be overwritten by the extension until a valid file arrives or the user saves a deck explicitly.
- **FR-015**: When the file is deleted, moved or renamed, the tab MUST follow the editor's usual behaviour for such a file, and the user's unsaved deck MUST stay available to save elsewhere.

**Pictures**

- **FR-016**: The extension MUST declare the picture-storing ability to the canvas only when the setting "save next to the deck" is on, the deck has a file on disk, and the workspace is trusted and allowed to write; otherwise pictures MUST stay embedded (067 FR-016).
- **FR-017**: With "save next to the deck" on, the extension MUST write each new picture to `<deck name>.assets/` next to the deck file and answer the canvas with the path relative to the deck file (068). It MUST NOT overwrite an existing file; a name clash MUST get a different file name or reuse an identical file.
- **FR-017a**: On "Save As", the extension MUST copy every picture file the deck points at into `<new name>.assets/` next to the new file, MUST rewrite the new deck's paths to the copies (never overwriting existing files, as FR-017), and MUST leave the old deck and its files unchanged. A picture whose file is missing or outside the workspace keeps its path and shows as missing.
- **FR-018**: The extension MUST serve a pointed-at picture to the canvas by reading the file at the path, and MUST answer that the picture is missing, with a plain reason, when the file is not there or cannot be read.
- **FR-019**: The extension MUST refuse to read or write any picture path that resolves outside the workspace folder (068 FR-014), judged on the resolved location including links, and MUST say so in the reason it gives. It MUST apply the same rule to the folder `<deck name>.assets/`.
- **FR-020**: The extension MUST check every pointed-at file against the picture's id and size before serving it, and MUST NOT show a file whose bytes do not match, answering missing with a reason that says the file changed.
- **FR-021**: A failure to write a picture file MUST leave the picture embedded in the deck and tell the user why.

**Look and feel**

- **FR-022**: The canvas MUST use the editor's light or dark scheme at start and MUST follow changes while open, without reloading the deck. High-contrast themes MUST map to their base scheme.

**Commands**

- **FR-023**: The extension MUST provide "New Sododeck deck" (never overwrites an existing file; asks for a place if no folder is open) and "Open in Sododeck web" (hands the user the deck file and the web app's address; uploads nothing).

**Trust and limits**

- **FR-024**: The extension MUST NOT make any network request, MUST NOT load or start telemetry, and MUST load only its own bundled files into the canvas, under a strict content policy that allows no remote resource and allows the canvas's background workers.
- **FR-025**: The extension MUST accept messages only from its own canvas and MUST ignore unknown or malformed ones without changing the deck or any file (067 FR-004).
- **FR-026**: In an untrusted workspace the extension MUST keep decks fully editable and savable with embedded pictures, MUST NOT read or write picture files (the picture-storing ability is not declared), and MUST say in plain words that picture files are limited until the workspace is trusted.
- **FR-027**: Only one canvas per file is supported; opening the same file a second time MUST show a plain message and MUST NOT let the two canvases overwrite each other.

**Packaging**

- **FR-028**: The extension MUST be packaged as one installable file with a marketplace description, icon and a short "what it does and does not do" text that states the no-network and workspace-only promises.
- **FR-029**: Publishing to the VS Code Marketplace and Open VSX MUST be a documented release step with its own checklist; building the package MUST NOT publish it.
- **FR-030**: The extension's behaviour MUST be covered by automated tests that run the extension's host side against the fake-host contract of 067 (open, edit, save, flush, outside change, own-write echo, invalid file, version mismatch, picture store and refusal outside the workspace).

### Key Entities

- **Deck file**: the `.sododeck` file on disk; the single store. Owned by the editor program, read and written only through the editor's document features.
- **Canvas**: the embedded Sododeck editor (067) shown in the editor tab; owns the open document and undo.
- **Host side**: the extension's part that connects a file to a canvas through the 067 message protocol (start, change, flush, external-change, picture store, theme).
- **Picture file**: an image file next to the deck in `<deck name>.assets/`, or elsewhere in the workspace, that a deck entry points to by relative path (068).
- **Setting**: the user choice for where new pictures live: embedded (default) or next to the deck.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user opens a deck from the file explorer and sees the canvas in under 2 seconds for a 500-node deck.
- **SC-002**: Across 100 scripted edit, save, outside-change and revert sequences, no edit is lost and no sequence produces a file that fails the format check.
- **SC-003**: Opening and saving an unchanged deck produces zero bytes of diff for 100% of the sample decks and test corpus.
- **SC-004**: After a file change on disk, the open canvas shows the new content within 1 second, with selection and viewport kept in 100% of test cases where the selected objects still exist.
- **SC-005**: In the scenario "unsaved moves, then an agent rewrites the file", the canvas equals the file, the tab is not marked as changed and the replaced-edits notice is shown in 100% of test runs, and no "file changed on disk" prompt ever appears.
- **SC-006**: Zero network requests are made over a full session of open, edit, save, picture add, outside change and theme switch.
- **SC-007**: No test path, including links and `..` runs, lets the extension read or write a file outside the workspace.
- **SC-008**: Dragging a node in a 500-node deck stays smooth: the canvas keeps its usual frame rate in the editor tab, and a burst of edits produces at most one pending state per 200 ms.
- **SC-009**: A first-time user goes from installing the extension to a saved, valid new deck in under 2 minutes without reading documentation.
- **SC-010**: The built package installs in a clean editor profile and opens a deck with no other setup, on the editor's current stable release and its previous one.

## Assumptions

- **Depends on 067's contract, not its code.** This spec uses the message protocol in `specs/067-embed-host-protocol` (start, change, flush, external-change, picture store, theme, abilities, version check). Until 067 is implemented and merged, 069 can be planned and its host side built against the contract and the fake host, but cannot be tested end to end in a real editor tab. If planning finds a need the 067 contract does not cover, it is raised against 067, not worked around here.
- **068 is merged.** Pointed-at pictures, the relative path rules (leading `..` only) and the rule that hosts refuse paths outside their workspace are already specified and implemented in the format and tooling.
- **The editor program owns the file.** Save, dirty state, backup, hot exit and recovery are the editor's own mechanisms; the extension never keeps a second copy of the deck outside the canvas and the editor's document.
- **Workspace boundary.** "Workspace" means the folder or folders the user has open. A deck opened from outside any workspace gets only embedded pictures, and its own folder is treated as the boundary for pointed-at pictures.
- **Default for pictures is embedded**, as in the backlog, so a deck stays one self-contained file unless the user opts in. The setting is per user, with an optional per-workspace override.
- **Picture file naming** (`<deck name>.assets/`, file names derived from the picture's id) is settled at planning time; the rule is only that existing files are never overwritten.
- **File extension.** `.sododeck` is the main extension; `.sododeck.json` keeps opening, as in the web app.
- **Language.** English UI, global audience, like the rest of the product.
- **Out of scope**: a deck library or home view in the editor, several canvases on one file, telemetry, web-based VS Code (vscode.dev) unless it works with no changes, the notes-app host (070), the local AI agent bridge (065), uploading decks to any service, turning a pointed-at picture into an embedded one (and the reverse) for existing decks, the `.sododeck.md` wrapper.
- **Risks to settle at planning**: how the canvas's background workers run under a strict content policy inside the editor's frame; the cost of sending large decks and pictures between the extension and the canvas (measure at 500 nodes); keeping the saved file's key order stable for clean diffs.
