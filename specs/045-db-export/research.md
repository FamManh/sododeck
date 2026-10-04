# Research: Schema Export (045)

Decisions for [plan.md](plan.md). Engine facts were checked against each engine's documentation;
Mermaid ER and DBML syntax against their current docs (2026-10-04). An established open-source
schema tool was reviewed for behaviour only, at the founder's request (spec Assumptions,
"Reference review"); nothing was copied and it is not named here (DB5, AGENTS.md).

## R1 — Where the writers live

- **Decision**: `apps/app/src/db/export/`, pure functions `(SododeckFile, SchemaExportRequest) →
SchemaExportResult`, with one shared intermediate (`SchemaSlice`, data-model §1).
- **Rationale**: export logic over the JSON snapshot, like 012's `json-export` and `render-svg`;
  `@sododeck/model` is the Yjs ↔ JSON layer and should not learn SQL. One slice means scope,
  stale-id handling, FK placement and notes are computed once and shared by four writers.
- **Alternatives**: writers in `@sododeck/model` (rejected: widens the model's job; 046 still
  needs app-side UI); a writer per format reading the deck directly (rejected: four copies of
  scope and reference resolution, notes would drift).

## R2 — Main thread, not a worker

- **Decision**: generate on the main thread after the dialog's existing 150 ms debounce; a perf
  test asserts < 50 ms per format for 150 tables / 1,800 columns / 250 relationships.
- **Rationale**: string building over ~2,000 items is linear and takes a few ms; a worker adds a
  message round-trip, a second bundle entry and snapshot cloning for no gain. ADR 0016 set the
  same budget for JSON / SVG export. Constitution V names layout, large imports and bulk
  validation as worker jobs; this is none of them.
- **Fallback**: if the perf test fails, wrap `schemaExport` in a worker client behind the same
  async `generate()` in `use-export-result.ts` (no API change).

## R3 — Generic deck: common type list (clarified Q1)

- **Decision**: a data table `common-types.ts` of canonical types with aliases (case-insensitive,
  whitespace-normalised) and a per-dialect equivalent. Only Generic decks use it; decks with a
  real dialect write types as stored. Unmapped types are written as stored and produce a note.

  | Canonical   | Aliases                               | Postgres           | MySQL       | SQLite    | Size kept           |
  | ----------- | ------------------------------------- | ------------------ | ----------- | --------- | ------------------- |
  | `int`       | integer, int4, mediumint              | `integer`          | `int`       | `integer` | no                  |
  | `smallint`  | int2, tinyint                         | `smallint`         | `smallint`  | `integer` | no                  |
  | `bigint`    | int8                                  | `bigint`           | `bigint`    | `integer` | no                  |
  | `decimal`   | numeric, dec                          | `numeric`          | `decimal`   | `numeric` | yes (p,s) PG, MySQL |
  | `real`      | float, float4                         | `real`             | `float`     | `real`    | no                  |
  | `double`    | double precision, float8              | `double precision` | `double`    | `real`    | no                  |
  | `char`      | character                             | `char`             | `char`      | `text`    | yes PG, MySQL       |
  | `varchar`   | character varying, string             | `varchar`          | `varchar`   | `text`    | yes PG, MySQL¹      |
  | `text`      | clob, longtext, mediumtext            | `text`             | `text`      | `text`    | no                  |
  | `boolean`   | bool                                  | `boolean`          | `boolean`   | `integer` | no                  |
  | `uuid`      | guid                                  | `uuid`             | `char(36)`  | `text`    | no                  |
  | `date`      |                                       | `date`             | `date`      | `text`    | no                  |
  | `time`      |                                       | `time`             | `time`      | `text`    | no                  |
  | `timestamp` | timestamptz, timestamp with time zone | `timestamptz`²     | `timestamp` | `text`    | no                  |
  | `datetime`  | timestamp without time zone           | `timestamp`        | `datetime`  | `text`    | no                  |
  | `json`      | jsonb                                 | `jsonb`            | `json`      | `text`    | no                  |
  | `blob`      | binary, varbinary, bytea, longblob    | `bytea`            | `blob`      | `blob`    | no                  |

  ¹ MySQL `varchar` needs a length: no size → `varchar(255)` and a note.
  ² `timestamp` / `timestamptz` → `timestamptz` (an instant is the safe default); the plain
  `datetime` row is the "local time" type.

- **Rationale**: matches the founder's answer; the reference tool uses a fixed list of ~26 types
  but silently replaces anything unmapped with a catch-all type, while Sododeck types are free
  text (040), so silent replacement would hide mistakes. SQLite equivalents use its five type
  affinities (integer, real, text, blob, numeric), which also keeps `STRICT` tables possible later.
- **Alternatives**: write as stored (founder chose translation); block until 043's dialect setting
  exists (043 not built).
- **Reuse**: 043's type conversion table (dialect change) starts from this list.

## R4 — Foreign-key placement and table order

- **Decision**:
  - Order tables by a stable topological sort (Kahn's algorithm; ties by schema, name, id) over
    "table A references table B" (self-references ignored).
  - **Postgres**: single-column FKs inline on the column (`REFERENCES t (c) ON DELETE …`, as frame
    145); composite FKs as a table constraint. FKs whose target is in a cycle (not yet created) are
    written after all tables as `ALTER TABLE … ADD FOREIGN KEY …`.
  - **MySQL**: always table-level `FOREIGN KEY (…) REFERENCES …` clauses, because InnoDB parses
    but **ignores** column-level `REFERENCES`; cycles as `ALTER TABLE … ADD FOREIGN KEY`.
  - **SQLite**: always inside the table (column-level for single, table-level for composite), in
    the same stable order; SQLite cannot `ALTER TABLE ADD CONSTRAINT` and does not check the
    referenced table at `CREATE TABLE` time, so cycles need nothing special (spec FR-009).
- **Rationale**: readable output in dependency order (frame 145) and a script that always runs.
  The reference tool puts every FK after all tables for Postgres / MySQL: always runs but hides
  the FK from the table definition; we keep that only for cycles.
- **Constraint names**: not generated (the engine names them); a relationship label is display
  text, not an identifier.

## R5 — Relationship → foreign key mapping (040 direction)

`cardinality` is read from → to (040). The FK holder and columns:

| Cardinality | FK on table         | FK columns    | References                                                                     |
| ----------- | ------------------- | ------------- | ------------------------------------------------------------------------------ |
| `n-1`       | from                | `fromColumns` | to.`toColumns`                                                                 |
| `1-n`       | to                  | `toColumns`   | from.`fromColumns`                                                             |
| `1-1`       | from                | `fromColumns` | to.`toColumns` (+ the FK columns are not made unique automatically; 047 lints) |
| absent      | from                | `fromColumns` | to.`toColumns` (042's drag default)                                            |
| `n-n`       | junction table (R6) | —             | —                                                                              |

Relationships with no column ends (plain table-to-table connectors) are not FKs: skipped in SQL
and DBML with a note; written in Mermaid (table-level line) and the dictionary.
Lists of different length → skipped in SQL / DBML with a note (040 allows them, 047 lints).

## R6 — n–n junction table

- **Decision**: name `<from table>_<to table>` (stored names, no singularising); columns
  `<referenced table>_<column>` for each column of each side, typed like the referenced column
  (after R3 translation); primary key of all columns; one FK to each side using the
  relationship's `onDelete` / `onUpdate` when set. Side columns default to that table's primary
  key when the relationship names none; a side without columns and without a primary key skips
  the relationship with a note. Name clash with a table in scope → suffix `_2`, `_3` and a note;
  self n–n → second side's columns get `_2` and a `self-junction` note.
- **Placement**: right after the later of the two tables in the order (frame 145 shows it with a
  `-- n-n products ↔ categories` comment).
- **Option off**: the relationship is skipped with a note (spec FR-011).
- **DBML / Mermaid**: n–n written natively (`<>`, `}o--o{`), never as a junction (spec US3).

## R7 — Enums per dialect

- Postgres: `CREATE TYPE [schema.]name AS ENUM ('a', 'b');` before the first table that uses it,
  enums used by tables in scope only; columns use the enum's (qualified) name.
- MySQL: column type `ENUM('a', 'b')` inline. SQLite: `text` plus `CHECK (col IN ('a', 'b'))`.
- "Include enums and indexes" off: no `CREATE TYPE` / `CREATE INDEX` statements; Postgres enum
  columns still name the type and one note says enum types are not created (MySQL / SQLite inline
  enums are unaffected).
- Empty enum: Postgres allows `AS ENUM ()`; MySQL / SQLite cannot express it → column as stored
  type fallback `text` with a note.
- Stale `enumRef`: the column is written with its stored `type` text and a note.

## R8 — Auto-increment

- Postgres: `GENERATED BY DEFAULT AS IDENTITY` on integer columns (identity is the current
  standard form; `serial` is legacy). On non-integer types: dropped with a note.
- MySQL: `AUTO_INCREMENT` (MySQL requires it to be a key; a non-key increment column gets a note
  but is still written, since it is a pk / unique in practice).
- SQLite: only a single-column integer primary key can auto-increment: written as
  `integer PRIMARY KEY AUTOINCREMENT`; anywhere else dropped with a note.

## R9 — Defaults and expressions

- `default` value: string → `'…'` with `'` doubled; number as is; boolean → `TRUE` / `FALSE`
  (Postgres, MySQL), `1` / `0` (SQLite).
- `defaultExpr`: Postgres as written; MySQL and SQLite wrapped in parentheses `(expr)` unless it
  is already parenthesised or one of `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME`, `NULL`
  (both engines require parentheses for expression defaults).
- Check expressions, index expressions and default expressions are user text: written verbatim,
  never parsed (046 / 047 may validate later).

## R10 — Identifiers and quoting

- Plain = matches `^[a-z_][a-z0-9_]*$` and is not a reserved word → unquoted. Anything else is
  quoted: Postgres / SQLite `"name"` (`"` doubled), MySQL `` `name` `` (`` ` `` doubled).
- Upper-case names are quoted in every dialect (Postgres folds unquoted names to lower case, so
  quoting is the only way to keep `UserId`; applying it everywhere keeps output uniform).
- `reserved-words.ts`: the union of the commonly reserved words of the three engines (≈ 150, e.g.
  `order`, `user`, `group`, `select`, `table`, `key`, `index`, `check`, `default`, `references`).
- DBML: quote with `"…"` when not `^[A-Za-z_][A-Za-z0-9_]*$`.
- Mermaid: entity and attribute names allow letters, digits, `-`, `_` (first a letter); others are
  replaced by `_` and the original kept (entity alias `id["original"]`; attribute comment).
  Types allow letters, digits, `-`, `_`, `(`, `)`, `[`, `]`: `decimal(10,2)` becomes
  `decimal(10-2)` with the original type in the comment. The `type?` nullable form is not used
  (needs a very recent renderer).

## R11 — Schemas

- Postgres: `CREATE SCHEMA IF NOT EXISTS s;` for each non-`public` schema used, first; names
  qualified `s.t`. Absent or `public` → unqualified.
- MySQL: a schema is a database: `CREATE DATABASE IF NOT EXISTS s;` first, names qualified
  `` `s`.`t` ``.
- SQLite: schema dropped, one note; if two tables then share a name, both are written and a note
  names the clash (047 reports duplicates).

## R12 — Indexes and checks

- Index name: stored name, or `<table>_<first part>_idx` (`_uniq` for unique; expression part →
  `expr`), made unique within the export with `_2`… (Postgres allows unnamed indexes, MySQL and
  SQLite do not; one rule for all three keeps output uniform).
- Postgres `CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON t [USING method] (a, (expr));`.
  MySQL `CREATE [UNIQUE] INDEX name ON t (a, (expr)) [USING BTREE|HASH];` (other methods dropped
  with a note; MySQL has no `IF NOT EXISTS` for indexes, so the option does not apply there).
  SQLite `CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON t (a, expr);` (method dropped with a note).
- Column check inline `CHECK (expr)`; table checks `[CONSTRAINT name] CHECK (expr)` after the
  columns.

## R13 — Notes (comments) per dialect

- Postgres: `COMMENT ON TABLE / COLUMN / TYPE … IS '…';` after the table (or enum).
- MySQL: column `COMMENT '…'`, table option `COMMENT='…'`; enum and index notes as `-- …` lines.
- SQLite: `-- …` lines above the table / column.
- Multi-line notes: SQL `--` comments one per line; string literals keep the line breaks.
- A note is documentation, not schema: writing it as a `--` comment is not a "change" note.

## R14 — DBML output

- `Project` block with `database_type` when the deck has a real dialect.
- `Enum [schema.]name { value [note: '…'] }`, `Table [schema.]name [note? via Note:] { … }`.
- Columns: `name type [pk, increment, not null, unique, default: …, note: '…']`; type with size
  `varchar(255)`; types with spaces quoted (`"double precision"`); enum columns name the enum.
  Default: string `'…'`, number / boolean bare, expression `` `expr` ``.
- Composite primary key: `indexes { (a, b) [pk] }` instead of `pk` on each column.
- Indexes: `(a, \`expr\`) [unique, type: hash, name: '…', note: '…']`; checks block
`` checks { `expr` [name: '…'] } ``; column checks also go to the checks block (DBML has no
  column-level check setting) — no information lost.
- Refs as standalone `Ref [name]: from.(a, b) OP to.(c, d) [delete: cascade, update: …]`, with
  OP `>` (n-1), `<` (1-n), `-` (1-1), `<>` (n-n), and **optional markers** `?` on the matching
  side (`?>` from optional, `>?` to optional; DBML's current syntax supports `?` on either side of
  every operator). The reference tool does not write optionality; DBML can, so nothing is lost.
- 044 must pin a parser version that reads `?` markers and `checks` (round-trip, SC-002).
- Notes with `'` escaped as `\'`; multi-line notes in `'''…'''`.

## R15 — Data dictionary layout

```text
# <Deck> · <scope> · <dialect>
## <schema.>table
<note>
| Column | Type | Key | Null | Default | Note |
Indexes: …   Checks: …   References outside this export: …
## Enums
## Relationships
- orders.customer_id → customers.id · many to one · on delete cascade · "places"
```

Cell text escapes `|` as `\|` and turns line breaks into `<br>`; Markdown punctuation is left as
typed (it renders, which is what a wiki reader expects; spec US4-5 "shown as typed").

## R16 — Test engines (clarified Q2)

- **Postgres**: `@electric-sql/pglite` (Apache-2.0, WASM Postgres 17, runs in Node; ~25 MB
  unpacked, dev only). Its engine is Postgres 17; the writer uses no feature newer than
  Postgres 12, so passing here also covers SC-001's Postgres 16. The test runs the script, then queries `information_schema` /
  `pg_catalog` for tables, columns, PK, FK, unique, indexes, enums.
- **SQLite**: `node:sqlite` (`DatabaseSync`, in Node ≥ 24; no package). `PRAGMA foreign_keys = ON`,
  run the script, check `sqlite_schema`, `pragma_table_info`, `pragma_foreign_key_list`,
  `pragma_index_list`.
- Both tests run with `// @vitest-environment node`, are imported by no app code, and stay out of
  the production bundle. Risk: Vitest / Vite resolving `node:sqlite` — if it is not externalised,
  load it with `createRequire(import.meta.url)('node:sqlite')`.
- **MySQL**: golden files only (no in-process MySQL exists); the quickstart has a manual check
  against a local MySQL 8.
- **Mermaid / Markdown**: golden files plus syntax-rule unit tests (R10 character rules); no
  renderer dependency; the quickstart renders both by hand (SC-007).
- **DBML round-trip**: added by 044 with the DB6 parser.

## R17 — Problems banner

- **Decision**: read `useProblems()`; keep problems whose kind starts with `db-` (today
  `db-dangling-reference`, `db-composite-mismatch` from 040; 047 adds more) and whose target
  touches a table in scope; banner "n errors in <scope>" with the first two details and
  "Show problems" (closes the dialog, `openFlyout('problems')`). "Block SQL export with errors"
  is not built (047 / 043); the banner never blocks in 045.
- **Rationale**: 015's problems store already runs in a worker; no new check is needed and 047
  plugs in by adding kinds.

## R18 — Dialog shape

- Formats split in two labelled groups ("Schema", "Image and data") inside the one radio group,
  matching frame 145; Schema hidden when the deck has no table.
- Schema formats use their own scope control (Selection / <card name> / Whole deck), separate from
  the image scope (Whole deck / Current view / Selected flow).
- SQL shows a dialect chip ("Postgres · deck dialect") or, on Generic, a select "Dialect" with
  Postgres, MySQL, SQLite (no default: the preview waits with "Choose a dialect to write SQL").
  The pick lasts while the dialog is open.
- SQL options use the dialog's existing `OptionSwitch` (frame 145 draws checkboxes; the built
  012 dialog uses switches for options, so the dialog stays consistent).
- Preview: line-numbered `<pre>` showing the first 400 lines (as 012's JSON preview) and a
  "… n more lines" footer; Copy / Download use the full text.
- Notes strip: "n export notes" with the first three items and "Show all".
