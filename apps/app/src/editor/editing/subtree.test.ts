import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { groupAncestors, groupSubtree } from './subtree';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'inner' },
    { id: 'b', type: 'service', title: 'B', group: 'outer' },
    { id: 'c', type: 'service', title: 'C' },
    { id: 'hidden', type: 'queue', title: 'Hidden', group: 'inner', tags: ['hide'] },
    { id: 'x', type: 'service', title: 'X', group: 'loop1' },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'side', title: 'Side' },
    { id: 'loop1', title: 'L1', parent: 'loop2' },
    { id: 'loop2', title: 'L2', parent: 'loop1' },
  ],
});

describe('groupSubtree (016)', () => {
  it('collects members and nested groups recursively, hidden members included', () => {
    expect(groupSubtree(deck, ['outer'])).toEqual({
      nodes: ['a', 'b', 'hidden'],
      groups: ['outer', 'inner'],
    });
    expect(groupSubtree(deck, ['inner'])).toEqual({ nodes: ['a', 'hidden'], groups: ['inner'] });
  });

  it('is safe with parent cycles and repeated or unknown ids', () => {
    expect(groupSubtree(deck, ['loop1', 'loop1'])).toEqual({
      nodes: ['x'],
      groups: ['loop1', 'loop2'],
    });
    expect(groupSubtree(deck, ['gone'])).toEqual({ nodes: [], groups: [] });
    expect(groupSubtree(deck, [])).toEqual({ nodes: [], groups: [] });
  });
});

describe('groupAncestors', () => {
  it('walks up the parent chain, innermost first, and stops on cycles', () => {
    expect(groupAncestors(deck, 'inner')).toEqual(['inner', 'outer']);
    expect(groupAncestors(deck, undefined)).toEqual([]);
    expect(groupAncestors(deck, 'loop1')).toEqual(['loop1', 'loop2']);
  });
});
