# Tasks: Saved Views and Auto-Layout

**Input**: design documents in `specs/011-views-autolayout/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the Clarifications of 2026-09-28 (8 answers).
- [research.md](research.md) (R1–R16) and [data-model.md](data-model.md).
- [contracts/model-views.md](contracts/model-views.md) and [contracts/views-ui.md](contracts/views-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for unit tests (Vitest) for every pure module, store and model op, and component tests (Testing Library, by role and label, following [views-ui.md](contracts/views-ui.md)). Write each test first and watch it fail. Do not add Playwright tests; the smoke suite must stay green and unchanged.

**Scope guards**:

- Only optional schema fields and one enum value (`flows`); `version` stays 1.
- Only `@sododeck/model` writes views. The app never patches view internals with generic `update('views', …)`.
- Opening a deck or switching views never writes to the document (FR-001, FR-005).
- Collapse is never an undo step (FR-050).
- `elkjs` stays in the worker chunk.
- Out of scope (R16): view reordering, per-view drill/focus/zoom, layout options, role layers, export scope.

**Approvals**: no new runtime dependency (`elkjs` and `radix-ui` are already installed). No Complexity Tracking exception.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. Regenerate with `pnpm schema:generate`.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/…`. Read `packages/model/CLAUDE.md` first.
- **UI**: `packages/ui/src/components/…`. Read `packages/ui/CLAUDE.md` first (tokens only).
- **App**: `apps/app/src/…`, tests next to the code (`*.test.ts(x)`). The harness is `apps/app/src/test/render-canvas.tsx` (`editorWrapper`, `deckOf`). Canvas recipes are in `.agents/skills/react-flow/SKILL.md`.
- **Commits**: after each task or logical group, using Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `test(…)`, `docs: …`), with no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `011-views-autolayout` from the latest `main`. Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 Add `options.views` to `generateBenchDeck` in `apps/app/src/bench/generate-deck.ts` (R14): three views (`system`, `feature`, `infra`), with `infra` holding `positions` overrides for 50% of the nodes (seeded offsets), `pinned` for 20 nodes, and `excludeKinds: ['external']` on a fourth `custom` view. This option writes only fields the current schema already accepts (`positions`), plus the new fields once T006 lands; gate the new fields behind the same option so the baseline still runs. Add cases to `apps/app/src/bench/generate-deck.test.ts` for view count, override count and determinism for a seed.
- [x] T003 Extend `apps/app/bench/perf.bench.ts` with three scenarios (R14):
  - `view-switch`: ms from a click on a view tab to the next painted frame (SC-003, target ≤ 200 ms);
  - `tidy-layout-200`: a 200-node deck with 5 pins, ms from the "Tidy layout" click to positions applied (SC-001, < 2 s);
  - `pan-during-layout`: pan fps on the 500-node deck while a layout runs (SC-002, ≥ 60).

  Until the UI exists (T031, T045), each scenario logs `TODO(011): not available yet` and records no number. It is not a skipped test.

- [x] T004 Run `pnpm bench` before any change and save the table in `specs/011-views-autolayout/bench-before.md`.
- [x] T005 [P] Write the ADR `docs/decisions/0012-saved-views-and-layout.md` in the header format of 0011. It covers:
  - the new optional view fields and `flows` (R1);
  - presets as data with fixed ids, materialized on the first view change outside undo history (R3, R4);
  - an override wins in any view, the base view included; a base-view move writes `node.position` and drops the override (R4);
  - the base-view rule (R4);
  - collapse as an untracked origin (R5);
  - pins enforced after ELK layout, plus the overlap sweep (R9).

  It also records the alternatives from R1, R3, R5 and R9, and amends ADR 0005 (layout table) and ADR 0011 (collapse is no longer UI state).

---

## Phase 2: Foundational (blocks every user story)

**Purpose**: the file format, the model ops and the app plumbing that every story reads. No visible change yet: while every deck resolves to the System preset, the canvas looks exactly as on `main`.

### Schema

- [x] T006 Add the optional `View` fields `excludeGroups` (`IdList`), `excludeKinds` (array of `NodeKind`), `excludeTags` (`Tags`), `dimKinds` (array of `NodeKind`), `pinned` (`IdList`) and `collapsed` (`IdList`) to `packages/schema/schema/v1.json`, all with `uniqueItems: true` and a one-line `description` each. Add `flows` to `SubtitleField` and update its description ("`flows` shows "<n> flows · <owner>"").
- [x] T007 Run `pnpm schema:generate` and commit `packages/schema/src/generated/types.ts` and `zod.ts`.
- [x] T008 [P] Add every new field (and `subtitleField: "flows"`) to the existing views in `packages/schema/examples/full.sododeck.json`. Add invalid cases to `packages/schema/test/fixtures.ts`: an unknown kind in `excludeKinds`, a duplicate id in `pinned`, a bad id pattern in `collapsed`, and `subtitleField: "flow"`. Run `pnpm --filter @sododeck/schema test` (Ajv/Zod parity green).

### Model (contract: [model-views.md](contracts/model-views.md))

- [x] T009 Write `packages/model/test/views.test.ts` (failing first) covering:
  - `resolveViews` (stored views vs presets, and array identity);
  - `baseViewId`;
  - `nextCustomTitle` (lowest unused n);
  - `viewPosition` (override in a non-base view, override in the base view, base position, undefined).
- [x] T010 Implement `packages/model/src/views.ts`: `VIEW_PRESETS` (ids `system` / `feature` / `infra`; titles "System" / "Feature" / "Infra"; subtitles `tech` / `flows` / `host`; Infra `dimKinds: ['client']`), `PRESET_VIEW_IDS`, `resolveViews`, `baseViewId`, `nextCustomTitle`. Add `viewPosition` to `packages/model/src/geometry.ts`. Export everything from `packages/model/src/index.ts`.
- [x] T011 Extend `packages/model/test/views.test.ts` with the editor-op cases:
  - materialization: the first `moveInView('infra', …)` on a deck with no views writes the 3 presets, then the change; one `undo()` undoes only the change and the 3 views stay;
  - move in Infra (materializes), `setCollapsed`, `undo()`: the move is undone, the views and the collapse stay (FR-050);
  - base-view rule: `moveInView('system', …)` writes `node.position`, `moveInView('infra', …)` writes `view.positions`, and unknown node ids are skipped;
  - base view with its own override (remove the first view so Infra becomes the base): `viewPosition` returns the override; `moveInView` there writes `node.position` and deletes the override;
  - `setPinned` adds and removes, stays unique, and throws `missing-reference` for an unknown node;
  - `updateView`: blank title → `invalid`; bad kind → `invalid`; unknown group or feature → `missing-reference`; `[]` removes the field; a title typing burst is one undo step;
  - `addView` returns an id, uses the title "Custom <n>", and appends at the end;
  - `removeView` of the last view → `invalid`;
  - after `removeView`, undo restores every field.
- [x] T012 Implement `packages/model/src/ops/views.ts` (`materializePresets`, run in its own transaction with a second, untracked origin `{ editor: 'sododeck', untracked: true }` created here, registered in `editorOrigins` but not in the `UndoManager`'s `trackedOrigins`, before the tracked change; `moveInView`, `setPinned`, `updateView`, `addView`, `removeView`). Validate before writing using the generated Zod. Store lists as `Y.Array` and remove empty lists. Wire the ops into `DeckEditor` in `packages/model/src/editor.ts` and add them to the `DeckEditor` interface with doc comments.
- [x] T013 Extend `packages/model/test/views.test.ts` with the collapse-origin cases (R5):
  - `setCollapsed` alone leaves `canUndo()` false;
  - rename a node, collapse, then `undo()`: the rename is undone and the group stays collapsed;
  - a collapse as the first view change materializes presets; nothing is undoable afterwards;
  - `removeView`, then undo, restores `collapsed`;
  - a second `Y.Doc` synced with `Y.applyUpdate` sees the collapse;
  - `observeDeck` reports origin `local` in the writing doc and `remote` in the other.
- [x] T014 Implement `setCollapsed` with the untracked origin from T012 (`packages/model/src/editor.ts`, `packages/model/src/ops/views.ts`). Materialization inside it uses the same origin.
- [x] T015 [P] Cascade and references (failing tests first in `packages/model/test/cascade.test.ts` and `integrity.test.ts`):
  - removing a node also drops it from `pinned`;
  - removing a group drops it from `excludeGroups` and `collapsed` in every view, and those views are listed in `RemovalResult.updated`;
  - `checkIntegrity` reports dangling ids in `pinned`, `excludeGroups` and `collapsed`;
  - renaming a node, group or feature keeps every view reference.

  Implement this in `packages/model/src/ops/cascade.ts`, `packages/model/src/ops/refs.ts` and `packages/model/src/integrity.ts`.

- [x] T016 [P] Add a round-trip case to `packages/model/test/round-trip.test.ts`: a deck whose views use every new field and `subtitleField: 'flows'`. Update the Yjs layout comment at the top of `packages/model/src/deck.ts`.

### UI primitives

- [x] T017 [P] Add `packages/ui/src/components/checkbox.tsx` and `radio-group.tsx`: thin wrappers of `radix-ui` `Checkbox` / `RadioGroup` with token-only styles, a visible focus ring and label association. Add tests (by role: `checkbox`, `radiogroup` / `radio`; keyboard toggling) and export them from the package index. Add them to the design gallery `apps/app/src/design-gallery/fields-section.tsx`.

### App plumbing (no visible change)

- [x] T018 Write failing tests in `apps/app/src/state/ui-store.test.ts`, then add `currentViewId: Id | null`, `revealed: ReadonlySet<Id>`, `layoutRun: { status: 'idle' | 'running' | 'slow'; viewId?: Id }`, `switchView(id)` (clears `selection`, `drill`, `focusMode` and `revealed`), `reveal(id)` and `setLayoutRun`. Reset all of them in `resetForDeck`. File: `apps/app/src/state/ui-store.ts`.
- [x] T019 Create `apps/app/src/editor/views/use-current-view.ts` (+ test):
  - `useViews()` → `resolveViews(deck)`;
  - `useCurrentView()` → the view for `currentViewId`, falling back to the first view;
  - `useIsBaseView()`;
  - `useViewActions()`, which wraps the editor view ops with the current view id: `move`, `pin`, `update`, `add`, `remove` and `setCollapsed`.
- [x] T020 Write `apps/app/src/editor/view-filter.test.ts` (failing first), then implement `apps/app/src/editor/view-filter.ts` (R7):
  - `viewFilter(deck, view, revealed)` → `{ hidden, dimmed }`, handling `includes` whitelist, `excludeGroups` with nested groups, `excludeKinds`, `excludeTags` (any tag matches), `feature` (nodes at either end of an edge used by a step of a flow with that feature), `dimKinds`, and `revealed` (never hidden);
  - `flowCountByNode(deck)`, memoized per deck identity;
  - `firstViewShowing(deck, views, nodeId)`.

  Cover each rule and a 500-node timing assertion (< 2 ms, loose).

- [x] T021 Add a `hidden: ReadonlySet<string>` argument to `visibleGraph` in `apps/app/src/editor/visible-graph.ts`. Hidden nodes are treated as absent: their edges are dropped, not merged into cards and not turned into port pills. Add `hidden` to the cache key. Extend `visible-graph.test.ts` (hidden node, hidden inside a collapsed group, hidden edge end at a scope border). Update every call site (listed in research R6/R7: `canvas.tsx`, `use-canvas-handlers.ts`, `use-canvas-shortcuts.ts`, `flows/flow-mode.ts`, `flows/step-player.tsx`, `merged-edge-popover.tsx`, `inspector/group-inspector.tsx`, `port-pill-node.tsx`, `outline.ts`) to pass the current view's `hidden`, through a `useViewFilter()` hook in `apps/app/src/editor/views/use-current-view.ts`.
- [x] T022 Add a `ViewRender` input to `toFlowNodes` in `apps/app/src/editor/deck-to-flow.ts`:
  - `position(node, index)`: `viewPosition` from the model, else `displayPosition`;
  - `subtitle(node)`: tech / host / owner / "<n> flows · <owner>" ("1 flow", "0 flows", owner omitted when empty) / none;
  - `dimmed`;
  - `pinned`.

  Put `subtitle`, `viewDimmed` and `pinned` into node `data` and the node cache key. Extend `deck-to-flow.test.ts` for every subtitle field, override vs base position, and the cache key.

- [x] T023 Route drags through the view: in `onNodesChange` in `apps/app/src/editor/use-canvas-handlers.ts`, replace `editor.update('nodes', id, { position })` with `editor.moveInView(currentViewId, positions)`, still inside `batch` and the drag gesture. Sticky moves are unchanged. Extend the canvas drag test in `apps/app/src/editor/canvas.test.tsx`: in the base view the drag writes `node.position`; in another view it writes `view.positions`; and a drag is one undo step.
- [x] T024 Add a document-identity test in `apps/app/src/editor/views/view-switcher.test.tsx` (the file is created here with just this test): opening a deck with no views and switching the current view through the store three times leaves `serializeDeck` byte-identical (FR-001, FR-005).

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` are green, and the canvas is visually unchanged on the demo deck.

---

## Phase 3: User Story 1 — Switch between System, Feature and Infra views (Priority: P1) 🎯 MVP

**Goal**: one model seen through the three presets, where an edit in any view shows in all of them.

**Independent Test**: on the demo deck, switch between System, Feature and Infra. Check subtitles, Infra dimming, the crumb and the announcement, and that a rename in Infra shows in System (spec US1 scenarios 1–5).

- [x] T025 [P] [US1] Tests in `apps/app/src/editor/deck-node.test.tsx`: the subtitle text follows `data.subtitle`; a view-dimmed node's accessible name ends with ", dimmed in this view" and it stays focusable and clickable; the subtitle is hidden at the System and Landscape levels as in 010.
- [x] T026 [US1] Implement in `apps/app/src/editor/deck-node.tsx`: render `data.subtitle` where `tech` was shown, add the `view-dimmed` class and the accessible-name suffix. Add `.view-dimmed` (opacity from a token, 0.4 per design 20) to `apps/app/src/index.css`, with a DESIGN.md token added in `packages/ui` if none exists.
- [x] T027 [P] [US1] Create `apps/app/src/editor/views/view-title.ts` (+ test) with `viewCrumbTitle(view)` → "<title> view". Replace the "System view" literals in `apps/app/src/editor/drill-crumbs.tsx`, `outline.ts` (`parentScopeTitle` gains a `view` argument) and `canvas.tsx`. Replace the duplicated `scopeTitle` in `use-canvas-shortcuts.ts` with the one from `outline.ts`. Existing tests that assert "System view" must still pass.
- [x] T028 [P] [US1] Write tests in `apps/app/src/editor/views/view-switcher.test.tsx` following [views-ui.md](contracts/views-ui.md):
  - `tablist` "Views" with tabs "System, system view", "Feature, feature view" and "Infra, infra view", with `aria-selected`;
  - ←/→, Home/End and Enter/Space;
  - a click switches views, announces "Infra view", and clears selection, drill-in and focus.
- [x] T029 [US1] Implement the tab list in `apps/app/src/editor/views/view-switcher.tsx`: a segmented tab list per design 02/20 using tokens, with a roving tabindex. On select it calls `switchView`, then `fitView` over the visible nodes with zoom clamped to 40–130% (the 010 drill-in fit), then `announce`.
- [x] T030 [US1] Mount `ViewSwitcher` in the top bar's centre slot in `apps/app/src/editor/top-bar.tsx`. `SessionChip` replaces it while a flow is being recorded or edited (design 41). Update `top-bar.test.tsx`: the switcher is shown on the canvas screen, hidden while recording, and the crumb reads "Infra view" after switching.
- [x] T031 [US1] Wire the canvas in `apps/app/src/editor/canvas.tsx`: the current view gives `viewFilter`, then `visibleGraph`, then `ViewRender`, all memoized on `[deck, view, revealed, scope, collapsed]`. Add `useViewSync`: if the current view disappears (remote delete or undo), switch to its left neighbour and announce "<title> view". Add canvas tests: Infra subtitles show host and clients are dimmed; a title edit made while in Infra shows in System (FR-015); switching doesn't write. Enable the `view-switch` bench scenario from T003.

**Checkpoint**: US1 works end to end. Quickstart scenarios 1, 2 and 4 pass.

---

## Phase 4: User Story 2 — Each view keeps its own layout (Priority: P1)

**Goal**: moves in a view stay in that view; the base view moves shared positions; undo in another view is explained.

**Independent Test**: move components in System and Infra, switch between them, reload, and undo from another view (spec US2 scenarios 1–4, FR-045).

- [x] T032 [P] [US2] Canvas tests in `apps/app/src/editor/canvas.test.tsx`:
  - a move in Infra doesn't change System;
  - a node never moved in Infra shows at its base position;
  - a move in System moves the node in Feature when Feature has no override;
  - after a reload (re-create the deck from `toJSON`), both views keep their positions.
- [x] T033 [P] [US2] Tests in `apps/app/src/editor/views/undo-context.test.ts` for `describeUndo(changes, currentViewId)`: only `views` changes for one other view → `{ viewId, action }`, with action `move` / `pin` / `rename` / `view settings` / `change` from the changed keys; changes that include `nodes` or touch the current view → null.
- [x] T034 [US2] Implement `apps/app/src/editor/views/undo-context.ts`: `describeUndo` plus `useUndoAcrossViews()`, which subscribes to `observeDeck` for origin `undo` / `redo` and shows the toast "Undid <action> in <title>" (or "Redid …") with the action "Go to <title>" (calls `switchView`), and announces the same text. Mount it in the editor shell next to `useSelectionSync` in `apps/app/src/editor/canvas.tsx`. Add a component test: a move in Infra, switch to System, ⌘Z → the toast appears, and "Go to Infra" switches.

**Checkpoint**: quickstart scenarios 3, 5 and 13 pass.

---

## Phase 5: User Story 3 — Tidy the layout without losing pinned components (Priority: P1)

**Goal**: pin components per view, and arrange everything else automatically off the main thread in one undo step.

**Independent Test**: on a 200-node deck with 5 pins, run Tidy layout; measure time and responsiveness; check the pins, groups, overlaps and a one-step undo (spec US3 scenarios 1–7).

### Pins

- [x] T035 [P] [US3] Tests in `apps/app/src/editor/deck-node.test.tsx`: a pinned node shows an `img` "Pinned" at every level except Landscape, and its name contains ", pinned".
- [x] T036 [US3] Implement the pin glyph in `apps/app/src/editor/deck-node.tsx` using lucide `Pin`, positioned per the tokens.
- [x] T037 [P] [US3] Tests in `apps/app/src/editor/inspector/node-inspector.test.tsx` and `apps/app/src/editor/canvas-toolbar.test.tsx`:
  - `switch` "Pin position" pins and unpins in one undo step;
  - a mixed multi-selection shows the mixed state and toggling pins all;
  - the toolbar `button` "Pin" / "Unpin" (`aria-pressed`) appears when the selection has nodes;
  - dragging a pinned node keeps it pinned.
- [x] T038 [US3] Implement the "Pin position" switch in `apps/app/src/editor/inspector/node-inspector.tsx` and the Pin/Unpin toggle in `apps/app/src/editor/canvas-toolbar.tsx`, both through `useViewActions().pin`.

### Layout engine (worker)

- [x] T039 [P] [US3] Tests in `apps/app/src/layout/elk-layout.test.ts` (Node environment):
  - `applyPins`: pinned ids end exactly at their positions; no unpinned box overlaps a pinned box or another unpinned box; the result is deterministic;
  - `computeLayout` with groups: every group's members form one contiguous bounding box that overlaps no other group's box;
  - a collapsed card is laid out as one node;
  - 200 nodes, 400 edges and 5 pins finish in < 2 s (loose CI bound).
- [x] T040 [US3] Extend `apps/app/src/layout/elk-layout.ts` (R9):
  - `LayoutRequest` gains `groups: { id; parent? }[]`, `parent?` on nodes and `pinned: Record<string, { x; y }>`;
  - groups become ELK compound nodes with `elk.hierarchyHandling: INCLUDE_CHILDREN` and padding matching `groupBounds`;
  - add a pure `applyPins(result, request)`: translate by the median pin offset, restore pins exactly, then run a deterministic overlap sweep that pushes unpinned boxes right, then down;
  - remove the `TODO(M4)`.
- [x] T041 [US3] Add cancellation to `apps/app/src/layout/layout-client.ts`: `cancel()` terminates the worker and rejects pending calls with a `LayoutCancelled` error. The next `layout()` recreates the worker lazily.

### Orchestration and UI

- [x] T042 [P] [US3] Tests in `apps/app/src/editor/tidy-layout.test.ts` for `buildLayoutRequest(deck, graph, view)`: it includes only visible nodes of the current scope; hidden nodes aren't sent; a collapsed group is one node of `COLLAPSED_CARD_SIZE` and its members receive the card's delta in `expandResult`; pinned positions come from the view's pins at their displayed positions; node sizes follow `canvas-geometry`.
- [x] T043 [US3] Implement `apps/app/src/editor/tidy-layout.ts`: `buildLayoutRequest`, `expandResult`, and `useTidyLayout()`:
  - create the client on first use;
  - set `layoutRun` to `running`, then `slow` after 500 ms;
  - on the result, apply with one `editor.batch(() => moveInView(viewId, positions))`, skipping ids that were deleted or pinned in the meantime;
  - `fitView`, then announce "Layout tidied, <n> components moved";
  - Cancel → `client.cancel()` and announce "Layout cancelled".
- [x] T044 [P] [US3] Tests in `apps/app/src/editor/canvas-toolbar.test.tsx`:
  - `button` "Tidy layout" is present;
  - it's disabled with the tooltips "Not available while a flow is open", "Nothing to arrange" and "All components are pinned";
  - the `progressbar` "Tidying layout" and `button` "Cancel layout" appear after 500 ms (fake timers, mocked client);
  - after the result, one ⌘Z restores every previous position;
  - while drilled in, only the scope's members move.
- [x] T045 [US3] Implement the Tidy layout button, progress bar and Cancel in `apps/app/src/editor/canvas-toolbar.tsx` using lucide `LayoutGrid`. Enable the `tidy-layout-200` and `pan-during-layout` bench scenarios from T003.

**Checkpoint**: quickstart scenarios 9 and 10 pass. Record the bench numbers for SC-001 and SC-002.

---

## Phase 6: User Story 4 — Create and manage custom views (Priority: P2)

**Goal**: add, rename, configure and delete views; hidden components remain findable.

**Independent Test**: create "Custom 1", rename it, hide a group, a kind and a tag, use ⌘K on a hidden component, then delete the view and undo from the toast (spec US4 scenarios 1–6, FR-016).

- [x] T046 [P] [US4] Tests in `apps/app/src/editor/views/view-switcher.test.tsx`:
  - `button` "Add view" adds "Custom 1", selects it and shows the toast `View "Custom 1" created`; a second click adds "Custom 2";
  - on the first add to a deck with no views, `views` holds 4 entries;
  - the overflow menu "More views" appears when tabs don't fit (mock `ResizeObserver`), and the current tab stays visible;
  - without `ResizeObserver`, every tab is shown.
- [x] T047 [US4] Implement "Add view" and the overflow handling in `apps/app/src/editor/views/view-switcher.tsx` (`supportsResizeObserver` from `apps/app/src/lib/features.ts`).
- [x] T048 [P] [US4] Tests in `apps/app/src/editor/views/view-tab-menu.test.tsx`:
  - the menu opens by right-click, `button` "View options for <title>" and Shift+F10;
  - Rename, by double-click or menu, is a `textbox` "View name": Enter commits, Esc cancels, and blank input shows "A view needs a name" and keeps the title;
  - Delete view opens `alertdialog` 'Delete view "<title>"?'; after confirming, the Undo toast `View "<title>" deleted` restores the view with its settings;
  - Delete view is disabled on the last view, with the tooltip "A deck needs at least one view";
  - deleting the current view selects the view on its left.
- [x] T049 [US4] Implement `apps/app/src/editor/views/view-tab-menu.tsx` (`DropdownMenu` + `ContextMenu` from `@sododeck/ui`, `InlineEdit` for the rename, `ConfirmDeleteDialog` pattern, `useUndoToast`) and wire it into `view-switcher.tsx`.
- [x] T050 [P] [US4] Tests in `apps/app/src/editor/views/view-settings-popover.test.tsx`:
  - `dialog` "View settings: <title>";
  - `radiogroup` "Subtitle" with 5 options;
  - the groups "Hide groups", "Hide kinds", "Hide tags" and "Dim kinds" list only kinds and tags used in the deck (plus any already chosen);
  - `combobox` "Feature" offers "All features" or a feature, and shows "(deleted)" for a deleted feature;
  - each change is one undo step and updates the canvas (a hidden group's nodes and their edges disappear only in this view);
  - Esc returns focus to the tab.
- [x] T051 [US4] Implement `apps/app/src/editor/views/view-settings-popover.tsx` (`Popover`, `RadioGroup`, `Checkbox`, `Select`) through `useViewActions().update`. Open it from "View settings…" in the tab menu.
- [x] T052 [P] [US4] Revealed-node rule: a test in `apps/app/src/editor/canvas.test.tsx` where a node is created (palette drop) while its kind is hidden in the current view. It stays visible with the note "Hidden in this view" until the view is switched, and then it's hidden. Implement it by calling `reveal(id)` from the node-creation path in `apps/app/src/editor/canvas-actions.ts`, and render the note in `deck-node.tsx`.
- [x] T053 [P] [US4] Tests in `apps/app/src/editor/command-palette/palette-results.test.ts` and `open-result.test.ts`:
  - a hidden node's result meta ends with " · Hidden in this view";
  - choosing it keeps the view, selects nothing, and shows the toast "<title> is hidden in this view" with `button` "Show in System" (focused; Enter switches views and selects the node);
  - when no view shows the node, the toast reads "<title> is hidden in every view" with no action.
- [x] T054 [US4] Implement FR-016: `buildPaletteResults` takes `hidden`, `openResult` gets `isHidden` / `firstViewShowing` in its context, and the toast is added in `apps/app/src/editor/command-palette/open-result.ts`. Pass the values from `apps/app/src/editor/command-palette/command-palette.tsx`.

**Checkpoint**: quickstart scenarios 6, 7 and 8 pass.

---

## Phase 7: User Story 5 — Collapse state is remembered per view (Priority: P3)

**Goal**: 010's collapse moves from the UI store into each view. It's saved and synced, but never an undo step.

**Independent Test**: collapse different groups in two views, switch, reload, undo and use two tabs (spec US5 scenarios 1–5).

- [x] T055 [P] [US5] Tests (failing first) in `apps/app/src/editor/views/use-current-view.test.ts`:
  - `useCollapsed()` returns the current view's `collapsed` as a `ReadonlySet`, with the same identity while the array is unchanged;
  - `useViewActions().setCollapsed` writes to the current view.

  In `apps/app/src/editor/canvas.test.tsx`:
  - collapse in System, then switch to Infra: expanded;
  - reload: still collapsed in System;
  - rename then collapse, then ⌘Z: the rename is undone and the group stays collapsed;
  - the JSON panel's Deck tab shows the group id in `views[0].collapsed` and nothing on the group.

- [x] T056 [US5] Remove `collapsed`, `setCollapsed`, `toggleCollapsed` and `expandAll` from `apps/app/src/state/ui-store.ts` (and their tests). Add `useCollapsed()` to `apps/app/src/editor/views/use-current-view.ts`. Replace every reader and writer with `useCollapsed()` / `useViewActions().setCollapsed`: `canvas.tsx`, `use-canvas-handlers.ts`, `use-canvas-shortcuts.ts`, `group-boundary-node.tsx`, `collapsed-group-node.tsx`, `merged-edge-popover.tsx`, `inspector/group-inspector.tsx`, `port-pill-node.tsx`, `flows/flow-mode.ts`, `flows/step-player.tsx` and `outline.ts`. Keep `pruneView` for `drill` only. All 010 tests must stay green.
- [x] T057 [US5] Multi-tab test in `apps/app/src/editor/canvas.test.tsx` (two docs linked by update exchange, as in the existing tab-sync tests in `apps/app/src/storage`): a collapse in one shows in the other on the same view. Update the `groups-collapsed` and `collapse-toggle` bench scenarios in `apps/app/bench/perf.bench.ts` to collapse through the view.

**Checkpoint**: quickstart scenarios 11 and 12 pass. The 010 bench scenarios show no regression.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T058 [P] Accessibility pass: an axe check in the component tests for the switcher, tab menu, settings popover and toolbar (Tidy and Pin), in light and dark themes (SC-007); keyboard-only run of quickstart scenario 14.
- [x] T059 Run `pnpm bench` and save `specs/011-views-autolayout/bench-after.md` with before/after numbers for every scenario, including the new ones (SC-001–SC-003) and the 010 ones (no regression below 60 fps).
- [x] T060 Bundle check: `pnpm --filter @sododeck/app build`, then confirm that `elkjs` appears only in the layout worker chunk (list the chunks in the report).
- [x] T061 Visual check: screenshots at 1440×900, light and dark, next to `docs/design/screens/02-*`, `20-*`, `21-*` and `22-*`, in `specs/011-views-autolayout/visual-check.md`. Add separate screenshots of the undesigned parts (settings popover, Tidy button with its progress bar, pin glyph) for founder approval.
- [x] T062 [P] Docs:
  - `packages/model/CLAUDE.md` ("Added by 011": views API, untracked collapse origin, cascade);
  - `apps/app/CLAUDE.md` (map: `editor/views/`, `tidy-layout.ts`, `view-filter.ts`; rules: the current view is UI state, collapse is document data, drags go through `moveInView`);
  - `packages/ui/CLAUDE.md` (`Checkbox`, `RadioGroup`);
  - `.agents/skills/react-flow/SKILL.md` (the view filter feeding the visible graph, and `ViewRender`).
- [ ] T063 Run the definition-of-done commands: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix anything they report. Then run quickstart scenario 15 (export and re-import).
- [ ] T064 Final report: what changed, what was skipped, what is uncertain (approval of the undesigned parts, layout quality on unusual decks), bench numbers, and a proposal for the next step (012 export or 018).

---

## Dependencies & Execution Order

- **Setup (T001–T005)** → **Foundational (T006–T024)** → user stories.
- Inside Foundational: schema (T006–T008), then model (T009–T016), then app plumbing (T018–T024). T017 (UI primitives) is independent, and is needed only by US4 (T051).
- **US1 (Phase 3)** depends only on Foundational. It is the MVP.
- **US2 (Phase 4)** depends on Foundational. T034 needs the switcher from US1 to be useful manually, but its tests stub `switchView`.
- **US3 (Phase 5)** depends on Foundational. Its toolbar tasks touch `canvas-toolbar.tsx` after US1's changes, so run them after Phase 3 or merge carefully.
- **US4 (Phase 6)** depends on US1 (the switcher and tab list) and T017.
- **US5 (Phase 7)** depends on Foundational (T014 `setCollapsed`). It touches many 010 files, so do it in one commit.
- **Polish** comes after the stories that are delivered.

### Parallel opportunities

- **Setup:** T005 alongside T002–T004.
- **Foundational:** T008 ∥ T009; T015 ∥ T016 ∥ T017 once T012 lands; T020 ∥ T022 (different files).
- **US1:** T025 ∥ T027 ∥ T028 (tests and helpers in different files).
- **US3:** T035 ∥ T037 ∥ T039 ∥ T042 ∥ T044 (tests), then T040 ∥ T041 (engine) alongside T036 and T038.
- **US4:** T046 ∥ T048 ∥ T050 ∥ T052 ∥ T053.
- **Across stories:** after Phase 3, US3 (layout) and US4 (management) can proceed in parallel with two agents; they share only `canvas-toolbar.tsx` (US3) versus `view-switcher.tsx` (US4).

### Parallel example (US3)

```text
Agent A: T039 → T040 → T041            (apps/app/src/layout/*)
Agent B: T042 → T043                    (apps/app/src/editor/tidy-layout.ts)
Agent C: T035 → T036, T037 → T038       (deck-node, node-inspector, toolbar pin)
then:    T044 → T045                    (toolbar Tidy button, bench)
```

## Implementation Strategy

1. **MVP**: Phases 1–3. The three presets with subtitles, dimming, crumbs and edits propagating. Ship behind nothing; with no view writes on open, this is safe.
2. **Increment 2**: US2 + US3 (per-view layout, pins, Tidy layout), which covers every P1 story in the spec. Bench SC-001 to SC-003.
3. **Increment 3**: US4 (custom views, settings, search on hidden components).
4. **Increment 4**: US5 (per-view collapse), then Polish.

Stop after each checkpoint, run `pnpm lint && pnpm typecheck && pnpm test`, and commit.
