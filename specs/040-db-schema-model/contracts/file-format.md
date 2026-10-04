# Contract: file format additions (040)

Additions to `packages/schema/schema/v1.json`. All optional, no `version` bump, no format
revision (research R14). Every new object has `additionalProperties: false` and every property
a `description` (Monaco hover). No `default` keyword; defaults are stated in descriptions.
Shapes and rules: [../data-model.md](../data-model.md).

## New `$defs`

```jsonc
"Dialect":      { "enum": ["generic", "postgres", "mysql", "sqlite"] },
"DbName":       { "type": "string", "minLength": 1, "maxLength": 128, "pattern": "^[^\\n\\r]+$" },
"DbExpr":       { "type": "string", "minLength": 1 },
"DbNote":       { "type": "string" },
"DbAction":     { "enum": ["cascade", "restrict", "set-null", "set-default", "no-action"] },
"Cardinality":  { "enum": ["1-1", "1-n", "n-1", "n-n"] },
"DbDetail":     { "enum": ["names", "keys", "all"] },
"ColumnIdList": { "type": "array", "items": { "$ref": "#/$defs/Id" }, "minItems": 1, "uniqueItems": true },

"DbColumn": {
  "type": "object", "additionalProperties": false, "required": ["id", "name", "type"],
  "properties": {
    "id": Id, "name": DbName, "type": DbName,
    "size": { "type": "string", "pattern": "^[0-9]{1,6}(,[0-9]{1,6})?$" },
    "pk": boolean, "notNull": boolean, "unique": boolean, "increment": boolean,
    "default": { "anyOf": [string, number, boolean] },
    "defaultExpr": DbExpr, "check": DbExpr, "enumRef": Id, "note": DbNote
  }
},
"DbIndexPart": { "anyOf": [ Id, { "type": "object", "additionalProperties": false,
                                  "required": ["expr"], "properties": { "expr": DbExpr } } ] },
"DbIndex": {
  "type": "object", "additionalProperties": false, "required": ["id", "columns"],
  "properties": {
    "id": Id, "name": DbName,
    "columns": { "type": "array", "items": DbIndexPart, "minItems": 1 },
    "unique": boolean, "method": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,31}$" },
    "note": DbNote
  }
},
"DbCheck": { "type": "object", "additionalProperties": false, "required": ["id", "expr"],
             "properties": { "id": Id, "name": DbName, "expr": DbExpr } },
"DbEnumValue": { "type": "object", "additionalProperties": false, "required": ["id", "name"],
                 "properties": { "id": Id, "name": DbName, "note": DbNote } },
"DbEnum": { "type": "object", "additionalProperties": false, "required": ["id", "name", "values"],
            "properties": { "id": Id, "name": DbName, "schema": DbName, "note": DbNote,
                            "values": { "type": "array", "items": DbEnumValue } } }
```

(`Id`, `boolean` etc. abbreviate `{ "$ref": "#/$defs/Id" }` and `{ "type": "boolean" }`.)

## Root properties (after `fieldDefaults`)

| Key       | Schema                 |
| --------- | ---------------------- |
| `dialect` | `$ref Dialect`         |
| `enums`   | array of `$ref DbEnum` |

## `Node.properties` (after `style`)

`schema` (DbName), `columns` (array of DbColumn), `indexes` (array of DbIndex), `checks` (array
of DbCheck), `expanded` (boolean), `detail` (DbDetail).

## `Edge.properties` (after `style`)

`fromColumns`, `toColumns` (ColumnIdList), `cardinality` (Cardinality), `fromOptional`,
`toOptional` (boolean), `onDelete`, `onUpdate` (DbAction).

## `TypeId` / `PackId` descriptions

Add `db-table` to the built-in type ids and `database` to the built-in pack ids. Patterns
unchanged.

## Semantic rules (`semantic-rules.ts`)

- **S14** A column holds at most one of `default` and `defaultExpr`. Path:
  `nodes.<i>.columns.<j>.defaultExpr`.
- **S15** (only if the parity test shows json-schema-to-zod drops `minItems` here): `index.columns`,
  `fromColumns`, `toColumns` are not empty.

## Examples and fixtures

- `examples/full.sododeck.json` gains the "Shop" fragment: one `database` card holding
  `customers`, `orders`, `order_items` (composite PK), `categories` (self-reference); one enum
  with notes; an expression index; a named check; every `DbAction`, `Cardinality`, `Dialect` and
  `DbDetail` value used once (coverage test). Key order as declared.
- `test/fixtures.ts` invalid cases: column without `type`; `notnull` typo; bad `size` (`"10.2"`);
  `default` + `defaultExpr`; empty index `columns`; index part `{ "expr": "" }`; index part
  `{ "column": "x" }`; unknown `cardinality` (`"many"`); unknown action (`"set null"`); unknown
  dialect (`"oracle"`); empty `fromColumns`; duplicate in `toColumns`; enum without `values`;
  `detail: "full"`; method `"BTREE"`.
