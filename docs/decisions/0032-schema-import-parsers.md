# 0032. Schema import parsers

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** `specs/044-db-import` (research R1–R5, R13)
- **Revises:** founder decision DB6 (`docs/backlog-database.md`)
- **Builds on:** 0029 (database pack model), 0031 (schema export)

## Context

DB6 chose one Apache-2.0 library for both DBML and SQL import, loaded lazily in a Web Worker,
with the dependency approval to be recorded by 044. Probing it during 044's plan showed:

- Its browser bundle is about 15.8 MB raw / 2.68 MB gzip: every dialect grammar is reachable from
  its parser entry, so nothing tree-shakes. That is above the PWA's 5 MB per-file precache limit
  (`apps/app/vite.config.ts`), so import would not work offline.
- It has no SQLite grammar, drops `ALTER TABLE … ADD COLUMN`, gives SQL objects no source
  positions, reports semantic errors at line 1 and aborts the whole parse on one dangling foreign
  key. A statement splitter with line numbers was needed anyway.

## Decision

Two runtime dependencies of `apps/app`, exact versions, both Apache-2.0, both loaded only inside
the import worker through dynamic `import()` (`db/import/load-parsers.ts` is the only module that
names them):

| Package           | Version | Used for                                   | Size (gzip, measured at build)                                 |
| ----------------- | ------- | ------------------------------------------ | -------------------------------------------------------------- |
| `@dbml/parse`     | 10.2.0  | DBML (`Compiler`, `parse.errors`, `rawDb`) | ~108 KB                                                        |
| `node-sql-parser` | 5.4.0   | SQL, one build per dialect                 | Postgres ~72 KB, MySQL ~67 KB, SQLite ~54 KB (one loaded only) |

Around them, code of our own:

1. **Statement splitter** (`split-sql.ts`): quotes, `$tag$` bodies, comments, MySQL `DELIMITER`
   and `COPY … FROM stdin` data. Each statement keeps its line; statements the deck does not
   model (views, functions, grants, data, session settings…) are classified and reported, never
   parsed. One failing statement is one report line, not a failed import (an unreadable
   `CREATE TABLE` or `CREATE TYPE` still blocks, because a table would be lost).
2. **Pre-pass** (`prepare-statement.ts`): column types are read from the source text and replaced
   by `text` before parsing, so user types, unusual spellings and dialect types the parser lacks
   never fail; `GENERATED ALWAYS AS IDENTITY` is read as `BY DEFAULT`; generated expressions are
   removed and reported; `::type` casts are stripped. The fixture corpus has a case per rewrite, so
   a parser upgrade that changes behaviour fails a test.
3. **Readers** turn the parser output into one neutral `RawSchema`, and one `buildPlan` maps it to
   a model fragment applied through `pasteFragment` (no model change).

## Consequences

- The editor's initial download does not change; each parser is a separate, precachable chunk
  fetched on the first import of that format or dialect, from the app's own origin.
- We maintain the splitter and the pre-pass (~500 lines with tests) instead of a grammar.
- Upgrading either package is a dependency change: re-run the import corpus and round-trip tests.
- The DBML compiler rejects two outputs of 045's writer (an enum without values, a relationship
  from a column to itself); the writer now leaves them out with an export note (R13).
- Relationships in the export are ordered by table, then in deck order (was: by id). Ids are
  random, so only deck order lets an imported file export again in the same order.
