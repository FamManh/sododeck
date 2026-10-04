# 0031. Schema export: pure writers over one slice, on the main thread

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/045-db-export` (research R1–R18)
- **Builds on:** 0016 (export dialog and rendering budget), 0029 (database pack model), 0030
  (table card)

## Context

045 writes the deck's database schema as SQL DDL (Postgres, MySQL, SQLite), DBML, Mermaid
`erDiagram` and a Markdown data dictionary, for the selection, one database card or the whole
deck. Four formats share the same hard parts: which tables are in scope, resolving column,
index, enum and relationship references by id (some stale, which 040 keeps), where a foreign
key goes, n–n junction tables, and saying what had to be skipped or changed. Column types are
free text (040); a Generic deck has no dialect at all.

## Decision

1. **Writers live in `apps/app/src/db/export/`** as pure functions of the `SododeckFile`
   snapshot and a request: no React, DOM, Yjs or `editor/` imports. `@sododeck/model` stays the
   Yjs ↔ JSON layer. 046 (DBML panel) and 049 (export from a database card) call
   `schemaExport` from the same place.
2. **One schema slice.** `buildSchemaSlice` resolves the scope, every reference by id,
   foreign-key placement (cardinality read from → to), junction tables, the stable table order
   (schema, name, id) and the SQL dependency order (Kahn; a cycle is broken at its first table
   and its foreign keys into the cycle are deferred), and the notes. Writers never re-resolve
   ids.
3. **Notes instead of silent drops.** Every skip or change is an `ExportNote` (20 kinds, list
   order fixed), shown in the dialog's notes strip and, in SQL and DBML, as a comment above the
   table it concerns. The edge-case fixture pins the kinds each format must report.
4. **Main thread.** Generation runs after the dialog's 150 ms debounce, like JSON and SVG. A
   perf test holds each format under 50 ms for 150 tables / 1,800 columns / 250 relationships
   (measured 2–5 ms in Node). If it ever fails, `schemaExport` moves into a worker behind the
   same `generate()` call.
5. **Generic decks translate a common type list.** About 17 canonical types with aliases map to
   each dialect (e.g. `uuid` → `char(36)` on MySQL, `text` on SQLite); anything else is written
   as stored and noted, never replaced. Decks with a real dialect write types as stored. MySQL
   `varchar` without a length gets 255, with a note.
6. **Foreign-key placement per dialect.** Postgres writes single-column keys inline and
   composite ones as table constraints; MySQL always writes table-level `FOREIGN KEY` clauses
   because InnoDB parses column-level `REFERENCES` but ignores it; SQLite writes every key inside
   its table, since it cannot add one later and does not check the referenced table at creation.
   Cycles: `ALTER TABLE … ADD FOREIGN KEY` after all tables on Postgres and MySQL.
7. **n–n is a junction table in SQL only** (`<from>_<to>`, columns `<table>_<column>`, composite
   key, one foreign key per side; `_2` on a name clash or for the second side of a self n–n);
   DBML (`<>`) and Mermaid (`}o--o{`) write it natively.
8. **Auto-increment needs care per engine.** Postgres: identity on integer types. MySQL:
   `AUTO_INCREMENT` only on a key column (otherwise MySQL refuses the table), dropped with a
   note elsewhere. SQLite: only a single integer primary key, written `integer PRIMARY KEY
AUTOINCREMENT`.
9. **Test engines.** Golden files (`__golden__/`) for every format and dialect on the "Shop"
   and edge-case decks. The Postgres script runs on PGlite (dev dependency, Apache-2.0, 0 bytes
   in the app) and the SQLite script on Node's built-in `node:sqlite`; the tests read the
   catalogs back. MySQL is checked by golden file and one manual run.
10. **DBML writes optional sides** with `?` on either side of the operator and table and column
    checks in a `checks` block. 044 must pin a DBML parser version that reads both, and adds the
    round-trip test using this writer.

## Alternatives rejected

- Writers in `@sododeck/model`: widens the model's job to SQL.
- One writer per format reading the deck: four copies of scope and reference resolution, and
  notes that drift apart.
- Every foreign key after all tables: always runs, but hides keys from the table definition.
- Replacing unmapped types with a catch-all type: hides mistakes in free-text types.
- A worker: a message round-trip, a second bundle entry and snapshot cloning for a few ms of
  string building.

## Consequences

- 043's dialect conversion starts from `common-types.ts`; 047's lint kinds reach the dialog's
  problems banner with no change (`db-*` kinds touching tables in scope).
- A schema download is not a backup: only JSON marks the deck as exported.
