# Tasks: Canvas-First Layout

**Input**: design documents in `specs/018-canvas-first-layout/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the Clarifications of 2026-09-28 (§g-49, §g-50 defaults accepted).
- [research.md](research.md) (R1–R15) and [data-model.md](data-model.md).
- [contracts/shell-ui.md](contracts/shell-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for unit tests (Vitest) for every pure module and store, and component tests (Testing Library, by role and name, following [shell-ui.md](contracts/shell-ui.md)). Write each test first and watch it fail. Do not add Playwright tests; update only the smoke suite's selectors.

**Scope guards**:

- No change to `packages/schema` or `packages/model`. No document writes from shell state; shell state never enters Yjs, the file or undo history (FR-042).
- Panels are **moved, not rewritten**: `Palette`, `OutlineTree`, `NotesOutline`, `FlowList`, `FlowPanel`, `ProblemsPanel`, `Inspector` (and its sub-inspectors), `JsonPanel`, `ViewSwitcher`, `SaveStatus`, `DrillCrumbs`, `StepPlayer` keep their behaviour.
- JSON stays read-only (§g-42). The rule editor screen and the library keep their layouts.
- Out of scope: selection toolbar, inline card title, card details button, context menu (019); group from selection, align, nudge, snap (016); resize and routing (017); Appearance and colours (020).

**Approvals**: no new runtime dependency. One Complexity Tracking item, **approved by the founder (2026-09-28)**: the Group rail button is shown `aria-disabled` until 016.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US7 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to the code (`*.test.ts(x)`). New shell code in `apps/app/src/editor/shell/`. Harnesses in `apps/app/src/test/` (`render-canvas.tsx` `editorWrapper` / `deckOf`, `render-inspector.tsx`, `render-flows.tsx`). Read `apps/app/CLAUDE.md` first; canvas recipes are in `.agents/skills/react-flow/SKILL.md`.
- **UI**: `packages/ui/src/…`. Read `packages/ui/CLAUDE.md` first (tokens only, no `dark:`).
- **Shortcuts**: "⌘" means ⌘ on Apple platforms and Ctrl elsewhere (`isMod`, `isApplePlatform` in `apps/app/src/lib/features.ts`). Single-letter keys are ignored in text targets (`apps/app/src/lib/is-text-target.ts`).
- **Commits**: after each task or logical group, Conventional Commits (`feat(app): …`, `feat(ui): …`, `test(app): …`, `docs: …`), no AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Create branch `018-canvas-first-layout` from the latest `main`. Run `pnpm install && pnpm test` to confirm a green start.
- [x] T002 Run `pnpm bench` on the unchanged code and save the table in `specs/018-canvas-first-layout/bench-before.md`.
- [x] T003 Add the `drawer-open-pan` scenario to `apps/app/bench/perf.bench.ts` (R14): on the 500 / 1,000 deck, select a node, open the details drawer and the JSON panel, then measure pan fps (SC-006). Until the drawer exists (T045) and ⌘J exists (T058), it logs `TODO(018): not available yet` and records no number (not a skipped test). Note that the "inspector title edit → canvas" scenario will need the drawer opened first (T046).
- [x] T004 [P] Write ADR `docs/decisions/0014-canvas-first-shell.md` in the header format of 0013, covering R1 (full-bleed canvas + pointer-transparent overlay layer; step player stays a React Flow panel), R2 (top bar only on the rule editor), R3 (shell slice in the UI store; per-deck prefs in `localStorage["sododeck.shell.<deckId>"]`, not synced, removed on purge; JSON hidden by default), R4 (one flyout + one pinned, swap and return), R5 (drawer on request, pan-to-clear), R7 (F6 regions and new keys, `event.code` for ⌥1/⌥2/⇧1/⇧2), R8 (tools with today's operations; Group disabled until 016, founder-approved), and the alternatives listed in research.

---

## Phase 2: Foundational (blocks every user story)

### Tokens

- [x] T005 [P] Add `--sd-dur-overlay: 120ms` (0ms under `prefers-reduced-motion: reduce`) to `packages/ui/src/styles/tokens.css`, `MOTION.overlayMs` to `packages/ui/src/lib/motion.ts`, and extend the existing CSS ↔ TS parity test in `packages/ui/test/`. Add one reusable overlay-enter utility (fade + 4 px slide using `duration-(--sd-dur-overlay)`) in `packages/ui/src/styles/theme.css` or the app's `apps/app/src/index.css`, whichever already holds animation utilities.

### Pure modules (write tests first)

- [x] T006 [P] `apps/app/src/editor/shell/shell-geometry.ts` + `shell-geometry.test.ts` (data-model "Derived"): constants (island height 44, edge 12, rail width 48, rail left 12, flyout left 68 / top 68 / width 280, drawer top 68 / right 12 / bottom 12, drawer min 320 / default 360 / max 560, JSON left 68 / bottom 12); `islandRects(viewport)`, `chromeCoverage(viewport, rects)` (assert ≤ 0.08 at 1440×900 with nothing open, FR-003), `drawerRect(viewport, width)`, `clampDrawerWidth(px, viewportWidth, compact)` (compact: ≤ 35 % of the viewport but ≥ 320), `jsonRect(viewport, height, drawerWidth | null)`, `zoomIslandBottom(jsonOpen, jsonHeight)`, `panToClear(selectionRect, obstacle: {left?: number; right?: number}, margin = 24)` → `{ dx }` (0 when already clear).
- [x] T007 [P] `apps/app/src/editor/shell/regions.ts` + `regions.test.ts` (R7): `REGION_ORDER = ['deck','tools','rail','history','canvas','zoom','drawer']`, `type RegionId`, `visibleRegions({ hideUi, drawerOpen })`, `nextRegion(current: RegionId | null, visible, direction: 1 | -1)` with wrap-around and hidden regions skipped; under Hide UI the order is `canvas` ↔ `show-ui`.
- [x] T008 [P] `apps/app/src/editor/shell/shell-prefs.ts` + `shell-prefs.test.ts` (data-model "Per-deck preferences"): `ShellPrefs { drawerWidth; pinnedFlyout; jsonOpen }`, `DEFAULT_SHELL_PREFS` (`360`, `null`, `false`), `shellPrefsKey(deckId)` = `sododeck.shell.<deckId>`, `readShellPrefs(raw)` validating field by field (unknown flyout ids → `null`, width clamped 320–560), `loadShellPrefs(deckId | null)` (null → defaults, blocked storage → defaults), `saveShellPrefs(deckId | null, prefs)` (no-op for null, best-effort), `removeShellPrefs(deckId)`. Mirror the style of `apps/app/src/state/json-panel-prefs.ts`.
- [x] T009 [P] `apps/app/src/editor/shell/shortcuts.ts` + `shortcuts.test.ts` (R9): one `SHORTCUTS` table `{ id, label, section: 'Canvas' | 'Tools' | 'Panels' | 'Flows' | 'JSON', keys: { apple: string; other: string } }` covering every key in contract "Rail", "Zoom island", "Hide UI", F6/⇧F6, ⌘J, ⌘⇧D, 1–6, plus the existing ones (⌘K, ⌘Z/⇧⌘Z, ⌘S, ⌘., arrows, Enter, Space, E, F, N, Delete, Esc, playback keys). `shortcutLabel(id)` returns the platform string. Tests: ids unique, no two actions share the same key in the same section, every rail item id has an entry.
- [x] T010 [P] Add `supportsMatchMedia()` to `apps/app/src/lib/features.ts` with a case in `features.test.ts`.

### UI store shell slice

- [x] T011 Extend `apps/app/src/state/ui-store.ts` (+ `ui-store.test.ts`) with the `shell` fields and actions of data-model.md: `flyout`, `pinnedFlyout`, `drawer { open, width, mode }`, `drawerReturn`, `hideUi`, `minimap`, `tool`, `helpOpen`; `openFlyout`, `closeFlyout`, `dismissFlyout`, `togglePin`, `openDrawer(mode?)`, `closeDrawer`, `toggleDrawer`, `setDrawerWidth(px, { commit })`, `setHideUi`, `setMinimap`, `setTool`, `setHelpOpen`. `resetForDeck(deckId: string | null)` reads `loadShellPrefs` into `pinnedFlyout`, `flyout`, `drawer.width` and `jsonShown`, and resets the session-only fields. `togglePin`, `setDrawerWidth({ commit: true })` and `setJsonShown` / `toggleJsonShown` write `saveShellPrefs` for the current deck id (keep it in the store as `shellDeckId`). Drawer auto-close: when `select`, `clearSelection` or `pruneSelection` leave the selection empty and `drawer.mode === 'selection'`, close it. Tests: every transition table row in data-model.md, Hide UI keeps other fields, prefs round-trip, auto-close, deck mode ignores empty selection.
- [x] T012 Keep `apps/app/src/state/json-panel-prefs.ts` unchanged: its `open` is 004's expanded / collapsed state. The overlay's visibility is a new store field `jsonShown` (default hidden) saved per deck as `ShellPrefs.jsonOpen` (`setJsonShown`, `toggleJsonShown`). Update the call in `apps/app/src/routes/editor-page.tsx` `EditorShell` to `resetForDeck(data.kind === 'stored' ? data.deckId : null)`.
- [x] T013 In `apps/app/src/storage/library-db.ts` `purgeDeleted`, call `removeShellPrefs(id)` for each purged deck (+ a case in its test). Keep `src/library/` free of `yjs` / model imports (the prefs module has none).

### Shell skeleton (no visible change yet)

- [x] T014 Create `apps/app/src/editor/shell/canvas-shell.tsx` (+ `canvas-shell.test.tsx`): a `relative h-dvh overflow-hidden bg-canvas` container; the canvas in `absolute inset-0`; a sibling overlay layer `pointer-events-none absolute inset-0` whose children opt in with `pointer-events-auto`. Named slots for deck, tools, rail, history, zoom, flyout, drawer, json, show-ui. Each region container gets `data-region` and `tabIndex={-1}`. Test: the canvas element's size does not change when slot content toggles (mock `getBoundingClientRect`; assert the canvas container has no size-dependent props) and a pointer event on empty overlay space reaches the canvas.

**Checkpoint**: pure modules and the store slice are green; nothing user-visible has changed.

---

## Phase 3: User Story 1 — Work on a large diagram with the whole screen (Priority: P1) 🎯 MVP

**Goal**: the canvas fills the window; the deck, tools, history and zoom islands float over it; every control from the old top bar and canvas toolbar is reachable.

**Independent test**: at 1440×900 with nothing open, the canvas reaches all edges and chrome ≤ 8 %; rename, save status, views, Tidy layout, Jump to, Labels, Notes, Focus, theme, Export, zoom and fit all work from the islands.

**Transition note**: until US2 and US3 land, `LeftSidebar` and `Inspector` render as temporary overlays in the flyout and drawer slots (always open, same widths as today) so no function is lost; the JSON panel renders in the json slot with today's open state. US2 / US3 / US4 replace them.

### Tests first

- [x] T015 [P] [US1] `apps/app/src/editor/shell/deck-island.test.tsx`: contract "Deck island" — `toolbar` "Deck"; "Deck menu" button opens a `menu` with "All decks", "Import…", "Export…", "Deck settings", "Show JSON"; "Rename deck" → `textbox` "Deck name" (Enter commits one undo step, Esc cancels, empty keeps the name); save status names for saving / saved / failed and the error popover; views `tablist` present; Flow chip "Exit flow <name>" in flow mode (exits); session chip replaces the views during a recording; drill breadcrumb present when drilled.
- [x] T016 [P] [US1] `apps/app/src/editor/shell/tools-island.test.tsx`: `toolbar` "Tools" with "Jump to… (⌘K)" (opens the command palette), "Labels" (`aria-pressed` toggles), "Notes: dimmed" menu (radio items Dimmed / Shown / Hidden, available outside flow mode too), "Focus" (`aria-pressed`, disabled with reason in flow mode), theme switch, "Export".
- [x] T017 [P] [US1] `apps/app/src/editor/shell/zoom-island.test.tsx`: `toolbar` "Zoom" with "Fit diagram", "Fit selection" (disabled without selection), "Zoom out", "Zoom in", level indicator, "Minimap" (`aria-pressed`, shows `Minimap` region when on), "Keyboard shortcuts" (opens the dialog stub from T025).
- [x] T018 [P] [US1] `apps/app/src/editor/save-status.test.tsx`: add the icon-only variant (§g-51): accessible name and tooltip equal today's words; the icon differs by shape per state (check / loader / alert, not colour only); reduced motion → loader has no spin class; error opens the popover.
- [x] T019 [P] [US1] `apps/app/src/editor/views/view-tab-menu.test.tsx`: the views menu offers "Tidy layout" (runs `useTidyLayout`, disabled with the `useTidyBlock` reason, shows the slow progress + "Cancel layout" as today) and "View settings…" (§g-46).

### Implementation

- [x] T020 [US1] `apps/app/src/editor/shell/deck-island.tsx` + `deck-menu.tsx`: move `DeckNameCrumb` out of `top-bar.tsx` (export it from a new `apps/app/src/editor/deck-name.tsx` so both use it), `SaveStatus` (icon variant, T021), `ViewSwitcher`, `SessionChip`, the flow-mode chip (`flows/flow-mode-chip.tsx`, restyled as "Flow · <name>" with ×) and `DrillCrumbs` as a chip. The menu uses `DropdownMenu`: "All decks" (link to `/`), "Import…" (the existing import entry — reuse the library import action through navigation to `/` with the import dialog, or the command palette's import command if present; do not add a new import path), "Export…" (`useExportDeck`), "Deck settings" (`openDrawer('deck')`), "Show JSON" / "Hide JSON" (`toggleJsonPanel`, hint from `shortcutLabel`).
- [x] T021 [P] [US1] `apps/app/src/editor/save-status.tsx`: add `variant="icon"` (check / `LoaderCircle` with `motion-safe:animate-spin` / `CircleAlert` in Clay), `Tooltip` with the same words, same live-region announcements; keep the text variant for the rule editor's top bar.
- [x] T022 [P] [US1] `apps/app/src/editor/views/view-tab-menu.tsx` (and `view-switcher.tsx` if the menu trigger lives there): add "Tidy layout" and "View settings…" items; move `TidyLayoutControl`'s run / cancel / progress logic from `canvas-toolbar.tsx` into a small `apps/app/src/editor/views/tidy-layout-item.tsx` used by the menu (the slow-state progress bar + "Cancel layout" render next to the views control while running).
- [x] T023 [US1] `apps/app/src/editor/shell/tools-island.tsx`: the Jump to button (moved from `top-bar.tsx`), Labels and Focus toggles and the Notes menu (moved from `canvas-toolbar.tsx`; Notes shown always, §g-46), theme toggle (moved from `top-bar.tsx`), Export (`useExportDeck`, primary). Move `PinToggle` to the node inspector header actions in `apps/app/src/editor/inspector/node-inspector.tsx` if it is not already there (011's inspector switch may already cover it — then drop the toolbar copy only).
- [x] T024 [US1] `apps/app/src/editor/shell/history-island.tsx`: move `HistoryButtons` from `top-bar.tsx` into a `toolbar` "History" positioned 8 px below the rail slot.
- [x] T025 [US1] `apps/app/src/editor/shell/zoom-island.tsx`: move `ZoomControl`'s content (−, %, +, `LevelIndicator`, fit) from `zoom-control.tsx` (keep `MIN_ZOOM` / `MAX_ZOOM` exported from there), add "Fit selection" (`fitView({ nodes: selected, padding: 0.2 })`), "Minimap" (`setMinimap`), "Keyboard shortcuts" (`setHelpOpen(true)`). Add `apps/app/src/editor/shell/shortcut-help-dialog.tsx` rendering `SHORTCUTS` grouped by section as a `table` per `heading` inside `Dialog` "Keyboard shortcuts" (+ `shortcut-help-dialog.test.tsx`: every section heading and a sample row per section).
- [x] T026 [US1] `apps/app/src/editor/canvas.tsx`: remove the `CanvasToolbar` and `ZoomControl` `<Panel>`s; render `MiniMap` only when `shell.minimap` (positioned above the zoom island via its `style` bottom / right from `shell-geometry`); keep `StepPlayer` in `Panel position="bottom-center"`; keep `EmptyCanvasCard` centred. Its "Add component" action becomes `openFlyout('palette')` (US2 wires the flyout; until then it keeps today's behaviour).
- [x] T027 [US1] `apps/app/src/routes/editor-page.tsx`: `CanvasScreen` renders `CanvasShell` with the islands, the canvas, and (transition) `LeftSidebar` in the flyout slot, `Inspector` in the drawer slot and `JsonPanel` in the json slot. `EditorChrome` renders `TopBar` only when `screen === 'rules'`, and the grid becomes `h-dvh` for the canvas screen. Remove the canvas-only branches from `apps/app/src/editor/top-bar.tsx` (view switcher, Rules link, drill crumbs, Export, Jump to, history) and update `top-bar.test.tsx` to the rule-editor-only bar.
- [x] T028 [US1] Selection frame (R12): `apps/app/src/editor/selection-frame.tsx` draws a 2 px Deck Orange outline 2 px outside each selected card (single selection included); `apps/app/src/editor/deck-node.tsx` drops the selected border + halo (flow-step styling unchanged). Update `deck-node.test.tsx` (selected state still exposed via `aria-selected` / the node's accessible state, not by class).
- [x] T029 [US1] Delete `apps/app/src/editor/canvas-toolbar.tsx` and `canvas-toolbar.test.tsx` once T022, T023 and US2's Problems button (T037) cover every control; until T037 lands, move `ProblemsButton` temporarily into the tools island. Update `apps/app/src/routes/editor-page.test.tsx` for the new placement.
- [x] T030 [US1] Update the smoke suite selectors in `apps/app/tests/e2e/smoke.spec.ts` for this phase (the Outline / Inspector complementary regions still exist as transitional overlays; keep assertions passing). Run `pnpm e2e`.

**Checkpoint**: full-bleed canvas, islands working, old panels still reachable as transitional overlays. Commit.

---

## Phase 4: User Story 2 — Open the outline, flows, rules or palette from the rail (Priority: P1)

**Goal**: the left rail with tools and panel launchers; flyouts beside it, one at a time, pinnable, returning when a temporary one closes.

**Independent test**: open each flyout; only one at a time; Esc / outside click close unpinned ones; pinned outline survives canvas drags and returns after the palette closes; 1–6 add components; flows flyout enters flow mode with the chip.

### Tests first

- [x] T031 [P] [US2] `apps/app/src/editor/shell/rail.test.tsx`: contract "Rail" — `toolbar` "Canvas tools" (vertical); every item's accessible name; tooltip text "<name> <shortcut>" after focus (fake timers, 400 ms); tool buttons `aria-pressed` follow `tool`; panel buttons `aria-expanded` + `aria-controls`; "Group" is `aria-disabled` with tooltip "Group from selection — coming soon" and does nothing on click / G; "Problems, <n>" with a badge only when n > 0; "Search" opens the command palette.
- [x] T032 [P] [US2] `apps/app/src/editor/shell/flyout.test.tsx`: `dialog` (non-modal) named by title; focus moves to the first control on open; "Pin <title>" `aria-pressed`; "Close <title>"; Esc with a non-empty filter clears it first, then closes (focus → rail button); pinned + Esc moves focus to the rail button without closing; pointer down on the canvas closes an unpinned flyout and still reaches the canvas; announcements "<title> opened / closed / pinned".
- [x] T033 [P] [US2] `apps/app/src/editor/shell/flyouts.test.tsx`: swap (outline → flows), pin-and-return (pinned outline, open palette, close → outline back), flows flyout shows `FlowPanel` in flow mode / during a session and `FlowList` otherwise, a recording session auto-opens and pins Flows and restores the previous pin after Done / Cancel, palette keys 1–6 add a component of that kind at the view centre only while the palette is open (and not in a text field), rules flyout lists rules and "Open rule editor" navigates, problems flyout shows `ProblemsPanel` and ⌘. still walks problems.
- [x] T034 [P] [US2] `apps/app/src/editor/use-canvas-shortcuts.test.tsx`: C with no focused card → `openFlyout('palette')`; C with one focused card → connect popover (unchanged); V / S / L set the tool; G does nothing; Sticky tool: next pane click adds a note at that point and resets to Select; Connector tool: next node click opens its connect popover and resets; Esc resets the tool.

### Implementation

- [x] T035 [US2] `apps/app/src/editor/shell/rail-button.tsx` + `rail.tsx`: 38×38 buttons (18 px icons, `ICON_STROKE_WIDTH`), dividers, `Tooltip` (400 ms delay, label + Mono shortcut from `shortcutLabel`), items per contract (lucide: `MousePointer2`, `Plus`, `StickyNote`, `Group`, `Spline`, `ListTree`, `Workflow`, `Table2`, `Search`, `TriangleAlert`). Active tool / open flyout: Orange Soft + Orange Ink (tokens).
- [x] T036 [US2] `apps/app/src/editor/shell/flyout.tsx` (frame: header 46 with title, "Pin", "Close"; body scroll; overlay-enter motion; Esc and outside-pointer handling via a `pointerdown` listener on the canvas container that calls `dismissFlyout`) and `flyouts.tsx` (content switch): palette → `Palette`; outline → `OutlineTree` + `NotesOutline` (moved from `left-sidebar.tsx`'s outline tab, with the `Components · n` section label); flows → `FlowPanel` when `flowSession !== null || activeFlow !== null`, else `FlowList`; rules → `rules-list.tsx`; problems → `ProblemsPanel`.
- [x] T037 [P] [US2] `apps/app/src/editor/shell/rules-list.tsx` (+ `rules-list.test.tsx`): rule titles from the snapshot (sorted as the rule editor's list), count in the title, rows open `ruleNav.openRules(id)`, "New rule" → `openRules(undefined, { newRule: true })`, "Open rule editor" → `openRules()`. `apps/app/src/editor/problems/problems-button.tsx`: becomes the rail's Problems item behaviour (`openFlyout('problems')` then `focusFirstProblem`), waiting for a session to end as today; remove its temporary tools-island placement from T029.
- [x] T038 [US2] Recording session auto-open (R4): in `apps/app/src/editor/flows/use-flow-sync.ts` or a small effect in `flyouts.tsx`, when `flowSession` goes from null to set, remember `pinnedFlyout`, set `flyout = pinnedFlyout = 'flows'`; when it returns to null, restore the remembered pin (not persisted to prefs).
- [x] T039 [US2] `apps/app/src/editor/palette.tsx` (+ `palette.test.tsx`): show `1`–`6` key hints on the kind tiles; tiles keep click / Enter / drag. `apps/app/src/editor/shell/use-shell-shortcuts.ts`: while `flyout === 'palette'`, digits 1–6 (`event.code` `Digit1`…`Digit6`, not in text targets) add that kind at the view centre (`addComponent` + `centredOn` as `Palette` does). After a drop or add, `closeFlyout()` unless the palette is pinned.
- [x] T040 [US2] Tools (R8): `tool` handling in `apps/app/src/editor/use-canvas-handlers.ts` — in `sticky` tool, `onPaneClick` / `onNodeClick` adds a note at the flow point (`addNoteAt`, refused in flow mode as today) then `setTool('select')`; in `connector` tool, `onNodeClick` on a component calls `openConnectPopover(id)` then `setTool('select')`. Keys in `apps/app/src/editor/use-canvas-shortcuts.ts`: V / S / L set the tool, G no-op, `case 'c'` gains the "no focused card → `openFlyout('palette')`" branch (§g-49). Esc resets the tool before its other meanings.
- [x] T041 [US2] ⌥1 / ⌥2 in `use-shell-shortcuts.ts` (`event.altKey && event.code === 'Digit1' | 'Digit2'`, works in text targets too since they are modified) → `openFlyout('outline' | 'flows')`. `EmptyCanvasCard`'s "Add component" → `openFlyout('palette')`.
- [x] T042 [US2] `apps/app/src/routes/editor-page.tsx`: replace the transitional `LeftSidebar` in the flyout slot with `Flyouts` and the rail / history islands. Delete `apps/app/src/editor/left-sidebar.tsx` and its test; remove `leftTab` / `setLeftTab` / `LeftTab` from `ui-store.ts` and every use (grep). Move any `left-sidebar.test.tsx` cases that still apply (outline, features) into `flyouts.test.tsx`.
- [x] T043 [US2] Pan-to-clear for flyouts (R5, 90): when a flyout opens and the selection or the active flow path's bounds sit under it, pan right by `panToClear(bounds, { left: 68 + 280 })` with `setViewport` (no zoom). Test in `flyouts.test.tsx` with a stubbed React Flow instance.

**Checkpoint**: rail and flyouts replace the left column. Commit.

---

## Phase 5: User Story 3 — Open component details on demand in a drawer (Priority: P1)

**Goal**: the inspector becomes an on-demand right drawer that overlays the canvas, opens only on request, resizes, and remembers its width per deck.

**Independent test**: select a component, Enter → drawer with fields, canvas size unchanged, Esc → focus back on the card; resize, reopen the deck → width kept; three cards + ⌘⇧D → bulk editor.

### Tests first

- [x] T044 [P] [US3] `apps/app/src/editor/shell/detail-drawer.test.tsx`: `complementary` "Details"; opens on Enter on a plain focused component (focus lands on the title field), on double-click of a plain component, on ⌘⇧D (toggle), on the command palette's "Open details", and in deck mode from "Deck settings"; Enter on a group or a component with children still drills in; shows node / edge / group / sticky / bulk / flow / step inspectors for the matching selection; "Close details" and Esc close it and focus returns to the card (`ui.focusedId` and canvas focus); an Esc consumed by an inner combobox / popover does not close it; empty selection closes it in selection mode but not deck mode; opening does not call `fitView` or change the canvas container's size; if the selected card's rect is under the drawer, `setViewport` is called with only an x change.
- [x] T045 [P] [US3] `apps/app/src/editor/shell/drawer-grip.test.tsx`: `separator` "Resize details" with `aria-orientation="vertical"`, `aria-valuemin="320"`, `aria-valuemax="560"`, `aria-valuenow`; ←/→ ±8, ⇧←/⇧→ ±40, Home / End; pointer drag changes width live and commits once on release (prefs written once).

### Implementation

- [x] T046 [US3] `apps/app/src/editor/shell/detail-drawer.tsx` + `drawer-grip.tsx`: frame at right 12 / top 68 / bottom 12 with `drawer.width`, Float shadow, overlay-enter motion; renders `Inspector` (pass `mode` so deck mode renders `DeckInspector` regardless of selection); `InspectorFrame` (`apps/app/src/editor/inspector/inspector-frame.tsx`) gains an optional close action slot rendering "Close details". Focus management: on open, focus the title field (reuse the selector from `focusInspectorTitle` in `use-canvas-shortcuts.ts`, moved to `apps/app/src/editor/shell/drawer-focus.ts`); on close, `ui.focus(drawerReturn)` then focus the canvas wrapper. Pan-to-clear on open with `panToClear(selectionRect, { right: drawerRect.left })`. In `apps/app/bench/perf.bench.ts`, make the "inspector title edit" scenario open the drawer first.
- [x] T047 [US3] Triggers: `apps/app/src/editor/use-canvas-shortcuts.ts` `case 'enter'` last branch → `openDrawer()` instead of `focusInspectorTitle()`; `apps/app/src/editor/use-canvas-handlers.ts` `onNodeDoubleClick` on a plain component (no children, not sticky / port) → select + `openDrawer()`; `use-shell-shortcuts.ts` ⌘⇧D → `toggleDrawer()` (works in text targets); `apps/app/src/editor/command-palette/` gains the "Open details" command (enabled with a selection). Remove any previous inspector shortcut (⌘I) if bound anywhere (grep; none expected).
- [x] T048 [US3] Flow interplay: in flow mode, selecting a step (clicking a path edge, 007) does not open the drawer by itself; Enter / ⌘⇧D open it with the step inspector (`Inspector` already routes to `FlowInspector`). `StepPlayer` centres on the remaining canvas when the drawer is open (offset its `Panel` style by `drawer.width / 2`). Tests in `apps/app/src/editor/flows/step-player.test.tsx`.
- [x] T049 [US3] `apps/app/src/routes/editor-page.tsx`: replace the transitional `Inspector` overlay with `DetailDrawer` rendered only when `drawer.open`. Update tests that expected a permanent `complementary` "Inspector" (`editor-page.test.tsx`, `inspector.test.tsx`, `problems-*.test.tsx`, flows tests using `render-inspector.tsx`) to open the drawer or render the inspector directly. The deck inspector's `ProblemsPanel` stays (deck settings view) and the rail flyout also shows it.
- [x] T050 [US3] Smoke selectors: "selecting a node updates the inspector" → click the node, press Enter, expect `getByRole('complementary', { name: 'Details' })` heading "Order Service". Run `pnpm e2e`.

**Checkpoint**: all P1 stories done; the three-column layout is gone. Commit. This is the MVP.

---

## Phase 6: User Story 4 — Show and hide the JSON panel (Priority: P2)

**Goal**: JSON hidden by default; ⌘J / deck menu toggle a bottom overlay with 004's behaviour; remembered per deck.

**Independent test**: new deck → hidden; ⌘J → open, focused, follows selection; Esc → focus to canvas; with drawer open the overlay ends at the drawer; zoom island above it; reopen → state kept.

- [x] T051 [P] [US4] `apps/app/src/editor/shell/json-overlay.test.tsx`: hidden by default; ⌘J opens the `region` "JSON" and focuses the viewer; ⌘J again or "Close JSON" closes; Esc in the viewer returns focus to the canvas and keeps it open; right edge = drawer's left edge − 12 when the drawer is open; the zoom island's bottom moves above it; read-only message on typing; state saved per deck (prefs mock).
- [x] T052 [US4] `apps/app/src/editor/shell/json-overlay.tsx`: absolutely positioned wrapper (left 68, bottom 12, right from `jsonRect`), Float shadow, 12 px radius, overlay-enter motion; renders `JsonPanel` only when open (Monaco stays lazy). `apps/app/src/editor/json-panel.tsx`: `useAvailableHeight` measures the overlay layer and caps at `viewport − 80`; Esc in the viewer focuses the canvas wrapper; header "×" labelled "Close JSON"; collapse and resize unchanged. `apps/app/src/editor/json-panel-header.tsx`: show the ⌘J hint.
- [x] T053 [US4] ⌘J in `use-shell-shortcuts.ts` (works in text targets; not intercepted by Monaco — add a Monaco keybinding passthrough in `json-viewer.tsx` if Monaco swallows it), deck menu item (T020), command palette "Show JSON" / "Hide JSON". `zoom-island.tsx` reads `zoomIslandBottom`.
- [x] T054 [US4] `apps/app/src/routes/editor-page.tsx`: replace the transitional JSON slot with `JsonOverlay`. Smoke suite: "editor shell renders all panels" → assert canvas, `toolbar` "Deck" and `toolbar` "Canvas tools" visible, press `ControlOrMeta+J`, then the existing Monaco / schema URL / `"web-app"` assertions; "makes no third-party network requests" → press `ControlOrMeta+J` before waiting for Monaco. Run `pnpm e2e`; the existing 004 component tests (`json-panel.test.tsx`, `json-viewer.test.tsx`) must pass unchanged apart from the open default.

**Checkpoint**: commit.

---

## Phase 7: User Story 5 — Hide all controls (Priority: P2)

**Goal**: ⌘\\ hides every island, flyout, drawer and JSON overlay, leaving a "Show UI" pill; toggling back restores exactly.

**Independent test**: open a flyout + drawer, ⌘\\ → only the pill; canvas keys work; ⌘\\ or the pill → both back.

- [x] T055 [P] [US5] `apps/app/src/editor/shell/show-ui-pill.test.tsx` and cases in `canvas-shell.test.tsx`: ⌘\\ hides all islands, the flyout, drawer, JSON overlay and step player (playback keys still work); only `button` "Show UI" remains; ⌘\\ or the pill restores the same flyout / drawer / JSON; toasts, delete confirmation, command palette and canvas popovers still render; announcements "Interface hidden" / "Interface shown"; a save error while hidden shows an alert mark on the pill (accessible name "Show UI, couldn't save").
- [x] T056 [US5] `apps/app/src/editor/shell/show-ui-pill.tsx` (34 px pill bottom-right, `Eye` icon, "Show UI", ⌘\\ key cap, `button-secondary` states) and the `hideUi` branch in `canvas-shell.tsx` (render only the pill in the overlay layer; keep popovers / dialogs / toasts outside the layer). ⌘\\ in `use-shell-shortcuts.ts` (`event.code === 'Backslash'` with mod) and a command palette "Hide UI" command.

**Checkpoint**: commit.

---

## Phase 8: User Story 6 — Reach everything from the keyboard (Priority: P2)

**Goal**: F6 / ⇧F6 region cycling, visible region focus, named regions, full shortcut help.

**Independent test**: keyboard only — cycle all regions, open / close each flyout, the drawer and JSON, with focus always visible and returning sensibly.

- [x] T057 [P] [US6] `apps/app/src/editor/shell/use-shell-shortcuts.test.tsx`: F6 from the canvas → zoom → drawer (when open) → deck → tools → rail → history → canvas; ⇧F6 reverses; hidden regions skipped (drawer closed, Hide UI → canvas ↔ "Show UI"); focused region shows the region focus attribute; F6 works from inside text fields; the full key table from contract "Single-key guard" is ignored in text targets and in the Monaco viewer; in flow mode only the view-only shell keys (F6, ⌘\\, ⌘J, ⌘⇧D, ⇧1 / ⇧2, M, ?) act.
- [x] T058 [US6] Finish `apps/app/src/editor/shell/use-shell-shortcuts.ts` (installed once by `CanvasShell`, canvas screen only): F6 / ⇧F6 using `nextRegion` and `document.activeElement.closest('[data-region]')`, focusing the region container (canvas: the existing canvas wrapper) and setting `data-region-focus` until focus leaves; ⇧1 / ⇧2 (`event.code` `Digit1` / `Digit2` with shift) fit / fit selection; M minimap; ? help. Region focus ring: 2 px orange (`focusRing` tokens) on the island. Also `role="toolbar"` + `aria-label` on each island per contract "Regions".
- [x] T059 [US6] Announcements through `ui.announce` for flyout open / close / pin, drawer open / close, JSON shown / hidden and Hide UI (contract texts); verify no double announcements with `apps/app/src/editor/announcer.test.tsx`.
- [x] T060 [US6] Complete `SHORTCUTS` (T009) with every key added in this feature and wire all rail / island tooltips to `shortcutLabel`; `shortcut-help-dialog.test.tsx` asserts the rows for F6, ⌘\\, ⌘J, ⌘⇧D, ⌥1, ⌥2, V, S, G, L, C, 1–6, ⇧1, ⇧2, M (FR-039).

**Checkpoint**: commit.

---

## Phase 9: User Story 7 — Use the editor in a narrower window (Priority: P3)

**Goal**: compact islands at 1024–1279 px; drawer ≤ ~35 %; below 1024 unchanged.

**Independent test**: 1024×768 and 1279×800 — compact variants, no overlap, every control reachable.

- [x] T061 [P] [US7] Tests: `apps/app/src/editor/shell/use-compact-shell.test.ts` (matchMedia mock, feature-detected fallback = not compact) and compact cases in `deck-island.test.tsx` (views as `combobox` "View" with the same options and menu), `tools-island.test.tsx` (Jump to / Labels / Focus icon-only with accessible names unchanged, Export icon-only "Export"), `detail-drawer.test.tsx` (width clamped to 35 % but ≥ 320); `shell-geometry.test.ts`: no two island rects intersect at 1024×768 and 1279×800.
- [x] T062 [US7] `apps/app/src/editor/shell/use-compact-shell.ts` (`matchMedia('(max-width: 1279px)')` via `supportsMatchMedia`); compact branches in `deck-island.tsx` (a `Select` of views reusing `ViewSwitcher`'s data and handlers — add a `variant="compact"` to `apps/app/src/editor/views/view-switcher.tsx` rather than a second switcher), `tools-island.tsx`, and drawer width via `clampDrawerWidth`. Confirm the existing < 1024 view-only behaviour still applies (grep for its breakpoint and keep it).

**Checkpoint**: commit.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T063 [P] Accessibility pass (partly done: keyboard paths and names are covered by component tests; not done: a contrast case for the selection ring on coloured cards, which waits for 020's card colours; an automated axe check needs a new dependency): keyboard-only run of quickstart scenario 9; check contrast of the selection outline and island borders against Canvas in both themes (non-text ≥ 3:1) and add a case to `packages/ui/test/contrast.test.ts` if a new pair is introduced; confirm every state has a non-colour cue (pressed / expanded / badge text / outline).
- [x] T064 [P] Reduced motion: flyouts, drawer and JSON overlay appear without slide; save loader does not spin (component test with `matchMedia` reduced).
- [x] T065 Run `pnpm bench` and save `specs/018-canvas-first-layout/bench-after.md` with before / after for every scenario, including `drawer-open-pan` (SC-006, ≥ 60 fps) and the updated "inspector title edit" (SC-005 context).
- [x] T066 Visual check: screenshots at 1440×900, light and dark, of states 86–94 and 115, and 116 at 1024×768, next to `docs/design/screens/` in `specs/018-canvas-first-layout/visual-check.md`; list differences (allowed: token overrides, lucide icons, parts owned by 016 / 017 / 019 / 020 such as the selection toolbar, Appearance section, bulk Align, and the disabled Group tool). Measure SC-001 (canvas ≥ 92 %) on the 86 screenshot.
- [x] T067 [P] Docs: `apps/app/CLAUDE.md` (map: `editor/shell/`; removed `left-sidebar.tsx` and `canvas-toolbar.tsx`; rules: shell state is UI-only, per-deck prefs in `sododeck.shell.<deckId>`, JSON hidden by default and `open` per deck, drawer opens only on request, F6 regions, where each former top-bar / toolbar control lives); `packages/ui/CLAUDE.md` (overlay motion token); `.agents/skills/react-flow/SKILL.md` (panels removed from the canvas; minimap toggle; tools in the handlers); DESIGN.md only for corrections found while building; `docs/backlog.md` §018 status line.
- [x] T068 Run the definition-of-done commands: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Fix anything they report. Check `pnpm build` still keeps Monaco, React Flow and telemetry out of the library entry chunk.
- [x] T069 Final report: what changed, what was skipped (Group tool disabled until 016), what is uncertain (import entry from the deck menu, compact views dropdown, pan-to-clear feel), bench numbers, SC-001 measurement, and the next step (019 card quick-edit).

---

## Dependencies & Execution Order

- **Setup (T001–T004)** → **Foundational (T005–T014)** → user stories.
- Inside Foundational: T005–T010 are independent; T011 needs T008; T012 and T013 need T011 / T008; T014 is independent of the store.
- **US1 (Phase 3)** depends on Foundational. It keeps the old sidebar, inspector and JSON as transitional overlays.
- **US2 (Phase 4)** depends on US1 (rail and history islands sit in the shell; T029 hands Problems over in T037).
- **US3 (Phase 5)** depends on US1; independent of US2 except both edit `use-canvas-shortcuts.ts` and `use-canvas-handlers.ts` (Enter / double-click vs C / tools) — do them in sequence or merge carefully.
- **US4 (Phase 6)** depends on US1 (and on US3 for the drawer-edge case in T051, which can be stubbed).
- **US5 (Phase 7)** and **US6 (Phase 8)** depend on US1–US4 being present to hide / cycle them; US6's T058 also finishes `use-shell-shortcuts.ts` started in US2–US5.
- **US7 (Phase 9)** depends on US1 and US3.
- **Polish** comes after the delivered stories.

### Parallel opportunities

- **Setup:** T004 alongside T002–T003.
- **Foundational:** T005 ∥ T006 ∥ T007 ∥ T008 ∥ T009 ∥ T010; T014 alongside T011.
- **US1:** tests T015 ∥ T016 ∥ T017 ∥ T018 ∥ T019; then T021 ∥ T022 alongside T020.
- **US2:** tests T031 ∥ T032 ∥ T033 ∥ T034; T037 alongside T035–T036.
- **US3:** T044 ∥ T045.
- **Across stories:** after US1, US2 and US3 can run with two agents if `use-canvas-shortcuts.ts` / `use-canvas-handlers.ts` edits are sequenced (T040 before T047, or rebase).

### Parallel example (US1)

```text
Agent A: T015 → T020 → T021              (deck island, deck menu, save icon)
Agent B: T016 → T023, T019 → T022        (tools island, views menu + Tidy)
Agent C: T017 → T024 → T025              (history, zoom island, help dialog)
then:    T026 → T027 → T028 → T029 → T030 (canvas, page, selection frame, cleanup, smoke)
```

## Implementation Strategy

1. **MVP**: Phases 1–5 (all P1 stories): full-bleed canvas, islands, rail and flyouts, details drawer. The three-column layout is gone at the end of Phase 5; run the smoke suite and bench after each phase.
2. **Increment 2**: US4 + US5 (JSON overlay hidden by default, Hide UI).
3. **Increment 3**: US6 (F6 regions, complete shortcut help) — required for constitution VII before merge.
4. **Increment 4**: US7 (narrow windows), then Polish.

Stop after each checkpoint, run `pnpm lint && pnpm typecheck && pnpm test`, and commit. The feature merges as one PR only after Phase 10 (US6 is required for accessibility).
