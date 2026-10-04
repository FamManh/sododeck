# Research: Database Schema Model (040)

Phase 0 of [plan.md](plan.md). Every open point of the Technical Context is resolved here. Each
entry: **Decision**, **Rationale**, **Alternatives considered**. Spec clarifications (2026-10-04)
are taken as given: `db-table` in pack `database`, no interim hiding, enums as a deck-level list,
removing a column removes its relationships, ids unique across the deck.

## R1. Where the table lives in the file

- **Decision:** a table is a `node` with `type: "db-table"`. Six optional node keys, declared
  after `style` (end of `Node.properties`, so older keys keep their order): `schema` (text),
  `columns` (`DbColumn[]`), `indexes` (`DbIndex[]`), `checks` (`DbCheck[]`), `expanded`
  (boolean; the editor writes `true` or removes it), `detail` (`"names" | "keys" | "all"`). Name, note, colour, owner, tags, links,
  group, parent and size are the node's own `title`, `description`, `style`, `owner`, `tags`,
  `links`, `group`, `parent`, `size`.
- **Rationale:** DB7 (a table is a node, so groups, colours, search, views, export, drill-in and
  flows work as for cards). Key order of `v1.json` is the file's write order (schema
  `CLAUDE.md`), so appending keeps every existing file byte-identical.
- **Alternatives:** a root `tables[]` collection (rejected by DB7: every node feature would need a
  second path); a nested `table: { … }` object on the node (one more level for every reader; no
  gain because unknown keys are already kept on non-table nodes).

## R2. Column, index and check shape

- **Decision:**
  - `DbColumn { id, name, type, size?, pk?, notNull?, unique?, increment?, default?,
defaultExpr?, check?, enumRef?, note? }`. `name` and `type` are non-empty text; `size` is text
    matching `^[0-9]{1,6}(,[0-9]{1,6})?$` (`255`, `10,2`); flags are `true` only (the writer
    removes the key instead of writing `false`; a file's `false` is valid and kept); `default` is
    string, number or boolean (the value as data, quoted by the exporter by column type);
    `defaultExpr` is SQL text (`now()`); `check` is SQL text; `enumRef` is an enum id; `note` is
    plain text.
  - `DbIndex { id, name?, columns, unique?, method?, note? }` with `columns` a non-empty array
    whose items are a column id (string) or `{ expr: string }`. `method` is free lower-case text
    (`^[a-z][a-z0-9_]{0,31}$`).
  - `DbCheck { id, name?, expr }`.
- **Rationale:** the backlog's field list, with names that read well in hand-written JSON (the AI
  and hand-authoring path, US1). `true`-only flags follow 009's sticky booleans (absent = false
  keeps files short). A typed `default` keeps `0` and `'0'` apart for export (045). Index items
  as "id or `{ expr }`" is what the backlog drafted and what DBML / SQL express; `anyOf` of a
  string and an object is a shape both generators already handle (`FieldValue`, 032).
- **Alternatives:** `parts: [{ column } | { expr }]` (always objects: one more level for the
  common case); `size` as numbers `{ length, precision, scale }` (three keys for one SQL token,
  and 044 has to print it back anyway); `default` as text only (loses the value/literal
  distinction the exporter needs).

## R3. Notes are plain text, not `Y.Text`

- **Decision:** column, index, enum and enum-value `note` are plain strings (last write wins), and
  the schema does not call them markdown. The table's note is the node's `description`, which is
  already markdown and `Y.Text`.
- **Rationale:** `text-fields.ts` stores as `Y.Text` exactly the fields the schema calls markdown
  (a test enforces it). Column notes are one-liners in DBML and SQL comments; 1,800 extra
  `Y.Text` per 150-table deck would cost memory and load time (SC-005) for no merge benefit.
- **Alternatives:** markdown + `Y.Text` (letter-merge of two concurrent note edits; not worth the
  cost for one-line notes).

## R4. Relationship fields on the edge

- **Decision:** six optional edge keys, appended after `style`: `fromColumns` and `toColumns`
  (non-empty arrays of column ids, ordered; one item for a simple key), `cardinality`
  (`"1-1" | "1-n" | "n-1" | "n-n"`, read left to right as from → to), `fromOptional` and
  `toOptional` (`true` only), `onDelete` and `onUpdate`
  (`"cascade" | "restrict" | "set-null" | "set-default" | "no-action"`). Name and colour are the
  edge's `label` and `style.color`.
- **Rationale:** always-array ends give one shape for simple and composite keys (no union for
  readers). DB8's remark that 022 would reuse ports for side anchors is moot: 022 shipped anchors
  as `route.fromSide` / `fromAt`, so the ends name columns only, and `fromColumns` says so.
- **Alternatives:** `fromPort` / `toPort` as "id or id[]" (backlog draft; a union every reader
  must branch on, and a name that suggested a second meaning that no longer exists); a separate
  `relationships[]` collection (rejected by DB8: a relationship is a connector, so routing,
  styles, flows and focus all apply).

## R5. Enums: a deck-level list in `meta`

- **Decision:** root `enums` (`DbEnum[]`), declared after `dialect`. `DbEnum { id, name,
schema?, note?, values }`, `values: DbEnumValue[]`, `DbEnumValue { id, name, note? }`. In the
  Yjs document: `meta.enums` is a layout-2 list (`Y.Map<id, Y.Map>` with `$order`), each enum's
  `values` a child list; present only once the file has `enums` or the first enum is added
  (the `fields` pattern of 032), and written whenever stored (even empty) so files round-trip.
- **Rationale:** clarify Q3 (an enum is not drawn; values show on hover over the column). The
  032 field-definition list is the exact precedent: a deck-level list of ids with ordered child
  options, merged per item across tabs.
- **Alternatives:** an enum node type (dropped in clarify); enums inside the `database` card (an
  enum would vanish with its card and could not be shared by two database cards in one deck).

## R6. Dialect

- **Decision:** root `dialect` (`"generic" | "postgres" | "mysql" | "sqlite"`), declared right after
  `fieldDefaults`, stored as a plain `meta.dialect` value. Absent reads as `generic`. `setDialect(null)`
  and `setDialect('generic')` both remove the key; a file's explicit `"generic"` is valid and kept
  until changed.
- **Rationale:** DB11 and spec FR-004. A plain value is enough: one writer at a time, last write
  wins is the right merge.

## R7. Yjs layout of a table's lists

- **Decision:** `columns`, `indexes` and `checks` are child lists of the node map (`Y.Map<id,
Y.Map>` with `$order`, ADR 0021 §1–2), created only when the file or an op has them and written
  whenever present (even empty). Each item stores its fields as plain values; `index.columns`
  and a column's `default` are whole values. `read.ts` reads them in order for `nodes`;
  `write.ts` `createObject('nodes', …)` builds them. No change to `observe.ts`: an edit inside a
  child list already reports `updated` on the node with key `columns` / `indexes` / `checks`
  (the generic branch of `recordObjectEvent`).
- **Rationale:** spec US4 / FR-026: two tabs editing two columns, or one adding and one
  reordering, must both survive. Item maps merge per key; order keys merge moves; this is the
  steps / rule-columns / field-options layout already proven by 036's concurrency tests.
- **Alternatives:** `Y.Array` of plain objects (a concurrent edit replaces the whole column; add
  - reorder duplicates or loses items: the exact defect 036 removed); a whole-value `columns`
    array (last write wins on the entire table).

## R8. Id scope and generation

- **Decision:** columns, indexes, checks (of every table), enums and enum values form **one id
  scope**. `checkDuplicateIds` (`load-checks.ts`) gains that scope, so a duplicate refuses the
  file at import with every location, as for any duplicate today. Generated ids use new prefixes
  `dbcol`, `dbidx`, `dbchk`, `enum`, `enumval` through `ids.ts`, which already makes generated
  ids unique across the whole deck (it learns to collect the new lists). An op given an explicit
  id that exists in the scope throws `duplicate-id`.
- **Rationale:** clarify Q5 (one id names one object, so 047 lint, 048 search and 049 flows can
  point at a column by id alone). Today's rule is "refused, never auto-fixed" (`load-checks.ts`
  header); the spec was corrected during planning to follow it.
- **Alternatives:** per-table scopes (rejected in clarify); folding the scope into `nodes`
  (a column id equal to a node id is harmless, and a cross-collection check would refuse files
  that are valid today).

## R9. Removal cascades

- **Decision:**
  - `removeColumn`: drops the column from every index part list of its table (an index left empty
    is removed); for each edge with `from` = table and the column in `fromColumns` (or `to` /
    `toColumns`): a one-item end removes the edge; a composite end drops the pair at that
    position from both ends (the edge is removed when nothing is left). A self-reference counts
    both ends. One transaction, one undo step, `RemovalResult` lists removed indexes, updated
    indexes, removed edges and updated edges.
  - `removeEnum`: clears `enumRef` on every column that names it; columns keep `type`.
  - `removeEnumValue`, `removeIndex`, `removeCheck`: nothing else changes.
  - Node removal: unchanged (edges of a removed node are already removed by `ops/cascade.ts`).
- **Rationale:** clarify Q4 and spec FR-023–025, written next to the existing cascade code so the
  delete policy stays in one place (model `CLAUDE.md` "Delete policy").

## R10. Pasting and duplicating tables

- **Decision:** `pasteFragment` gives every column, index and check of a pasted table a new id
  and remaps, inside the pasted set: index parts, and `fromColumns` / `toColumns` of pasted edges
  (whose `from` / `to` are remapped already). `enumRef` is kept: the enum is deck-level, so a
  paste in the same deck still resolves, and a paste into another deck reports a dangling
  reference (kept, not dropped). `toFragment` copies the table's lists as plain data.
- **Rationale:** FR-022a; the paste op already rewrites node and edge ids, so the column map is
  one more table in the same remap.
- **Alternatives:** copying enums into the fragment (a pasted enum with a new id would duplicate
  the target deck's enum of the same name; deferred to 043 if users ask).

## R11. Problems (FR-021)

- **Decision:** two new problem kinds in `problems.ts`, derived like the others:
  - `db-dangling-reference`: an index part, a `fromColumns` / `toColumns` item or an `enumRef`
    naming nothing in its table (columns) or in `enums`. Only checked when the end card is a
    `db-table`; ends on other cards are ignored (FR-018).
  - `db-composite-mismatch`: `fromColumns` and `toColumns` of different lengths.
    The app's `problem-kinds.ts` gets a title and an icon for each (the map is exhaustive).
- **Rationale:** the existing derived Problems list (015) is the place for kept-but-broken data;
  047 adds the schema lint (types, naming, missing keys) later.

## R12. Model operations and validation

- **Decision:** new editor methods (contract in
  [contracts/model-additions.md](contracts/model-additions.md)): column, index, check, enum and
  enum-value add / update / move / remove, and `setDialect`. Table keys `schema`, `expanded`,
  `detail` and relationship keys on edges go through the existing `update('nodes' | 'edges', …)`.
  `update('nodes', …)` refuses `columns`, `indexes` and `checks` (`invalid`): they change only
  through their ops, like view internals (011). `add('nodes', data)` accepts a table with lists
  (ids validated against the scope; missing ids generated). Column-end patches on an edge are
  checked: each id must be a column of the end table when that end is a `db-table`
  (`missing-reference`). Every op validates the full candidate node or meta with the generated
  Zod before writing (model `CLAUDE.md`).
- **Rationale:** follows the step, rule-column and field-option ops one-for-one, so the editor
  surface stays uniform and every op is one undo step.

## R13. Registry and UI touch points

- **Decision:** `card-types.ts`: pack `{ id: 'database', name: 'Database' }` (after `data`,
  before `shapes`), category `database`, type `['db-table', 'Table', 'database', 'database']`.
  `NEW_DECK_PACKS` therefore includes `database` for new decks; decks with no `packs` stay
  Architecture-only, decks with a `packs` list are unchanged. `packages/ui` `icons.ts` gets a
  type style for `db-table` (lucide `Table2`, a neutral tone from the existing palette) and the
  app's deck thumbnail a fill entry, so the Add palette and thumbnails draw it without a fallback.
  No rendering beyond the generic card (041).
- **Rationale:** clarify Q2 (no hiding; the pack ships with 041–049). Type styles live in the UI
  package (ADR 0025).

## R14. Format version and revision

- **Decision:** no `version` bump (additive optional fields, constitution II) and no format
  revision (ADR 0020 deferred, §g-81). The spec was corrected during planning (FR-029, US3).

## R15. Performance

- **Decision:** a case in `packages/model/test/perf.test.ts` (which already times load, edits and
  `checkDeck` with a CI slack factor): 150 tables × 12 columns, ~200 relationships; `fromJSON` /
  `toJSON` under 1 s each, a column edit within the existing per-edit budget, problems within the
  existing `checkDeck` budget. `pnpm bench` before and after shows the canvas is unaffected (its
  generator makes no tables; 048 adds a schema bench).
- **Rationale:** SC-005 as a regression guard, using the file's existing budgets and slack.

## R16. Dependencies

- **Decision:** none. The `@dbml/core` parser (DB6) arrives with 044.
