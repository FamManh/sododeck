# Quickstart results (044)

Run on 2026-10-04, macOS, Node 24, branch `FamManh/feat-db-import` after merging `main` (043).

## Automated

| Check                              | Result                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `pnpm lint`                        | clean (one warning, `canvas.tsx` `liplessSelector`, already on `main`) |
| `pnpm typecheck`                   | clean                                                                  |
| `pnpm test`                        | schema 326, site 61, model 974, app 3,723 tests passed                 |
| `pnpm build`                       | ok                                                                     |
| `pnpm e2e`                         | 4 passed (incl. no third-party requests)                               |
| Corpus (`import.corpus.test.ts`)   | 9 files match expected plans; no silent drop (SC-005)                  |
| 30-table dump (SC-001)             | 30 tables, 35 relationships, 2 enums; no overlaps                      |
| `CREATE VIEW` at its line (SC-002) | L261 listed as "views are not modelled"                                |
| DBML round-trip with 045 (SC-003)  | same schema by name; byte-identical DBML                               |
| Undo (SC-009)                      | one `undo()` restores the deck exactly                                 |
| `no-fk.sql` suggestions (SC-010)   | exactly the 4 expected links                                           |

The two `packages/model` timing tests (`fitGroupFrames` 2,000 nodes, tag delete on 500 cards)
failed once while the dev server and the other packages' tests ran at the same time; run on their
own they pass. 044 changes nothing in `packages/model`.

## Performance (SC-006, Node, parser already loaded)

| Input                         | Plan time |
| ----------------------------- | --------- |
| SQL, 300 tables × 12 columns  | 73 ms     |
| DBML, 300 tables × 12 columns | 117 ms    |

## Bundle (R16, SC-007), `pnpm --filter @sododeck/app build`

| Chunk                       | `main` (043 merged)        | 044                        | Note                                           |
| --------------------------- | -------------------------- | -------------------------- | ---------------------------------------------- |
| Entry `index-*.js`          | 484.21 KB / 152.12 KB gzip | 472.65 KB / 147.80 KB gzip | no growth (chunking moved shared code)         |
| `editor-page-*.js`          | 114.38 KB / 34.50 KB gzip  | 122.87 KB / 36.78 KB gzip  | +2.3 KB gzip: menu items, report flyout, store |
| `import-dialog-*.js` (lazy) | —                          | 29.15 KB / 10.92 KB gzip   | loaded when the dialog opens                   |
| `import.worker-*.js` (lazy) | —                          | 223 KB                     | pipeline, in the worker                        |
| `dbml-parse-*.js` (lazy)    | —                          | 440 KB / 109 KB gzip       | DBML only                                      |
| `postgresql-*.js` (lazy)    | —                          | 294 KB / 58 KB gzip        | one SQL build per import                       |
| `mysql-*.js` (lazy)         | —                          | 263 KB / 53 KB gzip        |                                                |
| `sqlite-*.js` (lazy)        | —                          | 196 KB / 41 KB gzip        |                                                |

Each parser chunk is emitted twice (worker graph and the inline fallback's graph), so the PWA
precache grows from 9.4 MB to 12.1 MB; every file stays under the 5 MB precache limit.

## Manual (`pnpm dev`)

1. New deck → empty canvas "Import SQL or DBML" → paste `pg-30-tables.sql`: preview "30 tables,
   35 relationships, 2 enums · 17 statements will be skipped", "Auto · Postgres detected". Import:
   laid out without overlaps, report open, toast with Undo; ⌘Z removes everything. ✅
2. MySQL deck → paste the Postgres dump: notice "This deck is MySQL: n column types will be
   converted" with the first conversions and "A new deck keeps Postgres." ✅
3. Database card target: covered by component and apply tests (not clicked by hand).
4. `no-fk.sql`: 4 suggestions; Accept all adds 4 relationships and shows "Added". ✅
5. DBML round-trip: covered by `dbml-round-trip.test.ts`.
6. Network: covered by the e2e no-third-party check; parsers are same-origin chunks.
7. Bundle numbers: above.

Screenshots: `screenshots/` (dialog dark, dialog with dialect notice light, imported deck with
report dark and light, 30-table import dark).
