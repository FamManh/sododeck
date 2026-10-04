import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { currentFlowStep } from './current-step';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'client', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
    { id: 'c', type: 'database', title: 'C' },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
  ],
  flows: [
    {
      id: 'f',
      title: 'F',
      steps: [
        { id: 's1', edge: 'ab' },
        { id: 's2', edge: 'bc' },
      ],
    },
  ],
});

const active = (stepId: string | null) => ({
  flowId: 'f',
  stepId,
  branchId: null,
  alternativeId: null,
  playing: false,
  speed: 1 as const,
});

describe('currentFlowStep (049)', () => {
  it('is the chosen step in flow mode, step 1 when none is chosen', () => {
    expect(currentFlowStep(deck, { activeFlow: active('s2'), flowSession: null })?.id).toBe('s2');
    expect(currentFlowStep(deck, { activeFlow: active(null), flowSession: null })?.id).toBe('s1');
  });

  it('is null outside flow mode or for a missing flow', () => {
    expect(currentFlowStep(deck, { activeFlow: null, flowSession: null })).toBeNull();
    expect(
      currentFlowStep(deck, { activeFlow: { ...active('s1'), flowId: 'x' }, flowSession: null }),
    ).toBeNull();
  });

  it('returns the same step object for the same inputs', () => {
    const state = { activeFlow: active('s2'), flowSession: null };
    expect(currentFlowStep(deck, state)).toBe(currentFlowStep(deck, state));
  });
});
