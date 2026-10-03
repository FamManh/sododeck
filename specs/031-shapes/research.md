# Research: Shapes (031)

Decisions for [plan.md](plan.md). Names checked on `main` (2026-10-03, after 030 docs / 034). 030 is
specified and planned, not built: names from its plan (`card-types.ts`, `TYPE_STYLE`, palette
flyout, `NEW_DECK_PACKS`) are the ones this plan extends.

## R1. Shape types in the 030 registry

- **Decision:** add pack `shapes` ("Basic shapes", category `shapes`, tab "Shapes") with eleven
  `family: 'shape'` types, each with a `geometry` key:

  | Type id             | Name              | Geometry                                  | Default size | Min size | Lip |
  | ------------------- | ----------------- | ----------------------------------------- | ------------ | -------- | --- |
  | `rectangle`         | Rectangle         | rect                                      | 160 × 72     | 64 × 40  | yes |
  | `rounded-rectangle` | Rounded rectangle | rect, radius 14                           | 160 × 72     | 64 × 40  | yes |
  | `ellipse`           | Ellipse           | ellipse                                   | 152 × 80     | 64 × 40  | yes |
  | `diamond`           | Diamond           | diamond                                   | 176 × 112    | 80 × 56  | yes |
  | `pill`              | Pill              | stadium                                   | 176 × 52     | 80 × 36  | yes |
  | `cylinder`          | Cylinder          | cylinder (top ellipse 18 % of height)     | 152 × 104    | 64 × 56  | yes |
  | `document-shape`    | Document          | rect with a wavy bottom (12 % of height)  | 152 × 96     | 64 × 48  | yes |
  | `parallelogram`     | Parallelogram     | skew 16 % of width                        | 168 × 72     | 72 × 40  | yes |
  | `hexagon`           | Hexagon           | points inset 12 % of width                | 160 × 76     | 72 × 40  | yes |
  | `actor`             | Actor             | stick figure in the top 64 %, title below | 80 × 112     | 48 × 72  | no  |
  | `text`              | Text              | none (box only for hit tests)             | 160 × 40     | 40 × 24  | no  |

  The in-between card types get a `shapeForm`: `decision` → `diamond`, `database` → `cylinder`,
  `document` → `document-shape`. `NEW_DECK_PACKS` gains `shapes` (founder, 030 deferral).

- **Why:** shapes are card types (ADR 0022), so packs, Add, the type picker, views, search and
  unknown-id handling from 030 apply with no new mechanism. `document-shape` avoids colliding with
  030's `document` card type id (ids are global and never change); the UI name is still
  "Document". Sizes and proportions are read off frame 120.
- **Alternatives:** a separate shape registry (two lists to keep in step); `shape-` prefix on every
  id (noisier ids for a single collision).

## R2. Geometry module (pure)

- **Decision:** `apps/app/src/editor/shapes/shape-geometry.ts`, pure and shared by the canvas and
  the export: `shapePath(geometry, box)` (SVG path data for outline and lip), `outlinePoint(geometry,
box, side, at = 0.5)` (where a connector meets the outline; also used by 022's free anchors),
  `titleBox(geometry, box)` (the rectangle the centred title wraps in: cylinder body below the top
  ellipse, document above the wave, actor below the figure, diamond and hexagon inner rectangle),
  `minSize(geometry)`. Outline points for the side midpoints: rect / rounded / ellipse / pill /
  diamond / hexagon / cylinder → the box side midpoint (on the outline for these shapes);
  parallelogram left / right → inset by half the skew at mid-height; document bottom → on the wave;
  actor → the figure's head (top), hands (left / right), feet (bottom); text → the box.
- **Why:** one source for geometry keeps canvas, export and connectors in agreement (SC-002) and is
  unit-testable without the DOM.

## R3. Rendering on the canvas

- **Decision:** a new React Flow node type `shape` (`apps/app/src/editor/shape-node.tsx`) chosen in
  `deck-to-flow.ts` when the effective family is `shape` (type family, or `node.display` for an
  in-between type). It draws one SVG: lip (outline path translated down 3 px, filled with the
  stroke colour), fill + 1.5 px outline, then the title in an HTML box at `titleBox` (Deck title
  font, 13 / 600, centred, 3-line clamp with title-only tooltip, reusing `card-text.ts` measuring).
  Handles are placed at `outlinePoint` per side via inline style, so React Flow hands edges the
  outline points with no routing change. States follow `DESIGN.md` (selected outline offset 4,
  problem offset 5 + badge top-right, current step orange stroke + 9 px Orange Soft halo +
  sticker, dimmed 22 %, drag tilt −3° paint-only, "n inside" pill below). Landscape: geometry only.
  Resize uses 017's handles and `setCardSize` with per-shape `minSize`.
- **Why:** a separate node type keeps `deck-node.tsx` (cards) unchanged and lets React Flow skip
  card layout for shapes. Handles on the outline need no change to `route-path.ts` (it routes from
  handle positions).
- **Alternatives:** branches inside `deck-node.tsx` (one component doing two layouts); computing
  outline points inside routing (would need node geometry in every edge).

## R4. Two forms (`node.display`)

- **Decision:** schema `Node.display`: `card` | `shape`, optional (ADR 0022). Model op
  `setNodeDisplay(nodeIds, display | null)` writes it only when it differs from the type's own
  family (else removes it); one undo step. An action `node.showAs` in
  `apps/app/src/editor/actions/` offers "Show as shape" / "Show as card" (radio, "Mixed") in toolbar,
  menu and drawer, applied only to types with a `shapeForm` (or `family: 'shape'` with a card form:
  none in 031). A size set by the user (017 `node.size`) is kept; otherwise each form uses its
  default size. `display` on a type with one form is ignored when drawing and kept on save.
- **Why:** additive, absent = today; the switch never touches fields, tags, edges or steps (SC-003).

## R5. Frame tool (Frame = Group)

- **Decision:** a canvas tool `frame` in the UI store (beside select / hand / sticky / connector).
  The Shapes-tab "Frame" tile (and ⏎ on it) activates it. Pointer down on the pane starts a
  rectangle preview (dashed, Deck Orange, with a size readout); release calls the existing
  `editor.groupSelection({ nodes, groups, title: 'New group', parent, frame })` with:
  - `frame`: the drawn rectangle, clamped to `MIN_FRAME` (160 × 96); a click without drag uses a
    default 320 × 200 centred on the point; ⏎ uses the view centre;
  - `parent`: the innermost visible group frame that fully contains the rectangle, else the
    drilled-in scope, else none;
  - `nodes` / `groups`: the top-level items of that parent level whose boxes are fully inside the
    rectangle (cards, shapes and frames; stickies are not members of groups today).
    Then the existing group-rename flow opens the label for typing, and the tool returns to select.
    `groupSelection` already accepts empty lists, so no model change; the UI's "≥ 2 items" guard
    stays only on ⌘G.
- **Empty groups:** verify `groupBounds` (stored frame), collapse (count 0), drill-in, export,
  `fitGroupFrames` and cascade keep a framed group with no members; add tests; no code is expected
  to delete it.
- **Why:** founder decision (Frame = Group, explicit membership kept); reuses 016's model and drop
  behaviour completely.
- **Alternatives:** a decorative frame object; capture-on-cover (both rejected in specify).

## R6. Sticky and Text tiles

- **Decision:** the Sticky tile calls `addNoteAt` (stickies) at the view centre or drop point, the
  same as the rail. Text is the `text` shape type: no outline, fill, lip or colour; Deck title
  font, centred; connectors meet its box.

## R7. Export

- **Decision:** `export/scene.ts` emits shapes with their geometry key, box, colours and title box;
  `export/render-svg.ts` draws `shapePath` (lip, fill, outline) and the wrapped title; edges use
  the same outline points (`export/edge-geometry.ts` takes the node's outline points instead of
  side midpoints). No tilt or lift.

## R8. Performance

- **Decision:** `shapePath` and `outlinePoint` are memoised per (geometry, size); the shape node
  has no text measuring beyond the title. Bench option `BENCH_SHAPES=1` turns a third of the 500
  nodes into shapes of mixed geometry (SC-008).
