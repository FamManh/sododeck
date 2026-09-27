# Feature Specification: Sticky Notes and Command Palette

**Feature Branch**: `009-stickies-search`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "009 (stickies-search) from docs/backlog.md. Let users put sticky notes on the diagram for reminders and open questions, either free on the canvas or attached to a component so the note moves with it; notes support simple markdown and can be edited, resized and deleted. Add a command palette opened with Cmd/Ctrl+K that finds any component, connection, flow, rule or note by title or by text in descriptions, notes and rule cells, and also runs common commands (export, switch theme, focus mode, open rules, go to the library, new deck). It is fully keyboard driven and fast on large decks. Why: knowledge is only useful if it can be found, and annotations need a home on the diagram."

**Sources**: `docs/backlog.md` §009 (scope, acceptance criteria, risks), `docs/spec.md` §7 (K-3 sticky notes, K-4 global search, C-3 command palette), `docs/design/design-analysis.md` §a (states 14, 30, 31, 32, 62, 63), §g-11 and §g-19 (confirm deletes, then Undo toast), §g-21 (sticky `collapsed` and show-in-flows are document data; the deck-wide "Notes" switch is a UI preference), §g-30 (dimmed notes must not rely on opacity alone), `docs/design/screens/` (light and dark), `specs/002-yjs-model/spec.md` (FR-005, FR-006, FR-017: sticky operations and deleted anchors), `specs/003-canvas-basic/spec.md` (palette, canvas selection, confirm-delete dialog, undo units), `specs/006-flow-authoring/spec.md` ("show flow F with step S selected"), `specs/007-flow-playback/spec.md` (flow mode, current step; lists sticky dimming as 009), `specs/008-inspector-rules/spec.md` (inspector shell, markdown Write / Preview, rule editor), constitution v1.0.0 (principles I–VIII).

**Dependency note**: 009 depends on 008, merged on `main` (`324d1bd`). It reuses 008's inspector shell and markdown Write / Preview field, the rule editor (opened from palette results) and 006's "show flow F with step S selected". 007 (flow playback) is merged on `main` (`b519550`); User Story 4 builds on its flow mode (open flow outside a recording session, view-only canvas, current step with its from/to components, dim timing token). The founder's Q2 decision deferred User Story 4 until 007 merged; the review against 007 as implemented was done on 2026-09-28 (see Clarifications), and User Story 4 is now in scope. The file format already has `stickies` (id, text, color, anchor, position); this feature adds two optional fields to a sticky, `collapsed` and `showInFlows` (§g-21), as an additive, non-breaking change.

## Scope

**In scope**

- **Sticky notes** (design 62):
  - An amber-soft note card, fixed 180 px wide, showing its text as simple markdown (the same subset and safety rules as 008's description preview).
  - Add a note from the left palette (STRUCTURE › Note, design 14) by dragging: dropped on a component it is pinned to that component; dropped on empty canvas it is free. Add a note with **N** at the pointer (free, or pinned when the pointer is over a component).
  - Edit the text in place on the card and in the sticky inspector (TEXT · MARKDOWN with Write / Preview, ANCHOR Free / Pinned to node, PINNED TO, DISPLAY Expanded / Collapsed, "Stay visible during flows").
  - Move a note by dragging; a pinned note keeps its offset from its component and moves with it; pin, re-pin and unpin from the inspector.
  - A pinned note shows a dotted leader line and a pin to its component.
  - Collapse / expand (one line + chevron; ⌥C on the selected note).
  - A new note left empty is removed when it loses focus.
  - Delete with confirmation (§g-11), then an Undo toast (§g-19); ⌘Z also restores it.
  - Notes appear in the outline and are selectable from it.
  - Two new optional note fields in the file: `collapsed` and `showInFlows` (additive schema change with fixtures, validator parity and round-trip tests).
- **Notes in flow mode** (design 63): the "Stay visible during flows" flag; while a flow is open in flow mode, notes are dimmed to 35% except those pinned to a component of the current step or marked "Stay visible during flows"; dimmed notes also get a non-color cue; notes are view-only in flow mode like the rest of the canvas; a "Notes: dimmed / shown / hidden" switch next to Labels in the canvas toolbar (flow mode only); a "NOTES ON THIS STEP" section in the step inspector listing the notes pinned to the current step's components.
- **Command palette** (design 30, 31, 32): opened with ⌘K / Ctrl+K or the top-bar "Jump to… ⌘K" field; searches the open deck's components, connections, flows, flow steps, rules and notes by title and by text in descriptions, step conditions and notes, sticky text and rule cells, with a snippet line for body matches; lists commands (export, switch theme, focus mode, open rules, go to the library, new deck); results show their kind; ↑ / ↓ move, Enter opens the highlighted result (the first one by default), Esc closes; "No results" for no matches.

**Out of scope**

- Resizing notes: the design fixes the width at 180 px, so resize is deferred (backlog §009) even though the input mentions it.
- Note colors other than the default amber in the UI (the file field `color` is kept and shown, but no color picker).
- Pinning notes to connections, groups, flows or steps from the UI (the file may already hold such anchors; they are kept, see Edge Cases).
- Comments and threads (P1), glossary (P1).
- Searching across decks: the library's own search (005) stays name-only; the palette searches the open deck only.
- Fuzzy / typo-tolerant search, search syntax (filters such as `kind:rule`), recent-searches history.
- Focus mode itself (010): the palette only lists commands whose feature exists.
- Showing which notes are shown or dimmed in the JSON panel's Step tab (design 63 JSON): the panel shows document data only (004).
- Playing flows (007); editing the JSON panel (still read-only); new end-to-end browser tests (constitution VI).

## Clarifications

### Session 2026-09-27

- Q: When a component with pinned notes is deleted, do the notes become free (backlog §009) or keep a broken anchor (002 FR-017)? → A: They become free notes at their last on-screen position (anchor removed, position converted to canvas coordinates), in the same undo step as the delete. This amends 002 FR-017 for notes pinned to components; notes anchored to other object types keep 002's behavior.
- Q: 007 is not on `main`; should 009 include the flow-mode behavior of notes? → A: Store "Stay visible during flows" (`showInFlows`) now; specify the dimming and the "Notes" switch against 007's spec, and build them once 007 (implemented in another session) is done, after reviewing this spec against it.

### Review against 007 as implemented (2026-09-28)

007 merged on `main` (`b519550`). Findings and the resulting spec changes:

- **Flow mode** is "a flow is open and no recording or edit session is running". Opening a flow anywhere (flow list, "Used in", connection inspector) enters flow mode at step 1 or at a given step. → Palette results follow the same rule: a flow result opens it in flow mode at step 1; a step result opens its flow in flow mode at that step (US2-6, FR-026). This resolves the open item "Opening flows from ⌘K (009)" in 007's scope.
- **The canvas is view-only in flow mode** (no drag, no handles, no deletes; clicking a dimmed object does nothing). → Notes are view-only in flow mode too: no drag, no in-card editing, no collapse toggle, N and Note drops are refused; they stay focusable and readable by keyboard (US4-2, US4-5, FR-017, FR-018b).
- **007 dims everything off the played path to 20% opacity.** Without a rule for notes, they would fall under the same dimming. → Notes follow their own rule: 35% (design 63), with the exceptions of FR-016, and never inherit the 20% path dimming.
- **The current step** has a from and to component (the current connection's ends). → "Pinned to a component of the current step" means pinned to either of them. With no current step (empty flow) or a broken current step, no note gets the exception; an empty flow dims nothing (as 007 does for components).
- **Dim timing** uses 007's dim token, which is instant under reduced motion. → Notes use the same token.
- **The canvas toolbar** holds the Labels toggle; design 63 puts "Notes: dimmed" next to it. → The Notes switch lives there, only in flow mode (FR-018).
- **Design 63's step inspector** has a "NOTES ON THIS STEP" section that 007 did not build. → Added here (US4-6, FR-018a).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Leave a note on the diagram (Priority: P1)

An architect drags a Note from the palette onto an empty area of the canvas and types "Open question: do we retry payments on timeout?". Later they press N while hovering "Order Service" and write "**Owner** moving to Platform in Q4". The second note shows a dotted leader to Order Service; when they drag Order Service across the canvas, the note follows. They collapse the first note to one line to reduce clutter.

**Why this priority**: K-3 is P0 in the product spec, and notes are the cheapest way to record open questions right where they apply.

**Independent Test**: On a deck with components (no flows or rules needed), add a free note and a pinned note, edit both, move the component, collapse a note, reload the deck and check that everything is kept; check the JSON panel after each change and undo each with one ⌘Z.

**Acceptance Scenarios**:

1. **Given** the palette, **When** the user drags Note onto empty canvas, **Then** a free note appears there in edit mode with the caret in its text; **When** it is dropped on "Order Service", **Then** the note is pinned to it and shows a dotted leader and pin.
2. **Given** the pointer over empty canvas, **When** the user presses N, **Then** a free note appears at the pointer in edit mode; **Given** the pointer over a component, **Then** the note is pinned to that component. N does nothing while typing in a text field.
3. **Given** a note in edit mode, **When** the user types markdown and leaves the note, **Then** the card shows formatted text (paragraphs, bullets, bold, italic, inline code); HTML and scripts are shown as plain text and never run.
4. **Given** a new note, **When** it loses focus while its text is empty or only whitespace, **Then** it is removed without a confirmation and without an Undo toast.
5. **Given** a note pinned to "Order Service", **When** the component is moved, **Then** the note moves with it and keeps the same offset; **When** the note itself is dragged, **Then** its offset from the component changes and it stays pinned.
6. **Given** a selected note, **When** the user presses ⌥C or its chevron, **Then** it shows one line (the first line of text, truncated) and a chevron; doing it again expands it. The state is saved with the deck.
7. **Given** a selected note, **When** the user changes ANCHOR from Free to Pinned and picks a component in PINNED TO, **Then** the note is pinned without moving on screen; **When** they switch back to Free, **Then** it becomes free without moving on screen.
8. **Given** a note pinned to "Order Service", **When** the component is deleted, **Then** the note is not lost: it becomes a free note at the same place on screen, with no leader or pin; one ⌘Z restores both the component and the pin with the original offset.
9. **Given** a selected note, **When** the user presses Delete or chooses Delete in the inspector, **Then** a confirmation dialog asks first; after confirming, the note is removed and an Undo toast appears; Undo or ⌘Z restores it with the same id, text, anchor and position.
10. **Given** notes in the deck, **When** the user opens the outline, **Then** a Notes section lists each note by its first line (or "Empty note"); choosing one selects it and brings it into view.

---

### User Story 2 - Find anything from the keyboard (Priority: P1)

A developer opens a large deck they don't know, presses ⌘K and types "reattempt". The palette lists the rule "Reattempt policy" and the flow step "Retry payment" whose condition mentions the reattempt policy, each with its kind and a snippet showing the matched text. They press Enter and the rule editor opens on that rule. Next they type "order", press ↓ twice and Enter to jump to the third result, the component "Order DB", which is selected and centered on the canvas.

**Why this priority**: K-4 and C-3 are P0: in a large deck the picture is only useful if users can get to any object in a few keystrokes.

**Independent Test**: On a sample deck with components, connections, flows, steps, rules and notes, open the palette, search for words that only appear in a title, a description, a step condition, a note and a rule cell, and check that each result appears with the right kind and snippet and opens the right place.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the user presses ⌘K (macOS) or Ctrl+K (other systems) or activates the top-bar "Jump to… ⌘K" field, **Then** the palette opens with the search field focused; pressing the shortcut again or Esc closes it and returns focus to where it was.
2. **Given** the palette is open with an empty query, **Then** it lists the available commands, then the deck's flows (design 30).
3. **Given** the query "reattempt", **When** it is typed, **Then** the rule "Reattempt policy" and the flow step whose condition mentions it are listed, each with a kind label; matches in a body (description, condition, note, rule cell) show a one-line snippet with the matched text emphasized by weight and underline, not by color alone; Enter opens the first result.
4. **Given** results, **When** the user presses ↓ twice and Enter, **Then** the third result opens; ↑ on the first result and ↓ on the last do not leave the list.
5. **Given** a query with no matches, **When** it is typed, **Then** "No results" is shown (design 32) and Enter does nothing.
6. **Given** a result, **When** it is opened, **Then**: a component, connection or note is selected and brought into view on the canvas; a flow opens in flow mode at its first step (007); a step opens its flow in flow mode at that step (007); a rule opens in the rule editor (008); and the palette closes.
7. **Given** results of several kinds, **Then** title matches are listed before body matches, and within each, results are ordered by kind (commands, components, connections, flows, steps, rules, notes) and then by title.
8. **Given** a query, **Then** matching ignores case, accents and surrounding spaces, and every word of the query must appear (in any order) for an object to match.

---

### User Story 3 - Run common commands from the palette (Priority: P2)

A user presses ⌘K, types "theme" and presses Enter; the app switches between light and dark. Then they type "export" and export the deck as a file, and "library" to go back to their decks.

**Why this priority**: commands make the palette the one keyboard entry point; each command already exists elsewhere in the UI, so this is convenience, not new capability.

**Independent Test**: With the palette open, run each listed command by name and check it has the same effect as its menu or button.

**Acceptance Scenarios**:

1. **Given** the palette, **When** the user runs "Export deck", **Then** the same export as the top-bar export action starts.
2. **Given** the palette, **When** the user runs "Toggle dark mode" (also found by typing "theme"), **Then** the theme toggles between light and dark, as with the existing theme control.
3. **Given** the palette, **When** the user runs "Open rule editor" (also found by typing "rules"), **Then** the rule editor opens (008).
4. **Given** the palette, **When** the user runs "Go to library" or "New deck", **Then** the app goes to the library or creates and opens a new deck, as the existing actions do.
5. **Given** a command whose feature is not available yet (e.g. focus mode before 010), **Then** it is not listed.
6. **Given** a command with a keyboard shortcut, **Then** the palette shows the shortcut next to it.

---

### User Story 4 - Notes during flow playback (Priority: P3)

While playing the checkout flow, notes stop competing with the flow: they fade, except the note pinned to "Payment Service" when the current step touches Payment Service, and a note the author marked "Stay visible during flows". From the flow toolbar the user can switch notes to shown or hidden.

**Why this priority**: design 63 and backlog §009 include it; it polishes flow playback (007, merged) rather than adding a new capability.

**Independent Test**: With flow mode available, play a flow on a deck with three notes (free, pinned to a node on step 2, marked "Stay visible"), step through and check each note's state and the Notes switch.

**Acceptance Scenarios**:

0. **Given** a selected note, **When** the user turns on "Stay visible during flows" in the inspector, **Then** the choice is saved with the deck and shown in the JSON panel; one ⌘Z turns it off.
1. **Given** flow mode (007), **When** a step is current, **Then** notes are dimmed to 35% except those pinned to either component of the current step's connection or marked "Stay visible during flows"; when the current step changes, the notes update; dimming follows 007's dim timing and is instant under reduced motion. Notes are never dimmed by 007's path dimming (20%).
2. **Given** a dimmed note, **Then** it is also marked in a non-color way (a dashed border and ", dimmed" in its accessible name), and it can still be reached and read by keyboard (§g-30).
3. **Given** flow mode, **When** the user sets "Notes" to shown, **Then** no note is dimmed; **When** set to hidden, **Then** notes are not drawn; **When** set to dimmed (the default), **Then** scenario 1 applies. The choice is remembered on this device and is not saved in the deck.
4. **Given** flow mode ends, **Then** all notes return to normal and are editable again.
5. **Given** flow mode, **Then** notes are view-only: they cannot be dragged, edited, collapsed or deleted, and N or a Note drop does nothing.
6. **Given** flow mode with a current step whose components have pinned notes, **When** the user looks at the step inspector, **Then** a "NOTES ON THIS STEP" section lists each of those notes (label and "Pinned to <component>"); activating one brings the note into view without leaving flow mode; the section is hidden when there are none.

---

### Edge Cases

- A note in the file anchored to something that is not a component (a connection, group, flow or step): it is kept unchanged and shown as a free note at its stored position, with the inspector saying "Pinned to <object>" in read-only text and offering "Unpin". Re-pinning from the UI offers components only.
- A note in the file with both an anchor and a position: the position is the offset from the anchor. A pinned note with no position is placed just above-right of its component.
- A note whose anchor names no object (already broken when imported): shown as a free note at its stored position; the inspector says "Pinned object is missing" and offers "Unpin"; the note is not changed until the user acts (002's integrity report still lists it).
- A note anchored to a connection, flow or step that is deleted: 002's behavior (kept, reported broken) applies; only component deletes free notes automatically.
- Deleting several components at once: every note pinned to any of them becomes free in the same undo step.
- Undoing a component delete restores pinned notes to their pins and offsets in the same step.
- A pinned note's component is moved into or out of a group: the note keeps following the component.
- Collapsed note with a very long first line: truncated with an ellipsis; the full text stays available in the inspector and to assistive technology.
- Very long note text: the card grows in height up to a limit and then scrolls; width stays 180 px.
- Pressing N repeatedly without typing: each empty note is removed on blur, so no empty notes accumulate.
- A new note is still empty when the tab closes or crashes (it was already autosaved): the next time the deck opens, the note is kept and shown as "Empty note", never deleted silently; the user can delete it.
- The palette is opened while a text field is being edited: the edit is committed first; ⌘K never inserts a character.
- The deck changes while the palette is open (another tab, undo): results refresh with the next keystroke or immediately; opening a result that was just deleted does nothing and shows "This item no longer exists".
- Very long query or pasted text: search still responds within the target; the query is trimmed to 200 characters.
- Objects with empty titles: listed with their kind name ("Untitled component") and still searchable by body text.
- Matches inside markdown syntax: search ignores markdown markers (e.g. searching "owner" matches "**Owner**").
- Duplicate titles: both results are shown, each with its context (group for components, flow for steps, "From → To" for connections).
- Notes in a read-only situation (deck deleted in another tab, 005): editing is blocked like the rest of the canvas.

## Requirements _(mandatory)_

### Functional Requirements

**Sticky notes**

- **FR-001**: Users MUST be able to add a note by dragging Note from the palette onto the canvas (pinned when dropped on a component, free otherwise) and by pressing N at the pointer (same rule), except while a text field has focus.
- **FR-002**: A note MUST display its text as simple markdown (paragraphs, bullets, bold, italic, inline code) using the same rendering and safety rules as 008's description preview; raw HTML MUST be shown as text and nothing in a note may run code or load external content.
- **FR-003**: Users MUST be able to edit a note's text in place on the card and in the sticky inspector (Write / Preview).
- **FR-004**: A note that is empty or whitespace-only when it loses focus MUST be removed immediately, as part of the same undo step as its creation (so it leaves no undo entry).
- **FR-005**: Users MUST be able to drag a note to move it. A free note stores its canvas position; a pinned note stores its offset from its component and MUST move with the component whenever the component moves.
- **FR-006**: A pinned note MUST show a dotted leader line and a pin between the note and its component.
- **FR-007**: Users MUST be able to pin a free note to a component, change the component, and unpin it, from the inspector; pinning and unpinning MUST NOT move the note on screen.
- **FR-008**: Users MUST be able to collapse a note to a single line with a chevron and expand it again (chevron, inspector DISPLAY, or ⌥C on the selected note); the state MUST be saved in the deck as the note's `collapsed` field.
- **FR-009**: Users MUST be able to mark a note "Stay visible during flows"; the choice MUST be saved in the deck as the note's `showInFlows` field.
- **FR-010**: Deleting a note MUST ask for confirmation, then show an Undo toast; Undo or ⌘Z MUST restore the note with its id, text, color, anchor, position, `collapsed` and `showInFlows`.
- **FR-011**: When a component that has pinned notes is deleted, the notes MUST become free notes at their last on-screen position (anchor removed, position converted from offset to canvas coordinates), in the same undo step as the delete; text, color, `collapsed` and `showInFlows` MUST be unchanged. Undo MUST restore the component and the pins with their original offsets in one step. This amends 002 FR-017 for component anchors only.
- **FR-012**: The outline MUST list notes (first line, or "Empty note" / "Note" placeholder) and selecting one MUST select the note and bring it into view.
- **FR-013**: Notes MUST be selectable, movable (arrow keys nudge the selected note), editable and deletable by keyboard, with a visible focus indicator and an accessible name made from their text.
- **FR-014**: Each note edit (text burst, move, pin, collapse, flag) MUST be one undo step, consistent with the existing undo units (003).
- **FR-015**: The deck file format MUST gain two optional sticky fields, `collapsed` (boolean, absent means expanded) and `showInFlows` (boolean, absent means not), as an additive change: existing files stay valid, the format version does not change, and saving and reopening MUST keep both fields unchanged.

**Notes in flow mode**

- **FR-016**: In flow mode, every note MUST be dimmed to 35% opacity except notes pinned to either component of the current step's connection and notes with `showInFlows` set. With no current step or a broken current step, only `showInFlows` notes are exempt; in an empty flow no note is dimmed. Notes MUST NOT receive 007's path dimming.
- **FR-017**: A dimmed note MUST differ from a normal note by more than opacity (border style and an accessible-name suffix), return to full strength while focused or hovered so its text meets WCAG AA contrast, and remain reachable by keyboard.
- **FR-018**: Flow mode MUST offer a "Notes: dimmed / shown / hidden" switch in the canvas toolbar next to Labels (default dimmed), remembered per device and never saved in the deck; "shown" dims no note and "hidden" draws no notes.
- **FR-018a**: In flow mode, the step inspector MUST show a "NOTES ON THIS STEP" section listing the notes pinned to the current step's from and to components; activating one MUST bring it into view without leaving flow mode.
- **FR-018b**: In flow mode, notes MUST be view-only (no drag, edit, collapse, pin or delete), and adding notes (N, drop, palette click) MUST be refused, consistent with 007's view-only canvas.

**Command palette and search**

- **FR-019**: The palette MUST open with ⌘K on macOS and Ctrl+K elsewhere, and from the top-bar "Jump to… ⌘K" field, from anywhere in the editor; Esc or the same shortcut MUST close it and return focus to the previously focused element.
- **FR-020**: The palette MUST search the open deck's components, connections, flows, flow steps, rules and notes, matching titles and body text: descriptions, step conditions and notes, sticky text, and rule cells (and rule column names).
- **FR-021**: Matching MUST ignore case, accents, markdown markers and leading/trailing spaces; a multi-word query MUST match only objects that contain every word, in any fields.
- **FR-022**: Each result MUST show its kind (with the kind icon), its title (or a placeholder), a context line where useful (group, flow, "From → To"), and, for body matches, a one-line snippet around the match with the matched words emphasized by weight and underline.
- **FR-023**: Results MUST be ordered: title matches before body-only matches; then by kind (commands, components, connections, flows, steps, rules, notes); then alphabetically by title. At most 50 results MUST be shown, with a "Showing 50 of n" line when there are more.
- **FR-024**: The first result MUST be highlighted by default; ↑ / ↓ MUST move the highlight without wrapping; Enter MUST open the highlighted result; the mouse MUST also be able to hover and click results.
- **FR-025**: When nothing matches, the palette MUST show "No results" and Enter MUST do nothing.
- **FR-026**: Opening a result MUST: select a component, connection or note and bring it into view; open a flow in flow mode at its first step; open a step's flow in flow mode at that step; open a rule in the rule editor; run a command. Then the palette MUST close.
- **FR-027**: With an empty query, the palette MUST list the commands, then the deck's flows (design 30); commands MUST also be matched by name when a query is typed.
- **FR-028**: The palette MUST offer at least these commands when their feature exists: Export deck…, Toggle dark mode, Open rule editor, Go to library, New deck, and Toggle focus mode (only once 010 exists), using the design's labels (design 30); "theme" and "rules" MUST also find the theme and rule-editor commands. Each command MUST behave exactly like its existing UI action and show its shortcut if it has one.
- **FR-029**: Search results MUST reflect the current deck content, including changes made in another tab or by undo, without reopening the palette.
- **FR-030**: The palette MUST be operable entirely by keyboard, announce the result count to assistive technology, and expose results as a list whose highlighted option is announced.
- **FR-031**: Search MUST run entirely on the device; no deck content (queries included) may leave the browser.

### Key Entities

- **Sticky note**: a note on the canvas. Id (stable), text (markdown), color (existing, default amber), anchor (id of the object it is pinned to, optional), position (canvas position when free, offset from the anchor when pinned), collapsed (new, optional), show in flows (new, optional). Belongs to the deck document and is exported with it.
- **Notes display preference**: dimmed / shown / hidden during flow playback. UI preference on this device, not part of the deck.
- **Search result**: derived, never stored. Kind, target object id (or command), title, context line, optional snippet with match ranges, rank.
- **Command**: a named app action available from the palette, with an optional shortcut and an availability condition.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On a 2,000-component deck (with flows, rules and notes in proportion), palette results update in under 50 ms per keystroke on a typical laptop.
- **SC-002**: A user can reach any named object in the deck from the keyboard in at most 3 actions after opening the palette (type, optional arrow keys, Enter).
- **SC-003**: A user can add a note, write text and pin it to a component in under 10 seconds.
- **SC-004**: 100% of notes pinned to a component keep their relative position after the component is moved, across save and reopen. 100% of notes pinned to a deleted component remain in the deck as free notes at the same place on screen.
- **SC-005**: Saving and reopening a deck with notes of every combination (free/pinned, collapsed/expanded, show in flows on/off) returns identical notes in 100% of round-trip test cases; existing deck files without the new fields still open unchanged.
- **SC-006**: No empty notes remain in a deck after a normal editing session (every empty note is removed on blur); only an interrupted session (tab closed or crashed mid-draft) can leave one, and it stays visible as "Empty note".
- **SC-007**: Every palette action and every note action can be completed without a pointer, and zero state (dimmed, selected, match) is shown by color alone.
- **SC-008**: Opening the palette shows the search field ready for typing in under 100 ms.
- **SC-009**: The editor's existing canvas performance targets (60 fps pan/zoom at 500 nodes / 1,000 edges) still hold with 100 notes on the canvas.

## Assumptions

- The palette searches only the open deck; the library keeps its name-only search (005).
- Search is substring-based per word (no fuzzy matching or typo tolerance) — enough for the backlog's criteria and predictable for users.
- Terms used in User Story 4 (flow mode, current step, played path, dim timing) mean what 007 implements on `main` (`b519550`); see "Review against 007 as implemented".
- Step "notes" (a step field kept in the file since 006) are included in body search, as the input asks for "text in … notes".
- Rule cells and rule column names are searchable; a match in a rule cell opens the rule editor on that rule (the cell itself is not focused).
- Note markdown reuses exactly 008's description subset and sanitizing rules; no links or images are rendered in notes.
- Note width is fixed at 180 px (design 62); resizing is deferred, overriding the input's "resized".
- Only components can be chosen as a pin target in the UI; other anchor types present in a file are preserved untouched.
- The note color picker is out of scope; imported colors are displayed with the matching design-system tint.
- Adding the new optional sticky fields follows the constitution's schema rules (generated types, validator parity, round-trip tests) and does not bump the format version.
- A command palette library may be proposed at planning time, but adding it requires founder approval (constitution VIII); the spec does not depend on one.
- Theme switching, export, library navigation, new deck and the rule editor already exist (000, 005, 008) and are reused as-is.
