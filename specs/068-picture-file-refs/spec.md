# Feature Specification: Pictures that point at a file next to the deck

**Feature Branch**: `068-picture-file-refs`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "068" — backlog entry `docs/backlog-3.md` § 068-picture-file-refs, with founder decision H2 (2026-10-07: "Host decides; file can reference"): "Let a picture in a Sododeck file either embed its bytes (as today) or point at an image file relative to the deck file, so editors that keep decks in a folder can store pictures as separate files. Exactly one of the two must be present. Existing files stay valid and unchanged; the web app keeps embedding pictures and shows a pointed-at picture it cannot read as missing, with the reason. Out of scope: reading those files in the web app."

## Context

Since 055, a deck file carries every picture it shows as embedded text (base64) inside the file. That works for the web app, where a deck is one file to download. It works badly for a deck that lives in a folder next to code or notes (the editor hosts of backlog 3: a code editor, a notes app):

- One screenshot can make the deck file several megabytes, so diffs and reviews of the deck become unreadable.
- The same picture cannot be shared with the rest of the project (a README, a note).
- An AI agent writing the deck cannot simply refer to an existing image in the repository.

Founder decision H2: the host decides where pictures live, and the file format allows a picture to **point at an image file relative to the deck** instead of embedding it. This feature changes only the file format and how the web app and the deck tooling treat such a picture. Reading the pointed-at file is the hosts' job (069, 070).

## Clarifications

### Session 2026-10-07

- Q: May a picture path leave the deck's folder (`../Attachments/x.png`), e.g. for a notes app's shared attachment folder? → A: Yes, through leading `..` segments. Hosts must refuse any path that resolves outside their workspace or vault; the web app never reads pointed-at files.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A deck can point at a picture file (Priority: P1)

A person (or an AI agent) writes a deck that lives in a project folder. Instead of embedding a screenshot, the deck's picture entry names the image file next to it, for example `diagrams/assets/login.png`. The deck is a valid Sododeck file: it passes validation in the app, in the bundled AI skill's checker, and in any tool that uses the published format description.

**Why this priority**: Everything else in this feature, and the folder-based hosts (069, 070), depend on the format accepting this form.

**Independent Test**: Take a valid deck with one image and replace the picture's embedded data with a relative path. The file validates with no problem. Put both an embedded data and a path in the same entry: validation reports exactly one clear problem on that entry.

**Acceptance Scenarios**:

1. **Given** a deck whose picture entry has a relative path and no embedded data, **When** it is validated, **Then** it is valid.
2. **Given** a picture entry with both embedded data and a path, **When** it is validated, **Then** it is invalid with one problem that names the entry and says to keep only one of the two.
3. **Given** a picture entry with neither embedded data nor a path, **When** it is validated, **Then** it is invalid with one problem that says one of the two is required.
4. **Given** a path that is absolute, uses backslashes, is a web address, is empty, or has a `.` or empty segment or a `..` after a folder name, **When** it is validated, **Then** it is invalid with a problem that says what is wrong with the path. A path starting with `../` segments is valid.
5. **Given** every existing example and test deck, **When** validated and opened, saved and reopened, **Then** nothing changes (the files are byte-identical).

---

### User Story 2 - The web app opens such a deck without failing (Priority: P1)

A person opens, in the web app, a deck that came from a project folder and points at picture files. The web app has no access to that folder. The deck opens, and every other object is there. Each pointed-at picture shows as a missing picture, with a reason the person understands: the picture is kept as a separate file next to the deck, named by its path, and the web app cannot read it.

**Why this priority**: People will move decks between a code editor or notes app and the web app. A deck that refuses to open, or loses its pictures without saying why, would break trust in both.

**Independent Test**: Import a deck with one pointed-at picture into the web app. It opens without an error. The image shows the missing-picture look, and its reason names the path (for example "Saved as a separate file: diagrams/assets/login.png"). The import's problem list includes the same explanation.

**Acceptance Scenarios**:

1. **Given** a deck with pointed-at pictures, **When** it is imported into the web app, **Then** the import succeeds and every other object is present.
2. **Given** an opened deck with a pointed-at picture, **When** the person looks at that image on the canvas, **Then** it shows as missing, and its reason (on the canvas and in the image's details) says it is a separate file and names the path.
3. **Given** the import's problem list, **When** a deck with pointed-at pictures is opened, **Then** each such picture is listed once, as information (not an error), with the same reason.
4. **Given** a deck with pointed-at pictures, **When** it is checked with the AI skill's bundled checker, **Then** it reports no error for those pictures.

---

### User Story 3 - The reference survives a round trip through the web app (Priority: P1)

A person opens a deck that points at picture files, edits other things (moves a card, adds a note), and exports or saves it. The exported file still points at the same picture files: the reference is not dropped, not replaced by a broken embedded picture, and not changed.

**Why this priority**: Today a picture without bytes is written back as a broken embedded picture. Applied to pointed-at pictures, that would destroy the reference the first time the deck passes through the web app, and the deck would then be broken in the code editor or notes app too.

**Independent Test**: Import a deck with a pointed-at picture, move another card, export. The exported file's picture entry has the same path and its other facts (type, size, dimensions, name) unchanged, and no embedded data.

**Acceptance Scenarios**:

1. **Given** an opened deck with a pointed-at picture, **When** it is exported or copied as a file, **Then** the picture entry keeps its path and facts and has no embedded data.
2. **Given** a pointed-at image copied and pasted inside the same deck, **When** the deck is exported, **Then** both images use the same pointed-at picture entry.
3. **Given** a deck with both embedded and pointed-at pictures, **When** it is exported, **Then** each picture keeps its own form.
4. **Given** a pointed-at picture whose last image is deleted, **When** the deck is exported, **Then** the entry is dropped like any unused picture.

---

### User Story 4 - Pictures added in the web app keep embedding (Priority: P2)

A person adds a new picture in the web app (paste, drop, upload). It is embedded in the deck as today. Nothing in the web app writes a path.

**Why this priority**: It keeps the web app's one-file promise (one download carries everything) and confirms the change is additive.

**Independent Test**: Add a picture in the web app and export. The new entry has embedded data and no path.

**Acceptance Scenarios**:

1. **Given** the web app, **When** a picture is added and the deck is exported, **Then** the picture is embedded and has no path.

---

### Edge Cases

- **The same picture is both embedded and pointed at by two different entries** (two ids): allowed. They are two entries. A host may later merge them; the web app does not.
- **Path case and spelling**: the path is kept exactly as written. Two entries whose paths differ only by case are two different references.
- **A path with spaces or non-Latin letters** (`assets/Ảnh chụp 1.png`): allowed, kept as written.
- **A path into a sub-folder or out of the deck's folder** (`assets/icons/logo.svg`, `../../Attachments/logo.svg`): both are valid in the file. A host refuses to read any path that resolves outside its workspace or vault (069, 070); the web app never reads either.
- **Picture facts disagree with the file on disk** (the host finds a different size or content than the entry says): outside the web app's reach. The web app trusts the stored facts for layout and shows the picture as missing. What a host does when the file on disk changed is decided in 069 / 070.
- **Picture id rule**: the id stays the fingerprint of the picture's bytes, as defined in 055. The web app cannot check it for a pointed-at picture and does not try.
- **A deck that points at pictures is merged as an outside change (066)**: the reference is kept like any other picture entry, and no bytes are expected.
- **Older app versions**: a deck with pointed-at pictures is refused by an app built before this feature, with the existing validation message. This is acceptable because the web app always runs the latest version.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The file format MUST allow a picture entry to carry either embedded data or a relative path to an image file. Exactly one of the two MUST be present.
- **FR-002**: An entry with both, or with neither, MUST be invalid, with one problem per entry that names it and says how to fix it.
- **FR-003**: A path MUST be relative to the folder of the deck file, use forward slashes, be non-empty, and MUST NOT be absolute, start with a drive letter or a slash, contain a scheme (`http:`, `file:`, `data:`…), or contain `.` or empty segments. `..` segments are allowed only as a leading run (`../../Attachments/x.png`), never after a folder name. Each violation MUST give a problem that says what is wrong.
- **FR-004**: All other picture facts (type, stored size, width, height, name) and the picture id rule stay required and unchanged for both forms.
- **FR-005**: Every existing valid file MUST stay valid, and MUST be written back byte-identical after opening and saving.
- **FR-006**: The published format description, the app's validation, and the AI skill's bundled checker MUST agree on which files are valid (existing parity checks extended to the new form).
- **FR-007**: The web app MUST open a deck with pointed-at pictures without refusing it, and MUST show each such picture as missing, with a reason that says it is a separate file and names its path. The reason MUST appear on the canvas image and in the image's details.
- **FR-008**: The web app's import problem list MUST list each pointed-at picture once, as information, with the same reason.
- **FR-009**: Exporting, saving, copying the deck as a file and copying images inside a deck MUST keep each pointed-at picture's path and facts unchanged, and MUST NOT write embedded data for it.
- **FR-010**: Pictures added in the web app MUST keep being embedded. The web app MUST NOT create a path.
- **FR-011**: The deck model MUST keep a pointed-at picture's path through every operation that keeps picture facts today (open, save, export, outside-change merge from 066, clipboard), and MUST report it to callers so a host can read the file.
- **FR-012**: The web app MUST NOT try to read, fetch or look up a pointed-at file in any way (no network request, no file access).
- **FR-013**: The format change MUST be recorded in a decision record, with the reasons and the compatibility note for older app versions.
- **FR-014**: Hosts that read pointed-at files (069, 070) MUST refuse a path that resolves outside their workspace or vault. This feature records the rule; the hosts implement it.

### Key Entities

- **Picture entry**: what the deck stores about one picture, under its id (the fingerprint of its bytes): type, stored size, width, height, original name, and **either** the embedded bytes **or** a relative path to the image file.
- **Pointed-at picture**: a picture entry with a path. The web app shows it as missing with a reason. A host reads the file.
- **Picture reason**: why a picture shows as missing. It gains the new kind "separate file", alongside the existing kinds for damaged pictures.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of existing example and test decks are still valid and are written back byte-identical.
- **SC-002**: A deck with a pointed-at picture opens in the web app in 100% of test cases, with every other object present and the picture's reason naming its path.
- **SC-003**: After open → edit something else → export in the web app, 100% of pointed-at picture entries are unchanged (path and facts) in the exported file.
- **SC-004**: The format description, the app's validation and the AI skill's checker give the same valid / invalid verdict on 100% of the new test cases (both forms, both present, neither present, each bad path kind).
- **SC-005**: A deck whose pictures are all pointed at is at least 90% smaller than the same deck with embedded pictures, for a deck with one 200 KB screenshot.
- **SC-006**: Opening a deck with pointed-at pictures in the web app makes zero network requests and zero file-access prompts.

## Assumptions

- **Path base**: the path is resolved against the folder that holds the deck file. Leading `..` segments may leave that folder, for a notes app's shared attachment folder (founder, 2026-10-07). The file format cannot know the workspace or vault root, so keeping reads inside it is the host's rule: 069 and 070 MUST refuse a path that resolves outside their workspace or vault.
- **No format version bump**: the change only adds an alternative form, so files without paths are unchanged. Like 055 (additive, no bump), the format stays at version 1, and older app builds refusing such files is accepted (the web app always serves the latest build).
- **The web app does not read pointed-at files** (no folder access) and offers no way to turn a reference into an embedded picture in this feature. Replacing a missing picture by hand stays as it is today.
- **Picture reasons in the UI** use plain words ("Saved as a separate file: <path>"), in the existing missing-picture look, and in the image's details panel. The exact wording is settled at planning time against DESIGN.md.
- **The picture id stays the fingerprint of the bytes** for pointed-at pictures; a host computes it when it creates the entry and may verify it when it reads the file (069, 070).
- **Out of scope**: reading pointed-at files in the web app; host behaviour (where to save, what to do when the file changed: 069, 070); converting between the two forms; the `.sododeck.md` wrapper.
- **Dependencies**: 055 (pictures) and 057 (picture editing), both merged. Independent of 066 and 067. If 066 merges first, its outside-change merge must keep the path (FR-011); this feature adds that case to 066's round-trip corpus.
