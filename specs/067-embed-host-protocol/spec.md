# Feature Specification: Embed the editor in a host program

**Feature Branch**: `067-embed-host-protocol`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "066 xong rồi làm tiếp" (066 is done, continue) — next feature in `docs/backlog-3.md`: § 067-embed-host-protocol: "Make the Sododeck editor embeddable in another program through one documented message protocol. A host page loads the editor in a frame, gives it a deck file, a light or dark theme and a list of what the host can do; the editor sends the changed file back shortly after each edit, asks the host to store and return pictures, and merges files the host reports as changed outside. The embedded editor has no deck library, browser storage, offline cache or telemetry, and sends nothing over the network. Include a development-only fake host to try it and to test the protocol. Out of scope: real editor or notes-app integrations, storing pictures as separate files."

## Context

Backlog 3 (editor hosts, 066–070) lets a deck open inside other programs, first a code editor (069), then a notes app (070), as a plain `.sododeck` file that lives next to the code or notes it describes. In a host, **the file is the store**: the host owns the bytes on disk, the dirty state, saving and backups; the editor owns the canvas, the open document and undo.

066 gave the deck model a way to merge a changed file into an open deck without losing selection, viewport or undo history. This feature builds the other half of the contract: one embeddable editor and one documented message protocol between the editor and whatever program hosts it. With it, each host becomes a thin adapter instead of a fork of the editor.

The people who benefit are developers and notes users who keep architecture next to their work (and the AI agents that write deck files for them). This feature itself ships no host they can install; it ships the embeddable editor, the protocol, and a development-only fake host that proves the contract and is the test bench for 069 and 070.

**Founder decision H1** (`docs/backlog-3.md`, decided 2026-10-07): the editor runs inside a frame in every host, so the host's own look and the editor's look never leak into each other.

## Clarifications

### Session 2026-10-07

- Q: When the host reports an invalid deck file (for example a half-typed JSON edit), how does the editor behave? → A: Keep the deck as it was, show a notice with the problems, and make the canvas read-only (sending nothing) until a valid file arrives.
- Q: Does the editor always run in its own frame, separate from the host's page, in every host (code editor, notes app)? → A: Yes, a frame in every host (H1 decided); mounting the editor directly into a host's page is out of scope.
- Q: When the host can store pictures, how does the file the editor sends record a picture? → A: The host stores the bytes and answers with a path relative to the deck file; the editor writes that path into the picture entry (068's format), so the file on disk equals the file the editor sent. The picture part of 067 depends on 068.
- Q: What does the editor's save indicator report in a host? → A: No "Saved" state in the editor; it only shows an error when the host refuses or does not take a change. Whether the file is saved to disk is shown by the host.
- Q: Which screens and import paths does the embedded editor keep? → A: Only the deck screen (the open deck's editor). Importing a `.sododeck` file is not available. Mermaid works by pasting text into the open deck only; choosing a Mermaid file from disk is not offered.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a deck file in a host (Priority: P1)

A host program loads the embedded editor and gives it the contents of a deck file, the host's colour scheme (light or dark) and the list of what the host can do. The editor shows the deck on the canvas, ready to edit, in the host's colour scheme. There is no deck library, no home screen and no "open / new deck" chrome: the host's file is the only deck.

**Why this priority**: Nothing else works until a host can show a file.

**Independent Test**: In the fake host, pick a sample deck and load it. The canvas shows that deck with the editor's normal tools; library, home and storage controls are absent; the fake host's message log shows the editor's "ready" and the host's "here is the file".

**Acceptance Scenarios**:

1. **Given** the fake host with a sample deck, **When** the editor loads, **Then** the editor says it is ready, the host sends the file, and the canvas shows that deck.
2. **Given** a host that says it uses the dark scheme, **When** the editor shows the deck, **Then** it uses the editor's dark theme; **When** the host later reports the light scheme, **Then** the editor switches without reloading the deck.
3. **Given** the embedded editor, **When** the user looks for the deck library, the home screen, a "new deck", "open deck" or "import deck file" control, **Then** none is present: only the open deck's screen is shown.
6. **Given** the embedded editor, **When** the user opens the Mermaid import, **Then** they can paste Mermaid text and it is added to the open deck, and there is no control to choose a file from disk.
4. **Given** a host that sends an empty file (a new, blank `.sododeck` file), **When** the editor loads it, **Then** it shows an empty deck and the first edit sends a complete, valid deck file back.
5. **Given** a host whose file is invalid (for example a hand edit left a dangling reference), **When** the editor loads it, **Then** it shows the file's problems in plain words, does not show a partial deck, and sends nothing back.

---

### User Story 2 - Edits flow back to the host as a file (Priority: P1)

The user edits the deck on the canvas (moves a card, renames a component, adds a connector). Shortly after each edit, the editor sends the host the complete, changed deck file, so the host can mark the file as changed and save it the way it saves any file. Many quick edits in a row arrive as one message, not one per keystroke. The editor shows no "Saved" state of its own (the host shows whether the file is saved to disk, the way it does for any file); it only shows an error when the host refuses or does not take a change.

**Why this priority**: A host that can show a deck but not take changes back is a viewer, not an editor.

**Independent Test**: In the fake host, move one card. Within 200 ms one "file changed" message arrives with the card's new position, and the file it carries validates. Type a ten-letter title quickly: one or two messages arrive, not ten.

**Acceptance Scenarios**:

1. **Given** an open deck in the fake host, **When** the user moves a card, **Then** exactly one "file changed" message arrives within 200 ms of the move, carrying a complete deck file that validates and has the new position.
2. **Given** the user makes several edits within a short burst, **When** the burst ends, **Then** the host receives the latest file once (earlier versions in the burst may be skipped) and never an older file after a newer one.
3. **Given** the host takes a file, **When** the user looks at the editor, **Then** it shows no save state (no "Saved" label); **Given** the host refuses a file, **Then** the editor shows an error with the host's reason, the deck stays editable, and the error clears when the host takes a later file.
4. **Given** the host asks the editor to hand over its latest changes (before the host saves or closes the file), **When** the editor answers, **Then** every edit made so far is in the file the host holds, and the editor confirms it is done.
5. **Given** the user undoes an edit, **When** the undo is done, **Then** the host receives the file without that edit, like any other change.

---

### User Story 3 - Outside changes appear in place (Priority: P1)

While the deck is open in a host, the file changes outside the editor: a version-control pull, a text edit of the same file, a sync from another device, or the user's AI agent rewriting it. The host reports the new file to the editor. The canvas updates in place: only what changed moves or changes, the user's selection and viewport stay, and the editor does not send the same file straight back. The user's own undo history still means "my last edit".

**Why this priority**: The main reason to keep decks in a folder is that agents and tools write them. Without this, every outside change forces a reload and loses the user's place.

**Independent Test**: In the fake host, select a card, then use the fake host's "simulate outside change" to rename a different component. The renamed title appears, the card is still selected, the canvas has not moved, and the message log shows no "file changed" sent back.

**Acceptance Scenarios**:

1. **Given** an open deck with a selected card, **When** the host reports a file where another component is renamed, **Then** only that title changes on the canvas, the selection and viewport stay, and no "file changed" message is sent back as a result.
2. **Given** the host reports a file equal to the one the editor last sent, **When** it arrives, **Then** nothing changes on the canvas and nothing is sent back.
3. **Given** the user made an edit, then an outside change arrives, **When** the user presses undo, **Then** the user's edit is undone and the outside change stays (as defined by 066).
4. **Given** the host reports an invalid file, **When** it arrives, **Then** the deck on the canvas stays as it was, a notice explains in plain words that the file has problems and lists them, and the canvas becomes read-only until a valid file arrives, so the editor never overwrites the user's half-finished text edit.
5. **Given** the canvas is read-only because of an invalid file, **When** the host reports a valid file, **Then** that file is merged in, the notice goes away, and editing works again.

---

### User Story 4 - Pictures through the host (Priority: P2)

The user adds a picture to a deck in a host. If the host says it can store pictures, the editor hands the picture's bytes to the host to keep, and asks the host for the bytes of pictures it does not have when a deck is opened or changed. If the host cannot store pictures, pictures stay inside the deck file, as in the web app. A picture the host cannot supply shows the existing "missing picture" look with a reason.

**Why this priority**: Pictures are part of decks (055), but most decks in a code or notes folder are mostly structure; the protocol must carry pictures, and 068/069 decide where they live on disk.

**Independent Test**: In the fake host with picture storage turned on, paste an image. The log shows the editor handing the picture to the host by its id; reload the deck: the editor asks for the picture and shows it. Turn the fake host's picture storage off and paste again: the picture is inside the file the editor sends.

**Acceptance Scenarios**:

1. **Given** a host that can store pictures, **When** the user adds a picture, **Then** the editor gives the host the picture's id, type and bytes, the host answers with a path relative to the deck file, the image shows on the canvas, and the file the editor sends records that path and no embedded bytes for that picture.
2. **Given** a host that can store pictures and a deck that names a picture the editor does not have, **When** the deck is shown, **Then** the editor asks the host for it by id and shows it when the host answers.
3. **Given** the host answers that a picture is missing, **When** the canvas shows that image, **Then** it shows the missing-picture look with a reason, and the rest of the deck is unaffected.
4. **Given** a host that cannot store pictures, **When** the user adds a picture, **Then** the picture's bytes are inside the deck file sent to the host.

---

### User Story 5 - A host that does less, or a different protocol version (Priority: P2)

Hosts differ: one can open links inside itself, another cannot; one can save an exported image next to the deck, another cannot. The editor shows only what the host can do, the way it already hides browser features the browser lacks. A host built for a different protocol version gets a clear message instead of a half-working editor.

**Why this priority**: Without this, every host has to support everything, or users click controls that do nothing.

**Independent Test**: In the fake host, turn off "export files". The export controls that need the host disappear. Set the fake host's protocol version to one the editor does not know: the editor shows "This extension needs an update" (or the editor needs one, whichever is older) and does not show the deck.

**Acceptance Scenarios**:

1. **Given** a host that cannot open links, **When** the user looks at a link in a deck, **Then** no "open link" action is offered (the link text stays readable and copyable).
2. **Given** a host that can open links, **When** the user opens a link in a deck, **Then** the editor asks the host to open it and does not navigate its own frame.
3. **Given** a host that can save exported files, **When** the user exports an image of the deck, **Then** the editor hands the exported file to the host; **Given** a host that cannot, **Then** export actions that need it are hidden.
4. **Given** a host speaking a newer or older protocol version than the editor, **When** the editor starts, **Then** it shows a plain message saying which side needs updating, shows no deck, and sends no edits.

---

### User Story 6 - Try and test the contract without a real host (Priority: P2)

A developer (or an agent) working on Sododeck opens a development-only fake host page. It loads the embedded editor, lets them pick a sample deck or paste a file, choose the colour scheme and the host's abilities, simulate an outside change, simulate the host taking or refusing a file, and see every message both ways. The same fake host is what automated tests use to check the protocol.

**Why this priority**: Real hosts (069, 070) come later; without a fake host, the protocol could only be tested once a real host exists, and every host bug would look like an editor bug.

**Independent Test**: Open the fake host page in a development build; load a sample, move a card, simulate an outside change, and read the log. Build for production: the fake host page is not in the output.

**Acceptance Scenarios**:

1. **Given** a development build, **When** the developer opens the fake host page, **Then** they can load a deck, change the scheme and abilities, simulate outside changes and the host taking or refusing files, and see each message both ways.
2. **Given** a production build, **When** its output is inspected, **Then** the fake host page is absent.

---

### Edge Cases

- **Messages from anyone but the host**: the editor accepts messages only from the program that embedded it and ignores anything else (another frame, a script in a linked page); the host side likewise accepts messages only from its editor frame.
- **A message the editor does not understand** (unknown type, malformed fields): ignored and noted in the developer console; it never crashes the editor or changes the deck.
- **The host never answers "ready"**: the editor shows a loading state, then after a short wait a plain message that the host did not send a file; it does not invent a deck.
- **The host sends the file twice at start** (a race in the host): the second is treated as an outside change and merged; nothing is sent back if it equals the first.
- **An outside change arrives during a drag or while typing**: applied at once (066's rule); the gesture continues on the updated deck. No holding back in this feature.
- **The user edits while a previous file is still waiting for the host's reply**: the newest file is sent next; no save state is shown meanwhile.
- **A flush request arrives with nothing pending**: the editor confirms at once.
- **A flush request arrives while the canvas is read-only (invalid file)**: the editor confirms at once and sends nothing.
- **Very large deck** (500 components / 1,000 connectors): edits still reach the host within the bound in SC-002; the merge of an outside change stays within 066's bound.
- **A host theme the editor does not know** (anything but light or dark): the editor uses light.
- **Pictures requested but never answered**: the image stays in its loading look and then shows as missing with a reason; the rest of the deck works.
- **Several editors in one host** (two files open side by side): each frame is independent; nothing is shared between them, not even undo.
- **Background work inside the frame** (layout, large imports): keeps working inside the host's frame; if the host forbids it, the editor falls back to doing it more slowly rather than failing.

## Requirements _(mandatory)_

### Functional Requirements

**Protocol**

- **FR-001**: There MUST be one documented message protocol between the editor and a host, with a version number. Every message type, its fields and its direction MUST be listed in one place that host authors can read.
- **FR-002**: The editor MUST announce that it is ready; the host MUST then send the start message with the deck file, colour scheme, host abilities and protocol version.
- **FR-003**: If the host's protocol version is not one the editor supports, the editor MUST show a plain message naming which side needs an update and MUST NOT show or edit the deck.
- **FR-004**: The editor MUST accept messages only from the program that embedded it, and MUST ignore unknown or malformed messages without changing the deck.
- **FR-005**: Both sides MUST be able to check every message against the documented shapes with one shared description, so the editor and every host agree on the contract.

**Loading and theme**

- **FR-006**: The editor MUST show the deck from the start message; an empty file MUST open as an empty deck; an invalid file MUST show its problems, show no partial deck, and send nothing back.
- **FR-007**: The editor MUST use the host's colour scheme (light or dark) and MUST follow scheme changes the host reports while open, without reloading the deck.

**Sending edits**

- **FR-008**: After each change to the open deck that is not an outside change, the editor MUST send the host the complete deck file, batched so that a burst of edits results in one message carrying the latest state, sent within 200 ms of the last edit in the burst.
- **FR-009**: Files sent to the host MUST be valid deck files in the same canonical form as an export, so the file on disk stays readable and diffable.
- **FR-010**: When the host asks for the latest changes (before saving or closing), the editor MUST send any pending file at once and then confirm it is done.
- **FR-011**: The editor MUST NOT show a "Saved" state in a host (saving to disk is the host's to show). It MUST show an error with the host's reason when the host refuses a file, or when the host has not taken a sent file within a short wait, and MUST clear it when the host takes a later file.

**Outside changes**

- **FR-012**: When the host reports a changed file, the editor MUST merge it into the open deck using 066's merge, so selection, viewport and the user's undo history are kept and the outside change is not a user undo step.
- **FR-013**: The editor MUST NOT send a file back as a result of merging an outside change, and MUST ignore an incoming file equal to the last file it sent.
- **FR-014**: When the host reports an invalid file, the editor MUST keep the deck as it was, show a notice with the problems, and make the canvas read-only (sending nothing) until the host reports a valid file.

**Pictures**

- **FR-015**: When the host says it can store pictures, the editor MUST hand each new picture's id, type and bytes to the host, MUST write the relative path the host answers with into that picture's entry (no embedded bytes, as defined by 068), MUST keep the picture embedded and report the host's reason if the host fails to store it, MUST ask the host by id for pictures it lacks, and MUST show a picture the host reports as missing with the missing-picture look and a reason.
- **FR-016**: When the host cannot store pictures, the editor MUST keep pictures inside the deck file it sends.

**Host abilities**

- **FR-017**: The editor MUST hide or disable every action that needs a host ability the host did not declare (open links, save exported files, store pictures), the same way it handles missing browser features.
- **FR-018**: Opening a link MUST go through the host when the host can open links; the editor's frame MUST NOT navigate away from the editor.
- **FR-019**: Exporting a file (image, document, deck copy) MUST go through the host when the host can save files.

**What the embedded editor leaves out**

- **FR-020**: The embedded editor MUST show only the open deck's screen. It MUST NOT include or show the deck library, home screen, "new deck", "open deck" or "import deck file" controls; Mermaid MUST be available only by pasting text into the open deck (no file chooser). It MUST NOT store decks or pictures in browser storage.
- **FR-021**: The embedded editor MUST NOT register an offline cache, MUST NOT load or start telemetry, and MUST NOT make any network request; everything it needs is bundled.
- **FR-022**: The web app at its usual address MUST keep working exactly as before (library, storage, offline use, telemetry settings).

**Fake host**

- **FR-023**: Development builds MUST include a fake host page that loads the embedded editor and lets a developer choose a deck (sample or pasted), the colour scheme and the host abilities, simulate an outside change, simulate the host taking or refusing a file, and see every message in both directions.
- **FR-024**: Production builds MUST NOT contain the fake host page.
- **FR-025**: Automated tests MUST exercise the protocol through the same fake-host contract (load, edit, outside change, echo, invalid file, flush, version mismatch, missing abilities).

### Key Entities

- **Host**: a program that embeds the editor in a frame and owns the deck file on disk (dirty state, save, backup). Examples later: a code editor (069), a notes app (070); now: the fake host.
- **Embedded editor**: the deck editor without library, storage, offline cache or telemetry; one per frame, one deck per editor.
- **Start message**: deck file contents, colour scheme, host abilities, protocol version.
- **Host abilities**: what the host can do — open links, save exported files, store and return pictures. Anything not listed is treated as unavailable.
- **File changed (editor → host)**: the complete deck file after the user's edits, batched.
- **Outside change (host → editor)**: the complete deck file after a change made outside the editor.
- **Flush**: the host's request for all pending edits, answered by the editor's confirmation.
- **Change reply**: the host's reply to a sent file: taken, or refused with a reason. It says nothing about saving to disk.
- **Picture messages**: hand a picture to the host (answered with its relative path, or a failure); ask the host for a picture; the host's answer (bytes, or missing).
- **Protocol version**: a number both sides state; a mismatch stops the editor with a clear message.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A deck loaded through the fake host shows on the canvas within 1 second of the host sending the file, for every sample deck.
- **SC-002**: After a single edit, the host receives a complete, valid deck file within 200 ms in 100% of test runs, including on a 500-component / 1,000-connector deck.
- **SC-003**: In 100% of tested outside changes, the user's selection and viewport are unchanged and zero files are echoed back to the host.
- **SC-004**: In 100% of tested invalid outside files, the deck is unchanged and zero files are sent to the host until a valid file arrives.
- **SC-005**: Loading and using the embedded editor through the fake host (load, edit, outside change, export, pictures) produces zero network requests.
- **SC-006**: The embedded editor's delivered code contains no deck library, browser deck storage, offline cache or telemetry code; the web app's behaviour and its existing checks are unchanged.
- **SC-007**: A host author can build a working minimal host from the protocol document alone (validated by the fake host being written against that document only).

## Assumptions

- **H1 decided** (Clarifications): the editor runs in a frame in every host. Mounting the editor directly into a host's page is out of scope.
- **Undo follows 066 as implemented**: an outside change is merged and is not an undo step (066 replaced the draft's "one undo step"). The backlog's architecture note on undo is superseded by the 066 spec.
- **No holding back outside changes**: they are applied when they arrive, even mid-gesture (066 clarification). A host that wants to delay them may do so on its side.
- **Read-only while the file is invalid** (confirmed in Clarifications): chosen so that a user typing JSON in a text editor next to the canvas never has a half-finished edit overwritten. The host shows the text; the editor only explains.
- **Whole file, not edit streams**: the editor sends the whole deck file, not low-level document updates, because hosts store text and the file must stay readable and diffable (backlog architecture).
- **Picture placement on disk is the host's choice** and is 069/070's work; this feature carries picture bytes between editor and host and records the path the host answers with (Clarifications). Pictures that point at a file (068) are shown when the host returns their bytes by id.
- **No real host ships here**; 069 (code editor) and 070 (notes app) build on this. Package docs and the repo map are updated with the new protocol package (backlog in-scope list).
- **Testing**: unit and component tests against the fake-host contract; no new end-to-end tests (constitution Principle VI); the existing smoke suite, including the no-third-party-requests check, keeps passing.
- **No new runtime dependency** is expected; any one found necessary during planning is asked first.
- **Dependencies**: 066 (merged). The picture part (User Story 4, FR-015) depends on 068 (picture paths in the file format); the rest can be built in parallel with 068.
- **Out of scope**: real host integrations (069, 070), picture paths in the file format itself (068), three-way merge or conflict prompts, the local agent bridge (065), editing several decks in one frame.
