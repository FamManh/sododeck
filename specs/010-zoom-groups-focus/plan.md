# Implementation Plan: Semantic Zoom, Collapsible Groups and Focus Mode

**Branch**: `010-zoom-groups-focus` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-zoom-groups-focus/spec.md` (clarified 2026-09-27, 2 answers)

**Dependency**: 003 (canvas-basic) is merged on `main` (`7b845bc`), and so are 006 (`96bd929`) and 008 (`324d1bd`). Names were checked on `main`: `toFlowNodes` / `toFlowEdges`, `GROUP_NODE_PREFIX`, `groupBounds`, `displayPosition`, `NODE_SIZE`, `flowOverlay`, `EdgeFlowMark`, `ZoomControl`, `CanvasToolbar`, `TopBar`, `useCanvasKeyDown`, `useEditorShortcuts`, `buildOutline`, `Selection`, `pruneSelection`, `resetForDeck`, `canvasViewport`. 007 (the step player) is not on `main`; per clarification Q2, 010 exports `groupAtStep` for it and does not render player text. 009 (stickies) is not on `main`; nothing here depends on it.

## Summary

Keep large decks readable with no document change. Everything is UI state plus one pure derivation.

- **Visible graph** (`editor/visible-graph.ts`, R1):
  - One pure, memoized function turns the deck, the drill scope and the collapsed set into what the canvas shows: members, group boundaries, collapsed cards, plain and merged edges, and port pills.
  - `deck-to-flow.ts` consumes it.
  - Children with a `parent` appear only inside their parent's scope (Q1, R5).
- **Levels** (`editor/levels.ts`, R2–R3):
  - A discrete zoom band (≤45 / ≤90 / ≤150 / >150%) with a small hysteresis, read by one `useStore` selector.
  - Forced to Component inside a node scope.
  - Nodes render per level: tile, title, title + tech, or a full 164 × 104 card.
  - A level indicator and menu sit in the zoom control.
- **Drill-in** (R4):
  - A `drill` stack in the UI store, with the viewport saved per frame, and `fitBounds` on entry.
  - Breadcrumb crumbs after the deck name ("System view" › …), port pills, an outline "Up" row.
  - Esc / Backspace go up only with nothing selected.
- **Collapse** (R6–R7):
  - A `collapsed` set in the UI store; a label chevron, Space, and a group inspector with a Collapsed switch.
  - Collapsed-group card node, `merged` edge type with a ×N pill and direction icon, and a keyboard-operable popover.
  - `Selection` gains `groups`.
- **Focus** (R8): `focusMode` in the UI store. A pure `focusSet` marks members. CSS dims the rest, and dimmed objects also get `aria-hidden` + `inert`. There is a toolbar toggle and the F key.
- **Flows** (R11): `collapseFlowMarks` folds 006's overlay into merged badges and card rings.
- **Bench** (R12): the bench deck gains groups, and the bench gains `groups-collapsed`, `collapse-toggle` and `focus` scenarios.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed:

- `@xyflow/react` 12.12: `useStore` selector, `fitBounds`, `setViewport`, `zoomTo`, `onNodeDoubleClick`, node `domAttributes`
- `zustand` 5
- `@sododeck/ui`: `Popover`, `DropdownMenu`, `Switch`, `Button` (toggle), `Tooltip`, `KindTile`, `TagChip`, `focusRing`, `resolveMotion`, `useReducedMotion`
- `lucide-react`: `Layers`, `ChevronDown`, `ChevronRight`, `ArrowRight`, `ArrowLeftRight`, `Focus`, `CornerLeftUp`

No new dependency.

**Storage**: none new. Nothing is written to the deck. The UI store gains `drill`, `collapsed`, `focusMode`, `Selection.groups` and the `merged` popover kind, all reset by `resetForDeck()` and never persisted (§g-22).

**Testing**:

- **Vitest (`apps/app`)**, pure functions:
  - `visible-graph` (merging, counts, nesting, children, ports, integrity, caching)
  - `levels` (bands, hysteresis, forced Component)
  - `focus-set`, `collapse-flow-marks`
  - `deck-to-flow` (new types, cache keys `level` / `dimmed` / `childCount`)
  - `outline` (scoped tree, "Up")
  - `canvas-geometry` (sizes per level)
  - `ui-store` (drill, collapse, focus, prune, reset)
- **Vitest + Testing Library (`apps/app`)**, by role and label (UI contract):
  - `zoom-control` / `level-indicator`
  - `group-boundary-node` (chevron, label button)
  - `collapsed-group-node`, `merged-edge` + popover, `port-pill`
  - `top-bar` crumbs, `group-inspector`, `canvas-toolbar` Focus toggle
  - `canvas` (double-click, focus dimming a11y)
  - `use-canvas-shortcuts` (Enter / Space / F / Esc / Backspace priorities)
  - a document-identity test (SC-005)
- **Bench**: `BENCH_GROUPS=1 pnpm bench` before and after. No new e2e (constitution VI).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; `inert` is supported in all of them.

**Project Type**: web app (monorepo). Changes are only in `apps/app`.

**Performance Goals**:

- 60 fps pan/zoom on the benchmark deck, all groups collapsed (SC-001);
- ≤ 100 ms for a collapse toggle, a drill, a focus toggle or a level-band change (SC-002);
- `visibleGraph` under 2 ms for 500 nodes and 1,000 edges.

**Constraints**:

- No document writes and no undo entries (FR-041).
- Derived data (members, merged edges, collapse) never appears in the JSON panel or the file (§g-22, §g-23).
- Tokens only; dimming is not conveyed by opacity alone (FR-034).

**Scale/Scope**: up to 500 nodes / 1,000 edges / ~30 groups, nesting depth ≤ 4. About 14 new files in `apps/app/src/editor`, changes to 12 existing ones, 1 ADR.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no justified exceptions._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Nothing document-shaped is copied. Drill, collapse and focus are ids in the UI store (§g-22). The visible graph, merged edges, counts and levels are derived from the snapshot on each render (R1). React Flow stays controlled.                                                            |
| II. Schema-owned format          | ✅     | No schema or model change (R14). The existing `level`, `parent`, `group` and `Group.parent` fields are only read. A test asserts `serializeDeck` is unchanged by every 010 action (SC-005).                                                                                                 |
| III. Stable identity             | ✅     | Collapse and drill reference group and node ids. Synthetic React Flow ids are prefixed (`collapsed:`, `merged:`, `port:`) and never written. Renames do not break the state.                                                                                                                |
| IV. Local-first, private         | ✅     | No network, no new assets, no persistence. The smoke no-third-party check is unchanged.                                                                                                                                                                                                     |
| V. Performance                   | ✅     | The derivation is linear and memoized, so no worker is needed (R1; the heavy work is layout and import). Level is a discrete selector (R2). Focus dims by CSS plus one rebuild per toggle (R8). Bench runs before and after, with new scenarios (R12).                                      |
| VI. Strict types, tested         | ✅     | Every pure module gets unit tests. Components are tested by role and label per [contracts/zoom-groups-focus-ui.md](contracts/zoom-groups-focus-ui.md). No new e2e; the smoke suite must stay green.                                                                                         |
| VII. Accessible                  | ✅     | Keyboard for every action (R9). Group labels and cards join the roving focus. The collapsed or expanded state uses `aria-expanded` and an icon. Dimmed objects are `aria-hidden` + `inert`, and the focused one has a ring. Level changes are announced. Reduced motion gives a static dot. |
| VIII. Simplicity, justified deps | ✅     | No dependency. There is one derivation instead of per-feature filters. Saved views and auto-layout are left to 011. ADR 0010 records the visible-graph and UI-state decision.                                                                                                               |

## Project Structure

### Documentation (this feature)

```text
specs/010-zoom-groups-focus/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R14
├── data-model.md        # Phase 1: fields read, UI state, derived models
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── visible-graph.md          # pure derivation + helpers
│   └── zoom-groups-focus-ui.md   # user-visible contract (roles, names, keys)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
apps/app/src/
├── state/ui-store.ts                     # + drill, collapsed, focusMode, Selection.groups, 'merged' popover,
│                                         #   drillInto/drillUp/toggleCollapsed/expandAll/setFocusMode/pruneView, reset
├── editor/
│   ├── levels.ts (+test)                 # NEW levelForZoom, levelWithHysteresis, effectiveLevel, nodeLevel
│   ├── visible-graph.ts (+test)          # NEW visibleGraph, scopeOf, scopeBounds, validDrillDepth
│   ├── focus-set.ts (+test)              # NEW focusSet
│   ├── collapse-flow-marks.ts (+test)    # NEW collapseFlowMarks, groupAtStep
│   ├── canvas-geometry.ts (+test)        # + COMPONENT_CARD_SIZE, COLLAPSED_CARD_SIZE, nodeSize(level)
│   ├── deck-to-flow.ts (+test)           # consumes VisibleGraph; collapsed/port nodes, merged edges; level/dimmed/childCount
│   ├── canvas.tsx (+test)                # level selector, focus attrs, new node/edge types, zoomOnDoubleClick off,
│   │                                     #   drill fit/restore, useViewSync (pruneView after removals)
│   ├── deck-node.tsx (+test)             # per-level rendering, child marker, dimmed/in-focus
│   ├── group-boundary-node.tsx (+test)   # label button, chevron, drill hint, landscape region
│   ├── collapsed-group-node.tsx (+test)  # NEW stacked card, counts, flow ring/dot
│   ├── port-pill-node.tsx (+test)        # NEW dashed pill → go up + select
│   ├── merged-edge.tsx (+test)           # NEW ×N pill + direction icon
│   ├── merged-edge-popover.tsx (+test)   # NEW listbox of underlying edges
│   ├── level-indicator.tsx (+test)       # NEW 4 bars + name + DropdownMenu
│   ├── zoom-control.tsx (+test)          # hosts LevelIndicator
│   ├── canvas-toolbar.tsx (+test)        # + Focus toggle
│   ├── drill-crumbs.tsx (+test)          # NEW "System view" + frames, used by top-bar
│   ├── top-bar.tsx (+test)               # renders DrillCrumbs on the canvas screen
│   ├── outline.ts / outline-tree.tsx     # scoped tree + "Up" row
│   ├── use-canvas-handlers.ts            # double-click drill, clicks on collapsed:/port:/merged:, group selection
│   ├── use-canvas-shortcuts.ts (+test)   # Enter/Space/F in canvas; Esc/Backspace "up" in editor shortcuts
│   ├── inspector.tsx                     # routes a group selection to GroupInspector
│   └── inspector/group-inspector.tsx (+test)  # NEW Collapsed switch, merged list, Expand group
├── index.css                             # [data-focus-mode] dimming, landscape region, card stack
└── bench/generate-deck.ts (+test)        # options.groups
apps/app/bench/perf.bench.ts              # groups-collapsed, collapse-toggle, focus scenarios; BENCH_GROUPS
docs/decisions/0010-visible-graph.md      # NEW ADR
.agents/skills/react-flow/SKILL.md        # map: visible-graph, levels, new prefixes
apps/app/CLAUDE.md                        # map + rules: drill/collapse/focus are UI state, visible graph
```

**Structure Decision**: all code lives in `apps/app`. `packages/model`, `packages/schema` and `packages/ui` are unchanged: no document change, and the needed UI primitives already exist.

### Merge hot spots

- `deck-to-flow.ts` / `canvas.tsx`: 009 (stickies) will add a sticky node type through the same functions. Keep 010's signature change (`graph`, `view`) in one commit, so 009 rebases onto it.
- `state/ui-store.ts` `Selection`: adding `groups` touches `select`, `pruneSelection`, the JSON Selection tab and the inspector router. 009 may add `stickies`, and both follow the same pattern.
- `top-bar.tsx` centre slot: 006's session chip; 011's view switcher will replace the constant "System view".

## Implementation order (for /speckit-tasks)

1. Bench groups option + baseline (`bench-before.md`).
2. `levels.ts`, `visible-graph.ts`, `focus-set.ts`, `collapse-flow-marks.ts` with tests (pure, no UI).
3. UI store additions + tests.
4. `deck-to-flow` / `canvas-geometry` switch to `VisibleGraph` with no visible change (all expanded, deck scope). The existing tests stay green.
5. US1 drill-in: handlers, crumbs, port pills, outline scope, Esc / Backspace, viewport restore.
6. US2 collapse: label chevron, card, merged edge + popover, group inspector, `Selection.groups`.
7. US3 focus: toggle, F, dimming + a11y.
8. US4 levels: per-level rendering, level indicator + menu, announcements.
9. US5 flow marks on cards and merged edges.
10. Visual check against 13, 19 and 64–71 (light and dark), bench after, ADR 0010, CLAUDE.md and skill updates, definition-of-done commands.

## Complexity Tracking

No constitution violations to justify.
