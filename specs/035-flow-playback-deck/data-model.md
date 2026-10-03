# Data Model: Flow Playback "Deck"

**No stored data changes.** Nothing is added to the Yjs document, `packages/schema`, `packages/model` or the `.sododeck.json` file. Everything below is derived at render time (constitution I, II).

## Inputs (existing)

| Name           | From                                               | Fields used                                                                           |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `FlowAnalysis` | `analyzeFlow` (`packages/model/src/flow-paths.ts`) | `main`, `branches`, `byStepId`; `PathStep { id, number, branchId, from, to, broken }` |
| `PlayedPath`   | `flows/played-path.ts` `playedPath()`              | ordered `steps`, `index: Map<stepId, number>`                                         |
| `ActiveFlow`   | `state/ui-store.ts`                                | `flowId`, `stepId`, `alternativeId`, `playing`, `speed`                               |

## Derived types (new, in `flows/step-marks.ts`)

```ts
type StepState = 'played' | 'current' | 'upcoming';

interface NodeStepMark {
  state: StepState;
  /** Step number to print; null for played cards (they show ✓). */
  number: string | null;
}

type EdgeStepState = 'played' | 'current' | 'upcoming';
```

- `stepMarks(path, currentIndex): Map<NodeId, NodeStepMark>`
- `edgeStateOf(pathIndex, currentIndex): EdgeStepState`

### Rules

1. Current step `c`: its target card → `current` with `number = step.number`.
2. Source of step `c` and source of step 1 → `played` (`number = null`).
3. Target of any step with index `< c` → `played`.
4. Target of any step with index `> c` that has no earlier role → `upcoming`, `number` = first such step's number.
5. A card with several roles keeps the highest of current > played > upcoming reached up to `c`.
6. Steps not on the played path (other alternatives) produce no mark.
7. Broken steps (`broken`) still mark their target card; their edge has no token.

### State transitions

`upcoming → current → played` as the current step moves forward; the reverse as it moves back. Leaving flow mode clears all marks (no mark exists outside flow mode).

## Extended overlay marks (existing types, new fields)

| Type                 | Field                           | Meaning                                                                                               |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `NodeFlowMark`       | `step: NodeStepMark \| null`    | replaces the boolean `currentStep` use for painting (`currentStep` kept for `aria-current`)           |
| `EdgeFlowMark`       | `state: EdgeStepState`          | played / current / upcoming for the stroke; `current: { speed, number }` gains `number` for the token |
| collapsed group data | `flowInside: StepState \| null` | replaces `'current' \| 'path'`                                                                        |
| `Segment` (player)   | `nextFork: boolean`             | dashed outline on the next branch point's segment                                                     |

## Validation

- No stored validation. Unit tests cover the rules table: linear flow, first step, last step, branch switch, loop-back card, self-loop step, broken step, collapsed group folding.
- A round-trip/regression test asserts the serialised deck is identical before and after opening, stepping and leaving a flow (SC-007).
