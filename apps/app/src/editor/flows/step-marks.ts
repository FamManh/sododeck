import type { PathStep } from '@sododeck/model';

import { touchedTables } from '../../db/touches';

/**
 * Where a card or connector sits relative to the current step of a played flow (035). Derived at
 * render time from the played path; nothing is stored (Principle I).
 */
export type StepState = 'played' | 'current' | 'upcoming';

export interface NodeStepMark {
  state: StepState;
  /** Step number to print; `null` for played cards (they show ✓). */
  number: string | null;
}

const RANK: Record<StepState, number> = { upcoming: 0, played: 1, current: 2 };

/**
 * The mark of every card the played path touches (research R1). The current card is the target of
 * the current step; the source of the current step and of step 1, and every earlier target, are
 * played; later targets are upcoming and show the first later step that reaches them. A card
 * reached more than once keeps its most advanced state (current > played > upcoming). Broken steps
 * have no cards, so they mark nothing. The tables the current step reads or writes (049) are
 * current too, at whatever level they are drawn. One pass, O(steps + touches).
 */
export function stepMarks(
  steps: readonly PathStep[],
  currentIndex: number,
): Map<string, NodeStepMark> {
  const marks = new Map<string, NodeStepMark>();
  if (steps[currentIndex] === undefined) return marks;

  const raise = (nodeId: string | null, mark: NodeStepMark) => {
    if (nodeId === null) return;
    const existing = marks.get(nodeId);
    if (existing === undefined || RANK[mark.state] > RANK[existing.state]) {
      marks.set(nodeId, mark);
    }
  };

  steps.forEach((s, k) => {
    if (s.broken) return;
    if (k === 0 || k === currentIndex) raise(s.from, { state: 'played', number: null });
    if (k < currentIndex) raise(s.to, { state: 'played', number: null });
    else if (k === currentIndex) raise(s.to, { state: 'current', number: s.number });
    else raise(s.to, { state: 'upcoming', number: s.number });
  });
  const current = steps[currentIndex];
  for (const tableId of touchedTables(current.step).keys()) {
    raise(tableId, { state: 'current', number: current.number });
  }
  return marks;
}

/** A connector's state from the position of its step on the played path. */
export function edgeStateOf(pathIndex: number, currentIndex: number): StepState {
  if (pathIndex < currentIndex) return 'played';
  return pathIndex === currentIndex ? 'current' : 'upcoming';
}
