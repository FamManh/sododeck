# Feature Specification: Model Validation (Problems)

**Feature Branch**: `015-model-validation`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "015 (model-validation) from docs/backlog.md. Show users the problems in their model: components with no connections, duplicate connections, flow steps whose connection was deleted, flows that jump between unconnected components, and missing or incomplete rules. Problems appear in a list and as small warnings on the affected objects; clicking a problem takes the user to it. Checking must not slow the editor on very large decks. Why: a diagram that silently contains broken flows loses the trust that makes it the source of truth. Notes: problems are derived and never written into the deck file or shown in the JSON panel (design-analysis §g-23). Design: 60 (PROBLEMS section in the deck inspector, amber glyphs, "n problems" canvas button, "No problems" row), 42 (broken-chain rows), 59 (bulk delete flags new problems), 46 (overlapping branch conditions). The problems list must be a reusable panel because 018 (canvas-first) moves it into a rail flyout with a count badge (§g-46). Reuse existing checks where they exist (002 integrity, 006 chain breaks, 008 catch-all)."

**Sources**: `docs/backlog.md` §015 (scope, acceptance criteria, risks), `docs/spec.md` §7 (C-7 validation), `docs/design/design-analysis.md` §a rows 42, 46, 59, 60 and the component row "Problems list + canvas button", §g-11 / §g-19 (deletes are confirmed, then an Undo toast), §g-23 (derived data never appears in the deck or the JSON panel), §g-46 (018 moves the list to a rail flyout with a count badge).

**Dependency note**: 006 (flows), 008 (rules), 009 (stickies), 010 (groups, drill-in) and 011 (views) are merged on `main`. Several checks already exist and are shown in one place only: referential integrity (002), flow chain breaks, broken steps and empty branch fields (006, shown in the step list), and the rule catch-all check (008, shown in the rule editor). This feature gathers them, adds the missing checks, and shows them deck-wide. **No file-format change.**

## Scope

**In scope**

- **Checks** (all derived from the deck, recomputed after every edit):
  - Orphan component: a component with no connections.
  - Duplicate connection: two or more connections with the same source, target and label.
  - Step without connection: a flow step whose connection was deleted.
  - Broken chain: a flow step that does not start where the previous step ended.
  - Incomplete flow: a flow with no steps, a branch with an empty label or condition, a step on a branch that no longer exists.
  - Overlapping branch conditions: two branches at the same fork with the same condition.
  - Missing rule: a component or step that refers to a rule that no longer exists.
  - Rule without catch-all: a rule where some inputs match no row; a rule with invalid cells.
  - Broken reference: any other reference to something that no longer exists (a group's parent, a sticky's anchor, a step's rule input) and parent cycles.
- **Problems list** (design 60): a PROBLEMS section in the deck inspector (shown when nothing is selected) with a count, one row per problem (icon, title, one-line detail, chevron), a short help line, and a collapsed "No problems" row with a check when the deck is clean. The list is one self-contained panel so 018 can move it to a rail flyout.
- **Canvas button**: an amber "n problems" button in the canvas toolbar when the count is above zero; it opens the list.
- **Glyphs on affected objects**: a small amber warning glyph on affected components and connections, and on affected flow rows (flow list) and rule rows (the rule editor's rules list).
- **Go to a problem**: click or ↵ on a row selects the object, brings it into view and opens the place where it can be fixed; ↑↓ move through rows; ⌘. / Ctrl+. jumps to the next problem from anywhere in the editor, ⇧⌘. to the previous one.
- **Delete feedback** (design 59): when a delete creates new problems, the Undo toast says how many.
- Keyboard and screen-reader support; light and dark themes.

**Out of scope**

- Custom or user-configurable checks (spec Q-4, P2) and severity settings.
- Auto-fix actions ("delete the duplicate", "connect the orphan").
- Dismissing or muting a problem per object (backlog risk "noise"; later, it would need a stored field).
- Writing problems into the deck, the JSON panel or exported files (§g-23).
- The rail flyout and count badge of the canvas-first layout (018).
- Semantic checks on free-text content (for example logically overlapping but differently worded branch conditions).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See every problem in the deck in one list (Priority: P1)

An architect opens a deck someone else built. With nothing selected, the inspector shows PROBLEMS · 4: an orphan component, a broken flow, a duplicate connection and a step whose connection was deleted. Each row says what is wrong and where, in plain words.

**Why this priority**: the list is the core value: without it, broken flows and stray components stay invisible. It works without glyphs, navigation or the canvas button.

**Independent Test**: build a deck containing one instance of each check; with nothing selected, read the list and compare it with the planted problems; fix each one and watch the list shrink to "No problems".

**Acceptance Scenarios**:

1. **Given** a component "Legacy Invoicer" with no connections, **When** the user looks at the deck inspector, **Then** the list shows "Orphan component · Legacy Invoicer has no connections".
2. **Given** two connections API Gateway → Tracking Service with the same label, **When** the list is shown, **Then** it shows one "Duplicate connection · API Gateway → Tracking Service appears twice" row (not one per copy).
3. **Given** flow "Failed delivery" whose step 4 does not start where step 3 ended, **When** the list is shown, **Then** it shows "Broken flow · Failed delivery · step 4 doesn't continue from step 3".
4. **Given** flow "Proof of delivery" whose step 2 used a connection that was deleted, **When** the list is shown, **Then** it shows "Step without connection · Proof of delivery · step 2 used a deleted connection".
5. **Given** a rule "Delivery tier" with no catch-all row, **When** the list is shown, **Then** it shows "Rule without catch-all · Delivery tier · some inputs match no row".
6. **Given** a clean deck, **When** the list is shown, **Then** it shows a single "No problems" row with a check icon.
7. **Given** the list shows a problem, **When** the user fixes it (for example connects the orphan), **Then** the row disappears without any other action.

---

### User Story 2 - Go straight to a problem and fix it (Priority: P1)

The architect clicks "Orphan component · Legacy Invoicer": the canvas centres on it, it is selected and the inspector shows it, ready to connect or delete. From anywhere they press ⌘. to walk to the next problem.

**Why this priority**: a list that cannot take the user to the object is a report, not a tool; navigation turns problems into fixes.

**Independent Test**: with the planted deck, activate each row by click and by ↵, and use ⌘. / ⇧⌘. from the canvas, the inspector and the flow list; check what is selected and visible each time.

**Acceptance Scenarios**:

1. **Given** an orphan component row, **When** the user clicks it or presses ↵ on it, **Then** the component is selected, centred on the canvas and shown in the inspector.
2. **Given** a duplicate connection row, **When** activated, **Then** the duplicate connections are selected together and brought into view.
3. **Given** a broken-flow or step row, **When** activated, **Then** the flow opens in the flow list with that step selected and highlighted on the canvas.
4. **Given** a rule row, **When** activated, **Then** the rule opens in the rule editor.
5. **Given** focus anywhere in the editor and 4 problems, **When** the user presses ⌘. four times, **Then** each problem is visited once in list order, and the fifth press wraps to the first; ⇧⌘. goes backwards.
6. **Given** the list has focus, **When** the user presses ↑ / ↓, **Then** focus moves between rows without selecting anything until ↵.
7. **Given** a problem on a component that is inside a collapsed group or outside the current drill-in scope, **When** activated, **Then** the group expands or the canvas goes up to a level where the component is visible, and it is selected.
8. **Given** a problem on a component that the current view excludes, **When** activated, **Then** the user is told it is hidden in this view and offered "Show in <view>" (the first view that shows it), consistent with 011 search.

---

### User Story 3 - Spot problems on the canvas while drawing (Priority: P2)

While editing the diagram, the architect sees a small amber warning glyph on "Legacy Invoicer" and on the "GPS stream ×2" connection, and an amber "4 problems" button in the canvas toolbar. Clicking the button opens the list.

**Why this priority**: in-context warnings catch problems as they are created; the list alone needs the user to look for it.

**Independent Test**: with the planted deck, check glyphs on each affected component, connection, flow row and rule row; check the canvas button's count and that it opens the list; fix a problem and check its glyph disappears.

**Acceptance Scenarios**:

1. **Given** an orphan component, **When** the canvas renders, **Then** it shows an amber warning glyph at its top-right corner, and its accessible name includes "1 problem".
2. **Given** duplicate connections, **When** rendered, **Then** each shows the glyph on its label (or at its midpoint when it has no label).
3. **Given** a flow with a broken chain, **When** the flow list is shown, **Then** that flow's row shows the glyph.
4. **Given** 4 problems, **When** the canvas renders, **Then** the toolbar shows "4 problems" in amber; **When** clicked, **Then** the selection clears and the deck inspector shows the list with focus on its first row.
5. **Given** a clean deck, **When** rendered, **Then** there is no canvas button and no glyph.
6. **Given** flow playback or recording is active, **When** rendered, **Then** the glyphs stay visible but do not cover step badges.

---

### User Story 4 - Know when an edit breaks something (Priority: P3)

The architect deletes three components. The confirmation already lists broken steps; after confirming, the Undo toast reads "Deleted 3 components and 8 connections · 2 new problems · Undo".

**Why this priority**: useful feedback at the moment of damage, but the list and glyphs already reveal the result.

**Independent Test**: delete objects that break a flow step and leave a component orphaned; check the toast count and that Undo removes those problems again.

**Acceptance Scenarios**:

1. **Given** a delete that creates 2 new problems, **When** it completes, **Then** the Undo toast includes "2 new problems".
2. **Given** a delete that creates no new problems, **When** it completes, **Then** the toast is unchanged.
3. **Given** the toast, **When** the user presses Undo, **Then** the deck and the problem count return to their previous state.

---

### Edge Cases

- **Intentional orphans**: a component with no connections is still reported (dismissing is out of scope); components that have child components (drill-in parents) or that are the only component in the deck are not orphans.
- **Stickies and groups** never count as orphans; only components do.
- **Duplicate definition**: same source, same target and the same label after trimming and ignoring case; an empty label equals a missing label. A → B and B → A are not duplicates. Three copies are one problem naming "appears 3 times".
- **Self-connections** (A → A) are allowed in the model and are not reported.
- **Overlapping conditions**: two branches of the same fork whose conditions are equal after trimming and ignoring case and repeated spaces; empty conditions are reported as incomplete, not as overlapping.
- **One cause, several symptoms**: a deleted connection used by a step yields one "step without connection" problem, not an extra broken-chain problem for the same step.
- **Problems in hidden places**: the list is deck-wide, regardless of the current view, drill-in, collapsed groups or focus mode.
- **Very large decks** (2,000 components): the list may show the first 200 rows with "Show all n"; counts are always exact.
- **Stale while typing**: the list may lag an edit by up to a second on large decks but never shows a problem that no longer exists after it settles.
- **Undo / redo and other tabs**: problems follow the current document state, including edits synced from other tabs.
- **Ordering**: problems are listed by kind (components, connections, flows, rules, references), then by the object's title, so the order is stable while editing.
- **Deleted target during navigation**: activating a row whose object was deleted meanwhile does nothing but refresh the list.
- **JSON panel and export** never show problems, even for the selected object (§g-23).

## Requirements _(mandatory)_

### Functional Requirements

**Checks**

- **FR-001**: The system MUST report a component with no incoming or outgoing connections as an **orphan component**, except components that have child components and a deck with only one component.
- **FR-002**: The system MUST report connections with the same source, target and label (trimmed, case-insensitive, empty = missing) as one **duplicate connection** problem per group, naming how many copies exist.
- **FR-003**: The system MUST report a flow step whose connection no longer exists as a **step without connection**.
- **FR-004**: The system MUST report a flow step that does not start where the previous step on its path ended as a **broken chain**, using the same rule as flow authoring (006), and not for a step already reported under FR-003.
- **FR-005**: The system MUST report **incomplete flows**: a flow with no steps, a branch with an empty label or condition, and a step assigned to a branch that no longer exists.
- **FR-006**: The system MUST report two or more branches of the same fork whose conditions are equal (trimmed, case-insensitive, repeated spaces collapsed) as **overlapping branch conditions**.
- **FR-007**: The system MUST report a component or step that refers to a missing rule as a **missing rule**.
- **FR-008**: The system MUST report a rule without a catch-all row and a rule with invalid cells, using the same checks as the rule editor (008).
- **FR-009**: The system MUST report every other broken reference and parent cycle found by the deck's referential integrity check (002) as a **broken reference**, naming the object and what it points to.
- **FR-010**: Problems MUST be derived from the current deck only and MUST NOT be written into the deck, the JSON panel, exported files or the undo history (§g-23).
- **FR-011**: Problems MUST update after every edit, undo, redo and change synced from another tab, within 1 second on a 2,000-component deck and without blocking editing.

**Problems list**

- **FR-012**: With nothing selected, the deck inspector MUST show a PROBLEMS section with the total count and one row per problem (kind icon, title, one-line detail naming the object, chevron), followed by the help line "Click a problem, or press ↵ on it, to select the object. The list updates as you edit." (design 60).
- **FR-013**: When there are no problems, the section MUST show one collapsed "No problems" row with a check icon.
- **FR-014**: Rows MUST be ordered by kind (components, connections, flows, rules, references), then by object title, then by step number.
- **FR-015**: The list MUST be a self-contained panel that does not depend on being inside the inspector, so it can be moved to another surface (018).
- **FR-016**: With more than 200 problems, the list MUST show the first 200 rows and a "Show all n" control; the count MUST always be exact.

**Navigation**

- **FR-017**: Activating a row (click, ↵ or Space) MUST go to the problem: select the component or connection(s) and bring them into view; for flow problems open the flow in the flow list with the step selected and highlighted; for rule problems open the rule editor; for broken references select the object holding the reference.
- **FR-018**: If the target is inside a collapsed group or outside the drill-in scope, the system MUST expand the group or go up to a level where it is visible before selecting it (010).
- **FR-019**: If the current view excludes the target, the system MUST say so and offer "Show in <view>" with the first view that shows it, instead of switching views automatically (same behaviour as 011 search).
- **FR-020**: In the list, ↑ / ↓ MUST move focus between rows and Home / End to the first / last row, without selecting until a row is activated.
- **FR-021**: ⌘. (Ctrl+. elsewhere) MUST go to the next problem after the last one visited and ⇧⌘. to the previous one, wrapping at the ends, from anywhere in the editor except text fields; with no problems it announces "No problems".

**Signals on the canvas and in lists**

- **FR-022**: Each affected component MUST show a small amber warning glyph at its top-right corner, and each affected connection on its label (or midpoint), placed so it does not cover step badges or the rules glyph.
- **FR-023**: Affected flow rows in the flow list and affected rules in the rule editor's rules list MUST show the same glyph; it replaces the flow row's existing "Has problems" marker (006) so there is one warning style.
- **FR-024**: When the count is above zero, the canvas toolbar MUST show an amber "n problems" button (singular "1 problem"); activating it clears the selection, shows the list and focuses its first row. With zero problems the button is absent.
- **FR-025**: The glyph MUST NOT be the only cue: affected objects' accessible names include the number of problems (for example "Service: Legacy Invoicer, 1 problem"), and the glyph has a tooltip naming the problem(s).

**Delete feedback**

- **FR-026**: After a delete (single or bulk) that increases the number of problems, the Undo toast MUST add "n new problems"; Undo MUST restore the previous count.

**Accessibility and themes**

- **FR-027**: The list, rows, button and glyphs MUST be keyboard operable and named for screen readers; the count change after an edit MUST NOT be announced on every keystroke (announced on opening the list and by FR-021).
- **FR-028**: All new UI MUST use design tokens in light and dark themes and meet WCAG 2.1 AA contrast.

### Key Entities

- **Problem** (derived, never stored): a kind (orphan component, duplicate connection, step without connection, broken chain, incomplete flow, overlapping conditions, missing rule, rule without catch-all, invalid rule cells, broken reference), the affected object(s) by id (component, connection(s), flow + step or branch, rule, or the object holding a broken reference), a title and a one-line detail, and a stable key so the list order and "next problem" position survive re-computation.
- **Problem summary** (derived): the total count, problems by affected object id (for glyphs and accessible names), and the ordered list.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On a test deck with one planted instance of each of the ten problem kinds, 100% are listed; a clean deck (the minimal example, the app's demo deck) shows "No problems", and the richer bundled examples list exactly their known, real problems (no false positives).
- **SC-002**: From the list, a user reaches the object behind any problem in one action (click or ↵), and walks all problems with ⌘. alone.
- **SC-003**: On a 2,000-component / 4,000-connection deck, the list reflects an edit within 1 second and dragging, typing and panning stay as smooth as without this feature (no regression in the canvas benchmark).
- **SC-004**: The deck file, the JSON panel and exports are byte-identical with and without problems present (problems never stored).
- **SC-005**: Every interaction in this feature works with keyboard only, and screen-reader users hear the problem count for affected objects.
- **SC-006**: All new UI matches design 60 in light and dark themes, with AA contrast and a non-colour cue for every warning.

## Assumptions

- The deck inspector is the home of the list until 018 (canvas-first) moves it to a rail flyout with a count badge (§g-46); the panel is built to move without changes.
- All problems are warnings (amber); there is no error level. Flow-authoring's own blocking of "Done" on a broken chain (006) is unchanged.
- The canvas button replaces nothing: it sits in the existing canvas toolbar next to Labels and Focus, as in design 60.
- ⌘. is reserved for "next problem" (design 60); the canvas-first design proposes ⌘. for collapsing a group (101), so 019 must pick another key for that.
- Design 60 shows `"problems": ["orphan"]` in the node JSON; that part is overridden by §g-23 and not built.
- Design 59 shows a bulk delete without confirmation; §g-11 keeps the confirmation, and this feature only adds the problem count to the Undo toast that follows.
- The flow list (006) and the rule editor's rules list (008) already exist and gain only the glyph; the canvas outline has no rules list.
- Checks run on the whole deck; per-view or per-scope problem counts are not needed.
