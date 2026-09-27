# Research: Sticky Notes and Command Palette (009)

Decisions for [plan.md](plan.md), resolving the technical unknowns in the [spec](spec.md).

**Names checked on 2026-09-27** on `main` (`324d1bd`, 008 merged):

- **Schema**:
  - `Sticky` is at `schema/v1.json:466-491`: `id`, `text`, `color`, `anchor`, `position`, plus an `anyOf` that needs an anchor or a position.
  - The generator is `scripts/generate.ts`. Its `stripPresenceRules` drops the `anyOf`, so rule S2 checks it again in `src/semantic-rules.ts`.
  - Tests: `test/schema.test.ts` (parity), `test/fixtures.ts`, `test/coverage.test.ts` against `examples/full.sododeck.json`, and `test/key-order.test.ts`.
  - The recipe for adding fields is in `packages/schema/CLAUDE.md`. The precedent for an additive field is `Flow.branches` (ADR 0008).
- **Model**:
  - Stickies use the generic `add` / `update` / `remove` (`ops/collections.ts`, id prefix `sticky`).
  - `removeNode` (`ops/cascade.ts:107-131`) leaves stickies untouched and reports them in `RemovalResult.broken` (ADR 0005).
  - Undo: `createEditor` wraps a `Y.UndoManager` (`editor.ts:160-273`). `update` keys typing bursts by `${collection}:${id}`, and `beginGesture` / `endGesture` exist.
  - `RemovalTarget` already has a `stickies` scope.
  - `createDeckSnapshot` shares structure between snapshots.
- **App**:
  - Canvas node types are `deck` and `group-boundary` (`canvas.tsx:38`, `deck-to-flow.ts`).
  - `displayPosition(node, index)` in `canvas-geometry.ts:33` places nodes that have no position on a grid.
  - Drag writes are in `use-canvas-handlers.ts`: gesture, then batched `update`.
  - Palette drops use the MIME type `application/x-sododeck-kind`.
  - Shortcuts: `useCanvasKeyDown` (canvas wrapper) and `useEditorShortcuts` (document capture, skips text fields through `isTextTarget`). No ⌘K handler exists.
  - `Selection { nodes, edges }` and `activeFlow` live in `state/ui-store.ts`.
  - Delete goes through `ConfirmDeleteDialog`, `removeTarget` batches and `showUndoToast`.
  - The outline (`outline.ts`) covers groups and nodes only.
  - `Inspector` routes to the node, edge, bulk, deck and flow inspectors.
  - `MarkdownField` renders with `MarkdownView` / `parseMarkdown` from `@sododeck/ui`: paragraphs, bullets and inline code, but **no bold or italic**.
  - `RuleNavContext.openRules(ruleId?)`.
  - "Show flow F at step S" is `navigate(canvasPath)` + `setActiveFlow` + `setActiveStep` (`rules/used-in.tsx:51-55`).
  - The theme is `useThemeStore`, export is `useExportDeck`, the library is `/` and a new deck is `/deck/new`.
  - `features.isApplePlatform` exists.
  - `filter-flows.ts` has `findRanges` (006, flow titles only).
- **UI kit**:
  - `Dialog`, `Combobox` (the WAI-ARIA combobox pattern), `SearchField` (with a `shortcut` kbd hint), `SegmentedControl`, `Switch`, `useToast`.
  - There is no command palette component. No cmdk or fuzzy-search library is installed.
  - Tints: amber, blue and clay soft/ink, plus success. There are no `green` / `grey` tints.
- **Bench**: the bench deck (`src/bench/generate-deck.ts`) has no stickies or rules.

## R1. Two optional sticky fields (additive schema change)

- **Decision**: add `collapsed` and `showInFlows` to `Sticky`:
  - Both are `boolean`, with a description, no `default`, and appended after `position`. Key order is the write order.
  - Absent `collapsed` means expanded; absent `showInFlows` means off.
  - Follow the `packages/schema/CLAUDE.md` recipe: `pnpm schema:generate`, extend `examples/full.sododeck.json` (coverage test), add invalid fixtures (non-boolean values), keep parity green, and add model round-trip cases.
  - `version` stays at 1.
- **Rationale**:
  - Design §g-21: these are authored choices that should travel with the file.
  - Constitution II: additive optional fields do not bump the version.
  - The precedent is `Flow.branches` (ADR 0008).
- **Writing `false`**: the app writes `collapsed: true` / `showInFlows: true` when turned on and **removes** the key when turned off. This keeps files minimal and makes "absent" and "false" mean the same, with no ambiguity. Files that contain `false` still load and round-trip as `false`, which keeps round-trip lossless.
- **Alternatives considered**: making them UI state in Zustand or localStorage was rejected, because it is lost on export and differs per device (§g-21). A single `display` enum was rejected: the two flags are independent.

## R2. Freeing pinned notes when a component is deleted (spec Q1)

- **Decision**: `removeNode` in `packages/model` (`ops/cascade.ts`) frees every sticky whose `anchor` is the removed node's id, in the same transaction:
  - It sets `position = nodeCanvasPosition(file, nodeId) + offset`, where the offset is the sticky's `position`, or `STICKY_DEFAULT_OFFSET` when that is absent.
  - It deletes `anchor`.
  - Text, color, `collapsed` and `showInFlows` are untouched.
  - Undo restores both the node and the pin, because it is one transaction.
  - Notes anchored to other object kinds keep ADR 0005's behavior: kept, and reported broken.
- **Also**:
  - `RemovalResult` gains `freed: Id[]`, so the Undo toast can say "Deleted Order Service · 1 note unpinned".
  - `previewRemoval` counts freed notes for the confirmation dialog.
  - **ADR 0010** records the change. It amends ADR 0005 for component anchors only.
- **Node position rule moves into the model**: `displayPosition`'s grid fallback (a node with no `position` is drawn at grid slot `index`) moves to `packages/model` as `nodeCanvasPosition(file, nodeId)` together with `NODE_GRID`. `canvas-geometry.ts` then re-exports or calls it.
  - The model needs the same point the user sees, so the note does not jump.
  - This is a file-reading rule (where an unpositioned node sits), not a UI choice.
- **Rationale**: this matches the founder decision (spec Q1, backlog §009). Keeping it in the model means the future CLI/MCP gets the same cascade, and the round-trip, cascade and undo tests cover it.
- **Alternatives considered**:
  - Freeing notes in the app's delete dialog was rejected: it duplicates the cascade outside the model (constitution II), and deletes from other paths (bulk, JSON later) would miss it.
  - Keeping the anchor and only drawing the note free was rejected by the founder (option C).

## R3. Anchored position and what the canvas draws

- **Decision**: a pure model helper `stickyCanvasPosition(file, sticky): { point: Point; pinnedTo: Id | null; status: 'free' | 'pinned' | 'foreign' | 'missing' }`:
  - `free`: no anchor. The point is `position`.
  - `pinned`: the anchor is a node. The point is the node's canvas position + `position`, or + `STICKY_DEFAULT_OFFSET` = `{ x: 24, y: -96 }` (above and to the right, as in design 62).
  - `foreign`: the anchor is an existing object that is not a node (edge, group, flow, step, rule). The note is drawn free at `position` (`{0, 0}` if absent). The inspector shows "Pinned to <object>" read-only with "Unpin".
  - `missing`: the anchor matches nothing. Drawn free at `position`; the inspector shows "Pinned object is missing" with "Unpin".
- **Dragging**:
  - Dragging a pinned note writes `position = dropPoint − nodeCanvasPosition`, so the offset changes and the note stays pinned.
  - Dragging a free, foreign or missing note writes an absolute `position`.
  - Moving the node writes nothing to its notes: they follow because their point is derived.
- **Pin and unpin keep the screen position**: pinning writes `anchor = nodeId` and `position = current − nodeCanvasPosition`; unpinning deletes the anchor and writes the absolute `position`. Both happen in one `batch`.
- **Rationale**: a single rule shared by the canvas, the cascade (R2) and tests. The schema already defines `position` as the offset when anchored, so no new field is needed (design-analysis mapping row "Sticky offset").

## R4. Stickies on the canvas

- **Decision**:
  - A new React Flow node type `sticky` (`editor/stickies/sticky-node.tsx`). `deck-to-flow.ts` gains `toStickyNodes(deck, selection)`, cached per sticky object with the same WeakMap pattern as nodes.
  - Stickies are drawn above components (`zIndex` 1), 180 px wide. Body height is capped at 240 px with internal scroll.
  - A leader is a React Flow edge type `sticky-leader` (dotted, not selectable or focusable, `aria-hidden`). It runs from the note's pin to the top edge of the node, with a pin glyph at the node end (design 62). It exists only for `pinned` notes.
  - The card is an amber-soft surface with a note icon and a chevron (collapse) in its header strip:
    - Expanded: the whole text as markdown.
    - Collapsed: the first non-empty line, as plain text, with an ellipsis.
    - Footer: "Pinned to <node title>" with a pin icon when pinned.
  - `color` maps to tints: amber, blue and clay use existing tints; `green` uses the `success` soft/ink tokens; `grey` uses the neutral surface and muted ink tokens. No new colors, tokens only.
- **Selection**: `Selection` gains `stickies: Id[]`.
  - `select`, `pruneSelection`, `resetForDeck` and marquee handle it.
  - Sticky node ids get the prefix `sticky:` on the canvas, like `group:`, so they can never collide with component ids.
- **No design title field**: the design shows a bold heading ("Checkout notes") that does not exist in the schema. The first line of the text is used as the inspector heading and the collapsed line. No `title` field is added (not in spec scope).
- **Rationale**: this reuses the derived-canvas pattern (ADR 0006) and adds no document state. Leaders as edges get React Flow's routing and viewport handling for free.
- **Alternatives considered**: an HTML overlay layer outside React Flow was rejected, because it has to re-implement viewport transforms and hit-testing.

## R5. Creating a note, and removing an empty one without an undo entry

- **Decision**:
  - A new model op pair, `beginStickyDraft(sticky): Id` and `endStickyDraft(id)`:
    - `beginStickyDraft` opens a gesture and adds the sticky in it.
    - Text edits during the draft merge into that gesture.
    - `endStickyDraft` ends the gesture. If the sticky's text is empty or whitespace, it first removes the sticky and then drops the gesture's stack item from the undo history (`undoStack.pop()` guarded by the item's origin), so creating and removing leaves no trace in undo or redo.
    - It notifies history listeners.
  - The app calls `beginStickyDraft` on palette drop / N and `endStickyDraft` on the note editor's blur, on Esc, or when the deck switches.
  - Tested in `undo.test.ts`: draft with text gives one undo step; empty draft gives no step and `canUndo` unchanged.
  - Remote tabs see add then remove, which is harmless.
- **Rationale**: this implements FR-004 ("same undo step as its creation, so it leaves no undo entry") in the only package that owns the undo manager.
- **Alternatives considered**:
  - Calling `undo()` on blur was rejected: it leaves a redo entry that can resurrect an empty note.
  - Creating the sticky only after the first keystroke was rejected: the card must exist and be editable at once (acceptance 1).

## R6. Editing text in place

- **Decision**:
  - Double-click, Enter or F2 on a selected note (and creation) opens an in-card `textarea` (tokens, 180 px, auto-growing up to the cap). Blur or Esc leaves edit mode; ⌘↵ also commits.
  - Text is written live through `useLiveField` (008 R4): one undo step per edit session, or the draft gesture for a new note.
  - The sticky inspector's TEXT · MARKDOWN field uses 008's `MarkdownField` bound to `stickies:<id>`.
  - While a note is in edit mode, canvas keys (N, Delete, arrows) are ignored, because `isTextTarget` already covers textareas.
- **Rationale**: this reuses 008's live-field and markdown field. The canvas card and the inspector write to the same Yjs field, so they cannot disagree.

## R7. Markdown in notes: add bold and italic to the shared parser

- **Decision**: extend `packages/ui/src/lib/markdown.ts` inline parsing with `**bold**` / `__bold__` and `*italic*` / `_italic_`:
  - Markers must hug non-space text. Unmatched markers stay literal. No nesting beyond bold wrapping italic.
  - Output is still React elements (`strong`, `em`), never HTML.
  - Notes and 008 descriptions share the parser, so descriptions gain bold and italic too. 008's `markdown` tests stay green, and new cases are added.
- **Rationale**:
  - Spec FR-002 lists bold and italic and asks for "the same rules as 008". One parser keeps both consistent.
  - The full example deck's sticky already uses `**ops**`.
  - Adding it is safe: no raw HTML path is introduced.
- **Alternatives considered**: a markdown library was rejected (008 R3, constitution VIII).

## R8. Search: pure module in the model, main thread, incremental

- **Decision**: `packages/model/src/search/` exports:
  - `normalizeText(s)`: NFKD, strips combining marks (accents), lower-cases, removes markdown markers (`*`, `_`, backticks, a leading `-` / `#` / `>` per line), and collapses whitespace.
  - `buildSearchIndex(file, previous?)`: one entry per searchable object (node, edge, flow, step, rule, sticky). Each entry holds the object's `kind`, id, parent id (the flow of a step), title, context line, and normalized `fields: { name: 'title' | 'description' | 'condition' | 'notes' | 'text' | 'cell' | 'column'; raw; norm }[]`.
    - Entries are cached in a `WeakMap` keyed by the snapshot object. Snapshots are structurally shared, so a keystroke in one description only re-normalizes that object.
  - `searchDeck(index, query, { limit = 50 }): { results: SearchResult[]; total: number }`:
    - Splits the normalized query into words. An entry matches when every word appears as a substring in any of its fields.
    - Rank: title match (all words in the title) first, then body-only; then by kind order `node, edge, flow, step, rule, sticky`; then by title with `localeCompare`.
    - A body match carries a snippet of about 80 characters: a window of the raw field around the first matched word, with ellipses and match ranges for highlighting. It is computed only for the returned results.
  - The query is trimmed to 200 characters.
- **Where**: the app keeps one index per open deck, rebuilt from the current snapshot while the palette is open (`useMemo` on the snapshot), so FR-029 holds.
- **Main thread, not a worker**:
  - At 2,000 nodes plus proportional edges, flows and rules, about 6k entries and about 20k short fields, a substring scan costs about 2–5 ms per keystroke on a laptop. That is well under SC-001's 50 ms.
  - A model perf test (`test/perf.test.ts`) asserts that `searchDeck` takes < 50 ms (median of 5 runs) on a generated 2,000-node deck.
  - The first index build (< 30 ms) happens on palette open, not on every edit.
  - Constitution V asks for workers for _heavy_ work. This is not heavy, and a worker would add copying costs larger than the search itself. **If the perf test ever exceeds 25 ms, move `searchDeck` to a worker** using the existing worker pattern (`library.worker.ts`).
- **Rationale**: pure and testable in Node; reusable by a future CLI/MCP; no dependency.
- **Alternatives considered**:
  - minisearch / fuse.js were rejected: a new dependency (constitution VIII), and fuzzy matching is out of scope.
  - An inverted index was rejected: it is not needed at this size, and substring matching is what users expect for code-like names.

## R9. Command palette UI (no cmdk)

- **Decision**:
  - `packages/ui` gains a presentational `CommandDialog`: a Radix `Dialog` holding a combobox input (`role=combobox`, `aria-expanded`, `aria-controls`, `aria-activedescendant`) and a `role=listbox` of `role=option` rows.
    - Each row has an icon slot, title with highlight ranges, meta text (kind · context) and an optional kbd hint.
    - It also has an empty state slot and a footer hint row ("↵ open · esc close").
    - The keyboard model is copied from `Combobox`: ↑/↓ with no wrapping, Home/End, Enter, Esc. The highlight follows the pointer on hover.
    - A polite live region announces "n results" (debounced 300 ms) or "No results".
  - All logic lives in the app under `apps/app/src/editor/command-palette/`: commands, the result model and opening results.
- **Rationale**: about 150 lines on existing Radix primitives, matching design 30–32. cmdk would need founder approval (backlog note, constitution VIII) and brings its own fuzzy ranking, which differs from the spec's ordering rules.
- **Alternatives considered**: cmdk (see above); reusing `Combobox` directly was rejected, because it is a popover field and not a modal dialog with rich rows.

## R10. Commands and their availability

- **Decision**: `commands.ts` builds the list from a context `{ navigate, openRules, exportDeck, theme, focusModeAvailable }`. Commands:
  - Export deck…: calls `useExportDeck`'s action. Shortcut: none.
  - Switch theme: shown as "Toggle dark mode" in the design, but we use "Switch theme", with the shortcut from the theme toggle if it has one. It toggles between the _resolved_ light and dark.
  - Open rule editor: `openRules()`.
  - Go to library: `navigate('/')`.
  - New deck: `navigate('/deck/new')`.
  - Toggle focus mode: listed only when `focusModeAvailable`, which is false until 010 wires it.
- With an empty query, the palette lists all commands, then flows (design 30), limited to 50 rows in total.
- With a query, commands are matched by name, with the same word rule, and rank first among title matches (spec acceptance US2-7).
- The design says "Toggle dark mode" and "Open rule editor"; the spec says "Switch theme" and "Open rules". The UI uses the design's labels, and the names used in the spec are aliases that also match. Result: typing "theme" or "dark" both find it.

## R11. Opening a result

- **Decision**: `openResult(result)` in `command-palette/open-result.ts`. On the rules screen, canvas targets first `navigate(canvasPath)`.
  - **Component**: `select({ nodes: [id] })`, focus it, then `fitView({ nodes: [{ id }], maxZoom: current, duration: 0 })`. This is the same as the outline (`outline-tree.tsx:46-48`).
  - **Connection**: select it, and `setCenter` on the midpoint of its endpoints at the current zoom.
  - **Note**: `select({ stickies: [id] })`, then `setCenter` on its canvas point.
  - **Flow**: `setActiveFlow({ flowId })`, the 006 "show a flow". Whether this starts flow mode is part of the post-007 review.
  - **Step**: `setActiveFlow` + `setActiveStep(stepId)`, as in `used-in.tsx`.
  - **Rule**: `openRules(ruleId)`.
  - **Command**: run it.
  - Then close the palette. Focus returns to the target (canvas item, inspector or rule editor), or to the previous focus for commands that do not move focus.
- If the target no longer exists, nothing happens and "This item no longer exists" is announced (edge case).
- **Rationale**: every path reuses an existing action, so there is no new navigation code.

## R12. Keyboard: ⌘K, N and ⌥C

- **Decision**:
  - **⌘K / Ctrl+K**: in `useEditorShortcuts` (document capture), active on both editor screens, including inside text fields (it never types a character: `preventDefault`).
    - If a text field is focused, blur it first so `useLiveField` commits.
    - Pressing it again while open closes the palette. The shortcut label uses `features.isApplePlatform`.
    - Palette state (`open`, `returnFocus`) lives in `useUiStore.palette`.
  - **N**: in `useCanvasKeyDown` (canvas wrapper only, not in text fields, not during a flow session).
    - It uses the last pointer position over the canvas pane (tracked by `onPointerMove` on the pane, in flow coordinates via `screenToFlowPosition`). With no pointer position, it falls back to the view centre.
    - If the point is inside a component's rectangle, the note is pinned to it.
  - **⌥C**: in `useCanvasKeyDown` on a selected sticky. It matches `event.code === 'KeyC' && event.altKey`, because on macOS ⌥C produces `ç` in `event.key`.
  - **Enter / F2**: edit the selected note. Arrows nudge the selected note by 8 px (Shift: 32 px) as one gesture per key-repeat burst.
- The top bar gets a "Jump to…" `SearchField`, rendered as a button (`aria-haspopup="dialog"`, name "Jump to… (⌘K)") that opens the palette, between the save status and the theme toggle (design 30).

## R13. Outline and inspector

- **Decision**:
  - `outline.ts` gains `buildNotesOutline(deck)`: notes in file order, each labelled by its first non-empty line (plain text, markdown stripped by `normalizeText`'s marker rule but keeping case) or "Empty note".
  - The left sidebar shows a "Notes · n" section after Components (collapsible, like groups). Choosing a row selects the note and centres it (R11).
  - `inspector/sticky-inspector.tsx`, a design 62 layout inside `InspectorFrame`:
    - Header: note icon, first line (or "Note"), "Note · pinned to <node>" / "Note · free", and a delete button.
    - TEXT · MARKDOWN (`MarkdownField`).
    - ANCHOR: `SegmentedControl` Free / Pinned to node.
    - PINNED TO: `Combobox` in pick mode, listing components by title, with the help text "Moves with the node. Unpin keeps it where it is."
    - DISPLAY: Expanded / Collapsed.
    - "Stay visible during flows": `Switch`, with the help text "Off: dims to 35% unless its node is on the current step".
  - Choosing "Pinned to node" without a component opens PINNED TO. The pin is written only when a component is picked.
  - The `Inspector` router shows `StickyInspector` when exactly one sticky and nothing else is selected. A mixed selection shows the existing "several" frame, with notes counted.

## R14. Delete, undo toast and the JSON panel

- **Decision**:
  - Delete / Backspace on selected notes calls `requestDelete`, which now includes `{ scope: 'stickies', ids }`.
  - `describe-removal.ts` gains note text: "Delete this note?" / "Delete 3 notes?", and the toast "Note deleted · Undo".
  - Deleting components reports freed notes (R2): "Deleted Order Service · 1 note unpinned".
  - JSON panel (004): the Selection tab shows the selected sticky object (as in design 62). The Deck tab already includes stickies.
- **Rationale**: this is the existing confirm-then-toast path (§g-11, §g-19). There is no new dialog.

## R15. Flow mode (deferred) and what 009 does during 006's shown flow

- **Decision**:
  - In 009, a shown or recorded flow (006) does **not** dim notes. Adding notes (drop, N) is refused during a flow session, like component drops today.
  - The `showInFlows` switch is stored and shown in the JSON panel.
  - User Story 4 and FR-016–FR-018 are built after 007 merges, reviewed against 007 as implemented. The expected hook is 007's flow overlay: a `dimmedStickies(overlay, deck, preference)` derivation plus a `notesDisplay: 'dimmed' | 'shown' | 'hidden'` preference persisted in localStorage.
  - Nothing in 009 blocks that.
- **Rationale**: founder decision (spec Q2).

## R16. Bench and performance checks

- **Decision**:
  - `generateBenchDeck` gains `stickies` (default 0). With `stickies=100`, half are pinned to random nodes and half are free, all seeded.
  - `pnpm bench` runs before (on `main`) and after, with `BENCH_STICKIES=100`. The pan/zoom FPS must stay at ≥ 60 fps at 500 nodes / 1,000 edges (SC-009).
  - A new scenario, "⌘K type → results painted", is a median of 5 runs on 2,000 nodes against a 50 ms target (SC-001, SC-008).
- **Rationale**: constitution V (bench before and after for canvas changes).

## R17. ADR numbering with parallel work

- **Decision**: this feature adds **ADR 0010: Sticky notes: display flags and release on component delete** (R1, R2, R3). 010 is being specified in parallel and may also claim 0010. Whichever merges second renumbers its ADR and fixes its references.
