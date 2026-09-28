# Implementation Plan: Model Validation (Problems)

**Branch**: `015-model-validation` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-model-validation/spec.md`

**Dependency**: 006, 008, 009, 010 and 011 are merged on `main` (`2ebf01a`). Names checked on
`main`: model `checkIntegrity`, `IntegrityProblem`, `analyzeFlow`, `FlowProblem`, `ruleChecks`,
`previewRemoval`; app `useDeckSnapshot`, `readDeck`, `openResult`,
`OpenResultContext`, `firstViewShowing`, `viewStateOf`, `setGroupCollapsed`, `collapsedOf`,
`scopeOf`, `drillUp`, `openFlow`, `exitFlow`, `toFlowNodes` / `toFlowEdges` (`overlay`),
`DeckNode`, `DeckEdge`, `CanvasToolbar`, `DeckInspector`, `FlowRow`, `RuleList`,
`removalToast`, `showUndoToast`, `useEditorShortcuts`, `createLayoutClient` (pattern),
`generateBenchDeck`.

## Summary

Show every problem in the deck in one list, on the objects themselves, and one keystroke away.

- **Model** (R1–R3): pure `checkDeck(file) → DeckProblems` in `packages/model/src/problems.ts`. It
  combines `analyzeFlow`, `ruleChecks` and `checkIntegrity` (deduplicated) with three new checks:
  orphans, duplicate connections and overlapping branch conditions. Output is sorted, keyed and
  indexed by object id.
- **Compute** (R4–R5): a problems module worker plus a per-deck store (150 ms trailing throttle,
  latest wins) behind `<ProblemsProvider>` and `useProblems()`. Tests use an inline client.
- **UI** (R6–R11):
  - Self-contained `ProblemsPanel` in the deck inspector (design 60), movable to 018's rail flyout.
  - Amber "n problems" button in the canvas toolbar.
  - Glyphs on nodes and edges through the canvas `overlay`, plus glyphs on flow rows (replacing
    the clay marker) and rule rows.
  - `goToProblem` built on `openResult`, plus collapsed-group / drill reveal and multi-edge select.
  - ⌘. / ⇧⌘. in `useEditorShortcuts`.
  - " · n new problems" in the delete Undo toast.
- **ADR 0013** (derived problems, worker, never stored).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed, no new dependency. `@xyflow/react` 12.12,
`zustand` 5, `yjs` 13.6, `lucide-react` (`TriangleAlert`, `Unlink`, `Copy`, `Workflow`, `Table2`,
`Link2Off`, `CircleCheck`, `ChevronRight`), `@sododeck/ui` (`PanelSection`, `Button`, `Tooltip`,
toast).

**Storage**: none. Problems are derived (§g-23). UI store gains `problemCursor` only.

**Testing**: Vitest in `packages/model/test` (`problems.test.ts`, perf budget) and colocated app
tests (store, client with FakeWorker, navigation, panel, toolbar, node, edge, flow row, rule list,
delete dialog, shortcuts, `deck-to-flow` cache). No new e2e (constitution VI); smoke suite must
pass.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox, Safari (module workers are
supported in all of them).

**Project Type**: web app in a pnpm monorepo (`packages/model`, `apps/app`).

**Performance Goals**: 60 fps at 500 nodes / 1,000 edges unchanged (`pnpm bench` before/after);
list updated within 1 s at 2,000 nodes / 4,000 edges; `checkDeck` ≤ 30 ms at that size (perf test,
× 3 on CI).

**Constraints**: nothing written to the deck, JSON panel, exports or undo history; no network;
keyboard and screen-reader operable; tokens only.

**Scale/Scope**: 1 model module, 1 worker + client + store, ~6 new app files, ~9 edited app files,
~40 tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                 | Check                                                                                                                                               | Status           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| I. Single source of truth | Problems are derived from the snapshot; nothing copied into Zustand/React Flow state except the derived overlay marks; `problemCursor` is UI state. | ✅               |
| II. Schema / round-trip   | No format change; JSON panel and export untouched (SC-004 test).                                                                                    | ✅               |
| III. Stable identity      | Problem keys and targets use ids; titles only for display and sort.                                                                                 | ✅               |
| IV. Local-first, private  | Worker is local; no network; no new feature-detected API (module workers are baseline).                                                             | ✅               |
| V. Off the main thread    | Deck-wide check in a worker; bench before/after. One synchronous `checkDeck` per confirmed delete (see Complexity Tracking).                        | ✅ (1 justified) |
| VI. Strict types, tested  | Pure model tests per kind + dedup + ordering; component tests by role/label; FakeWorker client test.                                                | ✅               |
| VII. Accessible           | Keyboard list, ⌘. walk, accessible names with counts, glyph + text (not colour alone), AA amber tokens.                                             | ✅               |
| VIII. Simplicity          | No dependency; reuses `openResult`, existing checks, layout-client pattern; ADR 0013.                                                               | ✅               |

Post-design re-check (after Phase 1): unchanged, ✅.

## Project Structure

### Documentation (this feature)

```text
specs/015-model-validation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── model-problems.md
│   └── problems-ui.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
packages/model/
├── src/problems.ts                 # NEW checkDeck, DeckProblems, Problem
├── src/index.ts                    # export
├── test/problems.test.ts           # NEW
├── test/perf.test.ts               # + checkDeck budget
└── CLAUDE.md                       # "Added by 015"

apps/app/src/
├── editor/problems/                # NEW
│   ├── problems-client.ts (+ .test.ts)
│   ├── problems.worker.ts
│   ├── problems-store.ts (+ .test.ts)
│   ├── problems-provider.tsx        # ProblemsProvider, useProblems
│   ├── problems-panel.tsx (+ .test.tsx)
│   ├── problems-button.tsx
│   ├── problem-glyph.tsx
│   ├── problem-marks.ts (+ .test.ts)  # DeckProblems → overlay marks
│   └── go-to-problem.ts (+ .test.ts)
├── editor/inspector/deck-inspector.tsx   # + ProblemsPanel
├── editor/canvas-toolbar.tsx             # + ProblemsButton
├── editor/canvas.tsx                     # marks into overlay
├── editor/deck-to-flow.ts                # marks in node/edge data + cache comparison
├── editor/deck-node.tsx / deck-edge.tsx  # glyphs, names
├── editor/flows/flow-row.tsx             # shared glyph, drop local analyzeFlow
├── editor/rules/rule-list.tsx            # glyph
├── editor/confirm-delete-dialog.tsx      # "n new problems"
├── editor/use-canvas-shortcuts.ts        # ⌘. / ⇧⌘.
├── state/ui-store.ts                     # problemCursor
├── routes/editor-page.tsx                # ProblemsProvider
└── test/render-canvas.tsx                # inline problems client in wrappers

docs/decisions/0013-derived-problems.md   # NEW
apps/app/CLAUDE.md                        # problems boundary
```

**Structure Decision**: the check is model code (pure, worker-safe); everything user-facing lives in
a new `apps/app/src/editor/problems/` folder so 018 can move the panel without touching the
checks.

## Complexity Tracking

| Violation                                                                | Why Needed                                                                                                     | Simpler Alternative Rejected Because                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synchronous `checkDeck` on the main thread once per confirmed delete (V) | The Undo toast text ("n new problems") must be built when the delete happens; the worker result arrives later. | Updating the toast when the worker answers: toasts are announced once, so the count would be missed by screen readers and could flicker. Budget 30 ms at 2,000 nodes, user-initiated, not during drag or typing. |
