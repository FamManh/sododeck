# 0026. Shapes, two forms and the Frame tool

- **Status:** Accepted
- **Date:** 2026-10-03
- **Feature:** `specs/031-shapes` (research R1–R8)
- **Builds on:** 0025 (card type registry), 0022 (schema roadmap, `node.display`), 0017 (group
  frames), 0019 (card size and connector route), 0024 (connector route model)

## Context

Process diagrams need standard shapes (diamond, pill, cylinder, …) drawn with their true
geometry, connectors that meet the outline rather than a bounding box, and a way to show the same
decision, database or document either as a detailed card or as a compact symbol. The founder also
asked for drawing a container first and dropping cards into it, where today a group can only be
made from two or more selected items.

## Decision

1. **Shapes are registry types.** The Basic shapes pack (`shapes`, category Shapes) adds eleven
   `family: 'shape'` types to 030's registry, each with a `geometry`, a default and a minimum size.
   Packs, Add, pickers, views, search and unknown-id handling apply with no new mechanism. The
   document shape's id is `document-shape` (the `document` card type already owns `document`; ids
   never change); its UI name is still "Document". New decks turn the pack on; older decks keep
   their packs.
2. **Two forms: `node.display`.** `card` | `shape`, optional, absent = the type's own family
   (ADR 0022). Decision, database and document carry a `shapeForm` (diamond, cylinder,
   document-shape). `setNodeDisplay(ids, display)` is one undo step and writes the key only when
   it differs from the type's family, so a deck that never switches stays byte-identical. Only
   the form changes: id, fields, tags, colour, connections, group and flow steps are untouched.
   A user size is kept in both forms; without one each form uses its own default size.
3. **One pure geometry module.** `apps/app/src/editor/shapes/shape-geometry.ts` builds every
   outline from M / L / C / Z segments (ellipses and corners as cubic Béziers) and is the only
   source of outline, lip, connection points and title box for the canvas, the export, the
   connectors and the tiles. A side's connection point is a projection onto the outline (a
   vertical line for top / bottom, a horizontal one for left / right, at `at` along the side),
   which is how 022's anchor drag already turns a pointer into `at`; `at` 0.5 is always the side's
   own middle. The actor (an open stick figure) connects at its head, hand tips and between its
   feet; the text shape at its box.
4. **A separate node type.** React Flow node type `shape` (`shapes/shape-node.tsx`) beside the
   card's `deck`, chosen by `effectiveFamily`. Handles are placed on the outline, so React Flow
   hands connectors the outline points with no routing change; anchored and bent connectors pass
   the end's geometry to `connectorPath`. Sizes go through `cardLayoutOf` / `sizeLimitsOf`, so
   groups, snapping, resize and export agree. Card and shape share their handles, resize controls
   and notes (`component-node-parts.tsx`, `use-component-node-state.ts`).
5. **Rings follow the geometry.** Selected, problem and the flow start are drawn as the same
   geometry around a grown box (4 px for selected, 7 px for a problem so both rings show
   together), not as a CSS box outline. Tilt and lift are paint-only on `.sd-shape-art`
   (§g-74); the lip uses the card's lip tokens, so it disappears below 60 % zoom like a card's.
6. **Tiles are mini outlines.** A shape type's tile draws its own outline (`TypeGlyph`,
   `NodeTypeTile`); `TYPE_STYLE` holds no shape icons (lucide has no parallelogram). The parity
   test asks card types for a tile style and shape types for a geometry.
7. **Frame = Group.** The Frame tile arms a `frame` canvas tool. A drag (clamped to the minimum
   frame), a click (320 × 200) or ⏎ on the tile (at the view centre) calls the existing
   `groupSelection` with the items of that level fully inside, in one undo step, then opens the
   group's name. The parent is the innermost visible frame around it, else the drilled-in group.
   "Frame" is only the tile's name; everywhere else it is a Group. Moving a frame never captures.
8. **Empty groups are drawn.** A group with no members is part of the visible graph (frame, drop
   target, collapse with count 0, drill-in, export) and nothing removes it. A view still leaves
   out groups whose members it hides, so views look as before.

## Consequences

- The schema gains one optional key; no version bump (§g-81). Shapes may be smaller than cards
  (down to 40 × 24); the size problem uses each shape's own minimum.
- The Sticky tile reuses today's sticky note; the Text shape takes no colour.
- DESIGN.md's States table now gives the problem ring on a shape at offset 7 (it said 5) so it
  never overlaps the selection ring at 4.
- Not done here: a drop look on the parent frame while a frame is drawn.
