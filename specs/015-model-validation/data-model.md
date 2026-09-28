# Data Model: Model Validation (Problems)

No file-format change. Everything below is **derived** from `SododeckFile` and never stored in the
deck, the JSON panel, exports or the undo history (§g-23, FR-010).

## Problem (packages/model)

```ts
type ProblemKind =
  | 'orphan'
  | 'duplicate-connection'
  | 'step-without-connection'
  | 'broken-chain'
  | 'incomplete-flow'
  | 'overlapping-conditions'
  | 'missing-rule'
  | 'rule-without-catch-all'
  | 'invalid-rule-cells'
  | 'broken-reference';

type ProblemTarget =
  | { type: 'node'; id: Id }
  | { type: 'edges'; ids: Id[] } // one or more (duplicates)
  | { type: 'flow'; flowId: Id; stepId?: Id; branchIds?: Id[] }
  | { type: 'rule'; ruleId: Id }
  | { type: 'object'; ref: ObjectRef }; // holder of a broken reference

interface Problem {
  key: string; // stable: kind + sorted ids, e.g. "broken-chain:f1:s4"
  kind: ProblemKind;
  target: ProblemTarget;
  title: string; // "Orphan component"
  detail: string; // "Legacy Invoicer has no connections"
  objectTitle: string; // sort key
  order: number; // step index within a flow, else 0
}

interface DeckProblems {
  list: Problem[]; // sorted (research R3)
  total: number;
  byObject: ReadonlyMap<Id, Problem[]>; // node, edge, flow and rule ids → problems (glyphs)
}
```

## Kinds, sources and targets

| Kind                      | Source                                                         | Target                      | Title / detail (example)                                                       |
| ------------------------- | -------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| `orphan`                  | new                                                            | node                        | Orphan component · Legacy Invoicer has no connections                          |
| `duplicate-connection`    | new                                                            | edges (all copies)          | Duplicate connection · API Gateway → Tracking Service appears twice            |
| `step-without-connection` | `analyzeFlow` `broken-step`                                    | flow + step                 | Step without connection · Proof of delivery · step 2 used a deleted connection |
| `broken-chain`            | `analyzeFlow` `chain-break`                                    | flow + step                 | Broken flow · Failed delivery · step 4 doesn't continue from step 3            |
| `incomplete-flow`         | `analyzeFlow` `empty-flow`, `empty-branch-*`, `unknown-branch` | flow (+ step or branch)     | Incomplete flow · Refund · branch b has no condition                           |
| `overlapping-conditions`  | new                                                            | flow + branchIds            | Overlapping conditions · Place order · branches a and c both say "paid"        |
| `missing-rule`            | `checkIntegrity` (`rules` → `rule`)                            | holder (node / flow + step) | Missing rule · Order Service uses a rule that was deleted                      |
| `rule-without-catch-all`  | `ruleChecks().catchAll === false`                              | rule                        | Rule without catch-all · Delivery tier · some inputs match no row              |
| `invalid-rule-cells`      | `ruleChecks().invalidCells`                                    | rule                        | Invalid rule cells · Delivery tier · 2 cells can't be read                     |
| `broken-reference`        | `checkIntegrity` (all other kinds and fields)                  | object (holder)             | Broken reference · Sticky "Check SLA" points to something that was deleted     |

`byObject` indexes each problem under every node id, edge id, flow id and rule id it names (a
missing rule is indexed on its holder).

## Derived app state

- **Problems store** (per deck, not Zustand): latest `DeckProblems | null`, the snapshot it was
  computed from, and a subscribe function (`useSyncExternalStore`).
- **UI store** gains `problemCursor: string | null`: the last visited problem key for ⌘. / ⇧⌘.
  Reset on deck change.
- **ProblemMarks** (canvas overlay): `Map<Id, { count: number; titles: string[] }>` built from
  `byObject` for nodes and edges.

## Rules

- Problems follow the current snapshot only; a result computed for an older snapshot is dropped.
- Every problem has at least one target id that exists in the deck, except `missing-rule` and
  `broken-reference`, whose target is the holder that exists.
- `total === list.length`.
