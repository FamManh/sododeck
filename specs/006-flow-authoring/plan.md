# Implementation Plan: Flow Authoring

**Branch**: `006-flow-authoring` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-flow-authoring/spec.md` (clarified 2026-09-27, 6 answers)

**Dependency**: 003, 004 and 005 are merged on `main` (`81d2d3a`). 006 needs nothing
flow-specific from 005: every change goes through the model, so the deck persistence provider
autosaves it and the deck channel syncs it to other tabs (remote changes arrive as
`observeDeck` origin `remote`).

Names used here were re-checked against `main` after 005 merged (research header). `Step` has no
`branch` field yet. No step from/to helper exists. The top bar has no view switcher; it now shows
the breadcrumb, a spacer, `SaveStatus` and Export. `packages/ui` now has `DropdownMenu` and
`ContextMenu` (added by 005), and the library builds its menus with `MenuKit`
(`apps/app/src/library/menu-kit.ts`). There is no drag-to-reorder code or dependency.

## Summary

Replace the left panel's "Flows and features arrive in Milestone 2" placeholder with first-class
features and flows.

- **File format** (ADR 0008, research R1):
  - Additive optional `Flow.branches[] { id, label, condition, errorPath?, description? }` and
    `Step.branch?: Id`.
  - The branch point is derived (the last main-path step), so there is one branch point per flow
    and one level of branching.
  - Steps stay one flat array.
- **Model**:
  - A pure `analyzeFlow` gives paths, display numbers (4a/5b), from/to, broken and chain-break
    flags, next start nodes and `canFinish`. 007 and 015 reuse it.
  - New ops: `addBranch` (splits the continuation into alternative "a"), `updateBranch`,
    `removeBranch`, `appendStep`, `captureFlowStructure` / `restoreFlowStructure` (edit-mode
    Cancel that keeps text edits).
  - Branch change tracking and `RemovalTarget`.
- **App** (`apps/app/src/editor/flows/`):
  - Feature and flow list with menus, rename, reorder (small in-house sortable hook, no
    dependency) and filter.
  - A recording and edit session in the Zustand UI store. Steps are written to the deck as they
    are clicked. Contiguity is checked with `analyzeFlow`. Invalid clicks write nothing and show a
    popover plus the live region, with "Add as branch".
  - Keyboard candidates with Tab and Enter.
  - A canvas overlay (badges, candidates, preview, invalid, error path, start ring) passed through
    the cached `toFlowEdges` / `toFlowNodes`.
  - Flow, step and branch inspectors. The JSON panel's Selection tab shows the flow.
  - Deletes go through the existing confirm dialog, widened to `RemovalTarget[]`.
- **No new runtime dependency and no new `packages/ui` component.** Feature and flow menus reuse
  the `DropdownMenu` that 005 added.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed:

- `yjs` 13.6
- `@xyflow/react` 12.12
- `zustand` 5
- `lucide-react` (`Route`, `GitBranch`, `CircleAlert`, `Ban`, `GripVertical`, `Plus`, `X`, `Check`,
  `Undo2`)
- `@sododeck/ui`: `Dialog`, `Popover`, `Switch`, `Input`, `InlineEdit`, `Textarea`, `Select`,
  `SearchField`, `Tooltip`, toast, `PanelSection`, `DropdownMenu` (added by 005)

**Storage**: none new. Document data goes in the Yjs deck through `@sododeck/model`. UI-only state
goes in `useUiStore`. Persistence and tab sync come from 005 (`storage/deck-persistence.ts`,
`storage/deck-channel.ts`) with no change.

**Testing**:

- **Vitest (`packages/schema`)**: Branch fixtures and parity.
- **Vitest (`packages/model`)**:
  - round-trip cases
  - `flow-paths.test.ts`
  - branch ops, restore, move refusals, cascade and undo in the existing suites
- **Vitest (`apps/app`)**:
  - pure `flowOverlay`, `filterFlows`, `candidateEdges`, `recordEdge` and `flowOrder`
  - the session store transitions
  - `use-sortable-list`
- **Testing Library component tests** by role and label:
  - flow list, filter, menus and dialogs
  - recording chip and Done gating
  - step list rows, branch headers and inspector branch validation
  - invalid-click popover and live region
  - broken and chain-break rows
- **E2E**: the existing smoke suite only (constitution VI). It does not reference the placeholder
  text.
- **Bench**: `pnpm bench` before and after, with a flows scenario.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; desktop 1440×900
reference; offline.

**Project Type**: Web SPA (`apps/app`) plus internal packages in the pnpm/Turborepo monorepo.

**Performance Goals**:

- A valid click shows the step, badge and row in < 100 ms at 500 components / 1,000 connections.
- Selecting a flow shows its marks in < 100 ms (constitution V).
- Pan, zoom and drag fps within 5 % of `main`.
- The filter updates within the keystroke frame for 20 flows × 10 steps.

**Constraints**:

- No duplicated document state (the edit checkpoint is justified below).
- No network.
- Keyboard-operable, and no state by color alone.
- Tokens only.
- Canvas stays derived (ADR 0006).
- React Flow keyboard and delete handling stay off. All keys go through `use-canvas-shortcuts.ts`.

**Scale/Scope**:

- Up to ~20 features, ~20 flows per feature and ~30 steps per flow (a few branches) in normal use.
- The bench deck adds 20 flows of 10 steps.
- About 20 new app files and 3 new model files; no new UI component.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with one justified
item._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅ \*  | Features, flows, steps and branches are written only through `DeckEditor`, and recording writes as you click (R3). The UI store holds ids, mode, hover, filter and notices only. \*The edit-mode Cancel checkpoint is a frozen copy of the flow structure held for the session: see Complexity Tracking.  |
| II. Schema-owned format          | ✅     | Additive optional `branches` and `branch` in `v1.json` with no version bump. Types and Zod are regenerated with parity green. The model stays the only Yjs ↔ JSON code (the checkpoint is produced and consumed by the model). Round-trip cases are added. ADR 0008.                                      |
| III. Stable identity             | ✅     | Branches get generated `branch-…` ids. `step.branch` references by id. Numbers (4a) and from/to are derived and never stored. Rename tests cover branch labels and flow and feature titles.                                                                                                               |
| IV. Local-first, private         | ✅     | No network, assets or CDNs. Nothing new is feature-detected (pointer and keyboard only). The smoke no-third-party check is unchanged.                                                                                                                                                                     |
| V. Performance                   | ✅     | The overlay goes through the cached derivation, so only changed edges get new objects. `analyzeFlow` is O(steps). The filter is O(flows × steps) on tiny inputs, so no worker is needed (not heavy work). Bench before and after, with new flow scenarios.                                                |
| VI. Strict types, tested         | ✅     | Pure functions plus store unit tests, component tests by role and label, and model round-trip, cascade and undo tests. No new e2e.                                                                                                                                                                        |
| VII. Accessible                  | ✅     | Tab/Enter recording, ⌥↑↓ reorder, B branch, / filter, F2 rename. Every notice is in the polite live region. Error path uses dash plus icon plus text, invalid uses dash plus ban icon plus text, broken and chain break use icon plus text, matches use bold plus underline. Focus rings via `focusRing`. |
| VIII. Simplicity, justified deps | ✅     | No new runtime dependency. Drag reorder is an in-house hook (R10). Menus reuse the existing `DropdownMenu`. No playback, rules or Problems panel (007, 008, 015). ADR 0008 records the branch shape.                                                                                                      |

## Project Structure

### Documentation (this feature)

```text
specs/006-flow-authoring/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R16
├── data-model.md        # Phase 1: schema additions, derived FlowAnalysis, UI session state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-additions.md     # schema + @sododeck/model additions
│   └── flow-authoring-ui.md   # user-visible contract (roles, labels, text)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                     # + $defs.Branch, Flow.branches, Step.branch
├── examples/full.sododeck.json        # + flow with two branches
├── src/generated/                     # regenerated (pnpm schema:generate)
└── test/fixtures.ts                   # + invalid Branch cases

packages/model/
├── src/flow-paths.ts                  # NEW analyzeFlow (pure)
├── src/ops/branches.ts                # NEW addBranch, updateBranch, removeBranch, appendStep,
│                                      #     captureFlowStructure, restoreFlowStructure
├── src/ops/steps.ts                   # moveStep path/branch-step refusals; branch ref validation
├── src/ops/cascade.ts                 # branch removal; flow removal lists branch children
├── src/ops/refs.ts, src/integrity.ts  # step.branch reference checks
├── src/observe.ts                     # child kind 'branch'
├── src/preview.ts                     # RemovalTarget 'branches'
├── src/editor.ts, src/index.ts        # wire + export
├── test/flow-paths.test.ts            # NEW
└── test/{round-trip,edit,undo,cascade,integrity}.test.ts  # + branch cases

apps/app/src/
├── state/ui-store.ts                  # + activeFlow, flowSession, hoverEdgeId, flowFilter;
│                                      #   pendingDelete → { targets: RemovalTarget[] }
├── editor/flows/                      # NEW
│   ├── flow-list.tsx                  # features + flows, "No feature", menus, grips, filter
│   ├── flow-filter.tsx, filter-flows.ts
│   ├── flow-order.ts                  # global index for in-feature moves, move-to-feature
│   ├── new-flow-dialog.tsx
│   ├── step-list.tsx, step-row.tsx, branch-header.tsx, recording-hint.tsx
│   ├── session-chip.tsx               # top-bar chip: Recording / Editing, Undo, Done, Cancel
│   ├── flow-session.ts                # start/record/done/cancel/addBranch actions (pure over editor)
│   ├── record-edge.ts                 # contiguity + invalid notice (uses analyzeFlow)
│   ├── candidate-edges.ts             # keyboard candidates in reading order
│   ├── flow-overlay.ts                # edge + node marks for the canvas
│   ├── invalid-edge-popover.tsx
│   ├── use-flow-sync.ts               # prune activeFlow/session on removals (any origin)
│   ├── use-flow-shortcuts.ts          # B, ⌥↑/⌥↓, ⌫ in session, /, F2
│   ├── use-sortable-list.ts           # pointer + keyboard reorder bounded by group
│   └── inspector-flow.tsx, inspector-step.tsx, inspector-branch.tsx
├── editor/left-sidebar.tsx            # Features section → <FlowList/> / session step list
├── editor/top-bar.tsx                 # renders <SessionChip/> when a session is active
├── editor/inspector.tsx               # routes activeFlow / session to flow inspectors
├── editor/deck-to-flow.ts             # optional overlay arg; DeckEdgeData.flow, node flowStart
├── editor/deck-edge.tsx, deck-node.tsx# draw badges, dashes, icons, ring + tag
├── editor/use-canvas-handlers.ts      # edge click → recordEdge in session; hover enter/leave
├── editor/use-canvas-shortcuts.ts     # session: Tab/Enter candidates, Esc cancel, ⌘Z last step,
│                                      #   pause structure edits
├── editor/json-panel-view.ts          # Selection tab shows flow (label Flow/Step)
├── editor/confirm-delete-dialog.tsx, describe-removal.ts  # RemovalTarget[] incl. features,
│                                      #   flows, branches
└── bench/generate-deck.ts (+ apps/app/bench/perf.bench.ts)  # flows mode + 2 scenarios

docs/decisions/0008-flow-branches.md   # NEW ADR
apps/app/CLAUDE.md, packages/model/CLAUDE.md, packages/schema/CLAUDE.md
.agents/skills/react-flow/SKILL.md     # overlay arg on toFlowEdges/toFlowNodes
```

**Structure Decision**:

- The work stays inside the existing boundaries: `schema` defines the format, and `model` owns
  structure rules and derivation.
- The app gets one new folder, `editor/flows/`, for everything flow-specific. The shared editor
  files are touched only at their extension points: sidebar section, top bar, inspector routing,
  edge/node data, handlers, shortcuts and the delete dialog.

## Implementation order (for /speckit-tasks)

1. Schema + ADR 0008 → model (`analyzeFlow`, branch ops, restore, tracking, removal) with tests.
2. UI store additions + `use-flow-sync`.
3. **P1 slice (stories 1–2)**:
   - flow list (read-only)
   - "+ New flow"
   - session chip
   - recording clicks with overlay
   - invalid popover
   - keyboard candidates
   - Done / Cancel / ⌘Z
   - bench
4. **Story 3**: features CRUD, flow rename, move and delete, inspectors, step editing, reorder, edit
   mode + Cancel restore.
5. **Story 4**: branches (B, split into "a", validation, error-path styles, fork inspector).
6. **Story 5**: filter, broken-step rows and "Has problems".
7. JSON panel label, docs (`CLAUDE.md` files, react-flow skill), visual check, bench after.

## Complexity Tracking

| Violation                                                                                                                                          | Why Needed                                                                                                                                                                                                                                       | Simpler Alternative Rejected Because                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Edit-mode Cancel checkpoint: a frozen copy of one flow's steps and branches held in the UI store during an edit session (principle I, borderline). | Clarification Q1 requires Cancel to restore the structure while keeping text edits. The checkpoint is created and applied only by the model (`captureFlowStructure` / `restoreFlowStructure`), and it is never rendered or read as current data. | Yjs `UndoManager` rollback also reverts text edits and interleaved remote edits. `Y.snapshot` requires `gc: false` on every deck (unbounded growth). Writing edits to a draft outside the deck duplicates data and breaks the JSON panel and autosave. |
