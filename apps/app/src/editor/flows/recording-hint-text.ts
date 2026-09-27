import type { SododeckFile } from '@sododeck/schema';

import type { FlowSession } from '../../state/ui-store';
import { candidateEdges } from './candidate-edges';
import { analysisOf } from './flow-session';
import { nodeTitle, sessionPath } from './session-path';

/** What to click next (FR-009, US2 #4, edge case "Deck with no connections"). */
export function recordingHint(deck: SododeckFile, session: FlowSession): string {
  if (deck.edges.length === 0) {
    return 'A flow needs connections. Draw some on the canvas first.';
  }
  const analysis = analysisOf(deck, session.flowId);
  const path = sessionPath(analysis, session.target);
  if (path.nextStart === null) return 'Click any connection to add step 1.';
  const node = nodeTitle(deck, path.nextStart);
  if (candidateEdges(deck, analysis, session.target).length === 0) {
    return `This flow can't continue from ${node}. Press Done, or add a branch.`;
  }
  if (path.branchId !== null && path.steps.length === 0) return `Click an edge leaving ${node}`;
  return `Next: click an edge leaving ${node}`;
}
