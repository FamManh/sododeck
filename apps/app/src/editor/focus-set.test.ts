import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { bundleEdges } from './bundles';
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

describe('focus sets with bundles and proxies (034 T020)', () => {
  const deck = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A' },
      { id: 'b', type: 'service', title: 'B' },
      { id: 'c', type: 'service', title: 'C' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
      { id: 'e3', from: 'a', to: 'c' },
    ],
  });
  const graph = visibleGraph(deck, { node: null, group: null }, new Set());
  const none = new Set<string>();

  it('counts a folded bundle as one connection, by its bundle id', () => {
    const bundles = bundleEdges(deck, graph, { exclude: none, fanned: none, off: false });
    const set = focusSet(deck, graph, 'a', bundles);
    expect(set?.edges).toEqual(new Set(['bundle:a|b', 'e3']));
    expect(set?.members).toEqual(new Set(['a', 'b', 'c']));
    expect(set === null ? 0 : connectionCount(set, graph, bundles)).toBe(3);
  });

  it('lists the connectors of a fanned bundle by their own ids, and keeps the pill', () => {
    const bundles = bundleEdges(deck, graph, {
      exclude: none,
      fanned: new Set(['bundle:a|b']),
      off: false,
    });
    const set = focusSet(deck, graph, 'a', bundles);
    expect(set?.edges).toEqual(new Set(['e1', 'e2', 'e3', 'bundle:a|b']));
    expect(set === null ? 0 : connectionCount(set, graph, bundles)).toBe(4);
  });

  it('makes the outside proxy a neighbour of the inside cards it connects to', () => {
    const drilled = deckOf({
      nodes: [
        { id: 'in', type: 'service', title: 'In', group: 'core' },
        { id: 'other', type: 'service', title: 'Other', group: 'core' },
        { id: 'out', type: 'service', title: 'Out' },
      ],
      groups: [{ id: 'core', title: 'Core' }],
      edges: [
        { id: 'p1', from: 'out', to: 'in' },
        { id: 'p2', from: 'in', to: 'out' },
      ],
    });
    const g = visibleGraph(drilled, { node: null, group: 'core' }, new Set());
    const bundles = bundleEdges(drilled, g, { exclude: none, fanned: none, off: false });
    expect(focusSet(drilled, g, 'in', bundles)).toEqual({
      focusId: 'in',
      members: new Set(['in', 'port:out']),
      edges: new Set(['bundle:in|port:out']),
    });
    expect(focusSet(drilled, g, 'other', bundles)?.members).toEqual(new Set(['other']));
    expect(focusSet(drilled, g, 'in')?.edges).toEqual(new Set(['p1', 'p2']));
  });
});
