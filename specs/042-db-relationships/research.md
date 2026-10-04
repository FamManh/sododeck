# Research: Table Relationships (042)

Phase 0 of [plan.md](plan.md). Clarify answers (2026-10-04) are given: 042 owns the relationship
display settings, Keys keeps connected rows, n–1 default with optional sides from nullability,
reconnect by drag (single-column ends), single-column primary key as drop fallback. Code facts come
from a survey of `apps/app/src/editor` (edges, routing, bundles, hover focus, export, reconnect) on
`main` and of `FamManh/feat-db-table-card` (041 in progress) on 2026-10-04.

## R1. No React Flow handle per row; anchors are computed

- **Decision:** relationship ends are not React Flow handles. `deck-to-flow.ts` `toFlowEdges`
  gives a relationship edge `data.rel: RelationshipEnds` with, per end, the row offsets relative to
  the card's top-left (from 041's `TableLayout`: `rowCenterY(layout, columnId)`, or the "+n" pill
  / title fallback) and the composite member offsets. `DeckEdge` resolves the absolute points from
  the live card boxes it already reads (`boxAt`), picks left / right (R3) and builds the path. The
  React Flow `sourceHandle` / `targetHandle` stay the card's `left` / `right` side handles (the
  ones nearest the chosen sides) so React Flow's own bookkeeping is unchanged, but their positions
  are not used for drawing.
- **Rationale:** 150 tables × 12 rows × 2 sides would be 3,600 handles (React Flow measures every
  handle; `updateNodeInternals` on every detail change). Row positions are already known from the
  pure layout (§g-58: computed, never measured), so canvas and export agree by construction.
- **Alternatives:** one handle per row and side (DOM and measuring cost, breaks on detail change);
  handles only on the hovered row (needs `updateNodeInternals` on hover; flaky with reconnect).

## R2. Row anchor positions

- **Decision:** a pure helper in 041's `table-layout.ts`:
  `rowAnchorY(layout, columnId): { y: number; kind: 'row' | 'pill' | 'title' }`. Row y =
  `layout.rowsTop + 24 i + 12` (DESIGN.md `colH`); a column not drawn falls back to the "+n
  columns" pill centre when `hidden.kind === 'more'`, else the title's vertical centre; a column id
  that does not exist uses the title (edge case "stale id"). Below 90 % zoom (System, Landscape)
  ends use the card outline instead (R6). 041's `TableLayout` gains `rowsTop`, `pillTop` and
  `titleCenter` (pure numbers it already computes for its height).
- **Rationale:** FR-003, US5; one function for canvas, export and the drag hit test.

## R3. Side choice

- **Decision:** pure `relationshipSides(fromBox, toBox)`: when the boxes do not overlap
  horizontally, each end takes the side facing the other box; when they overlap, both ends take
  the side that gives the shorter connector (sum of the two horizontal distances to that side's
  x), right on a tie. A self-reference uses right / right. Recomputed per render from live boxes,
  so it follows a dragged table (US1 scenario 2).
- **Rationale:** FR-002 and frame 159 F. Top / bottom sides are never used for column ends.
- **Alternatives:** stored sides in `route` (would go stale on move; 040 keeps `route` for
  ordinary connectors).

## R4. Path with straight stubs

- **Decision:** `relationshipPath(ends, shape)` in `routing/relationship-path.ts`:
  - Curved and elbow: each end gets a straight stub along the side normal (length 24, enough for
    the farthest mark: ring centre at 20 + radius 4), then `connectorPath` runs between the two
    stub tips with the same sides, so curves and elbows leave the stub tangent.
  - Straight: a straight line between the two anchor points; marks use the line angle (DESIGN.md
    construction: "u is the side normal for curved and elbow lines, the line angle for straight
    lines"; frame 159 F caption).
  - Composite end (R5) starts from the bracket midpoint.
  - User bends (`route.points`) are honoured between the stubs for curved / elbow (017 / 022).
- **Rationale:** DESIGN.md "Crow's foot and ports". The spec's FR-008 said "perpendicular stub on
  all line types"; planning corrects it to the design rule for straight lines (see spec FR-008).
- **Alternatives:** marks always on the side normal (a straight diagonal line would kink at the
  mark).

## R5. Composite ends

- **Decision:** for an end with ≥ 2 visible member rows: a 6 px stub from the side at each member
  row, one vertical segment joining the stub tips, and the connector stub starting from that
  segment's midpoint. Members hidden by detail are skipped; when ≤ 1 member is visible the end is
  drawn as a single-row end at that row (or the fallback). The label adds "(a, b)" (R10).
- **Rationale:** FR-010, frame 159 C; mismatched lengths (040 `db-composite-mismatch`) draw what
  exists.

## R6. Below 90 % zoom, collapsed groups and bundles

- **Decision:** at System and Landscape (zoom below 90 %, `level` landscape or system), a
  relationship edge is drawn as an ordinary table-to-table connector (card outline, automatic
  sides, no stubs) and keeps its crow's foot marks on the outline end. `bundles.ts` `foldable()`
  gains a `level` argument: a relationship edge with column ends folds only below 90 %; at 90 % and
  above it never folds. Edges into collapsed groups keep going through today's merged connectors.
- **Rationale:** FR-004, US5, frame 159 D note ("bundling with ×n happens only where rows are not
  drawn"). The level is already in edge data (`level`), and `bundleEdges` runs per render of the
  visible graph.
- **Alternatives:** never bundle relationships (dense boards at System become unreadable).

## R7. End marks

- **Decision:** extend `edge-end-marks.ts`: `EndMark` gains `{ kind: 'crow', end: 'one' |
'zero-one' | 'one-many' | 'zero-many', at, u }` and `{ kind: 'card-text', text: '1' | '0..1' |
'1..n' | '0..n', at, u }`. Pure `crowPath(at, u)` returns one SVG path string (toes p + 6v →
  p + 12u → p − 6v, bar of 16 across at 10 / 8 / 16 from the edge) plus an optional ring (centre
  at 17 for zero-or-one, 20 for zero-or-many, r 4, filled with the canvas colour). `edge-ends.tsx`
  and `export/render-svg.ts` draw them in the line colour with round joins. Mapping
  `endOf(cardinality, side, optional)`: the `from` side uses the first letter of the cardinality,
  the `to` side the second; `1` → one / zero-one, `n` → one-many / zero-many by the optional flag.
  Relationship edges draw no knob and no arrow (FR-008).
- **Rationale:** export already reuses `endMarks`; one place for the geometry (SC-001, SC-007).

## R8. Self-reference loop

- **Decision:** `selfLoopPath(fromY, toY, side, x)`: leaves the referencing row's stub, bulges
  out by `max(56, |toY − fromY| / 2)` and returns to the referenced row's stub on the same side,
  as a cubic curve for curved, a three-segment elbow for elbow and straight. Marks sit on the
  stubs.
- **Rationale:** FR-011, frame 159 B.

## R9. Creating by drag (pointer) and by keyboard

- **Decision:**
  - **Ports:** each drawn row in 041's `TableBody` gets two port dots (left, right) as plain
    elements, shown by CSS on row hover, while connecting, and for the rows of the selected
    relationship; 8 px visual, 24 px hit area, class `nodrag nopan`.
  - **Drag:** `editing/column-connect-drag.ts` (pointer events, the same pattern as
    `anchor-drag.ts`): pointer down on a port starts; a ghost line from the port to the pointer is
    drawn in a `ViewportPortal`; the target is computed in flow coordinates by the pure
    `columnTargetAt(point, tables)` (row under the point via `rowAnchorY` geometry; else the
    single-column PK of the table under the point; else none); the target row gets
    `data-connect-target`; the type check (R11) shows the warning chip. Release commits; Esc or no
    target cancels without writing. Drag threshold 4 px (as 050).
  - **Commit:** `canvas-actions.ts` `connectColumns(source, target)` writes in one `oneStep`
    `editor.add('edges', { from, to, fromColumns: [c], toColumns: [t], cardinality: 'n-1',
fromOptional: true, toOptional: !sourceNotNull, style?: { shape: lastLineShape } })`, then
    selects and announces like `connectComponents`. Duplicate pair in the same direction selects
    the existing edge (FR-019).
  - **Keyboard (constitution VII):** rows of a focused table are reachable with ↓ / ↑ (roving
    focus inside the card; Esc returns to the card). `C` on a focused row opens the existing
    `ConnectPopover` in a "column" mode listing `table.column` targets (primary keys first, then
    the rest, filtered by typing) and calls `connectColumns`.
- **Rationale:** React Flow's connection drag is handle-based (R1). Pointer code already exists for
  anchors and bends; the connect popover already is the keyboard path for cards.
- **Alternatives:** React Flow `onConnect` with dynamic handles (R1 rejected); keyboard creation
  only in 043's drawer (would leave FR-016 pointer-only in 042, violating VII).

## R10. Labels

- **Decision:** pure `relationshipLabel(edge)`: joins, with " · ", the connector label, "ON DELETE
  <ACTION>" when `onDelete` is set and is not `no-action`, "(a, b)" column names for composite
  ends (names read from the from-table), and "n–n" for many-to-many. Visibility in `toFlowEdges`:
  mode = `relationshipDisplay.labels ?? 'follow'`; `follow` → today's rule (`labelsOn` or in focus);
  `hover` → in focus / hovered / selected only; `always` → always; `off` → never. Hover uses
  today's CSS path (`data-edge-label-for`) so no re-render on hover.
- **Rationale:** FR-013, FR-014; the label pill and its renderer are reused unchanged.

## R11. Type mismatch check

- **Decision:** pure `typeMismatch(a: DbColumn, b: DbColumn): string | undefined` →
  "int → uuid" when `type` (case-insensitive) or `size` differ, or when the enum refs differ;
  undefined when equal. Shown as a chip next to the target row during the drag only; nothing is
  stored (047 lints).
- **Rationale:** FR-018; dialect-aware equivalence is 047's.

## R12. Connection rules

- **Decision:** `connection-rules.ts` `connectionCheck` keeps refusing self and second edges for
  card-to-card connections, and gains a column variant `columnConnectionCheck(deck, from, to)`:
  allows self-reference and several edges between the same tables; refuses only the same column
  pair in the same direction (returns that edge id so the UI selects it) and a drop on the source
  row itself.
- **Rationale:** FR-012, FR-017, FR-019; 040 explicitly allows both cases.

## R13. Reconnect a column end

- **Decision:** relationship edges with column ends set `reconnectable: false` for React Flow's
  built-in reconnect. When selected, `route-handles.tsx` draws their end handles at the row anchor
  (above cards, as 050 makes all handles); dragging one runs the R9 drag with a fixed other end and
  commits `update('edges', id, { from|to, fromColumns|toColumns })` in one step. Composite ends:
  the handle snaps back on release and the hint "Edit composite column ends in the details
  drawer" is announced and shown in the hint bar (FR-020). Column ends never slide along the side;
  `route.fromSide / fromAt` (and `to…`) are ignored for drawing and left untouched (FR-006).
- **Rationale:** React Flow's reconnect anchors at handle positions (wrong for rows). The drag code
  is shared with creation. 050 (in progress) rewrites end handles; 042 plugs its column drag into
  whichever end-handle component is on `main` when 042 starts and records a follow-up if 050 lands
  later.

## R14. Column hover highlight

- **Decision:** pure `columnFocusSet(deck, tableId, columnId): FocusSet | undefined` (in
  `focus-set.ts`): the edges whose ends include the column, their other tables as members, and
  `rows: Set<"tableId:columnId">` for both ends of each. `use-hover-focus` gets a row source: rows
  carry `data-row="tableId:columnId"`; hovering (after the same 150 ms rest) or focusing a row with
  relationships calls `ui.setHoverFocus({ id, source: 'column', column })`; a row without
  relationships does nothing beyond CSS hover. `hoverFocusCss` adds selectors for the lit rows
  (`[data-row="…"]` → Orange Soft fill, as the frame's highlighted row). Hovering / selecting a
  relationship lights its end rows the same way. Pinned focus or a flow keeps precedence
  (FR-024): the column focus is ignored while `CanvasView.focus` or a flow is active, except the
  row highlight.
- **Rationale:** 034's stylesheet approach changes no React Flow object on hover (SC-005).

## R15. Keys keeps connected rows (amends 041)

- **Decision:** 041's `table-keys.ts` gains `connectedColumns(deck): Map<tableId, Set<columnId>>`
  (every column end on either side, cached by `edges` identity) and `tableLayout` at Keys keeps
  rows that are PK, FK or connected; `hidden.count` excludes them. If 041 lands with the PK / FK
  rule only, 042's first app task changes it and its tests.
- **Rationale:** clarify Q2; DESIGN.md "Keys draws PK, FK and connected rows".

## R16. Relationship display settings in the file

- **Decision:** root `relationshipDisplay` (after 041's `tableDisplay`, the name 041's R4
  reserved): `{ hideEnds?: boolean, labels?: "hover" | "always" | "off", notation?: "numeric" }`,
  `additionalProperties: false`. Absent = ends shown, labels follow the Labels tool, crow's foot.
  Yjs `meta.relationshipDisplay` plain `Y.Map`, per-key writes, removed when empty; model op
  `setRelationshipDisplay(patch)` mirroring `setTableDisplay`. Deck settings Database section
  gains "Show on relationships": a `Switch` "Cardinality ends", a `Select` "Labels" (Follow Labels
  tool, Hover, Always, Off) and a `SegmentedControl` "Notation" (Crow's foot, 1 / n).
- **Rationale:** clarify Q1; same "absent = default, byte-identical old decks" rule as 041.
- **Alternatives:** inside `tableDisplay` (mixes two concerns; 041's R4 already reserved the name).

## R17. Export

- **Decision:** `export/scene.ts` `SceneEdge` gains `rel?: { ends, shape, marks, label }` built
  with the same pure helpers (`rowAnchorY`, `relationshipSides`, `relationshipPath`,
  `selfLoopPath`, `endMarks`), from the scene's card boxes and the tables' `TableLayout` (already
  built by 041 for scene cards). Export draws at Component level, so rows are drawn and nothing
  bundles (unchanged export rule). Labels: exported when the mode is `always`, or `follow` with
  the Labels tool on (today's export rule for labels).
- **Rationale:** ADR 0016 (no DOM, no `toFlowEdges`); FR-027.

## R18. Accessibility

- **Decision:** relationship edges get `aria-label` "Relationship orders.customer_id to
  customers.id, many to one, on delete restrict" (pure `relationshipName(edge, deck)`);
  ports are `button`s named "Connect customer_id" (`tabIndex -1`, reached through row focus);
  the type warning chip is `status` text; reconnect hints are announced through the existing live
  region.
- **Rationale:** FR-028, constitution VII.

## R19. Performance and bench

- **Decision:** extend 041's bench `tables` option with relationships carrying column ends
  (`BENCH_TABLES=150` already adds FK edges; add `BENCH_REL=1` → `rel=1` to give them `fromColumns`
  / `toColumns` / cardinality, ~200 edges). Compare the same deck with and without `rel` before and
  after; save `bench-before.md` / `bench-after.md` here. Budget: within 10 % (SC-006). Hover focus
  is CSS only; `data.rel` offsets are cached with the edge (`toFlowEdges` cache check gains the
  layout identity of both tables).
- **Rationale:** constitution V; backlog risk on DOM counts (ports are 2 small elements per row,
  plain).

## R20. Dependencies and ADR

- **Decision:** no new dependency. ADR 0029 (database pack model) gets an amendment note for
  `relationshipDisplay` (041 amends it for `tableDisplay` the same way).
