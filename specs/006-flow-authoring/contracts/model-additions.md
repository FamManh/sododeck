# Contract: additions to `@sododeck/schema` and `@sododeck/model` (006)

These additions build on the 002 contract (`specs/002-yjs-model/contracts/model-api.md`) and the
003 and 004 additions. Nothing that exists today changes meaning. The shape is recorded in ADR 0008
(research R1).

## Schema (`packages/schema/schema/v1.json`, no version bump)

- New `$defs.Branch`:
  - Required: `id` (`Id`), `label` (`string`, may be empty), `condition` (`string`, may be empty).
  - Optional: `errorPath` (`boolean`), `description` (`string`).
  - `additionalProperties: false`, and every property has a `description`.
- `Flow.properties.branches`: an optional array of `Branch`, placed after `links` and before
  `steps` (the key order in the file).
- `Step.properties.branch`: an optional `Id` placed after `edge`, described as "Id of the branch of
  this flow the step belongs to. Absent: main path."
- `examples/full.sododeck.json` gets one flow with two branches (one of them an error path).
- `test/fixtures.ts` gets invalid cases: a branch without `condition`, `errorPath: "yes"`, and an
  unknown key in a branch.
- Run `pnpm schema:generate`. The Ajv/Zod parity test stays green.

## Model: reads (pure, JSON in → JSON out, worker-safe)

```ts
/** Paths, display numbers, from/to, broken and chain-break flags of one flow (data-model §2). */
function analyzeFlow(flow: Flow, edges: ReadonlyMap<Id, Edge> | readonly Edge[]): FlowAnalysis;

/** Opaque restore point of a flow's structure (steps + branches), for edit-mode Cancel. */
function captureFlowStructure(file: SododeckFile, flowId: Id): FlowCheckpoint;
type FlowCheckpoint = { readonly flowId: Id; readonly __brand: 'FlowCheckpoint' /* opaque */ };
```

## Model: `DeckEditor` ops (validate first, throw `DeckEditError` without writing)

```ts
interface DeckEditor {
  // …existing…
  /**
   * Adds a branch after main-path step `afterStepId`, optionally with its first step.
   * - If the flow has no branches and main-path steps follow `afterStepId`, those steps first move
   *   into a new branch "a" (label "", condition ""), then the new branch is appended ("b").
   * - If the flow has branches, `afterStepId` must be the branch step (last main-path step).
   * - Refused (`invalid`) when `afterStepId` is on a branch, or is not the branch step while
   *   branches exist.
   * One transaction, one undo step. Returns the new branch id (and its first step id, if given).
   */
  addBranch(
    flowId: Id,
    afterStepId: Id,
    data: { label?: string; condition?: string; errorPath?: boolean; firstEdge?: Id },
  ): { branchId: Id; stepId: Id | null };

  updateBranch(flowId: Id, branchId: Id, patch: Patch<Branch>): void; // capture key flows:<f>:branch:<b>
  removeBranch(flowId: Id, branchId: Id): RemovalResult; // removes the branch and its steps

  /** Appends a step at the end of a path (main when branchId is null), keeping normal order. */
  appendStep(flowId: Id, branchId: Id | null, data: NewStep): Id;

  /** Restores steps + branches to the checkpoint; objects that still exist keep current text fields. */
  restoreFlowStructure(flowId: Id, checkpoint: FlowCheckpoint): void;
}
```

- `moveStep(flowId, stepId, toIndex)` (existing) now refuses (`invalid`) a move that would:
  - change the step's path, or
  - put a main-path step after the branch step while branches exist.

  `toIndex` is still the index in `flow.steps`. The app computes it from the position within the
  path.

- `removeStep` on the branch step while branches exist is allowed in the model: the branch point
  becomes the new last main-path step. The UI refuses it with a message (research R5).
- `addStep` and `updateStep` also validate `branch` (it must name a branch of the flow).

## Model: change tracking and removal

- `ObjectRef.child.kind` gains `'branch'`. Branch adds, updates and removes are reported like steps
  (`{ scope: 'flows', id: flowId, child: { kind: 'branch', id } }`).
- `RemovalTarget` gains `{ scope: 'branches'; flowId: Id; id: Id }`. `previewRemoval` supports it,
  so the confirm dialog can count the steps that go with a branch.
- `checkIntegrity` reports a step whose `branch` names no branch of its flow as
  `missing-reference` (`field: 'branch'`, `targetType: 'branch'`). This can only happen in
  hand-edited files.

## Guarantees (tests in `packages/model/test`)

- **Round-trip**: a flow with two branches (one error path, one empty label), a step with
  `branch`, and a broken step survive JSON → Yjs → JSON byte-identical (`round-trip.test.ts`).
- **Rename safety**: changing a branch label or a flow or feature title never changes an id or
  breaks `step.branch` (constitution III).
- **`analyzeFlow`**: numbering (`1..n`, `4a`, `5b`), from/to, chain breaks, broken skip rule,
  `canFinish`, and next start for each path (`flow-paths.test.ts`).
- **`addBranch`**: splitting into "a" and "b"; refusal cases; one undo step (`edit.test.ts`,
  `undo.test.ts`).
- **`restoreFlowStructure`**:
  - Steps added in the session are removed and removed ones come back.
  - Order and membership are restored.
  - Text edited in the session is kept.
  - A step removed by another origin after capture comes back.
  - It is one undo step.
- **Cascade**: `removeBranch` removes its steps; removing an edge leaves branch steps broken;
  removing a flow reports branch children (`cascade.test.ts`).
- **Pure reads** run without Yjs in a worker (import check as for `serializeEntry`).
