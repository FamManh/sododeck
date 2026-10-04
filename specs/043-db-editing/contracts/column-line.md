# Contract: Column Line Grammar (043)

`apps/app/src/db/column-line.ts`. These are pure functions, used by the line editor (FR-001–FR-007).

## API

```ts
type LineToken = {
  kind: 'name' | 'type' | 'flag' | 'default' | 'ignored';
  text: string;
  from: number;
  to: number;
};

type ParsedColumnLine = {
  name: string;                       // '' when missing
  type?: string;                      // as written, without the size
  size?: string;                      // '10' or '10,2'
  enumRef?: Id;                       // when `type` names a deck enum
  pk?: true;
  notNull?: true;
  unique?: true;
  increment?: true;
  default?: string | number | boolean;
  defaultExpr?: string;
  tokens: LineToken[];                // in text order, for the chips
  ignored: string[];                  // words not understood (FR-004)
  hints: string[];                    // e.g. "default needs a value"
};

parseColumnLine(text: string, ctx: { enums: readonly DbEnum[] }): ParsedColumnLine;
formatColumnLine(column: DbColumn, enums: readonly DbEnum[]): string;
columnLinePatch(previous: DbColumn | undefined, parsed: ParsedColumnLine): Patch<DbColumn>;
lineError(parsed: ParsedColumnLine, table: TableNode, exceptId?: Id): 'empty' | 'taken' | null;
```

## Grammar (case-insensitive keywords)

```
line      := name [type] modifier*
name      := word | quoted          ; "order date" → order date (quotes not stored)
type      := word ['(' digits [',' digits] ')']    ; schema-qualified allowed: public.order_status
modifier  := 'pk' | 'primary' 'key'
           | 'not' 'null' | 'null'
           | 'unique'
           | 'increment' | 'auto_increment' | 'autoincrement'
           | 'default' value
value     := quoted-string            → default (string, quotes removed)
           | number                   → default (number)
           | 'true' | 'false'         → default (boolean)
           | 'null'                   → default omitted (column nullable stays as written)
           | word '(' … ')'           → defaultExpr  (e.g. now(), gen_random_uuid())
           | bare word                → defaultExpr  (e.g. current_timestamp)
```

## Rules

- The second word is always the type, even when it is a keyword-looking word such as `text` or `date`. Keywords are only recognised after the type. A line with only a name has no type.
- `null` after `not null` (or the other way round) means the last one wins, and only its chip shows.
- A size that does not match `^\d{1,6}(,\d{1,6})?$` is part of an ignored token.
- `default` with nothing after it adds the hint "default needs a value" and is ignored.
- `ref`, `references`, `>` and anything else unknown go to `ignored` (clarified: the line never creates relationships).
- `type` matches an enum when its name equals the enum's `name` or `schema.name` (case-insensitive), and then `enumRef` is set.
- `formatColumnLine` writes the parts in this order: name (quoted if it has spaces), `type(size)`, `pk`, `not null` (only when `notNull` and not `pk`), `unique`, `increment`, `default …`.
- Round-trip property: `parse(format(c))` yields the same fields as `c` for name, type, size, flags, default and enumRef.
- `columnLinePatch` writes `null` for every line field that is missing from the parsed line but present on `previous`. It never touches `note`, `check` or `id`.
- `lineError`: `empty` when `name.trim() === ''`; `taken` when another column of the table has the same name (case-insensitive).

## Examples

| Line                                             | Result                                            |
| ------------------------------------------------ | ------------------------------------------------- |
| `email text unique not null`                     | name email, type text, unique, notNull            |
| `status order_status not null default 'pending'` | enumRef(order_status), notNull, default 'pending' |
| `price numeric(10,2) not null default 0`         | type numeric, size '10,2', notNull, default 0     |
| `created_at timestamptz default now()`           | defaultExpr 'now()'                               |
| `id int pk increment`                            | pk, increment                                     |
| `email text sparkly`                             | ignored ['sparkly']                               |
| `customer_id uuid ref customers.id`              | ignored ['ref', 'customers.id']                   |
| `notes`                                          | name only, no type                                |
