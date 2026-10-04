# Quickstart results (041)

Run 2026-10-04 on branch `FamManh/feat-db-table-card`. Screenshots in [screens/](screens/); the
deck used is [screens/shop.sododeck.json](screens/shop.sododeck.json) ("Shop": `orders`,
`customers` in a second schema with a blue fill, `order_items` pinned to Keys, one enum).

## 1. Tests

All listed test files exist and pass (`pnpm test`): `table-layout`, `table-keys`,
`table/table-body`, `table/enum-popover`, `actions/table-detail-actions`,
`shell/table-detail-control`, `inspector/deck-inspector` (Database), `canvas-geometry` (tables),
`deck-node` (table cards), `export/scene`, `export/render-svg`, `export/scene.perf` (150 tables),
`state/ui-store` (enum popover), `bench/generate-deck` (tables); model `db-schema`,
`round-trip`, `concurrency`; schema fixtures and coverage.

## 2. In the app

| Step                                     | Result                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Shop at 100 %+ vs frames 156 / 157    | Matches: header "Table · public" / "Table · auth", one-line title, 2-line note, hairline, key / link / "U" glyphs, Mono types, `order_status` chip, "text ?", "2 indexes"; blue fill and dark theme follow the Deck card. `table-card-light.png`, `table-card-dark.png`. |
| 2. Enum popover                          | Rest on the chip opens "order_status" with values and notes; moving away closes it; Enter opens it, Escape closes and returns focus (component test). `enum-popover-light.png`.                                                                                          |
| 3. Zoom 38 % → 180 %                     | Same flow box at every level (`orders`: 240 × 222 at 180 %, 68 % and 38 %); System shows title, key dots and the count; Landscape the icon plate. `system-keys-light.png`, `landscape-light.png`.                                                                        |
| 4. Table detail Keys, per-table override | Zoom island radio "Keys" → key rows and "+n columns"; the Detail submenu and the header toggle override one table; one undo step each (tests). Narrow window: "Table detail: Keys" dropdown.                                                                             |
| 5. Deck settings › Database              | Four switches, all on; turning one off writes `tableDisplay.hide*` (tests).                                                                                                                                                                                              |
| 6. Export                                | SVG rows are `<text>` with lucide glyph paths, the enum chip, pill and footer, no `<foreignObject>`; matches the canvas. `export-svg.png`.                                                                                                                               |

## 3. Performance

See [bench-before.md](bench-before.md) and [bench-after.md](bench-after.md): 150 tables pan at
56.4 fps vs 58.6 fps for 150 cards (mean frame +3.8 %, p95 equal), within SC-004's 10 %.

## 4. Contrast (SC-006, T037)

Every text / fill pair a table row uses is asserted in both themes by
`packages/ui/test/contrast.test.ts` (`TABLE_ROW_PAIRS`, 041):

| Pair                              | Where                                                    | Light    | Dark     |
| --------------------------------- | -------------------------------------------------------- | -------- | -------- |
| Ink on Surface / Surface 2        | names, PK glyph, rest / hovered row                      | pass     | pass     |
| Muted on Surface                  | type, "?", footer at rest                                | 4.84     | 5.58     |
| Secondary on Surface 2            | type and "?" on a hovered row (§g-90: raised from Muted) | 6.81     | 8.08     |
| Secondary on each named card fill | type, "?", footer, FK glyph, "U" on a coloured card      | pass ×13 | pass ×13 |
| Card ink on card chip             | enum chip text, 13 colours                               | pass ×13 | pass ×13 |

A custom hex card colour uses the readable text colour (`data-text`), as other Deck cards do.
