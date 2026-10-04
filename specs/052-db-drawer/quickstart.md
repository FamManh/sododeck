# Quickstart: Database Details Drawer (052)

Validation guide. Contracts are in [contracts/](contracts/), decisions in [research.md](research.md), fields in [data-model.md](data-model.md).

## Prerequisites

- 040–046 are on `main`.
- `pnpm install`.
- `pnpm dev`, then open the app on :5173 with the "Shop" schema (Postgres; import `apps/app/src/db/fixtures` Shop via Import, or the bench generator `?tables=11`).

## Automated checks

```bash
pnpm --filter @sododeck/schema test     # blockSqlExport: parity, invalid `false`
pnpm --filter @sododeck/model test      # setBlockSqlExport, round-trip
pnpm --filter @sododeck/app test        # dialect data, plan, enum edits, drawer components
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e
```

| Area                                          | Test proves                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dialect-types.test.ts`                       | Every `COMMON_TYPES` spelling is in its dialect's list. `typeEntry` matches aliases and case. SQLite has no index methods.                                               |
| `dialect-change.test.ts`                      | The contract's example table. Enum columns skipped. Unmapped types kept. `serial` gets `increment`. Every pair of the 4 dialects on Shop. 1,800 columns plan in < 50 ms. |
| `apply-dialect-change.test.ts`                | Dialect and types change in one batch; one `undo()` restores both (SC-003). Toast text for changes and for none.                                                         |
| `enum-edits.test.ts`                          | Rename enum rewrites linked column types; rename value rewrites matching defaults; each one undo step. Delete keeps type text.                                           |
| `use-live-field.test.tsx`                     | `validate`: no write while invalid, message shown, revert on blur; existing behaviour unchanged.                                                                         |
| `table-inspector.test.tsx`                    | Open details → General. Tabs by keyboard. Name taken message. Locked table is read-only with Unlock.                                                                     |
| `columns-tab.test.tsx`                        | Type pick, size / scale by type, enum pick and "No enum", Value / Expression default, add / delete / move, one undo per change.                                          |
| `indexes-tab.test.tsx`, `checks-tab.test.tsx` | Column and expression chips, method list per dialect (hidden on SQLite), add / delete.                                                                                   |
| `relationship-inspector.test.tsx`             | Pairs add / remove / reorder, length warning, last pair confirm, n–n hint, on update "Not set" removes the key, name = label.                                            |
| `enum-inspector.test.tsx`                     | Values add / rename / note / reorder / delete; used-by opens the table on the column; delete confirm counts columns.                                                     |
| `database-section.test.tsx`                   | Dialect select with hints, confirm dialog rows and "+ n more", cancel changes nothing, block switch writes `true` / removes.                                             |
| `export-dialog.test.tsx`                      | With the flag and an in-scope error, SQL Copy / Download disabled; out-of-scope error or DBML not blocked.                                                               |
| `palette.test.tsx`, canvas menu               | Enum tile and "Add enum" create `enum_1` and open the editor.                                                                                                            |

## Manual walkthrough (light and dark)

1. Select `orders`, press ⏎. The drawer opens on **General** (frame 164 left). Change the schema to `sales`, set Teal, write a note. Each ⌘Z undoes one change.
2. Open **Columns**. Expand `total`, pick `numeric`, set 10 and 2, not null, default Value `0`. The card shows `numeric(10,2)`.
3. Expand `status`, open the type picker: "Enums in this deck" first, then Postgres groups (frame 164 middle). Pick `order_status`; the card shows the enum chip.
4. Type `citext` as a type: it is saved and marked "Not in the Postgres list".
5. Right-click a column row on the canvas, pick **Edit details**: the drawer opens on that row.
6. **Indexes**: add an index on `customer_id` and `created_at`, unique, method `btree`, name it. The footer count goes up. Add an expression part `lower(email)` on `customers`.
7. **Checks**: add `total_non_negative` / `total >= 0`. Open Export › SQL: the index and check are in the DDL.
8. Select the `order_items → products` relationship, Open details (frame 164 bottom). Rename it, set On delete Cascade, add a second pair, then remove it. Remove the last pair: the confirm appears; Cancel.
9. Add flyout › Database › **Enum**. `enum_1` opens with its name selected. Name it `payment_status`, add four values, note one, drag one. Link it to `payments.status`; hover the chip: the popover matches. Rename a value used as a default: the default follows.
10. Rename `payment_status` to `payment_state`: the column's type text follows. ⌘Z restores both.
11. ≡ › Deck settings › **Database** (frame 152). Pick MySQL: the confirm lists conversions (frame 153). Cancel: nothing changes. Pick MySQL again and confirm: types change and the toast reads "Converted n columns to MySQL · Undo" (frame 154). Click Undo: Postgres and every type are back.
12. Turn on **Block SQL export with errors**. Make a dangling reference (delete a referenced column's table in another tab, or import the edge-case fixture). Export › SQL: Copy and Download are disabled; DBML still exports.
13. Lock `payments` (⇧⌘L) and open its drawer: read-only with Unlock.
