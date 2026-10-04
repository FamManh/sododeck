# Data Model: Schema Export (045)

No change to the deck file or the Yjs document. Everything below is in-memory, built from the
`SododeckFile` snapshot (040 fields) or held in the export dialog's reducer while it is open.

## 1. SchemaSlice (the shared intermediate)

Built once per request by `buildSchemaSlice(deck, request)`; every writer reads only this.

| Field           | Type                  | Notes                                                                                           |
| --------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `deckName`      | string                | `deck.name ?? 'Untitled deck'`                                                                  |
| `scopeLabel`    | string                | "Selection", the database card's title, or "Whole deck"                                         |
| `dialect`       | `Dialect`             | the deck's (`deckDialect`) or, for SQL on Generic, the picked one; `generic` for other formats  |
| `tables`        | `SliceTable[]`        | in scope, stable order: schema, name, id (FR-017); read by DBML, Mermaid, dictionary            |
| `sqlOrder`      | `Id[]`                | the same tables in **dependency order** (research R4); ties: schema, name, id; read by SQL only |
| `enums`         | `SliceEnum[]`         | enums referenced by a column in scope, in deck order                                            |
| `relationships` | `SliceRelationship[]` | edges whose both ends are tables in scope (out-of-scope ends → `notes`)                         |
| `deferredFks`   | `SliceForeignKey[]`   | FKs written after all tables (Postgres / MySQL cycles only)                                     |
| `notes`         | `ExportNote[]`        | collected while resolving (§3); writers may append format-specific notes                        |

### SliceTable

| Field         | Type                | Notes                                                                                   |
| ------------- | ------------------- | --------------------------------------------------------------------------------------- |
| `id`          | Id                  | node id                                                                                 |
| `name`        | string              | node title (the table name); empty → `table_<n>` with a note                            |
| `schema`      | string \| null      | `null` for absent or `public`                                                           |
| `note`        | string \| null      |                                                                                         |
| `columns`     | `SliceColumn[]`     | stored order                                                                            |
| `primaryKey`  | `Id[]`              | columns with `pk`, stored order                                                         |
| `indexes`     | `SliceIndex[]`      | parts resolved; stale column parts dropped with a note; index with no part left skipped |
| `checks`      | `{ name?, expr }[]` | table checks                                                                            |
| `foreignKeys` | `SliceForeignKey[]` | FKs this table holds and writes inline (R4, R5)                                         |
| `junction`    | boolean             | `true` for a generated n–n table (R6)                                                   |

### SliceColumn

`{ id, name, type: SliceType, notNull, unique, increment, default?: DefaultValue, check?, note?,
enum?: SliceEnum }` where `SliceType = { stored: string; size?: string; written: string }`
(`written` is the dialect form after R3 translation; equal to `stored` + size on real dialects)
and `DefaultValue = { kind: 'value'; value: string | number | boolean } | { kind: 'expr'; expr }`.

### SliceForeignKey

`{ relationshipId, table: Id, columns: Id[], refTable: Id, refColumns: Id[], onDelete?, onUpdate?,
name?: string /* relationship label, for comments and DBML only */ }`

### SliceRelationship

`{ id, from: Id, to: Id, fromColumns: Id[], toColumns: Id[], cardinality?: '1-1' | '1-n' | 'n-1'
| 'n-n', fromOptional, toOptional, onDelete?, onUpdate?, label? }` — the stored relationship,
used as is by DBML, Mermaid and the dictionary; SQL uses `foreignKeys` / junction tables.

### SliceEnum

`{ id, name, schema: string | null, note?, values: { name, note? }[] }`

**Validation rules while building** (each failure → one `ExportNote`, never a throw):

- A table is in scope only if it is a `db-table` node (`isDbTable`).
- Column / index / FK / enum references are resolved by id; a missing id → note `stale-reference`.
- `fromColumns.length !== toColumns.length` → note `length-mismatch`, relationship not turned into an FK.
- Column with an empty `type` → `written` = `text` (all dialects), note `empty-type`.
- Name collisions after schema removal (SQLite) → note `name-clash`.

## 2. SchemaExportRequest / Result

```text
SchemaExportRequest {
  format: 'sql' | 'dbml' | 'mermaid-er' | 'dictionary'
  scope: { kind: 'selection'; tableIds: Id[] } | { kind: 'database'; cardId: Id } | { kind: 'deck' }
  dialect: 'postgres' | 'mysql' | 'sqlite' | null   // SQL only; null = deck dialect
  sql: { enumsAndIndexes: boolean; junctionTables: boolean; ifNotExists: boolean }
}

SchemaExportResult {
  text: string            // full output, '\n' line ends, trailing newline
  notes: ExportNote[]
  tableCount: number      // 0 → the dialog shows "No tables in this scope"
}
```

Defaults: `enumsAndIndexes: true`, `junctionTables: true`, `ifNotExists: false`.

## 3. ExportNote

`{ kind: ExportNoteKind; message: string; tableId?: Id; columnId?: Id }`, ordered by table order,
then by kind order below; identical notes are merged.

| Kind                | Message (example)                                                             | Formats                                                              |
| ------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `fk-out-of-scope`   | "orders.account_id → billing.accounts not written: table not in this export"  | SQL, DBML, Mermaid, dictionary (as "References outside this export") |
| `unmapped-type`     | "`money` kept as written: not in the common type list for MySQL"              | SQL (Generic)                                                        |
| `default-size`      | "orders.code: varchar without length written as varchar(255)"                 | SQL MySQL                                                            |
| `schema-dropped`    | "Schemas are not supported by SQLite: billing.* written without schema"       | SQL SQLite                                                           |
| `name-clash`        | "Two tables named invoices after dropping schemas"                            | SQL SQLite                                                           |
| `stale-reference`   | "Index orders_idx names a column that no longer exists; part skipped"         | all                                                                  |
| `length-mismatch`   | "Relationship shipment_items → order_items has 2 and 1 columns; not written"  | SQL, DBML                                                            |
| `no-columns`        | "Relationship orders → payments names no columns; not a foreign key"          | SQL, DBML                                                            |
| `junction-skipped`  | "products ↔ categories (n–n) not written: junction tables are off"            | SQL                                                                  |
| `self-junction`     | "tags ↔ tags (n–n): second side's columns written as tags_id_2"               | SQL                                                                  |
| `junction-renamed`  | "Junction table products_categories exists; written as products_categories_2" | SQL                                                                  |
| `no-key`            | "products ↔ tags (n–n) not written: tags has no primary key"                  | SQL                                                                  |
| `increment-dropped` | "orders.seq: auto-increment needs an integer primary key in SQLite; dropped"  | SQL                                                                  |
| `method-dropped`    | "Index method gin is not supported by MySQL; written without it"              | SQL                                                                  |
| `enum-not-created`  | "Enum types are not created (option off); columns still name them"            | SQL Postgres                                                         |
| `empty-enum`        | "Enum order_status has no values; column written as text"                     | SQL MySQL, SQLite                                                    |
| `empty-type`        | "payments.amount has no type; written as text"                                | all                                                                  |
| `unnamed-table`     | "A table has no name; written as table_3"                                     | all                                                                  |
| `no-cardinality`    | "orders → customers has no cardinality; drawn as many to one"                 | Mermaid                                                              |
| `name-changed`      | "Name `order items` written as order_items"                                   | Mermaid                                                              |

SQL and DBML also write each note as a `--` / `//` comment at the place it concerns.

## 4. Common type map

`COMMON_TYPES: readonly { canonical; aliases: readonly string[]; postgres; mysql; sqlite;
keepsSize: readonly Dialect[] }[]` — content in research R3. Lookup normalises case and inner
whitespace. Used only when the deck dialect is `generic` and the format is SQL.

## 5. Scope

```text
availableSchemaScopes(deck, ui) → {
  selection: Id[]                 // selected db-table node ids (selection.nodes ∩ tables)
  database: { cardId, title } | null   // drilled-into database card (top drill frame, kind 'node', type 'database'),
                                        // else a single selected database card
  deckHasTables: boolean
}
```

Tables of a database card: `db-table` nodes whose `parent` is the card id. Default scope: first
enabled of selection → database → deck (FR-002).

## 6. Dialog state additions (`export-dialog-state.ts`)

| Field         | Type                                                         | Initial                                       |
| ------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `format`      | `ExportFormat` (+ `sql`, `dbml`, `mermaid-er`, `dictionary`) | unchanged (json, or png in flow mode)         |
| `schemaScope` | `'selection' \| 'database' \| 'deck'`                        | first enabled (§5)                            |
| `sqlDialect`  | `'postgres' \| 'mysql' \| 'sqlite' \| null`                  | `null` (Generic must pick; ignored otherwise) |
| `options.sql` | `{ enumsAndIndexes, junctionTables, ifNotExists }`           | `true, true, false`                           |

New actions: `{ type: 'schemaScope'; scope }`, `{ type: 'sqlDialect'; dialect }`, and
`option` gains `sql`. `ExportResult` gains `notes: ExportNote[]` (empty for JSON / PNG / SVG).

## 7. File names

`<deck slug>[-<scope slug>][-dictionary].<ext>`: scope slug is `selection`, the card title's slug,
or nothing for Whole deck; ext `sql`, `dbml`, `mmd`, `md`. Example: `shop-orders-db.sql`,
`shop-dictionary.md`.
