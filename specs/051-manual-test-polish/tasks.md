# Tasks: Manual-test polish

**Input**: design documents in `specs/051-manual-test-polish/`:

- [plan.md](plan.md) and [spec.md](spec.md), which records 7 default decisions under Clarifications.
- [research.md](research.md) (R1–R9) and [data-model.md](data-model.md).
- [contracts/ui-behaviour.md](contracts/ui-behaviour.md) (C1–C8).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Vitest for pure modules and stores.
- Testing Library for components, by role, label and text.
- **Bug fixes start with a failing test.** Write each test first and watch it fail.
- No new Playwright tests. The smoke suite (`apps/app/tests/e2e/smoke.spec.ts`) must keep passing.

**Scope guards**:

- **No schema, Yjs or file-format change.** `.sododeck.json` output stays byte-identical, and pack file order (`PACK_LIST` / `sortPacks`) is untouched.
- **Autosave writes are unchanged** (`flushMs = 100` in `storage/deck-persistence.ts`). Only the indicator changes.
- **Duplicate-drag stays one gesture**: one undo step on drop, and Esc or blur leaves the document unchanged.
- **Out of scope**: sticky duplicate-drag, an automatic `storage.persist()` request, a new hover preference, new e2e tests.
- Do not name other diagram tools anywhere: docs, code, comments, UI copy.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US8 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to the code (`*.test.ts(x)`). Read `apps/app/CLAUDE.md` first, and use the `react-flow` skill for every canvas change (`canvas.tsx`, `deck-to-flow.ts`, `editing/`, `hover-focus/`, `use-canvas-*.ts`, `index.css` canvas rules).
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`. Read `packages/model/CLAUDE.md` first.
- **UI**: `packages/ui/src/…`, tests in `packages/ui/test/`. Read `packages/ui/CLAUDE.md` first.
- **Commits**: small Conventional Commits (`fix(app): …`, `feat(model): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `051-manual-test-polish` from the latest `main`, carrying over only `specs/051-manual-test-polish/` (leave the untracked `specs/042-db-relationships/` and `apps/app/src/samples/` on their own branch). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start.
- [x] T002 Take the bench baseline on unchanged code with `pnpm bench`, and save the summary table in `specs/051-manual-test-polish/bench-before.md`.

---

## Phase 2: Foundational

**Purpose**: the one shared helper. US1 depends on it; no other story does.

- [x] T003 [P] Write failing tests in `apps/app/src/editor/focus-target.test.ts` for `focusTargetId(selection, collapsed)`. Cases:
  - one node → its id;
  - one expanded group → `group:<id>`;
  - one collapsed group → `collapsed:<id>`;
  - nothing selected, two nodes, or a node plus a group → `null`.

  Use `GROUP_NODE_PREFIX` / `COLLAPSED_NODE_PREFIX` from their current module.

- [x] T004 Implement `apps/app/src/editor/focus-target.ts` (pure, named export). Replace the inline `focusId` logic in `apps/app/src/editor/canvas.tsx:416-428` with `focusMode ? focusTargetId(selection, collapsed) : null`. Existing `canvas.test.tsx` focus-mode tests must stay green.

**Checkpoint**: no visible change yet.

---

## Phase 3: User Story 1 - Edit without the canvas dimming (Priority: P1) 🎯 MVP

**Goal**: hover and selection never dim the canvas outside Focus mode. Inside it, hover drives the highlight when nothing is pinned, and a single selection pins it (R1, contract C1).

**Independent Test**: with Focus mode off, hover and select cards: nothing dims. Press F with nothing selected and hover: neighbours light up. Select a card: the focus pins. Press F: back to rest.

### Tests for User Story 1 (write first, watch them fail)

- [x] T005 [P] [US1] In `apps/app/src/editor/hover-focus/use-hover-focus.test.ts`:
  - flip the suspension table at ~:140 so that `{ focusMode: false }` suspends and `{ focusMode: true }` with an empty selection does not;
  - add a case where `focusMode: true` with one selected node suspends (pinned);
  - update the tests that expect hover to light with Focus mode off.
- [x] T006 [P] [US1] In `apps/app/src/editor/canvas.test.tsx`, "hover focus (034)" describe (~:112-200), cover C1:
  - Focus mode off → no `data-hover-focus` after a 200 ms rest, and no dimmed node after selecting a card;
  - Focus mode on with nothing selected → `data-hover-focus` set after the rest;
  - one card selected → hover does not set it;
  - emptying the selection keeps Focus mode on (replaces the old auto-exit expectation near :630-675).
- [x] T007 [P] [US1] In `apps/app/src/editor/use-canvas-shortcuts.test.tsx` (~:286-294, :866):
  - pressing F with nothing selected turns `focusMode` on and does not announce "Select a component to focus";
  - F with one node selected still calls `ui.focus(id)` and turns it on;
  - F while on turns it off;
  - F during a flow session is still refused.

### Implementation for User Story 1

- [x] T008 [US1] In `apps/app/src/editor/hover-focus/use-hover-focus.ts` `suspendedBy()` (:21-33), replace the `s.focusMode` condition with `!s.focusMode || focusTargetId(s.selection, <collapsed set>) !== null`. Read the collapsed set from the store the same way `canvas.tsx` does. Keep every other suspension (flows, gestures, hand tool, popovers, connecting).
- [x] T009 [US1] In `apps/app/src/editor/use-canvas-shortcuts.ts` (:498-517), F turns Focus mode on with any selection:
  - with exactly one node or group, focus it as today;
  - otherwise call `ui.setFocusMode(true)` without the announcement.

  Keep the flow refusal and the toggle-off branch, and announce "Focus mode on" / "Focus mode off".

- [x] T010 [US1] In `apps/app/src/editor/canvas.tsx`, remove the effect that turns Focus mode off when the selection empties (:577-587).
- [x] T011 [US1] In `apps/app/src/editor/shell/tools-island.tsx` (:68-110), make sure the Focus toggle is enabled without a selection: it is disabled only while a flow is shown. Its pressed state (`aria-pressed`) must reflect `focusMode`. Add or adjust the case in its test file, if one exists next to it.
- [x] T012 [US1] Update the bench hover scenario so it turns Focus mode on (with no selection) before hovering: `apps/app/src/routes/bench-page.tsx` (:257-340) and `apps/app/bench/perf.bench.ts` (:778-816).

**Checkpoint**: US1 works on its own. T005–T007 are green.

---

## Phase 4: User Story 2 - See the copy appear while duplicate-dragging (Priority: P1)

**Goal**: during an ⌥/Alt drag the originals stay at their start and the copies follow the pointer. ⌥ toggles mid-drag. Drop gives one undo step; Esc or blur leaves nothing (R2, contract C2, data-model "Duplicate-drag session").

**Independent Test**: ⌥-drag a card. The original stays put and a copy moves. Drop and undo once: only the copy goes. Repeat with Esc: nothing changes.

### Tests for User Story 2 (write first, watch them fail)

- [x] T013 [P] [US2] In `apps/app/src/editor/canvas.test.tsx`, describe "⌥-drag duplicates (016 FR-009)" (:773-840), add failing cases from C2:
  - **(a)** past the threshold with ⌥, before release, the original's doc position equals its start and a second node with the same title exists;
  - **(b)** the canvas wrapper has `data-duplicating` during the drag;
  - **(c)** after drop, one `undo` leaves exactly the original at its start;
  - **(d)** Esc mid-drag gives one node at the start and an undo stack depth unchanged;
  - **(e)** a window `blur` mid-drag behaves like Esc;
  - **(f)** pressing ⌥ during a plain drag snaps the original back and creates the copy, and releasing ⌥ before drop removes it, leaving a plain move;
  - **(g)** three selected cards give three copies, and the edges between them are copied;
  - **(h)** a group frame ⌥-drag copies the group with its members.
- [x] T014 [P] [US2] Add unit tests for the session mode switch in `apps/app/src/editor/editing/drag-session.test.ts` (create it if absent; use a fake `editor` that records calls). Cover:
  - `move → duplicate` calls `pasteFragment` once and resets the originals;
  - `duplicate → move` removes exactly the copy ids;
  - repeated `pointer()` frames in duplicate mode never paste again;
  - `stop()` in duplicate mode does not call the old `duplicateOnDrop`.

### Implementation for User Story 2

- [x] T015 [US2] Add `dragCopyIds: ReadonlySet<string>` (default empty) with `setDragCopyIds` / `clearDragCopyIds` to `apps/app/src/state/ui-store.ts`, cleared in the same places `hoverFocus` is reset (deck, view and drill switches). Add store tests in `apps/app/src/state/ui-store.test.ts`.
- [x] T016 [US2] In `apps/app/src/editor/editing/drag-session.ts`, add `mode: 'move' | 'duplicate'` and `copies: { ids: string[]; map: Map<string, string> } | null` to the session (data-model.md).
  - **Enter duplicate**: when the threshold is passed with ⌥ held, or ⌥ goes down mid-drag (`onKey`, `pointer()`):
    - write the originals back to `session.start` and their frames;
    - `editor.pasteFragment(selectionFragment(...), { offset: 0, parent: commonParent })` at the current dragged positions;
    - map the originals to the copies, and make `apply()` move the copy ids;
    - call `setDragCopyIds`.
  - **Leave duplicate** (⌥ up): remove the copies with the editor's delete op for those ids, switch `apply()` back to the originals at the current delta, and clear `dragCopyIds`.
  - Everything happens inside the already-open `beginGesture()`.
- [x] T017 [US2] In the same file:
  - **`stop()`**: in duplicate mode, `endGesture()`, select the copies and announce "Duplicated n components". Remove `duplicateOnDrop()` (:526-540) and the release-event ⌥ override (:440).
  - **`cancel()`** and a new window `blur` listener (added in `begin()`, removed on every exit): `cancelGesture()` and `clearDragCopyIds()`.
  - The ⌥ "no group" drop target is unchanged.
- [x] T018 [US2] In `apps/app/src/editor/deck-to-flow.ts`, add the class `sd-drag-copy` to nodes and group nodes whose id is in `view.dragCopyIds`. Thread it from `canvas.tsx` like the other view fields, and include it in the cache key. In `apps/app/src/editor/canvas.tsx`, set `data-duplicating` on the wrapper while `dragCopyIds.size > 0`.
- [x] T019 [US2] In `apps/app/src/index.css`, under `[data-duplicating]`:
  - remove the lift from `.react-flow__node.dragging .sd-card` / `.sd-shape-art` (the original sits at rest);
  - apply the drag lift (lip `--sd-deck-lip-drag` and the Float shadow) to `.react-flow__node.sd-drag-copy .sd-card` / `.sd-shape-art`.
- [x] T020 [US2] Check `apps/app/src/editor/editing/gesture-hints.ts` (:13-24). The hint text ("⌥ Duplicate / No group") still matches; adjust only if a test shows otherwise.

**Checkpoint**: T013–T014 are green, and the existing 016 duplicate tests still pass.

---

## Phase 5: User Story 3 - Show card details at mid zoom (Priority: P1)

**Goal**: Container detail (type name, description, chips, tag pills) shows down to 51 %. System is 31–50 % and Landscape ≤ 30 % (R4, contract C4).

**Independent Test**: zoom from 100 % to 25 %. Details are visible down to 51 %, the System look shows from 50 % to 31 %, and icons only at 30 % and below.

### Tests for User Story 3 (write first, watch them fail)

- [x] T021 [P] [US3] In `apps/app/src/editor/levels.test.ts`:
  - `levelForZoom` boundaries: 0.30 → landscape, 0.31 / 0.50 → system, 0.51 / 1.50 → container, 1.51 → component;
  - the `levelWithHysteresis` table rewritten for 30 / 50 / 150 with `HYSTERESIS = 2`;
  - `LEVEL_MID_ZOOM` values lie inside their own bands.
- [x] T022 [P] [US3] In `apps/app/src/editor/level-indicator.test.tsx`, picking each level zooms to the new `LEVEL_MID_ZOOM` (0.2 / 0.4 / 1.0 / 1.75).

### Implementation for User Story 3

- [x] T023 [US3] In `apps/app/src/editor/levels.ts`, set `LANDSCAPE_MAX = 30`, `SYSTEM_MAX = 50`, and `LEVEL_MID_ZOOM = { landscape: 0.2, system: 0.4, container: 1.0, component: 1.75 }`. Update the comment on `liplessSelector` in `apps/app/src/editor/canvas.tsx` (:105-108), which names 45 % and 90 %. The 60 % lip rule stays.
- [x] T024 [US3] Run the affected suites and fix any assertion that hard-codes the old boundaries. Do not change component logic. Suites:
  - `deck-node.test.tsx`, `group-boundary-node.test.tsx`, `merged-edge.test.tsx`, `shapes/shape-node.test.tsx`;
  - `canvas.test.tsx` (level announcements), `export/scene.test.ts`;
  - `use-canvas-shortcuts.test.tsx`, `editing/drag-session` tests, `actions/align-actions` tests.
- [ ] T025 [US3] Run `pnpm bench` and compare the zoom/pan fps scenarios with `bench-before.md`.
  - If any regresses beyond 5 %, apply the research R4 fallback: hide the field and tag chips row at System, keep the description. Record it.
  - Save the table in `specs/051-manual-test-polish/bench-after.md`.

**Checkpoint**: T021–T022 are green and the bench is within budget.

---

## Phase 6: User Story 4 - Drag cards without tilt (Priority: P2)

**Goal**: dragged cards and shapes never rotate; the lift stays (R3, contract C3).

**Independent Test**: drag a card and a shape. They lift and never rotate.

- [x] T026 [P] [US4] Write a failing CSS test `apps/app/src/editor/drag-look-css.test.ts`, in the style of `quick-edit-css.test.ts`, that reads `apps/app/src/index.css`. It asserts:
  - the `.react-flow__node.dragging .sd-card` and `.react-flow__node.dragging .sd-shape-art` rules contain no `rotate`;
  - they still reference `--sd-deck-lip-drag` or `--shadow-float`.
- [x] T027 [US4] In `apps/app/src/index.css`, remove `rotate(-2.5deg)` (:114-120) and `rotate(-3deg)` (:219-225) from the dragging rules. Keep the lip and the shadow, and drop the transform `transition` if nothing else needs it.

**Checkpoint**: T026 is green.

---

## Phase 7: User Story 5 - Export options react to a click anywhere on the option (Priority: P2)

**Goal**: clicking any part of an export format row selects it, keyboard behaviour is unchanged, and the accessible name stays the format name (R5, contract C5).

**Independent Test**: open Export and click each format's subtitle text. It is selected and the preview updates.

### Tests for User Story 5 (write first, watch them fail)

- [x] T028 [P] [US5] In `packages/ui/test/radio-group.test.tsx`:
  - clicking the `description` text of an item checks it;
  - clicking the item's outer element checks it;
  - arrow keys still move selection;
  - `getByRole('radio', { name })` still resolves from `label` / `aria-label`.
- [x] T029 [P] [US5] In `apps/app/src/editor/export/export-dialog.test.tsx`, add a case: clicking a format's subtitle text (`getByText(subtitle)`) checks that radio. Existing cases (`:84-89`, `:129-135`, `:154`, `:239-265`, `:340`) stay green.

### Implementation for User Story 5

- [x] T030 [US5] In `packages/ui/src/components/radio-group.tsx`, make the outer element of `RadioGroupItem` a `<label htmlFor={itemId}>` (it was a `<span>`) that receives `className`.
  - Render the `label` content in a `<span>` with `min-w-0 flex-1 truncate`.
  - Add an optional `description?: ReactNode` rendered inside the outer label, below the text.
  - Keep `cursor-pointer` and the disabled styles on the outer label (`has-[:disabled]` or `peer` equivalents).
  - Update the JSDoc.
- [x] T031 [US5] In `apps/app/src/editor/export/export-dialog.tsx` (:222-248), drop the wrapper `<div>`. Pass its row classes (`rounded-row border p-3`, plus the checked/unchecked classes) as `className`, and the subtitle as `description` with `id={export-format-${id}}`. Keep `aria-label` and `aria-describedby`, so the name stays the format name.
- [x] T032 [P] [US5] Check the other `RadioGroupItem` users still render and behave: `apps/app/src/editor/views/view-settings-popover.tsx` and `apps/app/src/design-gallery/fields-section.tsx`, plus their tests if present.

**Checkpoint**: T028–T029 are green.

---

## Phase 8: User Story 6 - Calm save indicator while typing (Priority: P2)

**Goal**: "Saving…" appears only when a write has been pending for 1 s or more. Writes still land about 100 ms after an edit, and errors show at once (R6, contract C6).

**Independent Test**: type a 30-character title: no spinner. Reload right away: the title is complete.

### Tests for User Story 6 (write first, watch them fail)

- [x] T033 [P] [US6] In `apps/app/src/storage/save-status.test.ts`, use fake timers to cover data-model "Save status":
  - `pending` then `saved` at +100 ms → never `saving`;
  - 30 cycles 80 ms apart → never `saving`;
  - `pending` with no `saved` for 1,000 ms → `saving`, then the 200 ms hold applies on `saved`;
  - `failed` during `pending` → `error` at once.

  Rewrite the old cases (`:8`, `:46`, `:59`, `:67`, `:80`, `:96`) that expect `saving` straight after `pending`.

- [x] T034 [P] [US6] In `apps/app/src/editor/save-status.test.tsx` (`:40`, `:88`), after a `pending` dispatch the indicator still reads "Saved" with no spinner, and after advancing 1,000 ms it reads "Saving…". Also check `editor/shell/deck-island.test.tsx:54` and `shell-chrome.test.tsx:150-154` still pass.

### Implementation for User Story 6

- [x] T035 [US6] In `apps/app/src/storage/save-status.ts`:
  - add `{ kind: 'pending'; since: number }` to the state and `SAVING_SHOW_DELAY_MS = 1000`;
  - in `reduceSaveStatus`, `pending` from `saved` gives `pending`;
  - in `createSaveStatusStore`, start the show-delay timer on entering `pending`; on firing, if still `pending`, set `saving`; on `saved` while `pending`, clear the timer and set `saved`;
  - keep the `waiting` guard and the 200 ms hold for `saving`, and `failed` immediate;
  - delete the unused `SAVED_MAX_HOLD_MS`.
- [x] T036 [US6] In `apps/app/src/editor/save-status.tsx`, render `pending` exactly like `saved` (icon and text variants), so no spinner. `show-ui-pill.tsx` is unaffected (it reads only `error`).
- [x] T037 [P] [US6] Confirm `apps/app/src/storage/deck-persistence.test.ts` still shows the write 100 ms after the first update and the flush on `pagehide` (no code change expected).

**Checkpoint**: T033–T034 are green.

---

## Phase 9: User Story 7 - Packs in a useful order, Logistics tucked away (Priority: P3)

**Goal**: packs are listed Basic shapes, Process, Data cards, Database, Architecture, Logistics. New decks have Logistics off. Files are unchanged (R7, contract C7).

**Independent Test**: on a new deck, Add shows "Packs · 5 on" with no Logistics tiles, and the Packs panel lists the new order. An existing deck with Logistics is unchanged.

### Tests for User Story 7 (write first, watch them fail)

- [x] T038 [P] [US7] In `packages/model/test/card-types.test.ts`:
  - `PACK_DISPLAY_ORDER` lists every `PackId` once;
  - `PACKS` sorted by `order` gives the new order;
  - `onByDefault` is false only for `logistics`;
  - `NEW_DECK_PACKS` is the five other packs in **file order**;
  - `sortPacks` output is unchanged (file order).

  Update `:48`, `:95`, `:128`, `:157` (`packTypeCount`) and `:230` only where they assert display order or `NEW_DECK_PACKS`; keep file-order assertions as they are.

- [x] T039 [P] [US7] In `packages/model/test/packs.test.ts` (:88), `createDeck().packs` has no `logistics`. Add a round-trip case: a deck with `packs: ['architecture', 'process', 'logistics', 'shapes']` gives `toJSON` with the identical array.
- [x] T040 [P] [US7] In `apps/app/src/editor/packs-panel.test.tsx` and `apps/app/src/editor/palette.test.tsx`:
  - the panel rows follow the new order;
  - a new deck shows "Packs · 5 on" (was 6, `:290`);
  - Add tabs follow the new `CATEGORIES` order;
  - turning Logistics on shows its tiles last.

### Implementation for User Story 7

- [x] T041 [US7] In `packages/model/src/card-types.ts`:
  - add `onByDefault: boolean` to `Pack`, and an exported `PACK_DISPLAY_ORDER: readonly PackId[] = ['shapes', 'process', 'data', 'database', 'architecture', 'logistics']`;
  - set `Pack.order` from `PACK_DISPLAY_ORDER.indexOf(id)` (keep `PACK_LIST` order as is);
  - reorder `CATEGORIES` to the display order;
  - set `NEW_DECK_PACKS = PACKS.filter((p) => p.onByDefault).map((p) => p.id)`;
  - update the doc comments, and export the new names from `packages/model/src/index.ts`.
- [x] T042 [US7] In `apps/app/src/editor/packs-panel.tsx` (:25-26, :54) and `apps/app/src/editor/palette.tsx` (:68-83), render packs sorted by `order` (not array order). `apps/app/src/storage/library-ops.ts:66-68` and `apps/app/src/bench/generate-deck.ts:270` keep using `NEW_DECK_PACKS`. Check that the bench deck does not rely on Logistics types; if it does, give it an explicit pack list.

**Checkpoint**: T038–T040 are green, and the model round-trip suite is green.

---

## Phase 10: User Story 8 - Simpler library sidebar (Priority: P3)

**Goal**: the "Persistent storage" card is gone, its orphaned code is deleted, and the import button reads "Import" (R8, contract C8).

**Independent Test**: on the library page there is no storage card, and the button says "Import" and still imports.

- [x] T043 [P] [US8] Add a test to `apps/app/src/library/import-button.test.tsx`: the button's visible text is exactly "Import", and its accessible name is "Import deck file (.sododeck.json)". Add a library page or sidebar test, next to `apps/app/src/library/library-sidebar.tsx` or `routes/library-page.tsx` tests, that asserts `queryByText('Persistent storage')` is null.
- [x] T044 [US8] In `apps/app/src/library/import-button.tsx` (:38), set the visible text to "Import" and add `aria-label="Import deck file (.sododeck.json)"` on the control that carries the name.
- [x] T045 [US8] Remove the storage card:
  - delete `apps/app/src/library/storage-card.tsx`, `storage-card.test.tsx`, `apps/app/src/storage/storage-estimate.ts` and `storage-estimate.test.ts`;
  - remove the `storageCard` prop and slot from `apps/app/src/library/library-sidebar.tsx` (:155, :163, :234) and its use in `apps/app/src/routes/library-page.tsx` (:27, :168);
  - remove `supportsPersistentStorage` and `supportsStorageEstimate` from `apps/app/src/lib/features.ts` (:9, :55) and their cases in `lib/features.test.ts`;
  - grep that no references remain.

**Checkpoint**: T043 is green, and `pnpm typecheck` shows no dangling imports.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [x] T046 [P] Write `docs/decisions/0031-manual-test-polish.md` (use the next free number if 0031 is taken). It records:
  - hover focus only inside Focus mode, and Focus mode without a selection (redefines 034);
  - level thresholds 30 / 50 / 150 (redefines frame 123);
  - pack display order split from file order, and Logistics off by default (amends ADR 0025);
  - G-4 retired.
- [x] T047 [P] Update `DESIGN.md`:
  - the "Zoom levels (123)" table (:292-302): ≤ 30 %, 31–50 %, 51–150 %, > 150 %;
  - the `--sd-deck-tilt` token row (:201): removed, or "none";
  - the "Being dragged" state (:255) and :260: lift only, no tilt; under ⌥ the original stays in place and the copy carries the lift; drop the never-built origin ghost.
- [x] T048 [P] Update `docs/spec.md`:
  - V-3 (:185): Focus mode toggles a mode; hover or selection drives the focus inside it;
  - G-4 (:285): retired by founder decision on 2026-10-04.

  Add an amendment note to `docs/decisions/0025-card-type-registry.md` (:27, "all four packs on").

- [x] T049 [P] Update the package docs:
  - `packages/model/CLAUDE.md` (:109-125): `NEW_DECK_PACKS`, `PACK_DISPLAY_ORDER`, `onByDefault`;
  - `apps/app/CLAUDE.md`: remove the storage card (:35-36), fix "cycles the 13 types with every pack on" (:105), note `focus-target.ts` and the duplicate-drag mode.
- [ ] T050 Run the full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix anything red, and update the smoke suite only if a change breaks it.
- [ ] T051 Walk through `specs/051-manual-test-polish/quickstart.md` steps 1–8 in `pnpm dev`, and take a screenshot per step for the PR.
- [ ] T052 Open the PR with the bench before/after numbers, the screenshots, and the report: what changed, what was skipped (sticky duplicate-drag, automatic persist request), and what is uncertain (the duplicate-drag interaction with React Flow's internal drag, and the bench at 51–90 %). No AI attribution lines.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001–T002)** comes first. T002 must run before any canvas change (US1, US2, US3, US4).
- **Foundational (T003–T004)** blocks US1 only.
- **US2–US8** depend only on Setup, and are independent of each other and of US1.
- **Polish (T046–T052)** runs after the stories it documents. T050–T052 come last.

### Shared files (serialize edits)

- `apps/app/src/editor/canvas.tsx`: T004 → T010 (US1) → T018 (US2) → T023 (US3 comment only).
- `apps/app/src/index.css`: T019 (US2) and T027 (US4) touch neighbouring rules. Do T027 first, then T019.
- `apps/app/src/editor/canvas.test.tsx`: T006 (US1) and T013 (US2) are in different describes, but merge them carefully.
- `apps/app/src/state/ui-store.ts`: T015 only.

### Within each story

Tests first and failing, then the implementation, then the checkpoint.

## Parallel Examples

- **After T002**: T003 (foundational), T013–T014 (US2 tests), T021–T022 (US3 tests), T026 (US4), T028–T029 (US5), T033–T034 (US6), T038–T040 (US7) and T043 (US8) all touch different files.
- **US1 tests**: T005, T006 and T007 together.
- **US5**: T028 (ui package) and T029 (app) together, then T030 → T031, with T032 in parallel after T030.
- **US7**: T038, T039 and T040 together, then T041 → T042.
- **Polish docs**: T046, T047, T048 and T049 together.

## Implementation Strategy

### MVP

US1 alone (T001–T012) removes the founder's most disruptive problem. Ship it if time is short.

### Suggested delivery (plan "Delivery order")

1. **Quick wins first**, each its own small commit: US8 (T043–T045), US5 (T028–T032), US4 (T026–T027), US7 (T038–T042).
2. **US6** (T033–T037).
3. **US1** (T003–T012).
4. **US3** with the bench (T021–T025).
5. **US2** (T013–T020), the largest and riskiest, so do it last with its tests written first.
6. **Polish** (T046–T052).

### Notes

- Keep commits small and conventional, one story (or less) per commit.
- Rebase on 050 if it lands first: it also edits `drag-session.ts`, `deck-to-flow.ts` and `canvas.tsx`, and it takes ADR 0030.
