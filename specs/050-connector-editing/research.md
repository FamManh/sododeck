# Research: Connector editing (050)

Decisions for [plan.md](plan.md). Each has the decision, why, and what else was looked at. Names checked on `main` at `615fd85` (2026-10-04). Root causes come from reading the code; interaction mechanics come from studying how mature whiteboard editors handle connectors (described on their own terms).

## Root causes (from the founder's manual test)

| Symptom                        | Cause (file)                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ends jump while dragging       | `editing/anchor-drag.ts`: a pointer > 12 px (`BODY_DEPTH`) inside the card counts as "automatic", so the preview falls back to React Flow's `toX/toY`, which snaps to the body handle or to a side handle within the default 20 px `connectionRadius`. `nearestSide` switches side abruptly at the diagonals.                                |
| Line drag stops after a few px | `routing/route-handles.tsx`: `begin()` sets pointer capture on the midpoint button, then `setActive()` makes every midpoint render `null` (`if (dragging) return null`). The capturing element unmounts, so `pointermove` stops. The new bend button never gets capture.                                                                     |
| Weight has no visible effect   | `deck-edge.tsx`: `width = selected ? 2.5 : …`. The connector is always selected while its weight is edited in the inspector or popover.                                                                                                                                                                                                      |
| Weight control is fiddly       | `line-style/line-style-controls.tsx` `WeightSlider`: five `onClick` dots, no pointer drag on the track.                                                                                                                                                                                                                                      |
| Handles under cards            | React Flow renders `.react-flow__edgelabel-renderer` **before** `NodeRenderer`. `RouteHandles` and `LabelHandle` portal into it, so cards cover them. The pointer path for ends is React Flow's reconnect anchor, which lives in the edge SVG (also under cards) at the side **midpoint**, not at a pinned `fromAt` point.                   |
| Can't connect groups           | `Edge.from/to` are node ids only (`ops/refs.ts`, `integrity.ts`). Group frames are emitted with `connectable: false`, `pointerEvents: 'none'` and no `<Handle>` (`deck-to-flow.ts` `groupNodes`, `group-boundary-node.tsx`).                                                                                                                 |
| Guides stay visible            | Only card drag, card resize and bend drag set guides. None listen to `pointercancel`, `lostpointercapture`, window `blur` or unmount. Card resize relies on React Flow's `onResizeEnd`, which never fires if the node unmounts (semantic-zoom switch). `GuidesOverlay` draws whatever is in the store, with no "is a gesture running" check. |

## R1. Handles live in a layer above the cards

- **Decision:** `RouteHandles`, the new end handles, segment handles and `LabelHandle` render through `ViewportPortal` (already used by `selection-frame.tsx` and `guides-overlay.tsx`). `.react-flow__viewport-portal` comes after `NodeRenderer` in the DOM, and a CSS rule gives it a z-index above `.react-flow__nodes`, so handles sit above every card, group and sticky and receive the pointer first. The portal itself is `pointer-events: none`; only the handle buttons are `pointer-events: auto`, so the canvas under it still works.
- **Why:** this matches how mature editors draw the selected connector's handles: in an overlay above all elements, hit-tested before anything else. It is a few lines. Edges stay under cards, so the drawing order of lines does not change.
- **Alternatives:** `elevateEdgesOnSelect` (lifts the whole edge above cards, so the line would draw across cards while selected, and the reconnect anchor still sits at the midpoint); z-index on `.react-flow__edgelabel-renderer` (would also lift every edge label above cards, which is a visual change).

## R2. One pointer-drag helper for all connector handles

- **Decision:** a small `editing/pointer-drag.ts` helper starts on `pointerdown` and listens on `window` for `pointermove`, `pointerup`, `pointercancel` and `blur`. It also captures the pointer on the pressed element when it can. Nothing the drag does depends on the pressed element staying mounted. The drag only "commits" after **4 screen px** of travel (`DRAG_THRESHOLD`); below that, release is a click and nothing is written. The helper owns cleanup: the end, cancel, blur and unmount paths all run the same `finish()`. Bend, midpoint, segment, end, label and weight-slider drags use it.
- **Why:** it fixes the root cause of "moves a bit then stops" (lost capture on unmount) once for every handle, and gives one place for the threshold and the cleanup that FR-002/FR-003/FR-028 need. Window listeners are the platform way to keep a drag alive across re-renders.
- **Alternatives:** keep element capture and stop unmounting the midpoint buttons (fixes one case, and the next refactor breaks it again); a drag library (new dependency, Principle VIII).

## R3. Our own end handles replace React Flow's reconnect

- **Decision:** the two end buttons in `RouteHandles` become real pointer handles. They are drawn at the **actual** end points (`ends.start` / `ends.end`, i.e. the pinned `fromAt` / `toAt` point or the outline point). A new `editing/endpoint-drag.ts` session does the reconnect:
  1. On press, store the offset between the pointer and the end point (FR-007), so pressing never moves it.
  2. Each frame, the pointer minus that offset is hit-tested against targets (R4) and resolved into an attachment (R5).
  3. The live attachment goes into the UI store (`endpointPreview`), and `DeckEdge` draws the connector with that end overridden, in its own type (FR-013).
  4. Release writes once (R11): `from`/`to` if the target changed, plus `fromSide/fromAt` or `toSide/toAt`, or clears the side for "automatic". Esc drops the preview.
- React Flow reconnect is turned off (`edgesReconnectable={false}`); `onReconnectStart/End/onReconnect`, `endpointHover`, `endpointAnchor`, `reconnectingEdgeId` and the `.react-flow__edgeupdater` CSS are removed. `EndpointConnectionLine` stays for **new** connections only, where it also uses R4/R5 so a new connection can land on a group.
- **Why:** the jumping comes from React Flow's handle snapping and from the anchor sitting at the midpoint. Owning the gesture is the only way to get continuous attachment, a pointer offset and handles above cards. It also removes the `mousemove` side channel the reconnect needed.
- **Alternatives:** tune `reconnectRadius` / `connectionRadius` (does not fix the midpoint anchor, the handles under cards or the 12 px rule); keep React Flow reconnect for cards and add our own only for groups (two code paths).

## R4. Target hit-testing: cards first, then groups

- **Decision:** a pure `routing/endpoint-target.ts` `hitTarget(point, scene, zoom)` returns the topmost target under or near the pointer:
  - cards (and collapsed-group cards) in paint order, inside or within **16 screen px** of the box;
  - otherwise the **innermost** group whose frame contains the point, or whose frame outline is within 16 screen px.
    A card always wins over the group it sits in (spec edge case). The scene comes from the same boxes the canvas draws (`cardBox`, group frame rects from `deck-to-flow`), so it is right for views, drill-in and semantic zoom.
- **Why:** gives groups a large, natural drop area (anywhere inside the frame that isn't a card, plus the frame edge) without changing how group frames take pointer events (they stay `pointer-events: none`, so marquee and pan inside a group keep working). Distances are in screen px divided by zoom (FR-030).
- **Alternatives:** React Flow handles on the group frame as drop targets (tiny targets, and the frame would have to take pointer events); only the frame border as a target (hard to hit on large groups).

## R5. Attachment along the outline: nearest point, midpoint snap, centre zone

- **Decision:** a pure `routing/outline-attach.ts` `attachToOutline(box, geometry, pointer, opts)`:
  - **Nearest point:** for a rectangle, project the pointer onto each side segment and take the nearest (exact, and continuous around corners because neighbouring sides meet at the corner points). For a shape (031), sample `outlinePoint(geometry, box, side, at)` at 48 steps per side, take the nearest sample, then refine between its neighbours. Output: `{ side, at, point }`.
  - **Midpoint snap:** when `|at − 0.5| × sideLength ≤ 6 screen px` and ⌘/Ctrl is not held, `at = 0.5` and `snapped = true`. No other stops (clarify 2026-10-04: many ends on one side must be placeable freely). Sides shorter than 3 × the snap reach do not snap.
  - **Centre zone:** only for the end's **own current** target. The zone is the middle 40 % of the box on each axis, and it exists only when it stays ≥ 24 screen px from every side. Inside it, the result is `automatic: true` and the readout says "automatic".
  - Keyboard stops (0/25/50/75/100 %) stay in `stepAnchor`. A new `nudgeAnchor(side, at, ±0.01)` handles Shift + arrow and carries round corners like `stepAnchor`.
- **Why:** follows the cursor without jumps (SC-003), matches the founder's workflow of nudging ten ends apart, and keeps the 022 "drop in the middle = automatic" escape hatch where it can't be hit by accident.
- **Alternatives:** keep the 5-stop snap at 8 px (pulls bunched ends onto each other); ray from the other end through the pointer to the outline (smooth, but the end then doesn't sit under the cursor, which makes nudging imprecise); a timed switch to "precise" mode (hidden behaviour, harder to test).

## R6. Groups as connector endpoints

- **Decision (file format):** `Edge.from` / `Edge.to` may name a **node or a group**. The JSON Schema shape doesn't change (both are `Id`); descriptions change, and model checks accept either collection. Ids are already unique across the deck when generated (`deckHasId`). A load check is added: a node and a group sharing one id is an integrity error (the endpoint would be ambiguous). **No version bump:** every existing file stays valid with the same meaning, and the widening is recorded in ADR 0030. Older app builds would show such an edge as a broken reference, which is acceptable for a single-deploy app before 1.0, and is noted in the ADR.
- **Model:**
  - `refsOf` gets a new ref target `'nodes|groups'`, accepted by `validate.ts` `exists`, and `integrity.ts` checks `from/to` against both.
  - `endpointOf(deck, id)` returns `{ kind: 'node' | 'group', title }` and replaces node-only title lookups (`problems.ts`, `search/index.ts`, app labels).
  - `removeGroup` deletes edges touching the group in the same transaction, and `previewRemoval` reports them (FR-022).
  - `toFragment` / `pasteFragment` keep and remap group-ended edges through the existing `groupIds` map.
- **Rules (app `connection-rules.ts`):** self, duplicate (either direction) and a new `'contains'` refusal: a group can't connect to anything inside it (members, nested groups, their cards), nor a card to a group that contains it. `connectTargets` lists groups too.
- **Canvas:** `group-boundary-node.tsx` gets four hidden `<Handle>`s (needed by React Flow to draw edges to the node) and visible connect handles on the frame label for starting a connection from a group. `deck-to-flow` `boxFor` / `endGeometry` resolve `group:<id>` to the frame rect. `visible-graph` maps a group endpoint to its representative: the frame when shown, the `collapsed:<id>` card when collapsed, the nearest visible ancestor's representative or a port when the group is out of the drill scope.
- **Flows:** a group-ended edge is an ordinary step. Continuity stays plain id equality, so a step into group G followed by a step leaving a card inside G is a chain break. That keeps flows predictable; documented as a known limit. `boundsOf` and flow viewport fitting include group frames.
- **Export:** `export/scene.ts` adds group frame rects to `rects`, so PNG/SVG draw group connectors. There is no text-diagram export yet (012 deferred Mermaid), so FR-020b has nothing to change today; the scene contract notes it for later.
- **Layout:** `tidy-layout` / `elk-layout` include group ids in the endpoint set (ELK accepts edges to compound nodes).
- **Why:** the founder uses card↔group and group↔group connectors often. Treating groups as first-class endpoints in the model, rather than drawing to a hidden member, keeps ids stable (Principle III) and keeps one model.
- **Alternatives:** store a group edge as an edge to a chosen member card plus a flag (lies about intent, and breaks when that card moves out); a separate `groupEdges` collection (duplicates every edge feature: style, route, flows, inspector).

## R7. Elbow segment drag (US5) without new stored data

- **Decision:** the selected elbow connector shows a segment handle in the middle of each straight run of ≥ 24 screen px (FR-004). Dragging moves the run along its normal only:
  - **Inner run** (between two bends): both bends move together on the run's normal axis.
  - **First or last run** (touching a card): the run leaves the card perpendicular to the side, so moving it along its normal slides that end along the side. The drag updates `fromAt` / `toAt` (pinning the side) through R5's math, without the centre zone.
  - **Automatic elbow** (no waypoints): on drag start, the drawn vertices (`elbowVertices`) become explicit bends, as 022 already does for the 017 offset on the first bend edit.
  - Snap: neighbouring runs' lines and the 22 px grid within 6 screen px (`snapBend`), ⌘ off. Release: `simplifyWaypoints`, one write. Double-click on the handle drops the two bends of that run (the run returns to its automatic place); on an end run it clears that end's `at`.
- **Why:** gives the "drag a whole segment" feel using only the 022 route model (waypoints and anchors), so there is no schema change and no second route representation. 022 removed the 017 one-axis segment pill because it fought with bends; this version builds on bends.
- **Alternatives:** store per-segment offsets (new format, two models of one route); a full orthogonal router that re-routes around fixed segments (large, and conflicts with "store only intent").

## R8. Weight: real width while selected, a draggable slider

- **Decision:**
  - `DeckEdge` draws the selected connector at its own width. Selection is shown by the selection colour (unchanged) plus a halo path under the line: `--color-primary-soft`, width `own.width + 6`, not interactive. Colour is not the only cue (Principle VII), because the halo adds shape and the route handles appear.
  - `WeightSlider` becomes pointer-draggable on its whole track via R2. Each move maps the pointer x to the nearest of the five stops (`WIDTHS`, unchanged per clarify) and sets a UI-store `lineStylePreview { edgeIds, width }`, which `DeckEdge` reads before the stored width. Release writes once through `applyLineStyle` (one undo step); Esc clears the preview. A click on the track still picks the nearest stop. Keys are unchanged.
  - The focus highlight `--sd-edge-hl-width` (034) still lifts plain connectors in focus mode only.
- **Why:** fixes the "nothing happens" symptom at its cause and gives the founder the slider they asked for, without a new dependency (the slider is already a custom `role="slider"`).
- **Alternatives:** Radix Slider from `packages/ui` (would need restyling to the 022 stop look and a stop-snapping layer; no less code); widening the stops (rejected in clarify).

## R9. Guides are always cleared

- **Decision:**
  1. **Ownership.** Every gesture that sets guides clears them in one `finish()` reached from release, cancel, `pointercancel`, `lostpointercapture`, window `blur` and unmount. Bend, segment and endpoint drags get this from R2. Card resize gets an unmount cleanup in `component-node-parts.tsx` that calls `cancelCardResize` if a resize is open.
  2. **Safety net.** `canvas.tsx` registers window `pointerup`, `pointercancel`, `blur` and `visibilitychange` listeners. After the current event (a microtask), if no gesture is registered (`hasActiveGesture()` from `drag-session.ts`, new), they clear `guides`, `bendPreview`, `endpointPreview`, `connectorReadout`, `resizeReadout` and a stale `canvasGesture`.
  3. **Render guard.** `GuidesOverlay` draws only while a gesture is registered.

  `DragController` (card drag) also handles `blur`, and wraps `apply()` so an exception still clears guides.

- **Why:** belt and braces. The per-gesture fixes address the known leaks, the safety net catches anything React Flow swallows (e.g. `onNodeDragStop` or `onResizeEnd` never firing), and the render guard makes a leftover invisible even before it is cleared.
- **Alternatives:** clear guides on a timer (flicker during slow drags); only the safety net (would still leave stale `canvasGesture` and preview state between events).

## R10. Spread ends evenly (US7)

- **Decision:** a pure `editing/spread-ends.ts` `spreadEnds(view, cardIds)` returns route patches:
  - For each selected card and each side, collect the connector ends currently drawn on that side. That includes automatic ends (their resolved side) and both ends of a self-loop. Skip connectors hidden in the view.
  - Sides with fewer than 2 ends are skipped. Each kept end is ordered by its other end's position along the side's axis (x for top/bottom, y for left/right), with ties broken by edge id for stable results.
  - Assign `at = (i + 1) / (n + 1)`, which leaves a margin at both corners, and pin the side.
  - Writes are one `oneStep` of `setEdgeRoute` calls.
  - Exposed as action `node.spreadEnds` (menu + toolbar for `node`, `where: { menu: ['node'], toolbar: ['node'] }`, disabled with reason "No side has two or more connector ends") and as a palette command in `command-palette/commands.ts`. Announces "Spread N ends on M sides".
- **Why:** turns the founder's 40-drag chore into one action, using only 022 anchor data.
- **Alternatives:** auto-spreading on every render (changes today's automatic look for every deck, and is not intent stored by the user); spacing in px (breaks on resize, whereas fractions follow the card).

## R11. One write per gesture

- **Decision:** every drag keeps its live state in the UI store (`bendPreview`, new `endpointPreview`, `lineStylePreview`) and writes the document once on release, inside `oneStep` (one undo step). A reconnect that changes the target writes `from/to` and the route patch in the same transaction. Nothing is written for a click below the threshold or for an unchanged result.
- **Why:** Principle I (previews are UI-only until release), FR-006, and no Yjs writes per frame (performance).

## R12. Performance

- **Decision:** only the selected connector computes handles and previews. Preview selectors are per-edge (`s.endpointPreview?.edgeId === id ? … : null`), as `bendPreview` is today, so other edges don't re-render during a drag. Hit-testing runs only during an endpoint drag or a new connection, at most once per animation frame (rAF-throttled in the drag helper). The outline sampling for shapes (R5) is 4 × 48 points per frame for one target. Run `pnpm bench` before and after, and record the numbers in `bench-before.md` / `bench-after.md` (SC-008, Principle V).
