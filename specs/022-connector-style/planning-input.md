# 022 Connector Style: planning input

Founder notes given during `/speckit.specify` (2026-10-03). The model and interaction rules are in
[`spec.md`](spec.md). The implementation boundaries below are for `/speckit.plan` and the ADR, not
the spec body.

## Model

- Store only user intent, never path geometry. The SVG path is derived at render time from the
  source anchor, the waypoints, the target anchor and the style.
- One point list drives every shape: `[sourceAnchor, ...waypoints, targetAnchor]`.
  - straight → polyline through the points
  - elbow → orthogonal legs inserted between consecutive points, rounded corners
  - curved → smooth curve through the points (Catmull-Rom converted to cubic Bézier)
- Waypoints are stored relative to the two ends (clarify Q1, founder: option B), not in absolute
  board units, so they follow cards across drags, group moves, per-view positions and
  auto-layout. The ADR picks the exact frame (e.g. a fraction along the end-to-end axis plus a
  perpendicular offset, or per-axis fractions of the end-to-end box) and handles ends that line up.
- Anchor = side + fraction `at` (0–1) along that side; absent `at` = today's automatic middle.
- Label position = fraction of path length (`labelAt`, 0–1, default 0.5), resolved with
  `SVGPathElement.getPointAtLength`; dragging the label projects the pointer onto the path.
- Migration: 017's `route.offset` keeps its meaning. Proposal for the ADR: an offset equals two
  implicit waypoints; the first waypoint edit converts it to explicit waypoints; Reset route clears
  both. 017 decks stay valid, round-trip lossless.

## Implementation boundaries

- Keep React Flow custom edges (`BaseEdge`, `EdgeLabelRenderer`); build on 017's
  `apps/app/src/editor/routing/route-path.ts` (`resolveSides`, `middleSegment`), not beside it.
- One pure, unit-tested geometry module, e.g. `apps/app/src/editor/routing/connector-geometry.ts`:
  `anchorPoint(box, side, at)`, `pointsToPath(points, shape)`, `projectOnPath(path, point)`,
  `labelPoint(path, at)`, `simplifyWaypoints(points)`.
- The line keeps a wide invisible hit stroke (React Flow `interactionWidth`).
- Prefer the platform (SVG path APIs) and a hand-written Catmull-Rom (~30 lines). Candidate
  dependencies only if needed, and ask before adding: `bezier-js` (projection / intersections,
  useful for later line jumps), `d3-shape` curves. No obstacle-avoiding router (011).
- Connectors with waypoints, a non-automatic anchor or their own style never join a 034 bundle.
- 034 sets highlight colour and weight separately; 022 changes only the colour rule (spec FR-024).
- Do not name other diagram tools in the spec, plan or ADR.
