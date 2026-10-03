import type { EdgeFlowMark, EdgeFlowStyle } from './flows/flow-overlay';
import type { StepState } from './flows/step-marks';

export type FlowStrokeKey = EdgeFlowStyle | StepState;

export interface FlowStroke {
  stroke: string;
  width: number;
  dash?: string;
  /** Round caps turn a short dash into a dot (the upcoming connector). */
  cap?: 'round';
}

/**
 * Stroke of a flow mark (006 research R6, 035 FR-009). `played`, `current` and `upcoming` are the
 * playback states; the others are recording and overview styles. Never colour alone: weight and
 * dash tell played, current, upcoming and error apart, and error paths also end in ×.
 */
export const FLOW_STROKES: Readonly<Record<FlowStrokeKey, FlowStroke>> = {
  played: { stroke: 'var(--color-ink-secondary)', width: 2.5 },
  current: { stroke: 'var(--color-deck-orange)', width: 3.25 },
  upcoming: { stroke: 'var(--color-ink-secondary)', width: 2.5, dash: '2 6', cap: 'round' },
  path: { stroke: 'var(--color-primary)', width: 2 },
  error: { stroke: 'var(--color-clay-ink)', width: 2.5, dash: '7 4' },
  candidate: { stroke: 'var(--color-primary)', width: 1.5, dash: '2 4' },
  preview: { stroke: 'var(--color-primary)', width: 2.5, dash: '2 4' },
  invalid: { stroke: 'var(--color-clay-ink)', width: 2, dash: '6 4' },
};

/**
 * Which stroke a mark draws. On the played path (flow mode) the state picks it, except that an
 * error path keeps its Clay dashes in every state; elsewhere the recording style applies.
 */
export function flowStrokeKey(mark: EdgeFlowMark): FlowStrokeKey {
  const state = mark.current != null ? 'current' : mark.inPath === true ? mark.state : undefined;
  if (state === undefined) return mark.style;
  return mark.style === 'error' ? 'error' : state;
}
