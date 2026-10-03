import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { connectionCount, connectionsText, focusSet } from './focus-set';
import { visibleGraph } from './visible-graph';

describe('focusSet', () => {
  it('returns the focused node, its visible neighbours, and the connecting edges', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A' },
        { id: 'b', type: 'service', title: 'B' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set());
    expect(focusSet(deck, graph, 'b')).toEqual({
      focusId: 'b',
      members: new Set(['a', 'b', 'c']),
      edges: new Set(['ab', 'bc']),
    });
  });

  it('focuses a collapsed card and its merged neighbours', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set(['core']));
    expect(focusSet(deck, graph, 'collapsed:core')).toEqual({
      focusId: 'collapsed:core',
      members: new Set(['collapsed:core', 'c']),
      edges: new Set(['merged:c|collapsed:core']),
    });
  });

  it('returns null for an element not visible in the graph', () => {
    const deck = deckOf({
      nodes: [
        { id: 'parent', type: 'service', title: 'Parent' },
        { id: 'child', type: 'service', title: 'Child', parent: 'parent' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set());
    expect(focusSet(deck, graph, 'child')).toBeNull();
  });
});

describe('connection counts (034)', () => {
  it('counts every connector a merged connector folds, and words the announcement', () => {
    const deck = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A', group: 'core' },
        { id: 'b', type: 'service', title: 'B', group: 'core' },
        { id: 'c', type: 'service', title: 'C' },
        { id: 'd', type: 'service', title: 'D' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'ac', from: 'a', to: 'c' },
        { id: 'bc', from: 'b', to: 'c' },
        { id: 'cd', from: 'c', to: 'd' },
      ],
    });
    const graph = visibleGraph(deck, { node: null, group: null }, new Set(['core']));
    const set = focusSet(deck, graph, 'c');
    expect(set === null ? 0 : connectionCount(set, graph)).toBe(3);
    expect(connectionsText('C', 3)).toBe('C: 3 connections');
    expect(connectionsText('C', 1)).toBe('C: 1 connection');
    expect(connectionsText('C', 0)).toBe('C: 0 connections');
  });
});
