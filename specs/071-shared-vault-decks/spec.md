# Feature Specification: Shared Vault Decks

**Feature Branch**: `071-shared-vault-decks`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "071 from docs/backlog-3.md" — backlog entry `docs/backlog-3.md` § 071-shared-vault-decks: "One folder of decks that opens as a canvas in both Obsidian and VS Code, with the Obsidian-only gains (search by card text, backlinks, pictures that follow moves) kept."

## Context

Two hosts already open decks as a canvas:

- **069 (VS Code extension)** opens the plain `.sododeck` file.
- **070 (Obsidian plugin)** opens the plain `.sododeck` file and the Markdown form, `.sododeck.md` (readable text the notes app can search and link, plus the full deck).

A team or a person who keeps one folder as both an Obsidian vault and a VS Code workspace gets half of this today: a plain `.sododeck` already works in both, but a `.sododeck.md` note shows as text in VS Code. And nobody is told that the plain file is the shared one, so people do not know which form to pick, and older `.sododeck.json` files are not opened by Obsidian at all.

This feature closes both gaps in two parts:

1. **Cross-tool plain file** — say clearly where users look that `.sododeck` is the form that opens everywhere, and give a one-step way to bring a `.sododeck.json` in. No change to either file format.
2. **`.sododeck.md` in VS Code** — the extension also opens Sododeck notes as the canvas, saves them without damaging what the user wrote around the generated part, and keeps picture links working for Obsidian when it can.

## Clarifications

### Session 2026-10-08

- Q: How is a picture added in VS Code stored for a `.sododeck.md`? → A: Same rule as VS Code's plain decks (069): with "save next to the deck" on, the picture goes to a sibling folder and the deck points at it by a plain relative path, which Obsidian resolves and tracks; otherwise it stays embedded in the file. The note's picture link list (the part Obsidian keeps up to date when files move) is written only for plain relative paths; an embedded picture needs no link. *(Confirmed by the founder, 2026-10-08.)*
- Q: Does the VS Code "new deck" command create `.sododeck` or `.sododeck.md`? → A: `.sododeck` stays the default (it opens in every host and tool). A second command, "New Sododeck note", creates a `.sododeck.md`. The default command is renamed from "New Sododeck deck" to "New Sododeck" in both hosts (the last word is dropped). *(Confirmed by the founder, 2026-10-08.)*
- Q: Does VS Code take over every Markdown file? → A: No. Only a `.sododeck.md` file whose front matter carries the Sododeck marker opens as a canvas. Any other Markdown file stays in the text editor, and "Open as text" works on a deck note as on any other deck.
- Q: Does the skill (027) or Obsidian-style link rewriting come with this? → A: No, both are out of scope (backlog).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One folder, two tools, same deck (Priority: P1)

A user opens one folder as an Obsidian vault and as a VS Code workspace. A plain `.sododeck` file in it opens as the canvas in both. They edit in one tool; the other shows the change.

**Why this priority**: This is the headline promise, and it already works in the code; what is missing is that users know it and can rely on it.

**Independent Test**: Open one folder in both programs, open the same `.sododeck`, edit in one, and watch the other.

**Acceptance Scenarios**:

1. **Given** one folder open as a vault and as a workspace, **When** the user opens a `.sododeck` file in each, **Then** both show the same canvas.
2. **Given** the deck open in both, **When** the user edits it in Obsidian, **Then** VS Code shows the change within one second of the file being written; and the reverse, where VS Code's change shows once saved the normal way.
3. **Given** the documentation of both hosts, the web app's export help, and `docs/`, **When** a user looks for how to share decks across tools, **Then** each says that `.sododeck` is the form that opens in both, what `.sododeck.md` adds in Obsidian, and how to bring a `.sododeck.json` in.

---

### User Story 2 - Bring an older `.sododeck.json` in (Priority: P1)

A user has decks saved as `.sododeck.json` from before. Neither host opens that name as a canvas. They bring one in with a single step and keep their work.

**Why this priority**: Without it, older decks are stranded outside the shared folder.

**Independent Test**: Run the step on a `.sododeck.json`; the new `.sododeck` opens as the canvas and the original is untouched.

**Acceptance Scenarios**:

1. **Given** a `.sododeck.json` in the workspace, **When** the user runs "Copy as .sododeck" on it in VS Code, **Then** a `.sododeck` with the same content appears next to it and opens as the canvas; the original is unchanged.
2. **Given** the same file in a vault, **When** the user runs the matching command in Obsidian, **Then** the same result.
3. **Given** a `.sododeck` with that name already exists, **When** the command runs, **Then** nothing is overwritten and the user gets a different name or is told why, in plain words.
4. **Given** a `.sododeck.json` whose content is not a valid deck, **When** the command runs, **Then** no file is created and the user is told it is not a deck.
5. **Given** a user who prefers it, **When** they rename the file by hand to `.sododeck`, **Then** it opens (no code needed); the docs say this too.

---

### User Story 3 - Open a Sododeck note in VS Code as a canvas (Priority: P1)

A user has `Projects/billing.sododeck.md`, written in Obsidian. In VS Code they open it and see the canvas, not text.

**Why this priority**: The core of part 2.

**Independent Test**: Open a deck note and an ordinary Markdown file in VS Code.

**Acceptance Scenarios**:

1. **Given** a `.sododeck.md` whose front matter carries the marker, **When** it is opened in VS Code, **Then** it shows the canvas.
2. **Given** a Markdown file without the marker, **When** it is opened, **Then** it stays a text file.
3. **Given** a deck note open as a canvas, **When** the user chooses "Open as text", **Then** the note opens in the text editor and stays usable as text.
4. **Given** a note whose deck data cannot be read, **When** it is opened, **Then** the user sees a plain message saying why, with the option to open as text, and the file is not changed.

---

### User Story 4 - Saving a note keeps what the user wrote (Priority: P1)

The user types a paragraph after the generated part of a deck note, then edits on the canvas and saves. The paragraph is still there, and Obsidian still opens the note as a deck.

**Why this priority**: A host that damages hand-written text is worse than no host.

**Independent Test**: Add text outside the generated part, edit on the canvas, save, compare.

**Acceptance Scenarios**:

1. **Given** a note with a paragraph after the generated part, **When** the user edits the deck and saves, **Then** the paragraph is unchanged and the generated part is regenerated.
2. **Given** that saved note, **When** it is opened in Obsidian, **Then** it opens as a deck.
3. **Given** a card title edited as text in the note, **When** the note is open in VS Code, **Then** the canvas shows the new title in place, without losing selection, viewport or undo history.
4. **Given** the canvas has no unsaved changes, **When** the user closes the note, **Then** the file on disk is untouched.

---

### User Story 5 - Pictures in a shared note keep working in Obsidian (Priority: P2)

The user adds a picture to a deck note in VS Code and later opens the note in Obsidian. The picture shows, and Obsidian keeps it linked if files move.

**Why this priority**: Keeps the Obsidian-only gain (pictures that follow moves) when the note is touched from VS Code.

**Independent Test**: Add a picture in VS Code with "save next to the deck" on, open in Obsidian, move the picture file there, reopen.

**Acceptance Scenarios**:

1. **Given** "save next to the deck" is on, **When** the user adds a picture to a deck note in VS Code, **Then** the file goes to the deck's sibling folder, the deck points at it by a plain relative path, and the note's link list gains a link Obsidian resolves.
2. **Given** that note opened in Obsidian, **When** the picture is moved there, **Then** Obsidian updates the link as for any picture in a note, and VS Code shows it from the new place after the next read.
3. **Given** the setting is off, or the workspace is untrusted, **When** a picture is added, **Then** it stays embedded in the note, with no link written.
4. **Given** a picture whose path is not a plain relative path (for example outside the folder), **When** the note is saved, **Then** no link is written for it, and it shows as missing with a plain reason if it cannot be read.

---

### Edge Cases

- A `.sododeck.md` whose marker is missing or malformed: stays text. Only the exact marker counts.
- The same file open in both tools with unsaved edits in VS Code when Obsidian writes: the file wins (as 066/069), with a one-line notice if edits were replaced.
- A user hand-edits the deck data block of a note: the readable text wins on titles and notes (070 rule); the docs say so.
- Folders with both `billing.sododeck` and `billing.sododeck.md`: both open independently; no merging.
- A `.sododeck.md` in an untrusted workspace: opens and saves with pictures embedded; no picture files read or written (069 rule).
- A note over the size limit the deck format allows: refused with a plain reason, file untouched.
- Sync tools creating conflict copies: copies are ordinary files; each opens on its own.

## Requirements _(mandatory)_

### Functional Requirements

**Cross-tool plain file**

- **FR-001**: The README of the VS Code extension, the README of the Obsidian plugin, the web app's export help, and `docs/` MUST each state that `.sododeck` is the form that opens in every host, what `.sododeck.md` adds (search by card text, backlinks, links that follow moves, in Obsidian), and how to bring in a `.sododeck.json`.
- **FR-002**: The VS Code extension MUST provide a command that copies a `.sododeck.json` to a `.sododeck` next to it, leaving the original unchanged.
- **FR-003**: The Obsidian plugin MUST provide the same command for a vault file.
- **FR-004**: Both commands MUST check that the content is a valid deck before writing, MUST NOT overwrite an existing file (a different name or a plain explanation instead), and MUST NOT change the content.
- **FR-005**: No change to the `.sododeck` or `.sododeck.md` formats is made by this feature.

**`.sododeck.md` in VS Code**

- **FR-006**: The VS Code extension MUST open a `*.sododeck.md` file as the canvas when and only when its front matter carries the Sododeck marker; any other Markdown file MUST stay in the text editor.
- **FR-007**: "Open as text" MUST work on a deck note, as on any deck.
- **FR-008**: The extension MUST read a note through the model's Markdown reader, so edits to titles and notes in the readable part reach the canvas (070 rule).
- **FR-009**: The extension MUST save a note through the model's Markdown writer with the previous text, so text outside the generated part is kept byte for byte and the readable part is regenerated.
- **FR-010**: The extension MUST write a note only in response to the editor's save, save as, or a new-note command, never on open or close (069 FR-010).
- **FR-011**: When the note changes on disk, the canvas MUST update in place without losing selection, viewport or undo history (066), with the file winning over unsaved edits and a one-line notice if edits were replaced.
- **FR-012**: A note that cannot be read MUST show a plain message and offer "Open as text"; the file MUST NOT be changed.
- **FR-013**: The extension MUST provide a "New Sododeck note" command that creates a `.sododeck.md`; the default command MUST be named "New Sododeck" (renamed from "New Sododeck deck", in the VS Code extension and in the Obsidian plugin, in command palette, folder menu, docs and READMEs) and MUST keep creating a `.sododeck`.
- **FR-014**: For a note, pictures MUST follow the extension's existing picture rules (sibling folder when "save next to the deck" is on, otherwise embedded; nothing read or written in an untrusted workspace; nothing outside the workspace).
- **FR-015**: When a picture of a note is stored as a plain relative path inside the workspace, the note's link list MUST include a link to it that Obsidian resolves; other pictures MUST have no link written.
- **FR-016**: Link rewriting as Obsidian does it (on a move inside VS Code) is NOT done; a picture moved in VS Code shows as missing with a plain reason until it is moved back or re-added.

**Quality**

- **FR-017**: A note saved from VS Code MUST open as a deck in Obsidian, and a note saved from Obsidian MUST open as a deck in VS Code (round trip proven by tests on the same fixtures).
- **FR-018**: Nothing is sent over the network (architecture rule 5); no new runtime dependency.

### Key Entities

- **Shared folder**: one folder opened by both Obsidian and VS Code; holds decks in either form.
- **Deck note**: a `.sododeck.md` file: front matter marker, a readable part, a link list for pictures, and the full deck block.
- **Generated region**: the part of a deck note the writer owns and regenerates; everything outside it is the user's.
- **Plain relative path picture**: a picture the deck points at by a path inside the folder with no special parts; the only kind that gets a link in the note.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a folder opened in both tools, an edit made in one shows in the other within 1 second of the file being written, for 100% of the tested edits.
- **SC-002**: 100% of the test fixtures for the note form survive an open → edit → save round trip in VS Code with every character outside the generated region unchanged.
- **SC-003**: 100% of notes saved from VS Code open as decks in Obsidian, and the reverse, on the shared fixtures.
- **SC-004**: A user brings a `.sododeck.json` in with one command in under 10 seconds, and the original is byte-identical afterwards.
- **SC-005**: An ordinary Markdown file is never opened as a canvas in 100% of the tested cases (no marker, partial marker, other extensions).
- **SC-006**: A user reading only the README of either host can tell which file form to choose for a shared folder.

## Assumptions

- Both hosts (069, 070) and the Markdown form with its reader and writer (070) are built and merged.
- Picture storage (FR-014/FR-015) and the new-deck default and name (FR-013) are confirmed by the founder (2026-10-08).
- `.sododeck.json` support in the hosts is limited to the one-step copy command; neither host registers that name as a canvas.
- Out of scope: the skill (027) writing or checking `.sododeck.md`; rewriting links in VS Code; links from cards to notes; deck previews inside notes.
- The marker, the generated region and the reader/writer behave as specified in 070; this feature adds no new rule to them.
