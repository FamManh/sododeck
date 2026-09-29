# Research: Canvas Editing (016)

Every decision below was checked against `main` (`57c4f46`). Paths are repo-relative.

## R1 — Group frame in the file format

- **Decision**:
  - Add `$defs/Size` `{ width, height }` (numbers with `exclusiveMinimum: 0`, `additionalProperties: false`). 017 reuses it for `node.size`.
  - Add optional `Group.position` (`Position`) and `Group.size` (`Size`), declared after `parent`, and rewrite the Group description: "A named frame holding nodes…".
  - Add optional `View.groupFrames`: `propertyNames: Id` → `$defs/Frame { position, size }`, declared right after `View.positions`.
  - New semantic rules in `packages/schema/src/semantic-rules.ts`:
    - A group has both `position` and `size`, or neither.
    - `groupFrames` keys are ids of existing groups (same pattern as rule S3 for `positions`).
- **Rationale**:
  - Mirrors `Node.position` and the planned `node.size`, so the file reads the same for cards and frames.
  - The change is additive and optional, so ADR 0002 says there is no version bump.
  - Pairing position and size keeps "no frame" (older file) distinct from "half a frame".
  - The Zod generator ignores `dependentRequired` and `propertyNames`, which is why both checks are semantic rules, like S3.
- **Alternatives**:
  - A flat `group.frame {x,y,width,height}`: a second shape for the same idea, and it would not match 017's `node.size`.
  - Reusing `view.positions` for group ids plus a new `view.sizes`: it mixes node and group keys, and would break S3's meaning.
  - A required frame with a version bump: it would break every existing file, so it was rejected.

## R2 — Fitting frames for older decks

- **Decision**:
  - A pure function `fitGroupFrames(deck, cardSize, padding)` in `packages/model/src/geometry.ts` returns frames for groups that have none. It is inner-first: the union of member cards and child frames, plus padding. Cycles and empty groups are skipped. It works for the base positions and, separately, for each view that has its own positions.
  - A new editor op, `DeckEditor.fillGroupFrames(frames)`, writes them inside `ctx.transactUntracked`, like the untracked view materialize step (`packages/model/src/ops/views.ts:66-73`). It adds no undo step.
  - The app calls it once after the editor is created for an opened deck (`apps/app/src/routes/editor-page.tsx`, helper in `apps/app/src/editor/open-deck.ts`), with `COMPONENT_CARD_SIZE` (164×104) and `GROUP_PADDING` (24).
- **Rationale**:
  - The model owns document writes, but card sizes live in the app, so the size is passed in.
  - Fitting at the largest card size means members fit at every semantic zoom level. At full detail the frame matches today's derived box exactly (SC-003b); at smaller levels it is a little looser than today.
  - An untracked write means ⌘Z never "unfits" frames. Two tabs fitting at once write identical values, and last write wins.
- **Alternatives**:
  - Fitting inside `fromJSON`: it covers imports only, not decks already in IndexedDB, and the model does not know card sizes.
  - Rendering a derived box until the first edit: the group would still auto-scale, which contradicts the founder decision.

## R3 — One place that resolves a group's box

- **Decision**:
  - `groupBounds(deck, size)` (`apps/app/src/editor/canvas-geometry.ts:79`) returns the **stored frame** when a group has one. Otherwise it falls back to today's derived box, for a deck opened by an older tab before fitting runs.
  - `viewDeck` / `projectNodes` (`views/view-state.ts:94-159`) also project `view.groupFrames[id]` onto `group.position` and `group.size`.
  - Every current caller then gets frames without changes: `deck-to-flow.ts` (canvas and minimap), `visible-graph.ts` (collapsed cards), `use-canvas-shortcuts.ts` (arrow focus), `export/scene.ts`, `storage/deck-summary.ts`.
- **Rationale**: a single choke point keeps the diff small, and export (012) and the minimap follow for free.
- **Alternatives**: a new `groupFrame()` next to `groupBounds` would mean touching seven callers, and it is easy to miss one.

## R4 — Per-view frames

- **Decision**:
  - The existing `materialize()` step for a non-base view (`ops/views.ts:66`) also copies each group's base frame into `view.groupFrames`, untracked.
  - A new op, `DeckEditor.setGroupFrames(viewId, frames)`, writes `group.position` / `group.size` on the base view (`views[0]`) and `view.groupFrames` otherwise, mirroring `moveInView`. The undo key is `views:<id>:groupFrames`.
  - The cascade (`ops/cascade.ts:164`) deletes `view.groupFrames[id]` when a group is removed.
- **Rationale**: this matches the "base writes the object, other views write overrides" rule already used for positions. A view becomes independent exactly when its positions do.
- **Alternatives**: a frame that is always derived in views would auto-scale in views, which is inconsistent.

## R5 — Group drag, resize and hit area

- **Decision**:
  - Group boundary nodes become `selectable: true`, `draggable: true`, with `dragHandle: '.sd-group-handle'`. The label button and an 8 px edge band carry that class. The outer div stays `pointer-events: none`, so empty space inside the frame keeps panning and marquee selection (FR-017).
  - **Drag**:
    - On drag start, the handler records the start position of the group's subtree (members, nested groups and their frames).
    - In `onNodesChange`, a group position change becomes a delta. One `editor.batch` then applies `moveInView` for the members and `setGroupFrames` for the frames, inside the existing `beginGesture` / `endGesture`.
  - **Resize**: xyflow `NodeResizer` (already installed, `@xyflow/react` ^12.12) with 8 controls, `minWidth` / `minHeight` taken from the members' box plus padding (and at least 160 × 96), and `keepAspectRatio` while ⇧ is held. Resizing from the centre (⌥) is computed from `params.direction` in `onResize`. The final frame is written through `setGroupFrames` inside one gesture.
- **Rationale**:
  - React Flow already gives hit testing, pointer capture and screen/flow transforms.
  - Handle styling follows the DESIGN.md resize handle (112), so 017 reuses the same wrapper for cards.
- **Alternatives**: custom pointer handling was rejected because it duplicates xyflow's drag and zoom maths.

## R6 — Drop target and membership

- **Decision**:
  - A pure function, `dropTarget(frames, pointer, excluded)` in `apps/app/src/editor/editing/drop-target.ts`, returns the innermost frame containing the pointer. "Innermost" means the deepest in the parent chain, with the smaller area winning ties. It skips the dragged groups and their descendants.
  - During a drag, `onNodeDrag` updates `ui.dropTarget`, which is UI-only and drives the 110 highlight. It is null while ⌥ is held.
  - On drag stop, still inside the gesture, a pure function `membershipChanges(...)` computes, for each dragged top-level item, its new parent: the target, the drill scope, or none. It writes `node.group` / `group.parent` with `editor.update`.
  - Each move that nests a group shows `showUndoToast`.
- **Rationale**: "pointer decides" (110). Because membership is explicit, frames never capture cards by covering them (FR-046).

## R7 — Snapping and guides

- **Decision**:
  - On drag start, collect candidate lines from the components visible on screen that are not being dragged: left, centre and right x; top, middle and bottom y.
  - A pure function, `snap(box, candidates, threshold)` in `editing/snap.ts`, returns the per-axis offset and the guides. The threshold is `6 / zoom`, and the nearest line wins per axis. `gaps.ts` works out the distance label and equal-gap labels from the same row or column.
  - `onNodesChange` adds the snap offset to every dragged position change before writing.
  - Holding ⌘ / Ctrl skips snapping, tracked with `keydown` / `keyup` during the gesture. ⇧ locks the drag to the axis with the larger offset.
  - Guides render in a `ViewportPortal` overlay from `ui.guides`, which is UI-only.
- **Rationale**: O(candidates) work per frame, and only for on-screen cards, so FR-038 holds. Bench before and after.
- **Alternatives**: a spatial index was not needed at 500 nodes, since on-screen culling already bounds the set.

## R8 — Nudge, and arrow keys during a drag

- **Decision**:
  - In `useCanvasKeyDown`, handle ⌥(+⇧)+arrow **before** the existing `if (event.altKey) return` (`use-canvas-shortcuts.ts:238`).
  - The first nudge opens `editor.beginGesture()`. A 1 s idle timer (and any other key or pointer down) calls `endGesture()`, so a burst is one undo step (FR-024). The selection moves with `moveInView`; selected groups move through the R5 subtree move.
  - During a pointer drag, plain arrows add 1 / 10 px to a drag offset ref that `onNodesChange` applies (§g-45).
  - Match on `event.code`, not `key`, because ⌥ changes `key` on macOS.
- **Alternatives**: the model's 500 ms `captureTimeout` is shorter than the spec's 1 s, and applies to all edits.

## R9 — Clipboard

- **Decision**:
  - ⌘C, ⌘X and ⌘V use the platform `copy` / `cut` / `paste` events on the document, skipped when focus is in a text field. The handler writes `clipboardData.setData('text/plain', envelope)` and reads `getData('text/plain')`. This needs no permission prompt and works in all four target browsers.
  - The canvas-menu Paste item uses `navigator.clipboard.readText()` when `supportsClipboardRead()` (new in `apps/app/src/lib/features.ts`). Without it, the item is disabled with the tooltip "Press ⌘V to paste".
  - Paste is enabled only when a UI-only "a fragment was copied" flag says so: a timestamp in `localStorage` (`sododeck:fragment-copied`, no content), read on focus and on the `storage` event. It is only a hint; paste still validates what it reads.
  - **Envelope** (`packages/model/src/fragment.ts`): `{ "sododeckFragment": 1, "deck": <a valid SododeckFile holding only the copied nodes, edges and groups> }`. `parseFragment(text)` validates `deck` with `parseSododeckFile` plus `checkDuplicateIds`. Anything else returns `null`, so plain text is ignored (FR-007).
- **Rationale**:
  - Cross-tab paste needs the system clipboard.
  - The copy / paste events avoid the async-API permission prompts.
  - Reusing the file parser makes the fragment "valid against the file format" by construction (FR-002), and keeps JSON ↔ model conversion in `packages/model` (Principle II).
- **Alternatives**:
  - A custom MIME type (`web application/x-sododeck`): Chromium only.
  - An in-app clipboard over BroadcastChannel: it does not survive closing the source tab and adds a second channel.

## R10 — Paste and duplicate ops

- **Decision**:
  - `toFragment(json, selection)`: the selected nodes, the edges with both ends selected, and the groups whose whole subtree is selected, all with frames.
  - `DeckEditor.pasteFragment(fragment, { offset, parent, viewId, knownRules })`, in one batch:
    - Allocates new ids with the editor's id allocator.
    - Remaps the edges' `from` / `to`, the nodes' `group`, and the groups' `parent` within the set. Parents outside the set become `parent`.
    - Drops rule ids that are not in the deck.
    - Offsets node positions and group frames.
    - In a non-base view, also writes view positions and frames.
    - Returns the new ids.
  - Duplicate is `pasteFragment(toFragment(...), { offset: 24,24 })` with no clipboard.
  - ⌥+drag: on stop, the originals go back to their start positions and a copy is pasted at the dropped offset, all in the same gesture.
  - Placement is a pure function, `pastePlacement(...)`: at the pointer, else +24 px when that is on screen, else the view centre, with +24 for each repeat at the same point.
- **Rationale**: one model op, which gets a round-trip test and an id-remap test. The app only decides where things go.

## R11 — Group from selection

- **Decision**:
  - `DeckEditor.groupSelection({ nodes, groups, title, parent, frames })` adds the group and repoints its members, in one batch.
  - The app computes `parent` (the innermost common ancestor, pure `commonParent()`) and the fitted frame, both base and per-view.
  - The action `group.create` (⌘G, and "Group" in the toolbar and menus) then starts the 019 `titleEdit` on the new group, which is a separate undo step (FR-012).
  - The rail Group button (`shell/rail.tsx:160`, "coming soon") is enabled with the same action.
- **Alternatives**: composing `add` and `update` in the app was rejected, because the backlog hint asks for a model op with a round-trip case.

## R12 — Align and distribute

- **Decision**:
  - Pure functions `align(rects, mode)` and `distribute(rects, axis)` in `editing/align.ts`, over the displayed card sizes at the current level (`nodeSize(level)`).
  - Written with one `moveInView` inside `oneStep`.
  - Actions `arrange.align.*` / `arrange.distribute.*` go under an "Align" submenu in the menu and the multi toolbar. ⌥A / ⌥D / ⌥W / ⌥S are matched by `event.code`.
- **Rationale**: aligning to what the user sees gives exact visual alignment (SC-004).

## R13 — Marquee refinements and hint bar

- **Decision**:
  - `selectionMode` switches between `SelectionMode.Full` and `SelectionMode.Partial` while ⌥ is held during a marquee.
  - The count chip reads the live selection count and follows the pointer, rendered in the canvas overlay.
  - Esc during a marquee restores the selection saved at `onSelectionStart`.
  - The hint bar is a presentational `HintBar` in `packages/ui` (inverse pill with key caps). The app shows it from `ui.canvasGesture`, which is extended to `'pan' | 'drag' | 'group-drag' | 'resize' | 'marquee'`, with one announcement per gesture.

## R14 — Cancel a gesture with Esc

- **Decision**: a new `DeckEditor.cancelGesture()` ends the open gesture, undoes its stack item, and drops that item from the redo stack. Nothing stays in history (US2-10). The app calls it on Esc during a drag or resize, and ignores the rest of that drag's changes.
- **Rationale**: this belongs next to `beginGesture` / `endGesture` and the UndoManager, and is tested in the model.

## R15 — Performance and tests

- **Decision**:
  - Bench: run `pnpm bench` before and after, and add `drag-100-selected` (100 selected nodes, snapping on) and `group-drag` (with `BENCH_GROUPS=1`).
  - Tests:
    - Pure unit tests for snap, gaps, align, drop-target, membership, placement, commonParent and fitGroupFrames.
    - Model tests for the new ops, round trip with and without frames, cascade, cancelGesture, and the fragment.
    - Schema: an example, fixtures, and parity.
    - Component tests by role and name.
  - No new e2e test (constitution VI).
- **ADR 0017** records R1–R4 (group frames) and R9 (clipboard envelope).
