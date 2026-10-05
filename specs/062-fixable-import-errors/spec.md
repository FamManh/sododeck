# Feature Specification: Fixable import errors

**Feature Branch**: `062-fixable-import-errors`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "062 from docs/backlog.md: fixable import errors. When an import fails or is partial, the user can copy the problems and paste them back to their AI to fix the file (pairs with 027). Every schema or lint problem has a stable `code`, a JSON `path`, the `subject` id and a `fix` hint (same codes as the skill's `lint.mjs`); 'Copy problems' copies them as JSON; imports from other formats (056) end with a fidelity report: what was merged, collapsed, left out or not supported, never silent."

**Sources**: `docs/backlog.md` §062 and §027 (AI deck skill: fixable, machine-readable errors, fidelity report); `specs/005-local-library-autosave/` (deck import, error toast); `specs/056-file-format-and-mermaid-import/` (Mermaid import report); `specs/044-db-import/` (SQL / DBML import report); `docs/decisions/0013-derived-problems.md` (problems list); AGENTS.md architecture rules 2, 3, 5; constitution v1.0.0 (II, III, IV, VII).

## Context (today)

- Opening an invalid deck file shows one toast, "That file is not a valid .sododeck file", and the details the app already found (which field, what is wrong) are thrown away. The user cannot tell their AI what to fix.
- A deck file with damaged pictures opens, but the toast only gives a count ("N pictures are missing").
- Mermaid import (056) and SQL / DBML import (044) already list skipped lines with reasons, but the lists cannot be copied and they use different words for the same idea.
- The problems list on an open deck (ADR 0013) has stable kinds, but no file location and no copy.

## Scope

**In scope**

- **Problem entries**: one shared shape for every problem found while importing a deck file and for every problem in the open deck's problems list: a stable `code`, a `severity`, a `path` into the file, the `subject` object id (when there is one), a short human `message`, the `evidence` found, and a `fix` hint.
- **Import problems dialog**: a deck file that cannot be opened shows a dialog listing every problem found (not a toast), with **Copy problems**. Nothing is added to the library, as today.
- **Partial deck import**: a deck that opens with repairs (damaged pictures) or with problems in the problems list says so once after opening, and the details are one click away with **Copy problems**.
- **Copy problems** in the problems panel of an open deck, so the user can hand the whole list to their AI.
- **Fidelity report** for imports from other formats (Mermaid 056, SQL / DBML 044): every input construct that did not come across one-to-one is reported in one of four groups, **merged**, **collapsed**, **left out**, **not supported**, with **Copy report**. Never silent.
- **Code catalogue**: the list of problem codes, their meaning and their fix hint is published as part of the file-format documentation, so the AI deck skill (027) can use the same codes. Codes never change meaning once released.

**Out of scope**

- The AI deck skill itself and its `validate` / `lint` scripts (027); this feature only defines the codes and shape they will reuse.
- Fixing a file inside the app (an "auto-fix" button on import errors); the app reports, the user's AI fixes.
- Editing the deck from JSON (backlog 004).
- Paste of a deck fragment that is invalid (silently ignored today; belongs to 026 paste-a-deck).
- New lint rules beyond those that exist today (the problems list kinds and the file checks).
- Sending problems anywhere: copying goes to the user's clipboard only (constitution IV).

## Clarifications

### Session 2026-10-05

- Q: A valid deck file with broken references (connector or flow step pointing to a missing id): refuse the whole file, or open it without the broken parts? → A (revised the same day, after reading the code): Keep today's behaviour. The file format allows broken references (002, `load.test.ts` "loads a file with dangling references"), so such a file opens unchanged, nothing is dropped or rewritten, and its broken references appear as problems-list entries (`broken-reference`, `step-without-connection`, …) behind the "Opened with N problems" notice with Copy problems. Only files the app cannot load at all (not JSON, newer version, schema violations, duplicate or ambiguous ids) are refused. The first answer ("refuse") rested on the wrong premise that refusing was today's behaviour.
- Q: Should the "Opened with N problems" notice also fire for problems-list entries, or only for damaged pictures? → A: Fire for damaged pictures and for problems-list entries of severity `error` or `warning`; `info` entries never trigger it (today every problems-list kind is `error` or `warning`, so in practice all count).
- Q: Schema violations: generic codes per violation type, or a specific code per field / object kind? → A: Generic codes per violation type (`schema-required`, `schema-type`, `schema-enum`, …) with an exact `path`; the `fix` hint is built from the field name and allowed values in the schema. Semantic problems (broken reference, duplicate id, problems-list kinds) keep one specific code each.
- Q: What does Copy problems put on the clipboard: plain JSON, or JSON with a one-line instruction for the AI? → A: Plain, valid JSON only; no instruction text. Prompt wording for the AI lives in the docs and the AI deck skill (027).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Copy why a deck file was refused (Priority: P1)

A user asked their AI for a deck and imports the file. It is refused. Instead of a vague toast, they see the list of problems (for example "`/nodes/3/kind`: expected one of …" or "id `api` is used twice") and press **Copy problems**, paste the result into their AI chat, get a fixed file and import it.

**Why this priority**: This is the core loop of 027 (generate → import → fix). Without it the user has nothing to tell their AI.

**Independent Test**: Import a file with a known schema error and a duplicate id; the dialog lists both with code, path, subject and fix; the clipboard holds valid JSON with the same entries.

**Acceptance Scenarios**:

1. **Given** a deck file where a component is missing its required `title` and another has an id already used, **When** the user imports it, **Then** a dialog titled with the file name says the deck could not be opened, lists the problem with its message, location and fix hint, and nothing is added to the library.
2. **Given** that dialog, **When** the user presses **Copy problems**, **Then** the clipboard holds JSON with the file name, the file-format version the app expects, and one entry per problem with `code`, `severity`, `path`, `subject`, `message`, `evidence` and `fix`, and a confirmation "Copied" is shown.
3. **Given** a file that is not JSON at all, **When** imported, **Then** the dialog shows one problem with code `invalid-json`, the line and column of the first error, and a fix hint.
4. **Given** a file written for a newer file-format version, **When** imported, **Then** the dialog shows one problem with code `unsupported-version`, the version found and the version supported.
5. **Given** a file with 40 problems, **When** imported, **Then** every problem is listed (scrollable) and every problem is in the copied JSON, in a stable order (by location in the file).

---

### User Story 2 - See what an imported deck lost or needs (Priority: P2)

A user imports a deck that opens, but some pictures were damaged, or the deck has problems such as a flow step that does not follow a connector. They are told once, can see each item, and can copy the list for their AI.

This is also where broken references end up (a connector or flow step pointing to a missing id): the file format allows them, so the deck opens unchanged and they are listed as problems.

**Why this priority**: A "successful" import that quietly loses or breaks things is worse than a refusal; it erodes trust in AI-made decks.

**Independent Test**: Import a deck with one damaged picture and one broken flow chain; a notice appears after opening; the details list both; **Copy problems** copies both as JSON.

**Acceptance Scenarios**:

1. **Given** a deck file with two damaged pictures, **When** imported, **Then** the deck opens and a notice says "Opened with 2 problems", and **Show** lists each picture by name or id with the reason (for example "data does not match its size").
2. **Given** a deck that opens with problems-list entries of severity error or warning (for example a missing rule), **When** imported, **Then** the same notice counts them, and **Show** opens the problems panel; entries of severity info are not counted.
3. **Given** the problems panel of any open deck, **When** the user presses **Copy problems**, **Then** the clipboard holds the same JSON shape as in Story 1, one entry per listed problem, each with `path` pointing to the object in the deck file.
4. **Given** a deck that opens with no problems and no repairs, **When** imported, **Then** no notice is shown (today's behaviour).

---

### User Story 3 - Fidelity report for Mermaid and SQL / DBML imports (Priority: P3)

A user imports a Mermaid flowchart or a SQL schema. When it is done, a report tells them exactly what was merged, collapsed, left out or not supported, line by line, and they can copy it.

**Why this priority**: Both imports already list skipped lines; this makes the words the same, makes nothing silent, and adds copy. Smaller gap than Stories 1–2.

**Independent Test**: Import a Mermaid flowchart with a style line, a subgraph inside a subgraph and a click handler; the report lists each line under the right group; **Copy report** copies them as JSON.

**Acceptance Scenarios**:

1. **Given** a Mermaid flowchart with styling lines, **When** imported, **Then** the report lists them under **left out** with line numbers and the reason (appearance is not imported).
2. **Given** a Mermaid flowchart with a nested subgraph, **When** imported, **Then** the report lists it under **collapsed** (flattened into its parent group).
3. **Given** a SQL schema with a statement type the importer does not read, **When** imported, **Then** the report lists it under **not supported** with its line and excerpt.
4. **Given** an input where two declarations become one object (for example the same table declared twice), **When** imported, **Then** the report lists it under **merged** with both line numbers.
5. **Given** any import report, **When** the user presses **Copy report**, **Then** the clipboard holds JSON with the source format, counts of what was created, and one entry per reported item with `code`, `group`, `line`, `excerpt`, `message` and, when it applies, a `fix` hint.
6. **Given** an input where everything came across one-to-one, **When** imported, **Then** the report says so explicitly ("Everything was imported") rather than showing nothing.

---

### Edge Cases

- **Very many problems** (e.g. a file with 10,000 broken references): the dialog stays responsive by showing the first 500 entries with "and N more"; the copied JSON holds all of them up to 5,000 entries and states how many were left out beyond that.
- **Clipboard unavailable or denied**: **Copy problems** shows "Couldn't copy" and offers the same JSON in a selectable text box, so the user can copy it by hand.
- **Long evidence** (a huge string field): evidence is trimmed to 200 characters in both the list and the copy, marked as trimmed.
- **Problem without a subject** (e.g. invalid JSON, wrong root type): `subject` is empty / absent, `path` points at the root or the line.
- **Several files dropped at once**: unchanged from today (one file at a time; several → toast, nothing added).
- **Problems that depend on other problems** (a dangling flow step because a connector id is misspelled): the deck opens; the problems list reports them as it does today (ADR 0013 already folds one cause into one problem where it can).
- **Old `.sododeck.json` files**: same dialog, same codes.
- **Same file imported twice**: the same problems in the same order with the same codes and paths (deterministic).
- **Privacy**: problem entries contain ids and short evidence from the user's own file; they go only to the clipboard on an explicit user action; nothing is logged or sent (constitution IV).

## Requirements _(mandatory)_

### Functional Requirements

**Problem entries**

- **FR-001**: Every problem found when reading a deck file (not JSON, wrong version, schema violation, duplicate id, broken reference, damaged picture) and every entry in the problems list of an open deck MUST be described by one shared problem entry: `code`, `severity` (`error` refuses the file, `warning` opens with a notice, `info`), `path`, `subject`, `message`, `evidence`, `fix`.
- **FR-002**: `code` MUST be a short, stable kebab-case identifier. Existing problems-list kinds (ADR 0013) MUST keep their current names as their codes. A released code MUST NOT be renamed or reused for a different meaning; retired codes stay listed as retired.
- **FR-003**: `path` MUST point to the offending value in the file using a standard JSON Pointer (e.g. `/flows/0/steps/2/edge`), or to line and column when the file is not readable JSON.
- **FR-004**: `subject` MUST be the stable id of the object the problem belongs to whenever one exists (never a title).
- **FR-002a**: Schema violations MUST use a small set of generic codes, one per violation type (e.g. `schema-required`, `schema-type`, `schema-enum`, `schema-pattern`, `schema-unknown-field`), never one code per field or object kind; the exact field is given by `path`. Semantic problems (broken reference, duplicate id, damaged picture, each problems-list kind) MUST each have their own specific code.
- **FR-005**: `fix` MUST be a one-sentence instruction a person or an AI can act on (e.g. "Point `edge` to an existing connector id, or remove this step"). Every code MUST have a fix hint.
- **FR-006**: Problem entries MUST be produced in a deterministic order (by position in the file, then code) so the same file always yields the same list.

**Refused deck files**

- **FR-007**: When a deck file cannot be opened, the app MUST show a dialog (not only a toast) with the file name, the number of problems and the list of problems, each showing its message, location and fix hint.
- **FR-008**: The app MUST collect all problems it can find in one pass rather than stopping at the first, so the user's AI can fix them in one round.
- **FR-009**: The dialog MUST offer **Copy problems**, which copies a JSON document holding: the file name, the file-format version the app supports, the app's revision, the counts per severity, and the list of problem entries.
- **FR-010**: A refused file MUST still add nothing to the library and leave the open deck untouched (today's behaviour). A file is refused only when it cannot be loaded at all: not JSON, a newer format version, a schema violation, or duplicate / ambiguous ids. Broken references (a connector, flow step, rule, group or view pointing to a missing id) MUST NOT refuse the file: it opens unchanged, nothing is dropped or rewritten, and they are reported as problems-list entries (FR-011). Only damaged pictures are repaired on open, and each is reported.

**Decks opened with problems**

- **FR-011**: When a deck opens but pictures were repaired or the problems list has entries of severity `error` or `warning`, the app MUST show one notice after opening with the count of those and a **Show** action; `info` entries MUST NOT trigger or be counted in the notice. Damaged pictures MUST each be listed with name or id and reason.
- **FR-012**: The problems panel MUST offer **Copy problems** with the same JSON shape as FR-009 (file name replaced by the deck name).

**Fidelity report (other formats)**

- **FR-013**: Every import from another format (Mermaid, SQL, DBML) MUST end with a report that sorts every construct that did not come across one-to-one into exactly one of four groups: **merged**, **collapsed**, **left out**, **not supported**.
- **FR-014**: Each report item MUST carry a stable `code`, its group, the input line (and excerpt), a human message and, where the user can change the input to get a better result, a fix hint. Existing skip and change reasons of 044 and 056 MUST be mapped to these groups without losing information.
- **FR-015**: The report MUST show counts of what was created and MUST state explicitly when nothing was lost.
- **FR-016**: The report MUST offer **Copy report**, copying the source format, counts and items as JSON.

**Copy behaviour and catalogue**

- **FR-017**: All copy actions MUST work from the keyboard, announce success to assistive technology, and fall back to a selectable text box when the clipboard is unavailable.
- **FR-018**: Every copy action (Copy problems, Copy report) MUST put only valid, pretty-printed JSON on the clipboard, with no surrounding instruction or prose, limited as described in Edge Cases. Suggested wording for asking an AI to fix the file is published in the docs, not added to the copy.
- **FR-019**: The full list of codes with meaning, severity and fix hint MUST be published in the file-format documentation and kept as a single source that both the app and the AI deck skill (027) use; a check MUST fail when a code is used that is not in the catalogue or a catalogue entry has no fix hint.
- **FR-020**: No problem entry, report or copied text may be sent over the network or written to logs or telemetry.

### Key Entities

- **Problem entry**: one thing wrong with a deck file or open deck. Attributes: code, severity, path, subject id, message, evidence, fix hint.
- **Problem report**: what **Copy problems** produces. Attributes: source (file name or deck name), supported file-format version, app revision, counts per severity, entries, number of entries left out.
- **Fidelity item**: one input construct that did not come across one-to-one. Attributes: code, group (merged / collapsed / left out / not supported), line, excerpt, message, optional fix hint.
- **Fidelity report**: what an import from another format ends with. Attributes: source format, counts created, items, "nothing lost" flag.
- **Code catalogue**: the stable list of problem and fidelity codes with meaning, default severity and fix hint; shared with the AI deck skill (027).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of reasons a deck file can be refused produce at least one problem entry with a code, a path and a fix hint; no refused import ends with only a generic message.
- **SC-002**: For a set of at least 10 broken sample decks (one per common mistake: dangling connector, dangling flow step, duplicate id, missing required field, wrong value type, unknown kind, newer version, not JSON, damaged picture, broken rule reference), pasting the copied problems into an AI assistant leads to a file that imports cleanly within two rounds for at least 9 of them.
- **SC-003**: The same file imported twice yields byte-identical copied problem lists (ignoring nothing but the copy time, which is not included).
- **SC-004**: The problems dialog for a file with 10,000 problems opens in under 1 second and stays responsive.
- **SC-005**: Every construct in the 044 and 056 test inputs that does not map one-to-one appears in exactly one fidelity group; zero silent drops in those test suites.
- **SC-006**: Copying works with keyboard only and is announced by a screen reader in all three places (refused file, problems panel, fidelity report).

## Assumptions

- The feature directory uses the backlog number (062) like the other features, not the next free sequential number.
- Problem codes for file checks are new (e.g. `invalid-json`, `unsupported-version`, the generic `schema-*` codes of FR-002a, `duplicate-id`, `broken-reference`, `picture-damaged`); problems-list codes are the existing ADR 0013 kinds unchanged. Final names are fixed in the plan and catalogue.
- For schema violations the `fix` hint is composed from the schema (field name, expected type, allowed values), so it stays current when the schema changes.
- Schema violations are reported per offending value; one wrong value may give one entry, not every alternative the schema tried.
- `evidence` is limited to 200 characters; the dialog shows the first 500 entries; the copy holds at most 5,000 entries. These limits are defaults chosen for responsiveness and can change in planning.
- Damaged pictures count as `warning` (the deck opens); problems-list entries keep their current severities.
- The import problems dialog and notice follow existing dialog and toast components and the design tokens; there is no design frame for them, so they reuse the 044 import report panel's layout.
- The 044 and 056 reports are adapted in place (grouping, codes, copy), not rebuilt.
- The AI deck skill (027) is not built yet; this feature publishes the catalogue it will reuse.
