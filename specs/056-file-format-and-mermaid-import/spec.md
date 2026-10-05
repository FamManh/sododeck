# Feature Specification: File format and Mermaid import

**Feature Branch**: `056-file-format-and-mermaid-import`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "056 file-format-and-mermaid-import: deck files use the extension `.sododeck` (drop the trailing `.json`); old `.sododeck.json` files still open. Import Mermaid (flowchart and sequence diagram; ER later). Size: medium, touches the file format and the importer."

## Clarifications

### Session 2026-10-05

- Q: Which Mermaid diagram types are imported in this feature? → A: flowchart and sequence diagram; ER diagram is deferred to a later feature (database pack).

**Sources**: `docs/backlog.md` §056, §025 (format compatibility), §026 (diagram-as-code, importers); `apps/app/src/storage/` (download, library ops); `apps/app/src/library/` (import button, import hook); AGENTS.md architecture rules 1–5 (single source of truth, lossless round-trip, stable ids, heavy work off the main thread, no network with content); constitution v1.0.0.

## Scope

**In scope**

- **New file extension**: decks are saved as `<name>.sododeck`. The content is unchanged; only the file name ends differently.
- **Old files keep working**: `.sododeck.json` (and plain `.json` that holds a valid deck) still open exactly as before.
- **Mermaid import**: turn Mermaid **flowchart** text into a new deck (nodes become components, links become connections, subgraphs become groups) and Mermaid **sequence diagram** text into a new deck (participants become components, messages become connections, and the ordered messages become one flow with steps). Everything gets an automatic readable layout.
- **Import report**: after a Mermaid import, say what was mapped and what was skipped and why.
- **Docs**: wording that names the old extension (UI text, docs, sample decks) is updated.

**Out of scope**

- Other Mermaid diagram types (ER, class, state, gantt…): a clear "not supported yet" message is shown instead. ER import fits the database pack and is a follow-up feature (decided 2026-10-05).
- Exporting a deck to Mermaid (tracked separately, M5).
- Merging imported Mermaid content into an existing deck: an import always creates a new deck.
- Changing what is inside the file (the schema and its revision are untouched).
- Other importers (Structurizr, OpenAPI) and editing the JSON panel (feature 026).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Save and open decks with the `.sododeck` extension (Priority: P1)

A person saves a deck to a file and gets `payments.sododeck`, a name that is short and recognisable instead of the double extension. They can open that file later, and files they saved long ago as `payments.sododeck.json` still open.

**Why this priority**: it is the founder's visible request and it touches every save and open path; old files breaking would lose people's work.

**Independent Test**: save a deck, check the downloaded file name ends in `.sododeck` with no `.json`; open it back and get an identical deck; open a file named `*.sododeck.json` and a plain `*.json` deck and get the same result as before.

**Acceptance Scenarios**:

1. **Given** a deck named "Payments", **When** the person saves it to a file, **Then** the file is named `Payments.sododeck`.
2. **Given** a file `Payments.sododeck` made by the app, **When** it is opened from the library, **Then** the deck appears identical to the one saved (lossless round-trip).
3. **Given** an older file `Payments.sododeck.json`, **When** it is opened, **Then** it opens as before with no warning and no change to its content.
4. **Given** a file with an unrelated extension or content that is not a deck, **When** it is opened, **Then** the person sees the existing "not a valid deck" message and nothing is added.
5. **Given** the file chooser, **When** it opens, **Then** `.sododeck` files are selectable alongside the older ones.

---

### User Story 2 - Import a Mermaid flowchart as a deck (Priority: P1)

A person who already has a diagram written in Mermaid (in a README, a wiki, a chat) pastes it, or picks the file, and gets a deck with the same boxes, arrows and groups, laid out and ready to work on, instead of redrawing it by hand.

**Why this priority**: it is the on-ramp for people with existing diagrams and the main value of the feature besides the rename.

**Independent Test**: import a 30-node flowchart with 2 subgraphs; the new deck has 30 components, 2 groups, the same links and labels, and no overlapping cards.

**Acceptance Scenarios**:

1. **Given** the library, **When** the person chooses Mermaid import and pastes flowchart text (or picks a `.mmd` / `.mermaid` / `.txt` file), **Then** a new deck is created and opened.
2. **Given** a flowchart with nodes `A[Web app] --> B[API]`, **When** imported, **Then** two components titled "Web app" and "API" exist with one connection from the first to the second.
3. **Given** a link with a label (`A -->|login| B`), **When** imported, **Then** the connection carries the label "login".
4. **Given** a `subgraph` containing some nodes, **When** imported, **Then** a group with the subgraph title contains those components; nested subgraphs become nested groups.
5. **Given** a flowchart direction (`TD`, `LR`, `BT`, `RL`), **When** imported, **Then** the layout follows that direction.
6. **Given** the same text imported twice, **When** compared, **Then** both decks have the same structure and titles (ids are fresh, never derived from titles).
7. **Given** node shapes (rectangle, rounded, circle, rhombus…), **When** imported, **Then** each becomes a component of the closest matching kind; shapes with no match become the default kind.

---

### User Story 3 - Import a Mermaid sequence diagram as a flow (Priority: P1)

A person who has a sequence diagram (who calls whom, in order) imports it and gets a deck where each participant is a component, each call is a connection, and the order of the calls is a flow they can play step by step.

**Why this priority**: sequence diagrams are the other common way people document systems, and the deck's flows are exactly "ordered steps over connections", so the match is direct and high value.

**Independent Test**: import a sequence diagram with 4 participants and 10 messages; the deck has 4 components, the needed connections, and one flow with 10 steps in the original order.

**Acceptance Scenarios**:

1. **Given** `participant Web`, `participant API` and `Web->>API: login`, **When** imported, **Then** two components "Web" and "API" exist, one connection from Web to API labelled "login", and one flow whose first step uses it.
2. **Given** `actor User` or `participant A as Alias`, **When** imported, **Then** the component title is the display name ("Alias"), and an `actor` becomes a person-like component when such a kind exists, otherwise the default kind.
3. **Given** a participant used in a message without being declared, **When** imported, **Then** it is created from first use, in order of appearance.
4. **Given** reply messages (`API-->>Web: token`), **When** imported, **Then** they are steps in the same flow, back along the same pair of components, in order.
5. **Given** two messages in the same direction between the same pair with different labels, **When** imported, **Then** each message is its own step; the connection between the pair is reused when it already exists and a step never refers to a missing connection.
6. **Given** `alt/else`, `opt`, `loop`, `par` blocks, **When** imported, **Then** their messages are kept as steps in reading order, the block text is kept as a note on the first step it covers, and the report states that branching was flattened.
7. **Given** notes, activations, `autonumber`, and a title, **When** imported, **Then** the title becomes the flow title and the rest is listed as skipped or kept as notes as stated in the report.
8. **Given** a self-message (`A->>A: retry`), **When** imported, **Then** it becomes a step on a self-connection.

---

### User Story 4 - Understand what the import did (Priority: P2)

After importing, the person sees a short report: how many components, connections and groups were created, and a list of anything that was skipped (styling lines, click handlers, unsupported syntax) with the reason, so nothing is silently lost.

**Why this priority**: trust. Without it a partial import looks like a bug.

**Independent Test**: import a flowchart that contains `style`, `classDef`, `click` lines and one unsupported construct; the report counts the mapped objects and lists each skipped line with a reason.

**Acceptance Scenarios**:

1. **Given** a clean flowchart, **When** imported, **Then** the report shows the counts and no skipped items.
2. **Given** text with styling or interaction lines, **When** imported, **Then** the report lists them as skipped (appearance only) and the structure is still imported.
3. **Given** a line the importer cannot read, **When** imported, **Then** the rest is still imported and the report names that line number and why it was skipped.

---

### User Story 5 - Clear errors and a safe import (Priority: P2)

Bad input never produces a broken or half-created deck, never freezes the app, and never leaves the network involved.

**Why this priority**: importers take untrusted text; robustness is part of shipping it.

**Independent Test**: try empty text, a non-flowchart diagram, a huge diagram, and malformed text; each gives a clear message or a bounded result, and no deck is created on failure.

**Acceptance Scenarios**:

1. **Given** empty or whitespace-only text, **When** the person imports, **Then** a message says there is nothing to import and no deck is created.
2. **Given** a diagram of another type (`erDiagram`, `classDiagram`…), **When** imported, **Then** a message says that type is not supported yet and names what is supported (flowchart and sequence diagram); no deck is created.
3. **Given** text that has no readable nodes, **When** imported, **Then** a message says nothing could be read, with the first problem found; no deck is created.
4. **Given** a flowchart with 500 nodes, **When** imported, **Then** the app stays responsive while it lays out, and the result opens.
5. **Given** any import, **When** it runs, **Then** no network request is made.

---

### Edge Cases

- A file named `deck.sododeck.json` saved again: the new save is named `deck.sododeck` (the old double extension is not repeated or kept).
- Two decks with the same name saved in a row: the browser's usual duplicate-name handling applies; the extension is the only change.
- Mermaid text fenced in Markdown code fences (` ```mermaid … ``` `) or with a front-matter / title / `%%` comment block: fences and comments are tolerated; if a Markdown file holds several diagrams, the first flowchart is imported and the report says others were ignored.
- Node ids that repeat, or a node mentioned only in a link: one component per id; link-only nodes are created with the id as title.
- Chained links (`A --> B --> C`), several targets (`A --> B & C`), and link styles (`---`, `-.->`, `==>`): all become connections; dotted/thick/no-arrow variations map to the closest connector style or are noted in the report.
- Titles with special characters, quotes, emoji, `<br/>` line breaks or Markdown-ish text: shown as readable plain text, never executed or rendered as markup.
- Very long titles are kept in full, not cut.
- Self-links (`A --> A`) and links between a node and a subgraph: self-links are kept; subgraph-to-node links are reported as skipped or attached to the group, whichever the existing connector rules allow.
- Mermaid text that uses the older `graph` keyword instead of `flowchart` is accepted as the same thing.

## Requirements _(mandatory)_

### Functional Requirements

**File extension**

- **FR-001**: Saving a deck to a file MUST name it `<safe name>.sododeck`; the name is made safe the same way as today.
- **FR-002**: The content of a saved file MUST be byte-for-byte what the previous format wrote (same structure, same revision); only the file name changes.
- **FR-003**: Opening a deck file MUST accept `.sododeck`, `.sododeck.json` and `.json` files, decided by what the content is, not only by the name; behaviour and validation for valid files are identical for all three.
- **FR-004**: A file that is not a valid deck MUST give the existing error message and add nothing, whatever its extension.
- **FR-005**: The file chooser, drag-and-drop zone and every visible label MUST mention `.sododeck`; the old extension is mentioned only where it helps ("older `.sododeck.json` files also open").
- **FR-006**: Save → open of a deck MUST round-trip losslessly (existing guarantee, re-tested with the new name).

**Mermaid import**

- **FR-007**: The library MUST offer an import path for Mermaid text: paste text, or choose a `.mmd`, `.mermaid`, `.md` or `.txt` file.
- **FR-008**: Import MUST accept `flowchart` and `graph` diagrams with direction `TB`, `TD`, `BT`, `LR` or `RL`, and `sequenceDiagram` diagrams; the type is detected from the first meaningful line.
- **FR-009**: Every node MUST become one component with its label as title; the Mermaid node id is used only to join links and is never reused as the deck's stable id.
- **FR-010**: Every link MUST become one connection between the matching components, keeping its label; chained links and `&` groups expand to individual connections.
- **FR-011**: Every `subgraph` MUST become a group holding its nodes; nesting is preserved; the subgraph title is the group title.
- **FR-012**: Node shapes MUST map to the closest component kind or the default kind (mapping documented in the plan).
- **FR-008a**: For a sequence diagram, every participant or actor MUST become one component (display name as title; undeclared participants created at first use, in order of appearance); every message MUST become one step of a single new flow, in source order; each step MUST refer to a connection between the two participants, created when missing and reused when it already exists; the flow title is the diagram title or a default.
- **FR-008b**: Sequence blocks (`alt`, `opt`, `loop`, `par`, `critical`, `break`) MUST NOT stop import: their messages are kept in reading order and the block label is kept as a note on the first covered step; the report states that branching was flattened.
- **FR-013**: Imported items MUST be placed by the automatic layout, following the flowchart direction, with no overlapping cards.
- **FR-014**: Import MUST always create a new deck and open it; it never changes an existing deck.
- **FR-015**: Import MUST show a report with counts of components, connections, groups and flow steps, and a list of skipped lines each with its line number and reason.
- **FR-016**: Styling, class definitions, link styles and click handlers MUST NOT block import; they are listed as skipped (appearance only).
- **FR-017**: Unsupported diagram types (ER, class, state…), empty input and input with no readable nodes MUST fail with a clear message and create nothing.
- **FR-018**: Parsing and layout MUST NOT block the interface for large inputs (500 nodes stays responsive); input above a documented limit is refused with a message.
- **FR-019**: Imported text MUST be treated as plain text only: no markup or script from titles is ever interpreted.
- **FR-020**: Import MUST make no network request; nothing leaves the browser.
- **FR-021**: Imported decks MUST pass the same validation as any deck file and round-trip losslessly once saved.
- **FR-022**: Whole import is atomic: it either produces a complete valid deck or none.

### Key Entities

- **Deck file**: one deck written to disk; extension `.sododeck`; content unchanged by this feature.
- **Mermaid source**: text (pasted or from a file) describing a flowchart or a sequence diagram; read-only input, never stored as-is.
- **Import report**: summary of one import: counts by object type and a list of skipped items (line number, excerpt, reason); shown once after import.
- **Imported deck**: a new deck holding components, connections and groups (flowchart) or components, connections and one flow (sequence diagram) derived from the source, with fresh stable ids.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of files saved by this version are named `*.sododeck` and reopen to an identical deck.
- **SC-002**: 100% of valid decks in the old `.sododeck.json` format, including the bundled samples, still open with no change in result.
- **SC-003**: A 30-node, 2-subgraph flowchart becomes a deck with 30 components, 2 groups and every link present, in under 3 seconds from confirming to seeing the deck.
- **SC-003a**: A sequence diagram with 4 participants and 10 messages becomes a deck with 4 components and one 10-step flow in the original order, and the flow plays from first to last step without any broken reference.
- **SC-004**: A 500-node flowchart imports without the interface freezing for more than 100 ms at a time.
- **SC-005**: For every import, 100% of lines that were not mapped appear in the report; no content disappears silently.
- **SC-006**: A person with an existing Mermaid flowchart gets to an editable deck in under 30 seconds, with no manual re-drawing.
- **SC-007**: Zero network requests are made during save, open and import.

## Assumptions

- **Flowchart and sequence diagram** are imported now (founder decision 2026-10-05); ER diagram is a later feature, the natural fit for the database pack. The estimate in the backlog grows from 4 d to about 6 d.
- Saved files use `.sododeck` while the content stays the existing JSON, so no schema or revision change is needed.
- Opening is decided by content as well as name, so a renamed or extension-less deck file still opens when it is valid.
- Mermaid import is a small in-repo parser for the flowchart and sequence subsets (no new runtime dependency), per the project rule to ask before adding dependencies; parsing and layout run off the main thread.
- Import always creates a new deck; merging into an open deck is not offered.
- The bundled sample decks keep working; renaming their files is housekeeping and not user-visible.
- The Mermaid shape-to-kind mapping and the connector style mapping are decided in the plan, using the existing kinds and connector styles only.
- Per project rules: English UI copy, no new end-to-end tests (the smoke suite must stay green), tokens and icons from the design system, and no other tool names in docs or copy beyond the format name "Mermaid".
- Documentation (spec, deploy/README wording, backlog, an ADR if the extension decision warrants one) is updated as part of the work.
