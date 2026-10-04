# Research: Table Card (041)

Phase 0 of [plan.md](plan.md). Clarify answers (2026-10-04) are given: stored column order, an
optional enum colour, deck-level display settings in the file. Code facts come from a survey of
`apps/app/src/editor` (card layout, levels, export, inspector, actions) on 2026-10-04.

## R1. One pure table layout shared by canvas and export

- **Decision:** a new pure module `apps/app/src/editor/table-layout.ts` with constants
  `TABLE_CARD` (width 240, row 24, key slot 16 / 30, note line 17, max note lines 2, footer 24,
  hairline 1, pill 24, type share 0.58, nullable slot 7) and
  `tableLayout(input, width, measure) → TableLayout` returning the rows to draw (column ids in
  stored order, each with glyph kinds, cut name and type, nullable flag, enum chip), title and
  note lines, the "+n columns" count, footer text and the computed height. `canvas-geometry.ts`
  `cardLayoutOf` routes `db-table` nodes to it (as it routes shapes to `shapeLayout`), so
  `cardSize`, `cardBox`, group bounds, fit and export all get the table size from one place.
- **Rationale:** §g-58 (height computed, never measured); ADR 0016 (export never measures the
  DOM and reuses the card layout). Shapes already prove the routing.
- **Alternatives:** measuring rows in the DOM (breaks export and layout); extending
  `cardLayout` with table branches (one function for two different bodies; harder to test).

## R2. Size does not follow zoom

- **Decision:** a table's box depends on its effective detail (table `detail` ?? deck detail;
  Auto = All) and the display toggles only. Below 90 % the card draws compact content (System:
  name, key dots, count; Landscape: icon plate) inside that box, exactly as Deck cards do today
  (`cardSize` ignores the level). From 90 % it draws its effective detail. The spec was corrected
  (FR-013, FR-014, US3).
- **Rationale:** `canvas-geometry.ts` `cardSize(node, _level)` ignores the level by design:
  boxes that grow on zoom would overlap neighbours and move connectors while zooming. Frame
  162's "Container shows keys" in Auto is reached by pinning Keys.
- **Alternatives:** box per zoom level (frame 162 caption; rejected: layout jumps at 150 %);
  Auto box sized for All but drawing keys at Container (empty space in every card).

## R3. Rows in stored order; key glyphs derived

- **Decision:** rows draw in stored order (clarify Q1). Glyphs: primary key from `pk`; foreign
  key when the column is a column end on the referencing side of an edge (the `n` side of
  `1-n` / `n-1`, else `from`), computed once per deck snapshot into
  `Map<tableId, Set<columnId>>` (`table-keys.ts`, cached by `edges` identity); "U" for `unique`
  non-key columns; nullable when neither `notNull` nor `pk`. Keys detail keeps rows that are PK or
  FK, in stored order. The key slot is 30 when any row has two glyphs.
- **Rationale:** spec FR-005, FR-006, FR-016; one derivation for canvas, export and 042.

## R4. Deck display settings in the file

- **Decision:** root `tableDisplay` (after `enums`): `{ detail?: "names" | "keys" | "all",
hideTypes?: boolean, hideNullable?: boolean, hideNotes?: boolean, hideIndexes?: boolean }`,
  `additionalProperties: false`. Absent object or key = Auto and shown. The editor writes `true`
  or removes a hide flag, removes `detail` for Auto, and removes the object when empty. Stored as
  a plain `meta.tableDisplay` map in Yjs (per-key writes so two tabs toggling different switches
  both keep theirs). New model op `setTableDisplay(patch)`; one undo step per change.
- **Rationale:** clarify Q3. "hide" flags keep "absent = on" with no stored defaults (schema
  rule: no `default` keyword). 042 adds relationship display next to it (`relationshipDisplay`),
  so the names do not collide.
- **Alternatives:** booleans that mean "show" (a file would need `true` everywhere or absent
  would have to mean true, which reads wrong); per-view settings (048).

## R5. Enum colour

- **Decision:** `DbEnum.color?: ColorRef` (the card-colour reference: a palette name or hex),
  declared after `note`. The chip uses the same look as tag chips (`tagChips` / `TAG_CHIP`
  colours from the palette); neutral chip when absent or when the enum is missing. 040's
  `updateEnum` patch gains `color`. The picker UI is 043's.
- **Rationale:** clarify Q2; reuses an existing colour type and chip look (no new palette).

## R6. Canvas component

- **Decision:** `DeckNode` keeps the frame, header, badges, states and a11y; when
  `isDbTable(node)` its body renders `TableBody` (`apps/app/src/editor/table/table-body.tsx`)
  instead of description, fields and tags, from `data.table: TableLayout` built in
  `deck-to-flow.ts` `toFlowNode` (added to its cache equality check). Rows are plain elements
  (one flex row each, no per-row component state); the hover fill is CSS `:hover` on the row.
  System / Landscape content follows the existing `isLandscape` / level branches.
- **Rationale:** states, selection, focus, dimming, drill-in proxies and handles stay one
  implementation (029, 034); the body is the only difference, like 032's fields block.
- **Alternatives:** a separate `table` node type in React Flow (duplicates every state).

## R7. Enum popover

- **Decision:** the enum chip is a `<button>` (class `nodrag nopan`, `tabIndex` follows the
  card's roving focus, Enter / Space stop propagation; model: 032's "+N fields" button). Hover
  uses the `use-hover-focus` timings (150 ms rest, 100 ms grace) to open a `Popover` (packages/ui)
  anchored to the chip; focus + Enter opens it; Escape closes. One popover instance per canvas
  (state in `ui-store`: `enumPopover: { nodeId, columnId } | null`), mounted lazily, never one per
  chip (the tooltip cost note in `details-button.tsx`).
- **Rationale:** FR-011, FR-023, SC-004.

## R8. Cut text tooltips

- **Decision:** cut table names use the existing lazy title tooltip; cut column names and types
  use the native `title` attribute on the row (no Radix tooltip per row). The row's accessible
  text is the full name and type (visually cut with CSS `text-overflow` only where the layout
  says so).
- **Rationale:** cost of one Radix tooltip per element at scale (`details-button.tsx` note);
  150 × 12 rows.

## R9. Detail controls

- **Decision:**
  - Deck: a `TableDetailControl` in `shell/zoom-island.tsx` next to `LevelIndicator`, shown
    only when the deck has at least one table: a `SegmentedControl` Auto · Names · Keys · All;
    in the compact shell (`useCompactShell`, < 1280 px) a dropdown like `LevelIndicator`.
  - Table: an action module `editor/actions/table-detail-actions.ts` (radio submenu "Detail":
    Use deck setting, Names, Keys, All) in `ACTIONS` for menu and toolbar on `db-table` targets,
    and a header toggle button in the badge slot cycling Use deck setting → Keys → All.
  - Both write through `editor.setTableDisplay` / `editor.update('nodes', id, { detail })`
    inside `oneStep`.
- **Rationale:** existing island and action patterns; FR-014, FR-015. The 900 px dropdown in
  DESIGN.md maps to the existing compact shell breakpoint.

## R10. Deck settings "Database" section

- **Decision:** `deck-inspector.tsx` gains `<PanelSection label="Database">` after Summary,
  shown only when the deck has a table or the Database pack is on, with heading "Show on tables"
  and four `Switch`es (Data types, Nullable marker, Notes, Index footer). 043 adds the dialect
  select, notation and export rows to the same section.
- **Rationale:** frame 152; §g-85 (only the Database section is new); §g-86 (use `packages/ui`
  `switch`).

## R11. Export

- **Decision:** `export/scene.ts` `SceneCard` gains `table?: TableLayout` (from `tableLayout`
  with the same deck display and per-table detail; export draws at Component level, as it does
  for cards); `render-svg.ts` adds `tableBody()` drawing the hairline, rows (glyph paths from
  lucide `key-round`, `link-2`, the "U" square, text, enum chip rect), the "+n columns" pill and
  the footer. `FONTS` gains Mono 11 for types. PNG goes through `rasterize.ts` unchanged. The
  enum popover is not exported.
- **Rationale:** ADR 0016; SC-005; scene perf budget (< 50 ms) tested in `scene.perf.test.ts`.

## R12. Header type name and schemas

- **Decision:** a deck-level derived value `schemaCount` (distinct non-empty `schema` names of
  tables) computed with the FK map; "Table · <schema>" when ≥ 2, else "Table". The accessible
  name is "Table <title>, <n> columns" plus the existing state suffixes.

## R13. Tokens

- **Decision:** layout numbers live in `TABLE_CARD` (TS, shared by canvas and export, like
  `DECK_CARD`). CSS uses existing tokens: row hover Surface 2, type text Muted on Surface and
  Secondary on tinted rows (§g-90), hairline token, chip colours from the palette. No new CSS
  variable unless the implementation needs one; `packages/ui/CLAUDE.md` documents any added.

## R14. Performance and bench

- **Decision:** add a `tables` option to `apps/app/src/bench/generate-deck.ts` (n of the nodes
  become `db-table` with 12 columns and FK edges), a `tables` query parameter in
  `routes/bench-page.tsx` and `BENCH_TABLES` in `bench/perf.bench.ts`. Measure 150 tables vs 150
  cards before and after; save `bench-before.md` / `bench-after.md` in this spec folder. Budget:
  within 10 % frame time (SC-004). 048 adds the 150-table scenario to the standing bench.
- **Rationale:** constitution V; the backlog's DOM-count risk (1,800 rows).

## R15. Dependencies

- **Decision:** none. Lucide icons (`Table2`, `KeyRound`, `Link2`) are already bundled.
