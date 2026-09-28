# Research: Canvas-First Layout (018)

These are the decisions taken while planning. The spec is [spec.md](spec.md), clarified on 2026-09-28 (§g-49 and §g-50 defaults accepted).

Code was read on `main` at `fb3994c`:

- **Shell:** `apps/app/src/routes/editor-page.tsx` (`EditorChrome`, `CanvasScreen`), `editor/{top-bar,left-sidebar,inspector,json-panel,json-panel-header,zoom-control,canvas,canvas-toolbar,palette,save-status,drill-crumbs,empty-canvas-card,selection-frame}.tsx`.
- **Keys and handlers:** `editor/use-canvas-shortcuts.ts`, `editor/use-canvas-handlers.ts`, `editor/flows/use-flow-shortcuts.ts`.
- **State:** `state/ui-store.ts`, `state/json-panel-prefs.ts`.
- **Other entry points:** `editor/problems/{problems-button,problems-panel}.tsx`, `editor/flows/{flow-list,flow-panel,flow-mode-chip,session-chip,step-player}.tsx`, `editor/views/view-switcher.tsx`, `editor/inspector/deck-inspector.tsx`, `apps/app/tests/e2e/smoke.spec.ts`, `apps/app/bench/perf.bench.ts`.
- **UI package:** `packages/ui/src/components/*`, `lib/{focus,motion,menu}.ts`.

**Facts that shape the plan:**

- `CanvasScreen` is a CSS grid `264px | 1fr | 336px` (`LeftSidebar`, canvas + `JsonPanel`, `Inspector`) under a 56 px `TopBar` row in `EditorChrome`. The rule editor route reuses `EditorChrome` and its `TopBar`.
- The canvas already draws its own floating chrome through React Flow `<Panel>`s: `CanvasToolbar` (top-right: selection count, Tidy layout, Pin, Problems, Labels, Focus, Notes display), `ZoomControl` (bottom-left) and an always-visible `MiniMap` (bottom-right), plus `StepPlayer` (bottom-centre).
- `LeftSidebar` switches to `FlowPanel` in flow mode and during a recording session; otherwise Outline / Palette tabs plus the Features list.
- `Inspector` routes to the flow inspectors or `CanvasInspector` (deck / node / edge / group / sticky / bulk). With nothing selected it shows `DeckInspector`, which holds deck settings, storage and the `ProblemsPanel`. `ProblemsButton` clears the selection to reveal it.
- `JsonPanel` measures its parent for height (`useAvailableHeight`), and its prefs `{ open, height, tab }` live in `localStorage["sododeck.jsonPanel"]`, global, default `open: true`. `toggleJsonPanel` exists in the store but no key is bound.
- Enter on a plain focused component calls `focusInspectorTitle()`; Enter on a group or a component with children drills in. Double-click on a plain component does nothing (`onNodeDoubleClick` returns early). C opens the connect popover on a focused card; N adds a sticky.
- There is no group-creation operation in `@sododeck/model` yet (016 adds "group from selection") and no keyboard-help dialog.
- No F6, ⌘\\, ⌘J, ⌘⇧D, ⇧1, ⇧2 or M binding exists today.

## R1 — Shell structure: one full-bleed canvas, chrome as absolutely positioned islands

- **Decision:** `CanvasScreen` renders a single `relative h-dvh` container. The canvas fills it (`absolute inset-0`), and the chrome sits in a sibling overlay layer with `pointer-events: none` on the layer and `pointer-events: auto` on each island. New components live in `apps/app/src/editor/shell/`:

  | File                                   | Role                                                                                |
  | -------------------------------------- | ----------------------------------------------------------------------------------- |
  | `canvas-shell.tsx`                     | Layout: canvas + overlay layer, region order for F6, Hide UI switch                 |
  | `deck-island.tsx`                      | ≡ menu, deck name, save icon, views control, Flow / session / drill chips           |
  | `deck-menu.tsx`                        | Library, import, export, deck settings, Show JSON                                   |
  | `tools-island.tsx`                     | Jump to, Labels, sticky visibility, Focus, theme, Export                            |
  | `rail.tsx`, `rail-button.tsx`          | Tools and panel launchers, tooltips, Problems badge                                 |
  | `history-island.tsx`                   | Undo / Redo (moved out of `top-bar.tsx`)                                            |
  | `flyout.tsx`, `flyouts.tsx`            | Flyout frame (header, pin, close, Esc / outside click) and the content switch       |
  | `detail-drawer.tsx`, `drawer-grip.tsx` | Drawer frame around `Inspector`, resizing                                           |
  | `zoom-island.tsx`                      | Fit, fit selection, zoom, level, minimap toggle, help                               |
  | `json-overlay.tsx`                     | Positions `JsonPanel` as the bottom overlay                                         |
  | `show-ui-pill.tsx`                     | The only chrome under Hide UI                                                       |
  | `shortcut-help-dialog.tsx`             | "?" list of shortcuts                                                               |
  | `shell-geometry.ts`                    | Pure: island rectangles, drawer / JSON bounds, chrome coverage, pan-to-clear offset |
  | `shell-prefs.ts`                       | Pure + storage: per-deck prefs read / write / validate                              |
  | `use-shell-shortcuts.ts`               | F6 / ⇧F6, ⌘\\, ⌘J, ⌘⇧D, ⌥1 / ⌥2, V / S / G / L / C, ⇧1 / ⇧2, M, ?                   |
  | `regions.ts`                           | Pure: F6 order and skipping                                                         |

  Existing panels (`OutlineTree`, `NotesOutline`, `Palette`, `FlowList`, `FlowPanel`, `ProblemsPanel`, `Inspector`, `JsonPanel`, `ViewSwitcher`, `SaveStatus`, `DrillCrumbs`, `StepPlayer`) are moved, not rewritten. `LeftSidebar` and `CanvasToolbar` are removed once their content has a new home.

- **Rationale:** the canvas never resizes (FR-002) because nothing shares its box; React Flow keeps one stable size, so no `fitView` or re-measure is triggered by chrome. An overlay layer with pointer-events pass-through keeps drags that start on the canvas working (FR-004).
- **Alternatives:**
  - Keep React Flow `<Panel>` for every island: panels live inside the pane and inherit its stacking and pointer handling; the drawer and JSON overlay must also sit over the minimap and step player. Only the step player stays a React Flow panel (it is canvas-bound).
  - CSS grid with overlapping areas: same result, harder to reason about for the drawer offset of the JSON overlay.

## R2 — The rule editor screen keeps the top bar

- **Decision:** `EditorChrome` renders `TopBar` only when `screen === 'rules'`; the canvas screen renders `CanvasShell` full height. `TopBar` loses its canvas-only branches (view switcher, Rules link, drill crumbs, Export), which move to the islands. Save status stays in the rule editor's top bar.
- **Rationale:** the spec keeps the rule editor's layout; making it canvas-first too is out of scope.
- **Alternatives:** islands on the rule editor as well: changes a screen the spec excludes.

## R3 — Shell UI state in the UI store, per-deck prefs in localStorage

- **Decision:** the UI store gains a `shell` slice (see [data-model.md](data-model.md)): `flyout`, `pinnedFlyout`, `drawer { open, width, mode }`, `hideUi`, `hiddenSnapshot`, `minimap`, `tool`, `helpOpen`. The JSON overlay's visibility is a new `jsonShown` field saved in the per-deck prefs; `jsonPanel.open` keeps 004's expanded / collapsed meaning.
  - Per-deck prefs `{ drawerWidth, pinnedFlyout, jsonOpen }` are stored in `localStorage["sododeck.shell.<deckId>"]`, validated field by field like `json-panel-prefs.ts`, read in `resetForDeck(deckId)` and written on change. The demo and memory decks use the key `demo` / no persistence.
  - The JSON panel's height, tab and expanded / collapsed state stay in the existing global `sododeck.jsonPanel` key; a deck without prefs starts with the overlay hidden (FR-028).
  - Keys are deleted when the library purges a deck (`purgeDeleted`), so stale prefs do not accumulate. The number of keys is bounded by the number of decks.
  - No sync between tabs: the store reads storage only on deck open (§g-50).
- **Rationale:** constitution I puts UI-only state in Zustand and never in Yjs; §g-50 keys it by deck and keeps it local. `localStorage` is already used for JSON prefs and theme, and it is synchronous so the first frame is correct.
- **Alternatives:** IndexedDB library metadata (like `openedAt`): async first paint, and it would mix UI prefs into the library record; one global key with a map of decks: one big value rewritten on every drag.

## R4 — Flyouts: one visible, one pinned, swap and return

- **Decision:** state is `flyout: FlyoutId | null` (the one shown) and `pinnedFlyout: FlyoutId | null`. Opening a flyout sets `flyout`; closing a temporary flyout sets `flyout = pinnedFlyout`. Pinning sets `pinnedFlyout = flyout`. An outside click (a `pointerdown` on the canvas pane) or Esc closes only an unpinned flyout; Esc on a pinned flyout moves focus to its rail button. A first Esc inside a flyout with a non-empty filter clears the filter (the filter components already handle Esc; the flyout ignores an Esc they `preventDefault`).
  - `FlyoutId = 'palette' | 'outline' | 'flows' | 'rules' | 'problems'`.
  - Flyout frame: Radix-free `<section role="dialog" aria-modal="false" aria-labelledby>`; focus moves to its first control on open and returns to the rail button on Esc. Non-modal, because the canvas must stay usable while it is pinned.
  - Content: palette → `Palette`; outline → `OutlineTree` + `NotesOutline`; flows → `FlowList`, or `FlowPanel` in flow mode / a session (as `LeftSidebar` does today); rules → a new small `RulesList` (titles, count, "Open rule editor", "New rule") built on `rule-nav.ts`; problems → `ProblemsPanel`.
  - During a recording session (006) the flows flyout opens and pins itself, since the step list must be visible while clicking edges; it returns to the previous state when the session ends.
- **Rationale:** matches §a 88–90 and FR-013–FR-017 with two fields and no stack. The session auto-open keeps 006's acceptance criteria true without a left column.
- **Alternatives:** a stack of flyouts: more states than the design shows; Radix Popover: modal-ish focus handling and it closes on any outside interaction, which breaks pinning.

## R5 — Detail drawer: overlay, pan-to-clear, resize, focus return

- **Decision:**
  - `DetailDrawer` renders `Inspector` inside a fixed frame (right 12, top 68, bottom 12, width from state), `role="complementary"` named "Details". Opening moves focus to the inspector's title field (reusing `focusInspectorTitle`'s target) and records the canvas element to return to.
  - Open triggers: Enter on a plain focused component (replacing `focusInspectorTitle()` in `use-canvas-shortcuts.ts`), ⌘⇧D toggle, `onNodeDoubleClick` on a plain component (today a no-op), the command palette command "Open details", the deck menu's "Deck settings" (opens with `mode: 'deck'`, showing `DeckInspector` regardless of selection), and 006's flow / step selection when the user asks for it.
  - Closing: Esc (when focus is inside the drawer and no inner popover consumed it), the close button, or an empty selection unless `mode === 'deck'`. Focus returns to the previously focused canvas object via `ui.focus(id)` and the canvas wrapper's focus.
  - Pan-to-clear: `panToClear(selectionRect, drawerLeft, viewport)` in `shell-geometry.ts` returns the x offset needed so the selection's right edge sits 24 px left of the drawer; applied with `setViewport` (no zoom change) and skipped when the selection is already clear. Same helper for flyouts on the left.
  - Resize: a 4×48 grip, `role="separator"` with `aria-orientation="vertical"`, `aria-valuemin=320`, `aria-valuemax=560`, `aria-valuenow`; pointer drag and ←/→ (8 px, ⇧ 40 px). Width written to prefs on release.
  - ProblemsButton's "clear selection to show the deck inspector" becomes "open the Problems flyout".
- **Rationale:** FR-021–FR-027 with the inspector untouched. `separator` is the WAI-ARIA pattern for a resizable splitter.
- **Alternatives:** open the drawer automatically on selection: rejected by the spec (on request only).

## R6 — JSON overlay

- **Decision:** `JsonOverlay` positions the existing `JsonPanel` absolutely (left 68, right 12 or `drawerWidth + 24`, bottom 12) with the Float shadow and 12 px radius. `JsonPanel` keeps its header, tabs, copy, collapse and resize handle; `useAvailableHeight` measures the overlay layer instead of the old `main` column, capped so the top islands stay clear (`viewport − 68 − 12`). ⌘J toggles; opening focuses the viewer; Esc inside the viewer returns focus to the canvas without closing (FR-030). The zoom island's `bottom` becomes `12 + jsonHeight + 8` when open.
- **Rationale:** 004's behaviour is preserved by moving the component, not rewriting it (plan hint). The read-only viewer is unchanged (§g-42).
- **Alternatives:** a new overlay component duplicating the header: two copies of 004's logic.

## R7 — Keyboard: F6 regions and new shortcuts

- **Decision:**
  - Regions are marked with `data-region="deck|tools|rail|history|canvas|zoom|drawer"` and `tabIndex={-1}` on the region container. `nextRegion(order, current, visible, direction)` in `regions.ts` is pure; `use-shell-shortcuts.ts` finds the current region from `document.activeElement.closest('[data-region]')`, focuses the next visible one, and shows a region focus ring (`data-region-focus`) until focus leaves it. Order: deck → tools → rail → history → canvas → zoom → drawer (frame 115; FR-036).
  - New keys, installed once in `CanvasShell` (canvas screen only), ignoring text targets (`is-text-target.ts`) for single keys:

    | Key           | Action                                                                                 |
    | ------------- | -------------------------------------------------------------------------------------- |
    | F6 / ⇧F6      | Next / previous region                                                                 |
    | ⌘\\ / Ctrl+\\ | Toggle Hide UI                                                                         |
    | ⌘J / Ctrl+J   | Toggle JSON overlay                                                                    |
    | ⌘⇧D / Ctrl+⇧D | Toggle drawer                                                                          |
    | ⌥1 / ⌥2       | Outline / Flows flyout (uses `event.code` `Digit1` / `Digit2`: ⌥1 types "¡" on macOS)  |
    | V, S, G, L    | Select, Sticky, Group, Connector tools                                                 |
    | C             | Palette when no card is focused; connect popover when one is (§g-49, unchanged branch) |
    | 1–6           | Add kind at view centre, only while the palette flyout is open                         |
    | ⇧1 / ⇧2       | Fit / fit selection (`event.code`, since ⇧1 is "!")                                    |
    | M             | Minimap                                                                                |
    | ?             | Shortcut help                                                                          |

  - N keeps adding a sticky at the pointer (existing); S arms the Sticky tool.
  - Flow mode keeps its current rule (only zoom and playback keys on the canvas), extended with F6, ⌘\\, ⌘J, ⌘⇧D, ⇧1 / ⇧2 and M, which are view-only.
- **Rationale:** F6 region cycling is the platform convention for landmark-like panes. `event.code` avoids layout-dependent characters.
- **Alternatives:** Tab through every island in DOM order: 30+ stops before the canvas.

## R8 — Rail tools with the operations that exist today

- **Decision:** `tool: 'select' | 'sticky' | 'connector'` in the UI store; the tool resets to Select after one use and on Esc.
  - **Select (V):** today's behaviour.
  - **Sticky (S):** the next click on empty canvas or a card adds a note there (`addNoteAt`, the same as dragging the palette's Note tile).
  - **Connector (L):** the next click on a card opens the connect popover from it (003's C path); canvas handles still work in any tool.
  - **Group (G):** rendered, `aria-disabled` with the tooltip "Group from selection — coming soon". There is no group-creation operation in the model; 016 adds "group from selection" and enables the button. See Complexity Tracking.
  - **Add component (C):** opens the palette flyout.
  - **Search:** opens the ⌘K command palette anchored to the rail button.
- **Rationale:** the design places these tools; building group creation here would pull 016 forward (spec: out of scope).
- **Alternatives:** hide Group until 016: the rail would change shape later and 018's screens would not match 86; implement group creation now: 016's scope.

## R9 — Zoom island, minimap, help

- **Decision:** `ZoomIsland` wraps today's `ZoomControl` content (−, %, +, `LevelIndicator`, fit) plus fit selection (`fitView({ nodes })` of the selection), a minimap toggle (`aria-pressed`) and "?" (opens `ShortcutHelpDialog`). The `MiniMap` renders only when `shell.minimap` is on, positioned above the zoom island. Default off (frame 86 shows none). `ShortcutHelpDialog` is a `Dialog` listing sections (Canvas, Tools, Panels, Flows, JSON) from one `SHORTCUTS` table in `shortcuts.ts`, which the rail tooltips also read, so names and keys cannot drift.
- **Rationale:** one source for shortcut labels (FR-039, FR-020).
- **Alternatives:** keep the minimap always on: covers canvas area against SC-001.

## R10 — Hide UI

- **Decision:** `hideUi: boolean`. `CanvasShell` renders only `ShowUiPill` from the overlay layer when on; the flyout / drawer / JSON state is kept as is (not cleared), so turning it off restores exactly (FR-034). Toasts, dialogs, popovers anchored to the canvas (edge, connect, merged, invalid) and the command palette are outside the overlay layer and keep working (FR-035). Step player hides, but playback keys keep working. A save error while hidden adds an alert dot to the pill and the existing live-region announcement.
- **Rationale:** a single flag, no snapshot to restore, cannot drift.

## R11 — Narrow windows (1024–1279)

- **Decision:** one `useCompactShell()` hook (`matchMedia('(max-width: 1279px)')`, feature-detected through `features.ts`) switches islands to compact variants: `ViewSwitcher` renders as a `Select`-style dropdown, Jump to / Labels / Focus become icon buttons with tooltips, Export icon-only. The drawer width is clamped to `min(width, 0.35 × viewport)` but not below 320. Below 1024 the existing view-only behaviour is unchanged.
- **Rationale:** FR-041 with no layout engine; `matchMedia` is available in all target browsers but goes through `features.ts` per constitution IV.

## R12 — Selection frame

- **Decision:** `selection-frame.tsx` (exists for multi-selection) draws a 2 px Deck Orange outline 2 px outside each selected card; `deck-node.tsx` drops its selected border + halo; flow-step styling is unchanged. Contrast is checked against the canvas in both themes (non-text ≥ 3:1, constitution VII), and selection keeps a non-colour cue (the outline shape plus `aria-selected`).
- **Rationale:** every frame 86–116 uses it and it reads on any card fill (020).

## R13 — Motion and tokens

- **Decision:** add `--sd-dur-overlay` 120 ms (0 ms under reduced motion) and `MOTION.overlayMs` in `packages/ui`; flyouts, drawer and JSON overlay use a fade + 4 px slide class. Island, rail and flyout sizes are Tailwind utilities from existing spacing; no new colour token. The loader icon in `SaveStatus` uses `motion-safe:animate-spin`.
- **Rationale:** DESIGN.md motion rule for overlays (021); tokens-only test in `packages/ui` keeps it honest.

## R14 — Tests, smoke and bench

- **Decision:**
  - Unit: `regions.ts`, `shell-geometry.ts` (coverage ≤ 8 % at 1440×900, pan-to-clear, drawer / JSON bounds), `shell-prefs.ts` (validation, per-deck keys, blocked storage), UI store shell slice (flyout swap / pin / return, drawer open / close rules, Hide UI).
  - Component (Testing Library, by role / name): `rail`, `flyout`, `detail-drawer` (open by Enter / ⌘⇧D / double-click, Esc focus return, separator keys), `json-overlay` (⌘J, Esc, read-only), `deck-island`, `tools-island`, `zoom-island`, `show-ui-pill`, `shortcut-help-dialog`, `canvas-shell` (F6 order, hidden regions skipped); existing `editor-page`, `top-bar`, `inspector`, `json-panel`, `problems` tests updated for new placement.
  - Smoke e2e: selectors only. "editor shell renders all panels" becomes: canvas visible, deck island and rail visible, press ⌘J then assert the JSON region; "selecting a node updates the inspector" becomes select + Enter then assert the "Details" region heading; the no-third-party test opens JSON with ⌘J before waiting for Monaco.
  - Bench: run before and after (`pnpm bench`); the "inspector title edit → canvas" scenario opens the drawer first. Add a `drawer-open-pan` scenario (open drawer + JSON, then pan) to back SC-006.
- **Rationale:** constitution VI (no new e2e) and V (bench for canvas-touching changes).

## R15 — ADR and docs

- **Decision:** ADR `0014-canvas-first-shell.md`: overlay layer and pointer pass-through, UI state split (store vs per-deck prefs), F6 regions, what moved where, Group tool deferred. Update `apps/app/CLAUDE.md` (map rows for `editor/shell/`, removal of `left-sidebar.tsx` / `canvas-toolbar.tsx`, JSON prefs rule), `packages/ui/CLAUDE.md` (overlay motion token), and the React Flow skill if it names the removed panels. DESIGN.md already describes the shell (021); only corrections found while building.
