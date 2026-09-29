# Tasks: Canvas Editing

**Input**: design documents in `specs/016-canvas-editing/`:

- [plan.md](plan.md) and [spec.md](spec.md). The spec was clarified on 2026-09-29: groups are frames with a stored position and size, a card released outside its frame leaves the group, and views have their own frames (§g-55).
- [research.md](research.md) (R1–R15) and [data-model.md](data-model.md).
- [contracts/canvas-editing-ui.md](contracts/canvas-editing-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module, store and model op.
- Round-trip cases for every model change.
- Component tests (Testing Library) by role and name, as in the [contract](contracts/canvas-editing-ui.md).

Write each test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Schema change is additive and optional only**: `Size`, `Frame`, `Group.position` / `Group.size`, `View.groupFrames`. No version bump (ADR 0002). Regenerate with `pnpm schema:generate`, and keep Ajv/Zod parity green.
- **Every document write goes through `DeckEditor`** and is exactly one undo step per gesture, paste, duplicate, group, align or nudge burst. Fitting and materializing frames are **untracked**.
- **Membership never follows geometry**. Only these change `node.group` / `group.parent`: drop, paste, `groupSelection`, ungroup, and the existing group field (FR-046).
- **UI-only state** (guides, drop target, readout, marquee count, paste serial) lives in the UI store or handler refs, never in the document.
- **Out of scope**:
  - Card resize and routing (017), and colours (020).
  - A grid.
  - Plain-drag selection (§g-36).
  - Copying flows, stickies or views.
- **Editing is off** in flow mode, during recording and in the view-only editor. Copy stays available (FR-035).

**Approvals**: no new runtime dependency. `NodeResizer`, `SelectionMode` and `ViewportPortal` ship in `@xyflow/react`. The schema change was approved by the founder (§g-55).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, and no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. Read `packages/schema/CLAUDE.md` first:
  - Property order is the file key order.
  - Every property needs a `description`.
  - No `default` / `format`.
  - The `full.sododeck.json` coverage test.
- **Model**: `packages/model/src/…`, with tests in `packages/model/test/`. Read `packages/model/CLAUDE.md`. `DeckEditor` ops go through `EditContext` (`transact`, `transactUntracked`).
- **UI**: `packages/ui/src/…`. Tokens only, `data-slot`, and a gallery entry per new component.
- **App**: `apps/app/src/…`, with tests next to the code.
  - New gesture code goes in `apps/app/src/editor/editing/`, and action modules in `apps/app/src/editor/actions/`.
  - Read `apps/app/CLAUDE.md` and `.agents/skills/react-flow/SKILL.md`.
- **Shortcuts**:
  - "⌘" is `isMod`. Match ⌥ keys by `event.code`.
  - Ignore keys in text targets (`isTextTarget`).
  - Labels come from `editor/shell/shortcuts.ts`.
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `feat(ui): …`, `test(…): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `016-canvas-editing` from the latest `main`, after the docs PR is merged. Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 Run `pnpm bench` and `BENCH_GROUPS=1 pnpm bench` on the unchanged code. Save both tables in `specs/016-canvas-editing/bench-before.md`.
- [x] T003 Add two scenarios to `apps/app/bench/perf.bench.ts` (R15, FR-038):
  - `drag-100-selected`: select 100 nodes near the centre and drag them for 2 s.
  - `group-drag` (only with `BENCH_GROUPS`): drag a group label for 2 s.
  - Both record fps like the existing `drag` scenario.
  - Until group dragging exists (T041), `group-drag` logs `TODO(016): not available yet` and records no number.
- [x] T004 [P] Write ADR `docs/decisions/0017-group-frames-and-clipboard.md` in the header format of 0016. It records:
  - Groups as frames (R1). This supersedes the "no geometry stored" part of ADR 0004 / 0006.
  - Fitting frames untracked on open (R2).
  - The `groupBounds` choke point (R3).
  - Per-view frames through `materialize` (R4).
  - The explicit membership rule (R6).
  - The clipboard envelope and copy / paste events (R9).
  - `cancelGesture` (R14).
  - The alternatives from research.

---

## Phase 2: Foundational — group frames (blocks every story)

**Purpose**: frames exist in the file, the model, rendering and layout. After this phase the canvas looks the same as before, but frames are stored.

### Schema

- [x] T005 Write failing cases in `packages/schema/test/fixtures.ts` for:
  - a group with `position` but no `size` (S-frame-pair);
  - a `size` with `width: 0`;
  - a `view.groupFrames` key that is not a group id (S-group-frames-keys);
  - a `groupFrames` value missing `size`.

  Extend `packages/schema/examples/full.sododeck.json` with a group `position` / `size` and one `view.groupFrames` entry, which the coverage test needs.

- [x] T006 Edit `packages/schema/schema/v1.json` (R1, data-model):
  - Add `$defs/Size` and `$defs/Frame`.
  - Add `Group.position` and `Group.size` after `parent`, and rewrite the Group description.
  - Add `View.groupFrames` after `positions`.

  Add rules S-frame-pair and S-group-frames-keys to `packages/schema/src/semantic-rules.ts`. Run `pnpm schema:generate`, then `pnpm --filter @sododeck/schema test`, and confirm T005 is green and parity holds.

### Model

- [x] T007 [P] Write a failing round-trip test in `packages/model/test/round-trip.test.ts`. Cover a group with a frame, a group without a frame, and a view with `groupFrames`. Also check that key order is `…parent, position, size` and that the text is identical after `serializeDeck`.
- [x] T008 [P] Write failing tests in `packages/model/test/frames.test.ts` for `fitGroupFrames` (R2):
  - nested groups inner-first;
  - empty groups and parent cycles skipped;
  - the padding and card size come from the arguments;
  - a view variant uses `view.positions`;
  - only groups missing a frame are returned;
  - 2,000 nodes in under 50 ms.
- [x] T009 Implement `fitGroupFrames` and a `frameOf(group)` helper in `packages/model/src/geometry.ts`, and export them from `packages/model/src/index.ts`.
- [x] T010 Write failing tests in `packages/model/test/frames.test.ts`:
  - `editor.fillGroupFrames` writes only missing frames and adds **no** undo step.
  - `editor.setGroupFrames(baseViewId, …)` writes `group.position` / `group.size` as one undo step.
  - `setGroupFrames(otherViewId, …)` materializes the view, writes `view.groupFrames`, and leaves the base frame unchanged.
  - `materialize` copies the base frames into the view.
- [x] T011 Implement `packages/model/src/ops/frames.ts` (`fillGroupFrames` with `transactUntracked`; `setGroupFrames` with undo key `views:<id>:groupFrames`). Extend `materialize` in `packages/model/src/ops/views.ts` to copy frames, and wire both ops into `packages/model/src/editor.ts`.
- [x] T012 [P] Write a failing test in `packages/model/test/cascade.test.ts` that removing a group deletes `view.groupFrames[id]` in every view in the same step. Implement it in `packages/model/src/ops/cascade.ts`.
- [x] T013 [P] Write a failing test in `packages/model/test/cancel-gesture.test.ts`: after `beginGesture()`, moves, then `cancelGesture()`, the document is restored and both the undo and redo stacks are the same as before the gesture (R14). Implement `cancelGesture` in `packages/model/src/editor.ts`.

### App rendering and layout

- [x] T014 Write a failing test in `apps/app/src/editor/canvas-geometry.test.ts`:
  - `groupBounds` returns the stored frame when a group has `position` and `size`.
  - Otherwise it falls back to the derived box.
  - The cache is invalidated when `deck.groups` changes.

  Implement it in `apps/app/src/editor/canvas-geometry.ts` (R3).

- [x] T015 Write a failing test in `apps/app/src/editor/views/view-state.test.ts` that `viewDeck` projects `view.groupFrames[id]` onto the group for a non-base view and leaves the base view's frames alone. Implement it in `apps/app/src/editor/views/view-state.ts`.
- [x] T016 Add `fitMissingFrames(editor, deck)` in `apps/app/src/editor/open-deck.ts`, and call it once after the editor is created for an opened deck, in `apps/app/src/routes/editor-page.tsx` (near the `openDeck(source)` call). It calls `editor.fillGroupFrames(...)`. Pass the base frames and the frames for each view with its own positions, from `fitGroupFrames` with `COMPONENT_CARD_SIZE` and `GROUP_PADDING`. Add a test in `apps/app/src/editor/open-deck.test.ts` (new): an old deck gets frames, ⌘Z does nothing, and the rendered group boxes at component level equal the old derived boxes (SC-003b).
- [x] T017 [P] Write a failing test in `apps/app/src/editor/tidy-layout.test.ts` that Tidy writes each laid-out group's ELK box as its frame in the same step as the positions (FR-045). Implement it in `apps/app/src/editor/tidy-layout.ts`.
- [x] T018 [P] Update `apps/app/src/editor/export/scene.test.ts` so that an export of a deck with a frame larger than its members uses the stored frame.
- [x] T019 [P] Extend `apps/app/src/state/ui-store.ts` (+ test) with the fields from data-model:
  - `canvasGesture` gains `'group-drag' | 'resize' | 'marquee'`.
  - `dropTarget`, `guides`, `dragReadout`, `marqueeCount`, `pasteSerial`.
  - `resetForDeck` and pruning clear them.
- [x] T020 [P] Add an "Editing" section to `apps/app/src/editor/shell/shortcuts.ts` (+ test) with every id in the contract. Change `group` from G to ⌘G.
- [x] T021 [P] Add `supportsClipboardRead()` (`navigator.clipboard.readText`) to `apps/app/src/lib/features.ts` (+ test).
- [x] T022 [P] Create `HintBar` in `packages/ui/src/components/hint-bar.tsx` (+ test, gallery entry): an inverse pill, 30 px tall, bottom centre, with key caps in Mono, as in the DESIGN.md hint bar. Its props are `items: { keys: string; label: string }[]`.
- [x] T023 Commit, then run `pnpm lint && pnpm typecheck && pnpm test`. The canvas must be visually unchanged: compare the demo deck against the screenshots from 018 / 019.

**Checkpoint**: frames are stored, rendered, exported and laid out. Stories can start.

---

## Phase 3: User Story 1 — Copy, paste and duplicate (P1) 🎯 MVP

**Goal**: ⌘C / ⌘X / ⌘V / ⌘D and ⌥-drag, within one deck and across tabs, each as one undo step.

**Independent test**: quickstart scenarios 1–3.

- [ ] T024 [P] [US1] Write failing tests in `packages/model/test/fragment.test.ts`:
  - `toFragment` includes the selected nodes, the edges with both ends selected, and only groups whose whole subtree is selected, with frames.
  - `serializeFragment` / `parseFragment` round-trip.
  - `parseFragment` returns `null` for plain text, JSON that is not an envelope, an invalid deck, and duplicate ids.
- [ ] T025 [US1] Implement `packages/model/src/fragment.ts` (R9) and export it.
- [ ] T026 [P] [US1] Write failing tests in `packages/model/test/paste.test.ts` for `pasteFragment`:
  - new ids, and no collisions with existing ids;
  - edges remapped;
  - nodes' `group` and groups' `parent` remapped inside the set, and outside parents set to `options.parent`;
  - rule ids missing from the deck dropped;
  - positions and frames offset;
  - in a non-base view, view positions and frames written as well;
  - one undo step;
  - the new ids returned.
- [ ] T027 [US1] Implement `packages/model/src/ops/paste.ts` and wire `editor.pasteFragment` in `packages/model/src/editor.ts`.
- [ ] T028 [P] [US1] Write failing tests in `apps/app/src/editor/editing/paste-placement.test.ts` for FR-004: at the pointer; otherwise +24 px when that is on screen; otherwise the view centre; +24 for each repeat at the same point. Implement `paste-placement.ts`.
- [ ] T029 [US1] Write failing tests for `apps/app/src/editor/actions/clipboard-actions.ts`, in `actions-run.test.ts` and `actions-for.test.ts`:
  - `clipboard.copy`, `clipboard.cut`, `clipboard.paste` and `clipboard.duplicate` are offered per the contract table.
  - Copy stays enabled in flow and view-only modes, and the others do not.
  - Paste is disabled with "Nothing to paste: copy components first", or "Press ⌘V to paste" without `supportsClipboardRead`.
  - Duplicate pastes at +24 and leaves the clipboard alone.
  - Cut runs the existing delete path.
  - The announcements match the contract.
- [ ] T030 [US1] Implement `clipboard-actions.ts`:
  - Duplicate uses `toFragment` → `pasteFragment`.
  - Paste in the menu uses `readText`.
  - The paste target parent is the innermost frame under the paste point, else the drill scope (FR-008), via `dropTarget` from T047. Until then, use a local call to the same pure function.
  - Write the timestamp hint `sododeck:fragment-copied` on copy.
  - Register the module in `apps/app/src/editor/actions/index.ts`.
- [ ] T031 [US1] Write failing tests in `apps/app/src/editor/editing/use-clipboard-events.test.tsx`:
  - The document `copy` / `cut` / `paste` events on the canvas write and read `text/plain` envelopes.
  - Nothing happens in text fields or with a non-fragment paste.
  - Selecting pasted objects.
  - A clipboard failure shows the "Could not use the clipboard" toast.

  Implement it, and mount it in `apps/app/src/editor/canvas.tsx`.

- [ ] T032 [US1] Add ⌘D to `useEditorShortcuts` in `apps/app/src/editor/use-canvas-shortcuts.ts` (+ test), calling `clipboard.duplicate`. It must `preventDefault` the browser bookmark.
- [ ] T033 [US1] Implement ⌥-drag duplicate in `apps/app/src/editor/use-canvas-handlers.ts` (FR-009), with a test in `canvas.test.tsx`. When ⌥ is held on drag stop:
  1. Restore the originals to their start positions.
  2. Paste a fragment of them at the dropped offset.
  3. Do both inside the same gesture, so there is one undo step.
- [ ] T034 [US1] Add Copy, Cut and Duplicate to the component, components and group menus, and Paste to the canvas menu (contract). Check this in `apps/app/src/editor/quick-edit/canvas-menu.test.tsx`.

**Checkpoint**: US1 is fully usable and testable on its own.

---

## Phase 4: User Story 2 — Group the selection and move / resize a group (P1)

**Goal**: ⌘G creates a fitted frame. Frames are dragged by the label or edge, and resized with handles or the drawer, each as one step. Esc cancels, ⌥ duplicates, ⇧ locks the axis, and a group dropped into another frame nests.

**Independent test**: quickstart scenarios 4, 5, 8 and 9.

- [ ] T035 [P] [US2] Write failing tests in `packages/model/test/group-selection.test.ts`:
  - The group is added with its title, parent and frames (base and per-view).
  - The members' `group` and the selected groups' `parent` are repointed.
  - It is one undo step.
  - The new id is returned.
- [ ] T036 [US2] Implement `packages/model/src/ops/group-selection.ts` and wire `editor.groupSelection`.
- [ ] T037 [P] [US2] Write failing tests in `apps/app/src/editor/editing/common-parent.test.ts` for the innermost common ancestor, the top level, and mixed groups. Implement `common-parent.ts`.
- [ ] T038 [US2] Write failing tests for `group.create` in `apps/app/src/editor/actions/group-actions.ts`:
  - ⌘G with 4 components creates "New group" with a fitted frame (members' box plus `GROUP_PADDING`) and starts `titleEdit` on it.
  - Two ⌘Z undo the rename, then the group.
  - It is disabled with "Select two or more components" for fewer than 2.
  - It is hidden in flow or view-only mode.
  - The announcement is "Grouped 4 components".

  Implement it. Enable the rail Group button in `apps/app/src/editor/shell/rail.tsx`, and add Group to the components toolbar and menus.

- [ ] T039 [P] [US2] Write failing tests in `apps/app/src/editor/editing/subtree.test.ts`: a group's members and nested groups are collected recursively, cycles are safe, and the result includes hidden members. Implement `subtree.ts`.
- [ ] T040 [P] [US2] Write failing tests in `apps/app/src/editor/editing/resize-limits.test.ts`:
  - The minimum frame is the members' and nested frames' box plus padding, and at least 160 × 96.
  - ⇧ keeps the aspect ratio.
  - ⌥ resizes from the centre, computed from `direction`.

  Implement `resize-limits.ts`.

- [ ] T041 [US2] Make group boundary nodes selectable and draggable with `dragHandle: '.sd-group-handle'` in `apps/app/src/editor/deck-to-flow.ts` (+ test). In `apps/app/src/editor/group-boundary-node.tsx` (+ test):
  - Add the handle class to the label and an 8 px edge band. Empty space inside keeps `pointer-events: none` (FR-017).
  - Show `NodeResizer` with 8 controls while the group is selected and editing is allowed.
- [ ] T042 [US2] Implement group drag in `apps/app/src/editor/use-canvas-handlers.ts` together with a new `apps/app/src/editor/editing/use-drag-editing.ts`:
  - On start, record the subtree's start positions and frames and set `canvasGesture: 'group-drag'`.
  - On each change, one `editor.batch` applies `moveInView` to the members and `setGroupFrames` to the frames by the delta, and sets `dragReadout`.
  - ⇧ locks the axis.
  - Esc runs `cancelGesture`.
  - ⌥ on release duplicates the subtree instead of moving it.

  Add tests in `canvas.test.tsx`: a drag by (100, 40) moves everything, one ⌘Z moves it back, Esc leaves no history, and ⌥ duplicates.

- [ ] T043 [US2] Implement resize in the same hook: `onResize` clamps with `resize-limits`, and on end one `setGroupFrames` runs inside a gesture. Test that no card moves, membership is unchanged, it is one step, and Esc cancels.
- [ ] T044 [US2] Implement nesting on group drop (FR-016): a group released inside another frame nests there, never in itself or a descendant, and shows `showUndoToast` "Moved Payments into Checkout". A nested group released outside its parent's frame leaves the parent. This depends on `dropTarget` (T047), so T044 lands after T047.
- [ ] T045 [US2] Add a "Frame" section with X, Y, Width and Height `spinbutton`s to `apps/app/src/editor/inspector/group-inspector.tsx` (+ test). Each commit is one `setGroupFrames` step with the resize limits applied (FR-044).
- [ ] T046 [US2] Render the dashed ghost of the start frame and the offset readout during a group drag in `apps/app/src/editor/editing/guides-overlay.tsx` (created here, extended in US3), with a test.

**Checkpoint**: groups are real frames and can be created, moved, resized, nested and edited by keyboard.

---

## Phase 5: User Story 4 — Drop into / out of a group (P2)

This is ordered before US3 because T044 depends on it.

**Goal**: the pointer decides membership on drop, and ⌥ keeps it. Frames never grow.

**Independent test**: quickstart scenario 6.

- [ ] T047 [P] [US4] Write failing tests in `apps/app/src/editor/editing/drop-target.test.ts`:
  - The innermost frame containing the pointer wins: the deepest first, then the smaller area.
  - Dragged groups and their descendants are excluded.
  - The result is `null` outside every frame.

  Implement `drop-target.ts`.

- [ ] T048 [P] [US4] Write failing tests in `apps/app/src/editor/editing/membership-changes.test.ts`, covering each dragged top-level item:
  - It gets the new parent: the target, else the drill scope, else none.
  - There is no change when the target equals the current group.
  - There is no change with ⌥.
  - Members of a dragged group are untouched.

  Implement `membership-changes.ts`.

- [ ] T049 [US4] Wire `onNodeDrag` in `use-drag-editing.ts` so it sets `ui.dropTarget`, null while ⌥ is held. On drag stop, write the membership changes inside the open gesture, with the announcements "Moved X into Y" / "Moved X out of Y". Add tests in `canvas.test.tsx`:
  - In, out and ⌥ each work.
  - A collapsed-group drop updates the count.
  - No frame size changes.
  - Each is one undo step.
- [ ] T050 [US4] Render the drop-target highlight (110) in `group-boundary-node.tsx` (+ test) when `ui.dropTarget` is this group: a 1.5 px dashed Deck Orange border, a 7 % fill, and a "Drop into <title>" chip. Render the dashed landing slot in `guides-overlay.tsx`. Use tokens only, and the dashed pattern is the non-colour cue.

**Checkpoint**: membership can be edited by drag and drop.

---

## Phase 6: User Story 3 — Line things up (P1)

**Goal**: align and distribute actions, plus snapping guides with distance and equal-gap labels. ⌘ disables snapping.

**Independent test**: quickstart scenario 7 (align and snap).

- [ ] T051 [P] [US3] Write failing tests in `apps/app/src/editor/editing/align.test.ts`:
  - The six alignments and two distributions over displayed rects.
  - The outermost cards stay put when distributing.
  - Gaps are equal within 1 px (SC-004).

  Implement `align.ts`.

- [ ] T052 [US3] Write failing tests for `apps/app/src/editor/actions/align-actions.ts`:
  - The Align ▸ submenu order is as in the contract.
  - It is disabled for fewer than 2 (distribute: fewer than 3) with the tooltip.
  - It is one undo step.
  - The announcements match the contract.
  - It appears in the multi toolbar as "Align".

  Implement it and register it.

- [ ] T053 [US3] Add ⌥A / ⌥D / ⌥W / ⌥S, matched by `event.code`, to `useCanvasKeyDown` in `apps/app/src/editor/use-canvas-shortcuts.ts` (+ test), before the `altKey` return.
- [ ] T054 [P] [US3] Write failing tests in `apps/app/src/editor/editing/snap.test.ts`:
  - Edges and centres snap within `6 / zoom`.
  - The nearest line wins per axis, and the axes are independent.
  - Nothing snaps outside the threshold.
  - The guide spans the aligned cards.

  Implement `snap.ts`.

- [ ] T055 [P] [US3] Write failing tests in `apps/app/src/editor/editing/gaps.test.ts`: the distance to the nearest neighbour on the axis, and equal-gap detection in the same row or column. Implement `gaps.ts`.
- [ ] T056 [US3] Wire snapping into `use-drag-editing.ts`:
  - At drag start, collect candidates from the on-screen, non-dragged components.
  - In `onNodesChange`, add the snap offset to every dragged change and set `ui.guides`.
  - ⌘ / Ctrl held skips snapping. ⇧ locks the axis for component drags too.
  - Apply the same logic to group drags.

  Test it in `canvas.test.tsx`.

- [ ] T057 [US3] Render the guides and labels in `guides-overlay.tsx` (+ test), using a `ViewportPortal`, a 1 px Deck Orange hairline, Mono 10.5 pill labels, and dashed gap ticks. They are `aria-hidden`.
- [ ] T058 [US3] Run `pnpm bench` for `drag` and `drag-100-selected`. If fps drops below 60, reduce the candidates (only the viewport, and the nearest 200) and record the change in research R7.

**Checkpoint**: diagrams can be lined up precisely.

---

## Phase 7: User Story 5 — Nudge and keyboard (P2)

**Goal**: ⌥(⇧) arrow nudges in one-step bursts, arrows during a drag, and every action from the keyboard.

**Independent test**: quickstart scenario 7 (nudge), plus a keyboard-only pass of stories 1–3.

- [ ] T059 [US5] Write failing tests in `apps/app/src/editor/editing/use-nudge.test.tsx`:
  - ⌥→ moves 1 px and ⌥⇧→ 10 px.
  - Three presses within 1 s undo in one step.
  - A press after a 1 s pause is a new step.
  - Any other key or a pointer down closes the burst.
  - Selected groups move their subtree.
  - Plain arrows still move focus.
  - The burst-end announcement is "Moved 2 components 30 px right".

  Implement `use-nudge.ts` and call it from `useCanvasKeyDown` before the `altKey` return.

- [ ] T060 [US5] Implement arrows during a pointer drag (§g-45): add 1 / 10 px to the drag offset ref in `use-drag-editing.ts`, with a test.
- [ ] T061 [US5] Confirm the keyboard-shortcut help lists every new shortcut, and add a test for `apps/app/src/editor/shell/shortcut-help-dialog.tsx` (new `shortcut-help-dialog.test.tsx`). Check that no new shortcut fires in a text field (one test per group of keys).

---

## Phase 8: User Story 6 — Marquee and hints (P3)

**Goal**: a marquee count chip, ⌥ to include touched cards, Esc to restore the selection, and a hint bar with an announcement for every gesture.

**Independent test**: quickstart scenario 10.

- [ ] T062 [US6] In `apps/app/src/editor/canvas.tsx` and `use-canvas-handlers.ts`, set `selectionMode` to `SelectionMode.Partial` while ⌥ is held during a marquee (otherwise `Full`). Save the selection at `onSelectionStart`, restore it on Esc, and set `canvasGesture: 'marquee'` and `marqueeCount`. Test these in `canvas.test.tsx`.
- [ ] T063 [P] [US6] Create `apps/app/src/editor/editing/marquee-chip.tsx` (+ test): an inverse 22 px chip with the count that follows the pointer.
- [ ] T064 [US6] Create `apps/app/src/editor/editing/gesture-hint.tsx` (+ test). It shows `HintBar` with the contract text for each `canvasGesture` value and announces it once per gesture through the live region. Mount it in `apps/app/src/editor/shell/canvas-shell.tsx`. It is hidden in Hide UI.

---

## Phase 9: Polish and cross-cutting

- [ ] T065 [P] Update `packages/schema/CLAUDE.md` (the frame fields), `packages/model/CLAUDE.md` (the new ops, fragment, `cancelGesture`, fitting), `apps/app/CLAUDE.md` (`editor/editing/`, the new actions) and `packages/ui/CLAUDE.md` (`HintBar`).
- [ ] T066 [P] Update `docs/backlog.md`:
  - Mark 016 as implemented, with links.
  - Note in 017 that `Size` and the resize wrapper exist.
  - Note in 020 that `group.style` sits next to the frame.
- [ ] T067 Accessibility pass. Check that every new action works with the keyboard only. Check contrast of the guides, labels, drop chip and hint bar against Canvas in both themes; if a new pair is introduced, add it to `packages/ui/test/contrast.test.ts`. Check that reduced motion shows no animations.
- [ ] T068 Visual check against screens 92 (Align part), 99, 102–104 (016 items) and 108–111, in light and dark. Take screenshots into `specs/016-canvas-editing/screens/` and list the differences in `specs/016-canvas-editing/visual-check.md` (SC-009).
- [ ] T069 Run `pnpm bench` and `BENCH_GROUPS=1 pnpm bench` after the change. Save the results in `specs/016-canvas-editing/bench-after.md` next to `bench-before.md`, and confirm ≥ 60 fps for `drag-100-selected` (FR-038, SC-006).
- [ ] T070 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and fix anything red. The smoke suite (including the no-third-party-requests check) must pass unchanged.
- [ ] T071 Run the quickstart scenarios 1–11 by hand and record the results in the PR description.

---

## Dependencies and execution order

- **Setup (T001–T004)** comes first. T004 can run in parallel.
- **Foundational (T005–T023)** blocks every story:
  - Schema: T005 → T006.
  - Model: T007–T013, after T006.
  - App: T014–T018, after T011.
  - T019–T022 can run in parallel at any time.
- **US1 (T024–T034)** depends only on Foundational. It is the MVP.
- **US2 (T035–T046)** depends on Foundational. T044 needs T047 (US4).
- **US4 (T047–T050)** depends on Foundational plus T042 (drag hook). T047 and T048 are pure and can start early.
- **US3 (T051–T058)** depends on Foundational. T056 extends `use-drag-editing.ts` from T042.
- **US5 (T059–T061)** depends on T042 (subtree move) for groups. Components-only nudge can start after Foundational.
- **US6 (T062–T064)** depends on T022 (`HintBar`) and T019.
- **Polish (T065–T071)** comes last.

Story order is US1 → US2 → US4 → US3 → US5 → US6. US1 and the pure halves of US3 and US4 can run in parallel with US2.

## Parallel examples

- **Foundational**: T007, T008, T012, T013 (model tests in separate files) together with T019, T020, T021, T022.
- **US1**: T024, T026, T028 (fragment, paste and placement tests).
- **US2**: T035, T037, T039, T040 (pure and model tests).
- **US3**: T051, T054, T055 (align, snap and gaps).
- **US4**: T047, T048.

## Implementation strategy

1. **MVP**: Setup, then Foundational, then US1. The result is copy / paste / duplicate across tabs, on top of stored frames (visually unchanged). This is a shippable PR if the scope has to be split.
2. **Increment 2**: US2 + US4. Groups become frames that can be created, dragged, resized and dropped into or out of.
3. **Increment 3**: US3 + US5. Align, snapping and nudge.
4. **Increment 4**: US6 and Polish.

Each increment ends with a green `pnpm lint && pnpm typecheck && pnpm test`, and the last one with the full definition-of-done set and the bench numbers.
