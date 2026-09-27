/**
 * What a click on an edge does during a session (006 research R9): it starts the flow, extends the
 * target path, or is refused because it does not continue the chain (FR-008, FR-010, FR-011).
 * Pure; `flow-session.ts` performs the result.
 */
import { analyzeFlow } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { FlowSession } from '../../state/ui-store';
import { findFlow, sessionPath } from './session-path';

export type RecordResult =
  | { kind: 'create'; title: string; featureId: string | null; edge: string }
  | { kind: 'append'; branchId: string | null; edge: string }
  | { kind: 'invalid'; stepNumber: string; branchFromStep: string | null };

/**
 * The main-path step a refused edge could branch from ("Add as branch from step k"): a flow
 * without branches may branch after any earlier main step whose end the edge leaves; a flow with
 * branches only after its branch step (edge case "A second branch point").
 */
function branchFromStep(analysis: ReturnType<typeof analyzeFlow>, from: string): string | null {
  if (analysis.branchStepId !== null) {
    const branchStep = analysis.byStepId.get(analysis.branchStepId);
    return branchStep?.to === from ? analysis.branchStepId : null;
  }
  const earlier = analysis.main.slice(0, -1).filter((s) => !s.broken && s.to === from);
  return earlier.at(-1)?.step.id ?? null;
}

/** The outcome of clicking `edgeId`, or `null` when the edge does not exist. */
export function recordEdge(
  deck: SododeckFile,
  session: FlowSession,
  edgeId: string,
): RecordResult | null {
  const edge = deck.edges.find((e) => e.id === edgeId);
  if (edge === undefined) return null;
  const flow = findFlow(deck, session.flowId);
  if (flow === undefined) {
    return {
      kind: 'create',
      title: session.pendingTitle,
      featureId: session.featureId,
      edge: edgeId,
    };
  }
  const analysis = analyzeFlow(flow, deck.edges);
  const path = sessionPath(analysis, session.target);
  if (path.nextStart === null || edge.from === path.nextStart) {
    return { kind: 'append', branchId: path.branchId, edge: edgeId };
  }
  return {
    kind: 'invalid',
    stepNumber: path.nextNumber,
    branchFromStep: branchFromStep(analysis, edge.from),
  };
}
