# Implementation Plan: Basic Canvas Editing

**Branch**: `003-canvas-basic` (git: not created yet; work is currently on `main`) | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-canvas-basic/spec.md`

**Dependency**: 002 (`@sododeck/model` editor) is merged on `main` (d3974cc). The API names used
here were checked against `packages/model/src/index.ts` and `editor.ts` on 2026-09-27.

## Summary

Turn the M0 read-only canvas into an editor. The architect adds components from a palette, draws,
validates and reconnects connections, selects and moves, deletes with a confirmation and an Undo
toast, undoes and redoes, and navigates large diagrams. All of it also works from the keyboard.

- **Rendering**: React Flow stays fully controlled. Nodes and edges are derived every render from
  an incremental, structurally shared deck snapshot.
- **Writes**: every edit goes through the 002 `DeckEditor`, which also gives undo, gestures and
  batches.
- **UI state**: selection, focus, popovers and Labels live in the Zustand UI store.
- **Model additions**: two additive exports in `@sododeck/model`, `createDeckSnapshot` (fast
  reads while dragging) and `previewRemoval` (confirmation counts that match the real cascade).
- **UI package**: one new `Popover` wrapper and one toast-duration token in `packages/ui`.
- **Not included**: no file-format change (cloud/partner kinds deferred, §g-28 → B) and no new
  dependency ([research.md](research.md)).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies** (all existing):

- `@xyflow/react` 12 for the canvas.
- `@sododeck/model` (002 editor) and `@sododeck/schema` types.
- `@sododeck/ui` (Radix via `radix-ui`, `lucide-react`) and Zustand 5.
- No new dependency.

**Storage**: N/A. There are in-memory decks at `/deck/demo` and `/deck/new`; persistence is 005.
The Labels preference goes in `localStorage`.

**Testing**:

- Vitest for the pure view models, stores and the model additions.
- Testing Library component tests, by role and label.
- The existing Playwright smoke suite, with no new e2e tests.
- `pnpm bench` with an added drag scenario.

**Target Platform**: The latest 2 versions of Chrome, Edge, Firefox and Safari, desktop,
1440×900 reference.

**Project Type**: Web SPA (`apps/app`) plus internal packages (`packages/model`, `packages/ui`) in
the pnpm/Turborepo monorepo.

**Performance Goals**:

- ≥ 60 fps pan, zoom and drag at 500 nodes / 1,000 edges.
- A single edit is reflected in the next frame; a snapshot update takes < 2 ms.

**Constraints**:

- React Flow state is derived, never authoritative.
- No React Flow built-in delete or keyboard handling; the app does its own confirmation and roving
  focus.
- The existing smoke-suite selectors stay unchanged.
- Tokens only, lucide icons.

**Scale/Scope**:

- About 12 new app components and 9 pure functions.
- 2 model exports and 1 UI component.
- About 18 screens and states to match (light and dark).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                         | Check                                                                                                                                                                                                                                                                                                    | Result |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth         | Nodes, edges, positions, titles and labels are read from the model snapshot and written only via `DeckEditor`. React Flow gets derived arrays. Drag writes positions to the document every frame (R2). Selection, focus, viewport, popover and Labels are UI-only (Zustand or React Flow viewport).      | ✅     |
| II. Schema-owned format, lossless | No format change. Yjs ↔ JSON stays in the model: `createDeckSnapshot` lives there, with a parity test against `toJSON` after every 002 operation.                                                                                                                                                        | ✅     |
| III. Stable identity              | Ids come from `add`. Reconnect updates `from`/`to` and keeps the edge id. Undo restores the same ids (tested). Nothing is keyed by title.                                                                                                                                                                | ✅     |
| IV. Local-first, private          | No network. Icons and fonts are bundled. The smoke no-third-party test stays. `localStorage` is only used for the Labels preference, with try/catch.                                                                                                                                                     | ✅     |
| V. Performance                    | `pnpm bench` before and after, plus a new drag scenario. Incremental snapshot and memoized nodes. There is no heavy work here that needs a worker (group bounds and the outline are O(n) per change).                                                                                                    | ✅     |
| VI. Strict types, tested          | Unit tests for every pure function and store. Component tests by role and label for each user story. No new e2e. The smoke suite passes.                                                                                                                                                                 | ✅     |
| VII. Accessible by default        | Roving tabindex with a visible `focusRing`. Arrow-key navigation, C to connect, E for edges. Every state has a non-colour cue (ring style, "+", ban icon plus text). There is a live region, and every node, edge and control has an accessible name ([contracts/canvas-ui.md](contracts/canvas-ui.md)). | ✅     |
| VIII. Simplicity, dependencies    | No new dependency. Popover comes from the existing `radix-ui`. No command-palette or combobox library; the listbox is small and hand-written. ADR 0006 records how the canvas stays derived (snapshot, drag writes, keyboard model).                                                                     | ✅     |

**Post-design re-check (after Phase 1)**: all ✅. One cross-feature coordination item: the two
model additions ([contracts/model-additions.md](contracts/model-additions.md)) extend the 002 API
additively. They are implemented as the first 003 tasks.

## Project Structure

### Documentation (this feature)

```text
specs/003-canvas-basic/
├── plan.md              # this file
├── research.md          # Phase 0: R1–R13
├── data-model.md        # Phase 1: fields used, UI state, derived view models
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-additions.md   # createDeckSnapshot, previewRemoval
│   └── canvas-ui.md         # roles/names, keyboard map, smoke hooks
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/snapshot.ts            # createDeckSnapshot (R1)
├── src/preview.ts             # previewRemoval: runs the real cascade on a throwaway copy (R5)
├── src/index.ts               # + exports
├── test/snapshot.test.ts      # parity after every op, structural sharing, perf < 2 ms
├── test/preview.test.ts       # preview === batch remove result, per cascade row
└── CLAUDE.md                  # + API

packages/ui/
├── src/components/popover.tsx # Radix Popover wrapper (tokens, focusRing)
├── src/styles/tokens.css      # + --sd-toast-undo: 6000ms
├── src/lib/motion.ts          # + toastUndoMs (CSS/TS parity test)
├── test/popover.test.tsx
└── CLAUDE.md                  # + Popover, token

apps/app/src/
├── model/use-deck-snapshot.ts      # now backed by createDeckSnapshot (same signature)
├── model/editor-context.tsx        # EditorProvider, useEditor(), useHistory()
├── state/ui-store.ts               # selection, focusedId, leftTab, outlineCollapsed, labelsOn, popover, pendingDelete, announce
├── editor/
│   ├── canvas.tsx                  # controlled React Flow, handlers → editor
│   ├── deck-to-flow.ts             # toFlowNodes/toFlowEdges (+ groups, selection, labels)
│   ├── deck-node.tsx               # tile, title, subtitle, rule marker, 4 handles, roving tabindex, target states
│   ├── group-boundary-node.tsx     # dashed boundary + label
│   ├── deck-edge.tsx               # smoothstep 8px, end dot, label pill
│   ├── canvas-geometry.ts          # groupBounds, nearestInDirection, freeSpot
│   ├── connection-rules.ts         # connectionCheck, connectTargets
│   ├── outline.ts                  # buildOutline
│   ├── describe-removal.ts         # confirmation text
│   ├── left-sidebar.tsx            # Outline/Palette tabs
│   ├── outline-tree.tsx
│   ├── palette.tsx
│   ├── empty-canvas-card.tsx
│   ├── zoom-control.tsx
│   ├── canvas-toolbar.tsx          # Labels toggle, selection count
│   ├── edge-popover.tsx
│   ├── connect-popover.tsx         # "Connect X to…" listbox
│   ├── confirm-delete-dialog.tsx
│   ├── announcer.tsx
│   ├── use-canvas-shortcuts.ts     # keyboard map
│   ├── inspector.tsx               # minimal: title / label / deck name / count + delete
│   ├── top-bar.tsx                 # + undo/redo buttons
│   └── demo-deck.ts                # positions moved into node.position
├── routes/editor-page.tsx          # /deck/demo, /deck/new; EditorProvider; ToastProvider
├── routes/bench-page.tsx           # uses node.position + editor (drag scenario)
└── bench/generate-deck.ts          # positions into node.position
apps/app/bench/perf.bench.ts        # + drag scenario
apps/app/CLAUDE.md                  # editor context, snapshot, keyboard model
docs/decisions/0006-derived-canvas.md
```

Each `.ts`/`.tsx` gets a sibling `*.test.ts(x)`.

**Structure Decision**: Most of the work is in `apps/app/src/editor`. The two model exports go in
`packages/model` because constitution II keeps Yjs ↔ JSON and the cascade there. The `Popover` and
the token go in `packages/ui` because they are shared presentational parts. `packages/schema` is
not touched.

## Implementation order (for /speckit-tasks)

1. **Baseline.** Run `pnpm bench` and save the report. Once 002 is merged, re-check the contract
   names.
2. **Model additions.** `createDeckSnapshot` and `previewRemoval`, with their tests. Then switch
   `useDeckSnapshot` to the incremental store.
3. **UI additions.** `Popover` and `--sd-toast-undo`.
4. **Foundations.** `EditorProvider`, `useHistory`, the UI store changes, and the demo, bench and
   generator decks moved to `node.position`. Add the `/deck/new` route.
5. **Read path (US5).** Nodes (subtitle, rule marker), group boundaries, edges and labels, zoom
   control, minimap, Labels toggle, outline tree.
6. **US1.** Palette (click and drag), empty-canvas card, `onConnect` and the edge popover.
7. **US2.** `connectionCheck`, target states, keyboard connect, reconnect.
8. **US3.** Selection (shift/⌘-click, marquee, ⌘A, frame, count), multi-drag gesture, and
   delete → confirm → toast → undo.
9. **US4.** Undo/redo shortcuts and buttons, and selecting restored objects.
10. **US6.** Roving focus, arrow navigation, E, the live region, and an accessibility pass.
11. **Minimal inspector**, ADR 0006, the package `CLAUDE.md` files, visual check, `pnpm bench`
    after, and the full DoD command set.

## Complexity Tracking

No constitution violations; nothing to justify.
