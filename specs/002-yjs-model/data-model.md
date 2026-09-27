# Data Model: Deck Document Model (002)

The file-level objects (node, group, edge, view, feature, flow, step, rule, column, row, sticky,
link) and their fields are defined by format v1: see
[001 data-model](../001-json-schema-v1/data-model.md) and `packages/schema/schema/v1.json`. This
document covers what 002 adds: how those objects live in the live document, how they reference
each other, what happens on delete, and the model-level types (edit results, changes, integrity
problems).

## Live document layout (persisted from 005 on; ADR 0005)

| Root       | Yjs type                   | Contents                                                                    |
| ---------- | -------------------------- | --------------------------------------------------------------------------- |
| `meta`     | `Y.Map`                    | `$schema`, `version`, `name?`, `description?`, `tags?` (Y.Array)            |
| `nodes`    | `Y.Array<Y.Map>`           | one map per node, file order                                                |
| `groups`   | `Y.Array<Y.Map>`           | one map per group                                                           |
| `edges`    | `Y.Array<Y.Map>`           | one map per edge                                                            |
| `views`    | `Y.Array<Y.Map>`           | `includes` → Y.Array, `positions` → Y.Map(node id → Y.Map x,y)              |
| `features` | `Y.Array<Y.Map>`           | one map per feature                                                         |
| `flows`    | `Y.Array<Y.Map>`           | `steps` → Y.Array<Y.Map>; step `ruleInputs` → nested Y.Map                  |
| `rules`    | `Y.Map<Y.Map>` (id → rule) | `inputs`/`outputs`/`rows` → Y.Array<Y.Map>; `when`/`then` → Y.Array<string> |
| `stickies` | `Y.Array<Y.Map>`           | one map per sticky                                                          |

Scalars (all text, numbers, enums) are plain values; optional fields are **absent** when unset
(never stored as `null`/`undefined`), so write-out emits only present fields.

## Identity

| Object                                         | Id scope on load (refused if duplicated) | Generated ids                         |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| node, group, edge, view, feature, flow, sticky | within its collection                    | unique across the deck, prefix = type |
| rule                                           | key of `rules` (unique by construction)  | `rule-…`                              |
| step                                           | within its flow                          | `step-…`, unique across the deck      |
| rule column                                    | within its rule (inputs + outputs)       | `col-…`                               |
| rule row                                       | within its rule                          | `row-…`                               |

Ids are immutable: no operation writes `id` after creation; `update` patches exclude it by type.

## References and delete cascade

| Reference (holder.field)       | Target        | On target delete                             | Reported if dangling                 |
| ------------------------------ | ------------- | -------------------------------------------- | ------------------------------------ |
| edge.from / edge.to            | node          | **edge removed**                             | yes                                  |
| node.parent                    | node          | field cleared                                | yes                                  |
| node.group                     | group         | set to deleted group's `parent` (or cleared) | yes                                  |
| group.parent                   | group         | set to deleted group's `parent` (or cleared) | yes                                  |
| node.rules[]                   | rule          | id removed from list (list removed if empty) | yes                                  |
| step.edge                      | edge          | **kept, reported broken**                    | yes                                  |
| step.rules[]                   | rule          | id removed from list (list removed if empty) | yes                                  |
| step.ruleInputs[ruleId]        | rule          | entry removed (map removed if empty)         | yes (also if rule not in step.rules) |
| step.ruleInputs[ruleId][colId] | input column  | entry removed on column delete               | yes                                  |
| flow.feature                   | feature       | field cleared                                | yes                                  |
| flow.steps[]                   | (owned)       | steps deleted with the flow                  | —                                    |
| view.feature                   | feature       | field cleared                                | yes                                  |
| view.includes[]                | node          | id removed from list                         | yes                                  |
| view.positions[nodeId]         | node          | entry removed                                | yes                                  |
| sticky.anchor                  | any object id | **kept, reported broken**                    | yes (+ ambiguous)                    |

Deleting an edge follows the same rows (steps kept and reported). Every delete, with its whole
cascade, is one transaction → one change event, one undo step.

## Rule table invariants

- Every row has exactly one `when` cell per input column and one `then` cell per output column, in
  column order. Add column → insert `''` at that index in every row; remove column → remove that
  index in every row; move column → move the cell in every row.
- Removing an input column removes `ruleInputs[ruleId][columnId]` on every step.

## Model-level types

### Edit input and patch

- `NewObject<C>`: the object type without `id` (an explicit `id` is accepted for paste/import and
  checked for uniqueness). For flows, `steps` defaults to `[]`; for rules, columns/rows default to
  `[]` and `hitPolicy` to `first`.
- `Patch<T>`: any subset of `T`'s fields except `id` and owned children (`flow.steps`,
  `rule.inputs/outputs/rows`); required fields take a value, optional fields take a value or
  `null` (= clear the field).

### Edit error

`DeckEditError { code: 'invalid' | 'not-found' | 'missing-reference' | 'duplicate-id'; issues: Issue[] }`
— `Issue` is the schema package's `{ path, message }`. Thrown before any write.

### Removal result

`remove*` returns `{ removed: ObjectRef[]; updated: ObjectRef[]; broken: IntegrityProblem[] }`
so a surface can tell the user what the confirmed delete affected.

### Change event

```text
DeckChange {
  origin: 'local' | 'undo' | 'redo' | 'remote'
  changes: ObjectChange[]
}
ObjectChange {
  scope: 'meta' | 'nodes' | 'groups' | 'edges' | 'views' | 'features' | 'flows' | 'rules' | 'stickies'
  id: Id                      // object id ('' for meta)
  child?: { kind: 'step' | 'column' | 'row'; id: Id }
  kind: 'added' | 'updated' | 'removed'
  keys: string[]              // top-level fields changed (for 'updated')
}
```

### Integrity problem

```text
IntegrityProblem {
  kind: 'missing-reference' | 'ambiguous-anchor' | 'cycle' | 'detached-rule-input'
  object: ObjectRef           // { scope, id, child? } of the holder
  field: string               // e.g. 'from', 'edge', 'rules', 'ruleInputs.R-1.in2', 'anchor', 'parent'
  target: Id                  // the missing / ambiguous / cyclic id
  targetType: 'node' | 'group' | 'edge' | 'feature' | 'rule' | 'rule-column' | 'object'
}
```

| Check (FR-030)                                  | kind                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| edge.from/to → node                             | missing-reference                                 |
| step.edge → edge                                | missing-reference                                 |
| node.rules / step.rules → rule                  | missing-reference                                 |
| step.ruleInputs rule not in step.rules          | detached-rule-input                               |
| step.ruleInputs column not an input of the rule | missing-reference                                 |
| sticky.anchor → any object                      | missing-reference / ambiguous-anchor              |
| view.includes / positions → node; view.feature  | missing-reference                                 |
| flow.feature → feature                          | missing-reference                                 |
| node.group, node.parent, group.parent           | missing-reference                                 |
| group.parent chain, node.parent chain loops     | cycle (one problem per cycle, on its smallest id) |

## Editor session state (not document data)

The editor holds only: its transaction origin, the `Y.UndoManager`, the gesture depth, the last
edited object (for burst boundaries) and the id generator. None of this is persisted or exported
(constitution I).
