# Data Model: Flow Playback (007)

No file-format change. Nothing in this feature is written to the deck, the `.sododeck.json` file
or the undo history (FR-025). Three kinds of data are involved:

1. **Document data (read only)**: flows, steps, branches, edges, nodes, rules, from the Yjs deck via
   `useDeckSnapshot`. Step text fields stay editable through `editor.updateStep` exactly as in 006.
2. **Derived data (pure, never stored)**: `FlowAnalysis` from `analyzeFlow` (006) and the new
   played path, player view and overlay marks.
3. **UI state (Zustand, per tab)**: the flow mode session.

## 1. UI state: flow mode session (`state/ui-store.ts`)

`activeFlow` (006) is extended. Flow mode is **derived**: `activeFlow !== null && flowSession === null`.

```ts
export type ActiveFlow = {
  flowId: string;
  /** Current step in flow mode; the selected step in an edit session (006). */
  stepId: string | null;
  /** A branch opened in the inspector (006). */
  branchId: string | null;
  /** Chosen alternative at the fork; null = the first ("a"). Forgotten on exit (Q3). */
  alternativeId: string | null;
  playing: boolean;
  speed: 1 | 2;
} | null;

/** Flow row marked "last played" after exit (Q5); cleared by openFlow and resetForDeck. */
lastPlayedFlowId: string | null;
```

| Action                       | Effect                                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openFlow(flowId, stepId?)`  | `activeFlow = { flowId, stepId: stepId ?? first played step ?? null, branchId: null, alternativeId: alternative of stepId ?? null, playing: false, speed: 1 }`; clears selection, focused edge, popover, `lastPlayedFlowId`. |
| `exitFlow()`                 | `lastPlayedFlowId = activeFlow.flowId`; `activeFlow = null`; selection empty (deck inspector).                                                                                                                               |
| `setCurrentStep(stepId)`     | `stepId`, `branchId: null`, `playing: false`.                                                                                                                                                                                |
| `setPlaying(playing)`        | `playing`.                                                                                                                                                                                                                   |
| `setSpeed(speed)`            | `speed`, `playing: false`.                                                                                                                                                                                                   |
| `setAlternative(id, stepId)` | `alternativeId`, `stepId` (re-homed by the caller with `rehome`), `playing: false`.                                                                                                                                          |
| `advance(stepId)` (autoplay) | `stepId`, keeps `playing`.                                                                                                                                                                                                   |
| `resetForDeck()`             | also `lastPlayedFlowId = null`.                                                                                                                                                                                              |

The 006 `setActiveFlow(id | null)` stays as a thin alias: `id` → `openFlow(id)`, `null` →
`exitFlow()` (callers in `flow-row.tsx`, `flow-panel.tsx`, `flow-session.ts`, `use-flow-sync.ts`).
`startEditing` / `startRecording` keep setting `activeFlow` (with `playing: false`); the session's
presence turns flow mode off.

### State transitions

```text
            click flow row / Done / "Used in flows"
  Canvas ─────────────────────────────────────────► Flow mode (paused, step 1, 1×, alt a)
    ▲                                                   │  ▲
    │ Esc / × / Back to canvas / flow deleted           │  │ Done / Cancel of edit mode
    └───────────────────────────────────────────────────┘  │   (openFlow on step 1)
                                                        │  │
                                          "Edit steps"  ▼  │
                                                   Edit session (006)

  In flow mode:  paused ──Play──► playing ──(last step | ←/→ | click | speed | branch | hidden)──► paused
                 playing ──every stepMs / speed──► next step
```

## 2. Derived: played path (`editor/flows/played-path.ts`, pure)

| Name               | Shape                                                                                                                                                              | Rules                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `PlayedPath`       | `{ steps: readonly PathStep[]; alternative: BranchPath \| null; index: ReadonlyMap<stepId, number> }`                                                              | `analysis.main` + chosen alternative's steps; alternative = the one with `alternativeId`, else `branches[0]`, else null. |
| `PlayerView`       | `{ position: number; total: number; label: string; previous: id \| null; next: id \| null; showPicker: boolean; forkNumber: string \| null; segments: Segment[] }` | `label` = "Step {number} of {total}"; `showPicker` when current is the fork step or on an alternative.                   |
| `Segment`          | `{ stepId; number; filled: boolean; current: boolean; errorPath: boolean; broken: boolean }`                                                                       | `filled` for positions ≤ current.                                                                                        |
| `stepForNode`      | `(played, nodeId) → stepId \| null`                                                                                                                                | First played step with `from === nodeId \|\| to === nodeId`.                                                             |
| `stepForEdge`      | `(played, edgeId, currentStepId) → stepId \| null`                                                                                                                 | First played step on the edge after the current one, wrapping.                                                           |
| `rehome`           | `(analysis, toAlternativeId, currentStepId) → stepId \| null`                                                                                                      | Current on main path → unchanged; on an alternative → same position in the new one, else its last step, else fork step.  |
| `stepAnnouncement` | `(deck, played, step) → string`                                                                                                                                    | "Step 5 of 8: Order Service → Payment Service"; + ", branch <label>"; broken → "Step n of m: connection deleted".        |

Validation: every function tolerates an unknown step id (returns the first step or `null`) so a
removal from another tab between render and event never throws.

## 3. Derived: canvas marks (`editor/flows/flow-overlay.ts`)

`flowOverlay(deck, analysis, session, hoverEdgeId, activeStepId, playback?)` gains the optional
`playback: { played: ReadonlySet<string>; currentStepId: string | null; speed: 1 | 2 } | null`.

| Mark           | New field                            | Meaning                                                       |
| -------------- | ------------------------------------ | ------------------------------------------------------------- |
| `EdgeFlowMark` | `inPath: boolean`                    | A played step travels the edge → class `in-flow`, not dimmed. |
| `EdgeFlowMark` | `current: { speed: 1 \| 2 } \| null` | The current step's edge: width 3, filled label, token.        |
| `NodeFlowMark` | `inPath: boolean`                    | From/to of a played, non-broken step → `in-flow`.             |
| `NodeFlowMark` | `currentStep: boolean`               | From/to of the current step → ring + `aria-current="step"`.   |

`NodeFlowMark.startsHere` becomes optional (006 recording only). Both new fields are part of the
cache checks in `deck-to-flow.ts` (`sameMark`, node check); `className: 'in-flow'` is set from
`inPath`. Outside flow mode `playback` is `null` and marks are exactly as in 006.

## 4. Derived: JSON panel entry

`selectionView(deck, selection, activeFlow, flowMode)` in flow mode with a current step returns
`label: "Step <number>"`, `fullLabel: "Step <number>: <flow title>"`, `entries: [{ collection:
'steps', value: step }]` (text from `serializeEntry('steps', step)`, [contracts/model-additions.md](contracts/model-additions.md)).

## 5. Document entities read (unchanged)

| Entity | Fields used                                                                 |
| ------ | --------------------------------------------------------------------------- |
| Flow   | `id`, `title`, `steps`, `branches` (via `analyzeFlow`), `feature`           |
| Step   | `id`, `edge`, `title`, `description`, `condition`, `sla`, `rules`, `branch` |
| Branch | `id`, `label`, `condition`, `errorPath`                                     |
| Edge   | `id`, `from`, `to`, `label`, `protocol`, `direction`                        |
| Node   | `id`, `title`, `type` (kind tile)                                           |
| Rule   | `id` (key in `rules`), `title`                                              |
