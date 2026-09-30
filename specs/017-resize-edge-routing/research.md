# Research: Resize Cards and Route Connectors (017)

Findings come from reading `main` at `60cfc46` (016 merged). Each item records the decision, why, and what else was considered. Paths are relative to the repo root.

## R1. File format: `Node.size` and `Edge.route`

**Decision**:

- `Node.size`: optional, `$ref: #/$defs/Size` (added by 016; `width` / `height` with `exclusiveMinimum: 0`). It goes right after `position`, so written files keep a natural key order.
- New `$defs/Side`: `enum ["top", "right", "bottom", "left"]`.
- New `$defs/EdgeRoute`: an object with `additionalProperties: false` and three optional properties: `fromSide` (`Side`), `toSide` (`Side`) and `offset` (number, canvas px, may be negative or fractional).
- `Edge.route`: optional, `$ref: #/$defs/EdgeRoute`, after `links`.
- No version bump (ADR 0002: additive optional fields). `pnpm schema:generate`; Ajv/Zod parity stays green. `full.sododeck.json` gains a sized node and a routed edge (the coverage test requires every property). Invalid fixtures: a non-positive size, an unknown side, and an extra key in `route`.
- The 120 × 44 – 800 × 600 range is **not** in the schema. The schema has no `minimum` / `maximum` anywhere, and a range error would make the whole file fail to import with the generic "The file is not a valid deck." Instead the app clamps what it writes and draws, and 015 reports out-of-range files (R11).
- An empty `route` (`{}`) stays valid in the schema, so a hand-written one round-trips losslessly. The app never writes one: the model op removes `route` when nothing is left (R8).

**Rationale**: this mirrors the 016 group frame change, and the schema stays a structural contract.

**Alternatives**:

- `minimum` / `maximum` in the schema: rejected, because one bad size would block the whole deck.
- A semantic rule for a non-empty `route`: rejected. It would reject hand-written files for no user benefit.
- Free waypoints (`points[]`): rejected by the backlog and the founder (§g-37). The Miro-like shapes are scheduled as 022-connector-style. That feature's ADR decides how waypoints relate to `offset`.

## R2. What a stored size means across zoom levels

**Finding**: cards have no single default size today. `nodeSize(level)` (`apps/app/src/editor/canvas-geometry.ts:66`) returns 164 × 50 at the landscape, system and container levels and 164 × 104 at the component level. `deck-to-flow.ts:306,329` puts that size on every React Flow node.

**Decision**: a stored `size` replaces the level size **at every level**. Inside it, the card's content still switches between the compact and the full layout by `data.level`. A card without `size` keeps today's level size. Group frame fitting (016's `fitGroupFrames`, ⌘G) uses `size ?? COMPONENT_CARD_SIZE`, the same "largest box" rule 016 uses today. The spec was corrected to match (FR-001, edge cases).

**Rationale**: a card the user sized should not jump between sizes while they zoom, and connectors attached to it would move with it. Keeping absent = level size means untouched decks look identical.

**Alternatives**:

- Size only at the component level: rejected. The user resizes at whatever zoom they are at, usually the system level.
- Scaling the stored size by level: rejected. It is surprising, and it breaks the "exactly 244 × 80" acceptance.

## R3. One place that answers "what box does this card occupy"

**Finding**: about 30 call sites assume a single size: `NODE_SIZE`, `nodeSize(level)`, `COMPONENT_CARD_SIZE`, or a single `size` argument to `groupBounds` / `selectionFrame` / `boundsOf`. The full list is in the plan's Source Code section. `snap.ts`, ELK, the marquee and the minimap already take whatever boxes they are given.

**Decision**:

- `canvas-geometry.ts` gains `cardSize(node, level): Size` (stored size, clamped to the limits, else the level size) and `cardBox(node, index, level): Rect`.
- `groupBounds`, `selectionFrame` and `boundsOf` take the level and size each member with `cardSize`. The `groupBounds` cache key becomes the level plus the deck snapshot (the snapshot changes whenever a size does).
- In the model, `fitGroupFrames` gains an optional `sizeOf(node)` callback. It defaults to the current single size, so 016's callers and tests keep working.
- Every listed call site switches to these helpers. `canvas-actions.ts` `centredOn` stays: a new card has no size yet.
- `deck-to-flow.ts` compares `width` / `height` in its node cache check (`:307-323`). Today it never does, so a resize would otherwise render a stale node.

**Rationale**: one choke point, as 016 did with `groupBounds`. Missing a call site shows up as a visible misalignment, so the plan lists every one.

**Alternatives**: reading React Flow's `measured` sizes was rejected. Measured sizes are view state that arrives a frame late, and export and layout run without React Flow.

## R4. Card resize gesture

**Decision**:

- `deck-node.tsx` renders eight `NodeResizeControl`s (`@xyflow/react`, already used by `group-boundary-node.tsx`), styled `.sd-resize-handle`. They show only when the card is the **single** selected object and editing is allowed (not in flow mode, recording, view-only, or a collapsed group).
- New `apps/app/src/editor/editing/card-resize.ts` mirrors `frame-resize.ts`:
  - `startCardResize` calls `beginGesture`, `setCanvasGesture('card-resize')` and `setActiveGesture({ cancel })`.
  - `applyCardResize` runs on every pointer move. It writes `node.size`, plus the position when resizing from the top or left: through `moveInView`, so a view with its own positions gets the change in that view.
  - `endCardResize` calls `endGesture`, so the whole drag is one undo step.
  - Esc runs `cancelGesture()` (016).
- Pure maths: `resize-limits.ts` generalises `resizeFrame` into `resizeBox({ start, proposed, handle, min, max, step, keepRatio, fromCentre })`. The group path keeps its content minimum. The card path uses min 120 × 44, max 800 × 600 and step 4, where "step" rounds the absolute width and height to multiples of 4. That gives 164 + 80 = 244 and 50 + 30 = 80, as in the acceptance scenario.
- Snapping: a new pure `snapEdges(box, handle, candidates, threshold)` in `snap.ts` moves only the edges the handle drags, against the on-screen candidates collected at gesture start (as `drag-session.ts` does). ⌘ disables it. The 4 px step is applied after snapping, unless the snap target itself is not on the 4 px grid; then the snap wins, so edges line up exactly.
- Readout: the UI store gains `resizeReadout: { width, height, x, y } | null`, rendered by `guides-overlay.tsx` next to the dragged corner.
- Double-click on a handle calls the `node.resetSize` action (R9).

**Alternatives**: a hand-rolled pointer handler was rejected, because `NodeResizeControl` already solves handle hit areas and cursor styles, and 016 uses it.

## R5. Text inside a resized card

**Decision**: title and subtitle keep their font size. `deck-node.tsx` computes a line clamp from the card height with a pure `textLines(size, level)`. Available height = height − vertical padding − kind tile row (full layout only), divided by the token line height. Title and subtitle each get `-webkit-line-clamp` (Baseline in all four browsers). One line is the minimum, so a 44 px card behaves like today's truncation. Tooltip (`title`) and the drawer already show the full text.

**Alternatives**: scaling the text and showing the description were rejected by the founder (clarification Q4).

## R6. Path with pinned sides and a middle-segment offset

**Finding**:

- `getSmoothStepPath` (`@xyflow/system` 0.0.83) takes `centerX` / `centerY`. Its `offset` is the length of the straight stub at each end, not a middle shift.
- For **opposite** sides (right↔left, top↔bottom) the middle segment sits at `centerX` (horizontal pair) or `centerY` (vertical pair), and the returned `labelX` / `labelY` equal that centre. For perpendicular or same-side pairs it ignores the centre and draws a single corner (L) or a U.
- `DeckEdge`, `MergedEdge` and `export/edge-geometry.ts` each call `getSmoothStepPath` with `borderRadius: 8`.

**Decision**:

- New pure module `apps/app/src/editor/routing/route-path.ts`:
  - `resolveSides(fromBox, toBox, route)`: a pinned side wins; otherwise `facingSides`, now compared on box **centres** (identical to today for equal-size cards).
  - `middleSegment(sides)`: `'vertical' | 'horizontal' | null`. Only opposite pairs have one.
  - `routedStepPath({ sourceX, …, sides, offset })`: calls `getSmoothStepPath` with `centerX = defaultMidX + offset` or `centerY = defaultMidY + offset` when a middle segment exists. The default mid is the stub-gapped midpoint the library uses at `stepPosition` 0.5. It returns `{ path, labelX, labelY, segment }`, where `segment` = `{ axis, at, from, to }` for the handle, or null.
- `DeckEdge` and `export/edge-geometry.ts` use it. `MergedEdge` and port edges stay automatic (edge case in the spec). With offset 0 and no pinned sides, the output is byte-identical to today (unit test against `getSmoothStepPath`).
- Labels, step badges, the popover anchor, the reduced-motion token and problem glyphs already sit at `labelX` / `labelY`. The animated token uses `<animateMotion path>`. So they all follow the new path with no extra work (FR-017).
- For L, U and straight shapes, `segment` is null: no handle, and a stored offset is ignored when drawing but kept in the file (spec FR-012, corrected).
- Export: `edgePath` takes the edge's route. `extent` includes the shifted middle segment (today it pads the source / target box by the 20 px stub only), so PNG / SVG crop correctly.

**Rationale**: reusing the library keeps automatic routes identical to today, adds about 60 lines of pure code, and needs no new dependency.

**Alternatives**:

- Our own full orthogonal router (points plus rounded corners): rejected. It is more code, and its visual diffs against today would need a design review.
- `stepPosition` ratio instead of a px offset: rejected. A ratio moves the segment when the cards move apart, which contradicts FR-014.

## R7. Segment drag

**Decision**:

- `DeckEdge` renders the segment handle (10 × 24, rotated to the segment's axis) through `EdgeLabelRenderer` when the edge is the single selection, editing is allowed and `segment` is not null. It has `role="slider"`, the name "Move middle segment" and `aria-valuenow` = offset.
- New `editing/segment-drag.ts`:
  - Pointer down → `beginGesture`, `setCanvasGesture('segment')`.
  - Moves convert the pointer with `screenToFlowPosition`. The offset = pointer coordinate on the free axis − default mid, snapped against the centre lines and edges of on-screen cards along that axis (1-D `snap`, 6 screen px, ⌘ off). Each move writes it with `setEdgeRoute`.
  - Pointer up → `endGesture`.
- Esc cancels (`cancelGesture`). **R**, while this gesture is active, cancels the gesture and then runs `edge.resetRoute`. That is one undo step, because the cancelled gesture leaves no history.
- Free movement (clarification Q2): no clamp and no card avoidance.
- Ghost: while the gesture is active, `DeckEdge` also draws the automatic path (`routedStepPath` with no route) dashed at 40 % opacity. Readout: a signed offset (`+60`, `−18`) in the shared readout.

## R8. Model ops for size and route

**Finding**: `editor.update('nodes' | 'edges', id, patch)` validates and writes in one transaction. `null` deletes a key. `writePatch` keeps `position` as a per-axis `Y.Map` and would replace `size` / `route` as whole maps.

**Decision**:

- Extend `writePatch` so `size` and `route` are written per key like `position`, so that two tabs editing different sides merge.
- New `packages/model/src/ops/shape.ts`:
  - `setCardSize(ctx, nodeId, size | null)`: `null` removes it. It does not clamp; the app clamps, and the model stays format-level.
  - `setEdgeRoute(ctx, edgeId, patch: { fromSide?: Side | null; toSide?: Side | null; offset?: number | null } | null)`: merges into the current route, drops `offset: 0`, and removes `route` entirely when no key is left.
- Both run through `ctx.transact` with the undo key `nodes:<id>:size` / `edges:<id>:route`, so they join an open gesture. `DeckEditor` gains `setCardSize` / `setEdgeRoute`.
- Round-trip cases:
  - node with and without `size`
  - edge with `route` (sides only, offset only, both, empty `{}` as written by hand)
  - absent fields stay absent after edits to other fields
- Removal of an edge or node needs no cascade: the fields live on the object itself.
- `fromJSON` / `toJSON` need no special case (`convert.ts` skips `undefined`).

## R9. Actions, toolbar, menus, keys and drawer

**Decision**:

- New action module `apps/app/src/editor/actions/shape-actions.ts`, registered in `ACTIONS` (the slot reserved in `index.ts`):
  - `node.resetSize`: where menu `component`; `disabledReason` "Default size" when there is no `size`; icon `Scaling`.
  - `edge.resetRoute`: where menu `connection` and toolbar `connection`; `disabledReason` "Route is automatic"; icon `RotateCcw`, as in frame 100.
- Both use `oneStep` and announce ("Size reset", "Route reset").
- Shortcuts (`editor/shell/shortcuts.ts`, "Editing" section, listed in the help dialog):
  - `resizeCard` = ⌘⇧ + arrow
  - `moveSegment` = ⌥ + arrow / ⌥⇧ + arrow when a connector is selected
  - `resetRoute` = R, during a segment drag only
- Handling in `use-canvas-shortcuts.ts` extends the ⌥-arrow branch: a single selected edge → segment move, otherwise 016's nudge. Both reuse `createNudger`'s burst pattern (a gesture that closes after 1 s idle) through a small generalisation, `createBurst(onFirst, onStep, onEnd)`.
- Keys are ignored while a text field has focus (the existing guard).
- Drawer:
  - `inspector/node-inspector.tsx` gains a **Size** section, `size-fields.tsx`: W and H number fields and "Reset size". It follows the `frame-fields.tsx` pattern: a draft while typing, commit on Enter or blur, Esc cancels, one step per commit, clamped and rounded to whole px.
  - `inspector/edge-inspector.tsx` gains a **Route** section, `route-fields.tsx`: "From side" and "To side" selects (Auto, Top, Right, Bottom, Left), an Offset field (disabled with the hint "No middle segment for these sides" when `segment` is null) and "Reset route".

## R10. Keys for resizing: why not ⌥⌘ + arrow

**Finding**: Chrome on macOS uses ⌥⌘ ← / → to switch tabs. The browser handles it before the page, so `preventDefault` cannot stop it. ⌃⌥ + arrow is VoiceOver's modifier pair, and ⌃ + arrow switches Spaces or opens Mission Control. ⌥ + arrow and ⌥⇧ + arrow are 016's nudge.

**Decision**: ⌘⇧ + arrow (Ctrl+Shift+arrow on Windows and Linux), 4 px per press. The browsers bind these only inside text fields, where canvas shortcuts are off anyway. There is no 20 px variant: holding the key repeats, and large sizes are typed in the drawer. The spec was updated (FR-019, story 5), and the founder is told in the report.

**Alternatives**: ⌥⌘ + arrow (backlog) was rejected because of the Chrome tab switch. `[` / `]` keys only cover one axis. A "resize mode" toggle adds a hidden mode.

## R11. Out-of-range sizes in files

**Decision**:

- New 015 problem kind `card-size-out-of-range` in `packages/model/src/problems.ts`, appended to `PROBLEM_KINDS`. The message is: `Component "API Gateway" has a size of 900 × 40; allowed 120 × 44 to 800 × 600`. The target opens the component's drawer.
- `cardSize` clamps for drawing (R3), so the canvas never draws an unusable card.
- The file still opens (spec FR-030, corrected).

## R12. Endpoint drag, side targets and reconnect

**Finding**:

- `edgesReconnectable` is on. `onReconnect` (`use-canvas-handlers.ts:478-488`) checks `connectionCheck` and writes `{ from, to }`, but ignores the handle ids.
- Cards render four `type="source"` handles (`top` / `right` / `bottom` / `left`) plus a `body` target while connecting, with `ConnectionMode.Loose`.

**Decision**:

- While a reconnect is in progress (`onReconnectStart` sets `setCanvasGesture('endpoint')` and remembers which end moves), the card under the pointer shows its four side targets: 12 px rings on the existing handles, made visible by the gesture class.
- The nearest side to the pointer is "hot". It is computed by the pure `nearestSide(box, point)` and marked by a filled ring plus a larger size, not by colour alone.
- A custom `connectionLineComponent` draws the live path dashed in primary through `routedStepPath`, with the pinned side applied. The edge being moved stays drawn as the ghost (40 % opacity through the gesture class).
- `onReconnect`:
  - the side = `nearestSide` of the drop point on the target card (so dropping on the `body` target still pins a side)
  - same card → `setEdgeRoute({ fromSide | toSide })` only
  - another card → `connectionCheck` as today, then one `oneStep` writing `{ from, to }` and the new side, and clearing `offset` (the old offset belongs to the old geometry)
- Esc, or a drop elsewhere, leaves everything as it was (xyflow cancels the reconnect). ⌥ does nothing (§g-44).
- The inspector's "reattach" keeps working. When the card changes, it also clears the route side of the end it moved.

## R13. Layout, export, thumbnails

**Decision**:

- **Tidy / ELK** (`tidy-layout.ts:62,78,164`): send each node's `cardSize`; `fitGroupFrames` uses `sizeOf`. Pinned sides are kept (layout moves cards only), and offsets are kept as stored.
- **Export** (`export/scene.ts`): card rects use `cardSize`; edges pass `edge.route` to `edgePath` (the `TODO(017)` markers at `scene.ts` and `edge-geometry.ts:44` are resolved).
- **Thumbnails** (`storage/deck-summary.ts`): each node tuple gains optional `w, h`. Summaries without them use the default, so library metadata written before this feature still renders; the summary is recomputed on the next save anyway. `library/deck-thumbnail.tsx` draws per-node sizes.

## R14. Gesture hints

**Decision**: `CanvasGesture` gains `'card-resize' | 'segment' | 'endpoint'`. `gesture-hints.ts`:

| Gesture       | Hint                                                    |
| ------------- | ------------------------------------------------------- |
| `card-resize` | "⇧ Keep ratio · ⌥ From centre · ⌘ No snap · Esc Cancel" |
| `segment`     | "⌘ No snap · R Reset route · Esc Cancel"                |
| `endpoint`    | "Drop on a side to pin it · Esc Keep old end"           |

On other platforms, ⌘ becomes Ctrl through the existing `apple` flag. Each hint is announced once, by the existing `GestureHint`.

## R15. Performance

**Decision**:

- `cardSize` is O(1). `routedStepPath` is one `getSmoothStepPath` call plus a few additions.
- The `deck-to-flow` caches compare the resolved size and sides, so pan and zoom re-render nothing.
- The segment handle and the ghost only render for the single selected edge.
- The bench gains a `resized-routed` scenario: every node sized, 200 edges with a route (a mix of sides and offsets), then pan and zoom. Run `pnpm bench` before and after, with results in `bench-before.md` / `bench-after.md`. Target: ≥ 60 fps and no regression (FR-031, SC-006).

## R16. ADR

**Decision**: ADR **0019 "Card size and connector route"**. ADR 0010 in the backlog hint is taken (sticky notes), and 0018 is reserved by 020-card-style. It records:

- optional `node.size` / `edge.route`
- sides plus one middle-segment offset instead of waypoints, and why
- the offset is relative to the automatic middle, in px
- the offset is ignored for non-opposite sides
- a stored size wins at every zoom level
- out-of-range sizes are a problem, not a schema error
- forward compatibility: builds older than this feature reject files with the new fields (`additionalProperties: false`), like any additive field; the version stays v1 because newer builds read older files unchanged.
- 022 (connector styles, waypoints) is the planned extension point.
