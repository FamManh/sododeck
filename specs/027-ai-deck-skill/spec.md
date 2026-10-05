# Feature Specification: AI deck skill

**Feature Branch**: `027-ai-deck-skill`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "027 from docs/backlog.md: AI deck skill (phase 1 first). A skill for the user's own AI agent that writes a valid `.sododeck` file (components, connections, groups, flows, rules) from a description, a codebase or another text format, or updates an existing deck, checks it with bundled `validate` / `lint` scripts that print fixable machine-readable errors, and hands over a file the user simply imports. The AI runs on the user's side; Sododeck never sends diagram content anywhere."

**Sources**: `docs/backlog.md` §027 (and 001, 005, 011, 012, 024, 025, 026, 056, 062); `specs/062-fixable-import-errors/` (problem entry shape, `contracts/problem-report.md`); `docs/file-format/problem-codes.md` (code catalogue, generated from `@sododeck/model`); ADR 0002 (JSON file format, public schema URL), ADR 0011/0012 (visible graph, saved views and layout), ADR 0013 (derived problems), ADR 0016 (export rendering), ADR 0020 (format revision), ADR 0039 (problem codes); AGENTS.md architecture rules 2, 3, 5; constitution v1.0.0 (II, III, IV, VI, VIII).

## Context (today)

- A user can already import a `.sododeck` file (005). When a file is refused, 062 lists every problem with a stable `code`, a JSON `path`, the `subject` id, `evidence` and a `fix`, and **Copy problems** copies them as JSON for the user's AI. The code catalogue is published in `docs/file-format/problem-codes.md`.
- The file format allows cards without positions. Mermaid import (056) lays such cards out before storing the deck, but importing a `.sododeck` file whose cards have no positions does **not** lay them out today: every unplaced card lands on the default spot.
- There is no guidance for an AI agent on how to write a good deck: which card types and levels exist, how flows must follow real connectors, how rules attach to steps, how to keep ids stable. Agents that try today guess the format and produce decks that are refused or crowded.

## Scope

The feature is delivered in three phases. This spec covers all three so the plan can sequence them; **phase 1 is built first** and is a complete, shippable product on its own.

**In scope**

- **Phase 1, core**
  - A **skill package** (`sododeck-deck`): plain Markdown instructions plus small self-contained scripts, usable by any agent that can read files and run a script (agent "skills" folders, or an `AGENTS.md`-style prompt pointing at it).
  - **Progressive disclosure**: a short entry file routes the agent to exactly one reference for the task (modelling, flows, rules, database, taste); a flow-only edit never needs the database reference.
  - **From a description** mode (the default) and **update an existing deck** mode.
  - Scripts: **validate** (file-format check), **lint** (meaning checks), **summary** (short outline of a deck), **diff** (compare two decks by id).
  - **Fixable, machine-readable errors** from validate and lint, in the same entry shape and with the same codes as the app (062), plus a plain-text form for people.
  - **Repair loop and atomic delivery**: the agent fixes and re-checks until both pass, and only then replaces the target file.
  - **Detail and audience dials**, **taste rules**, **only declared structure**.
  - At least **three worked example decks**.
  - **Generated, not hand-kept**: a build step in this repo writes the skill's schema, examples, codes and format revision from the schema and model packages; a test fails when they drift.
  - **App side**: a deck file whose cards have no positions is laid out automatically on import, the same way a Mermaid import is.
  - A **docs page** on the marketing site: install the skill, prompt examples per mode, import the result.
- **Phase 2, other inputs**
  - **From a codebase** mode (services, queues, databases, calls) with **source links** on every component and connector built from code.
  - **From text formats** mode (Mermaid, C4 text, OpenAPI).
  - A **fidelity report** at the end of both modes: what was merged, collapsed, left out or could not be mapped (same four groups as 062).
- **Phase 3, render self-check**
  - An optional **render** script that lays the deck out and renders it to a PNG with the app's own layout and export, and prints a geometry report (overlaps, clipped labels, connectors crossing cards, crowded groups, views over budget). Skipped cleanly when no headless browser is installed.

**Out of scope**

- Any AI feature inside the app or any hosted AI (would send content; needs its own decision).
- An MCP server and a `sododeck` command-line tool (AI-3, later; these scripts are a starting point).
- Changing the file format: no schema change is needed (source links use the existing `links`, evidence uses the existing `note`).
- New app-side problems-list rules; the skill's extra authoring checks run in the skill only (their codes are still catalogued so they never clash).
- Pasting a deck fragment into an open deck (026), kind packs beyond what the format already has (024).
- Editing a deck from JSON inside the app (004).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Generate a deck from a description and import it (Priority: P1)

A user installs the skill in their AI agent and writes "an e-commerce checkout with web, API gateway, order service, payment provider, Kafka and Postgres, plus the checkout flow". The agent reads the skill, writes a deck, runs validate and lint, fixes what they report, and hands over a file. The user imports it in Sododeck: the cards are laid out, connected, grouped, and the checkout flow plays step by step.

**Why this priority**: This is the whole promise of the feature: "describe it, import it". Every other story builds on the package, the checks and the import.

**Independent Test**: Run an agent with only the skill and the prompt above; the produced file passes validate and lint, imports without the problems dialog, opens laid out, and its flow plays from first to last step.

**Acceptance Scenarios**:

1. **Given** the skill and the checkout prompt, **When** an agent runs it, **Then** it writes a file that passes validate and lint and imports without errors.
2. **Given** that file imported, **When** opened, **Then** every card is placed by automatic layout (no two cards stacked on the same spot) and the checkout flow plays step by step along existing connectors.
3. **Given** a request with no positions given, **When** the agent writes the deck, **Then** it omits positions for every card (it never invents coordinates), and lint accepts that.
4. **Given** the prompt mentions only some calls between services, **When** the agent writes the deck, **Then** it adds connectors only for calls the description states, and its handover lists anything it assumed.
5. **Given** a description larger than the chosen detail level allows in one view, **When** the agent writes the deck, **Then** it splits the system into groups and levels so no single view exceeds the budget.

---

### User Story 2 - Fix a broken deck from machine-readable errors (Priority: P1)

The agent writes a deck with a mistake: a flow step points to a connector that does not exist, an id is used twice, a field has the wrong type. Validate and lint print one entry per problem with a code, a location, the object id, what was found and how to fix it. The agent fixes them and runs the checks again until both pass. The target file is only replaced once they pass.

**Why this priority**: AI-written decks will contain mistakes; the repair loop is what makes the output reliable. It ships with Story 1.

**Independent Test**: Run lint on a deck with a dangling flow step; it prints a JSON entry with `code`, `path`, `subject`, `evidence` and `fix` and exits non-zero. Fix it; lint exits zero.

**Acceptance Scenarios**:

1. **Given** a deck with a dangling flow step, **When** lint runs, **Then** it prints an entry with `code`, `path`, `subject`, `evidence` and `fix`, and exits non-zero.
2. **Given** a deck violating the file format (missing required key, wrong type, unknown key), **When** validate runs, **Then** each violation is one entry using the same generic schema codes the app uses (`schema-required`, `schema-type`, `schema-unknown-field`, …) with the exact path.
3. **Given** a problem the app also reports (broken reference, duplicate id, step without connection, …), **When** validate or lint reports it, **Then** it uses the app's code and fix hint for it, so the app's **Copy problems** and the skill's output read the same.
4. **Given** a valid, clean deck, **When** validate and lint run, **Then** both exit zero and say so in one line.
5. **Given** the agent's draft still fails a check, **When** the agent delivers, **Then** the existing target file is untouched and the draft stays in a temporary file.
6. **Given** a person runs the scripts, **When** they ask for plain text, **Then** the same problems print as readable lines instead of JSON.

---

### User Story 3 - Update an existing deck without breaking it (Priority: P2)

A user gives the agent their exported deck and asks "add a refund flow". The agent changes only what was asked: the new flow, and any connector or card it truly needs. Every existing object and id stays as it was. Before handing over, the agent runs diff and shows what was added, changed and removed.

**Why this priority**: Decks are living documents; regenerating from scratch would break ids, views and links the user built by hand. Second only to creating a deck.

**Independent Test**: Give the agent a sample deck and "add a refund flow"; diff between the old and new file lists only additions for the refund flow; every old id is present and unchanged.

**Acceptance Scenarios**:

1. **Given** an existing deck and the prompt "add a refund flow", **When** the agent runs update mode, **Then** diff shows only additions for the refund flow and every existing id is unchanged.
2. **Given** a request to rename a card, **When** the agent updates the deck, **Then** diff shows one changed title on the same id; nothing that referenced the card changes.
3. **Given** an updated deck, **When** diff runs, **Then** it lists added, changed (with the changed fields) and removed objects by id, in a stable order, as JSON and as plain text.
4. **Given** a request that would remove objects, **When** the agent prepares the update, **Then** diff shows the removals and the agent states them explicitly in its handover.
5. **Given** an existing deck with hand-placed positions, **When** the agent adds new cards, **Then** existing positions are kept and new cards are left without positions so the app places them on import.

---

### User Story 4 - Read a deck quickly (Priority: P2)

Before editing, or when asked "what's in this deck?", the agent runs summary and gets a short outline: groups and their cards, connectors, flows with their steps, rules and where they attach, counts per view. It uses that instead of reading the whole file.

**Why this priority**: Keeps update mode cheap and accurate on large decks; small on its own.

**Independent Test**: Run summary on a sample deck; the outline names every group, card, flow and rule by id and title, and fits on one screen for a 30-card deck.

**Acceptance Scenarios**:

1. **Given** a deck, **When** summary runs, **Then** it prints groups with their cards, flows with their ordered steps (from → to), rules with what they attach to, and totals.
2. **Given** a deck with problems, **When** summary runs, **Then** it still prints the outline and a one-line count pointing to lint.

---

### User Story 5 - Generate a deck from a codebase or a text format (Priority: P3, phase 2)

A user points their agent at a repository, or pastes a Mermaid diagram, C4 text or an OpenAPI file. The agent builds a deck from what it actually finds. Every component and connector built from code carries a link to the file and lines at a fixed commit. The run ends with a fidelity report listing what was merged, collapsed, left out or could not be mapped.

**Why this priority**: High value for engineers, but phase 1 must exist first, and it is the hardest to make faithful.

**Independent Test**: Run codebase mode on a small sample repository with two services, a queue and a database; every connector has a source link that opens the right lines; the run ends with a fidelity report.

**Acceptance Scenarios**:

1. **Given** a codebase, **When** the agent runs codebase mode, **Then** every connector has a source link and the run ends with a fidelity report.
2. **Given** a call the agent could not trace to code, **When** it builds the deck, **Then** it does not add that connector and lists it in the fidelity report under "could not map".
3. **Given** a Mermaid flowchart, C4 text or an OpenAPI file, **When** the agent runs text-format mode, **Then** the deck passes validate and lint and the fidelity report lists every construct that did not come across one-to-one.
4. **Given** codebase mode, **When** lint runs, **Then** a connector without a source link is reported.

---

### User Story 6 - Visual self-check before handover (Priority: P4, phase 3)

When a headless browser is available on the user's machine, the agent renders the deck to a PNG with the app's own layout and export, reads a geometry report, fixes crowding (grouping, levels, shorter labels) and renders again. When none is available, the step is skipped and validate + lint remain the gate.

**Why this priority**: The app already draws the model; this is a final look, not the core. Most value comes from Stories 1–3.

**Independent Test**: Run render on a sample deck with a browser present: a PNG and a geometry report are written; without a browser: a clear "skipped" message and success.

**Acceptance Scenarios**:

1. **Given** a headless browser is available, **When** render runs, **Then** it writes a PNG that matches the app's export of the same deck and a geometry report as JSON.
2. **Given** none is available, **When** render runs, **Then** it exits successfully with a clear "skipped" message.
3. **Given** a deck with two overlapping cards or a view over its budget, **When** render runs, **Then** the geometry report lists each case with the ids involved and a fix hint.

---

### Edge Cases

- **Mixed positions**: some cards have positions and some do not. Lint warns (positions should be set for all cards or none), except in update mode where new cards without positions next to existing placed cards are expected; on import the app places only the unplaced cards and keeps the placed ones.
- **Deck too large for the detail level**: lint warns per view over budget with the count and the budget; the agent splits into groups or levels.
- **Ids derived from titles** (e.g. `order-service-v2-new` from "Order Service v2 (new)"): lint warns on long or title-shaped ids (a short slug such as `api` is fine); ids are chosen once and never changed on rename.
- **Duplicate titles inside one group**: lint warns.
- **Orphan components** (no connector at all): lint warns unless the card is in a group, has cards below it, or is touched by a flow; an intended loner is named in the handover.
- **Labels over the length budget**: lint warns with the length and the budget; details belong in the note and fields.
- **Newer file format**: a deck written for a newer format version is reported (`unsupported-version`), and the agent is told to update the skill.
- **Skill older than the app**: the skill states the format version and schema fingerprint it was built for (the format revision of 025 once it exists); the docs page always offers the latest build.
- **Very many problems**: output follows 062's limits and order (deterministic, by location in the file, then code).
- **Huge input** (large codebase): the agent picks the chosen detail level and reports what it collapsed in the fidelity report instead of producing a crowded deck.
- **Agent without script execution**: the skill still explains the format and taste rules; the user's import (062 dialog with **Copy problems**) becomes the check, and the docs page says so.
- **No network**: all scripts work offline; nothing they do sends deck content anywhere.

## Requirements _(mandatory)_

### Functional Requirements

**Skill package**

- **FR-001**: The skill MUST be a folder of plain Markdown instructions, reference files, the file-format schema, example decks and scripts, usable by any agent that can read files and run a script, with no install step beyond copying the folder and having a JavaScript runtime.
- **FR-002**: The entry file MUST be short and act as a router: it names the modes and points to the one reference each task needs. References MUST cover: modelling (card types and levels, groups, id rules, when to omit positions), flows (steps, branches, touches, playback), rules (decision tables), database (tables, relationships), taste, and, in phase 2, codebase and text formats.
- **FR-003**: The skill MUST include at least three example decks (phase 1) that pass validate and lint, covering at least: a service architecture with a flow, a deck with a decision rule on a step, and a grouped multi-level system.
- **FR-004**: The skill's schema, examples, problem codes, fix hints and format revision MUST be generated from this repository's schema and model packages by a build step, never edited by hand. A test MUST fail when the generated skill differs from what the build would produce.
- **FR-005**: The skill's scripts MUST work offline and MUST NOT send deck content or anything else over the network (constitution IV).

**Modes**

- **FR-006**: **From a description** (default): the agent writes a new deck from the user's words, using the detail and audience dials, the taste rules and the modelling references.
- **FR-007**: **Update an existing deck**: the agent MUST change only what was asked, MUST keep every other object and every existing id unchanged (constitution III), MUST keep existing positions, and MUST show the diff summary (added, changed, removed) before handing over the file.
- **FR-008**: (phase 2) **From a codebase**: the agent builds components and connectors from services, queues, databases and calls it finds, and attaches a source link (`file#Lstart-Lend` at a fixed commit) in each component's and connector's links.
- **FR-009**: (phase 2) **From text formats**: the agent converts Mermaid, C4 text and OpenAPI into a deck.
- **FR-010**: (phase 2) Codebase and text-format modes MUST end with a fidelity report in four groups, **merged**, **collapsed**, **left out**, **could not map**, so nothing is dropped silently.

**Checks and errors**

- **FR-011**: **validate** MUST check a file against the file format and the load checks the app applies (ids unique, connector ends unambiguous, pictures consistent) and report every problem in one pass.
- **FR-012**: **lint** MUST report every problem the app's problems list would report for the deck (same codes, same severities, same fix hints), plus the skill's authoring checks: ids that look derived from titles, mixed positions, orphan components, duplicate titles in a group, labels over budget, views over the detail budget and, in codebase mode, connectors without a source link.
- **FR-013**: Every problem MUST be printed in 062's problem entry shape (`code`, `severity`, `path`, `subject`, `message`, `evidence`, `fix`) inside 062's report shape, as JSON by default, and as plain text on request.
- **FR-014**: Where a problem has an app code, the skill MUST use it. New authoring-check codes MUST be added to the same published catalogue, in their own section, so codes never clash and never change meaning.
- **FR-015**: validate and lint MUST exit non-zero when any problem of severity `error` is found and zero otherwise; warnings are printed and the instructions tell the agent to clear them or state them in its handover.
- **FR-016**: The instructions MUST tell the agent to write to a temporary file, loop on validate and lint until both pass, and only then replace the target file, so a failing draft never overwrites a good deck.

**Summary and diff**

- **FR-017**: **summary** MUST print a short outline of a deck: deck name, groups with their cards, connectors, flows with ordered steps, rules and what they attach to, views, and totals.
- **FR-018**: **diff** MUST compare two decks by object id and list added, changed (with the changed fields) and removed objects per collection, in a stable order, as JSON and plain text. Objects are matched by id only, never by title.

**Quality of the model**

- **FR-019**: Detail dial: `faithful` (at most 24 components per view), `balanced` (at most 12, default) and `simplified` (at most 7). Audience dial: `engineer` (default), `mixed`, `executive`; it changes wording and which fields are filled, not the structure rules. Larger systems MUST be split into groups and levels rather than one crowded view.
- **FR-020**: Taste rules MUST be written down for the agent: shape follows meaning (a fan-out is a group with many connectors, a sequence is a flow, a decision is a rule rather than a diamond card); every card earns its place; one accent colour for at most two focal cards; short labels, details in notes and fields.
- **FR-021**: Only declared structure: the agent MUST NOT invent connectors, calls or components that are not in the description or the code. In codebase mode this is checked by the source-link rule (FR-012).
- **FR-022**: Evidence in notes: the instructions MUST tell the agent to put real payloads or short code excerpts in a card's or step's note when they explain it better than prose.
- **FR-023**: New decks MUST omit positions unless the user gave them; ids MUST be short slugs that are unique in their collection and never derived from titles.

**App side**

- **FR-024**: When a `.sododeck` file is imported and some or all of its cards have no position, the app MUST place the unplaced cards with its automatic layout before the deck is stored, keeping every card that has a position where it is. Layout runs off the main thread, as for Mermaid import. A deck where every card is placed imports exactly as today.
- **FR-025**: A deck that passes validate and lint MUST open with every flow playable from its first to its last step; the example decks are imported and played in the repository's tests to prove it.

**Render self-check (phase 3)**

- **FR-026**: **render** MUST lay the deck out and draw it to a PNG with the app's own layout and export code, on the user's machine, with no network.
- **FR-027**: render MUST also print a geometry report in the problem entry shape: overlapping cards, clipped or truncated labels, connectors crossing cards, crowded groups, views over budget, each with the ids involved and a fix hint.
- **FR-028**: When no headless browser is available, render MUST exit successfully with a clear "skipped" message. validate and lint remain the required gate.
- **FR-029**: How the app's layout and export are packaged into the skill MUST be recorded as an ADR before phase 3 is built.

**Docs and distribution**

- **FR-030**: A docs page on the marketing site MUST explain how to install the skill in common agents, give prompt examples per mode (description, update, and in phase 2 codebase and text formats), and how to import the result and paste import problems back to the agent.
- **FR-031**: The skill MUST state the format revision it was generated for, and the docs page MUST offer the latest version as a download.

### Key Entities

- **Skill package**: the folder an agent reads: entry router, references, schema, examples, scripts, format revision.
- **Mode**: the task type (from description, update, from codebase, from text format); decides which reference the agent reads.
- **Problem entry / problem report**: 062's shape, reused by validate, lint and render; codes come from the shared catalogue.
- **Authoring check**: a skill-only lint rule (id style, mixed positions, orphans, duplicate titles, label length, view budget, source links), catalogued with its own code.
- **Deck diff**: per collection, the added, changed (with fields) and removed objects between two decks, matched by id.
- **Deck summary**: the short outline of a deck.
- **Fidelity report**: (phase 2) what an input lost on the way, in four groups.
- **Geometry report**: (phase 3) layout problems found in the rendered deck.
- **Dials**: detail (`faithful` / `balanced` / `simplified`) and audience (`engineer` / `mixed` / `executive`).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: With only the skill and the checkout prompt, an agent produces a deck that passes validate and lint and imports without the problems dialog in at least 9 of 10 runs.
- **SC-002**: A user goes from prompt to an opened, laid-out deck with a playable flow in under 5 minutes, without editing the file by hand.
- **SC-003**: In update mode on the sample decks, 100% of existing ids are unchanged and diff shows no changes outside the requested area.
- **SC-004**: Every problem the scripts report carries a code, a location and a fix hint (100%), and every code that also exists in the app reads identically in both.
- **SC-005**: An imported deck without positions has no two cards overlapping after import.
- **SC-006**: The generated skill never drifts from the app: a format or code change that is not regenerated fails the repository checks every time.
- **SC-007**: For a phase-1 task, the agent reads the entry file plus at most one reference (measured on the example prompts).
- **SC-008**: The scripts make zero network requests (verified offline).
- **SC-009**: (phase 2) Every connector built in codebase mode has a source link that opens the right file and lines; every run ends with a fidelity report.
- **SC-010**: (phase 3) render produces a PNG identical in layout to the app's export of the same deck, or a "skipped" result, in 100% of runs.

## Assumptions

- **Phase order**: phase 1 (Stories 1–4, FR-001–007, 011–025, 030–031) is planned and built first; phases 2 and 3 follow as separate increments of the same feature.
- **Runtime**: the scripts need a current JavaScript runtime (the same major versions the repo supports) and nothing else; dependencies such as the schema validator are bundled into the scripts.
- **Location and distribution**: the skill's sources live in a workspace package (`packages/skill`); every build writes the finished skill folder and a download archive, which the docs page offers. Nothing generated is committed (plan research R1). Whether it also gets its own public repository is decided with the open-source question; nothing in this spec depends on it.
- **Lint reuses the app's logic**: the skill's lint runs the same derived-problems logic as the app (ADR 0013) from the model package, bundled at build time, so the two cannot disagree.
- **Warnings don't fail the gate**: only `error` problems make validate or lint exit non-zero; authoring checks are warnings by default. Codes and severities are fixed in the plan.
- **Import layout**: placing unplaced cards on `.sododeck` import reuses the existing automatic layout used by Mermaid import, with placed cards kept fixed; no new setting.
- **Schema URL**: the public schema URL planned in ADR 0002 (`https://sododeck.com/schema/v1.json`) is referenced by the skill but the skill bundles its own copy, so it never needs to fetch it.
- **No schema change**: source links and evidence use existing `links` and `note` fields.
- **Agents named in docs**: the docs page may name AI agents and their skill folders (they are not diagram or database tools); it does not name other diagram tools.
- **Success measurement**: SC-001 and SC-002 are measured by running the example prompts with an agent during acceptance, not by telemetry (nothing is collected).
