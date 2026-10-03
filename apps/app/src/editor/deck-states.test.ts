import { describe, expect, it } from 'vitest';

import { deckStateClasses, type DeckStateFlags } from './deck-states';

const none: DeckStateFlags = {
  selected: false,
  hasProblem: false,
  connectTarget: false,
  connectRefused: false,
  currentStep: false,
};
const classes = (patch: Partial<DeckStateFlags>) => deckStateClasses({ ...none, ...patch });

describe('deckStateClasses (029 US2)', () => {
  it('is empty for a resting card', () => {
    expect(classes({})).toEqual([]);
  });

  it('names each state', () => {
    expect(classes({ selected: true })).toEqual(['selected']);
    expect(classes({ hasProblem: true })).toEqual(['has-problem']);
    expect(classes({ connectTarget: true })).toEqual(['connect-target']);
    expect(classes({ connectRefused: true })).toEqual(['connect-refused']);
    expect(classes({ currentStep: true })).toEqual(['current-step']);
  });

  it('keeps selected and problem side by side', () => {
    expect(classes({ selected: true, hasProblem: true })).toEqual(['selected', 'has-problem']);
  });

  it('keeps the current step and a problem side by side', () => {
    expect(classes({ currentStep: true, hasProblem: true })).toEqual([
      'has-problem',
      'current-step',
    ]);
  });

  it('keeps every state when all are on', () => {
    expect(
      classes({
        selected: true,
        hasProblem: true,
        connectTarget: true,
        connectRefused: true,
        currentStep: true,
      }),
    ).toEqual(['selected', 'has-problem', 'connect-target', 'connect-refused', 'current-step']);
  });
});
