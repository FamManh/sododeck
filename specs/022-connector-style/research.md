# Research: Connector Style (022)

Decisions for [plan.md](plan.md). Each has the decision, why, and what else was looked at. Names
checked on `main` (2026-10-03, after 029 / 033 / 035).

## R1. Reference frame for bend points (clarify Q1: relative to the two ends)

- **Decision:** a bend point is stored per axis relative to the **centres of the two cards**
  (source centre S, target centre T), never as a board position. On each axis the bend stores
  either a **fraction** of the S→T span (`x`, `y`; 0 = source centre, 1 = target centre, may be
  outside 0–1) or, when that span was shorter than one grid step (22 px) at the moment the bend
  was placed, an **offset in px from the midpoint** (`dx`, `dy`). Decoding:
  `P.x = S.x + x · (T.x − S.x)` or `P.x = (S.x + T.x) / 2 + dx`; same for y. A bend is re-encoded
  only when the user moves it, never when cards move.
- **Why:** follows the cards in every case the spec names (single-card drag stretches, a
  multi-card or group drag where both centres move by the same amount moves the bends by exactly
  that amount, per-view positions and auto-layout are just other centres). Per-axis fractions keep
  horizontal and vertical runs horizontal and vertical, so an elbow keeps its right angles (US2 #7).
  The offset fallback avoids dividing by ~0 when two cards are aligned (common with snapping), and
  decoding never divides, so nothing jumps to infinity (spec edge case). Card centres, not anchor
  points, avoid a loop: the automatic side of an end is chosen from the bends (R4), so anchors
  cannot also define the bends' frame.
- **Alternatives:** absolute board units shared by views (rejected in clarify: bends left behind in
  views and after group moves); a similarity frame (fraction along S→T plus a perpendicular
  offset), rejected because it rotates bends when one card moves sideways, so elbow runs stop
  being axis-aligned; per-view stored bends (rejected in clarify); offset from the midpoint only
  (moves but never stretches, so it fails "stretch with the two ends").
- **Known limit (edge case in the spec):** when a span on one axis shrinks to 0 after placing,
  fraction bends on that axis line up with the ends on that axis (the line flattens there) and
  spread again when the cards move apart; stored data never changes.

## R2. One point list drives every shape (founder model)

- **Decision:** a pure module `apps/app/src/editor/routing/connector-geometry.ts` turns
  `[sourceAnchor, ...bends, targetAnchor]` into a path for each shape:
  - **straight:** `M`/`L` through the two ends only; stored bends are kept but not drawn and their
    handles hidden (frame 129 "Shapes").
  - **elbow:** between consecutive points, insert axis-aligned legs. The first leg leaves the
    source side along its normal, the last enters the target side along its normal; between two
    bends the leg goes horizontal first when the previous leg was vertical and vice versa. Corners
    rounded with radius `min(10, half the shorter neighbouring leg)` (frame 129 "10 px rounded
    corners").
  - **curved:** centripetal Catmull-Rom through all points (α = 0.5, no cusps or loops), converted
    to cubic Bézier segments; the end tangents follow the side normals so the line leaves and
    enters a card straight, as 029's curve does. Hand-written (~40 lines).
  - With **no bends**, each shape calls today's `routedPath` (029 / 017) unchanged, so every
    existing connector is byte-identical.
- **Why:** one model, no second route system beside 017's (backlog risk "one route model, not
  two"). Keeping the no-bend path on `routedPath` makes "absent = today's look" trivially true and
  tested.
- **Alternatives:** `d3-shape` `curveCatmullRom` (new dependency for ~40 lines; rejected,
  constitution VIII); uniform Catmull-Rom (overshoots and loops at close points); orthogonal
  routing through bends with obstacle avoidance (011, out of scope).

## R3. 017's `route.offset` becomes implicit bends (clarify, founder proposal)

- **Decision:** an elbow connector with `route.offset` and no bends draws exactly as today (no-bend
  path, R2). Its **implicit bends** are the two corners of the offset middle segment
  (`segment.from`/`to` at `segment.at`), shown as bend handles. The first bend edit (move, add,
  remove) writes those two points as explicit bends (R1 encoding) and deletes `offset` in the same
  transaction, writing `style.shape: 'elbow'` when no shape is stored (the existing 029
  "reset-route pinning" in `setEdgeRoute`), so the line neither jumps nor turns curved. Reset
  route clears `offset`, bends and anchors together. A stored file never holds both `offset` and
  `waypoints` (semantic rule S10, R5).
- **Why:** 017 decks keep their look and stay valid without a migration; the user only ever sees
  one handle model (bends). The 017 segment pill and its one-axis drag go away (founder feedback).
- **Alternatives:** keep `offset` and bends together (two models; rejected); migrate every offset
  on open (rewrites files the user did not touch; violates FR-021 "no data added").

## R4. Anchors: side + position along it; automatic side with bends

- **Decision:** `route.fromAt` / `route.toAt` (0–1 along the side, top/bottom left → right,
  left/right top → bottom; absent = 0.5). A position is only meaningful with a pinned side, so
  `fromAt` requires `fromSide` (S9). The anchor point is
  `sideMidpoint + (at − 0.5) · sideLength · tangent`, computed in `DeckEdge` from React Flow's live
  `sourceX/Y` (the side midpoint, already live during drags) and the card size passed in edge data,
  so anchors follow drags and resizes without reading internal nodes. Drag rules (frame 118 c):
  pointer projected to the nearest side, snap within 4 % to 0 / 25 / 50 / 75 / 100 %, readout
  "left side · 78 %", 40 % ghost of the old route, Esc cancels, drop on the card body (more than
  12 px inside every side) clears side and position. **With bends and no pinned side**, the
  automatic side faces the first (or last) bend rather than the other card, so a detour leaves the
  card on the side it heads to.
- **Why:** additive to 017's `fromSide`/`toSide` (meaning unchanged). DB8 (column ports) can later
  add a port key beside these without changing them. Using React Flow's handle midpoint plus the
  size keeps the per-frame cost to a few multiplications.
- **Alternatives:** an `{ side, at }` object per end (cleaner, but changes 017's two flat keys and
  every 017 test; rejected); absolute anchor coordinates (break on resize).

## R5. File format (ADR 0022 row, ADR 0019 extension)

- **Decision (all optional, no version bump, §g-81):**
  - `EdgeStyle` gains `dash` (`solid` | `dashed` | `dotted`), `width` (enum 1, 1.5, 2, 3, 4),
    `color` (`ColorRef`), `animated` (boolean). Absent = solid, 2 px, default grey, still.
  - `EdgeRoute` gains `fromAt`, `toAt` (number 0–1) and `waypoints` (array, min 1, of
    `RouteWaypoint`: exactly one of `x` / `dx` and exactly one of `y` / `dy`, all numbers).
  - `Edge` gains `labelAt` (number 0–1; absent = 0.5).
  - Semantic rules: **S9** `fromAt` needs `fromSide`, `toAt` needs `toSide` (Zod drops
    `dependentRequired`, as S4); **S10** `route` never holds both `offset` and `waypoints`;
    **S11** each waypoint has exactly one key per axis (Zod drops `oneOf` on required sets).
  - Values equal to the default are not stored (`dash: 'solid'`, `width: 2`, `animated: false`,
    `labelAt: 0.5`, `fromAt: 0.5` with an automatic side): the ops remove the key instead, so a
    reset returns the exact pre-022 JSON (FR-021, SC-004).
- **Why:** smallest additive change; names match the backlog draft except `waypoints` items, which
  are relative (R1) and so cannot be `Position`. One ADR (0024) records the route model; ADR 0022's
  table gets the new rows.
- **Alternatives:** `width` as a free number (frame 133 fixes five steps; a free number invites
  values the slider cannot show); storing defaults explicitly (breaks "absent = today's look").

## R6. Yjs layout (ADR 0021)

- **Decision:** `style` stays a nested `Y.Map` written key by key (`ops/edge-style.ts`), so two tabs
  setting dash and colour both survive. `route` is already a nested `Y.Map` (`writeRoute`); the new
  scalar keys are written key by key; `waypoints` is one JSON value replaced whole on each bend
  edit (a bend list is one intention; merging two tabs' half-edited lists would make a route
  nobody drew). `labelAt` is a scalar on the edge map. No layout version change.
- **Why:** matches 029 / 036 patterns; last write wins per key (spec edge case "two tabs").
- **Alternatives:** `Y.Array` of waypoints (concurrent inserts interleave into a nonsense route).

## R7. Model ops (one transaction = one undo step)

- **Decision:** generalise `setEdgeShape` into `setEdgeStyle(edgeIds, patch)` where `patch` has any
  of `shape | dash | width | color | animated`, `null` meaning "back to default" (removes the key,
  and `style` when empty). `setEdgeShape` stays as a thin wrapper (its "curved with offset" rule
  moves into the general op). Route: `setEdgeRoute(edgeId, patch)` gains `fromAt`, `toAt`,
  `waypoints` in `EdgeRoutePatch`; it applies R3's conversion when `waypoints` is set on a route
  with `offset`. New `setEdgeLabelAt(edgeId, at | null)`. All validate first, then write in one
  `ctx.transact`.
- **Why:** one op per stored object keeps undo granularity right: a multi-selection pick is one
  call; a bend drag ends in one call (auto-simplify included, R9).
- **Alternatives:** one op per key (more surface, same behaviour).

## R8. Toolbar, menu, drawer (ADR 0015 action registry)

- **Decision:** a new action `connection.lineStyle` with `field: 'lineStyle'` replaces the
  toolbar placement of `connection.lineType` (toolbar `connection` and `connections`); it opens a
  `LineStylePopover` (288 wide, frame 128) in the toolbar's `FieldPopover` host. The menu keeps
  "Line type ▸" and gains "Dash ▸", "Weight ▸" (radio children) and "Animate direction" (checked);
  colour in the menu opens the popover (as `style.colour` does for cards). Multi-selection shows
  "Mixed" per section via a `lineStyleView(edges)` derivation (pattern of `styleView`), with
  dashed rings on in-use values. The drawer (`edge-inspector.tsx`) gets a "Line" section with the
  same controls, plus "Label position" (percentage) and "Bends: n · Reset route"; the bulk drawer
  gets the style rows. "Reset route" applies to every shape once bends exist (today: elbow only).
- **Why:** one popover component for toolbar and drawer (constitution VIII); actions keep menu,
  toolbar and keys in agreement.

## R9. Handles, bend editing, snapping, auto-simplify

- **Decision:** `routing/route-handles.tsx` replaces `segment-handle.tsx` and the 017 end grips:
  round handles in `EdgeLabelRenderer`, end 10 px (14 on hover), midpoint and bend 8 px (12 on
  hover), each in a 24 px invisible hit circle; shown when the connector is hovered or it is the
  single selected connector (not in flow mode or recording, as today). Pointer gestures go through
  a pure session (`editing/bend-drag.ts`, pattern of `segment-drag.ts`): add (midpoint index i →
  insert at i), move, end. Snapping at release and live: first to the horizontal/vertical line of
  a neighbouring point within 6 px (screen), then to the 22 px dot grid (clarify Q3), the existing
  no-snap modifier (⌘, `feedback-section` "No snap") disables both; guides plus an "x · y" board
  readout. **Auto-simplify** on release: a bend whose distance to the segment between its
  neighbours is under 4 px (screen), or that coincides with a neighbour, is dropped; done inside
  the same `setEdgeRoute` call. Remove: double-click or ⌫/Delete on a focused bend handle (the
  handle stops propagation, so the connector is not deleted). Keyboard: handles are focusable
  buttons in DOM order (ends, midpoints, bends) when the connector is selected; arrows move a bend
  22 px (Shift 1 px), ⏎ on a midpoint adds a bend at its point, Esc returns focus to the connector.
- **Why:** frame 129 and the founder's "lighter handles"; a pure session is unit-testable, the
  component stays thin. React Flow's `interactionWidth` stays 12 at every weight (frame 133 "Hit
  areas").
- **Alternatives:** React Flow's built-in edge reconnect handles only (no midpoints or bends).

## R10. Label position

- **Decision:** `labelAt` resolves with `SVGPathElement.getPointAtLength(at · totalLength)` on a
  detached path element in the canvas (one per call, cached by path string), clamped so the pill
  keeps 8 px plus half its width from either end. Dragging projects the pointer onto the path by
  sampling (64 samples, then a local refine of 8) and converts to a fraction; snaps within 4 % of
  25 / 50 / 75; no-snap modifier; readout "label 20 %". Export computes the same point with the
  same pure sampler over the path (no DOM), so the canvas and export agree; the canvas may use the
  DOM API only as a fast path with a unit test proving both agree within 0.5 px. Keyboard per FR-017.
- **Why:** the founder's suggestion; sampling keeps it pure and testable in Vitest (jsdom has no
  `getPointAtLength`).
- **Alternatives:** `bezier-js` projection (new dependency; not needed for 64-sample accuracy).

## R11. Animated direction

- **Decision:** CSS animation on `stroke-dashoffset` (class `sd-edge-run`, period `8w` px for a
  solid line with dash `3w 5w`, 24 px/s, `linear infinite`; `animation-direction: reverse` for the
  second train of a two-way connector, drawn as a second path). Solid lines also draw a 32 %
  opacity track. Dashed / dotted lines run their own pattern without a track. Off when:
  `useReducedMotion()` is true, a flow is shown or recorded (`isFlowMode` / `flowSession`), or the
  edge is in an export (export never adds the class). Hidden tabs: browsers stop CSS animations in
  background tabs. Off-screen: the canvas passes `onlyRenderVisibleElements` for large decks, which
  removes off-screen edges; if SC-007 misses, pause animations of edges outside the viewport with
  `animation-play-state` from a viewport-derived set (measured in the bench, not built up front).
- **Why:** no JS per frame; React does not re-render while lines run. Constitution V and SC-007.
- **Alternatives:** a `requestAnimationFrame` loop updating every animated path (main-thread cost
  per frame, rejected); SMIL `<animate>` (no reduced-motion hook, harder to pause).

## R12. Colour, contrast and precedence

- **Decision:** a connector's colour draws with the colour's `stroke` token
  (`--sd-card-<name>-stroke`, light and dark); custom hex is mixed toward black (light) or white
  (dark) in 1/24 steps until it reaches 3:1 against the canvas, in a pure `lineColour(ref, theme)`
  (frame 133 "Custom colours"); the stored value never changes. A contrast test covers the 13
  names in both themes (SC-008) and fails if any token is below 3:1. Precedence at draw time,
  highest first: selected (orange), flow / error / candidate / invalid stroke (006 / 007 / 035),
  034 highlight (keeps own colour, takes 2.75 px; uncoloured → Ink; clarify Q4), the connector's
  own colour / dash / width, the defaults. A flow being shown also disables `animated`.
- **Why:** colour never carries state alone (VII); the user's colour survives where it does not
  hide a state cue.
- **Alternatives:** draw named colours with their `dot` token (several fail 3:1 in dark).

## R13. Export

- **Decision:** `export/scene.ts` `SceneEdge` gains `style` (dash pattern, width, resolved light
  colour) and the bend points resolved from the card rects in the export's view; `edgePath` in
  `export/edge-geometry.ts` takes the bends and anchors and calls the same `connector-geometry`
  module; label point from R10's sampler; never animated. Extents include bends.
- **Why:** "what `DeckEdge` draws, the export draws" (ADR 0016).

## R14. 034 interplay and performance

- **Decision:** 034 is specified but not built. Whichever lands second implements FR-024: bundling
  skips edges with `waypoints`, `fromAt` / `toAt` or any `style` key other than `shape`; the
  highlight colour rule reads `style.color`. `deck-to-flow` cache keys add `style`, `route`
  (already) and `labelAt`, and the card size for anchors. Bench (`pnpm bench`) before and after on
  the 500 / 1,000 deck, plus a variant with 200 animated connectors and 200 connectors with 3 bends
  (SC-007); results in `bench-before.md` / `bench-after.md`.
- **Why:** constitution V; the curved-with-bends path and animation are the only new per-frame
  costs.
