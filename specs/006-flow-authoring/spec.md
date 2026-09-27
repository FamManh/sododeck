# Feature Specification: Flow Authoring

**Feature Branch**: `006-flow-authoring`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "006 (flow-authoring) from docs/backlog.md — Let architects record business flows on top of the existing diagram. A feature (for example "Delivery") groups many flows. To create a flow, the user starts recording and clicks existing connections in order; each click adds a step, without redrawing anything. Each step can have a title, description, condition and SLA target. A flow can branch at a step into an alternative path with its own condition, and error paths look clearly different from the happy path (not by color alone). Users can reorder, remove and edit steps, rename and delete flows and features, and filter the flow list. If a connection used by a step is deleted, the step is shown as broken instead of silently disappearing. Why: a feature with 10–20 flows is unreadable as one blob; flows must be first-class objects, and creating them must be fast."

**Sources**: `docs/backlog.md` §006 and founder decisions §g-11, §g-19, `docs/spec.md` §7.3 (F-1, F-4, F-5) and §7.4 (K-1, flow and step title and description), `docs/design/design-analysis.md` §a (flow mode, states 41–48), §d ("Data implied by states 41–85": step branch shape), §g-18 (non-contiguous click is blocked), `docs/design/screens/` 02, 03, 41–48 (light and dark), `specs/002-yjs-model/spec.md` (delete policy: steps on a deleted connection are kept and reported broken; deleting a feature detaches its flows), `specs/003-canvas-basic/spec.md` (editor shell, confirm-delete dialog, Undo toast, undo history), `specs/004-json-panel-sync/spec.md` (read-only JSON panel), `specs/005-local-library-autosave/spec.md` (autosave, multi-tab sync), constitution v1.0.0 (principles I, II, III, IV, V, VI, VII, VIII).

**Dependency note**: 003 (canvas), 004 (JSON panel) and 005 (local library, autosave, multi-tab sync, `81d2d3a`) are merged. Every change in this feature goes through the model, so it is autosaved, survives reload and syncs between tabs through 005 with nothing flow-specific. The file format already has features, flows and steps (with stable step ids, condition, SLA, title, description); the model already edits them and keeps steps whose connection is deleted. The editor's left panel today only shows "Flows and features arrive in Milestone 2." This feature replaces that placeholder.

## Scope

**In scope**

- Features in the left panel: create, rename, delete (with confirmation and Undo toast, §g-11, §g-19); each feature lists its flows with their step counts.
- Flows: create by recording, rename, move to another feature, delete (with confirmation and Undo toast); a flow and its steps can be edited later ("Editing '<flow>'" mode, design 45).
- Recording mode (design 41–44): "+ New flow" names the flow; a top-bar chip "Recording '<name>' · n steps" with Undo ⌘Z, Done and Cancel Esc shows in the centre of the top bar (where the view switcher of 010/011 will go); the canvas stays at full opacity; hovering a connection previews it as the next step; recorded connections get numbered step badges; the node where the next step must start gets a ring and a "Step n starts here" tag, and its outgoing connections show as dotted candidates; a hint says "Next: click an edge leaving <node>".
- Blocked non-contiguous clicks (design 43, §g-18): a connection that does not start where the last step ended is not added; it flashes in the invalid style (dashed, ban icon), a popover says "Can't add this edge as step n", offers "Add as branch from step k" when the connection leaves the end node of an earlier step k, and "Got it"; the same message shows in the step list and is announced politely.
- Keyboard recording: Tab / Shift+Tab move between candidate connections, Enter adds the focused one.
- Step list editing: select a step, edit its title, description (markdown), condition and SLA target in the inspector; reorder by grip drag or ⌥↑ / ⌥↓; remove with ⌫ or the row's remove button; undo last step (⌘Z).
- Chain check: a reorder that makes a step not start where the previous one ended marks the affected rows (dashed clay dot + alert icon + text) and blocks Done until fixed.
- Branches (design 45–46): B on a focused step starts a branch after that step, with a required label, a required condition and an Error path toggle, then the user picks the branch's connections on the canvas; the step list indents branches under "◇ <label>" headers with numbering 4a / 5a, 4b / 5b; the inspector of the fork step lists its branches.
- Error paths look different without relying on color: dashed connection line plus an alert icon on the connection label, the step badge and the branch header, plus the text "error path".
- Showing a flow: selecting a flow in the list shows its steps in the left panel and marks its connections on the canvas with numbered step badges, happy-path and error-path styles.
- Broken steps: when a connection used by a step is deleted, the step stays in the flow with a "broken" indicator (icon + text, for example "Connection deleted"); undo restores the connection and clears the indicator.
- Flow list filter (design 47–48): / focuses it; live filtering over flow names, step titles, connection labels and conditions; "n of m" count; matches bold and underlined; parent feature headers stay visible; an empty state with "Clear filter" and "New flow '<text>'".
- Flow inspector fields: title, description (markdown), feature, owner (free text with suggestions from owners already used in the deck, §g-10).
- File format: an optional branch description on steps (fork, label, condition, error-path flag), added without a format version bump, with a round-trip test and a decision record.

**Out of scope**

- Flow playback: dimming the rest of the canvas, the animated token, the step player, playback speed and the branch picker "AT STEP n" (007).
- Rules on steps, rule sample inputs, SLA meter and step owner, tags and links (008).
- Problems panel warnings such as overlapping branch conditions (015).
- Global search and ⌘K (009).
- Flow comparison, flow × node matrix, sequence and swimlane renderings (P1).
- Branches inside branches (only one level of branching) and branches that join back into the main path.
- Drawing new connections while recording (flows only use existing connections; connections are drawn in normal canvas mode).
- New end-to-end browser tests (constitution VI; the existing smoke suite must keep passing).

## Clarifications

### Session 2026-09-27

- Q: When the first branch is added after step n and the main path already continues after step n, what happens to those later steps? → A: They become the first alternative "a" and need their own label and condition, as design 46 shows every alternative under a "◇" header; the new branch is the next letter. After a fork, the main path ends at the fork step.
- Q: When the user presses Cancel in edit mode on a saved flow, what is undone? → A: Only structural changes live in edit mode (adding, reordering, removing steps, adding or deleting branches); Cancel, after confirmation, restores the flow exactly as it was when edit mode started. Text fields of flows, steps and branches (title, description, condition, SLA, label, owner, feature) are editable whenever a flow is selected, save as you type and are undone with ⌘Z; they are not reverted by Cancel.
- Q: Should a broken step (its connection was deleted) block Done until it is removed? → A: No. Broken steps never block Done; they stay flagged and the flow is saved with them. Only a broken chain between existing steps and empty branch label or condition block Done.
- Q: In what order should features and the flows inside each feature appear in the left panel? → A: Creation order by default; users can reorder features and flows (drag, ⌥↑ / ⌥↓ on a focused row, or moving a flow into another feature, where it goes to the end), and the order is saved in the deck.
- Q: Can a step be moved between the main path and a branch, or between branches, when reordering? → A: No. Steps reorder only within their own path (the main path or one alternative); ⌥↑ / ⌥↓ stop at the first and last step of that path and a drag outside it is refused.
- Q: What should a step row in the step list show as its main line and second line? → A: Main line: the step title, or "From → To" when the step has no title. Second line: the connection label, followed by the condition when one is set.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Record a flow by clicking connections (Priority: P1)

An architect has a system diagram. In the Delivery feature they press "+ New flow", type "Place order", and the editor enters recording mode. They click "Customer App → API Gateway", then "API Gateway → Order Service", then "Order Service → Event Bus". Each click adds a numbered step; the step list and the top-bar chip count up. They press Done; the flow is saved under Delivery with three steps and shown.

**Why this priority**: This is F-1, the core of the product's flow layer; every later flow feature (playback, rules, export) needs flows to exist.

**Independent Test**: On a deck with connections and one feature, record a three-step flow with the mouse and check the flow list, the step list, the canvas badges and the flow in the JSON panel.

**Acceptance Scenarios**:

1. **Given** a deck with connections and a feature, **When** the user chooses "+ New flow" in that feature and enters "Place order", **Then** recording mode starts: the top-bar chip reads "Recording 'Place order' · 0 steps" with Undo, Done and Cancel, the left panel shows the flow name and "No steps yet", and Done is disabled.
2. **Given** recording with no steps, **When** the user hovers any connection, **Then** it is previewed as step 1; **When** they click it, **Then** it becomes step 1 with a numbered badge on the canvas and a row "<from> → <to>" in the step list.
3. **Given** recording with steps, **When** the user looks at the canvas, **Then** the node where the next step must start has a ring and a "Step n starts here" tag, its outgoing connections show as dotted candidates, and the step list shows "Next: click an edge leaving <node>".
4. **Given** recording "Place order" and three connections clicked in order, **When** the user presses Done, **Then** the flow has three steps referencing those connections in that order, it appears under its feature with "3 steps", a toast confirms it, and the flow is shown.
5. **Given** recording, **When** the user presses ⌘Z / Ctrl+Z or "Undo last step", **Then** the last recorded step is removed.
6. **Given** recording with steps, **When** the user presses Esc or Cancel, **Then** a confirmation asks before discarding; **When** confirmed, **Then** no flow is added and the deck is as before recording. **Given** recording with no steps, **When** Esc is pressed, **Then** recording ends without asking.
7. **Given** a connection already used by an earlier step, **When** the user clicks it again while it continues the chain, **Then** it is added as a new step (the same connection may appear in several steps).

---

### User Story 2 - Blocked clicks and keyboard recording (Priority: P1)

While recording, the architect clicks a connection that does not start where the last step ended. Nothing is added; the connection flashes dashed with a ban icon, and a popover explains why and offers to add it as a branch from the earlier step it leaves. A keyboard-only user records the same flow with Tab and Enter.

**Why this priority**: Without it, recording produces broken flows (§g-18) and fails keyboard users (constitution VII); it is part of making recording correct, not an extra.

**Independent Test**: Record a flow, click a non-contiguous connection, check nothing is added and the message appears; then record a flow using only the keyboard.

**Acceptance Scenarios**:

1. **Given** recording with steps whose last step ends at node X, **When** the user clicks a connection whose source is not X, **Then** no step is added, the connection shows the invalid state (dashed + ban icon), a popover "Can't add this edge as step n" appears with "Got it", the step list shows the same message, and a polite live region announces it.
2. **Given** the same situation where the clicked connection leaves the end node of an earlier step k, **When** the popover shows, **Then** it also offers "Add as branch from step k"; **When** chosen, **Then** branch creation starts after step k with that connection as the branch's first step (story 4).
3. **Given** recording, **When** the user presses Tab / Shift+Tab, **Then** focus moves between candidate connections (all connections for step 1, the next start node's outgoing connections afterwards) with a visible focus indicator and an announced name; **When** Enter is pressed, **Then** the focused connection is added as the next step.
4. **Given** a next start node with no outgoing connections, **When** the user looks at the hint, **Then** it says the flow cannot continue from that node and suggests Done or a branch.

---

### User Story 3 - Organize features and flows, and edit steps (Priority: P2)

The architect creates a "Payments" feature, renames "Delivery" to "Delivery & tracking", moves a flow between features, renames a flow, and later opens "Place order" to fix it: they give step 2 a title and SLA "< 300 ms", add a condition, reorder two steps, and remove one. They delete an old flow and a feature after confirming, and undo one of the deletes.

**Why this priority**: A feature with 10–20 flows must be organized and correctable; it builds on stories 1–2.

**Independent Test**: With a few features and flows, perform each action from the left panel, the inspector and the keyboard and check the list, the canvas and the JSON panel after each one, including undo.

**Acceptance Scenarios**:

1. **Given** the left panel, **When** the user creates a feature, **Then** it appears with an empty flow list and "+ New flow"; **When** they rename it (inline, F2 or menu), **Then** the new title shows in the panel, the flow inspector and the JSON; empty names are refused and the old name stays.
2. **Given** a flow, **When** the user renames it or changes its feature in the inspector, **Then** the list updates and the flow keeps its steps and identity.
3. **Given** a selected flow, **When** the user selects a step, **Then** the inspector shows its title, description, condition and SLA target for editing, and the header "Step n · <from> → <to>"; in the step list, the row shows the title (or "<from> → <to>" without one) above the connection label and condition.
4. **Given** a focused step in edit mode, **When** the user presses ⌥↑ / ⌥↓ or drags its grip, **Then** it moves up or down; **When** the move makes a step not start where the previous step ended, **Then** the affected rows show a dashed clay dot, an alert icon and a text explanation, and Done stays disabled until the chain is valid again.
5. **Given** a focused step, **When** the user presses ⌫ or the row's remove button, **Then** the step is removed and the numbering updates; ⌘Z restores it.
6. **Given** a flow or a feature, **When** the user chooses Delete, **Then** a confirmation dialog names it (for a feature, it says how many flows it contains and that they are kept as flows without a feature); **When** confirmed, **Then** it disappears and a 6 s toast offers Undo with a ⌘Z hint; ⌘Z still undoes the delete after the toast is gone.
7. **Given** flows without a feature (created before features existed, or whose feature was deleted), **When** the left panel shows, **Then** they are listed in a "No feature" section and can be moved into a feature.
8. **Given** a feature with flows "Place order", "Assign driver", "Live tracking", **When** the user focuses "Live tracking" and presses ⌥↑ twice (or drags it to the top), **Then** it is listed first, and it stays first after reload and after export → import.

---

### User Story 4 - Branches and error paths (Priority: P2)

At step 3 "Order Service → Payment Service" the architect presses B, labels the new branch "payment failed", sets the condition `payment.status == "declined"`, turns on Error path and clicks "Payment Service → Notification Service" and "Notification Service → SMS Gateway". The step list shows the branch indented under "◇ payment failed" with steps 4b and 5b; on the canvas the branch is dashed with an alert icon, clearly different from the happy path.

**Why this priority**: F-4 is P0, but branches only make sense once linear flows work (stories 1–3).

**Independent Test**: On a recorded flow, add a normal branch and an error-path branch, check the step list numbering, the canvas styles (with color ignored), the inspector of the fork step and validation of empty fields.

**Acceptance Scenarios**:

1. **Given** a flow in edit or recording mode with step 3 focused, **When** the user presses B (or "Add branch" on the step), **Then** the top-bar chip reads "Editing '<flow>' · adding branch after step 3", the inspector shows NEW BRANCH label, condition and an Error path toggle, and the hint says to pick the first edge of the branch leaving step 3's end node.
2. **Given** a new branch, **When** the user presses Done with an empty label or condition, **Then** an inline error (icon + text) shows on each empty field, focus moves to the first one, and the branch is not saved.
3. **Given** a branch being recorded, **When** the user clicks connections, **Then** the same contiguity rules as story 2 apply, starting from the fork step's end node.
4. **Given** a flow, **When** the user adds a branch at step 2 labelled "payment declined" and marks it as an error path, **Then** its connections render dashed with an alert icon on their labels and step badges, its header reads "◇ payment declined" with an alert icon and the text "error path", and the happy path stays solid.
5. **Given** a fork step with branches, **When** it is selected, **Then** the inspector lists "BRANCHES AFTER THIS STEP" with each label, condition and first step number; choosing one selects that branch.
6. **Given** a branch, **When** the user edits its label, condition or Error path toggle, or deletes it (with confirmation and Undo toast), **Then** the step list, canvas and JSON update.
7. **Given** a step that is already inside a branch, **When** the user presses B, **Then** no nested branch is created and a message says branches can only start from the main path.
8. **Given** a flow whose main path continues after step 3 (steps 4–6) and no branch at step 3, **When** the user adds the first branch after step 3, **Then** steps 4–6 become alternative "a" (4a–6a) under their own "◇" header, the new branch becomes alternative "b", and both need a label and a condition: Done shows the inline errors of scenario 2 on alternative "a" until they are filled in.
9. **Given** a step 3 with no later main-path steps, **When** the user adds the first branch, **Then** it becomes alternative "a"; a further branch at step 3 becomes "b", and so on.
10. **Given** a fork step, **When** the user looks at the step list, **Then** the main path ends at the fork step and every later step belongs to exactly one labelled alternative.

---

### User Story 5 - Find a flow and spot broken steps (Priority: P3)

In a feature with ten flows, the architect presses / and types "fail": only matching flows remain, with the match highlighted and "2 of 10" shown. Later someone deletes a connection used by a step; the step shows as broken in its flow instead of disappearing.

**Why this priority**: F-5 and data safety for flows; valuable once there are many flows.

**Independent Test**: With ten flows, filter by name, step text and condition, check the empty state; delete a connection used by a step, check the broken indicator, then undo.

**Acceptance Scenarios**:

1. **Given** ten flows in a feature, **When** the user types "fail" in the flow filter, **Then** only flows whose name, step titles, connection labels or conditions contain "fail" (ignoring case) show, their parent feature headers stay visible, matching text is bold and underlined, and the count reads "n of m".
2. **Given** the editor with focus outside a text field, **When** the user presses /, **Then** the flow filter gets focus; Esc in the filter clears it.
3. **Given** a filter with no matches, **When** the list is empty, **Then** it shows an empty state with "Clear filter" and "New flow '<text>'"; the latter starts recording a flow with that name in the current feature.
4. **Given** a step whose connection is deleted, **When** the flow is shown, **Then** the step stays in place with a broken indicator (icon + text "Connection deleted") and the flow list shows the flow has a problem; **When** the deletion is undone, **Then** the indicator disappears.
5. **Given** a broken step, **When** the user removes it, **Then** the flow keeps its other steps, and any break in the chain it leaves is flagged as in story 3.

---

### Edge Cases

- **Deck with no connections**: "+ New flow" is still available; recording shows a hint that a flow needs connections and Done stays disabled.
- **Deck with no features**: "+ New flow" in the "No feature" section records a flow without a feature; the user can create a feature at any time.
- **Duplicate names**: flows and features may share names; ids keep them distinct and renames never break references.
- **Empty flow name** at "+ New flow": refused with an inline error; recording does not start.
- **Connection deleted while recording** (in this tab or another tab): the step on it is kept and marked broken; Done stays available and saves the flow with the broken step flagged. The broken step is skipped when working out where the next step must start (the previous valid step's end node is used).
- **Node deleted**: its connections go with it (003), so steps on them become broken as above.
- **A connection used twice in one flow** (for example a retry loop): allowed; each step has its own number and badge.
- **A second branch point**: because the main path ends at its branch point, a flow branches at one step only. Adding a branch after the existing branch step adds another alternative there; adding one at an earlier step is refused with a message ("This flow already branches after step n"), since it would put a branch inside a branch. A refused connection whose start is an earlier step's end node therefore offers "Add as branch" only at the branch step itself.
- **Self-loop connection**: may be used as a step; the next step starts at the same node.
- **Leaving the deck or reloading while recording**: the steps recorded so far are kept as a saved flow (autosave never loses work); recording mode is not resumed.
- **Selecting nodes or opening menus while recording**: node clicks do not add steps; canvas editing (moving, adding nodes, drawing connections) is paused until Done or Cancel.
- **Two tabs**: a flow recorded in one tab appears in the other when Done is pressed or as steps are added (005 live sync); recording mode itself is per tab.
- **Long flow and feature names**: shortened with an ellipsis in the list and chip, shown in full on hover and to assistive technology.
- **Filter while recording**: the filter is hidden during recording (the left panel shows the flow being recorded).
- **Reordered steps then Cancel in edit mode**: after confirmation, the flow's steps and branches return to exactly how they were when edit mode started; text edits made meanwhile (for example a renamed step) are kept, and ⌘Z undoes them one by one.
- **Text edit to a step that Cancel then removes** (a step added in this edit session): the step and its text disappear with the Cancel.
- **Broken chain in a saved flow** (for example a flow imported from a file): the flow opens and shows the flagged rows; it is not rejected.
- **Saved flow with broken steps opened in edit mode**: Done is not blocked by them; the user may remove them or leave them flagged.

## Requirements _(mandatory)_

### Functional Requirements

**Features and flow list**

- **FR-001**: The left panel MUST list features, each with its flows and each flow's step count, plus a "No feature" section for flows without a feature (shown only when such flows exist).
- **FR-001a**: Features and the flows within each feature MUST be listed in creation order by default; users MUST be able to reorder features and flows by drag and by ⌥↑ / ⌥↓ on a focused row, and the order MUST be saved in the deck (it survives reload, export and import). A flow moved to another feature MUST go to the end of that feature's list.
- **FR-002**: Users MUST be able to create, rename (inline, F2, menu) and delete features; empty names MUST be refused and the old name kept.
- **FR-003**: Users MUST be able to rename a flow, change its feature, edit its description (markdown) and owner (free text with suggestions from owners already used in the deck), and delete it.
- **FR-004**: Deleting a feature, flow, step or branch from a menu MUST ask for confirmation in a dialog that names the item (a feature dialog also states how many flows it holds and that they are kept); after confirming, a 6 s toast MUST offer Undo with a ⌘Z hint, and ⌘Z MUST still undo the delete after the toast is gone. Removing a step with ⌫ or its row button during recording or editing MUST NOT ask (it is undoable at once with ⌘Z).
- **FR-005**: Deleting a feature MUST keep its flows, which then appear under "No feature".

**Recording**

- **FR-006**: "+ New flow" MUST ask for a flow name (required) and start recording mode for a new flow in that feature.
- **FR-007**: In recording mode the top bar MUST show "Recording '<name>' · n steps" with Undo (⌘Z), Done and Cancel (Esc) in the centre of the top bar (where the view switcher of 010/011 will go), and the canvas MUST stay at full opacity.
- **FR-008**: Clicking a connection MUST add it as the next step when it is the first step or when its source is the end node of the last step; hovering a connection MUST preview it as the next step.
- **FR-009**: Recorded connections MUST show numbered step badges; the next start node MUST show a ring and a "Step n starts here" tag, its outgoing connections MUST show as dotted candidates, and the step list MUST show "Next: click an edge leaving <node>".
- **FR-010**: Clicking a connection that does not continue the chain MUST add nothing, show the connection in the invalid style (dashed + ban icon), show a popover "Can't add this edge as step n" with "Got it", show the same message in the step list, and announce it in a polite live region.
- **FR-011**: When the refused connection leaves the end node of an earlier main-path step k, the popover MUST also offer "Add as branch from step k", which starts a branch after step k with that connection as its first step.
- **FR-012**: Done MUST be disabled until the flow has at least one step and while any step is flagged as breaking the chain between existing steps or a branch has an empty label or condition; the reason MUST be shown next to Done. Broken steps (FR-032) MUST NOT block Done: the flow is saved with them still flagged. The chain check MUST skip a broken step, so the steps on either side of it are not flagged only because the connection between them is gone.
- **FR-013**: Esc / Cancel MUST ask for confirmation when steps were recorded (or edits made) and discard them when confirmed; with nothing recorded it MUST end recording without asking.
- **FR-014**: ⌘Z / Ctrl+Z and "Undo last step" in recording mode MUST remove the last recorded step.
- **FR-015**: Tab / Shift+Tab MUST move focus between candidate connections and Enter MUST add the focused one; focus MUST be visible and the focused connection's name announced.
- **FR-016**: Done MUST save the flow to its feature, end recording, show a confirmation toast and show the flow with its steps.
- **FR-017**: While recording, clicks on nodes MUST NOT add steps and canvas structure editing (adding, moving, deleting nodes and connections) MUST be paused.

**Editing steps**

- **FR-018**: Users MUST be able to reopen a saved flow in edit mode ("Editing '<flow>'") to make structural changes: add steps at the end of the main path (or of a chosen alternative once the flow has a fork, FR-030), add or delete branches, reorder and remove steps. Cancel MUST ask for confirmation when structural changes were made and then restore the flow exactly as it was when edit mode started; Done MUST keep them.
- **FR-018a**: Text fields (flow title, description, owner, feature; step title, description, condition, SLA; branch label, condition, error-path flag) MUST be editable whenever a flow or step is selected, with or without edit mode, save as the user types, be undoable with ⌘Z, and MUST NOT be reverted by Cancel of edit mode.
- **FR-019**: Selecting a step MUST show in the inspector its header "Step n · <from> → <to>" and editable title, description (markdown), condition and SLA target.
- **FR-019a**: Each step row MUST show as its main line the step title, or "<from> → <to>" when the step has no title, and as its second line the connection label followed by the condition when one is set. A broken step whose connection is gone MUST show its title (or "Unknown connection") with the broken indicator in place of the second line.
- **FR-020**: Users MUST be able to reorder steps by grip drag and ⌥↑ / ⌥↓, and remove the focused step with ⌫ or the row's remove button. Reordering MUST stay within the step's own path (the main path or one alternative): ⌥↑ / ⌥↓ MUST stop at the path's first and last step, and a drag outside the path MUST be refused (the step returns to its place).
- **FR-021**: A step that does not start where the previous step on its path ended MUST be flagged in the step list with a dashed clay dot, an alert icon and text, and on its canvas badge.

**Branches**

- **FR-022**: Pressing B on a focused main-path step (or "Add branch") MUST start a branch after that step, with the top-bar chip "Editing '<flow>' · adding branch after step n" and inspector fields for label (required), condition (required) and an Error path toggle.
- **FR-023**: Pressing Done with an empty branch label or condition MUST show an inline error (icon + text) on each empty field and MUST NOT save the branch.
- **FR-024**: A branch's steps MUST follow the same contiguity rules as the main path, starting from the fork step's end node.
- **FR-025**: The step list MUST show branches indented under "◇ <label>" headers after their fork step, numbered with the step position and a branch letter (4a, 5a, 4b, 5b); the header count MUST read "<main steps> + <n> branches".
- **FR-026**: Error-path branches MUST be distinguishable without color: dashed connection lines, an alert icon on the connection label, the step badge and the branch header, and the text "error path" in the step list.
- **FR-027**: Selecting a fork step MUST list its branches in the inspector ("BRANCHES AFTER THIS STEP": label, condition, first step number), each selectable.
- **FR-028**: Users MUST be able to edit a branch's label, condition and error-path flag, and delete a branch (with its steps).
- **FR-029**: Only one level of branching MUST be allowed: pressing B on a step inside a branch MUST NOT create a branch and MUST explain why.
- **FR-030**: A fork MUST end the main path: when the first branch is added after step n, any main-path steps after n MUST become alternative "a" (with a required label and condition, like any branch) and the new branch the next letter; after a fork, every step after step n MUST belong to exactly one labelled alternative, and edit mode MUST append new steps to the end of a chosen alternative. Deleting an alternative MUST keep the others as labelled branches.

**Showing flows and broken steps**

- **FR-031**: Selecting a flow MUST show its steps in the left panel and mark its connections on the canvas with numbered step badges, happy-path and error-path styles; other elements keep their normal look (dimming is 007).
- **FR-032**: A step whose connection no longer exists MUST stay in its flow and show a broken indicator (icon + text "Connection deleted") in the step list; the flow's row in the list MUST show that it has a problem (icon + accessible text); undoing the deletion MUST clear the indicator.
- **FR-033**: The JSON panel MUST show the selected flow or step (Flow / Step tab) and the whole deck, read-only, updated live, as in 004.

**Filter**

- **FR-034**: The flow filter MUST filter flows as the user types, ignoring case, over flow names, step titles, connection labels of steps and conditions (steps and branches); matching text MUST be bold and underlined; the count MUST read "n of m"; parent feature headers of matches MUST stay visible.
- **FR-035**: / MUST focus the filter when focus is not in a text field; Esc in the filter MUST clear it.
- **FR-036**: With no matches, the list MUST show an empty state with "Clear filter" and "New flow '<text>'".

**File format, data, access and performance**

- **FR-037**: Branch information (fork step, label, condition, error-path flag) MUST be stored in the deck file as an optional, additive part of steps without a format version bump; files without it MUST keep loading, and export → import MUST give an identical deck.
- **FR-038**: Step numbers (1, 4a, …) and a step's from / to nodes MUST be derived for display and never stored.
- **FR-039**: Every change (feature, flow, step, branch) MUST go through the deck model so that it is autosaved, synced to other tabs and undoable with ⌘Z.
- **FR-040**: Every action in this feature MUST be operable by keyboard with a visible focus indicator; dialogs, popovers, menus and toasts MUST have accessible names; recording and validation messages MUST be announced; no state (candidate, invalid, error path, broken, match) MUST rely on color alone.
- **FR-041**: The screens MUST match design frames 41–48 and the left-panel flow list of 02 and 03 (light and dark), except where DESIGN.md or founder decisions differ (confirmation before deletes, DESIGN.md clay for error paths and invalid states, lucide icons) and except playback parts owned by 007 (player, branch picker, dimming).
- **FR-042**: No flow, feature or step content MUST leave the device.

### Key Entities

- **Feature**: a business capability that groups flows; has a stable id, title, description and owner. Deleting it keeps its flows.
- **Flow**: an ordered path over existing connections; stable id, title, description, owner, optional feature, and its steps. Tags and links exist in the file but are edited in 008.
- **Step**: one hop of a flow over one existing connection; stable id, the connection it travels, title, description, condition, SLA target. The same connection may appear in several steps. Its number and from / to nodes are derived.
- **Branch**: an alternative path forking after a main-path step; label, condition, error-path flag and its own steps. One level only. Stored as optional information on steps (new, additive).
- **Recording session**: UI-only, per tab: the flow being recorded or edited, mode (recording, editing, adding branch), the next start node, the focused candidate, pending validation messages.
- **Flow filter**: UI-only text and result count.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can record a 5-step flow on an existing diagram in under 30 seconds with the mouse, and in under 60 seconds with the keyboard alone.
- **SC-002**: Each click on a valid connection adds the step, badge and list row within 100 ms on the benchmark deck (500 components / 1,000 connections); selecting a flow marks its path within 100 ms; canvas frame rate stays at or above the pre-feature benchmark.
- **SC-003**: 100% of non-contiguous clicks in tests add no step and show the explanation; 0 saved flows contain a chain break created by recording.
- **SC-004**: In a feature with 20 flows, a user finds a known flow via the filter in under 5 seconds.
- **SC-005**: Deleting a connection used by steps loses 0 steps: 100% of affected steps show as broken and are fully restored by undo.
- **SC-006**: Error paths are identified correctly in a grayscale screenshot in 100% of review checks (dashed line + icon + text).
- **SC-007**: Export → import of decks with flows, branches and broken steps gives an identical deck in 100% of round-trip tests.
- **SC-008**: Every action in this feature can be completed with the keyboard alone.

## Assumptions

- Flow-mode playback (dimming, token, player, branch picker) is 007; in 006, selecting a flow only marks its path, as the "normal flow mode on step 1" of design 44 minus playback.
- Recording writes steps to the deck as they are added (so they are autosaved and synced); Cancel removes them after confirmation, which is why a reload during recording keeps the recorded steps as a saved flow.
- Edit mode on an existing flow appends at the end of the main path, or at the end of a chosen alternative once the flow has a fork; inserting a new connection in the middle of a path is done by recording at the end and reordering.
- Branches end the flow (they do not rejoin the main path) and there is one level of branching (backlog risk note).
- The step inspector in 006 shows only title, description, condition and SLA target; rules, sample inputs, SLA meter, owner, tags and links on steps come in 008. SLA is a target only (§g-6).
- Owner suggestions come from owners already used in the deck (§g-10); there is no team list.
- The "flow has a problem" marker in the list is local to 006; the deck-wide Problems panel is 015.
- The branch shape the design settles (fork step, label, condition, error-path flag) is recorded in a decision record during planning; no other format change is needed because features, flows and steps already exist in schema v1.
- No new runtime dependency is expected; any addition is justified in `plan.md` and approved by the founder (constitution VIII).
