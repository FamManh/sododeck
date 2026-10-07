# Feature Specification: Sododeck in Obsidian

**Feature Branch**: `070-obsidian-plugin`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "70 from docs/backlog-3.md" — backlog entry `docs/backlog-3.md` § 070-obsidian-plugin: "Ship an Obsidian plugin that opens .sododeck files in a vault as the Sododeck canvas, on desktop and mobile. Changes save automatically, a deck changed by sync or in another pane updates in place, pictures go to the vault's attachment folder, and the canvas follows the light or dark theme. Nothing is sent over the network." Revised in clarification the same day (founder): the vault's deck file is a Markdown file, `.sododeck.md` (readable text the notes app can search and link, plus the full deck), instead of a plain `.sododeck`; pictures are stored as links the notes app keeps up to date when files move.

## Context

Backlog 3 (editor hosts, 066–070) puts a deck inside the programs where the work already happens. People who keep their notes in an Obsidian vault keep the systems those notes describe next to them: a deck belongs in the vault as a file that syncs, shows up in search, and can be written by an AI agent, then opened as a canvas with one click.

The pieces below this feature are built or specified:

- **066** merges a changed file into an open deck without losing selection, viewport or undo history.
- **067** defines one message protocol and an embeddable editor with no library, no browser storage and no network.
- **068** lets a picture point at an image file instead of embedding its bytes.
- **069** is the first host (a code editor), which keeps using the plain `.sododeck` file. Its host side is the model for this one: the same contract, a different program around it.

This feature is the second host: an Obsidian plugin that opens `.sododeck.md` and plain `.sododeck` files as the canvas and does the host's half of the 067 contract. The vault owns the bytes on disk, sync and the theme; the embedded editor owns the canvas, the open document and undo.

**Why a Markdown file.** The notes app only understands links, tags and text inside Markdown files. A deck stored as a Markdown file gets, with no extra code in the plugin: full-text search of card titles and notes, backlinks and the graph, and, most importantly, **picture links that the app rewrites by itself when a picture or the deck is moved or renamed** (the way another popular drawing plugin for the same app keeps its embedded images working). A plain `.sododeck` file would be opaque to the app, and a moved picture would silently break.

The cost: a second file format, which this feature adds to the model and to the web app's import and export; and a plugin that has to tell a deck from an ordinary note, since the app picks a view by the last extension (`md`) and this file is, to the app, a note.

## Clarifications

### Session 2026-10-07

- Q: Does this feature change the editor or the file format? → A: Yes, one thing: a second, Markdown form of the same deck (`.sododeck.md`) is added to the model (read and write, lossless) and to the web app's import and export. The deck schema and the plain `.sododeck` file do not change. Anything else the editor needs that 067 does not provide is reported as a gap to 067, not built here.
- Q: Does the embedded editor run inside the notes app's own screen or in an isolated frame? → A: An isolated frame (founder decision H1 in `docs/backlog-3.md`), so the editor's styles and popups never leak into the notes app's interface.
- Q: Does a deck need its own "Save" step? → A: No. The notes app has no manual save, so changes are written automatically shortly after the last edit, and always before the view closes (067 `flush`).
- Q: Which files does the plugin open as a canvas? → A: Two kinds (founder): `.sododeck.md` files that carry the Sododeck marker in their front matter (the recommended form, with search, backlinks and links that survive moves), and plain `.sododeck` files, which the plugin registers as its own file type the way a popular drawing plugin registers its own extension, so they show in the file list and open and edit on the canvas like any deck. `.sododeck.json` is not supported (the app would hand the plugin every `.json` file). The plugin offers no conversion command; the web app's export and import move a deck between the two forms.
- Q: What does a plain `.sododeck` give up compared with `.sododeck.md`? → A: Search of card text, backlinks, and picture links that the app updates on a move. New pictures in a `.sododeck` stay embedded in the file (the plugin does not write relative paths it cannot keep correct); a `.sododeck` that already points at picture files (068) shows them from the vault, read-only in that respect.
- Q: When the user edits the readable Markdown part (titles, notes) in text mode, is it read back into the deck? → A: Yes. Edits to titles and notes in the readable part are read back by the stable id each line carries; everything else (positions, connections, rules, flows) comes from the full deck block. Lines without a known id and text the user adds around them are ignored and kept; deleting a line never deletes an object.
- Q: When the readable part and the full deck block disagree about a title or note, which wins? → A: The readable part, because a person editing text is the usual cause; the documentation tells anyone who edits the deck block by hand to edit the readable text too.
- Q: When the file changes from outside while the user has edits that were not yet written, who wins? → A: The file, as in 069 and 066: the merge is not an undo step and never restores what it replaced. Because the app writes within about a second, this window is short; if edits were replaced, a one-line notice says so.
- Q: Which folder is the boundary for pictures? → A: The vault. A picture link that resolves outside the vault is refused (068 FR-014).
- Q: Where do new pictures go, and how are they referenced? → A: By default into the vault's attachment location as set in the app's own settings (the one the user already uses for pasted images), referenced from the deck file by a link the app tracks. The user can instead keep pictures embedded in the file with a plugin setting.
- Q: What if the user moves or renames a picture or the deck? → A: The plugin does no rewriting of its own. The app updates the links (when its "update internal links" setting is on) and links also still resolve by file name; if a picture still cannot be found, it shows as missing with a reason that names it.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a deck from the vault and edit it, saved automatically (Priority: P1)

A user has `Projects/billing.sododeck.md` in their vault. They tap it in the file list and the deck opens as a canvas in a normal pane, on desktop or on a phone. They move a node and keep working; they never press save. A second later the file on disk holds the change.

**Why this priority**: This is the reason for the plugin. Without it nothing else matters.

**Independent Test**: Open a vault containing one deck, open the file, move a node, wait one second, and check the file on disk against the format. Repeat on a mobile device.

**Acceptance Scenarios**:

1. **Given** a vault with `Projects/billing.sododeck.md`, **When** the user opens it, **Then** the canvas shows the deck in a pane, without any library, home screen or "open deck" control.
2. **Given** the deck is open, **When** the user edits it, **Then** the file on disk holds the edit within one second of the last change, as a valid deck file in its Markdown form.
3. **Given** the deck is open and unedited, **When** the user closes the pane, **Then** the file on disk is untouched (no rewrite, no new modified time).
4. **Given** edits were made in the last fraction of a second, **When** the user closes the pane or the app, **Then** those edits are in the file (067 `flush` is answered before the view goes away).
5. **Given** a plain `.sododeck` file in the vault, **When** the user looks at the file list and opens it, **Then** it is listed like any file and opens as the canvas, is edited and written automatically like any deck, and keeps its plain form (it is not converted). A `.sododeck.json` file is left alone as an ordinary file.
6. **Given** an ordinary note (a Markdown file without the Sododeck marker), **When** the user opens it, **Then** it opens as a note, as before.
7. **Given** a phone or tablet, **When** the user opens a deck, **Then** the canvas shows and can be edited with touch, and edits are written automatically as on desktop.
8. **Given** a deck open as a canvas, **When** the user chooses to view the file as text (the app's own "open in source mode" for the same file), **Then** the raw Markdown is shown without changing it.

---

### User Story 2 - The deck is part of the vault: search, backlinks, text editing (Priority: P1)

Because the deck file is Markdown, the user finds a deck by words that appear on its cards (titles and notes) in the app's search, sees which notes link to it and which notes it links to by text, and can fix a typo in a card title right in the text view without opening the canvas.

**Why this priority**: It is the reason for the Markdown form. Without a readable part the Markdown file is just the old file with a longer name.

**Independent Test**: Create a deck with titled cards and notes; search the vault for a card title; edit a title in the text view; reopen the canvas.

**Acceptance Scenarios**:

1. **Given** a deck with a card titled "Payment gateway", **When** the user searches the vault for those words, **Then** the deck file is among the results.
2. **Given** a note that contains a link to the deck file, **When** the user opens the deck's backlinks, **Then** that note is listed.
3. **Given** a card note that contains the text of a link to another note, **When** the app indexes the vault, **Then** the app lists that link in the deck file's outgoing links (clicking it on the canvas is out of scope).
4. **Given** the deck's text view, **When** the user changes a card's title in the readable part and saves the text (or the app autosaves it), **Then** the canvas, if open, shows the new title in place and keeps selection and viewport; if closed, the next open shows it.
5. **Given** the user adds a new line, heading or paragraph of their own in the readable part, **When** the deck is next written by the plugin, **Then** the user's additions are kept and no object is created or removed because of them.
6. **Given** the user deletes a title line from the readable part, **When** the deck is read, **Then** the object stays on the canvas (with its title as the deck block holds it) and nothing is lost.
7. **Given** the readable part and the deck block disagree on a title, **When** the file is read, **Then** the readable text wins and the deck shows it.
8. **Given** the deck block has been damaged by hand so it is not a valid deck, **When** the file is read, **Then** the plugin shows the problems read-only and does not rewrite the file (see Story 3).

---

### User Story 3 - The canvas follows the file: sync, other panes, agents (Priority: P1)

The vault syncs between devices, the same deck may be open in two panes, an AI agent may write the file, and the user may edit its text. When the file changes on disk, the open canvas shows the new content in place, keeping selection and viewport.

**Why this priority**: Notes vaults change under the app constantly. Without this the open canvas and the file drift apart, and the next automatic write would overwrite the synced or agent-written content.

**Independent Test**: Open a deck, change the file from outside (another device through sync, a command line write, another pane, the text view), and watch the canvas; repeat with a deck the user is editing right then.

**Acceptance Scenarios**:

1. **Given** an open deck, **When** vault sync (or any outside writer) changes the file, **Then** the canvas shows the new content without reloading, and selection and viewport are kept where the objects still exist.
2. **Given** the user's own automatic write, **When** the app reports the file change that write caused, **Then** the canvas does not flicker, merge or add an undo step, and the file is not written again because of it.
3. **Given** edits that were not yet written, **When** an outside change arrives, **Then** the canvas shows the file's content, a one-line notice says the recent edits were replaced, and the replaced edits are not brought back by undo (066 / ADR 0047).
4. **Given** an outside change that is not a valid deck, **When** it arrives, **Then** the canvas keeps the last good deck, shows the problems and is read-only (067 FR-014), and the plugin does not write over the file until a valid file arrives.
5. **Given** a sync service that writes a conflicted copy next to the deck, **When** it appears, **Then** the original deck keeps working and the plugin does nothing to the copy.
6. **Given** the file is renamed or moved while open, **When** this happens, **Then** the pane stays on the same deck under its new name; **Given** it is deleted, **Then** the view shows the app's usual missing-file state with no write that would recreate the file by itself.
7. **Given** a deck open in a pane that is in the background, **When** the user switches to it, **Then** it shows the current content.
8. **Given** the same deck open in two panes, **When** the user edits in one, **Then** the other updates in place as an outside change and the two never write over each other in a loop.

---

### User Story 4 - Pictures stay linked when files move (Priority: P2)

A user pastes or adds a picture to a card. By default it is saved as an image file in the vault's attachment location, exactly where the user's other pasted images go, and the deck file records it as a link the app understands. When the user later moves the picture, moves the deck, or renames either, the picture still shows. A user who wants one self-contained file switches a plugin setting so pictures stay embedded.

**Why this priority**: It is the second reason for the Markdown form. The plugin works without it (embedded pictures), so it ranks below the file round trip.

**Independent Test**: Add a picture; move the picture to another folder; move the deck to another folder; rename each; try a link that leaves the vault.

**Acceptance Scenarios**:

1. **Given** the default setting, **When** the user adds a picture, **Then** an image file appears in the vault's attachment location, the deck file records a link to it, and the picture shows on the canvas.
2. **Given** the setting "keep pictures inside the deck", **When** the user adds a picture, **Then** its bytes are embedded in the deck block and no extra file is created.
3. **Given** a picture file used by a deck, **When** the user moves or renames the picture file in the app, **Then** the link in the deck file is updated by the app and the picture still shows (without reopening the deck).
4. **Given** a deck with pictures, **When** the user moves the deck to another folder or renames it, **Then** its pictures still show.
5. **Given** the app's setting that updates internal links is off, **When** a picture is moved, **Then** the picture still shows if its link can still be resolved by file name, and otherwise shows as missing with a reason that names the picture and mentions the setting.
6. **Given** a link in the deck that points at a file that does not exist (for example not yet synced to this device), **When** the deck is opened, **Then** that picture shows as missing with a reason that names it, and it appears by itself once the file arrives.
7. **Given** a deck with a picture link that resolves outside the vault, **When** the deck is opened, **Then** the file is not read, the picture shows as missing with a reason that says the path is outside the vault, and no file outside the vault is touched.
8. **Given** the attachment location already holds a different file with the name the plugin wants, **When** a picture is saved, **Then** both files are kept and the existing one is never overwritten; an identical file is reused.
9. **Given** the plugin cannot write the picture file (read-only location, no space), **When** the user adds a picture, **Then** the picture stays embedded and the user sees the reason.
10. **Given** a linked file whose bytes no longer match the picture's id, **When** the picture is requested, **Then** it shows as missing with the reason "the file changed", never the wrong image.
11. **Given** the user changes the vault's attachment setting, **When** the next picture is added, **Then** it goes to the new location; existing pictures stay as they are.

---

### User Story 5 - The canvas looks like it belongs in the app (Priority: P2)

The canvas uses the notes app's light or dark theme and follows it when the user switches, without reloading the deck or losing the user's place.

**Why this priority**: A bright canvas in a dark vault looks broken, but it does not block the work.

**Independent Test**: Open a deck in each theme, then switch theme while it is open, on desktop and mobile.

**Acceptance Scenarios**:

1. **Given** the app uses a dark theme, **When** a deck opens, **Then** the canvas is dark; the same for light.
2. **Given** a deck is open, **When** the user switches the app's theme (or the system switches it automatically), **Then** the canvas follows within one second, without reload and with selection and viewport kept.

---

### User Story 6 - Create a deck and bring decks in and out (Priority: P2)

A user runs "New Sododeck deck" from the command palette or from a folder's menu in the file list, names the file, and gets an empty deck open on the canvas. A deck made elsewhere (the web app, an agent through the skill) reaches the vault as a `.sododeck.md` exported from the web app, and a vault deck can be opened in the web app by importing the same file.

**Why this priority**: Makes the first minute easy and keeps the vault from being a dead end, but opening existing files already works without it.

**Independent Test**: Run each entry point in a fresh vault; export a deck from the web app, drop it into the vault, open it; import a vault deck into the web app.

**Acceptance Scenarios**:

1. **Given** a vault, **When** the user runs "New Sododeck deck" from the command palette, **Then** a valid empty `.sododeck.md` file is created in the folder of the active note (or the vault root) and opens on the canvas; an existing file with that name is never overwritten.
2. **Given** the file list, **When** the user opens a folder's menu, **Then** it offers "New Sododeck deck" and the new deck is created in that folder.
3. **Given** a deck exported from the web app as `.sododeck.md`, **When** it is placed in the vault, **Then** it opens as the canvas with its content (pictures embedded or linked as exported).
4. **Given** a deck made in the vault, **When** the file is imported into the web app, **Then** the web app opens the same deck, with the same ids, and the same file exported back from the web app opens in the vault unchanged in content.
5. **Given** a deck in the vault, **When** the user looks in the file list and the quick switcher, **Then** it is listed by name like any note and opening it from either shows the canvas.

---

### User Story 7 - Install and trust (Priority: P2)

A user finds the plugin in the community plugin list, reads what it does, installs it, and can rely on it making no network requests and not reading or writing outside their vault.

**Why this priority**: Without an honest, installable package nobody gets to use it; however, publishing to the list is a release step and not part of the code.

**Independent Test**: Build the release files, install them in a clean vault on desktop and on a phone, open a deck while watching network traffic.

**Acceptance Scenarios**:

1. **Given** the built release files, **When** they are installed in a clean vault, **Then** `.sododeck.md` and `.sododeck` files open as the canvas with no other setup.
2. **Given** the plugin running, **When** a deck is edited, saved, changed from outside, a picture is added and the theme is switched, **Then** there are zero network requests.
3. **Given** the plugin is switched off or removed, **When** the user looks at the vault, **Then** every deck file and picture file is exactly as it was, and each deck is still a readable Markdown note with its full content.

---

### Edge Cases

- A deck of 500 nodes and 1,000 edges opens and edits without a noticeable delay in typing or dragging on desktop; on a phone it opens and edits without the app being closed for memory, and if the device cannot hold it the user sees a plain message instead of a blank pane.
- A big deck makes a big note: the readable part is text, not the full deck, and the app's search and graph stay responsive with 100 decks in the vault.
- Rapid edits (dragging a node) produce one write per burst, not hundreds; the plugin never writes more often than once per 200 ms and never writes a file that equals the file already on disk.
- A Markdown file with the Sododeck marker but no valid deck block, an empty one, or one that is mangled: empty (marker only) opens as an empty deck; anything else shows its problems, offers a way to see the raw text, and the plugin never rewrites it.
- A deck's text view is edited while the canvas is open: each text save is an outside change (merged in place); the user's own text around the readable part survives the next write.
- The user changes the marker (removes it): the file becomes an ordinary note and the plugin lets go of it without touching it.
- Text with characters that Markdown treats specially (headings, lists, links, code fences, front matter fences, line breaks) in a title or note: it is written so it reads back unchanged, and it never breaks the file's structure.
- A very large picture (tens of megabytes) passes between the canvas and the plugin without freezing the app; the format's size limits still apply and a refusal gives a plain reason.
- The app is backgrounded or killed right after an edit (common on phones): the edit is written as soon as the change message arrives, and the plugin does not rely on a timer that a sleeping app would never run.
- Vault sync that has not yet delivered a linked picture: it shows as missing and recovers by itself when the file appears (no manual refresh).
- Symbolic links or shortcuts inside the vault that lead outside it: a picture link is judged by where it really ends up where the platform allows that to be known; where it cannot be known (mobile), links are not followed.
- Two devices edit the same deck at the same moment: the vault's own sync rules decide the winner; the plugin treats the arriving file as an outside change and never writes a deck it has not changed.
- Line endings and key order: opening a deck without editing and closing it produces no diff; writing a changed deck changes only what changed.
- The pane is moved to a pop-out window or restored after an app restart: it comes back on the same deck with the saved file.
- Protocol version mismatch between plugin and embedded editor: a plain "update the plugin" message, nothing is shown or edited (067 FR-003).

## Requirements _(mandatory)_

### Functional Requirements

**The Markdown form of a deck**

- **FR-001**: The model MUST read and write a deck in a Markdown form, `.sododeck.md`, made of: front matter that marks the file as a Sododeck deck (and carries nothing the deck block does not), a readable part (the deck's title and, for every object with text, its title and notes, grouped so a person can follow them), and one block holding the complete deck in the deck format. The deck schema and the plain `.sododeck` file MUST NOT change.
- **FR-002**: Reading then writing a deck in the Markdown form MUST be lossless: every object, id, field and picture entry survives, and a deck converted from `.sododeck` to `.sododeck.md` and back is the same deck.
- **FR-003**: Every line of the readable part that stands for an object's title or notes MUST carry that object's stable id, so edits are matched by id and never by position or wording.
- **FR-004**: Reading a file MUST apply title and notes edits found in the readable part to the matching objects, MUST keep everything else from the deck block, MUST let the readable text win where the two disagree, and MUST ignore text and lines it does not recognise without losing them on the next write. Deleting a line MUST NOT delete an object.
- **FR-005**: Writing a file MUST preserve any text the user added outside the parts the plugin owns, and MUST write titles and notes so they read back unchanged whatever characters they hold.
- **FR-006**: The same Markdown form MUST be available for import and export in the web app, so a deck can go between the web app, an AI agent's output and a vault, and a file exported by the web app opens in the vault with no other step.

**Opening and the file**

- **FR-007**: The plugin MUST register `.sododeck` as its own file type and open such files as the canvas, MUST open a Markdown file as the canvas only when its front matter carries the Sododeck marker, MUST leave every other Markdown file and every `.sododeck.json` file to the app, and MUST let go of a file whose marker is removed. A `.sododeck` file MUST be read and written in its plain form (no Markdown form is added to it). It MUST work in the file list, search and quick switcher on desktop and mobile.
- **FR-008**: The canvas MUST run in an isolated frame inside the pane (H1), load only the plugin's own bundled files, and MUST NOT let the editor's styles, popups or scripts reach the app's own interface or the other way round.
- **FR-009**: The canvas MUST show the deck from the file as 067's start message, with the host's abilities declared truthfully, and MUST show only the open deck's screen (067 FR-020).
- **FR-010**: A file with the marker and no deck block MUST open as an empty deck without rewriting the file. An invalid file MUST show its problems, MUST NOT be rewritten, and MUST offer a way to view the raw text.
- **FR-011**: When the protocol version of the plugin and the editor differ, the user MUST see 067's plain "update" message naming which side needs an update, and the deck MUST NOT be shown or edited.

**Editing and saving**

- **FR-012**: The plugin MUST write the deck file automatically after the canvas reports a change, within one second of the last edit, and MUST NOT require or show a save command for decks.
- **FR-013**: The plugin MUST write only through the app's file API for the vault, MUST write the complete file in the form it was opened in (the Markdown form (FR-001) for `.sododeck.md`, the plain deck form for `.sododeck`), and MUST NOT write a file that equals the file already on disk.
- **FR-014**: Before the view closes, the pane is hidden by an app shutdown, or the app is sent to the background, the plugin MUST ask the canvas for its latest changes (067 `flush`) and MUST write them before finishing; no edit is lost to a closing view.
- **FR-015**: A write MUST NOT happen unless the canvas reported a change; opening, viewing, selecting, zooming or merging an outside change MUST NOT modify the file.
- **FR-016**: The plugin MUST report the write state to the canvas (067 `change-result`: taken, or refused with a reason), and a failed write MUST be retried on the next change and shown to the user in plain words; the plugin MUST NOT silently discard a deck it could not write.
- **FR-017**: The written file MUST be in a canonical form with a stable order of everything it writes, so that opening and closing an unchanged deck produces no diff.

**Outside changes**

- **FR-018**: The plugin MUST watch the open deck's file and report a changed file to the canvas (067 `external-change`) so it is merged in place with selection, viewport and undo history kept, for changes from vault sync, another pane, the text view, another program, or an agent. The file MUST be read through FR-004 first, so text edits arrive as outside changes.
- **FR-019**: The plugin MUST ignore file changes that its own write caused, and MUST NOT report a file equal to the last one the canvas sent (067 FR-013), so no write loop can form between two panes, the plugin and a sync service, or the plugin and the text view.
- **FR-020**: An outside change while the canvas has edits that were not yet written MUST be applied like any outside change: the file wins, the merge is not an undo step (066), and a one-line notice says the recent edits were replaced. The user MUST NOT be asked a "file changed" question for a deck.
- **FR-021**: A file that becomes invalid MUST leave the last good deck on the canvas, show the problems read-only (067 FR-014), and MUST NOT be overwritten by the plugin until a valid file arrives.
- **FR-022**: When the file is renamed or moved, the pane MUST stay on the same deck under the new name; when it is deleted, the pane MUST show the app's usual missing-file state and the plugin MUST NOT recreate the file without a user edit.
- **FR-023**: Two panes on the same deck MUST each follow the other as an outside change; the plugin MUST ensure they cannot trigger each other in a loop of writes.

**Pictures**

- **FR-024**: The plugin MUST declare the picture-storing ability to the canvas for a `.sododeck.md` deck when the setting is "save in the vault's attachment location" (default); for a plain `.sododeck` deck it MUST NOT declare it, so new pictures stay embedded; with "keep pictures inside the deck" the ability MUST NOT be declared and pictures stay embedded in the deck block (067 FR-016).
- **FR-025**: The plugin MUST write each new picture to the location the app's own attachment settings give for a file in that deck's folder, MUST record it in the deck file as a link the app tracks (and so rewrites when the picture or the deck moves or is renamed), and MUST NOT write any link-rewriting code of its own. It MUST NOT overwrite an existing file; a name clash MUST get a different file name or reuse an identical file.
- **FR-026**: The plugin MUST serve a linked picture to the canvas by resolving the link the way the app does (including by file name), or, for a picture entry of a plain `.sododeck` that holds a relative path (068), by resolving that path from the deck file's folder, and reading the file through the app's file API, and MUST answer that the picture is missing, with a plain reason that names it, when the file is not there or cannot be read. A picture reported missing MUST be asked for again when the vault reports that file created, changed or renamed, so a late-synced or moved picture appears by itself.
- **FR-027**: The plugin MUST refuse to read or write any picture path that resolves outside the vault (068 FR-014), judged on the resolved location, and MUST say so in the reason it gives. Absolute paths and paths with a drive or scheme MUST be refused the same way.
- **FR-028**: The plugin MUST check every linked file against the picture's id and size before serving it, and MUST NOT show a file whose bytes do not match, answering missing with a reason that says the file changed.
- **FR-029**: A failure to write a picture file MUST leave the picture embedded in the deck and tell the user why.
- **FR-030**: Picture links MUST survive the Markdown form's round trip (FR-002) and a conversion to and from `.sododeck`: a deck's picture entries and the links the app tracks stay equivalent.

**Look and feel**

- **FR-031**: The canvas MUST use the app's light or dark scheme at start and MUST follow changes while open, without reloading the deck.

**Commands and entry points**

- **FR-032**: The plugin MUST provide "New Sododeck deck" in the command palette and in the file list's folder menu; it creates a valid empty `.sododeck.md` in the target folder (the folder of the active file, or the vault root, when run from the palette), never overwrites an existing file, and opens it.
- **FR-033**: The plugin MUST provide one setting for where pictures go (the vault's attachment location, default, or inside the deck) and MUST NOT add other settings in this feature.

**Trust and limits**

- **FR-034**: The plugin MUST NOT make any network request, MUST NOT load or start telemetry, MUST NOT use any remote script, style or font, and MUST load only its own bundled files into the canvas.
- **FR-035**: The plugin MUST accept messages only from its own canvas frame and MUST ignore unknown or malformed ones without changing the deck or any file (067 FR-004).
- **FR-036**: The plugin MUST read and write only the open deck file, the picture files its own protocol requests ask for inside the vault, and its own small settings; it MUST NOT scan, index or modify other vault files.
- **FR-037**: Disabling or removing the plugin MUST leave every deck and picture file valid and readable, each deck as an ordinary Markdown note with its full content; the plugin MUST NOT leave behind extra files or folders it created for itself, apart from picture files the user chose to save.

**Packaging and release**

- **FR-038**: The plugin MUST be packaged as the files the community plugin list expects (manifest, bundled code, styles, version list), with a description that states the no-network and vault-only promises, that it opens `.sododeck.md` and `.sododeck` files, and which devices it supports (desktop and mobile).
- **FR-039**: Submitting to the community plugin list MUST be a documented release step with its own checklist; building the release files MUST NOT publish them.
- **FR-040**: The plugin's behaviour MUST be covered by automated tests that run the plugin's host side against the fake-host contract of 067 with a fake vault (open, edit, automatic write, flush on close, outside change, own-write echo, two panes, text-view edit read back, invalid file, version mismatch, picture store, link resolution after a move, refusal outside the vault, late-arriving picture), and the Markdown form by round-trip tests in the model (FR-002, FR-004, FR-005).

### Key Entities

- **Deck file**: the `.sododeck.md` file in the vault; the single store. Owned by the app's vault, read and written only through its file API.
- **Readable part**: the human-readable text in the deck file (deck title, object titles and notes with their ids); what the app searches and links, and what a person may edit.
- **Deck block**: the complete deck in the deck format, inside the deck file; the source for everything except titles and notes.
- **Marker**: the front matter entry that tells the plugin a Markdown file is a deck.
- **Canvas**: the embedded Sododeck editor (067) shown in the pane inside an isolated frame; owns the open document and undo.
- **Host side**: the plugin's part that connects a file to a canvas through the 067 message protocol (init, change, change-result, flush, external-change, picture store, theme).
- **Picture link**: a link in the deck file to an image file in the vault, tracked and rewritten by the app on move or rename.
- **Picture file**: an image file in the vault, usually in the attachment location.
- **Setting**: the user's one choice for where new pictures live: the vault's attachment location (default) or inside the deck.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user opens a deck from the file list and sees the canvas in under 2 seconds on desktop for a 500-node deck, and under 5 seconds on a mid-range phone for a deck of 100 nodes.
- **SC-002**: After the last edit, the file on disk holds it within 1 second in 100% of scripted runs, and closing the pane immediately after an edit loses no edit in 100 of 100 runs.
- **SC-003**: Across 100 scripted edit, sync-style outside change, text-view edit, two-pane and reopen sequences, no edit made before the last outside change is lost except as stated in FR-020, no sequence produces a file that fails the format check, and no sequence causes a write loop (zero writes caused only by an echo).
- **SC-004**: Opening and closing an unchanged deck produces zero bytes of diff and no change of modified time for 100% of the sample decks and test corpus.
- **SC-005**: Converting every sample deck to the Markdown form and back yields the same deck in 100% of cases, including titles and notes with Markdown-special characters.
- **SC-006**: A card title found in the vault search returns the deck file, and a title edited in the text view shows on the open canvas within 1 second, with selection and viewport kept, in 100% of test cases where the selected objects still exist.
- **SC-007**: After a picture file or a deck is moved or renamed in the app, 100% of its pictures still show without any action by the user (links updated by the app), and the same holds when the app's link-update setting is off and the file name is unique.
- **SC-008**: Zero network requests are made over a full session of open, edit, picture add, outside change and theme switch, on desktop and on mobile.
- **SC-009**: No test path, including `..` runs, absolute paths and links where the platform lets them be known, lets the plugin read or write a file outside the vault.
- **SC-010**: A picture whose file is delivered late by sync appears on the canvas within 2 seconds of the file appearing, with no user action.
- **SC-011**: A first-time user goes from installing the plugin to a new deck with one edit saved in under 2 minutes without reading documentation.
- **SC-012**: Removing the plugin leaves 100% of deck and picture files byte-identical to before removal, and each deck is still readable as a note.
- **SC-013**: Dragging a node in a 500-node deck on desktop stays smooth: the canvas keeps its usual frame rate, and a burst of edits results in at most one write per 200 ms.

## Assumptions

- **Depends on 067's contract, not its code.** This spec uses the message protocol in `specs/067-embed-host-protocol` (init, change, change-result, flush, external-change, picture store, theme, abilities, version check) and 068's picture entries. If planning finds a need the contract does not cover (for example a change burst size on mobile), it is raised against 067, not worked around here. 066, 067 and 068 are merged.
- **Scope is larger than the backlog's 4 days.** The Markdown form adds a second file format in the model, the web app's import and export of it, and the plugin's detection of a deck among notes. The backlog estimated 2–4 days for that part alone ("Later" item `.sododeck.md`). Planning should decide whether to deliver it as two features (the Markdown form in the model and web app, then the plugin) so each stays within the 1–6 day rule; the spec keeps one feature, as the founder asked.
- **069 is the pattern, not a dependency of code.** The host-side logic shared with 069 (writing rules, echo handling, picture path rules) is expected to be reusable; whether it is shared or copied is settled at planning, and host apps never import app code. 069 keeps using the plain `.sododeck` file; opening `.sododeck.md` there is "Later".
- **The notes app owns the file and the links.** Writing, sync, file watching, the vault and the rewriting of links on move or rename are the app's own mechanisms; the plugin keeps no second copy of the deck outside the canvas and the vault file and has no link-rewriting logic. A moved picture is handled by the app only when its "update internal links" setting is on; with it off, a link still resolves by file name when the name is unique.
- **Autosave replaces save.** There is no "dirty" state to show and no "revert": the app has neither for its own files, and the user's recourse is the canvas's undo plus the vault's own file history or sync history.
- **Readable text wins** when it and the deck block disagree on a title or note (see Clarifications). The risk is someone editing only the deck block by hand and not seeing the change; the documentation states the rule.
- **What counts as "titles and notes"** (which object fields appear in the readable part and can be read back) is settled at planning from the deck schema; the rule is that only text a person would reasonably edit as prose is read back, and ids, positions and structure never are.
- **Vault boundary.** "Vault" means the open vault's folder. Everything the plugin reads or writes is inside it. A deck is never opened from outside a vault.
- **Mobile limits.** The embedded frame must work on the app's mobile webview; memory is lower and background time is short, so writing happens as soon as a change arrives rather than on long timers (see Edge Cases). Resource addressing of the plugin's bundled files inside the frame on mobile is a risk to settle at planning.
- **Default for pictures is the vault's attachment location**, differing from 069 (embedded by default), because notes users expect pasted images to land there and to be visible as files; a single setting switches to embedded.
- **Picture file naming** (file names derived from the picture's id, extension from its type) is settled at planning; the rule is only that existing files are never overwritten and the app's attachment-location setting is honoured.
- **Language.** English UI, global audience, like the rest of the product.
- **Out of scope**: `.sododeck.json` files, any conversion command between the two forms (the web app's export and import are the way), clicking a link in a card to open a note (the text of a link is kept and indexed by the app, but not made clickable on the canvas), a deck preview inside a note, a deck library or home view, telemetry, uploading or syncing decks by the plugin's own means (the vault's sync is the user's), an "Open in Sododeck web" command, three-way merge of simultaneous edits (066's two-way rule applies), the local AI agent bridge (065), and moving existing pictures between embedded and linked.
- **Risks to settle at planning**: how to tell a deck from a note at the moment a file is first indexed, and how to swap the Markdown view for the canvas without a flash of the note; whether the isolated frame can load the plugin's bundled files and start the canvas's background workers on both desktop and mobile; memory use on phones for large decks and large pictures; how reliably the app reports file changes from sync and from other programs; how to tell the plugin's own write from an outside one without a timer; how Markdown-special text round-trips safely; keeping the written file's order stable for clean diffs.
