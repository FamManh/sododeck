# Tasks: Sticky Notes and Command Palette

**Input**: design documents in `specs/009-stickies-search/`:

- [plan.md](plan.md) and [spec.md](spec.md), including the Clarifications of 2026-09-27 (Q1: notes become free when their component is deleted; Q2: flow-mode behavior waits for 007), and the review against 007 as implemented (2026-09-28), which brought User Story 4 fully into scope.
- [research.md](research.md) (R1–R17) and [data-model.md](data-model.md).
- [contracts/model-additions.md](contracts/model-additions.md) and [contracts/stickies-palette-ui.md](contracts/stickies-palette-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI requires:

- unit tests (Vitest) for every pure module and store
- component tests (Testing Library, by role and label, following the UI contract) for user-visible behavior
- a round-trip case for every model change

Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay green unchanged.

**007 is merged** (`b519550`). User Story 4 builds on its flow mode: `isFlowMode`, `openFlow`, the flow overlay's `NodeFlowMark.currentStep`, the `data-flow-mode` CSS and `--sd-dur-dim`, `canvas-toolbar.tsx` and `flows/inspector-step.tsx` (research header, R15).

**Parallel sessions**: 010 is being specified in another session. `.specify/feature.json` points at 010, so do not rely on it; use `specs/009-stickies-search/` explicitly. Merge hot spots and ADR renumbering are covered in plan.md and research R17.

**Approvals**: no new runtime dependency and no Complexity Tracking exception. The PR description should mention two behavior changes to the founder: node deletes now free pinned notes (ADR 0010), and markdown bold and italic also apply to 008 descriptions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US4 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`, tests in `packages/schema/test/`.
- **Model**: source in `packages/model/src/…`, tests in `packages/model/test/`.
- **UI package**: source in `packages/ui/src/…`, tests in `packages/ui/test/`.
- **App**: source in `apps/app/src/…`, with tests next to the code (`*.test.ts(x)`).
- **Commits**: after each task or logical group, using Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(ui): …`, `feat(app): …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `009-stickies-search` from the latest `main` (008 merged, `324d1bd` or later). Run `pnpm install && pnpm test` to confirm a green start.
- [ ] T002 [P] Record the baseline with `BENCH_STICKIES=0 pnpm bench` on `main` and save the pan, zoom and drag numbers at 500 nodes / 1,000 edges in `specs/009-stickies-search/bench-before.md`. `BENCH_STICKIES` is ignored until T020 lands; the numbers are the baseline.
- [x] T003 [P] Write the ADR `docs/decisions/0010-sticky-notes.md` in the 0008 header format. It covers:
  - the optional `collapsed` and `showInFlows` fields, and why they are document data (§g-21, research R1)
  - writing `true` or removing the key
  - `position` as the offset when pinned, and `STICKY_DEFAULT_OFFSET`
  - node deletes freeing pinned notes at the same canvas point in the same transaction, which amends ADR 0005 for node anchors only (spec Q1, research R2)
  - the node grid fallback moving into the model
  - alternatives considered: UI-only flags, freeing notes in the app, keeping the anchor but drawing it free (option C)
  - If 010 has already merged an ADR 0010, take the next free number and fix the references in plan.md and research.md.

---

## Phase 2: Foundational (blocks every user story)

### Schema (`packages/schema`)

- [x] T004 Add `collapsed` and `showInFlows` to `Sticky` in `packages/schema/schema/v1.json`, following `packages/schema/CLAUDE.md` "Editing v1.json" (contracts/model-additions.md "Schema"):
  - booleans with descriptions, no `default`, appended after `position`
  - run `pnpm schema:generate` to update `src/generated/types.ts` and `src/generated/zod.ts`
  - extend `examples/full.sododeck.json` with one sticky that has `"collapsed": true` and one that has `"showInFlows": true`
  - add invalid fixtures `collapsed: "yes"` and `showInFlows: 1` to `packages/schema/test/fixtures.ts`
  - `pnpm --filter @sododeck/schema test` must pass: parity, coverage, generated and key order.

### Model (`packages/model`)

- [x] T005 [P] Write `packages/model/test/geometry.test.ts`. It must fail at first, and it covers (research R2, R3):
  - `nodeCanvasPosition` for a positioned node, an unpositioned node (the grid slot by index, matching today's app `displayPosition`), and an unknown id (`null`)
  - `stickyCanvasPosition` for each status: free; pinned with an offset; pinned without a position (`STICKY_DEFAULT_OFFSET`); foreign (anchor = an edge id, then a step id); missing (anchor names nothing)
  - `stickyLabel`: the first non-empty line, markdown markers removed, case kept, and `null` for blank text
- [x] T006 Implement `packages/model/src/geometry.ts` (`Point`, `NODE_GRID`, `STICKY_DEFAULT_OFFSET = { x: 24, y: -96 }`, `nodeCanvasPosition`, `stickyCanvasPosition`, `stickyLabel`) and export it from `packages/model/src/index.ts`. `NODE_GRID` must equal the values of the `GRID` constant in `apps/app/src/editor/canvas-geometry.ts`. Make T005 pass.
- [x] T007 Add round-trip cases to `packages/model/test/round-trip.test.ts`: stickies with every combination of free and pinned, with and without position, `collapsed` true, false and absent, and `showInFlows` true, false and absent. Include a key-order check for the new fields. Confirm they pass once T004 is in.

### App foundation (`apps/app`)

- [x] T008 Switch `displayPosition` in `apps/app/src/editor/canvas-geometry.ts` to call `nodeCanvasPosition`, or to share `NODE_GRID` from `@sododeck/model`, so the grid rule lives only in the model. The existing `canvas-geometry.test.ts` and `deck-to-flow.test.ts` must stay green unchanged.
- [x] T009 Extend `Selection` in `apps/app/src/state/ui-store.ts` with `stickies: Id[]`, and add the UI state from data-model.md: `stickyEditing`, `stickyDraft`, `canvasPointer`, `palette { open, returnFocus }`.
  - Update `select`, `pruneSelection` (drop sticky ids that are gone), `resetForDeck` and every `Selection` literal in the app. `setActiveFlow` still clears the selection.
  - Add store tests in `apps/app/src/state/ui-store.test.ts`: pruning of removed stickies, reset, and the palette open/close state.

**Checkpoint**: the schema has the fields, the model has the geometry, and the app has sticky selection. The stories can start.

---

## Phase 3: User Story 1: Leave a note on the diagram (P1) 🎯 MVP

**Goal**: add, edit, pin, move, collapse and delete notes; free them when their component is deleted; list them in the outline (spec US1, FR-001–FR-015).

**Independent test**: on a deck with components only, add a free and a pinned note, edit both, move the component, collapse a note, delete the component (the note becomes free) and undo, then reload. The JSON panel is correct after each step, and each step undoes with one ⌘Z (quickstart steps 1–6).

### Model

- [x] T010 [P] [US1] Write `packages/model/test/stickies.test.ts`. It must fail at first, and it covers (contracts "Editor ops", research R3, R5):
  - `beginStickyDraft` adds the note, and text updates during the draft merge into one step. `endStickyDraft` returns `'kept'` and leaves one undo step, which removes the note on undo.
  - Blank text: `endStickyDraft` returns `'discarded'`, the note is gone, and `canUndo()`/`canRedo()` are the same as before the draft. History listeners are notified.
  - A second `beginStickyDraft` while one is open throws. `endStickyDraft` on a note removed by a remote tab returns `'discarded'`.
  - `pinSticky` / `unpinSticky` keep `stickyCanvasPosition(...).point` unchanged, for a positioned node and a grid-placed node. `pinSticky` with an unknown node throws `missing-reference`.
  - `moveSticky` writes an offset when pinned and an absolute point otherwise.
  - The flags: `update('stickies', id, { collapsed: true })`, then `{ collapsed: null }`, removes the key.
  - Each op is one undo step. A remote-origin edit is observed as remote.
- [x] T011 [US1] Implement `packages/model/src/ops/stickies.ts` (`beginStickyDraft`, `endStickyDraft`, `pinSticky`, `unpinSticky`, `moveSticky`) and wire them into `DeckEditor` in `packages/model/src/editor.ts`.
  - The draft uses the gesture machinery. On discard, remove the note, end the gesture, then pop the draft's stack item from the `Y.UndoManager` undo stack, only if its origin is this editor **and it is still the top item**. If another local step was recorded after the draft started, remove the note as a normal step instead of popping. Notify `onHistoryChange` listeners.
  - Add this case to T010's test file: another edit recorded during the draft, then discard, leaves the other edit undoable and the note removed.
  - Export the ops from `packages/model/src/index.ts`. Make T010 pass.
- [x] T012 [P] [US1] Update the cascade tests in `packages/model/test/cascade.test.ts`, `packages/model/test/undo.test.ts` and `packages/model/test/preview.test.ts`. They must fail at first (research R2):
  - Deleting a node with two pinned notes (one with an offset, one without a position) frees both at their previous canvas points. The anchor is removed; text, color and flags are untouched.
  - Same for a grid-placed node.
  - A multi-node delete frees the notes of every deleted node.
  - Notes anchored to a deleted edge, step or flow are unchanged and still in `broken`.
  - `RemovalResult.freed` lists the freed ids, and they are not in `broken`.
  - One `undo()` restores the node and each note's `anchor` and original `position`.
  - `previewRemoval` reports `freed`.
  - Update any existing assertion that expected a node-anchored sticky to be `broken`.
- [x] T013 [US1] Implement the freeing in `removeNode` in `packages/model/src/ops/cascade.ts`, and add `freed` to `RemovalResult` and to `previewRemoval` in `packages/model/src/preview.ts`. Make T012 pass. Update `packages/model/CLAUDE.md` with the sticky ops, the geometry, the cascade change and ADR 0010.

### UI kit

- [x] T014 [P] [US1] Add bold and italic cases to `packages/ui/test/markdown.test.ts`. They must fail at first (research R7):
  - `**b**`, `__b__`, `*i*`, `_i_`, and bold wrapping italic
  - unmatched markers and markers next to spaces stay literal
  - `snake_case_name` stays literal
  - existing cases stay green
  - `markdown-view.test.tsx` renders `strong` and `em` and still never injects HTML
- [x] T015 [US1] Extend inline parsing in `packages/ui/src/lib/markdown.ts` and rendering in `packages/ui/src/components/markdown-view.tsx`. Make T014 pass.

### Canvas

- [x] T016 [P] [US1] Write the sticky cases in `apps/app/src/editor/deck-to-flow.test.ts`. They must fail at first (research R4):
  - `toStickyNodes` gives one `sticky` node per note, id `sticky:<id>`, at `stickyCanvasPosition`, selected when in `selection.stickies`, with object identity reused when the note and its anchor node are unchanged
  - a pinned note moves when its node's position changes
  - `toLeaderEdges` gives one `sticky-leader` edge per pinned note only (none for foreign or missing), not selectable or focusable
- [x] T017 [US1] Implement `toStickyNodes` and `toLeaderEdges` in `apps/app/src/editor/deck-to-flow.ts` (WeakMap cache per sticky), plus `apps/app/src/editor/stickies/sticky-tint.ts`: color → token classes, where amber, blue and clay use tints, green uses `success`, and grey uses neutral surface and muted ink. Add a contrast case for the sticky tints in the existing `packages/ui` contrast suite. Make T016 pass.
- [x] T018 [P] [US1] Write `apps/app/src/editor/stickies/sticky-node.test.tsx`. It must fail at first, following the UI contract "Sticky note on the canvas":
  - the accessible name ("Note: <label>", ", pinned to <node>", ", collapsed", "Note: empty")
  - markdown body elements; `<script>` shown as text
  - the collapsed line and the `aria-expanded` toggle ("Collapse note" / "Expand note")
  - the "Pinned to <node title>" footer, which updates after the node is renamed
  - double-click, Enter or F2 opens the `textbox` "Note text"; typing writes to the model live; Esc and blur leave edit mode
- [x] T019 [US1] Implement `apps/app/src/editor/stickies/sticky-node.tsx` (the 180 px card, a header strip with a note icon and chevron, the body capped at 240 px with scroll, the footer, and the in-card editor through `useLiveField` bound to `stickies:<id>`) and `apps/app/src/editor/stickies/sticky-leader-edge.tsx` (dotted, pin glyph at the node's top edge, `aria-hidden`). Register both in `nodeTypes` and `edgeTypes` in `apps/app/src/editor/canvas.tsx`, above components (`zIndex` 1). Make T018 pass.
- [x] T020 [P] [US1] Add a `stickies` option to `apps/app/src/bench/generate-deck.ts` (seeded; half pinned to random nodes, half free) and read `BENCH_STICKIES` / `?stickies=` in `apps/app/src/routes/bench-page.tsx` and `apps/app/bench/perf.bench.ts`.

### Adding, moving and keys

- [x] T021 [P] [US1] Write `apps/app/src/editor/stickies/sticky-actions.test.ts` and the sticky cases in `apps/app/src/editor/use-canvas-shortcuts.test.tsx` and `apps/app/src/editor/palette.test.tsx`. They must fail at first (research R5, R12):
  - `addNoteAt(point)` starts a draft that is free on empty canvas and pinned when the point is inside a component's rectangle. It selects the note, enters edit mode and announces "Note added" / "Note added, pinned to <node>".
  - `finishDraft` on blur discards a blank note ("Empty note removed", no undo entry) and keeps a note with text.
  - N at the tracked pointer adds a note, falls back to the view centre, and does nothing in a text field, during a flow session or in flow mode (`isFlowMode`).
  - ⌥C (`code === 'KeyC'`, `altKey`) toggles `collapsed` on the selected note and announces it.
  - Arrows nudge the selected note by 8 px (Shift 32 px).
  - Enter or F2 edits the note.
  - The palette "Note" card is draggable with the note MIME, a click adds a free note at the view centre, and the STRUCTURE help text is present.
  - In a read-only deck (deleted in another tab, 005), N, a Note drop, a palette click and in-card editing do nothing (spec edge case).
- [x] T022 [US1] Implement:
  - `apps/app/src/editor/stickies/sticky-actions.ts`: `addNoteAt` and `finishDraft`. A deck switch and unmount also end an open draft.
  - pane pointer tracking into `canvasPointer` in `apps/app/src/editor/canvas.tsx`
  - the note drop (a new MIME value) and sticky drag in `apps/app/src/editor/use-canvas-handlers.ts`: a gesture on drag start, `moveSticky` on change, and `sticky:` ids routed separately from nodes. Drops are refused during a flow session, like component drops.
  - N, ⌥C, nudge and Enter/F2 in `useCanvasKeyDown` in `apps/app/src/editor/use-canvas-shortcuts.ts`
  - the Note card in `apps/app/src/editor/palette.tsx`
  - Make T021 pass.

### Inspector, outline, delete, JSON

- [x] T023 [P] [US1] Write `apps/app/src/editor/inspector/sticky-inspector.test.tsx`. It must fail at first, following the UI contract "Sticky inspector":
  - header and subtitle
  - the TEXT · MARKDOWN Write/Preview ("Nothing to preview.")
  - ANCHOR Free ⇄ Pinned: choosing Pinned opens "Pinned to", and picking a component pins it without moving the note (the canvas point is unchanged in the store snapshot)
  - Free unpins
  - foreign anchor: read-only text and "Unpin"; missing anchor: "Pinned object is missing" and "Unpin"
  - DISPLAY toggles `collapsed`
  - the "Stay visible during flows" switch writes `showInFlows: true` and removes it when off
  - "Delete note" opens the confirmation
  - in a read-only deck, every field is disabled (spec edge case)
- [x] T024 [US1] Implement `apps/app/src/editor/inspector/sticky-inspector.tsx` (`InspectorFrame`, `MarkdownField`, `SegmentedControl`, `Combobox` in pick mode, `Switch`). Route a selection of exactly one sticky to it in `apps/app/src/editor/inspector.tsx`, and count notes in the "several selected" frame. Make T023 pass.
- [x] T025 [P] [US1] Write the tests for the Notes section in `apps/app/src/editor/outline.test.ts` and `apps/app/src/editor/outline-tree.test.tsx` (or a new `apps/app/src/editor/notes-outline.test.tsx`). They must fail at first:
  - `buildNotesOutline` uses labels in file order, with "Empty note" for a blank one
  - "Notes · n" heading, collapsible, hidden at 0
  - choosing a row selects and centres the note
- [x] T026 [US1] Implement `buildNotesOutline` in `apps/app/src/editor/outline.ts` and the Notes section in `apps/app/src/editor/left-sidebar.tsx`, reusing the outline row styles. Make T025 pass.
- [x] T027 [P] [US1] Write the tests for the delete text in `apps/app/src/editor/describe-removal.test.ts` and `apps/app/src/editor/confirm-delete-dialog.test.tsx`. They must fail at first:
  - "Delete this note?" / "Delete 3 notes?"
  - the toast "Note deleted · ⌘Z to undo" (Ctrl+Z off Apple), where Undo restores the same id
  - deleting a component with a pinned note: the dialog line "1 pinned note will stay on the canvas, unpinned." and the toast suffix " · 1 note unpinned"
  - Delete/Backspace with notes selected requests `{ scope: 'stickies' }` targets
- [x] T028 [US1] Implement the note text and freed-note text in `apps/app/src/editor/describe-removal.ts`, include selected stickies in `requestDelete`, and read `freed` in `apps/app/src/editor/confirm-delete-dialog.tsx`. Make T027 pass.
- [x] T029 [US1] Show a selected sticky in the JSON panel's Selection tab (`apps/app/src/editor/json-panel-view.ts`), with a case added to `apps/app/src/editor/json-panel-view.test.ts`.

**Checkpoint**: US1 works on its own (quickstart steps 1–6). Commit, then run `BENCH_STICKIES=100 pnpm bench` as an early check against SC-009.

---

## Phase 4: User Story 2: Find anything from the keyboard (P1)

**Goal**: ⌘K opens a palette that searches the open deck's components, connections, flows, steps, rules and notes, with snippets, and opens any result (spec US2, FR-019–FR-026, FR-029–FR-031).

**Independent test**: on the demo deck, search words that appear only in a title, a description, a step condition, a note and a rule cell. Each result appears with its kind and snippet and opens the right place; "reattempt" and "↓↓ Enter" behave as in the backlog; "No results" works (quickstart step 8).

### Model search

- [x] T030 [P] [US2] Write `packages/model/test/search.test.ts`. It must fail at first (contracts "Search", research R8):
  - `normalizeText`: accents, case, markdown markers, whitespace
  - matches in every field: node title and description, edge label and "<from> → <to>" fallback, flow description, step title, condition and notes, rule title, column name and input/output cell, sticky text
  - multi-word AND in any order
  - ordering: title before body, then node, edge, flow, step, rule, sticky, then title
  - the snippet window (about 80 characters, ellipses) with ranges in displayed text, and title ranges
  - `limit` and `total`; an empty query returns nothing; the query is trimmed to 200 characters
  - the backlog case: "reattempt" returns the rule "Reattempt policy" and the step whose condition mentions it
  - renaming a node updates the index
  - entry reuse: an unchanged snapshot object yields the same entry object
- [x] T031 [US2] Implement `packages/model/src/search/normalize.ts`, `packages/model/src/search/index.ts` (`buildSearchIndex`, WeakMap cache per snapshot object) and `packages/model/src/search/search.ts` (`searchDeck`), and export them from `packages/model/src/index.ts`. Make T030 pass.
- [x] T032 [US2] Extend `largeDeck` in `packages/model/test/helpers.ts` with node, rule and sticky counts (defaults unchanged, so existing perf tests keep their deck). Then add to `packages/model/test/perf.test.ts`: on a generated 2,000-node deck (edges, flows, rules and stickies in proportion), `searchDeck` takes < 50 ms (median of 5) and a cold `buildSearchIndex` < 100 ms (SC-001). Record the measured values in the test name or a comment. If `searchDeck` exceeds 25 ms, stop and raise it (research R8: move to a worker).

### UI kit

- [x] T033 [P] [US2] Write `packages/ui/test/command-dialog.test.tsx`. It must fail at first (research R9, UI contract "Command palette"):
  - `dialog` "Jump to"
  - the input is a `combobox` "Search the deck" with `aria-controls` and `aria-activedescendant`
  - `listbox` "Results" with `option` rows, where the first is highlighted
  - ↑/↓ with no wrap, Home/End, Enter calls `onSelect` with the highlighted item, Esc calls `onOpenChange(false)`
  - hover moves the highlight
  - highlight ranges rendered bold and underlined (`mark` or `strong` with an underline class, asserted via the accessible name)
  - the empty state slot, the footer hint, and the debounced `status` announcing "n results" / "No results"
- [x] T034 [US2] Implement `packages/ui/src/components/command-dialog.tsx` on Radix Dialog, reusing the keyboard logic of `combobox.tsx`, and export it from the `packages/ui` index. Add a demo to the design gallery (`apps/app/src/design-gallery/`). Update `packages/ui/CLAUDE.md`. Make T033 pass.

### App palette

- [x] T035 [P] [US2] Write `apps/app/src/editor/command-palette/palette-results.test.ts`. It must fail at first:
  - an empty query lists commands then flows (design 30)
  - a query merges matched commands (ranked first among title matches) with `searchDeck` results
  - rows are limited to 50, with "Showing 50 of n"
  - meta text per kind follows the UI contract ("Service · Core services", "Flow · 8 steps", "Step 4 · Place order", "Rule · First match", "Note", "Connection · A → B")
- [x] T036 [P] [US2] Write `apps/app/src/editor/command-palette/open-result.test.ts`. It must fail at first (research R11):
  - node: selected, focused, `fitView` called with its id
  - edge: selected and centred on its midpoint
  - note: `selection.stickies`, centred
  - flow: `openFlow(editor, flowId)` enters flow mode at step 1
  - step: `openFlow(editor, flowId, stepId)` enters flow mode at that step
  - a component, connection or note result while in flow mode calls `exitFlow()` first, then selects
  - rule: `openRules(ruleId)`
  - from the rules screen, canvas targets navigate to the canvas first
  - a vanished target announces "This item no longer exists" and returns false
- [x] T037 [US2] Implement `apps/app/src/editor/command-palette/palette-results.ts` and `apps/app/src/editor/command-palette/open-result.ts`. Make T035 and T036 pass.
- [x] T038 [P] [US2] Write `apps/app/src/editor/command-palette/command-palette.test.tsx`. It must fail at first:
  - ⌘K (Ctrl+K off Apple) opens with the input focused, even from a text field (the field's edit is committed first, no character typed); ⌘K again or Esc closes and returns focus
  - typing "reattempt" shows the rule and the step with snippets, and Enter opens the first
  - ↓↓ Enter opens the third result
  - "zzqx" shows "No results" and Enter does nothing
  - results refresh when the deck changes while open (FR-029)
  - the top-bar "Jump to… (⌘K)" button opens it
- [x] T039 [US2] Implement:
  - `apps/app/src/editor/command-palette/command-palette.tsx`: `CommandDialog`, `buildSearchIndex` memoized on the snapshot while open, the results and the open handling
  - mount it in `EditorChrome` in `apps/app/src/routes/editor-page.tsx`
  - handle ⌘K/Ctrl+K in `useEditorShortcuts` in `apps/app/src/editor/use-canvas-shortcuts.ts`: capture phase, `preventDefault`, blur a focused text field first, toggle `palette.open`
  - add the "Jump to…" button with the kbd hint (label from `features.isApplePlatform`) to `apps/app/src/editor/top-bar.tsx`, between the save status and the theme toggle
  - Make T038 pass.

**Checkpoint**: US1 and US2 work (quickstart steps 1–8).

---

## Phase 5: User Story 3: Run common commands from the palette (P2)

**Goal**: the palette runs Export deck…, Toggle dark mode, Open rule editor, Go to library and New deck, each exactly like its existing UI action. Focus mode is hidden until 010 exists (spec US3, FR-027, FR-028).

**Independent test**: with the palette open, run each listed command by name and compare its effect with its button (quickstart step 9).

- [x] T040 [P] [US3] Write `apps/app/src/editor/command-palette/commands.test.ts`. It must fail at first (research R10):
  - the list order and labels
  - Export deck… calls the export action
  - Toggle dark mode flips the _resolved_ theme (light ↔ dark, also from "system")
  - Open rule editor calls `openRules()`
  - Go to library navigates to `/`
  - New deck navigates to `/deck/new`
  - "Toggle focus mode" is absent while `focusModeAvailable` is false
  - aliases: "theme" and "dark" find Toggle dark mode, and "rules" finds Open rule editor
  - a command's shortcut is shown when it has one
- [x] T041 [US3] Implement `apps/app/src/editor/command-palette/commands.ts` (a command list built from `{ navigate, openRules, exportDeck, theme, focusModeAvailable }`) and wire it into `command-palette.tsx` and `palette-results.ts`. `focusModeAvailable` stays `false` until 010 wires it; leave a `TODO(M4): wire focus mode when 010 lands` comment. Make T040 pass, and add one end-to-end component case to `command-palette.test.tsx`: type "theme", press Enter, and the theme changes.

**Checkpoint**: US3 works.

---

## Phase 6: User Story 4: Notes during flow playback (P3)

**Goal**: in 007's flow mode, notes dim to 35% except those pinned to the current step's components or marked "Stay visible during flows"; notes are view-only; a Notes switch in the canvas toolbar; NOTES ON THIS STEP in the step inspector (spec US4, FR-009, FR-016–FR-018b).

**Independent test**: play a flow on a deck with three notes (free, pinned to a component of step 2, marked "Stay visible"). Step through and check each note's state, the Notes switch (dimmed, shown, hidden, remembered after reload), the step inspector's notes list, and that notes can't be moved or edited until flow mode ends (quickstart step 7).

- [ ] T042 [P] [US4] Write `apps/app/src/editor/stickies/sticky-flow.test.ts`. It must fail at first (research R15):
  - `stickyFlowState`: `normal` outside flow mode; `hidden` / `normal` for the hidden / shown display; `normal` for `showInFlows`; `normal` when pinned to the current step's from or to node (`NodeFlowMark.currentStep`); `dimmed` for a free note, a note pinned to another node, and foreign or missing anchors; `normal` for every note in an empty flow; `dimmed` (unless `showInFlows`) with a broken current step
  - `notesOnStep(deck, fromId, toId)`: notes pinned to either node, in file order; foreign and missing anchors are excluded
- [ ] T043 [US4] Implement `apps/app/src/editor/stickies/sticky-flow.ts` (`stickyFlowState`, `notesOnStep`). Make T042 pass.
- [ ] T044 [P] [US4] Write the flow-mode sticky cases in `apps/app/src/editor/deck-to-flow.test.ts`, `apps/app/src/editor/stickies/sticky-node.test.tsx`, `apps/app/src/flow-mode-css.test.ts` and `apps/app/src/state/ui-store.test.ts`. They must fail at first:
  - `toStickyNodes` with a playback overlay: dimmed notes get `sd-note-dimmed`, the others `in-flow sd-note-shown`, hidden notes `hidden: true`, and every sticky node is `draggable: false` in flow mode; the cache is reused when the state is unchanged
  - the card in flow mode: the accessible name ends with ", dimmed" when dimmed; there is no collapse button; double-click, Enter, F2 and ⌥C do nothing
  - `index.css`: a `[data-flow-mode] .react-flow__node.sd-note-dimmed` rule at opacity 0.35 with `transition: opacity var(--sd-dur-dim)`, full opacity on `:hover` / `:focus-within`, and a dashed border from a token
  - `notesDisplay` defaults to `dimmed`, persists under `sododeck.notes`, and works when localStorage throws
  - `addNoteAt` returns early in flow mode (N, drop, palette click)
- [ ] T045 [US4] Implement:
  - `notesDisplay` + `setNotesDisplay` in `apps/app/src/state/ui-store.ts` (the `LABELS_KEY` pattern)
  - pass the overlay and `notesDisplay` to `toStickyNodes` in `apps/app/src/editor/deck-to-flow.ts` and `apps/app/src/editor/canvas.tsx`
  - the view-only card in `apps/app/src/editor/stickies/sticky-node.tsx`
  - the early return in `apps/app/src/editor/stickies/sticky-actions.ts`
  - the CSS rule in `apps/app/src/index.css`
  - Make T044 pass.
- [ ] T046 [P] [US4] Write the tests for the Notes switch in `apps/app/src/editor/canvas-toolbar.test.tsx` and for NOTES ON THIS STEP in `apps/app/src/editor/flows/inspector-step.test.tsx`. They must fail at first (UI contract "Notes in flow mode"):
  - the button "Notes: dimmed" shows only in flow mode; its `menu` "Notes during flows" has `menuitemradio` Dimmed, Shown and Hidden, and choosing one updates the label and `notesDisplay`
  - the step inspector lists notes pinned to the current step's components as buttons "<label>, pinned to <component>"; activating one centres the note (`setCenter`) without leaving flow mode or changing the selection; the section is hidden when empty; the list follows step changes
- [ ] T047 [US4] Implement the Notes switch in `apps/app/src/editor/canvas-toolbar.tsx` (`DropdownMenu`, `StickyNote` icon) and the NOTES ON THIS STEP section in `apps/app/src/editor/flows/inspector-step.tsx` (`PanelSection`, `notesOnStep`). Make T046 pass. The "Stay visible during flows" switch itself is covered by T023.

**Checkpoint**: every story in the spec is complete.

---

## Phase 7: Polish and cross-cutting concerns

- [ ] T048 [P] Accessibility pass on every new surface: keyboard only (quickstart step 10), visible focus on notes and palette rows, a grayscale check (pinned vs free, collapsed, matched text), and every announcement from the UI contract. Fix gaps with tests.
- [ ] T049 [P] Update the docs:
  - `apps/app/CLAUDE.md`: the `editor/stickies/` and `editor/command-palette/` folders, `Selection.stickies`, the N, ⌥C and ⌘K keys
  - `packages/schema/CLAUDE.md`: the new sticky fields
  - check `packages/model/CLAUDE.md` (T013) and `packages/ui/CLAUDE.md` (T034)
  - the root README, only if commands changed
- [ ] T050 Add a "⌘K type → results painted" scenario to `apps/app/bench/perf.bench.ts` (2,000 nodes, median of 5, 50 ms target), run `BENCH_STICKIES=100 pnpm bench`, and write `specs/009-stickies-search/bench-after.md` with the before and after numbers. Pan and zoom must stay ≥ 60 fps at 500 nodes / 1,000 edges (SC-009), and palette open must be < 100 ms (SC-008). Also check that 007's flow scenarios ("select flow → marks painted", step changes) stay within their 100 ms targets with 100 notes on the canvas.
- [ ] T051 Visual check: take screenshots at 1440×900, light and dark, of frames 14, 30, 31, 32, 62 and 63, next to `docs/design/screens/`, and write `specs/009-stickies-search/visual-check.md`. List the differences for the PR. Allowed differences: no note title field (the first line is used), the command labels from research R10, DESIGN.md tokens, lucide icons.
- [ ] T052 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Confirm there are no skipped or `.only` tests, walk through quickstart.md steps 1–11, and export and re-import a deck with notes to check the round-trip (SC-005).

---

## Dependencies and execution order

- **T001** starts the branch. T002 and T003 can run in parallel with it.
- **Phase 2** blocks every story: T004 → T007; T005 → T006 → T008; T009 can run in parallel with the model tasks.
- **Stories**:
  - **US1** (T010–T029) needs Phase 2.
    - Model: T010 → T011; T012 → T013.
    - UI: T014 → T015.
    - Canvas: T016 → T017 → T018 → T019.
    - Keys: T021 → T022, which needs T011 and T019.
    - Then T023 → T024, T025 → T026, T027 → T028 (T028 needs T013), then T029.
  - **US2** (T030–T039) needs Phase 2 (sticky selection, for opening note results). It does not need US1, but note results are only visible on the canvas once T019 exists.
    - T030 → T031 → T032; T033 → T034; T035 and T036 → T037; T038 → T039, which needs T031, T034 and T037.
  - **US3** (T040–T041) needs US2's palette (T039).
  - **US4** (T042–T047) needs US1 (T017, T019, T022, T024). T042 → T043 → T044 → T045; T046 → T047, which needs T043.
- **Polish** (T048–T052) comes after all stories.

```text
T001 → Phase 2 ─┬─ US1 (MVP) → US4 ─────┐
                └─ US2 → US3 ────────────┴─ Polish
```

## Parallel examples

- **Phase 2**: T004, T005 and T009 together; then T006 and T007.
- **US1**: T010, T012, T014, T016, T018 and T020 (tests and bench) touch different files, so they can run together. Then T011, T013, T015 and T017. T023, T025 and T027 (tests) together once T019 is in.
- **US1 and US2** can go to separate agents after Phase 2. They share only `use-canvas-shortcuts.ts` (N/⌥C in `useCanvasKeyDown` vs ⌘K in `useEditorShortcuts`) and `ui-store.ts` (done in T009).
- **US2**: T030, T033, T035, T036 and T038 (tests) together.
- **US4**: T042, T044 and T046 (tests) together; US4 can run alongside US2 and US3 once US1 is in.

## Implementation strategy

1. **MVP**: T001–T029, which delivers sticky notes (US1, K-3). Demo it and check against frames 14 and 62.
2. **Search**: add US2 (K-4, C-3). Demo it against frames 30–32.
3. **Commands**: add US3.
4. **Flow mode**: add US4 (T042–T047). Demo it against frame 63.
5. Finish with Polish (T048–T052). The feature ships in one PR. The final report lists what changed, what was skipped, what is uncertain, and the bench numbers.
