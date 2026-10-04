# Contract: `@sododeck/model` additions (040)

Public API added to `DeckEditor` and the package exports. Every method validates first, throws
`DeckEditError` (`invalid`, `not-found`, `missing-reference`, `duplicate-id`) without writing,
and is one undo step. Types come from `@sododeck/schema` (generated: `DbColumn`, `DbIndex`,
`DbCheck`, `DbEnum`, `DbEnumValue`, `Dialect`, …). `Patch<T>`: `null` clears an optional key.

## Deck

```ts
/** Sets the deck's dialect; `null` or 'generic' removes the key (absent = Generic). */
setDialect(dialect: Dialect | null): void;
```

`deckDialect(file | doc): Dialect` — pure reader, `'generic'` when absent.

## Tables (`tableId` = a node of type `db-table`; another type → `invalid`)

```ts
addColumn(tableId: Id, data: NewDbColumn, index?: number): Id;          // NewDbColumn = Omit<DbColumn,'id'> & { id?: Id }
updateColumn(tableId: Id, columnId: Id, patch: Patch<Omit<DbColumn, 'id'>>): void;
moveColumn(tableId: Id, columnId: Id, toIndex: number): void;
removeColumn(tableId: Id, columnId: Id): RemovalResult;                 // cascade: research R9

addIndex(tableId: Id, data: NewDbIndex, index?: number): Id;
updateIndex(tableId: Id, indexId: Id, patch: Patch<Omit<DbIndex, 'id'>>): void;
moveIndex(tableId: Id, indexId: Id, toIndex: number): void;
removeIndex(tableId: Id, indexId: Id): RemovalResult;

addCheck(tableId: Id, data: NewDbCheck, index?: number): Id;
updateCheck(tableId: Id, checkId: Id, patch: Patch<Omit<DbCheck, 'id'>>): void;
moveCheck(tableId: Id, checkId: Id, toIndex: number): void;
removeCheck(tableId: Id, checkId: Id): RemovalResult;
```

- `default` and `defaultExpr` (S14): a patch that would leave both set is `invalid`; switching
  from one to the other sends the new key and `null` for the old one in the same patch.
- Flag keys (`pk`, `notNull`, `unique`, `increment`): `true` writes `true`, `false` or `null`
  removes the key.
- `enumRef` and index part ids must exist (`missing-reference`).
- Table keys `schema`, `expanded`, `detail`: `update('nodes', tableId, patch)`; `expanded: false`
  removes the key. `update('nodes', …)` with `columns`, `indexes` or `checks` → `invalid`.

## Enums

```ts
addEnum(data: NewDbEnum, index?: number): Id;                           // values optional, default []
updateEnum(enumId: Id, patch: Patch<Pick<DbEnum, 'name' | 'schema' | 'note'>>): void;
moveEnum(enumId: Id, toIndex: number): void;
removeEnum(enumId: Id): RemovalResult;                                  // clears enumRef on columns

addEnumValue(enumId: Id, data: NewDbEnumValue, index?: number): Id;
updateEnumValue(enumId: Id, valueId: Id, patch: Patch<Omit<DbEnumValue, 'id'>>): void;
moveEnumValue(enumId: Id, valueId: Id, toIndex: number): void;
removeEnumValue(enumId: Id, valueId: Id): RemovalResult;
```

## Relationships

Through `update('edges', edgeId, patch)` (existing). Added checks when the patch holds
`fromColumns` / `toColumns` and that end's card is a `db-table`: every id is a column of that
table (`missing-reference`). Ends on other cards are validated by shape only.

## Ids

`IdPrefix` gains `dbcol`, `dbidx`, `dbchk`, `enum`, `enumval`. Generated ids stay unique across
the deck. Given ids are checked against the database-parts scope (`duplicate-id`).

## RemovalResult

Unchanged type. `removeColumn` reports removed indexes and edges under `removed`, changed indexes
and edges under `updated`. `removeEnum` reports changed tables under `updated`.

## Changes and problems

- `observeDeck`: no new kinds. A change inside a table's lists is `updated` on the node with key
  `columns` / `indexes` / `checks`; enum changes are `updated` on `meta` with key `enums`;
  dialect with key `dialect`.
- `ProblemKind` gains `db-dangling-reference` and `db-composite-mismatch` (target: the edge for
  column ends, the table node for index parts and `enumRef`).

## Registry (`card-types.ts`)

Pack `database` ("Database"), category `database`, type `db-table` ("Table"). `NEW_DECK_PACKS`
includes it. `isDbTable(node)` helper.

## Fragments and paste

`toFragment` copies table lists. `pasteFragment` re-ids columns, indexes and checks of pasted
tables and remaps index parts and the pasted edges' `fromColumns` / `toColumns`; `enumRef` is
kept.
