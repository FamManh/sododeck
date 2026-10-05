import type { Group, Node } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { descendantNodeIds } from '../src';

const node = (id: string, group?: string): Node => ({
  id,
  type: 'service',
  title: id,
  ...(group === undefined ? {} : { group }),
});
const group = (id: string, parent?: string): Group => ({
  id,
  title: id,
  ...(parent === undefined ? {} : { parent }),
});

describe('descendantNodeIds', () => {
  const deck = {
    nodes: [
      node('a', 'outer'),
      node('b', 'inner'),
      node('c', 'inner'),
      node('d'),
      node('e', 'other'),
    ],
    groups: [group('outer'), group('inner', 'outer'), group('empty'), group('other')],
  };

  it('returns the cards of the group and of nested groups', () => {
    expect([...descendantNodeIds(deck, 'outer')].sort()).toEqual(['a', 'b', 'c']);
    expect([...descendantNodeIds(deck, 'inner')].sort()).toEqual(['b', 'c']);
  });

  it('is empty for an empty group and for an unknown id', () => {
    expect(descendantNodeIds(deck, 'empty')).toEqual([]);
    expect(descendantNodeIds(deck, 'nope')).toEqual([]);
  });

  it('has no duplicates', () => {
    const ids = descendantNodeIds(
      { nodes: deck.nodes, groups: [...deck.groups, group('outer')] },
      'outer',
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not loop on a cyclic parent chain', () => {
    const cyclic = {
      nodes: [node('x', 'g1'), node('y', 'g2')],
      groups: [group('g1', 'g2'), group('g2', 'g1')],
    };
    expect([...descendantNodeIds(cyclic, 'g1')].sort()).toEqual(['x', 'y']);
  });
});
