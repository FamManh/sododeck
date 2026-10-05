# Research: Sticky notes and connector multi-select

Method: read-only survey of the code (2026-10-05) plus the founder's reference screenshots (kept
locally in `reference/`, not published). Each item: Decision, Rationale, Alternatives.

## R1. Connector multi-select is mostly built

**Finding**: the selection store already holds several edges, shift-click and marquee add them, the
action context returns a `connections` target, `toolbar-variant` has a `connections` variant,
`lineStyleView` computes "mixed", and `setEdgeStyle(ids, patch)` is one undo step. Bend handles are
already hidden unless exactly one edge is selected. Missing: colour, weight and arrow ends are menu
actions or single-connector only, and edges cannot be locked.

**Decision**: do not rebuild selection. Promote `connection.colour`, `connection.weight` and direction
to the `connections` toolbar, reuse `LineStyleControls` popovers, and add lock for edges.

**Rationale**: smallest change that meets US4; avoids a second selection model.

**Alternatives**: a new bulk-edit panel (rejected: duplicates the toolbar and inspector).

## R2. File format changes (additive, no version bump)

**Decision**: add optional `Sticky.size` (reuses `$defs/Size`), `Sticky.fontSize` (integer from a fixed
list; absent = Auto), `Sticky.align` (`left | center | right`; absent = centre), `Sticky.tags`
(`$defs/Tags`), `Sticky.locked` (`const: true`), `Edge.locked` (`const: true`). `Edge.from` / `to`
may name a sticky (descriptions and semantic rules only, as in ADR 0031).

**Rationale**: precedent exists for each: `Node.locked` (043), `Size` on nodes and groups, `Tags` on
four objects, and widening ends (050). Unknown optional data is kept by older builds (ADR 0020).

**Alternatives**: store the auto-fitted font size (rejected: derived data, would go stale, bloats the
file); a separate "comment link" edge kind (rejected: spec says a regular connector; more code).

**Older builds**: show a sticky-ended connector as a broken reference (a problem, not a crash), same
accepted trade-off as ADR 0031.

## R3. Text auto-fit

**Finding**: no fit utility exists. `export/text-measure.ts` measures plain text with canvas 2D.
Notes render markdown in the DOM (`MarkdownView`), so lists, headings and code cannot be measured by
canvas alone.

**Decision**: a pure `fitFontSize(measure, steps, box)` that picks the largest step from a fixed
descending list (32, 28, 24, 20, 18, 16, 14, 12, 11, 10, 9 px) for which the content fits. The
production `measure` renders the note's markdown into one hidden DOM measuring element (same width,
same typography, tag rows subtracted) and reads `scrollHeight`. Results cache by
(text, width, height, tag rows, align). Only recompute on change, never on zoom or pan. Below 9 px the
note clips with a visible cue. For export, a plain-text measurer (markdown stripped) with the same
steps is used.

**Rationale**: correct for markdown, testable (the pure function takes an injected measurer), bounded
cost (≤ 11 measurements, only on edits and resizes).

**Alternatives**: CSS container query units / `font-size: clamp` (cannot react to text length);
shrink-to-fit with `ResizeObserver` loops (jank, hard to test); canvas-only measuring (wrong for
markdown).

## R4. Sticky as a connector end

**Finding**: ends resolve through `endpointOf` (model), `refs.ts`, `integrity.ts`, `connection-rules`,
`endpoint-target` (the hit-test scene), `endpointIdOf` in canvas handlers, `boxFor` and `endGeometry`
in `deck-to-flow`, the visible-graph representative map, `view-filter`, `focus-set`, export rects and
the delete cascade (`removeEdgesAt` is not called for stickies). The sticky RF node id is
`sticky:<id>`; the edge stores the bare id.

**Decision**: follow ADR 0031 exactly: a third collection in each of those places, a sticky `Handle`
set on the node (four side-named handles like groups), a `'sticky'` case in `targetScene`, a cascade
call, and an id-collision check across nodes, groups and stickies.

**Rationale**: one proven pattern; routing already works from any `Box`.

**Flows**: a connector to a sticky is a plain edge. Step pickers and flow analysis work from node
ids, so such a connector is never offered as a step; verified by a test. The pin leader line
(`sticky-leader`) stays separate.

**Hidden stickies**: when stickies are hidden (or anchored to a hidden node in the current view),
their connectors are not drawn (the visible graph drops edges whose end has no representative).

## R5. Sticky tags

**Finding**: `TagPicker`, `deckTags`, `tagUsage` and the model tag ops (rename, delete, colour) only
see nodes (plus edges, flows, steps in the ops). Chip layout lives in `card-tags.ts`
(`tagChips`, `tagRows`, `tagBlockHeight`).

**Decision**: generalise `TagPicker` to take targets (`{ nodeIds, stickyIds }`), include stickies in
`deckTags`, `tagUsage` (new `notes` count) and the model ops, and reuse the chip layout with a
"+N" collapse for narrow notes. The ten-per-object limit is shared (`MAX_CARD_TAGS`).

**Rationale**: decision Q1 (shared deck tags). Reuse keeps colours, case rules and delete
confirmations identical.

**Search/outline**: sticky text is indexed; add sticky tags to the search index in the same change.

## R6. Sticky look and the pad tile

**Decision**: a shared `StickyPaper` component draws the note (soft shadow, light vertical gradient,
slightly lifted corner via a pseudo-element, no header, no icon, no lip) from the existing sticky
tint tokens plus two new neutral shadow tokens if needed. The Add flyout tile reuses it at small size
to draw a pad (three offset sheets) in `lastStickyColour`. Colours stay the five current ones.

**Alternatives**: raster artwork (rejected: breaks themes and tokens).

**Copyright**: the look is our own design from our tokens; the reference images are never shipped or
committed, and copy or class names never mention other tools.

## R7. Drop from the pad

**Finding**: `addNoteAt` pins to the card under the pointer; the drag payload `NOTE_MIME` exists.

**Decision**: add an options object to `addNoteAt` (`{ pin: boolean, colour }`); dropping from the pad
passes `pin: false`; the Sticky tool click on a card keeps today's pinning (it is a different gesture).
The new note opens in edit mode (existing draft flow).

## R8. Resize

**Decision**: use the existing node resize pattern (`017-resize-edge-routing`) with corner and side
handles via `NodeResizer`-style handles, minimum 96 × 96 px, snapping like cards, writing
`Sticky.size` on release in one undo step. Disabled when collapsed or locked.

**Default size**: 200 × 200 px (a square pad note). Existing stickies with no `size` render at the
default; collapsed keeps its one-line form. Import placement and export constants follow
`STICKY_DEFAULT_SIZE` instead of the hard-coded 180 / 200 (three places found).

## R9. Lock

**Finding**: lock exists for nodes only (`node-lock.ts` hard-codes `nodes`; `lock.ts` UI helpers).

**Decision**: generalise `setLocked(ctx, collection, ids, locked)` to nodes, stickies and edges; UI
helpers get sticky and edge variants. Locked objects refuse move, resize, reshape, delete, reconnect;
unlock stays available. Group lock and select-all-and-lock are 054.

## R10. Toolbar

**Decision**: add `sticky` and `stickies` variants to `toolbar-variant.ts`; the toolbar content is
defined as actions with `surface: 'toolbar'` like cards, with custom popovers for text size, colour
(five swatches) and tags. For `connections` add arrow ends, colour and weight as toolbar actions and
lock. Placement and hide rules (pan, drag, marquee, edit, flow mode, Hide UI) come from the existing
`SelectionToolbar`.

## R11. Bold, alignment, link

**Decision**: bold and link edit the markdown text: while editing they wrap the textarea selection;
otherwise they wrap the whole text. Alignment is the new `Sticky.align` field. No new rich-text format.

## R12. Performance

**Decision**: measure with `pnpm bench` before and after (bench deck gains stickies with connectors);
fit is cached and runs only on change. Expected impact: none on pan/zoom.

## R13. Open items deferred to tasks (not blocking)

- Exact shadow/gradient token values (design pass against DESIGN.md).
- Exact fixed font size list shown in the toolbar (starting point: 12, 14, 16, 20, 24, 32).
- ADR number: 0036 (next free; the folder has duplicate 0031 and 0034, so check before writing).
