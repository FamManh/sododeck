/**
 * The path a session extends (006): its steps, where its next step must start and the number that
 * step will get. Pure, over `analyzeFlow`.
 */
import type { FlowAnalysis, PathStep } from '@sododeck/model';
import type { Flow, SododeckFile } from '@sododeck/schema';

import type { SessionTarget } from '../../state/ui-store';

export interface SessionPath {
  steps: readonly PathStep[];
  /** Node the next step must start at; `null` means any edge (the flow's first step). */
  nextStart: string | null;
  /** Display number of the next step on this path, e.g. "4" or "5b". */
  nextNumber: string;
  /** The branch the path is, or `null` for the main path. */
  branchId: string | null;
  errorPath: boolean;
}

/** The path `target` names; the main path when the branch no longer exists. */
export function sessionPath(analysis: FlowAnalysis | null, target: SessionTarget): SessionPath {
  if (analysis === null) {
    return { steps: [], nextStart: null, nextNumber: '1', branchId: null, errorPath: false };
  }
  if (target.kind === 'branch') {
    const branch = analysis.branches.find((b) => b.branch.id === target.branchId);
    if (branch !== undefined) {
      return {
        steps: branch.steps,
        nextStart: branch.nextStart,
        nextNumber: `${String(analysis.main.length + branch.steps.length + 1)}${branch.letter}`,
        branchId: branch.branch.id,
        errorPath: branch.branch.errorPath === true,
      };
    }
  }
  return {
    steps: analysis.main,
    nextStart: analysis.nextStart,
    nextNumber: String(analysis.main.length + 1),
    branchId: null,
    errorPath: false,
  };
}

/** Title of a node, or its id when it is gone. */
export function nodeTitle(deck: SododeckFile, id: string | null): string {
  if (id === null) return '';
  return deck.nodes.find((n) => n.id === id)?.title ?? id;
}

/** "<from> → <to>" of a step, or "Unknown connection" when its edge is gone. */
export function stepRoute(deck: SododeckFile, step: PathStep): string {
  if (step.broken) return 'Unknown connection';
  return `${nodeTitle(deck, step.from)} → ${nodeTitle(deck, step.to)}`;
}

export function findFlow(deck: SododeckFile, flowId: string | null): Flow | undefined {
  return flowId === null ? undefined : deck.flows.find((f) => f.id === flowId);
}
