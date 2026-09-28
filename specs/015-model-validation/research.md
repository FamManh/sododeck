# Research: Model Validation (Problems)

All decisions below were checked against `main` (`2ebf01a`). No NEEDS CLARIFICATION remained in
the spec.

## R1. One deck-wide check in `packages/model`

**Decision:** add a pure `checkDeck(file: SododeckFile): DeckProblems` in
`packages/model/src/problems.ts` and export it from the package index. It builds on the existing
checks instead of re-implementing them:

- `analyzeFlow(flow, file.edges)` for step without connection (`broken-step`), broken chain
  (`chain-break`), incomplete flow (`empty-flow`, `empty-branch-label`, `empty-branch-condition`,
  `unknown-branch`).
- `ruleChecks(rule)` for rule without catch-all (`catchAll === false`) and invalid cells.
- `checkIntegrity(file)` for missing rules (`field` `rules` with `targetType` `rule`) and every
  other broken reference, cycle, ambiguous anchor and detached rule input.
- New code only for orphan components, duplicate connections and overlapping branch conditions.

**Rationale:** `packages/model` is pure, worker-safe and already the home of `checkIntegrity`,
`analyzeFlow` and `ruleChecks` (its CLAUDE.md). One function gives the list, the glyphs, the
toast count and ⌘. the same answer, and the flow row stops running its own `analyzeFlow`.

**Alternatives considered:** checks inside the app (rejected: duplicates model logic, not
worker-safe by lint); extending `checkIntegrity` (rejected: it reports references, and its callers,
such as the delete preview, must not start reporting orphans).

## R2. Deduplication ("one cause, one symptom")

**Decision:** integrity problems on `flows[].steps[].edge` and `flows[].steps[].branch` are
dropped because `analyzeFlow` reports them as `broken-step` / `unknown-branch`. `analyzeFlow`
already never flags a chain break right after a broken step. Integrity problems on `rules` fields
become `missing-rule`, not `broken-reference`.

**Rationale:** FR-004 and the edge case "a deleted connection used by a step yields one problem".

## R3. Definitions

- **Orphan:** a node id that is neither `from` nor `to` of any edge, is not the `parent` of another
  node, and the deck has more than one node. Groups and stickies are never orphans.
- **Duplicate:** edges grouped by `from`, `to` and the normalised label (empty = missing); groups of 2+ are one problem listing
  all edge ids. Direction matters (A→B ≠ B→A); self-loops are not reported.
- **Normalisation** of labels and conditions: trimmed, lower-case, runs of whitespace collapsed
  (a local helper; the search normaliser also strips markdown markers, which labels do not need).
- **Overlapping conditions:** a flow has at most one fork (all `flow.branches` share it, see
  `flow-paths.ts`), so branches of one flow whose normalised non-empty conditions are equal form
  one problem.
- **Ordering:** kind order `orphan`, `duplicate-connection`, `step-without-connection`,
  `broken-chain`, `incomplete-flow`, `overlapping-conditions`, `missing-rule`,
  `rule-without-catch-all`, `invalid-rule-cells`, `broken-reference`; then object title
  (`localeCompare`, base sensitivity); then step order.
- **Stable key:** `kind` + the ids involved (for example `broken-chain:flow-7:step-3`). ⌘.
  remembers the last visited key and continues from its index; when that problem is gone (fixed),
  the walk restarts from the first (or, backwards, the last) problem.

## R4. Where it runs: a problems worker

**Decision:** a module worker `apps/app/src/editor/problems/problems.worker.ts` with a client
`createProblemsClient()` shaped like the layout client (lazy start, `{id, request}` messages,
pending map, `onerror`, injectable `makeWorker`). A per-doc store posts the latest snapshot
**trailing-throttled at 150 ms, latest wins** (a newer snapshot supersedes any in-flight result,
which is dropped when it arrives). Tests inject an inline client that calls `checkDeck`
synchronously.

**Rationale:** constitution V names "bulk validation" as worker work; SC-003 asks for no canvas
regression at 2,000 components. Structured-cloning a 2,000-node snapshot costs a few ms off the
interaction path; the check itself then costs nothing on the main thread. 150 ms keeps small decks
feeling instant while typing (FR-011's 1 s budget).

**Alternatives considered:** main thread with memoisation (rejected: violates V for large decks and
competes with drag frames); worker only above a size threshold (rejected: two code paths for
little gain); sending Yjs updates to a worker-side doc (rejected: more complex, and the snapshot is
already the unit the app reads).

## R5. Sharing the result

**Decision:** a `ProblemsProvider` in `EditorChrome` (`routes/editor-page.tsx`) owns one store per
deck and exposes `useProblems(): DeckProblems | null` (`null` before the first result) via
`useSyncExternalStore`. The UI store only gains `problemCursor: string | null` (last visited key).

**Rationale:** apps/app/CLAUDE.md: Zustand is for UI state; problems are derived, so they live in a
derived store next to the snapshot, like `createDeckSnapshot`. One provider means one worker round
trip per edit for the toolbar, inspector, flow list, rule list, canvas and ⌘. together; ⌘. also
works on the rules screen because the provider wraps both screens.

## R6. Going to a problem

**Decision:** `goToProblem(problem, ctx)` in `apps/app/src/editor/problems/go-to-problem.ts` reuses
`openResult` (command palette) for nodes, flows/steps and rules, including its "hidden in this
view → Show in <view>" toast and "no longer exists" announcement, and adds what `openResult`
lacks:

- **Collapsed group / drill-in (FR-018):** before selecting a node, if it is inside a collapsed
  group of the current view, expand the outermost collapsed ancestor with
  `setGroupCollapsed(editor, groupId, false)` (untracked, not an undo step, per 011); if it is
  outside the drill scope, `drillUp` to the deepest level that contains it (`scopeOf`).
- **Several edges (duplicates):** `select({ edges: ids })` and `fitView` on their end nodes.
- **Branch problems:** `openFlow(editor, flowId, forkStepId)` (the last main step), so the flow
  inspector shows the branches.
- **Broken references:** select the holder (node, group, sticky, edge); a view holder switches to
  that view; a flow/step holder opens the flow.
- **Flow mode:** the canvas button and row activation call `exitFlow()` first when needed, because
  the inspector shows the flow inspector while a flow is active.

## R7. Glyphs on the canvas

**Decision:** a per-id `ProblemMarks` (`Map<id, { count, titles, label }>`) is passed to
`toFlowNodes` / `toFlowEdges` as `CanvasView.problems` (next to the view's `render` input; the flow
`overlay` stays for flow marks only), and added to the node/edge cache comparisons. `DeckNode` shows an amber
`TriangleAlert` at the top-right corner (hidden while the connect-target "+" uses that corner) and
appends ", n problem(s)" to its accessible name; `DeckEdge` shows the glyph inside the label pill
and renders the pill when the edge has problems even if labels are off.

**Rationale:** apps/app/CLAUDE.md forbids ad hoc filtering in components; the overlay path keeps
memoisation intact. Amber tokens (`amber-soft` / `amber-ink`) exist in both themes.

## R8. Flow and rule rows

**Decision:** `FlowRow` drops its own `analyzeFlow` call and its clay "Has problems" marker and
reads problem counts for its flow from `useProblems()`; the rule editor's `RuleList` rows get the
same glyph. A shared `ProblemGlyph` component in `apps/app/src/editor/problems/`.

## R9. Delete feedback

**Decision:** in `confirm-delete-dialog.tsx`, count problems synchronously with `checkDeck` on
`readDeck` before and after the batch (one call each, only on a confirmed delete), and append
" · n new problems" to the toast and announcement when the count grew.

**Rationale:** the worker result arrives asynchronously, after the toast is built. A synchronous
check once per delete is a user-initiated, one-off cost; measured in `packages/model/test/perf`
(budget 30 ms at 2,000 nodes). Recorded in Complexity Tracking.

## R10. Keyboard

**Decision:** ⌘. / Ctrl+. and ⇧⌘. / ⇧Ctrl+. in `useEditorShortcuts`, after the text/dialog guard,
matching `event.code === 'Period'` (shift changes `event.key` on some layouts). Nothing uses these
keys today. The list uses the roving-focus pattern of the outline (↑↓, Home/End, ↵/Space).

## R11. Row cap

**Decision:** the panel renders the first 200 rows and a "Show all n" button (UI state, reset when
the deck changes); counts come from `DeckProblems.total`.
