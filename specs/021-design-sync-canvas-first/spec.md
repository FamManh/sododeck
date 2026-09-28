# Feature Specification: Design Sync, Canvas-First (86–116)

**Feature Branch**: `021-design-sync-canvas-first`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "021 from docs/backlog.md" (021-design-sync-canvas-first: bring the canvas-first design, states 86–116, into the repo and point the design rules at it, so 018–020 are specified and built against it rather than the 3-column prototype).

**Sources**: `docs/backlog.md` §021 (scope, acceptance criteria, risks) and the "Design update (2026-09-28)" note; `docs/design/claude-design-prompt-canvas-first.md` (the brief and the list of states 86–116); `docs/design/design-analysis.md` §g-38–§g-47 (founder decisions); `docs/design/README.md` (how the prototype is imported and captured); `DESIGN.md` (current "Editor Grid" section with the 264 / 336 px columns).

**Dependency note**: 000–011 and 015 are merged on `main`. The canvas-first design exists only in the Claude Design project "Sododeck" (`Sododeck Canvas-first.dc.html`, `Sododeck Canvas State.dc.html`, `sododeck-canvas.js`, plus the shared `sododeck-data.js`, `sododeck-states.js`, `support.js`). design-analysis §g-42–§g-46 already carry founder decisions (defaults accepted, 2026-09-28). This is a **documentation-only** feature: no app or package code, no file-format change. The backlog notes a `/speckit.specify` pass was optional for this task; it is specified here at the founder's request.

## Scope

**In scope**

- **Design files**: copy the canvas-first prototype files, byte-for-byte and read-only, into `docs/design/claude-design/` next to the existing ones; list them in `docs/design/README.md` with the import date and how to re-capture states 86–116.
- **Screenshots**: every state 86–116 (31 states) in light and dark, 62 images, in `docs/design/screens/` named `<id>-<slug>-{light,dark}.png`, with slugs from the design's state list (e.g. `86-shell-empty`, `105-fill-popover`). 1440×900, except 116 at 1024×768.
- **design-analysis.md**:
  - inventory rows for 86–116 (same table shape as 41–85: state, light/dark links, what it shows) and, for each, the backlog feature it belongs to (016–020, or 015 for the problems badge);
  - the new components with sizes, spacing, tokens and hover / focus / pressed / disabled states: island, rail button, flyout, drawer, selection toolbar, toolbar popover, context menu, colour popover and swatch, resize handle, segment handle, endpoint handle, snap guide, marquee, drop target, hint bar;
  - the card-colour tokens and any other new tokens introduced by 86–116;
  - mismatches between 86–116 and DESIGN.md or founder decisions, each with a decision or a stated default; §g-42–§g-46 confirmed as decided.
- **DESIGN.md**:
  - "Three-panel editor" / Editor Grid replaced by a "Canvas-first editor" section: full-bleed canvas, floating islands, left icon rail, flyout (280 px), detail drawer (360 px default, resizable 320–560 px), JSON panel as a bottom overlay (hidden by default, values from frame 93), hide-UI mode;
  - selection shown as a 2 px frame outside the card;
  - narrow windows 1024–1279 px described as designed (116);
  - 13 card-colour tokens as light/dark pairs;
  - overlay motion: 120 ms fade plus 4 px slide, none with reduced motion;
  - Known Gaps updated for anything the canvas-first design closes or opens.
- **AGENTS.md** Design section: frames 02–85 are the reference for panel **content**; frames 86–116 for editor **placement** and the new controls; the backlog line updated to cover 000–021.
- **docs/backlog.md**: 021 marked done once merged (status only).

**Out of scope**

- Any code in `apps/*` or `packages/*`, including tokens in `packages/ui` (added by 018 and 020).
- An ADR for the canvas-first layout (written with 018, which makes the code decision).
- Changing frames 02–85, their screenshots or their inventory rows to match the new placement.
- Changing the prototype files themselves, or copying prototype code into the app.
- New founder decisions beyond recording defaults for mismatches found while importing (anything that changes scope goes back to the founder).

## User Scenarios & Testing _(mandatory)_

The "users" of this feature are the founder and the agents who will specify and build 018, 019, 016, 017 and 020.

### User Story 1 - See every canvas-first state in the repo (Priority: P1)

An agent starting 018 opens `docs/design/screens/` and finds each canvas-first state in light and dark, named consistently with earlier states, so it can match the UI pixel-close without access to the Claude Design project.

**Why this priority**: The screenshots are the reference every later feature (018–020) is checked against; without them the rest of this feature has nothing to point to.

**Independent Test**: List `docs/design/screens/` and check that states 86–116 each have a light and a dark image at the stated size; open a sample to confirm it shows the named state.

**Acceptance Scenarios**:

1. **Given** `docs/design/screens/`, **When** it is listed, **Then** it contains 62 new images, one light and one dark for each state 86–116, named `<id>-<slug>-{light,dark}.png`.
2. **Given** any state other than 116, **When** its image is opened, **Then** it is 1440×900 (at the capture scale used for 41–85) and shows that state.
3. **Given** state 116, **When** its image is opened, **Then** it is 1024×768 and shows the narrow-window layout.
4. **Given** `docs/design/claude-design/`, **When** listed, **Then** the canvas-first files are present and identical to the originals in the Claude Design project, and no earlier file is changed.

---

### User Story 2 - Build against the canvas-first rules in DESIGN.md (Priority: P1)

An agent implementing 018 reads DESIGN.md and finds the canvas-first shell described with concrete sizes, behaviour and tokens, and no longer finds the fixed 264 / 336 px columns described as the editor layout.

**Why this priority**: DESIGN.md is the design contract for code; if it still describes three columns, 018 would be built against contradicting rules.

**Independent Test**: Read DESIGN.md alone and answer: rail and island placement, flyout width, drawer default and range, JSON overlay position and default visibility, selection frame, narrow-window behaviour, overlay motion, and the 13 card-colour light/dark pairs.

**Acceptance Scenarios**:

1. **Given** DESIGN.md, **When** read, **Then** it describes the canvas-first shell (islands, rail, flyout 280 px, drawer 360 px within 320–560 px, JSON bottom overlay hidden by default, hide-UI mode) and does not describe the 264 / 336 px columns as the current editor layout.
2. **Given** DESIGN.md, **When** read, **Then** it lists 13 card-colour tokens, each with a light and a dark value.
3. **Given** DESIGN.md, **When** read, **Then** it states the selection frame (2 px, outside the card), the narrow range 1024–1279 px as designed, and the overlay motion (120 ms fade + 4 px slide, none with reduced motion).

---

### User Story 3 - Trace each canvas-first state to a feature and a decision (Priority: P2)

The founder or an agent writing the 018–020 specs looks up a state in design-analysis.md and sees what it shows, which feature builds it, which new components it uses, and whether any conflict with DESIGN.md or a founder decision is settled.

**Why this priority**: It turns the screenshots into specifiable scope and prevents re-litigating settled conflicts, but the screenshots and DESIGN.md are usable without it.

**Independent Test**: Pick any state 86–116 in design-analysis.md and follow it to its feature, its components (each with sizes, tokens and states) and any related §g entry.

**Acceptance Scenarios**:

1. **Given** design-analysis §a, **When** read, **Then** there is one row per state 86–116 with light and dark links that resolve to existing files and the feature (016–020 or 015) it belongs to.
2. **Given** design-analysis §b, **When** read, **Then** each listed new component (island, rail button, flyout, drawer, selection toolbar, toolbar popover, context menu, colour popover and swatch, resize / segment / endpoint handles, snap guide, marquee, drop target, hint bar) has sizes, spacing, tokens and hover / focus / pressed / disabled states (or says a state does not apply).
3. **Given** design-analysis §g-42–§g-46, **When** read, **Then** each has a founder decision or an accepted default; any new mismatch found during import is added as a numbered §g entry with a default.

---

### User Story 4 - Know which frames govern what (Priority: P3)

Any agent reading AGENTS.md learns that frames 02–85 govern panel content and frames 86–116 govern editor placement and the new controls, so it neither "fixes" old frames nor copies old placement.

**Why this priority**: A one-paragraph rule, but it prevents the main risk named in the backlog.

**Independent Test**: Read the AGENTS.md Design section and answer "where does the outline panel go, and what does it contain?" with the right frame ranges.

**Acceptance Scenarios**:

1. **Given** the AGENTS.md Design section, **When** read, **Then** it states that 02–85 are the reference for panel content and 86–116 for editor placement and new controls, and that 02–85 are not changed to match.

### Edge Cases

- A state in the design list has no slug, or two states share a slug: derive a slug from the state title in the same kebab-case style and note it in the README.
- The prototype renders differently from its design notes (wrong icon, missing state detail): capture what it renders, and record the difference as a §g mismatch with a default rather than editing the prototype.
- The prototype renders a value that conflicts with DESIGN.md or a founder decision (e.g. JSON editing in 93, free connector end in 114, plain-arrow nudge in 109): the screenshot stays as rendered; DESIGN.md and design-analysis follow the decision.
- The prototype needs network access to render (CDN scripts, web fonts): allowed for capture only, as for 41–85; nothing from it reaches the app.
- A capture misses icons or fonts because it was taken too early: re-capture until icons and fonts are loaded; no half-rendered image is committed.
- The Claude Design project cannot be reached: the feature stops and reports; it does not recreate states by hand.
- A card-colour token in the design lacks a dark value: flag it as a §g mismatch with a proposed dark value; the "13 pairs" criterion is not met until each pair is complete.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The canvas-first prototype files MUST be added to `docs/design/claude-design/` unchanged from the originals (injected preview markup stripped as documented), and no existing file there may change.
- **FR-002**: `docs/design/README.md` MUST list the new files with their import date and describe how to re-capture states 86–116 (props, sizes, wait conditions).
- **FR-003**: `docs/design/screens/` MUST contain a light and a dark image for every state 86–116 (62 images), named `<id>-<slug>-{light,dark}.png` with slugs from the design's state list.
- **FR-004**: Images for 86–115 MUST be captured at 1440×900 and 116 at 1024×768, at the same device scale as states 41–85.
- **FR-005**: Existing screenshots (02–85) MUST NOT be changed or removed.
- **FR-006**: design-analysis.md MUST have one inventory row per state 86–116 with working light/dark links, a short description and the owning feature.
- **FR-007**: design-analysis.md MUST describe each new component listed in scope with sizes, spacing, tokens and interaction states.
- **FR-008**: design-analysis.md MUST list the card-colour tokens and any other tokens introduced by 86–116, mapped to their DESIGN.md names.
- **FR-009**: design-analysis.md §g-42–§g-46 MUST each show a decision; mismatches newly found MUST be added as numbered §g entries, each with a default, and reported to the founder.
- **FR-010**: DESIGN.md MUST replace the three-column editor description with the canvas-first editor (values in scope) and MUST NOT describe the 264 / 336 px columns as the current layout.
- **FR-011**: DESIGN.md MUST list 13 card-colour tokens as light/dark pairs, the 2 px outside selection frame, the 1024–1279 px narrow range as designed, and the overlay motion including reduced motion.
- **FR-012**: The AGENTS.md Design section MUST state the frame split (02–85 content; 86–116 placement and new controls) and cover backlog features up to 021.
- **FR-013**: No file under `apps/` or `packages/` may change.
- **FR-014**: All changed Markdown MUST pass the repo's formatting check.

### Key Entities

- **Design state**: one frame of the prototype, identified by a number (86–116), a slug and a title; rendered in light and dark; belongs to one backlog feature.
- **Screenshot**: an image of one design state in one theme at a fixed size.
- **Component spec**: a named UI element introduced by 86–116, with sizes, spacing, tokens and interaction states.
- **Card-colour token**: a named colour with a light and a dark value, used for card fill and stroke (applied by 020).
- **Design decision (§g entry)**: a numbered conflict between the design and DESIGN.md or the spec, with the founder's decision or an accepted default.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 62 of 62 canvas-first screenshots (31 states × 2 themes) exist at the stated sizes; 0 existing screenshots changed.
- **SC-002**: 31 of 31 states 86–116 have an inventory row whose light and dark links resolve.
- **SC-003**: 100 % of the new components listed in scope have sizes, tokens and interaction states documented.
- **SC-004**: DESIGN.md lists 13 of 13 card-colour tokens with both light and dark values, and 0 passages describe the 264 / 336 px columns as the current editor layout.
- **SC-005**: 5 of 5 decisions §g-42–§g-46 are recorded, and every newly found mismatch has a default.
- **SC-006**: An agent writing the 018 spec can answer every layout question listed in User Story 2 from DESIGN.md and design-analysis.md alone, without opening Claude Design.
- **SC-007**: 0 files changed under `apps/` or `packages/`; the formatting check passes.
- **SC-008**: The feature takes about 1 working day, per the backlog estimate.

## Assumptions

- The Claude Design project "Sododeck" is reachable and its canvas-first files are final for 016–020 (design update of 2026-09-28).
- The state list and slugs come from the design's own list for 86–116 (`sododeck-canvas.js` or `sododeck-states.js`); where it gives none, slugs follow the brief's titles (e.g. `86-shell-empty`).
- Captures use the same method and device scale as states 41–85 (Playwright, 2× scale), documented in `docs/design/README.md`; network access during capture is acceptable because it never applies to the real app.
- "13 card-colour tokens" matches the design's named palette; if the design has a different count, the actual count is documented and flagged to the founder rather than padded or trimmed.
- The JSON overlay values (height, position) are read from frame 93; the drawer and flyout values come from the backlog and the design notes.
- The canvas-first ADR, `packages/ui` tokens and all behaviour belong to 018–020; this feature only documents.
- Constitution checks for code (single source of truth, network, performance, tests) do not apply beyond "no app or package code changes"; the definition-of-done commands still pass because nothing they cover changes.
