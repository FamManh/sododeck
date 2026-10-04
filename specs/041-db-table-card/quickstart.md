# Quickstart: validating 041 (Table Card)

Prerequisite: **040 merged** (model, `db-table`, "Shop" fixture in
`packages/schema/examples/full.sododeck.json`). Shapes: [data-model.md](data-model.md); roles:
[contracts/table-card-ui.md](contracts/table-card-ui.md); format:
[contracts/format-and-model.md](contracts/format-and-model.md).

## 1. Unit and component tests

```bash
pnpm --filter @sododeck/schema test     # tableDisplay, enum colour: parity + fixtures
pnpm --filter @sododeck/model test      # setTableDisplay, enum colour, round-trip, concurrency
pnpm --filter @sododeck/app test        # table-layout, table-keys, TableBody, popover, actions, inspector, export scene
```

| Test (apps/app/src/editor)                   | Proves                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `table-layout.test.ts`                       | heights for All / Keys / Names, toggles, empty table, note ≤ 2 lines, key slot 16 / 30, cuts |
| `table-keys.test.ts`                         | FK derivation per cardinality, composite ends, self-reference, schema count                  |
| `table/table-body.test.tsx`                  | rows by role and name, glyphs, nullable, enum chip, "+n columns", footer                     |
| `table/enum-popover.test.tsx`                | hover / Enter opens, Escape closes and returns focus, "No values", missing enum → no chip    |
| `actions/table-detail-actions.test.ts`       | radio submenu, multi-select one undo step, Use deck setting removes `detail`                 |
| `shell/table-detail-control.test.tsx`        | Auto · Names · Keys · All, compact dropdown, hidden without tables                           |
| `inspector/deck-inspector.test.tsx`          | Database section and four switches write `tableDisplay`                                      |
| `canvas-geometry.test.ts`                    | `cardSize` of a table equal at every level; follows detail and toggles                       |
| `export/scene.test.ts`, `render-svg.test.ts` | table payload equals the canvas layout; SVG rows are text; perf budget unchanged             |

## 2. In the app

```bash
pnpm dev
```

1. Import `full.sododeck.json`. Compare `orders` at 100 % with frame 156 and the set with 157
   (light and dark). Screenshot both themes.
2. Hover `order_status`: values popover. Tab to the card, Tab to the chip, Enter, Escape.
3. Zoom from 30 % to 200 %: the table box never changes size (SC-002); System shows key dots and
   count; Landscape the icon plate.
4. Zoom island → Table detail Keys: every table shows keys and "+n columns"; `orders` context
   menu → Detail → All; reload; still All. ⌘Z restores Keys.
5. Deck settings → Database → turn off Data types, Notes: tables shrink; JSON panel shows
   `tableDisplay`.
6. Export SVG and PNG: compare with the canvas (SC-005).

## 3. Performance (SC-004)

```bash
BENCH_TABLES=150 pnpm bench     # 150 tables × 12 columns
BENCH_TYPES=1 pnpm bench        # 150-card comparison run (same node count)
```

Save summaries to `specs/041-db-table-card/bench-before.md` and `bench-after.md`; table frame
time within 10 % of cards.

## 4. Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```
