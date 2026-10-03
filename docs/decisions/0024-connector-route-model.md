# 0024. A connector's route is intent: sides, anchors and relative bends

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/022-connector-style` (spec, research R1–R14, contracts)
- **Builds on:** 0019 (route sides and offset), 0022 (schema roadmap), 0021 (stored layout)

## Context

017 stores only pinned sides and one middle-segment offset. 022 adds a line style (dash, weight,
colour, animation), free bend points, ends that attach anywhere along a side, and a draggable
label. The founder's rule: store **intent**, never geometry. A saved file must not hold a path,
absolute bend coordinates or label coordinates, because cards move, views place the same card
differently and auto-layout rewrites positions.

## Decision

1. **Additive keys, no version bump.** `EdgeStyle` gains `dash`, `width` (1, 1.5, 2, 3, 4),
   `color` (`ColorRef`) and `animated`. `EdgeRoute` gains `fromAt`, `toAt` (0 to 1 along a side)
   and `waypoints` (new `RouteWaypoint`). `Edge` gains `labelAt` (0 to 1). A value equal to its
   default is never stored (`solid`, 2 px, not animated, 0.5), so a reset returns the exact
   pre-022 JSON.
2. **Bends are relative to the two card centres.** Per axis a bend is a fraction of the
   source → target span (`x`, `y`), or pixels from the midpoint (`dx`, `dy`) when that span was
   under one grid step (22 px) when the bend was placed. Decoding never divides, so a zero span
   cannot produce infinity. Bends follow single-card drags, group moves, other views and
   auto-layout; they are re-encoded only when the user moves them.
3. **One point list for every shape.** `connector-geometry.ts` turns `[start, ...bends, end]` into
   a path: straight draws the two ends only, elbow joins points with axis-aligned legs and 10 px
   corners, curved is a centripetal Catmull-Rom spline written as cubic Béziers, leaving and
   entering along the side normals. With no bends and no anchors the old `routedPath` draws, so
   every existing connector is byte-identical.
4. **017's `offset` becomes two implicit bends.** It still draws as before. The first bend edit
   writes the two corners as explicit bends and removes `offset` in the same transaction, pinning
   `style.shape: 'elbow'` when no shape is stored (029's reset-route pinning), so the line neither
   jumps nor turns curved. The segment pill and its one-axis drag are removed.
5. **Anchors are a side plus a position.** `fromAt` needs `fromSide` (rule S9). Dragging an end
   over its card projects the pointer onto the nearest side, snaps within 4 % to 0 / 25 / 50 / 75 /
   100 %, and a drop deeper than 12 px inside the card sends the end back to automatic. With bends
   and no pinned side, an end faces the first (or last) bend.
6. **Rules S9–S11** (the generated Zod drops what they need): S9 `fromAt` / `toAt` need their
   side; S10 a route never holds both `offset` and `waypoints`; S11 the waypoint list is not
   empty and each waypoint has exactly one key per axis.
7. **Yjs.** `style` and `route` stay nested maps written key by key (two tabs setting different
   keys both survive). `waypoints` is one plain JSON value replaced whole: a bend list is one
   intention, and merging two tabs' half-edited lists would draw a route nobody drew.
8. **Drag previews live in the UI store.** A bend, anchor or label drag writes nothing to the
   document until release; release is one op and one undo step.
9. **Precedence when drawing:** selected > flow, error, candidate and invalid strokes > 034's
   highlight (keeps the connector's own colour, takes its weight) > the connector's own colour,
   dash and weight > defaults. Named colours use their `stroke` token (all 13 reach 3:1 on the
   canvas in both themes, tested); a custom hex is mixed toward the text colour until it does. The
   stored value never changes.
10. **Default weight is 2 px**, the weight the canvas has drawn since 029, so "absent = today's
    look" stays true.

## Alternatives considered

- **Absolute bend coordinates:** simple, but bends are left behind when a card moves or when a
  view places it elsewhere. Rejected in clarification.
- **A similarity frame (fraction along the line plus a perpendicular offset):** rotates bends when
  one card moves sideways, so elbow runs stop being axis-aligned.
- **Keeping `offset` beside `waypoints`:** two route models. Rejected (one route model).
- **`Y.Array` of waypoints:** concurrent inserts interleave into a nonsense route.
- **A new dependency for splines:** about 40 lines of hand-written code replace it.

## Consequences

- `setEdgeStyle` generalises `setEdgeShape`; `setEdgeRoute` takes `fromAt`, `toAt` and
  `waypoints`; `setEdgeLabelAt` is new. Each call is one undo step.
- Connectors with bends, anchors or their own style never join a 034 bundle.
- The export draws bends, anchors, dash, weight, colour and the label position from the same
  geometry as the canvas; it never animates.
- Relationship types and a legend belong to the Database pack, not here.
