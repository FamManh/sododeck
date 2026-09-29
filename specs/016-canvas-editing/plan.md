# Implementation Plan: Canvas Editing

**Branch**: `016-canvas-editing` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-canvas-editing/spec.md`, clarified on 2026-09-29:

- Groups are frames with a stored position and size. Users drag and resize them, and they never auto-scale.
- A card released outside its group's frame leaves the group.
- Views that have their own positions also have their own frames (§g-55).

**Dependency**: 019 (card quick edit) is merged on `main` (`55c087e`), and 012 (export) is merged (`57c4f46`). I checked these names on `main`:

- **Store**: `useUiStore` (`select`, `focus`, `announce`, `canvasGesture` / `setCanvasGesture`, `titleEdit`, `drill`, `canvasPointer`, `selection`).
- **Canvas**: `useCanvasHandlers` (`onNodeDragStart`, `onNodesChange`, `onNodeDragStop`, `onSelectionStart` / `onSelectionEnd`, `applySelectChanges`), `useCanvasKeyDown`, `useEditorShortcuts`, `groupBounds`, `GROUP_PADDING`, `nodeSize`, `COMPONENT_CARD_SIZE`, `GROUP_NODE_PREFIX`, `viewDeck` / `projectNodes`.
- **Actions**: `ACTIONS`, `Action`, `actionsFor`, `runAction`, `useRunAction`, `oneStep`, `showUndoToast` / `useUndoToast`, `SHORTCUTS` / `shortcutLabel`, `copyText`, `supportsClipboardWrite`.
- **Model**: `DeckEditor.{add, update, remove, batch, beginGesture, endGesture, moveInView, undo}`, `EditContext.transactUntracked`, `materialize`, the group cascade, `fromJSON`, `parseSododeckFile`, `checkDuplicateIds`.
- **Tidy**: `tidy-layout.ts` (ELK compounds).

## Summary

Editing on the canvas becomes fast. Groups become real frames.

- **Group frames** (R1–R4):
  - The schema gains optional `Group.position` / `Group.size`, a new `Size` / `Frame`, and optional `View.groupFrames`, plus two semantic rules. There is no version bump.
  - The model fits missing frames untracked after open.
  - `groupBounds` prefers stored frames, so the canvas, minimap, export and collapsed cards follow automatically.
  - `setGroupFrames` mirrors `moveInView` for base versus other views.
  - Group removal cleans up per-view frames.
  - ADR 0017.
- **Frame gestures** (R5, R6, R14):
  - Group nodes become draggable by the label and an 8 px edge band, and resizable with xyflow `NodeResizer`.
  - The subtree moves as one step.
  - Drop into / out of a frame is decided by the pointer through the pure `dropTarget` / `membershipChanges`. ⌥ keeps membership.
  - Esc runs the new `cancelGesture()`.
- **Clipboard** (R9, R10):
  - The fragment envelope `{ sododeckFragment: 1, deck }` is built and parsed in `packages/model` with the file parser.
  - Platform copy / cut / paste events handle the keys. The menu's Paste uses the feature-detected `readText`.
  - `pasteFragment` remaps ids in one step. Duplicate and ⌥-drag reuse it.
- **Group from selection** (R11): the `groupSelection` model op, then the 019 title edit on the label. The rail Group button is enabled.
- **Align, distribute, nudge** (R8, R12): pure maths over the displayed card sizes. ⌥A / D / W / S. ⌥(⇧) arrow bursts merge into one step with a 1 s idle. Arrows during a drag add an offset.
- **Snapping** (R7): on-screen candidates collected at drag start, pure `snap` and `gaps`, and a `ViewportPortal` guides overlay. ⌘ disables snapping and ⇧ locks the axis.
- **Marquee and hints** (R13): Partial / Full selection with ⌥, a count chip, Esc restores the selection, and a `HintBar` in `packages/ui`.
- **Tests and bench** (R15): pure, model, schema and component tests. No new e2e. Bench before and after, with `drag-100-selected` and `group-drag`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; no new dependency.

- `@xyflow/react` ^12.12: `NodeResizer`, `dragHandle`, `onNodeDrag`, `SelectionMode`, `ViewportPortal`.
- `yjs` (model), `zustand` 5, `radix-ui` through `packages/ui`, `lucide-react`. Icons: `Copy`, `Scissors`, `ClipboardPaste`, `CopyPlus`, `Group`, `AlignStartVertical`, `AlignCenterVertical`, `AlignEndVertical`, `AlignStartHorizontal`, `AlignCenterHorizontal`, `AlignEndHorizontal`, `AlignHorizontalSpaceAround`, `AlignVerticalSpaceAround`.

**Storage**:

- **Schema v1, additive**: `Size`, `Frame`, `Group.position`, `Group.size`, `View.groupFrames`. Regenerate types and Zod with `pnpm schema:generate`.
- **UI store**: `dropTarget`, `guides`, `dragReadout`, `marqueeCount`, `pasteSerial`, and an extended `canvasGesture`.
- **localStorage**: a fragment-copied hint (a timestamp only).

**Testing**:

- **Schema**:
  - `full.sododeck.json` gains frames (the coverage test).
  - Invalid fixtures: a half frame, an unknown `groupFrames` key, and a non-positive size.
  - Ajv/Zod parity stays green.
- **Model** (`packages/model/test`):
  - Round trip for a group with and without a frame, and for a view with `groupFrames`.
  - `fitGroupFrames` (nested, empty, cycles).
  - `fillGroupFrames` adds no undo step.
  - `setGroupFrames` on the base view and on another view.
  - `materialize` copies frames, and the cascade removes `groupFrames`.
  - `groupSelection` (common parent, one step).
  - Fragment: to, parse, reject plain text or invalid input, and a round trip.
  - `pasteFragment` (id remap, dropped outside edges, dropped unknown rules, parent, offset, one step).
  - `cancelGesture` (no undo or redo left).
- **Vitest, pure (app)**:
  - `snap`, `gaps`, `align` / `distribute`, `drop-target`, `membership-changes`, `paste-placement`, `common-parent`, `subtree`, `resize-limits`.
  - `groupBounds` prefers the stored frame.
  - `viewDeck` projects `groupFrames`.
- **Testing Library, by role and name** (the [contract](contracts/canvas-editing-ui.md)):
  - Clipboard actions and menus: enabled and disabled states, tooltips.
  - Align submenu, ⌘G to rename, the rail Group button.
  - Group drawer Frame fields.
  - Hint bar texts, announcements.
  - `use-canvas-shortcuts` nudge and align keys, `use-editor-shortcuts` ⌘C / X / V / D / G through copy / paste events.
  - `packages/ui` `hint-bar`.
- **Existing tests updated**: `group-boundary-node` (now selectable and draggable), `canvas-geometry` (stored frame), `deck-to-flow`, `tidy-layout` (writes frames), `export/scene` (frames), `shortcuts` (G → ⌘G).
- **E2E**: no new tests (constitution VI). Smoke stays green.
- **Bench**: before and after, plus `drag-100-selected` and `group-drag`.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. Copy / cut / paste events are universal. `readText` for the menu is feature-detected in `features.ts`.

**Project Type**: web app (monorepo). Changes span `packages/schema`, `packages/model`, `packages/ui` (`HintBar`) and `apps/app`.

**Performance Goals**:

- ≥ 60 fps dragging 100 selected cards at 500 / 1,000 with snapping (FR-038, SC-006).
- No pan or zoom regression.
- Snap work is O(on-screen cards) per frame.
- Fitting frames on open for 2,000 nodes takes < 50 ms, measured in a unit test with a time bound, at the model level.

**Constraints**:

- One undo step per gesture, paste, duplicate, group, align or nudge burst.
- Fitting and materializing are untracked.
- No network. The clipboard is used only on explicit user actions.
- Membership never follows geometry.

**Scale/Scope**:

- About 20 new files: about 14 in `apps/app/src/editor/editing/`, 1 in `packages/ui`, and about 4 model or schema files.
- About 25 changed files.
- 1 ADR (0017), and updates to 3 package `CLAUDE.md` files.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no deviations._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Frames, membership and positions live only in the Yjs document and are written through `DeckEditor` ops. Guides, the drop target, readout, marquee count and paste serial are UI-only store fields. Drag start positions are a handler ref, never document copies.                                                                                                   |
| II. Schema-owned format          | ✅     | The schema adds optional `Size` / `Frame` / group and view fields, with semantic rules. Types and Zod are regenerated, and parity stays green. The fragment is built and parsed in `packages/model` with `parseSododeckFile`, so the app never serializes the document itself. Round-trip cases cover frames with and without values. No version bump, per ADR 0002. |
| III. Stable identity             | ✅     | Paste and duplicate allocate new ids and remap every reference inside the fragment. Moving or resizing never changes an id. Membership is by id, not geometry. The cascade removes `groupFrames[id]` with the group.                                                                                                                                                 |
| IV. Local-first, private         | ✅     | The clipboard is only the local system clipboard, on explicit gestures. The localStorage hint stores a timestamp, never content. No network. Clipboard read is feature-detected in `features.ts`, with a fallback.                                                                                                                                                   |
| V. Performance off main thread   | ✅     | Snapping considers only on-screen cards. Fitting frames is linear and runs once on open (well under a frame for the bench deck). Tidy stays in its worker. Bench runs before and after with two new scenarios.                                                                                                                                                       |
| VI. Strict types, tested         | ✅     | Pure modules have unit tests, model ops have round-trip and behaviour tests, and UI is tested by role and name. No new e2e.                                                                                                                                                                                                                                          |
| VII. Accessible                  | ✅     | Every action has a keyboard path: shortcuts, menus and toolbar, ⌥ arrow nudge, and drawer X/Y/W/H for frames. Handles and guides are pointer-only visuals with keyboard equivalents. Announcements cover each result. Drop target, guides and marquee are never shown by colour alone (dashed borders, chips, labels). Reduced motion is respected.                  |
| VIII. Simplicity, justified deps | ✅     | No new dependency (`NodeResizer` ships in `@xyflow/react`). One choke point (`groupBounds`) instead of new resolution paths. ADR 0017 records the reversal of "no geometry stored".                                                                                                                                                                                  |

## Project Structure

### Documentation (this feature)

```text
specs/016-canvas-editing/
├── plan.md                        # This file
├── research.md                    # Phase 0: R1–R15
├── data-model.md                  # Phase 1: schema, model API, UI state, transitions
├── quickstart.md                  # Phase 1: validation guide
├── contracts/canvas-editing-ui.md # user-visible contract
├── checklists/requirements.md
└── tasks.md                       # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                          # + Size, Frame, Group.position/size, View.groupFrames
├── src/semantic-rules.ts (+test)           # + frame pair, groupFrames keys
├── src/generated/{types,zod}.ts            # regenerated
├── examples/full.sododeck.json             # + frames
└── test/fixtures.ts                        # + invalid frame cases
packages/model/src/
├── geometry.ts                             # + fitGroupFrames, frameOf helpers
├── fragment.ts                             # NEW toFragment, parseFragment, serializeFragment
├── ops/frames.ts                           # NEW fillGroupFrames, setGroupFrames
├── ops/paste.ts                            # NEW pasteFragment (id remap)
├── ops/group-selection.ts                  # NEW groupSelection
├── ops/views.ts                            # materialize copies frames
├── ops/cascade.ts                          # group removal drops groupFrames
├── editor.ts                               # wire new ops + cancelGesture
└── index.ts                                # exports
packages/model/test/                        # round-trip, frames, fragment, paste, group-selection, cancel-gesture
packages/ui/src/components/hint-bar.tsx (+test)   # NEW inverse pill with key caps
apps/app/src/
├── editor/editing/                         # NEW (016)
│   ├── snap.ts, gaps.ts (+tests)           # guides and snapping maths
│   ├── align.ts (+test)                    # align / distribute
│   ├── drop-target.ts, membership-changes.ts (+tests)
│   ├── subtree.ts (+test)                  # group subtree for drags
│   ├── resize-limits.ts (+test)            # min frame from members
│   ├── paste-placement.ts, common-parent.ts (+tests)
│   ├── use-drag-editing.ts                 # snap / drop / ⌥ / Esc / arrows inside drag handlers
│   ├── use-nudge.ts (+test)                # ⌥ arrow bursts
│   ├── use-clipboard-events.ts (+test)     # copy / cut / paste document events
│   ├── guides-overlay.tsx (+test)          # ViewportPortal guides + labels + readout + drop chip
│   ├── marquee-chip.tsx                    # count chip
│   └── gesture-hint.tsx (+test)            # HintBar per gesture + announcement
├── editor/actions/clipboard-actions.ts     # NEW copy / cut / paste / duplicate
├── editor/actions/align-actions.ts         # NEW Align ▸ submenu
├── editor/actions/group-actions.ts         # + group.create
├── editor/actions/index.ts (+test)         # register modules
├── editor/canvas-geometry.ts (+test)       # groupBounds prefers stored frame
├── editor/views/view-state.ts (+test)      # project groupFrames
├── editor/deck-to-flow.ts (+test)          # group nodes selectable / draggable, dragHandle
├── editor/group-boundary-node.tsx (+test)  # handle classes, NodeResizer, drop highlight
├── editor/use-canvas-handlers.ts           # group drag, resize, drop, snap, ⌥-drag, marquee Esc
├── editor/canvas.tsx (+test)               # selectionMode, overlays, onNodeDrag
├── editor/use-canvas-shortcuts.ts (+test)  # ⌥ arrows, ⌥A / D / W / S, arrows during drag
├── editor/open-deck.ts, routes/editor-page.tsx  # fitMissingFrames after open
├── editor/tidy-layout.ts (+test)           # write ELK group boxes as frames
├── editor/inspector/group-inspector.tsx (+test)  # Frame section X / Y / W / H
├── editor/shell/shortcuts.ts (+test)       # "Editing" section, G → ⌘G
├── editor/shell/rail.tsx                   # enable Group
├── state/ui-store.ts (+test)               # new UI fields
├── lib/features.ts (+test)                 # supportsClipboardRead
└── bench/perf.bench.ts                     # + drag-100-selected, group-drag
docs/decisions/0017-group-frames-and-clipboard.md   # NEW ADR
packages/schema/CLAUDE.md, packages/model/CLAUDE.md, apps/app/CLAUDE.md, packages/ui/CLAUDE.md   # updated
docs/backlog.md (017 reuses Size + resize wrapper)
```

**Structure Decision**: the monorepo layout is unchanged. `apps/app/src/editor/editing/` holds this feature's gesture maths and hooks. The action modules plug into 019's `ACTIONS`. The model owns every document write and the fragment format.

## Complexity Tracking

No constitution violations to justify.

The frames reverse schema v1's "no geometry stored" design (ADR 0004 / 0006). The change is additive and optional, and is recorded in ADR 0017.
