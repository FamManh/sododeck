import { describe, expect, it } from 'vitest';

import { stickyFlowState, type NotesDisplay } from './sticky-flow';

const plain = {};
const always = { showInFlows: true as const };

function state(
  sticky: { showInFlows?: boolean },
  options: Partial<{ flowMode: boolean; display: NotesDisplay; emptyFlow: boolean }> = {},
) {
  return stickyFlowState(sticky, {
    flowMode: true,
    display: 'dimmed',
    emptyFlow: false,
    ...options,
  });
}

describe('stickyFlowState', () => {
  it('is normal outside flow mode', () => {
    expect(state(plain, { flowMode: false })).toBe('normal');
  });

  it('honors hidden and shown display modes', () => {
    expect(state(plain, { display: 'hidden' })).toBe('hidden');
    expect(state(always, { display: 'hidden' })).toBe('hidden');
    expect(state(plain, { display: 'shown' })).toBe('normal');
  });

  it('dims every note while a flow plays, unless it stays visible (ADR 0041: no pinning)', () => {
    expect(state(plain)).toBe('dimmed');
    expect(state(always)).toBe('normal');
  });

  it('keeps every note normal in an empty flow', () => {
    expect(state(plain, { emptyFlow: true })).toBe('normal');
  });
});
