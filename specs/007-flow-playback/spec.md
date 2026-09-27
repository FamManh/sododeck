# Feature Specification: Flow Playback

**Feature Branch**: `007-flow-playback`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "007 (flow-playback) from docs/backlog.md — Let users play a flow like a presentation. Selecting a flow highlights its path, dims everything else, and a token travels along the current step's connection. A player lets users go to the previous or next step, play and pause at normal or double speed, and jump to any step from the progress bar, the step list, or by clicking the diagram; arrow keys also step through the flow. A side panel shows the current step's from and to components, protocol, condition, description, SLA target and attached rules. The current step is clear without relying on color, is announced to screen readers, and animation stops for users who prefer reduced motion. Why: tracing one flow end to end is the core value and the north-star metric ("flows played")."

**Sources**: `docs/backlog.md` §007 and founder decision §g-6 (SLA shows the target only, no measured value), `docs/spec.md` §7.3 (F-2, F-3) and §10 (north star: decks with ≥ 1 flow played), `docs/design/design-analysis.md` §a (flow mode, states 03, 24–27, 44, 46, 50), §b (edge states, flow token, step player, branch picker), §c Motion (dim 250 ms, token loop 1.4 s ÷ speed, step 1.7 s ÷ speed, reduced motion), §e (flow mode behavior), `docs/design/screens/` 03, 24, 25, 26, 27, 44, 46, 50 (light and dark where present), `specs/006-flow-authoring/spec.md` (flow list, step list, step numbering, branches, broken steps, edit mode, "show a flow", FR-031, FR-018a), ADR 0008 (flat step list; a fork ends the main path; one level of branching; alternatives in `branches` order), `specs/008-inspector-rules/spec.md` (step inspector with compact decision table, specified but not merged), `specs/003-canvas-basic/spec.md` (canvas, selection, keyboard), `specs/004-json-panel-sync/spec.md` (read-only JSON panel), `specs/005-local-library-autosave/spec.md` (multi-tab sync), constitution v1.0.0 (principles I–VIII).

**Dependency note**: 007 depends on 006, merged on `main` (`96bd929`). It relies on 006's flow list, step list, derived step numbers (1, 4a, …), branches, broken-step detection, step inspector and edit mode. 008 (inspector and rules) is specified but not a dependency: until it lands, the step view lists attached rule names; once it lands, the step view shows 008's compact decision table in the same place. No file-format change: which flow is open, the current step, play state, speed and the chosen branch are session-only UI state and are never written to the deck.

## Scope

**In scope**

- **Flow mode** (design 03, 44, 46): opening a flow from the left panel's flow list (and, when those surfaces exist, a connection's "Used in flows" or a rule's "Used in") enters flow mode on step 1. The top bar shows the chip "Flow mode · <flow name> ×"; the left panel shows "Back to canvas", the feature's flows and the flow's STEPS. Exit with the chip ×, "Back to canvas" or Esc.
- **Highlight and dimming**: flow connections are highlighted and every connection and component not on the played path is dimmed (fade 250 ms). Flow connections carry their step number on their label (non-color cue). Error-path steps keep 006's dashed style and icon.
- **Current step**: its connection is drawn thicker with a solid label; its two components carry the selection ring; a token loops along the connection (1.4 s per loop at 1×, 0.7 s at 2×).
- **Step player** (bottom centre, design 03, 26): previous, play/pause, next; "<flow> · Step n of m" and the current step's title (or "<from> → <to>"); 1× / 2× speed toggle; progress segments, one per step on the played path, the ones up to the current step filled; clicking a segment jumps to that step.
- **Navigation**: ← / → step backward / forward (not while typing in a field); clicking a step row, a progress segment, a flow connection or a flow component jumps to a step.
- **Autoplay**: play advances one step every 1.7 s at 1× (0.85 s at 2×) and stops on the last step; play on the last step restarts from step 1; changing speed pauses.
- **Branches** (design 46): the played path is the main path plus one chosen alternative. At the fork, the player shows "AT STEP n" and a segmented control with one option per alternative (error paths with their icon); ↑ / ↓ switch the alternative while the current step is the fork step or any step of an alternative. Step numbers and "Step 4b of 5" follow the chosen path; steps of other alternatives stay dimmed.
- **Step view** in the inspector (design 03, 24, 25, 46): "STEP n OF m · <flow>", from → to component tiles and names, protocol, CONDITION, DESCRIPTION, RULES (attached rule names, or "No rules attached"; 008's table when available), SLA TARGET (target only). The step's text fields stay editable as in 006.
- **JSON panel**: shows the current step (Step tab) and the whole deck, read-only, updated as the current step changes (004).
- **Accessibility**: the current step is announced politely ("Step 5 of 8: Order Service → Payment Service"); all player controls are keyboard operable with visible focus and accessible names; under reduced motion no token moves (a static marker sits at the connection's midpoint), dimming is instant, and the current connection stays distinguishable by width, solid label and step number.
- Timers and animations stop when flow mode ends, the deck closes or the tab is hidden.
- Canvas performance: flow highlight within 100 ms on the benchmark deck; no drop below 60 fps while playing.

**Out of scope**

- Measured SLA values and the SLA meter fill (§g-6).
- The compact decision table with the matched row and "Evaluated with" inputs, and "Edit rule" (008).
- Opening flows from ⌘K (009), sticky-note dimming during flows (009, design 63), flows through collapsed groups (010, design 71).
- Exporting a flow (012), counting "flows played" for analytics (014).
- Flow comparison, sequence / swimlane views, payload display (P1).
- New Playwright e2e tests (constitution VI, `TODO(e2e)`).

## Clarifications

### Session 2026-09-27

- Q: When a user clicks a flow in the left panel, should the app go straight into flow mode or first show 006's plain view and wait for Play? → A: Straight into flow mode on step 1, paused; 006's plain selected-flow view is replaced.
- Q: While a flow is open in flow mode, can users still change the diagram, or only pan, zoom and jump? → A: View-only canvas (pan, zoom, click to jump); step text fields stay editable in the inspector; structural flow changes go through 006's edit mode.
- Q: At a fork, which alternative does playback follow when a flow opens, and is the choice kept? → A: Always the first alternative ("a"); the choice is forgotten when flow mode ends.
- Q: How should the canvas move when a flow opens or the current step is off-screen? → A: On opening, fit the whole played path in view; on step changes, pan only when the current connection is off-screen, never re-zoom.
- Q: What does the user see right after leaving flow mode? → A: Normal canvas with nothing selected (deck inspector); the left panel returns to the feature/flow list with the last played flow's row marked (not selected).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a flow and step through it (Priority: P1)

An architect explaining checkout to a colleague opens "Place order" from the flow list. The diagram dims except the flow's path; step 1's connection is thick with a token moving along it. They press → to walk through the steps, each time seeing the from and to components, the protocol and the condition in the side panel, then press Esc to return to the canvas.

**Why this priority**: tracing one flow end to end is the product's core value and its north-star action. Without this, flows are only lists.

**Independent Test**: with a deck holding one 8-step flow, open the flow, press → seven times, check each step's highlight and side panel, then exit; delivers value with no autoplay or branches.

**Acceptance Scenarios**:

1. **Given** a flow with 8 steps, **When** the user opens it from the flow list, **Then** flow mode starts: the chip reads "Flow mode · Place order ×", the flow's connections are highlighted with step numbers on their labels, all other components and connections are dimmed, step 1 is current, and the highlight appears within 100 ms on the benchmark deck.
2. **Given** step 4 is current, **When** the user presses →, **Then** step 5 becomes current, its connection gets the thick style, solid label and token, its step row and progress segment are marked current, and a screen reader announces "Step 5 of 8: Order Service → Payment Service".
3. **Given** step 1 is current, **When** the user presses ← or Previous, **Then** nothing changes and Previous is disabled; **Given** the last step, **Then** Next is disabled and → does nothing.
4. **Given** a current step, **When** the user looks at the inspector, **Then** it shows "STEP n OF m · <flow>", the from → to components, the protocol, the condition, the description, the attached rule names (or "No rules attached") and the SLA target (or "No SLA target"), with no measured value.
5. **Given** flow mode, **When** the user presses Esc, the chip × or "Back to canvas", **Then** flow mode ends, dimming and the token disappear, the canvas returns to its normal look with nothing selected, the inspector shows the deck, and the flow list marks "Place order" as last played.
6. **Given** the user is typing in a step's condition field, **When** they press ← or →, **Then** the caret moves in the field and the current step does not change.
7. **Given** flow mode, **When** the user tries to drag a component or presses ⌫ with focus on the canvas, **Then** nothing moves or is deleted, and no connection handles appear on hover.

---

### User Story 2 - Play a flow like a presentation (Priority: P1)

During a design review, the presenter presses play and the flow advances on its own while they talk; they switch to 2× to skim the obvious part and pause on the interesting step.

**Why this priority**: "play" is what makes a flow a presentation, and "flows played" is the north-star metric; it is the second half of F-2/F-3.

**Independent Test**: open a flow, press play, time the step changes at 1× and 2×, and check that playback stops on the last step and restarts from step 1.

**Acceptance Scenarios**:

1. **Given** play at 1×, **When** 1.7 s elapse, **Then** the player advances one step; at 2× it advances every 0.85 s; on the last step playback stops and the play button returns to "Play".
2. **Given** the last step is current, **When** the user presses play, **Then** playback restarts from step 1.
3. **Given** playback is running, **When** the user switches between 1× and 2×, **Then** playback pauses and the speed label updates; the token's loop duration follows the new speed.
4. **Given** playback is running, **When** the user presses ←, →, clicks a step row, a segment, a flow connection or a flow component, **Then** that step becomes current and playback pauses.
5. **Given** playback is running, **When** the browser tab is hidden or flow mode ends, **Then** playback stops and no timer keeps running.
6. **Given** the player, **When** the user tabs through it, **Then** Previous, Play/Pause, Next, the speed toggle and each progress segment are reachable, have accessible names ("Play", "Pause", "Speed 1×", "Go to step 3 of 8") and show a visible focus ring; Space or Enter activates them.

---

### User Story 3 - Jump to a step from the diagram or the lists (Priority: P2)

A reader wants to know what happens at the Payment Service. They click that component on the canvas and land on the first step that touches it; they click step 7 in the list, then a progress segment, to move around.

**Why this priority**: random access makes playback useful for questions ("where does the DB come in?"), but step-by-step already delivers the core value.

**Independent Test**: open a flow and jump via each of the four entry points (step row, segment, flow connection, flow component), checking the resulting current step.

**Acceptance Scenarios**:

1. **Given** flow mode, **When** the user clicks a component that belongs to the flow, **Then** the first step (in played-path order) touching that component becomes current.
2. **Given** flow mode, **When** the user clicks a flow connection used by several steps, **Then** the first of those steps after the current step becomes current, wrapping to the first one.
3. **Given** flow mode, **When** the user clicks a dimmed component or connection not on the played path, **Then** the current step does not change and nothing is selected.
4. **Given** flow mode, **When** the user clicks the 6th progress segment or the step row "6", **Then** step 6 becomes current.

---

### User Story 4 - Play a flow with branches (Priority: P2)

"Place order" forks after step 3 into "payment ok" and "payment failed" (an error path). The presenter plays the happy path first, then at step 3 switches the branch picker to "payment failed" and plays the error path, which is dashed with an error icon.

**Why this priority**: 006 lets users record branches; playback must show them, but most flows are linear.

**Independent Test**: with a flow that has 3 main steps and two alternatives of 2 steps each, play each alternative end to end with the picker and ↑ / ↓.

**Acceptance Scenarios**:

1. **Given** a flow forking after step 3 into "payment ok" (a) and "payment failed" (b, error path), **When** it is opened, **Then** the played path is steps 1–3 then 4a–5a, the player reads "Step n of 5", and steps 4b–5b are dimmed.
2. **Given** the current step is 3 (the fork step) or a step of an alternative, **When** the user looks at the player, **Then** it shows "AT STEP 3" with a segmented control "payment ok" / "payment failed", the error option with its error icon.
3. **Given** step 4a is current, **When** the user presses ↓ or chooses "payment failed", **Then** the played path becomes 1–3 then 4b–5b, step 4b is current, its connection is dashed with the error icon and thick, the announcement reads "Step 4b of 5: Payment Service → Notification Service, branch payment failed", and progress segments are rebuilt for the new path.
4. **Given** steps 1–2 are current (before the fork), **When** the user presses ↑ / ↓, **Then** nothing happens and the branch picker is not shown.
5. **Given** playback reaches the fork step, **When** it advances, **Then** it continues into the chosen alternative (the first alternative, "a", unless the user chose another).

---

### User Story 5 - Play without motion or color (Priority: P3)

A user with vestibular sensitivity has reduced motion turned on; a colour-blind user reads the diagram. Both can follow the flow.

**Why this priority**: constitution VII requires keyboard operability and non-color cues; this story verifies them explicitly.

**Independent Test**: turn on reduced motion and grayscale, open a flow and step through it.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion`, **When** a step is current, **Then** no token moves (a static marker sits at the connection's midpoint), dimming and highlights change instantly, and the current connection is still distinguishable by width, solid label and step number.
2. **Given** a grayscale display, **When** a step is current, **Then** the user can tell flow connections (step numbers on labels), the current step (thicker connection, solid label, ringed components, marked step row and segment) and error paths (dashed, error icon) apart without color.
3. **Given** flow mode, **When** the current step changes by any means, **Then** exactly one polite announcement is made; autoplay does not queue a backlog of announcements.

---

### Edge Cases

- **Flow with zero steps**: flow mode opens with the empty step list ("No steps yet"), the player shows "No steps" with all controls disabled, and nothing is dimmed.
- **Flow with one step**: Previous and Next are disabled; play highlights the step and stops immediately.
- **Broken step** (connection deleted, 006 FR-032): it keeps its number and segment; no token is drawn; the step view shows "Connection deleted" with an icon instead of from → to; the announcement reads "Step n of m: connection deleted"; autoplay passes through it at the normal pace.
- **Connection used by several steps**: its label shows all its step numbers ("2, 6"); the current one is visually emphasised.
- **Flow changes while in flow mode** (edit in this tab via the inspector, or another tab): the highlight, numbers and player update live; if the current step is removed, the current step becomes the one now at the same position (or the last one); if the chosen alternative is removed, the first remaining alternative is chosen.
- **Flow deleted while in flow mode** (for example from another tab): flow mode ends, the canvas returns to normal and a toast says "This flow was deleted".
- **Deck switched or closed while in flow mode**: flow mode ends and timers stop.
- **Entering 006 edit mode or recording from flow mode**: playback stops and flow mode ends first; after Done or Cancel, the flow opens in flow mode on step 1.
- **Undo (⌘Z) in flow mode**: undoes the last deck edit as usual; it does not undo navigation between steps.
- **Components or connections moved or re-routed while a token runs** (other tab): the token follows the new connection path from the next frame.
- **Very long flows** (50+ steps): progress segments shrink to a minimum width and the bar scrolls with the current segment kept in view; the step list scrolls to the current row.
- **Viewport**: opening a flow fits its played path in view; later, when the current step's connection is outside the visible canvas, the canvas pans to bring it into view without changing zoom. A played path too large to fit at the minimum zoom is fitted as far as possible, starting from step 1.
- **Nodes inside a group**: groups stay visible but dimmed in flow mode; collapsed groups are 010.

## Requirements _(mandatory)_

### Functional Requirements

**Entering and leaving flow mode**

- **FR-001**: Clicking a flow in the flow list MUST enter flow mode directly (there is no intermediate non-dimmed "selected flow" view) with the first step of the played path current and playback paused. It MUST replace 006's plain "show a flow" state (006 FR-031): the step badges and error-path styles stay, and dimming, the token and the player are added. Other surfaces that open a flow (connection "Used in flows", rule "Used in", 006's Done after recording, design 44) MUST enter the same flow mode, on the requested step when one is given.
- **FR-002**: In flow mode the top bar MUST show the chip "Flow mode · <flow name>" with a close button; the left panel MUST show "Back to canvas", the flows of the flow's feature (the open flow marked) and the flow's STEPS list; choosing another flow in that list MUST switch flow mode to it on step 1.
- **FR-003**: Esc (when focus is not in a text field or an open menu), the chip's close button and "Back to canvas" MUST end flow mode, stop playback and animations and restore the normal canvas look with nothing selected (the deck inspector shows). The left panel MUST return to the feature and flow list, where the last played flow's row is marked "last played" (visual mark plus accessible text, not a selection) until another flow is opened or the deck is closed.
- **FR-004**: In flow mode the canvas MUST be view-only: panning, zooming and clicking to jump are allowed; moving, adding or deleting components, drawing or deleting connections, and canvas delete / connect shortcuts MUST be disabled (no connection handles, as in design 52); structural flow changes go through 006's edit mode, which ends flow mode first. The step's text fields in the inspector MUST stay editable as in 006 (FR-018a).

**Highlight and current step**

- **FR-005**: In flow mode, components and connections not on the played path MUST be dimmed; connections on the path MUST be highlighted and MUST show their step number(s) on their label; error-path steps MUST keep 006's dashed style and error icon.
- **FR-006**: The current step's connection MUST be drawn thicker than other flow connections with a solid label, and its from and to components MUST show the in-current-step ring.
- **FR-007**: A token MUST loop along the current step's connection in its direction, 1.4 s per loop at 1× and 0.7 s at 2×; no token is drawn for a broken step.
- **FR-008**: Under `prefers-reduced-motion`, the token MUST be a static marker at the connection's midpoint and dimming and highlight changes MUST be instant; all other cues (width, solid label, step numbers, rings) MUST remain.
- **FR-009**: When flow mode starts (or switches to another flow), the canvas MUST zoom and pan to fit the whole played path in view. Afterwards, when the current step's connection is outside the visible canvas, the canvas MUST pan to show it without changing the zoom level; it MUST NOT move when the connection is already visible. Switching alternative MUST NOT re-fit.

**Step player and navigation**

- **FR-010**: The step player MUST show Previous, Play/Pause and Next buttons, "<flow> · Step n of m" and the current step's title (or "<from> → <to>"), a 1× / 2× speed toggle, and one progress segment per step of the played path with the segments up to and including the current step filled.
- **FR-011**: → and Next MUST make the next step of the played path current; ← and Previous the previous step. Previous MUST be disabled on the first step and Next on the last. Arrow keys MUST be ignored while focus is in a text field.
- **FR-012**: Clicking a step row, a progress segment, a flow connection or a flow component MUST make a step current: a row or segment its own step; a connection the first of its steps after the current step, wrapping to the first; a component the first step on the played path whose from or to is that component. Clicking a dimmed element MUST do nothing.
- **FR-013**: Play MUST advance one step every 1.7 s at 1× and every 0.85 s at 2×, and MUST stop on the last step. Play on the last step MUST restart from the first step. Changing speed, any manual navigation, switching branch, the tab being hidden or leaving flow mode MUST pause playback.
- **FR-014**: The default speed MUST be 1× for each new flow mode session.

**Branches**

- **FR-015**: The played path MUST be the flow's main path followed by one chosen alternative (always the first, "a", each time flow mode starts; the choice is not kept after flow mode ends); steps of the other alternatives MUST be dimmed like non-flow elements but keep their numbers and error styles.
- **FR-016**: When the current step is the fork step or a step of an alternative, the player MUST show "AT STEP n" (n = the fork step's number) and a segmented control listing every alternative by label, error paths with their error icon and accessible text "error path".
- **FR-017**: Choosing an alternative (by the control, or ↑ / ↓ which select the previous / next alternative in order) MUST change the played path; if the current step belonged to the old alternative, the step at the same position in the new alternative (or its last step) MUST become current; progress segments and "Step n of m" MUST follow the new path.
- **FR-018**: Step numbers in the player, the step list, the announcement and the inspector MUST use 006's derived numbering (1, 4a, 5b).

**Step view**

- **FR-019**: In flow mode the inspector MUST show the current step: "STEP n OF m · <flow>", from and to component tiles and names, the connection's protocol, CONDITION, DESCRIPTION, RULES and SLA TARGET; for a step on an alternative it MUST also show the branch label and, for error paths, the error icon.
- **FR-020**: RULES MUST list the names of rules attached to the step, or "No rules attached"; once 008 is available, this section MUST show 008's step rules view instead. Missing rules MUST show "Missing rule <id>".
- **FR-021**: SLA TARGET MUST show only the target text or "No SLA target"; no measured value or meter.
- **FR-022**: The JSON panel MUST show the current step as read-only JSON (Step tab) alongside the whole-deck tab, and MUST follow the current step as it changes.

**Accessibility and robustness**

- **FR-023**: Every change of current step MUST produce one polite screen-reader announcement "Step n of m: <from> → <to>" (with ", branch <label>" on alternatives and "connection deleted" for broken steps); rapid changes MUST replace, not queue, pending announcements.
- **FR-024**: All player controls, the branch picker and progress segments MUST be keyboard operable, have accessible names and states (pressed / current), and show the focus ring from DESIGN.md.
- **FR-025**: The flow, current step, chosen alternative, play state and speed MUST be session UI state only, never written to the deck, the file or the undo history.
- **FR-026**: Changes to the flow while in flow mode (from this tab or another) MUST be reflected live; removing the current step, the chosen alternative or the whole flow MUST be handled as described in Edge Cases, without errors.
- **FR-027**: Timers and animations MUST stop when flow mode ends, the deck is closed or switched, or the tab is hidden, and MUST NOT leak.
- **FR-028**: The screens MUST match design frames 03, 24, 26, 27, 44 and 46 (light and dark where available) pixel-close, except where DESIGN.md or founder decisions differ (target-only SLA, DESIGN.md colors, lucide icons) and except parts owned by 008 (compact decision table, "Edit rule").

### Key Entities

- **Flow mode session** (UI only, not saved): the open flow, the current step, the chosen alternative, play state (playing / paused) and speed (1× / 2×).
- **Played path** (derived): the ordered steps that playback walks: main-path steps, then the steps of the chosen alternative; each step keeps its derived number, from and to components, connection and broken flag.
- **Flow, step, branch, rule** (existing, from 006 and the file format): read here; only the step's text fields are edited, through the deck model as in 006.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: On the benchmark deck (500 components, 1,000 connections), the flow highlight appears within 100 ms of opening a flow or changing step.
- **SC-002**: While a flow plays on the benchmark deck, the canvas stays at 60 frames per second or better.
- **SC-003**: Autoplay advances within ±100 ms of 1.7 s at 1× and 0.85 s at 2× per step.
- **SC-004**: A first-time user can open a flow and walk it to its last step using only the keyboard in under 30 seconds for an 8-step flow.
- **SC-005**: In a grayscale screenshot of any step, the current step, flow connections and error paths can each be identified (verified by review of design-matched screenshots).
- **SC-006**: Under reduced motion, no element of the flow moves continuously (0 running animations).
- **SC-007**: After leaving flow mode 100 times in a row, no playback timer or animation remains active.
- **SC-008**: Opening flow mode and playing never changes the deck file: export before and after playback is identical.

## Assumptions

- The spec directory uses the backlog number 007 (the sequential scan would give 009; 007 is free and matches the backlog).
- Clicking a connection used by several steps cycles forward through them; this is not in the design and is chosen as the least surprising default.
- The player position and sizes (420–560 px wide, bottom centre) and the motion values come from design-analysis §c; the motion tokens exist or are added in `packages/ui` per 000.
- Counting "flows played" for the north-star metric is 014; this feature only makes playback possible.
- The Labels toggle and minimap keep their current behavior in flow mode; the Focus toggle is hidden in flow mode (design-analysis §b).
