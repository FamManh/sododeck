# Data Model: Flow Authoring (006)

Document data lives in the Yjs deck and changes only through `@sododeck/model` (constitution I).
UI state lives in `useUiStore`. Derived data is computed and never stored (FR-038).

## 1. Document data (`.sododeck.json`, schema v1, additive)

Existing and unchanged: `Feature { id, title, description?, owner? }` and `Flow { id, title,
feature?, description?, trigger?, outcome?, owner?, tags?, links?, steps }`.

### New: `Flow.branches?: Branch[]`

| Field         | Type       | Rules                                                                                                  |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `id`          | `Id`       | Stable, generated with prefix `branch-`, unique across the deck.                                       |
| `label`       | `string`   | Required key; may be empty while being authored. Done refuses empty (FR-023).                          |
| `condition`   | `string`   | Required key; may be empty while being authored. Done refuses empty (FR-023).                          |
| `errorPath`   | `boolean?` | Absent means false. When true, the branch is drawn as an error path (FR-026).                          |
| `description` | `string?`  | Markdown. Not edited in 006's UI; included so 008 and file authors can use it without a format change. |

The array order is the alternative order: index 0 is "a", index 1 is "b", and so on. Branches are
never reordered in 006.

### New: `Step.branch?: Id`

- This is the id of a branch in the **same** flow. When absent, the step is on the main path.
- The model refuses a `branch` that names no branch of the flow (`missing-reference`).

### Structural rules (the model enforces them in its ops)

1. **The branch point is derived**: it is the last main-path step. A flow with `branches` must
   have at least one main-path step.
2. **One level**: branches have no branches (the shape can't express it).
3. **Normal order of `steps`**: main-path steps first, then each branch's steps grouped in
   `branches` order. Ops keep this. Imported files that aren't in this order load unchanged, and
   `analyzeFlow` uses relative order within each path.
4. The same edge may appear in several steps.
5. **Removing a branch** removes the branch and its steps.
6. **Removing a flow** removes its steps and branches (they are owned by the flow).
7. **Removing a feature** detaches its flows (existing).
8. **Removing an edge** keeps the steps that use it and reports them broken (existing, ADR 0005).

### Example

```json
{
  "id": "flow-place-order",
  "title": "Place order",
  "feature": "feature-delivery",
  "branches": [
    { "id": "branch-ok", "label": "payment ok", "condition": "payment.status == \"authorized\"" },
    {
      "id": "branch-failed",
      "label": "payment failed",
      "condition": "payment.status == \"declined\"",
      "errorPath": true
    }
  ],
  "steps": [
    { "id": "step-1", "edge": "e1" },
    { "id": "step-2", "edge": "e2" },
    { "id": "step-3", "edge": "e5", "title": "Authorize payment" },
    { "id": "step-4a", "edge": "e7", "branch": "branch-ok" },
    { "id": "step-5a", "edge": "e9", "branch": "branch-ok" },
    { "id": "step-4b", "edge": "e30", "branch": "branch-failed" },
    { "id": "step-5b", "edge": "e31", "branch": "branch-failed" }
  ]
}
```

The ids here are illustrative. Generated ids are opaque, like `step-k3j9x0q2ab`.

## 2. Derived data (`packages/model/src/flow-paths.ts`, never stored)

```ts
interface FlowAnalysis {
  main: PathStep[]; // main path, in order
  branchStepId: Id | null; // last main-path step when branches exist
  branches: BranchPath[]; // in `branches` order
  problems: FlowProblem[]; // chain breaks, broken steps, empty branch fields, empty flow
  canFinish: boolean; // ≥1 step, no chain break, no empty branch label/condition (FR-012)
}
interface BranchPath {
  branch: Branch;
  letter: string; // 'a', 'b', …
  steps: PathStep[];
  nextStart: Id | null;
}
interface PathStep {
  step: Step;
  number: string; // '3', '4a', '5b'
  from: Id | null; // null when broken
  to: Id | null;
  broken: boolean; // step.edge no longer exists
  chainBreak: boolean; // doesn't start at the previous non-broken step's `to` (broken steps skipped)
}
// The main path's next start node is `nextStart(main)`; each branch path has its own `nextStart`.
```

- **Numbering**: main steps get `1…n`. A branch step's number is `n + position` followed by the
  branch letter.
- **Chain check**: the first step of a branch compares with the branch step's `to`. Broken steps
  are skipped in both directions (clarification Q2).
- **Next start**: the `to` of the last non-broken step on the path, or `null` for an empty main
  path, meaning any edge is allowed.

## 3. UI state (`apps/app/src/state/ui-store.ts`, never exported)

```ts
type ActiveFlow = { flowId: Id; stepId: Id | null; branchId: Id | null } | null;

type FlowSession = null | {
  mode: 'record' | 'edit'; // record = new flow; edit = existing flow ("Editing …")
  flowId: Id | null; // null until the first step of a new flow is recorded (research R3)
  pendingTitle: string; // name typed at "+ New flow" (record mode, before first step)
  featureId: Id | null;
  target: { kind: 'main' } | { kind: 'branch'; branchId: Id }; // path new clicks extend
  addingBranch: boolean; // "adding branch after step n" chip + NEW BRANCH inspector
  recorded: Id[]; // step ids added this session, for ⌘Z "undo last step" (FR-014)
  checkpoint: FlowCheckpoint | null; // edit mode only, opaque, from captureFlowStructure
  invalid: { edgeId: Id; stepNumber: string; branchFromStep: Id | null } | null;
  candidateEdgeId: Id | null; // keyboard focus among candidates
};
```

Also added: `hoverEdgeId: Id | null`, `flowFilter: string`, and
`pendingDelete: { targets: RemovalTarget[] } | null` (widened from `Selection`).

### Session state transitions

```text
idle ──"+ New flow"(name)──▶ record(flowId=null)
record(flowId=null) ──valid click──▶ record(flowId=F)  [add flow + step 1, one batch]
record/edit ──valid click──▶ same  [addStep on target path, recorded.push]
record/edit ──invalid click──▶ same + invalid  [nothing written; popover, live region]
invalid ──"Add as branch from step k"──▶ addingBranch  [addBranch(F, after k, firstEdge)]
record/edit ──B on branch-eligible step──▶ addingBranch
addingBranch ──Done (label+condition non-empty)──▶ record/edit, target=that branch
record/edit ──Done (canFinish)──▶ idle, activeFlow=F, toast
record ──Cancel (confirmed if recorded>0)──▶ idle  [remove flow F if created]
edit ──Cancel (confirmed if structure changed)──▶ idle  [restoreFlowStructure(F, checkpoint)]
any ──flow F removed (this or another tab)──▶ idle  [useFlowSync]
```

## 4. Validation summary (spec → rule)

| Spec                     | Rule                                                                                                        | Where                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| FR-006, FR-002           | Flow and feature titles are non-empty (`Text`)                                                              | schema + UI inline error         |
| FR-008, FR-010           | Contiguity for new clicks                                                                                   | `recordEdge` via `analyzeFlow`   |
| FR-012                   | Done requires `analysis.canFinish`                                                                          | UI                               |
| FR-021                   | `chainBreak` rows flagged                                                                                   | `analyzeFlow`                    |
| FR-023                   | Empty branch label or condition → inline errors, not saved                                                  | UI + `analysis.problems`         |
| FR-029, edge case        | A branch only after the branch step (or any main step when there are no branches); never from a branch step | model op + UI message            |
| FR-020, clarification Q4 | Moves stay inside their path; the branch step stays last on the main path                                   | `use-sortable-list` + model op   |
| FR-032                   | `broken` when `step.edge` is missing                                                                        | `analyzeFlow` / `checkIntegrity` |
