import { Button } from '@sododeck/ui/components/button';
import { TriangleAlert } from 'lucide-react';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import { exitFlow } from '../flows/flow-mode';
import { problemCountLabel } from './problem-kinds';
import { focusFirstProblem } from './problems-dom';
import { useProblems } from './use-problems';

/**
 * Amber "n problems" in the canvas toolbar (015 FR-024, design 60), absent without problems. It
 * leaves flow mode, clears the selection so the deck inspector shows the list, and focuses its
 * first row. A recording or edit session keeps the flow inspector, so it waits until it ends.
 */
export function ProblemsButton() {
  const total = useProblems()?.total ?? 0;
  const inSession = useUiStore((s) => s.flowSession !== null);
  if (total === 0) return null;
  return (
    <Button
      className="border-amber-ink bg-amber-soft text-amber-ink shadow-rest hover:bg-amber-soft"
      disabled={inSession}
      title={inSession ? 'Finish the flow first' : 'Show problems · ⌘.'}
      onClick={() => {
        if (isFlowMode(useUiStore.getState())) exitFlow();
        useUiStore.getState().clearSelection();
        requestAnimationFrame(() => {
          focusFirstProblem();
        });
      }}
    >
      <TriangleAlert />
      {problemCountLabel(total)}
    </Button>
  );
}
