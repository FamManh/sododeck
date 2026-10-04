# Quickstart: validating Database Scale

Prerequisites: `pnpm install`; Node ≥ 24.

## Automated

```bash
pnpm --filter @sododeck/schema test && pnpm --filter @sododeck/model test   # format, ops, search
pnpm --filter @sododeck/app test                                            # layout, grouping, views, palette
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
BENCH_NODES=150 BENCH_EDGES=250 BENCH_TABLES=150 BENCH_REL=1 BENCH_WIDE=1 BENCH_SCHEMAS=3 pnpm bench   # 150-table scenario
pnpm bench                                                                  # 500-card baseline
```

Unit coverage to see green: row selection (limit, order, connected rows, filter), layout cache
keys, anchor on the button, `expanded` round-trip and undo, `groupingMode` round-trip, view
`schemas` / `detail` round-trip and Ajv/Zod parity, schema grouping and collapse ids, merged list,
view filter and revealed tables, search kinds / ranking / cap, focus edges among kept tables.

## Manual (dev server `pnpm dev`, app on :5173)

1. **Row limit**: open a deck with a 60-column table; at 100 % it shows 12 rows + "Show all 60
   columns"; click, reload, still open; undo closes it. Compare frame 158.
2. **Connector anchor**: a foreign key on a cut column ends on the button; opening the table moves
   it to the row with no jump.
3. **Filter**: select the table, ⌘F, type a name that exists only past row 12; counter, highlight,
   Enter / Shift+Enter; Esc restores.
4. **Jump to**: ⌘K, "invoice_id": the column row is selected, the table opened (undo reverts), the
   canvas centred.
5. **Grouping**: Deck settings → Database → By schema; collapse `billing`; ×n pill lists the FKs;
   switch back to By group; collapse state kept per mode.
6. **View**: new view "Billing" with schema `billing` + table `customers`, detail Keys; proxies
   for hidden neighbours; switch away and back.
7. **Focus**: select a table, F; only it and its neighbours are strong; relationships among them
   highlighted.
8. **Export**: SVG / PNG of a limited table and a collapsed schema group match the canvas.

Results go in `quickstart-results.md`; bench numbers in `bench-before.md` and `bench-after.md`.
