# Quickstart: validating Schema Export (045)

## Prerequisites

- `pnpm install` (adds the dev-only `@electric-sql/pglite`), Node ≥ 24 (`node:sqlite`).
- Fixtures: `apps/app/src/db/fixtures/shop.ts`, `export-edge-cases.ts` (see
  [data-model.md](data-model.md) §3 for the cases they must hit).

## Automated

```bash
pnpm --filter @sododeck/app test -- src/db/export          # writers, slice, golden files
pnpm --filter @sododeck/app test -- sql-writer.engine      # Postgres (PGlite) + SQLite execution
pnpm --filter @sododeck/app test -- schema-export.perf     # 150 tables < 50 ms per format
pnpm --filter @sododeck/app test -- src/editor/export      # dialog reducer + component tests
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

Expected: all green; the engine test lists every Shop table, column, PK, FK (with actions),
unique, index and enum after running the script (SC-001); golden files unchanged on a second run
(SC-005); the edge-case deck produces exactly the notes listed in its fixture (SC-006).

## Manual (app, `pnpm dev`)

1. Load the Shop fixture deck (Postgres). ≡ → Export…: the **Schema** group shows above
   **Image and data**; SQL selected shows "Postgres · deck dialect".
2. Drill into Orders DB, open Export: scope reads "Orders DB" and the preview holds only its
   tables; Download gives `shop-orders-db.sql` (≤ 4 clicks from opening Export, SC-003).
3. Select three tables → scope Selection; a foreign key to an unselected table shows in the
   notes strip and as a `--` comment.
4. Set a deck to Generic (JSON panel or 043 when built) → SQL asks for a dialect; pick MySQL:
   `uuid` columns become `char(36)`; a `money` column stays and is noted.
5. Toggle each option and check the text changes (no junction table; `IF NOT EXISTS`; no
   `CREATE INDEX` / `CREATE TYPE`).
6. DBML / Mermaid ER / Data dictionary: Copy, paste into a Mermaid renderer and a Markdown
   viewer offline (SC-007); the DBML shows `?` optional markers and `<>` for n–n.
7. MySQL (manual, **required** for SC-001): run the MySQL export of Shop on a local MySQL 8 — no errors; record the MySQL version in `quickstart-results.md`.
8. Dark theme: compare with frame 145 dark.
9. Network tab: no request while exporting (SC-008).
