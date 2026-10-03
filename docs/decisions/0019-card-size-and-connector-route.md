# 0019. Card size and connector routing are optional, clamped-at-read fields

- **Status:** Accepted
- **Date:** 2026-09-30
- **Feature:** `specs/017-resize-edge-routing` (spec, research R1–R16, contracts)
- **Builds on:** 0004 (schema v1 shape), 0006 (derived canvas), 0017 (`$defs/Size`, group frames)

## Context

Every card so far had the same size for its semantic zoom level (`NODE_SIZE` /
`COMPONENT_CARD_SIZE`), and every connector was a plain `getSmoothStepPath` between two boxes.
017 lets a user make an important card bigger and move a connector's middle segment or pin which
side it leaves/enters from, so a busy diagram can be made to look tidy (spec C-6). The founder
approved a schema change (§g-37) and decided the offsets (not free waypoints) are the right
level, with a decision still open on whether the connector's middle drag stays free or stops
12 px from a card edge (resolved below) and whether a dropped endpoint can be left "free"
(resolved: no — §g-44, 017 always keeps `from` / `to`).

## Decision

1. **`node.size` and `edge.route` are optional and additive (R1).** Schema v1 gains `$defs/Side`
   (`'top' | 'right' | 'bottom' | 'left'`), reuses 0017's `$defs/Size` for `Node.size` (after
   `group`), and adds `Edge.route: { fromSide?, toSide?, offset? }` (after `links`). No `minimum`
   / `maximum` in the schema and no new semantic rule: an out-of-range size still opens, it is
   reported as a 015 problem (`card-size-out-of-range`), not refused. The version stays 1 (0002).
2. **The app clamps; the model does not (R2, R11).** `setCardSize` / `setEdgeRoute`
   (`packages/model/src/ops/shape.ts`) write and merge exactly what they are given (`null` clears
   a key, `offset: 0` is dropped, an empty route is removed). `canvas-geometry.ts`'s `cardSize(node,
level)` is the **only** place that turns a node into a drawn box: the stored size clamped to
   `CARD_SIZE_LIMITS` (120×44 to 800×600), else the level's default. A stored size wins at every
   zoom level, not only `'component'` (the plan's first draft was level-only; corrected during
   planning).
3. **A route is a resolved side pair plus one offset, never waypoints (R6, R16).** `resolveSides`
   (`editor/routing/route-path.ts`) picks each end's side: the pinned `fromSide` / `toSide` if
   set, else the automatic side `getSmoothStepPath` would have chosen. `middleSegment` reports a
   movable middle segment only when the resolved sides are an **opposite pair** (both horizontal
   or both vertical); an L-shaped route (adjacent or same sides) has no offset to drag or store,
   and the inspector's Offset field is disabled with a hint rather than silently ignoring input.
   The offset is relative to the automatic middle position, so it survives both ends moving
   together, and is drawn in px on whichever axis the segment runs.
   **Alternative rejected:** free multi-point waypoints (022's job if offsets are ever not
   enough) — far more state, and harder to keep undo/redo and flow highlights simple.
4. **The middle segment moves freely (clarified 2026-09-29).** The backlog's draft had it "stop
   12 px from any card edge"; the clarified plan drops that stop, matching quickstart scenario 3.
   112–114's screens still show the stop; the visual check (T055) records this as an expected,
   allowed difference.
5. **No free connector ends (§g-44).** Dragging an endpoint always reconnects to a card side (the
   same card re-pins a side; another card reconnects as today, clearing the pinned side that no
   longer applies). The design's "⌥ leaves a free end" is dropped; `EdgeRoute` has no field for an
   unconnected end and never will without a further schema change.
6. **Automatic paths stay pixel-identical (R7).** `routedStepPath` with no stored route calls
   `getSmoothStepPath` exactly as before; a route only changes the path once at least one of
   `fromSide` / `toSide` / `offset` is set. This is a contract test, not just a convention.
7. **One undo step per gesture, per key burst, per drawer commit (R9, R10, R12).** Pointer drags
   (`card-resize.ts`, `routing/segment-handle.tsx`, `routing/endpoint-connection-line.tsx`) use
   `beginGesture` / `endGesture` / `cancelGesture` (0017); a keyboard burst (`use-resize-key.ts`,
   `use-segment-key.ts`, both ⌘⇧+arrow, replacing the backlog's ⌥⌘+arrow after founder
   confirmation) reuses 016's `createBurst`; the inspector's Size and Route fields
   (`inspector/size-fields.tsx`, `inspector/route-fields.tsx`) use the shared live-field /
   one-step helpers (008/019). `R` resets a route to automatic (`actions/shape-actions.ts`).
8. **Forward compatibility.** Older app builds that do not know `node.size` / `edge.route` parse
   and re-save a file unchanged (the Zod schema is additive, so no build rejects the fields, and
   this app never writes them without the fields already present in the format it loaded). A
   build with 017 opens an old deck exactly as before (no `size` / `route` keys means today's
   behaviour), and a deck written with these fields round-trips losslessly on every build that
   knows the fields, and is left unmodified where a build that predates 017 does not touch them.
9. **022 (connector styling) is the next extension point.** It adds line type, waypoints, dash,
   weight, colour and label position on top of `route-path.ts`'s resolved sides and segment, and
   on `EdgeRoute` if it needs to grow. It must not touch `fromSide` / `toSide` / `offset`
   semantics.

## Alternatives considered

- **Free waypoints instead of one offset:** far more schema and undo/redo surface for a benefit
  022 may never need; revisit only if offsets prove insufficient in practice.
- **A version bump for the new fields:** unnecessary churn; additive optional fields keep v1
  valid for every existing file (0002).
- **Clamping and defaults inside the model:** `packages/model` must stay free of UI concerns
  (level, px, zoom); the schema/model boundary (0004) keeps that job in the app.
- **A free ("dangling") connector end:** rejected at design review (§g-44); `from` / `to` stay
  required on every edge, keeping every consumer of `Edge` (flows, problems, export) unchanged.
- **Stopping the middle-segment drag 12 px from a card edge:** the original design's rule; dropped
  in the 2026-09-29 clarification in favour of a free drag, since a fixed stop had no clear use and
  added a special case to every consumer of `offset`.

## Consequences

- `checkDeck` (015) gains a tenth problem kind, `card-size-out-of-range`, for a stored size a
  foreign tool or a hand-edit put outside 120×44–800×600; the file still opens and draws the
  clamped size.
- `fitGroupFrames` (0017) takes an optional `sizeOf` so a group's frame fits members at their real,
  resized boxes instead of always the level default.
- Every place that used to assume `NODE_SIZE` / `COMPONENT_CARD_SIZE` (minimap, search-fit,
  layout worker, thumbnails, export 012, group frame fitting) now goes through `cardSize` /
  `cardBox`; a card resize is visible everywhere without those call sites changing again.
- Screens 112–114 and 100 stay the design reference for handles, readouts and the reset button;
  the 12 px stop and the free-end modifier are recorded as intentional, allowed differences
  (T055).

## Update (022)

`offset` is read as two implicit bends once a connector gets free bends, anchors or a style; the
route model that replaced the one-axis segment drag is ADR 0024.
