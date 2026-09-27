import type { BranchPath, FlowAnalysis, PathStep } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import { nodeTitle } from './session-path';

/**
 * The played path of flow mode (007 data-model §2, research R2): the main path followed by one
 * chosen alternative. Pure; every function tolerates unknown step ids, since a removal in another
 * tab can land between a render and an event.
 */
export interface PlayedPath {
  steps: readonly PathStep[];
  /** The chosen alternative, `null` for a flow without branches. */
  alternative: BranchPath | null;
  /** Position (0-based) of each played step, by id. */
  index: ReadonlyMap<string, number>;
}

export interface Segment {
  stepId: string;
  number: string;
  filled: boolean;
  current: boolean;
  errorPath: boolean;
  broken: boolean;
}

export interface PlayerView {
  /** 1-based position of the current step. */
  position: number;
  total: number;
  /** "Step 4 of 8", "Step 4b of 5". */
  label: string;
  previous: string | null;
  next: string | null;
  /** The branch picker shows from the fork step on (FR-015). */
  showPicker: boolean;
  /** Number of the fork step, `null` without branches. */
  forkNumber: string | null;
  segments: Segment[];
}

/** Main path + the alternative `alternativeId` (unknown or `null` → the first one). */
export function playedPath(analysis: FlowAnalysis, alternativeId: string | null): PlayedPath {
  const alternative =
    analysis.branches.find((b) => b.branch.id === alternativeId) ?? analysis.branches[0] ?? null;
  const steps = [...analysis.main, ...(alternative?.steps ?? [])];
  return { steps, alternative, index: new Map(steps.map((s, i) => [s.step.id, i])) };
}

/** The current step: `stepId` when played, else the first played step. */
export function currentOf(played: PlayedPath, stepId: string | null): PathStep | null {
  const i = stepId === null ? undefined : played.index.get(stepId);
  return played.steps[i ?? 0] ?? null;
}

export function playerView(
  analysis: FlowAnalysis,
  played: PlayedPath,
  currentStepId: string | null,
): PlayerView | null {
  const current = currentOf(played, currentStepId);
  if (current === null) return null;
  const i = played.index.get(current.step.id) ?? 0;
  const forkIndex =
    analysis.branchStepId === null ? undefined : played.index.get(analysis.branchStepId);
  const errorPath = played.alternative?.branch.errorPath === true;
  const total = played.steps.length;
  return {
    position: i + 1,
    total,
    label: `Step ${current.number} of ${String(total)}`,
    previous: played.steps[i - 1]?.step.id ?? null,
    next: played.steps[i + 1]?.step.id ?? null,
    showPicker: forkIndex !== undefined && i >= forkIndex,
    forkNumber: forkIndex === undefined ? null : (played.steps[forkIndex]?.number ?? null),
    segments: played.steps.map((s, k) => ({
      stepId: s.step.id,
      number: s.number,
      filled: k <= i,
      current: k === i,
      errorPath: errorPath && s.branchId !== null,
      broken: s.broken,
    })),
  };
}

/** First played step touching the node, or `null`. */
export function stepForNode(played: PlayedPath, nodeId: string): string | null {
  return played.steps.find((s) => s.from === nodeId || s.to === nodeId)?.step.id ?? null;
}

/** The next played step on the edge after the current one, wrapping; `null` off the path. */
export function stepForEdge(
  played: PlayedPath,
  edgeId: string,
  currentStepId: string | null,
): string | null {
  const n = played.steps.length;
  const from = currentStepId === null ? -1 : (played.index.get(currentStepId) ?? -1);
  for (let k = 1; k <= n; k++) {
    const s = played.steps[(from + k + n) % n];
    if (s !== undefined && s.step.edge === edgeId) return s.step.id;
  }
  return null;
}

/**
 * Where the current step goes when the alternative changes: unchanged on the main path, the same
 * position in the new alternative, its last step when shorter, the fork step when empty.
 */
export function rehome(
  analysis: FlowAnalysis,
  toAlternativeId: string,
  currentStepId: string | null,
): string | null {
  const target = analysis.branches.find((b) => b.branch.id === toAlternativeId);
  const current = currentStepId === null ? undefined : analysis.byStepId.get(currentStepId);
  if (target === undefined || current === undefined || current.branchId === null) {
    return current?.step.id ?? analysis.main[0]?.step.id ?? null;
  }
  const from = analysis.branches.find((b) => b.branch.id === current.branchId);
  const position = from?.steps.findIndex((s) => s.step.id === currentStepId) ?? 0;
  const step = target.steps[Math.min(position, target.steps.length - 1)];
  return step?.step.id ?? analysis.branchStepId;
}

/** "Step 5 of 8: Order Service → Payment Service[, branch payment failed]" (FR-023). */
export function stepAnnouncement(deck: SododeckFile, played: PlayedPath, step: PathStep): string {
  const head = `Step ${step.number} of ${String(played.steps.length)}: `;
  const route = step.broken
    ? 'connection deleted'
    : `${nodeTitle(deck, step.from)} → ${nodeTitle(deck, step.to)}`;
  const branch =
    step.branchId !== null && played.alternative !== null
      ? `, branch ${played.alternative.branch.label}`
      : '';
  return head + route + branch;
}
