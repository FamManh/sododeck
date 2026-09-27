# Feature Specification: Inspectors and Rules

**Feature Branch**: `008-inspector-rules`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "008 (inspector-rules) from docs/backlog.md, specified on top of the 006 flow-authoring docs (`specs/006-flow-authoring`). Let users attach knowledge to everything on the diagram. Selecting a component, connection, flow, step or the deck itself shows a side panel where they edit its title, a markdown description with preview, owner, tags and links, plus type-specific fields (technology and hosting for components; label, protocol and direction for connections; condition and SLA for steps). Several components can be edited at once. Business rules are decision tables: named, described, with a hit policy, condition and action columns and rows; conditions accept comparisons, lists and "any". A rule is shared: attach it to any flow step or component and edits apply everywhere; the rule shows where it is used, and a step shows its table with the row that matches. Users can try inputs and see which row matches. Why: complex business rules (thresholds, retries, SLAs) get lost in scattered docs; they must live on the exact step they govern."

**Sources**: `docs/backlog.md` §008 and founder decisions §g-6 (rule test panel + catch-all check in 008, SLA target only), §g-10 (owner is free text with suggestions), §g-11 and §g-19 (confirm deletes, then Undo toast), `docs/spec.md` §7.1 (C-6 bulk edit) and §7.4 (K-1, K-2), `docs/design/design-analysis.md` §a (states 02, 03, 04, 10, 18, 23, 24, 28, 29, 49–51, 58), §e (inspector and rule editor behavior), §g-20 (success green per DESIGN.md), §g-24 (no measured SLA), §g-26 (owner combobox styled like a select), `docs/design/screens/` (light and dark), `specs/002-yjs-model/spec.md` (FR-012, FR-013, FR-018: rule delete and column cascades), `specs/003-canvas-basic/spec.md` (minimal inspector, connection popover, multi-select, confirm-delete dialog, undo units), `specs/005-local-library-autosave/spec.md` (deck inspector STORAGE section, autosave, multi-tab sync), `specs/006-flow-authoring/spec.md` and `data-model.md` (flow and step selection, flow and step inspectors, branches, step numbering, "show a flow at a step"), constitution v1.0.0 (principles I–VIII).

**Dependency note**: 008 depends on 006, which is merged on `main` (`96bd929`). This spec relies on what 006 ships: features and flows in the left panel, selecting a flow or a step (without flow playback), the flow inspector (title, description, feature, owner) and step inspector (title, description, condition, SLA target), derived step numbers (1, 4a, …), branches, broken steps, and "show flow F with step S selected". 007 (flow playback) is **not** a dependency: everything here works on a selected flow and step without flow mode. The file format already holds every field this feature edits (titles, descriptions, owners, tags, links, node technology and host, connection protocol and direction, step rules and sample inputs, and rules with hit policy, columns and rows), so no format change is expected.

## Scope

**In scope**

- One inspector per selection type, replacing 003's minimal inspector and extending the flow and step inspectors built in 006:
  - **Component** (design 02, 18, 23): header (kind tile, title, "Kind · Group · id", delete); TITLE, KIND, GROUP, DESCRIPTION · MARKDOWN (Write / Preview), OWNER + TECH, HOST, TAGS, LINKS, RULES (+ Attach), CONNECTIONS · n.
  - **Connection** (design 49): TITLE (= label), FROM / TO, PROTOCOL (segmented), DESCRIPTION, OWNER, DIRECTION, TAGS, LINKS, USED IN FLOWS.
  - **Flow** (design 50): TITLE, DESCRIPTION, OWNER, FEATURE, TAGS, LINKS, and a summary.
  - **Step** (design 51, minus the measured SLA): TITLE, DESCRIPTION, OWNER, EDGE, TAGS, LINKS, CONDITION, SLA TARGET, ATTACHED RULES with a compact decision table, the matched row and the step's sample inputs.
  - **Deck** (nothing selected, design 10): NAME, DESCRIPTION, TAGS, stats (Components, Connections, Flows, Rules), and the existing STORAGE section from 005.
- Shared field components: markdown description with Write / Preview (paragraphs, bullets, inline code), owner combobox (free text + suggestions from owners in the deck), tag input, link rows.
- Multi-select bulk edit of components (design 58): KIND, OWNER, TECH, GROUP, TAGS; differing values show "Mixed"; tags on some components show dashed with "n/m"; one change applies to all selected components as one undo step.
- Rule editor screen (design 04, 28, 29): DECISION TABLES list with New; rule name, description and hit policy (First match / Unique / Collect); add, rename and remove condition and action columns; edit cells; add, delete and reorder rows; delete a rule (with confirmation and Undo toast); cell syntax hint.
- Rule test panel (founder decision §g-6): TEST INPUT with one field per condition, live match result (matched row highlighted, its actions listed) or "No row matches these inputs"; USED IN list; CHECKS (catch-all check and a hit-policy explanation).
- Attaching and detaching rules on steps and components; "Used in" jumps to the step (in its flow) or the component.
- Cell matching and hit-policy evaluation as one shared, tested behavior used by the test panel and the step's compact table.

**Out of scope**

- Flow mode and playback: dimming, token, step player, "STEP n OF m" player context, branch picker (007). The step inspector in 008 works on a step selected from the flow's step list (006).
- Measured SLA, p95 values and the SLA meter (§g-6, §g-24): the step shows its SLA target only.
- Deck-wide Problems panel, amber problem glyphs and the "n problems" button (015). The rule editor's CHECKS section is local to one rule.
- ⌘K and global search across rules (009); stickies (009).
- Saved views and the deck inspector's VIEWS section (011).
- Comments (P1), ADRs (P1), glossary (P1), a rule simulator across flows (A-1), rule import/export on its own.
- Reordering columns of a rule; ranges such as `5..10` in cells; formulas in action cells.
- Feature inspector (features stay edited from the left panel as in 006); flow `trigger` / `outcome` and step `payload` / `notes` fields (kept in the file, not edited here).
- Creating, renaming and deleting groups (010); 008 only moves components between existing groups.
- Cloud-specific component fields (provider, service, region, resource id) (design 61, owned by 003's follow-up).
- Editing the JSON panel (still read-only, §g-3); new end-to-end browser tests (constitution VI).

## Clarifications

### Session 2026-09-27

- Q: Should 008 be built as one feature or split into 008a (inspectors, bulk edit) and 008b (decision tables)? → A: One feature: one spec, one plan, one tasks list, delivered in one PR.
- Q: With the Unique hit policy, what does the result show when several rows match? → A: No winner; a warning names every matching row ("2 rows match; Unique expects one"). The design's "returns the first match" is not followed.
- Q: Should deleting a single row or column of a rule ask for confirmation? → A: No. Rows and columns are deleted at once with an Undo toast and ⌘Z (an exception to §g-11, like removing a step in 006); only deleting a whole rule asks.
- Q: When the rule editor is opened from a step, are TEST INPUT changes saved as that step's sample inputs? → A: Not automatically. Test inputs stay temporary; when opened from a step, a "Save as step inputs" action writes the current values to that step as one undo step.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Document a component or connection (Priority: P1)

An architect selects "Pricing Service" and fills in its description in markdown ("Returns a fee and tier. Uses `Delivery tier`."), checks it in Preview, picks owner "Orders" from the suggestions, sets technology "Python" and host "eu-west k8s", adds the tags "pricing" and "pci", and pastes a link to the runbook. Then they select the connection "Order Service → Pricing Service", switch its protocol to gRPC, add a description and see which flows use it.

**Why this priority**: K-1 is the base of the knowledge layer; every other story reuses these fields, and without them the inspector is only a title box (003).

**Independent Test**: On a deck with components and connections (no flows or rules needed), edit every field of a component and a connection, check the canvas, outline and JSON panel after each edit, and undo the last edit with one ⌘Z.

**Acceptance Scenarios**:

1. **Given** a selected component, **When** the user edits title, kind, group, description, owner, technology, host, tags and links, **Then** the canvas, outline and JSON panel reflect each change and one ⌘Z undoes the last field edit.
2. **Given** a description with a paragraph, bullets and `code`, **When** the user chooses Preview, **Then** the paragraph, bullets and inline code render as formatted text; **Given** an empty description, **When** Preview is chosen, **Then** it shows "Nothing to preview."
3. **Given** a description containing HTML tags or a script, **When** Preview is chosen, **Then** the tags are shown as plain text and nothing runs.
4. **Given** the owner field, **When** the user types "Or", **Then** owners already used anywhere in the deck that contain "or" are suggested; **When** they type a new owner "Platform", **Then** it is accepted as is and appears in suggestions afterwards.
5. **Given** the tag input, **When** the user types " PCI " and presses Enter, **Then** the tag "pci" is added once (trimmed, lower-cased); adding "pci" again does nothing; × or Backspace in the empty input removes the last tag.
6. **Given** the links section, **When** the user pastes `https://runbooks.example.com/pricing` and presses Enter, **Then** a link row appears labelled "runbooks.example.com"; the label can be edited; activating the row opens the link in a new browser tab; a value like `javascript:alert(1)` is refused with an inline error.
7. **Given** a selected connection, **When** the user changes its title (label), protocol, direction, description, owner, tags or links, **Then** the canvas label and end markers, the connection popover and the JSON panel show the same values.
8. **Given** a selected connection, **When** the user picks another component in FROM or TO, **Then** the connection is reattached with the same id and fields; a choice that would connect a component to itself or duplicate an existing connection is refused with the same message as when drawing (003).
9. **Given** a connection used by two flow steps, **When** it is selected, **Then** USED IN FLOWS lists each use as "<flow> · Step n"; **When** the user chooses one, **Then** that flow is shown with that step selected (006); an unused connection shows "Not used in any flow".
10. **Given** a component with connections, **When** it is selected, **Then** CONNECTIONS · n lists each connection with direction and the other component; choosing a row selects that connection.

---

### User Story 2 - Document a flow, a step and the deck (Priority: P1)

The architect opens the "Place order" flow, adds a markdown description, tags and a link to the product brief. They select step 4, give it owner "Orders", tags and a link, and check that its SLA target reads "< 120 ms" with no measured value. With nothing selected, they rename the deck, describe it and tag it.

**Why this priority**: K-1 covers flows and steps too; 006 gave them only text fields, and this story completes them with the same field set as components.

**Independent Test**: With one flow recorded (006), edit every flow, step and deck field; check the step list, the flow list and the JSON panel; undo.

**Acceptance Scenarios**:

1. **Given** a selected flow, **When** the inspector shows, **Then** it has TITLE, DESCRIPTION (Write / Preview), OWNER, FEATURE, TAGS, LINKS and a summary ("8 steps · 2 branches · 6 components", plus "1 broken step" when any); each edit shows in the flow list and the JSON panel and is undoable.
2. **Given** a selected step, **When** the inspector shows, **Then** the header keeps 006's "Step n · <from> → <to>" with "<flow> · step n" beneath, and it has TITLE, DESCRIPTION (Write / Preview), OWNER, EDGE ("<label> · <protocol>"), TAGS, LINKS, CONDITION, SLA TARGET and ATTACHED RULES.
3. **Given** a step, **When** the user looks at SLA TARGET, **Then** only the target text is shown; there is no meter and no measured value.
4. **Given** a broken step (its connection was deleted, 006), **When** it is selected, **Then** EDGE shows "Connection deleted" with an icon and every other field stays editable.
5. **Given** nothing selected, **When** the inspector shows, **Then** it has NAME, DESCRIPTION (Write / Preview), TAGS, stats (Components, Connections, Flows, Rules with counts) and the STORAGE section of 005; renaming the deck updates the top bar and the library entry; an empty name is refused and the old name kept.
6. **Given** any inspector, **When** the user uses only the keyboard, **Then** every field, Write / Preview switch, tag, link and list row is reachable with Tab and operable with Enter, Space or Backspace, with a visible focus indicator.

---

### User Story 3 - Edit several components at once (Priority: P2)

The architect shift-clicks Pricing, Payment and Dispatch services. The inspector reads "3 components selected". Owner shows "Mixed" because they differ; tag "critical" shows dashed with "2/3". They set owner "Dispatch", which applies to all three in one undo step, and remove "critical" from all.

**Why this priority**: C-6 bulk edit is P0 but only useful once single-object fields exist (story 1).

**Independent Test**: Select three components with differing owners and partially shared tags; check Mixed and partial display; change each bulk field; undo once per change.

**Acceptance Scenarios**:

1. **Given** three selected components with different owners, **When** the bulk inspector shows, **Then** OWNER shows "Mixed" (italic, with accessible text "Mixed values"), and a tag present on two of them shows dashed with "2/3".
2. **Given** that selection, **When** the user sets owner "Dispatch", **Then** all three change, and one ⌘Z restores each component's own previous owner.
3. **Given** a field showing "Mixed", **When** the user focuses it and leaves without typing, **Then** no component changes.
4. **Given** a partial tag "critical 2/3", **When** the user chooses it, **Then** it is added to the remaining component (becoming "3/3", solid); **When** they choose its ×, **Then** it is removed from all selected components; each is one undo step.
5. **Given** a selection, **When** the user sets KIND or GROUP, **Then** every selected component gets that kind or group in one undo step; "Same on all 3" shows under a field whose values match.
6. **Given** a selection of components and connections, **When** the bulk inspector shows, **Then** its header states both counts ("3 components, 2 connections selected"), the bulk fields change components only, and a note says so.
7. **Given** a bulk selection, **When** the user chooses "Delete 3 components", **Then** the existing confirm-delete dialog of 003 opens.

---

### User Story 4 - Author a shared decision table (Priority: P2)

The architect opens Rules and creates "Delivery tier" with the description "Picks vehicle, SLA and surcharge from distance, weight and priority". They add conditions Distance (km), Weight (kg) and Priority, and actions Vehicle, SLA and Surcharge; fill five rows with cells such as `≤ 5`, `> 20`, `Express`, `Any`; reorder two rows; delete one; set the hit policy to First match; then go back to the canvas.

**Why this priority**: K-2 is P0; attaching and testing rules (stories 5–6) need rules to exist.

**Independent Test**: With no rules, create a rule, add and rename columns, fill rows with each cell syntax, reorder and delete rows, change hit policy, reload, and check the deck JSON.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the user opens Rules (from the top bar, from the deck inspector's Rules count, or from a rule row), **Then** the rule editor shows DECISION TABLES with each rule's name and "n rows · used in n steps"; with no rules it shows an empty state with "New rule"; "Back to canvas" returns to the editor with the previous selection.
2. **Given** the rule editor, **When** the user chooses New, **Then** a rule "Untitled rule" is created with hit policy First match, no columns and no rows, and its name field has focus; an empty name is refused and the old name kept.
3. **Given** a rule with rows, **When** the user adds a condition column, **Then** every existing row gets "Any" in it; **When** they add an action column, **Then** every existing row gets an empty cell.
4. **Given** a column, **When** the user renames it inline, **Then** the header updates everywhere the rule is shown; an empty label is refused.
5. **Given** a condition column used by steps' sample inputs, **When** the user removes it, **Then** it is removed at once without a dialog, its cells and the sample input values for it on every step go with it, an Undo toast shows, and one ⌘Z restores both.
6. **Given** cells, **When** the user types `≤ 5`, `<= 5`, `> 20`, `Express`, `Bike, Van`, `Any` or leaves a condition cell empty, **Then** each is accepted; an invalid condition such as `> abc` or `≤` alone shows an inline error (icon + text "Not a valid condition") and never matches.
7. **Given** rows, **When** the user chooses Add row, **Then** a row with "Any" conditions and empty actions is appended; **When** they press ⌥↑ / ⌥↓ on a focused row or drag its grip, **Then** it moves; **When** they choose the row's delete button or press ⌫ on a focused row, **Then** it is removed at once with an Undo toast, and ⌘Z restores it.
8. **Given** a rule, **When** the user changes Hit policy to Unique or Collect, **Then** the policy is saved and the CHECKS explanation changes accordingly.
9. **Given** a rule edited in one tab, **When** the other tab shows the same deck, **Then** the change appears there too (005), and a reload shows the rule exactly as left.

---

### User Story 5 - Attach rules and see the matched row on a step (Priority: P2)

On step 4 "Quote the delivery" the architect attaches "Delivery tier". The step inspector shows the rule as a compact table and "Evaluated with" sample inputs; they set Distance 5, Weight 10, Priority Express and row 1 is marked as matched with "Bike · 45 min · €4.00". The rule is also attached to step 2 of "Assign driver" and to the Pricing Service component. Later they change a cell in the rule editor and both steps show the new table.

**Why this priority**: The "rule lives on the exact step it governs" promise; depends on stories 2 and 4.

**Independent Test**: With a rule and two flows, attach the rule to two steps and a component, set sample inputs, check the matched row, edit the rule, check both steps, detach, undo.

**Acceptance Scenarios**:

1. **Given** a selected step, **When** the user chooses Attach in ATTACHED RULES, **Then** a list of the deck's rules (filterable by name, with those already attached marked) and "New rule" opens; choosing a rule attaches it; choosing "New rule" creates one, attaches it and opens it in the rule editor.
2. **Given** rule "Delivery tier" attached to two steps, **When** a cell is edited in the rule editor, **Then** both steps show the updated table (single shared rule).
3. **Given** a step with an attached rule, **When** the inspector shows, **Then** the rule card shows its name, a compact table (conditions and actions, rows numbered), the step's sample inputs as "Evaluated with Distance 5 · Weight 10 · Priority Express", and the matched row marked by a check icon, bold row number and the text "Row 1 matches → Bike · 45 min · €4.00"; with no match it shows "No row matches these inputs" with an error icon.
4. **Given** a step with an attached rule, **When** the user edits its sample inputs (one field per condition), **Then** the values are saved with the step and the matched row updates as they type.
5. **Given** a step with no rules, **When** the inspector shows, **Then** ATTACHED RULES reads "No decision table on this step." with Attach.
6. **Given** an attached rule, **When** the user chooses Detach, **Then** it is removed from that step only (its sample inputs for that rule go too) without a dialog, with an Undo toast; ⌘Z restores both.
7. **Given** a component, **When** the user attaches or detaches rules in its RULES section, **Then** they behave as on steps (without sample inputs); a rule row opens the rule in the rule editor.
8. **Given** an attached rule card, **When** the user chooses "Edit rule", **Then** the rule editor opens on that rule with TEST INPUT pre-filled with the step's sample inputs.
9. **Given** the rule editor opened from step 4 via "Edit rule", **When** the user changes TEST INPUT and chooses "Save as step inputs", **Then** step 4's sample inputs become those values and its matched row updates; **When** the user changes TEST INPUT and goes back without saving, **Then** step 4 is unchanged.

---

### User Story 6 - Test a rule and see where it is used (Priority: P3)

In the rule editor, the architect types Distance 5, Weight 10 and Priority Express in TEST INPUT: row 1 is highlighted and "Matched Row 1" lists Vehicle Bike, SLA 45 min, Surcharge €4.00. Clearing Weight shows "No row matches these inputs". CHECKS warns "No catch-all row — some inputs match nothing". USED IN lists "Place order · Step 4" and "Assign driver · Step 2"; choosing one goes to that step. They delete an old rule after a dialog tells them it is used by one step.

**Why this priority**: Founder decision §g-6 includes it; it builds on stories 4–5 and makes rules trustworthy.

**Independent Test**: With a five-row rule, try inputs for each hit policy, clear an input, add and remove a catch-all row, follow a USED IN entry, delete a used rule, undo.

**Acceptance Scenarios**:

1. **Given** test inputs Distance 5, Weight 10, Priority Express, **When** evaluated with First match, **Then** row 1 is highlighted and its actions listed under "Matched Row 1"; with Weight empty, **Then** "No row matches these inputs" shows with an error icon.
2. **Given** Collect and inputs matching rows 1 and 3, **When** evaluated, **Then** both rows are highlighted and the result lists each row's actions in row order.
3. **Given** Unique and inputs matching rows 1 and 3, **When** evaluated, **Then** no single winner is shown and a warning reads "2 rows match; Unique expects one" naming both rows; with exactly one match it behaves like First match.
4. **Given** a rule with no row whose conditions are all "Any", **When** CHECKS shows, **Then** it warns "No catch-all row — some inputs match nothing" with a warning icon; adding such a row replaces the warning with a check and "Has a catch-all row".
5. **Given** CHECKS, **When** the hit policy is First match / Unique / Collect, **Then** a line explains it ("Row order decides the winner" / "Only one row may match" / "Every matching row applies").
6. **Given** a rule used by steps and a component, **When** USED IN shows, **Then** it lists each step as "<flow> · Step n · <from> → <to>" and each component by title; **When** the user chooses a step entry, **Then** the editor opens with that flow shown and that step selected; a component entry selects the component.
7. **Given** a rule used by steps, **When** the user deletes it, **Then** a confirmation dialog names the rule and states the usage count ("Used in 2 steps and 1 component"); **When** confirmed, **Then** the rule is removed, detached everywhere with its sample inputs, an Undo toast shows for 6 s, and ⌘Z restores the rule and every attachment.
8. **Given** TEST INPUT values, **When** the user leaves and reopens the rule editor, **Then** the test values are not part of the deck (they never appear in the JSON or the export).

---

### Edge Cases

- **Rule with no columns or no rows**: the table shows an empty state with "+ Condition", "+ Action" and "Add row"; evaluation reports "No row matches these inputs"; CHECKS warns that there is no catch-all row.
- **Rule with no condition columns but rows**: every row matches every input (all conditions are effectively Any); First match picks row 1.
- **Numeric comparison on non-numeric input** (Distance "far" against `≤ 5`): the cell does not match; no error on the input.
- **Numeric formats**: `5`, `5.0`, `-3`, `0.5` compare as numbers; a value like `1,000` is a list of "1" and "000", as the syntax hint says.
- **Exact value matching** ignores case and surrounding spaces (`express` matches `Express`); list cells match when the input equals any item.
- **Empty input against a non-Any cell**: does not match; against `Any` or an empty condition cell: matches.
- **Sample inputs for a rule later detached, deleted or with a column removed**: removed with it by the model (002 FR-013, FR-018); undo brings them back.
- **Attached rule missing from the deck** (imported file referencing a rule that does not exist): the step or component shows "Missing rule <id>" with an icon and a Detach action; it is not silently dropped (015 will list it deck-wide).
- **Same rule attached twice to one step**: refused; the Attach list marks it as already attached.
- **Rule used on a broken step**: the step stays in USED IN with "Connection deleted" instead of from → to.
- **Duplicate rule names**: allowed; ids keep them distinct; USED IN and Attach show names with row counts to tell them apart.
- **Long values** (titles, cells, tags, owners): truncated with an ellipsis and shown in full on hover and to assistive technology; cells wrap in the full table.
- **Links**: relative paths are allowed and kept as typed; only `http`, `https` and relative links open; `javascript:`, `data:` and other schemes are refused at input.
- **Two tabs editing the same field**: both edits merge through the model (005); the field shows the merged value; undo is per tab.
- **Selection removed in another tab** (component, connection, flow, step or rule): the inspector falls back to the deck inspector (or the rule list) without an error.
- **Bulk selection of one component**: shows the single-component inspector, not the bulk one.
- **Markdown preview of very long text**: scrolls inside the inspector; the Write / Preview choice is kept per field while the selection stays the same.
- **Rule editor opened with a deck that has no flows**: USED IN reads "Not used yet"; attaching is still possible on components.
- **Undo while in the rule editor**: ⌘Z / ⇧⌘Z undo and redo rule edits in the same history as the rest of the deck.

## Requirements _(mandatory)_

### Functional Requirements

**Shared inspector fields**

- **FR-001**: The inspector MUST show the matching variant for the current selection: component, connection, flow, step (from 006's step list), several components (bulk), or the deck when nothing is selected.
- **FR-002**: Every text field MUST save as the user types, through the deck model, and a burst of typing in one field MUST be one undo step (003's undo unit); one ⌘Z MUST undo the last field edit.
- **FR-003**: Descriptions of components, connections, flows, steps, the deck and rules MUST offer Write and Preview; Preview MUST render paragraphs, bullet lists and inline code only, MUST show any HTML or script as plain text, and MUST show "Nothing to preview." for an empty description.
- **FR-004**: The owner field MUST accept any text and suggest, as the user types (ignoring case), owners already used on components, connections, features, flows and steps in the deck; it MUST look like the design's select (§g-26).
- **FR-005**: The tag input MUST add a tag on Enter (trimmed, lower-cased, no duplicates on the same object), remove a tag with its × or with Backspace in the empty input, and suggest tags already used in the deck.
- **FR-006**: Link rows MUST be added by typing or pasting a URL and pressing Enter, labelled with the domain by default (editable), removable, and opened in a new browser tab when activated; only `http`, `https` and relative links MUST be accepted, other schemes MUST be refused with an inline error.
- **FR-007**: Deleting the selected object from the inspector MUST use the existing confirmation dialog and Undo toast (003, §g-11, §g-19).

**Per type**

- **FR-008**: The component inspector MUST show a header (kind tile, title, "Kind · Group · id", delete) and TITLE, KIND (all component kinds), GROUP (existing groups or "No group"), DESCRIPTION, OWNER, TECH, HOST, TAGS, LINKS, RULES and CONNECTIONS · n (each row selects that connection).
- **FR-009**: The connection inspector MUST show TITLE (the label), FROM and TO (choosing another component reattaches the connection with the same id, refusing self-connections and duplicates with 003's message), PROTOCOL as a segmented control with the same choices as the connection popover, DESCRIPTION, OWNER, DIRECTION, TAGS, LINKS and USED IN FLOWS ("<flow> · Step n", each opening that flow with that step selected; "Not used in any flow" when empty). The connection popover (003) and the inspector MUST always show the same values.
- **FR-010**: The flow inspector MUST add TAGS, LINKS, Write / Preview for the description and a summary (step count, branch count, number of distinct components touched, broken step count when non-zero) to 006's flow fields.
- **FR-011**: The step inspector MUST add OWNER, EDGE ("<label> · <protocol>", or "Connection deleted" with an icon when broken), TAGS, LINKS, Write / Preview for the description, and ATTACHED RULES to 006's step fields. SLA TARGET MUST show the target only, with no meter or measured value.
- **FR-012**: The deck inspector MUST show NAME (non-empty), DESCRIPTION (Write / Preview), TAGS, stats (Components, Connections, Flows, Rules), and 005's STORAGE section; the Rules stat MUST open the rule editor.

**Bulk edit**

- **FR-013**: With two or more components selected, the inspector MUST show "<n> components selected" with KIND, OWNER, TECH, GROUP and TAGS, and a "Delete <n> components" action using 003's confirmation.
- **FR-014**: A field whose values differ MUST show "Mixed" (with a non-color cue and accessible text); a field whose values match MUST show the value and "Same on all <n>"; leaving a Mixed field without typing MUST change nothing.
- **FR-015**: Setting a bulk field MUST apply the value to every selected component as one undo step.
- **FR-016**: Tags on only some selected components MUST show dashed with "<k>/<n>"; choosing a partial tag MUST add it to all; × MUST remove it from all; each as one undo step.
- **FR-017**: When connections are also selected, the header MUST state both counts and the bulk fields MUST change components only.

**Rule editor**

- **FR-018**: The rule editor MUST be a separate screen of the deck, reachable from the top bar, the deck inspector's Rules stat, any rule row, "Edit rule" on a step, and Attach → New rule; it MUST have its own address so a reload returns to the same rule; "Back to canvas" MUST return to the editor.
- **FR-019**: The DECISION TABLES list MUST show every rule with name and "<rows> rows · used in <n> steps", a New action, and an empty state with "New rule" when the deck has none.
- **FR-020**: Users MUST be able to edit a rule's name (non-empty) and description (Write / Preview), and choose its hit policy: First match, Unique or Collect.
- **FR-021**: Users MUST be able to add condition and action columns (existing rows get "Any" for a condition, empty for an action), rename columns inline (non-empty) and remove columns without a dialog, with a 6 s Undo toast; removing a condition column MUST also remove the matching sample inputs on steps, and one ⌘Z MUST restore both.
- **FR-022**: Users MUST be able to edit any cell inline, add a row (Any conditions, empty actions, appended), reorder rows by grip drag and ⌥↑ / ⌥↓, and delete a row by its delete button or ⌫ on a focused row without a dialog, with an Undo toast.
- **FR-023**: A condition cell MUST accept: `Any` or empty (matches everything); a comparison `<`, `≤`/`<=`, `>`, `≥`/`>=` followed by a number; a comma-separated list of values (matches any item); or a single exact value. Exact and list matching MUST ignore case and surrounding spaces; comparisons MUST match only numeric inputs. An invalid condition MUST show an inline error (icon + "Not a valid condition") and MUST never match. A hint below the table MUST describe the syntax.
- **FR-024**: Deleting a rule MUST ask for confirmation naming the rule and its usage count; after confirming it MUST be detached from every step and component (sample inputs included), show a 6 s Undo toast, and one ⌘Z MUST restore the rule and every attachment.

**Evaluation, test panel and checks**

- **FR-025**: Rule evaluation MUST be one shared behavior used by the test panel and the step's compact table: a row matches when every condition cell matches its input; First match returns the first matching row in order; Unique returns the only matching row, or, when several match, no winner and a warning naming every matching row ("<n> rows match; Unique expects one") — on the step's card as well as in the test panel; Collect returns every matching row in order; no match returns "No row matches these inputs".
- **FR-026**: TEST INPUT MUST show one field per condition column; the result MUST update as the user types, highlight the matched row(s) with a non-color cue (check icon and bold row number), and list the actions by column label. Test values MUST be UI-only (not in the deck). When the editor is opened from a step, they MUST start from that step's sample inputs, and a "Save as step inputs" action (labelled with the flow and step number) MUST write the current values to that step as one undo step; without that action the step is never changed.
- **FR-027**: CHECKS MUST warn "No catch-all row — some inputs match nothing" when no row has every condition Any (or the rule has no rows), show "Has a catch-all row" otherwise, and explain the current hit policy in one line.
- **FR-028**: USED IN MUST list every step using the rule as "<flow> · Step n · <from> → <to>" (or "Connection deleted" for a broken step) and every component by title; choosing an entry MUST open the editor with that flow shown and step selected, or that component selected. "Not used yet" MUST show when empty.

**Attaching rules**

- **FR-029**: Steps and components MUST offer Attach, listing the deck's rules (filterable by name, already-attached ones marked and not selectable) and "New rule"; attaching MUST add the rule id to the object's rules in order; the same rule MUST NOT be attached twice to one object.
- **FR-030**: Detach MUST remove the rule from that object only (and, on a step, its sample inputs for that rule), without a dialog, with an Undo toast.
- **FR-031**: The step's attached rule card MUST show the rule name, a compact table, the step's sample inputs ("Evaluated with …", editable, one field per condition, saved with the step) and the evaluation result per FR-025 ("Row n matches → <actions>" or "No row matches these inputs"); a step with no rule MUST show "No decision table on this step.".
- **FR-032**: A reference to a rule that does not exist MUST show as "Missing rule <id>" with an icon and a Detach action, never be dropped silently.
- **FR-033**: A rule is shared: editing it MUST update every step and component that shows it, in this tab and in other tabs (005).

**Data, access, design and privacy**

- **FR-034**: Every edit in this feature MUST go through the deck model so it is autosaved, synced between tabs, undoable, visible in the JSON panel (Selection and Deck tabs, 004) and preserved by export → import.
- **FR-035**: No file format change is expected: every field edited here already exists in the version 1 format. Match results, usage lists, counts, "Mixed" states and checks MUST be derived for display and never stored.
- **FR-036**: Every action MUST be keyboard operable with a visible focus indicator; tables MUST be navigable cell by cell with arrow keys and Enter to edit; the match result and validation errors MUST be announced politely; no state (matched row, Mixed, partial tag, invalid cell, warning) MUST rely on color alone.
- **FR-037**: The screens MUST match design frames 02, 04, 10, 18, 23, 28, 29, 49, 50, 51 and 58 (light and dark), except where DESIGN.md or founder decisions differ: SLA target only (§g-24), owner combobox (§g-26), DESIGN.md success green for matches and clay for no-match and errors (§g-20), confirmation before deleting a rule (§g-11), lucide icons, and flow-mode parts owned by 007.
- **FR-038**: No deck content (descriptions, rules, test inputs, links) MUST leave the device; opening a link is the only navigation and happens only when the user activates it.

### Key Entities

- **Component, Connection, Flow, Step, Deck**: existing objects (002, 006); this feature edits their knowledge fields (description, owner, tags, links) and type-specific fields (component technology, host, kind, group; connection label, from, to, protocol, direction; step condition, SLA target, rules, sample inputs).
- **Rule (decision table)**: stable id, name, markdown description, hit policy (First match, Unique, Collect), ordered condition columns and action columns (each with a stable id and label), and ordered rows (stable id, one cell per column). Shared by reference from steps and components.
- **Sample inputs**: per step and per attached rule, a value per condition column; stored with the step; used to show the step's matched row.
- **Evaluation result** (derived): matched row(s), actions, or no match; plus a warning for Unique with several matches.
- **Rule usage** (derived): the steps and components that reference a rule.
- **Test input** (UI-only, per tab): values typed in the rule editor's TEST INPUT; remembers the step it was opened from, if any, for "Save as step inputs".
- **Bulk selection view** (derived): per field, one shared value or Mixed; per tag, how many selected components have it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can fully document a component (description, owner, technology, two tags, one link) in under 60 seconds, and every field edit is visible on the canvas, outline and JSON panel in under 100 ms on the benchmark deck (500 components / 1,000 connections).
- **SC-002**: A user can create a decision table with 3 conditions, 3 actions and 5 rows in under 3 minutes.
- **SC-003**: Evaluation gives the expected row for 100% of cases in a test table covering every cell syntax and every hit policy; the result updates within 100 ms of typing for a rule with 50 rows.
- **SC-004**: Editing a rule updates every step that uses it, in the same tab and in a second tab, in 100% of checks.
- **SC-005**: Setting a bulk field on 20 selected components takes one action and one ⌘Z fully restores each component's previous value.
- **SC-006**: Deleting a rule used by steps loses nothing after one undo: 100% of attachments and sample inputs return.
- **SC-007**: Export → import of decks with rules, attachments, sample inputs, tags and links gives an identical deck in 100% of round-trip tests.
- **SC-008**: 0 scripts or HTML elements from user text are rendered in markdown preview, and 0 network requests carry deck content (existing no-third-party-requests check stays green).
- **SC-009**: Every action in this feature can be completed with the keyboard alone, and every state is identifiable in a grayscale screenshot.

## Assumptions

- 006 is merged before 008's implementation starts; 008 uses 006's selection of a flow and a step, its derived step numbers, and its "show flow at step" behavior. 007 is not required; when it lands, its step inspector reuses the ATTACHED RULES card built here.
- 008 is one feature delivered in one PR (clarification 2026-09-27); the backlog's optional 008a / 008b split is not used, even if the work exceeds the 5-day estimate. Stories stay prioritized so tasks can be ordered P1 → P3.
- Row and column removal inside a rule and detaching a rule happen without a dialog, with an Undo toast (clarification 2026-09-27, exception to §g-11 like removing a step in 006); deleting a whole rule asks for confirmation.
- A catch-all row is a row whose condition cells are all Any (or empty).
- Rule editor test inputs are not saved unless the user chooses "Save as step inputs" (only offered when opened from a step); step sample inputs are saved with the step (existing format field).
- 003 has no way to change one component's kind or group, so the single-component inspector adds KIND and GROUP fields (same choices as the bulk inspector, design 58); group creation and editing stay in 010.
- Markdown needs only paragraphs, bullets and inline code (design 18); any richer syntax shows as plain text. Whether this needs a new dependency is decided in `plan.md` with founder approval (constitution VIII).
- Owner and tag suggestions come only from the current deck (§g-10); there is no team or tag registry.
