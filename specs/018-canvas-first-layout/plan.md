# Implementation Plan: Canvas-First Layout

**Branch**: `018-canvas-first-layout` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-canvas-first-layout/spec.md` (clarified 2026-09-28: §g-49 and §g-50 defaults accepted)

**Dependency**: 021 (design sync) is merged on `main` (`fb3994c`), as are 003–011 and 015. Names were checked on `main`:

- **Shell:** `EditorChrome`, `CanvasScreen` (`routes/editor-page.tsx`), `TopBar` (with `HistoryButtons`, `DeckNameCrumb`), `LeftSidebar` / `DiagramSidebar`, `Inspector` / `CanvasInspector`, `JsonPanel` (`useAvailableHeight`), `ZoomControl`, `CanvasToolbar` (`TidyLayoutControl`), `SaveStatus`, `DrillCrumbs`, `EmptyCanvasCard`, `SelectionFrame`, `StepPlayer`.
- **Panels:** `Palette`, `OutlineTree`, `NotesOutline`, `FlowList`, `FlowPanel`, `ProblemsPanel`, `ProblemsButton`, `ViewSwitcher`, `PinToggle`, `DeckInspector`.
- **Store / keys:** `useUiStore` (`leftTab`, `jsonPanel`, `toggleJsonPanel`, `openPalette`, `resetForDeck`, `focus`, `announce`), `json-panel-prefs.ts`, `useCanvasShortcuts` (`focusInspectorTitle`, `case 'c'`, `case 'enter'`), `useEditorShortcuts`, `onNodeDoubleClick`.

## Summary

The diagram gets the whole window; all chrome floats over it.

- **Layout** (R1, R2): `CanvasScreen` becomes a full-bleed canvas with an overlay layer (pointer events pass through empty space) holding new shell components in `apps/app/src/editor/shell/`: deck island, tools island, rail + history island, flyouts, detail drawer, JSON overlay, zoom island, Show UI pill, shortcut help. Existing panels are **moved, not rewritten**. `LeftSidebar` and `CanvasToolbar` are removed; `TopBar` stays only on the rule editor screen.
- **State** (R3, R4, R5): a `shell` slice in the UI store (flyout, pinned flyout, drawer, Hide UI, minimap, tool, help). Per-deck prefs `{ drawerWidth, pinnedFlyout, jsonOpen }` in `localStorage["sododeck.shell.<deckId>"]`, never in Yjs, never synced between tabs (§g-50). JSON panel hidden by default.
- **Interaction** (R5–R10): flyouts swap with pin-and-return; the drawer opens only on request (Enter, double-click, ⌘⇧D, "Open details", Deck settings) and pans the canvas to clear the selection; ⌘J toggles the JSON overlay; ⌘\\ hides the UI; F6 / ⇧F6 cycle regions; V / S / L tools, C palette-or-connect (§g-49), 1–6 in the palette, ⇧1 / ⇧2 fit, M minimap, ? help. Group (G) is present but disabled until 016.
- **Details** (R11–R13): compact islands at 1024–1279 px; selection frame outside the card; overlay motion token (120 ms, none with reduced motion).
- **Tests / bench** (R14): unit tests for pure shell modules and the store slice, component tests by role / name per [contracts/shell-ui.md](contracts/shell-ui.md), smoke selectors updated, bench before / after plus a `drawer-open-pan` scenario.
- **ADR 0014** (R15).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, no new dependency.

- `@xyflow/react` 12 (`useReactFlow().setViewport`, `fitView({ nodes })`, `MiniMap`, `Panel` for the step player only).
- `zustand` 5 (UI store).
- `@sododeck/ui`: `Button`, `Tooltip`, `DropdownMenu`, `Dialog`, `InlineEdit`, `SegmentedControl`, `Select`, `SearchField`, `focusRing`, `MOTION`. Gains one motion token (`--sd-dur-overlay`, `MOTION.overlayMs`); no new component in `packages/ui` is required for 018 (island / rail / flyout frames are app components built from these primitives, per the design analysis target "ui ➕" they can be promoted later without API change).
- `lucide-react`: `Menu`, `MousePointer2`, `Plus`, `StickyNote`, `Group`, `Spline`, `ListTree`, `Workflow`, `Table2`, `Search`, `TriangleAlert`, `Pin`, `PinOff`, `X`, `Eye`, `Map`, `Keyboard`, `Maximize`, `Scan`, `Check`, `LoaderCircle`, `CircleAlert`.

**Storage**: no document change. UI store `shell` slice; per-deck prefs in `localStorage` via `shell-prefs.ts` (validated, best-effort, removed on deck purge). JSON height / tab stay in `sododeck.jsonPanel`.

**Testing**:

- **Vitest, pure:** `regions.ts` (order, skip hidden, wrap, reverse), `shell-geometry.ts` (chrome coverage ≤ 8 % at 1440×900, drawer / JSON / zoom rectangles, pan-to-clear), `shell-prefs.ts` (validation, defaults, blocked storage, per-deck keys, purge), `shortcuts.ts` (unique keys, every rail item has an entry).
- **Vitest, store:** flyout swap / pin / return / session auto-open, drawer open / close / auto-close / deck mode, Hide UI keeps state, `resetForDeck(deckId)` reads prefs.
- **Testing Library, by role and name** per [contracts/shell-ui.md](contracts/shell-ui.md): `canvas-shell` (F6 order, hidden regions skipped, Hide UI), `deck-island`, `deck-menu`, `tools-island`, `rail` (tooltips, pressed / expanded, Group disabled, Problems badge), `flyout` (Esc, filter Esc, pin, outside click), `detail-drawer` (Enter / double-click / ⌘⇧D, focus return, separator keys, canvas size unchanged), `json-overlay` (⌘J focus, Esc, read-only), `zoom-island`, `show-ui-pill`, `shortcut-help-dialog`, compact variants. Existing tests updated: `editor-page`, `top-bar`, `inspector`, `json-panel`, `problems-*`, `use-canvas-shortcuts` (Enter and C paths), `palette`, `ui-store`.
- **E2E:** no new tests (constitution VI). Smoke selectors updated (R14).
- **Bench:** before and after; "inspector title edit" opens the drawer first; new `drawer-open-pan`.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. `matchMedia` and `ResizeObserver` via `features.ts`.

**Project Type**: web app (monorepo). Changes in `apps/app` and one token in `packages/ui`. `packages/schema` and `packages/model` untouched.

**Performance Goals**: 60 fps pan / zoom at 500 / 1,000 with a flyout, the drawer and JSON open (SC-006); drawer visible with fields ≤ 150 ms after Enter (SC-005); flow highlight < 100 ms unchanged; no chrome re-render on pan (islands do not subscribe to the viewport except the zoom % label).

**Constraints**: canvas box never changes size (SC-002); no network; no document writes from shell state; Monaco stays lazy (the JSON overlay mounts its viewer only when open).

**Scale/Scope**: ~20 new files in `apps/app/src/editor/shell/`, ~20 changed files, 2 removed (`left-sidebar.tsx`, `canvas-toolbar.tsx` and their tests, content moved), 1 ADR.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; one scoped deviation is tracked below._

| Principle                        | Status | How                                                                                                                                                                                                                                                         |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | No document data added or copied. Shell state is UI-only in Zustand; per-deck prefs in `localStorage` are UI preferences (drawer width, pinned flyout, JSON open), never in Yjs or the file (FR-042, §g-50). Panels keep reading `useDeckSnapshot`.         |
| II. Schema-owned format          | ✅     | No schema or model change; no round-trip impact.                                                                                                                                                                                                            |
| III. Stable identity             | ✅     | Prefs are keyed by the library deck id (stable); `drawerReturn` holds a canvas object id, validated against the snapshot before focusing.                                                                                                                   |
| IV. Local-first, private         | ✅     | No network. Prefs stay in the browser. `matchMedia` feature-detected in `features.ts`. Smoke no-third-party test kept (opens JSON with ⌘J first).                                                                                                           |
| V. Performance off main thread   | ✅     | No heavy work added. Canvas box stable (no re-fit on chrome changes). Bench before / after with a new drawer + JSON pan scenario.                                                                                                                           |
| VI. Strict types, tested         | ✅     | Pure modules unit-tested; components tested by role / name per the contract; no new e2e; smoke selectors only.                                                                                                                                              |
| VII. Accessible                  | ⚠️     | F6 regions, named toolbars / dialogs / separator, focus return, announcements, non-colour cues (pressed / expanded, badge text, selection outline), reduced motion. **Deviation:** the Group rail button is shown disabled until 016 (Complexity Tracking). |
| VIII. Simplicity, justified deps | ✅     | No new dependency. Panels moved, not rewritten. One token added. ADR 0014 records the layout decision.                                                                                                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/018-canvas-first-layout/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R15
├── data-model.md        # Phase 1: UI store shell slice, per-deck prefs, transitions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── shell-ui.md      # user-visible contract (regions, roles, names, keys, texts)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/ui/src/
├── styles/tokens.css                     # + --sd-dur-overlay (120ms, 0 under reduced motion)
└── lib/motion.ts (+test)                 # + overlayMs
apps/app/src/
├── editor/shell/                         # NEW
│   ├── canvas-shell.tsx (+test)          # full-bleed canvas + overlay layer, regions, Hide UI
│   ├── deck-island.tsx (+test)           # menu, name, save icon, views, flow/session/drill chips
│   ├── deck-menu.tsx (+test)             # All decks, Import, Export, Deck settings, Show JSON
│   ├── tools-island.tsx (+test)          # Jump to, Labels, Notes, Focus, theme, Export
│   ├── rail.tsx, rail-button.tsx (+test) # tools + panel launchers, tooltips, Problems badge
│   ├── history-island.tsx                # Undo / Redo (moved from top-bar.tsx)
│   ├── flyout.tsx, flyouts.tsx (+test)   # frame (pin, close, Esc, outside click) + content switch
│   ├── rules-list.tsx (+test)            # rules flyout content → rule editor
│   ├── detail-drawer.tsx (+test)         # frame around Inspector, focus return
│   ├── drawer-grip.tsx (+test)           # separator, pointer + keys, 320–560
│   ├── json-overlay.tsx (+test)          # positions JsonPanel; ⌘J focus, Esc
│   ├── zoom-island.tsx (+test)           # fit, fit selection, zoom, level, minimap, help
│   ├── show-ui-pill.tsx (+test)
│   ├── shortcut-help-dialog.tsx (+test)
│   ├── shortcuts.ts (+test)              # SHORTCUTS table (tooltips + help)
│   ├── regions.ts (+test)                # F6 order, pure
│   ├── shell-geometry.ts (+test)         # rectangles, coverage, pan-to-clear, pure
│   ├── shell-prefs.ts (+test)            # per-deck prefs, validated
│   ├── use-shell-shortcuts.ts (+test)    # F6, ⌘\, ⌘J, ⌘⇧D, ⌥1/⌥2, V/S/G/L, 1–6, ⇧1/⇧2, M, ?
│   └── use-compact-shell.ts              # 1024–1279 via features.ts
├── state/ui-store.ts (+test)             # + shell slice & actions; − leftTab; resetForDeck(deckId)
├── state/json-panel-prefs.ts (+test)     # `open` no longer read; default closed
├── lib/features.ts (+test)               # + supportsMatchMedia
├── routes/editor-page.tsx (+test)        # CanvasScreen → CanvasShell; TopBar only on rules screen
├── editor/top-bar.tsx (+test)            # rule-editor only: canvas branches removed
├── editor/canvas.tsx (+test)             # drop CanvasToolbar/ZoomControl panels; MiniMap behind shell.minimap; tool clicks
├── editor/use-canvas-handlers.ts         # double-click opens drawer; Sticky / Connector tool clicks
├── editor/use-canvas-shortcuts.ts (+test)# Enter → openDrawer; C → palette when nothing focused
├── editor/json-panel.tsx (+test)         # measures the overlay layer; Esc returns focus
├── editor/inspector.tsx                  # deck mode prop; close-button slot via InspectorFrame
├── editor/inspector/inspector-frame.tsx  # header actions gain "Close details"
├── editor/save-status.tsx (+test)        # icon-only variant with same words (§g-51)
├── editor/selection-frame.tsx, deck-node.tsx (+test)  # 2 px outline outside the card
├── editor/palette.tsx (+test)            # 1–6 hints; flyout-friendly layout
├── editor/views/view-switcher.tsx, view-tab-menu.tsx  # compact dropdown; Tidy layout in the menu
├── editor/problems/problems-button.tsx   # → opens the Problems flyout (rail badge)
├── editor/command-palette/*              # + "Open details", "Show/Hide JSON", "Hide UI" commands
├── editor/left-sidebar.tsx (+test)       # REMOVED (content in flyouts)
├── editor/canvas-toolbar.tsx (+test)     # REMOVED (content in islands / views menu / drawer)
├── storage/library-db.ts                 # purgeDeleted also removes sododeck.shell.<id>
├── tests/e2e/smoke.spec.ts               # selectors only
└── bench/perf.bench.ts                   # drawer before title edit; + drawer-open-pan
docs/decisions/0014-canvas-first-shell.md # NEW ADR
apps/app/CLAUDE.md, packages/ui/CLAUDE.md, .agents/skills/react-flow/SKILL.md  # updated
```

**Structure Decision**: the monorepo layout is unchanged. New shell components are grouped in `apps/app/src/editor/shell/` (plan hint). They are app components because they read the UI store and editor context; `packages/ui` stays presentational and only gains a motion token.

## Complexity Tracking

| Violation                                                                                    | Why Needed                                                                                                                                                                                                                                                        | Simpler Alternative Rejected Because                                                                                                                                |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group rail button (G) shown `aria-disabled` until 016 (Principle VII: every action operable) | The design (86) and FR-012 place it; the model has no group-creation operation, and "group from selection" is 016's scope (spec Out of scope). The button has an accessible name and a tooltip explaining why it is unavailable, and it is reachable by keyboard. | Building group creation now pulls 016 forward; hiding the button changes the rail's shape later and breaks the match with 86. Approved by the founder (2026-09-28). |
