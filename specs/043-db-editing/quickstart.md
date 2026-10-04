# Quickstart: Schema Editing on the Canvas (043)

Validation guide. The contracts are in [contracts/](contracts/); the decisions are in [research.md](research.md).

## Prerequisites

- 040, 041, 042 and 045 are on `main`.
- `pnpm install`.
- `pnpm dev`, then open the app on :5173 with a deck that has the "Shop" schema (bench generator `?tables=11` or the 045 fixture).

## Automated checks

```bash
pnpm --filter @sododeck/schema test     # locked: parity, invalid fixtures
pnpm --filter @sododeck/model test      # setLocked, round-trip, paste (external, enums, names, ids)
pnpm --filter @sododeck/app test        # column-line, editor, keys, menus, lock, mismatch, clipboard
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e
pnpm bench                              # before and after, 150 tables
```

| Area                                                    | Test proves                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `column-line.test.ts`                                   | Every row of the contract's example table. `parse(format(c))` holds for every column of the Shop and export edge-case fixtures. A 200-character line parses in < 1 ms. |
| `column-line-editor.test.tsx`                           | Chips appear while typing. ⏎ adds and opens the next row. Esc cancels. Tab moves the caret to the type. "taken" and "empty" messages show. One ⌘Z per save.            |
| `table-body.test.tsx`                                   | Row grip and reorder drop index. The (!) icon has an accessible name. Locked rows have no grip.                                                                        |
| `use-canvas-shortcuts.test.ts`                          | The R5 key map. C and R moved. T and G work. ⇧⌘L locks. Keys are ignored in text fields.                                                                               |
| `table-actions.test.ts`, `relationship-actions.test.ts` | Each menu item is one undo step. Checks show the current state. Optional flags write `true` / `null`.                                                                  |
| `lock.test.ts` (app)                                    | Locked cards: no drag, nudge, resize, title edit, line edit or delete. "Skipped n locked". Connect to a row still works.                                               |
| `paste.test.ts` (model)                                 | Outgoing foreign keys kept on duplicate. Incoming ones never copied. Cross-deck drops counted. Enum linked or copied. `_copy` names. 0 shared ids for 20 tables.       |
| `view-state.test.ts`                                    | The row-edit override shows All. The stored `detail` is unchanged.                                                                                                     |

## Manual walkthrough (frames 160, 149, 136, 168; light and dark)

1. Press **T** on an empty canvas. `table_1` appears with `id integer` (key glyph) and the title in edit mode. Type `orders` and press ⏎.
2. Press **C**. Type `email text unique not null` and watch the chips (name, type, unique, not null). Press ⏎. The column is added and a new row opens. Press Esc.
3. Type `status order_status not null default 'pending'` (with the enum present). The type chip is the enum chip.
4. Press **↓** to enter the rows. Press ⌥↑ on `status`. Press **F2** on `email`, rename it to `email_address`, and press ⏎. Its relationship and index stay.
5. Set the table to Keys, then press ↓. The table shows All. Press Esc. It is back at Keys, and the deck JSON is unchanged.
6. Press ⌫ on a column with a relationship. The toast reads "Deleted column … · 1 relationship removed". Click Undo and everything returns.
7. Change `customers.id` to `uuid` while `loyalty_points.customer_ref` is `int`. Both rows show (!) with "int → uuid". Nothing else changes.
8. Right-click a relationship and set Cardinality to 1–n and On delete to Cascade. The ends redraw, and one ⌘Z each undoes them.
9. Press ⌘D on `customers`. `customers_copy` appears with its title selected and its outgoing foreign keys kept. Copy `orders`, then paste it into another deck. The toast reads "Pasted orders · n relationships dropped".
10. Press ⇧⌘L on `payments`. The lock badge shows. Drag, C, F2 and ⌫ do nothing (tooltip). A relationship drawn onto its row is created. Press ⇧⌘L again to unlock.
11. Open the Add flyout, Database tab. You see Table T, Note S and Table group G. In Packs, Database reads "Table, note, table group".
12. Marquee-select 3 tables and set Colour to Teal. One ⌘Z restores all three.

Record the bench numbers in `bench-before.md` and `bench-after.md`.
