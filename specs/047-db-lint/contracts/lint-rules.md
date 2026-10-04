# Contract: Lint rules (047)

`checkDeck` in `packages/model/src/problems.ts`, run by the problems worker. Pure, JSON in and out, never writes. Decisions: research R1–R3, R5.

## Problem shape (changes)

```ts
type Severity = 'error' | 'warning';

interface Problem {
  // existing: key, kind, target, title, detail, objectTitle, order
  severity: Severity; // new, from SEVERITY[kind] unless a draft overrides it
  column?: { tableId: Id; columnId: Id }; // new: the faulty row
  fixes?: readonly ProblemFix[]; // replaces `fix`; first is primary
}

interface DeckProblems {
  list: readonly Problem[]; // errors first, then kind rank, objectTitle, order, key
  total: number;
  errors: number; // new
  warnings: number; // new
  byObject: ReadonlyMap<Id, readonly Problem[]>;
}
```

## Severity of existing kinds

| Kind                                                                                                                                                                                                 | Severity |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `broken-reference`, `step-without-connection`, `broken-chain`, `invalid-rule-cells`                                                                                                                  | error    |
| `db-dangling-reference` (incl. missing enum), `db-composite-mismatch`                                                                                                                                | error    |
| `duplicate-connection`, `incomplete-flow`, `overlapping-conditions`, `missing-rule`, `rule-without-catch-all`, `card-size-out-of-range`, `unknown-card-type`, `unknown-pack`, `field-value-dangling` | warning  |

## New rules

Names in messages are `table.column`, schema-qualified (`sales.orders.id`) only when the deck has more than one schema. "Target" is `ProblemTarget`; "row" is `Problem.column`.

| Kind                        | Sev.    | One per                 | Title / detail (example)                                                                           | Target · row                        | Fixes                          | Edge `short` |
| --------------------------- | ------- | ----------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------ | ------------ |
| `db-no-primary-key`         | warning | table with ≥ 1 column   | "No primary key" / "audit_log has no primary key"                                                  | node · the `id` column if any       | `make-pk` or `add-id-pk`       | —            |
| `db-duplicate-table`        | error   | second table of a name  | "Duplicate table" / "Two tables named orders in public"                                            | nodes (both) · —                    | `rename` (second)              | —            |
| `db-duplicate-column`       | error   | second column of a name | "Duplicate column" / "products has two columns named sku"                                          | node · second column                | `rename`                       | —            |
| `db-duplicate-index`        | error   | second index of a name  | "Duplicate index" / "orders has two indexes named orders_idx"                                      | node · —                            | `rename`                       | —            |
| `db-duplicate-enum`         | error   | second enum, or value   | "Duplicate enum" / "Two enums named status in public" · "status has the value paid twice"          | object (enum) · —                   | `rename` / `add-values`        | —            |
| `db-empty-column`           | error   | column                  | "Column without a name" · "Column without a type" / "orders.notes has no type"                     | node · column                       | `rename` / `pick-type`         | —            |
| `db-type-mismatch`          | error   | relationship            | "Type mismatch" / "loyalty_points.customer_ref is int, customers.id is uuid"                       | edges · referencing column          | `match-type`                   | `int → uuid` |
| `db-null-default`           | error   | column                  | "Null default on a not-null column" / "orders.status is not null with default NULL"                | node · column                       | `remove-default`, `allow-null` | —            |
| `db-fk-not-key`             | warning | relationship            | "Reference to a non-key column" / "reviews.order_ref → orders.number: not a primary key or unique" | edges · referencing column          | `pick-column`                  | `not key`    |
| `db-many-to-many`           | warning | n–n relationship        | "Many-to-many" / "n–n between products and categories: create a junction table?"                   | edges · —                           | `create-junction`              | `n–n`        |
| `db-empty-enum`             | warning | enum                    | "Enum without values" / "Enum shipment_status has no values"                                       | object (enum) · —                   | `add-values`                   | —            |
| `db-default-type`           | warning | column                  | "Default does not fit the type" / "orders.qty is integer with default 'many'"                      | node · column                       | `remove-default`               | —            |
| `db-required-loop`          | warning | loop                    | "Required references form a loop" / "orders → payments → orders: every reference is not null"      | edges (loop) · —                    | —                              | `loop`       |
| `db-duplicate-relationship` | warning | second relationship     | "Duplicate relationship" / "reviews.order_id → orders.id appears twice"                            | edges (second) · referencing column | `delete-edge`                  | —            |
| `db-unknown-type`           | warning | type name               | "Type not in the MySQL list" / "citext is not a MySQL type · 12 columns"                           | nodes (all tables) · first column   | `pick-type`                    | —            |

Rules apply only to `db-table` nodes, relationships (edges with column ends, 042) and `file.enums`. A relationship with a dangling end or unequal end lengths gets no `db-type-mismatch`, `db-fk-not-key`, `db-duplicate-relationship` or loop problem (FR-007). `duplicate-connection` skips relationships.

## Comparison rules

- Names: trimmed, lower case. Tables and enums are keyed by `schema ?? ''` plus name.
- Types: `sameColumnType(a, b, dialect)` (research R2); sizes compared after removing spaces; enum-linked columns compare by `enumRef`.
- Primary key set: the table's columns with `pk`, in column order. A key match is set equality.

## Keys

`key` stays stable across runs: `kind:` plus the ids involved (`db-type-mismatch:<edgeId>`, `db-unknown-type:<lower type>`, `db-required-loop:<sorted table ids>`).

## Model data moved (research R2)

`packages/model/src/db-types.ts` exports `COMMON_TYPES`, `CommonType`, `commonTypeOf`, `DIALECT_TYPES`, `TypeEntry`, `typeEntry`, `INDEX_METHODS`, `DIALECT_HINTS`, `idTypeOf(dialect)`, `sameColumnType`. The app's `db/export/common-types.ts` keeps `translateType`; `db/import/convert-types.ts` keeps `convertType`; `db/dialect-types.ts` is removed and its importers use `@sododeck/model`.
