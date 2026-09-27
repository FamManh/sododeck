# Research: Inspectors and Rules (008)

Decisions for [plan.md](plan.md), resolving the technical unknowns in the spec.

**Names checked on 2026-09-27**:

- On `main` (`713b86b`):
  - Model: `DeckEditor.update/updateMeta/updateStep/batch/beginGesture/endGesture` and the rule ops `addRule`, `updateRule`, `addRuleColumn`, `renameRuleColumn`, `moveRuleColumn`, `removeRuleColumn`, `addRuleRow`, `setRuleCell`, `moveRuleRow`, `removeRuleRow`, `removeRule`. Also `previewRemoval`, `checkIntegrity` (`missing-reference`, `detached-rule-input`), and `observeDeck`.
  - App: `FieldEdit`, `Inspector`, `DeckInspectorStorage`, `useEditor`, `useDeckSnapshot`, `useUiStore` (`Selection { nodes, edges }`), `useEditorShortcuts`, `useCanvasKeyDown`, `isTextTarget`, `Announcer`, `ConfirmDeleteDialog`, `describeRemoval`, `removalToast`, `connectionCheck(deck, from, to, ignoreEdgeId?)`, `REFUSAL_TEXT`, and `PROTOCOLS` / `DIRECTIONS` (file-local in `edge-popover.tsx`).
  - Routing: `app/router.tsx`, with `/deck/:deckId` → `deckLoader` + `EditorPage`.
  - `@sododeck/ui`: `Input`, `Textarea`, `Select`, `SegmentedControl`, `Switch`, `TagChip`, `TagInput`, `lib/tags` (`normalizeTag`, `addTag`, `removeTag`), `Popover`, `Dialog`, `useToast` (with an action), `MOTION.toastUndoMs`, `PanelSection`, `SearchField`, `Tooltip`, `DropdownMenu`.
- From 006, merged on `main` (`96bd929`), re-checked after the merge:
  - Model: `analyzeFlow(flow, edges)` → `FlowAnalysis { main, branches, branchStepId, byStepId, problems, canFinish }`, with `PathStep { step, number, branchId, from, to, broken, chainBreak }`, and `branchLetter`. `RemovalTarget` has a `branches` scope, and `removeTarget(editor, doc, target)` removes one target.
  - UI store: `ActiveFlow { flowId, stepId, branchId }`, `setActiveFlow`, `setActiveStep`, `requestRemoval(targets)`, `flowSession`. The Undo-toast logic still lives inside `confirm-delete-dialog.tsx` (module-level `undoToastId`).
  - Inspectors: `inspector.tsx` returns `FlowInspector` (`editor/flows/flow-inspector.tsx`) when a flow is shown or recorded, else a local `CanvasInspector` (node, edge, several, deck). `FlowInspector` picks `InspectorBranch`, `InspectorStep` or `InspectorFlow`.
  - Shared pieces 006 added: `InspectorFrame` (`editor/flows/inspector-frame.tsx`: icon, heading, subtitle, actions), `TextareaEdit` (`editor/flows/textarea-edit.tsx`: labelled "<Label> · Markdown" textarea, commits on blur or ⌘↵, Esc reverts), and a private `owners(deck)` helper in `inspector-flow.tsx` (nodes, features, flows) feeding a `<datalist>`.
  - `FieldEdit` gained `error`, `list` (datalist id), `mono` and `id` props; it still commits on Enter or blur.
  - The step inspector header is "Step <n> · <from> → <to>", with the subtitle "<flow> · step <n>" (or "branch “<label>”"). 008 keeps it.
  - `useSortableList({ ids, group, onMove, locked })` in `editor/flows/use-sortable-list.ts`; `menu-kit.ts` is in `apps/app/src/lib/`.
  - `EditorLayout` (`routes/editor-page.tsx`) also runs `useFlowShortcuts()` and `useFlowSync()`; the top bar centres `SessionChip`.

## R1. No file-format change

- **Decision**: none. Every field the spec edits already exists in `schema/v1.json`:
  - Node: `description`, `owner`, `tags`, `tech`, `host`, `links`, `rules`.
  - Edge: `label`, `from`, `to`, `protocol`, `direction`, `description`, `owner`, `tags`, `links`.
  - Flow: `description`, `owner`, `tags`, `links`.
  - Step: `owner`, `tags`, `links`, `rules`, `ruleInputs`.
  - Deck: `name`, `description`, `tags`.
  - `Rule`, `RuleColumn`, `RuleRow` and `HitPolicy`.
- **Rationale**: ADR 0004 already settled the structured decision table (design §g-4) and `rules[]` arrays. `ruleInputs` holds the step's sample inputs (rule id → input column id → value).
- **Consequence**: no ADR for the format and no schema regeneration. The model still gets a round-trip case covering rules attached to nodes and steps, `ruleInputs`, tags and links (constitution II, "every model change").

## R2. Cell syntax and rule evaluation

- **Decision**: a pure module in `packages/model/src/rules/` (no UI). It is used by the test panel, the step's compact table and "catch-all" checks. It is recorded in **ADR 0009**.
  - `parseCell(text): Cell` (grammar applied to the trimmed text):
    - `''` or `any` (any case) → `{ kind: 'any' }`.
    - `(<|<=|≤|>|>=|≥) ␣* number` → `{ kind: 'compare', op, value }`, where `number` is `-?\d+(\.\d+)?`.
    - A comparison operator followed by anything else, or alone → `{ kind: 'invalid' }`.
    - Text containing `,` → `{ kind: 'list', values }`. Items are trimmed. An empty item, or an item that starts with a comparison operator, is `invalid`.
    - Any other text → `{ kind: 'exact', value }`.
  - `matchCell(cell, input)`:
    - `any` always matches.
    - `compare` matches only when the trimmed input is a number in the same grammar.
    - `exact` matches when both sides are numbers and are numerically equal, or when the case-folded, trimmed strings are equal.
    - `list` matches when any item matches as `exact`.
    - `invalid` never matches.
    - An empty input matches only `any`.
  - `evaluateRule(rule, inputs: Record<ColumnId, string>): Evaluation`:
    - A row matches when every input cell matches (with no input columns, every row matches).
    - `first` → `{ status: 'match', rows: [first] }` or `{ status: 'none' }`.
    - `unique` → one match gives `match`; several give `{ status: 'ambiguous', rows }` (spec clarification: no winner).
    - `collect` → `match` with every matching row in order.
  - `ruleChecks(rule)` → `{ catchAll: boolean, invalidCells: {rowId, columnId}[] }`. `catchAll` is true when some row has every input cell `any`.
- **Rationale**:
  - Keeping this in the model makes it usable by 015 (catch-all checks), 007 (the step card in flow mode) and a future CLI/MCP.
  - It has no UI, so it is unit-testable in Node.
  - Parsing is O(cells), and results are memoized per rule object in the app.
- **Alternatives considered**:
  - A FEEL or DMN expression library: a new dependency for a syntax the design limits to comparisons, lists, exact values and Any (constitution VIII).
  - Ranges (`5..10`) or negation: not designed, and out of scope in the spec.
  - Unicode-only operators: users type `<=` on keyboards, so both forms are accepted, and cells keep the user's text as typed.

## R3. Markdown preview

- **Decision**: an in-house renderer in `packages/ui`:
  - `lib/markdown.ts` → `parseMarkdown(text): Block[]`, where a block is a paragraph or a bullet list and inline content is text or code.
  - `components/markdown-view.tsx` renders the blocks as React elements.
  - Supported syntax: blank-line-separated paragraphs, `-` / `*` / `+` bullets (one level), and `` `code` ``. Everything else stays literal text.
  - `dangerouslySetInnerHTML` is never used, so HTML and scripts render as text (FR-003, SC-008).
- **Rationale**:
  - The design (frame 18) needs exactly these three constructs.
  - Emitting React elements makes injection impossible by construction.
  - It is about 80 lines and fully tested.
  - No new runtime dependency is needed (constitution VIII, and the backlog hint says to ask first).
- **Alternatives considered**:
  - `marked` + `dompurify`: both are already in the lockfile, but only as transitive dependencies of Monaco. Using them adds direct dependencies and HTML sanitizing we don't need.
  - `react-markdown`/`micromark`: about 40 kB for syntax we would then have to disable.

## R4. Field editing: save as you type, one undo step per field

- **Decision**: `FieldEdit`, 006's `TextareaEdit` (moved to `editor/fields/`) and the new combobox fields write to the model as the user types and group the whole focus session into one undo step:
  - `beginGesture()` on the first change after focus.
  - Writes are throttled to one per animation frame.
  - `endGesture()` on blur, Enter or unmount.
  - Esc restores the value from before focus: it writes that value, then ends the gesture, so the step becomes a no-op.
  - Empty values for required text are not written while typing. On blur they revert and show the existing inline error.
- **Rationale**:
  - Spec FR-002 (and 006 FR-018a) require saving as the user types, so autosave and the other tab see drafts.
  - Acceptance tests require "one ⌘Z undoes the last field edit".
  - `captureTimeout = Infinity` during a gesture merges the burst into one step, however slowly the user types.
  - While a text field has focus, ⌘Z is left to the browser (`isTextTarget`), so model undo never splits a half-typed value (003 FR text-undo unit).
- **Alternatives considered**:
  - Keep commit-on-blur (today's `FieldEdit`): breaks FR-002 (a reload mid-typing loses the draft, and the other tab sees nothing).
  - Rely on the object-keyed merge with the 500 ms timeout: slow typing splits into several undo steps.
- **Risk**: a gesture left open would swallow later edits. `useLiveField` always ends it in a `finally`, on blur and in the unmount cleanup. A test covers selection change mid-typing.

## R5. Owner combobox, component picker and tag suggestions

- **Decision**: a new `Combobox` in `packages/ui`, built on Radix `Popover` with the WAI-ARIA combobox and listbox pattern (no `cmdk`).
  - It shows free text plus a filtered suggestion list (contains, case-insensitive, up to 8 items) and is styled like the `Select` trigger (§g-26).
  - It takes `mode: 'free' | 'pick'`.
    - `free`: owner fields. Any text is accepted.
    - `pick`: the connection FROM/TO fields and bulk KIND/GROUP. The value must be one of the options.
  - The app supplies the suggestions:
    - `ownerSuggestions(deck)`: distinct owners from nodes, edges, features, flows and steps, sorted by name.
    - `tagSuggestions(deck)`.
  - `TagInput` gains an optional `suggestions` prop that reuses the same listbox.
- **Rationale**:
  - A native `<datalist>` (planned by 006) can't be styled like the design's select, and its matching differs by browser (prefix in Safari, contains in Chrome).
  - The FROM/TO picker has to search up to 500 components.
- **Alternatives considered**: `cmdk` or shadcn Command (a new dependency); `Select` for FROM/TO (unusable at 500 items).
- **006 impact**: 008 replaces 006's owner `<datalist>` with `OwnerField` in `inspector-flow.tsx`, moves its `owners(deck)` helper into `derive.ts` as `ownerSuggestions` (widened to edges and steps), and drops `FieldEdit`'s `list` prop once nothing uses it.

## R6. Links

- **Decision**: a pure `parseLinkInput(text)` in `apps/app/src/lib/links.ts`:
  - It trims the text.
  - It accepts `http:` / `https:` URLs (parsed with `URL`), labelled with the hostname minus `www.`.
  - It accepts relative paths: no scheme and not starting with `//`. The label is the last path segment.
  - It refuses any other scheme (`javascript:`, `data:`, `file:` …) with the message "Only http, https or relative links".
  - Links are opened with `window.open(url, '_blank', 'noopener,noreferrer')`, resolved against the app origin for relative paths, and only when the user activates the link.
  - The `LinkRow` UI shows the label, the URL as secondary text, an edit-label action and a remove action.
- **Rationale**: FR-006 and FR-038. Opening a link is the only navigation. It carries no deck content beyond the URL the user typed.
- **Alternatives considered**: storing links without validation (the schema only requires a non-empty string), which leaves the `javascript:` risk.

## R7. Bulk edit

- **Decision**:
  - A pure `bulkView(nodes)` returns `{ kind, owner, tech, group: Shared<string | null>, tags: { tag, count }[] }`, with `Shared<T> = { mixed: false, value } | { mixed: true }`.
  - Writes use `editor.batch(() => ids.forEach(id => editor.update('nodes', id, patch)))`, which is one undo step (FR-015).
  - Partial tag → add to all; × → remove from all; each in one batch.
  - A text field showing "Mixed" writes only once the user has typed (the gesture from R4 wraps a batch per frame).
- **Rationale**: the model already offers `batch`; no new op is needed.
- **Alternatives considered**: a model `bulkUpdate` op, which duplicates `batch`.

## R8. Rule editor route and shell

- **Decision**:
  - The deck route gets children: `/deck/:deckId` (index = canvas layout) and `/deck/:deckId/rules/:ruleId?` (rules layout).
  - `EditorShell` (the doc, `EditorProvider`, `ToastProvider`, `ConfirmDeleteDialog`, `Announcer`, `useEditorShortcuts`, 006's `useFlowSync`) moves up to wrap an `<Outlet/>`. 006's `useFlowShortcuts` stays with the canvas layout. The doc is opened once, and switching screens never re-hydrates or resets the UI store.
  - The top bar shows a "Rules" button (lucide `Table2`, with the rule count) before `SaveStatus` on the canvas. On the rules screen, the breadcrumb gains "/ Rules" and "Back to canvas" replaces Export (design 04).
  - Canvas viewport and selection are kept in the UI store (`canvasViewport`), so coming back restores them.
- **Rationale**: FR-018 requires an address a reload returns to. Nesting keeps one doc, one undo history and one toast host. The parent loader does not re-run between child routes.
- **Alternatives considered**:
  - A sibling top-level route: it opens a second doc and resets UI state.
  - A modal over the canvas: it has no address, and the design is a full screen.
- **Shortcut scope**: `useEditorShortcuts` keeps ⌘Z, ⇧⌘Z and ⌘S on both screens. Canvas-only keys (Delete of the canvas selection, Esc clears selection, the canvas keys) run only on the canvas screen. The rule table handles its own keys (R9).

## R9. Decision table keyboard and reorder

- **Decision**: the table follows the ARIA `grid` pattern:
  - Arrow keys move between cells.
  - Enter or F2 edits a cell; Enter commits and moves down; Esc cancels.
  - Typing a character starts editing.
  - ⌥↑ / ⌥↓ on a row moves it (`moveRuleRow`).
  - ⌫ / Delete on a focused row header deletes the row (Undo toast).
  - Rows are dragged by their grip using 006's `use-sortable-list` hook.
  - Column headers are inline-editable. Their menu offers Rename and Remove, and Remove shows an Undo toast (clarification).
  - Cell errors show a `CircleAlert` icon plus the text "Not a valid condition", linked with `aria-describedby`.
- **Rationale**: constitution VII and FR-036. Reusing 006's sortable hook avoids a new dependency.
- **Alternatives considered**: a plain `<table>` of inputs, which gives 3 × 5 × 2 tab stops and no arrow navigation.

## R10. Attaching rules and sample inputs

- **Decision**: new model ops (see [contracts/model-additions.md](contracts/model-additions.md)):
  - `attachRule(host, ruleId)` and `detachRule(host, ruleId)`, where `host = { kind: 'node', id } | { kind: 'step', flowId, stepId }`. Detaching from a step also removes `ruleInputs[ruleId]` in the same transaction, because the model refuses `ruleInputs` for unattached rules.
  - `setRuleInputs(flowId, stepId, ruleId, values)`: drops empty values and the key when nothing is left. It is keyed per step and rule, so typing merges.
  - `RemovalTarget` gains `{ scope: 'rules'; id }` so the delete dialog can preview usage.
  - Pure `ruleUsage(file, ruleId)` → `{ steps: { flowId, stepId, number, from, to, broken }[], nodes: Id[] }`, built with 006's `analyzeFlow`.
- **Rationale**:
  - Today attaching and detaching is a raw `update`/`updateStep` patch, and callers must remember the `ruleInputs` coupling.
  - Named ops make the invariant tested once.
  - "Used in n steps", USED IN and the delete dialog all share `ruleUsage`.
- **Alternatives considered**: doing it in the app with patches (the coupling spreads across callers).

## R11. Toasts and deletes

- **Decision**:
  - Extract `showUndoToast(message)` from `confirm-delete-dialog.tsx` into `editor/undo-toast.ts`, keeping the single-toast rule.
  - Row and column removal and detach call it directly, with no dialog.
  - Rule deletion goes through `requestRemoval([{ scope: 'rules', id }])` and the existing dialog. `describeRemoval` gains the text "Used in n steps and m components".
- **Rationale**: one Undo-toast behavior everywhere (§g-19).

## R12. Derived displays and performance

- **Decision**: pure, memoized selectors in `apps/app/src/editor/inspector/derive.ts`:
  - `edgeUsage(deck, edgeId)`: "<flow> · Step n", via `analyzeFlow`.
  - `flowSummary(deck, flowId)`.
  - `nodeConnections(deck, nodeId)`.
  - `deckStats(deck)`.
  - `ownerSuggestions`, `tagSuggestions`.
  - Evaluations are memoized per `(rule object, inputs)`.
- **Performance**:
  - The inspector is outside the canvas, and edits go through the existing incremental snapshot.
  - SC-001 (< 100 ms field → canvas) is covered by the existing derived canvas.
  - Bulk updates of 20 nodes are one transaction and one snapshot change.
  - `pnpm bench` runs before and after, because bulk edit and edge reattach touch canvas data. No worker is needed (no heavy work, constitution V).
