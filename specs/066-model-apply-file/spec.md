# Feature Specification: Apply a changed deck file to an open deck

**Feature Branch**: `066-model-apply-file`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "066" — backlog entry `docs/backlog-3.md` § 066-model-apply-file: "Add a way to merge a changed Sododeck file into an already open document. When the deck file is changed outside the editor (another program, a version-control pull, a text edit), the open document is updated in place: only objects and fields that differ change, matched by their stable ids, so the user keeps their selection, viewport and undo history, and the change itself is not undoable. An invalid incoming file is refused with its problems and the document stays as it was. Out of scope: three-way merge, conflict UI, any host integration."

## Context

Backlog 3 (editor hosts, 066–070) lets a deck open inside other programs (a code editor, a notes app) as a plain `.sododeck` file. There the file on disk is the store, and it can change while the deck is open: a version-control pull, a text edit of the JSON, an AI agent rewriting the file, a sync from another device.

Today the only way to take in a file is to load it as a new document. That throws away everything the user had in the open deck that is not in the file: what is selected, where the canvas is scrolled and zoomed, and the undo history. A user who has an agent update a deck while looking at it would see the canvas jump, lose the selection, and be unable to undo their own last edit.

This feature is the foundation for 067 (the host protocol): a document-level operation that takes the new file and changes only what differs. It has no user interface of its own; its users are the editor surfaces and, through them, the person looking at the deck.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - An outside change appears in place (Priority: P1)

A user has a deck open. Something outside the editor changes the deck file (for example an AI agent renames a component and adds a connector). The open deck updates to match the file: the renamed component shows its new title and the new connector appears, while everything else on the canvas stays exactly where it was. The canvas does not jump, the selection stays, nothing flickers.

**Why this priority**: This is the whole point of the feature and the base of every host integration (067–070). Without it, any outside change forces a full reload.

**Independent Test**: Open a sample deck, select a component, then apply a copy of the same file where one other component has a new title. Only that title changes; the selected component is still selected, the viewport is unchanged, and observers see a change for that one object only.

**Acceptance Scenarios**:

1. **Given** an open deck and the same file with one component renamed, **When** the file is applied, **Then** only that component's title changes, every object keeps its id, and no other object reports a change.
2. **Given** an open deck and a file that adds a connector and removes a sticky note, **When** the file is applied, **Then** the connector exists with the file's id and fields, the note is gone, and untouched objects report no change.
3. **Given** an open deck and a file that changes one field of a nested item (a flow step's text, a rule row's cell, a table column's type), **When** the file is applied, **Then** only that nested item reports a change, naming that field.
4. **Given** an open deck and a file that moves one item within an ordered list (a flow step, a rule row, a table column, a saved view), **When** the file is applied, **Then** the open deck's list has the file's order and items that did not move report no change.
5. **Given** an open deck and a file equal to the deck as it is now, **When** the file is applied, **Then** nothing is written and no change is reported at all.
6. **Given** any two decks A and B from the test corpus, **When** B is applied to an open deck of A, **Then** writing the open deck out produces B exactly (same content, same order).

---

### User Story 2 - Undo still means "my last edit" (Priority: P1)

A user moves a card, then an outside change arrives and is applied, then the user presses undo. The card moves back; the outside change stays. Redo, the undo grouping of a typing burst, and the rest of the user's history behave as if the outside change were not a user step.

**Why this priority**: Losing or corrupting undo history is the second thing that makes a full reload unacceptable. An outside change that the user could "undo" would silently put the file back out of step with disk.

**Independent Test**: Make two user edits, apply a file with an unrelated change, press undo twice. Both user edits are undone in reverse order; the applied change is still in the deck after both undos and after redo.

**Acceptance Scenarios**:

1. **Given** a user edit followed by an applied change on another object, **When** the user presses undo, **Then** the user's edit is undone and the applied change is not.
2. **Given** an applied change and no earlier user edit, **When** the user checks whether undo is available, **Then** it is not (the applied change added no undo step).
3. **Given** a user edit to a field, then an applied change that rewrote the same field, **When** the user presses undo, **Then** the applied value stays (the outside change wins) and the undo step is spent without an error.
4. **Given** a typing burst in progress on a component's title, **When** a change to another object is applied in the middle of it, **Then** the burst stays one undo step.

---

### User Story 3 - A broken file is refused, not half-applied (Priority: P1)

The deck file on disk becomes invalid: a hand edit leaves a dangling reference, a duplicate id, a missing required field, a format version the editor does not know, or it is not even a deck. Applying it leaves the open deck exactly as it was and returns the list of problems, so the caller can tell the user why the outside change was not taken.

**Why this priority**: A text edit or a half-finished agent write can leave the file broken at any moment. Applying part of it would corrupt the open deck, and the next save would write the corruption back to disk.

**Independent Test**: Apply a file with a connector naming a component that does not exist. The call reports a refusal naming that problem; the open deck, its undo history and its observers see no change.

**Acceptance Scenarios**:

1. **Given** an open deck and an incoming file that fails format validation, **When** it is applied, **Then** it is refused with the same problem list a file import reports, and the deck is unchanged.
2. **Given** an incoming file with a duplicate id in a collection, **When** it is applied, **Then** it is refused naming the duplicate, and the deck is unchanged.
3. **Given** an incoming file that is not valid JSON or not a deck, **When** it is applied, **Then** it is refused with one clear problem, and the deck is unchanged.
4. **Given** a refused file, **When** the user keeps editing, **Then** their edits and undo history are unaffected.

---

### User Story 4 - Pictures in an outside change (Priority: P2)

An outside change adds a picture (an image object with its embedded bytes) or replaces one. The new picture's bytes are handed back to the caller to store, the same way loading a file does, and a picture whose embedded data is damaged is applied as a missing picture with a reason, never refusing the whole file.

**Why this priority**: Pictures (055) are part of the file, so the round-trip guarantee needs them, but the most common outside changes (agent edits, version-control pulls of structure) do not touch pictures.

**Independent Test**: Apply a file that adds one image with valid embedded bytes. The image appears, and the result carries that picture's bytes under its id; applying a file whose picture data is damaged returns the picture problem and still applies everything else.

**Acceptance Scenarios**:

1. **Given** an incoming file with a new picture, **When** it is applied, **Then** the image object exists and the result carries the picture's bytes by id.
2. **Given** an incoming file whose picture data is damaged, **When** it is applied, **Then** the rest of the file is applied, the picture is kept as missing, and the result lists the picture problem.
3. **Given** an incoming file whose pictures carry no bytes (empty data) for pictures the open deck already has, **When** it is applied, **Then** the open deck keeps those pictures and reports no picture change.

---

### Edge Cases

- **Deck meta and settings change** (title, packs, dialect, grouping mode, canvas background): applied field by field like any object; unchanged settings report no change.
- **An object the user has selected is removed by the file**: it is removed; keeping the selection valid is the surfaces' job (they already drop ids that no longer exist).
- **The user is in the middle of a gesture** (dragging, resizing, drafting a note) when a file is applied: the change is applied at once; the gesture continues on the updated deck and stays one undo step. Deciding whether to delay an outside change until the gesture ends is the host's choice (067).
- **The file changes saved views** (positions, collapsed groups, focus): applied like other data. Positions live in views, so a moved card moves. The live viewport (scroll and zoom) is not in the file and is untouched.
- **An object changes kind** (a removed id reused for a different object in another collection): treated as a removal from one collection and an addition to the other; ids are unique per collection, so this is allowed.
- **Locked objects**: the lock is a user rule against accidental edits, not against the file; an applied change can move, edit or remove a locked object, and can lock or unlock it.
- **Keys the deck stores but the file leaves out** (optional fields): a field present in the deck and absent from the file is removed.
- **A file from an older layout** that loading already upgrades (legacy notes, older file name): applied after the same upgrade loading performs, so the result equals loading that file.
- **Very large change** (most of a 500-component deck replaced): applied in one step; may take longer than a small change but stays within the bound in SC-003.
- **Applying the same file twice in a row**: the second call writes nothing and reports no change (supports the echo rule in 067).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The deck model MUST offer one operation that takes an open deck and an incoming deck file and updates the open deck so that it equals the incoming file.
- **FR-002**: The operation MUST match objects by their stable id within each collection and nested list (components, groups, connectors, notes, images, flows and their steps and branches, rules and their inputs, outputs and rows, saved views, features, table columns, indexes, checks, enums and their values, and deck settings).
- **FR-003**: For a matched object, the operation MUST write only the fields whose value differs; equal fields MUST NOT be written.
- **FR-004**: Objects present in the open deck and absent from the file MUST be removed; objects present only in the file MUST be added with the file's id and fields.
- **FR-005**: Where the file format gives a list a meaningful order, the open deck MUST end with the file's order, moving only items whose position must change.
- **FR-006**: All writes of one application MUST happen in a single atomic step: observers see either the deck before or the deck after, with one change notification.
- **FR-007**: When the incoming file equals the open deck, the operation MUST write nothing and emit no change notification.
- **FR-008**: The caller MUST pass an origin for the change; observers MUST be able to tell an applied file apart from the user's own edits, undo and redo.
- **FR-009**: An applied change MUST NOT be recorded in the user's undo history, MUST NOT end or split an undo group in progress, and MUST NOT be reverted by undo or redo (same rule as storage loads today).
- **FR-010**: The incoming file MUST be validated exactly as a file import is (format, duplicate ids, references, version). An invalid file MUST be refused with the problem list, and the open deck, its undo history and its observers MUST see no change.
- **FR-011**: Older file layouts MUST be upgraded the same way loading upgrades them before comparing, so applying a file gives the same deck as loading it.
- **FR-012**: The operation MUST return a result that says whether the file was applied or refused, the problems (for a refusal, or for damaged pictures), the bytes of pictures the file carries, and a summary of what changed (counts of added, changed and removed objects).
- **FR-013**: Damaged picture data MUST NOT refuse the file; such a picture is applied as missing and reported, as on load. A picture entry without bytes MUST NOT remove the bytes of a picture the open deck already has.
- **FR-014**: Writing the open deck out after applying file B MUST produce B, byte for byte in canonical form, for every deck in the test corpus applied over every other deck.
- **FR-015**: Ids MUST be preserved: no object that is in both the open deck and the file gets a new id, and no id is derived from content.
- **FR-016**: The operation MUST work without a user interface and without the app (it belongs to the deck model, usable from a worker or a test).

### Key Entities

- **Open deck**: the live document the editor shows; the single source of truth while the deck is open. Holds objects by collection, ordered lists and deck settings.
- **Incoming file**: a complete deck file (the `.sododeck` format) that arrived from outside the editor. It wins field by field; there is no common base version.
- **Apply result**: applied or refused; problems; picture bytes by id; change summary (added / changed / removed counts per collection).
- **Apply origin**: a marker the caller passes so observers can recognise the change and the undo history ignores it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For 100% of pairs of decks in the test corpus, applying deck B over an open deck A and writing it out yields exactly B.
- **SC-002**: Applying a file that changes one field reports a change for exactly one object (zero for others) in 100% of test cases, so a user sees only that object update.
- **SC-003**: On a 500-component / 1,000-connector deck, applying a file with one changed field completes in under 50 ms, and applying a file where every object changed completes in under 1 second, on the benchmark machine.
- **SC-004**: In 100% of tested sequences (user edit, applied change, undo, redo), undo and redo affect only the user's edits, and an applied change never makes the undo control available on its own.
- **SC-005**: In 100% of tested invalid files, the open deck after the refused apply is identical to the deck before, and no change notification is sent.

## Assumptions

- **No three-way merge.** The incoming file wins field by field over the open deck. Unsaved edits the user made to a field the file also changed are overwritten by the file's value. Preventing that (dirty state, conflict prompts) is the host's job in 067–069.
- **Field granularity.** A changed text field is written as a whole new value; character-level merging of a text the user is typing at the same moment is not required.
- **Selection and viewport live outside the deck** (in the editor's UI state), so keeping ids stable and not reloading the document is what keeps them. This feature changes no surface; 067 wires surfaces to it.
- **Origin reporting.** Observers already distinguish local edits, undo, redo and anything else; an applied file is reported as "not a local edit" through the caller's origin. Whether the model adds a dedicated origin kind is a planning decision.
- **View repair.** After an applied change the existing repair of view entries that name nothing runs as for any change that is not the editor's own, untracked, and the result still equals the file (the file itself is validated, so it has no such entries).
- **Performance is measured** with the benchmark deck generator already used for the canvas (`pnpm bench`'s 500 / 1,000 deck).
- **No new runtime dependency**, no network, no user interface: this is a model-only feature with unit and round-trip tests (constitution: no new e2e tests).
- **Out of scope**: three-way merge with a common base, conflict UI, reading or watching files, any host integration (067–070), picture files referenced by path (068).
- **Dependencies**: none beyond what is merged (002 model, 055 pictures, 040 database schema model, 041/048 database fields).
