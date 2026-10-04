# Quickstart: Schema Lint (047)

Validation guide. Contracts in [contracts/](contracts/), decisions in [research.md](research.md).

## Prerequisites

- 015 and 040–046, 052 on `main`.
- `pnpm install`, `pnpm dev`, open the app on :5173 with the "Shop" schema (Postgres).

## Automated checks

```bash
pnpm --filter @sododeck/model test      # severity, every rule, keys, sort, db-types, perf
pnpm --filter @sododeck/app test        # marks, panel, popover, fixes, junction, export
pnpm lint && pnpm typecheck && pnpm build && pnpm e2e
BENCH_TABLES=150 BENCH_REL=1 pnpm bench # before and after (canvas marks change)
```

| Area                                        | Test proves                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `problems.test.ts` (model)                  | Each rule: one problem per broken object, severity, title, key, row, fixes; none on clean Shop (SC-001); no follow-on problems on a dangling relationship; errors sorted first; counts. |
| `db-types.test.ts` (model)                  | Moved data unchanged; `sameColumnType`: `int`/`integer` equal, `timestamptz`/`timestamp` differ on Postgres, sizes, enums.                                                              |
| `perf.test.ts` (model)                      | `checkDeck` on the 150-table schema within `CHECK_DECK_BUDGET_MS`.                                                                                                                      |
| `problem-marks.test.ts`                     | Worst severity, rows map, `short`; cache equality.                                                                                                                                      |
| `problems-panel.test.tsx`                   | Filter counts and filtering; severity icons labelled; fix buttons apply and announce; locked fix disabled.                                                                              |
| `apply-fix.test.ts`                         | Every write fix is one `undo()`; navigation fixes open the right drawer or editor.                                                                                                      |
| `junction-table.test.ts`                    | Name and free name, columns, pk, two n–1 relationships, n–n removed, one undo.                                                                                                          |
| `go-to-problem.test.ts`                     | Row focus, reveal at All without writes, popover opens, ⌘. visits errors first.                                                                                                         |
| `table-body.test.tsx`, `deck-edge.test.tsx` | Row glyph replaces key glyph; dashed relationship with `short`.                                                                                                                         |
| `export-dialog.test.tsx`                    | Banner counts; block counts errors only (warning-only deck exports).                                                                                                                    |

## Manual walkthrough (frames 144, 161, 167; light and dark)

1. Delete `payments.id`. The rail badge stays amber and goes up by one; `payments` shows a warning badge; the list reads "payments has no primary key" (warning).
2. Click it: the canvas pans to `payments`, the popover offers "Add id uuid PK". Apply; the problem goes; ⌘Z brings it back.
3. Set `loyalty_points.customer_ref` to `int` while `customers.id` is `uuid`. The row shows the error glyph in place of its link glyph, the relationship is dashed with `int → uuid`, the badge turns clay. "Change type" fixes it.
4. Draw an n–n between `products` and `categories`: warning with `n–n`. "Create junction table" adds `products_categories` between them with two relationships; one ⌘Z removes it all.
5. Import a MySQL deck with three `citext` columns: one warning "citext is not a MySQL type · 3 columns".
6. Filter Errors / Warnings; counts match.
7. Set Detail to Keys on a table with a problem on a non-key row, go to the problem: the table shows All for the visit; deselect returns to Keys.
8. Turn on Block SQL export (052) with only warnings: SQL exports. Add an error: Copy and Download disable; the banner shows both counts.
9. Lock a table with a problem: its fix buttons are disabled with "Locked · unlock to fix".
