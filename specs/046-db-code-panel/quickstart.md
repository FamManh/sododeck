# Quickstart: Schema Code Panel (DBML)

Validation guide for `046-db-code-panel`. Contracts: [schema-sync](contracts/schema-sync.md),
[code-panel-ui](contracts/code-panel-ui.md).

## Prerequisites

```bash
pnpm install
pnpm dev            # app on :5173
```

Open the "Shop" fixture deck (import `apps/app/src/db/fixtures/shop.ts` output, or the 044
corpus `shop.dbml` through File → Import), then open the code panel and pick **DBML**.

## Automated checks

```bash
pnpm --filter @sododeck/model test      # batch merge key
pnpm --filter @sododeck/app test -- db/sync editor/code state/json-panel-prefs
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Key suites: `db/sync/plan-schema-sync.test.ts` (matching, validation, SC-004 round trip over the
corpus), `db/sync/plan-schema-sync.perf.test.ts` (150 tables), `db/sync/apply-schema-plan.test.ts`
(ids kept, one merged undo step), `editor/code/dbml-tab.test.tsx` (states, markers, toast).

## Manual scenarios

| #   | Do                                                                         | Expect                                                                                    |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Whole schema: add `discount_cents int [not null]` in `orders`, stop typing | Column on the card within 1 s; pill "Applied"                                             |
| 2   | Rename `Table customers` → `Table clients`                                 | Same card renamed in place; position, colour, relationships kept                          |
| 3   | Type `total_cents int [not nul]`                                           | Inline error with "did you mean not null?"; "Can't apply: fix 1 error"; canvas unchanged  |
| 4   | Type a column name letter by letter, pause 3 s, ⌘Z                         | One ⌘Z removes the whole column                                                           |
| 5   | Delete `Table shipments { … }`                                             | Table and its relationships gone; toast "Removed shipments · Undo"                        |
| 6   | Cut the `orders` block, wait 2 s, paste it back                            | `orders` returns at its old position with its relationships                               |
| 7   | Select `orders` + `order_items`, Selection, delete the `order_items` block | Only `order_items` removed; other tables untouched                                        |
| 8   | With DBML open and no edits, rename a column on the canvas                 | Text updates; cursor stays                                                                |
| 9   | Open the deck in two browser tabs; edit DBML in one                        | Other tab's canvas follows                                                                |
| 10  | Select all text, delete                                                    | "This removes all n tables" + Apply; nothing removed until Apply                          |
| 11  | Add `TableGroup g { orders }`                                              | Warning on that line; rest applies                                                        |
| 12  | SQL tab on Shop (Postgres) and on a Generic deck                           | Same SQL as export; Generic shows the Preview dialect select; typing refused with message |
| 13  | Reload, open the panel on JSON; check network tab while using DBML         | Parser chunk loads only on first DBML open; no third-party requests                       |

Record results in `quickstart-results.md` with screenshots of scenarios 1, 3, 5, 10 and 12.
