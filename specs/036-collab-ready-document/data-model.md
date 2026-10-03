# Data Model: Collaboration-Ready Deck Document (036)

Two things are described here: the **stored document** (the Yjs layout, which changes) and the
**file** (`.sododeck.json`, which does not). Decisions are in [research.md](research.md).

## The file: unchanged

`packages/schema/schema/v1.json` is not edited. Every list is still a JSON array in list order,
`rules` is still an object keyed by rule id, rule rows still carry `when` / `then` arrays, text is
still a string, and key order is still the schema's property order (ADR 0004 §10, ADR 0005 §6).

## The stored document (layout 2)

Replaces the layout table of ADR 0005 §1. Root names are unchanged; their types change.

| Root       | Type               | Contents                                                                                                             |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `meta`     | `Y.Map`            | `$schema`, `version`, `name?`, `description` (`Y.Text`), `tags?` (`Y.Array`), `swatches` (`Y.Array`)                 |
| `nodes`    | `Y.Map<id, Y.Map>` | one map per component                                                                                                |
| `groups`   | `Y.Map<id, Y.Map>` | one map per group                                                                                                    |
| `edges`    | `Y.Map<id, Y.Map>` | one map per connection                                                                                               |
| `views`    | `Y.Map<id, Y.Map>` | view fields as before (`includes`, filters, `pinned`, `collapsed` → `Y.Array`; `positions`, `groupFrames` → `Y.Map`) |
| `features` | `Y.Map<id, Y.Map>` | one map per feature                                                                                                  |
| `flows`    | `Y.Map<id, Y.Map>` | `steps` → `Y.Map<id, Y.Map>`, `branches` → `Y.Map<id, Y.Map>` (both always present)                                  |
| `rules`    | `Y.Map<id, Y.Map>` | `inputs`, `outputs`, `rows` → `Y.Map<id, Y.Map>` (always present)                                                    |
| `stickies` | `Y.Map<id, Y.Map>` | one map per note                                                                                                     |

### Inside a list item

| Key              | Type      | Meaning                                                                                                                                                                                         |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(map key)_      | id        | The item's id. There is no `id` field inside the map.                                                                                                                                           |
| `$order`         | string    | Fractional-index key (base 62). The list is read sorted by (`$order`, id). Rules carry one too: the file's `rules` object is written in that order, so every client exports the same key order. |
| `$blank:<field>` | `true`    | Present only when `<field>` was given explicitly empty (`description: ""`, `branches: []`) and must be emitted empty.                                                                           |
| long text field  | `Y.Text`  | Always present. See "Long text".                                                                                                                                                                |
| other fields     | as before | Scalars as plain values; nested objects as `Y.Map`; arrays as `Y.Array` (`toY`). Optional fields absent when unset.                                                                             |

Keys starting with `$` are internal: never output, never reported in `DeckChange.keys`, and cannot
clash with the schema (no property starts with `$` below the root). `meta` is read field by field,
so its `$schema` key is not affected.

### Lists and their order space

| List                                                                  | Lives in                       | Order space                                                       |
| --------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| components, groups, connections, notes, views, features, flows, rules | root map                       | one per collection                                                |
| steps of a flow                                                       | `flow.steps`                   | one per flow, across all paths (flat order, as today's array; R4) |
| branches of a flow                                                    | `flow.branches`                | one per flow                                                      |
| input columns / output columns                                        | `rule.inputs` / `rule.outputs` | one per side                                                      |
| rows                                                                  | `rule.rows`                    | one per rule                                                      |

The **base view** is still "the first view": the lowest (`$order`, id).

### Rule rows

| Key      | Type                      | Meaning                                                  |
| -------- | ------------------------- | -------------------------------------------------------- |
| `$order` | string                    | Row order                                                |
| `cells`  | `Y.Map<columnId, string>` | Always present. A missing key reads as `''` (any value). |

Read: `when = inputs.map(c => cells.get(c.id) ?? '')`, `then = outputs.map(…)`. A key that names
no column is ignored.

### Long text

| Object     | Fields                            |
| ---------- | --------------------------------- |
| deck       | `description`                     |
| component  | `description`                     |
| group      | `description`                     |
| connection | `description`                     |
| feature    | `description`                     |
| flow       | `description`                     |
| step       | `description`, `notes`, `payload` |
| branch     | `description`                     |
| rule       | `description`                     |
| note       | `text` (required)                 |

| Stored state                                | Read as      |
| ------------------------------------------- | ------------ |
| `Y.Text` with characters                    | the string   |
| empty `Y.Text`, no marker                   | field absent |
| empty `Y.Text`, `$blank:<field>` set        | `""`         |
| empty `Y.Text` on a required field (`text`) | `""`         |

| Write                        | Effect                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------- |
| a non-empty string           | splice of the differing middle (common prefix and suffix kept); marker removed    |
| `null` (clear)               | all characters deleted, `Y.Text` kept; marker removed                             |
| `""` (explicit empty string) | all characters deleted; marker set (as today, an explicit empty string is stored) |

### Read-side normalization

- An empty `style` map (no `fill`, no `stroke`) is read as no style.
- A `branches` map with no entries is read as absent unless `$blank:branches` is set.

## Operations: what changes underneath (API unchanged)

| Operation                             | Before                                     | After                                                                                                           |
| ------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| find by id                            | scan the array                             | `map.get(id)`                                                                                                   |
| add (append)                          | `array.push`                               | `map.set(id, object)` with `$order` after the last                                                              |
| add at index (`addStep`, column, row) | `array.insert`                             | `$order` between the neighbours at that index (re-keying a tied run)                                            |
| reorder / move                        | delete + insert a copy                     | one `set('$order', …)` on the item                                                                              |
| remove                                | `array.delete(index)`                      | `map.delete(id)`                                                                                                |
| `addBranch` split                     | sets `branch` on the following steps       | same; `branches` already exists                                                                                 |
| `restoreFlowStructure`                | replaces both arrays                       | diff: delete steps / branches not in the checkpoint, re-create removed ones, restore `edge`, `branch` and order |
| `moveRuleColumn`                      | moves the column and one cell in every row | one `$order` change                                                                                             |
| `setRuleCell`                         | delete + insert in `when` / `then`         | `cells.set(columnId, value)`                                                                                    |
| `removeRuleColumn`                    | deletes the column and each row's cell     | deletes the column and each row's `cells` key                                                                   |
| text field in a patch                 | `map.set(key, string)`                     | `writeText`                                                                                                     |
| view presets on first view edit       | `array.push(3 presets)`                    | three `map.set` with fixed ids and fixed order keys                                                             |

Validation before writing, the delete cascade (ADR 0005 §4, ADR 0010), undo grouping and the
untracked origin are unchanged.

## Derived, never stored

- **Problems** (ADR 0013): unchanged. Derived from the snapshot after every change, local or not.
- **Repair** ([research R9](research.md#r9-check-and-repair-on-receive)): the only write is the
  removal of view entries that name nothing, after a non-local change.

## State transitions

**A list item's order**

```text
created (key after last / between neighbours)
   └─ moved (key replaced) ─┐
   └─ tied with a concurrent item (same key; id decides) ─┤
   └─ re-keyed by a local insert between tied items ──────┘
deleted (map key removed; concurrent edits inside are dropped)
```

**A long text field**

```text
empty ──type──▶ has text ──clear──▶ empty        (file: absent ↔ string ↔ absent)
empty + $blank ──type──▶ has text                (file: "" → string; marker removed)
```

## Round-trip cases to add (`packages/model/test/round-trip.test.ts`)

- `description: ""` on the deck, a component and a step; `notes: ""`, `payload: ""`.
- `text: ""` on a note.
- `branches: []` (existing case stays).
- A flow whose steps are not in normal order (a branch step before a main step).
- A rule with columns and rows where a row's cells include `''`.
- Every example file and the generated 500 / 2,000 decks:
  `serializeDeck(toJSON(fromJSON(f))) === serializeDeck(f)`.
