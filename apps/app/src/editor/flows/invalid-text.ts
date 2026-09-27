import type { FlowAnalysis } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';

import type { FlowSession, InvalidClick } from '../../state/ui-store';
import { nodeTitle, sessionPath } from './session-path';

/** The text of a refused click, shared by the popover and the step list (FR-010). */
export function invalidText(
  deck: SododeckFile,
  analysis: FlowAnalysis | null,
  session: FlowSession,
  invalid: InvalidClick,
): { title: string; body: string; route: string; start: string } {
  const edge = deck.edges.find((e) => e.id === invalid.edgeId);
  const start = nodeTitle(deck, sessionPath(analysis, session.target).nextStart);
  const from = nodeTitle(deck, edge?.from ?? null);
  return {
    title: `Can't add this edge as step ${invalid.stepNumber}`,
    body: `It doesn't start at ${start}. It starts at ${from}; step ${invalid.stepNumber} has to leave ${start}.`,
    route: `${from} → ${nodeTitle(deck, edge?.to ?? null)}`,
    start,
  };
}
