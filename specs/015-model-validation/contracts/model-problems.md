# Contract: `@sododeck/model` problems API (added by 015)

```ts
export function checkDeck(file: SododeckFile): DeckProblems;
export type { DeckProblems, Problem, ProblemKind, ProblemTarget } from './problems';
```

- Pure and worker-safe (no DOM, no React). Same input → same output (deep-equal), same order.
- Never mutates `file`; never reads a Yjs doc.
- Reuses `analyzeFlow`, `ruleChecks` and `checkIntegrity`; definitions and dedup rules are in
  [research.md](../research.md) R2–R3 and [data-model.md](../data-model.md).
- Performance budget (`packages/model/test/perf.test.ts`, × 3 on CI): 30 ms for a 2,000-node /
  4,000-edge / 40-flow deck.

## Tests (`packages/model/test/problems.test.ts`)

- One case per kind, positive and negative (e.g. A→B + B→A is not a duplicate; a node that is a
  `parent` is not an orphan; a one-node deck has no orphan; empty conditions are not overlapping).
- Dedup: a step whose edge was deleted yields only `step-without-connection`; the step after it
  gets no `broken-chain`; integrity problems on `steps[].edge` / `steps[].branch` are dropped.
- Missing rule on a node and on a step; broken reference on a sticky anchor, a group parent and a
  parent cycle.
- Ordering and keys are stable across two calls and after renaming an unrelated object.
- Clean fixtures: `packages/schema/examples/*.sododeck.json`, the app demo deck and the 008
  logistics deck return `total === 0` (SC-001).
