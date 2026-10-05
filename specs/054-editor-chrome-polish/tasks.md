# Tasks: Editor chrome polish (054)

**Inputs**: [plan.md](plan.md), [spec.md](spec.md) (clarified 2026-10-05: no Infra preset; names Overview and Flows; DBML and SQL tabs in the right drawer; Selection / Whole schema hidden, whole schema always; Deck settings in the tools island), [research.md](research.md) (R1–R10), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md).

**Tests**: required (constitution VI, AGENTS.md). Write each story's tests first and watch them fail. No new e2e; the existing smoke suite must stay green (update it only if a moved control breaks it).

**Organization**: one phase per user story in spec priority order (US1, US2 are P1; US3, US4, US5 are P2; US6, US7 are P3). Stories only share Phase 2 and are otherwise independent; any one can ship alone.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 to US7 from spec.md.

## Path Conventions

- App: `apps/app/src/` (editor in `apps/app/src/editor/`, shell in `apps/app/src/editor/shell/`, UI store `apps/app/src/state/ui-store.ts`)
- Model: `packages/model/src/`, tests in `packages/model/test/`
- Commits: Conventional Commits, small, **no `Co-Authored-By:` or other AI attribution** (AGENTS.md). Do not name other diagram or database tools anywhere.

---

## Phase 1: Setup

- [ ] T001 Confirm branch `054-editor-chrome-polish` and a green baseline: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Do not run `pnpm bench` yet; it is needed only in T046 if the canvas handlers change.
- [ ] T002 Commit the spec folder (spec, plan, research, data-model, contracts, quickstart, tasks, checklists) and the `docs/backlog.md` status line for 054 (`in progress`) as `docs: editor chrome polish spec, plan and tasks (054)`.

---

## Phase 2: Foundational

**Purpose**: the two pure helpers more than one story reads. Everything else is story-local.

- [ ] T003 [P] Write `packages/model/test/group-members.test.ts`: `descendantNodeIds(deck, groupId)` returns the cards of the group and of nested groups (through `group.parent`), is empty for an empty group, ignores unknown ids, and has no duplicates; a cyclic `parent` chain does not loop forever.
- [ ] T004 Implement `descendantNodeIds` in `packages/model/src/ops/group-selection.ts` (or a new `group-members.ts`), export it from `packages/model/src/index.ts`. T003 is green.
- [ ] T005 [P] Write `apps/app/src/editor/shell/shell-geometry.test.ts` cases for `clampCodeDrawerWidth(width, viewport, detailsWidth | null, compact)`: result is within 320 and the maximum; maximum is `min(70% of viewport, viewport − FLYOUT_LEFT − detailsWidth − 2·EDGE − 240)`; with no details drawer the maximum is 70%; compact uses the 35% share; the maximum never falls below 320 (caller then closes the other drawer); non-finite width falls back to the default 560.
- [ ] T006 Implement `CODE_DRAWER_MIN` (320), `CODE_DRAWER_DEFAULT` (560), `CANVAS_STRIP` (240) and `clampCodeDrawerWidth` in `apps/app/src/editor/shell/shell-geometry.ts`. T005 is green.

**Checkpoint**: helpers exist; story phases can start.

---

## Phase 3: User Story 1 — Deck settings in the tools island (P1) 🎯 MVP

**Goal**: a visible Deck settings button top-right; the menu item stays.

**Independent test**: open a deck; the tools island has a "Deck settings" button that opens and closes the deck drawer; the top-left deck island is unchanged.

- [ ] T007 [P] [US1] Write tests in `apps/app/src/editor/shell/tools-island.test.tsx`: the island lists, in order, "Deck settings", "Jump to… (⌘K)", "Labels" and no "Focus"; pressing Deck settings sets the drawer open in `deck` mode and `aria-pressed` is true; pressing again closes it; with the drawer open on a card's details, pressing Deck settings switches to deck mode.
- [ ] T008 [US1] Edit `apps/app/src/editor/shell/tools-island.tsx`: add a `ToolButton` with `Settings2`, label "Deck settings", tooltip "Deck settings", `pressed` from `drawer.open && drawer.mode === 'deck'`, `onClick` toggling `openDrawer('deck')` / `closeDrawer()`; remove the Focus button and its now-unused imports and selectors (Focus moves in T011). Update the doc comment. T007 is green except the Focus part checked there.
- [ ] T009 [P] [US1] Update `apps/app/src/editor/shell/shell-geometry.ts` `ISLAND_SIZES.tools` / `toolsCompact` if the button count changed width, and `apps/app/src/editor/shell/shell-geometry.test.ts` expectations; confirm `deck-menu.tsx` still has "Deck settings" and add a case to `apps/app/src/editor/shell/deck-island.test.tsx` (or a `deck-menu` test) that the menu item opens the same drawer.
- [ ] T010 [US1] Check the compact shell (`use-compact-shell.ts`): Deck settings stays reachable (button visible in `toolsCompact`, else the menu item); add a compact test case in `tools-island.test.tsx`.

**Checkpoint**: US1 works alone; Focus is temporarily absent until US2, so ship US1 and US2 together.

---

## Phase 4: User Story 2 — Focus in the rail (P1)

**Goal**: Focus is a rail tool directly under Select, same behaviour and shortcut.

**Independent test**: select a card, press the rail Focus button: the rest dims; press again: normal; during a flow it is disabled with its reason.

- [ ] T011 [P] [US2] Write tests in `apps/app/src/editor/shell/rail.test.tsx` (create if absent, else extend): the button named "Focus" sits immediately after Select / Hand in DOM order; `aria-pressed` follows `focusMode`; clicking toggles `focusMode`; with a flow session or flow mode it is `aria-disabled` and its tooltip says "Focus: not available while a flow is shown"; the shortcut `F` still toggles it (existing canvas shortcut test stays green).
- [ ] T012 [US2] Edit `apps/app/src/editor/shell/rail.tsx`: add a Focus `RailTip` + `RailButton` (`Focus` icon from lucide-react, `active` and `aria-pressed` from `focusMode`, `shortcut="focus"` if a `SHORTCUTS` id exists, else the literal hint "F") right after `pointerButton`; reuse the disabled rule from the old tools-island code (`flowSession !== null || isFlowMode`). T011 is green.
- [ ] T013 [P] [US2] Update `ISLAND_SIZES.rail` height for 11 buttons in `apps/app/src/editor/shell/shell-geometry.ts` and its test; update `apps/app/src/editor/shell/shortcut-help-dialog` and `shortcuts.ts` only if the Focus entry names its old location.
- [ ] T014 [US2] Run the existing smoke e2e locally (`pnpm e2e`); if it clicks the Focus tool in its old place, update `apps/app/tests/e2e/smoke.spec.ts` minimally.

**Checkpoint**: US1 and US2 together are the P1 release.

---

## Phase 5: User Story 3 — Overview and Flows views (P2)

**Goal**: new decks offer Overview and Flows only; stored decks are untouched.

**Independent test**: new deck shows tabs Overview, Flows; an old deck with System / Feature / Infra shows them unchanged and the file is not rewritten on open.

- [ ] T015 [P] [US3] Update `packages/model/test/views.test.ts`: `VIEW_PRESETS` is exactly two views with ids `system`, `feature`, types `system`, `feature`, titles "Overview", "Flows", subtitle fields `tech`, `flows`; no `infra`; `resolveViews` returns stored views untouched (including a stored Infra); `baseViewId` of the presets is `system`; `nextCustomTitle` unchanged. Add a round-trip case: a deck with stored System / Feature / Infra serialises byte-for-byte the same.
- [ ] T016 [US3] Edit `packages/model/src/views.ts`: retitle the two presets, remove `infra`, update the doc comment. Check `PRESET_VIEW_IDS` users (`packages/model/src/ops/views.ts`) still treat an `infra` id in a stored deck as a normal stored view. T015 is green.
- [ ] T017 [P] [US3] Update `apps/app/src/editor/views/view-title.ts` and its test: `viewTabName` returns "<title> view" for the built-in `system` and `feature` ids and "<title>, <type> view" for custom views; `currentViewCrumb` fallback becomes "Overview view". Update `views/view-switcher.test.tsx`, `views/view-state.test.ts`, `view-filter.test.ts`, `views/view-tab-menu.test.tsx` expectations that name "System", "Feature" or "Infra" for a deck with no stored views.
- [ ] T018 [US3] Edit `apps/app/src/editor/views/view-settings-popover.tsx` and `view-switcher.tsx` only where they print the preset titles or offer "Infra"; confirm "+" still adds "Custom n". Add a test that opening a deck with no views does not change `doc` (no write, undo stack empty), and the first view change writes Overview and Flows with their defaults without adding an undo step of its own.

**Checkpoint**: US3 works alone.

---

## Phase 6: User Story 4 — Compact table detail (P2)

**Goal**: one compact button with a described choice per detail.

**Independent test**: a deck with a table shows one "Detail: Auto" button; opening it lists four options with one-line descriptions; choosing one is one undo step.

- [ ] T019 [P] [US4] Rewrite `apps/app/src/editor/shell/table-detail-control.test.tsx`: no `radio` group is rendered in the island (only one button named "Detail: Auto"); opening it shows a menu named "Table detail" with radio items Auto, Names, Keys, All, each with its description text; choosing Keys writes the deck detail once and ⌘Z restores Auto; absent in a deck without a table; the same in compact mode; the trigger's accessible name includes the current value.
- [ ] T020 [US4] Edit `apps/app/src/editor/shell/table-detail-control.tsx`: remove the segmented branch, always render the dropdown; `OPTIONS` gains a `description` (Auto "Follows the zoom level", Names "Table and column names only", Keys "Names plus key columns", All "Every column with its type and notes"; check the wording against `packages/model/src/table-display.ts` and fix it to match the real behaviour); trigger text `Detail: <label>` with a small icon; keep `oneStep`. Drop the `compact` prop if nothing else needs it and update `zoom-island.tsx`.
- [ ] T021 [P] [US4] Update `ISLAND_SIZES.zoom` width in `apps/app/src/editor/shell/shell-geometry.ts` (the control is now one button) and its test; check `zoom-island.test` (if present) and `apps/app/src/editor/shell/shell-chrome.test.tsx` for the old segmented labels.

**Checkpoint**: US4 works alone.

---

## Phase 7: User Story 5 — Lock many cards or a whole group (P2)

**Goal**: Lock / Unlock works on groups and select-all in one undo step; locked groups refuse move, resize, delete.

**Independent test**: ⌘A, Lock: every card locked ("Locked N cards"), card and group drags refused; Unlock restores; one ⌘Z per step.

- [ ] T022 [P] [US5] Write `apps/app/src/editor/lock.test.ts` cases for the new helpers: `lockableIds(deck, selection)` = selected cards ∪ `descendantNodeIds` of selected groups, de-duplicated, ignoring selected stickies and edges; `groupLockState(deck, groupId)` is `locked` when it has members and all are locked, `unlocked` when any is not, `empty` with no members; `isGroupLocked` is false for an empty group; a card added later makes a locked group read `unlocked`.
- [ ] T023 [US5] Implement `lockableIds`, `groupLockState`, `isGroupLocked` in `apps/app/src/editor/lock.ts` (pure, reads the snapshot). T022 is green.
- [ ] T024 [P] [US5] Write tests in `apps/app/src/editor/actions/table-actions.test.ts` (or `actions/index.test.ts`): `node.lock` is offered for `component`, `components`, `group` and `mixed` in both menu and toolbar; label is "Unlock" only when every lockable card is locked, else "Lock"; running it on a group locks the group's and nested groups' cards in one transaction (`editor.setLocked` called once, one undo step); select-all (cards, groups, connectors, stickies) locks only cards and announces "Locked N cards" with the right N; unlocking a locked group unlocks all its cards; selected connectors and stickies are skipped without error.
- [ ] T025 [US5] Edit `apps/app/src/editor/actions/table-actions.ts`: widen `node.lock` `where` to the four targets, make `allLocked` and `toggleLock` use `lockableIds` (selection object, not just node ids), keep the column-edit end rule, announce counts. If the `lock` shortcut handler in `apps/app/src/editor/use-canvas-shortcuts.ts` only passes `selection.nodes`, route it through the same function. T024 is green.
- [ ] T026 [P] [US5] Write tests in `apps/app/src/editor/canvas.test.tsx` / `use-canvas-handlers` tests: dragging, resizing the frame of, or deleting a group whose `groupLockState` is `locked` is refused with `LOCKED_HINT` and changes nothing; an `unlocked` or `empty` group behaves as before; deleting a selection that contains a locked group skips it and says how many were skipped (extend `withoutLocked` / `confirm-delete-dialog.test.tsx`).
- [ ] T027 [US5] Implement the guard: in `apps/app/src/editor/use-canvas-handlers.ts` (group drag / resize start next to the node guard at the existing `isNodeLocked` check), in `apps/app/src/editor/lock.ts` (`withoutLocked` also drops locked groups), and the group inspector / title edit path if it moves the frame. Only after T026 fails.
- [ ] T028 [US5] Show the state: a lock glyph on a locked group's header (tokens only, reuse the card's lock icon style in `apps/app/src/editor/group-boundary-node.tsx` and `collapsed-group-node.tsx`) with an accessible label "Locked"; add tests in `group-boundary-node.test.tsx` and `collapsed-group-node.test.tsx`.

**Checkpoint**: US5 works alone (needs only Phase 2).

---

## Phase 8: User Story 6 — Spread ends evenly explained (P3)

**Goal**: the action says what it does, and why it is disabled.

**Independent test**: hover or focus Spread ends evenly: a sentence shows; with nothing to spread it is disabled with a reason that says what is needed.

- [ ] T029 [P] [US6] Update `apps/app/src/editor/actions/index.test.ts` / `connection-actions.test.ts`: `SPREAD_ENDS_ACTION.description` is "Space the connector ends evenly along each side of the selected cards"; `disabledReason` is "Needs a side with two or more connector ends" when `spreadPlan` has no patches and null otherwise; a menu item and a toolbar button for the action expose the description as the tooltip when enabled and the reason when disabled (use the existing menu / toolbar render tests).
- [ ] T030 [US6] Edit `SPREAD_ENDS_ACTION` in `apps/app/src/editor/actions/connection-actions.ts`: add `description`, reword `disabledReason`. T029 is green. Mention locked cards being skipped in the tooltip only if the 043 rule applies to this action (check `spreadPlan`).

**Checkpoint**: US6 works alone.

---

## Phase 9: User Story 7 — DBML drawer, whole schema only (P3)

**Goal**: a resizable right-side drawer with DBML and SQL; the JSON panel is JSON only; no Selection / Whole schema switch.

**Independent test**: deck menu → "Show DBML / SQL" opens the drawer; edit DBML and the canvas updates; drag the edge wide; open details too; JSON panel shows only JSON; with nothing selected DBML still shows the schema.

### State and prefs

- [ ] T031 [P] [US7] Write `apps/app/src/state/json-panel-prefs.test.ts` cases: a stored `format: 'dbml'` or `'sql'` reads as `'json'`; the stored `schemaScope` is kept as read but never rewritten by the new code path; new `codeDrawer` prefs `{ open, width, format: 'dbml' | 'sql' }` validate field by field and default to `{ open: false, width: 560, format: 'dbml' }`; blocked storage falls back to defaults.
- [ ] T032 [US7] Edit `apps/app/src/state/json-panel-prefs.ts` (type `CodeDrawerPrefs`, reader, save) and `apps/app/src/state/ui-store.ts`: add `codeDrawer`, `openCodeDrawer(format?)`, `closeCodeDrawer()`, `setCodeDrawerFormat`, `setCodeDrawerWidth(px, { commit })`; opening it closes the details drawer when `clampCodeDrawerWidth` has no room (research R7) and vice versa. Add store tests in `apps/app/src/state/ui-store.test.ts`. T031 is green.

### JSON panel loses the code tabs

- [ ] T033 [P] [US7] Update `apps/app/src/editor/json-panel.test.tsx`: the header has the JSON / Selection / Deck switch and no "DBML" or "SQL" tab, no "Schema scope" control; the panel never lazy-loads the DBML or SQL chunks.
- [ ] T034 [US7] Edit `apps/app/src/editor/json-panel.tsx` and `json-panel-header.tsx`: remove the `format` and `schemaScope` props, the `CodeFormatTabs`, the scope `SegmentedControl` and the `DbmlTab` / `SqlTab` lazy imports; keep the JSON branch. Remove `setCodeFormat` / `setSchemaScope` use from the panel only (the store actions stay for the drawer and for restoring scope later). T033 is green.

### Whole schema only

- [ ] T035 [P] [US7] Update `apps/app/src/editor/code/dbml-tab.test.tsx` and `sql-tab.test.tsx`: with a table selected and with nothing selected the tab shows the whole schema; no text contains "Select tables" or "Whole schema"; an old stored `selection` scope does not change what is shown.
- [ ] T036 [US7] Edit `apps/app/src/editor/code/dbml-tab.tsx`, `sql-tab.tsx`, `use-schema-text.ts` callers: pass the constant scope `'schema'`, delete the "Select tables, or switch to Whole schema" copy (keep the selection branch of the writers, parked: add `TODO(selection-scope): restore the Selection / Whole schema switch` once at the call site). T035 is green.

### The drawer

- [ ] T037 [P] [US7] Write `apps/app/src/editor/shell/code-drawer.test.tsx`: region named "Code" with tabs DBML and SQL; Close and Esc close it and return focus to the opener; the grip is a `separator` with `aria-valuemin` 320, `aria-valuemax` the clamp maximum and `aria-valuenow`; ←/→ resize by 8, ⇧←/⇧→ by 40, Home/End jump to min/max; dragging resizes live and commits once on release; the DBML tab is the editable editor (renders with the existing mocks), SQL is read-only with the existing message; empty deck shows the 046 empty states; Copy copies the shown text and toasts.
- [ ] T038 [US7] Generalise `apps/app/src/editor/shell/drawer-grip.tsx` to take `min`, `max`, `onChange(px)`, `onCommit(px)` (defaults keep the details drawer's behaviour; update `detail-drawer.tsx` and its tests), or if that touches more than the grip and the drawer, add `code-drawer-grip.tsx` instead. Either way T037's grip cases are green.
- [ ] T039 [US7] Create `apps/app/src/editor/shell/code-drawer.tsx`: absolutely positioned like `detail-drawer.tsx` (top `OVERLAY_TOP`, bottom `EDGE`, `right` = `EDGE` or `EDGE + detailsWidth + EDGE`), header with `CodeFormatTabs` limited to dbml and sql (edit `code/code-format-tabs.tsx` and its test so JSON is not offered), Copy, Close; body lazy-loads `DbmlTab` / `SqlTab` inside `Suspense`; `data-region="code"`; width from `clampCodeDrawerWidth`; tokens only. T037 is green.
- [ ] T040 [US7] Wire it: mount `CodeDrawer` in `apps/app/src/editor/shell/shell-chrome.tsx`; compute `codeWidth` and move the zoom island and `JsonOverlay` right edge by the total of open drawers (`apps/app/src/editor/shell/json-overlay.tsx`, `zoomIslandBottom` callers, `shell-insets.ts` so fit-to-view and pan-to-clear account for the new drawer, `apps/app/src/editor/canvas.tsx` minimap offset); add `'code'` to `REGION_ORDER` in `regions.ts` (after `drawer`), `visibleRegions`, `isRegionId`, and update `regions.test.ts` and `shell-chrome.test.tsx`.
- [ ] T041 [P] [US7] Write tests for the openers: `apps/app/src/editor/shell/deck-island.test.tsx` / a deck-menu test (menu item "Show DBML / SQL" opens the drawer and reads "Hide DBML / SQL" while open), `apps/app/src/editor/command-palette/commands.test.ts` ("Open DBML / SQL" present, runs `openCodeDrawer`), `empty-canvas-card.test.tsx` (the Database card's link opens the drawer instead of the JSON panel's DBML tab, if it linked there).
- [ ] T042 [US7] Implement the openers: `apps/app/src/editor/shell/deck-menu.tsx` item (icon `FileCode2` or `Braces`; only meaningful in any deck, disabled message not needed), `apps/app/src/editor/command-palette/commands.ts` entry, and any other call site found by `grep -rn "setCodeFormat\|format: 'dbml'" apps/app/src` that today opens the JSON panel on DBML (import success toast "Open in DBML", db inspector links). T041 is green.
- [ ] T043 [US7] Layout checks in `shell-geometry.test.ts` and `shell-chrome.test.tsx`: at 1440 px with the code drawer at 900 px and the details drawer open, the canvas strip is ≥ 240 px and rail, deck island and tools island do not overlap the drawers; at 1100 px (compact) opening one drawer closes the other.

**Checkpoint**: all seven stories done.

---

## Phase 10: Polish and cross-cutting

- [ ] T044 [P] Update docs: `apps/app/CLAUDE.md` (shell: tools island contents, rail Focus, code drawer, JSON panel is JSON only, whole schema only with the parked Selection path), `packages/model/CLAUDE.md` (presets, `descendantNodeIds`), `DESIGN.md` only if it describes the tools island, rail or code panel placement (keep tokens), `docs/spec.md` / `docs/backlog.md` (054 status `done`, a one-line note that Selection scope is parked), `docs/backlog-database.md` where it names the JSON panel's DBML tab. Do not name other tools.
- [ ] T045 [P] Accessibility pass: keyboard-only walk of the quickstart (gear, rail Focus, Detail menu, Lock on a group via menu and shortcut, drawer grip and Esc); fix any missing name, focus return or visible focus ring; confirm all colours are tokens (`pnpm lint` token rule).
- [ ] T046 If T027 changed canvas handlers: run `pnpm bench` before (stash) and after, save both as `specs/054-editor-chrome-polish/bench-before.md` and `bench-after.md`, and note any difference in the report. Skip and say so when handlers were not touched.
- [ ] T047 Run the quickstart manual walk-through (US1–US7), capture a screenshot of the new tools island, rail, `Detail` menu, locked group and the wide DBML drawer for the report.
- [ ] T048 Full definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; no skipped or `.only` tests; confirm `git status` shows only intended files (not the `.DS_Store` or the untracked sample files).
- [ ] T049 Commit in small conventional commits per story (`feat(app): deck settings in the tools island`, `feat(app): focus in the rail`, `feat(model): overview and flows view presets`, `feat(app): compact table detail control`, `feat(app): lock groups and select-all`, `feat(app): explain spread ends evenly`, `feat(app): dbml drawer`, `docs: …`), no AI trailers. Final report: what changed, what was skipped (stickies and connector lock → 053), what is uncertain (table detail copy, group lock when a card is added later), proposal for the next step. Stop; do not start 055 or 056.

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. T004 blocks T025 (lock), T006 blocks T039 (drawer).
- US1 and US2 share the tools-island edit (T008 removes Focus, T012 adds it to the rail): do T008 and T012 in one sitting or merge US1 + US2 as one release.
- US7: T032 (state) → T034 / T036 / T039 → T040 → T042 → T043. T033, T035, T037 can be written in parallel before their implementations.
- US3, US4, US5, US6 are independent of each other and of US7.
- Shared file note: `apps/app/src/editor/shell/shell-geometry.ts` (+ test) is touched by T006, T009, T013, T021, T043; do these in order, not in parallel.

## Parallel examples

- After Phase 2: US3 (T015–T018, model + views), US4 (T019–T021), US6 (T029–T030) touch disjoint files and can run in parallel.
- Inside US7: T031, T033, T035, T037, T041 (tests) in parallel, then implementations in the order above.

## Implementation strategy

1. **P1 release**: Phase 1, 2, then US1 + US2 (tools island and rail). Demo and stop.
2. **P2 release**: US3, US4, US5 in any order (US5 is the biggest).
3. **P3 release**: US6, then US7 (largest, last). Polish after.
4. Report after each release; never start the next milestone.
