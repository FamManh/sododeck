# Feature Specification: Deck Document Model

**Feature Branch**: `002-yjs-model`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "002 (yjs-model) from docs/backlog.md — Provide a single deck model that all editing surfaces (canvas, inspector, JSON panel, rule editor) change, so they can never disagree. Users can add, edit, move and delete components, groups, connections, flows, steps, rules and sticky notes; deleting a component also removes its connections and flags any flow step that used them; renaming never breaks a reference. Users can undo and redo their edits, where a burst of typing or one drag counts as a single step. Saving and loading a deck file must never lose or change data. Why: two-way sync between picture and text, undo, multi-tab safety and later collaboration only work with one trustworthy model."

**Sources**: `docs/backlog.md` §002, `docs/spec.md` §11, C-6, C-7, G-1, `docs/design/design-analysis.md` §e, `specs/001-json-schema-v1/spec.md` (FR-007: enforcing ids and references on load is this feature's job), ADR 0002, ADR 0004, constitution v1.0.0 (principles I, II, III, V, VI).

## Scope

**In scope**

- One live deck document holding every version 1 object (deck metadata, nodes, groups, edges, views, features, flows, steps, rules with their columns and rows, stickies).
- Typed edit operations for every object type: add, update fields, move/reorder, remove; plus decision-table columns and rows, and flow steps.
- Cascade rules when something is deleted, and a consistent policy for references that are kept but broken.
- Id generation for new objects.
- Undo and redo of local edits, with grouping (a typing burst or one drag = one step).
- Loading a deck file into the document and writing it back out, losslessly, in the canonical per-object key order.
- A referential integrity report: a typed list of broken references and cycles that a later feature (015 `model-validation`) shows to users.
- Running without a browser (in a background worker or on a server/CLI), so heavy work can move off the main thread.

**Out of scope**

- Storage and autosave (IndexedDB, library): 005.
- Any user interface: canvas (003), JSON panel (004), inspector and rule editor (008), stickies UI (009).
- User-facing validation messages and C-7 checks such as orphan nodes and duplicate edges shown in the UI: 015. This feature only produces the data they need.
- Rule evaluation (matching decision-table rows against inputs): 008.
- File format changes and migrations between format versions (none exist yet).
- Step branches (arrive with 006 as an additive format field).
- Multi-tab sync and collaboration transport. The model must not prevent them, but does not implement them.

## Clarifications

### Session 2026-09-27

- Q: When a component or connection is deleted, what happens to flow steps and sticky notes that pointed at it? → A: Keep them (with all their content) and flag them as broken until the user repairs or deletes them; undo restores the whole delete in one step.
- Q: When two tabs or people edit the same text field at once, merge letter by letter or last write wins? → A: Last write wins per field for all text now (finer than Excalidraw's whole-element rule); letter-by-letter merge is a planned later upgrade via ADR + layout migration when collaboration gets time.
- Q: When a group is deleted, what happens to the components and nested groups inside it? → A: They stay and move up to the deleted group's parent group (or become ungrouped); nothing inside is deleted.
- Q: When an imported file has two objects with the same id, refuse or load with a fix-up? → A: Refuse the import with an error naming the duplicate id and both locations; no auto-renaming.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Every surface shows the same deck (Priority: P1)

An architect renames a component in the inspector. The canvas label, the JSON panel and any flow step that runs through that component all show the new name immediately, because they all read the same deck. Every change made from any surface goes through the same set of edit operations.

**Why this priority**: The whole product promise (picture and text never disagree) depends on one model. Canvas (003), JSON panel (004), inspector (008) and autosave (005) are all built on top of it.

**Independent Test**: Using only the model's edit operations (no UI), add nodes, edges, a flow with steps and a rule; read the deck back and confirm every change is visible in the exported file, and that a change observer is notified once per edit.

**Acceptance Scenarios**:

1. **Given** an empty deck, **When** a node, a second node, an edge between them, a flow with one step on that edge, and a rule attached to the step are added, **Then** the exported file contains all of them with their references intact.
2. **Given** a node referenced by two edges and a flow step, **When** the node is renamed, **Then** its id is unchanged and every reference still resolves.
3. **Given** a surface is observing the deck, **When** another surface changes a field, **Then** the observer is told what changed (which object and which field) without re-reading the whole deck.

---

### User Story 2 - Save and load never lose or change data (Priority: P1)

An architect imports a `.sododeck.json` file, works on it, and exports it. Anything they did not touch is byte-for-byte the same in meaning; anything they changed appears in the fixed key order, so the git diff shows only their edits.

**Why this priority**: The file is the only way data leaves the browser in the MVP (constitution II, IV). A lossy load or save silently destroys work.

**Independent Test**: For every example file and one case per object type, load the file and write it back; the result must deep-equal the input and follow the canonical key order.

**Acceptance Scenarios**:

1. **Given** any valid example file, **When** it is loaded and written back, **Then** the result deep-equals the input (one round-trip case per object type, including every optional field).
2. **Given** a loaded deck where one node title is changed, **When** it is written out, **Then** only that node's title differs from the original file.
3. **Given** a file that fails format validation, **When** it is loaded, **Then** loading is refused with the list of problems and their locations, and no document is created.
4. **Given** a file where two objects in the same collection share an id, **When** it is loaded, **Then** loading is refused with an error naming the duplicated id and both locations.
5. **Given** a file with a reference to a missing object (e.g. a step pointing at an edge that does not exist), **When** it is loaded, **Then** it loads, and the integrity report lists that broken reference.

---

### User Story 3 - Deleting keeps the deck consistent (Priority: P1)

An architect deletes a component. Its connections disappear with it (a connection to nothing makes no sense), but the flow steps and notes that used it are kept and flagged, so the architect can repair them instead of silently losing knowledge. Deleting a rule detaches it everywhere it was used.

**Why this priority**: Deletion is where models most often become inconsistent; the design shows delete-node removing its edges (design-analysis §e, screen 02). Losing flow steps silently would destroy the knowledge layer.

**Independent Test**: Build a deck where one node is used by two edges, a flow step, a view and a sticky; delete the node and check the exact cascade and the integrity report; undo and check everything is back.

**Acceptance Scenarios**:

1. **Given** a node referenced by two edges and a flow step on one of them, **When** the node is deleted, **Then** both edges are removed, the step remains in its flow, and the integrity report lists the step as broken (its edge is missing).
2. **Given** a rule attached to two steps and one node, and sample inputs for it on one step, **When** the rule is deleted, **Then** it is removed from every rule list and its sample inputs are removed, and no broken reference is reported.
3. **Given** a deletion that cascaded to several objects, **When** undo runs once, **Then** the deleted object and everything removed by the cascade are restored exactly as before.
4. **Given** a sticky anchored to a node, **When** the node is deleted, **Then** the sticky is kept and the integrity report lists its anchor as broken.

---

### User Story 4 - Undo and redo feel natural (Priority: P2)

An architect types a new title, drags a component across the canvas, then presses ⌘Z twice: first the drag is undone as one step, then the whole title edit. ⌘⇧Z redoes them. Loading a file is not something they can undo into an empty deck.

**Why this priority**: Undo is P0 (C-6) and confirmed deletes rely on it (founder decision §g-11), but it adds value on top of stories 1–3 rather than enabling them.

**Independent Test**: Apply edit sequences through the model and check undo/redo boundaries without any UI.

**Acceptance Scenarios**:

1. **Given** ten title keystrokes in quick succession, **When** undo runs once, **Then** the title returns to its value before the burst.
2. **Given** a drag that moved a node through many intermediate positions, **When** undo runs once, **Then** the node returns to its position before the drag.
3. **Given** a multi-object edit (e.g. moving five selected nodes, or a delete with cascade), **When** undo runs once, **Then** the whole edit is reverted.
4. **Given** undo was run, **When** redo runs, **Then** the edit is re-applied; **When** a new edit is made after an undo, **Then** the redo history is cleared.
5. **Given** a freshly loaded deck, **When** undo runs, **Then** nothing changes (loading is not an undoable step).

---

### User Story 5 - New objects get safe ids (Priority: P2)

Whenever a surface creates an object, the model gives it an id that is unique in the deck, valid for the file format, not derived from its title, and never changes afterwards.

**Why this priority**: Required by constitution III; small but foundational.

**Acceptance Scenarios**:

1. **Given** a new node titled "Orders API", **When** its id is inspected, **Then** it is unique in the deck, accepted by the file format, and does not contain the title.
2. **Given** that node, **When** it is renamed, moved, regrouped or re-ordered, **Then** its id is unchanged.
3. **Given** 10,000 objects created in one deck, **When** their ids are compared, **Then** none collide.

### Edge Cases

- Deleting an edge used by flow steps: the steps are kept and reported broken (same policy as for nodes).
- Deleting a node that other nodes use as `parent`: their `parent` is cleared (they stay on the canvas at their current level).
- Deleting a group: its member nodes stay and move to the deleted group's parent group (or become ungrouped); nested groups move up the same way.
- Deleting a feature: flows and views that pointed to it lose that reference (the flows stay).
- Deleting any node removes it from every view's `includes` list and position overrides, so views never keep stale entries.
- Deleting a flow deletes its steps (they belong to it); stickies anchored to the flow or its steps are kept and reported broken.
- Adding an input or output column to a rule adds an empty cell to every row; removing a column removes that cell from every row and the matching sample inputs on steps, so row cell counts always stay valid.
- An edit that would make the deck invalid for the file format (e.g. an empty title where one is required, an unknown node kind, an edge to a node id that does not exist) is refused with an error; the deck is unchanged.
- Adding an edge between two nodes that already have an edge in the same direction is allowed (the design does it for different protocols); duplicates are reported by 015, not blocked here.
- Reordering steps, rows or columns keeps every id unchanged.
- Two concurrent edits (e.g. from another tab, later) to the same ordered list merge without losing either item; both appear in a deterministic order.
- Two concurrent edits to the same text field (e.g. two tabs typing in one title): the later write wins for that field; every tab converges to the same value; edits to other fields of the object are kept.
- Undo reverts only this user's own edits, never changes that arrived from another tab or collaborator.
- Very large decks (500 nodes / 1,000 edges) load, write out and produce the integrity report without freezing the editor.
- Loading an empty deck file produces an empty document whose export equals the input.

## Requirements _(mandatory)_

### Functional Requirements

**One document**

- **FR-001**: The deck MUST be held in one live document per open deck; every editing surface MUST read from it and write to it only through the model's operations (constitution I). No surface keeps its own copy of document data.
- **FR-002**: The model MUST let a surface observe changes and learn which objects and fields changed, so views can update incrementally.
- **FR-003**: The document layout (how each object type is stored) MUST be documented in one place in the model package, because it is persisted from 005 on and changing it later needs an ADR and a migration.
- **FR-004**: Every field of every version 1 object MUST be individually editable, so two edits to different fields of the same object never overwrite each other. Two concurrent edits to the same text field resolve as last write wins for that field (no letter-by-letter merge in this feature).

**Edit operations**

- **FR-005**: The model MUST provide typed operations to add, update and remove each object type: node, group, edge, view, feature, flow, step (within a flow), rule, rule input/output column, rule row, sticky; and to update deck metadata (name, description, tags).
- **FR-006**: The model MUST provide operations to move nodes and stickies (change position), to regroup nodes, and to reorder steps within a flow, and rows and columns within a rule.
- **FR-007**: Every operation MUST check that its result is valid for the file format and that new references point to existing objects; an invalid operation MUST be refused with a typed error and leave the deck unchanged.
- **FR-008**: Operations touching several objects (multi-select move, bulk edit, delete with cascade) MUST apply as one atomic change: observers see one change and undo reverts it in one step.

**Identity**

- **FR-009**: New objects MUST get an id that is unique within the deck, valid for the file format, not derived from any title or editable field, and never changed afterwards (constitution III).
- **FR-010**: Renaming, moving, regrouping or reordering an object MUST NOT change its id or any reference to it.

**Cascade on delete**

- **FR-011**: Deleting a node MUST remove every edge that starts or ends at it, remove it from every view's includes and position overrides, and clear `parent` on nodes that pointed to it.
- **FR-012**: Flow steps whose edge is removed (directly or by a node cascade) MUST be kept with all their content (title, condition, SLA, rules, sample inputs, notes) and reported as broken, not deleted; they stay broken until the user points them at another edge or deletes them.
- **FR-013**: Deleting a rule MUST remove its id from every node's and step's rule list and remove the sample inputs for it on every step.
- **FR-014**: Deleting a group MUST move its member nodes and child groups to its parent group (or ungroup them if it had none); it MUST NOT delete any node, edge or group inside it. Deleting the contents is done by selecting and deleting them.
- **FR-015**: Deleting a feature MUST clear the feature reference on flows and views that used it.
- **FR-016**: Deleting a flow MUST delete its steps.
- **FR-017**: Stickies anchored to a deleted object MUST be kept unchanged (text, color, anchor, position) and reported as having a broken anchor until the user re-anchors, frees or deletes them.
- **FR-018**: Adding or removing a rule column MUST keep every row's cell count equal to the column count, and removing an input column MUST remove the matching sample inputs on steps.

**Load and save**

- **FR-019**: Loading a file MUST validate it against the file format first and refuse invalid files with the list of problems and their locations (reusing the format's validator).
- **FR-020**: Loading MUST refuse a file with duplicate ids within a collection (or duplicate row/column ids within a rule, or duplicate step ids within a flow), naming the id and its locations. The model MUST NOT rename or drop duplicates to make such a file load.
- **FR-021**: Loading MUST accept files whose references point to missing objects, and those problems MUST appear in the integrity report (so users can repair rather than lose a file).
- **FR-022**: Writing out MUST produce a valid version 1 file whose keys follow the canonical per-object key order defined by the format (ADR 0004 §10), emitting optional fields only when present.
- **FR-023**: Load followed by write-out MUST be lossless: for every valid file, the output deep-equals the input; one test case per object type and per optional field.
- **FR-024**: Loading a file MUST NOT be an undoable step.

**Undo and redo**

- **FR-025**: Users MUST be able to undo and redo their own edits; undo MUST NOT revert changes that came from elsewhere (another tab or collaborator, later).
- **FR-026**: Edits in quick succession to the same object (a typing burst) MUST be grouped into one undo step, using a short pause as the boundary.
- **FR-027**: A surface MUST be able to mark the start and end of a gesture (e.g. a drag, a multi-step form change) so the whole gesture becomes exactly one undo step, regardless of its duration.
- **FR-028**: A new edit after an undo MUST clear the redo history.
- **FR-029**: The model MUST report whether undo and redo are currently available, so surfaces can enable or disable their controls.

**Integrity report**

- **FR-030**: The model MUST produce, on demand, a typed list of integrity problems covering at least: edge → missing node, step → missing edge, step or node → missing rule, sample inputs for a rule not attached to the step or for an unknown input column, sticky → missing anchor, view → missing node or feature, flow → missing feature, node → missing group or parent, group → missing parent, group nesting cycles and node parent cycles.
- **FR-031**: Each problem MUST identify the object with the problem, the field, and the missing or conflicting id, so 015 can show it and link to the object.

**Environment**

- **FR-032**: The model MUST run without a browser (no page, no DOM, no storage) so it can be used in background workers, tests and a future CLI.
- **FR-033**: The model MUST NOT perform any network access (constitution IV).

### Key Entities

- **Deck document**: the live, single source of truth for one deck; holds metadata and all collections from the version 1 format.
- **Edit operation**: a typed, validated change to the deck (add, update, move, reorder, remove), possibly touching several objects atomically.
- **Undo history**: the user's own grouped edits, with undo and redo stacks; excludes loads and remote changes.
- **Gesture**: a surface-declared span (drag, bulk edit) whose edits form one undo step.
- **Integrity problem**: a typed record of a broken reference or cycle: object type and id, field, the missing or conflicting id, and a problem kind.
- **Id**: an opaque, stable identifier generated at creation and never derived from editable fields.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of example files and per-object-type round-trip cases write back deep-equal to their input.
- **SC-002**: 100% of the cascade rules (FR-011 to FR-018) are covered by a test that also checks a single undo fully restores the prior deck.
- **SC-003**: For a deck with 500 nodes and 1,000 edges, loading, writing out, and producing the integrity report each complete in under 200 ms on a typical laptop, so the editor never visibly freezes.
- **SC-004**: A single edit (e.g. rename or move) on that same deck is applied and observed in under 16 ms, so dragging stays smooth at 60 fps.
- **SC-005**: A typing burst of any length within the grouping window and any single drag each produce exactly one undo step in 100% of tests.
- **SC-006**: 100% of the model's tests pass in a browser-free environment.
- **SC-007**: 0 edits accepted by the model produce a file that fails format validation (checked by exporting after every operation in the test suite).
- **SC-008**: Every broken-reference kind listed in FR-030 is produced by at least one test fixture and reported with object, field and missing id.

## Assumptions

- Knowledge objects that reference others (flow steps, stickies) are kept and reported broken when their target is deleted; structural objects that cannot exist without their target (edges without a node, steps without their flow) are removed. This keeps user-written knowledge while keeping the graph meaningful.
- Text fields are stored as whole values (last write wins per field). Upgrading to letter-by-letter merging later (at least for long markdown fields) is expected before real-time collaboration; it changes the persisted layout, so it needs an ADR and a migration of saved decks. The model's public API must hide the storage form so surfaces do not change when that happens.
- Group deletion re-parents rather than deletes members; the UI confirmation (founder decision §g-11) is the surface's job, not the model's.
- Files with dangling references load (and are reported); files with duplicate ids are refused, because a duplicate id makes every reference to it ambiguous. This matches 001 FR-007.
- The typing-burst grouping window is about 500 ms (a common editor default); the exact value is a planning detail.
- Undo history is per open deck and in memory only; it is not saved with the deck and is empty after a reload.
- Ordered lists (steps, rows, columns, collections) merge concurrent inserts deterministically; concurrent move of the same item may duplicate or reorder it and is out of scope until collaboration is designed (backlog risk).
- The existing skeleton (`createDeck`, `fromJSON`, `toJSON`, `serializeDeck`, `DeckValidationError`) is the starting point; its public names may be kept or extended in planning.
- No new runtime dependency is expected beyond the document library already used by the model; any addition is justified in `plan.md` and approved by the founder (constitution VIII).
