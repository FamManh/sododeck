import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION, type Selection } from '../../state/ui-store';
import { targetOf } from './use-action-context';

const sel = (patch: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...patch });

describe('targetOf', () => {
  it('is the canvas when nothing is selected', () => {
    expect(targetOf(EMPTY_SELECTION)).toEqual({ kind: 'canvas' });
  });

  it('names one or several components', () => {
    expect(targetOf(sel({ nodes: ['a'] }))).toEqual({
      kind: 'component',
      ids: sel({ nodes: ['a'] }),
    });
    expect(targetOf(sel({ nodes: ['a', 'b'] })).kind).toBe('components');
  });

  it('names one connection, one group and only stickies', () => {
    expect(targetOf(sel({ edges: ['e'] })).kind).toBe('connection');
    expect(targetOf(sel({ groups: ['g'] })).kind).toBe('group');
    expect(targetOf(sel({ stickies: ['s'] })).kind).toBe('sticky');
    expect(targetOf(sel({ stickies: ['s', 't'] })).kind).toBe('sticky');
  });

  it('is mixed for anything else', () => {
    expect(targetOf(sel({ edges: ['e', 'f'] })).kind).toBe('connections');
    expect(targetOf(sel({ edges: ['e'], stickies: ['s'] })).kind).toBe('mixed');
    expect(targetOf(sel({ groups: ['g', 'h'] })).kind).toBe('mixed');
    expect(targetOf(sel({ nodes: ['a'], edges: ['e'] })).kind).toBe('mixed');
    expect(targetOf(sel({ nodes: ['a'], groups: ['g'] })).kind).toBe('mixed');
    expect(targetOf(sel({ nodes: ['a'], stickies: ['s'] })).kind).toBe('mixed');
  });
});
