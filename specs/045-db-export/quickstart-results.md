# Quickstart results: Schema Export (045)

Run 2026-10-04 on the `feat-schema-export` branch, Chrome, `vite` dev server.

## Automated

- `src/db` (writers, slice, golden files, SC-006 notes): 122 tests green.
- `sql-writer.engine.test.ts`: the Shop Postgres script runs on PGlite (Postgres 17) and the
  catalog holds all 14 tables, 58 columns, 13 primary keys, 16 foreign keys with their actions,
  the unique and check constraints, 3 indexes (one expression) and the `order_status` enum. The
  SQLite script runs on `node:sqlite` with `PRAGMA foreign_keys = ON`; the enum check and the
  foreign keys refuse bad rows. The edge-case deck runs on both (Generic → each dialect).
- `schema-export.perf.test.ts` (150 tables, 1,800 columns, ≥ 250 relationships), median of 5:
  SQL Postgres 4.5 ms, MySQL 2.8 ms, SQLite 2.5 ms, DBML 2.0 ms, Mermaid ER 1.8 ms, dictionary
  2.2 ms (budget 50 ms). No worker needed.
- Dialog: 40 component tests (incl. keyboard path, no deck change, problems banner).

## Manual

1. **Shop deck, Export → SQL**: the Schema group shows above Image and data; the chip reads
   "Postgres · deck dialect". ✅
2. **Orders DB card selected → Export**: scope opens on "Orders DB", preview holds only its 11
   tables; footer `shop-orders-db.sql`. Deck menu → Export… → SQL → Download = 4 clicks (SC-003). ✅
   (Drill-in default is covered by a component test.)
3. **Selection scope / out-of-scope FK**: covered by component and writer tests (notes strip and
   `-- … not written` comment). ✅
4. **Generic deck**: SQL asks for a dialect ("Choose a dialect to write SQL", Copy / Download
   disabled); picking MySQL writes `uuid` as `char(36)`. ✅ (`money` note: edge-case tests.)
5. **Options**: each switch changes the text (component and writer tests). ✅
6. **DBML / Mermaid ER / Data dictionary**: previews and file names (`shop-orders-db.dbml`,
   `.mmd`, `-dictionary.md`) correct. Rendering the Mermaid and Markdown in an offline renderer
   was **not** done (no renderer installed); the Mermaid output is checked against the syntax
   character rules in tests.
7. **MySQL 8 (SC-001)**: `shop.mysql.sql` golden run on **MySQL 8.4.11** (Docker,
   `mysql:8.4`): exit 0; 14 tables, 58 columns, 16 foreign keys, 3 indexes. A second run fails
   with "Table 'audit_log' already exists" (expected without IF NOT EXISTS). The edge-case
   MySQL script stops at `money` (the noted unmapped type), as designed. The Postgres golden
   also ran on **Postgres 16.15** (Docker) with `ON_ERROR_STOP`: exit 0, 14 tables.
8. **Light and dark** vs frame 145: same structure (Schema / Image and data groups, scope
   segments with the card name, dialect chip, clay banner with Show problems, line-numbered
   preview). Screenshots in `screenshots/`. Deviations, both by decision: switches instead of
   checkboxes for SQL options (research R18), DBML subtitle "Database markup" (§g-88). Fixed
   during the run: scope labels wrapped onto two lines next to the dialect chip.
9. **Network**: no request recorded while switching between the four schema formats and
   copying (SC-008); the e2e no-third-party check passes.

Banner check (Shop deck with a stale `enumRef`): "1 error in the deck" with the detail; Show
problems closes the dialog and opens the Problems flyout. ✅
