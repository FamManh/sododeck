import { describe, expect, it } from 'vitest';

import { deckOf } from '../../test/render-canvas';
import { commonParent } from './common-parent';

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', group: 'inner' },
    { id: 'b', type: 'service', title: 'B', group: 'inner' },
    { id: 'c', type: 'service', title: 'C', group: 'outer' },
    { id: 'd', type: 'service', title: 'D', group: 'side' },
    { id: 'top', type: 'service', title: 'Top' },
  ],
  groups: [
    { id: 'outer', title: 'Outer' },
    { id: 'inner', title: 'Inner', parent: 'outer' },
    { id: 'deep', title: 'Deep', parent: 'inner' },
    { id: 'side', title: 'Side' },
  ],
});

describe('commonParent (016 R11)', () => {
  it('is the innermost group holding every item', () => {
    expect(commonParent(deck, { nodes: ['a', 'b'], groups: [] })).toBe('inner');
    expect(commonParent(deck, { nodes: ['a', 'c'], groups: [] })).toBe('outer');
    // A group's own container counts, never the group itself.
    expect(commonParent(deck, { nodes: ['a'], groups: ['deep'] })).toBe('inner');
    expect(commonParent(deck, { nodes: ['c'], groups: ['inner'] })).toBe('outer');
  });

  it('is the top level (undefined) when nothing is shared', () => {
    expect(commonParent(deck, { nodes: ['a', 'd'], groups: [] })).toBeUndefined();
    expect(commonParent(deck, { nodes: ['a', 'top'], groups: [] })).toBeUndefined();
    expect(commonParent(deck, { nodes: [], groups: [] })).toBeUndefined();
    expect(commonParent(deck, { nodes: [], groups: ['outer'] })).toBeUndefined();
  });
});
