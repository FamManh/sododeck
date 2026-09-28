# Implementation Plan: Saved Views and Auto-Layout

**Branch**: `011-views-autolayout` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-views-autolayout/spec.md` (clarified 2026-09-28, 8 answers)

**Dependency**: 010 (zoom-groups-focus) is merged on `main` (`8ab6052`), as are 003, 006, 007, 008 and 009. Names were checked on `main`:

- **App:** `visibleGraph`, `scopeOf`, `Scope`, `VisibleGraph`, `focusSet`, `effectiveLevel`, `displayPosition`, `toFlowNodes` / `toFlowEdges`, `CanvasToolbar`, `TopBar` (centre-slot comment reserving the view switcher), `DrillCrumbs`, `parentScopeTitle`, `scopeTitle` (duplicated in `canvas.tsx` and `use-canvas-shortcuts.ts`), `useUiStore` (`collapsed`, `setCollapsed`, `toggleCollapsed`, `expandAll`, `drill`, `drillInto`, `pruneView`, `resetForDeck`, `announce`), `openResult`, `buildPaletteResults`, `useToast`, `useUndoToast`, `computeLayout`, `createLayoutClient`.
- **Model:** `createEditor` (`trackedOrigins`, `editorOrigins`), `observeDeck`, `nodeCanvasPosition`.

## Summary

One model, many lenses, plus safe automatic layout.

- **File format** (R1): `View` gains optional `excludeGroups`, `excludeKinds`, `excludeTags`, `dimKinds`, `pinned` and `collapsed`, and `SubtitleField` gains `flows`. This is additive and needs no version bump.
- **Model** (R2–R5): `views.ts` holds `VIEW_PRESETS`, which are data with fixed ids and domain-neutral. `resolveViews` and `viewPosition` are pure helpers. New editor ops are `moveInView`, `setPinned`, `updateView`, `addView`, `removeView` and `setCollapsed`.
  - Presets are written on the first view change, outside undo history, so ⌘Z undoes only that change.
  - The base view (the first one) edits `node.position`. Other views store overrides, and an override wins in any view.
  - Collapse uses an untracked origin: it is saved and synced but is never an undo step.
  - The cascade and integrity checks cover the new references.
- **App** (R6–R13):
  - `currentViewId` in the UI store, and collapse read from the view.
  - A pure `viewFilter` (hidden and dimmed) feeds `visibleGraph`. `deck-to-flow` takes a per-view position, subtitle, dimmed state and pin.
  - Drags go through `moveInView`.
  - A view switcher tab list with a tab menu, inline rename, settings popover, and create/delete toasts.
  - Pin controls and a Tidy layout button driving the existing ELK worker, which is lazy, cancellable and applied in one batch, with pins enforced after layout.
  - Undo toasts for changes in other views, "Hidden in this view" in ⌘K, and "<title> view" crumbs.
- **Bench** (R14): `view-switch`, `tidy-layout-200` and `pan-during-layout` scenarios.
- **ADR 0012.**

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, no new dependency.

- `yjs` 13.6: a second origin outside the `UndoManager`'s `trackedOrigins`.
- `elkjs` ^0.12.0 (`layered`, `INCLUDE_CHILDREN`), in the existing module worker.
- `@xyflow/react` 12.12 (`fitView`), `zustand` 5.
- `@sododeck/ui`: `DropdownMenu`, `ContextMenu`, `Popover`, `Switch`, `Select`, `InlineEdit`, `Tooltip`, `Toast`. It gains **`Checkbox` and `RadioGroup` wrappers** over the `radix-ui` package it already depends on.
- `lucide-react`: `Plus`, `MoreHorizontal`, `LayoutGrid`, `Pin`, `PinOff`, `Eye`, `EyeOff`.

**Storage**: document data only through `@sododeck/model` (Yjs, autosaved by 005). The UI store gains `currentViewId`, `revealed` and `layoutRun`, and loses `collapsed` (now document data).

**Testing**:

- **Vitest, schema:** parity with the new fields and fixtures.
- **Vitest, model:** `views.test.ts`, round-trip, cascade, integrity.
- **Vitest, app, pure functions:**
  - `view-filter`, including the feature filter and nested group exclusion;
  - `flow-count`;
  - `deck-to-flow` (subtitle, dimmed, pinned, positions);
  - `tidy-layout` request building (collapsed cards, drilled scope, hidden nodes);
  - `elk-layout` / `applyPins` (pins exact, no overlaps, groups together, 200 nodes < 2 s);
  - `undo-context` key → action;
  - `palette-results` hidden meta;
  - `ui-store` (`switchView`, reset).
- **Testing Library, by role and label**, per [contracts/views-ui.md](contracts/views-ui.md):
  - `view-switcher`, `view-tab-menu`, `view-settings-popover`;
  - `canvas-toolbar` (Tidy, Pin), the node inspector pin switch, `deck-node` (subtitle, dimmed name, pin glyph);
  - `top-bar` crumbs, `open-result` hidden toast, the undo-across-views toast;
  - a document-identity test: switching views never writes.
- **Bench:** before and after. No new e2e (constitution VI). The smoke suite must stay green.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. Module workers are supported in all of them. `ResizeObserver` is feature-detected (`supportsResizeObserver` already exists).

**Project Type**: web app (monorepo). Changes are in `packages/schema`, `packages/model`, `packages/ui` (two primitives) and `apps/app`.

**Performance Goals**:

- Tidy layout of 200 nodes < 2 s (SC-001), and 60 fps panning while a 500-node layout runs (SC-002).
- View switch ≤ 200 ms on the bench deck (SC-003).
- `viewFilter` < 2 ms for 500 nodes, and no regression in the 010 scenarios.

**Constraints**:

- No network with content, and the layout stays in a worker (constitution IV, V).
- `elkjs` must not enter the main bundle. Checked by inspecting the build output (`vite build` chunk list) in the report.
- Opening or switching views never writes (FR-001, FR-005).

**Scale/Scope**: up to 500 nodes / 1,000 edges / ~30 groups / ~10 views. About 16 new files and ~20 changed ones, plus 1 ADR.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: it still passes, with no justified exceptions._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth        | ✅     | Views, positions, pins and collapse live only in Yjs. The store's `collapsed` Set is removed (R6). `currentViewId`, `revealed` and `layoutRun` are UI-only. The filter, subtitles and layout requests are derived. React Flow stays controlled.                                                              |
| II. Schema-owned format          | ✅     | Only optional fields plus one enum value are added, with no version bump (R1). Types and Zod are regenerated, parity is tested, and there is a round-trip case for every field. Only `@sododeck/model` writes views (R4).                                                                                    |
| III. Stable identity             | ✅     | Preset ids are fixed constants, not titles. Custom views get generated ids. Every view reference is by id and cleaned in the same step (R2). Rename tests cover node, group and feature references from views.                                                                                               |
| IV. Local-first, private         | ✅     | No network. The layout runs locally in the bundled worker, and the smoke no-third-party test is unchanged.                                                                                                                                                                                                   |
| V. Performance off main thread   | ✅     | ELK runs in the existing worker, which is created lazily and can be cancelled (R9). The filter is linear and memoized (R7). The bench gets three new scenarios run before and after (R14). The 200-node budget is also asserted in Node.                                                                     |
| VI. Strict types, tested         | ✅     | Every pure module has unit tests, components are tested by role and label, and model tests are listed in the contract. No new e2e.                                                                                                                                                                           |
| VII. Accessible                  | ✅     | The tab list uses a roving tabindex. The menu opens with Shift+F10. The popover is keyboard operable with focus return. Dimmed and pinned states carry text in the accessible name (not colour or opacity alone). Switches, layouts and undo toasts are announced. Token-only styling.                       |
| VIII. Simplicity, justified deps | ✅     | No new dependency: `elkjs` was planned in the constitution and is already installed, and `Checkbox` / `RadioGroup` wrap `radix-ui`, which is already a dependency. There is one filter instead of per-type behaviour (FR-002a). No layout options UI and no view reordering. ADR 0012 records the decisions. |

## Project Structure

### Documentation (this feature)

```text
specs/011-views-autolayout/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: view fields, Yjs mirror, UI state, derived models
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-views.md   # schema + model API additions
│   └── views-ui.md      # user-visible contract (roles, names, keys, texts)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                        # View: excludeGroups/excludeKinds/excludeTags/dimKinds/pinned/collapsed; SubtitleField + flows
├── src/generated/{types,zod}.ts          # regenerated
├── examples/full.sododeck.json           # views use the new fields
└── test/fixtures.ts                      # invalid cases for the new fields
packages/model/
├── src/views.ts                          # NEW VIEW_PRESETS, resolveViews, baseViewId, nextCustomTitle
├── src/geometry.ts                       # + viewPosition
├── src/ops/views.ts                      # NEW moveInView, setPinned, updateView, addView, removeView, setCollapsed, materialize
├── src/editor.ts                         # view ops; second (untracked) origin registered in editorOrigins
├── src/ops/{cascade,refs}.ts, integrity.ts  # pinned / excludeGroups / collapsed references
├── src/deck.ts                           # layout comment for the new Y.Arrays
└── test/{views,round-trip,cascade,integrity}.test.ts
packages/ui/src/components/
├── checkbox.tsx (+test)                  # NEW radix wrapper, tokens only
└── radio-group.tsx (+test)               # NEW radix wrapper, tokens only
apps/app/src/
├── state/ui-store.ts (+test)             # + currentViewId, revealed, layoutRun, switchView; − collapsed & actions
├── editor/view-filter.ts (+test)         # NEW viewFilter, flowCountByNode, firstViewShowing
├── editor/visible-graph.ts (+test)       # + hidden input (dropped, not merged)
├── editor/deck-to-flow.ts (+test)        # ViewRender: position, subtitle, dimmed, pinned
├── editor/deck-node.tsx (+test)          # subtitle, dimmed name, pin glyph, "Hidden in this view" note
├── editor/canvas.tsx (+test)             # current view → filter/graph/render; useViewSync; fit on switch
├── editor/use-canvas-handlers.ts         # drag → editor.moveInView; collapse via setCollapsed
├── editor/use-canvas-shortcuts.ts        # collapse via setCollapsed; shared scope title
├── editor/{group-boundary-node,collapsed-group-node,merged-edge-popover,port-pill-node}.tsx,
│   inspector/group-inspector.tsx, flows/{flow-mode.ts,step-player.tsx}, outline.ts
│                                         # read useCollapsed(); write through useViewActions()
├── editor/views/
│   ├── use-current-view.ts (+test)       # NEW useCurrentView, useCollapsed, useViewActions
│   ├── view-title.ts (+test)             # NEW viewCrumbTitle
│   ├── view-switcher.tsx (+test)         # NEW tablist, +, overflow
│   ├── view-tab-menu.tsx (+test)         # NEW Rename / View settings… / Delete view
│   ├── view-settings-popover.tsx (+test) # NEW subtitle, hide groups/kinds/tags, dim kinds, feature
│   └── undo-context.ts (+test)           # NEW undo/redo in another view → toast
├── editor/top-bar.tsx (+test)            # switcher in centre slot (SessionChip while recording)
├── editor/drill-crumbs.tsx (+test)       # "<title> view"
├── editor/canvas-toolbar.tsx (+test)     # Tidy layout, Pin/Unpin, progress + Cancel
├── editor/inspector/node-inspector.tsx (+test)  # "Pin position" switch
├── editor/tidy-layout.ts (+test)         # NEW request builder + useTidyLayout (lazy client, cancel, batch apply)
├── editor/command-palette/{palette-results,open-result}.ts (+test)  # hidden meta + "Show in <view>" toast
├── layout/elk-layout.ts (+test)          # groups (compound), pinned, applyPins, overlap sweep
├── layout/layout-client.ts               # cancel = terminate + recreate
├── index.css                             # .view-dimmed (token opacity), pin glyph
└── bench/generate-deck.ts (+test)        # options.views
apps/app/bench/perf.bench.ts              # view-switch, tidy-layout-200, pan-during-layout
docs/decisions/0012-saved-views-and-layout.md   # NEW ADR (amends 0005 layout, 0011 collapse)
packages/model/CLAUDE.md, apps/app/CLAUDE.md, packages/ui/CLAUDE.md, .agents/skills/react-flow/SKILL.md  # map + rules
```

**Structure Decision**: The file format changes in `packages/schema`, and view semantics and writes live in `packages/model`, following the dependency direction `app → model → schema`. `packages/ui` gains only two generic primitives. Everything view-specific in the UI, plus layout orchestration, lives in `apps/app/src/editor/views`, `editor/tidy-layout.ts` and `layout/`.

### Merge hot spots

- **`visible-graph.ts` / `deck-to-flow.ts` / `canvas.tsx`:** signature changes land in one commit (hidden input, `ViewRender`), with no visible change while every view is the System preset.
- **`ui-store.ts`:** removing `collapsed` touches about 10 call sites. Do it in one commit, with `useCollapsed()` returning the same `ReadonlySet` shape.
- **`top-bar.tsx` centre slot:** the switcher and SessionChip swap there. 018 (canvas-first layout) will move both later.

## Implementation order (for /speckit-tasks)

1. Bench `views` option plus baseline (`bench-before.md`).
2. Schema fields, `flows` subtitle, regenerate, fixtures, example.
3. Model: `views.ts`, `ops/views.ts`, the untracked origin, cascade, integrity, tests (round-trip, views, undo semantics).
4. `packages/ui` `Checkbox` / `RadioGroup`.
5. App plumbing with no visible change: `currentViewId`, `useCurrentView` / `useCollapsed` / `useViewActions`, collapse moved to the model, `viewFilter` → `visibleGraph`, `ViewRender`, drag through `moveInView`.
6. US1: switcher, subtitles and dimming, crumbs, switch behaviour, `useViewSync`.
7. US2: per-view positions (already wired in step 5), with tests and a reload check.
8. US3: pin ops UI, `elk-layout` groups and pins, `tidy-layout`, toolbar button, progress and Cancel, one-step undo.
9. US4: add, rename, delete (confirm and Undo toast), settings popover, revealed-new-node rule.
10. US5: per-view collapse (already data from step 5), with tests for undo skipping and multi-tab sync.
11. Cross-cutting: ⌘K hidden results (FR-016), undo-across-views toast (FR-045).
12. Visual check against 02, 20, 21 and 22 (light and dark), with founder screenshots of the undesigned parts. Bench after, ADR 0012, CLAUDE.md and skill updates, definition-of-done commands, and a bundle check that `elkjs` is only in the worker chunk.

## Complexity Tracking

No constitution violations to justify.
