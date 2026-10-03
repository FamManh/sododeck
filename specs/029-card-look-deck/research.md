# Research: Card Look "Deck" (029)

Decisions behind [plan.md](plan.md). Each entry gives the decision, why, and what else was considered. Code names were checked on `main` at `c1c8acd` (036 merged).

## R1. File format: `EdgeStyle` and the line type

**Decision**

- Add a `$defs/EdgeShape` enum `curved | elbow | straight`.
- Add `$defs/EdgeStyle`: `{ shape?: EdgeShape }`, `additionalProperties: false`, `minProperties: 1`.
- Add `Edge.style` (optional) declared **after** `route` in `v1.json`. Canonical key order is derived from declaration order (`packages/model/src/key-order.ts`), so this puts `style` last in written files.
- The Zod generator drops `minProperties`, so add semantic rule **S7** "an edge style has at least one key" next to S6 (card style) in `packages/schema/src/semantic-rules.ts`, with an invalid fixture. This keeps the Ajv / Zod parity test green.
- `version` stays `1`. Nothing else changes in the file.

**Why**: this is exactly the row in ADR 0022 (Connections). `EdgeStyle` is a separate def from the card `Style`, because 022 adds `dash`, `width`, `color` and `animated` to the edge style only, and the card `Style` (`fill`, `stroke`) must not accept them.

**Alternatives**: reuse `$defs/Style` (rejected: wrong keys for edges); a top-level `edge.shape` (rejected: ADR 0022 fixes `edge.style.shape`, and 022 shares the object).

## R2. Effective shape and when `shape` is stored

**Decision**

- One pure function in `packages/model`: `edgeShape(edge) = edge.style?.shape ?? (edge.route?.offset !== undefined ? 'elbow' : 'curved')`. The canvas, the merged-edge code, export and the JSON panel all use it.
- `setEdgeShape(edgeIds, shape)` writes `style.shape` explicitly for every target, for every shape, except `curved` on an edge with no `route.offset`, where it deletes `shape` (and drops an empty `style`). That case is the only one where absent already means the same thing.
- An edge with a legacy offset and no stored shape (elbow by the default) must not silently turn curved when its offset goes away. So `edge.resetRoute` and the drawer's reattach (which clears `route`) first write `shape: 'elbow'` in the same transaction when the edge's effective shape is elbow and `shape` is absent.
- Switching away from elbow never touches `route` (clarification Q2). Switching back restores the offset.

**Why**: storing explicitly is the only way to keep the clarification "a non-elbow connector with an offset stores its shape" and keep elbow stable after a route reset. Deleting on curved-without-offset keeps the file minimal for the common case and matches "files do not gain the field until the user sets a line type" as closely as the semantics allow.

**Alternatives**: always store `shape` once set (rejected: curved would be written for every touched connector, noisier JSON for no gain); clear `offset` when leaving elbow (rejected by Q2).

## R3. Model op and storage

**Decision**

- New `ops/edge-style.ts` with `setEdgeShape(ctx, edgeIds, shape)`.
- It validates every candidate edge with `validateObject('edges', …)` before writing (throws `DeckEditError` without writing).
- It writes in **one** `ctx.transact`: get or create the nested `style` `Y.Map` (ADR 0021: nested objects are `Y.Map`s), `set('shape')` or `delete('shape')`, delete `style` when empty. This is key by key, like `ops/style.ts` `writeChannel`, so a later 022 key and `shape` edited in two tabs both survive.
- Add an `edgeStyle` entry to `validate.ts` `ELEMENT_SCHEMAS`.
- Expose it as `DeckEditor.setEdgeShape`. `editor.add('edges', { from, to, style })` already accepts `style` once the schema has it (used for new connectors, R9).
- `edge.resetRoute` gains the R2 pinning through a small `pinElbowBeforeClear` helper in `ops/shape.ts`.
- No layout change: a nested `Y.Map` under an existing edge is already covered by ADR 0021 (R11: first creation of `style` by two clients is last-write-wins, acceptable).

**Why**: same pattern as 020's `setStyle`, which is tested for concurrent channel edits; one transaction gives one undo step for a multi-selection.

**Alternatives**: `editor.update('edges', id, { style })` per edge (rejected: `writeField` replaces the whole nested map, losing 022 keys later, and multiple updates are not one transaction).

## R4. Path builders for the three line types

**Decision**

- `routing/route-path.ts` gains `routedPath(shape, from, to, sides, offset)`, a single entry that returns `{ path, labelX, labelY, ends }`. `ends` holds the start point, end point and the end direction (unit vector) for the arrow and knob.
  - **elbow**: today's `routedStepPath` (smooth step + `offset`).
  - **curved**: a cubic Bézier whose two control points leave each end along its side's normal, at a distance of `max(40, 0.4 × distance)`. This is the canvas library's Bézier helper's shape, written as our own pure function so export can share it without importing the canvas library.
  - **straight**: one segment between the two side midpoints.
- **Ends** (clarification Q4): every shape uses `resolveSides` (pinned sides or centre comparison) and the side midpoints. Changing shape never moves an end point.
- **Self-loops** (imported only; the canvas refuses to create them, `connection-rules.ts`): every shape draws the same small loop off the card's top-right (out of the right side, back into the top), so it is never a zero-length line or a curve through the card.
- **Short connectors**: the line is shortened by the arrow length at the end; if the gap is shorter than the arrow, the arrow is still drawn full size along the side's normal and the line segment is omitted.
- Callers switched to `routedPath`: `deck-edge.tsx`, `merged-edge.tsx`, `routing/endpoint-connection-line.tsx`, `export/edge-geometry.ts`.

**Why**: one pure, unit-tested geometry module used by canvas and export keeps them identical (ADR 0016 consequence) and keeps the canvas library out of the export chunk.

**Alternatives**: the canvas library's `getBezierPath` / `getStraightPath` in the canvas and a copy in export (rejected: two implementations drift); free-angle anchors for straight lines (rejected by Q4; 022 adds `fromAt` / `toAt`).

## R5. Merged and port connectors

**Decision**: merged connectors (to a collapsed group) and port connectors (drill-in) are always drawn **curved** with the Deck stroke, arrow and knob. They are not routable and have no line-type control; they keep today's count badge and popover.

**Why**: they stand for several connectors with possibly different types; B draws them curved; per-bundle styling is 034.

## R6. Arrow, start knob and direction

**Decision**

- Today every connector has a 3px dot at both ends and no arrowhead. In the Deck look:
  - `forward` (or absent): 3.5px knob at the `from` end, arrow at the `to` end.
  - `both`: arrows at both ends.
  - `none`: knobs at both ends.
- The arrow is drawn as a path (filled triangle 9 long × 10 wide, 2px round-joined stroke, line colour), placed with the `ends` direction from R4. No SVG `<marker>`: flow mode, selection and dimming change the line colour per edge, and markers would need one definition per colour.
- Stroke 2px in `--sd-deck-edge`; selected 2.5px Deck Orange as today; flow states keep today's flow colours (playback restyle is 035).

**Why**: keeps the existing `direction` meaning (FR-022) and makes direction readable without colour.

## R7. Card layout and size

**Decision**

- `canvas-geometry.ts`: `NODE_SIZE` default becomes **184** wide (`DECK_CARD_WIDTH`); height is computed by a new pure `cardLayout(node, width)` in `card-layout.ts`, replacing the fixed 50 px base:
  - padding 12 top / 12 bottom, 13 left / right; gap 8 between regions;
  - header 24 (tile + type name + badge slot);
  - title: Geist 14 / 600, line height 18 (14 × 1.28), up to 3 lines;
  - description (the view's subtitle field, today's "subtitle"): Geist 12 / 400, line height 16.8, up to 3 lines; region skipped when empty;
  - tags: `card-tags.ts` switches to B's metrics (18 tall pills, 10.5 / 500, padding 0 6, gap 4); skipped when no tags;
  - "n inside" pill 24 tall when the card has children.
- Line counts come from canvas `measureText` wrapping (the same technique `card-tags.ts` already uses), cached per `(text, width, font)`. Nothing is measured from the DOM, so size stays one pure function of the node and its width (§g-58).
- **Stored size (017)**: width is the stored width. Height is the stored height, but never less than the minimum layout (header + one title line + tag block + padding). Title and description clamp to the lines that fit, title first. A card without a stored size gets the full content height.
- `cardSize` keeps its signature and stays level-independent; the level only decides what is painted inside the same box.
- `COMPONENT_CARD_SIZE` (tidy cell) and `COLLAPSED_CARD_SIZE` follow: tidy cell 184 × 128; collapsed hand 184 × 112.
- Export's `scene.ts` uses the same `cardLayout`.

**Why**: B's anatomy with content-driven height; the 017 resize must still be able to make a card shorter than its content.

**Alternatives**: measure the DOM after render (rejected: §g-58 and the bench; layout would jump); fixed 3-line height for every card (rejected: wastes space, B's 120 frame shows shorter cards).

## R8. What each zoom level paints (frame 123, §g-58, §g-59, §g-63)

| Level (zoom)         | Painted inside the same box                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Landscape (≤ 45 %)   | Type icon centred on the card fill (Surface when uncoloured), no text, no handles                          |
| System (45–90 %)     | Tile + title; tags as 6px dots (colour `dot`, neutral `--sd-deck-dot-neutral` uncoloured) in the tag block |
| Container (90–150 %) | + type name, description, problem / pin badges, tag pills                                                  |
| Component (> 150 %)  | Same as Container (fields arrive with 032)                                                                 |

- **Lip below 60 %**: a single boolean selector `zoom < 0.6` sets `data-lipless` on the canvas wrapper, read by CSS, like the existing `data-tiny-cards` flag (019 R4: cards never subscribe to the zoom). No card re-renders when crossing 60 %.
- The level boundaries and hysteresis in `levels.ts` do not change.

**Why**: a level change already re-renders cards (it is in the node cache key); the lip rule needs no React work at all.

## R9. Line type control and the per-tab memory

**Decision**

- New action `connection.lineType` in `actions/connection-actions.ts`: radio children Curved / Elbow / Straight (lucide `Spline`, `CornerDownRight`, `Minus`; verify the names against the installed `lucide-react` when implementing). Shown in the connection toolbar, the context menu and the drawer.
- **Multi-selection**: today `targetOf` returns `connection` only for exactly one edge; several edges give `mixed`. Add a `connections` target kind (two or more edges, nothing else) to `actions/use-action-context.ts` and `quick-edit/toolbar-variant.ts`. `connection.lineType` applies to `connection` and `connections`. Mixed selections that include cards do not show it.
- The radio shows the checked type when every selected edge has the same effective shape; otherwise none is checked and the trigger reads "Line type: mixed" (FR-028).
- Applying runs `setEdgeShape(selectedEdgeIds, shape)` inside `oneStep` (one undo step), announces "Line type: Elbow" (or "… for 3 connectors") through the announcer, and sets `useUiStore.lastLineShape`.
- `lastLineShape: EdgeShape` (default `'curved'`) lives in `state/ui-store.ts`, in memory only (no localStorage), so it is per tab and lost on reload. Only `connection.lineType` sets it; undo, paste and opening another deck do not.
- `canvas-actions.ts` `connectComponents` (pointer and keyboard connect) passes `style: { shape }` to `editor.add('edges', …)` when `lastLineShape !== 'curved'`, so creation and shape are one undo step.
- Drawer: `inspector/edge-inspector.tsx` gets a "Line type" `SegmentedControl` next to `RouteFields`; the edges-only multi-selection frame in `inspector.tsx` gets the same control instead of the bare "Select one item…" text.
- 017's segment handle and `RouteFields` "Reset route" show only when the effective shape is elbow (FR-025).

**Why**: reuses the 019 action list so toolbar, menu and drawer stay in sync and are tested once.

## R10. Card frame, states and handles in CSS

**Decision**

- The lip is a `box-shadow: 0 var(--lip) 0 0 var(--card-stroke)` on the card element, with `--lip` 3 / 5 (hover, current step) / 6 (dragging) and `0` under `[data-lipless]`. No blur. Border 1.5px `--card-stroke` (Border-strong when uncoloured), radius 14.
- **Hover lift and drag tilt** are `transform` on the card's inner element, never on the canvas library's node wrapper (which carries the position transform). So the box used for hit tests, snapping, anchors, minimap and export is unchanged (FR-016). Drag tilt keys off the existing `.react-flow__node.dragging` class; no new per-card state.
- Transitions on `transform` and `box-shadow` are disabled under `prefers-reduced-motion: reduce` (FR-042).
- **Selected**: `outline: 2px solid var(--sd-deck-orange); outline-offset: 2px`. **Problem**: `outline: 1.5px dashed var(--color-clay)` at offset 4 on a sibling layer (so selected + problem both show), and the problem badge moves into the header badge slot as a Clay Soft pill with `TriangleAlert` + count (replaces today's corner disc).
- **Dimmed**: focus mode and saved-view dimming use a new `--sd-deck-dim` (0.22). Flow-mode dimming keeps today's value until 035.
- **Highlighted neighbour** (`.in-focus`): border and lip in Secondary.
- **Connection target**: orange border, hovered side handle active; refused target keeps today's dashed Clay outline.
- **Handles** (`index.css` `.sd-handle`): 12px round, Surface fill, 2px Secondary border; active / hot side 16px Deck Orange with a 4px Orange Soft halo. Keep `visibility: hidden` in flow mode (never `display: none`).
- **Title editing**: `CardTitleInput` uses the title style and the selection colour `#fbd9c3` / `#6a3315` as a token.

**Why**: all states are paint-only CSS on existing classes and flags, so no new React state and no extra re-renders (bench).

## R11. Groups

**Decision**

- `CollapsedGroupNode` becomes the fanned hand (DESIGN.md "Groups"): two back sheets (absolute, `rotate(-7deg)` / `rotate(4deg)` around bottom centre, group fill + stroke + 3px lip) behind the front card: `Layers` tile, "Group", member count in a 26px Ink disc, name, one 22px tile per member kind (capped at the width; extra shown as "+n"). Size 184 × 112. Handles stay on the front card box.
- `GroupBoundaryNode`: radius 20, 1.5px solid border (colour stroke or Border-strong; was dashed), fill colour or Surface 2; label becomes a pill on the top edge (left 16, top −14, 28 tall, 2px lip): chevron + name (12.5 / 600) + count in an 18px Ink disc. The drop-target cue stays as today (orange border + "Drop into" pill).

## R12. Palette tokens and contrast

**Decision**

- `packages/ui/src/styles/tokens.css`: add `--sd-card-{name}-chip`, `-ink`, `-dot` for the 13 colours, light and dark (78 tokens), from DESIGN.md "Extended palette"; plus the Deck tokens listed in DESIGN.md "Card system (Deck)" (`--sd-deck-*`: edge `#b4b4ab` / `#5a5a53`, orange, orange-soft, selection colour, dim 0.22, neutral dot). Map them in `theme.css` like the 020 tokens.
- `fill` / `stroke` stay 020's values (§g-66).
- `packages/ui/test/contrast.test.ts`: every `ink` on its `chip` ≥ 4.5:1 in both themes (FR-034, SC-007); every `dot` on its `fill` ≥ 3:1 (non-text graphic). `theme-vars.test.ts` covers that every new token exists in both themes.
- Custom deck colours: chip = the hex, ink = `readableText(hex)`; no new check (§g-79).

## R13. Export

**Decision**

- `export/scene.ts`: `SceneCard` gains `typeName`, `description`, `tags` and the R7 layout (export draws resting cards with no problem or selection state, as today); `SceneEdge` gains `shape` and `direction`; `SceneCollapsed` gains member kinds.
- `export/render-svg.ts` `card()` draws the Deck frame: radius 14, 1.5px border, lip as a second rounded rect offset 3px down in the stroke colour behind the card, header tile + type name, title (600) and description clamped by `text-measure.ts`, tag pills (closing today's empty tag area). `edge()` uses `routedPath` and the R6 ends. Collapsed groups draw the fanned hand; expanded frames the Deck frame and label pill.
- Export is resting state at full detail (Container look), light palette only (ADR 0016); `export-palette.ts` `LIGHT_PALETTE` gains the new tokens and `export-palette.test.ts` keeps it in sync with `tokens.css`.
- Weight 600: `export-fonts.ts` loads `'600 14px "Geist Variable"'` too (the variable font already contains it; only the load call is added).
- The `Layers` icon path (collapsed-group tile) is added to `icon-paths.ts`; its drift test covers it. Line-type and problem icons are not drawn in exports.
- ADR 0016 stays; its "Consequences" list is updated (export now draws tags and three line types).

## R14. Performance

**Decision**

- `pnpm bench` before and after on this branch (constitution V gate), with the default run plus `BENCH_ROUTES=1`, `BENCH_COLOURS=1` and `BENCH_GROUPS=1`. Add `BENCH_LINE_TYPES=1` to `bench/perf.bench.ts`: one third each of curved, elbow and straight.
- Risks and mitigations:
  - 500 extra `box-shadow`s (the lip): flat, no blur, which is cheap to paint; turned off below 60 % by the wrapper flag.
  - Bézier paths cost about the same as smooth-step paths.
  - `cardLayout` text measuring: cached per text and width; covered by `scene.perf.test.ts` and a new unit perf case (500 cards < 20 ms).
  - Hover transform: on the inner element only, one card at a time.
- Baseline for comparison: 036's `bench-after.md` (default 53.5 FPS, 1.9 % long frames), re-measured on this branch before any change, in `bench-before.md`.

## R15. Docs

- DESIGN.md: the `node`, `edge`, `handle` and group component entries now point at "Card system (Deck)" as what the app draws; Typography keeps "600 only inside Deck cards" (§g-68); the old dashed 3px error ring text is replaced by B's problem state.
- ADR 0022: Connections row confirmed, with the R2 refinement (explicit storage; reset route pins elbow) and semantic rule S7.
- ADR 0016: consequences updated (R13).
- `packages/model/CLAUDE.md`: `setEdgeShape`, `edgeShape`. `packages/schema/CLAUDE.md`: S7.
- `docs/backlog.md` 029: status line when implemented.
