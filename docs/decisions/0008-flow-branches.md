# 0008. Flow branches: a flat step list with branch membership

- **Status:** Accepted
- **Date:** 2026-09-27
- **Feature:** `specs/006-flow-authoring` (spec, research R1, R4, R5, contracts)

## Context

Feature 006 lets architects record flows by clicking connections, and a flow may fork into
alternative paths (F-4, design 45–46): "payment ok" and "payment failed", the latter drawn as an
error path. Schema v1 has flows with an ordered, flat `steps` array and no way to say that a step
belongs to an alternative. The clarified spec fixes the semantics: a fork ends the main path, so a
flow branches at one step only, and there is one level of branching. Step ids, step references
(`flows/<id>/steps/<id>`), the cascade, `observeDeck` children and the JSON panel all assume the
flat array, and 007's player will walk it.

## Decision

1. **Two additive optional fields, no version bump.**
   - `Flow.branches?: Branch[]` with `Branch = { id, label, condition, errorPath?, description? }`.
     The array order is the alternative order: index 0 is "a", index 1 is "b".
   - `Step.branch?: Id`, the id of a branch of the same flow. A step without it is on the main
     path.

2. **The branch point is derived**: it is the last main-path step. There is no `from` field, so
   a dangling fork point is impossible and "one branch point per flow, one level" is encoded in
   the shape itself.

3. **`steps` stays one flat array** in a normal order that the model's ops keep: main-path steps
   first, then each branch's steps grouped in `branches` order. The order within a path is the
   relative order of its steps in the array. Files not in normal order load unchanged, and
   `analyzeFlow` (pure, in `@sododeck/model`) reads each path by relative order. Numbers (`4a`) and
   from/to are derived, never stored.

4. **Empty `label` and `condition` are valid in the file.** Recording writes to the deck as the
   user clicks (constitution I), so a half-made branch must never make the deck unsaveable or
   unexportable. "Required" is enforced by the UI's Done (FR-023) and later by 015's Problems
   panel.

5. **The edit-mode Cancel checkpoint.** Entering edit mode captures an opaque, frozen copy of the
   flow's `steps` and `branches` (`captureFlowStructure`). Cancel applies it with one editor op,
   `restoreFlowStructure`, in one transaction and one undo step: steps and branches added in the
   session go, removed ones come back, order and membership are restored, and objects that still
   exist keep their **current** text fields (clarification Q1). The checkpoint lives in the UI
   session only and is never rendered or read as current data. This is the one justified
   exception to "no document data in UI state" (plan, Complexity Tracking, approved by the
   founder).

## Alternatives considered

- **Nested steps** (`step.branches[].steps[]`): breaks every flat step op, step refs and change
  tracking, and needs a Yjs layout migration (ADR 0005).
- **A marker on the first step of each branch** (`step.branch = { label, condition, … }`):
  membership would depend on array position, so a reorder silently moves steps between paths.
- **`Branch.from`** (an explicit fork step): redundant under "a fork ends the main path", and it
  can dangle after a step is removed.
- **Cancel via `UndoManager`** (undo back to a marker): also reverts text edits and cannot skip
  edits from other tabs. **`Y.snapshot`**: needs `gc: false` on every deck (unbounded growth).
  **A draft outside the deck**: duplicates document data and makes the JSON panel and autosave lie.

## Consequences

- Every existing step op, step reference, cascade rule and change event keeps working. New ops
  (`appendStep`, `addBranch`, `updateBranch`, `removeBranch`, `restoreFlowStructure`) keep the
  normal order; `moveStep` refuses moves across paths or past the branch step.
- Adding the first branch after a step that main-path steps follow moves those steps into a new
  alternative "a" with an empty label and condition, then adds the new branch as "b", in one undo
  step.
- Removing a branch removes its steps. Removing the branch step while branches exist moves the
  branch point to the new last main-path step (the UI refuses this with a message).
- `observeDeck` reports branch changes as `child.kind: 'branch'`; `RemovalTarget` gains
  `branches`; `checkIntegrity` reports a `step.branch` that names no branch of its flow.
- Branch ids are unique across the deck like every other id.
