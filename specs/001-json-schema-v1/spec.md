# Feature Specification: Deck File Format v1 (`.sododeck.json`)

**Feature Branch**: `001-json-schema-v1`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "001 from docs/backlog.md — Define version 1 of the Sododeck deck file (.sododeck.json) so that a deck can hold everything an architect models: deck name and description; components with a kind, title, owner, tags, markdown description, technology, hosting, links, attached rules and position; groups; connections with protocol, label and direction; views; features; flows made of ordered steps over existing connections, each step with a condition, SLA, attached rules, an optional branch and sample rule inputs; business rules as decision tables with a hit policy, input and output columns and rows; and sticky notes that are free or attached to an object. Every object has a stable id that never changes when it is renamed, and all references are by id. The format must be strict, documented and validated, so the app, a future CLI and AI agents can trust it, and must stay readable in git diffs. Why: the file is the public contract and the only way data leaves the browser; if it cannot express the design, users lose work on export."

**Sources**: `docs/backlog.md` §001, `docs/spec.md` §6 and §7, `docs/design/design-analysis.md` §d and §g-4, ADR 0002, constitution v1.0.0 (principles II, III, IV).

**Parallel work**: `000-design-foundation` is being implemented in another session. It touches `packages/ui` and the app gallery only; this feature touches only the file format definition, its examples, its tests and the related docs. The two features share no files and have no dependency on each other.

## Scope

**In scope**

- The complete version 1 definition of the deck file: deck metadata, nodes, groups, edges, views, features, flows, steps, rules (decision tables) and stickies, with every field the design and the P0 spec need.
- Documentation of every field, embedded in the format definition, so an editor can show it as hover help and autocomplete.
- A fixed key order per object type, so files written by the app diff cleanly in git.
- Example files: a minimal deck, and a deck with a flow and a rule (plus a fuller deck exercising every object type).
- Valid and invalid fixtures, with both validators (the published JSON Schema and the app's generated validator) giving the same verdict on every fixture.
- A staleness check: changing the format definition without regenerating its derived types/validators fails the test run.
- Fixing the schema URL in `docs/spec.md` §6 (`sododeck.dev` → `sododeck.com`).
- An ADR (0004) recording the shape decisions: kind and protocol enums, positions, decision-table shape, `rules[]` arrays, and branches deferred to 006.

**Out of scope**

- Converting the file to or from the live document (feature 002, `yjs-model`).
- Cross-object integrity: unique ids across a collection, references that point to missing objects (edge → node, step → edge, step → rule, sticky → anchor, view → members). The format documents these rules; enforcing them on load is 002, and user-facing warnings are 015 (`model-validation`).
- Step branches (spec F-4): deferred to 006, added then as an optional field.
- YAML import, comments, ADR objects, entity state machines (all P1), migrations (none exist yet), the "Logistics Delivery" sample deck (013), publishing the schema on the website.
- Any UI, canvas or editor behavior.

## Clarifications

### Session 2026-09-27

- Q: Which positions model? → A: Positions live on the node (`position`); a view may hold optional per-node position overrides. (Decided in backlog §001 scope and design-analysis §g-4c proposal.)
- Q: Free-text or structured decision tables? → A: Structured: hit policy, input columns, output columns, rows with their own ids. (Backlog §001 scope, design wins over the spec §6 free-text example.)
- Q: One rule or many per step? → A: A list of rule ids (`rules`), even though the design shows one.
- Q: Which node kinds? → A: Closed list of six: `client`, `gateway`, `service`, `queue`, `database`, `external`.
- Q: Which edge protocol values? → A: Protocol families `http`, `grpc`, `event`, `sql`, `websocket`, `other`; specifics such as "Kafka" go in the label.
- Q: Branch shape? → A: Not in v1. `branch` is added as an optional step field in 006 (flow-authoring) once branching is designed; an additive optional field needs no version bump.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Export a deck without losing anything (Priority: P1)

An architect has modelled a system in the editor: components with owners, tags, technology, hosting, links and attached rules; groups; connections with protocols; flows with conditions, SLAs and rules; decision tables; and sticky notes. They export the deck as a `.sododeck.json` file and later import it (on the same or another machine). Everything they entered is still there.

**Why this priority**: The file is the only way data leaves the browser in the MVP. If a field the editor shows cannot be written to the file, that information is silently lost on export. Every later feature (model, canvas, flows, rules, export) builds on this definition.

**Independent Test**: Take the full example deck (which uses every object type and every optional field), validate it, and confirm it is accepted and that every design field listed in design-analysis §d has a place in it.

**Acceptance Scenarios**:

1. **Given** the full example deck containing every object type and every optional field, **When** it is validated, **Then** it is accepted by both validators.
2. **Given** a node that has no technology, hosting, icon, links, rules or position, **When** the deck is validated, **Then** it is valid (all of these are optional).
3. **Given** each field in the design data (design-analysis §d mapping table, excluding the items marked "not stored"), **When** the format is reviewed, **Then** each one maps to a documented field in version 1.

---

### User Story 2 - Trust a file written by someone else (Priority: P1)

A developer, a script, a future command-line tool or an AI agent writes or edits a `.sododeck.json` file by hand or by program. Before anything imports it, the file is validated. Mistakes (misspelled keys, wrong value types, unknown kinds, a step without an id, a decision-table row with the wrong number of cells) are rejected with a message that says what is wrong and where.

**Why this priority**: The file is a public contract (ADR 0002). A strict, documented format is what lets tools other than the app write decks safely; a lenient one lets broken data reach the editor.

**Independent Test**: Run every invalid fixture through both validators and confirm each is rejected, with an error that names the offending location.

**Acceptance Scenarios**:

1. **Given** a flow step without an `id`, **When** the deck is validated, **Then** validation fails and the error points at that step.
2. **Given** a rule with a row whose number of condition cells differs from the rule's number of input columns (or whose number of result cells differs from its output columns), **When** the deck is validated, **Then** validation fails with a readable message naming the rule and the row.
3. **Given** an object containing a key the format does not define, **When** the deck is validated, **Then** validation fails and the message names the unknown key.
4. **Given** a node whose kind or an edge whose protocol is not one of the allowed values, **When** the deck is validated, **Then** validation fails and the message lists the allowed values.
5. **Given** any fixture (valid or invalid), **When** it is checked by the published format definition and by the app's generated validator, **Then** both give the same verdict.

---

### User Story 3 - Read and review a deck in git (Priority: P2)

A team keeps its `.sododeck.json` files in a repository. When someone renames a component or changes one step, the diff shows only the lines that changed, and a reviewer can understand the file without the app.

**Why this priority**: Readable diffs are a stated product convention (spec §6) and make the file useful outside the app, but they matter only once files are being written, so this follows the two P1 stories.

**Independent Test**: Inspect the example files and the documented key order: every object type has a fixed, documented key order, ids come first, and a rename of a node changes only that node's title line.

**Acceptance Scenarios**:

1. **Given** the documented key order for each object type, **When** the example files are checked, **Then** their keys follow that order.
2. **Given** a node that is renamed, **When** the file is written again, **Then** its id and every reference to it are unchanged; only its title changes.

---

### User Story 4 - Keep the format and its derived validators in step (Priority: P2)

A maintainer (founder or AI agent) edits the format definition. If they forget to regenerate the derived types and validators, the test run fails and says so, instead of the app silently validating against an old format.

**Why this priority**: Protects the contract over time; low user-facing value on its own.

**Independent Test**: Change the format definition without regenerating; the test run fails with a message pointing at the regeneration command.

**Acceptance Scenarios**:

1. **Given** the format definition changed, **When** the tests run without regeneration, **Then** a staleness test fails.
2. **Given** regeneration was run, **When** the tests run, **Then** the staleness test passes.

### Edge Cases

- An empty deck (all collections empty, no metadata) is valid; `emptySododeckFile()` output stays valid.
- A deck with no `name` is valid (the library supplies a display name).
- A step whose `rules` list is empty, or which has sample inputs for a rule that is not in its `rules` list: the list may be empty; sample inputs keyed by a rule not attached to the step are a cross-object issue left to 002/015.
- A rule with zero rows, or zero input columns: valid (a new, unfilled table). A rule with zero output columns: valid.
- A decision-table cell that is empty or a wildcard (`Any`, `—`, empty string): valid; cells are text, and their matching meaning belongs to the rule evaluator, not the file format.
- A sticky with neither `anchor` nor `position`: invalid (it would have nowhere to appear). A sticky with an `anchor` and a `position`: valid; the position is then relative to the anchor.
- Numbers for positions may be negative or fractional.
- The same edge used by several steps of one flow (the design does this): valid.
- Duplicate ids within a collection, or references to missing ids: structurally valid here; rejected on load by 002 / flagged by 015 (documented in the format description).
- A file with `version` 2 or a different `$schema` URL: rejected (no migrations exist yet).
- Very long text fields (markdown descriptions): no length limit is imposed by the format.

## Requirements _(mandatory)_

### Functional Requirements

**File envelope**

- **FR-001**: A deck file MUST declare the schema URL `https://sododeck.com/schema/v1.json` and `version` 1; any other value MUST be rejected.
- **FR-002**: A deck file MUST contain the collections `nodes`, `groups`, `edges`, `views`, `features`, `flows`, `stickies` (lists) and `rules` (a map keyed by rule id), as today (ADR 0002). Top-level keys not defined by the format MUST be rejected.
- **FR-003**: A deck file MUST allow optional deck metadata: `name`, `description` (markdown) and `tags`.

**Identity and references**

- **FR-004**: Every node, group, edge, view, feature, flow, step, sticky and decision-table row MUST carry a required, non-empty `id`. A rule's id is its key in `rules`.
- **FR-005**: Ids MUST be non-empty strings of at most 64 characters made of letters, digits, `-`, `_`, `.` and `:`; the format documentation MUST state that ids are opaque, stable, never derived from titles and never changed on rename.
- **FR-006**: Every reference between objects MUST be an id (never a title): node → group, node → rules, node → parent node, group → parent group, edge → nodes, view → members, flow → feature, step → edge, step → rules, sticky → anchor.
- **FR-007**: The format documentation MUST state that ids are unique within their collection and that references must resolve, and that enforcing this on load is the model's job (002) and reporting it to users is 015.

**Objects and fields** (all fields optional unless marked required)

- **FR-008**: A **node** MUST have `id` (required), `type` (required, one of the allowed kinds, see FR-020), `title` (required), and MAY have `group` (group id), `parent` (node id, for drill-down across levels), `level` (`landscape`, `system`, `container` or `component`), `owner` (free text), `tags`, `description` (markdown), `tech`, `host`, `icon` (an icon key from the app's icon set), `links`, `rules` (rule ids) and `position` (`x`, `y` numbers).
- **FR-009**: A **group** MUST have `id` and `title`, and MAY have `parent` (group id, for nesting) and `description`. Group geometry is not stored: bounds are derived from member nodes (design-analysis §g-8); collapsed state is view/UI state.
- **FR-010**: An **edge** MUST have `id`, `from` and `to` (node ids), and MAY have `protocol` (one of the allowed protocols, see FR-021), `label`, `direction` (`forward` — the default when absent —, `both` or `none`), `description`, `owner`, `tags` and `links`.
- **FR-011**: A **view** MUST have `id`, `title` and `type` (`system`, `feature`, `infra` or `custom`), and MAY have `subtitleField` (which node field the canvas shows under the title: `tech`, `host`, `owner` or `none`), `feature` (feature id, for feature views), `includes` (the ids of the nodes it shows; absent means all), and `positions` (per-node position overrides keyed by node id).
- **FR-012**: A **feature** MUST have `id` and `title`, and MAY have `description` and `owner`.
- **FR-013**: A **flow** MUST have `id`, `title` and `steps` (an ordered list, possibly empty), and MAY have `feature` (feature id), `description`, `trigger`, `outcome`, `owner`, `tags` and `links`.
- **FR-014**: A **step** MUST have `id` and `edge` (edge id), and MAY have `title` (spec K-1), `condition`, `sla`, `rules` (rule ids), `payload` (text describing the data carried), `notes` (markdown), `ruleInputs` (sample inputs per attached rule: rule id → input column id → value text), `description`, `owner`, `tags` and `links`. Order is given by position in `steps`.
- **FR-015**: A **rule** (decision table) MUST have `title`, `hitPolicy` (`first`, `unique` or `collect`), `inputs` and `outputs` (ordered column lists, each column with its own `id` and a `label`) and `rows` (ordered; each row with `id`, `when` — one text cell per input column — and `then` — one text cell per output column), and MAY have `description`.
- **FR-016**: Validation MUST reject a rule row whose `when` cell count differs from the number of input columns, or whose `then` cell count differs from the number of output columns, with a message naming the rule id and row id.
- **FR-017**: A **sticky** MUST have `id` and `text` (markdown), MUST have an `anchor` (object id), a `position`, or both (with an anchor, the position is an offset from the anchor), and MAY have `color` (one of the DESIGN.md semantic tint names: `amber` — default —, `blue`, `green`, `clay`, `grey`).
- **FR-018**: A **link** (used on nodes, edges, flows, steps) MUST have `url` and MAY have `label`.
- **FR-019**: Every object type MUST reject keys it does not define (strict format, no silent extra data).

**Enumerations**

- **FR-020**: Node `type` MUST be one of: `client`, `gateway`, `service`, `queue`, `database`, `external` — the six kinds of the design, using the spec's names for `gateway` and `database` (design-analysis §g-4a). Any other value MUST be rejected.
- **FR-021**: Edge `protocol` MUST be one of: `http` (covers HTTPS), `grpc`, `event` (message brokers such as Kafka), `sql`, `websocket`, `other`. Product or transport specifics (e.g. "Kafka", "HTTPS") belong in the edge `label`; the UI may show friendly display names.
- **FR-022**: Version 1 MUST NOT define a step `branch` field (a step with `branch` is rejected as an unknown key). Branches (spec F-4) are added as an optional step field in 006 once designed; this is additive and needs no version bump.

**Readability, documentation, examples**

- **FR-023**: Every object type MUST have a documented fixed key order (id first, then identifying fields, then content, then references, then layout), and the example files MUST follow it.
- **FR-024**: Every field MUST have a human-readable description in the format definition, suitable for editor hover help and autocomplete.
- **FR-025**: The package MUST ship at least three valid examples: the existing minimal deck (updated to v1), a deck with one flow and one decision table attached to a step, and a full deck using every object type and optional field.
- **FR-026**: The package MUST ship invalid fixtures covering at least: missing required field per object type, unknown key per object type, bad enum value (kind, protocol, hit policy, view type, direction, level, sticky color), rule row cell-count mismatch, step without id, sticky with neither anchor nor position, bad id format, wrong version.
- **FR-027**: The published format definition and the app's generated validator MUST give the same verdict on every example and fixture (parity).
- **FR-028**: Validation errors from the app's validator MUST include the path to the offending value (e.g. `flows.0.steps.2.id`) and a readable message.
- **FR-029**: The test run MUST fail when the format definition changed but derived types/validators were not regenerated.
- **FR-030**: `docs/spec.md` §6 MUST use `https://sododeck.com/schema/v1.json`; `packages/schema/CLAUDE.md` "Status" MUST be updated; ADR 0004 MUST record the enum, position, decision-table, rule-list and branch decisions.

### Key Entities

- **Deck file**: the envelope; schema URL, version, optional name/description/tags, and the collections below.
- **Node**: a component of the system (client, gateway, service, queue, database, external); knowledge fields, optional group, parent node and level, optional position.
- **Group**: a named, optionally nested set of nodes; geometry derived, not stored.
- **Edge**: a directed (or two-way/undirected) connection between two nodes with a protocol and a label.
- **View**: a saved lens over the same model: type, which nodes it includes, subtitle field, position overrides.
- **Feature**: a business capability that groups flows.
- **Flow**: an ordered list of steps over existing edges, belonging to a feature.
- **Step**: one hop over an edge, with its own id, condition, SLA, attached rules, sample rule inputs, payload and notes (branches come in 006).
- **Rule**: a decision table (hit policy, input and output columns with ids, rows with ids and one cell per column), reusable across steps and nodes; keyed by id.
- **Sticky**: a markdown note, free (positioned) or anchored to an object, with a named color.
- **Link**: a URL with an optional label.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the design data fields in design-analysis §d (excluding those marked "not stored") have a documented place in the v1 format.
- **SC-002**: 100% of example files are accepted, and 100% of invalid fixtures are rejected, by both validators, with identical verdicts on every fixture.
- **SC-003**: Every invalid fixture's error message names the location of the problem (path) — verified for 100% of fixtures.
- **SC-004**: A reviewer unfamiliar with the app can explain what a full example deck models (nodes, flows, rules) from the file alone, using only the field descriptions.
- **SC-005**: Renaming any object in an example file changes exactly one line of that file and no other object.
- **SC-006**: A format change without regeneration is caught by the test run 100% of the time.
- **SC-007**: A deck file exported from the prototype's design data (Logistics Delivery: 6 groups, 20 nodes, 28 edges, 5 flows, 3 rules) can be expressed in v1 without dropping any field the editor displays.

## Assumptions

- Positions: stored on the node; views may override per node. Group bounds are derived, not stored (design-analysis §g-8).
- `rules` stays a map keyed by rule id (ADR 0002); steps and nodes reference rules by id lists.
- Decision-table cells are plain text; wildcard and comparison syntax (`≤ 5`, `Any`, `—`) is interpreted by the rule evaluator, not the format.
- `owner` is free text everywhere (design-analysis §g-10); there is no team list in the file.
- Theme, library metadata (folder, last edited, sample flag) and UI state (selection, collapsed groups, zoom) are not document data and are not in the file (constitution I, design-analysis §g-13).
- Edge `contract` (spec §6) and entity state machines, comments and ADR objects are not in v1; they can be added later as optional fields without a version bump (constitution II).
- Sticky colors reuse the DESIGN.md semantic tint names, so they follow the theme; exact visuals are decided in 009.
- Node `icon` stores a key from the app's icon set (lucide mapping from 000); the format accepts any non-empty text for it and does not list icons, so 000 can change its mapping freely.
- Adding enum values later is treated as an additive, non-breaking change in the ADR, but older app builds would reject such files; the ADR records this trade-off.
- Cross-field checks that the published format definition cannot express on its own (e.g. row cell counts) are still enforced identically by both validators; how is a planning decision.
- No new runtime dependency is expected; any tooling change is justified in `plan.md`.
