# Contract: Dialect data and conversion (052)

Pure modules under `apps/app/src/db/` (same boundary as `db/export` and `db/import`: plain deck data in, plain data out; no React, DOM, Yjs or `editor/` imports). Decisions: research R5, R6.

## `db/dialect-types.ts`

```ts
type TypeKind = 'number' | 'text' | 'datetime' | 'boolean' | 'binary' | 'json' | 'id' | 'other';
type SizeKind = 'none' | 'length' | 'precision';

interface TypeEntry {
  name: string; // as written in that dialect, lower case
  kind: TypeKind; // picker group
  size: SizeKind; // which size fields the drawer shows
}

const DIALECT_TYPES: Readonly<Record<Dialect, readonly TypeEntry[]>>;
const INDEX_METHODS: Readonly<Record<Dialect, readonly string[]>>;
const DIALECT_HINTS: Readonly<Record<Dialect, string>>;

/** Case-insensitive, whitespace-normalised; aliases of the common types count. */
function typeEntry(dialect: Dialect, typeText: string): TypeEntry | undefined;
```

Rules:

- Every `COMMON_TYPES` spelling for a SQL dialect is in that dialect's list (a test walks `COMMON_TYPES`). Fixed spellings with a size (`char(36)`) appear as their base type (`char`).
- Generic lists the 17 canonical names.
- `size: 'length'` for `char`, `varchar`, `binary`, `varbinary`, `bit`; `'precision'` for `decimal` / `numeric`; `'none'` otherwise.
- `INDEX_METHODS.sqlite` is empty, so the drawer hides the method field.
- Hints (frame 152):

| Dialect  | Hint                                             |
| -------- | ------------------------------------------------ |
| Generic  | Common types only; SQL export asks which dialect |
| Postgres | uuid, jsonb, timestamptz, enums, arrays          |
| MySQL    | char(36) ids, json, datetime, ENUM per column    |
| SQLite   | Type affinity: integer, text, real, blob         |

## `db/dialect-change.ts`

```ts
interface ColumnChange {
  tableId: Id;
  columnId: Id;
  label: string; // "orders.created_at" (schema-qualified when the deck has several schemas)
  before: { type: string; size?: string };
  after: { type: string; size?: string; increment?: true };
  sizeDropped: boolean;
}

interface KeptColumn {
  tableId: Id;
  columnId: Id;
  label: string;
  type: string;
}

interface DialectPlan {
  from: Dialect;
  to: Dialect;
  changes: ColumnChange[];
  kept: KeptColumn[];
}

function planDialectChange(deck: SododeckFile, to: Dialect): DialectPlan;

/** Groups for the dialog's "+ n more" line: "uuid → char(36) 11". */
function changeGroups(plan: DialectPlan): { before: string; after: string; count: number }[];

/** One editor.batch: setDialect + updateColumn per change. Returns the toast text. */
function applyDialectChange(editor: DeckEditor, plan: DialectPlan): string;
```

Rules:

- Order: tables in deck order, columns in stored order.
- Skipped: columns with `enumRef`, columns with an empty type, columns whose written type is already the target spelling (no-op).
- SQL → SQL: `convertType(type, size, from, to)`. Generic → SQL: `translateType(type, size, to)`. SQL → Generic: the common type's `canonical`, size kept when any SQL dialect keeps it for that type. `mapped: false` → `kept`.
- Postgres `serial` / `bigserial` / `smallserial` → common `int` / `bigint` / `smallint` in the target, with `after.increment = true`.
- `from === to` returns an empty plan; the select does nothing.
- `applyDialectChange` lives in `apps/app/src/editor/inspector/database/` (it needs the editor); the plan functions stay pure.
- Toast: `Converted ${n} column(s) to ${name} · Undo`, or `Dialect set to ${name} · Undo` when `changes` is empty.

## Examples (Shop, Postgres → MySQL)

| Column              | Before          | After           |
| ------------------- | --------------- | --------------- |
| `customers.id`      | `uuid`          | `char(36)`      |
| `orders.created_at` | `timestamptz`   | `timestamp`     |
| `payments.metadata` | `jsonb`         | `json`          |
| `orders.total`      | `numeric(10,2)` | `decimal(10,2)` |
| `orders.status`     | `order_status`  | skipped (enum)  |
| `docs.search`       | `tsvector`      | kept            |

The `timestamptz` row follows 045's common list (`timestamp` on MySQL), not frame 153's `datetime(6)`.
