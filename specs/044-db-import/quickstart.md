# Quickstart: validate Schema Import (044)

Prerequisites: `pnpm install`; Node ≥ 24. Fixtures: `apps/app/src/db/fixtures/import/` (research
R12). Contracts: [import-pipeline](contracts/import-pipeline.md),
[import-dialog-ui](contracts/import-dialog-ui.md).

## Automated

```bash
pnpm --filter @sododeck/app test -- src/db/import      # splitter, detector, readers, plan, suggestions, perf
pnpm --filter @sododeck/app test -- src/db/export      # 045 writers incl. R13 fixes
pnpm --filter @sododeck/app test -- src/editor/import  # dialog + report component tests
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected:

| Check                                   | Proves                                     |
| --------------------------------------- | ------------------------------------------ |
| `pg-30-tables.sql` plan test            | SC-001: 30 tables, every FK, column ends   |
| layout test on the same plan            | SC-001: no overlapping rectangles          |
| `CREATE VIEW` row in the report test    | SC-002                                     |
| DBML round-trip test (`shopDeck()`)     | SC-003 (and 045 SC-002)                    |
| corpus "no silent drop" test            | SC-005: every statement mapped or reported |
| perf test, 300 tables / 3,600 columns   | SC-006 (plan < 3 s in Node)                |
| undo test (`applyImport` then `undo()`) | SC-009                                     |
| `no-fk.sql` suggestions test            | SC-010                                     |
| e2e smoke (no third-party requests)     | SC-008                                     |

## Manual (dev server, `pnpm dev`, app on :5173)

1. New deck → empty-canvas card **Import SQL or DBML** → File → drop `pg-30-tables.sql`. Preview
   reads "30 tables, … · n statements will be skipped", select reads "Auto · Postgres detected".
   Import. Tables laid out, none overlapping; deck dialect chip / settings show Postgres; toast
   with Undo; report lists the view, function, grants and `COPY` with lines. ⌘Z removes all.
2. Postgres deck → import `mysql-dump.sql`: notice "This deck is Postgres: n column types will be
   converted"; after import, report "Changed" lists them.
3. Drill into a database card → open Import from the ≡ menu: target "Import into <card>"; imported
   tables sit inside the card.
4. Import `no-fk.sql`: report shows suggestions; hover one → both column rows highlight; Accept →
   relationship drawn; Undo → back to a suggestion.
5. Paste 045's DBML export of "Shop" into a new deck: same schema; export DBML again → same text.
6. DevTools Network while importing: only same-origin chunk loads (worker, parser), no other
   request. Offline (DevTools) after one use: import still works.
7. Record bundle numbers (R16): entry chunk delta and lazy chunk sizes, in the PR report.

Screenshots of the dialog, the report and the result go in `specs/044-db-import/screenshots/`.
