/**
 * The step flow mode is on (049), for views that must follow it without a React hook: the view
 * projection draws the rows that step touches. The same resolution as `playbackOf` (the played
 * path, step 1 when none is chosen), cached per flow object, edges and the store's ids, so
 * re-renders that change neither reuse it.
 */
import { analyzeFlow } from '@sododeck/model';
import type { Flow, SododeckFile, Step } from '@sododeck/schema';

import { isFlowMode, type UiState } from '../../state/ui-store';
import { currentOf, playedPath } from './played-path';

interface Cached {
  edges: SododeckFile['edges'];
  alternativeId: string | null;
  stepId: string | null;
  step: Step | null;
}

const cache = new WeakMap<Flow, Cached>();

/** The current step in flow mode, or null (not in flow mode, empty flow, flow gone). */
export function currentFlowStep(
  deck: Pick<SododeckFile, 'flows' | 'edges'>,
  state: Pick<UiState, 'activeFlow' | 'flowSession'>,
): Step | null {
  const active = state.activeFlow;
  if (active === null || !isFlowMode(state)) return null;
  const flow = deck.flows.find((f) => f.id === active.flowId);
  if (flow === undefined) return null;
  const known = cache.get(flow);
  if (
    known?.edges === deck.edges &&
    known.alternativeId === active.alternativeId &&
    known.stepId === active.stepId
  ) {
    return known.step;
  }
  const played = playedPath(analyzeFlow(flow, deck.edges), active.alternativeId);
  const step = currentOf(played, active.stepId)?.step ?? null;
  cache.set(flow, {
    edges: deck.edges,
    alternativeId: active.alternativeId,
    stepId: active.stepId,
    step,
  });
  return step;
}
