# Tasks: Inspectors and Rules

**Input**: design documents in `specs/008-inspector-rules/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27 (four answers).
- [research.md](research.md) (R1–R12) and [data-model.md](data-model.md).
- [contracts/model-additions.md](contracts/model-additions.md) and [contracts/inspector-rules-ui.md](contracts/inspector-rules-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI requires:

- unit tests (Vitest) for every pure module and store
- component tests (Testing Library, by role and label, following the UI contract) for user-visible behavior
- a round-trip case for every model change

Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay green unchanged.

**006**: merged on `main` (`96bd929`). The 006 names used below were re-checked after the merge (research header).

**Approvals**: no new runtime dependency and no Complexity Tracking exception. The live-field behavior change (plan, Complexity Tracking note) should be mentioned to the founder in the PR.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Model**: source in `packages/model/src/…`, tests in `packages/model/test/`.
- **UI package**: source in `packages/ui/src/…`, tests in `packages/ui/test/`.
- **App**: source in `apps/app/src/…`, with tests next to the code (`*.test.ts(x)`).
- **Commits**: after each task or logical group, using Conventional Commits (`feat(model): …`, `feat(ui): …`, `feat(app): …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `008-inspector-rules` from the latest `main` (with 006 merged). Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 [P] Record the baseline with `pnpm bench` on `main` and save the numbers (pan, zoom and drag at 500 nodes / 1,000 edges) in `specs/008-inspector-rules/bench-before.md`.
- [x] T003 [P] Write the ADR `docs/decisions/0009-decision-table-evaluation.md` in the 0006 header format. It covers:
  - the cell grammar (Any/empty, comparisons with `<` `<=` `≤` `>` `>=` `≥` and a number, comma lists, exact values, invalid cells)
  - matching (numeric vs case-folded text, empty input)
  - hit policies, where Unique with several matches is ambiguous and has no winner (spec clarification)
  - the catch-all definition
  - alternatives considered: a FEEL/DMN library, ranges, Unique as first match (research R2)

---

## Phase 2: Foundational (blocks every user story)

### Model (`packages/model`)

- [x] T004 [P] Write `packages/model/test/rules-evaluate.test.ts`. It must fail at first, and it covers:
  - every grammar row in research R2: `''`, `Any`, `any`, `≤ 5`, `<=5`, `> 20`, `>= -3.5`, `≤` alone, `> abc`, `Bike, Van`, `a,,b`, `Express`
  - `5` equals `5.0`, and `express` equals `Express`
  - empty input, and non-numeric input against a comparison
  - the spec's Delivery tier table under First match, Unique (including ambiguous rows 1 and 3) and Collect
  - a generated 50-row, 5-condition rule evaluates in under 100 ms (SC-003)
  - rules with no columns or no rows
  - `ruleChecks`: catch-all detection and `invalidCells`
- [x] T005 [P] Implement `parseCell` and `matchCell` in `packages/model/src/rules/cells.ts`, and `evaluateRule` and `ruleChecks` in `packages/model/src/rules/evaluate.ts`, following contracts/model-additions.md. Make T004 pass.
- [x] T006 [P] Write `packages/model/test/rule-links.test.ts`. It must fail at first, and it covers:
  - `attachRule` / `detachRule` on a node and on a step
  - a double attach throws `invalid`, and a missing rule throws `missing-reference`
  - a step detach removes `ruleInputs[ruleId]` in the same transaction
  - `setRuleInputs` drops empty values and removes the key when nothing is left
  - keyed typing merges into one undo step
  - each op is one undo step
  - `observeDeck` reports the changes with origin `local`
- [x] T007 Implement `attachRule`, `detachRule` and `setRuleInputs` with `RuleHost` in `packages/model/src/ops/rule-links.ts`, and wire them into `DeckEditor` in `packages/model/src/editor.ts`. Make T006 pass.
- [x] T008 Write `packages/model/test/rule-usage.test.ts` (it must fail at first), then implement `ruleUsage(file, ruleId)` in `packages/model/src/rules/usage.ts` using `analyzeFlow`. Cover:
  - main-path and branch step numbers (`4a`)
  - broken steps (`from`/`to` null, `broken: true`)
  - nodes that use the rule
  - renaming the rule or a column leaves the usage unchanged
- [x] T009 Add `{ scope: 'rules'; id }` to `RemovalTarget`, with support in `previewRemoval` and `removeTarget` in `packages/model/src/preview.ts`. Add cases to `packages/model/test/preview.test.ts`: the removed rule, and the updated nodes and steps.
- [x] T010 [P] Add a case to `packages/model/test/round-trip.test.ts`: a deck with rules attached to nodes and steps, `ruleInputs`, and tags and links on the deck, nodes, edges, flows and steps. Add a case to `packages/model/test/undo.test.ts`: `removeRule` then one undo restores every attachment and every sample input.
- [x] T011 Export the new functions and types (`parseCell`, `matchCell`, `evaluateRule`, `ruleChecks`, `ruleUsage`, `Cell`, `Evaluation`, `RuleChecks`, `RuleUsage`, `RuleHost`) from `packages/model/src/index.ts`, and update `packages/model/CLAUDE.md` with the rules module and the rule-links invariant.

### UI kit (`packages/ui`)

- [x] T012 [P] Write the test `packages/ui/test/markdown.test.ts`, then implement `parseMarkdown(text): Block[]` in `packages/ui/src/lib/markdown.ts`. It handles:
  - blank-line paragraphs
  - `-` / `*` / `+` bullets at one level
  - `` `code` ``
  - everything else as literal text
- [x] T013 [P] Write the test `packages/ui/test/markdown-view.test.tsx`, then implement `MarkdownView` in `packages/ui/src/components/markdown-view.tsx`. The test asserts:
  - bullets render as `list`/`listitem`
  - inline `code` renders as code
  - `<b>x</b>` and `<script>` render as literal text, with no element created
  - empty text renders "Nothing to preview."
- [x] T014 [P] Write the test `packages/ui/test/combobox.test.tsx`, then implement `Combobox` (`mode: 'free' | 'pick'`) in `packages/ui/src/components/combobox.tsx` on Radix Popover. It follows the WAI-ARIA combobox and listbox pattern:
  - contains-match filtering, ignoring case, showing at most 8 options
  - ↑/↓ move, Enter chooses, Esc closes
  - pick mode rejects free text
  - `focusRing` and tokens only
  - `placeholder` and `aria-describedby` pass through (used for "Mixed")
- [x] T015 [P] Add a `suggestions` prop to `TagInput` in `packages/ui/src/components/tag-input.tsx`, reusing the Combobox listbox. Make Backspace in the empty add field remove the last tag (FR-005; not supported today). Add a `partial` variant to `TagChip` in `packages/ui/src/components/tag-chip.tsx`: a dashed border, a "k/n" count, and the actions "Add <tag> to all" and "Remove <tag> from all". Extend the existing tests in `packages/ui/test/`.
- [x] T016 Add the new components to the contrast and keyboard a11y suites in `packages/ui/test/`, and to the `/design` gallery (`apps/app/src/design-gallery/`). Update `packages/ui/CLAUDE.md`.

### App foundation (`apps/app`)

- [x] T017 [P] Write the test `apps/app/src/editor/fields/use-live-field.test.tsx` (it must fail at first), then implement `useLiveField` in `apps/app/src/editor/fields/use-live-field.ts` (research R4). It must:
  - call `beginGesture` on the first change after focus
  - write at most once per animation frame
  - call `endGesture` on blur, Enter or unmount
  - on Esc, write the value from before focus and end the gesture
  - never write an empty required value, and revert it on blur with an error
    The test asserts that one ⌘Z after blur restores the value from before focus, and that the gesture ends when the selection changes mid-typing.
- [x] T018 Switch `FieldEdit` in `apps/app/src/editor/field-edit.tsx` to `useLiveField`, keeping its props (`error`, `mono`, `id`; `list` stays until T031 removes its last use) and its "<Label> can’t be empty." error. Move 006's `TextareaEdit` from `editor/flows/textarea-edit.tsx` to `apps/app/src/editor/fields/textarea-edit.tsx`, switch it to `useLiveField` too, and update its imports. Run the existing inspector, top-bar and flow tests and fix any regressions without changing their assertions.
- [x] T019 [P] Write the test `apps/app/src/lib/links.test.ts`, then implement `parseLinkInput` in `apps/app/src/lib/links.ts` (research R6). It covers:
  - http and https URLs, labelled with the host minus `www.`
  - relative paths, labelled with their last segment
  - refusal of `javascript:`, `data:`, `file:` and `//host`, with the message "Only http, https or relative links"
  - trimming
- [x] T020 [P] Write the test `apps/app/src/editor/inspector/derive.test.ts`, then implement `ownerSuggestions`, `tagSuggestions`, `nodeConnections`, `edgeUsage`, `flowSummary`, `deckStats` and `bulkView` in `apps/app/src/editor/inspector/derive.ts` (data-model §2). `ownerSuggestions` replaces 006's private `owners(deck)` in `editor/flows/inspector-flow.tsx` and adds edge and step owners. `edgeUsage` and `flowSummary` use `analyzeFlow`.
- [x] T021 [P] Extract `showUndoToast(message)` from `apps/app/src/editor/confirm-delete-dialog.tsx` into `apps/app/src/editor/undo-toast.ts`, keeping the single-toast rule, `MOTION.toastUndoMs`, the Undo button that calls `editor.undo()`, and the "Undone" announcement. Add a test in `undo-toast.test.tsx`. Keep the existing dialog tests green.
- [x] T022 [P] Move `PROTOCOLS` and `DIRECTIONS` from `apps/app/src/editor/edge-popover.tsx` into `apps/app/src/editor/fields/edge-choices.ts`, and import them back into the popover.
- [x] T023 Build the shared fields in `apps/app/src/editor/fields/`, each with a component test by role and label from the UI contract:
  - `markdown-field.tsx`: `TextareaEdit` (T018) plus a Write/Preview `radiogroup` and `MarkdownView`, with the mode kept in `descriptionMode` in the UI store
  - `owner-field.tsx`: a free Combobox fed by `ownerSuggestions`
  - `tags-field.tsx`: `TagInput` with `tagSuggestions` and the announcement "<tag> added"
  - `links-field.tsx`: link rows, edit label, remove, the add field with the `parseLinkInput` error, and opening with `window.open(…, 'noopener,noreferrer')`
    All of them write through `useEditor()`.
- [x] T024 Add `descriptionMode` to `apps/app/src/state/ui-store.ts` (reset on selection change) and cover it in the store test. Move 006's `InspectorFrame` from `editor/flows/inspector-frame.tsx` to `apps/app/src/editor/inspector/inspector-frame.tsx` and update its imports. In `apps/app/src/editor/inspector.tsx`, keep 006's `FlowInspector` branch and make `CanvasInspector` route to node, edge, bulk (two or more nodes) and deck inspectors. Add a test: when the selected component, connection or flow is removed by a remote-origin change, the inspector falls back to the deck inspector (spec edge case). Keep the existing inspector tests green.

**Checkpoint**: the model rules module, the UI kit pieces and the shared fields are ready, and every package's tests pass.

---

## Phase 3: User Story 1: Document a component or connection (P1) 🎯 MVP

**Goal**: rich component and connection inspectors (FR-001–FR-009).

**Independent test**: on a deck without flows or rules, edit every component and connection field, check the canvas, outline and JSON panel after each edit, and undo the last edit with one ⌘Z (spec story 1).

- [x] T025 [P] [US1] Write `apps/app/src/editor/inspector/node-inspector.test.tsx` (it must fail at first), covering spec story 1 scenarios 1–6 and 10:
  - the header "<Kind> · <Group> · <id>"
  - Kind and Group pick-mode comboboxes ("No group" clears the group), each one ⌘Z
  - Delete opens 003's confirmation dialog (FR-007)
  - Title, Description with a Preview of bullets and code and HTML shown as text, Owner suggestions, Tech, Host, Tags normalization, Links (including the refusal)
  - the Connections · n rows selecting the connection
  - one ⌘Z undoing the last field
- [x] T026 [US1] Implement `apps/app/src/editor/inspector/node-inspector.tsx` in `InspectorFrame`. Show the Rules section as an empty placeholder slot; it is filled in US5. Make T025 pass.
- [x] T027 [P] [US1] Write `apps/app/src/editor/inspector/edge-inspector.test.tsx` (it must fail at first), covering scenarios 7–9:
  - Title (the label), Protocol and Direction match the popover
  - From/To reattach keeps the id, and self or duplicate connections are refused with the `REFUSAL_TEXT` announcement
  - Description, Owner, Tags and Links
  - Delete opens 003's confirmation dialog (FR-007)
  - USED IN FLOWS shows "<flow> · Step n", and choosing it calls `setActiveFlow` then `setActiveStep`; with no uses it shows "Not used in any flow"
- [x] T028 [US1] Implement `apps/app/src/editor/inspector/edge-inspector.tsx`. From/To use a pick-mode Combobox, and the reattach checks `connectionCheck(deck, from, to, edgeId)` before `editor.update('edges', id, { from, to })`. Make T027 pass.
- [x] T029 [US1] Run `pnpm bench`, compare with `bench-before.md`, and record the result in `specs/008-inspector-rules/bench-after.md`. Reattach and field edits must not regress pan, zoom or drag. Also time a component field edit to its canvas update on the bench deck (target < 100 ms, SC-001) and record it.

**Checkpoint**: the component and connection inspectors are complete. This is the MVP.

---

## Phase 4: User Story 2: Document a flow, a step and the deck (P1)

**Goal**: K-1 on flows, steps and the deck (FR-010–FR-012).

**Independent test**: with one recorded flow, edit every flow, step and deck field, then check the step list, the flow list and the JSON panel, and undo (spec story 2).

- [x] T030 [P] [US2] Extend 006's flow inspector tests (`apps/app/src/editor/flows/inspector-flow.test.tsx`) for scenario 1: Description with Write/Preview, the `OwnerField` combobox (replacing 006's `<datalist>` and `owners()` helper), Tags, Links, and the summary line "<n> steps · <b> branches · <c> components", plus " · <k> broken steps" when k > 0.
- [x] T031 [US2] Implement those additions in `apps/app/src/editor/flows/inspector-flow.tsx` using the shared fields and `flowSummary`. Remove `FieldEdit`'s `list` prop if nothing else uses it.
- [x] T032 [P] [US2] Extend 006's step inspector tests (`apps/app/src/editor/flows/inspector-step.test.tsx`) for scenarios 2–4:
  - 006's header "Step n · <from> → <to>" and subtitle are unchanged
  - Owner, Edge "<label> · <protocol>", Tags, Links, Description with Write/Preview
  - SLA target as text only, with no meter
  - a broken step shows "Connection deleted" with an icon, and its other fields stay editable
  - an empty Attached rules slot (filled in US5)
- [x] T033 [US2] Implement those additions in `apps/app/src/editor/flows/inspector-step.tsx`.
- [x] T034 [P] [US2] Write `apps/app/src/editor/inspector/deck-inspector.test.tsx` (it must fail at first), covering scenarios 5–6:
  - Name is required, and renaming it updates the top bar
  - Description and Tags
  - the stats list shows Components, Connections and Flows, plus a `button` "Rules n"
  - 005's Storage section is still there
  - every control is reachable by Tab
- [x] T035 [US2] Implement `apps/app/src/editor/inspector/deck-inspector.tsx`, reusing `DeckInspectorStorage`. The "Rules n" button navigates to `rules` (the route is added in T041; until then it is disabled). Make T034 pass.

**Checkpoint**: K-1 covers every object type.

---

## Phase 5: User Story 3: Edit several components at once (P2)

**Goal**: bulk edit (FR-013–FR-017).

**Independent test**: select three components with different owners and partly shared tags, check the Mixed and partial display, change each bulk field, and undo once per change (spec story 3).

- [x] T036 [P] [US3] Write `apps/app/src/editor/inspector/bulk-inspector.test.tsx` (it must fail at first), covering spec story 3 scenarios 1–7:
  - Mixed shows with the accessible description "Mixed values"
  - "Same on all n"
  - leaving a Mixed field without typing changes nothing
  - setting Owner, Kind or Group is one ⌘Z
  - a partial tag is dashed with "k/n"; "Add to all" and "Remove from all" are each one undo step
  - with connections also selected, the header shows both counts and the note "Changes apply to components only."
  - "Delete n components" opens 003's dialog
- [x] T037 [US3] Implement `apps/app/src/editor/inspector/bulk-inspector.tsx` with `bulkView` and `editor.batch`. Text fields showing Mixed write only after the user types (a gesture wraps each batch). Kind and Group use a pick-mode Combobox (Group includes "No group"). Make T036 pass.

**Checkpoint**: C-6 bulk edit works.

---

## Phase 6: User Story 4: Author a shared decision table (P2)

**Goal**: the rule editor screen (FR-018–FR-024).

**Independent test**: starting with no rules, create a rule, add and rename columns, fill rows using every cell syntax, reorder and delete rows, change the hit policy, reload, and check the deck JSON (spec story 4).

- [x] T038 [US4] Add `canvasViewport` and `ruleTest` to `apps/app/src/state/ui-store.ts` (data-model §3), with store tests. Save and restore the viewport in `apps/app/src/editor/canvas.tsx` on unmount and mount.
- [x] T039 [US4] Refactor the shell in `apps/app/src/routes/editor-page.tsx` (research R8):
  - `EditorShell` keeps the doc, the providers, `ConfirmDeleteDialog`, `Announcer`, `Toaster`, `useEditorShortcuts` and 006's `useFlowSync`, and renders an `<Outlet/>`.
  - The canvas layout becomes the index child and keeps 006's `useFlowShortcuts`.
  - Existing editor tests stay green.
- [x] T040 [US4] Scope the keys in `apps/app/src/editor/use-canvas-shortcuts.ts`: ⌘Z, ⇧⌘Z and ⌘S apply on both screens; Delete, Esc (clear selection) and the canvas keys (and 006's flow keys) apply only on the canvas screen. Add a test that Delete on the rules screen does not open the canvas delete dialog.
- [x] T041 [US4] Add the child route `rules/:ruleId?` under `/deck/:deckId` in `apps/app/src/app/router.tsx`, lazy-loading `editor/rules/rules-page.tsx`. Update the top bar in `apps/app/src/editor/top-bar.tsx`:
  - on the canvas screen, a `link` "Rules" with the count, before the save status
  - on the rules screen, the breadcrumb segment "Rules" and a `link` "Back to canvas" in place of Export
    Add a test that the route and back navigation restore the selection and viewport. Enable the deck inspector's "Rules n" button from T035.
- [x] T042 [P] [US4] Write `apps/app/src/editor/rules/rule-list.test.tsx` and `rule-header.test.tsx` (they must fail at first), covering scenarios 1, 2 and 8:
  - the list shows "<rows> rows · used in <n> steps" with `aria-current`
  - the empty state
  - New creates "Untitled rule" with First match and focuses the name field
  - an empty name is refused
  - the Description has Write/Preview
  - the Hit policy combobox
- [x] T043 [US4] Implement `apps/app/src/editor/rules/rules-page.tsx` (the three-column layout from design 04), `rule-list.tsx` (usage counts from `ruleUsage`) and `rule-header.tsx`. Make T042 pass.
- [x] T044 [P] [US4] Write `apps/app/src/editor/rules/decision-table.test.tsx` (it must fail at first), covering scenarios 3–7:
  - adding a condition gives existing rows "Any"; adding an action gives them empty cells
  - columns rename inline, and an empty label is refused
  - removing a column needs no dialog, shows an Undo toast, and one ⌘Z restores the column and the step sample inputs
  - every cell syntax is accepted, and `> abc` shows "Not a valid condition" with `aria-invalid`
  - Add row appends a row
  - ⌥↑ / ⌥↓ moves a row, ⌫ on a row header deletes it with an Undo toast
  - grid navigation: arrows, Enter/F2, Esc, and typing to start editing
- [x] T045 [US4] Implement `apps/app/src/editor/rules/use-grid-keys.ts`, `cell-editor.tsx` and `column-menu.tsx`.
- [x] T046 [US4] Implement `apps/app/src/editor/rules/decision-table.tsx`:
  - WHEN/THEN column groups and a numbered row header with a grip (006's `use-sortable-list`)
  - the Add row button and the syntax hint
  - invalid cell display from `ruleChecks`
  - `showUndoToast` for row and column removal
    Make T044 pass.
- [x] T047 [US4] Add delete-rule support:
  - "Delete rule…" in the rule header calls `requestRemoval([{ scope: 'rules', id }])`.
  - `apps/app/src/editor/describe-removal.ts` says "Used in n steps and m components. It will be detached from them." (or "It isn't used anywhere.") and uses the toast text "Rule “<title>” deleted · ⌘Z to undo".
  - After deleting, the page falls back to the rule list.
    Extend the dialog tests for spec story 6 scenario 7 (one ⌘Z restores the rule and every attachment).
- [x] T048 [US4] Implement `apps/app/src/editor/rules/use-rule-sync.ts`: when the open rule is removed (from any origin, including another tab), navigate to `rules` and clear `ruleTest`. Add a test with a remote-origin removal.

**Checkpoint**: rules can be authored, reordered, deleted and undone, and they survive a reload and sync between tabs.

---

## Phase 7: User Story 5: Attach rules and see the matched row on a step (P2)

**Goal**: shared rules on steps and components, with the matched row (FR-029–FR-033).

**Independent test**: with a rule and two flows, attach the rule to two steps and one component, set sample inputs, check the matched row, edit the rule, check both steps, then detach and undo (spec story 5).

- [x] T049 [P] [US5] Write `apps/app/src/editor/fields/attach-rule-popover.test.tsx` (it must fail at first), covering scenario 1:
  - the `dialog` "Attach rule" and its filter
  - an already attached rule is `aria-disabled` and marked "Attached"
  - Enter attaches the rule
  - "New rule" creates a rule, attaches it and navigates to it
- [x] T050 [US5] Implement `apps/app/src/editor/fields/attach-rule-popover.tsx` using `editor.attachRule`. Make T049 pass.
- [x] T051 [P] [US5] Write `apps/app/src/editor/fields/rule-card.test.tsx` (it must fail at first), covering scenarios 3–6 and 8:
  - the compact `table`
  - "Evaluated with" inputs per condition, saved through `setRuleInputs`, with the result updating as the user types
  - "Row 1 matches → Bike · 45 min · €4.00" with a check icon and `aria-selected`
  - "No row matches these inputs", and the Unique ambiguous text
  - Detach needs no dialog, shows an Undo toast, and ⌘Z restores the rule and its inputs
  - "Edit rule" sets `ruleTest` with `from` and navigates
- [x] T052 [US5] Implement `apps/app/src/editor/fields/rule-card.tsx` (evaluation memoized per rule object and inputs) and `apps/app/src/editor/fields/attached-rules.tsx`:
  - step variant: rule cards, "No decision table on this step.", Attach
  - node variant: rows that open the editor, Detach, Attach
  - a missing rule shows "Missing rule <id>" with Detach (FR-032)
    Make T051 pass.
- [x] T053 [US5] Fill the Rules slots: in `node-inspector.tsx` (T026) and in 006's `inspector-step.tsx` (T033), render `AttachedRules`. Add a test for scenarios 2 and 7: one rule is shared by two steps, and editing a cell updates both, including when the edit arrives as a remote-origin change (SC-004); attaching and detaching on a component works.

**Checkpoint**: a rule lives on the steps and components it governs.

---

## Phase 8: User Story 6: Test a rule and see where it is used (P3)

**Goal**: the test panel, used-in list and checks (FR-025–FR-028), plus "Save as step inputs" (clarification).

**Independent test**: with a five-row rule, try inputs under each hit policy, clear an input, add and remove a catch-all row, follow a USED IN entry, delete a used rule and undo (spec story 6).

- [x] T054 [P] [US6] Write `apps/app/src/editor/rules/test-panel.test.tsx` (it must fail at first), covering scenarios 1–3 and 8, and story 5 scenario 9:
  - one field per condition
  - "Matched Row 1" with the list of actions
  - Collect shows "Matched 2 rows"
  - Unique shows "2 rows match; Unique expects one"
  - an empty Weight gives "No row matches these inputs"
  - the result is announced in a polite `status`
  - when opened from a step, the fields are pre-filled and "Save as step inputs (<flow> · Step n)" writes one undo step; leaving without saving changes nothing
  - test values never appear in the deck JSON
- [x] T055 [US6] Implement `apps/app/src/editor/rules/test-panel.tsx`, using `ruleTest` from the UI store and `evaluateRule`. Make T054 pass.
- [x] T056 [P] [US6] Write `apps/app/src/editor/rules/used-in.test.tsx` and `rule-checks.test.tsx` (they must fail at first), covering scenarios 4–6:
  - used-in entries read "<flow> · Step n · <from> → <to>", or "Connection deleted"
  - choosing a step entry goes to the canvas with `setActiveFlow` then `setActiveStep`; choosing a component selects it
  - "Not used yet" when empty
  - the catch-all warning and "Has a catch-all row"
  - the one-line explanation for each policy
- [x] T057 [US6] Implement `apps/app/src/editor/rules/used-in.tsx` and `apps/app/src/editor/rules/rule-checks.tsx`. Make T056 pass.

**Checkpoint**: every story in the spec is complete.

---

## Phase 9: Polish and cross-cutting concerns

- [x] T058 [P] Accessibility pass on every new surface: keyboard only (quickstart step 8), visible focus rings, a grayscale check of matched row, no-match, Mixed, partial tags and invalid cells, and every announcement from the UI contract. Fix gaps with tests.
- [x] T059 [P] Update the docs:
  - `apps/app/CLAUDE.md`: the fields, inspector and rules folders, the nested route, and the key scoping
  - `packages/model/CLAUDE.md` and `packages/ui/CLAUDE.md`, if not already done in T011 and T016
  - the root README, only if commands changed
- [x] T060 Run `pnpm bench` again and finalize `specs/008-inspector-rules/bench-after.md`, with the before and after numbers.
- [x] T061 Visual check: take screenshots at 1440×900, light and dark, of frames 02, 18, 23, 49, 50, 51 (no meter), 10, 58, 04, 28 and 29, next to `docs/design/screens/`. List the differences for the PR (allowed: DESIGN.md tokens, lucide icons, SLA target only, owner combobox).
- [x] T062 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Confirm there are no skipped or `.only` tests, and walk through quickstart.md steps 1–9.

---

## Dependencies and execution order

- **T001** starts the branch; 006 is already merged.
- **Phase 2** blocks every story.
  - Model: T004 → T005; T006 → T007; T008; T009; T010; T011 comes last.
  - UI: T012–T015 can run in parallel, then T016.
  - App: T017 → T018; T019–T022 can run in parallel; T023 depends on T014, T015, T017 and T019; T024 depends on T023.
- **Stories**:
  - **US1** (T025–T029) needs only Phase 2.
  - **US2** (T030–T035) needs only Phase 2. T035's Rules button is enabled by T041.
  - **US3** (T036–T037) needs only Phase 2.
  - **US4** (T038–T048) needs Phase 2. T038 → T039 → T040 → T041 run in order; T043 needs T041; T046 needs T045.
  - **US5** (T049–T053) needs US4's route (T041) for "Edit rule" and "New rule". T053 needs T026 and T033.
  - **US6** (T054–T057) needs US4 (the rules page) and US5 (the `ruleTest` prefill from the step card).
- **Polish** (T058–T062) comes after the stories that ship.

```text
T001 → Phase 2 ─┬─ US1 (MVP) ─┐
                ├─ US2 ───────┤
                ├─ US3 ───────┼─ Polish
                └─ US4 → US5 → US6 ┘
```

## Parallel examples

- **Phase 2**: T004, T006, T010, T012, T013, T014, T015, T019, T021 and T022 touch different files, so they can run together. Then T005, T007 and T017 → T018.
- **US1**: T025 and T027 (tests) together, then T026 and T028.
- **US1, US2 and US3** can go to separate agents after Phase 2. They share only `inspector.tsx`, which T024 already turned into a router.
- **US4**: T042 and T044 (tests) together while T038–T041 are being done.
- **US6**: T054 and T056 together.

## Implementation strategy

1. **MVP**: T001–T029, which delivers the component and connection inspectors (US1). Demo it and check against frames 02, 18, 23 and 49.
2. **K-1 complete**: add US2, which covers every object type.
3. **C-6**: add US3 (bulk edit).
4. **K-2**: US4 → US5 → US6 in order. Each phase is shippable in the PR's history, but the feature is delivered in **one PR** (spec clarification).
5. Finish with Polish (T058–T062). The final report lists what changed, what was skipped, what is uncertain, and the bench numbers.
