# Research: Database notes on hover and relationship reshaping (064)

Findings from reading the code on `main` at `0f0ede4a`. Paths are relative to `apps/app/src/` unless they start with `packages/`.

## R1. What a table row shows today, and when a row has "hidden information"

- A canvas row draws only: key glyphs (pk / fk / unique), the column name, the type text or enum chip, and the nullable `?` marker (`editor/table/table-body.tsx:273-317`). Not-null is shown by the _absence_ of `?`. Default, check, increment and the note are never drawn.
- The layout already measures cuts: `nameCut` and `typeCut` on `TableRow` (`editor/table-layout.ts:278-328`), using the cached canvas text measurer. A cut row gets a native `title` from `rowLabel(row)` (`table-body.tsx:219`).

**Decision**: A row has hidden information, and so opens a popover (spec FR-001), when any of these hold: the column has a non-empty note, `nameCut`, `typeCut`, a default value, a check expression, or auto-increment. The layout computes this once as `TableRow.hidden` (with `TableRow.hasNote` for the icon). The spec's "default or constraints are cut" reads as "not visible on the row"; default, check and increment are never visible, so they always count.
**Rationale**: Uses measurements the layout already makes (no DOM measuring on hover). Matches the clarification "only when there is something the row cannot show".
**Alternatives**: Measuring the DOM on hover (`scrollWidth > clientWidth`): rejected; layout already knows, and DOM reads during hover cost layout. Counting not-null and unique as hidden: rejected; they are visible (`?` and glyph).

The native `title` on cut rows is removed: the popover replaces it (two tooltips at once would be noise). `aria-label` stays.

## R2. Popover mechanism

- The enum chip popover (052) is the model: module-level rest/grace timers (`editor/table/enum-hover.ts`), a ui-store slice `enumPopover {nodeId, columnId, source}` (`state/ui-store.ts:44-48, 544, 1420-1430`), one Radix `Popover` mounted once in `canvas.tsx:940`, anchored with a `virtualRef` to the live element (`enum-popover.tsx:41-56`). Radix handles Escape, outside click, collision flipping.
- Row hover is already detected by delegation in `canvas.tsx:717-730` (`[data-row]`), and `editor/hover-focus/use-hover-focus.ts` holds the suspension rules (`rowsSuspendedBy`: flow session, canvas gesture, endpoint preview, column connect, hand tool, open popover/context menu/toolbar field, connecting) and ignores `pointerType === 'touch'`.
- The enum popover checks none of the suspensions and uses mouse events (so it fires during drags and on touch emulation).

**Decision**: One new ui-store slice `dbPopover` (see data-model) and one `DbPopover` component mounted next to `EnumPopover`. A new `editor/table/db-hover.ts` module mirrors `enum-hover.ts` but (a) consults the same suspension predicate as row hover-focus (exported from `use-hover-focus.ts`), (b) skips touch pointers for hover, (c) switches immediately when a popover is already open on the same table (FR-006). Opening `dbPopover` closes `enumPopover` and vice versa (FR-011). Delays: open after 300 ms rest (matches `TooltipProvider` 300 and SC-002 < 500 ms), close after 150 ms grace.
**Rationale**: Reuses the proven pattern and the one place that knows when hover must be suspended. One popover at a time keeps state trivial.
**Alternatives**: A HoverCard primitive in `packages/ui`: none exists and adding one is a new component for one use; rejected. Extending `enumPopover` into a union: rejected, it would mix enum value lists with column details and change 052 tests.

## R3. Keyboard and assistive technology

- Rows are `<li tabIndex={-1}>` with roving focus (`table/row-focus.ts`, keys in `use-canvas-shortcuts.ts:399-425`, Enter/F2 = edit). The polite announcer is `ui.announce(text)` (`editor/announcer.tsx`).

**Decision**: When a row with hidden information gets keyboard focus and keeps it for the rest delay, the column popover opens with `source: 'keyboard'` without taking focus, and the row's content summary (type, constraints, note) is announced once via `announce`. The same for a focused table card with a note. Escape closes the popover first, then leaves rows (existing order). The "open details" button stays reachable by Tab from inside the popover only when opened by click; on focus-open, Enter on the row still means edit (unchanged), and `openTableDrawer` is reachable by the existing shortcuts.
**Rationale**: FR-009 asks for focus-rest parity without stealing keys already bound.
**Alternatives**: A new key (e.g. `I`) to open: not needed for FR-009; can be added later.

## R4. Positioning

**Decision**: Radix `PopoverContent` (`packages/ui/src/components/popover.tsx`) with `side="right" align="start"`, anchored to the row element (`[data-node-id="…"] [data-row]`) or the title element, `collisionPadding` 8 so it flips to the left or shifts at viewport edges (FR-012). Max width 320 px, note area max height 200 px with scroll (FR-010). Panel look from DESIGN.md (`--sd-deck-panel-radius`, surface, border, shadow-hover); type text in the code font and code colour token.
**Alternatives**: `ViewportPortal` in flow coordinates: rejected; the popover must not scale with zoom.

## R5. Note icon

- Row name is a CSS `truncate flex-1` span; `nameMax` in the layout reserves type, keys and `?` room (`table-layout.ts:320`).
- The table name is `titleText` at `deck-node.tsx:326-334` (one line for tables).

**Decision**: lucide `NotebookText` at 12 px (rows) and 14 px (title), as a `<button>` with `aria-label="Show note for <name>"`, classes `nodrag nopan`, `aria-haspopup="dialog"`. Click or tap opens the popover at once (`source: 'click'`), stops propagation so it does not select or drag (FR-009a). `nameMax` subtracts the icon width (12 + 4 gap) when `hasNote`. Hidden when `tableDisplay.hideNotes` is on.
**Rationale**: The icon in the founder's screenshot is a notebook glyph; `StickyNote` is already the sticky-note object icon and would be confusing.

## R6. Removing the table note text

- Height formula and `rowsTop` include `8 + noteLines × 17` (`table-layout.ts:368-401`). Consumers pick up height through `cardBox`/`cardSize`/`rowAnchorY` (arrange, place, import placement, relationship ends, column connect, reveal row, command palette) and need no edit. SVG/PNG export draws note lines (`export/scene.ts:327-328`, `export/render-svg.ts:597-611`).
- `hideNotes` (`packages/model/src/table-display.ts`) is a deck setting stored in the file, set in Deck settings › Database › "Show on tables" › "Notes" (`inspector/database/database-section.tsx:27-32`). Its only effect today is the note text.

**Decision**: Drop `noteLines`/`noteCut` from `TableLayout`, the note term from height and `rowsTop`, the `table-note` block in `deck-node.tsx`, and the note lines in export. Add `TableLayout.hasNote`. Keep the `hideNotes` field (no schema change); it now hides the note icons on the canvas and in export. The settings switch label becomes "Note icons". The bench decks have no table notes, so bench numbers are unaffected by the height change.
**Alternatives**: Remove `hideNotes` from the schema: rejected; a breaking format change for no gain.

## R7. Relationship shape and bends

- A relationship is an ordinary `Edge` with column ends (`packages/schema/schema/v1.json:929-999`); `EdgeStyle.shape` and `EdgeRoute.waypoints` already apply. **No schema change.**
- `edgeShape` (`packages/model/src/edge-shape.ts:19-26`) defaults a relationship to `elbow` (#130).
- **Bug**: `setEdgeStyle` (`packages/model/src/ops/edge-style.ts:79-87`) deletes `shape: 'curved'` unless the edge has an offset, so picking Curved on a relationship is a no-op (absent reads as elbow). Fix: remove the key only when the value equals the edge's _default_ shape (`edgeShape` of the edge without `style.shape`).
- The relationship drawer has its own "Line type" control showing `edge.style?.shape ?? ''` (`inspector/relationship/relationship-inspector.tsx:143-157`), so the elbow default is not shown as selected. It has no Reset route field (`RouteFields` is only in `EdgeInspector`).
- `relationshipGeometry` already draws curved/elbow/straight and accepts `bends` (preview or decoded waypoints) (`deck-edge.tsx:218-235`, `routing/relationship-path.ts:98`); straight and self-loop ignore bends. Export already decodes waypoints for relationships (`export/edge-geometry.ts:140-175`).
- Handles: `deck-edge.tsx:677` renders `RouteHandles` only when `rel === undefined`. Bend drag (`editing/bend-drag.ts`) only needs a `BendContext` (edge id, both centres, start/end points, bends) and commits `setEdgeRoute(id, {waypoints})`; bends are stored relative to the two card centres, so they follow table moves like card connectors (FR-017).
- Segment drag (`editing/segment-drag.ts:95, 249-257`) computes vertices from side normals of free anchors and writes `fromSide`/`toSide`; relationship ends have fixed 24 px stubs (`REL_STUB`) on left/right sides chosen by `relationshipSides`.

**Decision**:

1. Fix `setEdgeStyle` (model) with a round-trip/ops test.
2. In row mode, `deck-edge.tsx` renders `RouteHandles` for a relationship with `anchors`/`ends` omitted (ends stay `RelationshipEndHandles`), `bendable = shape !== 'straight' && !selfLoop`, and a `BendContext` whose `start`/`end` are the stub tips (`q1`/`q2`) and centres are the table centres.
3. Segment drag for relationships uses a new stub-aware vertex function (`relationshipSegmentVertices` in `editing/segment-drag.ts`) that treats the stub tips as fixed ends and writes only `waypoints`.
4. Below the row zoom (outline mode) no reshape handles are shown; stored bends are still drawn by `connectorPath`.
5. Relationship drawer: line type shows `edgeShape(edge)`, and gains the existing `RouteFields` reset (or a "Reset route" button calling `setEdgeRoute(id, null)`).
6. Switching to straight keeps stored waypoints (same as card connectors, which only ignore bends when straight); spec US3 scenario 9 is amended to match.

**Rationale**: Reuses the card connector engine unchanged where it fits; adds one geometry function where relationships differ (stubs).
**Alternatives**: Letting relationship ends slide along sides to reuse segment drag as-is: rejected by 042 FR-006 and the spec (ends stay on rows).

## R8. Performance

**Decision**: Note icons add one icon per noted row; hover handling is delegated (no per-row listeners). Run `pnpm bench` before and after (constitution V); report in `bench-before.md` / `bench-after.md`. `TableRow.hidden`/`hasNote` are computed inside the existing cached layout.
